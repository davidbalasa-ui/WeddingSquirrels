import { PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import { weddingDate } from "./due-dates";

const ORG_CARDS = [
  {
    orgKey: "week_before",
    title: "Week before",
    summary:
      "Shared checklist for the seven days before the wedding — confirmations, packing, money, and calm logistics.",
    dueOffsetDays: 7,
    steps: [
      "Confirm week-of plans with each other",
      "Confirm final payments / tip envelopes ready",
      "Confirm vendors (photographer, Avalon, BSS, bartender, catering)",
      "Charge devices + pack backup batteries",
      "Pack for micro moon / after-wedding bag",
      "Share day-of timeline + parking with wedding party",
      "Final guest count / seating check",
    ],
  },
  {
    orgKey: "day_before",
    title: "Day before",
    summary:
      "Shared checklist for the day before — rehearsal, set-out, and anything that must be done before morning-of.",
    dueOffsetDays: 1,
    steps: [
      "Rehearsal time + dinner locked",
      "Lay out clothes / rings / vows / licenses",
      "Confirm tomorrow’s call times with wedding party",
      "Drop anything needed at venue / Airbnb",
      "Download offline maps + playlists",
      "Eat, hydrate, and sleep",
    ],
  },
] as const;

async function ensureAssignees(client: PrismaClient, taskId: string, personIds: string[]) {
  for (const personId of personIds) {
    await client.taskAssignee.upsert({
      where: { taskId_personId: { taskId, personId } },
      create: { taskId, personId },
      update: {},
    });
  }
}

export async function ensureOrgCards(client: PrismaClient) {
  const wedding = weddingDate();

  for (const card of ORG_CARDS) {
    const dueDate = subDays(wedding, card.dueOffsetDays);
    let parent = await client.task.findFirst({ where: { orgKey: card.orgKey } });

    if (!parent) {
      parent = await client.task.create({
        data: {
          title: card.title,
          summary: card.summary,
          planNotes: "",
          status: "todo",
          dueDate,
          orgKey: card.orgKey,
          sortOrder: card.orgKey === "week_before" ? -20 : -10,
          amountSpent: 0,
        },
      });
    } else {
      parent = await client.task.update({
        where: { id: parent.id },
        data: {
          title: card.title,
          summary: card.summary,
          dueDate,
          sortOrder: card.orgKey === "week_before" ? -20 : -10,
        },
      });
    }

    await ensureAssignees(client, parent.id, ["david", "haley"]);

    const existingChildren = await client.task.findMany({
      where: { parentId: parent.id },
      select: { title: true },
    });
    const existingTitles = new Set(existingChildren.map((c) => c.title.toLowerCase()));

    let sortOrder = existingChildren.length;
    for (const stepTitle of card.steps) {
      if (existingTitles.has(stepTitle.toLowerCase())) continue;
      const step = await client.task.create({
        data: {
          title: stepTitle,
          summary: "Shared step for this organizational card.",
          planNotes: "",
          status: "todo",
          parentId: parent.id,
          sortOrder: sortOrder++,
          amountSpent: 0,
        },
      });
      await ensureAssignees(client, step.id, ["david", "haley"]);
    }
  }
}
