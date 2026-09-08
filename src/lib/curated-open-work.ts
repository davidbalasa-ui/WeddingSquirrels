/**
 * Curated open wedding work for David & Haley.
 *
 * Planner only: no Prisma, no network, no deletes. The apply script uses this
 * to insert/reuse Task packages on the known production Neon database.
 */

import { countActionableOpenTasks, countOpenWorkspaceCards } from "./task-actionable";

export const EXPECTED_COUPLE_NAMES = "David & Haley";
export const EXPECTED_WEDDING_DATE = "2026-10-16";
export const EXPECTED_TIMEZONE = "America/Detroit";

export const WEEK_BEFORE_TITLE = "Week before";
export const DAY_BEFORE_TITLE = "Day before";

export const WEEK_BEFORE_STEPS = [
  "Confirm week-of plans with each other",
  "Confirm final payments / tip envelopes ready",
  "Confirm vendors (photographer, Avalon, BSS, bartender, catering)",
  "Charge devices + pack backup batteries",
  "Pack for micro moon / after-wedding bag",
  "Share day-of timeline + parking with wedding party",
  "Final guest count / seating check",
] as const;

export const DAY_BEFORE_STEPS = [
  "Rehearsal time + dinner locked",
  "Lay out clothes / rings / vows / licenses",
  "Confirm tomorrow’s call times with wedding party",
  "Drop anything needed at venue / Airbnb",
  "Download offline maps + playlists",
  "Eat, hydrate, and sleep",
] as const;

export const ORG_STEP_TITLES = [...WEEK_BEFORE_STEPS, ...DAY_BEFORE_STEPS] as const;

export type BudgetLinkKind = "booze" | "dishware";

export type CuratedStepDef = {
  key: string;
  title: string;
  summary?: string;
  planNotes?: string;
  budgetLink?: BudgetLinkKind;
};

export type CuratedPackageDef = {
  key: string;
  title: string;
  summary: string;
  planNotes?: string;
  steps: CuratedStepDef[];
};

