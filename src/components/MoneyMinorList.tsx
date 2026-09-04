"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveMinorExpense } from "@/app/actions";
import { formatMoney, type MinorExpenseSnapshot } from "@/lib/money";

export function MoneyMinorList({
  minor,
  canEdit,
}: {
  minor: MinorExpenseSnapshot[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  if (minor.length === 0) return null;

  return (
    <section className="mt-10">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Other spending
      </p>
      <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {minor.map((item) => {
          const needed = item.amountNeeded ?? item.amountSpent;
          const left = Math.max(0, needed - item.amountSpent);
          if (editingId === item.id && canEdit) {
            return (
              <article key={item.id} className="py-3">
                <form
                  action={async (fd) => {
                    await saveMinorExpense(fd);
                    setEditingId(null);
                    router.refresh();
                  }}
                  className="flex flex-col gap-3"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <p className="font-semibold">{item.title}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="amountNeeded"
                      inputMode="decimal"
                      defaultValue={item.amountNeeded ?? ""}
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      name="amountSpent"
                      inputMode="decimal"
                      defaultValue={item.amountSpent || ""}
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <button type="submit" className="btn-primary self-start">
                    Save
                  </button>
                </form>
              </article>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-3 py-3 text-left"
              onClick={() => canEdit && setEditingId(item.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {formatMoney(item.amountSpent)} spent of {formatMoney(needed)}
                </span>
              </span>
              <span className="shrink-0 font-[family-name:var(--font-display)] text-lg">
                {formatMoney(left)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
