"use client";

import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import { PeopleDeleteButton } from "@/components/PeopleDeleteButton";
import { PeopleMembershipEditor } from "@/components/PeopleMembershipEditor";
import { PeopleRoleEditor } from "@/components/PeopleRoleEditor";
import { formatMoney } from "@/lib/money";
import { rsvpStatusLabel } from "@/lib/guest-gifts";
import {
  firstName,
  omitFabricatedValue,
  profileContactActions,
  profileDisplayLabel,
  profilePhotoSrc,
  profileRoleChips,
  tasksEmptyLabel,
  visibleProfileSections,
} from "@/lib/people-experience";
import type { PeopleProfile } from "@/lib/people-profile";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{children}</p>
  );
}

function ProfileRow({
  href,
  title,
  detail,
}: {
  href?: string;
  title: string;
  detail?: string | null;
}) {
  const body = (
    <div className="flex min-h-14 items-start justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[1.05rem] font-semibold leading-snug">{title}</p>
        {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      </div>
      {href ? (
        <span className="shrink-0 pt-0.5 text-lg text-muted" aria-hidden>
          ›
        </span>
      ) : null}
    </div>
  );

  if (!href) return <div className="border-b border-[var(--line)]">{body}</div>;

  return (
    <Link href={href} className="block border-b border-[var(--line)] transition-colors hover:bg-[var(--accent-soft)]/25">
      {body}
    </Link>
  );
}

export function PeopleProfileView({ profile }: { profile: PeopleProfile }) {
  const chips = profileRoleChips(profile);
  const sections = visibleProfileSections(profile);
  const actions = profileContactActions(profile);
  const photoSrc = profilePhotoSrc(profile.photoSrc);
  const displayLabel = profileDisplayLabel(profile);
  const givenName = firstName(profile.name);
  const rsvp = profile.guestInfo ? omitFabricatedValue(rsvpStatusLabel(profile.guestInfo.rsvpStatus)) : null;
  const table = omitFabricatedValue(profile.guestInfo?.table);
  const household = omitFabricatedValue(profile.guestInfo?.household);
  const phone = omitFabricatedValue(profile.phone);
  const email = omitFabricatedValue(profile.email);
  const vendorContext = omitFabricatedValue(profile.vendorContext);
  const stayLabel = omitFabricatedValue(profile.stayLabel);
  const mealStatus = omitFabricatedValue(profile.mealStatus);
  const gifts = profile.gifts.map((gift) => omitFabricatedValue(gift)).filter((gift): gift is string => Boolean(gift));

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <div className="flex items-start gap-4">
          <PersonAvatar name={profile.name} photoSrc={photoSrc} size="lg" />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.05] tracking-tight">
              {profile.name}
            </h1>
            {displayLabel ? <p className="mt-2 text-base text-muted">{displayLabel}</p> : null}
            {chips.length > 0 ? (
              <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{chips.join(" · ")}</p>
            ) : null}
          </div>
        </div>
      </header>

      {actions.length > 0 ? (
        <div className="mb-8 flex flex-wrap gap-2">
          {actions.map((action) => (
            <a
              key={`${action.label}-${action.href}`}
              href={action.href}
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent)]"
            >
              {action.label}
            </a>
          ))}
        </div>
      ) : null}

      {sections.includes("contact") ? (
        <section className="mb-8">
          <SectionTitle>Contact</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            {phone ? <ProfileRow title={phone} detail="Phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`} /> : null}
            {email ? <ProfileRow title={email} detail="Email" href={`mailto:${email}`} /> : null}
          </div>
        </section>
      ) : null}

      {sections.includes("guest") && profile.guestInfo ? (
        <section className="mb-8">
          <SectionTitle>Guest</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            {household ? <ProfileRow title={household} detail="Household" href="/people?tab=guests" /> : null}
            {rsvp ? <ProfileRow title={rsvp} detail="RSVP" /> : null}
            {table ? <ProfileRow title={table} detail="Seating" /> : null}
            {gifts.map((gift) => (
              <ProfileRow key={gift} title={gift} detail="Gift" href="/people?tab=guests" />
            ))}
          </div>
        </section>
      ) : null}

      {sections.includes("vendor") && vendorContext ? (
        <section className="mb-8">
          <SectionTitle>{profile.isDayOfContact && profile.primaryList !== "vendors" ? "Day-of" : "Vendor"}</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            <ProfileRow title={vendorContext} detail={profile.isDayOfContact ? "Day-of contact" : "Vendor contact"} />
          </div>
        </section>
      ) : null}

      {sections.includes("tasks") ? (
        <section className="mb-8">
          <SectionTitle>Tasks</SectionTitle>
          {profile.openTasks.length === 0 ? (
            <p className="mt-3 text-base text-muted">{tasksEmptyLabel(profile.name)}</p>
          ) : (
            <div className="mt-1 border-t border-[var(--line)]">
              {profile.openTasks.map((task) => (
                <ProfileRow key={task.id} href={task.href} title={task.title} detail={task.dueLabel} />
              ))}
            </div>
          )}
          {profile.completedTaskCount > 0 ? (
            <p className="mt-3 text-sm text-muted">
              {profile.completedTaskCount} completed
              {profile.openTasks.length > 0 ? ` · ${profile.openTasks.length} open` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {sections.includes("meals") && mealStatus ? (
        <section className="mb-8">
          <SectionTitle>Meals</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            <ProfileRow title={mealStatus} detail="Rehearsal dinner" href="/rehearsal" />
          </div>
        </section>
      ) : null}

      {sections.includes("stay") && stayLabel ? (
        <section className="mb-8">
          <SectionTitle>Stay</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            <ProfileRow title={stayLabel} href="/stay" />
          </div>
        </section>
      ) : null}

      {sections.includes("day-of") ? (
        <section className="mb-8">
          <SectionTitle>Day-of responsibilities</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            {profile.assignments.map((assignment) => (
              <ProfileRow
                key={assignment.title}
                title={assignment.title}
                detail={assignment.notes}
                href="/people/responsibilities"
              />
            ))}
          </div>
        </section>
      ) : null}

      {sections.includes("budget") ? (
        <section className="mb-8">
          <SectionTitle>Money</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            {profile.budgetContracts.map((contract) => (
              <ProfileRow
                key={contract.id}
                href={contract.href}
                title={contract.name}
                detail={contract.remaining > 0 ? `${formatMoney(contract.remaining)} remaining` : "Paid in full"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {sections.includes("related") ? (
        <section className="mb-8">
          <SectionTitle>Also in the wedding</SectionTitle>
          <div className="mt-1 border-t border-[var(--line)]">
            {profile.relatedLinks.map((link) => (
              <ProfileRow key={link.href + link.label} href={link.href} title={link.label} detail={link.detail} />
            ))}
          </div>
        </section>
      ) : null}

      {profile.canEditLabel || profile.canEditPrimaryList || profile.canEditDayOf || profile.canDelete ? (
        <details className="mb-8">
          <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-muted [&::-webkit-details-marker]:hidden">
            Edit {givenName}
          </summary>
          <div className="mt-3 flex flex-col gap-5 border-t border-[var(--line)] pt-4">
            <PeopleRoleEditor
              profileId={profile.profileId}
              label={profile.directoryLabel}
              canEdit={profile.canEditLabel}
            />
            <PeopleMembershipEditor
              profileId={profile.profileId}
              primaryList={profile.primaryList}
              isDayOfContact={profile.isDayOfContact}
              canEditPrimaryList={profile.canEditPrimaryList}
              canEditDayOf={profile.canEditDayOf}
            />
            <PeopleDeleteButton
              profileId={profile.profileId}
              name={profile.name}
              canDelete={profile.canDelete}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
