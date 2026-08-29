# Unified Home Inbox — implementation spec

**Status:** Binding spec for composer. Supersedes the draft audited in `docs/plans/unified-home-inbox-audit.md`.  
**Route:** `/home` (additive until Phase 5)  
**Non-negotiable:** Zero data loss. Ask stays fully usable on `/requests` until Home has Ask parity.

Working title in UI: **Home**.

---

## Goal

One session that answers: *What needs me, who owns the rest, and can I act in one tap?*

Ask is the feature people use. Home must make Ask **faster**, not bury it under tasks.

```
┌─ NEEDS YOU · 2 ─────────────────────────────────┐
│ ● Ask · From David   “Can you pick up ice?”     │  ← unread badge; stays here after read
│ ○ Ask · From Haley   “Confirm florist time”     │
├─ WAITING · 1 (collapsed if you never send) ─────┤
│ ○ Ask · To Avalon    “Final headcount?”         │
├─ OPEN ──────────────────────────────────────────┤
│ ☐ Decision · Both    Florals & centerpieces  ›  │  ← workspace chevron
│ ☐ Buy · Haley        Batteries ×2               │
│ ☐ Task · David       Tip envelopes              │
├─ WEEK BEFORE · 4/7 ─────────────────────────────┤
│ ☐ · Both             Confirm vendors            │  ← org-card children only
└─ DONE (collapsed) ──────────────────────────────┘

[ Ask someone ▼ ]     chips: All · Needs me · Waiting · …
```

Bottom nav **after Phase 5 only:** `Home` · `Day-of` · `Guests` · `More`.

Until then, Home is an extra route. Today, Ask, Shop, People, Calendar keep their nav entries and pages.

---

## Hard rules (read before writing code)

1. **No Prisma schema changes.** No new tables, no new required columns, no dropping flags.
2. **No deletes** except existing per-row delete actions (`deleteRequest`, `deleteShoppingItem`). Never bulk-delete.
3. **Do not redirect old routes until Phase 5.** Phase 1–4 add `/home`; they do not replace `/today` or `/requests`.
4. **Reuse** `taskVisibilityWhere`, `requestVisibilityWhere`, `sessionCanMutateTask`, and the request permission helpers in `src/lib/requests.ts`. Do not fork visibility rules.
5. **Needs you is role-based, not unread-based.** Unread = badge only. Expanding a thread may `markRequestRead` and must not move the row out of Needs you.
6. **Do not cycle owners** unless current task assignees are a subset of `{david, haley}` (or empty) **and** `canManageOwners`. Otherwise you will wipe Shelly / extra people.
7. **Drag only within kind + group.** Asks are not draggable. Mixed Open order is display-only.
8. **Narrow mutations.** Do not reuse `saveTaskWorkspace` / `saveShoppingItem` / `saveRequest` from a dense row (they rewrite the whole record and/or redirect).
9. **Default compose = Ask.** Recipient is `PinAccount.id`, never `Person.id`.
10. **Flatten only `week_before` / `day_before` children.** Every other task is one package row with a link to `/work/[id]`.
11. **Declined ≠ done.** `InboxItem.done` for asks is `status === "done"` only.
12. **`firstAllowedRoute`:** prefer `/home` only if `canSeeHome(session)`; else existing scan. Shared-money still gets `/money`. Vendor may get `/home` (has Ask) — Day-of stays a primary tab.
13. **Calendar rows stay; `/calendar` stays** until Phase 5, then remains in More (or equivalent browse). Upcoming strip uses `endDate >= today`, not `startDate`.
14. **Offline:** do not replace pack fields. Derive a Home view from existing `tasks`, `requests`, `shopping`.
15. Redirects, when added, are **temporary** (`redirect()` / 307), never permanent.

---

## Data model (read-only merge)

### `canSeeHome`

```ts
export function canSeeHome(session: SessionAccount): boolean {
  return session.isMaster || session.canSeeRequests || session.canSeeTasks || session.canSeeShop;
}
```

Derived in code. **Not** a `PinAccount` column.

### Source → `InboxItem`

