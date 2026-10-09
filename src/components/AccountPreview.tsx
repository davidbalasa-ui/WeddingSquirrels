"use client";

import { useEffect, useRef } from "react";
import { ModuleIcon } from "@/components/ModuleIcon";
import { pickAccountFlags } from "@/lib/account-flags";
import { canSeeNavTab, moreGroups, NAV_TABS } from "@/lib/modules";
import type { AccountPanelAccount, SessionAccount } from "@/lib/types";

function sessionFromAccount(account: AccountPanelAccount): SessionAccount {
  return {
    id: "preview",
    name: account.name || "Account",
    isMaster: account.isMaster,
    linkedPersonId: account.linkedPersonId,
    assigneeFilter: null,
    ...pickAccountFlags(account),
  };
}

export function AccountPreview({
  account,
  onClose,
}: {
  account: AccountPanelAccount;
  onClose: () => void;
}) {
  const session = sessionFromAccount(account);
  const tabs = NAV_TABS.filter((item) => canSeeNavTab(session, item.tab));
  const more = moreGroups(session);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The preview sits on top of the account editor; one Escape closes only the preview.
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${account.name}`}
        tabIndex={-1}
        className="overlay-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Preview</h2>
            <p className="mt-1 text-sm text-muted">
              What <span className="font-semibold">{account.name || "this account"}</span> will see
              when signed in.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--surface)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Bottom bar</p>
        <div
          className="nav-bar"
          style={{ position: "static", transform: "none", width: "100%", marginBottom: 8 }}
        >
          {tabs.map((item) => (
            <span key={item.tab} className="nav-link">
              <ModuleIcon name={item.icon} className="nav-icon" />
              <span>{item.label}</span>
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {more.length > 0 ? (
            more.map((group) => (
              <div key={group.group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink"
                    >
                      <ModuleIcon name={item.icon} className="h-5 w-5 shrink-0" />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No additional tabs — just the pinned bar above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
