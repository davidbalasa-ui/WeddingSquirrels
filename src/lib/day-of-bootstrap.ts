/**
 * Day-of source-of-truth contract
 *
 * A. Before first import: candidate schedule may come from this bootstrap data.
 * B. After TimelineBlock rows exist in Neon: Neon is authoritative.
 * C. Future edits: PLAN Timeline writes Neon directly.
 * D. /day reads the current wedding TimelineBlock rows from the database.
 * E. Bootstrap/import scripts insert MISSING rows only. They never overwrite
 *    an existing production row, even when seedKey matches.
 *
 * seedKey is a stable identity/bootstrap aid. It is not a perpetual reset key.
 * After import, edited startAt / endAt / notes / sortOrder / title survive
 * any later candidate review or import.
 */

import { parseBlockNotes } from "@/lib/day-of-now";
import { parsedTimeFields, sortTimelineBlocks } from "@/lib/day-of-time";

export type CandidateWeddingBlock = {
  seedKey: string;
  startAt: string;
  endAt: string | null;
  notes: string;
};

export type ExistingTimelineRow = {
  id: string;
  seedKey: string | null;
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
  schedule: string;
};

export type TimelineMatchStatus = "MISSING" | "EXISTS" | "DIFFERENT";

export type CandidateReviewRow = {
  seedKey: string;
  startAt: string;
  endAt: string | null;
  title: string;
  notesSummary: string;
  proposedSortOrder: number;
  status: TimelineMatchStatus;
  existingId: string | null;
  differences: Array<"startAt" | "endAt" | "notes" | "sortOrder">;
};

export type CandidateInsert = {
  seedKey: string;
  schedule: "wedding";
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
  startMinutes: number | null;
  endMinutes: number | null;
  dayOffset: number;
};

/**
 * Candidate-authoritative October 16 wedding run-of-show.
 * Not production truth until the user reviews and imports selected rows.
 * Wendy is not MC; Kurt is MC. Notes reflect that confirmed fact.
 */
