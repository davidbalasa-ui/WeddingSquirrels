# Contextual wedding — People, Vendors, Day-of

**For:** Composer implementation  
**Wedding:** October 16, 2026  
**Supersedes:** the Home-centered draft in this file (asks-on-Home, Pay/Thank strips, no Vendors surface).  
**Home inbox plan** (`unified-home-inbox.md`) already shipped. This file is the next product. Implement from **this** file.

**Non-negotiable:** Zero data loss. Additive schema only. Existing ask threads become messages — they do not disappear. Contacts with photos and phones must work **offline without tapping Download**.

---

## Destination in one line

You work **on the thing**, not on a master list. People is the face book (on the phone). Vendors is setup + money. Day-of is the clock. Messages is just texting each other, with a ping.

```
People              Vendors                 Day-of
who they are        what we still owe       when it happens
photo · phone       how to pay              timeline
on this phone       insurance · contract    same people, Call
                    tips · their tasks
```

**Nav:** `People` · `Vendors` · `Day-of` · `More`  
**More:** Guests · Messages · Shop · Stay · Rehearsal · Accounts  
**Header:** envelope (unread messages) on every screen. Not a primary tab. Not a thing called Ask.

Home is **not** a primary tab. Login lands on People, except inside 7 days of the wedding → Day-of.

---

## Why the last plan still felt wrong

Home-as-inbox assumed the couple wants a notes app of every leftover Excel line. They don’t. They want to **make progress while looking at the vendor, the guest, or the day**.

| Last plan | What they actually said |
|-----------|-------------------------|
| Home is the daily list (asks, pay, buy, thank, packages) | Home still doesn’t feel right |
| Vendors are a hat + a Pay strip on Home | Vendor **setup** is a place: owed, how to pay, insurance, contract, tips |
| Contacts are a filter of People | Photos + phones must live **on the device** so everyone knows who everyone is on Oct 16 |
| Ask stays a ticket (Needs you / Done / Decline) | Ask may not be a thing — **messaging + notifications** |
| Tasks stay on Home, collapsed | **Move tasks** to where the work is; sort the existing pile |

---

## Hard rules

1. **No Home dump.** Do not put 54 packages back on a default list. `/home` may redirect to People (or a 4-line Next card). `/today` stays a soft redirect.
2. **People is the face book.** Name, photo, phone, role. Searchable. Works from IndexedDB if the network is gone. Wedding-party / vendor PINs with Day-of access get this book.
3. **Offline contacts are automatic.** On login and whenever People/Day-of is opened online, upsert the contact book into IndexedDB. The “Download for offline” button may still refresh the *full* pack (timeline, guests, money). Faces and phones must not depend on that tap.
4. **Vendors is the money + paperwork place.** One card per vendor. Budget lines attach to a vendor. “How much is left?” is answered here, not on Home.
5. **Tasks live on a home.** Every open parent package is assigned a home (table below). Unassigned leftovers go to a small “Loose ends” on Vendors or More — not back onto Home.
6. **Ask is Messages.** Keep `Request` + `RequestMessage` rows. Drop ticket verbs from the default UI (Decline / related decision / Needs you vs Waiting as sections). A thread is a conversation. Unread is a badge + a push.
7. **Ask recipients stay `PinAccount.id` on the wire.** UI shows the person.
8. **Households stay `Guest`.** Do not flatten 32 parties into Person.
9. **Additive schema only.** No `DROP`. No `deleteMany` on real user data. Merge scripts log and are reversible.
10. **Owner cycle / visibility helpers stay.** Do not fork `taskVisibilityWhere` or `requestVisibilityWhere`.
11. **Photos stay small.** Existing client resize (~400px data URLs) is the v1 photo store. Good enough for faces on a phone. Do not block on Blob storage for portraits.
12. **Contracts/insurance v1 are checkboxes + note + optional URL.** File upload (Vercel Blob) is phase-later, not a gate.

---

## The three objects

### 1. Person — “who is this”

