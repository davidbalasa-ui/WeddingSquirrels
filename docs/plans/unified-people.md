# Wedding coordination app — Day is the product

**For:** Composer implementation  
**Wedding:** October 16, 2026  
**Users:** Coordinator (Avalon) · Couple (David & Haley) · Planner/helpers · Wedding party · Vendors with a PIN  
**Supersedes:** Home-inbox, “People / Vendors / Day-of as three tabs,” and “asks on Home.”  
**Implement from this file.**

**Non-negotiable:** Zero data loss. Additive schema. Existing ask threads become DMs. Faces + names + phones work **offline without tapping Download**. Precious Peony is **food / catering**, not florals.

---

## Destination in one sentence

A coordinator-grade run-of-show: every moment has **faces**, every face has a **call** and a **task list**, every “can you do this” is a **task**, and talking is a **DM** with a ping.

```
DAY (the app)                         PLAN (how you load the day)
run-of-show with faces                same people, same vendors
NOW / NEXT highlighted                vendor setup (pay, insurance, tips)
call sheet = photo grid               guests · seating · thank-you
tap a face → call · DM · their tasks  tasks assigned to faces
```

**Nav:** `Day` · `Plan` · envelope (DMs)  
Two tabs. Not Home. Not Ask. Not People-versus-Vendors-versus-Day-of.

Login: `Day` if the account can see the timeline; else first Plan surface they can see (Vendors/money, Guests, or Messages). Inside 7 days everyone with Day access lands on Day.

---

## Why it still didn’t feel like a coordinator app

The last draft improved *where money lives*. It did not change *how you run Friday*.

Today’s Day-of is three disconnected tools:

| Tab | What you get | What’s missing |
|-----|----------------|----------------|
| Timeline | Time + a paragraph of notes | Katie, Belle, Barry are **words**, not faces you can tap |
| Contacts | Name / phone cards | Not a photo call sheet; not on the moment |
| Assignments | A second list of jobs | Not on the clock, not on the face |

A coordinator does not open Contacts, then Timeline, then Money. They look at **12:30 — photographer arrives**, see **Barry’s face**, tap Call, and know the shot-list task is still open.

Aisle Planner / Planning Pod / a film call sheet all work this way: **the schedule is the directory**.

Precious Peony correction: she is **catering / food**. Florals stay open until they name a florist — do not hang bouquet tasks on the caterer.

---

## Hard rules

1. **Day is the product.** Plan exists to load Day. Do not add a third primary tab for People or Vendors.
2. **Faces on the moment.** A timeline block shows the people who belong there (photo + first name). Notes stay for “what happens,” not for “who.”
3. **Call sheet is a photo grid.** Name under the face, role under the name. This is how the party learns who Skila is. List-of-cards is the fallback, not the default.
4. **Ask is a task.** “Can you confirm the bartender?” → task titled that, assigned to Avalon (or whoever). Do not create a second ticket type.
5. **DMs are talk.** Notifications on new messages. Optional link to a task or a timeline block. No Decline / Needs you / Waiting as product words.
6. **Same objects, three jobs.** Couple pays and assigns. Coordinator runs the clock and the faces. Party sees the day + who they are standing next to. One database.
7. **Offline face book is automatic.** IndexedDB upsert on login / Day open. Photos, names, phones, roles. Full offline pack stays for timeline + guests.
8. **Additive schema.** Use `Task.timelineBlockId` (already on the model, unused in UI) and `Request.taskId` (already unused in spirit). Add people-on-blocks. Do not drop tables.
9. **No Home dump.** `/home` redirects to Day (or Plan if no timeline).
10. **Do not invent a florist.** Florals stay Loose ends / a “Florist — TBD” vendor until they add a name.

---

## What “together” means

One person record. That face appears in four places without copying:

```
Person (photo, name, role, phone)
   ├─ on a timeline block     (“who is in this moment”)
   ├─ on the call sheet        (yearbook)
   ├─ as a vendor (if hat=vendor)  (owed, insurance, tip)
   └─ as a task owner          (“this is on Barry”)
```

