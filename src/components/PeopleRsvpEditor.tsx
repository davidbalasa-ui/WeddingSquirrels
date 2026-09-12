"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfileGuestRsvp } from "@/app/actions";
import { parseRsvpStatus, RSVP_STATUSES, rsvpStatusLabel, type RsvpStatus } from "@/lib/guest-gifts";

export function PeopleRsvpEditor({
  profileId,
  rsvpStatus,
  canEdit,
}: {
  profileId: string;
  rsvpStatus: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const serverRsvp = parseRsvpStatus(rsvpStatus);
  const [currentRsvp, setCurrentRsvp] = useState<RsvpStatus>(serverRsvp);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentRsvp(parseRsvpStatus(rsvpStatus));
  }, [rsvpStatus]);

  if (!canEdit) {
    return (
      <div className="flex min-h-14 items-start justify-between gap-3 border-b border-[var(--line)] py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] font-semibold leading-snug">{rsvpStatusLabel(currentRsvp)}</p>
          <p className="mt-1 text-sm text-muted">RSVP</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--line)] py-3.5" aria-busy={pending || undefined}>
      <p className="text-sm text-muted">RSVP</p>
      <div
        role="radiogroup"
        aria-label="RSVP status"
        className="mt-2 grid w-full grid-cols-3 gap-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5"
      >
        {RSVP_STATUSES.map((status: RsvpStatus) => (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={currentRsvp === status}
            disabled={pending}
            className={`min-w-0 whitespace-nowrap rounded-full px-1.5 py-1.5 text-[11px] font-semibold disabled:opacity-60 sm:px-2 sm:text-xs ${
              currentRsvp === status
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted"
            }`}
            onClick={() => {
              if (status === currentRsvp) return;
              setError(null);
              const previous = currentRsvp;
              setCurrentRsvp(status);
              startTransition(async () => {
                const result = await saveProfileGuestRsvp(profileId, status);
                if (!result.ok) {
                  setCurrentRsvp(previous);
                  setError("Couldn’t save RSVP — try again.");
                  return;
                }
                setCurrentRsvp(status);
                router.refresh();
              });
            }}
          >
            {rsvpStatusLabel(status)}
          </button>
        ))}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving RSVP" : `RSVP ${rsvpStatusLabel(currentRsvp)}`}
      </span>
      {error ? <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
