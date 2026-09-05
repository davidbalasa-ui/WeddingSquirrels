"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteBudgetItem, markLegacyRemainingPaid, saveBudgetItem } from "@/app/actions";
import { personProfileHref } from "@/lib/entity-links";
import {
  contractPaidTotal,
  contractRemaining,
  formatMoney,
  hasExplicitSchedule,
  personMoneyLabel,
  type BudgetContractSnapshot,
} from "@/lib/money";

function toDateInput(value: Date | null | undefined) {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function MoneyContractEditor({
  contract,
  canEdit,
  personNames,
}: {
  contract: BudgetContractSnapshot;
  canEdit: boolean;
  personNames: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const explicit = hasExplicitSchedule(contract);
  const paid = contractPaidTotal(contract);
  const remaining = contractRemaining(contract);

  if (editing && canEdit) {
    return (
      <form
        action={async (fd) => {
          await saveBudgetItem(fd);
          setEditing(false);
          router.refresh();
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="id" value={contract.id} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Contract</span>
          <input
            name="name"
            defaultValue={contract.name}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Price</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={contract.price}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>
        {explicit ? null : (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Paid so far</span>
              <input
                name="amountPaid"
                inputMode="decimal"
                defaultValue={contract.amountPaid}
                className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Pay by</span>
              <input
                type="date"
                name="payByDate"
                defaultValue={toDateInput(contract.payByDate)}
                className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
              />
            </label>
          </>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Owner</span>
          <select
            name="ownerId"
            defaultValue={contract.ownerId ?? ""}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Both</option>
            <option value="david">David</option>
            <option value="haley">Haley</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Payer</span>
          <select
            name="paidById"
            defaultValue={contract.paidById ?? ""}
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Both</option>
            <option value="david">David</option>
            <option value="haley">Haley</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Notes</span>
          <textarea
            name="note"
            defaultValue={contract.note || ""}
            rows={3}
            className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            Save
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <button
          type="button"
          className="self-start text-sm font-semibold text-[var(--danger)]"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Remove this contract? Payment rows for it will be removed too.")) return;
            startTransition(async () => {
              await deleteBudgetItem(contract.id);
              router.push("/money");
              router.refresh();
            });
          }}
        >
          Remove contract
        </button>
      </form>
    );
  }

  return (
    <section className="mb-8">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Contract</p>
      <div className="border-y border-[var(--line)] py-4">
        <p className="font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-tight">
          {contract.name}
        </p>
        <p className="mt-2 text-base text-muted">{formatMoney(contract.price)} contract</p>
        <p className="mt-1 text-sm text-muted">
          {contract.ownerId ? (
            <Link href={personProfileHref(contract.ownerId)} className="font-semibold text-[var(--accent)]">
              Owner {personMoneyLabel(contract.ownerId, personNames)}
            </Link>
          ) : (
            <>Owner {personMoneyLabel(contract.ownerId, personNames)}</>
          )}
          {contract.paidById ? (
            <>
              {" · "}
              <Link href={personProfileHref(contract.paidById)} className="font-semibold text-[var(--accent)]">
                Paid by {personMoneyLabel(contract.paidById, personNames)}
              </Link>
            </>
          ) : null}
        </p>
        {contract.note ? <p className="mt-3 text-sm leading-relaxed text-muted">{contract.note}</p> : null}
      </div>

      <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Payment status
      </p>
      <div className="flex flex-col gap-3 border-y border-[var(--line)] py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">Paid</span>
          <span className="font-[family-name:var(--font-display)] text-2xl">{formatMoney(paid)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">Remaining</span>
          <span className="font-[family-name:var(--font-display)] text-2xl">{formatMoney(remaining)}</span>
        </div>
      </div>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-[var(--accent)]"
            onClick={() => setEditing(true)}
          >
            Edit contract
          </button>
          {!explicit && remaining > 0.001 ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--accent)]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markLegacyRemainingPaid(contract.id);
                  router.refresh();
                })
              }
            >
              Mark remaining paid
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
