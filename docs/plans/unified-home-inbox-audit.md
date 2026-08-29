# Audit: Unified Home Inbox plan

**Date:** 2026-08-29  
**Verdict:** Do not implement the original plan as written. The destination (one Home list) is right. Several rules would hide data, break Ask, or silently overwrite owners.

Composer should implement from `docs/plans/unified-home-inbox.md` (revised spec), not from the draft this audit covers.

---

## What is already true in the codebase

These facts are load-bearing. The original plan contradicts several of them.

| Fact | Where |
|------|--------|
| Today lists **top-level decision packages** (`parentId: null`, `orgKey: null`), not checklist rows | `listTasks()` in `src/lib/tasks.ts` |
| “Confirm vendors”, “Charge devices”, “Tip envelopes” are **child steps of org cards**, not Today rows | `src/lib/org-cards.ts` + `TaskWorkspaceForm` |
| Ask sections are **role-based** (Needs you = sent *to* me; Waiting = I sent). Marking read must **not** move a row | Comment + grouping in `src/components/RequestsBoard.tsx` |
| Ask `done` and `declined` are different statuses | `Request.status`, `completeRequest` / `declineRequest` |
| Task titles **cannot be renamed** today (`saveTaskWorkspace` never writes `title`) | `src/app/actions.ts` |
| `createTaskPackage` **redirects to `/work/[id]`**; `saveTaskWorkspace` **redirects to `/today`** | same file |
| `saveShoppingItem` / `saveRequest` are full-form writes — omitting fields clears them | same file |
| People `?who=both` = assigned to David **and** Haley. Shop `?who=both` = `ownerId: null` | `people/page.tsx` vs `shop/page.tsx` |
| Task owners are **any `Person`** (david, haley, shelly, plus names created in Add task). Shop owners are **only** david / haley / unset | `TaskAssignee` vs `parseShoppingOwnerId` |
| Ask participants are **`PinAccount`s**, not `Person`s | `Request.senderAccountId` / `recipientAccountId` |
| `toggleTaskEscalation` no-ops on child steps (`task.parentId`) | `src/app/actions.ts` |
| `firstAllowedRoute()` is **first visible module in `MODULES` order**, not “always Today”. Vendor lands on `/day`. Shared-money lands on `/money`. Master is hardcoded to `/today` | `src/lib/routes.ts` |
| `requirePageSession({ need })` takes **one** flag | `src/lib/session.ts` |
| Calendar is read-only month grid: 3 seeded events **plus every task due date** | `calendar/page.tsx` |
| As of 2026-08-29, bachelor (Aug 21–23) and bachelorette (Aug 7–9) are **already past**. Next event is the wedding (Oct 16) | `src/lib/calendar-events.ts` |
| People exist beyond the couple: seed creates david, haley, shelly, and more from Excel | `prisma/seed.ts` |
| Offline pack is a **versioned IndexedDB blob** of raw tables, not a derived inbox | `src/lib/offline-db.ts` |

The mockup in the original plan is a **flattened org-card checklist mixed with Ask and Shop**. That is a different product than Today. It can be the right product — but only if flattening is explicit, limited to org-card children, and decision packages stay distinct.

---

## Blocking issues (would lose data or the only used feature)

### 1. Phase 1 redirects kill Ask before Home can replace it

Original Phase 1 is read-only except “expand ask thread”, then immediately redirects `/requests` → `/home?filter=asks`.

Ask is the only surface people use. That redirect removes:

- Compose (“Ask someone”)
- Reply
- Decline / reopen / delete
- Waiting vs Needs you tabs
- Unread “New” badge that does **not** change section membership

**Rule:** Keep `/today`, `/requests`, `/shop`, `/people`, `/calendar` fully functional until Home can create, reply, complete, decline, and reopen. Redirects and nav swap are the **last** step, not the first.

### 2. “Needs you = unread asks” regresses a bug Ask already fixed

`RequestsBoard` grouping is intentional:

```ts
// Sections are role-based, not read-based
const needs = requests.filter(row => row.status === "open" && row.recipientAccountId === session.id);
```

Expanding a thread calls `markRequestRead`. If Home’s “Needs you” bucket is unread-only, opening an ask **removes it from the top of the list**. That feels like data disappearing.

