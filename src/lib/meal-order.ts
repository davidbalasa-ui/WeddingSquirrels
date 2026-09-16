import type { MealCourseView } from "@/lib/meals";
import { labeledCourseOptions } from "@/lib/meals";

export type MealFollowUpChoiceView = {
  id: string;
  label: string;
};

export type MealOptionView = {
  id: string;
  label: string;
  followUpPrompt: string | null;
  followUpChoices: MealFollowUpChoiceView[];
  followUpAllowText?: boolean;
};

export type MealCourseConfig = {
  id: string;
  label: string;
  minSelections: number;
  maxSelections: number;
  options: MealOptionView[];
};

export type MealSelectionInput = {
  courseId: string;
  optionId: string;
  followUpChoiceId?: string | null;
  followUpText?: string | null;
};

export type MealOrderValidationResult =
  | { ok: true; selections: MealSelectionInput[] }
  | { ok: false; reason: string };

export type MealOrderProgress = "none" | "started" | "complete";

export function courseHasPickableOptions(course: Pick<MealCourseConfig, "options">): boolean {
  return labeledCourseOptions({ id: "", label: "", options: course.options }).length > 0;
}

export function activeCourses(courses: MealCourseConfig[]): MealCourseConfig[] {
  return courses.filter(courseHasPickableOptions);
}

function optionInCourse(course: MealCourseConfig, optionId: string) {
  return course.options.find((option) => option.id === optionId && option.label.trim());
}

export function validateMealSelections(
  courses: MealCourseConfig[],
  raw: MealSelectionInput[],
): MealOrderValidationResult {
  const active = activeCourses(courses);
  const byCourse = new Map<string, MealSelectionInput[]>();

  for (const row of raw) {
    const course = active.find((item) => item.id === row.courseId);
    if (!course) return { ok: false, reason: "invalid_course" };
    const option = optionInCourse(course, row.optionId);
    if (!option) return { ok: false, reason: "invalid_option" };

    const list = byCourse.get(course.id) ?? [];
    if (list.some((item) => item.optionId === row.optionId)) {
      return { ok: false, reason: "duplicate_option" };
    }
    list.push({
      courseId: course.id,
      optionId: row.optionId,
      followUpChoiceId: row.followUpChoiceId ?? null,
      followUpText: row.followUpText?.trim() ? row.followUpText.trim() : null,
    });
    byCourse.set(course.id, list);
  }

  for (const course of active) {
    const picks = byCourse.get(course.id) ?? [];
    if (picks.length > course.maxSelections) return { ok: false, reason: "too_many" };
    if (picks.length < course.minSelections) return { ok: false, reason: "too_few" };

    for (const pick of picks) {
      const option = optionInCourse(course, pick.optionId);
      if (!option) continue;
      const prompt = option.followUpPrompt?.trim();
      const choices = option.followUpChoices.filter((item) => item.label.trim());
      if (!prompt || choices.length === 0) {
        if (pick.followUpChoiceId || pick.followUpText) return { ok: false, reason: "unexpected_follow_up" };
        continue;
      }
      if (pick.followUpChoiceId) {
        if (!choices.some((item) => item.id === pick.followUpChoiceId)) {
          return { ok: false, reason: "invalid_follow_up" };
        }
        if (pick.followUpText) return { ok: false, reason: "invalid_follow_up" };
      } else if (!pick.followUpText) {
        return { ok: false, reason: "missing_follow_up" };
      }
    }
  }

  const normalized: MealSelectionInput[] = [];
  for (const course of active) {
    for (const pick of byCourse.get(course.id) ?? []) normalized.push(pick);
  }
  return { ok: true, selections: normalized };
}

export function isMealOrderComplete(courses: MealCourseConfig[], raw: MealSelectionInput[]): boolean {
  const active = activeCourses(courses);
  const byCourse = new Map<string, MealSelectionInput[]>();
  for (const row of raw) {
    const list = byCourse.get(row.courseId) ?? [];
    list.push(row);
    byCourse.set(row.courseId, list);
  }

  for (const course of active) {
    const picks = byCourse.get(course.id) ?? [];
    if (picks.length < course.minSelections || picks.length > course.maxSelections) return false;
    for (const pick of picks) {
      const option = optionInCourse(course, pick.optionId);
      if (!option) return false;
      const prompt = option.followUpPrompt?.trim();
      const choices = option.followUpChoices.filter((item) => item.label.trim());
      if (!prompt || choices.length === 0) continue;
      if (pick.followUpChoiceId) {
        if (!choices.some((item) => item.id === pick.followUpChoiceId)) return false;
      } else if (!pick.followUpText?.trim()) {
        return false;
      }
    }
  }

  for (const row of raw) {
    if (!active.some((course) => course.id === row.courseId)) return false;
    const course = active.find((item) => item.id === row.courseId);
    if (!course || !optionInCourse(course, row.optionId)) return false;
  }

  return true;
}

/** Legacy single-choice map: courseId -> optionId */
export type MealChoiceMap = Record<string, string | null>;

