/**
 * Canonical open-actionable Task counting and listing.
 *
 * An open actionable Task is:
 *   1. a TODO leaf/child Task, OR
 *   2. a TODO standalone top-level Task with no children.
 *
 * A top-level Task with children is a container/workspace and does not count.
 * Done Tasks do not count. Org-card parents are containers; their children count.
 */

export type ActionableTaskLike = {
  id?: string | null;
  status?: string | null;
  parentId?: string | null;
  dueDate?: Date | string | null;
  assignees?: Array<{ personId: string }>;
  children?: ActionableTaskLike[] | null;
};

export function taskStatusIsDone(status?: string | null): boolean {
  return status === "done";
}

function parentIdsWithChildren(tasks: ActionableTaskLike[]): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    const kids = task.children ?? [];
    if (task.id && kids.length > 0) ids.add(task.id);
    for (const child of kids) {
      if (task.id) ids.add(task.id);
      if (child.parentId) ids.add(child.parentId);
    }
    if (task.parentId) ids.add(task.parentId);
  }
  return ids;
}

/**
 * Open leaves from a nested parent list and/or a flat Task list.
 * Workspace/org-card parents contribute 0 themselves.
 */
export function listActionableOpenTasks<T extends ActionableTaskLike>(tasks: T[]): T[] {
  const containers = parentIdsWithChildren(tasks);
  const out: T[] = [];
  const seen = new Set<string>();

  const push = (task: T) => {
    if (taskStatusIsDone(task.status)) return;
    if (task.id) {
      if (seen.has(task.id)) return;
      seen.add(task.id);
    }
    out.push(task);
  };

  for (const task of tasks) {
    const kids = task.children ?? [];
    if (kids.length > 0) {
      for (const child of kids) {
        if (!taskStatusIsDone(child.status)) push(child as T);
      }
      continue;
    }
    if (task.parentId) {
      push(task);
      continue;
    }
    if (task.id && containers.has(task.id)) continue;
    push(task);
  }

  return out;
}

export function countActionableOpenTasks(tasks: ActionableTaskLike[]): number {
  return listActionableOpenTasks(tasks).length;
}

/** Open top-level cards (workspaces, org-card parents, and standalone packages). */
export function countOpenWorkspaceCards(tasks: ActionableTaskLike[]): number {
  return tasks.filter((task) => !task.parentId && !taskStatusIsDone(task.status)).length;
}

export type InboxActionableLike = {
  kind: string;
  done?: boolean;
  sourceId?: string;
  parentId?: string | null;
};

/**
 * Same canonical rule, expressed over Today inbox rows:
 * open task_step + open org_step + open childless kind=task packages.
 */
export function countActionableOpenInboxTasks(items: InboxActionableLike[]): number {
  const parentsWithSteps = new Set<string>();
  for (const item of items) {
    if (item.kind === "task_step" && item.parentId) parentsWithSteps.add(item.parentId);
  }

  let n = 0;
  for (const item of items) {
    if (item.done) continue;
    if (item.kind === "task_step" || item.kind === "org_step") {
      n += 1;
      continue;
    }
    if (item.kind === "task" && !parentsWithSteps.has(item.sourceId ?? "")) n += 1;
  }
  return n;
}
