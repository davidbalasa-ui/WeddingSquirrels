import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parseRsvpStatus } from "../src/lib/guest-gifts";

const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.guest.findMany({
    include: { people: { orderBy: { sortOrder: "asc" } } },
  });

  let updated = 0;
  for (const guest of guests) {
    if (guest.people.length === 0) continue;
    const householdStatus = parseRsvpStatus(guest.rsvpStatus);
    let attendingSlots = guest.acceptedCount;

    for (const person of guest.people) {
      if (person.rsvpStatus !== "pending") continue;

      let nextStatus = householdStatus;
      if (householdStatus === "attending") {
        if (attendingSlots > 0) {
          nextStatus = "attending";
          attendingSlots -= 1;
        } else {
          nextStatus = "pending";
        }
      }

      await prisma.guestPerson.update({
        where: { id: person.id },
        data: { rsvpStatus: nextStatus },
      });
      updated += 1;
    }
  }

  console.log(`Backfilled RSVP on ${updated} guest people.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
