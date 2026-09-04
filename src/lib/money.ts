import { addDays, startOfDay } from "date-fns";
import type { SessionAccount } from "@/lib/types";

export const MONEY_EPSILON = 0.001;
export const MONEY_DUE_SOON_DAYS = 14;
export const LEGACY_PAID_LABEL = "Paid so far";

export type BudgetPaymentSnapshot = {
  id: string;
  label: string | null;
  amount: number;
  dueDate: Date | null;
  paidAmount: number;
  paidAt: Date | null;
  paidById: string | null;
  note: string | null;
  sortOrder: number;
};

export type BudgetContractSnapshot = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  ownerId: string | null;
  paidById: string | null;
  payByDate: Date | null;
  note: string | null;
  sortOrder: number;
  payments: BudgetPaymentSnapshot[];
};

export type MoneySummary = {
  committed: number;
  paid: number;
  remaining: number;
  dueSoonCount: number;
  dueSoonAmount: number;
  overdueCount: number;
  overdueAmount: number;
};

export type FundingSourceStatus = "available" | "expected";

export type FundingSourceSnapshot = {
  id: string;
  label: string;
  amount: number;
  status: FundingSourceStatus;
  note: string | null;
  sortOrder: number;
};

export type MinorExpenseSnapshot = {
  id: string;
  title: string;
  summary: string | null;
  planNotes: string | null;
  amountNeeded: number | null;
  amountSpent: number;
};

export type MoneyLedgerSummary = {
  availableFunding: number;
  expectedFunding: number;
  projectedBudget: number;
  committedSpending: number;
  paidSpending: number;
  pendingSpending: number;
  projectedBalance: number;
  cashOnHand: number;
};

export type MoneyDueKind = "legacy" | "payment";

export type MoneyDueItem = {
  id: string;
  contractId: string;
  contractName: string;
  label: string;
  amount: number;
  dueDate: Date;
  overdue: boolean;
  kind: MoneyDueKind;
  ownerId: string | null;
  paidById: string | null;
};

export type MoneyHistoryItem = {
  id: string;
  contractId: string;
  contractName: string;
  label: string;
  amount: number;
  paidAt: Date | null;
  dueDate: Date | null;
};

export type BudgetShareRef = { pinAccountId: string };

export function formatMoney(amount: number, opts?: { maximumFractionDigits?: number }) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  });
}

export function clampNonNegativeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function hasExplicitSchedule(
  contract: { payments?: BudgetPaymentSnapshot[] },
): boolean {
  return (contract.payments?.length ?? 0) > 0;
}

export function paymentDisplayLabel(payment: Pick<BudgetPaymentSnapshot, "label">) {
  const label = payment.label?.trim();
  return label || "Payment";
}

export function paymentRemaining(payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount">) {
  return Math.max(0, payment.amount - payment.paidAmount);
}

export function paymentIsPaid(payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount">) {
  return paymentRemaining(payment) <= MONEY_EPSILON;
}

export function paymentIsOverdue(
  payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount" | "dueDate">,
  today = startOfDay(new Date()),
) {
  if (paymentIsPaid(payment) || !payment.dueDate) return false;
  return startOfDay(payment.dueDate) < today;
}

export function paymentIsDueSoon(
  payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount" | "dueDate">,
  today = startOfDay(new Date()),
  withinDays = MONEY_DUE_SOON_DAYS,
) {
  if (paymentIsPaid(payment) || !payment.dueDate) return false;
  const due = startOfDay(payment.dueDate);
  if (due < today) return false;
  return due <= addDays(today, withinDays);
}

