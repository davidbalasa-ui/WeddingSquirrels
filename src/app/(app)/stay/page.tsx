import { AppHeader } from "@/components/AppHeader";
import { StayBoard } from "@/components/StayBoard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { ensureStayLayout } from "@/lib/stay";

export default async function StayPage() {
  const session = await requirePageSession();
  await ensureStayLayout(prisma);

  const [slots, notes] = await Promise.all([
    prisma.staySlot.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.stayBathNote.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <AppHeader
        session={session}
        title="Night-before Airbnb"
        subtitle="Tap a name to claim a bed"
      />
      <StayBoard
        slots={slots.map((slot) => ({
          id: slot.id,
          sectionId: slot.sectionId,
          label: slot.label,
          occupant: slot.occupant,
          optional: slot.optional,
        }))}
        notes={notes.map((note) => ({
          id: note.id,
          sectionId: note.sectionId,
          note: note.note,
        }))}
      />
    </>
  );
}
