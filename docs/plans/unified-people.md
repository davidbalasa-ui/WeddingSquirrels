# One Person — Unified Directory, Home, and Daily Work

**For:** Composer implementation  
**Wedding:** October 16, 2026  
**UI names:** Home · Day-of · Guests · More → People, Money  
**Non-negotiable:** Zero data loss. Additive schema only. Ask never goes dark. No fourth primary tab.

Related: `docs/plans/unified-home-inbox.md` (Home already shipped). Implement the product from **this** file.

---

## Destination in one line

One human is one row. Home is what you **do**. Guests is households. Day-of is the clock. Vendors, contacts, payments, asks, and thank-yous are **views of the same people**, not new apps.

```
Home          Day-of           Guests
 do            when             households
asks · buy     timeline         RSVP · table
pay · thank    call list        gifts · thank
               (from People)
```

**Nav stays** `Home` · `Day-of` · `Guests` · `More`.  
**Do not add** Vendors, Contacts, Directory, or Thank-you as primary tabs or standalone apps.

---

## Why the app feels messy (facts)

These are load-bearing. The Home inbox plan unified *lists*. It did not unify *people*. That is why the product still feels duplicated and hard to learn.

| Fact | Today |
|------|--------|
| Four identity systems | `Person` (task owners) · `PinAccount` (ask to/from) · `Contact` (day-of phone/photo) · `Guest` / `GuestPerson` (households) |
| Same human, different names | David / "Groom - David"; Shelly / "Shelly Wiewiora"; Avalon as `avalon_planner` + `avalon_green` |
| 17 of 22 `Person` rows have zero task/shop/day-assignment links | They still appear on Home who-chips |
| PIN links are incomplete | Mom Balasa `null`; Avalon `null`; John → `shelly`; Shelly → `shelly` |
| Vendors have no home | Phone on Contacts, money on `/money`, asks on Home, name on People — four hops |
| Home Open is planning residue | 54 parent tasks / 140 children from Excel, mixed with 3 shop items and 17 asks |
| Ask compose is account-to-account | Recipient `<select>` of PIN names ("Mom Balasa", "John"), not people |
| Thank-you is buried | Gifts exist on `GuestGift`; only visible in Guests **Edit** |
| `scripts/audit-duplicate-data.ts` | Mentioned in ops notes; **not in this repo** and not in `package.json` |
| People page is gone | `/people` soft-redirects to Home who-chips (Stage B). Who-chips are filters, not a directory |

Jobs the couple actually asked for:

1. Manage **vendors and payments**
2. Manage **contacts**
3. Manage **guests** (seating, gifts, thank-you)
4. Things to **buy**
5. **Ask someone** fast

Constraint they set: **it cannot be three new pages.** Do not solve this by adding Vendors + Contacts + Thank-you.

---

## Hard rules

Copy these into the implementation. They are not optional.

1. **No fourth primary tab.** Nav stays Home · Day-of · Guests · More. People returns as a **More** destination only.
2. **No new apps.** Do not create `/vendors`, `/contacts` (top-level), `/thank-you`, or `/directory`. Day-of Contacts stays at `/day/contacts` and **renders the same directory component**.
3. **One person sheet, not one person page.** Tapping a name anywhere opens `PersonSheet` (bottom sheet). Do not navigate to `/people/[id]` as the primary pattern.
4. **Households stay `Guest` / `GuestPerson`.** Do not flatten 32 households into `Person`. Optional `GuestPerson.personId` is a link for the few overlaps (Belle, Wendy), not a merge of the guest list.
5. **Ask recipients stay `PinAccount.id` on the wire.** The UI may show people; `createRequest` still writes `recipientAccountId`. Never send `Person.id` as a recipient.
6. **Additive schema only.** New nullable columns and optional FKs are allowed. No `DROP`, no required columns on existing rows, no deleting `Contact` / `PinAccount` / `GuestPerson` tables in this project.
7. **No bulk deletes of real data.** Merge scripts log before/after and are reversible. Never `deleteMany` on Task / Request / ShoppingItem / Guest / BudgetItem except through existing per-row actions.
8. **Reuse visibility helpers.** `taskVisibilityWhere`, `requestVisibilityWhere`, `sessionCanMutateTask`, `canSeeHome`, `canManageOwners`. Do not fork permission logic.
9. **Home default is daily work, not the Excel dump.** Decision packages stay in the database and on `/work/[id]`. They are not the default Open list.
10. **Who-chips do not list unused people.** Home who-chips: All · David · Haley · Both, then people who actually own a visible task/shop item or match `assigneeFilter`. Avalon Green with zero tasks is not a chip.
11. **Owner cycle stays guarded.** Same `nextCoupleOwnerIds` rule as the inbox plan.
12. **Offline pack shape does not change.** Derive directory/Home extras client-side. Additive fields only, with fallback.
13. **Redirects stay temporary** (`redirect()`, never `permanent: true`).
14. **`ensurePersonByName` must alias-match** before create. Re-running `ensure-known-people` / `ensure-day-of` must not create `avalon_planner` next to `avalon_green` again.
15. **Declined ≠ done. Unread ≠ section.** Inbox ask rules still apply.

