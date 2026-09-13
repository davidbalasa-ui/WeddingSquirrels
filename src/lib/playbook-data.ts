import { prisma, supportsPlaybookItems } from "@/lib/db";
import {
  CANONICAL_PLAYBOOK,
  isPlaybookKind,
  mergeCanonicalPlaybookWithPersisted,
  playbookByKind,
  type PlaybookItemView,
  type PlaybookKind,
  type PlaybookRecord,
} from "@/lib/playbook";

function persistedToRecord(row: {
  sourceKey: string;
  kind: string;
  section: string;
  startAt: string | null;
  title: string;
  detail: string | null;
  location: string | null;
  notes: string | null;
  sortOrder: number;
  completed: boolean;
  id: string;
}): (PlaybookRecord & { id: string }) | null {
  if (!isPlaybookKind(row.kind)) return null;
  return {
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
  };
}

export async function loadPlaybookItems(kind?: PlaybookKind): Promise<PlaybookItemView[]> {
  const canonical = kind ? playbookByKind(CANONICAL_PLAYBOOK, kind) : CANONICAL_PLAYBOOK;

  if (!(await supportsPlaybookItems())) {
    return canonical;
  }

  const rows = await prisma.playbookItem.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  const persisted = rows.flatMap((row) => {
    const record = persistedToRecord(row);
    return record ? [record] : [];
  });

  if (persisted.length === 0) {
    return canonical;
  }

  return mergeCanonicalPlaybookWithPersisted(canonical, persisted);
}
