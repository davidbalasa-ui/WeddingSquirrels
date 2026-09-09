/**
 * Idempotent planner for wedding-ops production updates.
 *
 * Never deletes. Never seeds/resets. Classifies each intended write as
 * insert, update, skip, or conflict. The apply script executes only inserts
 * and updates after a dry-run.
 */

import { parseBlockNotes } from "@/lib/day-of-now";
import { isMcDirectoryLabel } from "@/lib/print-center";
import { CANONICAL_PLAYBOOK, type PlaybookRecord } from "@/lib/playbook";

export const EXPECTED_COUPLE_NAMES = "David & Haley";
export const EXPECTED_WEDDING_DATE = "2026-10-16";
export const EXPECTED_TIMEZONE = "America/Detroit";

export type TimelineSnapshot = {
  id: string;
  seedKey: string | null;
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
  schedule: string;
};

export type ContactSnapshot = {
  id: string;
  name: string;
  directoryLabel: string | null;
  directoryList: string | null;
  isDayOfContact: boolean;
  phone: string | null;
  email: string | null;
  personId: string | null;
};

export type PersonSnapshot = {
  id: string;
  name: string;
  directoryLabel: string | null;
  isDayOfContact: boolean;
};

export type PlaybookSnapshot = {
  id: string;
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
};

export type TaskSnapshot = {
  id: string;
  title: string;
  orgKey: string | null;
  status: string;
  parentId: string | null;
};

export type AssignmentSnapshot = {
  id: string;
  title: string;
  notes: string | null;
};

export type WeddingOpsSnapshot = {
  coupleNames: string;
  weddingDateIso: string | null;
  timezone: string;
  timeline: TimelineSnapshot[];
  contacts: ContactSnapshot[];
  people: PersonSnapshot[];
  playbook: PlaybookSnapshot[];
  tasks: TaskSnapshot[];
  assignments: AssignmentSnapshot[];
};

export type PlannedInsert<T> = { action: "insert"; row: T };
export type PlannedUpdate<T> = { action: "update"; id: string; from: Partial<T>; to: Partial<T> };
export type PlannedSkip = { action: "skip"; reason: string; identity: string };
export type PlannedConflict = { action: "conflict"; reason: string; identity: string };

export type TimelineWrite = {
  seedKey: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
};

export type ContactWrite = {
  id: string;
  name: string;
  directoryLabel?: string | null;
  isDayOfContact?: boolean;
  phone?: string | null;
  email?: string | null;
};

export type PersonWrite = {
  id: string;
  name: string;
  directoryLabel?: string | null;
  isDayOfContact?: boolean;
};

export type TaskWrite = {
  orgKey: string;
  title: string;
  summary: string;
  planNotes: string;
};

export type AssignmentWrite = {
  id: string;
  notes: string;
};

export type WeddingOpsPlan = {
  identityError: string | null;
  timelineInserts: Array<PlannedInsert<TimelineWrite>>;
  timelineUpdates: Array<PlannedUpdate<TimelineWrite> & { seedKey: string }>;
  contactUpdates: Array<PlannedUpdate<ContactWrite>>;
  personUpdates: Array<PlannedUpdate<PersonWrite>>;
  playbookInserts: Array<PlannedInsert<PlaybookRecord>>;
  playbookUpdates: Array<PlannedUpdate<PlaybookRecord> & { sourceKey: string }>;
  taskInserts: Array<PlannedInsert<TaskWrite>>;
  assignmentUpdates: Array<PlannedUpdate<AssignmentWrite>>;
  skips: PlannedSkip[];
  conflicts: PlannedConflict[];
  deletes: [];
};

