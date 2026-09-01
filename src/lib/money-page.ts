import { prisma, supportsBudgetFundingSources, supportsBudgetPayments } from "@/lib/db";
import { moneyEditable } from "@/lib/access";
import type { SessionAccount } from "@/lib/types";
import {
  buildMoneyDueItems,
  buildMoneyLedgerSummary,
  buildMoneySummary,
  sortContractsByUrgency,
  type BudgetContractSnapshot,
  type FundingSourceSnapshot,
  type MinorExpenseSnapshot,
  type MoneyDueItem,
  type MoneyLedgerSummary,
  type MoneySummary,
} from "@/lib/money";

export type MoneyPageData = {
  contracts: BudgetContractSnapshot[];
  minor: MinorExpenseSnapshot[];
  fundingSources: FundingSourceSnapshot[];
  summary: MoneySummary;
  ledger: MoneyLedgerSummary;
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

export async function loadFundingSources(): Promise<FundingSourceSnapshot[]> {
  if (!(await supportsBudgetFundingSources())) return [];

  const rows = await prisma.budgetFundingSource.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    amount: row.amount,
    status: row.status === "expected" ? "expected" : "available",
    note: row.note,
    sortOrder: row.sortOrder,
  }));
}

export async function loadMoneyPageData(session: SessionAccount): Promise<MoneyPageData> {
  const canEdit = moneyEditable(session);
  const [contracts, minor, fundingSources] = await Promise.all([
    loadVisibleBudgetContracts(session),
    loadMinorExpenses(canEdit),
    loadFundingSources(),
  ]);
  const sortedContracts = sortContractsByUrgency(contracts);
  const summary = buildMoneySummary(sortedContracts, { minor });
  const ledger = buildMoneyLedgerSummary(fundingSources, sortedContracts, minor);
  const dueItems = buildMoneyDueItems(sortedContracts).slice(0, 6);
  const overdueItems = buildMoneyDueItems(sortedContracts, { overdueOnly: true });

  return {
    contracts: sortedContracts,
    minor,
    fundingSources,
    summary,
    ledger,
    dueItems,
    overdueItems,
  };
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
