/** Inventory of meaningful user-facing controls. Status is coverage, not last-run PASS/FAIL. */

export type ControlKind =
  | "route"
  | "navigation"
  | "create"
  | "edit"
  | "save"
  | "cancel"
  | "delete"
  | "filter"
  | "dialog"
  | "day"
  | "people"
  | "plan"
  | "money"
  | "more"
  | "print"
  | "offline"
  | "permissions"
  | "mobile"
  | "external";

export type Coverage = "AUTOMATED" | "NOT COVERED";

export type InventoryControl = {
  id: string;
  route: string;
  control: string;
  expected: string;
  kinds: ControlKind[];
  status: Coverage;
  reason?: string;
  testId: string;
};

function auto(
  id: string,
  route: string,
  control: string,
  expected: string,
  kinds: ControlKind[],
  testId: string,
): InventoryControl {
  return { id, route, control, expected, kinds, status: "AUTOMATED", testId };
}

function skip(
  id: string,
  route: string,
  control: string,
  expected: string,
  kinds: ControlKind[],
  reason: string,
): InventoryControl {
  return { id, route, control, expected, kinds, status: "NOT COVERED", reason, testId: "—" };
}

export const DISCOVERED_ROUTES = [
  "/",
  "/today",
  "/home",
  "/day",
  "/day/now",
  "/day/assignments",
  "/day/contacts",
  "/day/mc",
  "/day/hair-makeup",
  "/day/shots",
  "/day/decor",
  "/people",
  "/people?tab=guests",
  "/people?tab=vendors",
  "/people?tab=day-of",
  "/people/guests",
  "/people/contacts",
  "/people/vendors",
  "/people/party",
  "/people/family",
  "/people/responsibilities",
  "/plan",
  "/plan/tasks",
  "/plan/timeline",
  "/plan/rehearsal",
  "/plan/stay",
  "/plan/shopping",
  "/plan/calendar",
  "/money",
  "/money/due",
  "/money/history",
  "/money/print",
  "/print",
  "/more",
  "/offline",
  "/accounts",
  "/requests",
  "/shop",
  "/stay",
  "/calendar",
  "/rehearsal",
  "/dinner",
  "/guests",
  "/guests/print",
  "/work/{id}",
  "/people/{profileId}",
  "/money/{itemId}",
  "/no-access",
] as const;

