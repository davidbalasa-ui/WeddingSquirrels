# Next action + Day — a planning app that can also run Friday

**For:** Composer implementation  
**Wedding:** October 16, 2026  
**Users:** Couple (David & Haley) · Coordinator (Avalon) · party / vendor PINs  
**This file is the spec.** It replaces Home-as-inbox, three-tab filing, and “Day is the only product.”

**Non-negotiable:** Zero data loss. Additive schema. Asks become **tasks** (work) + **DMs** (talk). Precious Peony is **food**, not florals. Faces/phones cache offline automatically.

---

## Challenge (read this first)

Three drafts optimized the wrong job.

| Draft | What it got right | Why it still fails |
|-------|-------------------|--------------------|
| Home inbox | One place to look | Everything is equal. 54 packages is not “what do I do next.” |
| People / Vendors / Day-of | Money has a home | Filing cabinets. You still hunt. |
| Day-as-the-product | Friday needs faces on the clock | **It is September.** Landing on a 10:30 AM timeline does not make planning progress. Call sheet does not pay BSS. |

**The couple’s actual job until ~Oct 9:** *What is the next action I can take? If I can’t, what is blocking it, and how do I fix that? Then the next one.*

**Avalon’s job on Oct 16:** *What is happening now, who is that face, call them.*

Those are two **modes**, not two apps, and not “Day swallows planning.”

**Focused work mode** is the right *intensity* for planning (one card, one action, hide the pile). It is the wrong *only* UI. Seating, the run-of-show, and “show me every vendor balance” are boards. You open a board when the next action *is* “place table 4” or “scan the timeline.” You do not live on boards.

So: **Next** is the planning product. **Focus** is Next with the rest of the chrome gone. **Day** is the coordination product. Same people, same tasks, same vendors.

Nav: `Next` · `Day` · More (Vendors, Guests, Roster, Shop, Stay).  
Envelope on the header.  
Login: Next, unless `daysUntil <= 7` and they can see the timeline → Day.

---

## Destination

```
NEXT (default now)                    DAY (default week-of)
one ranked queue                      run-of-show + faces
Ready  ·  Blocked                     Now / Next moment
Focus = one card                      call sheet photo grid
do the work on the card               tap face → call · DM · tasks
```

A Next card **is** the vendor, the task, the payment, or the DM — not a link that dumps you into another app and loses the queue. Save, then the following ready item.

---

## Hard rules

1. **Next answers one question:** “What do I do now?” If the honest answer is “wait,” show **why** and the **unblock** action (Message Avalon, assign an owner, name the florist). Then still offer the next *ready* item so they are not stuck staring at a wall.
2. **Blocked is first-class.** A pretty list that ignores waiting-on is Home again.
3. **Do the work on the card.** Pay remaining, check insurance, mark purchased, assign, send a DM, add a missing photo. Opening Vendors/Guests/Day is allowed when the action *needs* a board (seating). After that, back to Next.
4. **Ask is a task.** Work has an owner. Talk is a DM (notify, optional link to that task). Do not rebuild Needs-you tickets.
5. **Day does not replace Next.** Faces-on-blocks and the call sheet stay. They are mode 2.
6. **Rank, don’t dump.** Default Next shows ~1 focus card + a short “Up next” (3–5). The rest is “Later.” `?all=1` for the coward’s list.
7. **Mine vs ours.** David’s Next prefers David-owned + unassigned couple work + DMs to David. Haley’s the same. Master can toggle Ours. Avalon sees tasks on her + Day. Party does not get Next; they get Day + call sheet.
8. **Peony = caterer.** Floral tasks are blocked on “name a florist” until a Person exists — that *is* a Next action, not a silent mis-file.
9. **Additive schema. No bulk deletes.** Merge scripts dry-run first.
10. **Offline faces are automatic.** Still required. Not the planning loop.

---

## What a Next card is

Derived. No `InboxItem` table.

```ts
type NextKind =
  | "task"        // do, or assign
  | "pay"         // budget remaining, due soon/overdue
  | "vendor_gap"  // insurance / contract / tip / missing phone
  | "buy"         // shop
  | "dm"          // unread / needs reply
  | "face_gap"    // day-critical person missing photo or phone
  | "guest"       // RSVP / seating only when the date makes it urgent
  | "unblock";    // the action is "fix the blocker" on another item
```

### Ready vs blocked

| State | Meaning | Card |
|-------|---------|------|
| **Ready** | You can finish this without someone else | Primary button: Pay / Done / Add photo / Reply |
| **Blocked** | Waiting on a person, a date, or missing info | Why + Unblock (Message, assign, “Name florist”) |
| **Later** | Real work, not due, not blocking Friday | Hidden unless Later / All |

