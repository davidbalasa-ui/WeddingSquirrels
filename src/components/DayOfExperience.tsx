"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lockAction } from "@/app/actions";
import { DayTabs } from "@/components/DayTabs";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  contactChannelHref,
  formatMinutesUntil,
  viewFromExperienceSource,
  type DayOfContact,
  type DayOfExperienceSource,
  type DayOfMoment,
  type DayOfResponsibility,
  type DayOfView,
} from "@/lib/day-of";

const CLOCK_INTERVAL_MS = 30_000;

function isPastMoment(moment: DayOfMoment, view: DayOfView): boolean {
  if (view.mode === "completed") return true;
  if (view.mode !== "live") return false;
  if (view.position.now?.id === moment.id) return false;
  if (view.position.next?.id === moment.id) return false;
  if (view.position.afterNext?.id === moment.id) return false;
  if (moment.startKey == null) return false;
  return moment.startKey < view.position.nowKey;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{children}</p>
  );
}

function LogoutButton() {
  return (
    <form action={lockAction}>
      <button
        type="submit"
        className="min-h-11 px-1 text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Log out
      </button>
    </form>
  );
}

function MomentNotes({ moment, limit = 3 }: { moment: DayOfMoment; limit?: number }) {
  const lines = moment.detailLines.slice(0, limit);
  if (!moment.location && lines.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {moment.location ? (
        <p className="text-sm font-semibold text-[var(--accent)]">{moment.location}</p>
      ) : null}
      {lines.map((line) => (
        <p key={line} className="text-sm leading-relaxed text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}

function TimelineRow({
  moment,
  past,
  emphasis = "default",
}: {
  moment: DayOfMoment;
  past?: boolean;
  emphasis?: "default" | "later";
}) {
  return (
    <article
      className={`flex items-start gap-4 py-3 ${past ? "opacity-45" : ""}`}
    >
      <p
        className={`w-[4.75rem] shrink-0 pt-0.5 text-sm font-semibold ${
          past ? "text-muted" : "text-[var(--accent)]"
        }`}
      >
        {moment.startAt}
      </p>
      <div className="min-w-0 flex-1">
        <p className={`leading-snug ${emphasis === "later" ? "font-semibold" : "font-semibold"}`}>
          {moment.title}
        </p>
        {moment.location && !past ? (
          <p className="mt-0.5 text-sm text-muted">{moment.location}</p>
        ) : null}
      </div>
    </article>
  );
}

function ContactActions({ contact }: { contact: DayOfContact }) {
  const actions: Array<{ href: string; label: string; sr: string }> = [];
  if (contact.phone) {
    actions.push({
      href: contactChannelHref(contact.phone, "tel"),
      label: "Call",
      sr: `Call ${contact.name}`,
    });
    actions.push({
      href: contactChannelHref(contact.phone, "sms"),
      label: "Text",
      sr: `Text ${contact.name}`,
    });
  }
  if (contact.email) {
    actions.push({
      href: contactChannelHref(contact.email, "mailto"),
      label: "Email",
      sr: `Email ${contact.name}`,
    });
  }
  if (actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className="inline-flex min-h-12 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-line bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--accent)]"
        >
          <span className="sr-only">{action.sr}</span>
          <span aria-hidden="true">{action.label}</span>
        </a>
      ))}
    </div>
  );
}

function NeedSomeone({ contacts }: { contacts: DayOfContact[] }) {
  if (contacts.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="need-someone-heading">
      <h2 id="need-someone-heading" className="font-[family-name:var(--font-display)] text-xl tracking-tight">
        Need someone?
      </h2>
      <ul className="mt-4 space-y-5">
        {contacts.map((contact) => (
          <li key={contact.id} className="card p-4">
            <div className="flex items-start gap-3">
              <PersonAvatar name={contact.name} photoSrc={contact.photoSrc} size="md" />
              <div className="min-w-0 flex-1">
                {contact.profileHref ? (
                  <Link href={contact.profileHref} className="block font-semibold leading-snug underline-offset-4 hover:underline">
                    {contact.name}
                  </Link>
                ) : (
                  <p className="font-semibold leading-snug">{contact.name}</p>
                )}
                {contact.context ? <p className="mt-0.5 text-sm text-muted">{contact.context}</p> : null}
              </div>
            </div>
            <ContactActions contact={contact} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Responsibilities({ items }: { items: DayOfResponsibility[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="responsibilities-heading">
      <h2 id="responsibilities-heading" className="font-[family-name:var(--font-display)] text-xl tracking-tight">
        Your responsibilities
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--accent)]"
            />
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{item.title}</p>
              {item.notes ? <p className="mt-1 text-sm leading-relaxed text-muted">{item.notes}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FullDayList({ view }: { view: DayOfView }) {
  if (view.position.fullDay.length === 0) return null;
  return (
    <ol className="divide-y divide-[var(--line)]">
      {view.position.fullDay.map((moment) => (
        <li key={moment.id}>
          <TimelineRow moment={moment} past={isPastMoment(moment, view)} />
        </li>
      ))}
    </ol>
  );
}

function LiveHero({ view }: { view: DayOfView }) {
  return (
    <header className="pt-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Today</p>
        <LogoutButton />
      </div>
      <p
        className="mt-3 font-[family-name:var(--font-display)] text-[3.15rem] leading-none tracking-tight"
        aria-live="polite"
        aria-atomic="true"
      >
        {view.clockLabel}
      </p>
      {view.coupleNames ? (
        <p className="mt-3 text-base text-muted">{view.coupleNames}</p>
      ) : null}
    </header>
  );
}

function PreviewHero({ view }: { view: DayOfView }) {
  return (
    <header className="pt-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Wedding day
        </p>
        <LogoutButton />
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight">
        {view.weddingDateLabel ?? "The wedding day"}
      </h1>
      <p className="mt-3 text-base text-muted">Here&apos;s how the day is planned.</p>
      {view.coupleNames ? <p className="mt-1 text-sm text-muted">{view.coupleNames}</p> : null}
    </header>
  );
}

function CompletedHero({ view }: { view: DayOfView }) {
  return (
    <header className="pt-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Wedding day
        </p>
        <LogoutButton />
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight">
        The day is yours
      </h1>
      <p className="mt-3 text-base text-muted">The scheduled timeline is complete.</p>
      {view.weddingDateLabel ? (
        <p className="mt-1 text-sm text-muted">{view.weddingDateLabel}</p>
      ) : null}
    </header>
  );
}

function LiveNow({ view }: { view: DayOfView }) {
  const { position } = view;
  if (position.kind === "after_final") {
    return (
      <section className="mt-10" aria-labelledby="now-heading">
        <h2
          id="now-heading"
          className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.1] tracking-tight"
        >
          The day is yours
        </h2>
        <p className="mt-2 text-base text-muted">The scheduled timeline is complete.</p>
      </section>
    );
  }

  if (position.kind === "empty") {
    return null;
  }

  if (position.kind === "before_first") {
    return (
      <section className="mt-10" aria-labelledby="now-heading">
        <SectionLabel>Now</SectionLabel>
        <h2
          id="now-heading"
          className="mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-[1.1] tracking-tight"
        >
          The day is just getting started.
        </h2>
      </section>
    );
  }

  if (position.kind === "between") {
    return (
      <section className="mt-10" aria-labelledby="now-heading">
        <SectionLabel>Now</SectionLabel>
        <h2
          id="now-heading"
          className="mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-[1.1] tracking-tight"
        >
          A little breathing room.
        </h2>
      </section>
    );
  }

  if (!position.now) return null;

  return (
    <section className="mt-10" aria-labelledby="now-heading">
      <SectionLabel>Now</SectionLabel>
      <h2
        id="now-heading"
        className="mt-2 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.08] tracking-tight"
        aria-live="polite"
      >
        {position.now.title}
      </h2>
      <p className="mt-3 text-base font-semibold text-[var(--accent)]">{position.now.timeLabel}</p>
      <MomentNotes moment={position.now} />
    </section>
  );
}

function LiveNext({ view }: { view: DayOfView }) {
  const next = view.position.next;
  if (!next) return null;
  const until = formatMinutesUntil(view.position.minutesUntilNext);
  return (
    <section className="mt-8" aria-labelledby="next-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="next-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Next{next.startAt ? ` · ${next.startAt}` : ""}
        </h2>
        {until ? <p className="text-sm text-muted">{until}</p> : null}
      </div>
      <p className="mt-2 text-xl font-semibold leading-snug">{next.title}</p>
      {next.location ? <p className="mt-1 text-sm text-muted">{next.location}</p> : null}
    </section>
  );
}

function AfterThat({ view }: { view: DayOfView }) {
  const after = view.position.afterNext;
  if (!after) return null;
  return (
    <section className="mt-8" aria-labelledby="after-heading">
      <h2 id="after-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        After that
      </h2>
      <div className="mt-2 flex items-start gap-4">
        <p className="w-[4.75rem] shrink-0 text-sm font-semibold text-muted">{after.startAt}</p>
        <p className="font-semibold leading-snug">{after.title}</p>
      </div>
    </section>
  );
}

function LaterToday({ view }: { view: DayOfView }) {
  if (view.position.laterToday.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="later-heading">
      <h2 id="later-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Later today
      </h2>
      <ol className="mt-2 divide-y divide-[var(--line)]">
        {view.position.laterToday.map((moment) => (
          <li key={moment.id}>
            <TimelineRow moment={moment} emphasis="later" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function FullDayDisclosure({ view }: { view: DayOfView }) {
  if (view.position.fullDay.length === 0) return null;
  return (
    <section className="mt-10">
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center font-semibold text-[var(--accent)]">
          View full day
        </summary>
        <div className="mt-3">
          <FullDayList view={view} />
        </div>
      </details>
    </section>
  );
}

export function DayOfExperience({
  source,
  initialView,
  canEdit,
  showTabs = true,
}: {
  source: DayOfExperienceSource;
  initialView: DayOfView;
  canEdit: boolean;
  showTabs?: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (source.freezeClock) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, CLOCK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [source.freezeClock]);

  const view = now ? viewFromExperienceSource(source, now) : initialView;

  return (
    <div className="pb-6">
      {view.mode === "live" ? (
        <LiveHero view={view} />
      ) : view.mode === "completed" ? (
        <CompletedHero view={view} />
      ) : (
        <PreviewHero view={view} />
      )}

      {view.mode === "live" ? (
        <>
          <LiveNow view={view} />
          <LiveNext view={view} />
          <AfterThat view={view} />
          <Responsibilities items={view.responsibilities} />
          <NeedSomeone contacts={view.contacts} />
          <LaterToday view={view} />
          <FullDayDisclosure view={view} />
        </>
      ) : (
        <>
          {view.position.fullDay.length > 0 ? (
            <section className="mt-10" aria-labelledby="planned-heading">
              <h2 id="planned-heading" className="sr-only">
                {view.mode === "completed" ? "The wedding day timeline" : "The planned wedding day"}
              </h2>
              <FullDayList view={view} />
            </section>
          ) : (
            <p className="mt-10 text-base text-muted">The wedding-day timeline is still taking shape.</p>
          )}
          <Responsibilities items={view.responsibilities} />
          <NeedSomeone contacts={view.contacts} />
        </>
      )}

      {canEdit ? (
        <p className="mt-10">
          <Link
            href="/plan/timeline"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-muted underline-offset-4 hover:underline"
          >
            Edit timeline in Plan
          </Link>
        </p>
      ) : null}

      {showTabs ? (
        <div className="mt-10">
          <DayTabs />
        </div>
      ) : null}
    </div>
  );
}
