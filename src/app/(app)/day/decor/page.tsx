import { OperationalViewsNav } from "@/components/OperationalViewsNav";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlaybookBoard } from "@/components/PlaybookBoard";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { timelineEditable } from "@/lib/access";
import { requirePageSession } from "@/lib/session";

export default async function DecorSetupPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);
  const [decor, coordinator] = await Promise.all([
    loadPlaybookItems("decor"),
    loadPlaybookItems("coordinator"),
  ]);

  return (
    <>
      <PlanChapterHeader
        title="Decor / Setup"
        subtitle="What is actually going out, who owns cleanup, and Avalon's contracted setup/breakdown — not the blank worksheet."
        backHref="/day"
        backLabel="Day-of"
      />
      <OperationalViewsNav current="/day/decor" />
      <PlaybookBoard items={decor} empty="Decor decisions have not been recorded yet." canEdit={canEdit} />
      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-[1.65rem] leading-tight">
          Avalon / Green Garden
        </h2>
        <p className="mt-2 mb-4 text-sm text-muted">
          Contracted day-of scope. These are vendor responsibilities, not extra Tasks.
        </p>
        <PlaybookBoard items={coordinator} empty="Coordinator scope has not been recorded yet." canEdit={canEdit} />
      </section>
    </>
  );
}
