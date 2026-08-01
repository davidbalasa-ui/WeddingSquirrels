"use client";

import { useState } from "react";
import { saveGuest } from "@/app/actions";

export type GuestRecord = {
  id: string;
  nameLine1: string;
  nameLine2: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  person1TableNumber: number | null;
  person1TableSpot: string | null;
  person2TableNumber: number | null;
  person2TableSpot: string | null;
};

function tableSummary(guest: GuestRecord) {
  const parts: string[] = [];
  if (guest.person1TableNumber != null) {
    parts.push(
      `${guest.nameLine1}: Table ${guest.person1TableNumber}${guest.person1TableSpot ? ` · ${guest.person1TableSpot}` : ""}`,
    );
  }
  if (guest.nameLine2 && guest.person2TableNumber != null) {
    parts.push(
      `${guest.nameLine2}: Table ${guest.person2TableNumber}${guest.person2TableSpot ? ` · ${guest.person2TableSpot}` : ""}`,
    );
  }
  return parts.join(" · ");
}

export function GuestCard({ guest }: { guest: GuestRecord }) {
  const [open, setOpen] = useState(false);
  const address = [guest.street, [guest.city, guest.state].filter(Boolean).join(", "), guest.zip]
    .filter(Boolean)
    .join(" · ");
  const seating = tableSummary(guest);

  return (
    <article className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left min-h-[56px]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {guest.nameLine1}
            {guest.nameLine2 ? ` · ${guest.nameLine2}` : ""}
          </p>
          {address ? <p className="mt-1 text-sm text-muted">{address}</p> : null}
          {seating ? (
            <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{seating}</p>
          ) : null}
        </div>
        <span className="mt-0.5 shrink-0 text-lg text-muted" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <form action={saveGuest} className="flex flex-col gap-3 border-t border-line p-4">
          <input type="hidden" name="id" value={guest.id} />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Person 1
            </legend>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Name</span>
              <input
                name="nameLine1"
                required
                defaultValue={guest.nameLine1}
                className="field-input"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Table #</span>
                <input
                  name="person1TableNumber"
                  inputMode="numeric"
                  defaultValue={guest.person1TableNumber ?? ""}
                  placeholder="—"
                  className="field-input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Seat / spot</span>
                <input
                  name="person1TableSpot"
                  defaultValue={guest.person1TableSpot ?? ""}
                  placeholder="e.g. 3 or head"
                  className="field-input"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Person 2 (optional)
            </legend>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Name</span>
              <input name="nameLine2" defaultValue={guest.nameLine2 ?? ""} className="field-input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Table #</span>
                <input
                  name="person2TableNumber"
                  inputMode="numeric"
                  defaultValue={guest.person2TableNumber ?? ""}
                  placeholder="—"
                  className="field-input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Seat / spot</span>
                <input
                  name="person2TableSpot"
                  defaultValue={guest.person2TableSpot ?? ""}
                  placeholder="e.g. 4"
                  className="field-input"
                />
              </label>
            </div>
          </fieldset>

          <button type="submit" className="btn-primary">
            Save guest
          </button>
        </form>
      ) : null}
    </article>
  );
}