const REQUIRED_MC_LINES: Record<string, string[]> = {
  wedding_pre_ceremony: [
    "Playlist: While They Wait 3:00–3:30",
    'MC cue 3:25 PM: "Friends and travelers, welcome! Our ceremony will begin shortly. Please find your seats and silence your phones as we prepare to witness David and Haley begin their next chapter."',
  ],
  wedding_ceremony: [
    "Playlist: Walking Down The Aisle",
    'MC cue at 4:00: "The ceremony has concluded - let the celebration begin!"',
  ],
  wedding_cocktail_hour: [
    'MC cue 4:55: "Honored guests, cocktail hour is nearing its end."',
  ],
  wedding_dinner: [
    "Grand Entrance Song: Special Dances Playlist",
    'MC cue 5:00: "If I may have your attention - it’s time! Please welcome the wedding party, and then join me in cheering for the newlyweds, David and Haley!"',
    'Dinner cue immediately after entrance: "Our couple has arrived - let the feast begin!"',
    "Playlist: Dinner Minstrels, start of dinner through start of toasts",
  ],
  wedding_toasts_cake: [
    'MC cue 6:00: "As dinner winds down, please return to your seats."',
    'MC cue 6:15: "With the toasts complete, gather near the cake table."',
  ],
  wedding_first_dances: [
    "Music: First Dance and Father Daughter",
    'MC cue 6:30: "Please turn your attention to the center of the space."',
  ],
  wedding_open_dancing: [
    'MC cue 7:00: "The dance floor is officially open in the glass house."',
    "Playlist: Wedding - Kids Section 7:00–8:15",
    'MC cue 8:00: "A gentle reminder for our younger travelers."',
    "Playlist: Wedding - Adults Section 8:15–8:30",
    'MC cue 8:30 — Dollar Dance: "It’s time for a cherished tradition - the dollar dance."',
    "Music: Dollar Dance Song, Special Dances Playlist",
    'MC cue 9:55 — Last Call + Final Dance: "As the evening winds down, this is the last call for drinks."',
    "Music: Last Dance Song, Special Dances Playlist",
    'MC cue 10:00 — Reception Conclusion: "Our celebration has reached its end."',
  ],
};

const TIMELINE_TITLE_UPDATES: Record<string, string> = {
  wedding_diy_hair: "Hair & makeup at Airbnb",
};

const TIMELINE_REPLACE_LINES: Record<string, Array<{ from: RegExp; to: string }>> = {
  wedding_vendor_arrival: [
    {
      from: /^florals, rentals, tables, and ceremony space arranged$/i,
      to: "No florist. Lanterns, clouds, tables, and ceremony space arranged",
    },
  ],
};