---

## Product model

### A person has hats, not tables

```
Person (canonical)
  name, photo, phone, email
  hats: couple | family | vendor | party | group
  optional: PinAccount (can receive asks)
  optional: BudgetItem[] (if vendor / payee)
  optional: GuestPerson (if they are also a named guest)
```

`Contact` becomes the **day-of projection** of a Person who has a phone or photo.  
`PinAccount` is **login + inbox**, linked with `linkedPersonId`.  
`Guest` is a **household** (address, RSVP, table, gifts) that contains `GuestPerson` names.

### The person sheet (the unification primitive)

One sheet, opened from Home, Day-of, Money, Ask picker, Guests (when linked):

```
┌─────────────────────────────────┐
│ [photo]  Avalon Green           │
│          Vendor · planner       │
│          555-…                  │
│                                 │
│  [ Call ]              [ Ask ]  │
│                                 │
│  Payments                       │
│  $2,400 left · due Sep 15       │
│  ████████░░░░  60%              │
│                                 │
│  Open asks                      │
│  Reception dinner options       │
└─────────────────────────────────┘
```

- **Call** if `phone` is set (`tel:`). Hidden if empty.
- **Ask** if some `PinAccount.linkedPersonId === person.id` and `canSeeRequests`. Hidden if they have no PIN.
- **Payments** if any `BudgetItem` is linked to this person. Tap amount → inline pay / open Money row.
- **Open asks** involving that account. Expand in-sheet or jump to Home with that thread.
- Family/party people omit Payments. Guests-only people (no Person link) do not use this sheet — they stay on the household card.

### What each existing surface becomes

| Surface | After | Not |
|---------|--------|-----|
| **Home** | Needs you · Pay · Buy · Thank · Week/Day before. Compose is Ask with **people**. Decisions behind a chip. | A wall of 54 packages + 15 who-chips |
| **Day-of → Contacts** | Same `PeopleDirectory` filtered to people with phone/photo (and vendors). Add person writes `Person`, not a second identity. | A separate Contact-only database forever |
| **Day-of → Timeline / Assignments** | Unchanged. Assignment dropdown uses the cleaned Person list. | — |
| **Guests** | View · By table · Thank-you · Edit. Thank-you is a first-class mode. View tap expands gifts. | A new `/thank-you` page |
| **Money** | Ledger + print. Row name opens PersonSheet when linked. Home Pay is the daily slice. | A Vendors app |
| **More → People** | Full directory: search + chips Everyone · Family · Vendors · Day-of · Has PIN. | Primary tab |
| **`/work/[id]`** | Unchanged deep editor | — |

---

## Information architecture

### Home sections (default, no `?filter=`)

