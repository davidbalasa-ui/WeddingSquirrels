/**
 * Jobs already written into the Wedding Day schedule (the reconciled timeline) that
 * were never on Day-of → Assignments, so the Day-of jobs page printed nearly empty
 * (David, 2026-10-10). Words are the schedule's own. The Apply card on Plan → Tasks
 * adds any that are missing; it never changes or removes a job already there.
 */
export type DayJobDef = { title: string; notes: string };

export const SCHEDULE_DAY_JOBS: DayJobDef[] = [
  {
    title: "Wendy and Kurt begin setup.",
    notes: "10:30 AM · Set up the venue. Avalon arrives at 10:30 AM and is the main point of contact.",
  },
  {
    title: "Harmony is on ring security and stands next to the entry table for the half hour before the ceremony starts.",
    notes: "3:00 PM · Harmony on ring security",
  },
  {
    title: "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen.",
    notes: "4:00 PM · Sign the marriage license",
  },
  {
    title: "MOB or another helper meets Dan Vandenheede.",
    notes: "8:20 PM · Getaway vehicle arrives. Show Dan where to park, give him the “Just Married” sign, and tell the groom.",
  },
  // David, 2026-10-10 22:04: "Wendy is in charge of teardown".
  { title: "Wendy is in charge of teardown.", notes: "10:00 PM · Tear down and cleanup" },
];

/**
 * Jobs as this card first wrote them, before a correction. A job still reading exactly
 * like this was never edited, so the card brings it up to date; an edited one stays.
 */
const EARLIER_DAY_JOBS: Array<DayJobDef & { now: string; correction: string }> = [
  {
    // David, 2026-10-10: the driver is Dan, not San.
    title: "MOB or another helper meets San Vandenheede.",
    notes: "8:20 PM · Getaway vehicle arrives. Show San where to park, give him the “Just Married” sign, and tell the groom.",
    now: "MOB or another helper meets Dan Vandenheede.",
    correction: "San → Dan",
  },
];

export type DayJobReword = { id: string; title: string; notes: string; before: string; correction: string };

function key(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function planDayJobs(existing: Array<{ title: string }>): DayJobDef[] {
  // A job still under an earlier title is the same job: it is corrected, never added again.
  const have = new Set(
    existing.map((row) => key(EARLIER_DAY_JOBS.find((old) => key(old.title) === key(row.title))?.now ?? row.title)),
  );
  return SCHEDULE_DAY_JOBS.filter((job) => !have.has(key(job.title)));
}

/** Jobs this card added that still read exactly as it first wrote them, with their corrected words. */
export function planDayJobRewords(existing: Array<{ id: string; title: string; notes: string | null }>): DayJobReword[] {
  return existing.flatMap((row) => {
    const old = EARLIER_DAY_JOBS.find((job) => job.title === row.title && job.notes === row.notes);
    const now = old && SCHEDULE_DAY_JOBS.find((job) => job.title === old.now);
    return old && now ? [{ id: row.id, title: now.title, notes: now.notes, before: row.title, correction: old.correction }] : [];
  });
}
