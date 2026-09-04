"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markRequestRead } from "@/app/actions";
import { InboxRow } from "@/components/InboxRow";
import type { TodayAttentionItem } from "@/lib/today";
import type { SessionAccount } from "@/lib/types";
import type { TaskOption } from "@/lib/inbox";

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function AttentionCopy({
  title,
  context,
  whenLabel,
  reason,
  urgency,
  amountRemaining,
}: {
  title: string;
  context: string | null;
  whenLabel: string | null;
  reason: string;
  urgency: "high" | "normal";
  amountRemaining?: number;
}) {
  return (
    <div className="min-w-0 flex-1 py-3.5">
      <p className="text-[1.05rem] font-semibold leading-snug">{title}</p>
      {amountRemaining !== undefined ? (
        <p className="mt-1 text-sm text-muted">{formatMoney(amountRemaining)} remaining</p>
      ) : context ? (
        <p className="mt-1 text-sm text-muted">{context}</p>
      ) : null}
      <p
        className={`mt-1 text-xs font-semibold uppercase tracking-[0.08em] ${
          urgency === "high" ? "text-[var(--warn)]" : "text-muted"
        }`}
      >
        {reason}
        {whenLabel ? ` · ${whenLabel}` : ""}
      </p>
    </div>
  );
}

export function TodayAttentionQueue({
  session,
  attention,
  tasks,
}: {
  session: SessionAccount;
  attention: TodayAttentionItem[];
  tasks: TaskOption[];
}) {
  const [expandedAskId, setExpandedAskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleAskToggle(itemId: string, sourceId: string, open: boolean) {
    setExpandedAskId(open ? itemId : null);
    if (open) {
      startTransition(async () => {
        await markRequestRead(sourceId);
      });
    }
  }

  return (
    <section className="mb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Needs your attention
      </p>
      {attention.length === 0 ? (
        <p className="mt-3 text-[1.05rem] leading-snug text-muted">
          Nothing needs your attention right now.
        </p>
      ) : (
        <div className="mt-1 divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
          {attention.map((entry) => {
            if (entry.type === "inbox" && entry.item.kind === "ask") {
              return (
                <InboxRow
                  key={entry.id}
                  item={entry.item}
                  session={session}
                  tasks={tasks}
                  expanded={expandedAskId === entry.item.id}
                  onToggleExpand={() =>
                    handleAskToggle(entry.item.id, entry.item.sourceId, expandedAskId !== entry.item.id)
                  }
                />
              );
            }

            const href = entry.href;
            const body = (
              <AttentionCopy
                title={entry.title}
                context={entry.context}
                whenLabel={entry.whenLabel}
                reason={entry.reason}
                urgency={entry.urgency}
                amountRemaining={entry.type === "payment" ? entry.amountRemaining : undefined}
              />
            );

            if (href) {
              return (
                <Link
                  key={entry.id}
                  href={href}
                  className="flex min-h-14 items-start transition-colors hover:bg-[var(--accent-soft)]/25"
                >
                  {body}
                </Link>
              );
            }

            return (
              <div key={entry.id} className="flex items-start">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