What you need on October 16 when you don’t know the DJ from the florist:

- Photo
- Display name
- Role line (`Planner`, `Photographer`, `Maid of honor`, `Groom`)
- Phone (`tel:`) · email
- Optional: they have a PIN → Message

This list **syncs to the phone**. Day-of Contacts is this list, filtered to “has phone or is vendor,” same component.

Hats: `couple` · `family` · `party` · `vendor` · `group`

Groups (`Bridal party`) stay groups. They are not faces.

### 2. Vendor — “are we set with them”

A vendor **is** a Person (`hat: vendor`) plus a setup record. Opening Avalon from People shows Call / Message. Opening Avalon from Vendors shows money and paperwork. Same human.

Per vendor:

| Field | Why |
|-------|-----|
| Role | Planner, Venue, Photographer, … |
| Phone / email / photo | Same as Person (offline) |
| Budget lines | Total · paid · **left** · pay-by date |
| Pay method | check · Venmo · Zelle · cash · card · wire · invoice |
| Pay details | handle, memo, who the check is to |
| Insurance on file | yes / no / n/a |
| Contract | yes / no + optional URL or note (where the PDF lives) |
| Tip | needed? amount? how (cash envelope / add to check / Venmo) |
| Open tasks | only the lines that belong to **this** vendor |
| Messages | threads with their PIN, if any |

“Other costs” (dress, veil, cutlery, Airbnb) that are not a day-of human stay at the bottom of Vendors as **Other costs** — same money math, no face required.

### 3. Day-of — “what happens when”

Timeline stays. Assignments stay. Contacts tab **is** the People book (day-of preset). Week-before / day-before org steps live **here**, not on Home — that is when you will actually do them.

---

## What Home becomes

Not a product. Two options (pick A unless Next is requested in implementation):

**A (default).** `/home` → `redirect("/people")` (or `/day` if `daysUntilWedding <= 7`).  
**B.** `/home` is a 4-line card: days left · unread messages · next unpaid vendor · next vendor missing insurance/contract. Each line is a link. No task list. No chip bar.

Do not keep InboxBoard as the default UI.

---

## Messages (Ask is over as a product word)

Today Ask is a ticket: title, recipient, open/done/declined, related task, Needs you / Waiting. That is why it feels like another task list.

**Keep the data.** 17 threads (10 open) become conversations.

**New UI (More → Messages, plus header envelope):**

```
Avalon          Reception dinner options     · 2
Shelly          Can you confirm the count    ·
```

Tap → thread (existing messages + composer). No Decline. No “mark done” required. Optional overflow: “Archive” maps to `status: done` so old threads can hide.

**Compose:** pick a person who has a PIN → type. No “related decision” field on the default path.

**Notifications:**

- In-app unread badge (already exists) moves from Home to the envelope.
- **Web Push** on the existing service worker (`public/sw.js`): `push` + `notificationclick`.
- New table `PushSubscription` (`id`, `pinAccountId`, `endpoint`, `p256dh`, `auth`, `createdAt`).
- VAPID keys in env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). Prompt once after login (People or layout).
- On `addRequestMessage` / new thread: send to the other party’s subscriptions. Fail soft — message still saves if push fails.
- Do not add SMS/email in this project.

Vendor PIN “Ask-only” becomes **Messages + Day-of**. Same flags (`canSeeRequests`, `canSeeTimeline`).

---

## Offline face book (this is the day-of feature)

Today: a manual Download button writes a whole pack to IndexedDB; contacts are one array inside it; the SW only caches the app shell.

**Needed:**

1. `src/lib/contacts-cache.ts` — IndexedDB store `contacts-v1`, key `book`.
2. Shape: `{ fetchedAt, people: [{ id, name, hat, role, phone, email, photoData }] }`.
3. `GET /api/contacts-book` — permission: `canSeeTimeline` **or** `canSeePeople`. Returns the same rows the directory shows.
4. Client: on app layout mount (online), fetch and upsert. People and Day-of Contacts **read cache first**, then network.
5. Photos are already downscaled data URLs — they go in the cache. That is how “we all know who everyone is” works with no signal at BSS.
6. Full `/api/offline` pack stays for timeline/guests/money. Do not remove it. Do not make faces wait on it.

