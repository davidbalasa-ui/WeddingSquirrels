# Unified Home Inbox — Complete Plan

**For:** Composer implementation  
**Route:** `/home`  
**UI name:** Home  
**Rollout:** Build the complete new page. Then decommission the old ones.  
**Non-negotiable:** Zero data loss. No schema migration. Ask never goes dark.

Related: `docs/plans/unified-home-inbox-audit.md` (why these rules exist). Implement from **this** file only.

---

## Rollout in one line

1. **Stage A** — `/home` becomes a full replacement for Today + Ask + Shop + People (calendar browse stays). Old URLs keep their current UI.
2. **Stage B** — Swap nav, land login on Home, soft-redirect old planning URLs. Delete nothing.

Do not start Stage B until the Stage A gate at the bottom of that section is all checked.

Home must make Ask **faster**, not bury it. Default action on the page is “Ask someone.”

```
┌─ NEEDS YOU · 2 ─────────────────────────────────┐
│ ● Ask · From David   “Can you pick up ice?”     │  unread badge; stays here after read
│ ○ Ask · From Haley   “Confirm florist time”     │
├─ WAITING · 1 ───────────────────────────────────┤
│ ○ Ask · To Avalon    “Final headcount?”         │
├─ OPEN ──────────────────────────────────────────┤
│ ☐ Decision · Both    Florals & centerpieces  ›  │  workspace chevron
│ ☐ Buy · Haley        Batteries ×2               │
├─ WEEK BEFORE · 4/7 ─────────────────────────────┤
│ ☐ · Both             Confirm vendors            │  org-card children only
└─ DONE (collapsed) ──────────────────────────────┘

[ Ask someone ]     All · Needs me · Waiting · Asks · Tasks · Buy · David · Haley · …
```

**Nav after Stage B:** `Home` · `Day-of` · `Guests` · `More`  
**Nav during Stage A:** unchanged (`Today` · `Day-of` · `Ask` · `Guests` · `More`). Home is listed in **More** so it is findable without a fifth primary tab.

---

## Hard rules

Copy these into the implementation. They are not optional.

1. **No Prisma schema changes.** No new tables, no new required columns, no dropping `PinAccount` flags.
2. **No bulk deletes.** Only existing per-row deletes (`deleteRequest`, `deleteShoppingItem`). Never `deleteMany` on Task / Request / ShoppingItem / CalendarEvent / Person.
3. **Old pages stay fully usable until Stage B.** `/today`, `/requests`, `/shop`, `/people`, `/calendar` keep their current UI through all of Stage A.
4. **Reuse visibility helpers.** `taskVisibilityWhere`, `requestVisibilityWhere`, `sessionCanMutateTask`, and every helper in `src/lib/requests.ts`. Do not fork permission logic.
5. **Needs you is role-based.** Open asks where I am the recipient (masters also see third-party open asks). Unread is a **badge**. Expanding a thread may `markRequestRead` and must **not** move the row out of Needs you.
6. **Owner cycle is guarded.** Cycle task owners only when current assignees ⊆ `{david, haley}` or empty, **and** `canManageOwners` (`session.isMaster || !session.assigneeFilter?.length`). Otherwise tapping the chip does not write `TaskAssignee` (opens `/work/[id]` instead). `setTaskAssignees` deletes all rows — unguarded cycling wipes Shelly and extra people.
7. **Drag only within the same kind and the same group.** Asks are not draggable. There is no unified sort column; mixed Open order is display-only.
8. **Narrow mutations from the list.** Do not post `saveTaskWorkspace`, `saveShoppingItem`, or `saveRequest` from a dense row. Those rewrite the whole record and/or redirect (`saveTaskWorkspace` → `/today`; `createTaskPackage` → `/work/[id]`; `saveTaskWorkspace` does not even write `title`).
9. **Default compose is Ask.** Recipient is `PinAccount.id`, never `Person.id`.
10. **Flatten only org-card children.** `orgKey` in `{week_before, day_before}`. Every other task is one decision-package row with a link to `/work/[id]`.
11. **Declined ≠ done.** For asks, `done` is `status === "done"` only. Declined gets a badge and Reopen.
12. **`canSeeHome` is derived, not a DB column:** `isMaster || canSeeRequests || canSeeTasks || canSeeShop`.
13. **`firstAllowedRoute` (Stage B only):** if `canSeeHome` → `/home`; else keep the existing `APP_ROUTES` scan. Shared-money still lands on `/money`. Guests-only still lands on `/guests`.
14. **Calendar is not deleted.** `/calendar` month grid stays (More after Stage B). Upcoming on Home uses `endDate >= startOfDay(today)`, not `startDate`.
15. **Offline pack shape does not change.** Derive a Home view from existing `tasks` / `requests` / `shopping`. Do not replace those arrays.
16. **Redirects are temporary** (`redirect()` / 307). Never `permanent: true`.
17. **Do not auto-cascade done.** Checking an org parent does not mark children done, and vice versa.
18. **Prefixed inbox ids** (`ask:…`, `task:…`) are React keys only. Actions receive `sourceId`.

