import { AppHeader } from "@/components/AppHeader";
import { DayTimeline } from "@/components/DayTimeline";
import { MealBoard } from "@/components/MealBoard";
import { mealsEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { ensureMealLayout } from "@/lib/meals";
import { ensureRehearsalSchedule } from "@/lib/rehearsal";
import { requirePageSession } from "@/lib/session";

export default async function RehearsalPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeDinner" });
  await Promise.all([ensureMealLayout(prisma), ensureRehearsalSchedule(prisma)]);

  const canEdit = mealsEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEdit && editParam === "1";

  const [settings, options, guests, blocks] = await Promise.all([
    prisma.mealSettings.findUnique({ where: { id: 1 } }),
    prisma.mealOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.mealGuest.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } }),
  ]);

  const published = Boolean(settings?.published);
  const canEditMenu = canEdit;

  return (
    <>
      <AppHeader
        session={session}
        title="Rehearsal"
        subtitle="Thursday, October 15, 2026"
      />

      <section className="mb-6">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Schedule</h2>
        <DayTimeline
          blocks={sortTimelineBlocks(blocks)}
          canEdit={canEdit}
          startInEdit={startInEdit}
          schedule="rehearsal"
          idPrefix="reh"
          fixedAdd={false}
        />
      </section>

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Dinner</h2>
        <MealBoard
          options={options.map((option) => ({ id: option.id, label: option.label }))}
          guests={guests.map((guest) => ({
            id: guest.id,
            sectionId: guest.sectionId,
            name: guest.name,
            optionId: guest.optionId,
          }))}
          published={published}
          canEditMenu={canEditMenu}
          sessionName={session.name}
        />
      </section>
    </>
  );
}
