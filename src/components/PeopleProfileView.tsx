import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { PeopleProfile } from "@/lib/people-profile";

function ContactLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <a href={href} className="card flex min-h-[3.25rem] items-center justify-between px-4 py-3">
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        <span className="mt-0.5 block font-semibold text-[var(--accent)]">{value}</span>
      </span>
      <span aria-hidden className="text-lg text-muted">
        ›
      </span>
    </a>
  );
}

export function PeopleProfileView({ profile }: { profile: PeopleProfile }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="card flex items-center gap-4 p-5">
        <PersonAvatar name={profile.name} photoSrc={profile.photoSrc} size="lg" />
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-2xl leading-tight">
            {profile.name}
          </h2>
          {profile.subtitle ? <p className="mt-1 text-sm text-muted">{profile.subtitle}</p> : null}
          {profile.roles.length > 0 ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              {profile.roles.join(" · ")}
            </p>
          ) : null}
        </div>
      </section>

      {profile.phone || profile.email ? (
        <section className="flex flex-col gap-2">
          {profile.phone ? (
            <ContactLink href={`tel:${profile.phone}`} label="Phone" value={profile.phone} />
          ) : null}
          {profile.email ? (
            <ContactLink href={`mailto:${profile.email}`} label="Email" value={profile.email} />
          ) : null}
        </section>
      ) : null}

      {profile.openTasks.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Open tasks
          </p>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {profile.openTasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="flex min-h-[4rem] items-center justify-between gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
              >
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{task.title}</span>
                  {task.dueLabel ? (
                    <span className="mt-0.5 block text-sm text-muted">{task.dueLabel}</span>
                  ) : null}
                </span>
                <span className="text-lg text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {profile.assignments.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Day-of responsibilities
          </p>
          <div className="flex flex-col gap-2">
            {profile.assignments.map((assignment) => (
              <article key={assignment.title} className="card p-4">
                <p className="font-semibold">{assignment.title}</p>
                {assignment.notes ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{assignment.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.guestInfo ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Guest details
          </p>
          <div className="card p-4 text-sm">
            <p className="font-semibold">{profile.guestInfo.household}</p>
            <p className="mt-2 text-muted">RSVP · {profile.guestInfo.rsvpStatus}</p>
            {profile.guestInfo.table ? (
              <p className="mt-1 text-muted">{profile.guestInfo.table}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {profile.stayLabel || profile.mealStatus ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Wedding weekend
          </p>
          <div className="card p-4 text-sm">
            {profile.stayLabel ? <p>Staying · {profile.stayLabel}</p> : null}
            {profile.mealStatus ? (
              <p className={profile.stayLabel ? "mt-2 text-muted" : undefined}>
                Rehearsal dinner · {profile.mealStatus}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