/** Kurt's phone is collected once, in MC & Day-of Contacts. */
export const CURATED_PACKAGES: CuratedPackageDef[] = [
  {
    key: "black-sheep-details",
    title: "Finalize & Send Black Sheep Details",
    summary:
      "Finish table/chair counts, remaining decor, bonfire timing, vendor compliance, and send the venue packet.",
    planNotes:
      "Black Sheep venue itself is paid and the security-deposit form is done. Remaining email to Black Sheep has not been sent. Do not pay the venue again. Bonfire is happening; start time is still open. David already has event insurance.",
    steps: [
      {
        key: "bss-tables-chairs",
        title: "Finalize table and chair quantities for Black Sheep",
        planNotes: "Decor is mostly decided. Final table/chair counts still need to be locked before the packet goes out.",
      },
      {
        key: "bss-decor",
        title: "Finalize remaining decor/rental selections for Black Sheep",
      },
      {
        key: "bss-bonfire",
        title: "Choose the bonfire start time",
        planNotes: "The bonfire is happening. Only the start time is still undecided.",
      },
      {
        key: "bss-licenses",
        title: "Confirm required licenses, certifications, and insurance for all applicable vendors",
        planNotes:
          "Glass Slipper Bartending is already booked ($800, contract signed, (719) 250-1061, gsbartending1719@gmail.com). Precious Peony is the caterer. Confirm licenses/certifications/insurance for the BSS packet — do not find or book a bartender.",
      },
      {
        key: "bss-send-insurance",
        title: "Send Black Sheep the existing day-of event insurance policy",
        planNotes: "David already has the policy. It has not been sent to Black Sheep yet.",
      },
      {
        key: "bss-send-packet",
        title: "Send Black Sheep the complete vendor, logistics, table/chair, and decor information packet",
        planNotes:
          "Assume remaining Black Sheep email is unsent. Include Kurt's contact once it is collected. Do not tell Black Sheep there is no florist.",
      },
      {
        key: "bss-confirm-received",
        title: "Confirm Black Sheep received everything and resolve anything they say is missing",
      },
    ],
  },
  {
    key: "drinks-supplies",
    title: "Wedding Drinks & Serving Supplies",
    summary: "Lock the drink menu, cider service, cups, booze, dishware, and remaining s'mores ingredients.",
    planNotes:
      "Hot cider is definitely happening. Hot chocolate is weather-dependent. Black Sheep venue is paid; 150 compostable dishware sets are a separate unpaid add-on.",
    steps: [
      { key: "drinks-menu", title: "Finalize the complete wedding drink menu" },
      {
        key: "drinks-cider",
        title: "Figure out hot-cider service: source, quantity, heating/holding method, and serving plan",
        planNotes: "Hot cider is confirmed. This step is the service plan, not a decision about whether cider happens.",
      },
      { key: "drinks-cups", title: "Determine and order enough hot-drink cups" },
      {
        key: "drinks-hot-chocolate",
        title: "Decide whether to add hot chocolate based on the wedding-week weather forecast",
        planNotes:
          "Hot cider is already confirmed. If the forecast makes hot chocolate worthwhile, arrange it and increase hot-drink cups/supplies as needed.",
      },
      {
        key: "drinks-booze",
        title: "Buy the wedding booze after the drink plan is finalized",
        budgetLink: "booze",
        planNotes: "Money remains the financial source of truth. Buy after the drink menu is locked.",
      },
      {
        key: "drinks-dishware",
        title: "Order/pay for 150 compostable dishware sets from Black Sheep",
        budgetLink: "dishware",
        planNotes: "Separate unpaid add-on. Venue balance is already paid.",
      },
      {
        key: "drinks-smores",
        title: "Order the remaining s'mores ingredients",
        planNotes: "One shopping-follow-through step. Do not split marshmallows, graham crackers, or chocolate into extra tasks.",
      },
    ],
  },
  {
    key: "rehearsal-dinner-menu",
    title: "Rehearsal Dinner Menu",
    summary: "Get Hawkshead's menu, enter it in WeddingSquirrels, publish, and collect the 17 guest selections.",
    planNotes:
      "Hawkshead is already booked. This is the menu and meal-choice flow, not a venue booking. Do not recreate the Day-before rehearsal-time step.",
    steps: [
      {
        key: "rd-get-menu",
        title: "Get the final food/menu options from Hawkshead",
        planNotes: "The reservation is booked. The menu itself has not been received yet.",
      },
      {
        key: "rd-enter-menu",
        title: "Enter the rehearsal-dinner courses/dishes into WeddingSquirrels",
      },
      {
        key: "rd-publish",
        title: "Publish meal choices to the rehearsal-dinner guests",
      },
      {
        key: "rd-collect",
        title: "Collect selections from the 17 rehearsal-dinner guests",
      },
      {
        key: "rd-follow-up",
        title: "Follow up with guests who have not selected before the eventual cutoff",
      },
    ],
  },
  {
    key: "ceremony-flower-sword",
    title: "Ceremony Flower Sword",
    summary: "Receive the ordered sword and decorate it with faux flowers for Haley's walk.",
    planNotes:
      "No florist. The sword is already ordered. Haley will walk with the decorated sword instead of a florist arrangement.",
    steps: [
      {
        key: "sword-receive",
        title: "Receive the ordered sword",
        planNotes: "Already ordered. This is receipt, not a new purchase decision.",
      },
      {
        key: "sword-decorate",
        title: "Decorate the sword with faux flowers",
      },
    ],
  },
  {
    key: "day-of-jobs",
    title: "Day-of Jobs",
    summary: "Assign ice, s'mores setup, wedding-day lunch, teardown, and tell everyone.",
    planNotes:
      "Existing Day-of jobs for ice, s'mores, and lunch still have no owner. Teardown is still unorganized. Do not invent owners.",
    steps: [
      {
        key: "jobs-ice",
        title: "Decide/assign who gets the 100 lb of ice",
        planNotes: "Existing Day-of job: Get 100 lbs of Ice. Notes mentioned 10 am?. Owner still undecided.",
      },
      {
        key: "jobs-smores",
        title: "Decide/assign who preps and sets up the s'mores station foods",
        planNotes: "Existing Day-of job: Prep Smores Station foods — by noon / unpackage/prep. Owner still undecided.",
      },
      {
        key: "jobs-lunch",
        title: "Decide/order wedding-day lunch and assign who handles it",
        planNotes: "Existing Day-of job: Cater in Lunch. Owner still undecided.",
      },
      {
        key: "jobs-teardown-plan",
        title: "Organize the wedding-night teardown and cleanup plan",
      },
      {
        key: "jobs-teardown-assign",
        title: "Assign teardown responsibilities and an overall teardown coordinator",
      },
      {
        key: "jobs-communicate",
        title: "Communicate final day-of job assignments to everyone involved",
      },
    ],
  },
  {
    key: "mc-contacts",
    title: "MC & Day-of Contacts",
    summary: "Collect Kurt's contact info, keep day-of contacts usable, and give Kurt the run-of-show.",
    planNotes:
      "Kurt is MC. Wendy is Mistress of Ceremony. Shelly is Mother of the Bride. Do not invent Kurt's phone or email.",
    steps: [
      {
        key: "kurt-phone",
        title: "Get Kurt's missing phone/contact information",
        planNotes:
          "Needed for the Black Sheep packet and the day-of call list. Do not invent a number. David can add it in-app.",
      },
      {
        key: "kurt-day-of",
        title: "Add/ensure Kurt is available as a Day-of Contact",
        planNotes: "Reuse the existing Kurt person if present. Do not create a second Kurt.",
      },
      {
        key: "shelly-day-of",
        title: "Ensure Shelly is available as a Day-of Contact",
        planNotes: "Mother of the Bride. Being a contact does not mean she owns setup/teardown jobs.",
      },
      {
        key: "wendy-day-of",
        title: "Ensure Wendy is available as a Day-of Contact",
        planNotes: "Mistress of Ceremony. Being a contact does not mean she owns setup/teardown jobs.",
      },
      {
        key: "vendor-day-of",
        title: "Ensure useful vendor contacts remain easily available on the Day-of view",
      },
      {
        key: "kurt-run-of-show",
        title: "Give Kurt the final MC/music/run-of-show plan",
        planNotes: "The cue plan is authoritative wedding information and still needs to be handed to Kurt.",
      },
    ],
  },
  {
    key: "airbnb-sleeping",
    title: "Finish Airbnb Sleeping Assignments",
    summary: "Assign the remaining required Airbnb beds. Overflow can stay empty.",
    steps: [
      {
        key: "stay-required",
        title: "Assign the remaining required Airbnb beds",
        planNotes:
          "Preserve all current Stay assignments. Optional overflow beds can remain empty.",
      },
    ],
  },
  {
    key: "wedding-funding",
    title: "Wedding Funding",
    summary: "Follow up on John & Shelly's promised contribution. Money stays the financial source of truth.",
    steps: [
      {
        key: "funding-john-shelly",
        title: "Receive/confirm John & Shelly's $5,000 wedding contribution",
        planNotes: "Promised but not yet received. No due date has been provided.",
      },
    ],
  },
];