export function sortPayments<T extends Pick<BudgetPaymentSnapshot, "dueDate" | "sortOrder">>(
  payments: T[],
): T[] {
  return [...payments].sort((a, b) => {
    const aDue = a.dueDate ? startOfDay(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? startOfDay(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.sortOrder - b.sortOrder;
  });
}

type ContractMoneyFields = Pick<BudgetContractSnapshot, "amountPaid"> & {
  payments?: BudgetPaymentSnapshot[];
};

export function contractPaidTotal(contract: ContractMoneyFields) {
  const payments = contract.payments ?? [];
  if (payments.length > 0) {
    return payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  }
  return contract.amountPaid;
}

export function contractRemaining(
  contract: Pick<BudgetContractSnapshot, "price" | "amountPaid"> & { payments?: BudgetPaymentSnapshot[] },
) {
  return Math.max(0, contract.price - contractPaidTotal(contract));
}

export function contractIsPaid(
  contract: Pick<BudgetContractSnapshot, "price" | "amountPaid"> & { payments?: BudgetPaymentSnapshot[] },
) {
  return contractRemaining(contract) <= MONEY_EPSILON;
}

export function scheduledPaymentTotal(contract: Pick<BudgetContractSnapshot, "payments">) {
  return contract.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function completedPayments(contract: Pick<BudgetContractSnapshot, "payments">) {
  return sortPayments(contract.payments.filter((payment) => paymentIsPaid(payment)));
}

export function openPayments(contract: Pick<BudgetContractSnapshot, "payments">) {
  return sortPayments(contract.payments.filter((payment) => !paymentIsPaid(payment)));
}

export function summariesFromPayments(
  price: number,
  payments: BudgetPaymentSnapshot[],
  today = startOfDay(new Date()),
) {
  const paid = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const remaining = Math.max(0, price - paid);
  const next = sortPayments(payments.filter((payment) => !paymentIsPaid(payment)))[0] ?? null;
  return {
    paid,
    remaining,
    nextDue: next?.dueDate ?? null,
    overdue: next ? paymentIsOverdue(next, today) : false,
    scheduledTotal: payments.reduce((sum, payment) => sum + payment.amount, 0),
  };
}

function legacyDueItem(
  contract: BudgetContractSnapshot,
  today: Date,
): MoneyDueItem | null {
  const remaining = contractRemaining(contract);
  if (remaining <= MONEY_EPSILON || !contract.payByDate) return null;
  return {
    id: `legacy:${contract.id}`,
    contractId: contract.id,
    contractName: contract.name,
    label: `${formatMoney(remaining)} remaining`,
    amount: remaining,
    dueDate: contract.payByDate,
    overdue: startOfDay(contract.payByDate) < today,
    kind: "legacy",
    ownerId: contract.ownerId,
    paidById: contract.paidById,
  };
}

function explicitDueItems(contract: BudgetContractSnapshot, today: Date): MoneyDueItem[] {
  return sortPayments(contract.payments)
    .filter((payment) => !paymentIsPaid(payment) && payment.dueDate)
    .map((payment) => ({
      id: `payment:${contract.id}:${payment.id}`,
      contractId: contract.id,
      contractName: contract.name,
      label: paymentDisplayLabel(payment),
      amount: paymentRemaining(payment),
      dueDate: payment.dueDate as Date,
      overdue: paymentIsOverdue(payment, today),
      kind: "payment" as const,
      ownerId: contract.ownerId,
      paidById: contract.paidById,
    }));
}

/** Never mixes legacy remaining with explicit installment rows. */
export function obligationsForContract(
  contract: BudgetContractSnapshot,
  today = startOfDay(new Date()),
): MoneyDueItem[] {
  if (hasExplicitSchedule(contract)) return explicitDueItems(contract, today);
  const legacy = legacyDueItem(contract, today);
  return legacy ? [legacy] : [];
}

export function nextUnpaidPayment(
  contract: BudgetContractSnapshot,
  today = startOfDay(new Date()),
): MoneyDueItem | null {
  const items = obligationsForContract(contract, today).sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.getTime() - b.dueDate.getTime(),
  );
  return items[0] ?? null;
}

export function buildMoneyDueItems(
  contracts: BudgetContractSnapshot[],
  opts?: { overdueOnly?: boolean; dueSoonOnly?: boolean; now?: Date },
): MoneyDueItem[] {
  const today = startOfDay(opts?.now ?? new Date());
  const items: MoneyDueItem[] = [];

  for (const contract of contracts) {
    for (const item of obligationsForContract(contract, today)) {
      const dueSoon = paymentIsDueSoon(
        { amount: item.amount, paidAmount: 0, dueDate: item.dueDate },
        today,
      );
      if (opts?.overdueOnly && !item.overdue) continue;
      if (opts?.dueSoonOnly && !(dueSoon || item.overdue)) continue;
      items.push(item);
    }
  }

  return items.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.dueDate.getTime() - b.dueDate.getTime() ||
      a.contractName.localeCompare(b.contractName),
  );
}

export function buildMoneyHistoryItems(
  contracts: BudgetContractSnapshot[],
): MoneyHistoryItem[] {
  const items: MoneyHistoryItem[] = [];
  for (const contract of contracts) {
    if (!hasExplicitSchedule(contract)) {
      if (contract.amountPaid > MONEY_EPSILON) {
        items.push({
          id: `legacy-paid:${contract.id}`,
          contractId: contract.id,
          contractName: contract.name,
          label: LEGACY_PAID_LABEL,
          amount: contract.amountPaid,
          paidAt: null,
          dueDate: null,
        });
      }
      continue;
    }
    for (const payment of completedPayments(contract)) {
      items.push({
        id: `payment:${contract.id}:${payment.id}`,
        contractId: contract.id,
        contractName: contract.name,
        label: paymentDisplayLabel(payment),
        amount: payment.paidAmount,
        paidAt: payment.paidAt,
        dueDate: payment.dueDate,
      });
    }
  }

  return items.sort((a, b) => {
    const aTime = (a.paidAt ?? a.dueDate)?.getTime() ?? 0;
    const bTime = (b.paidAt ?? b.dueDate)?.getTime() ?? 0;
    return bTime - aTime || a.contractName.localeCompare(b.contractName);
  });
}

export function buildMoneySummary(
  contracts: BudgetContractSnapshot[],
  opts?: { now?: Date },
): MoneySummary {
  const today = startOfDay(opts?.now ?? new Date());
  const committed = contracts.reduce((sum, contract) => sum + contract.price, 0);
  const paid = contracts.reduce((sum, contract) => sum + contractPaidTotal(contract), 0);
  const dueItems = buildMoneyDueItems(contracts, { now: today });

  let dueSoonCount = 0;
  let dueSoonAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const item of dueItems) {
    if (item.overdue) {
      overdueCount += 1;
      overdueAmount += item.amount;
    } else if (paymentIsDueSoon({ amount: item.amount, paidAmount: 0, dueDate: item.dueDate }, today)) {
      dueSoonCount += 1;
      dueSoonAmount += item.amount;
    }
  }

  return {
    committed,
    paid,
    remaining: Math.max(0, committed - paid),
    dueSoonCount,
    dueSoonAmount,
    overdueCount,
    overdueAmount,
  };
}

