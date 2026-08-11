import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.pinAccount.findMany();
  const persons = await prisma.person.findMany({ select: { id: true } });
  const personIds = new Set(persons.map((p) => p.id));

  const masterNamed = accounts.find((a) => a.name === "Master" && a.isMaster);
  if (masterNamed) {
    await prisma.pinAccount.update({
      where: { id: masterNamed.id },
      data: { name: "David" },
    });
    console.log("Renamed Master → David");
  }

  const david = await prisma.pinAccount.findFirst({
    where: { OR: [{ name: "David" }, { name: "Master" }], isMaster: true },
  });
  if (david) {
    await prisma.pinAccount.update({
      where: { id: david.id },
      data: {
        name: "David",
        isMaster: true,
        canSeeTasks: true,
        canSeeBudget: true,
        canSeeGuests: true,
        canSeeTimeline: true,
        canSeeShop: true,
        canSeeCalendar: true,
        canSeePeople: true,
        canSeeRequests: true,
        canEditBudget: true,
        canEditTimeline: true,
        canManageAccounts: true,
        assigneeFilterJson: null,
        linkedPersonId: personIds.has("david") ? "david" : david.linkedPersonId,
      },
    });
    console.log("Ensured David is master");
  }

  const haley = accounts.find((a) => a.name.toLowerCase() === "haley");
  if (haley) {
    await prisma.pinAccount.update({
      where: { id: haley.id },
      data: {
        name: "Haley",
        isMaster: true,
        canSeeTasks: true,
        canSeeBudget: true,
        canSeeGuests: true,
        canSeeTimeline: true,
        canSeeShop: true,
        canSeeCalendar: true,
        canSeePeople: true,
        canSeeRequests: true,
        canEditBudget: true,
        canEditTimeline: true,
        canManageAccounts: true,
        assigneeFilterJson: null,
        linkedPersonId: personIds.has("haley") ? "haley" : haley.linkedPersonId,
      },
    });
    console.log("Promoted Haley to master (PIN unchanged)");
  } else {
    console.log("No Haley account found — create one in Accounts or re-seed");
  }

  const mil = accounts.find((a) => a.name.toLowerCase() === "mother in law");
  if (mil && personIds.has("shelly") && !mil.linkedPersonId) {
    await prisma.pinAccount.update({
      where: { id: mil.id },
      data: { linkedPersonId: "shelly" },
    });
    console.log("Linked Mother in law → shelly");
  }

  const next = await prisma.pinAccount.findMany({
    select: {
      name: true,
      isMaster: true,
      canManageAccounts: true,
      canEditBudget: true,
      canEditTimeline: true,
      linkedPersonId: true,
    },
    orderBy: [{ isMaster: "desc" }, { name: "asc" }],
  });
  console.log(JSON.stringify(next, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