**Rule:** Needs you = open asks where I am the recipient (masters also see third-party open asks, as today). Unread is a **badge**, not a section. Waiting (I sent, still open) stays its own section or a chip — do not dump waiting asks into a mixed Open list where they drown.

### 3. Owner-chip cycling overwrites non-couple assignees

`cycleTaskOwners`: David → Haley → Both → David calls `setTaskAssignees`, which **deletes all `TaskAssignee` rows** then inserts the cycle result.

Shelly-owned tasks, wedding-party owners, and any person created via “new person” would be replaced by David/Haley. That is real data loss. Filtered accounts (`assigneeFilter`) are not allowed to reassign today (`canManageOwners`).

**Rule:** Cycle only when current owners are a subset of `{david, haley}` (including unassigned → David). Any other owner set: tapping the chip does not cycle; it opens workspace or a picker. Never cycle when `!canManageOwners`.

### 4. Mixed-list drag cannot persist without a new table

Open is a merged list of asks + tasks + buy items. `Task.sortOrder` and `ShoppingItem.sortOrder` are independent. Asks have **no** `sortOrder`. Dragging a task between two shop rows cannot be saved.

Adding a unified `InboxItem` table is explicitly out of scope.

**Rule:** Drag reorders **within the same kind and the same group only**. Asks are not manually reordered (keep `updatedAt` / created order). Do not imply a global mixed order.

### 5. `firstAllowedRoute() → /home` strands accounts that cannot see Home

`canSeeHome` is derived (`canSeeRequests || canSeeTasks || canSeeShop`). It is **false** for:

- Shared-money (`canSeeBudget` only) → must still land on `/money`
- Custom calendar-only or guests-only accounts

Vendor currently lands on **Day-of** (`/day`), then has Ask as a primary tab. Forcing `/home` is OK for vendor (they have Ask) but must not replace the scan for everyone.

**Rule:** If the session can see Home, prefer `/home`. Else keep the existing `APP_ROUTES` scan. Do not add a `canSeeHome` column (no migration, would desync).

### 6. Calendar is not “three events in a subtitle”

Removing the calendar page without another browse path hides:

- Task due dates on a month grid (the bulk of the calendar)
- Multi-day events (use `endDate >= today`, not `startDate >= today`, or an in-progress event vanishes)
- Any future `CalendarEvent` rows (table stays, UI gone)

Rows stay in Postgres — users still **cannot see them**. That counts as data loss for this app.

**Rule:** Do not delete `CalendarEvent` or `/calendar`. After Home is the default, calendar remains a More-sheet destination (or a compact “Upcoming” strip on Home that lists **all** upcoming events + due-soon tasks, not one subtitle). Gate the strip with `canSeeCalendar`.

### 7. Flattening the wrong tasks

The mockup’s Open rows are org-card **children**. `listTasks()` never returns those. If Phase 1 only merges `listTasks` + requests + shop, Home looks like Today with extra shop rows — not the mockup.

If Phase 1 flattens **all** `Task` children, every decision package dumps its workspace steps onto Home. Checking those off without notes is OK for org cards; it is wrong as the default for “Makeup plan” / “Florals”.

**Rule:** Flatten **only** children of `orgKey` in `{week_before, day_before}`. Other packages stay one row with a workspace link and a steps badge (`3/7`). Checking the package checkbox still means “this decision is done”, as today.

### 8. Declined asks are not done

`done: status !== 'open'` puts declined asks in Done with completed asks and purchased items. Reopen exists for a reason.

**Rule:** `done` for asks = `status === 'done'`. Declined is its own badge; include in Done **or** a Closed group, labeled declined, with Reopen.

---

## High-severity product / permission issues

### 9. `who=both` means two different things

| Surface | `who=both` |
|---------|------------|
| People / tasks | Assignees include david **and** haley |
| Shop | `ownerId === null` (Both / unset) |

One query param on `/home` will filter the merged list incorrectly.

**Rule:** Apply `who` **per kind** with each kind’s existing semantics. Document it on the chip: “Both” for tasks = shared couple tasks; for buy = unassigned. Asks: filter by `linkedPersonId` of sender/recipient when set; otherwise do not hide asks on a person chip (Ask is account-to-account).

### 10. People page is not a person directory — but it lists every person

