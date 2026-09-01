# WeddingSquirrels V2 — Plan, Blueprint & Git Access

*Consolidated reference from the architecture audit, implementation blueprint, and Phase 1 work. Last updated: August 30, 2026.*

---

## Table of contents

1. [Product vision](#product-vision)
2. [Current state (audit summary)](#current-state-audit-summary)
3. [V2 information architecture](#v2-information-architecture)
4. [Screen-by-screen plan](#screen-by-screen-plan)
5. [Data model strategy](#data-model-strategy)
6. [Design system direction](#design-system-direction)
7. [Phased implementation plan](#phased-implementation-plan)
8. [Phase 1 status (completed)](#phase-1-status-completed)
9. [What must NOT change](#what-must-not-change)
10. [Git repository access](#git-repository-access)
11. [Local development setup](#local-development-setup)
12. [Product decisions and quality gates](#product-decisions-and-quality-gates)

---

## Product vision

WeddingSquirrels should be a **premium, mobile-first wedding operating system** for the couple and everyone helping them: partner, planner, parents, wedding party, vendors, and trusted helpers.

It should feel **warm, personal, calm, editorial, and effortless on mobile** — not like generic project-management software.

### Core questions the app must answer

- What do I need to know or do **right now**?
- What is **coming up**?
- Who is **responsible** for what?
- Who am I **waiting on**?
- What have we **spent** and what do we still **owe**?
- Where is everyone **staying**?
- How do I **contact** the right person?
- What happens **next**?

### Product principle

**Do not remove valuable functionality** to simplify the UI. Reorganize hierarchy, relationships, and presentation. Everything below must remain available:

People, photos/faces, guests, RSVP, wedding party, family, vendors, vendor contacts, payment schedules (deposits/finals/installments), tasks, assignments, asks/requests, timeline, day-of contacts, day-of responsibilities, stay/room/bed assignments, rehearsal, rehearsal dinner, meal planning, shopping, budget, offline, permissions, printable views.

### Best-in-class quality bar

The product should impress because it is useful, personal, and calm—not because it contains more screens.

- Every primary screen answers one clear question and presents one obvious next action.
- Couple names, dates, people, money, and wedding details come from authoritative data; never invent content for visual effect.
- Faces, relationships, ownership, and context make the experience feel like this couple’s wedding—not generic project software.
- Summaries must help a decision: what is next, blocked, overdue, incomplete, or ready.
- Supporting data such as calendar events should appear where it improves the workflow; it does not automatically deserve a destination page.
- Mobile interactions, empty states, loading, errors, accessibility, offline behavior, and visual polish are release criteria—not cleanup afterthoughts.
- A phase is complete only after automated checks and a working mobile walkthrough against realistic data.

---

## Current state (audit summary)

### Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, warm editorial design tokens |
| Database | Prisma 6 + PostgreSQL (Neon in production) |
| Auth | PIN accounts + JWT session cookie |
| Hosting | Vercel |
| Offline | Service worker shell + IndexedDB snapshot via `/api/offline` |

### What already works well

- Unified inbox logic (`src/lib/inbox.ts`)
- Task decision workspaces (`/work/[id]`)
- Day-of timeline editor (`DayTimeline`)
- Guest list, RSVP, seating, gifts
- Money/budget board (single payment per line today)
- Stay/bed assignments (free-text occupants)
- Rehearsal schedule + dinner menu
- Ask/request threading between PIN accounts
- Module permission registry (`src/lib/modules.ts`)
- Offline download and read-only viewer

### Key gaps before V2

| Gap | Detail |
|-----|--------|
| Navigation | Was Home / Day-of / Guests / More — not aligned to V2 tabs |
| TODAY | Inbox overloaded; not a true command center |
| PEOPLE | Fragmented across `Person`, `Contact`, `Guest`, `MealGuest`, stay text |
| MONEY | No payment installments — one `amountPaid` + one `payByDate` per budget line |
| Calendar | Month view intentionally removed; event data supports Today and deadline context |
| Vendors | No first-class model — spread across contacts, budget names, tasks |

### Technical debt to manage (not fix all at once)

- Monolithic `src/app/actions.ts` (~2,260 lines)
- Orphaned components: `TaskCard`, `RequestsBoard`, `ShoppingListBoard`, `CalendarMonth`, `AddTaskButton`
- Hardcoded wedding date in `src/lib/due-dates.ts` (also in `AppSettings`)
- Stay/meal layouts hardcoded in TypeScript config files

---

## V2 information architecture

### Primary navigation (5 tabs)

| Tab | Route | Purpose |
|-----|-------|---------|
| **TODAY** | `/today` | Personalized command center |
| **PLAN** | `/plan` | Wedding plan hub + drill-downs |
| **PEOPLE** | `/people` | Human-centric directory |
| **MONEY** | `/money` | Financial clarity |
| **MORE** | `/more` | Settings, accounts, offline, archive |

### Route map (target)

```
/today                      TODAY command center
/home                       → /today (legacy alias)

/plan                       PLAN hub
/plan/tasks                 Task views
/plan/timeline              Wedding day schedule (+ contacts + responsibilities)
/plan/rehearsal             Rehearsal + dinner
/plan/stay                  Accommodation / beds
/plan/shopping              Shopping list

/people                     PEOPLE hub
/people/guests              Guests (alias: /guests)
/people/party               Wedding party (derived)
/people/family              Family (derived)
/people/vendors             Vendor experience (aggregated)
/people/contacts            Day-of contacts
/people/responsibilities    Day-of assignments
/people/[profileId]         Unified profile shell (experience layer)

/money                      Budget + vendor contracts
/money/due                  Due soon / overdue
/money/history              Paid installments
/money/print                Printable summary

/more                       Admin hub
/more/settings              Wedding identity (AppSettings UI)
/more/accounts              PIN accounts
/offline                    Read-only offline app

/work/[id]                  Task decision workspace (unchanged)
```

Legacy routes (`/day`, `/guests`, `/rehearsal`, `/stay`, `/requests`, `/shop`, `/calendar`, `/accounts`) should keep working via redirects during transition. `/calendar` returns to Today because calendar events are supporting context, not a standalone product area.

---

## Screen-by-screen plan

### TODAY (`/today`)

**Priority bands (top → bottom):**

1. **Hero** — greeting, couple names, countdown, wedding date, venue
2. **Needs attention** — asks for me, overdue tasks, overdue/upcoming payments, escalated items (max 7)
3. **Waiting** — asks I sent, tasks waiting on others
4. **Today** — now/next timeline (wedding week / wedding day only)
5. **Pulse** — 3–4 tappable stats: RSVP, open tasks, budget remaining, open asks
6. **Coming up** — next 5 events/deadlines/payments

**Not on TODAY:** full task list, budget editor, guest list. Calendar events belong in Coming up rather than a separate month-grid workflow.

Reuse existing `InboxBoard` row components; evolve layout in Phase 2.

### PLAN hub (`/plan`)

PLAN is the decision workspace, not a directory of modules. It leads with the highest-ranked open decision and then shows five live domains:

1. Tasks — open and overdue decisions
2. Wedding timeline — run-of-show readiness
3. Rehearsal & dinner — schedule and meal completion
4. Stay — required bed assignment completeness
5. Shopping — remaining and purchased items

Calendar events remain available to TODAY’s Coming up list and task due-date context. A month grid is intentionally excluded until user behavior proves it solves a real planning need.

### PEOPLE hub (`/people`)

Face-forward sections: wedding party, family, vendors. Searchable directory. Unified profile shell aggregating data from multiple stores (experience layer — not one DB table).

### MONEY (`/money`)

Summary hero (committed / paid / remaining) + vendor contract rows with payment schedules. Answers: total budget, paid, remaining, due soon, overdue, per-vendor balances.

### MORE (`/more`)

Settings, accounts, offline download, archive (done items).

### DAY-OF (within PLAN timeline)

- **Before wedding:** planning timeline (existing `DayTimeline`)
- **On wedding day:** read-only **Now / Next** mode, quick contact access, no edit UI for most users

---

## Data model strategy

### Principle

**Unify the user experience before unifying the database.** Small relational additions only where clearly justified.

### Required schema change (Phase 5)

**`BudgetPayment`** child of `BudgetItem`:

```prisma
model BudgetPayment {
  id           String     @id @default(cuid())
  budgetItemId String
  budgetItem   BudgetItem @relation(...)
  label        String     // "Deposit", "Final", etc.
  amount       Float
  dueDate      DateTime?
  paidAmount   Float      @default(0)
  paidAt       DateTime?
  paidById     String?
  paidBy       Person?    @relation(...)
  note         String?
  sortOrder    Int        @default(0)
}
```

- `BudgetItem.price` = contract total
- `BudgetItem.amountPaid` = denormalized sum of `paidAmount`
- **Do not** fake installments via multiple budget lines or JSON in `note`

### Small additions (Phase 1–4)

| Model | Fields | Purpose |
|-------|--------|---------|
| `AppSettings` | `venueName`, `venueLocation` | TODAY hero |
| `StaySlot` | `occupantPersonId`, `occupantGuestPersonId` | Link beds to real people (keep `occupant` string) |
| `Contact` | `category` (optional) | Vendor grouping |

### Explicitly NOT required (initially)

- Unified Person/Guest/Contact/Vendor table
- `Vendor` entity (until Contact + BudgetItem aggregation proves insufficient)
- New auth or per-tab permission DB columns (derive from existing flags)
- Task / Request / Guest model changes

### People / vendor / guest relationship strategy

| Store | Role |
|-------|------|
| `Person` | Task/shopping/budget assignees |
| `Guest` / `GuestPerson` | RSVP, seating, gifts |
| `Contact` | Day-of vendor CRM + photos |
| `MealGuest` | Rehearsal dinner sections |
| `StaySlot.occupant` | Bed assignment (text + optional FKs) |

**Profile UI** aggregates via name matching heuristics in `lib/people-profile.ts`. Manual links only if heuristics fail (Phase 6).

### Room / bed assignment strategy

- Keep hardcoded `STAY_SECTIONS` layout in `src/lib/stay.ts`
- Show: completeness bar, room type, avatars, assign picker (Person / GuestPerson / Contact)
- No floor-plan UI
- Profile cross-link: “Staying in Bedroom 1 · Queen”

---

## Design system direction

Extend existing warm foundation — do not replace blindly.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#f3efe6` | Page background |
| `--accent` | `#2f5d50` | Primary sage |
| `--gold` | `#b8956b` | Subtle highlights (added Phase 1) |
| `--warn` | terracotta | Urgency / overdue |

**Typography:** Fraunces (display) + DM Sans (body)

**Rules:**

- Hierarchy over decoration
- One hero number per screen
- List rows with dividers, not nested card grids
- `PersonAvatar` for faces everywhere (initials fallback)
- Avoid generic SaaS dashboards and metric-card walls

---

## Phased implementation plan

| Phase | Focus | Schema changes |
|-------|-------|----------------|
| **1** | Shell + 5-tab nav + `/today` canonical | Optional `AppSettings` venue |
| **2** | TODAY command center (hero, attention, pulse, coming up) | Optional venue |
| **3** | PLAN decision center + dedicated tasks and shopping | None |
| **4** | PEOPLE: face-forward directory, profiles, party/family/vendor context | `StaySlot` FKs; optional `Contact.category` |
| **5** | MONEY: financial command center + payment schedules | `BudgetPayment` |
| **6** | Connect people ↔ money ↔ tasks ↔ stay; remove duplicate mental models | Optional `Contact.budgetItemId` |
| **7** | Day-of Now/Next mode, call sheet, contacts, offline readiness | None |
| **8** | Wow pass: visual refinement, motion, accessibility, resilience, performance | None |

### Phase 2 — TODAY (next)

- `TodayHero`, `AttentionQueue`, `WaitingSection`, `PulseStrip`, `ComingUpList`
- New `lib/today.ts` for ranking attention items
- Extend `AppSettings` for venue in hero
- Do **not** redesign `InboxBoard` row behavior yet

### Phase 3 — PLAN

- Lead with one ranked “Next decision” card, ownership, and due context
- Dedicated `/plan/tasks` and `/plan/shopping`
- Live readiness summaries for timeline, rehearsal/dinner, required stay assignments, and shopping
- Keep calendar events as supporting data in TODAY and task deadlines; do not restore the unused month page
- Success gate: a user can open PLAN and know what decision to make next without scanning every module

### Phase 4 — PEOPLE

- Make `/people` visually personal: faces first, clear roles, useful relationship groups
- Aggregate task ownership, guest/RSVP context, stay placement, meal choices, and day-of responsibilities into profiles
- Create intentional wedding party, family, and vendor experiences without pretending today’s separate tables are one canonical person record
- Success gate: each important person answers “who are they, how do I reach them, and what are they responsible for?”

### Phase 5 — MONEY

- Add `BudgetPayment` only after testing the migration on a Neon branch
- Show committed, paid, remaining, due soon, and overdue at a glance
- Treat vendor rows as contracts with deposits/finals/installments, not generic expenses
- Success gate: the couple can answer what is owed, to whom, by when, and who is paying in under ten seconds

### Phase 6 — CONNECTIONS

- Cross-link people, tasks, money, stay, meals, and day-of assignments
- Remove duplicated navigation and conflicting summaries after the connected flows exist
- Success gate: moving from a person or vendor to their work, money, and logistics never requires searching another module

### Phase 7 — DAY-OF

- Create a calm Now / Next run-of-show with faces, locations, ownership, and one-tap contacts
- Preserve the full editable planning timeline for authorized users
- Validate the offline snapshot and failure states on a real mobile device
- Success gate: a helper can run the next hour without learning the planning app

### Phase 8 — WOW AND TRUST

- Editorial visual polish, subtle motion, touch feedback, and memorable couple-specific moments
- Accessibility, loading/error/empty states, performance budgets, offline recovery, and destructive-action safeguards
- Remove dead components and split oversized action modules only when behavior is covered
- Success gate: automated checks pass, mobile walkthroughs pass, and every primary screen feels finished rather than merely functional

---

## Phase 1 status (completed)

**Branch:** `cursor/v2-nav-foundation-6ce5`  
**PR:** https://github.com/davidbalasa-ui/WeddingSquirrels/pull/21

### What shipped

- `navTab` on every module in `src/lib/modules.ts`
- `V2BottomNav` — Today / Plan / People / Money / More
- `/today` = existing `InboxBoard` (unchanged logic)
- `/home` → `/today` (query params preserved)
- Hub placeholders: `/plan`, `/people`, `/more`
- `/money` unchanged (existing MoneyBoard)
- `--gold` CSS token + `PersonAvatar` stub
- `firstAllowedRoute` → `/today`
- All `revalidatePath` targets updated to `/today`

### Verification

- `npm test` — 93/93 passed
- `npx tsc --noEmit` — passed
- `npm run build` — passed

---

## What must NOT change

- Next.js App Router + Server Actions + Prisma + PostgreSQL
- PIN authentication model
- Core domain models (Task tree, Request threading, Guest household, TimelineBlock)
- Visibility helpers: `taskVisibilityWhere`, `requestVisibilityWhere`, `sessionCanMutateTask`
- Excel seed pipeline
- Print routes (`/money/print`, `/guests/print`)
- Offline architecture (SW shell + IndexedDB pack)
- 560px mobile shell max-width
- Couple person IDs (`david` / `haley`) for this wedding

---

## Git repository access

### Repository URL

**GitHub (canonical):**  
https://github.com/davidbalasa-ui/WeddingSquirrels

> The repo may also resolve under the lowercase name `weddingsquirrels`. GitHub treats these as the same repository after rename.

### Clone on your computer

**HTTPS (simplest):**

```bash
git clone https://github.com/davidbalasa-ui/WeddingSquirrels.git
cd WeddingSquirrels
```

**SSH (if you have GitHub SSH keys set up):**

```bash
git clone git@github.com:davidbalasa-ui/WeddingSquirrels.git
cd WeddingSquirrels
```

### GitHub authentication

You need a GitHub account with access to this **private** repo.

1. **Sign in:** https://github.com/login  
2. **Personal Access Token (HTTPS):**  
   - GitHub → Settings → Developer settings → Personal access tokens  
   - Create a token with `repo` scope  
   - Use the token as your password when `git clone` or `git push` prompts for credentials  
3. **SSH key (recommended for daily use):**  
   - Generate: `ssh-keygen -t ed25519 -C "your@email.com"`  
   - Add public key: GitHub → Settings → SSH and GPG keys → New SSH key  
   - Test: `ssh -T git@github.com`

### Important branches

| Branch | Purpose |
|--------|---------|
| `main` | Production / stable |
| `cursor/v2-nav-foundation-6ce5` | Phase 1 V2 navigation (draft PR #21) |

### Common git commands

```bash
# Get latest main
git checkout main
git pull origin main

# Switch to V2 nav branch
git checkout cursor/v2-nav-foundation-6ce5
git pull origin cursor/v2-nav-foundation-6ce5

# See status
git status

# See recent commits
git log --oneline -10
```

### Open a PR / review on phone

- **GitHub mobile app:** sign in → open `davidbalasa-ui/WeddingSquirrels` → Pull requests → #21  
- **Mobile browser:** https://github.com/davidbalasa-ui/WeddingSquirrels/pull/21

### Vercel deployment

The app deploys from this GitHub repo on Vercel. Pushes to `main` trigger production deploys (if configured). Preview deploys are created for PR branches.

### If you cannot access the repo

1. Confirm you are signed into the GitHub account that owns or was invited to the repo.  
2. Check repo visibility: Settings → Collaborators (owner must add your GitHub username).  
3. For HTTPS clone errors, use a Personal Access Token instead of your GitHub password.

---

## Local development setup

### Prerequisites

- Node.js 20+
- npm
- Access to Neon `DATABASE_URL` (from your Neon dashboard or Vercel env vars)

### Environment variables

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://..."   # Neon pooled connection string
PIN_SESSION_SECRET="..."          # Long random string for JWT sessions
```

### Install and run

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

### Seeded PINs (from README)

| PIN | Account | Access |
|-----|---------|--------|
| `0425` | Master | Full access + Accounts admin |
| `0999` | Mother in law | Shelly tasks only |

### Run tests and build

```bash
npm test
npx tsc --noEmit
npm run build
```

---

## Product decisions and quality gates

### Decided

1. **Today is the command center.** It surfaces attention, waiting, pulse, and upcoming context.
2. **Plan is the decision center.** It leads with the next ranked decision and provides focused task and shopping workspaces.
3. **Calendar is supporting data.** Do not restore the removed month page unless observed usage demonstrates a need.
4. **Missing wedding details are omitted, not invented.** Venue belongs in AppSettings later.
5. **Experience unifies before schema.** Aggregate Person, Guest, Contact, MealGuest, and stay data before proposing destructive consolidation.
6. **Neon production data is authoritative.** Seeds cannot silently replace app edits.

### Deliberate choices still required

1. **Payment templates:** whether new vendor contracts default to 50/50 or require explicit installments.
2. **Stay links:** whether an occupant can link to Person, GuestPerson, or both.
3. **Venue shape:** one venue/location or separate ceremony and reception fields.
4. **Profile matching:** when name matching is insufficient and explicit links become necessary.

### Gate for every future PR

- Real data only; permission rules preserved.
- No regression to login, Neon connectivity, or legacy routes.
- Relevant unit tests, typecheck, lint, and production build pass.
- Mobile walkthrough proves the primary flow.
- Empty, loading, error, and restricted-PIN states remain coherent.

---

## Key files reference

| Area | Files |
|------|-------|
| Navigation registry | `src/lib/modules.ts`, `src/lib/routes.ts` |
| Bottom nav | `src/components/V2BottomNav.tsx` |
| TODAY page | `src/app/(app)/today/page.tsx`, `src/components/InboxBoard.tsx` |
| Inbox logic | `src/lib/inbox.ts` |
| PLAN | `src/app/(app)/plan/page.tsx`, `src/lib/plan.ts` |
| Permissions | `src/lib/access.ts`, `src/lib/auth.ts`, `src/lib/presets.ts` |
| Money | `src/components/MoneyBoard.tsx`, `prisma/schema.prisma` |
| Stay | `src/lib/stay.ts`, `src/components/StayBoard.tsx` |
| Day-of | `src/components/DayTimeline.tsx` |
| Schema | `prisma/schema.prisma` |
| Offline | `src/app/api/offline/route.ts`, `src/lib/offline-db.ts` |

---

*This document is a planning reference. For live code behavior, always trust the repository on the branch you have checked out.*