export const CONTROLS: InventoryControl[] = [
  auto("shell-skip", "*", "Skip to content", "Moves focus to #main-content", ["navigation"], "routes.spec.ts · skip and logout"),
  auto("shell-nav", "*", "TODAY / PLAN / PEOPLE / MONEY / MORE", "Each tab reaches its hub and marks aria-current", ["navigation", "mobile"], "routes.spec.ts · primary navigation"),
  auto("shell-preview-open", "*", "Preview time", "Master can expand the preview harness", ["day"], "day-of.spec.ts · preview harness"),
  auto("shell-preview-presets", "*", "Preview presets", "10:42 / ceremony / dinner / dancing / teardown / planning change asOf", ["day"], "day-of.spec.ts"),
  auto("shell-preview-custom", "*", "Custom preview Apply", "Applies a custom datetime asOf", ["day"], "day-of.spec.ts · preview harness"),
  auto("shell-preview-fixture", "*", "19-row sample timeline checkbox", "Toggles fixture=production-wedding", ["day"], "day-of.spec.ts · preview harness"),
  auto("shell-preview-clear", "*", "Clear preview", "Removes asOf and fixture", ["day"], "day-of.spec.ts · preview harness"),
  auto("shell-logout", "*", "Log out", "Visible lock control on hubs", ["navigation"], "routes.spec.ts · skip and logout"),
  skip("shell-a2hs", "/more", "Add to Home Screen / iOS install", "Would invoke native PWA / iOS share sheet", ["offline", "mobile"], "OS/browser install prompt cannot be completed in Playwright"),
  skip("shell-cold-offline", "/offline", "Cold first-ever visit offline", "Known limitation: pack only exists after an online visit", ["offline"], "Known architectural limitation; not a regression"),

  auto("today-load", "/today", "Today route", "Loads couple heading without app errors", ["route"], "routes.spec.ts · authenticated routes"),
  auto("today-pulse", "/today", "Wedding pulse links", "Pulse rows navigate (guests / tasks / money / asks)", ["navigation"], "today.spec.ts · pulse and sections"),
  auto("today-attention", "/today", "Attention / waiting / coming-up rows", "Representative row links navigate", ["navigation"], "today.spec.ts · pulse and sections"),
  auto("today-add-open", "/today", "Ask / Task / Buy compose", "Opens compose and Cancel closes it", ["create", "cancel", "dialog"], "today.spec.ts · compose cancel"),
  auto("today-add-task", "/today", "Add task save", "Creates a disposable task visible in Tasks", ["create", "save"], "writes.spec.ts · today task"),
  auto("today-filter", "/today?filter=asks", "Inbox filter chips", "Asks / Tasks / Buy / Done change the board", ["filter"], "today.spec.ts · inbox filters"),
  auto("today-task-open", "/today?filter=tasks", "Task title", "Visible task title opens /work/{id}; Back returns to Today filter", ["navigation"], "today.spec.ts · task title"),
  auto("today-alias", "/home /requests", "Today aliases", "/home and /requests reach Today", ["route"], "routes.spec.ts · aliases"),

  auto("day-load", "/day", "Day route", "Planning or live Day-of loads", ["route", "day"], "routes.spec.ts · authenticated routes"),
  auto("day-planning", "/day", "Planning schedule", "19 wedding rows, no live NOW", ["day"], "day-of.spec.ts · planning mode"),
  auto("day-now-1042", "/day", "10:42 NOW/NEXT/AFTER", "Concurrent NOW plus next/after titles", ["day"], "day-of.spec.ts · 10:42"),
  auto("day-now-later", "/day", "Ceremony / dinner / dancing / teardown NOW", "Each preset shows the expected NOW title", ["day"], "day-of.spec.ts · later moments"),
  auto("day-contacts", "/day", "Need Someone", "All flagged contacts; Wendy present; Kurt not a Contact", ["day", "people"], "day-of.spec.ts · Need Someone"),
  auto("day-channels", "/day", "Call / Text / Email", "tel/sms/mailto hrefs exist only when a channel exists", ["external", "day"], "day-of.spec.ts · contact channels"),
  auto("day-tabs", "/day", "Day / MC / Contacts / Assignments", "Tabs reach /day, /day/mc, /people?tab=day-of, /day/assignments", ["navigation", "day"], "day-of.spec.ts · day tabs"),
  auto("day-full", "/day", "View full day", "Disclosure expands the planned list in live mode", ["day"], "day-of.spec.ts · 10:42"),
  auto("day-edit-link", "/day", "Edit timeline in Plan", "Master link opens /plan/timeline", ["navigation", "day", "plan"], "day-of.spec.ts · day tabs"),
  auto("day-now-alias", "/day/now", "Now alias", "Redirects to /day", ["route", "day"], "routes.spec.ts · aliases"),

  auto("assign-load", "/day/assignments", "Assignments route", "3 canonical jobs, all unassigned", ["route", "day"], "data.spec.ts · assignments"),
  auto("assign-edit-open", "/day/assignments", "Edit / Cancel", "Opens form and Cancel restores list", ["edit", "cancel", "day"], "writes.spec.ts · assignment"),
  auto("assign-crud", "/day/assignments", "Add / Save / Delete disposable assignment", "Lifecycle on a CERT row only", ["create", "save", "delete", "day"], "writes.spec.ts · assignment"),

  auto("people-tabs", "/people", "All / Guests / Vendors / Day-of", "Tabs change query and lists", ["filter", "people"], "people.spec.ts · tabs and search"),
  auto("people-search", "/people", "Search people", "Filters to Kurt / Wendy", ["filter", "people"], "people.spec.ts · tabs and search"),
  auto("people-rsvp", "/people?tab=guests", "RSVP chips", "Everyone / No reply / Accepted / Declined", ["filter", "people"], "people.spec.ts · guests"),
  auto("people-profile", "/people/{id}", "Open profile + back", "Kurt MC; Wendy not MC; back returns", ["people", "navigation"], "people.spec.ts · profiles"),
  auto("people-identity", "/people", "Canonical identity", "All tab does not duplicate Kurt; Day-of shows Wendy not Kurt", ["people"], "people.spec.ts · identity"),
  auto("people-manage", "/people?tab=guests&manage=1", "Manage guest list + Print gift list", "Opens manage UI and /guests/print", ["people", "navigation"], "people.spec.ts · guests"),
  auto("people-dayof-edit", "/people?tab=day-of", "Add or edit day-of contacts accordion", "Expands ContactsPanel", ["people", "dialog"], "people.spec.ts · day-of contacts"),
  auto("people-channels", "/people/{id}", "Profile tel/mailto", "Href present only when channel exists", ["external", "people"], "people.spec.ts · profiles"),
  auto("people-role-cancel", "/people/{id}", "Edit role Cancel", "Opens role editor and Cancel leaves MC unchanged", ["edit", "cancel", "people"], "people.spec.ts · role cancel"),
  auto("people-subpages", "/people/vendors|/party|/family", "Legacy people lists", "Load and expose search", ["route", "people"], "people.spec.ts · subpages"),
  auto("people-task-open", "/people/{id}", "Open work task title", "Profile task opens /work/{id}; Back returns to profile", ["people", "navigation"], "people.spec.ts · David open work"),
  skip("people-delete-canonical", "/people/{id}", "Delete person", "Would permanently remove a Person", ["delete", "people"], "Must not delete canonical wedding people; no disposable Person fixture is created here"),
  skip("people-guest-photo-camera", "/people?tab=guests", "Take picture", "Would open device camera", ["people"], "Device camera cannot be operated in this runner"),

  auto("plan-hub", "/plan", "Plan chapter cards", "Tasks / Wedding Day / Rehearsal / Stay / Shopping / Calendar", ["navigation", "plan"], "plan.spec.ts · hub"),
  auto("plan-tasks-filters", "/plan/tasks", "Task filters", "Open / Overdue / Soon / Mine / Finished; wedding-week work stays in the same universe", ["filter", "plan"], "plan.spec.ts · tasks"),
  auto("plan-task-add", "/plan/tasks", "Add Task", "Creates a package and opens /work/{id}", ["create", "plan"], "writes.spec.ts · plan add task"),
  auto("plan-task-open", "/plan/tasks", "Open task workspace", "Task card opens /work/{id}", ["plan", "navigation"], "plan.spec.ts · tasks"),
  auto("plan-task-save", "/work/{id}", "Save decision / complete checkbox", "Disposable edit then restore to origin", ["edit", "save", "plan"], "writes.spec.ts · task workspace"),
  skip("plan-task-delete", "/work/{id}", "Delete task", "No delete control exists in the workspace", ["delete", "plan"], "App has no task-delete control"),
  auto("plan-task-cancel", "/work/{id}", "Leave without save", "Change workspace notes, leave via Back, original persists", ["cancel", "plan"], "writes.spec.ts · leave without save"),
  auto("plan-task-back", "/work/{id}", "Back", "Returns to originating internal route, falling back to /plan/tasks", ["navigation", "plan"], "writes.spec.ts · return to origin"),

  auto("plan-timeline-toggle", "/plan/timeline", "Review / Edit", "Toggles edit mode and + Add moment", ["edit", "plan"], "plan.spec.ts · timeline"),
  auto("plan-timeline-count", "/plan/timeline", "19 wedding rows", "Canonical titles present", ["plan"], "data.spec.ts · Timeline"),
  auto("plan-timeline-crud", "/plan/timeline", "Add / Discard / Delete disposable block", "CERT block created then removed", ["create", "cancel", "delete", "plan"], "writes.spec.ts · timeline"),
  auto("plan-timeline-reorder", "/plan/timeline", "Drag handle reorder", "Pointer-drags same-start CERT peers and persists the new order", ["edit", "plan"], "writes.spec.ts · timeline drag"),

  auto("plan-rehearsal", "/plan/rehearsal", "7 rehearsal rows + empty dinner", "Dinner before rehearsal; truthful empty menu", ["plan"], "plan.spec.ts · rehearsal"),
  auto("plan-rehearsal-edit", "/plan/rehearsal", "Walkthrough Review/Edit", "Edit exposes + Add moment", ["edit", "plan"], "plan.spec.ts · rehearsal"),
  auto("plan-rehearsal-menu-write", "/plan/rehearsal", "Add course / dish / publish menu", "Disposable course + dish, blur-save, publish toggle, then remove", ["create", "save", "plan"], "writes.spec.ts · meal menu"),

  auto("plan-stay", "/plan/stay", "Stay slots", "Slots and occupants render", ["plan"], "plan.spec.ts · stay"),
  auto("plan-stay-note", "/plan/stay", "Add / remove bathroom note", "Disposable note create + delete", ["create", "delete", "plan"], "writes.spec.ts · stay note"),
  auto("plan-stay-occupant-cancel", "/plan/stay", "Occupant restore", "Change an empty/optional field then restore original", ["edit", "cancel", "plan"], "writes.spec.ts · stay note"),

  auto("plan-shop-list", "/plan/shopping", "Shopping list + filters", "3 production items; owner / purchased filters", ["plan", "filter"], "plan.spec.ts · shopping"),
  auto("plan-shop-crud", "/plan/shopping", "Add / edit / cancel / delete item", "CERT item full lifecycle", ["create", "edit", "save", "cancel", "delete", "plan"], "writes.spec.ts · shopping"),

  auto("plan-cal", "/plan/calendar", "Calendar month + 3 events", "Prev/next month and a day with events", ["plan", "filter"], "plan.spec.ts · calendar"),
  skip("plan-cal-crud", "/plan/calendar", "Add / edit / delete event", "No in-app event CRUD", ["create", "plan"], "Calendar UI is read-only; events are seeded"),

  auto("money-dash", "/money", "Dashboard totals + 24 contracts", "Committed / paid / remaining fingerprint", ["money", "route"], "data.spec.ts · Money fingerprint"),
  auto("money-due", "/money/due", "Due page", "Loads due list or truthful empty", ["money", "route"], "money.spec.ts · due history print"),
  auto("money-history", "/money/history", "History page", "Loads payment history", ["money", "route"], "money.spec.ts · due history print"),
  auto("money-print", "/money/print", "Legacy money print", "Print button calls window.print; Back returns", ["money", "print"], "money.spec.ts · due history print"),
  auto("money-open", "/money/{id}", "Open contract detail", "Photographer (or first contract) opens", ["money", "navigation"], "money.spec.ts · detail cancel"),
  auto("money-edit-cancel", "/money/{id}", "Edit contract Cancel", "Opens editor; Cancel leaves name unchanged", ["edit", "cancel", "money"], "money.spec.ts · detail cancel"),
  auto("money-add-cancel", "/money", "Add a contract Cancel", "Form opens and Cancel closes", ["create", "cancel", "money"], "money.spec.ts · detail cancel"),
  auto("money-crud", "/money", "Disposable contract create / delete", "CERT contract saved then removed", ["create", "save", "delete", "money"], "writes.spec.ts · money"),

  auto("more-cards", "/more", "More cards", "Print, Offline, Accounts destinations", ["more", "navigation"], "more.spec.ts · cards"),
  auto("more-offline-update", "/more", "Update now / Open offline copy", "Sync control and /offline link", ["offline", "more"], "offline.spec.ts"),
  auto("accounts-dialog", "/accounts", "Add / Edit / Preview / Close", "Dialogs open and close without writing PINs", ["more", "dialog", "cancel"], "more.spec.ts · accounts"),
  skip("accounts-pin-write", "/accounts", "Save / Delete PIN account", "Would create extra local PIN identities", ["create", "delete", "more"], "Shared local auth fixtures must stay stable; dialogs are certified instead"),

  auto("print-presets", "/print", "Full Binder / Day-of Packet", "Presets select the documented sections", ["print"], "print.spec.ts"),
  auto("print-toggles", "/print", "Every section checkbox", "Each available toggle shows/hides its section", ["print"], "print.spec.ts · every toggle"),
  auto("print-action", "/print", "Print / Save PDF", "Invokes window.print", ["print"], "print.spec.ts"),
  auto("print-css", "/print", "Print media", "Nav and controls hidden; binder remains", ["print"], "print.spec.ts"),
  skip("print-os-dialog", "/print", "Native print dialog", "OS print UI", ["print"], "Native dialog cannot be driven; window.print invocation is certified"),

  auto("offline-tabs", "/offline", "Offline tabs", "Day-of · 19, Contacts, Shop, Stay, Assignments, others if packed", ["offline"], "offline.spec.ts"),
  auto("offline-reload", "/offline", "Reload while offline", "Copy remains usable", ["offline"], "offline.spec.ts"),
  auto("offline-channels", "/offline", "Offline tel/mailto", "Contact hrefs when channels exist", ["offline", "external"], "offline.spec.ts"),

  auto("perm-restricted", "*", "Restricted PIN boundaries", "No Money nav, cannot open /money or /day, no secret leak", ["permissions"], "permissions.spec.ts"),
  auto("perm-restricted-ui", "/people /plan /print", "Restricted visible controls", "People/Plan/Print remain; timeline/money chrome hidden", ["permissions"], "permissions.spec.ts · restricted chrome"),

  auto("mobile-critical", "mobile", "Critical mobile hubs", "Today Day People Plan Money More Print Offline + nav", ["mobile"], "mobile.spec.ts"),
  auto("a11y-names", "*", "Primary control names", "Primary buttons/links expose accessible names; dialogs close", ["dialog"], "more.spec.ts · accounts"),
];