Wedding-party PINs (timeline on, guests off) still get the face book.

---

## Schema (additive)

```prisma
model Person {
  // existing…
  hat         String?   // couple | family | party | vendor | group
  role        String?   // "Planner", "Photographer"
  phone       String?
  email       String?
  photoData   String?
  aliases     String[]  @default([])
  vendor      Vendor?
  contacts    Contact[]
}

model Vendor {
  id             String   @id @default(cuid())
  personId       String   @unique
  person         Person   @relation(fields: [personId], references: [id])
  payMethod      String?  // check | venmo | zelle | cash | card | wire | invoice
  payDetails     String?
  insurance      String   @default("unknown") // yes | no | na | unknown
  contract       String   @default("unknown")
  contractNote   String?
  tipNeeded      Boolean  @default(false)
  tipAmount      Float?
  tipHow         String?
  notes          String?
  budgetItems    BudgetItem[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model BudgetItem {
  // existing… plus:
  vendorId String?
  vendor   Vendor? @relation(fields: [vendorId], references: [id])
}

model Contact {
  // existing… plus:
  personId String?
  person   Person? @relation(fields: [personId], references: [id])
}

model PushSubscription {
  id           String     @id @default(cuid())
  pinAccountId String
  pinAccount   PinAccount @relation(fields: [pinAccountId], references: [id], onDelete: Cascade)
  endpoint     String     @unique
  p256dh       String
  auth         String
  createdAt    DateTime   @default(now())
}

model PersonMergeLog {
  id          String   @id @default(cuid())
  winnerId    String
  retiredId   String
  retiredName String
  reassigned  Json
  createdAt   DateTime @default(now())
}
```

`Task` stays. Add optional `vendorId` **or** keep using `budgetItemId` / parent package and resolve vendor in the directory layer. Prefer `Task.vendorId` nullable so a task can sit on a vendor without a budget line.

`Request` stays. UI ignores `declined` unless opening archive.

---

## Sort the existing work (do this, don’t leave it on Home)

Production has ~54 parent tasks / 140 children from Excel packages plus week/day-before org cards. **Homes** below are the assignment. Implementation moves `vendorId` / leaves a pointer; it does not delete titles unless listed as merge/kill.

### Vendors to create (from day-of contacts + known names)

| Vendor | Role | Phone / email already in seed | Budget match (name contains) |
|--------|------|-------------------------------|------------------------------|
| Avalon Green | Planner | (386) 589-7215 | coordinator, Avalon |
| Black Sheep Shelter | Venue | (616) 335-0797 | black sheep, BSS, venue |
| Barry Tilson | Photographer | (248) 704-3731 | photog |
| Belle Genton | Videographer | (513) 833-0929 | video (if a line exists) |
| Precious Peony | Caterer | preciouspeonyllc@gmail.com | cater, flower, peon |
| Wendy Rush | Mistress of ceremonies | (616) 318-9393 | usually $0; still a vendor card if they are paid or need a tip |
| Bartender | Bartender | *(add when known)* | bartender |
| Band / DJ | Music | *(add when known)* | band, DJ |

**Other costs** (no face): Airbnb, hotel, wedding dress, alterations, veil, groom attire, stationer/invites, cutlery, officiant if unpaid to a nameless line.

Merge Person dups first: `avalon_planner` → `avalon_green`, `barry` → `barry_tilson`. Link Contacts (`Avalon Green · Planner`, etc.) to those People. Copy phone/photo onto Person.

### Where each package goes

