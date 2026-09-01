import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMoneyDueItems,
  buildMoneyLedgerSummary,
  buildMoneySummary,
  dueDateLabel,
  paymentIsOverdue,
  paymentRemaining,
  resolveContractPayments,
  sortContractsByUrgency,
  synthesizePaymentsFromLegacy,
} from "./money";

const today = new Date("2026-08-15T12:00:00");

function contract(
  overrides: Partial<{
    id: string;
    name: string;
    price: number;
    amountPaid: number;
    payByDate: Date | null;
    sortOrder: number;
    payments: ReturnType<typeof resolveContractPayments>;
  }> = {},
) {
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

test("synthesizePaymentsFromLegacy splits paid and balance rows", () => {
  const rows = synthesizePaymentsFromLegacy({
    id: "c1",
    price: 1000,
    amountPaid: 250,
    payByDate: new Date("2026-08-20T12:00:00"),
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.label, "Paid so far");
  assert.equal(rows[1]?.amount, 750);
});

test("buildMoneySummary totals committed, paid, and remaining", () => {
  const summary = buildMoneySummary(
    [
      contract({ price: 1000, amountPaid: 250 }),
      contract({ id: "c2", name: "Catering", price: 500, amountPaid: 500 }),
    ],
    { now: today },
  );
  assert.equal(summary.committed, 1500);
  assert.equal(summary.paid, 750);
  assert.equal(summary.remaining, 750);
});

test("buildMoneyDueItems flags overdue and due-soon installments", () => {
  const items = buildMoneyDueItems(
    [
      contract({
        payments: [
          {
            id: "p1",
            label: "Deposit",
            amount: 250,
            paidAmount: 250,
            dueDate: new Date("2026-07-01T12:00:00"),
            paidAt: null,
            paidById: null,
            note: null,
            sortOrder: 0,
          },
          {
            id: "p2",
            label: "Final",
            amount: 750,
            paidAmount: 0,
            dueDate: new Date("2026-08-10T12:00:00"),
            paidAt: null,
            paidById: null,
            note: null,
            sortOrder: 1,
          },
          {
            id: "p3",
            label: "Other",
            amount: 100,
            paidAmount: 0,
            dueDate: new Date("2026-08-25T12:00:00"),
            paidAt: null,
            paidById: null,
            note: null,
            sortOrder: 2,
          },
        ],
      }),
    ],
    { now: today },
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]?.overdue, true);
  assert.equal(items[0]?.amount, 750);
  assert.equal(items[1]?.amount, 100);
});

test("sortContractsByUrgency puts overdue unpaid contracts first", () => {
  const sorted = sortContractsByUrgency(
    [
      contract({ id: "paid", name: "Paid vendor", price: 100, amountPaid: 100, payByDate: null }),
      contract({
        id: "soon",
        name: "Soon vendor",
        price: 100,
        amountPaid: 0,
        payByDate: new Date("2026-08-25T12:00:00"),
      }),
      contract({
        id: "late",
        name: "Late vendor",
        price: 100,
        amountPaid: 0,
        payByDate: new Date("2026-08-01T12:00:00"),
      }),
    ],
    today,
  );
  assert.equal(sorted[0]?.id, "late");
});

test("buildMoneyLedgerSummary separates funding and spending", () => {
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
  assert.equal(ledger.projectedBudget, 10000);
  assert.equal(ledger.committedSpending, 9000);
  assert.equal(ledger.paidSpending, 3500);
  assert.equal(ledger.pendingSpending, 5500);
  assert.equal(ledger.projectedBalance, 1000);
  assert.equal(ledger.cashOnHand, 1500);
});

test("paymentRemaining and dueDateLabel helpers", () => {
  assert.equal(paymentRemaining({ amount: 100, paidAmount: 40 }), 60);
  assert.equal(
    paymentIsOverdue(
      { amount: 100, paidAmount: 0, dueDate: new Date("2026-08-01T12:00:00") },
      today,
    ),
    true,
  );
  assert.equal(dueDateLabel(new Date("2026-08-15T12:00:00"), today), "Due today");
});
