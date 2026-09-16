import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureMealLayout } from "@/lib/meals";
import { ensureRehearsalSchedule } from "@/lib/rehearsal";
import { sortTimelineBlocks } from "@/lib/day-of-time";

export type DinnerOptionView = {
  id: string;
  label: string;
  followUpLabel: string | null;
  followUpOptions: string[];
  followUpRequired: boolean;
};

export type DinnerCourseView = {
  id: string;
  label: string;
  minSelections: number;
  maxSelections: number;
  options: DinnerOptionView[];
};

export type DinnerSelectionView = {
  optionId: string;
  followUpValue: string | null;
};

export type DinnerMealGuestView = {
  id: string;
  name: string;
  guestPersonId: string | null;
  selections: Record<string, DinnerSelectionView[]>;
};

export type DinnerGuestCandidate = {
  guestPersonId: string;
  name: string;
  rsvpStatus: string;
  mealGuestId: string | null;
};

type CourseRuleRow = {
  courseId: string;
  minSelections: number;
  maxSelections: number;
};

type OptionRuleRow = {
  optionId: string;
  followUpLabel: string | null;
  followUpOptionsJson: string | null;
  followUpRequired: boolean;
};

type GuestLinkRow = {
  guestId: string;
  guestPersonId: string;
};

type ChoiceDetailRow = {
  guestId: string;
  courseId: string;
  followUpValue: string | null;
};

type ExtraChoiceRow = {
  guestId: string;
  courseId: string;
  slot: number;
  optionId: string;
  followUpValue: string | null;
};

export function normalizeDinnerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function parseFollowUpOptions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function dinnerCourseComplete(
  course: DinnerCourseView,
  selections: DinnerSelectionView[] | undefined,
): boolean {
  const picked = selections ?? [];
  if (picked.length < course.minSelections) return false;
  if (picked.length > course.maxSelections) return false;
  const options = new Map(course.options.map((option) => [option.id, option]));
  return picked.every((selection) => {
    const option = options.get(selection.optionId);
    if (!option) return false;
    if (!option.followUpRequired) return true;
    return Boolean(selection.followUpValue?.trim());
  });
}

export function dinnerOrderComplete(
  courses: DinnerCourseView[],
  selections: Record<string, DinnerSelectionView[]>,
): boolean {
  const active = courses.filter((course) => course.options.some((option) => option.label.trim()));
  if (active.length === 0) return false;
  return active.every((course) => dinnerCourseComplete(course, selections[course.id]));
}

function isMissingMealExtension(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /MealCourseRule|MealOptionRule|MealGuestLink|MealChoiceDetail|MealExtraChoice/i.test(message);
}

