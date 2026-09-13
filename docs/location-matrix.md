# Location / place ownership matrix

| Record | Displayed where | Canonical source | Editable | Notes |
| --- | --- | --- | --- | --- |
| Wedding venue | Today hero, print quick reference | `AppSettings.venueName` + address fields | Yes — `/plan/timeline#venues` | Timeline regex is legacy fallback only |
| Rehearsal dinner place | Print quick reference | `AppSettings.rehearsalDinner*` | Same editor | Not GPS |
| Lodging / Airbnb hub | Print quick reference | `AppSettings.airbnb*` | Same editor | |
| Timeline moment place | Day timeline review/edit, print timeline rows | `TimelineBlock.notes` `location:` line | Yes — Location field in timeline Edit mode | MC/music/detail lines preserved |
| Calendar event place | Plan calendar event card | `CalendarEvent.location` | Yes — calendar event editor | |
| Playbook item place | Playbook board | `PlaybookItem.location` | Yes (PR #97) | |
| Guest mailing address | Guests, people profile | `Guest.street/city/state/zip` | Yes — profile “Edit mailing address” | No duplicate on Person/Contact |
| Contact address | — | — | No | Vendors use name/phone/email only |
| Stay room/bed labels | Stay UI | `stay.ts` section definitions + `StaySlot.label` | Occupancy yes; structural room names code-backed | Renaming “Bedroom 1” needs broader stay model |
| Day assignment place | Assignments list | — | No field | Jobs rarely show a dedicated “where” today |
| Meal section titles | Meals UI | `MEAL_SECTIONS` constants | Category labels only | Actual venues use timeline/settings |
| Offline pack | `/api/offline` | `weddingPlaces` projection from AppSettings | Refreshes on sync | |
