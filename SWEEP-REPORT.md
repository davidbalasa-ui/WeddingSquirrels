# Field sweep · People and contacts (worktree wt/people, port 3302, DB wedding_people)

Scope: /people hub (All / Vendors / Day-of tabs; Guests tab belongs to the Guests worker),
/people/vendors, /people/family, /people/party, /people/[profileId], and the orphan VendorEntryList.

Spec: e2e/overnight/fields-people.spec.ts (desktop + phone projects).

## Findings

### 1. /people?tab=day-of · Add day-of contact form · Name
- What I did: opened "Add or edit day-of contacts" → "Add day-of contact", typed three spaces as the name and "123" as the phone, pressed "Add person".
- What happened: the HTML `required` check let the spaces through, the server action silently returned (`if (!name) return;`), the form closed as if it had saved, and nothing was created. The typed phone was gone too.
- What should happen: the app says what is missing and keeps the form (and the phone) on screen.
- Status: fixed (ContactsPanel.tsx: `onSubmit` trims the name, prevents the action and shows "Add a name before saving."; the message clears when the name is edited).
- Proof: fields-people.spec.ts::"submitting the new-contact form with a blank name says so and keeps the phone typed"

### 2. /people/[profileId] · "Remove from Day-of Contacts" on a contact added from the Day-of tab
- What I did: added a contact on the Day-of tab, opened its profile, tapped "Remove from Day-of Contacts", reloaded.
- What happened: the button stayed on "Remove from Day-of Contacts" after reload. `createContact` stores such a contact with `directoryList: "day-of"`, the toggle only flipped `isDayOfContact` to false, and the profile's `resolveIsDayOfContact` still reads `directoryList === "day-of"` as "on the call list". The same thing happened for a Person profile whose linked Contact/GuestPerson rows still carried the flag (Person.isDayOfContact alone was cleared).
- What should happen: removing takes the person off the call list and the button reads "Add to Day-of Contacts" after reload.
- Status: fixed (people-identity-write.ts: turning the flag off also normalises a `day-of` list to the ordinary contact list `vendors` — the same list `createContact` gives a non-day-of contact — and clears the flag on rows linked to the Person; turning it on is unchanged, so the existing "linked contact preserved" tests still hold). Unit tests added in people-identity-write.test.ts.
- Proof: fields-people.spec.ts::"Remove from Day-of Contacts on a contact added from the Day-of tab actually takes it off the call list"

### 3. /people?tab=day-of · contact added with "Add day-of contact" does not appear in the Day-of tab's list
- What I did: added "Test Dayof B" from the Day-of tab form, looked at the entry list above the form, then at the All and Vendors tabs.
- What happened: the new contact appears in the collapsible "Call list" panel and on the All tab, but not in the Day-of tab's list itself (nor in its tab count), because `filterEntriesByTab("day-of")` requires a guest/vendor list and `resolvePrimaryList({directoryList:"day-of"})` is deliberately `null` (both pinned by unit tests: "unlisted person records must not appear on day-of").
- What should happen: unclear — either the Day-of tab should list it, or "Add day-of contact" should also put the contact on the Vendors list.
- Status: judgement call for David because the two rules contradict each other and both are tested as intended; changing either changes which tab people land on. Not changed.
- Proof: observed in exploration (test-artifacts/sweep/phone-dayof-tab.png); no spec, nothing changed.

### 4. /people?tab=day-of · Add day-of contact form · Email
- What I did: typed "not an email" and saved.
- What happened: saved as typed (the field is `inputMode="email"`, not `type="email"`), whereas the profile's "Edit contact info" email field is `type="email"` and blocks the same value.
- What should happen: consistent behaviour; either is defensible (a note like "text Sam" in an email field would be blocked by `type="email"`).
- Status: not a bug / judgement call for David — left as is; the value is stored exactly as typed and shown as a mailto link.
- Proof: observed in exploration.

### 5. Orphan `VendorEntryList` (src/components/VendorEntryList.tsx)
- Not rendered by any route (`grep -rn VendorEntryList src` finds only the file itself). Its "Total owed" / "Paid" inputs call `saveBudgetAmounts(id, Number(price), Number(paid))` on blur, so clearing a field would save 0 and "abc" would save NaN→0. Not reachable in the app, so not fixed and not wired up; if the component is ever rendered again, commit on blur with explicit empty handling (see GuestRsvpControls) before shipping it.