export function buildMoneyLedgerSummary(
  sources: FundingSourceSnapshot[],
  contracts: BudgetContractSnapshot[],
  minor: MinorExpenseSnapshot[] = [],
): MoneyLedgerSummary {
  const availableFunding = sources
    .filter((source) => source.status === "available")
    .reduce((sum, source) => sum + source.amount, 0);
  const expectedFunding = sources
    .filter((source) => source.status === "expected")
    .reduce((sum, source) => sum + source.amount, 0);
  const projectedBudget = availableFunding + expectedFunding;

  const contractCommitted = contracts.reduce((sum, contract) => sum + contract.price, 0);
  const contractPaid = contracts.reduce((sum, contract) => sum + contractPaidTotal(contract), 0);
  const minorCommitted = minor.reduce((sum, row) => sum + (row.amountNeeded ?? row.amountSpent), 0);
  const minorPaid = minor.reduce((sum, row) => sum + row.amountSpent, 0);

  const committedSpending = contractCommitted + minorCommitted;
  const paidSpending = contractPaid + minorPaid;
  const pendingSpending = Math.max(0, committedSpending - paidSpending);

  return {
    availableFunding,
    expectedFunding,
    projectedBudget,
    committedSpending,
    paidSpending,
    pendingSpending,
    projectedBalance: projectedBudget - committedSpending,
    cashOnHand: availableFunding - paidSpending,
  };
}

export function nextDueStateLabel(contract: BudgetContractSnapshot, today = startOfDay(new Date())) {
  if (contractIsPaid(contract)) return "Paid";
  const next = nextUnpaidPayment(contract, today);
  if (!next) {
    const remaining = contractRemaining(contract);
    return remaining > MONEY_EPSILON ? `${formatMoney(remaining)} remaining` : "Paid";
  }
  if (next.overdue) return `Overdue · ${shortDueDate(next.dueDate)}`;
  return `Next payment ${shortDueDate(next.dueDate)}`;
}

export function sortContractsByUrgency(contracts: BudgetContractSnapshot[], now = new Date()) {
  const today = startOfDay(now);
  return [...contracts].sort((a, b) => {
    const aPaid = contractIsPaid(a) ? 1 : 0;
    const bPaid = contractIsPaid(b) ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;

    const aNext = nextUnpaidPayment(a, today);
    const bNext = nextUnpaidPayment(b, today);
    if (aNext && bNext) {
      if (aNext.overdue !== bNext.overdue) return aNext.overdue ? -1 : 1;
      return aNext.dueDate.getTime() - bNext.dueDate.getTime();
    }
    if (aNext) return -1;
    if (bNext) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function dueDateLabel(date: Date, today = startOfDay(new Date())) {
  const due = startOfDay(date);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 14) return `Due in ${diff} days`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortDueDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function personMoneyLabel(id: string | null, names?: Record<string, string>) {
  if (id && names?.[id]) return names[id];
  if (id === "david") return "David";
  if (id === "haley") return "Haley";
  return id ? "Someone" : "Both";
}

export function canSeeBudgetItem(
  session: SessionAccount,
  item: { ownerId: string | null; shares: BudgetShareRef[] },
) {
  if (!session.canSeeBudget) return false;
  if (session.isMaster || session.canEditBudget) return true;
  if (session.linkedPersonId != null && item.ownerId === session.linkedPersonId) return true;
  return item.shares.some((share) => share.pinAccountId === session.id);
}

export function filterVisibleBudgetItems<T extends { ownerId: string | null; shares: BudgetShareRef[] }>(
  session: SessionAccount,
  items: T[],
): T[] {
  if (!session.canSeeBudget) return [];
  if (session.isMaster || session.canEditBudget) return items;
  return items.filter((item) => canSeeBudgetItem(session, item));
}

export function syncedLegacyFields(payments: BudgetPaymentSnapshot[]) {
  if (payments.length === 0) return null;
  const amountPaid = payments.reduce((sum, payment) => sum + clampNonNegativeMoney(payment.paidAmount), 0);
  const nextUnpaid = sortPayments(payments).find((payment) => !paymentIsPaid(payment));
  return {
    amountPaid,
    payByDate: nextUnpaid?.dueDate ?? null,
  };
}
