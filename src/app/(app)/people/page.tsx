import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleIcon } from "@/components/ModuleIcon";
import { PeopleDirectorySearch } from "@/components/PeopleDirectorySearch";
import { PeopleSectionGrid } from "@/components/PeopleSectionGrid";
import { V2PageHeader } from "@/components/V2PageHeader";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

export default async function PeopleHubPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; done?: string }>;
}) {
  const sp = await searchParams;
  if (sp.who || sp.done) {
    const next = new URLSearchParams();
    if (sp.who) next.set("who", sp.who);
    if (sp.done) next.set("done", sp.done);
    redirect(`/today?${next.toString()}`);
  }

  const session = await requirePageSession();
  const data = await loadPeopleHubData(session);

  const quickLinks = [
    session.canSeeGuests
      ? { key: "guests", label: "Guest list", href: "/people/guests", detail: `${data.guestCount} households` }
      : null,
    session.canSeeTimeline
      ? {
          key: "contacts",
          label: "Day-of contacts",
          href: "/people/contacts",
          detail: `${data.contactCount} contacts`,
        }
      : null,
    session.canSeeTimeline
      ? {
          key: "assignments",
          label: "Responsibilities",
          href: "/people/responsibilities",
          detail: `${data.assignmentCount} assignments`,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; href: string; detail: string }[];

  return (
    <>
      <V2PageHeader
        session={session}
        title="People"
        subtitle="Faces, roles, and who to reach"
      />

      <PeopleSectionGrid sections={data.sections} />

      {quickLinks.length > 0 ? (
        <section className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Lists
          </p>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {quickLinks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex min-h-[4.5rem] items-center gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ModuleIcon name="people" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-[family-name:var(--font-display)] text-lg leading-tight">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{item.detail}</span>
                </span>
                <span className="text-lg text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.entries.length > 0 ? <PeopleDirectorySearch entries={data.entries} /> : (
        <div className="card p-5 text-sm text-muted">No people are visible for this PIN yet.</div>
      )}
    </>
  );
}
