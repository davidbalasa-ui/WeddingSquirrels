/**
 * Coordinator scope rows the app wrote itself, brought up to date with David's reconciled
 * timeline. A row is only corrected while it still reads exactly as the app first wrote it.
 */
import { playbookRecordByKey } from "./playbook";

export type PlaybookReword = { id: string; sourceKey: string; title: string; notes: string; before: string; correction: string };

/** What the app first wrote, and why it changed. The new words are the canonical row's. */
const EARLIER_PLAYBOOK_NOTES: Array<{ sourceKey: string; notes: string; correction: string }> = [
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
    // David, 2026-10-11 15:21, on the girls' gifts and robes: "close this".
    sourceKey: "hm-1245-retouch",
    notes: "Get-ready robes: Harmony and Melody still TBD.",
    correction: "robes closed",
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
    return old && now != null ? [{ id: row.id, sourceKey: row.sourceKey, title: row.title, notes: now, before: old.notes, correction: old.correction }] : [];
  });
}