const TIMELINE_ADD_LINES: Record<string, string[]> = {
  wedding_settle_in: [
    "Katie (hair) and Belle (video) arrive at 10:30–11:00 AM",
    "Steam dresses and lay out accessories",
  ],
  wedding_venue_opens: [
    "Wendy Rush (Mistress of Ceremonies) and Kurt Huizenga (MC) arrive",
    "Avalon (coordinator) arrives 10:30 or 11:00 AM",
    "Who goes to the venue now: vendors, Avalon, Kurt, Wendy",
    "Who stays at the Airbnb: everyone else",
  ],
  wedding_diy_hair: [
    "Katie does Haley's hair — confirmed, not DIY",
    "Party stations: bathrooms for hair, bedrooms for makeup (see Hair & Makeup page)",
  ],
  wedding_pack_up: [
    "11:30 AM — Airbnb cleaned; wedding and personal items packed",
    "11:45 AM — eat, pack cars",
  ],
  wedding_party_leaves: [
    "Bridal party arrives at Black Sheep Shelter at 12:15 PM",
    "Haley, David, and Belle stay at the Airbnb",
  ],
  wedding_vendor_arrival: [
    "Decor setup (lanterns, clouds, tables) — no florist",
    "Wendy and Kurt are on site for MC/setup support",
    "Wedding party arrives at 12:15–12:25 PM",
  ],
  wedding_photographer_arrives: [
    "Detail shots: dress, rings, shoes, accessories, detail box",
    "Bridal party brings Haley's dress, shoes, accessories, and the detail box",
    "Haley, David, and Belle leave the Airbnb at 12:30 PM and arrive 12:45 PM",
  ],
  wedding_final_getting_ready: [
    "12:45 PM — Haley retouch makeup and get-ready photos",
    "Get-ready robes: Harmony and Melody still TBD",
    "1:00 PM — David first look / boutonniere pin",
    "1:00 PM — Haley in dress (Mother of the Bride to help)",
    "1:15 PM — Harmony and Melody arrival",
    "Caterer arrival time TBD",
  ],
  wedding_getting_dressed: [
    "1:15 PM — Haley first look with Dad",
    "1:30 PM — bridal portraits",
    "1:45 PM — groom portraits",
    "2:00 PM — bridal party dressed",
  ],
  wedding_first_look: [
    "2:00 PM — Haley and David first look",
    "2:15 PM — couple portraits",
    "2:15 PM — Harmony and Melody ready; Skila helps hair and makeup",
    "2:00 PM — Denise and Lisa pick up cake at Airbnb; 2:30 PM arrive at BSS (fridge by suites)",
    "2:30 PM — immediate family portraits",
    "2:45 PM — bridal party photos",
  ],
  wedding_pre_ceremony: [
    "3:00 PM — earliest guest arrival",
    "3:00 PM — officiant arrives",
    "3:15 PM — couple and bridal party hide; makeup touch-ups",
    "3:20 PM — wedding party lines up (see MC Run of Show lineup)",
    "Crossbow announcement rides with ceremony conclusion / cocktail start",
  ],
  wedding_ceremony: [
    "Wedding party song: Falling Colors by Judah Earl",
    "Bride song: Sand Drawing by Judah Earl",
    "Under the shelter",
  ],
  wedding_cocktail_hour: [
    "Officiant asks family to stay for photos",
    "4:00 PM — bar opens; couple cocktails and app plates",
    "Marriage license signing time still TBD (before ceremony vs 4:00 PM)",
    "4:05 PM — family photos; Wendy to help",
    "4:30 PM — couple re-enters cocktail hour",
    "4:45 PM — touch-ups; get couple drink for table",
    "4:50 PM — bridal party lines up for reception entrances",
  ],
  wedding_dinner: [
    "Avalon releases tables around 5:20 PM — Haley and David first",
    "5:45 PM — sunset photos",
    "Cake cutting stays at 6:15 with toasts (not the 5:15 if-by-the-bar maybe)",
  ],
  wedding_toasts_cake: [
    "Speeches: Braxton, Andi, John",
    "Cake cutting uses the dagger",
  ],
  wedding_first_dances: [
    "First dance: Fairytale (Violin Version) by Dramatica",
    "Father-daughter: My Girl by The Temptations",
  ],
  wedding_open_dancing: [
    "Dance floor opens at 7:00 PM in the glass house (not the older 7:45 PDF time)",
    "Starting song: Cupid Shuffle",
    "8:30 PM — night-sky photos",
    "9:00 PM — photographer leaves",
    "Last open dance: Moon by Logan Bowden",
    "9:55 PM — private last dance after last call",
  ],
  wedding_teardown: [
    "Trash: Haley's parents",
    "Decor goes with Haley's parents and anyone staying with them",
    "Avalon breaks down decor for the point person — not transport/removal of everything",
    "Tables stay; wood tables under the shelter",
    "Chairs stacked along backs of pews; short pews returned",
    "Venue gets swept",
    "11:00 PM — venue closes",
  ],
};

const REHEARSAL_ADD_LINES: Record<string, string[]> = {
  rehearsal_checkin: [
    "Thursday, October 15, 2026",
    "Airbnb: 10268 51st St, Grand Junction, MI 49056",
  ],
  rehearsal_dinner: [
    "Hawkshead — 523 Hawks Nest Dr, South Haven",
  ],
  rehearsal_walkthrough: [
    "Black Sheep Shelter rehearsal 6:00–7:00 PM",
    "Venue: 342 62nd St, South Haven, MI 49090",
  ],
};

