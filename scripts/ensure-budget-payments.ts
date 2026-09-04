/**
 * Automatic installment backfill is forbidden.
 * Existing BudgetItem.amountPaid / payByDate remain the truthful summary
 * until a person explicitly creates BudgetPayment rows in the app.
 */
console.error("Refusing automatic BudgetPayment backfill.");
console.error("This would invent installment history that the database cannot prove.");
console.error("Use the Money UI to add Deposit / installment / final payment rows intentionally.");
process.exit(1);
