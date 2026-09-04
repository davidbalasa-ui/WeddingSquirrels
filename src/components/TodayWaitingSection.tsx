"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markRequestRead } from "@/app/actions";
import { InboxRow } from "@/components/InboxRow";
import { profileIdForPerson } from "@/lib/people-directory";
import type { TodayWaitingItem } from "@/lib/today";
import type { SessionAccount } from "@/lib/types";
import type { TaskOption } from "@/lib/inbox";

export function TodayWaitingSection({
  session,
  waiting,
  tasks,
}: {
  session: SessionAccount;
  waiting: TodayWaitingItem[];
  tasks: TaskOption[];
}) {
  const [expandedAskId, setExpandedAskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!session.canSeeRequests) return null;

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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Waiting on</p>
      {waiting.length === 0 ? (
        <p className="mt-3 text-[1.05rem] leading-snug text-muted">Nothing is waiting on anyone.</p>
      ) : (
        <div className="mt-1 divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
          {waiting.map((entry) => {
            if (entry.item.kind === "ask") {
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

            const peopleHref = entry.personId ? `/people/${profileIdForPerson(entry.personId)}` : null;
            const href = peopleHref ?? entry.href;
            const body = (
              <div className="min-w-0 flex-1 py-3.5">
                <p className="text-[1.05rem] leading-snug">{entry.title}</p>
                <p className="mt-1 text-sm text-muted">{entry.context}</p>
                {entry.whenLabel ? <p className="mt-1 text-xs text-muted">{entry.whenLabel}</p> : null}
              </div>
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