Tap the face from **any** of those → the same sheet: photo, role, Call, DM, open tasks, and Setup if they are a vendor.

Assignments tab goes away as a place. A day-of job is either:

- people pinned on a block, or
- a task with `timelineBlockId` set (the column already exists)

---

## Day — Friday in the hand

This is what Avalon, David, Haley, and the party open on October 16.

```
  NOW · 12:32                    [grid] call sheet

  12:30 – 1:00
  Photographer arrives
  [Barry] [Avalon]
  ☐ Detail shots — dress, rings      on Barry
  Call · Message

  1:00 – 2:15
  Final getting ready
  [Haley] [Katie] [Barry] [Harmony] [Melody] [Skila]
```

**Now / Next.** While the clock is inside a block, that block is pinned at the top with a live “NOW” mark. Next block is one tap below. You do not hunt through morning notes during portraits.

**Faces on the row.** 40–48px circles, first name. Overflow `+2`. Tap a face → person sheet (Call, DM, tasks). Long-press / edit: add/remove who belongs on that moment.

**Open tasks on the block.** Only tasks with `timelineBlockId === this block` (or vendor tasks that were pinned here). Checkbox. This is coordinator progress — not 54 Excel packages.

**Call sheet button** (grid icon, always on Day). Full-screen photo roster:

```
[Avalon]     [Barry]      [Belle]      [Peony]
 Planner     Photo        Video        Food

[Wendy]      [Kurt]       [Katie]      [Skila]
 MC          MC           Hair         Kids
```

Search. Filter: All · Vendors · Party · Family. Tap → same person sheet. This is the “images with names so we know who everyone is” feature. It is **the** organizing tool, not a settings page.

**Vendor morning strip** (before noon, or a chip): each vendor who has an arrival block or a remaining balance. Photo · “arrives 12:30” · $ left · insurance dot. Tap → vendor setup. Coordinator sees “is the caterer here / paid / insured” without leaving Day.

**Week before / day before** sit on Day as a collapsed checklist *above* the clock, only until those days pass. After Friday morning they hide.

Review vs Edit stays: Review is the coordinator view (faces, now, call). Edit is times + notes + who-on-this-block.

---

## Plan — one place, four modes

Not four apps. Segmented control on `/plan` (or `/people` as the roster home with sibling modes):

`Roster` · `Vendors` · `Guests` · `Tasks`

Same People records. Same bottom nav: you are still in **Plan**.

### Roster (photo-first)

Add/edit faces: photo, name, role (`Planner`, `Photographer`, `Caterer`, `MOH`, `Groom`…), hat, phone, email, PIN link (read-only; PIN creation stays on Accounts).

This is also how the couple prepares the call sheet. If Barry has no photo on October 1, the coordinator knows to add one.

### Vendors

One card per vendor person. Precious Peony = **Food / Caterer**.

| Field | |
|-------|-|
| Remaining $ · pay-by | from linked budget lines |
| Pay method + details | Venmo / check / Zelle / cash / card / wire |
| Insurance | yes / no / n/a / unknown |
| Contract | yes / no + note or URL |
| Tip | needed, amount, how (envelope / add to check / Venmo) |
| Arrival | which timeline block they belong on (pins their face there) |
| Their tasks | shot list, final headcount to caterer, etc. |

**Other costs** (dress, Airbnb, cutlery, **florals until a florist exists**) at the bottom. `/money` redirects here. Print stays.

### Guests

Households. View · By table · Thank-you · Edit. Unchanged job, just no longer a primary tab. Seating and gifts are planner work, not Friday’s clock.

### Tasks

A real coordinator checklist — **assigned to a face**, optional **on a moment**, optional **on a vendor**.

```
☐ Shot list — detail photos     Barry     12:30 Photographer arrives
☐ Final headcount to Peony      Avalon    5:00 Dinner
☐ Tip envelope — Barry          David     (vendor)
```