export async function ensureFlexibleMealSchema(client: PrismaClient = prisma): Promise<void> {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealCourseRule" (
      "courseId" TEXT PRIMARY KEY REFERENCES "MealCourse"("id") ON DELETE CASCADE,
      "minSelections" INTEGER NOT NULL DEFAULT 1,
      "maxSelections" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MealCourseRule_selection_range" CHECK (
        "minSelections" >= 0 AND "maxSelections" >= 1 AND "maxSelections" >= "minSelections"
      )
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealOptionRule" (
      "optionId" TEXT PRIMARY KEY REFERENCES "MealOption"("id") ON DELETE CASCADE,
      "followUpLabel" TEXT,
      "followUpOptionsJson" TEXT,
      "followUpRequired" BOOLEAN NOT NULL DEFAULT FALSE,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealGuestLink" (
      "guestId" TEXT PRIMARY KEY REFERENCES "MealGuest"("id") ON DELETE CASCADE,
      "guestPersonId" TEXT NOT NULL UNIQUE REFERENCES "GuestPerson"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealChoiceDetail" (
      "guestId" TEXT NOT NULL,
      "courseId" TEXT NOT NULL,
      "followUpValue" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("guestId", "courseId"),
      FOREIGN KEY ("guestId", "courseId") REFERENCES "MealChoice"("guestId", "courseId") ON DELETE CASCADE
    )
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealExtraChoice" (
      "guestId" TEXT NOT NULL REFERENCES "MealGuest"("id") ON DELETE CASCADE,
      "courseId" TEXT NOT NULL REFERENCES "MealCourse"("id") ON DELETE CASCADE,
      "slot" INTEGER NOT NULL,
      "optionId" TEXT NOT NULL REFERENCES "MealOption"("id") ON DELETE CASCADE,
      "followUpValue" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("guestId", "courseId", "slot"),
      UNIQUE ("guestId", "courseId", "optionId"),
      CONSTRAINT "MealExtraChoice_slot_positive" CHECK ("slot" > 0)
    )
  `);
}

export async function flexibleMealSchemaAvailable(client: PrismaClient = prisma): Promise<boolean> {
  try {
    await client.$queryRawUnsafe(`SELECT 1 FROM "MealCourseRule" LIMIT 1`);
    await client.$queryRawUnsafe(`SELECT 1 FROM "MealOptionRule" LIMIT 1`);
    await client.$queryRawUnsafe(`SELECT 1 FROM "MealGuestLink" LIMIT 1`);
    await client.$queryRawUnsafe(`SELECT 1 FROM "MealChoiceDetail" LIMIT 1`);
    await client.$queryRawUnsafe(`SELECT 1 FROM "MealExtraChoice" LIMIT 1`);
    return true;
  } catch (error) {
    if (isMissingMealExtension(error)) return false;
    return false;
  }
}

function uniqueNameMatches(
  guestPeople: Array<{ id: string; name: string }>,
  mealGuests: Array<{ id: string; name: string }>,
): Map<string, string> {
  const guestByName = new Map<string, string[]>();
  const mealByName = new Map<string, string[]>();
  for (const person of guestPeople) {
    const key = normalizeDinnerName(person.name);
    const rows = guestByName.get(key) ?? [];
    rows.push(person.id);
    guestByName.set(key, rows);
  }
  for (const guest of mealGuests) {
    const key = normalizeDinnerName(guest.name);
    const rows = mealByName.get(key) ?? [];
    rows.push(guest.id);
    mealByName.set(key, rows);
  }
  const result = new Map<string, string>();
  for (const [key, people] of guestByName) {
    const meals = mealByName.get(key) ?? [];
    if (people.length === 1 && meals.length === 1) result.set(people[0]!, meals[0]!);
  }
  return result;
}

export async function loadRehearsalDinnerPage() {
  await Promise.all([ensureMealLayout(prisma), ensureRehearsalSchedule(prisma)]);

  const [settings, courseRows, mealGuests, guestPeople, blocks, advanced] = await Promise.all([
    prisma.mealSettings.findUnique({ where: { id: 1 } }),
    prisma.mealCourse.findMany({
      orderBy: { sortOrder: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.mealGuest.findMany({
      orderBy: { sortOrder: "asc" },
      include: { choices: true },
    }),
    prisma.guestPerson.findMany({
      select: {
        id: true,
        name: true,
        personId: true,
        rsvpStatus: true,
        sortOrder: true,
        guest: { select: { sortOrder: true } },
      },
      orderBy: [{ guest: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } }),
    flexibleMealSchemaAvailable(prisma),
  ]);

  let courseRules: CourseRuleRow[] = [];
  let optionRules: OptionRuleRow[] = [];
  let guestLinks: GuestLinkRow[] = [];
  let choiceDetails: ChoiceDetailRow[] = [];
  let extraChoices: ExtraChoiceRow[] = [];

  if (advanced) {
    [courseRules, optionRules, guestLinks, choiceDetails, extraChoices] = await Promise.all([
      prisma.$queryRawUnsafe<CourseRuleRow[]>(
        `SELECT "courseId", "minSelections", "maxSelections" FROM "MealCourseRule"`,
      ),
      prisma.$queryRawUnsafe<OptionRuleRow[]>(
        `SELECT "optionId", "followUpLabel", "followUpOptionsJson", "followUpRequired" FROM "MealOptionRule"`,
      ),
      prisma.$queryRawUnsafe<GuestLinkRow[]>(
        `SELECT "guestId", "guestPersonId" FROM "MealGuestLink"`,
      ),
      prisma.$queryRawUnsafe<ChoiceDetailRow[]>(
        `SELECT "guestId", "courseId", "followUpValue" FROM "MealChoiceDetail"`,
      ),
      prisma.$queryRawUnsafe<ExtraChoiceRow[]>(
        `SELECT "guestId", "courseId", "slot", "optionId", "followUpValue" FROM "MealExtraChoice" ORDER BY "slot" ASC`,
      ),
    ]);
  }

  const courseRuleById = new Map(courseRules.map((row) => [row.courseId, row]));
  const optionRuleById = new Map(optionRules.map((row) => [row.optionId, row]));
  const guestPersonByMealGuest = new Map(guestLinks.map((row) => [row.guestId, row.guestPersonId]));
  const mealGuestByGuestPerson = new Map(guestLinks.map((row) => [row.guestPersonId, row.guestId]));
  const detailByChoice = new Map(
    choiceDetails.map((row) => [`${row.guestId}:${row.courseId}`, row.followUpValue]),
  );
  const extrasByGuestCourse = new Map<string, ExtraChoiceRow[]>();
  for (const extra of extraChoices) {
    const key = `${extra.guestId}:${extra.courseId}`;
    const rows = extrasByGuestCourse.get(key) ?? [];
    rows.push(extra);
    extrasByGuestCourse.set(key, rows);
  }

  const explicitPersonMatch = new Map<string, string>();
  for (const mealGuest of mealGuests) {
    if (!mealGuest.personId) continue;
    if (!explicitPersonMatch.has(mealGuest.personId)) explicitPersonMatch.set(mealGuest.personId, mealGuest.id);
  }
  const nameMatches = uniqueNameMatches(guestPeople, mealGuests);

  const candidates: DinnerGuestCandidate[] = guestPeople.map((person) => ({
    guestPersonId: person.id,
    name: person.name,
    rsvpStatus: person.rsvpStatus,
    mealGuestId:
      mealGuestByGuestPerson.get(person.id) ??
      (person.personId ? explicitPersonMatch.get(person.personId) ?? null : null) ??
      nameMatches.get(person.id) ??
      null,
  }));

  const guests: DinnerMealGuestView[] = mealGuests.map((guest) => {
    const selections: Record<string, DinnerSelectionView[]> = {};
    for (const choice of guest.choices) {
      selections[choice.courseId] = [
        {
          optionId: choice.optionId,
          followUpValue: detailByChoice.get(`${guest.id}:${choice.courseId}`) ?? null,
        },
      ];
      const extras = extrasByGuestCourse.get(`${guest.id}:${choice.courseId}`) ?? [];
      selections[choice.courseId]!.push(
        ...extras.map((extra) => ({ optionId: extra.optionId, followUpValue: extra.followUpValue })),
      );
    }
    return {
      id: guest.id,
      name: guest.name,
      guestPersonId: guestPersonByMealGuest.get(guest.id) ?? null,
      selections,
    };
  });

  const courses: DinnerCourseView[] = courseRows.map((course) => {
    const rule = courseRuleById.get(course.id);
    const minSelections = Math.max(0, rule?.minSelections ?? 1);
    const maxSelections = Math.max(1, rule?.maxSelections ?? 1, minSelections);
    return {
      id: course.id,
      label: course.label,
      minSelections,
      maxSelections,
      options: course.options.map((option) => {
        const optionRule = optionRuleById.get(option.id);
        return {
          id: option.id,
          label: option.label,
          followUpLabel: optionRule?.followUpLabel?.trim() || null,
          followUpOptions: parseFollowUpOptions(optionRule?.followUpOptionsJson),
          followUpRequired: Boolean(optionRule?.followUpRequired),
        };
      }),
    };
  });

  const guestById = new Map(guests.map((guest) => [guest.id, guest]));
  const completed = candidates.reduce((count, candidate) => {
    if (!candidate.mealGuestId) return count;
    const guest = guestById.get(candidate.mealGuestId);
    return guest && dinnerOrderComplete(courses, guest.selections) ? count + 1 : count;
  }, 0);

  return {
    published: Boolean(settings?.published),
    advanced,
    courses,
    guests,
    candidates,
    completed,
    blocks: sortTimelineBlocks(blocks),
  };
}
