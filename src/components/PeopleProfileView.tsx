"use client";

import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import { PeopleDeleteButton } from "@/components/PeopleDeleteButton";
import { PeopleListEditor } from "@/components/PeopleListEditor";
import { PeopleRoleEditor } from "@/components/PeopleRoleEditor";
import { formatMoney } from "@/lib/money";
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
    <a
      href={href}
      className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30 last:border-b-0"
    >
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
    <div className="flex flex-col gap-4">
      <section className="card flex items-center gap-3 px-3 py-3">
        <PersonAvatar name={profile.name} photoSrc={profile.photoSrc} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight">
            {profile.name}
          </h2>
          {profile.subtitle && !profile.directoryLabel ? (
            <p className="mt-0.5 text-sm text-muted">{profile.subtitle}</p>
          ) : null}
          <PeopleRoleEditor
            profileId={profile.profileId}
            label={profile.directoryLabel ?? profile.roles[0] ?? null}
            canEdit={profile.canEditLabel}
          />
        </div>
      </section>

      <section className="card flex flex-col gap-3 px-3 py-3">
        <PeopleListEditor
          profileId={profile.profileId}
          currentList={profile.list}
          canEdit={profile.canEditList}
        />
        <PeopleDeleteButton
          profileId={profile.profileId}
          name={profile.name}
          canDelete={profile.canDelete}
        />
      </section>

      {profile.phone || profile.email ? (
        <section className="card divide-y divide-[var(--line)] overflow-hidden">
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
              className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
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
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {profile.assignments.map((assignment) => (
              <article key={assignment.title} className="px-3 py-2">
                <p className="font-semibold leading-snug">{assignment.title}</p>
                {assignment.notes ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{assignment.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.relatedLinks.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Connected
          </p>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {profile.relatedLinks.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{link.label}</span>
                  <span className="mt-0.5 block text-sm text-muted">{link.detail}</span>
                </span>
                <span className="text-lg text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {profile.budgetContracts.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Vendor contracts
          </p>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {profile.budgetContracts.map((contract) => (
            <Link
              key={contract.id}
              href={contract.href}
              className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{contract.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {contract.remaining > 0 ? `${formatMoney(contract.remaining)} remaining` : "Paid in full"}
                  </span>
                </span>
                <span className="text-lg text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {profile.guestInfo ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Guest details
          </p>
          <div className="card px-3 py-3 text-sm">
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
          <div className="card px-3 py-3 text-sm">
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