| Section | Contains | Empty |
|---------|----------|--------|
| **Needs you** | Open asks where I am recipient (+ master third-party), same as today | “You're caught up.” Always show header if `canSeeRequests` |
| **Waiting** | Open asks I sent | Hide when 0 |
| **Pay** | Unpaid `BudgetItem` (and unpaid minor task money) with `payByDate` ascending, overdue first. Max ~5 + “All money →” | Hide if `!canSeeBudget` or count is 0 |
| **Buy** | Incomplete `ShoppingItem` | Hide if `!canSeeShop` or count is 0 |
| **Thank** | `GuestGift` where `thanked === false` | Hide if `!canSeeGuests` or count is 0 |
| **Week before / Day before** | `org_step` rows | Hide if no tasks permission or no children |
| **Decisions** | Package groups (`task` + `task_step`). **Collapsed by default.** `?filter=tasks` expands. | Hide if `!canSeeTasks` |

Vendor PIN (`!canSeeTasks && !canSeeShop`): Needs you / Waiting / Done only. No Pay / Buy / Thank / Decisions.

### Home chips (one scroller, short)

`/home?filter=needs-me&who=david`

| Chip | Param | Shows |
|------|--------|--------|
| All | omit | Default sections above |
| Needs me | `needs-me` | Needs-you asks + my tasks + my buy (existing inbox rule) |
| Asks | `asks` | Ask rows only |
| Buy | `buy` | Buy only |
| Pay | `pay` | Pay only (requires `canSeeBudget`) |
| Thank | `thank` | Thank only (requires `canSeeGuests`) |
| Decisions | `tasks` | Decision packages + org steps |
| Done | `done=1` | Existing Done |

**Who chips:** All · David · Haley · Both, then **only people with visible work** or `assigneeFilter`. Horizontal scroll. Do not dump the 17 unused Person rows.

Remove Home chips: Waiting (section is enough), the old Tasks chip name (becomes Decisions).

### Ask compose (fast)

Default control is still **Ask someone**.

Do **not** lead with a `<select>` of PIN accounts.

1. Tap **Ask someone**
2. Horizontal people row: photo/initials of PIN accounts the session can message, labeled with **Person name** (fallback account name)
3. Tap a person → title field focuses
4. Optional message
5. Send → `createRequest` with that account’s id

Related-decision picker stays optional and collapsed (“Link a decision”).  
If the session can only see asks, no Ask/Task/Buy toggle.

### Guests modes

Keep the segmented control. Add **Thank-you** as a mode, not a page:

`View` · `By table` · `Thank-you` · `Edit`

- **View:** tap a household to expand address, seating, gifts, thanked state (read). Edit still for structured changes.
- **Thank-you:** flat list of gifts, unthanked first, checkbox → `setGuestGiftThanked`. Household name as the row label.
- **By table / Edit:** as today.

### People directory (More + Day-of Contacts)

Same component, two query presets:

- `/people` — Everyone
- `/day/contacts` — Day-of (has phone or photo or `hat === vendor`)

Chips: Everyone · Family · Vendors · Day-of · Has PIN  
Search: name, phone, company  

Add person: one form (name, hat, phone, email, photo). Writes `Person`. If they need a PIN, that stays on Accounts (do not invent PIN creation from the directory in v1).

---

## Data model (additive)

### Schema additions (all nullable / optional)

```prisma
model Person {
  // existing fields…
  hat         String?  // "couple" | "family" | "vendor" | "party" | "group"
  phone       String?
  email       String?
  photoData   String?
  company     String?
  aliases     String[] @default([])
  contacts    Contact[]
  guestPeople GuestPerson[]
  vendorBills BudgetItem[] @relation("BudgetVendor")
}

model Contact {
  // existing fields…
  personId String?
  person   Person? @relation(fields: [personId], references: [id])
}

model GuestPerson {
  // existing fields…
  personId String?
  person   Person? @relation(fields: [personId], references: [id])
}

model BudgetItem {
  // existing fields…
  vendorPersonId String?
  vendorPerson   Person? @relation("BudgetVendor", fields: [vendorPersonId], references: [id])
}

model PersonMergeLog {
  id           String   @id @default(cuid())
  winnerId     String
  retiredId    String
  retiredName  String
  reassigned   Json     // counts / ids touched
  createdAt    DateTime @default(now())
}
```