| Today’s package | Home after | What to do with children |
|-----------------|------------|--------------------------|
| **Vendor payments** | **Split onto vendors** | “Pay X / tip envelope / balance” → that vendor’s tasks + tip fields. Kill the package header once children are attached. |
| **Vendor & BSS paperwork** | **Vendor setup fields** | Insurance / licenses / names / bartender / helpers → checkboxes on BSS, Avalon, bartender. Do not keep a floating “paperwork” package. |
| **Florals & centerpieces** | Precious Peony | Bouquet, centerpieces, extra flowers stay as that vendor’s tasks. |
| **Photos & video** | Barry + Belle | Shot lists, engagement, golden hour → Barry. Video/camcorder → Belle. Split children by title. |
| **Decor & venue styling** | Avalon + BSS | Avalon list / signage / placement → Avalon. Table layout / venue constraints → BSS. |
| **Cake & dessert** | Other costs **or** a baker vendor if they name one | Keep as vendor tasks if a person exists; else Other costs + Shop if they still need to buy a topper. |
| **Music & sound** | Band/DJ vendor if named; else BSS / Day-of notes | Playlists, walk song, downloads → vendor or Day-before “playlists” (already an org step). |
| **Makeup plan** | People (Katie / Belle) + Day-of assignments | These are day-of humans, not a decision dump. Open steps become assignment notes or person notes. |
| **Hair plan** | Same as makeup | Stylist / trial → that person if they exist; else Loose ends. |
| **Invitations & RSVPs** | **Guests** | Order/send/remind → a short checklist on Guests (not Home). Website RSVP stays a note. |
| **Guest logistics** | **Guests** | Count, seating, escort cards, parking, travel → Guests modes (View / By table / a Logistics note at top). |
| **Thank-you cards** | **Guests → Thank-you** | Order/write/send + per-gift `thanked`. |
| **Rehearsal dinner** | **Rehearsal** (`/rehearsal`) | Venue, time, count, outfits. Merge the duplicate “confirm rehearsal time” / “Confirm Rehersal Time” into one child. |
| **Ceremony plan** | **Day-of** timeline / BSS | Confetti, vows, ceremony flow belong on Friday’s blocks or BSS notes — not a Home package. |
| **Reception moments** | **Day-of** | Toasts, dances, exit, favors → timeline notes or assignments (Wendy/Kurt). |
| **Attire & rings** | **People → Us** (David & Haley) | Rings, outfits, emergency kit — a small checklist on the couple, not a vendor. |
| **Guest book** | **Shop** | Buy the book. One shopping line if not purchased. |
| **Registry** | **Loose ends** or drop | Out of band (registry site). Don’t keep a decision package on Home. |
| **Communication game plan** | **Kill as a package** | Messages *is* the plan. “Share folder / website / need to know” → one note on People or Day-of. |
| **Week-of & day-of readiness** | **Day-of** | Already `week_before` / `day_before` org cards. Move UI from Home to Day-of (collapsible on Timeline). |

### Org-card steps (already the right work — wrong screen)

| Step | Stays on Day-of, plus |
|------|------------------------|
| Confirm final payments / tip envelopes | Vendors: any `tipNeeded` still open |
| Confirm vendors (photog, Avalon, BSS, bartender, catering) | Vendors list — if setup is complete, this step is done |
| Final guest count / seating | Guests |
| Share timeline + parking with wedding party | Messages (send the thread) + Day-of |
| Charge devices / pack / maps / sleep / clothes | Day-before only |
| Rehearsal time + dinner locked | Rehearsal |

### Asks (production)

17 threads, 10 open, one linked to “Provide Reception Dinner Options” → Rehearsal dinner.  
**Do not delete.** Show as Messages. The rehearsal-dinner link can appear as a quiet “about Rehearsal” chip; do not require it for new threads.

---

## Information architecture

### People (`/people`, primary)

- Search
- Chips: Everyone · Family · Party · Vendors · Has PIN
- Row: photo · name · role · trailing Call
- Tap row → sheet: photo, phone, email, Call, Message (if PIN), and **Set up** if `hat === vendor` (opens vendor card)
- Add person: name, role/hat, phone, email, photo

### Vendors (`/vendors`, primary) — replaces Money as the default money UI

