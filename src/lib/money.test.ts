import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionAccount } from "./types";
import {
  LEGACY_PAID_LABEL,
  buildMoneyDueItems,
  buildMoneyHistoryItems,
  buildMoneyLedgerSummary,
  buildMoneySummary,
  canSeeBudgetItem,
  clampNonNegativeMoney,
  completedPayments,
  contractPaidTotal,
  contractRemaining,
  dueDateLabel,
  filterVisibleBudgetItems,
  hasExplicitSchedule,
  nextUnpaidPayment,
  obligationsForContract,
  paymentIsOverdue,
  paymentRemaining,
  sortPayments,
  summariesFromPayments,
  syncedLegacyFields,
  type BudgetContractSnapshot,
  type BudgetPaymentSnapshot,
} from "./money";

const today = new Date("2026-08-15T12:00:00");

function payment(
  overrides: Partial<BudgetPaymentSnapshot> & Pick<BudgetPaymentSnapshot, "id">,
): BudgetPaymentSnapshot {
  return {
    label: "Payment",
    amount: 0,
    dueDate: null,
    paidAmount: 0,
    paidAt: null,
    paidById: null,
    note: null,
    sortOrder: 0,
    ...overrides,
  };
}

function contract(
  overrides: Partial<BudgetContractSnapshot> = {},
): BudgetContractSnapshot {
  return {
    id: "c1",
    name: "Photographer",
    price: 1000,
    amountPaid: 250,
    ownerId: "david",
    paidById: "david",
    payByDate: new Date("2026-08-20T12:00:00"),
    note: null,
    sortOrder: 0,
    payments: [],
    ...overrides,
  };
}

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "restricted",
    name: "Helper",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: true,
    canSeeGuests: false,
    canSeeTimeline: false,
    canManageAccounts: false,
    canSeeShop: true,
    canSeeCalendar: true,
    canSeePeople: true,
    canSeeRequests: true,
    canSeeStay: true,
    canSeeDinner: false,
    canEditBudget: false,
    canEditTimeline: false,
    canEditDinner: false,
    canEditRehearsal: false,
    linkedPersonId: "david",
    assigneeFilter: null,
    ...overrides,
  };
}

test("legacy BudgetItem with no payments preserves paid and remaining", () => {
  const item = contract({ price: 5000, amountPaid: 2000, payments: [] });
  assert.equal(hasExplicitSchedule(item), false);
  assert.equal(contractPaidTotal(item), 2000);
  assert.equal(contractRemaining(item), 3000);
});

test("legacy payByDate remains next-due when no explicit schedule exists", () => {
  const item = contract({
    price: 5000,
    amountPaid: 2000,
    payByDate: new Date("2026-10-01T12:00:00"),
    payments: [],
  });
  const next = nextUnpaidPayment(item, today);
  assert.equal(next?.kind, "legacy");
  assert.equal(next?.amount, 3000);
  assert.equal(next?.dueDate.toISOString().slice(0, 10), "2026-10-01");
  assert.match(next?.label ?? "", /remaining/);
  assert.equal(
    obligationsForContract(item, today).some((row) => /deposit|final/i.test(row.label)),
    false,
  );
});

test("missing payment schedule does not fabricate installments", () => {
  const item = contract({ price: 5000, amountPaid: 2000, payments: [] });
  const due = buildMoneyDueItems([item], { now: today });
  assert.equal(due.length, 1);
  assert.equal(due[0]?.kind, "legacy");
  assert.equal(due[0]?.id, "legacy:c1");
  assert.equal(item.payments.length, 0);
});

test("explicit payment schedule aggregates correctly", () => {
  const item = contract({
    amountPaid: 250,
    payments: [
      payment({ id: "p1", label: "Deposit", amount: 250, paidAmount: 250, sortOrder: 0 }),
      payment({
        id: "p2",
        label: "Second payment",
        amount: 400,
        paidAmount: 0,
        dueDate: new Date("2026-09-01T12:00:00"),
        sortOrder: 1,
      }),
      payment({
        id: "p3",
        label: "Final payment",
        amount: 350,
        paidAmount: 0,
        dueDate: new Date("2026-10-01T12:00:00"),
        sortOrder: 2,
      }),
    ],
  });
  const summary = summariesFromPayments(item.price, item.payments, today);
  assert.equal(summary.paid, 250);
  assert.equal(summary.remaining, 750);
  assert.equal(contractPaidTotal(item), 250);
  assert.equal(contractRemaining(item), 750);
});

