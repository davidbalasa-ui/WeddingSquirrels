# Field sweep: Plan / tasks / shopping / stay / calendar

Worktree `wt/plan`, port 3305, DB `wedding_plan`. Spec: `e2e/overnight/fields-plan.spec.ts` (desktop + phone).

Environment note for the orchestrator: the shared Postgres (max_connections = 100) was saturated by the
other workers' servers and test runs (15-18 idle connections per worker DB). While saturated, every
page on this worker's server redirected to the PIN screen and `/api/offline` answered 401 (getSession
fails on the DB error and is treated as logged out). I limited this worker's own pool with
`?connection_limit=3` on both URLs in the (git-ignored) `.env`; other workers may want the same.

## Findings

### 1. /work/[id] · Money needed / Money spent
- What I did: typed `abc` (and `12 dollars`) into Money needed / Money spent and pressed Save decision.
- What happened: the save "succeeded", the page reloaded with Money needed empty and Money spent empty; the
  DB had `amountNeeded = null`, `amountSpent = 0`. No message. (The inventory note about NaN reaching Prisma
  was already partly patched with an `isFinite` guard, but the guard turns garbage into null/0 silently.)
- What should happen: the form says the value must be a number and keeps what was typed.
- Status: fixed. New pure helper `parseMoneyText` in `src/lib/money.ts` (unit test in `money.test.ts`):
  blank -> null, "$1,250.50"/".5"/"007" -> number, anything else (including "12 dollars", which
  `parseFloat` would read as 12) -> invalid. `saveTaskWorkspace` returns "Money needed must be a number,
  like 250 or 12.50." / "Money spent must be a number, …" and keeps the typed values on screen. Empty still
  means null (needed) / 0 (spent) as before.
- Proof: fields-plan.spec.ts::"typing letters in Money needed says it must be a number instead of silently saving nothing"

### 2. /work/[id] · Decision title
- What I did: selected all, typed spaces only, Save decision.
- What happened: HTML `required` lets whitespace through; the server trimmed to "" and silently kept the old
  title (`...(title ? { title } : {})`), redirecting as if saved.
- What should happen: say "Add a title." like Add Task does.
- Status: fixed in `saveTaskWorkspace` (`if (!title) return { error: "Add a title." }`).
- Proof: fields-plan.spec.ts::"saving a whitespace-only title says Add a title instead of quietly keeping the old one"

### 3. /work/[id] · Step title (steps inside a package)
- What I did: cleared a step title and tabbed away; also typed a new name and pressed Enter.
- What happened: cleared box stayed blank on screen (the DB kept the old title, so screen != saved until a
  reload). Enter did nothing (no form around the input); only Tab/blur saved.
- What should happen: a step keeps its name, so the box shows the saved title again; Enter commits like the
  Stay bed inputs do.
- Status: fixed in `TaskWorkspaceForm` (blur with empty restores `step.title`; Enter blurs).
- Proof: fields-plan.spec.ts::"clearing a step title and tabbing away shows the saved title again, Enter saves a rename"

### 4. /plan/shopping · Item name (add form and edit form)
- What I did: typed spaces only in Item and pressed Add to list / Save item.
- What happened: the server action returned without saving, the form closed, nothing was added or changed,
  no message (quantity/note typed alongside were lost).
- What should happen: "Add an item name." and the form stays open with the other values.
- Status: fixed in `ShoppingListBoard`: both forms submit through a transition (same pattern as
  TaskWorkspaceForm) and show "Add an item name." when the name is blank.
- Proof: fields-plan.spec.ts::"adding an item with a blank name says so and keeps the form open",
  ::"an item round-trips its fields, hides when purchased, and renaming it to blank is refused"

### 5. /plan/calendar · Title
- What I did: edited the Wedding day event, set the title to spaces, Save event.
- What happened: server returned `{ok:false}`; the form stayed open with no message (silent failure).
- What should happen: "Add a title." Also a generic message when the server refuses (bad date).
- Status: fixed in `CalendarMonth` (client check + error line under the form).
- Proof: fields-plan.spec.ts::"editing an event keeps its dates, shows notes with their line breaks, and a blank title is refused"

### 6. /plan/calendar · Notes
- What I did: saved notes with a blank line between two lines.
- What happened: saved correctly, but the event card rendered "Test note line3" on one line (the `<p>` collapsed newlines).
- What should happen: line breaks show as typed.
- Status: fixed (`whitespace-pre-wrap` on the notes paragraph, as InboxRow/OfflineApp already do).
- Proof: same calendar test (asserts the rendered text keeps `\n\n`).