---

## What each old surface becomes

| Today | Home |
|-------|------|
| `/today` decision packages | Package rows in Open + workspace chevron |
| `/requests` Ask | Needs you + Waiting + inline thread + compose |
| `/shop` | Buy rows (`kind: "buy"`) |
| `/people` owner filters | Who chips (same semantics, including extra people) |
| `/calendar` | Stays as a page. Home header shows next milestone only |
| `/work/[id]` | Unchanged deep editor |

Org-card steps (“Confirm vendors”, “Charge devices”) live under Week before / Day before on Home. They are **not** Today rows today (`listTasks` excludes `orgKey` and children). Flattening them on Home is intentional and limited to those two cards.

---

## Information architecture

### Sections (stable membership)

| Section | Contains | Empty state |
|---------|----------|-------------|
| **Needs you** | Open asks where I am recipient (+ master third-party open asks) | “You're caught up — nothing waiting on you.” Header always shown if `canSeeRequests`. |
| **Waiting** | Open asks I sent | Hide the section when count is 0 |
| **Open** | Incomplete packages + incomplete buy items. **No asks.** | Compose bar still visible; no giant blank card |
| **Week before** / **Day before** | `org_step` rows for that `orgKey` | Hide if the session cannot see tasks or the card has no visible children |
| **Done** | Done packages, purchased buy, done asks, declined asks | Collapsed unless `?done=1` |

Vendor (`!canSeeTasks && !canSeeShop`): render Needs you / Waiting / Done (asks only). Do not render Open, Week before, Day before, or Buy chrome.

### Row types

| Kind | Primary tap | Checkbox | Chevron |
|------|-------------|----------|---------|
| `ask` | Expand thread | Marks complete (`completeRequest`); Reopen in Done | None |
| `task` (package) | Title edits / expand not required | `toggleTaskDone` | `/work/[id]` |
| `org_step` | Title | `toggleTaskDone` on the child | None (not a workspace) |
| `buy` | Title | `toggleShoppingPurchased` | None (optional link if `taskId`) |

Visual distinction: Ask rows look like messages (From/To, unread pill). Package rows look like decisions (steps badge, due badge, ›). Buy rows look like a shopping checkbox (quantity on the line).

### Filter chips (one horizontal scroller)

URL: `/home?filter=needs-me&who=david&done=1`

| Chip | Param | Logic |
|------|--------|--------|
| All | omit `filter` | All sections, permission-scoped |
| Needs me | `filter=needs-me` | Needs-you asks, plus tasks assigned to `linkedPersonId` **or** `assigneeFilter`, plus buy whose `ownerId` matches `linkedPersonId`. If neither link nor filter is set: asks that need you only |
| Waiting | `filter=waiting` | `waitingOnThem` |
| Asks | `filter=asks` | `kind === "ask"` |
| Tasks | `filter=tasks` | `task` + `org_step` |
| Buy | `filter=buy` | `kind === "buy"` |
| Who | `who=` | Per kind (below) |
| Done | `done=1` | Expands Done (same as today’s Show done) |

