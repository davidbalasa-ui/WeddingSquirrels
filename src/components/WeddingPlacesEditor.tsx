"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveWeddingPlaceSettings } from "@/app/actions";
import type { WeddingPlaceFields } from "@/lib/wedding-venue";

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="field-input" />
    </label>
  );
}

function PlaceGroup({
  title,
  description,
  name,
  street,
  city,
  state,
  zip,
  onName,
  onStreet,
  onCity,
  onState,
  onZip,
}: {
  title: string;
  description?: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  onName: (value: string) => void;
  onStreet: (value: string) => void;
  onCity: (value: string) => void;
  onState: (value: string) => void;
  onZip: (value: string) => void;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Place name" value={name} onChange={onName} />
        <Field label="Street" value={street} onChange={onStreet} />
        <Field label="City" value={city} onChange={onCity} />
        <Field label="State" value={state} onChange={onState} />
        <Field label="ZIP" value={zip} onChange={onZip} />
      </div>
    </div>
  );
}

function emptyFields(initial: WeddingPlaceFields | null | undefined): WeddingPlaceFields {
  return {
    venueName: initial?.venueName ?? "",
    venueStreet: initial?.venueStreet ?? "",
    venueCity: initial?.venueCity ?? "",
    venueState: initial?.venueState ?? "",
    venueZip: initial?.venueZip ?? "",
    rehearsalDinnerName: initial?.rehearsalDinnerName ?? "",
    rehearsalDinnerStreet: initial?.rehearsalDinnerStreet ?? "",
    rehearsalDinnerCity: initial?.rehearsalDinnerCity ?? "",
    rehearsalDinnerState: initial?.rehearsalDinnerState ?? "",
    rehearsalDinnerZip: initial?.rehearsalDinnerZip ?? "",
    airbnbName: initial?.airbnbName ?? "",
    airbnbStreet: initial?.airbnbStreet ?? "",
    airbnbCity: initial?.airbnbCity ?? "",
    airbnbState: initial?.airbnbState ?? "",
    airbnbZip: initial?.airbnbZip ?? "",
  };
}

export function WeddingPlacesEditor({
  initial,
  canEdit,
}: {
  initial: WeddingPlaceFields | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(() => emptyFields(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  function patch(partial: Partial<WeddingPlaceFields>) {
    setFields((prev) => ({ ...prev, ...partial }));
  }

  return (
    <section id="venues" className="mb-6 scroll-mt-24">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        Wedding places
      </p>
      <p className="mb-3 text-sm text-muted">
        Canonical venue and lodging addresses for Today, print quick reference, and offline backup.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await saveWeddingPlaceSettings(fields);
            if (!result.ok) {
              setError("Couldn’t save places — check that you can edit the timeline.");
              return;
            }
            router.refresh();
          });
        }}
      >
        <PlaceGroup
          title="Wedding venue"
          description="Ceremony and reception site."
          name={fields.venueName ?? ""}
          street={fields.venueStreet ?? ""}
          city={fields.venueCity ?? ""}
          state={fields.venueState ?? ""}
          zip={fields.venueZip ?? ""}
          onName={(value) => patch({ venueName: value })}
          onStreet={(value) => patch({ venueStreet: value })}
          onCity={(value) => patch({ venueCity: value })}
          onState={(value) => patch({ venueState: value })}
          onZip={(value) => patch({ venueZip: value })}
        />
        <PlaceGroup
          title="Rehearsal dinner"
          name={fields.rehearsalDinnerName ?? ""}
          street={fields.rehearsalDinnerStreet ?? ""}
          city={fields.rehearsalDinnerCity ?? ""}
          state={fields.rehearsalDinnerState ?? ""}
          zip={fields.rehearsalDinnerZip ?? ""}
          onName={(value) => patch({ rehearsalDinnerName: value })}
          onStreet={(value) => patch({ rehearsalDinnerStreet: value })}
          onCity={(value) => patch({ rehearsalDinnerCity: value })}
          onState={(value) => patch({ rehearsalDinnerState: value })}
          onZip={(value) => patch({ rehearsalDinnerZip: value })}
        />
        <PlaceGroup
          title="Lodging (Airbnb / stay hub)"
          name={fields.airbnbName ?? ""}
          street={fields.airbnbStreet ?? ""}
          city={fields.airbnbCity ?? ""}
          state={fields.airbnbState ?? ""}
          zip={fields.airbnbZip ?? ""}
          onName={(value) => patch({ airbnbName: value })}
          onStreet={(value) => patch({ airbnbStreet: value })}
          onCity={(value) => patch({ airbnbCity: value })}
          onState={(value) => patch({ airbnbState: value })}
          onZip={(value) => patch({ airbnbZip: value })}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-fit" disabled={pending}>
          {pending ? "Saving…" : "Save wedding places"}
        </button>
      </form>
    </section>
  );
}