export const OPEN_WORK_TASKS: TaskWrite[] = [
  {
    orgKey: "license-signing-time",
    title: "Confirm when the marriage license will be signed",
    summary: "Avalon is contracted to assist. Timing is still a question mark on the timeline.",
    planNotes:
      "The 10.16.26 timeline asks whether license signing is at 4:00 PM or before the ceremony. Do not invent a time. This is not a duplicate of Avalon's vendor-scope responsibility.",
  },
  {
    orgKey: "harmony-melody-robe-photos",
    title: "Decide whether Harmony and Melody join Haley get-ready robe photos",
    summary: "The hair/makeup and timeline PDFs still have this as a question.",
    planNotes: "Get-ready robes around 12:45 PM. Do not assume they are included until Haley/David decide.",
  },
];

const APPROVED_CONTACT_CHANNELS: Array<{
  nameMatch: RegExp;
  expectedNameIncludes: string;
  phone?: string;
  email?: string;
  directoryLabel?: string;
  isDayOfContact?: boolean;
  approvedIds?: string[];
}> = [
  {
    nameMatch: /avalon green/i,
    expectedNameIncludes: "Avalon",
    phone: "386.589.7215",
    email: "greengardeneventsmi@gmail.com",
    approvedIds: ["cmt0oqlfj000qfhb8ze02e4o6"],
  },
  {
    nameMatch: /black sheep/i,
    expectedNameIncludes: "Black Sheep",
    phone: "(616) 335-0797",
    approvedIds: ["cmt0oqljk000rfhb8f9b1ua60"],
  },
  {
    nameMatch: /barry tilson/i,
    expectedNameIncludes: "Barry",
    phone: "(248) 704-3731",
    approvedIds: ["cmt0oqlmh000sfhb8hk7z02pr"],
  },
  {
    nameMatch: /belle genton · videographer|belle genton · video/i,
    expectedNameIncludes: "Belle Genton · Videographer",
    phone: "(513) 833-0929",
    approvedIds: ["cmt0oqlpf000tfhb8wvd5iwhr"],
  },
  {
    nameMatch: /precious peony/i,
    expectedNameIncludes: "Precious Peony",
    email: "preciouspeonyllc@gmail.com",
    approvedIds: ["cmt0oqlsd000ufhb8sx77c7bh"],
  },
  {
    nameMatch: /^wendy rush$/i,
    expectedNameIncludes: "Wendy Rush",
    phone: "(616) 318-9393",
    directoryLabel: "Mistress of Ceremonies",
    isDayOfContact: true,
  },
];