`Contact` rows stay. UI prefers `Person` when `personId` is set; otherwise shows the Contact (so nothing vanishes mid-migration).

`PinAccount.linkedPersonId` already exists — **backfill**, do not add a new column.

### Alias map (authoritative for merges)

Use this table in `src/lib/person-aliases.ts` and in the merge script. Names are production as of 2026-08-30.

| Winner `Person.id` | Also means | Also `Contact` name | PIN |
|--------------------|------------|---------------------|-----|
| `david` | | Groom - David | David |
| `haley` | | (bride contact if present) | Haley |
| `shelly` | | Shelly Wiewiora | Shelly, John (keep both PINs → same person) |
| `bri` | | Bri Eling | — |
| `avalon_green` | `avalon_planner` | Avalon / Avalon Green | Avalon |
| `barry_tilson` | `barry` | Barry Tilson | — |
| `belle_genton` | | Belle Genton | — (also GuestPerson) |
| `precious_peony` | | Precious Peony | — |
| `wendy_rush` | | Wendy Rush | — (also GuestPerson) |
| `black_sheep_shelter` / BSS | | BSS / Black Sheep Shelter | — |
| `kurt` | | Kurt (role label if any) | — |

Contacts **only** (create `Person` if missing, `hat: family` or `party`): Andi Carhart, Evan Eling, Trinity Medler, Lisa Pelfresne, Denise Bordeaux.

Groups stay groups: `bridal_party`, Maid of Honor, Best Man, etc. `hat: group`. Do not merge groups into humans.

### Merge behavior (script, not UI)

`scripts/merge-people.ts` (new):

For each alias pair:

1. Reassign `TaskAssignee`, `DayAssignmentAssignee`, `ShoppingItem.ownerId`, `BudgetItem.ownerId` / `paidById`, `PinAccount.linkedPersonId` from retired → winner
2. Append retired name to `winner.aliases`
3. Insert `PersonMergeLog`
4. Delete the retired `Person` **only if** it has zero remaining FKs
5. Print a dry-run by default; `--apply` writes

Never merge a `Guest` household into a `Person`. Only optional `GuestPerson.personId`.

### Duplicate task (known)

Under package “Rehearsal dinner”: **confirm rehersal time** and **Confirm Rehersal Time**.

Merge: keep the child with more notes / assignees / later `updatedAt`; move any `Request.taskId` to the keeper; delete the empty duplicate via existing `delete` path or a logged one-row script. Do not `deleteMany`.

### Dedup on create

- `ensurePersonByName`: match `name` **or** `aliases` (insensitive) **or** slug-equivalent (`Avalon Green` ↔ `avalon_green` ↔ `avalon planner`)
- `createRequest` / `createRequestFromItem`: if an **open** ask already exists with same sender, recipient, and normalized title, return the existing id (no second row)
- `ensure-known-people.ts` / `ensure-day-of.ts`: call the shared helper, never a private copy of slug+create

---

## Home Pay / Thank rows

These are **derived inbox kinds**, not new tables.

```ts
// additive to InboxKind
type InboxKind = "ask" | "task" | "task_step" | "org_step" | "buy" | "pay" | "thank";
```

| Kind | Source | `done` | Primary tap | Checkbox |
|------|--------|--------|-------------|----------|
| `pay` | `BudgetItem` where remaining > 0 | remaining ≈ 0 | PersonSheet or expand: amount paid | None (money is not a checkbox). Optional “Log payment” inline |
| `thank` | `GuestGift` where `!thanked` | `thanked` | Expand household | `setGuestGiftThanked` |

Permissions: Pay requires `canSeeBudget` (same visibility as `/money` — master/edit sees all; shared-money sees shared/owned). Thank requires `canSeeGuests`. Shared-money PIN still has **no Home** (`canSeeHome` unchanged).

Do not put Pay/Thank in the offline pack as a new required array. Offline Home can omit them until a later additive pack field.

---

## Server actions / files

### New

