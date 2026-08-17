"use client";

import { useState } from "react";
import {
  addMealCourse,
  addMealOption,
  deleteMealCourse,
  deleteMealOption,
  saveMealChoice,
  saveMealCourse,
  saveMealOption,
  setMealPublished,
} from "@/app/actions";
import { countFinishedGuests, labeledCourseOptions, MEAL_SECTIONS, type MealChoiceMap } from "@/lib/meals";

export type MealCourseView = {
  id: string;
  label: string;
  options: Array<{ id: string; label: string }>;
};

export type MealGuestView = {
  id: string;
  sectionId: string;
  name: string;
  choices: MealChoiceMap;
};

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

export function MealBoard({
  courses,
  guests,
  published,
  canEditMenu,
  sessionName,
}: {
  courses: MealCourseView[];
  guests: MealGuestView[];
  published: boolean;
  canEditMenu: boolean;
  sessionName: string;
}) {
  const [courseList, setCourseList] = useState(courses);
  const [courseSource, setCourseSource] = useState(courses);
  if (courses !== courseSource) {
    setCourseSource(courses);
    setCourseList(courses);
  }

  const [guestList, setGuestList] = useState(guests);
  const [guestSource, setGuestSource] = useState(guests);
  if (guests !== guestSource) {
    setGuestSource(guests);
    setGuestList(guests);
  }

  const [publishedSource, setPublishedSource] = useState(published);
  const [isPublished, setIsPublished] = useState(published);
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingOptionId, setAddingOptionId] = useState<string | null>(null);
  const [focusCourseId, setFocusCourseId] = useState<string | null>(null);
  const [focusOptionId, setFocusOptionId] = useState<string | null>(null);
  if (published !== publishedSource) {
    setPublishedSource(published);
    setIsPublished(published);
  }

  const you = sessionName.trim().toLowerCase();
  const pickable = courseList.filter((course) => labeledCourseOptions(course).length > 0);
  const finished = countFinishedGuests(courseList, guestList);

  async function addCourse() {
    setAddingCourse(true);
    try {
      const result = await addMealCourse();
      if (!result.ok) return;
      setCourseList((prev) => [...prev, { id: result.id, label: "", options: [] }]);
      setFocusCourseId(result.id);
    } finally {
      setAddingCourse(false);
    }
  }

  async function addDish(courseId: string) {
    setAddingOptionId(courseId);
    try {
      const result = await addMealOption(courseId);
      if (!result.ok) return;
      setCourseList((prev) =>
        prev.map((course) =>
          course.id === courseId
            ? { ...course, options: [...course.options, { id: result.id, label: "" }] }
            : course,
        ),
      );
      setFocusOptionId(result.id);
    } finally {
      setAddingOptionId(null);
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
              <h2 className="text-sm font-semibold">Menu</h2>
              <p className="text-[11px] text-muted">
                Add courses (entree, side, drink, dessert…), then dishes in each. People pick one per
                course.
              </p>
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
          {courseList.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">No courses yet. Add entree, sides, drinks — whatever Pam is serving.</p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {courseList.map((course) => (
                <CourseEditor
                  key={course.id}
                  course={course}
                  focusLabel={focusCourseId === course.id}
                  focusOptionId={focusOptionId}
                  addingDish={addingOptionId === course.id}
                  onAddDish={() => void addDish(course.id)}
                  onRemoved={() => {
                    setCourseList((prev) => prev.filter((item) => item.id !== course.id));
                    setGuestList((prev) =>
                      prev.map((guest) => {
                        const next = { ...guest.choices };
                        delete next[course.id];
                        return { ...guest, choices: next };
                      }),
                    );
                  }}
                  onSavedLabel={(label) =>
                    setCourseList((prev) =>
                      prev.map((item) => (item.id === course.id ? { ...item, label } : item)),
                    )
                  }
                  onRemovedOption={(optionId) => {
                    setCourseList((prev) =>
                      prev.map((item) =>
                        item.id === course.id
                          ? { ...item, options: item.options.filter((option) => option.id !== optionId) }
                          : item,
                      ),
                    );
                    setGuestList((prev) =>
                      prev.map((guest) =>
                        guest.choices[course.id] === optionId
                          ? { ...guest, choices: { ...guest.choices, [course.id]: null } }
                          : guest,
                      ),
                    );
                  }}
                  onSavedOption={(optionId, label) =>
                    setCourseList((prev) =>
                      prev.map((item) =>
                        item.id === course.id
                          ? {
                              ...item,
                              options: item.options.map((option) =>
                                option.id === optionId ? { ...option, label } : option,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
              ))}
            </div>
          )}
          <div className="border-t border-line px-3 py-2">
            <button
              type="button"
              disabled={addingCourse}
              className="text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
              onClick={() => void addCourse()}
            >
              {addingCourse ? "Adding…" : "+ Add course"}
            </button>
          </div>
        </section>
      ) : null}

      {!canEditMenu && pickable.length > 0 ? (
        <p className="text-xs text-muted">Find your name and pick one dish in each course.</p>
      ) : null}

      {pickable.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {canEditMenu
            ? "Add a course and at least one dish before people can choose."
            : "The menu is visible, but no dishes have been added yet."}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            {finished} of {guestList.length} finished choosing
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
                      courses={pickable}
                      isYou={guest.name.trim().toLowerCase() === you}
                      onPicked={(courseId, optionId) =>
                        setGuestList((prev) =>
                          prev.map((item) =>
                            item.id === guest.id
                              ? { ...item, choices: { ...item.choices, [courseId]: optionId } }
                              : item,
                          ),
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

function CourseEditor({
  course,
  focusLabel,
  focusOptionId,
  addingDish,
  onAddDish,
  onRemoved,
  onSavedLabel,
  onRemovedOption,
  onSavedOption,
}: {
  course: MealCourseView;
  focusLabel?: boolean;
  focusOptionId: string | null;
  addingDish: boolean;
  onAddDish: () => void;
  onRemoved: () => void;
  onSavedLabel: (label: string) => void;
  onRemovedOption: (optionId: string) => void;
  onSavedOption: (optionId: string, label: string) => void;
}) {
  const [propLabel, setPropLabel] = useState(course.label);
  const [saved, setSaved] = useState(course.label);
  const [value, setValue] = useState(course.label);
  if (course.label !== propLabel) {
    setPropLabel(course.label);
    setSaved(course.label);
    setValue(course.label);
  }

  async function commit() {
    const next = value.trim();
    if (next === saved.trim()) return;
    if (!next && saved.trim()) {
      setValue(saved);
      return;
    }
    const result = await saveMealCourse(course.id, next);
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
    onSavedLabel(next);
  }

  async function remove() {
    const result = await deleteMealCourse(course.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          autoFocus={focusLabel}
          placeholder="Course name (Entree, Side, Drink…)"
          enterKeyHint="done"
          onFocus={selectAll}
          onClick={selectAll}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold leading-5 outline-none placeholder:text-muted"
        />
        <button
          type="button"
          aria-label="Remove course"
          className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-[var(--danger)]"
          onClick={() => void remove()}
        >
          Remove
        </button>
      </div>
      <div className="mt-1 divide-y divide-[var(--line)] rounded-xl border border-line/70">
        {course.options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">No dishes in this course yet.</p>
        ) : (
          course.options.map((option) => (
            <MealOptionRow
              key={option.id}
              option={option}
              autoFocus={focusOptionId === option.id}
              onRemoved={() => onRemovedOption(option.id)}
              onSaved={(label) => onSavedOption(option.id, label)}
            />
          ))
        )}
      </div>
      <button
        type="button"
        disabled={addingDish}
        className="mt-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
        onClick={onAddDish}
      >
        {addingDish ? "Adding…" : "+ Add dish"}
      </button>
    </div>
  );
}

function MealOptionRow({
  option,
  autoFocus,
  onRemoved,
  onSaved,
}: {
  option: { id: string; label: string };
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
        aria-label="Remove dish"
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
  courses,
  isYou,
  onPicked,
}: {
  guest: MealGuestView;
  courses: MealCourseView[];
  isYou: boolean;
  onPicked: (courseId: string, optionId: string | null) => void;
}) {
  const [propChoices, setPropChoices] = useState(guest.choices);
  const [saved, setSaved] = useState(guest.choices);
  const [choices, setChoices] = useState(guest.choices);
  if (guest.choices !== propChoices) {
    setPropChoices(guest.choices);
    setSaved(guest.choices);
    setChoices(guest.choices);
  }

  async function pick(courseId: string, optionId: string) {
    const next = choices[courseId] === optionId ? null : optionId;
    const nextChoices = { ...choices, [courseId]: next };
    setChoices(nextChoices);
    onPicked(courseId, next);
    const result = await saveMealChoice(guest.id, next, courseId);
    if (!result.ok) {
      setChoices(saved);
      onPicked(courseId, saved[courseId] ?? null);
    } else {
      setSaved(nextChoices);
    }
  }

  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-[15px] font-semibold leading-5">
        {guest.name}
        {isYou ? <span className="ml-2 text-[11px] font-semibold text-[var(--accent)]">You</span> : null}
      </p>
      <div className="flex flex-col gap-2">
        {courses.map((course) => (
          <div key={course.id}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {course.label || "Course"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {labeledCourseOptions(course).map((option) => {
                const selected = choices[course.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void pick(course.id, option.id)}
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
        ))}
      </div>
    </div>
  );
}
