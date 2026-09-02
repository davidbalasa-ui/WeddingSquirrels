import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleIcon } from "@/components/ModuleIcon";
import { PeopleDirectorySearch } from "@/components/PeopleDirectorySearch";
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
          label: "Day-of call list",
          href: "/day/contacts",
          detail: `${data.contactCount} on the call sheet`,
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
        subtitle="Guest list, day-of contacts, and vendors — each on its own tab"
      />

      {quickLinks.length > 0 ? (
        <section className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Lists
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {quickLinks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ModuleIcon name="people" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{item.detail}</span>
                </span>
                <span className="shrink-0 text-sm text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.entries.length > 0 ? (
        <PeopleDirectorySearch entries={data.entries} />
      ) : (
        <div className="card px-3 py-4 text-sm text-muted">No people are visible for this PIN yet.</div>
      )}
    </>
  );
}
