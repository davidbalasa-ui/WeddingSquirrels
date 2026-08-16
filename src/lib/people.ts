import { prisma } from "@/lib/db";

/** Turn "Mother in law" / "Avalon" into a stable person id. */
export function personIdFromName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `person_${Date.now()}`;
}

export async function ensurePersonByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existingByName = await prisma.person.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existingByName) return existingByName;

  let id = personIdFromName(trimmed);
  const clash = await prisma.person.findUnique({ where: { id } });
  if (clash) id = `${id}_${Date.now().toString(36)}`;

  const maxSort = await prisma.person.aggregate({ _max: { sortOrder: true } });
  return prisma.person.create({
    data: {
      id,
      name: trimmed,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function resolveAssigneeIds(
  selectedIds: string[],
  newPersonName: string | null,
  opts?: { restrictTo?: string[] | null; fallback?: string[] },
) {
  let ids = [...selectedIds];

  if (newPersonName?.trim()) {
    const created = await ensurePersonByName(newPersonName);
    if (created) ids.push(created.id);
  }

  ids = [...new Set(ids.filter(Boolean))];

  if (opts?.restrictTo?.length) {
    ids = ids.filter((id) => opts.restrictTo!.includes(id));
    if (ids.length === 0) ids = [...opts.restrictTo];
  } else if (ids.length === 0 && opts?.fallback?.length) {
    ids = [...opts.fallback];
  }

  return ids;
}

/** Owners to pre-check on Add task. Prefer the People filter, else the only visible person, else David+Haley. */
export function defaultAssigneeIds(
  people: { id: string }[],
  preferredIds?: string[] | null,
): string[] {
  const available = new Set(people.map((person) => person.id));
  if (preferredIds?.length) {
    const picked = preferredIds.filter((id) => available.has(id));
    if (picked.length) return picked;
  }
  if (people.length === 1) return [people[0]!.id];
  return ["david", "haley"].filter((id) => available.has(id));
}

export function assigneeDisplayNames(
  assignees: { person?: { name: string } | null }[],
): string {
  return assignees
    .map((row) => row.person?.name)
    .filter((name): name is string => Boolean(name))
    .join(" · ");
}

export async function setTaskAssignees(taskId: string, personIds: string[]) {
  await prisma.taskAssignee.deleteMany({ where: { taskId } });
  for (const personId of personIds) {
    const exists = await prisma.person.findUnique({ where: { id: personId } });
    if (!exists) continue;
    await prisma.taskAssignee.create({ data: { taskId, personId } });
  }
}