| `kind` | Source | Visible when | `done` | Owners | Notes |
|--------|--------|--------------|--------|--------|-------|
| `ask` | `Request` | `canSeeRequests` + `requestVisibilityWhere` | `status === "done"` | Display names from accounts, **not** person ids | `needsMe`, `waitingOnThem`, `unread`, `status` including `declined` |
| `task` | Top-level `Task` with `orgKey: null` | `canSeeTasks` + `taskVisibilityWhere` | `status === "done"` | `TaskAssignee` person ids | Link `/work/{id}`; steps badge from children |
| `org_step` | Child of `orgKey` in `week_before` \| `day_before` | same as tasks | `status === "done"` | child’s assignees | `groupKey` = parent orgKey; **not** a workspace row |
| `buy` | `ShoppingItem` | `canSeeShop` | `purchased === true` | `ownerId` or `[]` if unset | Keep quantity, note, optional `taskId` in meta |

Do not emit a separate inbox row for the org **parent**. The group header *is* that card (title, due, progress). Checking the parent done can remain a header action that calls existing `toggleTaskDone(parentId)` — do **not** auto-toggle children.

### Normalized type (`src/lib/inbox.ts`)

```ts
export type InboxKind = "ask" | "task" | "org_step" | "buy";

export type InboxItem = {
  id: string;                 // "ask:<sourceId>" etc. Render key only
  kind: InboxKind;
  sourceId: string;           // raw cuid / id passed to actions
  title: string;
  done: boolean;
  ownerPersonIds: string[];   // empty for asks
  ownerLabel: string;         // "From David" / "David · Haley" / "Both" / "Unassigned"
  dueDate?: Date | null;
  groupKey?: "week_before" | "day_before";
  groupLabel?: string;
  sortOrder: number;
  unread?: boolean;
  needsMe?: boolean;          // ask: I am recipient && open (master: also third-party open)
  waitingOnThem?: boolean;    // ask: I am sender && open
  escalated?: boolean;
  declined?: boolean;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
  href?: string;              // /work/[id] for kind=task
  meta?: {
    messageCount?: number;
    quantity?: string | null;
    note?: string | null;
    status?: string;
    childDone?: number;
    childTotal?: number;
  };
};
```

Ask rows: set `needsMe` / `waitingOnThem` from account ids, matching `RequestsBoard` (including the master “unseen open asks → needs” loop).

---

## Sort, sections, filters

### Sections (stable membership)

1. **Needs you** — `needsMe` (open asks to me). Never empty-hide the header if the user can see asks; use “You're caught up”.
2. **Waiting** — `waitingOnThem`. Collapse when count is 0.
3. **Open** — incomplete tasks (non-org packages), incomplete buy items, and nothing else from asks.
4. **Week before / Day before** — `org_step` groups, collapsible.
5. **Done / closed** — collapsed. Includes done tasks, purchased buy, done asks, **declined asks** (badge “Declined” + Reopen).

### Default order inside Open

1. Escalated tasks (`escalatedAt` desc)
2. Overdue, then due today (`dueLabel` ranks)
3. Remaining tasks by `sortOrder`, then title
4. Buy items by `sortOrder`, then name  

Do not interleave asks here.

### Filter chips (URL)

`/home?filter=needs-me&who=david&done=1`

| Chip | Param | Logic |
|------|--------|--------|
| All | (omit `filter`) | All sections, permission-scoped |
| Needs me | `filter=needs-me` | Needs you asks + tasks assigned to `linkedPersonId` or `assigneeFilter` + buy with matching `ownerId`. If no link/filter, asks only |
| Waiting | `filter=waiting` | `waitingOnThem` |
| Asks | `filter=asks` | `kind === "ask"` |
| Tasks | `filter=tasks` | `task` + `org_step` |
| Buy | `filter=buy` | `kind === "buy"` |
| Who | `who=` | **Per kind** (see below) |
| Done | `done=1` | Expand Done section |

Who semantics (existing, do not invent a third meaning):

- **task / org_step:** same as `listTasks({ personId })` — `both` = david AND haley; `david` = david and not haley; etc.
- **buy:** `david` / `haley` = that `ownerId`; `both` = `ownerId === null`; omit = all
- **ask:** if the person has a `PinAccount.linkedPersonId` matching `who`, filter to threads involving that account; if `who` is a person with no linked account, **do not hide asks** (cannot map). `who=both` does not apply to asks.

