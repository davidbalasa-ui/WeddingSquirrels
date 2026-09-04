import type { GuestRsvpReport } from "@/lib/guest-gifts";

export function PeopleRsvpPulse({ report }: { report: GuestRsvpReport }) {
  return (
    <p className="mb-5 text-sm text-muted">
      <span className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">
        {report.accepted}
      </span>{" "}
      accepted
      <span className="mx-2 text-[var(--line)]">·</span>
      <span className="font-[family-name:var(--font-display)] text-lg text-[var(--warn)]">
        {report.awaiting}
      </span>{" "}
      still to reply
    </p>
  );
}
