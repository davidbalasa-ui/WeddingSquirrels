import { prisma, supportsBudgetPayments } from "@/lib/db";
import { moneyEditable } from "@/lib/access";
import {
  buildMoneyDueItems,
  buildMoneyHistoryItems,
  buildMoneySummary,
  filterVisibleBudgetItems,
  sortContractsByUrgency,
  type BudgetContractSnapshot,
  type BudgetPaymentSnapshot,
  type MinorExpenseSnapshot,
  type MoneyDueItem,
  type MoneyHistoryItem,
  type MoneySummary,
} from "@/lib/money";
import { taskVisibilityWhere } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export type MoneyPageData = {
  contracts: BudgetContractSnapshot[];
  minor: MinorExpenseSnapshot[];
  summary: MoneySummary;
  dueItems: MoneyDueItem[];
  overdueItems: MoneyDueItem[];
  historyItems: MoneyHistoryItem[];
  personNames: Record<string, string>;
  canEdit: boolean;
};

function mapPayments(
  payments: Array<{
    id: string;
    label: string | null;
    amount: number;
    dueDate: Date | null;
    paidAmount: number;
    paidAt: Date | null;
    paidById: string | null;
    note: string | null;
    sortOrder: number;
  }>,
): BudgetPaymentSnapshot[] {
  return payments.map((payment) => ({
    id: payment.id,
    label: payment.label,
    amount: payment.amount,
    dueDate: payment.dueDate,
    paidAmount: payment.paidAmount,
    paidAt: payment.paidAt,
    paidById: payment.paidById,
    note: payment.note,
    sortOrder: payment.sortOrder,
  }));
}

export async function loadVisibleBudgetContracts(
  session: SessionAccount,
): Promise<BudgetContractSnapshot[]> {
  if (!session.canSeeBudget) return [];

  const includePayments = await supportsBudgetPayments();
  const allItems = await prisma.budgetItem.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      shares: { select: { pinAccountId: true } },
      payments: includePayments
        ? { orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] }
        : false,
    },
  });

  const visible = filterVisibleBudgetItems(session, allItems);

  return visible.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    amountPaid: item.amountPaid,
    ownerId: item.ownerId,
    paidById: item.paidById,
    payByDate: item.payByDate,
    note: item.note,
    sortOrder: item.sortOrder,
    payments: includePayments && "payments" in item && item.payments
      ? mapPayments(item.payments)
      : [],
  }));
}

export async function loadVisibleBudgetContract(
  session: SessionAccount,
  contractId: string,
): Promise<BudgetContractSnapshot | null> {
  const contracts = await loadVisibleBudgetContracts(session);
  return contracts.find((contract) => contract.id === contractId) ?? null;
}

export async function loadMinorExpenses(canEdit: boolean): Promise<MinorExpenseSnapshot[]> {
  if (!canEdit) return [];

  const rows = await prisma.task.findMany({
    where: {
      parentId: null,
      budgetItemId: null,
      OR: [{ amountNeeded: { not: null } }, { amountSpent: { gt: 0 } }],
    },
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      planNotes: true,
      amountNeeded: true,
      amountSpent: true,
    },
  });

  return rows;
}

export async function loadRelatedTasksForContract(
  session: SessionAccount,
  budgetItemId: string,
): Promise<Array<{ id: string; title: string }>> {
  if (!session.canSeeTasks) return [];
  return prisma.task.findMany({
    where: { AND: [taskVisibilityWhere(session), { budgetItemId }] },
    orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    select: { id: true, title: true },
  });
}

export async function loadPersonNames(): Promise<Record<string, string>> {
  const people = await prisma.person.findMany({
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  return Object.fromEntries(people.map((person) => [person.id, person.name]));
}

export async function loadMoneyPageData(session: SessionAccount): Promise<MoneyPageData> {
  const canEdit = moneyEditable(session);
  const [contracts, minor, personNames] = await Promise.all([
    loadVisibleBudgetContracts(session),
    loadMinorExpenses(canEdit),
    loadPersonNames(),
  ]);
  const sortedContracts = sortContractsByUrgency(contracts);
  const summary = buildMoneySummary(sortedContracts);
  const dueItems = buildMoneyDueItems(sortedContracts);
  const overdueItems = buildMoneyDueItems(sortedContracts, { overdueOnly: true });
  const historyItems = buildMoneyHistoryItems(sortedContracts);

  return {
    contracts: sortedContracts,
    minor,
    summary,
    dueItems,
    overdueItems,
    historyItems,
    personNames,
    canEdit,
  };
}

export async function syncBudgetItemAmountPaid(budgetItemId: string) {
  if (!(await supportsBudgetPayments())) return;

  const payments = await prisma.budgetPayment.findMany({
    where: { budgetItemId },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  if (payments.length === 0) return;

  const amountPaid = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const nextDue =
    payments.find((payment) => payment.paidAmount + 0.001 < payment.amount)?.dueDate ?? null;

  await prisma.budgetItem.update({
    where: { id: budgetItemId },
    data: {
      amountPaid,
      payByDate: nextDue,
    },
  });
}
