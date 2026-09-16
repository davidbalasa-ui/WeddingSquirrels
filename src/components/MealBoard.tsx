"use client";

import { useMemo, useState } from "react";
import {
  addDinnerCourse,
  addDinnerOption,
  deleteDinnerCourse,
  deleteDinnerOption,
  initializeFlexibleDinner,
  saveDinnerCourse,
  saveDinnerOption,
  saveDinnerSelections,
  setDinnerPublished,
} from "@/app/rehearsal-meal-actions";
import type {
  DinnerCourseView,
  DinnerGuestCandidate,
  DinnerMealGuestView,
  DinnerOptionView,
  DinnerSelectionView,
} from "@/lib/rehearsal-dinner";

function orderComplete(
  courses: DinnerCourseView[],
  selections: Record<string, DinnerSelectionView[]>,
) {
  const active = courses.filter((course) => course.options.some((option) => option.label.trim()));
  if (!active.length) return false;
  return active.every((course) => {
    const picked = selections[course.id] ?? [];
    if (picked.length < course.minSelections || picked.length > course.maxSelections) return false;
    return picked.every((selection) => {
      const option = course.options.find((row) => row.id === selection.optionId);
      return option && (!option.followUpRequired || Boolean(selection.followUpValue?.trim()));
    });
  });
}

