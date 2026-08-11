"use client";

import type { AccountModuleFlags } from "@/lib/types";

type ModuleRow = {
  key: string;
  label: string;
  seeKey: keyof AccountModuleFlags;
  editKey?: keyof AccountModuleFlags;
};

const MODULE_ROWS: ModuleRow[] = [
  { key: "tasks", label: "Tasks", seeKey: "canSeeTasks" },
  { key: "people", label: "People", seeKey: "canSeePeople" },
  { key: "calendar", label: "Calendar", seeKey: "canSeeCalendar" },
  { key: "shop", label: "Shop", seeKey: "canSeeShop" },
  { key: "money", label: "Money", seeKey: "canSeeBudget", editKey: "canEditBudget" },
  { key: "dayof", label: "Day-of", seeKey: "canSeeTimeline", editKey: "canEditTimeline" },
  { key: "guests", label: "Guests", seeKey: "canSeeGuests" },
  { key: "requests", label: "Requests", seeKey: "canSeeRequests" },
  { key: "accounts", label: "Manage accounts", seeKey: "canManageAccounts" },
];

export function ModulePermissionGrid({
  flags,
  locked,
  onChange,
}: {
  flags: AccountModuleFlags;
  locked?: boolean;
  onChange: (next: AccountModuleFlags) => void;
}) {
  function setFlag(key: keyof AccountModuleFlags, value: boolean) {
    if (locked) return;
    const next = { ...flags, [key]: value };

    // Edit flags auto-clear when corresponding See is off.
    if (key === "canSeeBudget" && !value) next.canEditBudget = false;
    if (key === "canSeeTimeline" && !value) next.canEditTimeline = false;

    // Edit without See → force See.
    if (key === "canEditBudget" && value) next.canSeeBudget = true;
    if (key === "canEditTimeline" && value) next.canSeeTimeline = true;

    onChange(next);
  }

  return (
    <fieldset disabled={locked} className="overflow-x-auto">
      <legend className="mb-2 text-sm font-semibold">Modules</legend>
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="pb-2 pr-2 font-semibold">Module</th>
            <th className="pb-2 pr-2 font-semibold">See</th>
            <th className="pb-2 font-semibold">Edit</th>
          </tr>
        </thead>
        <tbody>
          {MODULE_ROWS.map((row) => (
            <tr key={row.key} className="border-t border-line/70">
              <td className="py-2.5 pr-2">{row.label}</td>
              <td className="py-2.5 pr-2">
                <input
                  type="checkbox"
                  name={row.seeKey}
                  checked={flags[row.seeKey]}
                  onChange={(e) => setFlag(row.seeKey, e.target.checked)}
                  aria-label={`${row.label} see`}
                />
              </td>
              <td className="py-2.5">
                {row.editKey ? (
                  <input
                    type="checkbox"
                    name={row.editKey}
                    checked={flags[row.editKey]}
                    onChange={(e) => setFlag(row.editKey!, e.target.checked)}
                    aria-label={`${row.label} edit`}
                  />
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {locked ? (
        <p className="mt-2 text-xs text-muted">Master accounts always have full access.</p>
      ) : null}
    </fieldset>
  );
}

export { MODULE_ROWS };
