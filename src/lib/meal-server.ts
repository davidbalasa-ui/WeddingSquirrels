import type { PrismaClient } from "@prisma/client";
import type { MealCourseConfig, MealSelectionInput } from "@/lib/meal-order";
import { validateMealSelections, validatePartialMealSelections } from "@/lib/meal-order";

export function newMealGuestId(guestPersonId: string): string {
  return `meal.gp.${guestPersonId}`;
}

export async function resolveMealGuestForGuestPerson(
  client: PrismaClient,
  guestPersonId: string,
): Promise<{ id: string; name: string } | null> {
  const guestPerson = await client.guestPerson.findUnique({
    where: { id: guestPersonId },
    select: { id: true, name: true, personId: true },
  });
  if (!guestPerson) return null;

  const linked = await client.mealGuest.findFirst({
    where: { guestPersonId: guestPerson.id },
    select: { id: true, name: true },
  });
  if (linked) return linked;

  if (guestPerson.personId) {
    const legacy = await client.mealGuest.findFirst({
      where: { personId: guestPerson.personId, guestPersonId: null },
      select: { id: true, name: true },
    });
    if (legacy) {
      await client.mealGuest.update({
        where: { id: legacy.id },
        data: { guestPersonId: guestPerson.id },
      });
      return legacy;
    }
  }

  const created = await client.mealGuest.create({
    data: {
      id: newMealGuestId(guestPerson.id),
      guestPersonId: guestPerson.id,
      personId: guestPerson.personId,
      name: guestPerson.name,
      sectionId: "guest",
      sortOrder: 10_000,
    },
    select: { id: true, name: true },
  });
  return created;
}

export async function persistMealOrder(
  client: PrismaClient,
  mealGuestId: string,
  courses: MealCourseConfig[],
  selections: MealSelectionInput[],
  opts: { requireComplete: boolean },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const validated = opts.requireComplete
    ? validateMealSelections(courses, selections)
    : validatePartialMealSelections(courses, selections);
  if (!validated.ok) return { ok: false, reason: validated.reason };

  const next = validated.selections;
  const activeCourseIds = new Set(courses.map((course) => course.id));

  await client.$transaction(async (tx) => {
    await tx.mealChoice.deleteMany({
      where: {
        guestId: mealGuestId,
        courseId: { in: [...activeCourseIds] },
      },
    });
    if (next.length) {
      await tx.mealChoice.createMany({
        data: next.map((row) => ({
          guestId: mealGuestId,
          courseId: row.courseId,
          optionId: row.optionId,
          followUpChoiceId: row.followUpChoiceId ?? null,
          followUpText: row.followUpText ?? null,
        })),
      });
    }
  });

  return { ok: true };
}
