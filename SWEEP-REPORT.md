# Field sweep: Guests and RSVP (worktree wt/guests, port 3303, DB wedding_guests)

Pages: `/people?tab=guests&manage=1`, `/people?tab=guests&view=table`, `/guests/print`.
Components: GuestList, GuestPersonCard, GuestEditCard, GuestPhotoPicker, GiftPrintView.
Spec: `e2e/overnight/fields-guests.spec.ts` (10 tests x desktop + phone = 20, all passing on the rebuilt server).

Setup note: the seeded DB had 0 guests and the app has no screen that creates a household
(GuestEditCard's "+ Add person" / "Remove" paths are only rendered without `personId`, and
the only caller, GuestPersonCard, always passes one). The spec therefore seeds its own
"Test Guest One/Two/Three" households straight into the local test DB in each test.

Environment note: the shared local Postgres has max_connections=100 and eight `next start`
servers; my worker hit "sorry, too many clients already" twice. I added
`connection_limit=2&pool_timeout=30` to this worktree's (gitignored) `.env` only. Also,
`restart-worker.sh` did not actually kill the old `next-server` (the `pkill -f "next start -p"`
pattern misses the child), so the "new" server failed with EADDRINUSE while the old build
kept serving; I kill by cwd before restarting.

## Findings

### 1. Guest card · Person name (inline) · Escape
- What I did: in edit mode, clicked the name, typed "Test Guest One ESC", pressed Escape.
- What happened: the name reverted on screen but the typed draft was saved to the DB
  (`element.blur()` inside the Escape handler ran `commitName` with the still-typed `name`).
- What should happen: Escape discards the draft and nothing is saved.
- Status: fixed (GuestPersonCard.tsx: `cancelNameRef` set before blur, checked in `commitName`).
- Proof: fields-guests.spec.ts::"typing a new name and pressing Enter saves it; Escape puts the old name back instead of saving the draft"

### 2. Guest card · Seat form · Name + "Save guests"
- What I did: expanded a person, cleared the Name box in the seat form, tapped Save guests.
- What happened: the person was deleted from the household silently (payload dropped the blank
  name and `saveGuestPeople` deletes every existing person not in the payload). With RSVP,
  photo, seat gone. No message.
- What should happen: the form says a name is needed and keeps the person.
- Status: fixed (GuestEditCard.tsx `savePeople`: an existing person with a blank name shows
  "Every person needs a name." and nothing is sent). Brand-new, still-unnamed rows are still
  dropped (unreachable in the UI anyway).
- Proof: ::"wiping a person's name in the seat form and tapping Save guests says a name is needed instead of deleting the person"

### 3. Guest card · Table #
- What I did: typed "0" (vanished), "0" then "9" (showed "9"), "12b" (showed "12"), "007" (showed "7").
- What happened: the field stored a parsed number on every keystroke (`parseInt || null`), so
  0 could not be typed at all and typos were silently truncated.
- What should happen: the box shows what was typed; Save stores 0 as 0, "007" as 7, blank as
  no table, and refuses "12b" with a message.
- Status: fixed (string draft `tableNumberText` parsed on Save by the new pure helper
  `parseTableNumberInput` in src/lib/guest-gifts.ts, unit-tested in guest-gifts.test.ts; banner
  "Table # must be a whole number, like 9.").
- Proof: ::"Table # shows exactly what is typed: 0 stays 0, 007 saves as 7, 12b is refused with a message, blank means no table"

### 4. Guest card · Address / Table / Seat drafts wiped by another tap on the card
- What I did: typed a street and a table number, then (before Save guests) tapped the RSVP
  pill, then "+ Add gift".
- What happened: every unsaved address/table/seat value was blanked. Each of those actions
  revalidates the household, the new `guest` prop arrives and GuestEditCard reset its drafts
  from it unconditionally.
- What should happen: unsaved typing stays until the user saves or leaves.
- Status: fixed (GuestEditCard.tsx `dirty` flag: drafts are only replaced from a fresh `guest`
  when nothing is unsaved; cleared after a successful Save guests).
- Proof: ::"an address typed but not yet saved survives tapping the RSVP pill and Add gift on the same card"

### 5. Guest card · Photo picker · Upload photo with a file the browser cannot decode
- What I did: uploaded a file named .png whose bytes are not an image.
- What happened: `createImageBitmap` rejected inside `startTransition`, the error escaped,
  and the whole page was replaced by "This page couldn't load".
- What should happen: a message under the photo, page keeps working (that is what
  PeopleProfilePhotoEditor and ContactsPanel already do).
- Status: fixed (GuestPersonCard.tsx `handlePhotoUpload` catches and shows "That image
  couldn't be read. Try a JPEG or PNG."; a failed save shows "Couldn't save the photo").
- Proof: ::"uploading a photo saves it; a file that is not really an image shows a message instead of breaking the page"

### 6. Guest card · Gift description · clearing the text
- What I did: selected all + Delete in a saved gift's text box, tabbed away.
- What happened: the gift row (with its Written/Sent ticks) was deleted, no confirm.
- What should happen: unclear. There is an explicit "Remove gift" button, so the blank-means-
  delete path is a second, silent way to lose the record; but it also means a fully blank gift
  never lingers.
- Status: judgement call for David — left as is (saveGuestGift's contract). Note a gift
  added with "+ Add gift" and never typed in does linger as an empty "" row (commit() skips
  unchanged values), so the delete-on-blank only fires on previously saved text.
- Proof: covered by hand (test-artifacts/sweep/probe2.ts), not asserted in the spec.

### 7. Guest card · Person name (inline) · clearing the name
- What I did: cleared the inline name and tabbed away.
- What happened: the old name came back silently; nothing saved.
- What should happen: a person must have a name, so reverting is right; a hint would be nicer.
- Status: not a bug (server rejects blank names too). Spec asserts the revert.
- Proof: ::"clearing the name and tabbing away keeps the saved name (a person cannot be nameless)"

### 8. GuestEditCard · "+ Add person" / "Remove" / "Person N" labels
- Not reachable: GuestPersonCard always passes `personId`, which hides them. Noted only; no change.

### 9. Orphans (noted, not wired up, per the brief)
- `GuestRsvpControls` (src/components/GuestRsvpControls.tsx) is rendered by no route.
- `saveGuest(formData)` (actions.ts) has no UI caller.

## Passed (full script, desktop + phone)
- Search guests: filters cards live, "No guests matching your search." for no match, clearing restores all.
- Print gift list link / `/guests/print`: names, addresses, gifts and Print button; no sideways scroll.
- Edit guest (feather) toggle, Expand/Collapse chevron.
- Person photo: upload (8x8 PNG → resized JPEG data URL saved), picker Cancel/Escape.
- Role pill and RSVP pill: cycle, persist, survive reload.
- Phone: types, saves on blur, "   " stores null, emoji/dashes kept, survives reload.
- Street / City / State / ZIP: 2000-char street, emoji + quotes + `<b>x</b>` city, whitespace-only
  state → null, "007" ZIP kept as text, cleared fields → null; no layout break, no sideways scroll.
- Seat / spot: "  head  " trims to "head", cleared → null.
- Gifts: Add gift focuses the new row, Enter saves, quotes/emoji kept, Written and Sent persist
  (Sent also sets `thanked`), Remove gift deletes, survive reload.
- Fast typing (delay 0) in the inline name: no lost keystrokes; typing in Street while a
  refresh from a gift save lands: nothing lost.
- No console errors, page errors or 5xx in any test (attachGuards).

Fields exercised: 25 of 25 in the inventory section (plus the 3 orphan GuestRsvpControls fields
noted, not exercised, as instructed).