Who chips: All, David, Haley, Both (if both people exist), then every other person the session may see (`assigneeFilter` applied). Horizontal scroll. Do not drop Shelly.

---

## File map

### New

| File | Purpose |
|------|---------|
| `src/lib/inbox.ts` | `canSeeHome`, `listInboxItems`, `groupInboxItems`, `filterInboxItems` |
| `src/lib/inbox.test.ts` | Normalize, sections, who-per-kind, permissions, declined ≠ done, no unread-section move |
| `src/components/InboxBoard.tsx` | Client board |
| `src/components/InboxRow.tsx` | Dense row |
| `src/components/InboxGroup.tsx` | Org group header |
| `src/components/InboxAddBar.tsx` | Default Ask compose |
| `src/app/(app)/home/page.tsx` | Server page + `requireHomeSession()` |

### Extend existing (do not rip out)

| File | Change |
|------|--------|
| `src/lib/session.ts` | `requireHomeSession()` |
| `src/lib/routes.ts` | Prefer `/home` when `canSeeHome` (Phase 5 for login landing; can land login on `/home` earlier **only if** `/home` already has Ask compose) |
| `src/lib/modules.ts` | Add `home` module; **Phase 5** demote Today/Ask from `primary` |
| `src/app/actions.ts` | Narrow inbox actions + `revalidatePath("/home")` **in addition to** existing paths |
| `src/app/(app)/layout.tsx` | Unread badge on Home once it is primary |
| `src/components/AppHeader.tsx` | Optional `extra` / milestone subtitle |
| `src/app/api/offline/route.ts` | No breaking shape change |
| `src/components/OfflineApp.tsx` | Optional derived Home tab **in addition to** existing tabs until Phase 5 |
| `src/lib/routes.test.ts` | Home + shared-money + vendor cases |

### Unchanged on purpose

- `src/app/(app)/work/[id]/page.tsx` (back link updates in Phase 5)
- `src/components/TaskWorkspaceForm.tsx`
- `src/lib/tasks.ts`, `requests.ts`, `people.ts` — call them, don’t copy them
- `src/components/RequestsBoard.tsx`, `ShoppingListBoard.tsx` — keep until Phase 5 redirects; then `@deprecated`, do not delete

---

## Phase 1 — Additive read model (no behavior taken away)

**Goal:** `/home` shows merged data. Every old URL still renders the old UI.

### Tasks

1. `src/lib/inbox.ts`
   - Parallel fetch requests / tasks / org cards+children / shopping using existing visibility helpers and flags
   - Normalize + `groupInboxItems`
   - `filterInboxItems`
2. `requireHomeSession()` — if `!canSeeHome`, `redirect(firstAllowedRoute(session) ?? "/no-access")`
3. `src/app/(app)/home/page.tsx` — fetch grouped items, accounts (for later compose), people
4. `InboxBoard` v1
   - Sections as specified
   - Expand ask thread **read-only** is OK; if you call `markRequestRead`, section must stay Needs you
   - Filter chips, URL-driven
   - Package rows link to `/work/[id]`
   - Hide Task/Buy sections when the session lacks that flag (vendor: asks only)
5. Unit tests listed above
6. **Do not** change `MODULES` primary tabs, `firstAllowedRoute`, or old pages

### Success

- [ ] David sees asks, packages, org steps, buy items
- [ ] Vendor sees only asks; no empty Task/Buy chrome
- [ ] Mother-in-law sees `assigneeFilter` tasks + her asks
- [ ] `/today` and `/requests` unchanged
- [ ] Declined asks are not checked off as done
- [ ] Org steps appear under Week/Day before; “Makeup plan” is still one package row

---

## Phase 2 — Ask parity (the phase that matters)

**Goal:** Nobody needs `/requests` to live in Ask. Still no redirects.

Reuse `createRequest`, `addRequestMessage`, `completeRequest`, `declineRequest`, `reopenRequest`, `deleteRequest`, `markRequestRead`, `saveRequest` (full edit inside expanded thread only).

### Tasks

