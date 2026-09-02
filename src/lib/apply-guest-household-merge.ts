import type { PrismaClient } from "@prisma/client";
import {
  analyzeHouseholdMerges,
  buildMergedHouseholdFields,
  type GuestMergeApplyResult,
  type MergeGuestHousehold,
} from "@/lib/guest-household-merge";
import { planPhotoCopies } from "@/lib/guest-photo-sync";

type Db = PrismaClient;

async function loadMergeHouseholds(db: Db): Promise<MergeGuestHousehold[]> {
  const guests = await db.guest.findMany({
    include: {
      people: { orderBy: { sortOrder: "asc" } },
      gifts: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return guests.map((guest) => ({
    id: guest.id,
    phone: guest.phone,
    street: guest.street,
    city: guest.city,
    state: guest.state,
    zip: guest.zip,
    rsvpStatus: guest.rsvpStatus,
    invitedCount: guest.invitedCount,
    acceptedCount: guest.acceptedCount,
    sortOrder: guest.sortOrder,
    people: guest.people.map((person) => ({
      id: person.id,
      name: person.name,
      directoryLabel: person.directoryLabel,
      isDayOfContact: person.isDayOfContact,
      rsvpStatus: person.rsvpStatus,
      photoData: person.photoData,
      tableNumber: person.tableNumber,
      tableSpot: person.tableSpot,
      sortOrder: person.sortOrder,
    })),
    gifts: guest.gifts.map((gift) => ({
      id: gift.id,
      description: gift.description,
      thanked: gift.thanked,
      thankYouWritten: gift.thankYouWritten,
      thankYouSent: gift.thankYouSent,
      sortOrder: gift.sortOrder,
    })),
  }));
}

export async function copyGuestContactPhotos(db: Db): Promise<number> {
  const [people, contacts] = await Promise.all([
    db.guestPerson.findMany({ select: { id: true, name: true, photoData: true } }),
    db.contact.findMany({ select: { id: true, name: true, photoData: true } }),
  ]);
  const plan = planPhotoCopies(people, contacts);
  for (const update of plan.guestUpdates) {
    await db.guestPerson.update({
      where: { id: update.id },
      data: { photoData: update.photoData },
    });
  }
  for (const update of plan.contactUpdates) {
    await db.contact.update({
      where: { id: update.id },
      data: { photoData: update.photoData },
    });
  }
  return plan.guestUpdates.length + plan.contactUpdates.length;
}

export async function applySafeGuestHouseholdMerges(db: Db): Promise<GuestMergeApplyResult> {
  const households = await loadMergeHouseholds(db);
  const analysis = analyzeHouseholdMerges(households);
  const report: string[] = [];
  let merged = 0;

  for (const plan of analysis.merges) {
    const winner = households.find((row) => row.id === plan.winnerId);
    const loser = households.find((row) => row.id === plan.loserId);
    if (!winner || !loser) continue;

    const built = buildMergedHouseholdFields(winner, loser);

    await db.$transaction(async (tx) => {
      for (const person of built.people) {
        if (winner.people.some((row) => row.id === person.id)) {
          await tx.guestPerson.update({
            where: { id: person.id },
            data: {
              name: person.name,
              directoryLabel: person.directoryLabel,
              isDayOfContact: person.isDayOfContact,
              rsvpStatus: person.rsvpStatus,
              photoData: person.photoData,
              tableNumber: person.tableNumber,
              tableSpot: person.tableSpot,
              sortOrder: person.sortOrder,
            },
          });
        } else if (loser.people.some((row) => row.id === person.id)) {
          await tx.guestPerson.update({
            where: { id: person.id },
            data: {
              guestId: winner.id,
              name: person.name,
              directoryLabel: person.directoryLabel,
              isDayOfContact: person.isDayOfContact,
              rsvpStatus: person.rsvpStatus,
              photoData: person.photoData,
              tableNumber: person.tableNumber,
              tableSpot: person.tableSpot,
              sortOrder: person.sortOrder,
            },
          });
        }
      }

      for (const gift of loser.gifts) {
        await tx.guestGift.update({
          where: { id: gift.id },
          data: {
            guestId: winner.id,
            sortOrder: gift.sortOrder + winner.gifts.length,
          },
        });
      }

      await tx.guest.update({
        where: { id: winner.id },
        data: built.household,
      });

      const remainingLoserPeople = await tx.guestPerson.count({ where: { guestId: loser.id } });
      if (remainingLoserPeople === 0) {
        await tx.guest.delete({ where: { id: loser.id } });
      }
    });

    merged += 1;
    report.push(`Merged ${plan.label}`);
    // Keep in-memory view consistent for later pairs in this pass
    winner.people = built.people;
    winner.gifts = built.gifts;
    Object.assign(winner, built.household);
  }

  for (const conflict of analysis.conflicts) {
    report.push(`Skipped ${conflict.label} (${conflict.reasons.join(", ")})`);
  }

  const photosCopied = await copyGuestContactPhotos(db);
  if (photosCopied > 0) report.push(`Copied ${photosCopied} photos between contacts and guests`);

  return {
    merged,
    skippedConflicts: analysis.conflicts.length,
    photosCopied,
    report,
  };
}