### 6. /people/[profileId] and the Day-of form · page shows the OLD value right after a successful save (intermittent)
- What I did: saved through the profile editors (Edit name, Edit role, Edit contact info, Household phone, Mailing address) and the Day-of "Add person" form, then watched the page without reloading.
- What happened: roughly 1 run in 4-5 (both desktop and phone, more often while the box was busy with the other workers' builds) the form closed as saved, the database already had the new value (the spec polls Prisma first), but the heading / role line / contact list still showed the old value and kept showing it for the 10 s assertion window; a reload showed the new value. Seen with every refresh pattern in these components: `<form action>` + `router.refresh()` (ContactsPanel/createContact), `startTransition(await action; router.refresh())` with the action calling `revalidatePath` only (PeopleRoleEditor/saveDirectoryLabel), and the same with the action also calling `refresh()` from next/cache (PeopleNameEditor, PeopleGuestAddressEditor, PeopleGuestPhoneEditor, PeopleContactEditor). An experiment that removed the client `router.refresh()` where the action already calls `refresh()` did not make it go away, so it was reverted.
- What should happen: the page shows what was just saved.
- Status: judgement call for David / needs a deeper look at how the Next 16 client router applies the revalidated tree from the action response versus the follow-up `router.refresh()` under load; nothing in the data path is wrong (the value is saved, the next render shows it). Not changed. The spec therefore checks the database first and reloads before reading the page (marked `// finding 6`), so it does not fail on this.
- Proof: traces from the failing runs showed the DB poll passing and the stale text on screen (test-artifacts/overnight/output/*-phone/test-failed-1.png during the sweep); not pinned by a spec.

## Passed (full script, desktop and phone)
- /people · tab links All / Vendors / Day-of (URL-driven, counts shown, no sideways scroll at 412px).
- /people, /people/vendors · "Search people/vendors" search box: type, select-all+Delete, whitespace-only (shows everyone), no-match message, Enter (does not submit/navigate), Escape, no console errors.
- /people/family, /people/party · read-only lists open clean.
- Day-of form · Name (odd characters `<b>x</b> ' " \` 🎉` round-trip exactly), Phone (" 007 " → "007" trimmed; clear → null), Email (clear → null), Add/Change/Remove photo (resized data URL stored, Remove stores null via `clearPhoto`), Enter in a text field submits the form, Escape keeps the typed text, Cancel discards, Edit, Delete (confirm dialog).
- Profile · Edit contact info: Name (blank/whitespace disables Save), Phone (0 → clear → 9 saves "9"; clear → null; Enter submits), Email (`type="email"` blocks malformed; clear → null); name change cascades to the linked Person.
- Profile · Edit role: Enter saves, whitespace clears to null and the label disappears after reload.
- Profile · "Add a role" select: shows the current list; re-selecting is a no-op; choosing "Guest list" on a contact converts it to a Person with a guest household and navigates to the new profile id.
- Profile · Add / Change / Remove photo (guest and contact records), no confirm on Remove (by design, noted in inventory).
- Profile · Delete person (confirm dialog, lands on /people, row gone).
- Guest profile · Edit name (blank disables Save, surrounding spaces trimmed, Enter saves, cascades to Person/Contact/GuestPerson), Household phone (0 → clear → 9; whitespace → null and "No phone yet."), Mailing address Street/City/State/ZIP (Enter in ZIP saves all four, `<b>` kept literally, "00700" keeps its leading zeros, clearing all four stores null and shows "No mailing address yet."), RSVP radios (optimistic, persists after reload), Day-of toggle on/off (guest kind), Log out.
- Copy oddity (not changed): when a profile has no role label the role line reads "Add a note" next to an "Edit role" button.

## Coverage
Inventory fields in this section: /people hub 10, /people/vendors 1, /people/family + /people/party 0, /people/[profileId] 13, orphan VendorEntryList 4 (not reachable). Exercised: 24 of 24 reachable fields; the 4 orphan fields were reviewed in code only.

## Notes for the merge
- Lint: `npm run lint` reports 6 pre-existing `react-hooks/set-state-in-effect` errors in files this sweep did not touch (DayNowNext, DayOfExperience, InboxBoard, OfflineSetupCard, PeopleProfilePhotoEditor, PeopleRsvpEditor); the changed files lint clean apart from the pre-existing `<img>` warning in ContactsPanel.
- The hub-lists test allows the console message "Failed to fetch": jumping between six pages faster than a person can cancels in-flight prefetches, which `attachGuards` would otherwise count as a page error.
- The shared Postgres hit `max_connections` (100, since raised to 400) several times during the sweep: nine `next start` servers each keep a 9-connection Prisma pool. This worktree's .env now carries `connection_limit=3`; the restart script's `pkill -f "next start -p"` also misses the `next-server` process, so a rebuilt server failed with EADDRINUSE while the stale one served missing chunks (500s) — test-artifacts/sweep/restart.sh kills the listener by port instead.
