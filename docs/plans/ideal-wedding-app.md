# Ideal wedding app (north star)

Unconstrained vision. Not an implementation plan. Not limited by the current schema, nav, or Home inbox.

**For:** David & Haley (couple / planners) · Avalon (coordinator) · wedding party · vendors who need a slice  
**Wedding:** October 16, 2026 · Black Sheep Shelter

---

## One sentence

A wedding **operating system** with two tempos: **Today** tells you the next move and how to unblock it; **Day** runs the room with faces. Everyone is one person with a photo. Work is a task. Talk is a message.

---

## Who it is for (same app, different first screen)

| Person | They open the app to… |
|--------|------------------------|
| **David / Haley** | What do I do next? Pay, decide, nudge, seat, thank. |
| **Avalon** | What is happening now? Who is that? Are vendors set? |
| **Party (Katie, Skila, Wendy…)** | Who is everyone, when am I needed, text Haley. |
| **Vendor (Barry, Peony…)** | When do I arrive, who do I call, one thread with the couple. |

No separate “couple app” and “coordinator app.” One dataset. The first screen changes with **who you are** and **how close Friday is**.

---

## Two tempos (not two products)

**Today** — planning tempo (now through ~Oct 9)  
The next action. If it’s blocked, the unblock action. Then the next one. Focus mode = only that card.

**Day** — coordination tempo (rehearsal + Oct 16, and whenever you edit the clock)  
Now / next moment. Faces on every beat. Call sheet. Vendor check-in.

The app **switches the home screen** as the wedding approaches. You can always flip: Plan ↔ Day. You never maintain two worlds.

---

## One object model (this is the whole product)

```
PERSON          one human · photo · name · role · phones · optional login
  ├─ vendor     money, how to pay, insurance, contract, tip, arrival
  ├─ on moments who is in this beat of the day
  └─ owns tasks work that is theirs

MOMENT          a beat on the clock · where · notes · faces · tasks
TASK            work · owner · due · blocker · optional moment / vendor / household
THREAD          a conversation · DM or small group · can pin a task or moment
HOUSEHOLD       guests · address · RSVP · table · meals · gifts · thanked
THING           something to buy (not a person)
```

There is no second copy of Avalon. No “Ask” object. No contact-only twin.

**Precious Peony** is a Person, role Caterer (food). Florals are a different Person, or a hole the app nags you to fill.

---

## The bar (four things, that’s it)

```
Today     Day     People     Guests
 plan     clock   faces      households
```

Plus an **envelope** (messages, badge + lock-screen ping).

Vendors are not a tab. A vendor is a **person** with a Money / Paperwork panel.  
Shop is not a tab. A buy is a **Today card** (and a short list inside Today if you want to browse).  
Money is not a tab. Remaining $ lives on the vendor and rolls up on Today (“$2,400 due this week”).  
Accounts / stay / rehearsal dinner are settings or a Day schedule, not peers of Today.

---

## Today — the planning home

This is the couple’s app.

```
47 days · Friday Oct 16

DO THIS
┌─────────────────────────────────────────┐
│ Pay Black Sheep Shelter                 │
│ $2,400 left · due Sep 15 · check        │
│ [ Pay $2,400 ]     [ Open BSS ]         │
└─────────────────────────────────────────┘

UP NEXT
Reply to Avalon · bartender license
Add florist (bouquets have no owner)
Buy guest book

WAITING
Shot list — Barry (nudge)
Final headcount — you → Peony (blocked on seating)
```

**Focus mode** (toggle, or the default on a small phone): only `DO THIS`. Big photo or amount. One primary button. Skip. “I’m blocked — who?” Done → the next ready card slides in.

You **finish the work on the card**. Paying does not send you to a ledger app. Adding a florist does not send you to a People app and forget the queue. If the work *needs* a board (drag seating), the board opens as a sheet; when you close it you’re back on Today.

### What can appear as “DO THIS”

- Pay a vendor (amount, method, due)
- Close a task that is yours
- Reply to a message
- Unblock: message the person you’re waiting on, assign an owner, fill a hole (name the florist, add Barry’s photo, add the bartender’s phone)
- Buy a thing
- Seat a household / send a reminder, when the date makes it urgent
- Mark insurance / contract / tip on a vendor

### Ranking (the product is the rank)

Overdue money → messages that need you → unblock a critical vendor (venue, food, planner, photo) → your work due this week → vendor paperwork gaps → buys → missing face/phone when Day is getting close → seating / final count when Day is getting close.