export function coverageStats(controls: InventoryControl[] = CONTROLS) {
  const automated = controls.filter((row) => row.status === "AUTOMATED").length;
  const notCovered = controls.filter((row) => row.status === "NOT COVERED");
  return {
    total: controls.length,
    automated,
    notCovered: notCovered.length,
    percent: controls.length ? Math.round((automated / controls.length) * 100) : 0,
    notCoveredRows: notCovered,
  };
}

export function kindStats(kind: ControlKind, controls: InventoryControl[] = CONTROLS) {
  const rows = controls.filter((row) => row.kinds.includes(kind));
  const automated = rows.filter((row) => row.status === "AUTOMATED").length;
  return { automated, total: rows.length };
}

export function renderInventoryMarkdown() {
  const stats = coverageStats();
  const lines = [
    "# WeddingSquirrels interaction inventory",
    "",
    "Every meaningful user-facing control is listed. Status is **AUTOMATED** or **NOT COVERED** with a reason. No silent gaps.",
    "",
    `TOTAL USER-FACING ROUTES DISCOVERED: **${DISCOVERED_ROUTES.length}**`,
    "",
    `TOTAL MEANINGFUL CONTROLS INVENTORIED: **${stats.total}**`,
    "",
    `AUTOMATED CONTROLS: **${stats.automated}**`,
    "",
    `NOT COVERED CONTROLS: **${stats.notCovered}**`,
    "",
    `INTERACTION COVERAGE: **${stats.percent}%**`,
    "",
    "Repeated identical row actions are inventoried once as a shared pattern.",
    "",
    "| ID | Route | Control | Expected behavior | Test | Status |",
    "| --- | --- | --- | --- | --- | --- |",
    ...CONTROLS.map((row) => {
      const status = row.status === "AUTOMATED" ? "AUTOMATED" : `NOT COVERED — ${row.reason}`;
      return `| \`${row.id}\` | ${row.route} | ${row.control} | ${row.expected} | ${row.testId} | ${status} |`;
    }),
    "",
    "## Not covered",
    "",
    ...stats.notCoveredRows.map((row) => `- **${row.control}** (\`${row.id}\`): ${row.reason}`),
    "",
  ];
  return lines.join("\n");
}
