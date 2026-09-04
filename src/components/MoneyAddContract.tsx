"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBudgetItem } from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

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
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="price"
            inputMode="decimal"
            placeholder="Contract total"
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
          <input
            name="amountPaid"
            inputMode="decimal"
            placeholder="Paid so far"
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </div>
        <input
          type="date"
          name="payByDate"
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
        <textarea
          name="note"
          rows={2}
          placeholder="Notes…"
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
