"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { groupGuestsByTable } from "@/lib/guest-gifts";
import type { GuestRecord } from "@/lib/guests";
import type {
  PeopleAttendanceFilter,
  PeopleRoleFilter,
  PeopleView,
} from "@/lib/people-directory";
import {
  filterGuestPeople,
  flattenGuestPeople,
  sortGuestPeople,
  type UploadedPhotoOption,
} from "@/lib/people-sort";
import { GuestPersonCard } from "@/components/GuestPersonCard";
import { PersonAvatar } from "@/components/PersonAvatar";

export function GuestList({
  guests,
  canEdit,
  role = "all",
  attendance = "all",
  view = "list",
  photos = [],
}: {
  guests: GuestRecord[];
  canEdit: boolean;
  role?: PeopleRoleFilter;
  attendance?: PeopleAttendanceFilter;
  view?: PeopleView;
  photos?: UploadedPhotoOption[];
}) {
  const [query, setQuery] = useState("");

  const filteredPeople = useMemo(
    () =>
      sortGuestPeople(
        filterGuestPeople(flattenGuestPeople(guests), { role, attendance, query }),
        "name",
      ),
    [guests, role, attendance, query],
  );

  const guestsForTable = useMemo(() => {
    const matchingIds = new Set(filteredPeople.map((item) => item.person.id));
    return guests
      .map((guest) => ({
        ...guest,
        people: guest.people.filter((person) => matchingIds.has(person.id)),
      }))
      .filter((guest) => guest.people.length > 0);
  }, [guests, filteredPeople]);

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
      </div>

      <div className="mb-3 flex justify-end print-hide">
        <Link href="/guests/print" className="text-sm font-semibold text-[var(--accent)]">
          Print gift list
        </Link>
      </div>

      {guests.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No guests yet.</div>
      ) : view === "table" ? (
        <GuestTableView guests={guestsForTable} query={query} />
      ) : filteredPeople.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No guests matching your search.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPeople.map(({ person, guest }) => (
            <GuestPersonCard
              key={person.id}
              person={person}
              guest={guest}
              canEdit={canEdit}
              photos={photos}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function personPhotoForRow(guests: GuestRecord[], personId: string): string | null {
  for (const guest of guests) {
    const person = guest.people.find((row) => row.id === personId);
    if (person?.photoData) return person.photoData;
  }
  return null;
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
                <PersonAvatar
                  name={row.name}
                  photoSrc={personPhotoForRow(guests, row.personId)}
                  size="sm"
                />
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