- Sort: unpaid first, then pay-by date, then name
- Row: photo/initials · name · role · **$ left** · missing-insurance/contract dots
- Tap → vendor setup (fields above) + that vendor’s tasks (checkboxes) + budget lines
- Footer: **Other costs** (non-vendor budget items) + **Print** (existing `/money/print`)
- `/money` soft-redirects to `/vendors` (keep print route)

Shared-money PIN: still no People/Day-of if flags say so; they land on `/vendors` (read-only lines they can see). `firstAllowedRoute`: budget-only → `/vendors`.

### Day-of (`/day`, primary)

- Tabs: Timeline · People · Assignments  
  (`/day/contacts` stays, label **People**, same directory, day-of preset)
- Week before / Day before checklists sit under Timeline (collapsed)

### Guests (`/guests`, More)

- View · By table · Thank-you · Edit  
- Thank-you mode: unthanked gifts first  
- View tap expands gifts (don’t require Edit)

### Messages (`/messages`, More + header)

- Soft-redirect `/requests` → `/messages` (not `/home?filter=asks`)
- Header envelope on `AppHeader` for anyone with `canSeeRequests`

### Shop (`/shop`, More)

- Restore the list (undo Stage B redirect to Home). Three items deserve a list, not a chip on a dump.

---

## PIN / permission notes

Flags unchanged. Rename copy only.

| Account | After |
|---------|--------|
| Master / Partner | People · Vendors · Day-of · Messages |
| Vendor (Avalon) | Day-of + Messages. Their vendor card is not an admin edit unless you later grant budget. |
| Wedding party | People (faces) · Day-of · Messages. No money. |
| Mother-in-law | Messages + whatever task filter remains on **Us / Loose ends** — not a vendor admin |
| Shared-money | `/vendors` read-only (same share rules as Money) |
| Guests-only | `/guests` |

`canSeeHome` can stay as a derived helper but should not gate a tab. `firstAllowedRoute`: if `canSeePeople` or `canSeeTimeline` → People (or Day-of when ≤7 days); else existing scan (`/vendors`, `/guests`, `/messages`).

Backfill `linkedPersonId`: Avalon → `avalon_green`. Mom Balasa → confirm before pointing at `shelly`.

---

## Files (new / touch)

| File | Role |
|------|------|
| `src/lib/person-aliases.ts` | Merge map + slug match |
| `src/lib/directory.ts` | Face book query |
| `src/lib/vendors.ts` | Vendor list, remaining $, setup completeness |
| `src/lib/contacts-cache.ts` | IndexedDB face book |
| `src/lib/push.ts` | VAPID send helper |
| `src/components/PeopleDirectory.tsx` | Shared list |
| `src/components/PersonSheet.tsx` | Call / Message / Set up |
| `src/components/VendorCard.tsx` | Setup + money + tasks |
| `src/components/MessagesBoard.tsx` | Thread list (port from RequestsBoard, drop ticket chrome) |
| `src/app/(app)/people/page.tsx` | Restore; primary |
| `src/app/(app)/vendors/page.tsx` | New |
| `src/app/(app)/messages/page.tsx` | New |
| `src/app/api/contacts-book/route.ts` | Face-book JSON |
| `src/app/api/push/subscribe/route.ts` | Store subscription |
| `public/sw.js` | `push` + `notificationclick` |
| `scripts/audit-duplicate-data.ts` | Read-only report |
| `scripts/merge-people.ts` | Dry-run / `--apply` |
| `scripts/attach-tasks-to-vendors.ts` | One-time: apply the sort table (logged, reversible) |
| `src/lib/modules.ts` | People + Vendors + Day-of primary; hide Home; Messages in More + header |
| `src/app/(app)/home/page.tsx` | Redirect (option A) |
| `src/app/(app)/money/page.tsx` | Redirect to `/vendors` |
| `src/app/(app)/requests/page.tsx` | Redirect to `/messages` |
| `src/app/(app)/shop/page.tsx` | Restore board |
| `package.json` | `db:audit` |

