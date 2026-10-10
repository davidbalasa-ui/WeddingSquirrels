# Field sweep report · area `print` (print / accounts / more / no-access / login / offline)

Worktree `/home/claude/wt/print`, branch `wt/print`, server `http://127.0.0.1:3307`, DB `wedding_print`.
Spec: `e2e/overnight/fields-print.spec.ts` (desktop 1280x900 and phone Pixel 7).

Environment note: the shared local Postgres hit `max_connections=100` several times during the
sweep (eight workers x Prisma pools), which showed up as "Login failed. Try again." on the PIN pad
and "This page couldn't load" on app pages. Not an app bug; my `.env` now adds
`connection_limit=4&pool_timeout=30` to my own DATABASE_URL/OVERNIGHT_DATABASE_URL (local .env,
not committed) and the spec's `gotoReady` retries the waking page.

## Findings

### 1. /accounts · Edit account · "New PIN (optional reset)"
- What I did: Edit "Mother in law", typed `abc` into New PIN, pressed Save changes.
- What happened: Red text "An error occurred in the Server Components render. The specific message
  is omitted in production builds…" (the server's `PIN must be 4–8 digits` throw is masked by the
  production build; only create mode was validated on the client).
- What should happen: "PIN must be 4–8 digits", same as Add account.
- Status: fixed (AccountEditor.submit validates a non-empty PIN in edit mode too).
- Proof: fields-print.spec.ts::"edit: a non-digit PIN reset says PIN must be 4–8 digits instead of a production error blob"

### 2. / (login) · PIN pad · accounts whose PIN has 5–8 digits
- What I did: Created an account with an 8-digit PIN (the editor allows 4–8), then tapped the 8
  digits on the pad (slowly and fast).
- What happened: The pad auto-submits at the 4th digit; taps while that attempt is pending are
  ignored; the "Incorrect PIN" result clears the pad. Every attempt therefore restarts at digit 1
  and the "Unlock" button (shown at >4 digits) can never appear. A person with a 5–8 digit PIN is
  locked out, and the master who set that PIN gets no warning.
- What should happen: Either the pad lets a longer PIN be completed, or the editor only allows what
  the pad can enter.
- Status: judgement call for David — three product options, each changes behaviour someone relies on:
  (a) PINs are exactly 4 digits (editor + server rule; the 4–8 range becomes 4); existing longer
  PINs get reset by a master; (b) keep the digits on the pad after a failed 4-digit auto-attempt so
  the person can keep typing and press Unlock (a 4-digit mistype then needs ⌫ ×4 instead of
  clearing); (c) drop auto-submit and always press Unlock. (a) is the smallest and matches how the
  family actually uses it. Not changed here because it is a design choice, not a code slip.
- Proof: fields-print.spec.ts::"an 8-digit PIN can be entered and unlocked from the pad" (test.fixme, documents the trap)

### 3. /more · Offline panel · "Add to Home Screen" install guide
- What I did: Opened the install guide, pressed Escape.
- What happened: The guide stayed open (every other overlay in the app — account editor, preview,
  More sheet, photo picker — closes on Escape); only the Close button or the backdrop worked.
- What should happen: Escape closes it like the others.
- Status: fixed (OfflineSetupCard adds the same keydown listener while the guide is open).
- Proof: fields-print.spec.ts::"more: the install guide opens from Add to Home Screen and closes on Escape and on Close"

### 4. / (login) · PIN pad · physical keyboard
- What I did: On desktop, typed 0425 on the keyboard, pressed Enter and Escape.
- What happened: Nothing (no `<input>`; the pad is buttons only). No error, nothing lost, page stays.
- What should happen: Arguably a desktop user could type the PIN; by design the pad is tap-only.
- Status: not a bug (by design; keyboard does nothing harmful). Noted for David in case he wants
  keyboard entry — that would be a feature, not a fix.
- Proof: fields-print.spec.ts::"keyboard digits, Enter and Escape do nothing harmful on the pad"

### 5. /accounts · Account editor · stale error line
- What I did: Triggered "PIN must be 4–8 digits", then fixed the PIN and kept editing other fields.
- What happened: The red line stays until the next Save/Add press (it then clears or updates).
- What should happen: Acceptable; the message is still true until re-submitted.
- Status: not a bug (same pattern as other editors; the next submit clears it).

