"use client";

import { useState, useTransition } from "react";
import { saveGuestRsvp } from "@/app/actions";
import {
  effectiveAcceptedCount,
  effectiveInvitedCount,
  parseGuestCount,
  parseRsvpStatus,
  type RsvpStatus,
} from "@/lib/guest-gifts";
import type { GuestPersonRecord, GuestRecord } from "@/lib/guests";

const RSVP_OPTIONS: { id: RsvpStatus; label: string }[] = [
  { id: "pending", label: "No reply" },
  { id: "attending", label: "Attending" },
  { id: "not_attending", label: "Not attending" },
];

export function GuestRsvpControls({
  guest,
  people,
  compact = false,
  inline = false,
}: {
  guest: GuestRecord;
  people: GuestPersonRecord[];
  compact?: boolean;
  /** Pills only — hides invited/accepted count fields. */
  inline?: boolean;
}) {
  const rsvpGuest = {
    nameLine1: people[0]?.name ?? "",
    nameLine2: people[1]?.name ?? null,
    rsvpStatus: guest.rsvpStatus,
    invitedCount: guest.invitedCount,
    acceptedCount: guest.acceptedCount,
    people,
  };
  const [rsvp, setRsvp] = useState<RsvpStatus>(parseRsvpStatus(guest.rsvpStatus));
  const [invited, setInvited] = useState(String(effectiveInvitedCount(rsvpGuest)));
  const [accepted, setAccepted] = useState(String(effectiveAcceptedCount(rsvpGuest)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(patch: { rsvpStatus?: RsvpStatus; invitedCount?: number; acceptedCount?: number }) {
    setError(null);
    startTransition(async () => {
      const result = await saveGuestRsvp({ guestId: guest.id, ...patch });
      if (!result.ok) {
        setRsvp(parseRsvpStatus(guest.rsvpStatus));
        setInvited(String(effectiveInvitedCount(rsvpGuest)));
        setAccepted(String(effectiveAcceptedCount(rsvpGuest)));
        setError("Couldn’t save RSVP — try again.");
      }
    });
  }

  function commitInvited() {
    const next = parseGuestCount(invited);
    if (next == null) {
      setInvited(String(effectiveInvitedCount(rsvpGuest)));
      return;
    }
    if (next === effectiveInvitedCount(rsvpGuest)) return;
    persist({ invitedCount: next });
  }

  function commitAccepted() {
    const next = parseGuestCount(accepted);
    if (next == null) {
      setAccepted(String(effectiveAcceptedCount(rsvpGuest)));
      return;
    }
    if (next === effectiveAcceptedCount(rsvpGuest)) return;
    persist({ acceptedCount: next });
  }

  return (
    <div className={compact ? "" : "border-t border-line px-4 py-3"}>
      <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5">
        {RSVP_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending}
            className={`rounded-full px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
              rsvp === option.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted"
            }`}
            onClick={() => {
              if (option.id === rsvp) return;
              setRsvp(option.id);
              if (option.id === "not_attending") setAccepted("0");
              if (option.id === "attending" && (parseGuestCount(accepted) ?? 0) === 0) {
                setAccepted(invited);
              }
              persist({ rsvpStatus: option.id });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {inline ? null : (
        <div className={`grid grid-cols-2 gap-3 ${compact ? "mt-2" : "mt-3"}`}>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted"># invited</span>
            <input
              inputMode="numeric"
              value={invited}
              disabled={pending}
              onChange={(event) => setInvited(event.target.value)}
              onBlur={commitInvited}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="field-input"
              aria-label="Number invited"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted"># accepted</span>
            <input
              inputMode="numeric"
              value={accepted}
              disabled={pending}
              onChange={(event) => setAccepted(event.target.value)}
              onBlur={commitAccepted}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="field-input"
              aria-label="Number accepted"
            />
          </label>
        </div>
      )}
      {error ? <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