Filters: Mine · Open · By person · By moment.  
Create: title, who (person), optional moment, optional vendor.  
**This replaces Ask.** “Ask Avalon to lock rehearsal time” is a task on Avalon, on the rehearsal block if you want.

Mother-in-law / `assigneeFilter` still only sees her tasks.

---

## DMs (Ask the product word dies)

Keep `Request` + `RequestMessage`. 17 existing threads stay.

**UI:** envelope in the header. Thread list. Composer is a person with a PIN.

**Notifications:** Web Push on `public/sw.js` (`push` + `notificationclick`). `PushSubscription` table. VAPID env keys. Soft-fail.

**Link (optional, collapsed):** “About a task…” or “About a moment…” — writes `Request.taskId` (exists today) or a new nullable `Request.timelineBlockId`. The thread shows a chip; tap opens that task/block. Do not require a link to send.

**Do not** show Decline, Needs you, Waiting, related-decision as the default path. Archive = `status: done`.

If someone without a PIN must be reached: Call from the face sheet. Tasks can still be assigned to them; DMs cannot.

---

## Roles (same Day, different chrome)

| Who | Day | Plan | DMs |
|-----|-----|------|-----|
| **Couple** (master/partner) | Full run-of-show, call sheet, vendor strip | Roster, vendors/money, guests, all tasks | Everyone with a PIN |
| **Coordinator** (Avalon) | Full run-of-show — this is her console | Roster + tasks she can see; money only if you grant it | Couple + party as you allow |
| **Planner/helper** | Day + faces | Tasks / roster per flags | Per flags |
| **Wedding party** | Day + call sheet (learn faces) | None, or stay | Couple / coordinator |
| **Vendor PIN** | Their arrival block + call sheet | No money | Couple / coordinator |
| **Shared-money** | No Day | Vendors read-only | No |
| **Guests-only** | No | Guests only | No |

Do not add `canSeeHome`. `canSeeRequests` = DMs. `canSeePeople` = roster edit. `canSeeTimeline` = Day. Vendor preset stays timeline + requests.

---

## Data (mostly relationships you already have)

```
Person     + hat, role, phone, email, photoData, aliases
Vendor     1:1 Person     pay method, insurance, contract, tip, notes
BudgetItem + vendorId
Contact    + personId     (kept; UI prefers Person)
TimelineBlockPerson       NEW  blockId + personId   (faces on the moment)
Task.timelineBlockId      EXISTS — start writing it
Task.vendorId             NEW nullable (or infer via budgetItem)
Request.taskId            EXISTS — DM “about this task”
Request.timelineBlockId   NEW nullable
PushSubscription          NEW
PersonMergeLog            NEW
```

`DayAssignment` stays in the database for now. New work uses people-on-blocks + tasks-on-blocks. Do not migrate assignments in v1 unless a dry-run shows they are unused.

### Vendor roster (corrected)

| Person | Role | Phone / email | Money match |
|--------|------|---------------|-------------|
| Avalon Green | Planner / coordinator | (386) 589-7215 | coordinator, Avalon |
| Black Sheep Shelter | Venue | (616) 335-0797 | BSS, venue, black sheep |
| Barry Tilson | Photographer | (248) 704-3731 | photog |
| Belle Genton | Videographer | (513) 833-0929 | video |
| Precious Peony | **Caterer / food** | preciouspeonyllc@gmail.com | cater, dinner, food — **not** flower/peony-as-floral |
| Wendy Rush | Mistress of ceremonies | (616) 318-9393 | tip if needed |
| Kurt | Master of ceremonies | *(add)* | — |
| Bartender | Bartender | TBD | bartender |
| **Florist** | Florist | **TBD — do not use Peony** | flower, bouquet, centerpiece, peon-as-floral |

Merge `avalon_planner` → `avalon_green`, `barry` → `barry_tilson`. Copy Contact phones onto Person.