### 7. /plan/stay · Bathroom note (judgement call)
- What I did: cleared a saved bathroom note and tabbed away.
- What happened: the note row disappeared and the record was deleted (`saveStayBathNote` deletes on empty).
  After reload it is gone. A note that is added and then abandoned blank stays as an empty row.
- What should happen: judgement call for David. Clearing a field normally leaves it empty; here it deletes the
  row even though a Remove button exists. Nothing is lost (the note was empty), so I left it as is.
- Status: judgement call for David because deleting an emptied note loses no text and there is an explicit Remove.
- Proof: fields-plan.spec.ts::"a bathroom note saves on blur with its blank lines and Remove deletes it" (covers the save/remove path).

### 8. /work/[id] · Money needed / spent accept negatives and sub-cent values (judgement call)
- What I did: typed `-5` and `12.345`.
- What happened: saved as -5 and 12.345 (the Money page clamps to non-negative via `clampMoney`; this form does not).
- What should happen: probably refuse negatives; judgement call for David because the Money page silently clamps instead.
- Status: not changed.

### 8b. /work/[id] · Save decision sometimes stays on "Saving…" (pre-existing, not fixed)
- What I did: pressed Save decision repeatedly in the spec (about 12 saves per run, desktop and phone).
- What happened: roughly 1-2 saves per run never left "Saving…" (button disabled) although the server
  had already answered the action with its 303 redirect in ~30 ms and the DB had the new values; a reload
  shows everything saved. A standalone probe of 9 consecutive saves could not reproduce it, and the same
  sequence ran on the untouched build during exploration (I only checked the DB then, not the button).
  Hydration is not the cause (the spec waits for React fibers before clicking).
- What should happen: the button returns to "Save decision" after the redirect.
- What should happen next: judgement call for David / a deeper look: the form submits through
  `startTransition(() => saveAction(data))` and the action ends with `redirect()` to the same URL; the
  pending flag from `useActionState` is what sticks. Not a field bug and outside a minimal fix, so I left
  the code alone and made the spec's save helper reload when the button sticks (comment in the helper).
- Proof: none (intermittent); see `saveDecision` in fields-plan.spec.ts.

### 9. /work/[id] · Money spent shows empty for 0 (by design)
- Typing `0` in Money spent saves 0 and comes back empty (`task.amountSpent || ""`); Money needed shows `0`.
  0 is the column default and means "nothing spent", so not a bug.

### 10. Textareas store CRLF when submitted as a form action (by design / note)
- Step notes and shopping notes go through a native form submission, so blank lines are stored as `\r\n`
  (browser form encoding). Textareas and the inbox render them fine. Calendar/stay notes go through JS and store `\n`.

## Passed (full script, both viewports unless noted)
- /plan/tasks · Add Task title: empty blocked by `required`; whitespace-only -> "Add a title."; emoji/quotes/angle
  brackets round-trip; Escape keeps the draft; Cancel closes; redirect to /work/[id] on success.
- /plan/tasks · View filters, priority pin on cards: navigate / toggle and persist.
- /work/[id] · Priority pin, Step done check: toggle, counter updates (1/7 done), persist.
- /work/[id] · Step notes: save on blur (also when clicking straight to Save decision), blank lines + emoji
  round-trip, clear to "" and stays empty after reload.
- /work/[id] · What is this / The plan: 2000 chars, blank lines, emoji, quotes, `<b>x</b>` round-trip; no sideways scroll.
- /work/[id] · Due date: set/clear round-trips, no day shift (stored at local noon).
- /work/[id] · Money needed/spent: `12.50`, `1,000`, `$12`, `.5`, `007`, `1e3` parse as expected; clear -> empty; 0->clear->9 saves 9.
- /work/[id] · Mark completed checkbox, Owners checkboxes (all unchecked -> Unassigned), Add someone new (creates and assigns).
- /plan/shopping · Quantity (`007` kept as text), Who's buying, Note, Related decision, Purchased checkbox, Mark purchased
  row button, Show/Hide purchased, owner filters, Delete (no confirm: by design, noted).
- /plan/stay · Bed occupant: type + Enter, click-End-type keeps text, clear -> "" (unclaimed), whitespace -> "".
- /plan/stay · Bathroom note: add focuses the new note, blank lines + emoji round-trip, Remove deletes.
- /plan/calendar · Starts/Ends/Location/Notes round-trip; end before start snaps to start (by design); Cancel discards; Escape keeps text.

Fields exercised: 44 of 44 in the inventory section (6 + 15 + 11 + 3 + 8, counting buttons/links rows).
