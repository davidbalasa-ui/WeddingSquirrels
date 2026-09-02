"use client";

import { useOptimistic, useState, useTransition } from "react";
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

function guestSnapshot(guest: GuestRecord, people: GuestPersonRecord[]) {
  const rsvpGuest = {
    nameLine1: people[0]?.name ?? "",
    nameLine2: people[1]?.name ?? null,
    rsvpStatus: guest.rsvpStatus,
    invitedCount: guest.invitedCount,
    acceptedCount: guest.acceptedCount,
    people,
  };
  return {
    rsvpGuest,
    serverRsvp: parseRsvpStatus(guest.rsvpStatus),
    serverInvited: String(effectiveInvitedCount(rsvpGuest)),
    serverAccepted: String(effectiveAcceptedCount(rsvpGuest)),
  };
}

export function GuestRsvpControls({
  guest,
  people,
  compact = false,
  inline = false,
}: {
  guest: GuestRecord;
  people: GuestPersonRecord[];
  compact?: boolean;
  inline?: boolean;
}) {
  const { rsvpGuest, serverRsvp, serverInvited, serverAccepted } = guestSnapshot(guest, people);
  const [optimisticRsvp, setOptimisticRsvp] = useOptimistic(serverRsvp);
  const [invited, setInvited] = useState(serverInvited);
  const [accepted, setAccepted] = useState(serverAccepted);
  const [editingField, setEditingField] = useState<"invited" | "accepted" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const syncToken = `${serverRsvp}|${serverInvited}|${serverAccepted}`;
  const [prevSyncToken, setPrevSyncToken] = useState(syncToken);
  if (syncToken !== prevSyncToken && !pending && editingField === null) {
    setPrevSyncToken(syncToken);
    setInvited(serverInvited);
    setAccepted(serverAccepted);
  }

  function persist(patch: { rsvpStatus?: RsvpStatus; invitedCount?: number; acceptedCount?: number }) {
    setError(null);
    startTransition(async () => {
      if (patch.rsvpStatus !== undefined) {
        setOptimisticRsvp(patch.rsvpStatus);
      }
      const result = await saveGuestRsvp({ guestId: guest.id, ...patch });
      if (!result.ok) {
        setInvited(serverInvited);
        setAccepted(serverAccepted);
        setError("Couldn’t save RSVP — try again.");
      }
    });
  }

  function commitInvited() {
    setEditingField(null);
    const next = parseGuestCount(invited);
    if (next == null) {
      setInvited(serverInvited);
      return;
    }
    if (next === effectiveInvitedCount(rsvpGuest)) return;
    persist({ invitedCount: next });
  }

  function commitAccepted() {
    setEditingField(null);
    const next = parseGuestCount(accepted);
    if (next == null) {
      setAccepted(serverAccepted);
      return;
    }
    if (next === effectiveAcceptedCount(rsvpGuest)) return;
    persist({ acceptedCount: next });
  }

  return (
    <div className={compact ? "" : "border-t border-line px-4 py-3"} aria-busy={pending || undefined}>
      <div
        role="radiogroup"
        aria-label="RSVP status"
        className="grid w-full grid-cols-3 gap-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5"
      >
        {RSVP_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={optimisticRsvp === option.id}
            disabled={pending}
            className={`min-w-0 whitespace-nowrap rounded-full px-1.5 py-1.5 text-[11px] font-semibold disabled:opacity-60 sm:px-2 sm:text-xs ${
              optimisticRsvp === option.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted"
            }`}
            onClick={() => {
              if (option.id === optimisticRsvp) return;
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
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving RSVP" : ""}
      </span>
      {inline ? null : (
        <div className={`grid grid-cols-2 gap-3 ${compact ? "mt-2" : "mt-3"}`}>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted"># invited</span>
            <input
              inputMode="numeric"
              value={invited}
              disabled={pending}
              onChange={(event) => setInvited(event.target.value)}
              onFocus={() => {
                setEditingField("invited");
              }}
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
              onFocus={() => {
                setEditingField("accepted");
              }}
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