export const CANDIDATE_WEDDING_TIMELINE: CandidateWeddingBlock[] = [
  {
    seedKey: "wedding_venue_opens",
    startAt: "10:30 AM",
    endAt: null,
    notes:
      "Venue Opens\nWho goes to the venue now:\n· Vendors\n· Coordinator (Avalon)\n· Master of ceremonies (Kurt)\nWho stays at the Airbnb:\n· Everyone else",
  },
  {
    seedKey: "wedding_settle_in",
    startAt: "9:00 AM",
    endAt: "11:00 AM",
    notes:
      "Settle in at Airbnb\nEveryone sets up their personal hair/makeup stations\nSteam dresses\nLay out accessories, shoes, jewelry\nLight snacks + hydration\nKatie and Belle arrive at 11:00 AM",
  },
  {
    seedKey: "wedding_diy_hair",
    startAt: "11:00 AM",
    endAt: "11:45 AM",
    notes:
      "Wedding party DIY hair & makeup\nEveryone works in pairs or small groups\nHaley begins hair with Katie (light prep only)",
  },
  {
    seedKey: "wedding_pack_up",
    startAt: "11:45 AM",
    endAt: null,
    notes:
      "Wedding party packs up\nDresses zipped into garment bags\nTouch-up kits packed\nShoes + jewelry organized\nEveryone finishes any last-minute makeup steps\nHaley finishes hair and makeup at venue",
  },
  {
    seedKey: "wedding_party_leaves",
    startAt: "12:00 PM",
    endAt: null,
    notes: "Wedding party leaves Airbnb\nWho leaves now:\n· Everyone except David, Haley, and Belle",
  },
  {
    seedKey: "wedding_quiet_time",
    startAt: "12:00 PM",
    endAt: "12:20 PM",
    notes: "Quiet time at the Airbnb\nPrivate vows",
  },
  {
    seedKey: "wedding_vendor_arrival",
    startAt: "10:30 AM",
    endAt: "12:30 PM",
    notes:
      "Vendor + Wedding Party Arrival\nVenue opens\nDecor setup\nFlorals, rentals, tables, and ceremony space arranged\nWedding party settles in, snacks, and hydration\nWedding party arrives at 12:25 PM",
  },
  {
    seedKey: "wedding_photographer_arrives",
    startAt: "12:30 PM",
    endAt: "1:00 PM",
    notes:
      "Photographer arrives\nPhotographer unloads gear\nBegins detail shots (dress, rings, etc.)\nCaptures getting-ready candids\nHaley and David arrive at 12:45 PM",
  },
  {
    seedKey: "wedding_final_getting_ready",
    startAt: "1:00 PM",
    endAt: "2:15 PM",
    notes:
      "Final getting ready\nBride finishes hair/makeup\nWedding party final touches\nGroom + groomsmen get ready\nPhotographer captures robe photos, finishing touches, and candids\nHarmony and Melody arrive at 1:30 PM\nSkila helps kids get ready",
  },
  {
    seedKey: "wedding_getting_dressed",
    startAt: "2:15 PM",
    endAt: "2:45 PM",
    notes:
      "Getting dressed\nBride gets into dress\nFirst look with parent(s)\nPhotographer captures emotional moments + portraits",
  },
  {
    seedKey: "wedding_first_look",
    startAt: "2:45 PM",
    endAt: "3:15 PM",
    notes:
      "First Look + Portraits\nFirst look w/ David\nCouple portraits\nWedding party portraits\nImmediate family portraits",
  },
  {
    seedKey: "wedding_pre_ceremony",
    startAt: "3:15 PM",
    endAt: "3:30 PM",
    notes:
      "Pre-Ceremony Transition\nGuests begin arriving\nWedding party lines up\nTouch-ups\nPhotographer captures ceremony details + guest arrivals",
  },
  {
    seedKey: "wedding_ceremony",
    startAt: "3:30 PM",
    endAt: "4:00 PM",
    notes: "Ceremony\nUnder the shelter",
  },
  {
    seedKey: "wedding_cocktail_hour",
    startAt: "4:00 PM",
    endAt: "5:00 PM",
    notes:
      "Cocktail Hour\nGuests enjoy drinks + appetizers\nBar + trailer\nPhotographer captures candids, group photos, and reception details",
  },
  {
    seedKey: "wedding_dinner",
    startAt: "5:00 PM",
    endAt: "6:00 PM",
    notes:
      "Dinner begins\nGuests seated\nGrand entrance\nDinner service starts\nToasts can begin towards the end of this hour",
  },
  {
    seedKey: "wedding_toasts_cake",
    startAt: "6:00 PM",
    endAt: "6:30 PM",
    notes: "Toasts + Cake cutting\nFinish dinner\nToasts (Best man, MOH, FOB)\nCake cutting",
  },
  {
    seedKey: "wedding_first_dances",
    startAt: "6:30 PM",
    endAt: "7:00 PM",
    notes: "First dances\nFirst dance\nFOB dance",
  },
  {
    seedKey: "wedding_open_dancing",
    startAt: "7:00 PM",
    endAt: "10:00 PM",
    notes: "Open Dancing\nDance floor opens\nPhotographer stays until 9:00 PM to capture peak energy",
  },
  {
    seedKey: "wedding_teardown",
    startAt: "10:00 PM",
    endAt: "11:00 PM",
    notes: "Tear down / Clean up\nEveryone helps pack up before the night is over",
  },
];

export function candidateTitle(notes: string): string {
  return parseBlockNotes(notes).title;
}

