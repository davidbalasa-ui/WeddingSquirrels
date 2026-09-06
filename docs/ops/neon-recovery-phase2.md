# Neon Recovery Phase 2 — reconstruction manifest

Discovery only. Production was not written. No Excel import, seed, relink, or cutover. PR #80 remains unmerged.

Recorded 2026-09-06 00:26 UTC.

## Dump protection

The Phase 1 Time Travel dump was re-hashed and copied locally. It was **not** committed.

| Copy | Path | sha256 |
| --- | --- | --- |
| original | `/opt/cursor/artifacts/neon-recovery-pre-seed-20260905-173554.dump` | `aef11ab08c9431f1215f1df0cc7006d65c05b0fd8f3363b05231d973e17e7b9f` |
| copy | `/tmp/wedding-recovery-preserve/neon-recovery-pre-seed-20260905-173554.dump` | match |
| copy | `/home/ubuntu/wedding-recovery-preserve/neon-recovery-pre-seed-20260905-173554.dump` | match |

Original mtime 2026-09-05 22:56:34 UTC, 202104 bytes. Rehash after copy matched. Timestamp of contents: `2026-09-05T17:35:54Z`.

This is a **partial** backup (timeline + PIN links + day-of contacts). It does not contain the lost 84/88/24/194 graph.

## Backups found

| Artifact | Where | Fingerprint | Verdict |
| --- | --- | --- | --- |
| `neon-recovery-pre-seed-20260905-173554.dump` | this VM, 3 copies above | Person 5, GP 0, Guest 0, Budget 0, Timeline wedding 19, PIN linked 3, Contact 7, Task 15, Stay 12, Meal 17 | exact for **second-wipe eve** only |
| `neon-phase1b1-pre-20260903.dump` | **file missing** | recorded sha256 `a9cb7d1ea512db4bb94bf5891f74ee2d89ce7309dcb2dc0249164be5b3b423ca`; restored-then counts Person 22 / Guest 38 / GP 88 / Task 194 / TaskAssignee 314 / Contact 7 / Meal 17 / Stay 12 / GuestGift 1 | **only known exact full-graph backup**; bytes not on this VM |
| Phase 1B-1 apply / match reports | `/opt/cursor/artifacts/phase1b1-*.txt`, `neon_identity_match_report.*` | hashes of guest/task/stay tables; 22 named Person stubs; 88 GP name+id pairs | evidence + replay map, not a DB |
| Sep 4 budget migration JSON | `/opt/cursor/artifacts/budget-payment-neon-migration.json` | BudgetItem 24, price 21485.83, paid 9167.22 | fingerprint only |
| In-repo `data/guest-rsvp.csv` | git since 2026-09-01 | 76 people / 34 households; RSVP only | partial names, not addresses |
| Local Postgres `wedding` | localhost | seed residue: Budget 4 (17500/6500), Task 15, Timeline 7 rehearsal | **not** the lost graph |
| Local Postgres `wedding_recovery_173554` | localhost | restore of the 17:35:54 dump | same partial state |

No `*.dump` other than the 17:35:54 file. No `*.xlsx` anywhere searched (`/opt/cursor`, `/home/ubuntu`, `/tmp`, `/mnt`, `/workspace` minus `node_modules`/`.git`). No Git LFS. No GitHub Actions artifacts (total 0). No workflow files. No releases.

## Local databases

Three non-template databases. None hold GuestPerson 88 / Person ~84 / BudgetItem 24 / Task ~194.

`wedding` is the Cloud Agent seed (Excel files were absent, so seed skipped those sheets and then `ensureOrgCards` created the 15 week-before/day-before tasks).

## Old Cursor artifact

`/opt/cursor/artifacts/neon-phase1b1-pre-20260903.dump` is **not** under another path on this machine.

It is recorded in `phase1b1-apply-report.txt` with sha256 and a successful throwaway restore on a **previous** VM boot of this same long-running agent. 130 accessible cloud-agent runs were listed; none serve the dump bytes. Cursor artifacts that **did** persist across boots are the text/JSON reports, not the dump.

