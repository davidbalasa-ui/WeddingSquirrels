"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createRequest } from "@/app/actions";
import { RequestCard, type RequestView } from "@/components/RequestCard";
import { StarIcon } from "@/components/StarIcon";

type AccountOption = { id: string; name: string };
type TaskOption = { id: string; title: string };

type CapsMap = Record<
  string,
  {
    canEdit: boolean;
    canComplete: boolean;
    canDecline: boolean;
    canReopen: boolean;
    canDelete: boolean;
    isRecipient: boolean;
    isUnread: boolean;
  }
>;

function ComposerFields({
  accounts,
  tasks,
  defaultTaskId,
  autoFocus,
}: {
  accounts: AccountOption[];
  tasks: TaskOption[];
  defaultTaskId?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">To</span>
        <select name="recipientAccountId" required defaultValue="" className="field-input">
          <option value="" disabled>
            Choose who to ask…
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Title</span>
        <input
          name="title"
          required
          placeholder="What do you need?"
          className="field-input"
          autoFocus={autoFocus}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Note (optional)</span>
        <textarea
          name="note"
          rows={3}
          placeholder="Context, deadline, link…"
          className="field-input resize-y"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Related decision (optional)</span>
        <select name="taskId" defaultValue={defaultTaskId ?? ""} className="field-input">
          <option value="">None</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function RequestsBoard({
  needsYou,
  waitingOnOthers,
  closed,
  showClosed,
  accounts,
  tasks,
  caps,
  defaultTaskId,
}: {
  needsYou: RequestView[];
  waitingOnOthers: RequestView[];
  closed: RequestView[];
  showClosed: boolean;
  accounts: AccountOption[];
  tasks: TaskOption[];
  caps: CapsMap;
  defaultTaskId?: string;
}) {
  const [adding, setAdding] = useState(Boolean(defaultTaskId));
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {needsYou.length} need you · {waitingOnOthers.length} waiting
        </p>
        <button
          type="button"
          className="filter-pill min-h-[44px] rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted"
          style={{
            background: showClosed ? "var(--accent-soft)" : "var(--bg-elevated)",
            color: showClosed ? "var(--accent)" : undefined,
          }}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            if (showClosed) next.delete("closed");
            else next.set("closed", "1");
            const q = next.toString();
            router.push(q ? `${pathname}?${q}` : pathname);
          }}
        >
          {showClosed ? "Hide closed" : "Show closed"}
        </button>
      </div>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-4 py-4 text-sm font-semibold text-[var(--accent)]"
        >
          <StarIcon size={16} />
          Ask someone
        </button>
      ) : (
        <article className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              New ask
            </p>
            <button
              type="button"
              aria-label="Close"
              className="star-btn star-btn-active"
              onClick={() => setAdding(false)}
            >
              <StarIcon filled size={18} />
            </button>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted">
              No other PIN accounts to ask yet. Add an account first.
            </p>
          ) : (
            <form
              action={async (fd) => {
                await createRequest(fd);
                setAdding(false);
              }}
              className="flex flex-col gap-3"
            >
              <ComposerFields
                accounts={accounts}
                tasks={tasks}
                defaultTaskId={defaultTaskId}
                autoFocus
              />
              <button type="submit" className="btn-primary">
                Send ask
              </button>
            </form>
          )}
        </article>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Needs you</h2>
        <p className="text-sm text-muted">Asks sent to your PIN login.</p>
        {needsYou.length === 0 ? (
          <div className="card p-5 text-center text-sm text-muted">Nothing waiting on you.</div>
        ) : (
          needsYou.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              tasks={tasks}
              caps={caps[request.id]}
              defaultOpen={Boolean(defaultTaskId && request.taskId === defaultTaskId)}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Waiting on others</h2>
        <p className="text-sm text-muted">Asks you sent that are still open.</p>
        {waitingOnOthers.length === 0 ? (
          <div className="card p-5 text-center text-sm text-muted">No open asks from you.</div>
        ) : (
          waitingOnOthers.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              tasks={tasks}
              caps={caps[request.id]}
            />
          ))
        )}
      </section>

      {showClosed ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Closed</h2>
            <Link
              href={pathname}
              className="text-xs font-semibold text-[var(--accent)]"
            >
              Hide
            </Link>
          </div>
          <p className="text-sm text-muted">Done and declined asks.</p>
          {closed.length === 0 ? (
            <div className="card p-5 text-center text-sm text-muted">No closed asks yet.</div>
          ) : (
            closed.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                tasks={tasks}
                caps={caps[request.id]}
              />
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}
