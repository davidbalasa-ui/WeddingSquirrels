"use client";

import { useState } from "react";
import { AccountEditor } from "@/components/AccountEditor";
import { AccountPreview } from "@/components/AccountPreview";
import { accountSummaryLabel } from "@/lib/account-flags";
import { matchPreset, PRESETS } from "@/lib/presets";
import type { AccountPanelAccount, PersonOption, ShareOption } from "@/lib/types";

export function AccountsManager({
  accounts,
  people,
  budgetShareOptions,
  taskShareOptions,
}: {
  accounts: AccountPanelAccount[];
  people: PersonOption[];
  budgetShareOptions: ShareOption[];
  taskShareOptions: ShareOption[];
}) {
  const [editing, setEditing] = useState<{
    mode: "create" | "edit";
    account: AccountPanelAccount | null;
  } | null>(null);
  const [preview, setPreview] = useState<AccountPanelAccount | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => setEditing({ mode: "create", account: null })}
      >
        Add account
      </button>

      {accounts.length === 0 ? (
        <div className="card p-5 text-sm text-muted">
          No accounts yet — add the first one above.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              people={people}
              onEdit={() => setEditing({ mode: "edit", account })}
              onPreview={() => setPreview(account)}
              onDuplicate={() =>
                setEditing({
                  mode: "create",
                  account: { ...account, id: "", name: `${account.name} (copy)`, isMaster: false },
                })
              }
            />
          ))}
        </div>
      )}

      {editing ? (
        <AccountEditor
          mode={editing.mode}
          account={editing.account ?? undefined}
          people={people}
          budgetShareOptions={budgetShareOptions}
          taskShareOptions={taskShareOptions}
          onClose={() => setEditing(null)}
          onPreview={(draft) => setPreview(draft)}
        />
      ) : null}

      {preview ? <AccountPreview account={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function AccountCard({
  account,
  people,
  onEdit,
  onPreview,
  onDuplicate,
}: {
  account: AccountPanelAccount;
  people: PersonOption[];
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
}) {
  const isMaster = account.isMaster;
  const role = isMaster ? "full" : matchPreset(account);
  const personNameById = new Map(people.map((p) => [p.id, p.name]));
  const linkedName = account.linkedPersonId
    ? personNameById.get(account.linkedPersonId) || account.linkedPersonId
    : null;
  const filterNames = account.assigneeFilter
    .map((id) => personNameById.get(id) || id)
    .filter(Boolean);

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{account.name}</h3>
            {isMaster ? (
              <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                Master
              </span>
            ) : null}
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {PRESETS[role].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{accountSummaryLabel(account)}</p>
          {linkedName ? (
            <p className="mt-1 text-xs text-muted">Linked: {linkedName}</p>
          ) : null}
          {filterNames.length > 0 ? (
            <p className="mt-1 text-xs text-muted">Filter: {filterNames.join(", ")}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={onPreview}>
            Preview
          </button>
          {!isMaster ? (
            <button type="button" className="text-sm text-muted" onClick={onDuplicate}>
              Duplicate
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