If David downloaded that dump, the sha256 above is the integrity check.

## Source workbooks

`prisma/seed.ts` reads the **first sheet** of each file from `$HOME/Downloads` (or `%USERPROFILE%\Downloads`). Missing file → skip that domain (warn, do not fail). IDs are Prisma `cuid()` except Person tokens from the TO-DO “who” column.

| File | Maps to | Columns used | Idempotent? | Exact known counts? |
| --- | --- | --- | --- | --- |
| `Finances.xlsx` | `BudgetItem` | col0 name, col1 price (number required), col2 amountPaid; skip blank / Total / alcohol | No. Always `create`. New ids. | **Unknown until David’s file is parsed.** Target fingerprint is 24 / 21485.83 / 9167.22. Later app edits to paid amounts would be missing. |
| `Guest Addresses.xlsx` | `Guest` + `GuestPerson` | col0 nameLine1, col1 nameLine2, col2–5 street/city/state/zip; one household per row; people = line1 [+ line2] | No. New cuids. | Seed creates **2 people per household max**. Known GP 88 / Guest 38 cannot come from that 1:1/1:2 mapping alone — later RSVP/backfill added people. |
| `Wedding Master TO-DO.xlsx` | `Task` + `TaskAssignee` + `ensurePerson` | col0 title, col1 who; packages via regex in `PACKAGES`; due dates inferred | No. New task ids. | Likely source of ~194 tasks / 314 assignees. Cannot verify without the file. App-created tasks after seed would be missing. |
| `Wedding Timeline.xlsx` | old `TimelineBlock` (no `seedKey`) | col0 start, col1 end, col2 notes; Excel times → `en-US` clock | No. New ids. | **Superseded** by `src/lib/day-of-bootstrap.ts` 19 `seedKey` candidates + `scripts/import-wedding-timeline.ts` (MISSING-only, never overwrite). |

**David should provide** the four Downloads workbooks from the machine that originally seeded production, without editing them.

## Guest recovery

Best exact source: missing Sep 3 dump.

Best available now:

- `data/guest-rsvp.csv` — 76 people / 34 parties vs known **88 / 38**. RSVP statuses only. `applyGuestRsvpImport` can **create** households if none exist, but new ids, no addresses, incomplete set.
- Identity reports list 88 GuestPerson **ids + display names** (not published here). No streets/phones/seating/photos/gifts.
- Pre-wipe hashes: `guest_rsvp=2849fb6d…`, `guestperson_core=b2298987…`, `gp_rsvp_photo_seat=bd3c7ac0…`, `guest_seating=4a4ec1b6…`, gifts `2e5a0282…` (1 gift row).

Fidelity without the dump or `Guest Addresses.xlsx`: **partial names + partial RSVP**. Addresses, seating, the extra ~12 people, 1 gift, and 1 guest photo are **unknown**.

## Budget recovery

No `Finances.xlsx` on this VM, so the 24 / 21485.83 / 9167.22 fingerprint **cannot be reproduced here**.

Local seed without Excel created 4 items totaling 17500 / 6500 — not the real budget.

`BudgetPayment` was 0 at the Sep 4 additive migration and 0 in every reachable state. Reconstructing items does not require payment rows.

Confidence: **unknown** until the workbook is parsed read-only against that fingerprint. Even a matching sum would still mint new ids.

## Task recovery

~194 tasks / 314 assignees came from `Wedding Master TO-DO.xlsx` via seed packaging (`sourceRow` stored). Current 15 tasks are `ensureOrgCards` week-before/day-before cards (also what the 17:35 seed left).

Task ids are **not** deterministic (`cuid()`). Anything pointing at task ids (`Request`, `TaskShare`, `TaskAssignee`) cannot be replayed exactly from Excel.

`Request` is 0 in known fingerprints — low loss there.

Without the workbook: **no known recovery source** for the 194-row graph.

## Identity recovery

The ~84 Person graph was **not** born as 84 rows.

