import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { ensureMealLayout } from "@/lib/meals";
import { ensureRehearsalSchedule } from "@/lib/rehearsal";
import { ensureStayLayout } from "@/lib/stay";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { summarizeShoppingItems } from "@/lib/plan";
import type { SessionAccount } from "@/lib/types";

export async function loadPlanRehearsalPage() {
  await Promise.all([ensureMealLayout(prisma), ensureRehearsalSchedule(prisma)]);

  const [settings, courseRows, guests, blocks] = await Promise.all([
    prisma.mealSettings.findUnique({ where: { id: 1 } }),
    prisma.mealCourse.findMany({
      orderBy: { sortOrder: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.mealGuest.findMany({
      orderBy: { sortOrder: "asc" },
      include: { choices: true },
    }),
    prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } }),
  ]);

  return {
    published: Boolean(settings?.published),
    courses: courseRows.map((course) => ({
      id: course.id,
      label: course.label,
      options: course.options.map((option) => ({ id: option.id, label: option.label })),
    })),
    guests: guests.map((guest) => ({
      id: guest.id,
      sectionId: guest.sectionId,
      name: guest.name,
      choices: Object.fromEntries(guest.choices.map((choice) => [choice.courseId, choice.optionId])),
    })),
    blocks: sortTimelineBlocks(blocks),
  };
}

export async function loadPlanStayPage() {
  await ensureStayLayout(prisma);
  const [slots, notes] = await Promise.all([
    prisma.staySlot.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.stayBathNote.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    slots: slots.map((slot) => ({
      id: slot.id,
      sectionId: slot.sectionId,
      label: slot.label,
      occupant: slot.occupant,
      optional: slot.optional,
    })),
    notes: notes.map((note) => ({
      id: note.id,
      sectionId: note.sectionId,
      note: note.note,
    })),
  };
}

export async function loadPlanShoppingPage(
  session: SessionAccount,
  opts: { who: string },
) {
  const ownerWhere =
    opts.who === "david"
      ? { ownerId: "david" as const }
      : opts.who === "haley"
        ? { ownerId: "haley" as const }
        : opts.who === "both"
          ? { ownerId: null }
          : {};

  const [items, tasks] = await Promise.all([
    prisma.shoppingItem.findMany({
      where: ownerWhere,
      include: {
        owner: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: [{ purchased: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    session.canSeeTasks
      ? prisma.task.findMany({
          where: { parentId: null, orgKey: null },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    items,
    tasks,
    summary: summarizeShoppingItems(items),
  };
}

export async function loadPlanCalendarPage() {
  const events = await prisma.calendarEvent.findMany({
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { title: "asc" }],
  });
  return {
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      notes: event.notes,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      color: event.color,
      eventKey: event.eventKey,
    })),
    initialMonth: startOfMonth(new Date()).toISOString(),
  };
}