function normalizeLine(line: string): string {
  return line
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function applyNoteReplacements(
  notes: string,
  replacements: Array<{ from: RegExp; to: string }>,
): { notes: string; changed: boolean } {
  let changed = false;
  const next = notes.split("\n").map((line) => {
    const trimmed = line.trim();
    for (const rule of replacements) {
      if (rule.from.test(trimmed) && trimmed !== rule.to) {
        changed = true;
        return rule.to;
      }
    }
    return line;
  });
  return { notes: next.join("\n"), changed };
}

export function notesHasLine(notes: string, line: string): boolean {
  const wanted = normalizeLine(line);
  return notes
    .split("\n")
    .map(normalizeLine)
    .some((existing) => existing === wanted || existing.includes(wanted));
}

export function mergeTimelineNotes(
  existing: string,
  addLines: string[],
  title?: string,
): { notes: string; changed: boolean } {
  const lines = existing.split("\n");
  const next = [...lines];
  if (title) {
    if (!next[0] || parseBlockNotes(existing).title !== title) {
      if (next.length === 0) next.push(title);
      else next[0] = title;
    }
  }
  for (const line of addLines) {
    if (!notesHasLine(next.join("\n"), line)) next.push(line);
  }
  const notes = next.join("\n").replace(/\n+$/, "");
  return { notes, changed: notes !== existing };
}

export function productionWeddingIdentityError(snapshot: {
  coupleNames: string;
  weddingDateIso: string | null;
  timezone: string;
}): string | null {
  if (snapshot.coupleNames.trim() !== EXPECTED_COUPLE_NAMES) {
    return `coupleNames is ${JSON.stringify(snapshot.coupleNames)}, expected ${EXPECTED_COUPLE_NAMES}`;
  }
  const day = snapshot.weddingDateIso?.slice(0, 10);
  if (day !== EXPECTED_WEDDING_DATE) {
    return `weddingDate is ${JSON.stringify(day)}, expected ${EXPECTED_WEDDING_DATE}`;
  }
  if (snapshot.timezone !== EXPECTED_TIMEZONE) {
    return `timezone is ${JSON.stringify(snapshot.timezone)}, expected ${EXPECTED_TIMEZONE}`;
  }
  return null;
}

function findUniqueContact(
  contacts: ContactSnapshot[],
  match: (row: ContactSnapshot) => boolean,
  identity: string,
): ContactSnapshot | PlannedConflict | PlannedSkip {
  const hits = contacts.filter(match);
  if (hits.length === 0) return { action: "skip", reason: "no matching contact", identity };
  if (hits.length > 1) {
    return {
      action: "conflict",
      reason: `multiple contacts matched (${hits.map((row) => row.id).join(", ")})`,
      identity,
    };
  }
  return hits[0]!;
}

function channelConflict(
  current: string | null,
  wanted: string | undefined,
  field: string,
  identity: string,
): PlannedConflict | null {
  if (!wanted) return null;
  const have = current?.trim() || "";
  if (!have || have === wanted) return null;
  if (normalizeLine(have) === normalizeLine(wanted)) return null;
  return {
    action: "conflict",
    reason: `${field} already ${JSON.stringify(have)}; will not overwrite with ${JSON.stringify(wanted)}`,
    identity,
  };
}

export function emptyWeddingOpsPlan(): WeddingOpsPlan {
  return {
    identityError: null,
    timelineInserts: [],
    timelineUpdates: [],
    contactUpdates: [],
    personUpdates: [],
    playbookInserts: [],
    playbookUpdates: [],
    taskInserts: [],
    assignmentUpdates: [],
    skips: [],
    conflicts: [],
    deletes: [],
  };
}

export function planWeddingOpsUpdate(snapshot: WeddingOpsSnapshot): WeddingOpsPlan {
  const plan = emptyWeddingOpsPlan();
  plan.identityError = productionWeddingIdentityError(snapshot);
  if (plan.identityError) return plan;

  const wedding = snapshot.timeline.filter((row) => row.schedule === "wedding");
  const bySeed = new Map(wedding.map((row) => [row.seedKey, row]));

  for (const [seedKey, addLines] of Object.entries(TIMELINE_ADD_LINES)) {
    const existing = bySeed.get(seedKey);
    const mcLines = REQUIRED_MC_LINES[seedKey] ?? [];
    const title = TIMELINE_TITLE_UPDATES[seedKey];
    if (!existing) {
      plan.skips.push({
        action: "skip",
        reason: "timeline seedKey not present — will not invent a new block",
        identity: seedKey,
      });
      continue;
    }
    const replaced = applyNoteReplacements(existing.notes, TIMELINE_REPLACE_LINES[seedKey] ?? []);
    const merged = mergeTimelineNotes(replaced.notes, [...mcLines, ...addLines], title);
    if (!merged.changed && !replaced.changed) {
      plan.skips.push({ action: "skip", reason: "notes already include enrichment", identity: seedKey });
      continue;
    }
    plan.timelineUpdates.push({
      action: "update",
      id: existing.id,
      seedKey,
      from: { notes: existing.notes },
      to: { notes: merged.notes },
    });
  }

  for (const [seedKey, lines] of Object.entries(REQUIRED_MC_LINES)) {
    if (TIMELINE_ADD_LINES[seedKey]) continue;
    const existing = bySeed.get(seedKey);
    if (!existing) {
      plan.skips.push({
        action: "skip",
        reason: "MC seedKey not present",
        identity: seedKey,
      });
      continue;
    }
    const merged = mergeTimelineNotes(existing.notes, lines);
    if (!merged.changed) {
      plan.skips.push({ action: "skip", reason: "MC cues already present", identity: seedKey });
      continue;
    }
    plan.timelineUpdates.push({
      action: "update",
      id: existing.id,
      seedKey,
      from: { notes: existing.notes },
      to: { notes: merged.notes },
    });
  }

  for (const [seedKey, addLines] of Object.entries(REHEARSAL_ADD_LINES)) {
    const existing = snapshot.timeline.find(
      (row) => row.schedule === "rehearsal" && row.seedKey === seedKey,
    );
    if (!existing) {
      plan.skips.push({
        action: "skip",
        reason: "rehearsal seedKey not present — addresses stay in report",
        identity: seedKey,
      });
      continue;
    }
    const merged = mergeTimelineNotes(existing.notes, addLines);
    if (!merged.changed) {
      plan.skips.push({ action: "skip", reason: "rehearsal notes already include addresses", identity: seedKey });
      continue;
    }
    plan.timelineUpdates.push({
      action: "update",
      id: existing.id,
      seedKey,
      from: { notes: existing.notes },
      to: { notes: merged.notes },
    });
  }

  for (const spec of APPROVED_CONTACT_CHANNELS) {
    const identity = spec.expectedNameIncludes;
    const found = findUniqueContact(
      snapshot.contacts,
      (row) => {
        if (spec.approvedIds?.includes(row.id)) return true;
        return spec.nameMatch.test(row.name);
      },
      identity,
    );
    if ("action" in found) {
      if (found.action === "conflict") plan.conflicts.push(found);
      else plan.skips.push(found);
      continue;
    }
    const to: Partial<ContactWrite> = {};
    const from: Partial<ContactWrite> = {};
    const phoneConflict = channelConflict(found.phone, spec.phone, "phone", identity);
    const emailConflict = channelConflict(found.email, spec.email, "email", identity);
    if (phoneConflict) plan.conflicts.push(phoneConflict);
    else if (spec.phone && (found.phone?.trim() || "") !== spec.phone) {
      from.phone = found.phone;
      to.phone = spec.phone;
    }
    if (emailConflict) plan.conflicts.push(emailConflict);
    else if (spec.email && (found.email?.trim() || "") !== spec.email) {
      from.email = found.email;
      to.email = spec.email;
    }
    if (spec.directoryLabel && found.directoryLabel !== spec.directoryLabel) {
      const current = found.directoryLabel ?? "";
      const allowedOverwrite =
        /setup|teardown|clean/i.test(current) ||
        isMcDirectoryLabel(current) ||
        current.trim() === "";
      if (!allowedOverwrite && current.trim()) {
        plan.conflicts.push({
          action: "conflict",
          reason: `directoryLabel already ${JSON.stringify(current)}`,
          identity,
        });
      } else {
        from.directoryLabel = found.directoryLabel;
        to.directoryLabel = spec.directoryLabel;
      }
    }
    if (spec.isDayOfContact != null && found.isDayOfContact !== spec.isDayOfContact) {
      from.isDayOfContact = found.isDayOfContact;
      to.isDayOfContact = spec.isDayOfContact;
    }
    if (Object.keys(to).length === 0) {
      plan.skips.push({ action: "skip", reason: "contact already matches", identity: `${found.id} ${found.name}` });
      continue;
    }
    plan.contactUpdates.push({
      action: "update",
      id: found.id,
      from,
      to,
    });
  }

  const familyBelle = snapshot.contacts.filter(
    (row) => /^belle genton$/i.test(row.name) && !/video/i.test(row.name),
  );
  for (const row of familyBelle) {
    plan.skips.push({
      action: "skip",
      reason: "family Belle Genton row is a separate identity from the videographer contact",
      identity: row.id,
    });
  }

  const kurtContacts = snapshot.contacts.filter((row) => /\bkurt\b/i.test(row.name));
  if (kurtContacts.length === 0) {
    plan.skips.push({
      action: "skip",
      reason: "no Kurt Contact row — will not fabricate phone/email or a name-only contact",
      identity: "Kurt Huizenga contact",
    });
  } else if (kurtContacts.length > 1) {
    plan.conflicts.push({
      action: "conflict",
      reason: "multiple Kurt contacts",
      identity: kurtContacts.map((row) => row.id).join(", "),
    });
  } else {
    const kurt = kurtContacts[0]!;
    plan.skips.push({
      action: "skip",
      reason: "Kurt Contact exists; phone/email still missing and will not be invented",
      identity: kurt.id,
    });
    if (kurt.directoryLabel !== "MC" || !kurt.isDayOfContact) {
      plan.contactUpdates.push({
        action: "update",
        id: kurt.id,
        from: { directoryLabel: kurt.directoryLabel, isDayOfContact: kurt.isDayOfContact },
        to: { directoryLabel: "MC", isDayOfContact: true },
      });
    }
  }

  for (const person of snapshot.people) {
    if (/^wendy rush$/i.test(person.name) || person.id === "wendy_rush" || person.id === "wendy") {
      const to: Partial<PersonWrite> = {};
      const from: Partial<PersonWrite> = {};
      if (person.directoryLabel !== "Mistress of Ceremonies") {
        from.directoryLabel = person.directoryLabel;
        to.directoryLabel = "Mistress of Ceremonies";
      }
      if (!person.isDayOfContact) {
        from.isDayOfContact = person.isDayOfContact;
        to.isDayOfContact = true;
      }
      if (Object.keys(to).length) {
        plan.personUpdates.push({ action: "update", id: person.id, from, to });
      } else {
        plan.skips.push({ action: "skip", reason: "Wendy person already labeled", identity: person.id });
      }
    }
    if (/^kurt/i.test(person.name) || person.id === "kurt") {
      const to: Partial<PersonWrite> = {};
      const from: Partial<PersonWrite> = {};
      if (person.directoryLabel !== "MC") {
        from.directoryLabel = person.directoryLabel;
        to.directoryLabel = "MC";
      }
      if (!person.isDayOfContact) {
        from.isDayOfContact = person.isDayOfContact;
        to.isDayOfContact = true;
      }
      if (Object.keys(to).length) {
        plan.personUpdates.push({ action: "update", id: person.id, from, to });
      } else {
        plan.skips.push({ action: "skip", reason: "Kurt person already labeled MC / day-of", identity: person.id });
      }
    }
  }

  const playbookByKey = new Map(snapshot.playbook.map((row) => [row.sourceKey, row]));
  for (const record of CANONICAL_PLAYBOOK) {
    const existing = playbookByKey.get(record.sourceKey);
    if (!existing) {
      plan.playbookInserts.push({ action: "insert", row: record });
      continue;
    }
    if (existing.completed && record.completed === false) {
      plan.skips.push({
        action: "skip",
        reason: "existing completion state preserved",
        identity: record.sourceKey,
      });
    }
    const changed =
      existing.kind !== record.kind ||
      existing.section !== record.section ||
      existing.startAt !== record.startAt ||
      existing.title !== record.title ||
      existing.detail !== record.detail ||
      existing.location !== record.location ||
      existing.notes !== record.notes ||
      existing.sortOrder !== record.sortOrder;
    if (!changed) {
      plan.skips.push({ action: "skip", reason: "playbook row already matches", identity: record.sourceKey });
      continue;
    }
    plan.playbookUpdates.push({
      action: "update",
      id: existing.id,
      sourceKey: record.sourceKey,
      from: {
        title: existing.title,
        notes: existing.notes,
        detail: existing.detail,
        location: existing.location,
        section: existing.section,
        sortOrder: existing.sortOrder,
      },
      to: {
        title: record.title,
        notes: record.notes,
        detail: record.detail,
        location: record.location,
        section: record.section,
        sortOrder: record.sortOrder,
        kind: record.kind,
        startAt: record.startAt,
      },
    });
  }

  for (const task of OPEN_WORK_TASKS) {
    const byKey = snapshot.tasks.find((row) => row.orgKey === task.orgKey);
    if (byKey) {
      plan.skips.push({ action: "skip", reason: "task orgKey already exists", identity: task.orgKey });
      continue;
    }
    const byTitle = snapshot.tasks.filter(
      (row) => normalizeLine(row.title) === normalizeLine(task.title),
    );
    if (byTitle.length > 0) {
      plan.skips.push({
        action: "skip",
        reason: "matching open-work title already exists",
        identity: task.title,
      });
      continue;
    }
    plan.taskInserts.push({ action: "insert", row: task });
  }

  const teardown = snapshot.assignments.find((row) => /tear|clean/i.test(row.title));
  if (teardown) {
    const wanted =
      "Trash: Haley's parents. Decor goes home with Haley's parents. Avalon breaks down for the point person but does not own transport.";
    if (teardown.notes && notesHasLine(teardown.notes, "Haley's parents")) {
      plan.skips.push({ action: "skip", reason: "teardown assignment already notes parents", identity: teardown.id });
    } else {
      plan.assignmentUpdates.push({
        action: "update",
        id: teardown.id,
        from: { notes: teardown.notes ?? undefined },
        to: { notes: teardown.notes ? `${teardown.notes}\n${wanted}` : wanted },
      });
    }
  } else {
    plan.skips.push({
      action: "skip",
      reason: "no teardown DayAssignment to enrich",
      identity: "teardown assignment",
    });
  }

  plan.skips.push({
    action: "skip",
    reason: "Melissa Roessings is the Black Sheep contact name; phone is applied to the venue row if present, not a new Person",
    identity: "Melissa Roessings",
  });
  plan.skips.push({
    action: "skip",
    reason: "Blank decor worksheet rows are a template, not selected facts",
    identity: "decor worksheet blanks",
  });
  plan.skips.push({
    action: "skip",
    reason: "Meeting notes 'Wendy and her boyfriend' superseded by Kurt Huizenga + Wendy Rush",
    identity: "legacy MC wording",
  });
  plan.skips.push({
    action: "skip",
    reason: "Meeting notes DIY hair superseded by confirmed Katie hair",
    identity: "legacy DIY hair",
  });
  plan.skips.push({
    action: "skip",
    reason: "Seating chart / extra signage rows on the blank decor worksheet are not selected facts",
    identity: "blank seating chart",
  });
  plan.skips.push({
    action: "skip",
    reason: "Recessional song blank on the timeline PDF is not a current music decision",
    identity: "recessional song blank",
  });

  return plan;
}

export function planWriteCounts(plan: WeddingOpsPlan) {
  return {
    inserts:
      plan.timelineInserts.length +
      plan.playbookInserts.length +
      plan.taskInserts.length,
    updates:
      plan.timelineUpdates.length +
      plan.contactUpdates.length +
      plan.personUpdates.length +
      plan.playbookUpdates.length +
      plan.assignmentUpdates.length,
    skips: plan.skips.length,
    conflicts: plan.conflicts.length,
    deletes: 0,
  };
}