export type TaskSnapshot = {
  id: string;
  title: string;
  summary: string | null;
  planNotes: string | null;
  status: string;
  dueDate: Date | string | null;
  sourceRow: number | null;
  parentId: string | null;
  orgKey: string | null;
  budgetItemId: string | null;
  sortOrder: number;
};

export type PersonSnapshot = {
  id: string;
  name: string;
  isDayOfContact: boolean;
};

export type ContactSnapshot = {
  id: string;
  name: string;
  personId: string | null;
  isDayOfContact: boolean;
  phone: string | null;
  email: string | null;
};

export type StaySnapshot = {
  id: string;
  label: string;
  occupant: string;
  optional: boolean;
};

export type BudgetSnapshot = {
  id: string;
  name: string;
};

export type WeddingSnapshot = {
  coupleNames: string;
  weddingDate: Date | string;
  timezone: string;
  tasks: TaskSnapshot[];
  people: PersonSnapshot[];
  contacts: ContactSnapshot[];
  stay: StaySnapshot[];
  budgetItems: BudgetSnapshot[];
};

export type PlannedStep = {
  key: string;
  title: string;
  action: "insert" | "reuse";
  existingId?: string;
  summary?: string;
  planNotes?: string;
  budgetItemId?: string;
  skipLinkReason?: string;
};

export type PlannedPackage = {
  key: string;
  title: string;
  action: "insert" | "reuse";
  existingId?: string;
  summary: string;
  planNotes?: string;
  steps: PlannedStep[];
};

export type PlannedFlag = {
  id: string;
  name: string;
  from: boolean;
  to: true;
};

export type SkippedItem = {
  item: string;
  reason: string;
};

export type CuratedPlan = {
  packages: PlannedPackage[];
  skipped: SkippedItem[];
  personFlags: PlannedFlag[];
  contactFlags: PlannedFlag[];
  stay: {
    remainingRequired: number;
    assignedRequired: number;
    totalRequired: number;
    optionalEmpty: number;
    occupants: string[];
    preservedNames: { trinity: boolean; bri: boolean; skila: boolean };
  };
  kurt: {
    personId: string | null;
    contactId: string | null;
    hasChannel: boolean;
  };
};

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

