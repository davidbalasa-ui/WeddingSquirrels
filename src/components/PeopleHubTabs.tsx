"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PeopleTab } from "@/lib/people-directory";

const TABS: { key: PeopleTab; label: string }[] = [
  { key: "guests", label: "Guest list" },
  { key: "vendors", label: "Vendors" },
  { key: "day-of", label: "Day-of contacts" },
];

export function PeopleHubTabs({
  activeTab,
  counts,
}: {
  activeTab: PeopleTab;
  counts: Record<PeopleTab, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
            style={{
              borderColor: active ? "var(--accent)" : "var(--line)",
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--accent)" : "var(--muted)",
            }}
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.set("tab", tab.key);
              router.push(`${pathname}?${next.toString()}`);
            }}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">({counts[tab.key]})</span>
          </button>
        );
      })}
    </div>
  );
}

export function PeopleTabFooterLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm transition-colors hover:bg-[var(--accent-soft)]/30"
    >
      <span>
        <span className="block font-semibold text-[var(--accent)]">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{detail}</span>
      </span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </Link>
  );
}
