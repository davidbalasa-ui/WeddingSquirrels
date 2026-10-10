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
    title: "MOB or another helper meets San Vandenheede.",
    notes: "8:20 PM · Getaway vehicle arrives. Show San where to park, give him the “Just Married” sign, and tell the groom.",
  },
];

function key(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function planDayJobs(existing: Array<{ title: string }>): DayJobDef[] {
  const have = new Set(existing.map((row) => key(row.title)));
  return SCHEDULE_DAY_JOBS.filter((job) => !have.has(key(job.title)));
}