1. Seed / TO-DO `ensurePerson` created **22** stub Persons (ids like `david`, `avalon_green`, `wendy_rush`). Listed in `phase1b1-pre-fingerprints.txt`.
2. `scripts/phase-1b1-identity.ts --apply` used the committed manifest `src/lib/phase-1b1-manifest.ts`: **62 creates** (slug ids such as `adam_crossbow`), **6 renames**, **72 GuestPerson links**, **1 Contact link**. End state Person 84, GP 72 linked / 16 unlinked.

Classification:

- **Person rows alone:** exactly replayable from the manifest (deterministic slug ids + names). Does **not** restore guests.
- **Links:** exactly replayable **only if** the original GuestPerson cuids still exist. The apply script preflights those ids. Re-importing guests mints new ids → apply **refuses**.
- After a name-based guest rebuild: **manual review required** to rematch 72 links (16 plus-ones stay unlinked by design).

Do not run apply against current production (Person 5 / GP 0 fails start counts 22 / 88).

## Browser / offline possibility

Do **not** claim any device still has a pack.

Code:

- IndexedDB `weddingsquirrels-offline` / store `packs` / key `current`
- `GET /api/offline` returns tasks, people, timeline, contacts, assignments, guests, budgetItems, requests, shopping, stay for the signed-in PIN
- Master PIN can see guests + budget + tasks — a pack fetched **before the first wipe** could hold the lost graph
- Service worker `weddingsquirrels-v2` caches the **app shell / navigations only**. `/api/*` is never cached

Worth asking David to preserve, not clear:

1. On every phone and desktop that opened production before 2026-09-05 02:57 UTC, do **not** clear site data.
2. Chrome/Edge desktop: DevTools → Application → IndexedDB → `weddingsquirrels-offline` → `packs` → `current`. If `fetchedAt` is before the wipe and `guests` / `budgetItems` / `tasks` arrays are large, export that JSON (copy object / “Save as”).
3. Same origin the PWA was installed from (Vercel production).
4. Do not press a new “Download for offline” now — that would overwrite a good pack with today’s empty graph.

## Other Neon / database copies

Only credentialed endpoint: `ep-holy-mouse-avnzi9jd` on `br-empty-darkness-avx7u2gx`. No other connection strings with passwords. Neon API still 401. Vercel MCP unauthenticated. No stale preview branch could be fingerprinted.

## Surviving production data

Seed does **not** delete these. Prefer **current production** over any older dump so later legitimate edits are kept:

| Table | Prod now | Why keep from prod |
| --- | ---: | --- |
| Contact | 7 (5 day-of true; ids `cmt0oql*` / `cmtksa*`) | Same ids as approved day-of flags; photos/phone if still on the row |
| DayAssignment | 3 (Ice / Smores / Lunch) | Survived both wipes; assignees still 0 |
| StaySlot | 12 | Count matches pre-wipe |
| MealGuest | 17 | Count matches pre-wipe |
| ShoppingItem | 3 | Created 2026-08-27 |
| CalendarEvent | 3 | Created 2026-07-26 |
| Meal settings / options / courses | present as schema | not wiped by seed |

Do **not** take from current production: Person, PinAccount, Task, TimelineBlock, AppSettings.updatedAt, Guest*, Budget*. Those are post-17:35 seed residue.

## Reconstruction matrix

