"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  groupGuestsByTable,
  guestAddressLine,
  guestNameLines,
  guestSeatingSummary,
  rsvpStatusLabel,
} from "@/lib/guest-gifts";
import type { GuestRecord } from "@/lib/guests";
import { normalizePersonName, profileIdForGuestPerson } from "@/lib/people-directory";
import { GuestEditCard } from "@/components/GuestEditCard";
import { GuestRsvpControls } from "@/components/GuestRsvpControls";
import { PersonAvatar } from "@/components/PersonAvatar";

type Mode = "list" | "table";

function householdTitle(guest: GuestRecord) {
  const names = guestNameLines({
    nameLine1: guest.people[0]?.name ?? "",
    nameLine2: guest.people[1]?.name ?? null,
    people: guest.people,
  });
  return names.join(" · ") || "Guest";
}

function matchesGuestQuery(guest: GuestRecord, query: string) {
  const needle = normalizePersonName(query);
  if (!needle) return true;
  const haystack = normalizePersonName(
    [
      householdTitle(guest),
      guestAddressLine(guest),
      guestSeatingSummary({ people: guest.people }),
      rsvpStatusLabel(guest.rsvpStatus),
      ...guest.people.map((person) => person.name),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(needle);
}

export function GuestList({
  guests,
  canEdit,
}: {
  guests: GuestRecord[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>("list");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () => guests.filter((guest) => matchesGuestQuery(guest, query)),
    [guests, query],
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 print-hide">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guests"
          className="min-w-0 flex-1 rounded-xl border border-line bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          aria-label="Search guests"
        />
        <div className="flex shrink-0 gap-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              mode === "list" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => setMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              mode === "table" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => setMode("table")}
          >
            Tables
          </button>
        </div>
      </div>

      <div className="mb-3 flex justify-end print-hide">
        <Link href="/guests/print" className="text-sm font-semibold text-[var(--accent)]">
          Print gift list
        </Link>
      </div>

      {guests.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No guests yet.</div>
      ) : mode === "table" ? (
        <GuestTableView guests={filtered} query={query} />
      ) : filtered.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No guests matching your search.</div>
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {filtered.map((guest) => {
            const title = householdTitle(guest);
            const address = guestAddressLine(guest);
            const seating = guestSeatingSummary({ people: guest.people });
            const profileId = guest.people.find((person) => person.id)?.id;
            const profileHref = profileId
              ? `/people/${encodeURIComponent(profileIdForGuestPerson(profileId))}`
              : null;
            const open = openId === guest.id;

            const details = [
              address || null,
              canEdit ? null : `RSVP · ${rsvpStatusLabel(guest.rsvpStatus)}`,
              seating || null,
            ].filter((line, index, lines): line is string => Boolean(line) && lines.indexOf(line) === index);

            return (
              <article key={guest.id} className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <PersonAvatar name={title} size="sm" />
                  <div className="min-w-0 flex-1">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="block transition-colors hover:text-[var(--accent)]"
                      >
                        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
                        {details.map((line) => (
                          <span
                            key={line}
                            className={`mt-0.5 text-xs text-muted ${
                              line === seating ? "line-clamp-2" : "block truncate"
                            }`}
                          >
                            {line}
                          </span>
                        ))}
                      </Link>
                    ) : (
                      <>
                        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
                        {details.map((line) => (
                          <span
                            key={line}
                            className={`mt-0.5 text-xs text-muted ${
                              line === seating ? "line-clamp-2" : "block truncate"
                            }`}
                          >
                            {line}
                          </span>
                        ))}
                      </>
                    )}

                    {canEdit ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-[var(--accent)]"
                        onClick={() => setOpenId((current) => (current === guest.id ? null : guest.id))}
                        aria-expanded={open}
                      >
                        {open ? "Hide address & gifts" : "Edit address & gifts"}
                      </button>
                    ) : null}
                  </div>

                  {profileHref ? (
                    <Link
                      href={profileHref}
                      className="shrink-0 pt-0.5 text-sm text-muted"
                      aria-label={`Open ${title}`}
                    >
                      ›
                    </Link>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="mt-2">
                    <GuestRsvpControls guest={guest} people={guest.people} compact inline />
                  </div>
                ) : null}

                {open ? (
                  <div className="mt-2 border-t border-line">
                    <GuestEditCard guest={guest} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GuestTableView({ guests, query }: { guests: GuestRecord[]; query: string }) {
  const groups = groupGuestsByTable(guests);

  if (groups.length === 0) {
    return (
      <div className="card px-3 py-4 text-sm text-muted">
        {query ? "No guests matching your search." : "No guests with seating yet."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <figure className="card overflow-hidden">
        <img
          src="/seating-layout.png"
          alt="Black Sheep Shelter floor plan with South tables on the left, North tables on the right, and the head table at the bar and band end"
          className="w-full"
        />
        <figcaption className="border-t border-line px-3 py-2 text-xs text-muted">
          South is left, North is right, Head is between the bar and band.
        </figcaption>
      </figure>
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {group.label}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {group.rows.map((row) => (
              <article key={row.personId} className="flex items-center gap-2 px-3 py-2">
                <PersonAvatar name={row.name} size="sm" />
                <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{row.name}</p>
                {row.tableSpot ? (
                  <p className="shrink-0 text-xs font-semibold text-[var(--accent)]">
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
