# Neon Recovery Phase 1

Isolated point-in-time inspection. Production was not restored, reseeded, or cut over. No replay writes. PR #80 remains unmerged.

Recorded 2026-09-05 23:00 UTC.

## PITR capability

Production identity (untouched):

- project: `rough-water-44439856`
- branch: `br-empty-darkness-avx7u2gx`
- endpoint: `ep-holy-mouse-avnzi9jd`
- database: `neondb`

What this project supports:

1. **Time Travel (read-only).** Connect to the branch hostname `br-empty-darkness-avx7u2gx.c-11.us-east-1.aws.neon.tech` with `options=neon_timestamp:YYYY-MM-DDTHH:MM:SSZ`. Neon spins an ephemeral static compute and deletes it after idle. This does not change production endpoint routing. Connecting to the live endpoint host `ep-holy-mouse-avnzi9jd…` ignores the timestamp and hits current primary.
2. **Isolated child branch from history.** `POST /projects/{id}/branches` with `parent_id` + `parent_timestamp`, then add a `read_write` endpoint on the **child only**. This is the correct persistent recovery mechanism. It requires a Neon API key.
3. **Instant restore-in-place.** `POST …/branches/{id}/restore` overwrites the target root branch. Forbidden this phase. Not used.

Observed history window (binary search at 2026-09-05 22:55 UTC):

- earliest reachable: `2026-09-05T16:56:13Z`
- too-old bound: `2026-09-05T16:55:10Z`
- window ≈ **6 hours** (Neon Free default), sliding

`2026-09-04T19:15:00Z` is **before the retention window**. Neon rejects it (`The provided timestamp is before the retention window for your project`).

This environment has no `NEON_API_KEY`. Unauthenticated API calls return 401. `neonctl` OAuth timed out. A named Neon recovery branch was therefore **not** created. Production was not used as a restore target.

## Recovery artifact (not a Neon branch)

Because a named child branch could not be created, the latest pre-seed Time Travel state was preserved as a Postgres 17 custom dump on this VM only:

- path: `/opt/cursor/artifacts/neon-recovery-pre-seed-20260905-173554.dump`
- sha256: `aef11ab08c9431f1215f1df0cc7006d65c05b0fd8f3363b05231d973e17e7b9f`
- timestamp: `2026-09-05T17:35:54Z`
- restored only to local isolated database `wedding_recovery_173554` (localhost). Not copied into Neon.

To create the named Neon child branch **while that timestamp is still inside the 6-hour window** (~expires 2026-09-05 23:35 UTC):

```http
POST /projects/rough-water-44439856/branches
{
  "branch": {
    "name": "recovery-pre-seed-20260905-173554",
    "parent_id": "br-empty-darkness-avx7u2gx",
    "parent_timestamp": "2026-09-05T17:35:54Z"
  },
  "endpoints": [{ "type": "read_write" }]
}
```

Do not set the child as default/primary. Do not restore production. The originally suggested name `recovery-pre-wipe-20260904` cannot be created: 2026-09-04 19:15 UTC is outside retention.

## Latest intact point

The **full real wedding graph is not in the reachable PITR window.**

| Target | Reachable PITR? |
| --- | --- |
| GuestPerson 88 / Person ~84 / BudgetItem 24 / sums 21485.83 / 9167.22 | No. Last verified 2026-09-04 19:15 UTC, now expired. |
| 19 wedding TimelineBlocks + approved PIN links + day-of Contact flags | Yes, through `2026-09-05T17:35:54Z`. |

First destructive event is now pinned more tightly than autovacuum `02:58:01`:

- `2026-09-05 02:57:42.696 UTC` — `AppSettings.updatedAt`
- `2026-09-05 02:57:43 UTC` — PinAccount ids `cmtnslq*` created and linked
- `2026-09-05 02:57:43–46 UTC` — 15 Task rows `cmtnslq*`

That wipe is already before the earliest reachable PITR time (`16:56`).

Time Travel sweep (read-only):

| Timestamp (UTC) | Person | GuestPerson | BudgetItem | TimelineBlock | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| 16:57:00 | 5 | 0 | 0 | 0 | Earliest-ish reachable; import not yet landed |
| 17:02:00 | 5 | 0 | 0 | 19 | Import already present |
| 17:02:48 | 5 | 0 | 0 | 19 | Matches import verification log |
| 17:16:00 | 5 | 0 | 0 | 19 | |
| 17:30:00 | 5 | 0 | 0 | 19 | |
| 17:35:00 | 5 | 0 | 0 | 19 | |
| **17:35:54** | **5** | **0** | **0** | **19** | **Latest pre-seed** |
| 17:35:56 | 0 | 0 | 0 | 0 | Mid-seed `deleteMany` |
| 17:36:00 | 5 | 0 | 0 | 0 | Seed complete; new unlinked pins `cmtonz4*` |

