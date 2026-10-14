/**
 * Coordinator scope rows the app wrote itself, brought up to date with David's reconciled
 * timeline. A row is only corrected while it still reads exactly as the app first wrote it.
 */
import { playbookRecordByKey } from "./playbook";

export type PlaybookReword = {
  id: string;
  sourceKey: string;
  title: string;
  notes: string;
  before: string;
  correction: string;
  /** The row's detail as the app wrote it, and as it reads now; only rewritten while it still reads as before. */
  detail?: { before: string; now: string | null };
};

/** What the app first wrote, and why it changed. The new words are the canonical row's. */
const EARLIER_PLAYBOOK_NOTES: Array<{ sourceKey: string; notes: string; correction: string; detail?: string }> = [
  {
    // The reconciled timeline has "Sign the marriage license" at 4:00 PM, immediately after the recessional.
    sourceKey: "avalon-license",
    notes: "Avalon is contracted to assist. Exact timing (before ceremony vs 4:00 PM) is still TBD.",
    correction: "time TBD → 4:00 PM",
  },
  {
    // David, 2026-10-11 12:31: "the signing will be [3:50] to 4:00".
    sourceKey: "avalon-license",
    notes: "Avalon is contracted to assist. Signing is at 4:00 PM, immediately after the recessional.",
    correction: "signing 3:50–4:00 PM",
  },
  {
    // David, 2026-10-11 15:50: "dinner begins at 5:15, avalon is releasing then".
    sourceKey: "avalon-release",
    notes: "Avalon releases tables for dinner around 5:20 PM. Haley and David first.",
    correction: "tables released at 5:15 PM",
  },
  {
    // David, 2026-10-11 15:21, on the girls' gifts and robes: "close this".
    sourceKey: "hm-1245-retouch",
    notes: "Get-ready robes: Harmony and Melody still TBD.",
    correction: "robes closed",
  },
  {
    // David, 2026-10-14 15:09: "we do need to update trash to being Tracy and Victor."
    sourceKey: "decor-trash",
    notes: "Haley's parents take trash.",
    detail: "Haley's parents",
    correction: "trash: Tracy and Victor",
  },
  {
    sourceKey: "avalon-breakdown",
    notes: "Full décor clean-up/breakdown for the client's point person. That is not Avalon personally owning removal or transport of all decor. Haley's parents take trash and take decor home.",
    correction: "trash: Tracy and Victor",
  },
];

export function planPlaybookRewords(
  existing: Array<{ id: string; sourceKey: string; title: string; notes: string | null }>,
): PlaybookReword[] {
  return existing.flatMap((row) => {
    const old = EARLIER_PLAYBOOK_NOTES.find((entry) => entry.sourceKey === row.sourceKey && entry.notes === row.notes);
    // A row whose open line was closed now has no notes; it is cleared, never left with the old line.
    const record = old && playbookRecordByKey(old.sourceKey);
    const now = record ? (record.notes ?? "") : null;
    if (!old || now == null) return [];
    const detail = old.detail != null ? { before: old.detail, now: record?.detail ?? null } : undefined;
    return [{ id: row.id, sourceKey: row.sourceKey, title: row.title, notes: now, before: old.notes, correction: old.correction, ...(detail ? { detail } : {}) }];
  });
}