Owner chips “David / Haley / Both” drop Shelly and anyone else. Mother-in-law’s value on People is the Shelly filter (also enforced by `assigneeFilter`). Other people still need a chip or overflow.

**Rule:** Build who-chips the way `/people` does: All, David, Haley, Both (if both exist), then every other visible person. Honor `assigneeFilter` when listing people.

### 11. `canSeePeople` and `canSeeCalendar` become orphan flags if removed from `MODULES`

`permissionModules()` and the accounts grid are driven by `MODULES`. Removing those entries hides the toggles while columns remain on `PinAccount`.

**Rule:** Keep `people` and `calendar` in `MODULES` as **non-primary** (More sheet) until you are sure. If calendar stays reachable, keep `see: canSeeCalendar`. If People is only a Home filter, keep the flag but do not invent a new `canSeeHome` DB field. Do not group Tasks+Shop+Ask into one permission checkbox — vendor must stay Ask-only.

### 12. Needs me for tasks depends on `linkedPersonId`, which is often null

Original plan backfills `linkedPersonId` in Phase 5, but Needs me is a Phase 1 filter.

**Rule:** Needs me =

- Open asks where I am recipient (always), plus
- Tasks assigned to `session.linkedPersonId` **or** `session.assigneeFilter` (if either is set), plus
- Buy items whose `ownerId` matches `linkedPersonId` (if set)

If neither link nor filter is set (typical master/partner), Needs me = asks that need you only — do not hide everyone else’s tasks. Do not wait for a backfill script to make the chip useful. Running `scripts/backfill-permissions.ts` is optional ops, not a product dependency.

### 13. Reusing `saveTaskWorkspace` / `saveShoppingItem` / `saveRequest` for inline edits

Partial form posts will blank notes, money, quantity, `taskId`, purchased, etc.

**Rule:** New narrow actions: `renameInboxItem`, `cycleTaskOwners` (guarded), `cycleShoppingOwner`, `reorderInboxItems`. Do not send a full workspace form from a dense row.

### 14. Offline pack reshape

Replacing `tasks` / `requests` / `shopping` with a single `inbox` array breaks already-downloaded IndexedDB packs (schema is implicit; version is still `1`).

**Rule:** Keep the existing pack shape. Offline Home **derives** the merged list client-side from those arrays. Additive `inbox` is OK only if the client falls back when it is missing.

### 15. `createRequestFromItem` cannot FK a shop item

`Request.taskId` points at `Task` only. No schema migration.

**Rule:** Buy-originated asks set title/note from the item and leave `taskId` null unless the item already has `ShoppingItem.taskId`. Do not add columns in this project.

---

## Ease-of-use gaps (Home would be worse than Ask)

These are not theoretical. They fight the constraint “convenience first” and “Ask is what people use”.

1. **Default compose type must be Ask**, not Task. The original Add bar treats three types equally; people will create tasks by accident.
2. **Recipient is a PIN account**, not a person chip. The Ask compose must keep “Choose who…” from `RequestsBoard`. Never send to `Person.id`.
3. **Waiting asks need a home.** Mixing them into Open under “open asks (waiting)” after unread needs-me is how they get ignored. Keep a Waiting section (collapsed if empty) or a “Waiting” chip with a count.
4. **Decision packages are not todos.** A one-line checkbox with no link to `/work/[id]` hides notes, money, and steps. Dense row + workspace chevron for non-org packages.
5. **Swipe-to-pin fights vertical scroll.** Reuse `EscalatePriorityButton` (already on `TaskCard`). No swipe in v1.
6. **Copying `DayTimeline` drag** is the wrong pattern (pointer capture, peer buckets, schedule save). Inbox drag should be a short same-kind reorder, or skip drag until after checkbox/ask parity.
7. **Chip bar vs density.** All · Needs me · Asks · Tasks · Buy · David · Haley · Both · Done plus extra people will eat the “5–7 rows without scrolling” budget. One horizontal scroll row of chips, sticky compose, sticky Needs you. Done is a chip that expands a collapsed section (`?done=1`), not a seventh primary chip fighting for space.
8. **Optimistic checkbox + undo.** Mobile mis-taps will mark asks done. Tasks/shop already toggle; asks need confirm **or** undo via `reopenRequest`. Prefer undo toast over a confirm modal for speed; confirm only for delete.
9. **Vendor empty sections.** Do not render Tasks/Buy headers at all when `!canSeeTasks` / `!canSeeShop`. Do not show “Open (empty)” chrome.
10. **Master third-party asks.** `RequestsBoard` appends open asks the master is not party to into Needs you. Preserve that or masters “lose” vendor threads.
11. **`createInboxAsk` is unnecessary** if `createRequest` is reused. Extra actions invite permission bugs. Prefer wrapping existing request actions + `revalidatePath("/home")`.
12. **Phase 4 permission grid “group under Home”** will let an admin turn off Ask while thinking they turned off a section header. Keep granular flags.