**Derive blocked** (do not require a new field on day one):

- Task assignees are *only* other people (Avalon, Shelly, Haley if you are David) → blocked, waiting on them
- Task has no assignee → ready, but the action may be **Assign** (unassigned critical work is a smell)
- `payByDate` more than 14 days out and not overdue → Later
- Vendor insurance `unknown` on a named vendor → Ready (`vendor_gap`) for the couple
- Floral package and no florist Person → Ready unblock: “Add florist”
- DM to you, unread/open → Ready
- DM you sent, no reply → Blocked (waiting). Unblock = nudge
- Face gap: vendor or party with a PIN / a block pin, and no photo or no phone → Ready once we are inside 21 days (or immediately for Avalon/Barry/Peony/BSS)

Optional additive later: `Task.waitingOnId` when derivation is wrong (“I’m waiting on the venue contract, but the task is still on me”). v1 lives on derivation + a “I’m blocked — who?” control on the card that *sets* `waitingOnId`.

### Rank (couple, September)

Score, then take the top:

1. Overdue **pay**
2. **DM** that needs you
3. Blocked item on the **critical path** (venue, food, planner, photo, legal) → show as `unblock` if you can nudge
4. Ready task due within 7 days, assigned to me / both / unassigned
5. `vendor_gap` on those same vendors
6. **buy**
7. **face_gap** inside 21 days
8. **guest** seating / final count inside 14 days
9. Everything else → Later

Critical-path vendors: Avalon, BSS, Precious Peony (food), Barry, Belle, bartender, florist-if-named. Not “guest book.”

Org-card week/day-before steps: Later until we are inside their window; then they enter Ready.

### Focus mode

`/next?focus=1` or a Focus toggle.

- One card, large
- One primary action (44px+)
- Blocked? Unblock is the primary
- Skip → next ready (does not complete)
- “I’m blocked” → pick a person, sets `waitingOnId`, card becomes unblock for the other partner / leaves your queue
- No chip bar, no 15 who-filters, no package wall
- Escape: Day, Guests, Vendors in the header overflow — not a second inbox

Focus is **not** a third primary tab.

---

## Day (unchanged job, demoted to a mode)

Friday / rehearsal / Avalon’s console.

- Now / Next **moment** (clock), faces on each block
- Call sheet = photo grid (name + role)
- Tap face → Call · DM · their tasks · vendor setup if vendor
- Morning vendor strip (arrival, $ left, insurance dot)
- Block tasks via `Task.timelineBlockId` (column already exists)
- Contacts / Assignments tabs go away
- Automatic offline face book

Party PINs land here. They do not need Next.

---

## Talk vs work

| | Work | Talk |
|---|-|-|
| Object | `Task` (owner, optional block, optional vendor) | `Request` thread |
| How it starts | “Add task” / assign from a card | Envelope · person sheet · Unblock |
| Done | checkbox | archive (`status: done`) |
| Ping | no | **Web Push** on new DM |
| Link | — | optional `taskId` / `timelineBlockId` chip |

“Ask Avalon for the bartender license” → **task** on Avalon. If you want to talk about it → DM with that task linked. Your Next: either the task (if it’s yours) or “Waiting on Avalon — Message” (if it’s theirs and critical).

Existing 17 threads: DMs. If a title is clearly a job, also ensure a task and link the thread. Do not delete.

---

## Boards (More, opened from a card when needed)

Not primaries. Same records.

| Board | When Next sends you there |
|-------|---------------------------|
| **Vendors** | Pay, insurance, contract, tip, Peony=food, Other costs, florals TBD |
| **Roster** | Add photo / phone / role (feeds call sheet + face_gap cards) |
| **Guests** | Seating, RSVP, thank-you |
| **Shop** | The three buy lines, also completable on the card |
| **Stay / Rehearsal / Accounts** | Rare; stay in More |

`/home` → `/next`. `/money` → Vendors board. `/requests` → DMs. `/people` → Roster. `/day/contacts` → Day call sheet.

---

## Roles

| Account | Default | Next | Day |
|---------|---------|------|-----|
| Couple | Next | Full rank | Full |
| Avalon | Day (or Next if she has tasks) | Tasks on her + DMs | Console |
| Party | Day | Hidden | Call sheet + run-of-show |
| Shared-money | Vendors board | Pay cards only if we ever allow a thin Next | No |
| Guests-only | Guests | No | No |

`firstAllowedRoute`: Next if `canSeeTasks || canSeeBudget || canSeeRequests || canSeeShop`; Day if only timeline; else existing scan. Week-of override: Day if they can see it.

---

## Data (still one person)

