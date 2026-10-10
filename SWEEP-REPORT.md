# Field sweep report · area `inbox` (Today / Messages)

Worktree `/home/claude/wt/inbox`, branch `wt/inbox`, DB `wedding_inbox`, server port 3306.
Spec: `e2e/overnight/fields-inbox.spec.ts` (projects desktop + phone).

## Findings

### 1. /today · Note editor · owners (Other → untick everyone)
- What I did: opened the feather editor on a task note, chose "Other", unticked every person, pressed Save; reloaded.
- What happened: the save returned fine, but the row still said "David · Haley" and the DB still had both TaskAssignee rows. `updateInboxTask` only called `setTaskAssignees` when the resolved list was non-empty (actions.ts:2489-2494), so "nobody" was silently ignored.
- What should happen: owners cleared to nobody; row shows "Unassigned" (the label already handles an empty list, and the /work editor already allows clearing).
- Status: fixed — `updateInboxTask` now always applies the resolved list.
- Proof: fields-inbox.spec.ts::"note editor: Other with nobody ticked clears the owners to Unassigned"

### 2. /today · Compose dock · Ask → "What do you need?" (blank / whitespace title)
- What I did: opened Ask, chose Haley, typed three spaces as the title, pressed Send ask.
- What happened: the form closed as if sent; nothing was created (the browser's `required` accepts whitespace, the server trims and returns silently, the client then `form.reset()` + closes).
- What should happen: the form stays open and says what is missing.
- Status: fixed — the Ask form checks the trimmed title / recipient before calling the action and shows "Add a short title." / "Choose who to ask." inline (same pattern the Task form already used). Switching the Ask/Task/Buy tab clears a stale message.
- Proof: fields-inbox.spec.ts::"Ask with a blank title says what is missing instead of closing the form"

### 3. /today · Compose dock · Buy → Item (blank / whitespace name)
- What I did: opened Buy, typed spaces, pressed Add to list.
- What happened: form closed, nothing added, no message.
- What should happen: stays open with "Add what to buy."
- Status: fixed (InboxAddBar buy form).
- Proof: fields-inbox.spec.ts::"Buy with a blank item name says what is missing instead of closing the form"

### 4. /messages · New message → "What is it about?" (blank / whitespace)
- What I did: New message → Haley, title of spaces, message "hello", Send.
- What happened: compose closed, the typed message was thrown away, nothing created.
- What should happen: stays open with the message intact and says "Add what it's about."
- Status: fixed (MessageThreadList checks the trimmed title before calling `createRequest`).
- Proof: fields-inbox.spec.ts::"new message with a blank subject says what is missing and keeps the form"

### 5. /today · Ask row (expanded) · edit form Title (blank / whitespace)
- What I did: expanded an open ask I sent, cleared the title to spaces, pressed Save.
- What happened: the server ignored it and the uncontrolled form snapped back to the old title with no message.
- What should happen: a message saying a title is needed; the old title stays.
- Status: fixed — the edit form's onSubmit stops a blank title and shows "Add a title." in the row's error slot.
- Proof: fields-inbox.spec.ts::"ask edit form with a blank title says Add a title and keeps the old one"

### 6. /today · Ask row · done/declined checkbox label
- What I did: declined an incoming ask, opened Done, inspected the ticked box.
- What happened: a declined ask shows a ✓ but its button was labelled "Mark done" (it actually reopens the ask on tap).
- What should happen: label matches what the tap does.
- Status: fixed — declined asks label the box "Reopen".
- Proof: fields-inbox.spec.ts::"declined ask checkbox is labelled Reopen and reopens the ask"

### 7. /today · Ask row · "Marked done · Undo"
- What I did: ticked an open ask done on the Today board (Waiting section).
- What happened: the row leaves the list on the server refresh, so the 5-second "Marked done. Undo" line under it is never seen; reopening works from Done (Show done) or from the conversation.
- What should happen: judgement call for David — either keep the row in place for the undo window or drop the undo line. Left as is (not a field bug; needs a layout decision).
- Status: judgement call for David.

### 8. /today · Row title inline rename (⋯ → Rename) · empty / whitespace
- What I did: Rename, cleared the box, pressed Enter / tabbed away.
- What happened: the row exits edit mode and keeps the old title; nothing saved, no message.
- What should happen: acceptable — the old title stays visible and editable; Escape also reverts. Recorded as by design (inline rename pattern), not changed.
- Status: not a bug because the old value stays and nothing is written.

### 9. /messages/[id] · Composer · Enter on a phone keyboard labelled "send"
- What I did: typed, pressed Enter (desktop and Pixel 7 project).
- What happened: Enter inserts a newline on both; Ctrl/Cmd+Enter and the Send button send. The textarea sets `enterKeyHint="send"`, so a phone keyboard shows a "send" key that inserts a newline.
- What should happen: judgement call for David — either send on Enter from a phone, or change the key hint to "enter". Not changed (behaviour choice, not a data bug).
- Status: judgement call for David.

## Passed (ran the full script, no issue)
- /today · Task → Task title + Due date: value shows, saves, reloads identical; blank title shows "Add a title."; due date stored at local noon so no day shift; emoji/quotes/`<b>` kept verbatim.
- /today · Note editor (feather) on tasks, task steps, org steps and buy items: title (emoji, quotes, brackets, 2000 chars — no sideways scroll on desktop or Pixel 7), Save disabled on blank/whitespace, Enter submits, Escape does nothing (Cancel reverts), Due can be cleared, presets David/Haley/Both/Other, buy editor hides Due/Other and Both → owner null.
- /today · Note row / row done checks, buy purchased toggle and undo, owner cycle on done buy rows (Both → David).
- /today · Package header "+ Item": Add disabled on blank, Enter adds, child inherits the parent's owners, form closes.
- /today · Ask compose: message with blank lines becomes the first message verbatim; related decision saved; blank message → no first message (by design).
- /today · Ask edit form: note cleared → null; related decision "None" → null; title with emoji/quotes saved.
- /today · Reply: Send disabled on whitespace; Enter adds a newline; multi-line reply saved verbatim; box clears after send.
- /today · Decline note: blank → null; a note with emoji/quotes is saved and shown as "Declined: …"; Enter submits; Reopen button and ticked box both reopen.
- /today · Done/undo for tasks, buy items and asks via the Done chip; Delete (ask via ⋯, buy via editor) with confirm.
- /today · Filter chips, "Needs me" shows incoming asks, attention queue marks an ask read on expand, Log out returns to the PIN screen.
- /messages · New message: blank note → request without a first message (by design); list shows the new thread.
- /messages/[id] · Composer: whitespace disables Send; Enter = newline; Ctrl+Enter sends; 2000-char message no sideways scroll; draft survives the 12 s refresh tick and browser Back/Forward; Mark done / Reopen.

## Notes
- The shared Postgres hit "too many clients" during the sweep (8 workers × default Prisma pool). This worktree's `.env` (untracked) now uses `connection_limit=4` for its own server. Two spec runs each had one sporadic failure where the UI had not caught up with a write within 10 s under that load; both passed 3/3 on repeat, and the spec now polls the DB and reloads before asserting lists.
- The brief's restart script kills by `next start -p` but the process is titled `next-server`, so the old server kept the port and the first rebuild was not actually served; killed by cwd instead.

## Coverage
Inventory section lists 32 (/today) + 5 (/messages) + 3 (/messages/[id]) = 40 fields/controls. Exercised: 40 of 40 (Offline setup Install/Sync buttons only checked to render and not error — they need a service-worker install prompt that headless Chromium does not raise).