export function MealBoard({
  courses,
  guests,
  candidates,
  published,
  canEditMenu,
  sessionName,
  completed,
  advanced,
}: {
  courses: DinnerCourseView[];
  guests: DinnerMealGuestView[];
  candidates: DinnerGuestCandidate[];
  published: boolean;
  canEditMenu: boolean;
  sessionName: string;
  completed: number;
  advanced: boolean;
}) {
  const [courseList, setCourseList] = useState(courses);
  const [guestList, setGuestList] = useState(guests);
  const [candidateList, setCandidateList] = useState(candidates);
  const [isPublished, setIsPublished] = useState(published);
  const [isAdvanced, setIsAdvanced] = useState(advanced);
  const [addingCourse, setAddingCourse] = useState(false);

  const sessionCandidate = useMemo(() => {
    const key = sessionName.trim().toLocaleLowerCase();
    return candidateList.find((candidate) => candidate.name.trim().toLocaleLowerCase() === key) ?? null;
  }, [candidateList, sessionName]);
  const [selectedGuestPersonId, setSelectedGuestPersonId] = useState(sessionCandidate?.guestPersonId ?? "");

  const selectedCandidate =
    candidateList.find((candidate) => candidate.guestPersonId === selectedGuestPersonId) ?? null;
  const selectedMealGuest = selectedCandidate?.mealGuestId
    ? guestList.find((guest) => guest.id === selectedCandidate.mealGuestId) ?? null
    : null;
  const selectedSelections = selectedMealGuest?.selections ?? {};
  const activeCourses = courseList.filter((course) => course.options.some((option) => option.label.trim()));
  const selectedComplete = selectedCandidate
    ? orderComplete(activeCourses, selectedSelections)
    : false;

  async function enableAdvanced() {
    const result = await initializeFlexibleDinner();
    if (result.ok) setIsAdvanced(true);
  }

  async function addCourse() {
    setAddingCourse(true);
    try {
      const result = await addDinnerCourse();
      if (!result.ok) return;
      setIsAdvanced(true);
      setCourseList((prev) => [
        ...prev,
        { id: result.id, label: "", minSelections: 1, maxSelections: 1, options: [] },
      ]);
    } finally {
      setAddingCourse(false);
    }
  }

  async function togglePublished() {
    const next = !isPublished;
    const result = await setDinnerPublished(next);
    if (result.ok) {
      setIsPublished(next);
      setIsAdvanced(true);
    }
  }

  function updateSavedSelections(
    guestPersonId: string,
    mealGuestId: string,
    courseId: string,
    selections: DinnerSelectionView[],
  ) {
    const candidate = candidateList.find((row) => row.guestPersonId === guestPersonId);
    if (!candidate) return;
    setCandidateList((prev) =>
      prev.map((row) =>
        row.guestPersonId === guestPersonId ? { ...row, mealGuestId } : row,
      ),
    );
    setGuestList((prev) => {
      const existing = prev.find((guest) => guest.id === mealGuestId);
      if (existing) {
        return prev.map((guest) =>
          guest.id === mealGuestId
            ? { ...guest, selections: { ...guest.selections, [courseId]: selections } }
            : guest,
        );
      }
      return [
        ...prev,
        {
          id: mealGuestId,
          name: candidate.name,
          guestPersonId,
          selections: { [courseId]: selections },
        },
      ];
    });
  }

  async function persistCourseSelections(courseId: string, selections: DinnerSelectionView[]) {
    if (!selectedCandidate) return false;
    const result = await saveDinnerSelections({
      guestPersonId: selectedCandidate.guestPersonId,
      courseId,
      selections,
    });
    if (!result.ok) return false;
    setIsAdvanced(true);
    updateSavedSelections(selectedCandidate.guestPersonId, result.id, courseId, selections);
    return true;
  }

  if (!canEditMenu && !isPublished) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        The rehearsal dinner menu is still being prepared. Check back once it is published.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canEditMenu ? (
        <section className="card overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Dinner menu</h2>
              <p className="mt-1 text-[11px] leading-4 text-muted">
                Build the questions guests answer: entrée, sides, drink, dessert, or anything else.
                Each group can allow one or several selections, and a dish can ask a follow-up such as steak temperature.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void togglePublished()}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
              style={{
                background: isPublished ? "var(--accent-soft)" : "transparent",
                color: isPublished ? "var(--accent)" : "var(--muted)",
              }}
            >
              {isPublished ? "Published" : "Hidden"}
            </button>
          </div>

          {!isAdvanced ? (
            <div className="border-b border-line bg-[var(--paper-soft)] px-4 py-3 text-xs text-muted">
              <p>Flexible choices are ready to initialize. Existing meal choices are preserved.</p>
              <button
                type="button"
                className="mt-2 font-semibold text-[var(--accent)]"
                onClick={() => void enableAdvanced()}
              >
                Enable flexible dinner choices
              </button>
            </div>
          ) : null}

          {courseList.length ? (
            <div className="divide-y divide-[var(--line)]">
              {courseList.map((course) => (
                <CourseEditor
                  key={course.id}
                  course={course}
                  onChanged={(next) =>
                    setCourseList((prev) => prev.map((row) => (row.id === next.id ? next : row)))
                  }
                  onRemoved={() =>
                    setCourseList((prev) => prev.filter((row) => row.id !== course.id))
                  }
                />
              ))}
            </div>
          ) : (
            <p className="px-4 py-4 text-xs text-muted">No menu groups yet.</p>
          )}

          <div className="border-t border-line px-4 py-3">
            <button
              type="button"
              disabled={addingCourse}
              className="text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
              onClick={() => void addCourse()}
            >
              {addingCourse ? "Adding…" : "+ Add menu group"}
            </button>
          </div>
        </section>
      ) : null}

      {activeCourses.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {canEditMenu
            ? "Add a menu group and at least one choice before taking orders."
            : "The menu is published, but there are no choices yet."}
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Meal selections</h2>
            <p className="mt-1 text-xs text-muted">
              Choose a name from the wedding guest list, then complete that person’s order.
              {completed > 0 ? ` ${completed} completed so far.` : ""}
            </p>
          </div>

          <div className="px-4 py-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted" htmlFor="dinner-person">
              Person
            </label>
            <select
              id="dinner-person"
              value={selectedGuestPersonId}
              onChange={(event) => setSelectedGuestPersonId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-transparent px-3 text-sm outline-none"
            >
              <option value="">Select your name</option>
              {candidateList.map((candidate) => (
                <option key={candidate.guestPersonId} value={candidate.guestPersonId}>
                  {candidate.name}
                  {candidate.rsvpStatus === "not_attending" ? " — declined wedding RSVP" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedCandidate ? (
            <div className="border-t border-line px-4 py-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{selectedCandidate.name}</p>
                  <p className="text-xs text-muted">
                    {selectedComplete ? "Order complete" : "Selections save as you go"}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: selectedComplete ? "var(--accent-soft)" : "transparent",
                    color: selectedComplete ? "var(--accent)" : "var(--muted)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {selectedComplete ? "Complete" : "In progress"}
                </span>
              </div>

              <div className="flex flex-col gap-5">
                {activeCourses.map((course) => (
                  <GuestCoursePicker
                    key={course.id}
                    course={course}
                    selections={selectedSelections[course.id] ?? []}
                    onSave={(next) => persistCourseSelections(course.id, next)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="border-t border-line px-4 py-5 text-sm text-muted">
              Select a person to start or update an order.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function CourseEditor({
  course,
  onChanged,
  onRemoved,
}: {
  course: DinnerCourseView;
  onChanged: (course: DinnerCourseView) => void;
  onRemoved: () => void;
}) {
  const [label, setLabel] = useState(course.label);
  const [minSelections, setMinSelections] = useState(course.minSelections);
  const [maxSelections, setMaxSelections] = useState(course.maxSelections);
  const [saving, setSaving] = useState(false);
  const [addingOption, setAddingOption] = useState(false);

  async function saveCourse() {
    setSaving(true);
    try {
      const result = await saveDinnerCourse(course.id, { label, minSelections, maxSelections });
      if (!result.ok) return;
      if (!label.trim()) {
        onRemoved();
        return;
      }
      onChanged({ ...course, label: label.trim(), minSelections, maxSelections });
    } finally {
      setSaving(false);
    }
  }

  async function removeCourse() {
    const result = await deleteDinnerCourse(course.id);
    if (result.ok) onRemoved();
  }

  async function addOption() {
    setAddingOption(true);
    try {
      const result = await addDinnerOption(course.id);
      if (!result.ok) return;
      onChanged({
        ...course,
        options: [
          ...course.options,
          {
            id: result.id,
            label: "",
            followUpLabel: null,
            followUpOptions: [],
            followUpRequired: false,
          },
        ],
      });
    } finally {
      setAddingOption(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Menu group — Entrée, Sides, Drink…"
          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold outline-none placeholder:text-muted"
        />
        <button type="button" onClick={() => void removeCourse()} className="text-xs font-semibold text-muted">
          Remove
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">
        <label className="text-muted">
          Minimum
          <input
            type="number"
            min={0}
            max={10}
            value={minSelections}
            onChange={(event) => setMinSelections(Number(event.target.value) || 0)}
            className="ml-2 w-14 rounded-lg border border-line bg-transparent px-2 py-1.5 text-[var(--ink)]"
          />
        </label>
        <label className="text-muted">
          Maximum
          <input
            type="number"
            min={1}
            max={10}
            value={maxSelections}
            onChange={(event) => setMaxSelections(Math.max(1, Number(event.target.value) || 1))}
            className="ml-2 w-14 rounded-lg border border-line bg-transparent px-2 py-1.5 text-[var(--ink)]"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveCourse()}
          className="font-semibold text-[var(--accent)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save group"}
        </button>
      </div>

      <div className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-line/70">
        {course.options.length ? (
          course.options.map((option) => (
            <OptionEditor
              key={option.id}
              option={option}
              onChanged={(next) =>
                onChanged({
                  ...course,
                  options: course.options.map((row) => (row.id === next.id ? next : row)),
                })
              }
              onRemoved={() =>
                onChanged({ ...course, options: course.options.filter((row) => row.id !== option.id) })
              }
            />
          ))
        ) : (
          <p className="px-3 py-3 text-xs text-muted">No choices in this group yet.</p>
        )}
      </div>
      <button
        type="button"
        disabled={addingOption}
        onClick={() => void addOption()}
        className="mt-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
      >
        {addingOption ? "Adding…" : "+ Add choice"}
      </button>
    </div>
  );
}

function OptionEditor({
  option,
  onChanged,
  onRemoved,
}: {
  option: DinnerOptionView;
  onChanged: (option: DinnerOptionView) => void;
  onRemoved: () => void;
}) {
  const [label, setLabel] = useState(option.label);
  const [followUpLabel, setFollowUpLabel] = useState(option.followUpLabel ?? "");
  const [followUpOptions, setFollowUpOptions] = useState(option.followUpOptions.join(", "));
  const [followUpRequired, setFollowUpRequired] = useState(option.followUpRequired);
  const [saving, setSaving] = useState(false);

  async function saveOption() {
    setSaving(true);
    try {
      const parsedOptions = followUpOptions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await saveDinnerOption(option.id, {
        label,
        followUpLabel,
        followUpOptions: parsedOptions,
        followUpRequired,
      });
      if (!result.ok) return;
      if (!label.trim()) {
        onRemoved();
        return;
      }
      onChanged({
        id: option.id,
        label: label.trim(),
        followUpLabel: followUpLabel.trim() || null,
        followUpOptions: parsedOptions,
        followUpRequired: Boolean(followUpLabel.trim() && followUpRequired),
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeOption() {
    const result = await deleteDinnerOption(option.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Choice — Filet, Chicken, Mashed potatoes…"
          className="min-h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted"
        />
        <button type="button" onClick={() => void removeOption()} className="text-[11px] font-semibold text-muted">
          Remove
        </button>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <input
          value={followUpLabel}
          onChange={(event) => setFollowUpLabel(event.target.value)}
          placeholder="Optional follow-up — How should it be cooked?"
          className="min-h-10 rounded-lg border border-line bg-transparent px-2.5 text-xs outline-none"
        />
        <input
          value={followUpOptions}
          onChange={(event) => setFollowUpOptions(event.target.value)}
          placeholder="Rare, Medium Rare, Medium…"
          className="min-h-10 rounded-lg border border-line bg-transparent px-2.5 text-xs outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={followUpRequired}
            disabled={!followUpLabel.trim()}
            onChange={(event) => setFollowUpRequired(event.target.checked)}
          />
          Require follow-up when this choice is selected
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveOption()}
          className="text-[11px] font-semibold text-[var(--accent)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save choice"}
        </button>
      </div>
    </div>
  );
}

function GuestCoursePicker({
  course,
  selections,
  onSave,
}: {
  course: DinnerCourseView;
  selections: DinnerSelectionView[];
  onSave: (selections: DinnerSelectionView[]) => Promise<boolean>;
}) {
  const [working, setWorking] = useState(selections);
  const [saving, setSaving] = useState(false);

  async function persist(next: DinnerSelectionView[]) {
    const previous = working;
    setWorking(next);
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (!ok) setWorking(previous);
  }

  async function toggle(option: DinnerOptionView) {
    const exists = working.find((selection) => selection.optionId === option.id);
    if (exists) {
      await persist(working.filter((selection) => selection.optionId !== option.id));
      return;
    }
    if (course.maxSelections === 1) {
      await persist([{ optionId: option.id, followUpValue: null }]);
      return;
    }
    if (working.length >= course.maxSelections) return;
    await persist([...working, { optionId: option.id, followUpValue: null }]);
  }

  async function saveFollowUp(optionId: string, value: string) {
    const next = working.map((selection) =>
      selection.optionId === optionId ? { ...selection, followUpValue: value || null } : selection,
    );
    await persist(next);
  }

  const instruction =
    course.minSelections === course.maxSelections
      ? course.maxSelections === 1
        ? "Choose 1"
        : `Choose ${course.maxSelections}`
      : course.minSelections === 0
        ? `Choose up to ${course.maxSelections}`
        : `Choose ${course.minSelections}–${course.maxSelections}`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{course.label || "Menu choice"}</p>
        <span className="text-[11px] text-muted">{saving ? "Saving…" : instruction}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {course.options
          .filter((option) => option.label.trim())
          .map((option) => {
            const selected = working.some((selection) => selection.optionId === option.id);
            const blocked = !selected && course.maxSelections > 1 && working.length >= course.maxSelections;
            return (
              <button
                key={option.id}
                type="button"
                disabled={saving || blocked}
                onClick={() => void toggle(option)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
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

      {working.map((selection) => {
        const option = course.options.find((row) => row.id === selection.optionId);
        if (!option?.followUpLabel) return null;
        return (
          <FollowUpField
            key={option.id}
            option={option}
            value={selection.followUpValue ?? ""}
            disabled={saving}
            onSave={(value) => saveFollowUp(option.id, value)}
          />
        );
      })}
    </div>
  );
}

function FollowUpField({
  option,
  value,
  disabled,
  onSave,
}: {
  option: DinnerOptionView;
  value: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="mt-2 rounded-xl border border-line/70 px-3 py-2">
      <label className="text-xs font-semibold">
        {option.label} — {option.followUpLabel}
        {option.followUpRequired ? <span className="text-[var(--danger)]"> *</span> : null}
      </label>
      {option.followUpOptions.length ? (
        <select
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            void onSave(next);
          }}
          className="mt-1 min-h-10 w-full rounded-lg border border-line bg-transparent px-2 text-sm"
        >
          <option value="">Select one</option>
          {option.followUpOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      ) : (
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void onSave(draft)}
          placeholder="Enter response"
          className="mt-1 min-h-10 w-full rounded-lg border border-line bg-transparent px-2 text-sm outline-none"
        />
      )}
    </div>
  );
}
