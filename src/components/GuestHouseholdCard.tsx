"use client";

import { useRef, useState, useTransition } from "react";
import {
  cycleGuestPersonRsvp,
  cycleGuestPersonRole,
  saveGuestPersonName,
  saveGuestPersonPhoto,
  saveGuestPhone,
} from "@/app/actions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { parseRsvpStatus, rsvpStatusLabel } from "@/lib/guest-gifts";
import {
  guestPersonRoleLabel,
  resolveGuestPersonRole,
} from "@/lib/guest-person-role";
import { tableSeatingLabel } from "@/lib/guest-seating-chart";
import type { GuestRecord } from "@/lib/guests";
import { GuestEditCard } from "@/components/GuestEditCard";
import { fileToResizedDataUrl } from "@/lib/resize-image";

function personTableLabel(person: GuestRecord["people"][number]) {
  if (person.tableNumber == null) return null;
  const base = tableSeatingLabel(person.tableNumber);
  const spot = person.tableSpot?.trim();
  return spot ? `${base} #${spot}` : base;
}

function householdTableSummary(guest: GuestRecord) {
  const labels = guest.people.map(personTableLabel).filter(Boolean);
  if (labels.length === 0) return null;
  const unique = [...new Set(labels)];
  return unique.join(" · ");
}

export function GuestHouseholdCard({
  guest,
  canEdit,
}: {
  guest: GuestRecord;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [prevGuest, setPrevGuest] = useState(guest);
  if (guest !== prevGuest) {
    setPrevGuest(guest);
    setPhone(guest.phone ?? "");
  }

  const tableSummary = householdTableSummary(guest);

  return (
    <article className="px-3 py-2">
      <div className="flex flex-col gap-1">
        {guest.people.map((person) => (
          <GuestPersonRow key={person.id} person={person} canEdit={canEdit} />
        ))}
        {tableSummary ? (
          <p className="pl-[2.75rem] text-xs text-muted">{tableSummary}</p>
        ) : null}
      </div>

      {canEdit ? (
        <button
          type="button"
          className="mt-2 pl-[2.75rem] text-xs font-semibold text-[var(--accent)]"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Hide details" : "Details"}
        </button>
      ) : null}

      {open && canEdit ? (
        <div className="mt-2 border-t border-line pt-3 pl-[2.75rem]">
          <GuestHouseholdDetails guest={guest} phone={phone} onPhoneChange={setPhone} />
        </div>
      ) : null}
    </article>
  );
}

function GuestPersonRow({
  person,
  canEdit,
}: {
  person: GuestRecord["people"][number];
  canEdit: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(person.name);
  const [editingName, setEditingName] = useState(false);
  const [pending, startTransition] = useTransition();
  const [prevPerson, setPrevPerson] = useState(person);
  if (person !== prevPerson && !editingName) {
    setPrevPerson(person);
    setName(person.name);
  }

  const rsvp = parseRsvpStatus(person.rsvpStatus);
  const role = resolveGuestPersonRole({ directoryLabel: person.directoryLabel });

  function commitName() {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === person.name) {
      setName(person.name);
      return;
    }
    startTransition(async () => {
      const result = await saveGuestPersonName(person.id, trimmed);
      if (!result.ok) setName(person.name);
    });
  }

  function pickPhoto() {
    if (!canEdit) return;
    fileRef.current?.click();
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending || undefined}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          startTransition(async () => {
            const dataUrl = await fileToResizedDataUrl(file);
            await saveGuestPersonPhoto(person.id, dataUrl);
          });
        }}
      />
      <button
        type="button"
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onClick={pickPhoto}
        disabled={!canEdit || pending}
        aria-label={person.photoData ? `Change photo for ${person.name}` : `Add photo for ${person.name}`}
      >
        <PersonAvatar name={person.name} photoSrc={person.photoData} size="sm" />
      </button>

      <div className="min-w-0 flex-1">
        {editingName && canEdit ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setName(person.name);
                setEditingName(false);
              }
            }}
            className="w-full rounded-lg border border-line bg-[var(--card)] px-2 py-1 text-[15px] font-semibold outline-none ring-[var(--accent)] focus:ring-2"
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="block max-w-full truncate text-left text-[15px] font-semibold leading-snug disabled:text-inherit"
            disabled={!canEdit}
            onClick={() => canEdit && setEditingName(true)}
          >
            {person.name}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-60 ${
              rsvp === "attending"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : rsvp === "not_attending"
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "bg-[var(--bg-elevated)] text-muted"
            }`}
            onClick={() => startTransition(async () => { await cycleGuestPersonRsvp(person.id); })}
          >
            {rsvpStatusLabel(rsvp)}
          </button>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {rsvpStatusLabel(rsvp)}
          </span>
        )}

        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-line bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted disabled:opacity-60"
            onClick={() => startTransition(async () => { await cycleGuestPersonRole(person.id); })}
          >
            {guestPersonRoleLabel(role)}
          </button>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {guestPersonRoleLabel(role)}
          </span>
        )}
      </div>
    </div>
  );
}

function GuestHouseholdDetails({
  guest,
  phone,
  onPhoneChange,
}: {
  guest: GuestRecord;
  phone: string;
  onPhoneChange: (value: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 text-sm" aria-busy={pending || undefined}>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Phone</span>
        <input
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          onBlur={() => {
            if ((phone.trim() || "") === (guest.phone?.trim() || "")) return;
            startTransition(async () => {
              await saveGuestPhone(guest.id, phone);
            });
          }}
          className="field-input"
          placeholder="Phone number"
        />
      </label>

      <div className="border-t border-line pt-3">
        <GuestEditCard guest={guest} />
      </div>
    </div>
  );
}