Who chips: **All**, David, Haley, **Both** (if both people exist), then every other visible person (`assigneeFilter` applied). Horizontal scroll. Do not drop Shelly.

Who semantics — do not invent a third meaning:

- **task / org_step:** same as `listTasks({ personId })`. `both` = david **and** Haley; `david` = david and not Haley.
- **buy:** `david` / `haley` = that `ownerId`; `both` = `ownerId === null` (shop’s “Both / unset”).
- **ask:** if some `PinAccount.linkedPersonId === who`, keep threads involving that account; if `who` has no linked account, **do not hide asks**. `who=both` does not apply to asks.

### Compose bar (`InboxAddBar`)

Sticky above the list (or directly under chips). Single field + type toggle: **Ask** (default) | Task | Buy.

- **Ask:** recipient `<select>` of other PIN accounts (copy `RequestsBoard`), title, optional message, optional related task if `canSeeTasks`. Submits `createRequest`. Hide this type if `!canSeeRequests`.
- **Task:** title only (optional due date). Assignees = `defaultAssigneeIds(people)`. Stays on `/home` (no redirect to workspace). Hide if `!canSeeTasks`.
- **Buy:** name, optional owner select (unset / David / Haley). Hide if `!canSeeShop`.

If the session can only see asks, do not show the type toggle — just Ask.

### Ease of use (best-in-class bar)

- One-tap primary action; 44px minimum hit targets.
- Optimistic checkbox; on failure, revert.
- Completing an ask: undo toast that calls `reopenRequest`. Do not confirm-modal complete. Confirm **delete** only.
- Sticky chips + compose on small screens so the list is the content.
- No second full-width “Ask someone” card if the bar already composes.
- Pin uses existing `EscalatePriorityButton`, not swipe.
- `localStorage` collapse state for Week before / Day before only — never persist “hide Needs you.”

---

## Data model

### `canSeeHome` / `requireHomeSession`

```ts
export function canSeeHome(session: SessionAccount): boolean {
  return session.isMaster || session.canSeeRequests || session.canSeeTasks || session.canSeeShop;
}

export function canManageOwners(session: SessionAccount): boolean {
  return session.isMaster || !session.assigneeFilter?.length;
}
```

`requireHomeSession()`: `getSession()`, redirect `/` if missing; if `!canSeeHome(session)` redirect `firstAllowedRoute(session) ?? "/no-access"`.

### `InboxItem`

```ts
export type InboxKind = "ask" | "task" | "org_step" | "buy";

export type InboxItem = {
  id: string;                 // "ask:<sourceId>" — render key only
  kind: InboxKind;
  sourceId: string;           // passed to actions
  title: string;
  done: boolean;
  ownerPersonIds: string[];   // empty for asks
  ownerLabel: string;         // "From David" / "To Avalon" / "David · Haley" / "Both" / "Unassigned"
  dueDate?: Date | null;
  groupKey?: "week_before" | "day_before";
  groupLabel?: string;
  sortOrder: number;
  unread?: boolean;
  needsMe?: boolean;
  waitingOnThem?: boolean;
  escalated?: boolean;
  declined?: boolean;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
  href?: string;              // /work/[id] for kind=task only
  meta?: {
    messageCount?: number;
    quantity?: string | null;
    note?: string | null;
    status?: string;          // ask: open | done | declined
    childDone?: number;
    childTotal?: number;
  };
};
```

### Source mapping

| Kind | Query | `done` | Notes |
|------|--------|--------|-------|
| `ask` | `Request` + messages + sender/recipient names, if `canSeeRequests`, `requestVisibilityWhere` | `status === "done"` | `needsMe` / `waitingOnThem` match `RequestsBoard` grouping, including the master leftover-open-asks → needs loop. `unread` via `isRequestUnread`. |
| `task` | Top-level `parentId: null`, `orgKey: null`, `taskVisibilityWhere` | `status === "done"` | Include children **counts** only. `href` = `/work/{id}`. |
| `org_step` | Children of tasks with `orgKey` in `week_before` \| `day_before`, same visibility as tasks | `status === "done"` | `groupKey` = parent orgKey. Do **not** also emit the parent as a row. Group header *is* the parent (title, due, `childDone/childTotal`). |
| `buy` | All `ShoppingItem` if `canSeeShop` (shop has no extra visibility filter today) | `purchased === true` | `ownerPersonIds` = `[ownerId]` or `[]`. |

