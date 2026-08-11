"use client";

import Link from "next/link";

export type MoneyPrintBudgetRow = {
  id: string;
  name: string;
  ownerId: string | null;
  paidById: string | null;
  price: number;
  amountPaid: number;
  payByDate: string | null;
  note: string | null;
  sortOrder: number;
};

export type MoneyPrintMinorRow = {
  id: string;
  title: string;
  amountNeeded: number | null;
  amountSpent: number;
  planNotes: string | null;
};

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function responsibleLabel(id: string | null) {
  if (id === "david") return "David";
  if (id === "haley") return "Haley";
  return "Both";
}

function paidByLabel(id: string | null) {
  if (id === "david") return "David";
  if (id === "haley") return "Haley";
  return "—";
}

function groupKey(ownerId: string | null): "david" | "haley" | "both" {
  if (ownerId === "david") return "david";
  if (ownerId === "haley") return "haley";
  return "both";
}

const GROUPS: { key: "david" | "haley" | "both"; title: string }[] = [
  { key: "david", title: "David" },
  { key: "haley", title: "Haley" },
  { key: "both", title: "Both" },
];

export function MoneyPrintView({
  items,
  minor,
}: {
  items: MoneyPrintBudgetRow[];
  minor: MoneyPrintMinorRow[];
}) {
  const grouped = GROUPS.map((group) => ({
    ...group,
    rows: items
      .filter((item) => groupKey(item.ownerId) === group.key)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((group) => group.rows.length > 0);

  const minorRows = minor.filter(
    (m) => !((m.amountNeeded ?? 0) === 0 && m.amountSpent === 0),
  );

  return (
    <div className="money-print flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight">Money</h1>
          <p className="mt-1 text-sm text-muted">Budget + minor expenses</p>
        </div>
        <div className="print-hide flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Print
          </button>
          <Link href="/money" className="btn-secondary">
            Back
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted">No budget lines yet.</p>
      ) : (
        grouped.map((group) => (
          <section key={group.key} className="print-section">
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">{group.title}</h2>
            <div className="overflow-x-auto">
              <table className="money-print-table w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-muted">
                    <th className="py-2 pr-2 font-semibold">Item</th>
                    <th className="py-2 pr-2 font-semibold">Responsible</th>
                    <th className="py-2 pr-2 font-semibold">Paid by</th>
                    <th className="py-2 pr-2 font-semibold">Total</th>
                    <th className="py-2 pr-2 font-semibold">Paid</th>
                    <th className="py-2 pr-2 font-semibold">Left</th>
                    <th className="py-2 pr-2 font-semibold">Due</th>
                    <th className="py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const left = Math.max(0, row.price - row.amountPaid);
                    return (
                      <tr key={row.id} className="border-b border-line align-top">
                        <td className="py-2 pr-2 font-medium">{row.name}</td>
                        <td className="py-2 pr-2">{responsibleLabel(row.ownerId)}</td>
                        <td className="py-2 pr-2">{paidByLabel(row.paidById)}</td>
                        <td className="py-2 pr-2">${money(row.price)}</td>
                        <td className="py-2 pr-2">${money(row.amountPaid)}</td>
                        <td className="py-2 pr-2">${money(left)}</td>
                        <td className="py-2 pr-2">{row.payByDate || "—"}</td>
                        <td className="py-2 text-muted">{row.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <section className="print-section">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Minor expenses</h2>
        {minorRows.length === 0 ? (
          <p className="text-sm text-muted">No minor expenses.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="money-print-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-muted">
                  <th className="py-2 pr-2 font-semibold">Item</th>
                  <th className="py-2 pr-2 font-semibold">Needed</th>
                  <th className="py-2 pr-2 font-semibold">Spent</th>
                  <th className="py-2 pr-2 font-semibold">Left</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {minorRows.map((row) => {
                  const needed = row.amountNeeded ?? row.amountSpent;
                  const left = Math.max(0, needed - row.amountSpent);
                  return (
                    <tr key={row.id} className="border-b border-line align-top">
                      <td className="py-2 pr-2 font-medium">{row.title}</td>
                      <td className="py-2 pr-2">
                        {row.amountNeeded == null ? "—" : `$${money(row.amountNeeded)}`}
                      </td>
                      <td className="py-2 pr-2">${money(row.amountSpent)}</td>
                      <td className="py-2 pr-2">${money(left)}</td>
                      <td className="py-2 text-muted">{row.planNotes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