### Pin people onto blocks (seed from notes you already wrote)

The notes already name who is where. v1 can **suggest** pins; do not auto-write without a dry-run review.

| Block | Faces to pin |
|-------|----------------|
| 9:00 Settle in Airbnb | Wedding party, Haley, David; Katie + Belle (arrive 11:00) |
| 10:30 Venue opens | Avalon, Wendy, Kurt, vendors |
| 10:30–12:30 Vendor + party arrival | Avalon, BSS, florist TBD, Peony if food setup, party |
| 11:00 DIY hair | Party, Haley, Katie |
| 12:00 Party leaves Airbnb | Party (not David, Haley, Belle) |
| 12:00 Quiet time | David, Haley, Belle |
| 12:30 Photographer arrives | Barry, Avalon, David, Haley |
| 1:00 Final getting ready | Haley, Katie, Barry, Harmony, Melody, Skila, groomsmen |
| 2:15 Getting dressed | Haley, parents, Barry |
| 2:45 First look + portraits | David, Haley, party, family, Barry, Belle |
| 3:15 Pre-ceremony | Party, Barry, Wendy, Kurt |
| 3:30 Ceremony | Full party, officiant, Wendy, Kurt, Barry, Belle |
| 4:00 Cocktail | Peony (food), bartender, Barry |
| 5:00 Dinner | Peony, Wendy, Kurt |
| 6:00 Toasts + cake | Best man, MOH, FOB, Barry |
| 6:30 First dances | David, Haley, FOB, music |
| 7:00 Open dancing | Barry until 9:00 |
| 10:00 Tear down | Everyone |

---

## Where the Excel pile goes (sort, corrected)

| Package | Home | Notes |
|---------|------|--------|
| Vendor payments / tip envelopes | **Vendor fields** | Split; kill package header |
| Vendor & BSS paperwork | **Vendor checkboxes** | Insurance/licenses on BSS, Avalon, bartender |
| Florals & centerpieces | **Florist — TBD** or Loose ends | **Not** Precious Peony |
| Photos & video | **Barry / Belle** + pin on 12:30 / portraits | Split stills vs video |
| Decor & venue | **Avalon + BSS** + arrival block | |
| Cake & dessert | Other costs or baker if named | Peony only if she is actually serving it |
| Music & sound | Music vendor or Day notes | Playlists also sit on Day-before |
| Makeup / hair | **Katie / Belle** faces + getting-ready blocks | |
| Invites / RSVP / guest logistics | **Plan → Guests** | |
| Thank-you cards | **Plan → Guests → Thank-you** | |
| Rehearsal dinner | **Rehearsal** | Merge the two “confirm rehearsal time” children |
| Ceremony / reception moments | **Day blocks** (ceremony, toasts, dances, exit) | Tasks on those moments |
| Attire & rings | **Roster → David & Haley** | |
| Guest book | **Shop** | |
| Registry | Loose ends / out of app | |
| Communication game plan | **Kill** | DMs + tasks |
| Week / day before | **Day**, collapsed until done | |

Existing open asks: become DM threads. If the title is really a job (“Provide Reception Dinner Options”), also make (or keep) a **task** on Avalon / Peony and link the DM. Do not delete the thread.

---

## Schema / files (delta)

New: `TimelineBlockPerson`, `Vendor`, Person profile columns, `BudgetItem.vendorId`, `Task.vendorId`, `Request.timelineBlockId`, `PushSubscription`, `PersonMergeLog`, `Contact.personId`.

New UI: `CallSheet` (photo grid), `PersonSheet`, `DayBlock` (faces + now + tasks), `PlanSwitcher`, `VendorCard`, `TaskBoard` (replaces inbox as the checklist), `MessagesBoard`, `contacts-cache` IndexedDB, push helper.

