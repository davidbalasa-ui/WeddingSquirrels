import type { GuestRsvpReport } from "@/lib/guest-gifts";

function Stat({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: number;
  hint?: string;
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
    <div className={`rounded-xl ${bgClass} px-3 py-2`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-[family-name:var(--font-display)] text-2xl leading-tight ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function GuestRsvpReport({ report }: { report: GuestRsvpReport }) {
  return (
    <section className="card mb-3 p-4">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Invited" value={report.invited} hint="people" />
        <Stat label="Accepted" value={report.accepted} hint="people" />
        <Stat label="Awaiting" value={report.awaiting} hint="people" tone="warn" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <Stat label="Attending" value={report.attending} hint="households" />
        <Stat label="Not attending" value={report.notAttending} hint="households" tone="muted" />
        <Stat label="No reply" value={report.pending} hint="households" />
      </div>
    </section>
  );
}