### Fetch (`listInboxItems`)

Parallel:

1. Requests (if `canSeeRequests`) — same include as `requests/page.tsx`
2. Packages via existing `listTasks(session, { showDone: true })` so Done can be filled client/server without a second query
3. Org cards via `listOrgCards(session, { showDone: true })` plus each card’s children (cards already `include: { children: true }` — use those children as `org_step`, not as extra packages)
4. Shopping (if `canSeeShop`)
5. People (for chips + compose), filtered by `assigneeFilter`
6. PIN accounts `{ id, name }` (for Ask compose + From/To labels)

`groupInboxItems(items, session)` returns the five sections.  
`filterInboxItems(items, { filter, who, showDone, session, accounts })` applies chips.

Open sort (packages vs buy, **not** mixed with asks):

1. Escalated packages (`escalatedAt` desc)
2. Overdue, then due today (reuse `dueLabel` ranks)
3. Remaining packages by `sortOrder`, then title
4. Buy items after packages, by `sortOrder`, then name

### Owner cycle helper (unit-test this; do not inline)

```ts
const COUPLE = ["david", "haley"] as const;

export function nextCoupleOwnerIds(current: string[]): string[] | null {
  const set = new Set(current);
  if ([...set].some((id) => id !== "david" && id !== "haley")) return null;
  const hasD = set.has("david");
  const hasH = set.has("haley");
  if (!hasD && !hasH) return ["david"];
  if (hasD && !hasH) return ["haley"];
  if (!hasD && hasH) return ["david", "haley"];
  return ["david"]; // both → david
}
```

Shop cycle: `null → "david" → "haley" → null`.

### Upcoming milestone

`nextCalendarMilestone(events, today = new Date())`: first `CalendarEvent` with `endDate >= startOfDay(today)`, ordered by `startDate`. As of 2026-08-29 that is the wedding, not bachelor. Show only on Home, and only if `canSeeCalendar`.

---

## Server actions

Always `revalidatePath("/home")` **in addition to** existing paths. Keep `revalidatePath("/requests")` etc. so Stage A dual-running stays fresh.

### Reuse as-is

`toggleTaskDone`, `toggleTaskEscalation` (packages only — already no-ops on `parentId`), `toggleShoppingPurchased`, `deleteShoppingItem`, `createRequest`, `addRequestMessage`, `completeRequest`, `declineRequest`, `reopenRequest`, `deleteRequest`, `markRequestRead`.

### New / patch (narrow)

| Action | Writes | Must not |
|--------|--------|----------|
| `renameTask(taskId, title)` | `Task.title` | Touch notes, money, due, assignees, status |
| `createTaskFromInbox(title, dueDate?)` | Same create as `createTaskPackage` | `redirect(/work/…)` — return `{ id }` or void and stay on Home |
| `cycleTaskOwners(taskId)` | `setTaskAssignees` only if `canManageOwners` and `nextCoupleOwnerIds` is non-null | Run on Shelly / mixed owners |
| `renameShoppingItem(itemId, name)` | `name` | Clear quantity, note, owner, taskId, purchased |
| `cycleShoppingOwner(itemId)` | `ownerId` only | |
| `createShoppingItemFromInbox(name, ownerId?)` | name + owner + next sortOrder | |
| `renameRequest(id, title)` | `title` if `canEditRequest` | Clear `note` / `taskId` |
| `reorderInboxItems(kind, orderedIds)` | `sortOrder` 0..n on `Task` or `ShoppingItem` | Accept `ask`; accept mixed kinds; accept ids the session cannot mutate |
| `createRequestFromItem({ kind, sourceId, recipientId })` | `createRequest` with prefilled title. Package: set `taskId`. Buy: title/note from item; `taskId` = item’s `taskId` or null | Add columns |