`/day` is primary **Day**. `/plan` (or roster URL) is primary **Plan**.  
`/home` → `/day`. `/requests` → messages overlay or `/messages`. `/people` and `/day/contacts` → call sheet / roster. `/money` → Plan · Vendors. `/shop` restored under Plan or More.

`DayTabs` (Timeline / Contacts / Assignments) **go away**. Day is one scroll + call sheet.

---

## Phases

### P0 — Dry-runs (no UI)

- `db:audit` (dups, unlinked PINs, Peony-vs-floral mis-tags)
- `attach-tasks-to-homes` dry-run (corrected: florals ≠ Peony)
- `suggest-block-faces` dry-run from the table above
- Couple + Avalon review before `--apply`

### P1 — Faces exist

- Person photo/phone/role; merge dups; link Contacts
- Roster in Plan; **call sheet photo grid**
- Automatic IndexedDB face book
- Person sheet: Call · DM (if PIN)

**Done when:** Airplane mode still shows Barry’s photo and `tel:`. A guest-of-the-party PIN can open the grid and identify Wendy.

### P2 — Faces on the clock (this is the coordinator jump)

- `TimelineBlockPerson`
- Day review: Now/Next, faces on each block, tap → sheet
- Edit: add/remove who on a block
- Apply reviewed pin suggestions
- Kill Day Contacts / Assignments tabs (routes redirect to Day / the block)

**Done when:** “Photographer arrives” shows Barry’s face. Avalon can call him from that row.

### P3 — Tasks are asks

- Task board in Plan (who + optional moment + optional vendor)
- Block shows that moment’s open tasks
- Creating “need X from Avalon” does **not** create a Request
- Mother-in-law filter still works

**Done when:** Shot list is on Barry and on the 12:30 block — not on Home.

### P4 — Vendor setup on the same face

- Vendor record + money/insurance/tip
- Plan · Vendors; Other costs; `/money` redirect
- Day morning vendor strip
- Peony = food; florist TBD

**Done when:** Peony’s card says Caterer and remaining food balance. Bouquet tasks are not on her.

### P5 — DMs + push

- Envelope, threads, optional task/moment chip
- Web Push
- `/requests` redirect; copy says Message

**Done when:** Haley DMs Avalon about the headcount task; Avalon’s phone notifies; chip opens the task.

### P6 — Nav is Day · Plan

- Home gone. Two primaries + envelope
- `firstAllowedRoute` tests
- Week/day-before on Day
- Shop / Stay / Rehearsal / Accounts in More

---

## Testing (coordinator-shaped)

1. Add photos for Avalon, Barry, Belle, Peony, Wendy, Katie. Open call sheet offline. Every face labeled.
2. As Avalon PIN: Day shows Now/Next; 12:30 has Barry; Call works.
3. As David: Plan · Vendors, pay BSS, insurance still unknown (dot on Day strip).
4. Create task “Final headcount” on Avalon + Dinner block. It appears on Day at 5:00 and on Avalon’s sheet. No Ask ticket created.
5. DM that task; recipient gets a notification; chip deep-links.
6. Wedding-party PIN: call sheet + Day, no dollar amounts.
7. Shared-money: vendors only.
8. Florals task is not on Precious Peony.

---

## Out of scope

- SMS
- Public RSVP site
- Seating canvas
- Blob contract uploads (v1 = checkbox + URL)
- Auto-creating PINs from the roster
- Dropping `Contact`, `Request`, or `DayAssignment` tables
- Re-seeding Excel onto production
- Inventing a florist name

---

## Order

```
P0  dry-run sort + face-on-block suggestions
P1  photo roster + offline call sheet          ← “who is this”
P2  faces on the run-of-show + Now/Next        ← coordinator app
P3  tasks replace ask
P4  vendor setup on the same faces (Peony=food)
P5  DMs + notifications + optional task link
P6  Day · Plan nav; Home retired
```

P1+P2 are what make Friday feel like a real coordination tool. Everything else is how the couple and Avalon load that day so the work is already sitting on the moment and the face.
