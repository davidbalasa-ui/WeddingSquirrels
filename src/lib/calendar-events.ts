import { PrismaClient } from "@prisma/client";
import { weddingDate } from "./due-dates";

const SEEDED = [
  {
    eventKey: "bachelorette",
    title: "Bachelorette party",
    notes: "Haley’s bachelorette — Aug 7–9, 2026",
    start: "2026-08-07",
    end: "2026-08-09",
    color: "#8a4b2a",
  },
  {
    eventKey: "bachelor",
    title: "Bachelor party",
    notes: "David’s bachelor — Aug 21–23, 2026",
    start: "2026-08-21",
    end: "2026-08-23",
    color: "#2f5d50",
  },
  {
    eventKey: "wedding",
    title: "Wedding day",
    notes: "David & Haley · October 16, 2026",
    start: "2026-10-16",
    end: "2026-10-16",
    color: "#2f5d50",
  },
] as const;

function noon(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

export async function ensureCalendarEvents(client: PrismaClient) {
  // Keep wedding event aligned with AppSettings when possible
  const settings = await client.appSettings.findUnique({ where: { id: 1 } });
  const wedding = settings?.weddingDate ?? weddingDate();

  for (const event of SEEDED) {
    const startDate = event.eventKey === "wedding" ? wedding : noon(event.start);
    const endDate = event.eventKey === "wedding" ? wedding : noon(event.end);

    const existing = await client.calendarEvent.findUnique({
      where: { eventKey: event.eventKey },
    });

    if (!existing) {
      await client.calendarEvent.create({
        data: {
          eventKey: event.eventKey,
          title: event.title,
          notes: event.notes,
          startDate,
          endDate,
          color: event.color,
        },
      });
    } else {
      await client.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: event.title,
          notes: event.notes,
          startDate,
          endDate,
          color: event.color,
        },
      });
    }
  }
}
