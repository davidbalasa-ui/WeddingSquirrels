import { addDays, startOfDay } from "date-fns";

export type BudgetPaymentSnapshot = {
  id: string;
  label: string;
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

export type MoneyDueItem = {
  id: string;
  contractId: string;
  contractName: string;
  label: string;
  amount: number;
  dueDate: Date;
  overdue: boolean;
  ownerId: string | null;
  paidById: string | null;
};

const EPSILON = 0.001;
const DUE_SOON_DAYS = 14;

export function formatMoney(amount: number, opts?: { maximumFractionDigits?: number }) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  });
}

export function paymentRemaining(payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount">) {
  return Math.max(0, payment.amount - payment.paidAmount);
}

export function paymentIsPaid(payment: Pick<BudgetPaymentSnapshot, "amount" | "paidAmount">) {
  return paymentRemaining(payment) <= EPSILON;
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
  withinDays = DUE_SOON_DAYS,
) {
  if (paymentIsPaid(payment) || !payment.dueDate) return false;
  const due = startOfDay(payment.dueDate);
  if (due < today) return false;
  return due <= addDays(today, withinDays);
}

export function synthesizePaymentsFromLegacy(
  item: Pick<BudgetContractSnapshot, "id" | "price" | "amountPaid" | "payByDate">,
): BudgetPaymentSnapshot[] {
  const remaining = Math.max(0, item.price - item.amountPaid);
  const rows: BudgetPaymentSnapshot[] = [];

  if (item.amountPaid > EPSILON) {
    rows.push({
      id: `${item.id}:paid`,
      label: "Paid so far",
      amount: item.amountPaid,
      dueDate: null,
      paidAmount: item.amountPaid,
      paidAt: null,
      paidById: null,
      note: null,
      sortOrder: 0,
    });
  }

  if (remaining > EPSILON) {
    rows.push({
      id: `${item.id}:balance`,
      label: item.amountPaid > EPSILON ? "Balance" : "Payment",
      amount: remaining,
      dueDate: item.payByDate,
      paidAmount: 0,
      paidAt: null,
      paidById: null,
      note: null,
      sortOrder: rows.length,
    });
  } else if (item.price > EPSILON && item.amountPaid <= EPSILON) {
    rows.push({
      id: `${item.id}:payment`,
      label: "Payment",
      amount: item.price,
      dueDate: item.payByDate,
      paidAmount: 0,
      paidAt: null,
      paidById: null,
      note: null,
      sortOrder: 0,
    });
  }

  return rows;
}

export function resolveContractPayments(contract: BudgetContractSnapshot): BudgetPaymentSnapshot[] {
  if (contract.payments.length > 0) {
    return [...contract.payments].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return synthesizePaymentsFromLegacy(contract);
}

export function contractRemaining(contract: Pick<BudgetContractSnapshot, "price" | "amountPaid">) {
  return Math.max(0, contract.price - contract.amountPaid);
}

export function contractIsPaid(contract: Pick<BudgetContractSnapshot, "price" | "amountPaid">) {
  return contractRemaining(contract) <= EPSILON;
}

export function nextUnpaidPayment(
  contract: BudgetContractSnapshot,
  today = startOfDay(new Date()),
): MoneyDueItem | null {
  const payments = resolveContractPayments(contract);
  const unpaid = payments
    .filter((payment) => !paymentIsPaid(payment))
    .sort((a, b) => {
      const aDue = a.dueDate ? startOfDay(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? startOfDay(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue || a.sortOrder - b.sortOrder;
    });

  const next = unpaid[0];
  if (!next) return null;

  return {
    id: `${contract.id}:${next.id}`,
    contractId: contract.id,
    contractName: contract.name,
    label: next.label,
    amount: paymentRemaining(next),
    dueDate: next.dueDate ?? today,
    overdue: paymentIsOverdue(next, today),
    ownerId: contract.ownerId,
    paidById: contract.paidById,
  };
}

export function buildMoneyDueItems(
  contracts: BudgetContractSnapshot[],
  opts?: { overdueOnly?: boolean; dueSoonOnly?: boolean; now?: Date },
): MoneyDueItem[] {
  const today = startOfDay(opts?.now ?? new Date());
  const items: MoneyDueItem[] = [];

  for (const contract of contracts) {
    for (const payment of resolveContractPayments(contract)) {
      if (paymentIsPaid(payment) || !payment.dueDate) continue;
      const overdue = paymentIsOverdue(payment, today);
      const dueSoon = paymentIsDueSoon(payment, today);
      if (opts?.overdueOnly && !overdue) continue;
      if (opts?.dueSoonOnly && !(dueSoon || overdue)) continue;

      items.push({
        id: `${contract.id}:${payment.id}`,
        contractId: contract.id,
        contractName: contract.name,
        label: payment.label,
        amount: paymentRemaining(payment),
        dueDate: payment.dueDate,
        overdue,
        ownerId: contract.ownerId,
        paidById: contract.paidById,
      });
    }
  }

  return items.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.dueDate.getTime() - b.dueDate.getTime() ||
      a.contractName.localeCompare(b.contractName),
  );
}

export function buildMoneySummary(
  contracts: BudgetContractSnapshot[],
  opts?: { now?: Date },
): MoneySummary {
  const today = startOfDay(opts?.now ?? new Date());
  const committed = contracts.reduce((sum, contract) => sum + contract.price, 0);
  const paid = contracts.reduce((sum, contract) => sum + contract.amountPaid, 0);
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

export function sortContractsByUrgency(contracts: BudgetContractSnapshot[], now = new Date()) {
  return [...contracts].sort((a, b) => {
    const aPaid = contractIsPaid(a) ? 1 : 0;
    const bPaid = contractIsPaid(b) ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;

    const aNext = nextUnpaidPayment(a, startOfDay(now));
    const bNext = nextUnpaidPayment(b, startOfDay(now));
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

export function personMoneyLabel(id: string | null) {
  if (id === "david") return "David";
  if (id === "haley") return "Haley";
  return "Both";
}
