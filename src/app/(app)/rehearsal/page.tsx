import { AppHeader } from "@/components/AppHeader";
import { DayTimeline } from "@/components/DayTimeline";
import { MealBoard } from "@/components/MealBoard";
import { mealsEditable, rehearsalScheduleEditable } from "@/lib/access";
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

  const canEditSchedule = rehearsalScheduleEditable(session);
  const canEditMenu = mealsEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEditSchedule && editParam === "1";

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

  const published = Boolean(settings?.published);

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
          canEdit={canEditSchedule}
          startInEdit={startInEdit}
          schedule="rehearsal"
          idPrefix="reh"
          fixedAdd={false}
        />
      </section>

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Dinner</h2>
        <MealBoard
          courses={courseRows.map((course) => ({
            id: course.id,
            label: course.label,
            options: course.options.map((option) => ({ id: option.id, label: option.label })),
          }))}
          guests={guests.map((guest) => ({
            id: guest.id,
            sectionId: guest.sectionId,
            name: guest.name,
            choices: Object.fromEntries(guest.choices.map((choice) => [choice.courseId, choice.optionId])),
          }))}
          published={published}
          canEditMenu={canEditMenu}
          sessionName={session.name}
        />
      </section>
    </>
  );
}
