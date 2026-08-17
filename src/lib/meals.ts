import type { PrismaClient } from "@prisma/client";

export type MealSectionId = "couple" | "party" | "groom" | "bride" | "officiant" | "ceremony";

export type MealGuestDef = {
  id: string;
  name: string;
};

export type MealSectionDef = {
  id: MealSectionId;
  title: string;
  guests: MealGuestDef[];
};

export const MEAL_SECTIONS: MealSectionDef[] = [
  {
    id: "couple",
    title: "Bride and Groom",
    guests: [
      { id: "meal.david", name: "David" },
      { id: "meal.haley", name: "Haley" },
    ],
  },
  {
    id: "party",
    title: "Bridal Party",
    guests: [
      { id: "meal.trinity", name: "Trinity" },
      { id: "meal.bri", name: "Bri" },
      { id: "meal.evan", name: "Evan" },
      { id: "meal.andi", name: "Andi" },
      { id: "meal.braxton", name: "Braxton" },
      { id: "meal.victoria", name: "Victoria" },
      { id: "meal.skila", name: "Skila" },
      { id: "meal.kaylie", name: "Kaylie" },
    ],
  },
  {
    id: "groom",
    title: "Groom's side",
    guests: [
      { id: "meal.bryan", name: "Bryan" },
      { id: "meal.pam", name: "Pam" },
    ],
  },
  {
    id: "bride",
    title: "Bride's side",
    guests: [
      { id: "meal.shelly", name: "Shelly" },
      { id: "meal.john", name: "John" },
    ],
  },
  {
    id: "officiant",
    title: "Officiant",
    guests: [{ id: "meal.marie", name: "Marie" }],
  },
  {
    id: "ceremony",
    title: "Mr. & Mrs. of Ceremony",
    guests: [
      { id: "meal.wendy", name: "Wendy" },
      { id: "meal.kurt", name: "Kurt" },
    ],
  },
];

export const MEAL_GUEST_IDS = MEAL_SECTIONS.flatMap((section) => section.guests.map((guest) => guest.id));

export function isMealGuestId(value: string): boolean {
  return MEAL_GUEST_IDS.includes(value);
}

export function mealGuestCount(): number {
  return MEAL_GUEST_IDS.length;
}

export type MealGuestRow = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
};

export function planMealWrites(existing: MealGuestRow[]) {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const creates: MealGuestRow[] = [];
  const updates: MealGuestRow[] = [];
  let sort = 0;
  for (const section of MEAL_SECTIONS) {
    for (const guest of section.guests) {
      const row = byId.get(guest.id);
      const next: MealGuestRow = {
        id: guest.id,
        sectionId: section.id,
        name: guest.name,
        sortOrder: sort,
      };
      if (!row) creates.push(next);
      else if (row.sectionId !== next.sectionId || row.name !== next.name || row.sortOrder !== next.sortOrder) {
        updates.push(next);
      }
      sort += 1;
    }
  }
  return { creates, updates };
}

export function shouldDeleteMealOptionOnClear(existingLabel: string, nextLabel: string) {
  return !nextLabel.trim() && !existingLabel.trim();
}

export type MealCourseView = {
  id: string;
  label: string;
  options: Array<{ id: string; label: string }>;
};

export type MealChoiceMap = Record<string, string | null>;

export function labeledCourseOptions(course: MealCourseView) {
  return course.options.filter((option) => option.label.trim());
}

export function guestFinishedPicking(courses: MealCourseView[], choices: MealChoiceMap) {
  const needed = courses.filter((course) => labeledCourseOptions(course).length > 0);
  if (needed.length === 0) return false;
  return needed.every((course) => Boolean(choices[course.id]));
}

export function countFinishedGuests(courses: MealCourseView[], guests: Array<{ choices: MealChoiceMap }>) {
  return guests.filter((guest) => guestFinishedPicking(courses, guest.choices)).length;
}

export async function ensureMealLayout(client: PrismaClient) {
  await client.mealSettings.upsert({
    where: { id: 1 },
    create: { id: 1, published: false },
    update: {},
  });

  const existing = await client.mealGuest.findMany({
    select: { id: true, sectionId: true, name: true, sortOrder: true },
  });
  const { creates, updates } = planMealWrites(existing);
  if (creates.length) {
    await client.mealGuest.createMany({ data: creates });
  }
  for (const row of updates) {
    await client.mealGuest.update({
      where: { id: row.id },
      data: {
        sectionId: row.sectionId,
        name: row.name,
        sortOrder: row.sortOrder,
      },
    });
  }

  const orphanOptions = await client.mealOption.findMany({
    where: { courseId: null },
    orderBy: { sortOrder: "asc" },
  });
  if (orphanOptions.length) {
    let course = await client.mealCourse.findFirst({ orderBy: { sortOrder: "asc" } });
    if (!course) {
      course = await client.mealCourse.create({
        data: { label: "Dinner", sortOrder: 0 },
      });
    }
    await client.mealOption.updateMany({
      where: { id: { in: orphanOptions.map((option) => option.id) } },
      data: { courseId: course.id },
    });
  }

  const leftoverPicks = await client.mealGuest.findMany({
    where: { optionId: { not: null } },
    select: { id: true, optionId: true },
  });
  for (const guest of leftoverPicks) {
    if (!guest.optionId) continue;
    const option = await client.mealOption.findUnique({
      where: { id: guest.optionId },
      select: { id: true, courseId: true },
    });
    if (!option?.courseId) continue;
    await client.mealChoice.upsert({
      where: { guestId_courseId: { guestId: guest.id, courseId: option.courseId } },
      create: { guestId: guest.id, courseId: option.courseId, optionId: option.id },
      update: {},
    });
  }
}
