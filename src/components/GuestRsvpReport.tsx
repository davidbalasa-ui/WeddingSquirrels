import type { GuestRsvpReport } from "@/lib/guest-gifts";

function Stat({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value: number;
  tone?: "accent" | "warn" | "muted";
}) {
  const valueClass =
    tone === "warn"
      ? "text-[var(--warn)]"
      : tone === "muted"
        ? "text-ink"
        : "text-[var(--accent)]";
  const bgClass =
    tone === "warn" ? "bg-[var(--warn-soft)]" : "bg-[var(--accent-soft)]";

  return (
    <div className={`rounded-lg ${bgClass} px-2 py-1.5`}>
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className={`font-[family-name:var(--font-display)] text-xl leading-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

export function GuestRsvpReport({ report }: { report: GuestRsvpReport }) {
  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 font-semibold text-ink">RSVP summary</span>
        <span className="whitespace-nowrap text-[var(--accent)]">{report.accepted} accepted</span>
        <span className="whitespace-nowrap text-[var(--warn)]">{report.awaiting} awaiting</span>
        <span
          aria-hidden
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="grid grid-cols-3 gap-1.5 border-t border-line p-2.5">
        <Stat label="Invited people" value={report.invited} />
        <Stat label="Accepted people" value={report.accepted} />
        <Stat label="Awaiting people" value={report.awaiting} tone="warn" />
        <Stat label="Attending households" value={report.attending} />
        <Stat label="Not attending households" value={report.notAttending} tone="muted" />
        <Stat label="No-reply households" value={report.pending} />
      </div>
    </details>
  );
}
