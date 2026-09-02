"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import { profileHref } from "@/lib/connections";
import {
  buildDayNowNextSnapshot,
  type DayNowBlock,
  type DayNowNextSnapshot,
  type TimelineBlockInput,
} from "@/lib/day-of-now";

export type DayNowLiveSource = {
  blocks: TimelineBlockInput[];
  contacts: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }>;
  people: Array<{ id: string; name: string }>;
  daysToGo: number | null;
};

function ContactRow({ contact }: { contact: DayNowBlock["contacts"][number] }) {
  const href = contact.phone
    ? `tel:${contact.phone.replace(/[^\d+]/g, "")}`
    : contact.email
      ? `mailto:${contact.email}`
      : contact.profileId
        ? profileHref(contact.profileId)
        : null;

  const inner = (
    <>
      <PersonAvatar name={contact.name} photoSrc={contact.photoSrc} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{contact.name}</span>
        {contact.phone ? (
          <span className="block truncate text-xs text-muted">{contact.phone}</span>
        ) : contact.email ? (
          <span className="block truncate text-xs text-muted">{contact.email}</span>
        ) : (
          <span className="block text-xs text-muted">View profile</span>
        )}
      </span>
      {href ? (
        <span className="shrink-0 text-sm text-muted" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return <div className="flex items-center gap-2 py-1.5">{inner}</div>;
  }

  return (
    <a href={href} className="flex items-center gap-2 py-1.5 transition active:opacity-80">
      {inner}
    </a>
  );
}

function BlockRow({
  block,
  emphasis = "default",
}: {
  block: DayNowBlock;
  emphasis?: "now" | "next" | "default";
}) {
  const bgClass =
    emphasis === "now"
      ? "bg-[var(--accent-soft)]/55"
      : emphasis === "next"
        ? "bg-[var(--accent-soft)]/25"
        : "";

  const detailLimit = emphasis === "now" ? 4 : emphasis === "next" ? 3 : 2;
  const visibleDetails = block.detailLines.slice(0, detailLimit);

  return (
    <article className={`px-3 py-2 ${bgClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {block.status === "now" ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              Happening now
            </p>
          ) : block.status === "next" ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">
              Up next
            </p>
          ) : null}
          <p className="text-[15px] font-semibold leading-snug">{block.title}</p>
          {block.location ? (
            <p className="mt-0.5 text-xs font-semibold text-[var(--accent)]">{block.location}</p>
          ) : null}
        </div>
        <p
          className={`shrink-0 text-right text-xs font-semibold ${
            emphasis === "now" ? "text-[var(--accent)]" : "text-muted"
          }`}
        >
          {block.timeLabel}
        </p>
      </div>

      {visibleDetails.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-sm leading-snug text-muted">
          {visibleDetails.map((line) => (
            <li key={line} className="line-clamp-2">{line}</li>
          ))}
        </ul>
      ) : null}

      {block.contacts.length > 0 ? (
        <div className="mt-2 border-t border-line/70 pt-1">
          <p className="pb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Tap to call
          </p>
          <div className="divide-y divide-[var(--line)]">
            {block.contacts.map((contact) => (
              <ContactRow key={`${contact.source}:${contact.id}`} contact={contact} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function DayNowNext({
  snapshot: initialSnapshot,
  liveSource,
  canEdit,
  offline = false,
  onAllContacts,
}: {
  snapshot: DayNowNextSnapshot;
  liveSource?: DayNowLiveSource;
  canEdit: boolean;
  offline?: boolean;
  onAllContacts?: () => void;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    if (!liveSource) return;

    const tick = () => {
      setSnapshot(
        buildDayNowNextSnapshot(liveSource.blocks, liveSource.contacts, liveSource.people, {
          daysToGo: liveSource.daysToGo,
        }),
      );
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [liveSource]);

  const hasContent = snapshot.now || snapshot.next || snapshot.upcoming.length > 0;
  const nowBlock = snapshot.now;
  const nextBlock = snapshot.next;
  const nowId = nowBlock?.id ?? null;
  const showNowNextCard = Boolean(nowBlock) || Boolean(nextBlock && nextBlock.id !== nowId);
  const nextEmphasis: "now" | "next" = nowBlock ? "next" : "now";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {offline ? "Offline · wedding day" : "Wedding day"}
          </p>
          <p
            className="font-[family-name:var(--font-display)] text-2xl leading-none"
            aria-live="polite"
            aria-atomic="true"
          >
            {snapshot.clockLabel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {offline ? (
            onAllContacts ? (
              <button
                type="button"
                className="text-xs font-semibold text-[var(--accent)]"
                onClick={onAllContacts}
              >
                All contacts
              </button>
            ) : null
          ) : (
            <Link href="/day/contacts" className="text-xs font-semibold text-[var(--accent)]">
              All contacts
            </Link>
          )}
          {!offline ? (
            canEdit ? (
              <Link
                href="/day?view=timeline&edit=1"
                className="text-xs font-semibold text-[var(--accent)]"
              >
                Edit timeline
              </Link>
            ) : (
              <Link href="/day?view=timeline" className="text-xs font-semibold text-[var(--accent)]">
                Full timeline
              </Link>
            )
          ) : null}
        </div>
      </div>

      {!hasContent ? (
        <div className="card px-3 py-4 text-sm text-muted">
          No timed moments on the timeline yet.
          {canEdit && !offline ? (
            <>
              {" "}
              <Link href="/day?view=timeline&edit=1" className="font-semibold text-[var(--accent)]">
                Add the run of show
              </Link>
              .
            </>
          ) : null}
        </div>
      ) : null}

      {snapshot.betweenMoments && snapshot.next ? (
        <div className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
          Between moments — next up is <span className="font-semibold text-ink">{snapshot.next.title}</span>{" "}
          at {snapshot.next.startAt}.
        </div>
      ) : null}

      {showNowNextCard ? (
        <section className="card divide-y divide-[var(--line)] overflow-hidden">
          {nowBlock ? <BlockRow block={nowBlock} emphasis="now" /> : null}
          {nextBlock && nextBlock.id !== nowId ? (
            <BlockRow block={nextBlock} emphasis={nextEmphasis} />
          ) : null}
        </section>
      ) : null}

      {snapshot.upcoming.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Later today · {snapshot.upcoming.length}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {snapshot.upcoming.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