1. `InboxAddBar` default type **Ask**: recipient `<select>` of other PIN accounts, title, optional message, optional related task if `canSeeTasks` (copy `RequestsBoard` compose)
2. Inline thread: reply, decline, reopen, delete — same permission helpers
3. Complete ask: checkbox or Done button; `reopenRequest` from Done. Prefer undo toast over confirm; never delete on complete
4. Waiting section works
5. Unread “New” badge + layout badge still from `unreadRequestsWhere`
6. `revalidatePath("/home")` on every request action (keep `revalidateRequests()`)

### Success

- [ ] Send an ask from Home
- [ ] Reply without leaving the list
- [ ] Read an ask; it **stays** in Needs you until completed/declined
- [ ] Vendor can do all of this with no task UI

Do **not** switch login or bottom nav yet unless Phase 2 is in the same release as Phase 5. Safer: keep Ask tab until Phase 5.

---

## Phase 3 — Task / buy actions on the list

**Goal:** Act on todos without opening workspace, without wiping fields.

### New actions (narrow)

| Action | Behavior |
|--------|----------|
| `renameTask(taskId, title)` | `canSeeTasks` + `sessionCanMutateTask`; **title only** |
| `cycleTaskOwners(taskId)` | Only if `canManageOwners` and current ids ⊆ `{david, haley}` or empty. Cycle `[] → [david] → [haley] → [david,haley] → [david]`. Else no-op (row still links to workspace) |
| `cycleShoppingOwner(itemId)` | `unset → david → haley → unset` via `ownerId` only |
| `renameShoppingItem(itemId, name)` | Name only |

Existing: `toggleTaskDone`, `toggleShoppingPurchased`, `toggleTaskEscalation` (packages only, not `org_step` — matches current `parentId` guard). For org steps, checkbox = `toggleTaskDone(step.id)` (already used in workspace).

Quick add Task: new `createTaskPackage` path **without** `redirect(/work/…)`, or a `createTaskFromInbox` that stays on `/home`. Default assignees = `defaultAssigneeIds(...)`.

Quick add Buy: `createShoppingItem` without requiring the huge shop form; name + optional owner.

Inline title edit for asks: only if `canEditRequest` (sender or master, open). Title-only update — add `renameRequest` or patch `saveRequest` so omitted `note` / `taskId` are left unchanged (`undefined`, not `null`).

### Success

- [ ] Check off org step and shop item; refresh persists
- [ ] Rename does not clear notes / money / quantity
- [ ] Cycling a Shelly task does nothing to assignees
- [ ] Filtered PIN cannot cycle owners
- [ ] New task from bar does not force-open workspace

---

## Phase 4 — Reorder, pin, ask-from-row

1. **Pin:** `EscalatePriorityButton` on package rows (not swipe, not org_step)
2. **Drag:** same kind, same group, persist `sortOrder` on `Task` or `ShoppingItem`. Pattern: small dedicated reorder, not a port of `DayTimeline.tsx`
3. **Ask from row:** `createRequest` with prefilled title. Package: `taskId` set. Buy: title/note from item; `taskId` = `ShoppingItem.taskId` if present, else null
4. Row menu: Open workspace (packages), Ask someone, Pin, Delete (existing permission)
5. Done section collapsed; `?done=1` or Done chip

### Success

- [ ] Reorder two shop items; order survives reload
- [ ] Dragging a shop item “onto” a task does not write either table incorrectly (reject / snap back)
- [ ] Ask-from-task creates a linked request
- [ ] Ask-from-buy does not require a schema change

---

## Phase 5 — Nav, redirects, calendar, offline, polish

Only after Phases 2–3 are real.

1. `MODULES`: `{ key: "home", label: "Home", href: "/home", group: "plan", primary: true, badge: "unread", icon: "tasks" }` with a custom `canSeeModule` branch for `canSeeHome`. Remove `primary` from `tasks` and `requests`. Keep `people`, `shop`, `calendar` **in More** (do not delete). Optionally hide `people`/`shop` from More once filters on Home are enough — **keep `/calendar` in More**.
2. `firstAllowedRoute`: if `canSeeHome` return `/home`, else scan. Master → `/home`. Tests for shared-money → `/money`, guests-only → `/guests`, vendor → `/home` (timeline still in nav).
3. Soft redirects:
   - `/today` → `/home`
   - `/requests` → `/home?filter=asks`
   - `/shop` → `/home?filter=buy`
   - `/people` → `/home` preserving `?who=`
   - `/calendar` **does not redirect** (still the month grid)
