"use server";

import { revalidatePath } from "next/cache";
import { canSeeDinnerTab, mealsEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ensureFlexibleMealSchema, normalizeDinnerName, parseFollowUpOptions } from "@/lib/rehearsal-dinner";
import { requireSession } from "@/lib/auth";

export type DinnerWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid" };

async function requireDinnerViewer() {
  try {
    const session = await requireSession();
    return canSeeDinnerTab(session) ? session : null;
  } catch {
    return null;
  }
}

async function requireDinnerEditor() {
  const session = await requireDinnerViewer();
  return session && mealsEditable(session) ? session : null;
}

function revalidateDinner() {
  revalidatePath("/plan/rehearsal");
  revalidatePath("/rehearsal");
  revalidatePath("/dinner");
  revalidatePath("/plan");
  revalidatePath("/print");
}

async function ensureLinkedMealGuest(guestPersonId: string): Promise<string | null> {
  const guestPerson = await prisma.guestPerson.findUnique({
    where: { id: guestPersonId },
    select: { id: true, name: true, personId: true },
  });
  if (!guestPerson) return null;

  const linked = await prisma.$queryRaw<Array<{ guestId: string }>>`
    SELECT "guestId" FROM "MealGuestLink" WHERE "guestPersonId" = ${guestPerson.id} LIMIT 1
  `;
  if (linked[0]?.guestId) return linked[0].guestId;

  let mealGuestId: string | null = null;
  if (guestPerson.personId) {
    mealGuestId =
      (
        await prisma.mealGuest.findFirst({
          where: { personId: guestPerson.personId },
          select: { id: true },
          orderBy: { sortOrder: "asc" },
        })
      )?.id ?? null;
  }

  if (!mealGuestId) {
    const mealGuests = await prisma.mealGuest.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
    const sameName = mealGuests.filter(
      (row) => normalizeDinnerName(row.name) === normalizeDinnerName(guestPerson.name),
    );
    if (sameName.length === 1) mealGuestId = sameName[0]!.id;
  }

  if (!mealGuestId) {
    const last = await prisma.mealGuest.findFirst({ orderBy: { sortOrder: "desc" } });
    const created = await prisma.mealGuest.create({
      data: {
        id: `meal.guest.${guestPerson.id}`,
        sectionId: "guest-list",
        name: guestPerson.name,
        personId: guestPerson.personId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    mealGuestId = created.id;
  } else {
    await prisma.mealGuest.update({
      where: { id: mealGuestId },
      data: {
        name: guestPerson.name,
        ...(guestPerson.personId ? { personId: guestPerson.personId } : {}),
      },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "MealGuestLink" ("guestId", "guestPersonId")
    VALUES (${mealGuestId}, ${guestPerson.id})
    ON CONFLICT DO NOTHING
  `;

  const resolved = await prisma.$queryRaw<Array<{ guestId: string }>>`
    SELECT "guestId" FROM "MealGuestLink" WHERE "guestPersonId" = ${guestPerson.id} LIMIT 1
  `;
  return resolved[0]?.guestId ?? mealGuestId;
}

export async function initializeFlexibleDinner(): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  revalidateDinner();
  return { ok: true, id: "flexible-dinner" };
}

export async function addDinnerCourse(): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  const last = await prisma.mealCourse.findFirst({ orderBy: { sortOrder: "desc" } });
  const course = await prisma.mealCourse.create({
    data: { label: "", sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
  await prisma.$executeRaw`
    INSERT INTO "MealCourseRule" ("courseId", "minSelections", "maxSelections")
    VALUES (${course.id}, 1, 1)
    ON CONFLICT ("courseId") DO NOTHING
  `;
  revalidateDinner();
  return { ok: true, id: course.id };
}

export async function saveDinnerCourse(
  courseId: string,
  input: { label: string; minSelections: number; maxSelections: number },
): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  const existing = await prisma.mealCourse.findUnique({ where: { id: courseId } });
  if (!existing) return { ok: false, reason: "not_found" };

  const label = input.label.trim();
  if (!label) {
    if (existing.label.trim()) return { ok: false, reason: "invalid" };
    await prisma.mealCourse.delete({ where: { id: courseId } });
    revalidateDinner();
    return { ok: true, id: courseId };
  }

  const minSelections = Math.max(0, Math.floor(input.minSelections));
  const maxSelections = Math.max(1, Math.floor(input.maxSelections));
  if (minSelections > maxSelections || maxSelections > 10) {
    return { ok: false, reason: "invalid" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealCourse.update({ where: { id: courseId }, data: { label } });
    await tx.$executeRaw`
      INSERT INTO "MealCourseRule" ("courseId", "minSelections", "maxSelections", "updatedAt")
      VALUES (${courseId}, ${minSelections}, ${maxSelections}, CURRENT_TIMESTAMP)
      ON CONFLICT ("courseId") DO UPDATE SET
        "minSelections" = EXCLUDED."minSelections",
        "maxSelections" = EXCLUDED."maxSelections",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  });
  revalidateDinner();
  return { ok: true, id: courseId };
}

export async function deleteDinnerCourse(courseId: string): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  try {
    await prisma.mealCourse.delete({ where: { id: courseId } });
  } catch {
    return { ok: false, reason: "not_found" };
  }
  revalidateDinner();
  return { ok: true, id: courseId };
}

export async function addDinnerOption(courseId: string): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  const course = await prisma.mealCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return { ok: false, reason: "not_found" };
  const last = await prisma.mealOption.findFirst({
    where: { courseId },
    orderBy: { sortOrder: "desc" },
  });
  const option = await prisma.mealOption.create({
    data: { courseId, label: "", sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
  await prisma.$executeRaw`
    INSERT INTO "MealOptionRule" ("optionId", "followUpRequired")
    VALUES (${option.id}, FALSE)
    ON CONFLICT ("optionId") DO NOTHING
  `;
  revalidateDinner();
  return { ok: true, id: option.id };
}

export async function saveDinnerOption(
  optionId: string,
  input: {
    label: string;
    followUpLabel: string;
    followUpOptions: string[];
    followUpRequired: boolean;
  },
): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  const existing = await prisma.mealOption.findUnique({ where: { id: optionId } });
  if (!existing) return { ok: false, reason: "not_found" };

  const label = input.label.trim();
  if (!label) {
    if (existing.label.trim()) return { ok: false, reason: "invalid" };
    await prisma.mealOption.delete({ where: { id: optionId } });
    revalidateDinner();
    return { ok: true, id: optionId };
  }

  const followUpLabel = input.followUpLabel.trim() || null;
  const followUpOptions = [...new Set(input.followUpOptions.map((item) => item.trim()).filter(Boolean))];
  const optionsJson = followUpOptions.length ? JSON.stringify(followUpOptions) : null;
  const required = Boolean(followUpLabel && input.followUpRequired);

  await prisma.$transaction(async (tx) => {
    await tx.mealOption.update({ where: { id: optionId }, data: { label } });
    await tx.$executeRaw`
      INSERT INTO "MealOptionRule" (
        "optionId", "followUpLabel", "followUpOptionsJson", "followUpRequired", "updatedAt"
      ) VALUES (
        ${optionId}, ${followUpLabel}, ${optionsJson}, ${required}, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("optionId") DO UPDATE SET
        "followUpLabel" = EXCLUDED."followUpLabel",
        "followUpOptionsJson" = EXCLUDED."followUpOptionsJson",
        "followUpRequired" = EXCLUDED."followUpRequired",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  });
  revalidateDinner();
  return { ok: true, id: optionId };
}

export async function deleteDinnerOption(optionId: string): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  try {
    await prisma.mealOption.delete({ where: { id: optionId } });
  } catch {
    return { ok: false, reason: "not_found" };
  }
  revalidateDinner();
  return { ok: true, id: optionId };
}

export async function setDinnerPublished(published: boolean): Promise<DinnerWriteResult> {
  if (!(await requireDinnerEditor())) return { ok: false, reason: "forbidden" };
  await ensureFlexibleMealSchema(prisma);
  await prisma.mealSettings.upsert({
    where: { id: 1 },
    create: { id: 1, published },
    update: { published },
  });
  revalidateDinner();
  return { ok: true, id: "1" };
}

export async function saveDinnerSelections(input: {
  guestPersonId: string;
  courseId: string;
  selections: Array<{ optionId: string; followUpValue?: string | null }>;
}): Promise<DinnerWriteResult> {
  const session = await requireDinnerViewer();
  if (!session) return { ok: false, reason: "forbidden" };
  const settings = await prisma.mealSettings.findUnique({ where: { id: 1 } });
  if (!settings?.published && !mealsEditable(session)) return { ok: false, reason: "forbidden" };

  await ensureFlexibleMealSchema(prisma);
  const guestId = await ensureLinkedMealGuest(input.guestPersonId);
  if (!guestId) return { ok: false, reason: "not_found" };

  const course = await prisma.mealCourse.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      options: { select: { id: true } },
    },
  });
  if (!course) return { ok: false, reason: "not_found" };

  const ruleRows = await prisma.$queryRaw<Array<{ minSelections: number; maxSelections: number }>>`
    SELECT "minSelections", "maxSelections" FROM "MealCourseRule" WHERE "courseId" = ${course.id} LIMIT 1
  `;
  const maxSelections = Math.max(1, ruleRows[0]?.maxSelections ?? 1);
  const allowedOptions = new Set(course.options.map((option) => option.id));
  const uniqueSelections = input.selections.filter(
    (selection, index, all) =>
      allowedOptions.has(selection.optionId) &&
      all.findIndex((candidate) => candidate.optionId === selection.optionId) === index,
  );
  if (uniqueSelections.length !== input.selections.length || uniqueSelections.length > maxSelections) {
    return { ok: false, reason: "invalid" };
  }

  const optionRules = uniqueSelections.length
    ? await prisma.$queryRaw<
        Array<{
          optionId: string;
          followUpOptionsJson: string | null;
        }>
      >`
        SELECT "optionId", "followUpOptionsJson"
        FROM "MealOptionRule"
        WHERE "optionId" IN (${uniqueSelections.map((selection) => selection.optionId)})
      `
    : [];
  const optionRuleById = new Map(optionRules.map((row) => [row.optionId, row]));

  for (const selection of uniqueSelections) {
    const followUpValue = selection.followUpValue?.trim() || null;
    const rule = optionRuleById.get(selection.optionId);
    const allowedFollowUps = parseFollowUpOptions(rule?.followUpOptionsJson);
    if (followUpValue && allowedFollowUps.length && !allowedFollowUps.includes(followUpValue)) {
      return { ok: false, reason: "invalid" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "MealExtraChoice" WHERE "guestId" = ${guestId} AND "courseId" = ${course.id}
    `;
    await tx.$executeRaw`
      DELETE FROM "MealChoiceDetail" WHERE "guestId" = ${guestId} AND "courseId" = ${course.id}
    `;
    await tx.mealChoice.deleteMany({ where: { guestId, courseId: course.id } });

    const primary = uniqueSelections[0];
    if (!primary) return;

    await tx.mealChoice.create({
      data: { guestId, courseId: course.id, optionId: primary.optionId },
    });
    const primaryFollowUp = primary.followUpValue?.trim() || null;
    if (primaryFollowUp) {
      await tx.$executeRaw`
        INSERT INTO "MealChoiceDetail" ("guestId", "courseId", "followUpValue")
        VALUES (${guestId}, ${course.id}, ${primaryFollowUp})
      `;
    }

    for (let index = 1; index < uniqueSelections.length; index += 1) {
      const selection = uniqueSelections[index]!;
      const followUpValue = selection.followUpValue?.trim() || null;
      await tx.$executeRaw`
        INSERT INTO "MealExtraChoice" (
          "guestId", "courseId", "slot", "optionId", "followUpValue"
        ) VALUES (
          ${guestId}, ${course.id}, ${index}, ${selection.optionId}, ${followUpValue}
        )
      `;
    }
  });

  revalidateDinner();
  return { ok: true, id: guestId };
}
