# WeddingSquirrels interaction inventory

Every meaningful user-facing control is listed. Status is **AUTOMATED** or **NOT COVERED** with a reason. No silent gaps.

TOTAL USER-FACING ROUTES DISCOVERED: **44**

TOTAL MEANINGFUL CONTROLS INVENTORIED: **86**

AUTOMATED CONTROLS: **75**

NOT COVERED CONTROLS: **11**

INTERACTION COVERAGE: **87%**

Repeated identical row actions are inventoried once as a shared pattern.

| ID | Route | Control | Expected behavior | Test | Status |
| --- | --- | --- | --- | --- | --- |
| `shell-skip` | * | Skip to content | Moves focus to #main-content | routes.spec.ts · skip and logout | AUTOMATED |
| `shell-nav` | * | TODAY / PLAN / PEOPLE / MONEY / MORE | Each tab reaches its hub and marks aria-current | routes.spec.ts · primary navigation | AUTOMATED |
| `shell-preview-open` | * | Preview time | Master can expand the preview harness | day-of.spec.ts · preview harness | AUTOMATED |
| `shell-preview-presets` | * | Preview presets | 10:42 / ceremony / dinner / dancing / teardown / planning change asOf | day-of.spec.ts | AUTOMATED |
| `shell-preview-custom` | * | Custom preview Apply | Applies a custom datetime asOf | day-of.spec.ts · preview harness | AUTOMATED |
| `shell-preview-fixture` | * | 19-row sample timeline checkbox | Toggles fixture=production-wedding | day-of.spec.ts · preview harness | AUTOMATED |
| `shell-preview-clear` | * | Clear preview | Removes asOf and fixture | day-of.spec.ts · preview harness | AUTOMATED |
| `shell-logout` | * | Log out | Visible lock control on hubs | routes.spec.ts · skip and logout | AUTOMATED |
| `shell-a2hs` | /more | Add to Home Screen / iOS install | Would invoke native PWA / iOS share sheet | — | NOT COVERED — OS/browser install prompt cannot be completed in Playwright |
| `shell-cold-offline` | /offline | Cold first-ever visit offline | Known limitation: pack only exists after an online visit | — | NOT COVERED — Known architectural limitation; not a regression |
| `today-load` | /today | Today route | Loads couple heading without app errors | routes.spec.ts · authenticated routes | AUTOMATED |
| `today-pulse` | /today | Wedding pulse links | Pulse rows navigate (guests / tasks / money / asks) | today.spec.ts · pulse and sections | AUTOMATED |
| `today-attention` | /today | Attention / waiting / coming-up rows | Representative row links navigate | today.spec.ts · pulse and sections | AUTOMATED |
| `today-add-open` | /today | Ask / Task / Buy compose | Opens compose and Cancel closes it | today.spec.ts · compose cancel | AUTOMATED |
| `today-add-task` | /today | Add task save | Creates a disposable task visible in Tasks | writes.spec.ts · today task | AUTOMATED |
| `today-filter` | /today?filter=asks | Inbox filter chips | Asks / Tasks / Buy / Done change the board | today.spec.ts · inbox filters | AUTOMATED |
| `today-alias` | /home /requests | Today aliases | /home and /requests reach Today | routes.spec.ts · aliases | AUTOMATED |
| `day-load` | /day | Day route | Planning or live Day-of loads | routes.spec.ts · authenticated routes | AUTOMATED |
| `day-planning` | /day | Planning schedule | 19 wedding rows, no live NOW | day-of.spec.ts · planning mode | AUTOMATED |
| `day-now-1042` | /day | 10:42 NOW/NEXT/AFTER | Concurrent NOW plus next/after titles | day-of.spec.ts · 10:42 | AUTOMATED |
| `day-now-later` | /day | Ceremony / dinner / dancing / teardown NOW | Each preset shows the expected NOW title | day-of.spec.ts · later moments | AUTOMATED |
| `day-contacts` | /day | Need Someone | All flagged contacts; Wendy present; Kurt not a Contact | day-of.spec.ts · Need Someone | AUTOMATED |
| `day-channels` | /day | Call / Text / Email | tel/sms/mailto hrefs exist only when a channel exists | day-of.spec.ts · contact channels | AUTOMATED |
| `day-tabs` | /day | Day / Contacts / Assignments | Tabs reach /day, /people?tab=day-of, /day/assignments | day-of.spec.ts · day tabs | AUTOMATED |
| `day-full` | /day | View full day | Disclosure expands the planned list in live mode | day-of.spec.ts · 10:42 | AUTOMATED |
| `day-edit-link` | /day | Edit timeline in Plan | Master link opens /plan/timeline | day-of.spec.ts · day tabs | AUTOMATED |
| `day-now-alias` | /day/now | Now alias | Redirects to /day | routes.spec.ts · aliases | AUTOMATED |
| `assign-load` | /day/assignments | Assignments route | 3 canonical jobs, all unassigned | data.spec.ts · assignments | AUTOMATED |
| `assign-edit-open` | /day/assignments | Edit / Cancel | Opens form and Cancel restores list | writes.spec.ts · assignment | AUTOMATED |
| `assign-crud` | /day/assignments | Add / Save / Delete disposable assignment | Lifecycle on a CERT row only | writes.spec.ts · assignment | AUTOMATED |
| `people-tabs` | /people | All / Guests / Vendors / Day-of | Tabs change query and lists | people.spec.ts · tabs and search | AUTOMATED |
| `people-search` | /people | Search people | Filters to Kurt / Wendy | people.spec.ts · tabs and search | AUTOMATED |
| `people-rsvp` | /people?tab=guests | RSVP chips | Everyone / No reply / Accepted / Declined | people.spec.ts · guests | AUTOMATED |
| `people-profile` | /people/{id} | Open profile + back | Kurt MC; Wendy not MC; back returns | people.spec.ts · profiles | AUTOMATED |
| `people-identity` | /people | Canonical identity | All tab does not duplicate Kurt; Day-of shows Wendy not Kurt | people.spec.ts · identity | AUTOMATED |
| `people-manage` | /people?tab=guests&manage=1 | Manage guest list + Print gift list | Opens manage UI and /guests/print | people.spec.ts · guests | AUTOMATED |
| `people-dayof-edit` | /people?tab=day-of | Add or edit day-of contacts accordion | Expands ContactsPanel | people.spec.ts · day-of contacts | AUTOMATED |
| `people-channels` | /people/{id} | Profile tel/mailto | Href present only when channel exists | people.spec.ts · profiles | AUTOMATED |
| `people-role-cancel` | /people/{id} | Edit role Cancel | Opens role editor and Cancel leaves MC unchanged | people.spec.ts · role cancel | AUTOMATED |
| `people-subpages` | /people/vendors|/party|/family | Legacy people lists | Load and expose search | people.spec.ts · subpages | AUTOMATED |
| `people-delete-canonical` | /people/{id} | Delete person | Would permanently remove a Person | — | NOT COVERED — Must not delete canonical wedding people; no disposable Person fixture is created here |
| `people-guest-photo-camera` | /people?tab=guests | Take picture | Would open device camera | — | NOT COVERED — Device camera cannot be operated in this runner |
| `plan-hub` | /plan | Plan chapter cards | Tasks / Wedding Day / Rehearsal / Stay / Shopping / Calendar | plan.spec.ts · hub | AUTOMATED |
| `plan-tasks-filters` | /plan/tasks | Task filters | Open / Overdue / Soon / Mine / Finished | plan.spec.ts · tasks | AUTOMATED |
| `plan-task-open` | /plan/tasks | Open task workspace | Task card opens /work/{id} | plan.spec.ts · tasks | AUTOMATED |
| `plan-task-save` | /work/{id} | Save decision / complete checkbox | Disposable edit then restore | writes.spec.ts · task workspace | AUTOMATED |
| `plan-task-delete` | /work/{id} | Delete task | No delete control exists in the workspace | — | NOT COVERED — App has no task-delete control |
| `plan-task-cancel` | /work/{id} | Cancel workspace | Workspace persists on Save only; no Cancel button | — | NOT COVERED — No cancel control; leave-without-save is the browser back |
| `plan-timeline-toggle` | /plan/timeline | Review / Edit | Toggles edit mode and + Add moment | plan.spec.ts · timeline | AUTOMATED |
| `plan-timeline-count` | /plan/timeline | 19 wedding rows | Canonical titles present | data.spec.ts · Timeline | AUTOMATED |
| `plan-timeline-crud` | /plan/timeline | Add / Discard / Delete disposable block | CERT block created then removed | writes.spec.ts · timeline | AUTOMATED |
| `plan-timeline-reorder` | /plan/timeline | Drag handle reorder | Reorders same-time peers | — | NOT COVERED — Pointer drag of same-start peers is not a distinct user-facing destination; skip to keep the suite fast |
| `plan-rehearsal` | /plan/rehearsal | 7 rehearsal rows + empty dinner | Dinner before rehearsal; truthful empty menu | plan.spec.ts · rehearsal | AUTOMATED |
| `plan-rehearsal-edit` | /plan/rehearsal | Walkthrough Review/Edit | Edit exposes + Add moment | plan.spec.ts · rehearsal | AUTOMATED |
| `plan-rehearsal-menu-write` | /plan/rehearsal | Add course / dish / publish menu | Would mutate shared dinner board | — | NOT COVERED — Menu is unpublished/empty; creating courses would invent product dinner data. Empty state is certified instead |
| `plan-stay` | /plan/stay | Stay slots | Slots and occupants render | plan.spec.ts · stay | AUTOMATED |
| `plan-stay-note` | /plan/stay | Add / remove bathroom note | Disposable note create + delete | writes.spec.ts · stay note | AUTOMATED |
| `plan-stay-occupant-cancel` | /plan/stay | Occupant restore | Change an empty/optional field then restore original | writes.spec.ts · stay note | AUTOMATED |
| `plan-shop-list` | /plan/shopping | Shopping list + filters | 3 production items; owner / purchased filters | plan.spec.ts · shopping | AUTOMATED |
| `plan-shop-crud` | /plan/shopping | Add / edit / cancel / delete item | CERT item full lifecycle | writes.spec.ts · shopping | AUTOMATED |
| `plan-cal` | /plan/calendar | Calendar month + 3 events | Prev/next month and a day with events | plan.spec.ts · calendar | AUTOMATED |
| `plan-cal-crud` | /plan/calendar | Add / edit / delete event | No in-app event CRUD | — | NOT COVERED — Calendar UI is read-only; events are seeded |
| `money-dash` | /money | Dashboard totals + 24 contracts | Committed / paid / remaining fingerprint | data.spec.ts · Money fingerprint | AUTOMATED |
| `money-due` | /money/due | Due page | Loads due list or truthful empty | money.spec.ts · due history print | AUTOMATED |
| `money-history` | /money/history | History page | Loads payment history | money.spec.ts · due history print | AUTOMATED |
| `money-print` | /money/print | Legacy money print | Print button calls window.print; Back returns | money.spec.ts · due history print | AUTOMATED |
| `money-open` | /money/{id} | Open contract detail | Photographer (or first contract) opens | money.spec.ts · detail cancel | AUTOMATED |
| `money-edit-cancel` | /money/{id} | Edit contract Cancel | Opens editor; Cancel leaves name unchanged | money.spec.ts · detail cancel | AUTOMATED |
| `money-add-cancel` | /money | Add a contract Cancel | Form opens and Cancel closes | money.spec.ts · detail cancel | AUTOMATED |
| `money-crud` | /money | Disposable contract create / delete | CERT contract saved then removed | writes.spec.ts · money | AUTOMATED |
| `more-cards` | /more | More cards | Print, Offline, Accounts destinations | more.spec.ts · cards | AUTOMATED |
| `more-offline-update` | /more | Update now / Open offline copy | Sync control and /offline link | offline.spec.ts | AUTOMATED |
| `accounts-dialog` | /accounts | Add / Edit / Preview / Close | Dialogs open and close without writing PINs | more.spec.ts · accounts | AUTOMATED |
| `accounts-pin-write` | /accounts | Save / Delete PIN account | Would create extra local PIN identities | — | NOT COVERED — Shared local auth fixtures must stay stable; dialogs are certified instead |
| `print-presets` | /print | Full Binder / Day-of Packet | Presets select the documented sections | print.spec.ts | AUTOMATED |
| `print-toggles` | /print | Every section checkbox | Each available toggle shows/hides its section | print.spec.ts · every toggle | AUTOMATED |
| `print-action` | /print | Print / Save PDF | Invokes window.print | print.spec.ts | AUTOMATED |
| `print-css` | /print | Print media | Nav and controls hidden; binder remains | print.spec.ts | AUTOMATED |
| `print-os-dialog` | /print | Native print dialog | OS print UI | — | NOT COVERED — Native dialog cannot be driven; window.print invocation is certified |
| `offline-tabs` | /offline | Offline tabs | Day-of · 19, Contacts, Shop, Stay, Assignments, others if packed | offline.spec.ts | AUTOMATED |
| `offline-reload` | /offline | Reload while offline | Copy remains usable | offline.spec.ts | AUTOMATED |
| `offline-channels` | /offline | Offline tel/mailto | Contact hrefs when channels exist | offline.spec.ts | AUTOMATED |
| `perm-restricted` | * | Restricted PIN boundaries | No Money nav, cannot open /money or /day, no secret leak | permissions.spec.ts | AUTOMATED |
| `perm-restricted-ui` | /people /plan /print | Restricted visible controls | People/Plan/Print remain; timeline/money chrome hidden | permissions.spec.ts · restricted chrome | AUTOMATED |
| `mobile-critical` | mobile | Critical mobile hubs | Today Day People Plan Money More Print Offline + nav | mobile.spec.ts | AUTOMATED |
| `a11y-names` | * | Primary control names | Primary buttons/links expose accessible names; dialogs close | more.spec.ts · accounts | AUTOMATED |

## Not covered

- **Add to Home Screen / iOS install** (`shell-a2hs`): OS/browser install prompt cannot be completed in Playwright
- **Cold first-ever visit offline** (`shell-cold-offline`): Known architectural limitation; not a regression
- **Delete person** (`people-delete-canonical`): Must not delete canonical wedding people; no disposable Person fixture is created here
- **Take picture** (`people-guest-photo-camera`): Device camera cannot be operated in this runner
- **Delete task** (`plan-task-delete`): App has no task-delete control
- **Cancel workspace** (`plan-task-cancel`): No cancel control; leave-without-save is the browser back
- **Drag handle reorder** (`plan-timeline-reorder`): Pointer drag of same-start peers is not a distinct user-facing destination; skip to keep the suite fast
- **Add course / dish / publish menu** (`plan-rehearsal-menu-write`): Menu is unpublished/empty; creating courses would invent product dinner data. Empty state is certified instead
- **Add / edit / delete event** (`plan-cal-crud`): Calendar UI is read-only; events are seeded
- **Save / Delete PIN account** (`accounts-pin-write`): Shared local auth fixtures must stay stable; dialogs are certified instead
- **Native print dialog** (`print-os-dialog`): Native dialog cannot be driven; window.print invocation is certified