test("multiple installments sort chronologically", () => {
  const rows = sortPayments([
    payment({
      id: "late",
      label: "Final payment",
      amount: 300,
      dueDate: new Date("2026-10-01T12:00:00"),
      sortOrder: 0,
    }),
    payment({
      id: "early",
      label: "Deposit",
      amount: 200,
      dueDate: new Date("2026-07-01T12:00:00"),
      sortOrder: 1,
    }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["early", "late"],
  );
});

test("paid installments are excluded from Coming Due", () => {
  const items = buildMoneyDueItems(
    [
      contract({
        payments: [
          payment({
            id: "p1",
            label: "Deposit",
            amount: 250,
            paidAmount: 250,
            dueDate: new Date("2026-07-01T12:00:00"),
          }),
          payment({
            id: "p2",
            label: "Final payment",
            amount: 750,
            paidAmount: 0,
            dueDate: new Date("2026-08-25T12:00:00"),
            sortOrder: 1,
          }),
        ],
      }),
    ],
    { now: today },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.label, "Final payment");
  assert.equal(items[0]?.amount, 750);
});

test("overdue unpaid installment is identified", () => {
  const item = contract({
    payments: [
      payment({
        id: "p2",
        label: "Final payment",
        amount: 750,
        paidAmount: 0,
        dueDate: new Date("2026-08-10T12:00:00"),
      }),
    ],
  });
  const next = nextUnpaidPayment(item, today);
  assert.equal(next?.overdue, true);
  assert.equal(paymentIsOverdue(item.payments[0]!, today), true);
});

test("next unpaid installment is identified", () => {
  const item = contract({
    payments: [
      payment({
        id: "p1",
        label: "Deposit",
        amount: 250,
        paidAmount: 250,
        dueDate: new Date("2026-07-01T12:00:00"),
      }),
      payment({
        id: "p2",
        label: "Second payment",
        amount: 400,
        paidAmount: 0,
        dueDate: new Date("2026-09-01T12:00:00"),
        sortOrder: 1,
      }),
      payment({
        id: "p3",
        label: "Final payment",
        amount: 350,
        paidAmount: 0,
        dueDate: new Date("2026-10-01T12:00:00"),
        sortOrder: 2,
      }),
    ],
  });
  assert.equal(nextUnpaidPayment(item, today)?.label, "Second payment");
});

test("legacy and explicit obligations are never double counted", () => {
  const scheduled = contract({
    amountPaid: 250,
    payByDate: new Date("2026-08-20T12:00:00"),
    payments: [
      payment({
        id: "p2",
        label: "Final payment",
        amount: 750,
        paidAmount: 0,
        dueDate: new Date("2026-08-20T12:00:00"),
      }),
    ],
  });
  const due = buildMoneyDueItems([scheduled], { now: today });
  assert.equal(due.length, 1);
  assert.equal(due[0]?.kind, "payment");
  assert.equal(due[0]?.id.startsWith("legacy:"), false);
});

test("editing a payment recomputes paid and remaining", () => {
  const payments = [
    payment({ id: "p1", label: "Deposit", amount: 250, paidAmount: 250 }),
    payment({
      id: "p2",
      label: "Final payment",
      amount: 750,
      paidAmount: 0,
      dueDate: new Date("2026-09-01T12:00:00"),
      sortOrder: 1,
    }),
  ];
  const before = summariesFromPayments(1000, payments, today);
  const afterEdit = summariesFromPayments(
    1000,
    payments.map((row) => (row.id === "p2" ? { ...row, paidAmount: 750 } : row)),
    today,
  );
  assert.equal(before.paid, 250);
  assert.equal(before.remaining, 750);
  assert.equal(afterEdit.paid, 1000);
  assert.equal(afterEdit.remaining, 0);
});

test("deleting a payment does not alter contract price", () => {
  const price = 4500;
  const payments = [
    payment({ id: "p1", label: "Deposit", amount: 2250, paidAmount: 2250 }),
    payment({
      id: "p2",
      label: "Final payment",
      amount: 2250,
      paidAmount: 0,
      dueDate: new Date("2026-09-18T12:00:00"),
      sortOrder: 1,
    }),
  ];
  const afterDelete = summariesFromPayments(
    price,
    payments.filter((row) => row.id !== "p2"),
    today,
  );
  assert.equal(price, 4500);
  assert.equal(afterDelete.paid, 2250);
  assert.equal(afterDelete.remaining, 2250);
});

test("synced legacy fields follow the payment schedule", () => {
  const sync = syncedLegacyFields([
    payment({ id: "p1", amount: 200, paidAmount: 200 }),
    payment({
      id: "p2",
      amount: 800,
      paidAmount: 0,
      dueDate: new Date("2026-09-18T12:00:00"),
      sortOrder: 1,
    }),
  ]);
  assert.equal(sync?.amountPaid, 200);
  assert.equal(sync?.payByDate?.toISOString().slice(0, 10), "2026-09-18");
  assert.equal(syncedLegacyFields([]), null);
});

test("paid cannot become negative and remaining stays coherent", () => {
  assert.equal(clampNonNegativeMoney(-40), 0);
  assert.equal(paymentRemaining({ amount: 100, paidAmount: 40 }), 60);
  assert.equal(contractRemaining({ price: 100, amountPaid: 140 }), 0);
});

test("overpayment on an explicit schedule is represented without inventing rows", () => {
  const item = contract({
    price: 1000,
    amountPaid: 1200,
    payments: [payment({ id: "p1", label: "Balance", amount: 1000, paidAmount: 1200 })],
  });
  assert.equal(contractPaidTotal(item), 1200);
  assert.equal(contractRemaining(item), 0);
  assert.equal(buildMoneyDueItems([item], { now: today }).length, 0);
});

test("restricted account sees only allowed BudgetItems and their payments", () => {
  const visible = filterVisibleBudgetItems(session(), [
    { id: "owned", ownerId: "david", shares: [] },
    { id: "shared", ownerId: "haley", shares: [{ pinAccountId: "restricted" }] },
    { id: "hidden", ownerId: "haley", shares: [] },
  ]);
  assert.deepEqual(
    visible.map((item) => item.id),
    ["owned", "shared"],
  );
  assert.equal(
    canSeeBudgetItem(session(), { ownerId: "haley", shares: [] }),
    false,
  );
});

test("BudgetPayment cannot leak through a hidden BudgetItem", () => {
  const hidden = contract({
    id: "hidden",
    ownerId: "haley",
    payments: [
      payment({
        id: "secret",
        label: "Deposit",
        amount: 500,
        paidAmount: 0,
        dueDate: new Date("2026-08-20T12:00:00"),
      }),
    ],
  });
  const allowed = filterVisibleBudgetItems(session(), [
    { ...hidden, shares: [] },
  ]);
  assert.equal(allowed.length, 0);
  const due = buildMoneyDueItems(allowed, { now: today });
  assert.equal(due.length, 0);
});

test("account without budget permission sees nothing", () => {
  const items = filterVisibleBudgetItems(session({ canSeeBudget: false }), [
    { id: "owned", ownerId: "david", shares: [] },
  ]);
  assert.equal(items.length, 0);
});

test("completed payments appear in history and not in coming due", () => {
  const item = contract({
    payments: [
      payment({
        id: "p1",
        label: "Deposit",
        amount: 250,
        paidAmount: 250,
        paidAt: new Date("2026-07-02T12:00:00"),
      }),
      payment({
        id: "p2",
        label: "Final payment",
        amount: 750,
        paidAmount: 0,
        dueDate: new Date("2026-08-25T12:00:00"),
        sortOrder: 1,
      }),
    ],
  });
  assert.equal(completedPayments(item).map((row) => row.id).join(), "p1");
  const history = buildMoneyHistoryItems([item]);
  assert.equal(history[0]?.label, "Deposit");
  assert.equal(buildMoneyDueItems([item], { now: today })[0]?.label, "Final payment");
});

test("legacy history uses paid-to-date instead of invented deposits", () => {
  const history = buildMoneyHistoryItems([contract({ amountPaid: 2000, payments: [] })]);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.label, LEGACY_PAID_LABEL);
  assert.equal(history[0]?.amount, 2000);
});

test("buildMoneySummary totals committed, paid, and remaining from contracts only", () => {
  const summary = buildMoneySummary(
    [
      contract({ price: 1000, amountPaid: 250 }),
      contract({ id: "c2", name: "Catering", price: 500, amountPaid: 500, payByDate: null }),
    ],
    { now: today },
  );
  assert.equal(summary.committed, 1500);
  assert.equal(summary.paid, 750);
  assert.equal(summary.remaining, 750);
});

test("buildMoneyLedgerSummary still separates funding and spending", () => {
  const ledger = buildMoneyLedgerSummary(
    [
      { id: "1", label: "Savings", amount: 5000, status: "available", note: null, sortOrder: 0 },
      { id: "2", label: "Gift", amount: 5000, status: "expected", note: null, sortOrder: 1 },
    ],
    [contract({ price: 8000, amountPaid: 3000 })],
    [{ id: "m1", title: "Flowers", summary: null, planNotes: null, amountNeeded: 1000, amountSpent: 500 }],
  );

  assert.equal(ledger.availableFunding, 5000);
  assert.equal(ledger.expectedFunding, 5000);
  assert.equal(ledger.committedSpending, 9000);
  assert.equal(ledger.paidSpending, 3500);
});

test("paymentRemaining and dueDateLabel helpers", () => {
  assert.equal(paymentRemaining({ amount: 100, paidAmount: 40 }), 60);
  assert.equal(dueDateLabel(new Date("2026-08-15T12:00:00"), today), "Due today");
});
