/**
 * Three-way merge of a moment's notes, line by line.
 *
 * `base` is the text a device last saw saved, `theirs` is what is saved now (another device
 * changed it since), `mine` is what this device is saving. A line only one side touched is
 * taken from that side; lines both sides added at the same spot are kept, the already-saved
 * ones first; where both sides changed the same line, the save being made now wins.
 */
export function mergeTextLines(base: string, theirs: string, mine: string): string {
  const baseLines = splitLines(base);
  const theirLines = splitLines(theirs);
  const mineLines = splitLines(mine);
  if (sameLines(theirLines, baseLines) || sameLines(theirLines, mineLines)) return mineLines.join("\n");
  if (sameLines(mineLines, baseLines)) return theirLines.join("\n");

  const ours = align(baseLines, mineLines);
  const others = align(baseLines, theirLines);
  const out: string[] = [];
  for (let i = 0; i <= baseLines.length; i += 1) {
    const mineAdded = ours.inserted[i] ?? [];
    const theirAdded = others.inserted[i] ?? [];
    const bothDropped = i < baseLines.length && !ours.kept[i] && !others.kept[i];
    if (sameLines(mineAdded, theirAdded)) {
      out.push(...mineAdded);
    } else if (bothDropped && mineAdded.length && theirAdded.length) {
      // Both rewrote this line: the save being made now wins.
      out.push(...mineAdded);
    } else {
      out.push(...theirAdded, ...mineAdded);
    }
    if (i < baseLines.length && ours.kept[i] && others.kept[i]) out.push(baseLines[i]!);
  }
  return dedupeAdjacent(out).join("\n");
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** For each base line whether `next` still has it, and the lines `next` adds before base line i (i = length: at the end). */
function align(base: string[], next: string[]): { kept: boolean[]; inserted: string[][] } {
  const n = base.length;
  const m = next.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = base[i] === next[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const kept = new Array<boolean>(n).fill(false);
  const inserted: string[][] = Array.from({ length: n + 1 }, () => []);
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && base[i] === next[j]) {
      kept[i] = true;
      i += 1;
      j += 1;
    } else if (j < m && (i === n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      inserted[i]!.push(next[j]!);
      j += 1;
    } else {
      i += 1;
    }
  }
  return { kept, inserted };
}

function dedupeAdjacent(lines: string[]): string[] {
  return lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
}

type TimelineFields = { startAt: string; endAt: string; notes: string };

/**
 * A save from a device that last saw `base`, while `current` is saved now. Fields this device
 * did not touch keep the current value; notes are merged line by line. Without a base (an old
 * page) the save is taken as sent, as before.
 */
export function mergeStaleTimelineSave(sent: TimelineFields, current: TimelineFields, base?: TimelineFields): TimelineFields {
  if (!base) return sent;
  const same = (a: string, b: string) => a.trim() === b.trim();
  if (same(base.notes, current.notes) && same(base.startAt, current.startAt) && same(base.endAt, current.endAt)) return sent;
  return {
    startAt: same(sent.startAt, base.startAt) ? current.startAt : sent.startAt,
    endAt: same(sent.endAt, base.endAt) ? current.endAt : sent.endAt,
    // Notes typed away are nothing to save (the save step puts the saved notes back), not a merge.
    notes: !sent.notes.trim() || same(sent.notes, base.notes) ? current.notes : mergeTextLines(base.notes, current.notes, sent.notes),
  };
}