Makeup plan does not beat BSS. Guest book does not beat “Peony has no final count.”

---

## Day — the coordinator home

This is Avalon’s app, and everyone’s phone on Friday.

```
NOW  12:32                          ▦ call sheet

12:30–1:00  Photographer arrives · getting ready suite
[Barry] [Avalon] [Haley]
☐ Detail shots — dress, rings
☎ Call Barry    ✉ Message
```

- **NOW** is pinned. Next moment is under it. The rest of the day scrolls.
- Every moment has **faces**. Notes are “what happens,” never the only place a name lives.
- Tap a face → photo, role, call, message, their open tasks, vendor panel if they have one.
- **Call sheet** is a yearbook grid: photo, first name, role. This is how the party learns who Wendy is. Search. Filters are All / Vendors / Party / Family — not separate apps.
- **Vendor rail** (morning, or a chip): photo · arrives 10:30 · $ left · insurance · Arrived?  
  Peony is food. Florist is florist.
- Rehearsal Thursday is the same Day, other schedule.

Offline: faces, phones, the whole clock, and the call sheet are **already on the device**. No download button as a prerequisite. The barn can have no signal.

---

## People — the yearbook

One directory. Photo-first. This is organizing, not a settings page.

```
[Avalon]     [Barry]      [Belle]      [Peony]
 Planner     Photo        Video        Food

[Wendy]      [Katie]      [Skila]      [David]
 MC          Hair         Kids         Groom
```

Tap → **person sheet** (the same sheet Day uses):

- Hero photo, name, role, pronouns/notes
- Call · Text · Message
- **If vendor:** remaining $, pay method + handle, insurance, contract (file), tip, arrival moment
- Open tasks (assign, complete)
- Moments they’re on
- The thread

Add a person once. Give them a photo the week you hire them. That photo is what Friday runs on.

---

## Guests — households, not faces

Guests are parties (the Smiths), not the same thing as People. Belle can be both: a Person (videographer face) and a name at a table.

- List · **floor / tables** · Thank-you
- RSVP, counts, meals (this number is what Peony needs)
- Seat people; Today nags when you’re inside two weeks and table 4 is empty
- Gifts on the household; Thank-you is a pipeline (unthanked first), also a Today card after the wedding
- Print / export when you need paper

---

## Messages

iMessage, not a ticket.

- DM anyone with a login. Small groups (you two + Avalon) exist.
- Lock-screen notification. Badge on the envelope.
- Pin a task or a moment on a thread (“about final headcount”).
- Starting a message does **not** create work. Assigning a task does.
- “Ask Avalon to lock the bartender” = **task on Avalon**. If you want to talk, you message her with that task pinned. Today then shows you *Waiting — nudge* instead of a fake to-do.

---

## A Tuesday in September (David)

1. Opens app → **Today / Focus**: Pay BSS, $2,400, check, due Sep 15.
2. Logs the check on the card. Next card: Avalon asked about the bartender license.
3. That’s blocked on Avalon. He hits **Message** (thread already there). Next ready card: **Add florist** — bouquets have no owner.
4. He adds “_____ · Florist”, photo later, phone now. Floral tasks attach to that person. Peony never sees them.
5. He flips to **Guests** for ten minutes because Today said “final count is in two weeks and 6 parties have no table.”
6. Done. He did not open a task dump, an Ask board, or Money as a separate religion.

---

## A Friday at 12:32 (Avalon)

1. Opens app → **Day**. NOW is photographer arrives.
2. Barry’s face is on the block. She doesn’t remember his last name. She doesn’t need to. She taps Call.
3. Detail-shot task is still open on that block — she sees it, Barry sees it if he has a login.
4. Party member whispers “who is the woman with the kids?” — call sheet, Skila, photo.
5. Peony is late. Vendor rail: Food, no Arrived, phone one tap.
6. Signal dies. Call sheet and clock still work.

---

## After the wedding

Today becomes: thank-you pipeline, leftover pays, “write Avalon a review.” Day is an archive. The yearbook stays. You don’t need a new app.

---

## What you never see (on purpose)

- Four names for one human
- A Home wall of 50 decision packages
- “Ask” as a third kind of work
- Vendors / Contacts / People as three lists
- A download button standing between you and Friday’s faces
- Makeup plan ranked above an overdue venue balance
- Florals living on the caterer
- A learning curve: Today, Day, faces, households, envelope

---

## What “best in class” actually means here

Not more features. **One next move. One face. One clock.**

If the app is quiet, you’re either caught up or you’re waiting — and it will tell you which, and who to nudge.
