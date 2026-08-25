"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPinAccount, deletePinAccount, updatePinAccount } from "@/app/actions";
import { ModulePermissionGrid } from "@/components/ModulePermissionGrid";
import {
  flagDiffCount,
  flagEnabledCount,
  pickAccountFlags,
} from "@/lib/account-flags";
import { DEFAULT_CREATE_FLAGS, matchPreset, PRESETS, PRESET_ORDER, type PresetId } from "@/lib/presets";
import type { AccountModuleFlags, AccountPanelAccount, PersonOption, ShareOption } from "@/lib/types";

export function AccountEditor({
  mode,
  account,
  people,
  budgetShareOptions,
  taskShareOptions,
  onClose,
  onPreview,
}: {
  mode: "create" | "edit";
  account?: AccountPanelAccount;
  people: PersonOption[];
  budgetShareOptions: ShareOption[];
  taskShareOptions: ShareOption[];
  onClose: () => void;
  onPreview: (draft: AccountPanelAccount) => void;
}) {
  const router = useRouter();
  const isMaster = Boolean(account?.isMaster);
  const initialFlags: AccountModuleFlags = isMaster
    ? PRESETS.full.flags!
    : account
      ? pickAccountFlags(account)
      : DEFAULT_CREATE_FLAGS;

  const [name, setName] = useState(account?.name ?? "");
  const [pin, setPin] = useState("");
  const [linkedPersonId, setLinkedPersonId] = useState(account?.linkedPersonId ?? "");
  const [flags, setFlags] = useState<AccountModuleFlags>(initialFlags);
  const [preset, setPreset] = useState<PresetId>(() =>
    isMaster ? "full" : matchPreset(initialFlags),
  );
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(account?.assigneeFilter ?? []);
  const [sharedBudgetItemIds, setSharedBudgetItemIds] = useState<string[]>(
    account?.sharedBudgetItemIds ?? [],
  );
  const [sharedTaskIds, setSharedTaskIds] = useState<string[]>(account?.sharedTaskIds ?? []);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const baseline = mode === "edit" && account ? pickAccountFlags(account) : null;
  const changes = baseline ? flagDiffCount(baseline, flags) : flagEnabledCount(flags);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function applyPreset(id: PresetId) {
    if (isMaster) return;
    setPreset(id);
    const presetFlags = PRESETS[id].flags;
    if (presetFlags) setFlags({ ...presetFlags });
  }

  function toggleId(list: string[], id: string, on: boolean): string[] {
    if (on) return list.includes(id) ? list : [...list, id];
    return list.filter((x) => x !== id);
  }

  function draft(): AccountPanelAccount {
    return {
      ...flags,
      id: account?.id ?? "draft",
      name: name.trim() || "New account",
      isMaster,
      linkedPersonId,
      assigneeFilter,
      sharedBudgetItemIds,
      sharedTaskIds,
    };
  }

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (mode === "create" && !/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4–8 digits");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      if (mode === "edit" && account) fd.set("id", account.id);
      fd.set("name", name);
      if (pin) fd.set("pin", pin);
      fd.set("linkedPersonId", linkedPersonId);
      for (const key of Object.keys(flags) as (keyof AccountModuleFlags)[]) {
        if (flags[key]) fd.set(key, "on");
      }
      for (const id of assigneeFilter) fd.append("assigneeFilter", id);
      for (const id of sharedBudgetItemIds) fd.append("sharedBudgetItemIds", id);
      for (const id of sharedTaskIds) fd.append("sharedTaskIds", id);
      try {
        await (mode === "edit" ? updatePinAccount : createPinAccount)(fd);
        onClose();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function confirmDelete() {
    if (!account || isMaster) return;
    const ok = window.confirm(
      `Delete “${account.name}”? This removes the PIN and related access (including any shared-item links).`,
    );
    if (!ok) return;
    startDelete(async () => {
      try {
        await deletePinAccount(account.id);
        onClose();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? `Edit ${account?.name}` : "Add account"}
        tabIndex={-1}
        className="overlay-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              {mode === "edit" ? `Edit ${account?.name}` : "Add account"}
            </h2>
            <p className="mt-1 text-sm text-muted">Set a PIN and choose what this person can see.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--surface)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">1 · Basics</h3>
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

          {isMaster ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
              Master accounts always have full access. You can still rename or reset the PIN above.
            </p>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">2 · Role</h3>
                <p className="text-xs text-muted">Pick a starting point — you can fine-tune below.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRESET_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="role-card"
                      data-active={preset === id}
                      onClick={() => applyPreset(id)}
                    >
                      <span className="font-semibold">{PRESETS[id].label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{PRESETS[id].description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <ModulePermissionGrid
                flags={flags}
                onChange={(next) => {
                  setFlags(next);
                  setPreset("custom");
                }}
              />

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">4 · Scope</h3>
                <fieldset>
                  <legend className="mb-2 text-xs text-muted">Task filter</legend>
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
                            checked={checked}
                            onChange={(e) =>
                              setAssigneeFilter((prev) => toggleId(prev, person.id, e.target.checked))
                            }
                          />
                          {person.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-1 text-xs text-muted">Shared budget items</legend>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {budgetShareOptions.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={sharedBudgetItemIds.includes(item.id)}
                          onChange={(e) =>
                            setSharedBudgetItemIds((prev) => toggleId(prev, item.id, e.target.checked))
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                    {budgetShareOptions.length === 0 ? (
                      <p className="text-xs text-muted">No budget items yet.</p>
                    ) : null}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-1 text-xs text-muted">Shared tasks</legend>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {taskShareOptions.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={sharedTaskIds.includes(item.id)}
                          onChange={(e) =>
                            setSharedTaskIds((prev) => toggleId(prev, item.id, e.target.checked))
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                    {taskShareOptions.length === 0 ? (
                      <p className="text-xs text-muted">No tasks yet.</p>
                    ) : null}
                  </div>
                </fieldset>
              </section>
            </>
          )}

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {baseline
                  ? `${changes} module change${changes === 1 ? "" : "s"}`
                  : `${changes} modules enabled`}
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-[var(--accent)]"
                onClick={() => onPreview(draft())}
              >
                Preview tabs
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary min-w-0 flex-1"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add account"}
              </button>
              {mode === "edit" && !isMaster ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={confirmDelete}
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Delete"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