Patch `saveRequest` if reused from the expanded thread: omitted `note` / `taskId` must stay `undefined` (no write), not `null`.

---

## Files

### New

| File | Responsibility |
|------|----------------|
| `src/lib/inbox.ts` | Types, `canSeeHome`, `canManageOwners`, `nextCoupleOwnerIds`, `nextCalendarMilestone`, `listInboxItems`, `groupInboxItems`, `filterInboxItems` |
| `src/lib/inbox.test.ts` | Sections, unread ≠ move, who-per-kind, vendor, `assigneeFilter`, declined, org_step vs package, owner-cycle helper |
| `src/components/InboxBoard.tsx` | Sections, chips (URL), compose slot, expand-one-ask |
| `src/components/InboxRow.tsx` | Dense row + ask expanded thread (port compact UI from `RequestsBoard`, do not import the whole board) |
| `src/components/InboxGroup.tsx` | Org header: title, `n/m` steps, due, optional mark-parent-done |
| `src/components/InboxAddBar.tsx` | Ask default + Task + Buy |
| `src/app/(app)/home/page.tsx` | `requireHomeSession`, fetch, `AppHeader`, board |

### Touch in Stage A (additive)

| File | Change |
|------|--------|
| `src/lib/session.ts` | `requireHomeSession` |
| `src/lib/modules.ts` | Add `home` module **without** `primary`. `canSeeModule`: `key === "home"` → `canSeeHome(session)` |
| `src/app/actions.ts` | Narrow actions + `revalidatePath("/home")` on inbox-related writes |
| `src/components/AppHeader.tsx` | Optional subtitle already exists; Home page passes upcoming milestone string |
| `src/lib/inbox.ts` icon: reuse `"tasks"` until a home icon exists | `ModuleIconName` has no `"home"` |

### Touch only in Stage B

| File | Change |
|------|--------|
| `src/lib/modules.ts` | `home.primary = true`, `badge: "unread"`. Remove `primary` from `tasks` and `requests`. Leave `people`, `shop`, `calendar` in More (`calendar` required). Hide `people` and `shop` from More once Home chips cover them (keep the routes as redirects). |
| `src/lib/routes.ts` | `firstAllowedRoute`: Home if `canSeeHome`, else scan. Master → `/home` |
| `src/lib/routes.test.ts` | Home / shared-money `/money` / vendor `/home` / guests-only `/guests` |
| `src/app/(app)/today/page.tsx` | `redirect("/home")` |
| `src/app/(app)/requests/page.tsx` | `redirect("/home?filter=asks")` |
| `src/app/(app)/shop/page.tsx` | `redirect` to `/home?filter=buy` (preserve `who` if present) |
| `src/app/(app)/people/page.tsx` | `redirect` to `/home` preserving `who` and `done` |
| `src/app/(app)/calendar/page.tsx` | **No redirect** |
| `src/app/(app)/work/[id]/page.tsx` | Back link → `/home` |
| `src/app/(app)/error.tsx` | Link → `/home` |
| `src/app/(app)/layout.tsx` | Unread badge already works via `badge: "unread"` on whichever primary has it |
| `src/components/OfflineApp.tsx` | Add a derived Home list; keep existing tab data. Copy still says “Today” until this change — update that sentence to Home |
| `src/app/api/offline/route.ts` | No field removals. Optional additive `inbox` only with client fallback |
| `src/lib/account-flags.ts` | Summary may mention Home **in addition to** Tasks / Requests / Shop |
| `src/components/ModulePermissionGrid.tsx` | Keep granular Tasks, Ask, Shop. Do not add `canSeeHome` |
| `src/components/RequestsBoard.tsx` / `ShoppingListBoard.tsx` | `@deprecated` comment. **Do not delete** |

### Do not change

`TaskWorkspaceForm`, `src/lib/tasks.ts` / `requests.ts` / `people.ts` (call them), `prisma/schema.prisma`, calendar month grid internals, `/work/[id]` editor.

`src/app/page.tsx` stays the PIN pad (`HomePage` function name is fine; route `/` is not `/home`).

