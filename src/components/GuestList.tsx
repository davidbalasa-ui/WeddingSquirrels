"use client";

import { useState } from "react";
import Link from "next/link";
import {
  effectiveAcceptedCount,
  effectiveInvitedCount,
  groupGuestsByTable,
  guestAddressLine,
  guestNameLines,
  guestSeatingSummary,
  parseRsvpStatus,
  rsvpStatusLabel,
} from "@/lib/guest-gifts";
import type { GuestRecord } from "@/lib/guests";
import { GuestEditCard } from "@/components/GuestEditCard";

type Mode = "view" | "table" | "edit";

export function GuestList({
  guests,
  canEdit,
  startInEdit,
}: {
  guests: GuestRecord[];
  canEdit: boolean;
  startInEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>(canEdit && startInEdit ? "edit" : "view");
  const editing = canEdit && mode === "edit";

  return (
    <div className={editing ? "pb-4" : ""}>
      <div className="mb-3 flex items-center justify-between gap-3 print-hide">
        <div
          className={`grid flex-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5 ${
            canEdit ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === "view" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => setMode("view")}
          >
            View
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === "table" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => setMode("table")}
          >
            By table
          </button>
          {canEdit ? (
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                mode === "edit" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
              }`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
          ) : null}
        </div>
        <Link href="/guests/print" className="btn-secondary shrink-0 px-4 py-2 text-sm">
          Print gift list
        </Link>
      </div>

      {editing ? (
        <p className="mb-2 text-xs text-muted">
          Add family members, update seating, and track gifts. Tap + Add person for kids or extra guests.
        </p>
      ) : mode === "table" ? (
        <p className="mb-2 text-xs text-muted">Everyone listed by table number and seat order.</p>
      ) : null}

      {guests.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {editing ? "No guests yet." : "No guests yet."}
          {canEdit && !editing ? " Switch to Edit to manage guests." : null}
        </div>
      ) : editing ? (
        <div className="flex flex-col gap-3">
          {guests.map((guest) => (
            <GuestEditCard key={guest.id} guest={guest} />
          ))}
        </div>
      ) : mode === "table" ? (
        <GuestTableView guests={guests} />
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {guests.map((guest) => (
            <GuestViewRow key={guest.id} guest={guest} />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestTableView({ guests }: { guests: GuestRecord[] }) {
  const groups = groupGuestsByTable(guests);

  if (groups.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted">No guests with seating yet.</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {group.label}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {group.rows.map((row) => (
              <article key={row.personId} className="flex items-start gap-2 px-3 py-1.5">
                <p className="min-w-0 flex-1 text-[14px] font-semibold leading-5">{row.name}</p>
                {row.tableSpot ? (
                  <p className="shrink-0 whitespace-nowrap text-[12px] font-semibold leading-5 text-[var(--accent)]">
                    Seat {row.tableSpot}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GuestViewRow({ guest }: { guest: GuestRecord }) {
  const names = guestNameLines({
    nameLine1: guest.people[0]?.name ?? "",
    nameLine2: guest.people[1]?.name ?? null,
    people: guest.people,
  });
  const address = guestAddressLine(guest);
  const seating = guestSeatingSummary({ people: guest.people });
  const invited = effectiveInvitedCount({
    nameLine1: guest.people[0]?.name ?? "",
    nameLine2: guest.people[1]?.name ?? null,
    invitedCount: guest.invitedCount,
    people: guest.people,
  });
  const accepted = effectiveAcceptedCount({
    nameLine1: guest.people[0]?.name ?? "",
    nameLine2: guest.people[1]?.name ?? null,
    rsvpStatus: guest.rsvpStatus,
    invitedCount: guest.invitedCount,
    acceptedCount: guest.acceptedCount,
    people: guest.people,
  });
  const status = parseRsvpStatus(guest.rsvpStatus);
  const statusTone =
    status === "attending"
      ? "text-[var(--accent)]"
      : status === "not_attending"
        ? "text-muted"
        : "text-[var(--warn)]";

  return (
    <article className="px-3 py-1.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[14px] font-semibold leading-5">{names.join(" · ")}</p>
        <p className={`shrink-0 whitespace-nowrap text-[12px] font-semibold leading-5 ${statusTone}`}>
          {rsvpStatusLabel(guest.rsvpStatus)}
        </p>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-5 text-muted">
        {address ? <span>{address}</span> : null}
        <span className="font-semibold text-ink">
          {accepted}/{invited}
        </span>
        {guest.gifts.length > 0 ? (
          <span>
            {guest.gifts.length} gift{guest.gifts.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {seating ? <p className="mt-0.5 text-[12px] leading-5 text-[var(--accent)]">{seating}</p> : null}
    </article>
  );
}
