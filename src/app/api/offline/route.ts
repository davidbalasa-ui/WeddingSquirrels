import { getSession } from "@/lib/auth";
import { prisma, supportsBudgetPayments } from "@/lib/db";
import { filterVisibleBudgetItems } from "@/lib/money";
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

  const includePayments = session.canSeeBudget ? await supportsBudgetPayments() : false;

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
          include: {
            shares: { select: { pinAccountId: true } },
            payments: includePayments
              ? { orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] }
              : false,
          },
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

  const budgetItems = filterVisibleBudgetItems(session, allBudgetItems);

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