---

## Stage A — Build the complete page

Old nav and old pages unchanged. Add `/home`. Surface it in **More** (not primary).

Ship Stage A as one or more PRs. Suggested commit order:

### A1 — Read model + shell

- `inbox.ts` + tests
- `requireHomeSession`
- `/home` page: grouped list, chips, package › to workspace, vendor/filter scoping
- Expand ask **read-only** is acceptable in this commit; `markRequestRead` must not change section
- MODULES: non-primary `home`

**Done when:** David sees all kinds; vendor sees asks only; mother-in-law sees filtered tasks; declined is not checked done; Makeup plan is one package row; Confirm vendors is an org_step; `/today` and `/requests` still render their current UI.

### A2 — Ask parity (required before decommission)

Port compact thread from `RequestsBoard`: messages, reply, Done, Decline (optional note), Reopen, Delete, title edit for sender, related-task link.

Compose bar default Ask.

`revalidatePath("/home")` on request actions.

**Done when:** Send, reply, complete, decline, reopen all work on `/home`. Read an ask — it stays in Needs you. Vendor can live on Home for messaging. Waiting section works.

### A3 — Task and buy actions

Narrow rename/cycle/create-from-inbox actions. Checkboxes. Guarded owner chips. Quick add Task/Buy. Org-step checkboxes.

**Done when:** Check off org step and shop item, reload persists. Rename does not clear notes/quantity. Shelly owners do not cycle to David. Filtered PIN cannot cycle. New task stays on Home.

### A4 — Speed + density (still on `/home` only)

- Pin button on packages
- Same-kind drag reorder
- Row menu: workspace (packages), Ask someone, Pin, Delete
- Ask-from-row (`createRequestFromItem`)
- Done collapsed; `?done=1`
- Upcoming milestone in `AppHeader` subtitle on Home if `canSeeCalendar`
- Empty states, density pass, group collapse `localStorage`
- Optimistic UI + ask-complete undo

**Done when:** Reorder two shop items survives reload; mixed-kind drop is rejected; ask-from-task sets `taskId`; ask-from-buy needs no schema change; next milestone is not a past bachelor party.

---

## Stage A gate (must all be true before Stage B)

- [ ] Ask: create, reply, complete, decline, reopen, delete (with existing permissions)
- [ ] Needs you does not empty out when an ask is opened
- [ ] Waiting asks are not mixed into Open
- [ ] Packages check off and still open `/work/[id]`
- [ ] Org steps check off; decision packages are not flattened
- [ ] Shop check off + rename + owner cycle
- [ ] Owner cycle never writes non-couple assignees
- [ ] Vendor: asks only, no empty Task/Buy sections
- [ ] Mother-in-law: `assigneeFilter` honored
- [ ] Shared-money PIN still cannot open `/home` (redirects to `/money`)
- [ ] `/today`, `/requests`, `/shop`, `/people`, `/calendar` still work as today
- [ ] No Prisma migration
- [ ] Automated `inbox.test.ts` + existing task/request/people tests pass

If any box is unchecked, **do not decommission.**

---

## Stage B — Decommission old surfaces

Only after the gate. Prefer a separate PR so Stage A can ship and soak.

1. Promote Home to `primary` with `badge: "unread"`. Demote Today and Ask from primary.
2. Hide People and Shop from More (routes become redirects). **Keep Calendar in More.**
3. `firstAllowedRoute` prefers `/home` when `canSeeHome`.
4. Soft redirects:
   - `/today` → `/home`
   - `/requests` → `/home?filter=asks`
   - `/shop` → `/home?filter=buy` (+ `who` if present)
   - `/people` → `/home` (+ `who`, `done`)
   - `/calendar` — no redirect
5. Workspace back link and `error.tsx` → `/home`.
6. Offline: derived Home view; do not drop pack fields; fix the “go to Today to download” copy.
7. `@deprecated` on old boards — files stay.
8. Permission grid unchanged (granular flags). Optional summary label includes Home plus the underlying flags.

