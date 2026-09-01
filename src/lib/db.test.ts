import assert from "node:assert/strict";
import { test } from "node:test";
import { isMissingBudgetPaymentTable } from "./db";

test("isMissingBudgetPaymentTable detects Prisma missing-table errors", () => {
  assert.equal(isMissingBudgetPaymentTable({ code: "P2021", message: "table does not exist" }), true);
  assert.equal(
    isMissingBudgetPaymentTable(new Error('The table `public.BudgetPayment` does not exist')),
    true,
  );
  assert.equal(isMissingBudgetPaymentTable({ code: "P2002", message: "unique constraint" }), false);
});
