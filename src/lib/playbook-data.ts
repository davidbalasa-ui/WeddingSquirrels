import { prisma, supportsPlaybookItems } from "@/lib/db";
import {
  CANONICAL_PLAYBOOK,
  isPlaybookKind,
  playbookByKind,
  type PlaybookItemView,
  type PlaybookKind,
} from "@/lib/playbook";

export async function loadPlaybookItems(kind?: PlaybookKind): Promise<PlaybookItemView[]> {
  if (!(await supportsPlaybookItems())) {
    const rows = kind ? playbookByKind(CANONICAL_PLAYBOOK, kind) : CANONICAL_PLAYBOOK;
    return rows;
  }
  const rows = await prisma.playbookItem.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  if (rows.length === 0) {
    return kind ? playbookByKind(CANONICAL_PLAYBOOK, kind) : CANONICAL_PLAYBOOK;
  }
  return rows.flatMap((row) => {
    if (!isPlaybookKind(row.kind)) return [];
    return [
      {
        sourceKey: row.sourceKey,
        kind: row.kind,
        section: row.section,
        startAt: row.startAt,
        title: row.title,
        detail: row.detail,
        location: row.location,
        notes: row.notes,
        sortOrder: row.sortOrder,
        completed: row.completed,
        id: row.id,
      } satisfies PlaybookItemView,
    ];
  });
}
