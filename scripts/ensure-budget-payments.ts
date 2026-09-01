import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensurePaymentsForItem(item: {
  id: string;
  price: number;
  amountPaid: number;
  payByDate: Date | null;
}) {
  const existing = await prisma.budgetPayment.count({ where: { budgetItemId: item.id } });
  if (existing > 0) return 0;

  const remaining = Math.max(0, item.price - item.amountPaid);
  const rows: Array<{
    label: string;
    amount: number;
    paidAmount: number;
    dueDate: Date | null;
    paidAt: Date | null;
    sortOrder: number;
  }> = [];

  if (item.amountPaid > 0.001) {
    rows.push({
      label: "Paid so far",
      amount: item.amountPaid,
      paidAmount: item.amountPaid,
      dueDate: null,
      paidAt: new Date(),
      sortOrder: 0,
    });
  }

  if (remaining > 0.001) {
    rows.push({
      label: item.amountPaid > 0.001 ? "Balance" : "Payment",
      amount: remaining,
      paidAmount: 0,
      dueDate: item.payByDate,
      paidAt: null,
      sortOrder: rows.length,
    });
  } else if (item.price > 0.001 && item.amountPaid <= 0.001) {
    rows.push({
      label: "Payment",
      amount: item.price,
      paidAmount: 0,
      dueDate: item.payByDate,
      paidAt: null,
      sortOrder: 0,
    });
  }

  if (rows.length === 0) return 0;

  for (const row of rows) {
    await prisma.budgetPayment.create({
      data: {
        budgetItemId: item.id,
        label: row.label,
        amount: row.amount,
        paidAmount: row.paidAmount,
        dueDate: row.dueDate,
        paidAt: row.paidAt,
        sortOrder: row.sortOrder,
      },
    });
  }

  return rows.length;
}

async function main() {
  const items = await prisma.budgetItem.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, price: true, amountPaid: true, payByDate: true },
  });

  let created = 0;
  for (const item of items) {
    created += await ensurePaymentsForItem(item);
  }

  const total = await prisma.budgetPayment.count();
  console.log(`Ensured ${created} payment rows across ${items.length} budget items. Total payments: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
