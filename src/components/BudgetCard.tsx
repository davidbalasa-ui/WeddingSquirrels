"use client";

import { useTransition } from "react";
import { setBudgetOwner } from "@/app/actions";

type Item = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  ownerId: string | null;
  payByDate: Date | string | null;
};

const owners = [
  { id: "david", label: "David" },
  { id: "haley", label: "Haley" },
  { id: null, label: "Both" },
] as const;

export function BudgetCard({ item, canEdit }: { item: Item; canEdit: boolean }) {
  const remaining = Math.max(0, item.price - item.amountPaid);
  const [pending, startTransition] = useTransition();
  const selected = item.ownerId === "david" ? "david" : item.ownerId === "haley" ? "haley" : null;

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold leading-snug">{item.name}</h3>
          <p className="mt-1 text-sm text-muted">
            ${item.amountPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })} paid of $
            {item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--accent)]">
            ${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted">left</p>
        </div>
      </div>

      {canEdit ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {owners.map((owner) => {
            const active = selected === owner.id;
            return (
              <button
                key={owner.label}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => setBudgetOwner(item.id, owner.id))
                }
                className="rounded-xl border px-2 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {owner.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Owner: {selected === "david" ? "David" : selected === "haley" ? "Haley" : "Both / unset"}
        </p>
      )}
    </article>
  );
}
