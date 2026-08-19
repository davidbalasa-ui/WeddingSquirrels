import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestVisibilityWhere } from "@/lib/requests";
import { taskVisibilityWhere } from "@/lib/tasks";

/**
 * Returns a JSON snapshot of everything the signed-in account can see,
 * for the read-only offline copy used on the wedding day.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [
    settings,
    tasks,
    people,
    timeline,
    contacts,
    assignments,
    guests,
    allBudgetItems,
    requests,
    shopping,
    stay,
  ] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    session.canSeeTasks
      ? prisma.task.findMany({
          where: taskVisibilityWhere(session),
          include: {
            assignees: { include: { person: { select: { id: true, name: true } } } },
            children: { include: { assignees: { include: { person: { select: { id: true, name: true } } } } } },
            budgetItem: { select: { id: true, name: true } },
          },
          orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    session.canSeePeople
      ? prisma.person.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.timelineBlock.findMany({ orderBy: [{ schedule: "asc" }, { sortOrder: "asc" }] })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.dayAssignment.findMany({
          include: {
            assignees: { include: { person: { select: { id: true, name: true } } } },
          },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    session.canSeeGuests
      ? prisma.guest.findMany({
          include: {
            people: { orderBy: { sortOrder: "asc" } },
            gifts: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    session.canSeeBudget
      ? prisma.budgetItem.findMany({
          include: { shares: { select: { pinAccountId: true } } },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    session.canSeeRequests
      ? prisma.request.findMany({
          where: requestVisibilityWhere(session),
          include: {
            senderAccount: { select: { id: true, name: true } },
            recipientAccount: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
            messages: {
              orderBy: { sortOrder: "asc" },
              include: { authorAccount: { select: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    session.canSeeShop ? prisma.shoppingItem.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
    session.canSeeStay ? prisma.staySlot.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);

  // Mirror the Money page's visibility rule for non-editing accounts.
  const budgetItems =
    session.isMaster || session.canEditBudget
      ? allBudgetItems
      : session.canSeeBudget
        ? allBudgetItems.filter(
            (item) =>
              (session.linkedPersonId != null && item.ownerId === session.linkedPersonId) ||
              item.shares.some((share) => share.pinAccountId === session.id),
          )
        : [];

  return Response.json({
    fetchedAt: new Date().toISOString(),
    weddingDate: settings?.weddingDate?.toISOString() ?? null,
    coupleNames: settings?.coupleNames ?? null,
    timezone: settings?.timezone ?? null,
    tasks,
    people,
    timeline,
    contacts,
    assignments,
    guests,
    budgetItems,
    requests,
    shopping,
    stay,
  });
}
