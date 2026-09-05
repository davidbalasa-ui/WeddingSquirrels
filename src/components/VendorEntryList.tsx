"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveBudgetAmounts, saveBudgetReceipt } from "@/app/actions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { formatBudgetContractDetail } from "@/lib/connections";
import { peopleProfileHref } from "@/lib/entity-links";
import { contractRemaining, formatMoney } from "@/lib/money";
import type { DirectoryEntry, PeopleSort } from "@/lib/people-directory";
import { filterDirectoryEntries } from "@/lib/people-directory";
import { sortDirectoryEntries } from "@/lib/people-sort";
import type { VendorBudgetRecord } from "@/lib/people-hub";
import { fileToResizedDataUrl } from "@/lib/resize-image";

function VendorEntryCard({
  entry,
  budgets,
  canEditMoney,
}: {
  entry: DirectoryEntry;
  budgets: VendorBudgetRecord[];
  canEditMoney: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const primary = budgets[0];
  const phoneHref = entry.phone ? `tel:${entry.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <article className="px-3 py-2" aria-busy={pending || undefined}>
      <div className="flex items-center gap-2">
        <PersonAvatar name={entry.name} photoSrc={entry.photoSrc} size="sm" />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <span className="block text-[15px] font-semibold leading-snug">{entry.name}</span>
          {entry.subtitle && entry.subtitle !== entry.name ? (
            <span className="mt-0.5 block truncate text-xs text-muted">{entry.subtitle}</span>
          ) : null}
          {primary ? (
            <span className="mt-0.5 block text-xs text-muted">
              {formatBudgetContractDetail(primary)}
            </span>
          ) : null}
        </button>
        <Link
          href={peopleProfileHref(entry.profileId)}
          className="shrink-0 text-sm text-muted"
          aria-label={`Open ${entry.name}`}
        >
          ›
        </Link>
      </div>

      {open ? (
        <div className="mt-2 border-t border-line pt-3 pl-[2.75rem]">
          {entry.phone || entry.email ? (
            <div className="mb-3 flex flex-col gap-1 text-sm">
              {entry.phone && phoneHref ? (
                <a href={phoneHref} className="font-semibold text-[var(--accent)] hover:underline">
                  {entry.phone}
                </a>
              ) : null}
              {entry.email ? (
                <a href={`mailto:${entry.email}`} className="text-muted hover:underline">
                  {entry.email}
                </a>
              ) : null}
            </div>
          ) : null}

          {budgets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {budgets.map((budget) => (
                <VendorBudgetPanel
                  key={budget.id}
                  budget={budget}
                  canEdit={canEditMoney}
                  onSaveAmounts={(price, amountPaid) => {
                    startTransition(async () => {
                      await saveBudgetAmounts(budget.id, price, amountPaid);
                    });
                  }}
                />
              ))}
            </div>
          ) : null}

        </div>
      ) : null}
    </article>
  );
}

function VendorBudgetPanel({
  budget,
  canEdit,
  onSaveAmounts,
}: {
  budget: VendorBudgetRecord;
  canEdit: boolean;
  onSaveAmounts: (price: number, amountPaid: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const remaining = contractRemaining({ price: budget.price, amountPaid: budget.amountPaid });
  const [price, setPrice] = useState(String(budget.price));
  const [paid, setPaid] = useState(String(budget.amountPaid));

  return (
    <div className="rounded-lg border border-line px-3 py-2 text-sm">
      <p className="font-semibold">{budget.name}</p>
      <p className="mt-1 text-xs text-muted">{formatBudgetContractDetail(budget)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted">Total owed</span>
          {canEdit ? (
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              onBlur={() => onSaveAmounts(Number(price), Number(paid))}
              className="mt-0.5 w-full rounded-lg border border-line px-2 py-1"
              inputMode="decimal"
            />
          ) : (
            <p className="mt-0.5 font-semibold">{formatMoney(budget.price)}</p>
          )}
        </div>
        <div>
          <span className="text-muted">Paid</span>
          {canEdit ? (
            <input
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              onBlur={() => onSaveAmounts(Number(price), Number(paid))}
              className="mt-0.5 w-full rounded-lg border border-line px-2 py-1"
              inputMode="decimal"
            />
          ) : (
            <p className="mt-0.5 font-semibold">{formatMoney(budget.amountPaid)}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Balance remaining · <span className="font-semibold text-[var(--text)]">{formatMoney(remaining)}</span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        {budget.receiptData ? (
          <img
            src={budget.receiptData}
            alt="Receipt"
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : null}
        {canEdit ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                startTransition(async () => {
                  const dataUrl = await fileToResizedDataUrl(file);
                  await saveBudgetReceipt(budget.id, dataUrl);
                });
              }}
            />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)]"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              {budget.receiptData ? "Update receipt" : "Add receipt"}
            </button>
          </>
        ) : budget.receiptData ? (
          <span className="text-xs text-muted">Receipt on file</span>
        ) : null}
      </div>
      <Link href={budget.href} className="mt-2 block text-xs font-semibold text-[var(--accent)]">
        Open in Money →
      </Link>
    </div>
  );
}

export function VendorEntryList({
  entries,
  vendorBudgets,
  canEditMoney,
  sort,
  searchPlaceholder,
  emptyLabel,
}: {
  entries: DirectoryEntry[];
  vendorBudgets: Record<string, VendorBudgetRecord[]>;
  canEditMoney: boolean;
  sort: PeopleSort;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const searched = filterDirectoryEntries(entries, query);
    return sortDirectoryEntries(searched, sort);
  }, [entries, query, sort]);

  return (
    <section>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="mb-3 w-full rounded-xl border border-line bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search vendors"
      />

      {filtered.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">
          {emptyLabel}
          {query ? " matching your search" : ""}.
        </div>
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {filtered.map((entry) => (
            <VendorEntryCard
              key={entry.profileId}
              entry={entry}
              budgets={vendorBudgets[entry.profileId] ?? []}
              canEditMoney={canEditMoney}
            />
          ))}
        </div>
      )}
    </section>
  );
}