export function notesSummary(notes: string, max = 96): string {
  const compact = notes.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

export function proposedWeddingSortOrders(
  candidates: CandidateWeddingBlock[] = CANDIDATE_WEDDING_TIMELINE,
): Map<string, number> {
  const sortable = candidates.map((block, index) => ({
    id: block.seedKey,
    startAt: block.startAt,
    sortOrder: index,
  }));
  const ordered = sortTimelineBlocks(sortable);
  return new Map(ordered.map((block, index) => [block.id, index]));
}

function sameText(left: string | null, right: string | null): boolean {
  return (left ?? "") === (right ?? "");
}

export function reviewCandidateWeddingTimeline(
  existing: ExistingTimelineRow[],
  candidates: CandidateWeddingBlock[] = CANDIDATE_WEDDING_TIMELINE,
): CandidateReviewRow[] {
  const bySeed = new Map(
    existing
      .filter((row) => row.seedKey)
      .map((row) => [row.seedKey as string, row]),
  );
  const proposed = proposedWeddingSortOrders(candidates);

  return candidates.map((candidate) => {
    const proposedSortOrder = proposed.get(candidate.seedKey) ?? 0;
    const current = bySeed.get(candidate.seedKey);
    const title = candidateTitle(candidate.notes);
    const summary = notesSummary(candidate.notes);
    if (!current) {
      return {
        seedKey: candidate.seedKey,
        startAt: candidate.startAt,
        endAt: candidate.endAt,
        title,
        notesSummary: summary,
        proposedSortOrder,
        status: "MISSING",
        existingId: null,
        differences: [],
      };
    }

    const differences: CandidateReviewRow["differences"] = [];
    if (!sameText(current.startAt, candidate.startAt)) differences.push("startAt");
    if (!sameText(current.endAt, candidate.endAt)) differences.push("endAt");
    if (!sameText(current.notes, candidate.notes)) differences.push("notes");
    if (current.sortOrder !== proposedSortOrder) differences.push("sortOrder");

    return {
      seedKey: candidate.seedKey,
      startAt: candidate.startAt,
      endAt: candidate.endAt,
      title,
      notesSummary: summary,
      proposedSortOrder,
      status: differences.length === 0 ? "EXISTS" : "DIFFERENT",
      existingId: current.id,
      differences,
    };
  });
}

export function planCandidateWeddingImport(
  existing: ExistingTimelineRow[],
  selectedSeedKeys: string[],
  candidates: CandidateWeddingBlock[] = CANDIDATE_WEDDING_TIMELINE,
): {
  inserts: CandidateInsert[];
  refusedOverwrite: string[];
  skippedUnselected: string[];
  unknownKeys: string[];
} {
  const review = reviewCandidateWeddingTimeline(existing, candidates);
  const byKey = new Map(review.map((row) => [row.seedKey, row]));
  const candidateByKey = new Map(candidates.map((row) => [row.seedKey, row]));
  const selected = [...new Set(selectedSeedKeys)];

  const inserts: CandidateInsert[] = [];
  const refusedOverwrite: string[] = [];
  const unknownKeys: string[] = [];

  for (const seedKey of selected) {
    const row = byKey.get(seedKey);
    const candidate = candidateByKey.get(seedKey);
    if (!row || !candidate) {
      unknownKeys.push(seedKey);
      continue;
    }
    if (row.status !== "MISSING") {
      refusedOverwrite.push(seedKey);
      continue;
    }
    const parsed = parsedTimeFields(candidate.startAt, candidate.endAt);
    inserts.push({
      seedKey: candidate.seedKey,
      schedule: "wedding",
      startAt: candidate.startAt,
      endAt: candidate.endAt,
      notes: candidate.notes,
      sortOrder: row.proposedSortOrder,
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
      dayOffset: parsed.dayOffset,
    });
  }

  const skippedUnselected = review
    .filter((row) => row.status === "MISSING" && !selected.includes(row.seedKey))
    .map((row) => row.seedKey);

  return { inserts, refusedOverwrite, skippedUnselected, unknownKeys };
}

export function formatCandidateReview(rows: CandidateReviewRow[]): string {
  const lines = [
    "CANDIDATE WEDDING TIMELINE",
    "",
    `${rows.length} rows available`,
    "",
  ];
  for (const row of rows) {
    lines.push(`seedKey: ${row.seedKey}`);
    lines.push(`startAt: ${row.startAt}`);
    lines.push(`endAt: ${row.endAt ?? "(none)"}`);
    lines.push(`title: ${row.title}`);
    lines.push(`notes: ${row.notesSummary}`);
    lines.push(`proposed sortOrder: ${row.proposedSortOrder}`);
    lines.push(`production: ${row.status}${row.existingId ? ` id=${row.existingId}` : ""}`);
    if (row.differences.length) lines.push(`different fields: ${row.differences.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function dayOfRuntimeReadsDatabaseNotCandidates(): true {
  return true;
}