---

## Implementation traps (composer will hit these)

| Trap | Fix |
|------|-----|
| `requirePageSession({ need: "canSeeTasks" })` cannot express OR | Add `canSeeHome(session)` + `requireHomeSession()` |
| `ModuleIconName` has no `"home"` | Reuse `"tasks"` or add an icon; keep Ask icon for compose |
| `revalidatePath` still targets `/today`, `/people`, `/requests`, `/shop` | Also `/home` (and layout for unread). Keep old paths until redirects ship |
| `src/app/page.tsx` is already named `HomePage` (PIN pad) | Route is `/home`; do not rename the PIN pad |
| Redirects: use `redirect()` (307), never `permanent: true` | Old URLs must be reversible |
| `listInboxItems` must call `taskVisibilityWhere` and `requestVisibilityWhere` | Do not reimplement filters |
| Shop has **no** per-person visibility beyond `canSeeShop` | Do not invent shop sharing |
| Org parent as a group **and** a row duplicates the card | Group header is the org card; rows are children only |
| Checking an org parent vs children | Parent done ≠ all children done today. Don’t auto-cascade unless you add an explicit product rule (prefer no cascade) |
| `InboxItem.id` prefixed `"task:…"` passed into `toggleTaskDone` | Actions take `sourceId` |
| Tests: `routes.test.ts` expects `/today` | Update when `firstAllowedRoute` changes, with vendor + shared-money cases |
| Phase 1 “read-only expand” still needs `markRequestRead` | That is a write; it is OK, and must not change section |
| Header example “Next: Bachelor party · Aug 21” | Stale as of 2026-08-29. Use `endDate >= startOfDay(today)` |

---

## Data-preservation checklist (stricter than the original)

Nothing in Phases 1–5 may:

- `DROP` / migrate tables or add required columns
- `deleteMany` on Task / Request / ShoppingItem / CalendarEvent / Person except through **existing** per-item delete actions the user already has
- Strip `TaskAssignee` rows via owner cycling
- Blank `planNotes`, money, shop notes, `taskId`, messages via partial saves
- Remove `/work/[id]`
- Remove calendar browse until Upcoming + `/calendar` in More are both real
- Change offline IndexedDB key or drop pack fields
- Permanent-redirect away from old routes

Allowed:

- Additive `/home` route and components
- Soft redirects **after** feature parity
- Hiding modules from primary nav (routes still serve)
- `@deprecated` comments on old boards — do not delete those files in this project

---

## Recommended phase order (replaces original 1–5)

See `unified-home-inbox.md` for the full spec. Summary:

1. **Read model + additive `/home`** — no redirects, no nav swap. Old apps unchanged.
2. **Ask parity on Home** — compose (default), reply, complete, decline, reopen, unread badge. This is the phase that matters.
3. **Checkbox / rename / owners / shop / org-step rows** — narrow mutations, guarded owner cycle.
4. **Reorder (same kind), pin button, ask-from-row, Done section.**
5. **Nav swap + soft redirects + More-sheet calendar + offline derived list + density polish.**

Do not ship 5 before 2. Do not ship redirects in 1.

---

## Original plan pieces that are fine

- No schema migration; reuse `Task`, `Request`, `ShoppingItem`, `CalendarEvent`
- Prefixed inbox ids for React keys
- `/work/[id]` stays the deep editor
- Vendor sees asks only; `assigneeFilter` still scopes tasks
- Query-param filters instead of new pages
- Unread badge moves to whichever tab is Home **after** nav swap
- Deprecate, don’t delete, `RequestsBoard` / `ShoppingListBoard`
- Out of scope: merging Person and PinAccount, inbox table, calendar month rewrite, removing workspace
