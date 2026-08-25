"use client";

import { toggleAccountFlag } from "@/lib/account-flags";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  permissionModules,
  type ModuleDef,
  type ModuleGroup,
} from "@/lib/modules";
import type { AccountModuleFlags } from "@/lib/types";

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
    onChange(toggleAccountFlag(flags, key, value));
  }

  return (
    <fieldset disabled={locked} className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-semibold">Access</legend>
      {GROUP_ORDER.map((group: ModuleGroup) => {
        const rows = permissionModules(group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {GROUP_LABELS[group]}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {rows.map((module) => (
                <ModuleToggle
                  key={module.key}
                  module={module}
                  flags={flags}
                  onToggle={setFlag}
                />
              ))}
            </div>
          </div>
        );
      })}
      {locked ? (
        <p className="text-xs text-muted">Master accounts always have full access.</p>
      ) : (
        <p className="text-xs text-muted">
          Rehearsal Edit is the Thursday schedule; Dinner Edit is the menu (lives on the
          Rehearsal tab).
        </p>
      )}
    </fieldset>
  );
}

function ModuleToggle({
  module,
  flags,
  onToggle,
}: {
  module: ModuleDef;
  flags: AccountModuleFlags;
  onToggle: (key: keyof AccountModuleFlags, value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
      <span className="font-medium">{module.label}</span>
      <div className="flex items-center gap-3">
        {module.see ? (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={flags[module.see]}
              onChange={(e) => onToggle(module.see!, e.target.checked)}
              aria-label={`${module.label} see`}
            />
            See
          </label>
        ) : null}
        {module.edit ? (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={flags[module.edit]}
              onChange={(e) => onToggle(module.edit!, e.target.checked)}
              aria-label={`${module.label} edit`}
            />
            Edit
          </label>
        ) : null}
      </div>
    </div>
  );
}
