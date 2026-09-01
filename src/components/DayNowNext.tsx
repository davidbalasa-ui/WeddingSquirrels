import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import { profileHref } from "@/lib/connections";
import type { DayNowBlock, DayNowNextSnapshot } from "@/lib/day-of-now";

function ContactChip({ contact }: { contact: DayNowBlock["contacts"][number] }) {
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
    </>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-[var(--card)] px-3 py-2.5">
        {inner}
      </div>
    );
  }

  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-[var(--card)] px-3 py-2.5 transition active:scale-[0.99]"
    >
      {inner}
    </a>
  );
}

function BlockCard({
  block,
  emphasis = "default",
}: {
  block: DayNowBlock;
  emphasis?: "hero" | "default";
}) {
  const isHero = emphasis === "hero";

  return (
    <article
      className={
        isHero
          ? "rounded-[1.35rem] border border-[var(--accent)] bg-[var(--accent-soft)] p-5 shadow-sm"
          : "rounded-[1.2rem] border border-line bg-[var(--card)] p-4"
      }
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          {block.status === "now" ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              Happening now
            </p>
          ) : block.status === "next" ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">
              Up next
            </p>
          ) : null}
          <p
            className={
              isHero
                ? "font-[family-name:var(--font-display)] text-[1.75rem] leading-tight"
                : "text-lg font-semibold leading-snug"
            }
          >
            {block.title}
          </p>
        </div>
        <p
          className={
            isHero
              ? "shrink-0 text-right text-sm font-semibold text-[var(--accent)]"
              : "shrink-0 text-right text-sm font-semibold text-muted"
          }
        >
          {block.timeLabel}
        </p>
      </div>

      {block.location ? (
        <p className="mb-2 text-sm font-medium text-[var(--accent)]">{block.location}</p>
      ) : null}

      {block.detailLines.length > 0 ? (
        <ul className="mb-3 space-y-1 text-sm leading-relaxed text-muted">
          {block.detailLines.slice(0, isHero ? 6 : 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {block.contacts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Tap to call
          </p>
          <div className="grid gap-2">
            {block.contacts.map((contact) => (
              <ContactChip key={`${contact.source}:${contact.id}`} contact={contact} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function DayNowNext({
  snapshot,
  canEdit,
}: {
  snapshot: DayNowNextSnapshot;
  canEdit: boolean;
}) {
  const hasContent = snapshot.now || snapshot.next || snapshot.upcoming.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Wedding day
          </p>
          <p className="font-[family-name:var(--font-display)] text-3xl leading-none">
            {snapshot.clockLabel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/day/contacts" className="text-xs font-semibold text-[var(--accent)]">
            All contacts
          </Link>
          {canEdit ? (
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
          )}
        </div>
      </div>

      {!hasContent ? (
        <div className="card p-5 text-sm text-muted">
          No timed moments on the timeline yet.
          {canEdit ? (
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
        <div className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Between moments — next up is <span className="font-semibold text-ink">{snapshot.next.title}</span>{" "}
          at {snapshot.next.startAt}.
        </div>
      ) : null}

      {snapshot.now ? <BlockCard block={snapshot.now} emphasis="hero" /> : null}

      {snapshot.next && snapshot.next.id !== snapshot.now?.id ? (
        <BlockCard block={snapshot.next} emphasis={snapshot.now ? "default" : "hero"} />
      ) : null}

      {snapshot.upcoming.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Later today
          </p>
          <div className="flex flex-col gap-3">
            {snapshot.upcoming.map((block) => (
              <BlockCard key={block.id} block={block} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
