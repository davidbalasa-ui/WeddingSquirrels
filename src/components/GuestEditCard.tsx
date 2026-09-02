"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGuestGift,
  deleteGuestGift,
  saveGuestPeople,
  saveGuestGift,
  setGuestGiftThanked,
} from "@/app/actions";
import type { GuestGiftRecord, GuestPersonRecord, GuestRecord } from "@/lib/guests";

type EditablePerson = GuestPersonRecord & { clientKey: string };

function toEditablePeople(people: GuestPersonRecord[]): EditablePerson[] {
  return people.map((person) => ({ ...person, clientKey: person.id }));
}

export function GuestEditCard({ guest }: { guest: GuestRecord }) {
  const router = useRouter();
  const [people, setPeople] = useState<EditablePerson[]>(() => toEditablePeople(guest.people));
  const [street, setStreet] = useState(guest.street ?? "");
  const [city, setCity] = useState(guest.city ?? "");
  const [state, setState] = useState(guest.state ?? "");
  const [zip, setZip] = useState(guest.zip ?? "");
  const [saving, startSave] = useTransition();
  const [banner, setBanner] = useState<string | null>(null);
  const [prevGuest, setPrevGuest] = useState(guest);
  if (guest !== prevGuest) {
    setPrevGuest(guest);
    setPeople(toEditablePeople(guest.people));
    setStreet(guest.street ?? "");
    setCity(guest.city ?? "");
    setState(guest.state ?? "");
    setZip(guest.zip ?? "");
  }
  const addressLine = [street, [city, state].filter(Boolean).join(", "), zip]
    .filter(Boolean)
    .join(" · ");

  function addPerson() {
    setPeople((prev) => [
      ...prev,
      {
        id: "",
        clientKey: `new-${Date.now()}-${prev.length}`,
        name: "",
        tableNumber: null,
        tableSpot: null,
      },
    ]);
  }

  function removePerson(clientKey: string) {
    setPeople((prev) => (prev.length <= 1 ? prev : prev.filter((person) => person.clientKey !== clientKey)));
  }

  function updatePerson(clientKey: string, patch: Partial<EditablePerson>) {
    setPeople((prev) =>
      prev.map((person) => (person.clientKey === clientKey ? { ...person, ...patch } : person)),
    );
  }

  function savePeople() {
    const payload = people
      .map((person) => ({
        id: person.id || undefined,
        name: person.name.trim(),
        tableNumber: person.tableNumber,
        tableSpot: person.tableSpot,
      }))
      .filter((person) => person.name);
    if (payload.length === 0) {
      setBanner("At least one name is required.");
      return;
    }

    setBanner(null);
    startSave(async () => {
      const result = await saveGuestPeople({
        guestId: guest.id,
        people: payload,
        street,
        city,
        state,
        zip,
      });
      if (!result.ok) {
        setBanner("Couldn’t save guests — try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Mailing address</p>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Street</span>
          <input
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            className="field-input"
            placeholder="Street address"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">City</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="field-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">State</span>
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="field-input"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">ZIP</span>
          <input
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            className="field-input"
          />
        </label>
        {addressLine ? <p className="text-xs text-muted">Preview: {addressLine}</p> : null}

        {banner ? (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-3 py-2 text-sm text-[var(--danger)]">
            {banner}
          </p>
        ) : null}

        {people.map((person, index) => (
          <fieldset key={person.clientKey} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {index === 0 ? "Person 1" : `Person ${index + 1}`}
              </legend>
              {people.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-muted hover:text-[var(--danger)]"
                  onClick={() => removePerson(person.clientKey)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">Name</span>
              <input
                required={index === 0}
                value={person.name}
                onChange={(event) => updatePerson(person.clientKey, { name: event.target.value })}
                className="field-input"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Table #</span>
                <input
                  inputMode="numeric"
                  value={person.tableNumber ?? ""}
                  placeholder="—"
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    updatePerson(person.clientKey, {
                      tableNumber: raw ? Number.parseInt(raw, 10) || null : null,
                    });
                  }}
                  className="field-input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Seat / spot</span>
                <input
                  value={person.tableSpot ?? ""}
                  placeholder="e.g. 3 or head"
                  onChange={(event) =>
                    updatePerson(person.clientKey, { tableSpot: event.target.value || null })
                  }
                  className="field-input"
                />
              </label>
            </div>
          </fieldset>
        ))}

        <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={addPerson}>
          + Add person
        </button>

        <button type="button" disabled={saving} className="btn-primary" onClick={savePeople}>
          {saving ? "Saving…" : "Save guests"}
        </button>
      </div>

      <GuestGifts guestId={guest.id} gifts={guest.gifts} />
    </div>
  );
}

function GuestGifts({
  guestId,
  gifts,
}: {
  guestId: string;
  gifts: GuestGiftRecord[];
}) {
  const [rows, setRows] = useState(gifts);
  const [adding, setAdding] = useState(false);
  const [focusGiftId, setFocusGiftId] = useState<string | null>(null);
  const [prevGifts, setPrevGifts] = useState(gifts);
  if (gifts !== prevGifts) {
    setPrevGifts(gifts);
    setRows(gifts);
  }

  async function addGift() {
    setAdding(true);
    try {
      const result = await addGuestGift(guestId);
      if (!result.ok) return;
      setRows((prev) => [...prev, { id: result.id, description: "", thanked: false }]);
      setFocusGiftId(result.id);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Gifts</p>
        <button
          type="button"
          disabled={adding}
          className="text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
          onClick={() => void addGift()}
        >
          {adding ? "Adding…" : "+ Add gift"}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="py-1 text-xs text-muted">Tap Add gift to record an item for thank-you notes.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((gift) => (
            <GiftRow
              key={gift.id}
              gift={gift}
              autoFocus={focusGiftId === gift.id}
              onRemoved={() => setRows((prev) => prev.filter((item) => item.id !== gift.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GiftRow({
  gift,
  autoFocus,
  onRemoved,
}: {
  gift: GuestGiftRecord;
  autoFocus?: boolean;
  onRemoved: () => void;
}) {
  const [value, setValue] = useState(gift.description);
  const [thanked, setThanked] = useState(gift.thanked);
  const lastSaved = useRef(gift.description);

  async function commit() {
    if (value.trim() === lastSaved.current.trim()) return;
    const result = await saveGuestGift(gift.id, value);
    if (!result.ok) return;
    if (!value.trim()) {
      onRemoved();
      return;
    }
    lastSaved.current = value.trim();
    setValue(value.trim());
  }

  async function remove() {
    const result = await deleteGuestGift(gift.id);
    if (result.ok) onRemoved();
  }

  async function toggleThanked() {
    const next = !thanked;
    setThanked(next);
    const result = await setGuestGiftThanked(gift.id, next);
    if (!result.ok) setThanked(!next);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        autoFocus={autoFocus}
        placeholder="Gift, card, or cash note"
        enterKeyHint="done"
        autoCorrect="on"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-2.5 py-2 text-[15px] leading-5 outline-none placeholder:text-muted focus:border-[var(--accent)]"
      />
      <label className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <input type="checkbox" checked={thanked} onChange={() => void toggleThanked()} />
        Thanked
      </label>
      <button
        type="button"
        aria-label="Remove gift"
        className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-white hover:text-[var(--danger)]"
        onClick={() => void remove()}
      >
        Remove
      </button>
    </div>
  );
}
