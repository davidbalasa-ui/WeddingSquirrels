"use client";

import { useRef, useState, useTransition } from "react";
import {
  cycleGuestPersonRsvp,
  cycleGuestPersonRole,
  saveGuestPersonName,
  saveGuestPersonPhoto,
  saveGuestPhone,
} from "@/app/actions";
import { ChevronDownIcon } from "@/components/ChevronDownIcon";
import { FeatherIcon } from "@/components/FeatherIcon";
import { GuestEditCard } from "@/components/GuestEditCard";
import { GuestPhotoPicker } from "@/components/GuestPhotoPicker";
import { PersonAvatar } from "@/components/PersonAvatar";
import { parseRsvpStatus, rsvpStatusLabel } from "@/lib/guest-gifts";
import {
  guestPersonRoleLabel,
  resolveGuestPersonRole,
} from "@/lib/guest-person-role";
import type { GuestRecord } from "@/lib/guests";
import type { UploadedPhotoOption } from "@/lib/people-sort";
import { fileToResizedDataUrl } from "@/lib/resize-image";

export function GuestPersonCard({
  person,
  guest,
  canEdit,
  photos,
}: {
  person: GuestRecord["people"][number];
  guest: GuestRecord;
  canEdit: boolean;
  photos: UploadedPhotoOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Set by Escape so the blur it triggers puts the old name back instead of saving the draft.
  const cancelNameRef = useRef(false);
  const [prevPerson, setPrevPerson] = useState(person);
  const [prevGuest, setPrevGuest] = useState(guest);
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (person !== prevPerson && !editingName) {
    setPrevPerson(person);
    setName(person.name);
  }
  // A refresh after another save (Save guests, a pill) must not wipe a phone being typed.
  const [phoneDirty, setPhoneDirty] = useState(false);
  if (guest !== prevGuest) {
    setPrevGuest(guest);
    if (!phoneDirty) setPhone(guest.phone ?? "");
  }

  const rsvp = parseRsvpStatus(person.rsvpStatus);
  const role = resolveGuestPersonRole({ directoryLabel: person.directoryLabel });
  const cardEditing = canEdit && editing;

  function commitName() {
    setEditingName(false);
    const cancelled = cancelNameRef.current;
    cancelNameRef.current = false;
    const trimmed = name.trim();
    if (cancelled || !trimmed || trimmed === person.name) {
      setName(person.name);
      return;
    }
    startTransition(async () => {
      const result = await saveGuestPersonName(person.id, trimmed);
      if (!result.ok) setName(person.name);
    });
  }

  function handlePhotoSelect(src: string) {
    setPhotoPickerOpen(false);
    startTransition(async () => {
      await saveGuestPersonPhoto(person.id, src);
    });
  }

  function handlePhotoUpload(file: File) {
    setPhotoPickerOpen(false);
    setPhotoError(null);
    startTransition(async () => {
      let dataUrl: string;
      try {
        dataUrl = await fileToResizedDataUrl(file);
      } catch {
        setPhotoError("That image couldn’t be read. Try a JPEG or PNG.");
        return;
      }
      const result = await saveGuestPersonPhoto(person.id, dataUrl);
      if (!result.ok) setPhotoError("Couldn’t save the photo — try again.");
    });
  }

  const rsvpPillClass =
    rsvp === "attending"
      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
      : rsvp === "not_attending"
        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
        : "bg-[var(--bg-elevated)] text-muted";

  return (
    <>
      <article
        className={`card px-3 py-2.5 transition-[border-color,box-shadow] ${
          cardEditing ? "is-editing" : ""
        }`}
        aria-busy={pending || undefined}
      >
        <div className="relative flex items-center">
          <div className="relative z-10 shrink-0">
            {cardEditing ? (
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={() => setPhotoPickerOpen(true)}
                aria-label={person.photoData ? `Change photo for ${person.name}` : `Add photo for ${person.name}`}
              >
                <PersonAvatar name={person.name} photoSrc={person.photoData} size="sm" />
              </button>
            ) : (
              <PersonAvatar name={person.name} photoSrc={person.photoData} size="sm" />
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-12">
            {cardEditing ? (
              <input
                ref={nameInputRef}
                value={name}
                readOnly={!editingName}
                onFocus={() => setEditingName(true)}
                onChange={(event) => setName(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    cancelNameRef.current = true;
                    setName(person.name);
                    setEditingName(false);
                    event.currentTarget.blur();
                  }
                }}
                className="pointer-events-auto w-full max-w-[calc(100%-1rem)] bg-transparent border-0 p-0 m-0 font-semibold text-[15px] text-center outline-none"
              />
            ) : (
              <p className="max-w-full truncate font-semibold text-[15px] text-center leading-snug">
                {person.name}
              </p>
            )}
          </div>

          {canEdit ? (
            <button
              type="button"
              className={`relative z-10 ml-auto shrink-0 rounded-full p-1 transition-colors ${
                editing ? "text-[var(--gold)]" : "text-muted"
              }`}
              onClick={() => {
                setEditing((value) => {
                  if (value) {
                    setEditingName(false);
                    setName(person.name);
                  }
                  return !value;
                });
              }}
              aria-label={editing ? "Exit edit mode" : "Edit guest"}
              aria-pressed={editing}
            >
              <FeatherIcon className="h-5 w-5" />
            </button>
          ) : (
            <span className="ml-auto w-5 shrink-0" aria-hidden />
          )}
        </div>

        {photoError ? (
          <p role="alert" className="mt-2 text-center text-xs text-[var(--danger)]">
            {photoError}
          </p>
        ) : null}

        <div className="mt-2 grid grid-cols-2 divide-x divide-[var(--line)] border-y border-[var(--line)]">
          <div className="flex items-center justify-center px-2 py-2">
            {cardEditing ? (
              <button
                type="button"
                disabled={pending}
                className="rounded-full border border-line bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted disabled:opacity-60"
                onClick={() => startTransition(async () => { await cycleGuestPersonRole(person.id); })}
              >
                {guestPersonRoleLabel(role)}
              </button>
            ) : (
              <span className="rounded-full border border-line bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {guestPersonRoleLabel(role)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center px-2 py-2">
            {cardEditing ? (
              <button
                type="button"
                disabled={pending}
                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-60 ${rsvpPillClass}`}
                onClick={() => startTransition(async () => { await cycleGuestPersonRsvp(person.id); })}
              >
                {rsvpStatusLabel(rsvp)}
              </button>
            ) : (
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${rsvpPillClass}`}>
                {rsvpStatusLabel(rsvp)}
              </span>
            )}
          </div>
        </div>


        <button
          type="button"
          className="mx-auto mt-1 flex h-[25px] w-[25px] items-center justify-center text-muted"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          <ChevronDownIcon
            className={`h-[25px] w-[25px] transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {expanded ? (
          <div className="mt-2 border-t border-line pt-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Phone</span>
              <input
                value={phone}
                readOnly={!cardEditing}
                onChange={(event) => {
                  setPhoneDirty(true);
                  setPhone(event.target.value);
                }}
                onBlur={() => {
                  if (!cardEditing) return;
                  if ((phone.trim() || "") === (guest.phone?.trim() || "")) {
                    setPhoneDirty(false);
                    return;
                  }
                  startTransition(async () => {
                    await saveGuestPhone(guest.id, phone);
                    setPhoneDirty(false);
                  });
                }}
                className="field-input"
                placeholder="Phone number"
              />
            </label>

            <div className="mt-3 border-t border-line pt-3">
              <GuestEditCard guest={guest} editing={cardEditing} personId={person.id} />
            </div>
          </div>
        ) : null}
      </article>

      {photoPickerOpen ? (
        <GuestPhotoPicker
          photos={photos}
          personName={person.name}
          onSelect={handlePhotoSelect}
          onUpload={handlePhotoUpload}
          onClose={() => setPhotoPickerOpen(false)}
        />
      ) : null}
    </>
  );
}
