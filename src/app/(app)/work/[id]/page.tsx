import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { RelatedLinkList } from "@/components/RelatedLinkList";
import { TaskWorkspaceForm } from "@/components/TaskWorkspaceForm";
import { prisma } from "@/lib/db";
import { canViewRequest } from "@/lib/requests";
import { contractRemaining, formatMoney } from "@/lib/money";
import { personProfileHref, moneyHref, requestHref, timelineHref } from "@/lib/entity-links";
import { getTaskWorkspace } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const { id } = await params;
  const task = await getTaskWorkspace(session, id);
  if (!task) notFound();

  let people = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  if (session.assigneeFilter?.length) {
    people = people.filter((p) => session.assigneeFilter!.includes(p.id));
  }

  const canManageOwners = session.isMaster || !session.assigneeFilter?.length;
  const visibleRequests = session.canSeeRequests
    ? task.requests.filter((request) => canViewRequest(session, request))
    : [];

  const peopleLinks = task.assignees
    .filter((row) => row.person)
    .map((row) => ({
      href: personProfileHref(row.personId),
      title: row.person.name,
    }));

  const moneyLinks = task.budgetItem
    ? [
        {
          href: moneyHref(task.budgetItem.id),
          title: task.budgetItem.name,
          detail: `${formatMoney(task.budgetItem.price)} contract · ${formatMoney(contractRemaining(task.budgetItem))} remaining`,
        },
      ]
    : [];

  const timelineLinks = task.timelineBlock
    ? [
        {
          href: timelineHref({
            schedule: task.timelineBlock.schedule === "rehearsal" ? "rehearsal" : "wedding",
            blockId: task.timelineBlock.id,
          }),
          title: task.timelineBlock.notes.split("\n")[0]?.trim() || "Timeline moment",
          detail: task.timelineBlock.startAt || null,
        },
      ]
    : [];

  const requestLinks = visibleRequests.map((request) => ({
    href: requestHref(request.id),
    title: request.title,
    detail: request.senderAccount.name,
  }));

  return (
    <>
      <AppHeader session={session} title={task.title} subtitle="Decision workspace" />
      <Link href="/today" className="mb-3 inline-block text-sm font-semibold text-[var(--accent)]">
        ← Back to Today
      </Link>
      <RelatedLinkList title="People" items={peopleLinks} />
      <RelatedLinkList title="Money" items={moneyLinks} />
      <RelatedLinkList
        title={task.timelineBlock?.schedule === "rehearsal" ? "Rehearsal" : "Wedding day"}
        items={timelineLinks}
      />
      <RelatedLinkList title="Requests" items={requestLinks} />
      <TaskWorkspaceForm task={task} people={people} canManageOwners={canManageOwners} />
    </>
  );
}
