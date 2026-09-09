import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMissingBudgetFundingSourceTable,
  isMissingBudgetPaymentTable,
  isMissingPlaybookItemTable,
} from "./db";

test("isMissingBudgetPaymentTable detects Prisma missing-table errors", () => {
  assert.equal(isMissingBudgetPaymentTable({ code: "P2021", message: "table does not exist" }), true);
  assert.equal(
    isMissingBudgetPaymentTable(new Error('The table `public.BudgetPayment` does not exist')),
    true,
  );
  assert.equal(isMissingBudgetPaymentTable({ code: "P2002", message: "unique constraint" }), false);
});

test("isMissingBudgetFundingSourceTable detects Prisma missing-table errors", () => {
  assert.equal(
    isMissingBudgetFundingSourceTable(new Error('The table `public.BudgetFundingSource` does not exist')),
    true,
  );
});

test("isMissingPlaybookItemTable detects Prisma missing-table errors", () => {
  assert.equal(isMissingPlaybookItemTable({ code: "P2021", message: "table does not exist" }), true);
  assert.equal(
    isMissingPlaybookItemTable(new Error("The table `public.PlaybookItem` does not exist")),
    true,
  );
  assert.equal(isMissingPlaybookItemTable({ code: "P2002", message: "unique constraint" }), false);
});
