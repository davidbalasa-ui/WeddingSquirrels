"use client";

import { useMemo, useState } from "react";
import {
  addMealCourse,
  addMealOption,
  deleteMealCourse,
  deleteMealOption,
  saveMealChoice,
  saveMealCourse,
  saveMealCourseSelectionRules,
  saveMealOption,
  saveMealOptionFollowUp,
  saveMealOrder,
  setMealPublished,
} from "@/app/actions";
import type { LoadedMealOrder, MealGuestPersonOption } from "@/lib/meal-data";
import {
  activeCourses,
  canViewMealOrdering,
  courseSelectionHint,
  formatMealOrderSummary,
  isMealOrderComplete,
  mealOrderProgress,
  summarizeMealOrders,
  type MealCourseConfig,
  type MealSelectionInput,
} from "@/lib/meal-order";
import {
  countFinishedGuests,
  labeledCourseOptions,
  MEAL_SECTIONS,
  type MealChoiceMap,
} from "@/lib/meals";

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

export function MealBoard({
  courses,
  guestPeople,
  orders,
  legacyRoster,
  published,
  legacyOnly,
  canEditMenu,
  sessionName,
}: {
  courses: MealCourseConfig[];
  guestPeople: MealGuestPersonOption[];
  orders: LoadedMealOrder[];
  legacyRoster: Array<{ id: string; sectionId: string; name: string; choices: MealChoiceMap }>;
  published: boolean;
  legacyOnly: boolean;
  canEditMenu: boolean;
  sessionName: string;
}) {
  const [courseList, setCourseList] = useState(courses);
  const [courseSource, setCourseSource] = useState(courses);
  if (courses !== courseSource) {
    setCourseSource(courses);
    setCourseList(courses);
  }

  const [orderList, setOrderList] = useState(orders);
  const [orderSource, setOrderSource] = useState(orders);
  if (orders !== orderSource) {
    setOrderSource(orders);
    setOrderList(orders);
  }

  const [publishedSource, setPublishedSource] = useState(published);
  const [isPublished, setIsPublished] = useState(published);
  if (published !== publishedSource) {
    setPublishedSource(published);
    setIsPublished(published);
  }

  const pickable = activeCourses(courseList);
  const stats = summarizeMealOrders(courseList, orderList.map((row) => ({ selections: row.selections })));

  async function togglePublished() {
    const next = !isPublished;
    const result = await setMealPublished(next);
    if (result.ok) setIsPublished(next);
  }

  if (!canEditMenu && !canViewMealOrdering({ published: isPublished, canEditMenu })) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        David and Haley are still adding the rehearsal dinner menu. Check back once it is visible.
      </div>
    );
  }

  if (legacyOnly) {
    return (
      <LegacyMealBoard
        courses={courseList.map((course) => ({
          id: course.id,
          label: course.label,
          options: course.options.map((option) => ({ id: option.id, label: option.label })),
        }))}
        guests={legacyRoster}
        published={isPublished}
        canEditMenu={canEditMenu}
        sessionName={sessionName}
        onTogglePublished={() => void togglePublished()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canEditMenu ? (
        <MenuEditor
          courses={courseList}
          isPublished={isPublished}
          onTogglePublished={() => void togglePublished()}
          onCoursesChange={setCourseList}
          onOrdersChange={setOrderList}
        />
      ) : null}

      {canEditMenu && orderList.length ? (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <h2 className="text-sm font-semibold">Submitted orders</h2>
            <p className="text-[11px] text-muted">
              {stats.complete} complete · {stats.started} started · {stats.participants} guests
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {orderList.map((order) => (
              <div key={order.mealGuestId} className="px-3 py-2">
                <p className="text-[15px] font-semibold">{order.name}</p>
                <p className="text-xs text-muted">
                  {order.selections.length
                    ? formatMealOrderSummary(courseList, order.selections)
                    : "No selections yet"}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pickable.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {canEditMenu
            ? "Add a course and at least one dish before people can choose."
            : "The menu is visible, but no dishes have been added yet."}
        </div>
      ) : canViewMealOrdering({ published: isPublished, canEditMenu }) ? (
        <>
          {!canEditMenu ? (
            <p className="text-xs text-muted">Choose your name, then pick from the menu below.</p>
          ) : null}
          {!canEditMenu && stats.participants ? (
            <p className="text-xs text-muted">
              {stats.complete} complete · {stats.started} in progress
            </p>
          ) : null}
          <MealOrderCard
            courses={courseList}
            guestPeople={guestPeople}
            orders={orderList}
            canEditMenu={canEditMenu}
            sessionName={sessionName}
            onSaved={(next) => setOrderList(next)}
          />
        </>
      ) : null}
    </div>
  );
}

function MenuEditor({
  courses,
  isPublished,
  onTogglePublished,
  onCoursesChange,
  onOrdersChange,
}: {
  courses: MealCourseConfig[];
  isPublished: boolean;
  onTogglePublished: () => void;
  onCoursesChange: (next: MealCourseConfig[]) => void;
  onOrdersChange: (next: LoadedMealOrder[]) => void;
}) {
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingOptionId, setAddingOptionId] = useState<string | null>(null);
  const [focusCourseId, setFocusCourseId] = useState<string | null>(null);
  const [focusOptionId, setFocusOptionId] = useState<string | null>(null);

  async function addCourse() {
    setAddingCourse(true);
    try {
      const result = await addMealCourse();
      if (!result.ok) return;
      onCoursesChange([
        ...courses,
        {
          id: result.id,
          label: "",
          minSelections: 1,
          maxSelections: 1,
          options: [],
        },
      ]);
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
      onCoursesChange(
        courses.map((course) =>
          course.id === courseId
            ? {
                ...course,
                options: [
                  ...course.options,
                  { id: result.id, label: "", followUpPrompt: null, followUpChoices: [] },
                ],
              }
            : course,
        ),
      );
      setFocusOptionId(result.id);
    } finally {
      setAddingOptionId(null);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Menu</h2>
          <p className="text-[11px] text-muted">
            Build courses, set how many dishes guests may pick, and add optional follow-up questions.
          </p>
        </div>
        <button
          type="button"
          onClick={onTogglePublished}
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
      {courses.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted">No courses yet. Add entrée, sides, drinks — whatever Pam is serving.</p>
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {courses.map((course) => (
            <CourseEditor
              key={course.id}
              course={course}
              focusLabel={focusCourseId === course.id}
              focusOptionId={focusOptionId}
              addingDish={addingOptionId === course.id}
              onAddDish={() => void addDish(course.id)}
              onRemoved={() => {
                onCoursesChange(courses.filter((item) => item.id !== course.id));
              }}
              onSaved={(next) =>
                onCoursesChange(courses.map((item) => (item.id === course.id ? next : item)))
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
  );
}

function CourseEditor({
  course,
  focusLabel,
  focusOptionId,
  addingDish,
  onAddDish,
  onRemoved,
  onSaved,
}: {
  course: MealCourseConfig;
  focusLabel?: boolean;
  focusOptionId: string | null;
  addingDish: boolean;
  onAddDish: () => void;
  onRemoved: () => void;
  onSaved: (course: MealCourseConfig) => void;
}) {
  const [label, setLabel] = useState(course.label);
  const [savedLabel, setSavedLabel] = useState(course.label);
  const [minSel, setMinSel] = useState(String(course.minSelections));
  const [maxSel, setMaxSel] = useState(String(course.maxSelections));

  if (course.label !== savedLabel) {
    setSavedLabel(course.label);
    setLabel(course.label);
    setMinSel(String(course.minSelections));
    setMaxSel(String(course.maxSelections));
  }

  async function commitLabel() {
    const next = label.trim();
    if (next === savedLabel.trim()) return;
    if (!next && savedLabel.trim()) {
      setLabel(savedLabel);
      return;
    }
    const result = await saveMealCourse(course.id, next);
    if (!result.ok) {
      setLabel(savedLabel);
      return;
    }
    if (!next) {
      onRemoved();
      return;
    }
    setSavedLabel(next);
    onSaved({ ...course, label: next });
  }

  async function commitRules() {
    const min = Number(minSel);
    const max = Number(maxSel);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    const result = await saveMealCourseSelectionRules(course.id, min, max);
    if (!result.ok) return;
    onSaved({ ...course, minSelections: Math.max(0, min), maxSelections: Math.max(min, max) });
  }

  async function removeCourse() {
    if (!window.confirm("Remove this course? Existing selections in this course will be deleted.")) return;
    const result = await deleteMealCourse(course.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          value={label}
          autoFocus={focusLabel}
          placeholder="Course name (Entree, Side, Drink…)"
          enterKeyHint="done"
          onFocus={selectAll}
          onClick={selectAll}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => void commitLabel()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold leading-5 outline-none placeholder:text-muted"
        />
        <button
          type="button"
          aria-label="Remove course"
          className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-[var(--danger)]"
          onClick={() => void removeCourse()}
        >
          Remove
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>{courseSelectionHint(course)}</span>
        <label className="flex items-center gap-1">
          Min
          <input
            value={minSel}
            inputMode="numeric"
            onChange={(event) => setMinSel(event.target.value)}
            onBlur={() => void commitRules()}
            className="w-10 rounded border border-line bg-transparent px-1 py-0.5 text-ink"
          />
        </label>
        <label className="flex items-center gap-1">
          Max
          <input
            value={maxSel}
            inputMode="numeric"
            onChange={(event) => setMaxSel(event.target.value)}
            onBlur={() => void commitRules()}
            className="w-10 rounded border border-line bg-transparent px-1 py-0.5 text-ink"
          />
        </label>
      </div>
      <div className="mt-1 divide-y divide-[var(--line)] rounded-xl border border-line/70">
        {course.options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">No dishes in this course yet.</p>
        ) : (
          course.options.map((option) => (
            <MealOptionEditor
              key={option.id}
              option={option}
              autoFocus={focusOptionId === option.id}
              onRemoved={() =>
                onSaved({
                  ...course,
                  options: course.options.filter((row) => row.id !== option.id),
                })
              }
              onSaved={(next) =>
                onSaved({
                  ...course,
                  options: course.options.map((row) => (row.id === option.id ? next : row)),
                })
              }
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

function MealOptionEditor({
  option,
  autoFocus,
  onRemoved,
  onSaved,
}: {
  option: MealCourseConfig["options"][number];
  autoFocus?: boolean;
  onRemoved: () => void;
  onSaved: (option: MealCourseConfig["options"][number]) => void;
}) {
  const [label, setLabel] = useState(option.label);
  const [savedLabel, setSavedLabel] = useState(option.label);
  const [prompt, setPrompt] = useState(option.followUpPrompt ?? "");
  const [choices, setChoices] = useState(option.followUpChoices);
  const [expanded, setExpanded] = useState(Boolean(option.followUpPrompt?.trim()));

  if (option.label !== savedLabel) {
    setSavedLabel(option.label);
    setLabel(option.label);
    setPrompt(option.followUpPrompt ?? "");
    setChoices(option.followUpChoices);
  }

  async function commitLabel() {
    const next = label.trim();
    if (next === savedLabel.trim()) return;
    if (!next && savedLabel.trim()) {
      setLabel(savedLabel);
      return;
    }
    const result = await saveMealOption(option.id, next);
    if (!result.ok) {
      setLabel(savedLabel);
      return;
    }
    if (!next) {
      onRemoved();
      return;
    }
    setSavedLabel(next);
    onSaved({ ...option, label: next });
  }

  async function commitFollowUp() {
    const result = await saveMealOptionFollowUp(
      option.id,
      prompt,
      choices.map((row) => ({
        id: row.id.startsWith("local-") ? undefined : row.id,
        label: row.label,
      })),
    );
    if (!result.ok) return;
    onSaved({
      ...option,
      followUpPrompt: prompt.trim() || null,
      followUpChoices: choices.filter((row) => row.label.trim()),
    });
  }

  async function removeOption() {
    if (
      savedLabel.trim() &&
      !window.confirm("Remove this dish? Guests who picked it will lose that selection.")
    ) {
      return;
    }
    const result = await deleteMealOption(option.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-muted">=</span>
        <input
          value={label}
          autoFocus={autoFocus}
          placeholder="Dish name"
          enterKeyHint="done"
          onFocus={selectAll}
          onClick={selectAll}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => void commitLabel()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] leading-5 outline-none placeholder:text-muted"
        />
        <button
          type="button"
          className="rounded-full px-2 py-1 text-[11px] font-semibold text-muted"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide follow-up" : "Follow-up"}
        </button>
        <button
          type="button"
          aria-label="Remove dish"
          className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-[var(--danger)]"
          onClick={() => void removeOption()}
        >
          Remove
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-2 rounded-xl border border-line/70 bg-[var(--surface-soft)] p-2">
          <input
            value={prompt}
            placeholder="Follow-up question (e.g. How would you like it cooked?)"
            onChange={(event) => setPrompt(event.target.value)}
            onBlur={() => void commitFollowUp()}
            className="w-full rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs"
          />
          {choices.map((row, index) => (
            <input
              key={row.id || index}
              value={row.label}
              placeholder="Answer choice"
              onChange={(event) =>
                setChoices((prev) =>
                  prev.map((item, idx) => (idx === index ? { ...item, label: event.target.value } : item)),
                )
              }
              onBlur={() => void commitFollowUp()}
              className="w-full rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs"
            />
          ))}
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--accent)]"
            onClick={() => {
              setChoices((prev) => [...prev, { id: `local-${prev.length}`, label: "" }]);
            }}
          >
            + Add answer
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MealOrderCard({
  courses,
  guestPeople,
  orders,
  canEditMenu,
  sessionName,
  onSaved,
}: {
  courses: MealCourseConfig[];
  guestPeople: MealGuestPersonOption[];
  orders: LoadedMealOrder[];
  canEditMenu: boolean;
  sessionName: string;
  onSaved: (orders: LoadedMealOrder[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [guestPersonId, setGuestPersonId] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [selections, setSelections] = useState<MealSelectionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guestPeople.slice(0, 12);
    return guestPeople
      .filter(
        (person) =>
          person.name.toLowerCase().includes(q) || person.household.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [guestPeople, query]);

  const selectedPerson = guestPeople.find((row) => row.id === guestPersonId) ?? null;
  const existing = orders.find((row) => row.guestPersonId === guestPersonId);

  function loadPerson(id: string) {
    setGuestPersonId(id);
    const order = orders.find((row) => row.guestPersonId === id);
    setSelections(order?.selections ?? []);
    setEditing(!order || !isMealOrderComplete(courses, order.selections));
    setError(null);
  }

  function toggleOption(courseId: string, optionId: string) {
    setSelections((prev) => {
      const course = courses.find((row) => row.id === courseId);
      if (!course) return prev;
      const inCourse = prev.filter((row) => row.courseId === courseId);
      const has = inCourse.some((row) => row.optionId === optionId);
      if (has) {
        return prev.filter((row) => !(row.courseId === courseId && row.optionId === optionId));
      }
      if (inCourse.length >= course.maxSelections) {
        if (course.maxSelections === 1) {
          return [
            ...prev.filter((row) => row.courseId !== courseId),
            { courseId, optionId },
          ];
        }
        return prev;
      }
      return [...prev, { courseId, optionId }];
    });
  }

  function setFollowUp(courseId: string, optionId: string, followUpChoiceId: string) {
    setSelections((prev) =>
      prev.map((row) =>
        row.courseId === courseId && row.optionId === optionId
          ? { ...row, followUpChoiceId, followUpText: null }
          : row,
      ),
    );
  }

  async function save(requireComplete: boolean) {
    if (!guestPersonId || !selectedPerson) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveMealOrder(guestPersonId, selections, { requireComplete });
      if (!result.ok) {
        setError("Could not save — check your selections and try again.");
        return;
      }
      const nextOrder: LoadedMealOrder = {
        mealGuestId: result.id,
        guestPersonId,
        name: selectedPerson.name,
        sectionId: "guest",
        selections,
      };
      const next = [
        ...orders.filter((row) => row.guestPersonId !== guestPersonId),
        nextOrder,
      ];
      onSaved(next);
      if (requireComplete) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const you = sessionName.trim().toLowerCase();

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">Rehearsal dinner order</h2>
        <p className="text-[11px] text-muted">Who is this order for?</p>
      </div>

      {!guestPersonId ? (
        <div className="space-y-2 px-3 py-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search wedding guests"
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none"
          />
          <div className="flex flex-col gap-1">
            {filtered.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => loadPerson(person.id)}
                className="rounded-xl border border-line px-3 py-2 text-left"
              >
                <span className="block text-[15px] font-semibold">
                  {person.name}
                  {person.name.trim().toLowerCase() === you ? (
                    <span className="ml-2 text-[11px] font-semibold text-[var(--accent)]">You</span>
                  ) : null}
                </span>
                <span className="block text-[11px] text-muted">{person.household}</span>
              </button>
            ))}
          </div>
        </div>
      ) : editing ? (
        <div className="px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">{selectedPerson?.name}</p>
            <button
              type="button"
              className="text-xs font-semibold text-muted"
              onClick={() => {
                setGuestPersonId(null);
                setSelections([]);
              }}
            >
              Change guest
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {activeCourses(courses).map((course) => {
              const picks = selections.filter((row) => row.courseId === course.id);
              return (
                <div key={course.id}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {course.label || "Course"} · {courseSelectionHint(course)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {labeledCourseOptions({
                      id: course.id,
                      label: course.label,
                      options: course.options,
                    }).map((option) => {
                      const selected = picks.some((row) => row.optionId === option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(course.id, option.id)}
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
                  {picks.map((pick) => {
                    const option = course.options.find((row) => row.id === pick.optionId);
                    if (!option?.followUpPrompt?.trim() || !option.followUpChoices.length) {
                      return null;
                    }
                    return (
                      <div key={pick.optionId} className="mt-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {option.followUpPrompt}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {option.followUpChoices.map((choice) => {
                            const selected = pick.followUpChoiceId === choice.id;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => setFollowUp(course.id, pick.optionId, choice.id)}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                                style={{
                                  background: selected ? "var(--accent)" : "transparent",
                                  color: selected ? "white" : "var(--ink)",
                                  border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
                                }}
                              >
                                {choice.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
            className="mt-4 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save meal"}
          </button>
          {canEditMenu ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="mt-2 w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted disabled:opacity-60"
            >
              Save draft (editor)
            </button>
          ) : null}
        </div>
      ) : (
        <div className="px-3 py-3">
          <p className="text-[15px] font-semibold">{selectedPerson?.name}</p>
          <p className="mt-1 text-sm text-muted">{formatMealOrderSummary(courses, selections)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted"
              onClick={() => {
                setGuestPersonId(null);
                setSelections([]);
              }}
            >
              Change guest
            </button>
          </div>
        </div>
      )}

      {canEditMenu && guestPersonId && !editing && existing ? null : null}
    </section>
  );
}

function LegacyMealBoard({
  courses,
  guests,
  published,
  canEditMenu,
  sessionName,
  onTogglePublished,
}: {
  courses: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>;
  guests: Array<{ id: string; sectionId: string; name: string; choices: MealChoiceMap }>;
  published: boolean;
  canEditMenu: boolean;
  sessionName: string;
  onTogglePublished: () => void;
}) {
  const [guestList, setGuestList] = useState(guests);
  const pickable = courses.filter((course) => labeledCourseOptions(course).length > 0);
  const finished = countFinishedGuests(courses, guestList);
  const you = sessionName.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      {canEditMenu ? (
        <section className="card overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
            <div>
              <h2 className="text-sm font-semibold">Menu</h2>
              <p className="text-[11px] text-muted">Legacy menu mode (schema upgrade pending).</p>
            </div>
            <button
              type="button"
              onClick={onTogglePublished}
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: published ? "var(--accent-soft)" : "transparent",
                color: published ? "var(--accent)" : "var(--muted)",
                border: "1px solid var(--line)",
              }}
            >
              {published ? "Visible to guests" : "Hidden from guests"}
            </button>
          </div>
        </section>
      ) : null}
      {pickable.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">No dishes have been added yet.</div>
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
                    <LegacyMealGuestRow
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

function LegacyMealGuestRow({
  guest,
  courses,
  isYou,
  onPicked,
}: {
  guest: { id: string; name: string; choices: MealChoiceMap };
  courses: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>;
  isYou: boolean;
  onPicked: (courseId: string, optionId: string | null) => void;
}) {
  const [choices, setChoices] = useState(guest.choices);
  const [saved, setSaved] = useState(guest.choices);

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