| File | Responsibility |
|------|----------------|
| `src/lib/person-aliases.ts` | Winner map, slug/alias match, `hats` |
| `src/lib/directory.ts` | `listDirectory(session, filter)`, `getPersonSheet(id)`, merge of Person+Contact+PIN |
| `src/lib/directory.test.ts` | Alias match, unused people excluded from who-chips, vendor filter, PIN resolution |
| `src/components/PersonSheet.tsx` | Sheet: call, ask, pay, open asks |
| `src/components/PeopleDirectory.tsx` | Search + hat chips + rows |
| `src/components/PeopleAvatarPicker.tsx` | Ask compose recipients |
| `src/components/HomePayRow.tsx` / thank row | Dense rows; or extend `InboxNoteRow` |
| `scripts/audit-duplicate-data.ts` | Read-only report (Person dups, Contact overlap, Guest overlap, task title dups, unlinked PINs) |
| `scripts/merge-people.ts` | Dry-run / `--apply` using the alias map |
| `src/app/(app)/people/page.tsx` | Restore directory (remove Stage B redirect) |

### Touch

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Additive columns above; `npx prisma db push` |
| `src/lib/people.ts` | `ensurePersonByName` uses aliases; stop private slug-only create in scripts |
| `src/lib/inbox.ts` | Default sections; `pay` / `thank` kinds; who-chips = people with work |
| `src/lib/inbox.test.ts` | Default Home hides Decisions; who-chip exclusion |
| `src/lib/modules.ts` | `people.hideFromMore = false`; keep `primary` false |
| `src/lib/routes.ts` | Remove `/people` from `SKIP_FIRST_ROUTE` **only if** guests-only must not land on People. Guests-only still lands on `/guests`. People is not a firstAllowed target. |
| `src/app/actions.ts` | Narrow: `savePersonProfile`, `linkContactToPerson`, `setBudgetVendor`, `logBudgetPayment` (amountPaid only). Ask compose unchanged besides recipient UX. `revalidatePath("/people")` + `/home` + `/day/contacts` |
| `src/components/InboxAddBar.tsx` | Avatar picker; related task collapsed |
| `src/components/InboxBoard.tsx` | New default sections; shorter chips |
| `src/components/GuestList.tsx` | Thank-you mode; View expand |
| `src/components/ContactsPanel.tsx` | Thin wrapper around `PeopleDirectory` or delete usage |
| `src/app/(app)/day/contacts/page.tsx` | Render directory with day-of preset |
| `src/app/(app)/money/page.tsx` | Pass vendorPersonId; row opens sheet |
| `package.json` | `"db:audit": "tsx scripts/audit-duplicate-data.ts"` |
| Scripts | `ensure-known-people.ts` / `ensure-day-of.ts` import shared helper |

### Do not change

`createRequest` permission model, `RequestsBoard` (still deprecated, still present), `/work/[id]`, Stay / Rehearsal / Dinner, PIN pad, `canSeeHome` derivation, owner-cycle guard, offline IndexedDB version unless adding optional fields.

---

## PIN backfill (ops, not a product dependency)

| Account | Set `linkedPersonId` |
|---------|----------------------|
| David | `david` (already) |
| Haley | `haley` (already) |
| Bridal Party | `bridal_party` (already) |
| Shelly | `shelly` (already) |
| John | keep `shelly` (same human, second PIN) **or** leave and treat both as Shelly in the picker |
| Mom Balasa | `shelly` if that is mother-in-law; otherwise create/keep a dedicated Person — **confirm before apply** |
| Avalon | `avalon_green` after merge |

Home Ask picker groups multiple PINs for one person as one avatar (sends to the non-master / vendor account when obvious; if two PINs share a person, picker shows the account subtitle once: “Shelly · John”).

Do not block UI on this backfill. Picker falls back to account name when `linkedPersonId` is null.

---

## Visual refinement (same routes, calmer)

The cream / forest tokens stay. The mess is **density and too many equal controls**, not the palette.