export function selectionsFromLegacyChoiceMap(
  courses: MealCourseView[],
  choices: MealChoiceMap,
): MealSelectionInput[] {
  const out: MealSelectionInput[] = [];
  for (const course of courses) {
    const optionId = choices[course.id];
    if (optionId) out.push({ courseId: course.id, optionId });
  }
  return out;
}

export function legacyChoiceMapFromSelections(selections: MealSelectionInput[]): MealChoiceMap {
  const map: MealChoiceMap = {};
  for (const row of selections) {
    map[row.courseId] = row.optionId;
  }
  return map;
}

export function mealOrderProgress(
  courses: MealCourseConfig[],
  selections: MealSelectionInput[],
): MealOrderProgress {
  if (selections.length === 0) return "none";
  return isMealOrderComplete(courses, selections) ? "complete" : "started";
}

export function summarizeMealOrders(
  courses: MealCourseConfig[],
  orders: Array<{ selections: MealSelectionInput[] }>,
): { complete: number; started: number; participants: number } {
  let complete = 0;
  let started = 0;
  for (const order of orders) {
    const progress = mealOrderProgress(courses, order.selections);
    if (progress === "complete") complete += 1;
    else if (progress === "started") started += 1;
  }
  return { complete, started, participants: orders.length };
}

export function formatSelectionLine(
  optionLabel: string,
  followUpLabel: string | null,
): string {
  if (!followUpLabel) return optionLabel;
  return `${optionLabel} — ${followUpLabel}`;
}

export function formatMealOrderSummary(
  courses: MealCourseConfig[],
  selections: MealSelectionInput[],
): string {
  const parts: string[] = [];
  for (const course of courses) {
    const picks = selections.filter((row) => row.courseId === course.id);
    if (!picks.length) continue;
    const labels = picks.map((pick) => {
      const option = course.options.find((row) => row.id === pick.optionId);
      const optionLabel = option?.label.trim() || "Choice";
      let followUp: string | null = null;
      if (pick.followUpChoiceId && option) {
        followUp = option.followUpChoices.find((row) => row.id === pick.followUpChoiceId)?.label ?? null;
      } else if (pick.followUpText) {
        followUp = pick.followUpText;
      }
      return formatSelectionLine(optionLabel, followUp);
    });
    parts.push(labels.join(" · "));
  }
  return parts.join(" · ");
}

export function canSubmitMealOrder(input: { published: boolean; canEditMenu: boolean }): boolean {
  return input.published || input.canEditMenu;
}

export function canViewMealOrdering(input: { published: boolean; canEditMenu: boolean }): boolean {
  return canSubmitMealOrder(input);
}

export function courseSelectionHint(course: Pick<MealCourseConfig, "minSelections" | "maxSelections">): string {
  const { minSelections: min, maxSelections: max } = course;
  if (min <= 0 && max <= 0) return "Optional";
  if (min === 1 && max === 1) return "Choose 1";
  if (min <= 0 && max === 1) return "Choose up to 1";
  if (min <= 0 && max > 1) return `Choose up to ${max}`;
  if (min === max) return `Choose ${min}`;
  return `Choose ${min}–${max}`;
}

/** Validates a partial save (guest editing); only checks per-course caps and follow-ups for selected rows. */
export function validatePartialMealSelections(
  courses: MealCourseConfig[],
  raw: MealSelectionInput[],
): MealOrderValidationResult {
  const active = activeCourses(courses);
  const byCourse = new Map<string, MealSelectionInput[]>();

  for (const row of raw) {
    const course = active.find((item) => item.id === row.courseId);
    if (!course) return { ok: false, reason: "invalid_course" };
    const option = optionInCourse(course, row.optionId);
    if (!option) return { ok: false, reason: "invalid_option" };
    const list = byCourse.get(course.id) ?? [];
    if (list.some((item) => item.optionId === row.optionId)) {
      return { ok: false, reason: "duplicate_option" };
    }
    list.push({
      courseId: course.id,
      optionId: row.optionId,
      followUpChoiceId: row.followUpChoiceId ?? null,
      followUpText: row.followUpText?.trim() ? row.followUpText.trim() : null,
    });
    byCourse.set(course.id, list);
  }

  for (const course of active) {
    const picks = byCourse.get(course.id) ?? [];
    if (picks.length > course.maxSelections) return { ok: false, reason: "too_many" };
    for (const pick of picks) {
      const option = optionInCourse(course, pick.optionId);
      if (!option) continue;
      const prompt = option.followUpPrompt?.trim();
      const choices = option.followUpChoices.filter((item) => item.label.trim());
      if (!prompt || choices.length === 0) {
        if (pick.followUpChoiceId || pick.followUpText) return { ok: false, reason: "unexpected_follow_up" };
        continue;
      }
      if (pick.followUpChoiceId && !choices.some((item) => item.id === pick.followUpChoiceId)) {
        return { ok: false, reason: "invalid_follow_up" };
      }
    }
  }

  const normalized: MealSelectionInput[] = [];
  for (const course of active) {
    for (const pick of byCourse.get(course.id) ?? []) normalized.push(pick);
  }
  return { ok: true, selections: normalized };
}