const FORBIDDEN_TITLE_PATTERNS: Array<{ item: string; re: RegExp }> = [
  { item: "Complete BSS security-deposit authorization", re: /security.?deposit/i },
  { item: "Book Hawkshead", re: /\bbook\b.*hawkshead|confirm rehearsal dinner venue/i },
  { item: "Confirm Katie for Haley's hair", re: /\bkatie\b.*\bhair\b|\bconfirm katie\b/i },
  { item: "Find/book bartender", re: /\b(find|book)\b.*bartender/i },
  { item: "Find florist", re: /\bfind florist\b|\bdecide florist\b|florist vs diy/i },
  { item: "Tell BSS there is no florist", re: /tell\b.*\bno florist\b|\bno florist\b.*\b(bss|black sheep)/i },
  { item: "David's already-funded $10,000", re: /david.*10,?000|10,?000.*david/i },
];

export function forbiddenTaskReason(title: string): string | null {
  const normalized = normalizeTitle(title);
  if (
    /\bpay\b/.test(normalized) &&
    /\b(black sheep|bss|venue)\b/.test(normalized) &&
    !/\b(dish|dishes|dishware|compostable|cutlery|cups|sets)\b/.test(normalized)
  ) {
    return "Pay Black Sheep venue";
  }
  for (const row of FORBIDDEN_TITLE_PATTERNS) {
    if (row.re.test(title) || row.re.test(normalized)) return row.item;
  }
  return null;
}

export function isOrgCardTitle(title: string): boolean {
  return titlesMatch(title, WEEK_BEFORE_TITLE) || titlesMatch(title, DAY_BEFORE_TITLE);
}

export function isOrgStepTitle(title: string): boolean {
  return ORG_STEP_TITLES.some((step) => titlesMatch(title, step));
}

export function remainingRequiredBeds(slots: Array<{ occupant: string; optional: boolean }>): {
  remainingRequired: number;
  assignedRequired: number;
  totalRequired: number;
  optionalEmpty: number;
} {
  const required = slots.filter((slot) => !slot.optional);
  const assignedRequired = required.filter((slot) => Boolean(slot.occupant.trim())).length;
  const optionalEmpty = slots.filter((slot) => slot.optional && !slot.occupant.trim()).length;
  return {
    remainingRequired: Math.max(0, required.length - assignedRequired),
    assignedRequired,
    totalRequired: required.length,
    optionalEmpty,
  };
}

export function occupantNames(slots: Array<{ occupant: string }>): string[] {
  return slots.map((slot) => slot.occupant.trim()).filter(Boolean);
}

export function hasOccupant(slots: Array<{ occupant: string }>, re: RegExp): boolean {
  return slots.some((slot) => re.test(slot.occupant));
}

export function uniqueBudgetItemId(
  items: Array<{ id: string; name: string }>,
  kind: BudgetLinkKind,
): { id: string | null; reason?: string } {
  const testers: Record<BudgetLinkKind, (name: string) => boolean> = {
    booze: (name) => /\bbooze\b/i.test(name) && !/bartender/i.test(name),
    dishware: (name) => /compostable|dishware|150\s*(compostable|dish|set)/i.test(name),
  };
  const hits = items.filter((item) => testers[kind](item.name));
  if (hits.length === 1) return { id: hits[0]!.id };
  if (hits.length === 0) return { id: null, reason: `No unique ${kind} BudgetItem` };
  return { id: null, reason: `Ambiguous ${kind} BudgetItem (${hits.map((row) => row.name).join(", ")})` };
}

function uniqueNamed<T extends { id: string; name: string }>(
  rows: T[],
  match: (row: T) => boolean,
): T | null {
  const hits = rows.filter(match);
  return hits.length === 1 ? hits[0]! : null;
}

export function findPerson(
  people: PersonSnapshot[],
  who: "kurt" | "shelly" | "wendy",
): PersonSnapshot | null {
  if (who === "kurt") {
    return uniqueNamed(people, (row) => row.id === "kurt" || /\bkurt\b/i.test(row.name));
  }
  if (who === "shelly") {
    return uniqueNamed(
      people,
      (row) => row.id === "shelly" || /^shelly\b/i.test(row.name) || /\bshelly wiewiora\b/i.test(row.name),
    );
  }
  return uniqueNamed(
    people,
    (row) =>
      row.id === "wendy" ||
      row.id === "wendy_rush" ||
      /^wendy\b/i.test(row.name) ||
      /\bwendy rush\b/i.test(row.name),
  );
}

