"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGuestGift,
  deleteGuestGift,
  saveGuest,
  saveGuestGift,
  saveGuestRsvp,
  setGuestGiftThanked,
} from "@/app/actions";
import {
  effectiveAcceptedCount,
  effectiveInvitedCount,
  parseGuestCount,
  parseRsvpStatus,
  type RsvpStatus,
} from "@/lib/guest-gifts";

export type GuestGiftRecord = {
  id: string;
  description: string;
  thanked: boolean;
};

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
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  gifts: GuestGiftRecord[];
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

const RSVP_OPTIONS: { id: RsvpStatus; label: string }[] = [
  { id: "pending", label: "No reply" },
  { id: "attending", label: "Attending" },
  { id: "not_attending", label: "Not attending" },
];

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

      <GuestRsvpControls
        key={`${guest.id}-${guest.rsvpStatus}-${guest.invitedCount}-${guest.acceptedCount}`}
        guest={guest}
      />

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

      <GuestGifts guestId={guest.id} gifts={guest.gifts} />
    </article>
  );
}

function GuestRsvpControls({ guest }: { guest: GuestRecord }) {
  const router = useRouter();
  const [rsvp, setRsvp] = useState<RsvpStatus>(parseRsvpStatus(guest.rsvpStatus));
  const [invited, setInvited] = useState(String(effectiveInvitedCount(guest)));
  const [accepted, setAccepted] = useState(String(effectiveAcceptedCount(guest)));
  const [pending, startTransition] = useTransition();

  function persist(patch: { rsvpStatus?: RsvpStatus; invitedCount?: number; acceptedCount?: number }) {
    startTransition(async () => {
      const result = await saveGuestRsvp({ guestId: guest.id, ...patch });
      if (result.ok) router.refresh();
    });
  }

  function commitInvited() {
    const next = parseGuestCount(invited);
    if (next == null) {
      setInvited(String(effectiveInvitedCount(guest)));
      return;
    }
    if (next === effectiveInvitedCount(guest)) return;
    persist({ invitedCount: next });
  }

  function commitAccepted() {
    const next = parseGuestCount(accepted);
    if (next == null) {
      setAccepted(String(effectiveAcceptedCount(guest)));
      return;
    }
    if (next === effectiveAcceptedCount(guest)) return;
    persist({ acceptedCount: next });
  }

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5">
        {RSVP_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending}
            className={`rounded-full px-2 py-1.5 text-xs font-semibold disabled:opacity-60 ${
              rsvp === option.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-muted"
            }`}
            onClick={() => {
              if (option.id === rsvp) return;
              setRsvp(option.id);
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
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted"># invited</span>
          <input
            inputMode="numeric"
            value={invited}
            disabled={pending}
            onChange={(event) => setInvited(event.target.value)}
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
            onBlur={commitAccepted}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="field-input"
            aria-label="Number accepted"
          />
        </label>
      </div>
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
  const [giftSource, setGiftSource] = useState(gifts);
  const [rows, setRows] = useState(gifts);
  const [adding, setAdding] = useState(false);
  const [focusGiftId, setFocusGiftId] = useState<string | null>(null);
  if (gifts !== giftSource) {
    setGiftSource(gifts);
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
