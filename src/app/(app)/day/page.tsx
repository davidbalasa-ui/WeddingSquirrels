import { AppHeader } from "@/components/AppHeader";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function DayPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const blocks = await prisma.timelineBlock.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <AppHeader session={session} title="Day-of" subtitle="October 16, 2026" />
      <div className="flex flex-col gap-3">
        {blocks.map((block) => (
          <article key={block.id} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              {block.startAt}
              {block.endAt ? ` – ${block.endAt}` : ""}
            </p>
            <p className="mt-1 text-[15px] leading-snug">{block.notes}</p>
          </article>
        ))}
      </div>
    </>
  );
}