1. **Home compose** is one primary button until opened. Opened state is a sheet (reuse `.sheet`), not a second card stacked on chips.
2. **Chip row ≤ 6 visible concepts** before scroll (All, Needs me, Asks, Buy, Pay, Decisions). Who is a second row **only when** more than the couple exist as owners.
3. **Pay / Buy / Thank** use the notes-list row language already on Home (no new card skins).
4. **Person rows** (directory): 56px photo, name, one muted line (phone or “Vendor”), trailing Call. Same as today’s Contacts, shared.
5. **Guest View** stays dense; expansion is in-row, not a modal.
6. **44px** hit targets on Call, Ask, checkbox, compose.
7. Do not redesign Timeline, Money print, or PIN pad in this project.

---

## Phases

Ship in this order. Do not restore `/people` as a broken empty page. Do not redirect Day-of Contacts away until the directory reads Person+Contact together.

### P0 — See the mess (read-only)

- Add `scripts/audit-duplicate-data.ts` + `npm run db:audit`
- Report: Person slug/name dups, Person↔Contact overlaps, GuestPerson↔Person overlaps, unlinked PINs, task title dups (normalized), unused Person ids
- Commit the script even if production numbers differ

**Done when:** `npm run db:audit` prints the tables against local or `DATABASE_URL` without writing.

### P1 — Stop creating duplicates

- Shared `ensurePersonByName` with alias + slug match
- Scripts call it; delete the private copy in `ensure-known-people.ts`
- Open-ask dedup in `createRequest`
- Unit tests for alias match (`Avalon Green` / `avalon_planner`)

**Done when:** calling `ensurePersonByName("Avalon Green")` twice and `"avalon planner"` returns the same id in tests.

### P2 — Merge known duplicate People (logged)

- Schema: `aliases`, `PersonMergeLog` (can land with P3 if one push is easier)
- `scripts/merge-people.ts --dry-run` then `--apply` on production with the couple present
- Merge `avalon_planner` → `avalon_green`, `barry` → `barry_tilson`
- One-row rehearsal task duplicate

**Done when:** audit shows those Person dups gone; task assignees still resolve; Ask still works.

### P3 — Person profile fields + Contact link

- Additive `hat`, `phone`, `email`, `photoData`, `company`, `Contact.personId`
- Copy matching Contact fields onto Person (do not delete Contact)
- Create Person for contacts-only names
- Backfill `hat` for known vendors / couple / family
- `savePersonProfile` narrow action

**Done when:** David has phone from “Groom - David” on `Person`; Contact row still exists and points at `david`.

### P4 — Directory + PersonSheet (More + Day-of)

- Restore `/people` in More
- `PeopleDirectory` + `PersonSheet`
- `/day/contacts` uses the same component (day-of preset)
- Add person writes Person (+ optional Contact row for offline pack compatibility)

**Done when:** Adding “Florist temp” on Day-of Contacts shows on More → People; Call works; no second Person on re-add.

### P5 — Ask is people (Home)

- `PeopleAvatarPicker` in compose
- PersonSheet **Ask** pre-fills recipient
- Labels use Person name

**Done when:** Sending to Avalon is tap-avatar, not “choose who…” dropdown. Vendor PIN still receives the ask.

### P6 — Vendors and payments

- `BudgetItem.vendorPersonId` + name match backfill (Avalon, Barry, BSS, …)
- Home **Pay** section
- PersonSheet payments + `logBudgetPayment`
- Money row opens sheet

**Done when:** Home shows next unpaid; paying from the sheet updates Money; shared-money PIN still cannot open Home.

### P7 — Thank-you on Guests + Home

- Guests **Thank-you** mode
- View-row expand for gifts
- Home **Thank** section if `canSeeGuests`

**Done when:** Checking thanked on Guests hides the Home Thank row after refresh. Print gift list still works.

### P8 — Home default is daily (beauty)

- Decisions collapsed; default sections as specified
- Who-chips exclude unused people
- Compose in a sheet; chip bar shortened
- Inbox tests updated

**Done when:** Master login shows Needs you + Pay/Buy/Thank/org cards, **not** Makeup plan / Florals as the first Open wall. `?filter=tasks` still shows every package. Mother-in-law still sees only Shelly work.

---

## Permissions (flags unchanged)

