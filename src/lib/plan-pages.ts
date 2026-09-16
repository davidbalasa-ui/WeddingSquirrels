import { startOfMonth } from "date-fns";
import { isMissingWeddingPlaceColumn, prisma } from "@/lib/db";
import { loadMealPageData } from "@/lib/meal-data";
import { ensureMealLayout } from "@/lib/meals";
import { ensureRehearsalSchedule } from "@/lib/rehearsal";
import { ensureStayLayout } from "@/lib/stay";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { summarizeShoppingItems } from "@/lib/plan";
import type { SessionAccount } from "@/lib/types";

export async function loadPlanRehearsalPage() {
  await Promise.all([ensureMealLayout(prisma), ensureRehearsalSchedule(prisma)]);

  const [meal, blocks] = await Promise.all([
    loadMealPageData(prisma),
    prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } }),
  ]);

  return {
    ...meal,
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
  let events;
  try {
    events = await prisma.calendarEvent.findMany({
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { title: "asc" }],
    });
  } catch (error) {
    if (!isMissingWeddingPlaceColumn(error)) throw error;
    const legacyEvents = await prisma.calendarEvent.findMany({
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        notes: true,
        startDate: true,
        endDate: true,
        eventKey: true,
        color: true,
      },
    });
    events = legacyEvents.map((event) => ({ ...event, location: null }));
  }

  return {
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      notes: event.notes,
      location: event.location,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      color: event.color,
      eventKey: event.eventKey,
    })),
    initialMonth: startOfMonth(new Date()).toISOString(),
  };
}