4. `revalidatePath("/home")` already in place; old paths can stay
5. Work back link + `error.tsx` → `/home`
6. Upcoming on Home header if `canSeeCalendar`: next `CalendarEvent` where `endDate >= startOfDay(today)`, plus overdue/due-soon count. Do not claim bachelor is next after 2026-08-23
7. Offline: add a derived Home list from existing pack arrays; keep Today/Ask/Shop tabs or fold them later without dropping fields
8. Density: sticky Needs you + compose; one chip scroller; min 44px tap targets; no full-width duplicate compose card
9. Empty Open: compose still visible
10. Group collapse: `localStorage` for week/day only
11. Mark `RequestsBoard` / `ShoppingListBoard` `@deprecated` — **do not delete**
12. Permission grid: keep Tasks, Ask, Shop as separate toggles. Do not add `canSeeHome` to the grid
13. `accountSummaryLabel`: can say “Home” as shorthand **in addition to** listing Tasks/Ask/Shop, not instead of them

### Success

- [ ] Login with a Home-capable PIN opens `/home`
- [ ] Shared-money PIN still opens `/money`
- [ ] Old URLs (except calendar) land on Home without 404
- [ ] Calendar still opens from More
- [ ] Unread badge is on Home
- [ ] Existing offline packs still load

---

## Permission matrix (unchanged flags)

| Account | Home shows |
|---------|------------|
| Master / Partner | Asks + packages + org steps + buy |
| Helper | Same if flags on; no money |
| Vendor | Asks only (`canSeeRequests`; Day-of remains a tab via `canSeeTimeline`) |
| Mother in law | Asks + tasks matching `assigneeFilter` (typically `["shelly"]`) |
| Shared-money | **No Home** — Money only |
| Wedding party | Per flags (often tasks + asks, no shop) |

`canSeePeople` continues to gate `/people` until that route redirects. After redirect, owner chips are available to anyone with `canSeeTasks` (people list still filtered by `assigneeFilter`).

---

## Testing

### Automated

- `inbox.test.ts` — section membership; unread does not change Needs you; who=both per kind; vendor scoping; `assigneeFilter`; declined; org_step vs package; owner-cycle guard (pure helper)
- `routes.test.ts` — `canSeeHome` prefer `/home`; shared-money `/money`; empty session `null`
- Existing `tasks.test.ts`, `requests.test.ts`, `people.test.ts` still pass

### Manual (must do in browser)

1. PIN 0425: merged Home; send ask; reply; complete; reopen
2. Expand ask in Needs you — still there after read
3. Vendor PIN: asks only; send/reply
4. Mother-in-law: Shelly tasks only; cannot cycle owners onto David
5. Check org step; reload
6. Check shop item; reload
7. Rename shop item; quantity/note unchanged
8. `/requests` still works until Phase 5; after Phase 5 it redirects and Ask still works on Home
9. `/calendar` still shows due dates
10. Shared-money account never hits a broken Home

---

## Out of scope

- Merging `Person` and `PinAccount`
- Unified `InboxItem` table / global sort key
- Removing `/work/[id]`
- Removing `/calendar` month grid
- Auto-converting shop items to asks
- Swipe gestures
- New DB flag `canSeeHome`
- Running `scripts/backfill-permissions.ts` as a deploy step (optional, not required for Needs me)

---

## Phase summary

| Phase | Ships | User-visible |
|-------|--------|----------------|
| **1** | Merged `/home`, old apps intact | Extra URL for testers |
| **2** | Ask works on Home | Can live on Home for messaging |
| **3** | Checkbox, rename, guarded owners, quick add | Act without `/work` |
| **4** | Same-kind reorder, pin, ask-from-row | Prioritize / delegate |
| **5** | Nav + soft redirects + calendar in More + polish | One tab; **no data gone** |