Do not add `canSeeDirectory`. People in More uses `canSeePeople` **or** (`canSeeTimeline` && viewing from Day-of). Day-of Contacts remains gated by `canSeeTimeline` so vendors keep their call list without seeing the couple’s full family directory.

| Account | People (More) | Day-of Contacts | Home extras |
|---------|---------------|-----------------|-------------|
| Master / Partner | Full | Full | Pay + Thank if flags on |
| Vendor | No | Yes (timeline) | Asks only |
| Mother-in-law | If `canSeePeople` | No (no timeline today) | Asks + filtered tasks |
| Shared-money | No | No | No Home |
| Guests-only | No | No | Lands on `/guests` |

Accounts grid: keep granular flags. Do not add a Home or Directory checkbox.

---

## Testing

### Automated

- Alias / slug match; merge does not create a third person
- `createRequest` dedup of identical open asks
- Who-chips omit unused Person
- Default Home section membership (Decisions absent unless `filter=tasks`)
- `canSeeHome` still false for budget-only
- `firstAllowedRoute`: Home / money / guests-only unchanged
- Existing `inbox.test.ts`, `routes.test.ts`, `people.ts` consumers, guest gift helpers

### Manual (browser, master 0425)

1. `db:audit` on a copy of production data
2. Merge dry-run; then apply on staging/prod with a backup
3. Home: send ask via avatar (Avalon); reply; complete
4. Home: Pay row appears for an unpaid item; log a payment; Money matches
5. Day-of Contacts: call David; edit photo; same person on More → People
6. Guests: Thank-you mode; check a gift; Home Thank updates
7. Vendor PIN: Home is asks only; Day-of Contacts still there
8. Mother-in-law: no vendor directory leak; Shelly tasks only
9. Shared-money: `/money` only
10. Offline download still opens

---

## Data-preservation checklist

| Data | After |
|------|--------|
| `Person` (used) | Winner row + aliases |
| `Person` (unused but real humans) | Kept, now have phone/hat — they become the directory |
| `Person` (true dups) | Merged via log; retired id gone only when FKs are empty |
| `Contact` | Kept; `personId` set when matched |
| `PinAccount` | Kept; `linkedPersonId` backfilled where obvious |
| `Guest` / `GuestPerson` / `GuestGift` | Kept; thank-you mode + optional `personId` |
| `Task` packages + org cards | Kept; Decisions chip / `/work/[id]` |
| `Request` + messages | Kept; ask picker is UX only |
| `BudgetItem` | Kept; optional vendor link |
| `ShoppingItem` | Kept; Home Buy |
| Offline packs | Same keys |

---

## Out of scope

- Dropping `Contact` or `GuestPerson`
- Guest website / public RSVP
- Seating chart canvas (By table list is enough)
- Auto-creating PIN accounts from the directory
- Rewriting Timeline, Stay, Rehearsal, Dinner
- Restoring the calendar month grid
- Swipe gestures
- A unified `InboxItem` table
- Running Excel `db:seed` against production
- Deleting `RequestsBoard` / `ShoppingListBoard`

---

## Implementation order

```
P0  audit script (read-only)
P1  ensurePersonByName aliases + ask dedup
P2  merge known Person dups + rehearsal task
P3  Person profile columns + Contact.personId backfill
P4  directory + PersonSheet (More + Day-of Contacts)
P5  Ask avatar picker
P6  vendorPersonId + Home Pay
P7  Guests Thank-you mode + Home Thank
P8  Home default = daily work; chip/compose beauty
```

P0–P2 can ship without UI. P4 is the first user-visible unification. P8 is what makes Home feel finished — do not ship P8 before Pay/Thank exist or the default Home will look empty in the wrong way (hide packages **and** have nothing else).

---

## Suggested commit subjects

- `Add duplicate-data audit script`
- `Match people by alias before creating Person rows`
- `Merge duplicate Person rows with a reversible log`
- `Add Person contact fields and link Contact`
- `Restore People directory and shared person sheet`
- `Ask people from avatars instead of PIN dropdowns`
- `Link budget items to vendor people and surface Pay on Home`
- `Add thank-you mode on Guests and Home`
- `Collapse decision packages on Home by default`
