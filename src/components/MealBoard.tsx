"use client";

import { useState } from "react";
import {
  addMealOption,
  deleteMealOption,
  saveMealChoice,
  saveMealOption,
  setMealPublished,
} from "@/app/actions";
import { MEAL_SECTIONS } from "@/lib/meals";

export type MealOptionView = {
  id: string;
  label: string;
};

export type MealGuestView = {
  id: string;
  sectionId: string;
  name: string;
  optionId: string | null;
};

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

export function MealBoard({
  options,
  guests,
  published,
  canEditMenu,
  sessionName,
}: {
  options: MealOptionView[];
  guests: MealGuestView[];
  published: boolean;
  canEditMenu: boolean;
  sessionName: string;
}) {
  const [optionList, setOptionList] = useState(options);
  const [optionSource, setOptionSource] = useState(options);
  if (options !== optionSource) {
    setOptionSource(options);
    setOptionList(options);
  }

  const [guestList, setGuestList] = useState(guests);
  const [guestSource, setGuestSource] = useState(guests);
  if (guests !== guestSource) {
    setGuestSource(guests);
    setGuestList(guests);
  }

  const [publishedSource, setPublishedSource] = useState(published);
  const [isPublished, setIsPublished] = useState(published);
  const [adding, setAdding] = useState(false);
  const [focusOptionId, setFocusOptionId] = useState<string | null>(null);
  if (published !== publishedSource) {
    setPublishedSource(published);
    setIsPublished(published);
  }

  const picked = guestList.filter((guest) => guest.optionId).length;
  const you = sessionName.trim().toLowerCase();

  async function addOption() {
    setAdding(true);
    try {
      const result = await addMealOption();
      if (!result.ok) return;
      setOptionList((prev) => [...prev, { id: result.id, label: "" }]);
      setFocusOptionId(result.id);
    } finally {
      setAdding(false);
    }
  }

  async function togglePublished() {
    const next = !isPublished;
    const result = await setMealPublished(next);
    if (result.ok) setIsPublished(next);
  }

  if (!canEditMenu && !isPublished) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        David and Haley are still adding the rehearsal dinner menu. Check back once it is visible.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canEditMenu ? (
        <section className="card overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
            <div>
              <h2 className="text-sm font-semibold">Menu options</h2>
              <p className="text-[11px] text-muted">Add the dishes, then show the list so people can pick.</p>
            </div>
            <button
              type="button"
              onClick={() => void togglePublished()}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: isPublished ? "var(--accent-soft)" : "transparent",
                color: isPublished ? "var(--accent)" : "var(--muted)",
                border: "1px solid var(--line)",
              }}
            >
              {isPublished ? "Visible to guests" : "Hidden from guests"}
            </button>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {optionList.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted">No dishes yet. Add the first option.</p>
            ) : (
              optionList.map((option) => (
                <MealOptionRow
                  key={option.id}
                  option={option}
                  autoFocus={focusOptionId === option.id}
                  onRemoved={() => {
                    setOptionList((prev) => prev.filter((item) => item.id !== option.id));
                    setGuestList((prev) =>
                      prev.map((guest) => (guest.optionId === option.id ? { ...guest, optionId: null } : guest)),
                    );
                  }}
                  onSaved={(label) =>
                    setOptionList((prev) => prev.map((item) => (item.id === option.id ? { ...item, label } : item)))
                  }
                />
              ))
            )}
          </div>
          <div className="border-t border-line px-3 py-2">
            <button
              type="button"
              disabled={adding}
              className="text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
              onClick={() => void addOption()}
            >
              {adding ? "Adding…" : "+ Add option"}
            </button>
          </div>
        </section>
      ) : null}

      {!canEditMenu && optionList.length > 0 ? (
        <p className="text-xs text-muted">Find your name and tap the dish you want.</p>
      ) : null}

      {optionList.filter((option) => option.label.trim()).length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {canEditMenu
            ? "Add at least one menu option before people can choose."
            : "The menu is visible, but no dishes have been added yet."}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            {picked} of {guestList.length} chosen
          </p>
          {MEAL_SECTIONS.map((section) => {
            const sectionGuests = guestList.filter((guest) => guest.sectionId === section.id);
            if (sectionGuests.length === 0) return null;
            return (
              <section key={section.id} className="card overflow-hidden">
                <div className="border-b border-line px-3 py-2">
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {sectionGuests.map((guest) => (
                    <MealGuestRow
                      key={guest.id}
                      guest={guest}
                      options={optionList.filter((option) => option.label.trim())}
                      isYou={guest.name.trim().toLowerCase() === you}
                      onPicked={(optionId) =>
                        setGuestList((prev) =>
                          prev.map((item) => (item.id === guest.id ? { ...item, optionId } : item)),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function MealOptionRow({
  option,
  autoFocus,
  onRemoved,
  onSaved,
}: {
  option: MealOptionView;
  autoFocus?: boolean;
  onRemoved: () => void;
  onSaved: (label: string) => void;
}) {
  const [propLabel, setPropLabel] = useState(option.label);
  const [saved, setSaved] = useState(option.label);
  const [value, setValue] = useState(option.label);
  if (option.label !== propLabel) {
    setPropLabel(option.label);
    setSaved(option.label);
    setValue(option.label);
  }

  async function commit() {
    const next = value.trim();
    if (next === saved.trim()) return;
    if (!next && saved.trim()) {
      setValue(saved);
      return;
    }
    const result = await saveMealOption(option.id, next);
    if (!result.ok) {
      setValue(saved);
      return;
    }
    if (!next) {
      onRemoved();
      return;
    }
    setSaved(next);
    setValue(next);
    onSaved(next);
  }

  async function remove() {
    const result = await deleteMealOption(option.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="text-muted">=</span>
      <input
        value={value}
        autoFocus={autoFocus}
        placeholder="Dish name"
        enterKeyHint="done"
        onFocus={selectAll}
        onClick={selectAll}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] leading-5 outline-none placeholder:text-muted"
      />
      <button
        type="button"
        aria-label="Remove menu option"
        className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-[var(--danger)]"
        onClick={() => void remove()}
      >
        Remove
      </button>
    </div>
  );
}

function MealGuestRow({
  guest,
  options,
  isYou,
  onPicked,
}: {
  guest: MealGuestView;
  options: MealOptionView[];
  isYou: boolean;
  onPicked: (optionId: string | null) => void;
}) {
  const [propChoice, setPropChoice] = useState(guest.optionId);
  const [saved, setSaved] = useState(guest.optionId);
  const [choice, setChoice] = useState(guest.optionId);
  if (guest.optionId !== propChoice) {
    setPropChoice(guest.optionId);
    setSaved(guest.optionId);
    setChoice(guest.optionId);
  }

  async function pick(optionId: string) {
    const next = choice === optionId ? null : optionId;
    setChoice(next);
    onPicked(next);
    const result = await saveMealChoice(guest.id, next);
    if (!result.ok) {
      setChoice(saved);
      onPicked(saved);
    } else {
      setSaved(next);
    }
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold leading-5">
          {guest.name}
          {isYou ? <span className="ml-2 text-[11px] font-semibold text-[var(--accent)]">You</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = choice === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => void pick(option.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: selected ? "var(--accent)" : "transparent",
                color: selected ? "white" : "var(--ink)",
                border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