Do not delete `InboxBoard` / `RequestsBoard` in the first PR — redirect away, `@deprecated`.

---

## Phases

### P0 — Audit + sort script (no UI)

- `scripts/audit-duplicate-data.ts` + `npm run db:audit`
- Write `scripts/attach-tasks-to-vendors.ts` as **dry-run first**: print each open parent/child → proposed vendor/home using the table above
- Couple reviews the dry-run before `--apply`

**Done when:** dry-run lists every open package with a home. Nothing written.

### P1 — Stop duplicate people

- Shared `ensurePersonByName` with aliases
- Merge `avalon_planner` / `barry` with `PersonMergeLog`

### P2 — Face book (Person fields + offline cache)

- Additive Person columns; `Contact.personId`; copy phones from day-of contacts
- People page restored (can ship in More first, then promote)
- Auto IndexedDB sync; Day-of Contacts reads cache first
- Photos can be added immediately (existing resize)

**Done when:** Airplane mode after one online visit still shows Avalon’s face and `tel:` link.

### P3 — Vendor setup + move money

- `Vendor` + `BudgetItem.vendorId` + name-match backfill
- `/vendors` UI; `/money` redirects
- Setup fields: pay method, insurance, contract, tips
- Other costs footer

**Done when:** BSS remaining balance and “insurance unknown” are visible on one card.

### P4 — Attach tasks to homes

- `Task.vendorId` (or equivalent) from the reviewed dry-run
- Vendor card shows that vendor’s open steps
- Org cards render on Day-of
- Guests get thank-you mode + logistics note
- Rehearsal keeps rehearsal-dinner children
- Home no longer lists packages

**Done when:** “Shot list for photographer” is on Barry, not on Home. Week-before is on Day-of.

### P5 — Messages + push

- `/messages` + header envelope
- `/requests` redirects
- Archive = `status: done`
- Web Push subscribe + send on new message
- Copy: “Message”, never “Ask” in the UI

**Done when:** David messages Avalon; Avalon’s phone shows a notification; thread is in Messages, not a Needs-you ticket.

### P6 — Nav swap + calm

- Primary: People · Vendors · Day-of
- Home redirect; shop restored in More
- `firstAllowedRoute` updated + tests
- Offline copy button stays for the full pack; faces already cached

---

## Testing

### Automated

- Alias match / merge
- Face-book API permission (vendor with timeline: yes; shared-money: no)
- Vendor remaining $ math
- `firstAllowedRoute`: partner → People (or Day-of ≤7 days); shared-money → `/vendors`; guests-only → `/guests`
- Existing request visibility still scopes threads
- Inbox tests that assume Home as primary: update or retire

### Manual

1. Online: add a photo to Barry; go offline; open People — photo and Call still work
2. Wedding-party PIN: sees faces, not Vendors money
3. Vendor card: log a payment; remaining drops; print still works
4. Dry-run sort; apply on a copy of production; Barry has photo tasks
5. Message Avalon; badge + (if permission granted) system notification
6. `/home` and `/requests` do not show the old inbox
7. Oct 16 path: Day-of People tab is the same book

---

## Out of scope

- SMS / email notifications
- Public guest RSVP site
- Seating canvas
- Dropping `Contact` or `Request` tables
- Vercel Blob contract uploads (v2)
- Restoring the calendar month grid
- Re-running Excel `db:seed` on production

---

## Implementation order

```
P0  audit + task-home dry-run (sort the pile)
P1  merge duplicate people
P2  face book + automatic offline cache   ← day-of “who is this”
P3  vendor setup + money                  ← owed / how / insurance / tips
P4  attach tasks to those homes           ← progress where you already are
P5  messages + web push                   ← ask is just texting
P6  nav: People · Vendors · Day-of
```

P2 and P3 are the product. P4 is the cleanup they asked us to **sort**. P5 is Ask growing up. P6 is what makes Home finally go away.