| Domain | Current prod | Known good | Best source | Confidence | Replay? | Risks |
| --- | --- | --- | --- | --- | --- | --- |
| AppSettings | couple/date/tz OK; updatedAt 17:35:55 | same couple/date/tz | keep prod values; ignore seed timestamp | exact (fields) | no | none |
| Person | 5 seed stubs | 22 then 84 | missing Sep 3 dump; else manifest + TO-DO | exact only with dump; high for stubs+62 creates from manifest | yes if dump; else partial | apply needs GP 88 with old ids |
| PinAccount | 3 new unlinked `cmtonz4*` | 3 linked `cmtnslq*` | 17:35:54 dump | exact in dump | yes onto isolated DB | do not use current seed pins |
| Guest | 0 | 38 | missing dump or `Guest Addresses.xlsx` | unknown without file | yes later | new ids; CSV only 34 households |
| GuestPerson | 0 | 88 (72 linked) | dump or Excel+RSVP+backfills | unknown / partial | yes later | CSV 76 people; 16 +1s; seating/photos |
| BudgetItem | 0 | 24 / 21485.83 / 9167.22 | `Finances.xlsx` or dump | unknown until parse | yes later | new ids; paid may have drifted |
| BudgetPayment | 0 table exists | 0 | none needed | exact (empty) | no | keep empty |
| TimelineBlock | 0 | 19 wedding after import | 17:35:54 dump **or** `import-wedding-timeline.ts` candidates | exact (dump or code seedKeys) | already in dump | Excel path is the old non-seedKey import |
| Contact | 7 + day-of flags | 7 + flags | **current production** | exact | no | older dump is same ids; prefer live |
| DayAssignment | 3 / 0 assignees | 3 / 0 | **current production** | exact | no | later owners were never written |
| DayAssignmentAssignee | 0 | 0 | none | exact | no | |
| Task | 15 org-cards | ~194 / 314 assignees | TO-DO.xlsx or dump | unknown without file | yes later | new ids; lose post-seed edits |
| Request | 0 | 0 | none | exact | no | |
| ShoppingItem | 3 | 3 | **current production** | exact | no | |
| StaySlot | 12 | 12 | **current production** | exact | no | |
| MealGuest | 17 | 17 | **current production** | exact | no | identity never linked meals |
| CalendarEvent | 3 | 3 | **current production** | exact | no | |

## Recovery options (ranked by fidelity)

**OPTION A — find the Sep 3 dump** (preferred). Bytes matching `a9cb7d1e…`. Isolated restore, then replay identity apply (dump is pre-apply), BudgetPayment schema, day-of flags, PIN links, 19 timeline rows. Merge surviving **current** Contact/Stay/Meal/Shop/Calendar/DayAssignment rather than the dump’s copies if they differ.

**OPTION B — another Neon branch / laptop Postgres / Time Machine** with the full graph. None found here. Still preferred if David has one.

**OPTION C — Excel + CSV + identity rematch** (acceptable only after workbooks reproduce fingerprints). Isolated DB, never production. Import Finances / Guest Addresses / TO-DO. Overlay RSVP CSV. Rebuild Person stubs + 62 creates from the manifest **by name**, not by old GP ids. Manual review of 72 links. Overlay 17:35:54 dump’s 19 timeline + PIN rows **or** run the approved timeline/PIN scripts. Keep current production survivors listed above. **IDs will not match** the destroyed production rows.

**OPTION D — manual re-entry.** Last resort.

Do not pick C for convenience while A/B are still unsearched on David’s laptop and Downloads.

## Recommended path (plan only)

1. David searches Downloads + any backup disk for `neon-phase1b1-pre-20260903.dump` and the four xlsx files. Check sha256 if a dump appears.
2. David preserves browser IndexedDB as above before any new offline download.
3. If Neon API key exists, list branches/snapshots read-only for a stale full graph (Option B).
4. Stop. Do not import, seed, or restore production.
5. Next phase (not this one): isolated reconstruction only after A, B, or verified C fingerprints exist.

## PR #80

[PR #80](https://github.com/davidbalasa-ui/WeddingSquirrels/pull/80) is **OPEN**, `mergedAt` null.

## Data safety

This phase issued only filesystem reads, git/GitHub reads, local SELECT/pg_restore-already-done verification, and production **SELECT**. No Neon writes, no seed, no import, no env changes, no branch create/delete.

## Ready / not ready

**NOT READY.** There is not enough authoritative material on this VM to reconstruct the original wedding database without guessing.

What we **do** have: a verified partial dump, a committed identity manifest, RSVP CSV for 76/88 people, budget/task fingerprints, and intact production survivors for contact/stay/meal/shop/calendar/assignments.

What we **still need** from David’s computer: the Sep 3 dump and/or the original Downloads workbooks, plus any pre-wipe offline pack.
