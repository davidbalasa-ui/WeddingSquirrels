import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleIcon } from "@/components/ModuleIcon";
import { V2PageHeader } from "@/components/V2PageHeader";
import { modulesForNavTab } from "@/lib/modules";
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
  const links = modulesForNavTab(session, "people").filter((item) => item.href !== "/people");

  const extraLinks = [
    session.canSeeTimeline
      ? { key: "contacts", label: "Contacts", href: "/day/contacts", icon: "people" as const }
      : null,
    session.canSeeTimeline
      ? {
          key: "assignments",
          label: "Responsibilities",
          href: "/day/assignments",
          icon: "people" as const,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; href: string; icon: "people" }[];

  return (
    <>
      <V2PageHeader session={session} title="People" subtitle="Guests, contacts, and responsibilities" />
      {links.length === 0 && extraLinks.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No people modules are enabled for this PIN.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {links.map((item) => (
            <Link
              key={item.key}
              href={item.href!}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--accent-soft)]/40"
            >
              <ModuleIcon name={item.icon} className="h-6 w-6 shrink-0 text-[var(--accent)]" />
              <span className="flex-1 font-semibold">{item.label}</span>
              <span className="text-sm text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
          {extraLinks.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--accent-soft)]/40"
            >
              <ModuleIcon name={item.icon} className="h-6 w-6 shrink-0 text-[var(--accent)]" />
              <span className="flex-1 font-semibold">{item.label}</span>
              <span className="text-sm text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