**Done when:** Login (Home-capable PIN) opens `/home`. Shared-money opens `/money`. Vendor opens `/home` and still has Day-of in the bar. Old planning URLs do not 404. Calendar still opens. Unread badge is on Home. Existing offline packs still load.

---

## Permissions (flags unchanged)

| Account | Home |
|---------|------|
| Master / Partner | Asks + packages + org steps + buy |
| Helper | Per flags (usually all three) |
| Vendor | Asks only; Day-of stays a primary tab |
| Mother in law | Asks + tasks matching `assigneeFilter` (typically `["shelly"]`) |
| Shared-money | **No Home** |
| Wedding party | Per flags (often tasks + asks, no shop) |

Do not collapse Tasks + Ask + Shop into one accounts-grid checkbox. Vendor must stay Ask-only.

After Stage B, `canSeePeople` no longer needs to gate a page; who-chips follow `canSeeTasks` + `assigneeFilter`. `canSeeCalendar` still gates `/calendar` and the Home milestone.

---

## Testing

### Automated (Stage A)

- Section membership; unread does not change Needs you
- `who=both` per kind
- Vendor scoping; `assigneeFilter`
- Declined ≠ done
- org_step vs package
- `nextCoupleOwnerIds` returns `null` for `["shelly"]`
- `canSeeHome` false when only `canSeeBudget`

### Automated (Stage B)

- `firstAllowedRoute(master)` → `/home`
- `firstAllowedRoute(shared-money)` → `/money`
- `firstAllowedRoute(vendor)` → `/home`
- `firstAllowedRoute(guests-only)` → `/guests`
- `firstAllowedRoute(empty)` → `null`

Existing `tasks.test.ts`, `requests.test.ts`, `people.test.ts` must still pass.

### Manual (browser, Stage A)

1. PIN 0425: open `/home` from More; send ask; reply; complete; undo/reopen
2. Expand Needs you ask — still in Needs you after read
3. Open a package › workspace; back still works (to Today until Stage B)
4. Check org step; reload
5. Check shop item; rename; quantity still there
6. Tap owner on a Shelly task — assignees unchanged
7. Vendor PIN: asks only
8. Mother-in-law: Shelly tasks + asks
9. Confirm `/requests` still composes (Stage A)

### Manual (Stage B)

1. Login lands on `/home`
2. Bottom nav is Home · Day-of · Guests · More
3. `/today` and `/requests` redirect and Ask still works on Home
4. `/calendar` still shows the month + due dates
5. Shared-money PIN never sees a broken Home
6. Download offline, open `/offline`, list still populated

---

## Data preservation checklist

| Data | After Stage B |
|------|----------------|
| `Task` + children + `orgKey` cards | Home rows + `/work/[id]` |
| `TaskAssignee` | Owner chips; cycle never deletes non-couple people |
| `Request` + `RequestMessage` | Ask rows + inline thread |
| `ShoppingItem` | Buy rows |
| `CalendarEvent` | Header milestone + `/calendar` |
| `Person` | Who chips, owners |
| `TaskShare`, `assigneeFilter` | `listInboxItems` via `taskVisibilityWhere` |
| Offline IndexedDB packs | Same keys; Home derived |

Nothing deleted. No migrations.

---

## Out of scope

- Merging `Person` and `PinAccount`
- Unified `InboxItem` table / global sort key
- Removing `/work/[id]`
- Removing `/calendar` month grid
- Auto-converting shop items to asks
- Swipe gestures
- `canSeeHome` database column
- Running `scripts/backfill-permissions.ts` as a deploy step
- Deleting `RequestsBoard.tsx` / `ShoppingListBoard.tsx` / old page files

---

## Implementation order (composer)

```
Stage A1  read model + /home shell in More
Stage A2  Ask parity on /home
Stage A3  task/buy/org mutations
Stage A4  pin, same-kind reorder, ask-from-row, density
   GATE
Stage B   primary nav, login, soft redirects, offline copy, calendar in More
```

Stage A and B may land in one PR **only if** the gate is satisfied in that PR and redirects are the last commits. Prefer two PRs.
