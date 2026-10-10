"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBudgetItem } from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";
import { moneyInputProblem } from "@/lib/money";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";

export function MoneyAddContract({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line px-4 py-3 text-sm font-semibold text-[var(--accent)]"
      >
        <StarIcon size={16} />
        Add a contract
      </button>
    );
  }

  return (
    <article className="mt-4 rounded-2xl border border-line p-4">
      <form
        action={async (fd) => {
          await createBudgetItem(fd);
          setOpen(false);
          router.refresh();
        }}
        className="flex flex-col gap-3"
      >
        <input
          name="name"
          placeholder="Vendor or contract"
          aria-label="Vendor or contract"
          required
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="price"
            inputMode="decimal"
            placeholder="Contract total"
            aria-label="Contract total"
            onChange={(event) => event.currentTarget.setCustomValidity(moneyInputProblem(event.currentTarget.value) ?? "")}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
          <input
            name="amountPaid"
            inputMode="decimal"
            placeholder="Paid so far"
            aria-label="Paid so far"
            onChange={(event) => event.currentTarget.setCustomValidity(moneyInputProblem(event.currentTarget.value) ?? "")}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </div>
        <input
          type="date"
          name="payByDate"
          aria-label="Pay by date"
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
        <AutoGrowTextarea
          name="note"
          rows={2}
          placeholder="Notes…"
          aria-label="Notes"
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Add contract
          </button>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