```
Person     + hat, role, phone, email, photoData, aliases
Vendor     1:1 Person     pay method, insurance, contract, tip
BudgetItem + vendorId
Contact    + personId
Task       + vendorId, waitingOnId (nullable)
Task.timelineBlockId     EXISTS — use it
Request.taskId           EXISTS — DM about work
Request.timelineBlockId  nullable
TimelineBlockPerson      faces on a moment
PushSubscription
PersonMergeLog
```

### Vendor names (corrected)

Avalon (planner), BSS (venue), Barry (photo), Belle (video), **Precious Peony (food)**, Wendy / Kurt (MC), bartender TBD, **florist TBD — not Peony**.

### Sort the pile onto objects (so Next can rank them)

Same as before, Peony ≠ florals. Payments → vendor pay fields. Paperwork → insurance/contract. Photos → Barry/Belle + 12:30 block. Food/dinner headcount → Peony. Guests/thank-you → Guests board. Ceremony/reception → Day blocks. Week/day before → enter Next when the window opens. Communication package → kill. Duplicate rehearsal-time children → merge.

Unassigned critical tasks become Next **Assign** cards, not a hidden Excel graveyard.

---

## Next engine (`src/lib/next-actions.ts`)

Pure functions, heavy tests. This is the product.

```ts
listNextActions(session, now) → { focus: NextCard | null, ready: NextCard[], blocked: NextCard[], later: NextCard[] }
```

Unit tests (must exist before UI):

- Overdue BSS pay beats “buy guest book”
- David does not get Avalon-owned shot list as Ready; he gets Unblock if it is critical
- Haley DM unread beats a task due in three weeks
- No florist + open floral children → Ready “Add florist”
- Peony remaining $ is `pay`, not floral
- Week-before steps stay Later on Aug 30; they are Ready on Oct 9
- Shared-money session: no task cards
- Vendor-only session: no Next (Day)

---

## Phases

### P0 — Rank the real queue (no UI)

- `db:audit`
- Script: print **today’s** Next for David / Haley / Avalon against production (or a copy): focus, ready[5], blocked[5]
- Couple looks at that list and says “wrong” — **fix the ranker before building chrome**

If the printed Next is dumb, Focus mode will be a prettier dump.

### P1 — `/next` + Focus (planning product)

- `next-actions.ts` + tests
- `/next` page: focus card + Up next + Blocked (short) + Later collapse
- Card actions: `toggleTaskDone`, `logBudgetPayment`, `setVendorGap`, `toggleShoppingPurchased`, reply DM, `setTaskWaitingOn`, assign
- Focus toggle
- `/home` redirects here

**Done when:** Master PIN opens the app and the first button is a real action (pay / reply / assign / add florist), not Makeup plan.

### P2 — Unblock is a first-class action

- Blocked cards: waiting-on face + Message (creates/opens DM, optional task link)
- “I’m blocked” on a ready card
- Push on DM (can slip to P4 if needed, badge is enough for P2)

**Done when:** A task on Avalon disappears from David’s Ready and shows “Waiting on Avalon — Message.” After she completes it, it leaves Blocked.

### P3 — Faces + Day mode (coordination product)

- Person photo/phone/role, merge dups, contact link, offline cache
- Call sheet grid
- Faces on blocks, Now/Next moment
- Face-gap cards appear on Next inside 21 days

**Done when:** Airplane mode call sheet works. 12:30 shows Barry. Next can say “Add Barry’s photo.”

### P4 — Vendor setup on the same face + DMs named Messages

- Vendor fields, Peony=food, `/money` redirect
- Envelope + web push
- Ask copy gone

### P5 — Nav + boards

- Next · Day · More
- Party → Day only
- Week-of login → Day
- Shop / Guests restored as boards

---

## Testing

1. Aug 30 master: first card is a payment, a DM, or a critical confirm — not a decision package
2. Mark it done → the next card is the new focus
3. Mark “I’m blocked” on Haley → David’s Next shows unblock, Haley’s shows the task
4. Avalon PIN: Day usable; Next only her work
5. Party PIN: no Next, call sheet works offline
6. Peony pay card labeled food; floral unblock is “Add florist”
7. Oct 9: week-before steps enter Ready
8. Oct 16: login → Day, Now is the current block

---

## Out of scope

- SMS
- Public RSVP
- Seating canvas
- Blob uploads
- Dropping Contact / Request / DayAssignment
- A fourth primary tab
- Re-seeding Excel on production

---

## Order

```
P0  print Next for David/Haley/Avalon — argue with the rank
P1  /next + Focus cards (do work here)
P2  blocked + unblock (Message / assign / name florist)
P3  Day faces + call sheet + offline
P4  vendor setup + DM push
P5  Next · Day nav
```

P0 is the challenge made concrete. If we cannot print a Next list you believe, we do not get to build Focus chrome.