export function findContactForPerson(
  contacts: ContactSnapshot[],
  person: PersonSnapshot | null,
  who: "kurt" | "shelly" | "wendy",
): ContactSnapshot | null {
  if (person) {
    const byPerson = uniqueNamed(contacts, (row) => row.personId === person.id);
    if (byPerson) return byPerson;
  }
  if (who === "kurt") return uniqueNamed(contacts, (row) => /\bkurt\b/i.test(row.name));
  if (who === "shelly") {
    return uniqueNamed(contacts, (row) => /^shelly\b/i.test(row.name) || /\bshelly wiewiora\b/i.test(row.name));
  }
  return uniqueNamed(contacts, (row) => /^wendy\b/i.test(row.name) || /\bwendy rush\b/i.test(row.name));
}

function existingTaskByTitle(tasks: TaskSnapshot[], title: string): TaskSnapshot | undefined {
  return tasks.find((task) => titlesMatch(task.title, title));
}

function childOf(tasks: TaskSnapshot[], parentId: string, title: string): TaskSnapshot | undefined {
  return tasks.find((task) => task.parentId === parentId && titlesMatch(task.title, title));
}

function stayPlanNotes(remainingRequired: number): string {
  const base = "Preserve all current Stay assignments. Optional overflow beds can remain empty.";
  if (remainingRequired === 0) {
    return `${base} Stay currently shows every required bed assigned; confirm that is still true.`;
  }
  const bed = remainingRequired === 1 ? "required bed still needs a name" : "required beds still need names";
  return `${base} ${remainingRequired} ${bed}.`;
}

export function planCuratedOpenWork(snapshot: WeddingSnapshot): CuratedPlan {
  const skipped: SkippedItem[] = [];
  const packages: PlannedPackage[] = [];
  const stayStats = remainingRequiredBeds(snapshot.stay);
  const occupants = occupantNames(snapshot.stay);

  skipped.push({
    item: "Get Kurt's missing phone/contact information needed for the venue packet",
    reason: "Same outcome as MC & Day-of Contacts → Get Kurt's missing phone/contact information. One task only.",
  });

  for (const pkg of CURATED_PACKAGES) {
    const existingPkg = existingTaskByTitle(snapshot.tasks, pkg.title);
    if (existingPkg && existingPkg.parentId) {
      skipped.push({
        item: pkg.title,
        reason: `A task with this title exists as a child (${existingPkg.id}). Leaving it untouched; not creating a second package.`,
      });
      continue;
    }
    if (existingPkg && existingPkg.orgKey) {
      skipped.push({
        item: pkg.title,
        reason: `Title collides with an org-card (${existingPkg.orgKey}). Not merging.`,
      });
      continue;
    }

    const planned: PlannedPackage = {
      key: pkg.key,
      title: pkg.title,
      action: existingPkg ? "reuse" : "insert",
      existingId: existingPkg?.id,
      summary: pkg.summary,
      planNotes: pkg.planNotes,
      steps: [],
    };

    for (const step of pkg.steps) {
      if (isOrgStepTitle(step.title) || isOrgCardTitle(step.title)) {
        skipped.push({
          item: step.title,
          reason: "Matches the existing Week-before / Day-before org-card tree. Not duplicated.",
        });
        continue;
      }
      const forbidden = forbiddenTaskReason(step.title);
      if (forbidden) {
        skipped.push({ item: step.title, reason: `Forbidden curated item (${forbidden}).` });
        continue;
      }

      const underParent = existingPkg ? childOf(snapshot.tasks, existingPkg.id, step.title) : undefined;
      const global = existingTaskByTitle(snapshot.tasks, step.title);
      if (!underParent && global && global.id !== existingPkg?.id) {
        skipped.push({
          item: step.title,
          reason: `An existing task already uses this title (${global.id}). Not merging across trees.`,
        });
        continue;
      }

      const existingStep = underParent;

      let budgetItemId: string | undefined;
      let skipLinkReason: string | undefined;
      if (step.budgetLink) {
        const link = uniqueBudgetItemId(snapshot.budgetItems, step.budgetLink);
        if (link.id) budgetItemId = link.id;
        else skipLinkReason = link.reason;
      }

      let planNotes = step.planNotes;
      if (step.key === "stay-required") planNotes = stayPlanNotes(stayStats.remainingRequired);

      planned.steps.push({
        key: step.key,
        title: step.title,
        action: existingStep ? "reuse" : "insert",
        existingId: existingStep?.id,
        summary: step.summary,
        planNotes,
        budgetItemId: existingStep?.budgetItemId ?? budgetItemId,
        skipLinkReason: existingStep?.budgetItemId ? undefined : skipLinkReason,
      });
    }

    packages.push(planned);
  }

  const personFlags: PlannedFlag[] = [];
  const contactFlags: PlannedFlag[] = [];
  const kurtPerson = findPerson(snapshot.people, "kurt");
  const kurtContact = findContactForPerson(snapshot.contacts, kurtPerson, "kurt");
  for (const who of ["kurt", "shelly", "wendy"] as const) {
    const person = findPerson(snapshot.people, who);
    const contact = findContactForPerson(snapshot.contacts, person, who);
    if (person && !person.isDayOfContact) {
      personFlags.push({ id: person.id, name: person.name, from: false, to: true });
    } else if (!person) {
      skipped.push({
        item: `Ensure ${who} Person day-of flag`,
        reason: `No unique existing Person for ${who}. Not creating a Person. Task stays open.`,
      });
    }
    if (contact && !contact.isDayOfContact) {
      contactFlags.push({ id: contact.id, name: contact.name, from: false, to: true });
    } else if (!contact) {
      skipped.push({
        item: `Ensure ${who} Contact day-of flag`,
        reason: `No unique existing Contact for ${who}. Not inventing phone/email or a new identity row.`,
      });
    }
  }

  return {
    packages,
    skipped,
    personFlags,
    contactFlags,
    stay: {
      ...stayStats,
      occupants,
      preservedNames: {
        trinity: hasOccupant(snapshot.stay, /trinity/i),
        bri: hasOccupant(snapshot.stay, /\bbri\b/i),
        skila: hasOccupant(snapshot.stay, /skila/i),
      },
    },
    kurt: {
      personId: kurtPerson?.id ?? null,
      contactId: kurtContact?.id ?? null,
      hasChannel: Boolean(kurtContact?.phone?.trim() || kurtContact?.email?.trim()),
    },
  };
}

