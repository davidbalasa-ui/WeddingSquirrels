import { AppHeader } from "@/components/AppHeader";
import { MealBoard } from "@/components/MealBoard";
import { mealsEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ensureMealLayout } from "@/lib/meals";
import { requirePageSession } from "@/lib/session";

export default async function DinnerPage() {
  const session = await requirePageSession();
  await ensureMealLayout(prisma);

  const [settings, options, guests] = await Promise.all([
    prisma.mealSettings.findUnique({ where: { id: 1 } }),
    prisma.mealOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.mealGuest.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const published = Boolean(settings?.published);
  const canEditMenu = mealsEditable(session);

  return (
    <>
      <AppHeader
        session={session}
        title="Rehearsal dinner"
        subtitle={published ? "Pick your meal" : "Menu is still being set"}
      />
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
    </>
  );
}
