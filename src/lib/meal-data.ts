import type { PrismaClient } from "@prisma/client";
import { isMissingFlexibleMealColumn, type MealChoiceMap } from "@/lib/meals";
import type { MealCourseConfig, MealSelectionInput } from "@/lib/meal-order";

export type MealGuestPersonOption = {
  id: string;
  name: string;
  household: string;
};

export type LoadedMealOrder = {
  mealGuestId: string;
  guestPersonId: string | null;
  name: string;
  sectionId: string;
  selections: MealSelectionInput[];
};

export type LoadedMealPageData = {
  flexibleSchema: boolean;
  published: boolean;
  courses: MealCourseConfig[];
  guestPeople: MealGuestPersonOption[];
  orders: LoadedMealOrder[];
  legacyOnly: boolean;
  /** Full legacy roster rows for schema-skew fallback UI. */
  legacyRoster: Array<{ id: string; sectionId: string; name: string; choices: MealChoiceMap }>;
};

function mapCourseRow(
  course: {
    id: string;
    label: string;
    minSelections?: number;
    maxSelections?: number;
    options: Array<{
      id: string;
      label: string;
      followUpPrompt?: string | null;
      followUpChoices?: Array<{ id: string; label: string; sortOrder: number }>;
    }>;
  },
  flexible: boolean,
): MealCourseConfig {
  return {
    id: course.id,
    label: course.label,
    minSelections: flexible ? (course.minSelections ?? 1) : 1,
    maxSelections: flexible ? (course.maxSelections ?? 1) : 1,
    options: course.options.map((option) => ({
      id: option.id,
      label: option.label,
      followUpPrompt: flexible ? (option.followUpPrompt ?? null) : null,
      followUpChoices: flexible
        ? (option.followUpChoices ?? []).map((row) => ({ id: row.id, label: row.label }))
        : [],
    })),
  };
}

export async function loadMealPageData(client: PrismaClient): Promise<LoadedMealPageData> {
  let flexibleSchema = true;
  let courseRows;
  try {
    courseRows = await client.mealCourse.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: { followUpChoices: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
  } catch (error) {
    if (!isMissingFlexibleMealColumn(error)) throw error;
    flexibleSchema = false;
    courseRows = await client.mealCourse.findMany({
      orderBy: { sortOrder: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
  }

  const [settings, guestPeopleRows, mealGuestRows] = await Promise.all([
    client.mealSettings.findUnique({ where: { id: 1 } }),
    client.guestPerson.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { guest: { select: { nameLine1: true, nameLine2: true } } },
    }),
    client.mealGuest.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        choices: flexibleSchema
          ? { include: { followUpChoice: { select: { id: true, label: true } } } }
          : true,
      },
    }),
  ]);

  const guestPeople: MealGuestPersonOption[] = guestPeopleRows.map((row) => {
    const household = [row.guest.nameLine1, row.guest.nameLine2].filter(Boolean).join(" · ");
    return { id: row.id, name: row.name, household };
  });

  const legacyRoster = mealGuestRows.map((guest) => ({
    id: guest.id,
    sectionId: guest.sectionId,
    name: guest.name,
    choices: Object.fromEntries(
      guest.choices.map((choice) => [choice.courseId, choice.optionId]),
    ) as MealChoiceMap,
  }));

  const orders: LoadedMealOrder[] = mealGuestRows
    .filter((guest) => guest.choices.length > 0 || guest.guestPersonId)
    .map((guest) => ({
      mealGuestId: guest.id,
      guestPersonId: flexibleSchema ? (guest.guestPersonId ?? null) : null,
      name: guest.name,
      sectionId: guest.sectionId,
      selections: guest.choices.map((choice) => ({
        courseId: choice.courseId,
        optionId: choice.optionId,
        followUpChoiceId:
          flexibleSchema && "followUpChoiceId" in choice ? (choice.followUpChoiceId ?? null) : null,
        followUpText: flexibleSchema && "followUpText" in choice ? (choice.followUpText ?? null) : null,
      })),
    }));

  return {
    flexibleSchema,
    published: Boolean(settings?.published),
    courses: courseRows.map((course) => mapCourseRow(course, flexibleSchema)),
    guestPeople,
    orders,
    legacyOnly: !flexibleSchema,
    legacyRoster,
  };
}