## Recovery fingerprint (`2026-09-05T17:35:54Z`)

Counts (Time Travel + local dump restore agree):

| Table | Count |
| --- | ---: |
| AppSettings | 1 |
| Person | 5 |
| PinAccount | 3 (all linked; hashes not recorded) |
| Guest | 0 |
| GuestPerson | 0 |
| BudgetItem | 0 |
| BudgetPayment | 0 (table exists) |
| TimelineBlock | 19 wedding / 0 rehearsal |
| Contact | 7 (5 `isDayOfContact=true`) |
| DayAssignment | 3 |
| DayAssignmentAssignee | 0 |
| Task | 15 |
| Request | 0 |
| ShoppingItem | 3 |
| StaySlot | 12 |
| MealGuest | 17 |
| CalendarEvent | 3 |

Safe fingerprints:

- AppSettings: David & Haley / 2026-10-16 / America/Detroit / `updatedAt` 2026-09-05 02:57:42.696 UTC
- Person names: David, Haley, Shelly, Bri, Bridal party
- PIN links: David→David, Haley→Haley, Mother in law→Shelly (ids `cmtnslq*`, created 02:57:43)
- Timeline ids prefix `cmtomos2z` (19 wedding)
- Budget sums: 0 / 0

Compare to known later good state:

| Signal | Recovery 17:35:54 | Known good | |
| --- | --- | --- | --- |
| Person | 5 | ~84 | missing identity graph |
| GuestPerson | 0 | 88 | missing |
| BudgetItem | 0 | 24 | missing |
| SUM(price) / SUM(amountPaid) | 0 / 0 | 21485.83 / 9167.22 | missing |
| Contacts | 7 + day-of flags | 7 + day-of flags | match |
| StaySlot | 12 | 12 | match (survived both wipes) |
| MealGuest | 17 | 17 | match (survived both wipes) |
| Tasks | 15 (02:57 seed-shaped) | ~194 | missing real task graph |
| AppSettings couple/date/tz | correct | correct | match |

## Differences from later approved work

Already present at 17:35:54 — do **not** re-apply:

- David / Haley / Mother-in-law PIN links
- 19 wedding TimelineBlocks
- Day-of Contact flags
- `BudgetPayment` table (empty)
- AppSettings couple / date / timezone
- Surviving Contact, Stay, Meal, Shopping, Calendar, DayAssignment rows

Missing — needs a source **older than 2026-09-05 02:57**:

1. Person identity graph (~84 after apply)
2. Guest / GuestPerson (38 / 88)
3. BudgetItem 24 with sums 21485.83 / 9167.22
4. Real Task graph (~194)
5. Rehearsal TimelineBlocks (none in this window)
6. DayAssignment assignees / later assignment owners
7. Any `BudgetPayment` rows (0 at migration time as well)

Code only (not production data):

- parallel-NOW
- PR #9 / GitHub PR #80

The earlier Sep 3 dump `neon-phase1b1-pre-20260903.dump` was **not present on this VM**. If it still exists elsewhere, it is the only known full-graph backup from before the first wipe. It is older than identity apply, BudgetPayment migration, day-of flags, PIN links, and the 19-row import.

## Replay plan (ordered, do not execute)

**If a pre-02:57 full-graph source is found** (expired PITR will not provide it):

1. Restore that source onto an isolated recovery branch or local DB — never onto current production.
2. Replay canonical identity write/apply if the source is pre-apply.
3. Apply additive `BudgetPayment` schema if absent.
4. Apply day-of Contact flags if absent.
5. Relink David / Haley / Mother-in-law PINs if absent.
6. MISSING-only import of 19 wedding TimelineBlocks if absent.
7. Leave rehearsal / assignment owners / later identity edits until the base is confirmed.
8. Only then consider a cutover plan. Do not cut over in this phase.

**If using only the 17:35:54 partial base:** steps 4–6 are already done; steps 1–3 and the guest/budget/task graph still have no source inside Neon PITR.

## Production safety

After all Time Travel queries, production still reported:

`br-empty-darkness-avx7u2gx` / `ep-holy-mouse-avnzi9jd` / `primary` / TimelineBlock 0 / Person 5 / GuestPerson 0 / BudgetItem 0

No restore, reseed, import, PIN relink, truncate, copy-into-production, branch create, or branch delete was performed.

## PR #80

[PR #80](https://github.com/davidbalasa-ui/WeddingSquirrels/pull/80) remains **OPEN** and unmerged.

## Ready / not ready

**NOT READY** as a verified full-graph recovery base. The real wedding graph is outside the 6-hour PITR window.

**PARTIAL READY** for timeline + PIN + day-of reconstruction from `2026-09-05T17:35:54Z` (Time Travel verified + local dump).

Do not cut over. Do not restore production. Do not replay writes yet.
