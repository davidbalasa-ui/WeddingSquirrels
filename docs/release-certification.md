# WeddingSquirrels release certification

Inventory-driven Playwright suite that answers: **does WeddingSquirrels actually work?**

It complements `npx tsc --noEmit`, `npm test`, and `npm run build`.

Full control catalog: `docs/release-interaction-inventory.md`.

## How to run

Uses the local production-like simulation database (`wedding_production_merge_simulation_20260907`), never production.

```bash
npx tsc --noEmit
npm test
npm run build
npm run test:cert
```

`npm run test:cert` starts (or reuses) `next start` on port 3100 with `VERCEL_ENV=development` so Preview Time is available. Auth is a signed session cookie for the local master and restricted PIN accounts. No production writes.

Quiet on success. Screenshots, traces, and the machine report land in gitignored `test-artifacts/`.

Override with `CERT_BASE_URL`, `CERT_DATABASE_URL`, `CERT_PORT`, or `CERT_WORKERS`.

## Suites

| Suite | Spec | What it certifies |
| --- | --- | --- |
| ROUTES / NAVIGATION | `e2e/routes.spec.ts` | Authenticated hubs, aliases, skip, logout, primary nav |
| INVENTORY CRAWL | `e2e/crawl.spec.ts` | Same-origin links stay inside the inventoried route set |
| TODAY | `e2e/today.spec.ts` | Pulse, attention/waiting/coming-up, compose cancel, inbox filters |
| PEOPLE | `e2e/people.spec.ts` | Tabs, search, identity, profiles, guests, role cancel, subpages |
| PLAN | `e2e/plan.spec.ts` | Hub chapters, tasks, timeline, rehearsal, stay, shopping, calendar |
| MONEY | `e2e/money.spec.ts` | Due, history, print, contract detail cancel, add-contract cancel |
| MORE | `e2e/more.spec.ts` | Cards plus Accounts dialogs close without writing PINs |
| CORE INTERACTIONS | `e2e/interactions.spec.ts` | Shared People/Money/Plan/Day/Shopping smoke that predates the split specs |
| DATA INTEGRITY | `e2e/data.spec.ts` | Money fingerprint, 19+7 timeline, contacts/Wendy/Kurt roles, unassigned jobs |
| DAY OF | `e2e/day-of.spec.ts` | Preview Time 10:42 / ceremony / dinner / dancing / teardown; planning; Need Someone |
| WRITES | `e2e/writes.spec.ts` | Disposable create/edit/save/cancel/delete on shopping, assignments, timeline, stay, tasks, money |
| OFFLINE | `e2e/offline.spec.ts` | Save pack online, open `/offline`, Day-of · 19, contacts/timeline/stay/shopping, reload while offline |
| PRINT CENTER | `e2e/print.spec.ts` | Full Binder vs Day-of Packet, every section toggle, canonical rows, `window.print` |
| PERMISSIONS | `e2e/permissions.spec.ts` | Restricted PIN cannot open money or day-of; hidden chrome; no secret leak |
| MOBILE | `e2e/mobile.spec.ts` | Critical hubs + primary nav on a phone viewport |

## Requirements

Latest PASS / FAIL / NOT RUN for each row is written by the Playwright reporter to `test-artifacts/certification-report.md` (gitignored). This table is the human checklist.

| Requirement | Automated test | Status |
| --- | --- | --- |
| Authenticated hubs load (`/today` `/day` `/day/assignments` `/people` `/plan` `/plan/tasks` `/plan/timeline` `/plan/rehearsal` `/plan/stay` `/plan/shopping` `/plan/calendar` `/money` `/print` `/more`) | `e2e/routes.spec.ts` · authenticated routes | see last run |
| Primary nav clicks: TODAY PLAN PEOPLE MONEY MORE | `e2e/routes.spec.ts` · primary navigation | see last run |
| People tabs, search, profile | `e2e/interactions.spec.ts` · People tabs | see last run |
| Money detail + add-contract cancel | `e2e/interactions.spec.ts` · Money detail | see last run |
| Plan chapters, timeline Review/Edit, rehearsal, More → Print | `e2e/interactions.spec.ts` · Money detail | see last run |
| Day assignments + shopping add/cancel | `e2e/interactions.spec.ts` · Day assignments | see last run |
| Money: 24 items, $21,485.83 / $9,167.22 / $12,318.61 | `e2e/data.spec.ts` · Money fingerprint | see last run |
| Timeline: 19 wedding + 7 rehearsal | `e2e/data.spec.ts` · Timeline | see last run |
| Guests 35 / people 76 where UI exposes them | `e2e/data.spec.ts` · Guests… | see last run |
| Shopping 3 when present | `e2e/data.spec.ts` · Guests… | see last run |
| Tasks 15 in Full Binder | `e2e/data.spec.ts` · Guests… | see last run |
| Day-of contacts include Wendy; Kurt is not a Contact; Kurt = MC; Wendy ≠ MC | `e2e/data.spec.ts` · Guests… | see last run |
| Day assignments: 3, all UNASSIGNED | `e2e/data.spec.ts` · Guests… | see last run |
| 10:42 AM NOW / NEXT / AFTER THAT | `e2e/day-of.spec.ts` · 10:42 | see last run |
| Ceremony / dinner / dancing / teardown NOW | `e2e/day-of.spec.ts` · later moments | see last run |
| Planning-mode `/day` shows full schedule without live NOW | `e2e/day-of.spec.ts` · planning mode | see last run |
| Need Someone lists every flagged contact | `e2e/day-of.spec.ts` · Need Someone | see last run |
| Offline pack: Day-of · 19, contacts, shopping, stay, survives reload offline | `e2e/offline.spec.ts` | see last run |
| Full Binder + Day-of Packet presets, toggles, print, print CSS | `e2e/print.spec.ts` | see last run |
| Restricted PIN cannot open money or day-of; no secret leak | `e2e/permissions.spec.ts` | see last run |
| Mobile smoke: `/today` `/day` `/people` `/print` + nav | `e2e/mobile.spec.ts` | see last run |
| Inbox compose, pulse, filters | `e2e/today.spec.ts` | see last run |
| People identity, guests, role cancel | `e2e/people.spec.ts` | see last run |
| Plan chapter + chapter-page controls | `e2e/plan.spec.ts` | see last run |
| Money due / history / print / detail cancel | `e2e/money.spec.ts` | see last run |
| More cards + Accounts dialogs | `e2e/more.spec.ts` | see last run |
| Disposable CRUD lifecycles | `e2e/writes.spec.ts` | see last run |
| Crawl finds no silent routes | `e2e/crawl.spec.ts` | see last run |

## Status

Latest machine-readable run: `test-artifacts/certification-report.json` (gitignored).

If a production-like fact is missing from the local DB, that assertion is **NOT RUN** instead of inventing data.

Cold-first-visit offline is a known limitation and is not certified here.
