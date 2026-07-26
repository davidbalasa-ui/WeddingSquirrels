import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureCalendarEvents } from "../src/lib/calendar-events";

const prisma = new PrismaClient();

async function main() {
  await ensureCalendarEvents(prisma);
  const events = await prisma.calendarEvent.findMany({ orderBy: { startDate: "asc" } });
  console.log(
    events.map((e) => ({
      key: e.eventKey,
      title: e.title,
      start: e.startDate.toISOString().slice(0, 10),
      end: e.endDate.toISOString().slice(0, 10),
    })),
  );
  console.log("CALENDAR EVENTS READY");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
