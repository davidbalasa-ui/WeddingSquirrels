import { AppHeader } from "@/components/AppHeader";
import {
  AccountAccessPanel,
  type AccountPanelAccount,
} from "@/components/AccountAccessPanel";
import { createPinAccount, updatePinAccount } from "@/app/actions";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

function parseAssigneeFilterJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    // Corrupt filter JSON → empty selection (all tasks visible).
    return [];
  }
}

function toPanelAccount(
  account: {
    id: string;
    name: string;
    isMaster: boolean;
    canSeeTasks: boolean;
    canSeePeople: boolean;
    canSeeCalendar: boolean;
    canSeeShop: boolean;
    canSeeBudget: boolean;
    canEditBudget: boolean;
    canSeeTimeline: boolean;
    canEditTimeline: boolean;
    canSeeGuests: boolean;
    canSeeRequests: boolean;
    canManageAccounts: boolean;
    linkedPersonId: string | null;
    assigneeFilterJson: string | null;
    budgetItemShares: { budgetItemId: string }[];
    taskShares: { taskId: string }[];
  },
): AccountPanelAccount {
  return {
    id: account.id,
    name: account.name,
    isMaster: account.isMaster,
    canSeeTasks: account.canSeeTasks,
    canSeePeople: account.canSeePeople,
    canSeeCalendar: account.canSeeCalendar,
    canSeeShop: account.canSeeShop,
    canSeeBudget: account.canSeeBudget,
    canEditBudget: account.canEditBudget,
    canSeeTimeline: account.canSeeTimeline,
    canEditTimeline: account.canEditTimeline,
    canSeeGuests: account.canSeeGuests,
    canSeeRequests: account.canSeeRequests,
    canManageAccounts: account.canManageAccounts,
    linkedPersonId: account.linkedPersonId,
    assigneeFilter: parseAssigneeFilterJson(account.assigneeFilterJson),
    sharedBudgetItemIds: account.budgetItemShares.map((s) => s.budgetItemId),
    sharedTaskIds: account.taskShares.map((s) => s.taskId),
  };
}

export default async function AccountsPage() {
  const session = await requirePageSession({ need: "canManageAccounts" });
  const [accounts, people, budgetItems, tasks] = await Promise.all([
    prisma.pinAccount.findMany({
      orderBy: [{ isMaster: "desc" }, { name: "asc" }],
      include: {
        budgetItemShares: { select: { budgetItemId: true } },
        taskShares: { select: { taskId: true } },
      },
    }),
    prisma.person.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.budgetItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  const sharesEnabled = true;
  const budgetShareOptions = budgetItems.map((item) => ({
    id: item.id,
    label: item.name,
  }));
  const taskShareOptions = tasks.map((task) => ({
    id: task.id,
    label: task.title,
  }));

  const peopleOptions = people.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <AppHeader
        session={session}
        title="Accounts"
        subtitle="PINs, linked people, modules, task filters, and shared items"
      />

      <AccountAccessPanel
        mode="create"
        people={peopleOptions}
        action={createPinAccount}
        sharesEnabled={sharesEnabled}
        budgetShareOptions={budgetShareOptions}
        taskShareOptions={taskShareOptions}
      />

      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <AccountAccessPanel
            key={account.id}
            mode="edit"
            people={peopleOptions}
            account={toPanelAccount(account)}
            action={updatePinAccount}
            sharesEnabled={sharesEnabled}
            budgetShareOptions={budgetShareOptions}
            taskShareOptions={taskShareOptions}
          />
        ))}
      </div>
    </>
  );
}
