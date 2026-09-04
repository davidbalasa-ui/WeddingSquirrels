import { formatMoney, type MoneySummary } from "@/lib/money";

export function MoneyPosition({ summary }: { summary: MoneySummary }) {
  const rows = [
    { label: "Committed", value: summary.committed },
    { label: "Paid", value: summary.paid },
    { label: "Remaining", value: summary.remaining },
  ];

  return (
    <section className="mb-8 border-y border-[var(--line)] py-5">
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{row.label}</p>
            <p className="font-[family-name:var(--font-display)] text-[1.85rem] leading-none tracking-tight">
              {formatMoney(row.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