### 6. /accounts · Account editor · Escape / backdrop click discard typed text
- What I did: Typed a name in Add account, pressed Escape (also clicked the backdrop).
- What happened: Editor closes, draft gone, nothing saved (no "discard?" prompt).
- Status: by design (consistent with every overlay in the app; Delete does confirm). Judgement call
  only if David wants an "unsaved changes" prompt — not changed.

### 7. /print · open to every PIN
- What I did: Logged in as an account with no modules and opened /print.
- What happened: The page opens (the More tab links to it) and the document only contains the
  sections that account may see (`availableForSession`), so it prints a near-empty binder.
- Status: by design (`canSeeModule` returns true for print; content is gated per session).

## Passed (full script, both projects unless noted)

- / · PIN keys 0–9: tap 4 digits auto-submits; wrong PIN → "Incorrect PIN" and the dots clear,
  also for a second identical failure; 0425 → /today, 1016 → /today, 0999 (Mother in law: Tasks on)
  → /today; fast taps (no waiting between taps) unlock; a no-module account → /no-access;
  /accounts and /today for that account redirect to /no-access.
- / · Backspace: removes one digit; on an empty pad does nothing.
- / · Enter / Escape / typed digits: no effect, no error (see #4).
- Log out forms (TodayHero, AppHeader on /no-access and /more): clear the cookie, land on the pad;
  browser Back after logout still shows the pad (no cached app page).
- /accounts · Name: value shows and saves; leading/trailing whitespace trimmed on save; emoji,
  quotes, backticks, `<b>x</b>` saved and shown verbatim (no HTML interpretation); 2000-char name
  saves, card wraps, no sideways scroll (phone + desktop); empty and whitespace-only →
  "Name is required" (client), nothing written; Enter inside the field does not submit or lose text.
- /accounts · PIN (create): 0 → clear → 9 shows "9"; fast typing 8 digits keeps all 8; backspace to
  empty; "007", "123456789", " 7777 " (spaces), blank → "PIN must be 4–8 digits"; 8 digits
  accepted (but see #2); PIN field is cleared when re-opening the editor (hash only).
- /accounts · New PIN (edit): blank keeps the old PIN (the spec saves twice with it blank and then
  bcrypt-compares the original PIN against the stored hash); invalid → #1.
- /accounts · Linked person: choosing a person saves the id and shows "Linked: <name>"; back to
  "None" saves null and the line disappears.
- /accounts · Role preset cards: Vendor sets its flags; ticking one more box flips the active card
  to Custom; the footer counts "N modules enabled" / "N module changes".
- /accounts · Access grid See/Edit checkboxes (21 boxes): tick/untick round-trips; unchecking all
  saves every flag false (nothing snaps back on); Master editor shows the locked note, no grid.
- /accounts · Task filter pills: one checked → `["<id>"]`, card shows "Filter: <name>"; none →
  null (all tasks).
- /accounts · Shared tasks: tick saves a share row; untick removes it. Shared budget items: the
  seeded copy has no budget items ("No budget items yet." shown) so only the empty state was
  exercised.
- /accounts · Preview tabs: opens on top of the editor; Escape (and Close) closes only the preview
  and the editor keeps the typed values.
- /accounts · Duplicate: opens "Add account" seeded with "<name> (copy)"; Delete: confirm Cancel
  keeps the row, OK removes it (DB verified); master card has no Duplicate/Delete.
- /print · 8 packet cards: each becomes the only `aria-pressed` card, the document's kicker matches,
  Print / Save PDF calls `window.print` every time; 19 section checkboxes toggle on and off and the
  document follows; unticking a section drops the packet highlight (by design, see PrintCenter
  comment) but keeps the packet layout; all sections off leaves only the title page; reload returns
  to Groom's Binder; no sideways scroll on phone.
- /more · links (Accounts, Wedding Binder & Print, All modules) open; Offline panel status reads
  "Offline copy ready · updated …"; Update now re-syncs and re-enables; Open offline copy → /offline.
- /offline · 8 tab pills switch content (data-active), no sideways scroll on phone, "← Back to app"
  returns to /today; for a no-module account the pack is empty and the empty message shows.
- /no-access · renders for master and restricted accounts, Log out works.
- `DownloadOfflineButton` is not rendered anywhere in the app (grep: only its own file), so it has
  no user-facing field to exercise; its states were reviewed in code only.

## Coverage
Inventory fields in my section: /print 3, /accounts 10, /more 0 (+3 offline buttons), /no-access 0,
log out forms 1, PinPad 3, /offline tab buttons 1 = 21 inventory rows (plus the install-guide dialog
and the preview's Close). Exercised: all 21 (shared budget items only in their empty state).
