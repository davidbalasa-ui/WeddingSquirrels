"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePinAccount } from "@/app/actions";
import { ModulePermissionGrid } from "@/components/ModulePermissionGrid";
import type {
  AccountModuleFlags,
  PersonOption,
  ShareOption,
} from "@/lib/types";

export type AccountPanelAccount = AccountModuleFlags & {
  id: string;
  name: string;
  isMaster: boolean;
  linkedPersonId: string | null;
  assigneeFilter: string[];
  sharedBudgetItemIds?: string[];
  sharedTaskIds?: string[];
};

type PresetId = "full" | "partner" | "helper" | "sharedMoney";

const PRESETS: Record<
  PresetId,
  { label: string; description: string; flags: AccountModuleFlags }
> = {
  full: {
    label: "Full access",
    description: "Everything, including account management",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: true,
      canEditBudget: true,
      canSeeTimeline: true,
      canEditTimeline: true,
      canSeeGuests: true,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditDinner: true,
      canEditRehearsal: true,
      canManageAccounts: true,
    },
  },
  partner: {
    label: "Partner",
    description: "All modules + money/day-of edit; no account admin",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: true,
      canEditBudget: true,
      canSeeTimeline: true,
      canEditTimeline: true,
      canSeeGuests: true,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditDinner: true,
      canEditRehearsal: true,
      canManageAccounts: false,
    },
  },
  helper: {
    label: "Helper",
    description: "Tasks, people, calendar, shop, requests — no money/guests admin",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: false,
      canEditBudget: false,
      canSeeTimeline: false,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: true,
      canSeeStay: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
  sharedMoney: {
    label: "Shared-only money viewer",
    description: "Read-only money; other modules off (pair with shared items)",
    flags: {
      canSeeTasks: false,
      canSeePeople: false,
      canSeeCalendar: false,
      canSeeShop: false,
      canSeeBudget: true,
      canEditBudget: false,
      canSeeTimeline: false,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: false,
      canSeeStay: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
};

const DEFAULT_CREATE_FLAGS: AccountModuleFlags = {
  canSeeTasks: true,
  canSeePeople: true,
  canSeeCalendar: true,
  canSeeShop: true,
  canSeeBudget: false,
  canEditBudget: false,
  canSeeTimeline: false,
  canEditTimeline: false,
  canSeeGuests: false,
  canSeeRequests: true,
  canSeeStay: false,
  canSeeDinner: false,
  canEditDinner: false,
  canEditRehearsal: false,
  canManageAccounts: false,
};

const FULL_FLAGS = PRESETS.full.flags;

function summaryLabel(
  account: Pick<AccountPanelAccount, "isMaster"> & AccountModuleFlags,
): string {
  if (account.isMaster) return "Master · full access";
  const parts = [
    account.canSeeTasks && "Tasks",
    account.canSeePeople && "People",
    account.canSeeCalendar && "Cal",
    account.canSeeShop && "Shop",
    account.canSeeBudget && (account.canEditBudget ? "Money (edit)" : "Money"),
    account.canSeeTimeline && (account.canEditTimeline ? "Day-of (edit)" : "Day-of"),
    account.canSeeGuests && "Guests",
    account.canSeeStay && "Stay",
    account.canSeeDinner &&
      (account.canEditRehearsal || account.canEditDinner
        ? `Rehearsal${account.canEditRehearsal ? " schedule" : ""}${account.canEditDinner ? " dinner" : ""}`
        : "Rehearsal"),
    account.canSeeRequests && "Requests",
    account.canManageAccounts && "Accounts",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No modules";
}

function toggleId(list: string[], id: string, on: boolean): string[] {
  if (on) return list.includes(id) ? list : [...list, id];
  return list.filter((x) => x !== id);
}

function pickFlags(account: AccountModuleFlags): AccountModuleFlags {
  return {
    canSeeTasks: account.canSeeTasks,
    canSeePeople: account.canSeePeople,
    canSeeCalendar: account.canSeeCalendar,
    canSeeShop: account.canSeeShop,
    canSeeBudget: account.canSeeBudget,
    canEditBudget: account.canEditBudget,
    canSeeTimeline: account.canSeeTimeline,
    canEditTimeline: account.canEditTimeline,
    canSeeGuests: account.canSeeGuests,
    canSeeRequests: account.canSeeRequests,
    canSeeStay: account.canSeeStay,
    canSeeDinner: account.canSeeDinner,
    canEditDinner: account.canEditDinner,
    canEditRehearsal: account.canEditRehearsal,
    canManageAccounts: account.canManageAccounts,
  };
}

export function AccountAccessPanel({
  mode,
  people,
  account,
  action,
  budgetShareOptions,
  taskShareOptions,
  sharesEnabled = false,
  defaultOpen = false,
}: {
  mode: "create" | "edit";
  people: PersonOption[];
  account?: AccountPanelAccount;
  action: (formData: FormData) => Promise<void>;
  /** When WP3 share tables exist, pass selectable budget items. */
  budgetShareOptions?: ShareOption[];
  /** When WP3 share tables exist, pass selectable top-level tasks. */
  taskShareOptions?: ShareOption[];
  sharesEnabled?: boolean;
  defaultOpen?: boolean;
}) {
  const isMaster = Boolean(account?.isMaster);
  const [open, setOpen] = useState(defaultOpen || mode === "create");
  const [name, setName] = useState(account?.name ?? "");
  const [pin, setPin] = useState("");
  const [linkedPersonId, setLinkedPersonId] = useState(account?.linkedPersonId ?? "");
  const [flags, setFlags] = useState<AccountModuleFlags>(
    isMaster ? FULL_FLAGS : account ? pickFlags(account) : DEFAULT_CREATE_FLAGS,
  );
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(
    account?.assigneeFilter ?? [],
  );
  const [sharedBudgetItemIds, setSharedBudgetItemIds] = useState<string[]>(
    account?.sharedBudgetItemIds ?? [],
  );
  const [sharedTaskIds, setSharedTaskIds] = useState<string[]>(
    account?.sharedTaskIds ?? [],
  );
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const personNameById = useMemo(
    () => new Map(people.map((p) => [p.id, p.name])),
    [people],
  );

  const filterNames = assigneeFilter
    .map((id) => personNameById.get(id) || id)
    .filter(Boolean);

  function applyPreset(id: PresetId) {
    if (isMaster) return;
    setFlags(PRESETS[id].flags);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        if (mode === "create") {
          setName("");
          setPin("");
          setLinkedPersonId("");
          setFlags(DEFAULT_CREATE_FLAGS);
          setAssigneeFilter([]);
          setSharedBudgetItemIds([]);
          setSharedTaskIds([]);
        } else {
          setPin("");
          setOpen(false);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function confirmDelete() {
    if (!account || account.isMaster) return;
    const ok = window.confirm(
      `Delete “${account.name}”? This removes the PIN and related access (including any shared-item links).`,
    );
    if (!ok) return;
    startDelete(async () => {
      try {
        await deletePinAccount(account.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  const body = (
    <form action={submit} className="mt-3 flex flex-col gap-4">
      {mode === "edit" && account ? <input type="hidden" name="id" value={account.id} /> : null}
      {(Object.keys(isMaster ? FULL_FLAGS : flags) as (keyof AccountModuleFlags)[]).map((key) =>
        (isMaster ? FULL_FLAGS : flags)[key] ? (
          <input key={key} type="hidden" name={key} value="on" />
        ) : null,
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Identity</h3>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mother in law"
            className="field-input"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">
            {mode === "create" ? "PIN" : "New PIN (optional reset)"}
          </span>
          <input
            name="pin"
            required={mode === "create"}
            inputMode="numeric"
            pattern="\d{4,8}"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={mode === "create" ? "0999" : "Leave blank to keep"}
            className="field-input"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Linked person</span>
          <select
            name="linkedPersonId"
            value={linkedPersonId}
            onChange={(e) => setLinkedPersonId(e.target.value)}
            className="field-input"
          >
            <option value="">None</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        {isMaster ? (
          <p className="inline-flex w-fit items-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            Master
          </p>
        ) : null}
      </section>

      {!isMaster ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Presets</h3>
          <p className="text-xs text-muted">Applies locally — click Save to persist.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(PRESETS) as PresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-xl border border-line px-3 py-2 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <span className="font-semibold">{PRESETS[id].label}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {PRESETS[id].description}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ModulePermissionGrid
        flags={isMaster ? FULL_FLAGS : flags}
        locked={isMaster}
        onChange={setFlags}
      />

      {!isMaster ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Task filter</legend>
          <p className="mb-2 text-xs text-muted">
            None checked = all tasks visible (still limited by module access).
          </p>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => {
              const checked = assigneeFilter.includes(person.id);
              return (
                <label
                  key={person.id}
                  className="filter-pill flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    name="assigneeFilter"
                    value={person.id}
                    checked={checked}
                    onChange={(e) =>
                      setAssigneeFilter((prev) =>
                        toggleId(prev, person.id, e.target.checked),
                      )
                    }
                  />
                  {person.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Shared items</h3>
        {sharesEnabled && !isMaster ? (
          <>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Shared budget items</legend>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {(budgetShareOptions ?? []).map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="sharedBudgetItemIds"
                      value={item.id}
                      checked={sharedBudgetItemIds.includes(item.id)}
                      onChange={(e) =>
                        setSharedBudgetItemIds((prev) =>
                          toggleId(prev, item.id, e.target.checked),
                        )
                      }
                    />
                    {item.label}
                  </label>
                ))}
                {!budgetShareOptions?.length ? (
                  <p className="text-xs text-muted">No budget items yet.</p>
                ) : null}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Shared tasks</legend>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {(taskShareOptions ?? []).map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="sharedTaskIds"
                      value={item.id}
                      checked={sharedTaskIds.includes(item.id)}
                      onChange={(e) =>
                        setSharedTaskIds((prev) =>
                          toggleId(prev, item.id, e.target.checked),
                        )
                      }
                    />
                    {item.label}
                  </label>
                ))}
                {!taskShareOptions?.length ? (
                  <p className="text-xs text-muted">No tasks yet.</p>
                ) : null}
              </div>
            </fieldset>
          </>
        ) : isMaster ? (
          <p className="text-xs text-muted">
            Masters already see all budget items and tasks; per-item shares are for helpers.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
            {/* Fallback if share tables are unavailable on this deployment. */}
            Shared budget &amp; task pickers require item-sharing tables. Save accepts{" "}
            <code>sharedBudgetItemIds</code> / <code>sharedTaskIds</code> when available
            (synced like setBudgetItemShares / setTaskShares).
          </p>
        )}
      </section>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Add PIN account"
            : "Save changes"}
      </button>
    </form>
  );

  if (mode === "create") {
    return (
      <section className="card mb-4 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Add account</h2>
        {body}
      </section>
    );
  }

  const linkedName = account?.linkedPersonId
    ? personNameById.get(account.linkedPersonId) || account.linkedPersonId
    : null;

  return (
    <article className="card p-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h3 className="text-lg font-semibold">
            {account?.name}
            {isMaster ? (
              <span className="ml-2 align-middle text-xs font-semibold text-[var(--accent)]">
                Master
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-muted">
            {account ? summaryLabel(isMaster ? { ...account, ...FULL_FLAGS } : account) : ""}
          </p>
          {linkedName ? (
            <p className="mt-1 text-xs text-muted">Linked: {linkedName}</p>
          ) : null}
          {!isMaster && filterNames.length > 0 ? (
            <p className="mt-1 text-xs text-muted">Filter: {filterNames.join(", ")}</p>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-[var(--accent)]">
          {open ? "Close" : "Edit"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 border-t border-line pt-3">
          {body}
          {!isMaster ? (
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deletePending}
              className="mt-3 text-sm font-semibold text-[var(--danger)]"
            >
              {deletePending ? "Deleting…" : "Delete account"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
