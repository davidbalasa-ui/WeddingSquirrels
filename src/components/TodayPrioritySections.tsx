"use client";

import { useState, useTransition } from "react";
import { markRequestRead } from "@/app/actions";
import { InboxRow } from "@/components/InboxRow";
import { TodayAttentionPaymentRow } from "@/components/TodayAttentionPaymentRow";
import type { TodayAttentionItem } from "@/lib/today";
import type { InboxItem } from "@/lib/inbox";
import type { SessionAccount } from "@/lib/types";
import type { TaskOption } from "@/lib/inbox";

export function TodayPrioritySections({
  session,
  attention,
  waiting,
  tasks,
}: {
  session: SessionAccount;
  attention: TodayAttentionItem[];
  waiting: InboxItem[];
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

  if (attention.length === 0 && waiting.length === 0) {
    return (
      <p className="mb-5 text-sm text-muted">You&apos;re caught up on the urgent queue.</p>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-5">
      {attention.length > 0 ? (
        <section>
          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Needs attention · {attention.length}
          </p>
          <div className="divide-y divide-[var(--line)] border-t border-line">
            {attention.map((entry) =>
              entry.type === "payment" ? (
                <TodayAttentionPaymentRow key={entry.id} item={entry} />
              ) : (
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
              ),
            )}
          </div>
        </section>
      ) : null}

      {session.canSeeRequests && waiting.length > 0 ? (
        <section>
          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Waiting · {waiting.length}
          </p>
          <div className="divide-y divide-[var(--line)] border-t border-line">
            {waiting.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                session={session}
                tasks={tasks}
                expanded={expandedAskId === item.id}
                onToggleExpand={() =>
                  handleAskToggle(item.id, item.sourceId, expandedAskId !== item.id)
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