export function plannedInsertCounts(plan: CuratedPlan): { packages: number; steps: number } {
  return {
    packages: plan.packages.filter((pkg) => pkg.action === "insert").length,
    steps: plan.packages.reduce(
      (sum, pkg) => sum + pkg.steps.filter((step) => step.action === "insert").length,
      0,
    ),
  };
}

/** Same canonical open-actionable count used by /plan, /plan/tasks, and /today. */
export function planOpenCount(tasks: TaskSnapshot[]): number {
  return countActionableOpenTasks(tasks);
}

/** @deprecated Use planOpenCount; kept so apply-script logs stay named. */
export function todayPulseOpenCount(tasks: TaskSnapshot[]): number {
  return countActionableOpenTasks(tasks);
}

export function actionableOpenCount(tasks: TaskSnapshot[]): number {
  return countActionableOpenTasks(tasks);
}

export function planWorkspaceCount(tasks: TaskSnapshot[]): number {
  return countOpenWorkspaceCards(tasks);
}

export function weddingDateStamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return local === EXPECTED_WEDDING_DATE || `${year}-${month}-${day}` === EXPECTED_WEDDING_DATE
    ? EXPECTED_WEDDING_DATE
    : local;
}

export function productionWeddingIdentityError(snapshot: Pick<WeddingSnapshot, "coupleNames" | "weddingDate" | "timezone">): string | null {
  const names = snapshot.coupleNames.trim();
  if (!/david/i.test(names) || !/haley/i.test(names)) {
    return `Couple names are ${JSON.stringify(names)}, expected ${EXPECTED_COUPLE_NAMES}`;
  }
  if (weddingDateStamp(snapshot.weddingDate) !== EXPECTED_WEDDING_DATE) {
    return `Wedding date is ${JSON.stringify(snapshot.weddingDate)}, expected ${EXPECTED_WEDDING_DATE}`;
  }
  if (snapshot.timezone.trim() !== EXPECTED_TIMEZONE) {
    return `Timezone is ${JSON.stringify(snapshot.timezone)}, expected ${EXPECTED_TIMEZONE}`;
  }
  return null;
}
