import { prisma, supportsBudgetPayments } from "@/lib/db";
import { moneyEditable } from "@/lib/access";
import type { SessionAccount } from "@/lib/types";
import {
  buildMoneyDueItems,
  buildMoneySummary,
  sortContractsByUrgency,
  type BudgetContractSnapshot,
  type MoneyDueItem,
  type MoneySummary,
} from "@/lib/money";

export type MoneyPageData = {
  contracts: BudgetContractSnapshot[];
  summary: MoneySummary;
  dueItems: MoneyDueItem[];
  overdueItems: MoneyDueItem[];
};

export async function loadVisibleBudgetContracts(
  session: SessionAccount,
): Promise<BudgetContractSnapshot[]> {
  if (!session.canSeeBudget) return [];

  const includePayments = await supportsBudgetPayments();

  const allItems = await prisma.budgetItem.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      shares: { select: { pinAccountId: true } },
      ...(includePayments
        ? { payments: { orderBy: { sortOrder: "asc" } } }
        : {}),
    },
  });

  const visible =
    session.isMaster || moneyEditable(session)
      ? allItems
      : allItems.filter(
          (item) =>
            (session.linkedPersonId != null && item.ownerId === session.linkedPersonId) ||
            item.shares.some((share) => share.pinAccountId === session.id),
        );

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
    payments: includePayments
      ? item.payments.map((payment) => ({
          id: payment.id,
          label: payment.label,
          amount: payment.amount,
          dueDate: payment.dueDate,
          paidAmount: payment.paidAmount,
          paidAt: payment.paidAt,
          paidById: payment.paidById,
          note: payment.note,
          sortOrder: payment.sortOrder,
        }))
      : [],
  }));
}

export async function loadMoneyPageData(session: SessionAccount): Promise<MoneyPageData> {
  const contracts = sortContractsByUrgency(await loadVisibleBudgetContracts(session));
  const summary = buildMoneySummary(contracts);
  const dueItems = buildMoneyDueItems(contracts).slice(0, 6);
  const overdueItems = buildMoneyDueItems(contracts, { overdueOnly: true });

  return { contracts, summary, dueItems, overdueItems };
}

export async function syncBudgetItemAmountPaid(budgetItemId: string) {
  if (!(await supportsBudgetPayments())) return;

  const payments = await prisma.budgetPayment.findMany({
    where: { budgetItemId },
    orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
  });
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
