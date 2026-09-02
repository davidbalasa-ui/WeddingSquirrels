"use client";

import { useState } from "react";
import Link from "next/link";
import {
  groupGuestsByTable,
  guestAddressLine,
  guestNameLines,
  guestSeatingSummary,
} from "@/lib/guest-gifts";
import type { GuestRecord } from "@/lib/guests";
import { GuestEditCard } from "@/components/GuestEditCard";
import { GuestRsvpControls } from "@/components/GuestRsvpControls";
import { DayOfCallListToggle } from "@/components/DayOfCallListToggle";
import { profileIdForGuestPerson } from "@/lib/people-directory";

type Mode = "list" | "table";

export function GuestList({
  guests,
  canEdit,
  canEditDayOf,
}: {
  guests: GuestRecord[];
  canEdit: boolean;
  canEditDayOf?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("list");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 print-hide">
        <div className="grid flex-1 grid-cols-2 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === "list" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => setMode("list")}
          >
            List
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
        </div>
        <Link href="/guests/print" className="btn-secondary shrink-0 px-4 py-2 text-sm">
          Print gift list
        </Link>
      </div>

      {mode === "list" && canEdit ? (
        <p className="mb-2 text-xs text-muted">
          Tap a reply to change it. Tap a household to add people, seats, or gifts. Use the checkbox to put someone on the day-of call list.
        </p>
      ) : mode === "table" ? (
        <p className="mb-2 text-xs text-muted">Everyone listed by table. Floor plan shows where each table sits.</p>
      ) : null}

      {guests.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">No guests yet.</div>
      ) : mode === "table" ? (
        <GuestTableView guests={guests} />
      ) : (
        <div className="flex flex-col gap-2">
          {guests.map((guest) => (
            <GuestHouseholdRow
              key={guest.id}
              guest={guest}
              canEdit={canEdit}
              canEditDayOf={canEditDayOf}
              open={openId === guest.id}
              onToggle={() => setOpenId((current) => (current === guest.id ? null : guest.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestHouseholdRow({
  guest,
  canEdit,
  canEditDayOf,
  open,
  onToggle,
}: {
  guest: GuestRecord;
  canEdit: boolean;
  canEditDayOf?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const names = guestNameLines({
    nameLine1: guest.people[0]?.name ?? "",
    nameLine2: guest.people[1]?.name ?? null,
    people: guest.people,
  });
  const address = guestAddressLine(guest);
  const seating = guestSeatingSummary({ people: guest.people });

  return (
    <article className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-5">{names.join(" · ") || "Guest"}</p>
          {address ? <p className="mt-0.5 text-[12px] leading-5 text-muted">{address}</p> : null}
          {seating ? <p className="mt-0.5 text-[12px] leading-5 text-[var(--accent)]">{seating}</p> : null}
        </div>
        <span className="shrink-0 pt-0.5 text-xs font-semibold text-muted">{open ? "Hide" : "Details"}</span>
      </button>
      {canEditDayOf
        ? guest.people
            .filter((person) => person.id)
            .map((person) => (
              <div key={person.id} className="border-t border-line px-3 py-2">
                {guest.people.length > 1 ? (
                  <p className="mb-1 text-xs font-semibold text-muted">{person.name}</p>
                ) : null}
                <DayOfCallListToggle
                  profileId={profileIdForGuestPerson(person.id)}
                  checked={person.isDayOfContact}
                  compact
                />
              </div>
            ))
        : null}
      {canEdit ? (
        <div className="border-t border-line px-3 py-2">
          <GuestRsvpControls guest={guest} people={guest.people} compact />
        </div>
      ) : null}
      {open ? <GuestEditCard guest={guest} /> : null}
    </article>
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
      <figure className="overflow-hidden rounded-lg border border-line bg-[var(--bg-elevated)]">
        <img
          src="/seating-layout.png"
          alt="Black Sheep Shelter floor plan with South tables on the left, North tables on the right, and the head table at the bar and band end"
          className="w-full"
        />
        <figcaption className="px-3 py-2 text-xs text-muted">
          Layout reference — South is left, North is right, Head is between the bar and band.
        </figcaption>
      </figure>
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
