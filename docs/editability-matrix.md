# Editability matrix (WeddingSquirrels)

Severity: **P0** critical truth blocked · **P1** expected edit missing · **P2** navigation/context · **P3** polish

| Entity | Surface | Gap | Severity | Status |
|--------|---------|-----|----------|--------|
| Task | `/work/[id]` | Save redirected off detail; assignees could not clear/reassign without fallback | P1/P2 | **Fixed** — stay on workspace; `manageOwners` writes canonical `TaskAssignee` |
| Task | Today attention/context | Task links lacked `returnTo` | P2 | **Fixed** — `useTodayOriginHref` + `withReturnTo` |
| PlaybookItem | `/day/hair-makeup`, shots, decor | View-only when DB rows exist | P1 | **Fixed** — `PlaybookBoard` + `savePlaybookItem` |
| Contact | People profile | Phone/email/name only via Contacts list | P1 | **Fixed** — `PeopleContactEditor` + `saveProfileContact` |
| CalendarEvent | `/plan/calendar` | View-only event detail | P1 | **Fixed** — inline edit + `saveCalendarEvent` |
| DayAssignment | `/day/assignments` | — | — | EDITABLE_NOW (existing panel) |
| ShoppingItem | `/plan/shopping` | — | — | EDITABLE_NOW |
| StaySlot | `/plan/stay` | — | — | EDITABLE_NOW |
| Meals | `/plan/rehearsal` | — | — | EDITABLE_NOW |
| BudgetItem | `/money/[id]` | — | — | EDITABLE_NOW |
| TimelineBlock | `/plan/timeline` | — | — | EDITABLE_NOW (edit mode) |
| PlaybookItem | Canonical fallback (no DB `id`) | View-only until first edit | P1 | **Fixed** — materialize-on-first-edit by `sourceKey` |
| Guest household phone | People profile (guest-only) | Not editable on profile | P1 | **Fixed** — `PeopleGuestPhoneEditor` → `saveGuestPhone` |
| DayAssignment | `targetTime` | Not in schema | — | SCHEMA_READ_ONLY |
| Budget rollups | Money | Computed | — | DERIVED_READ_ONLY |
