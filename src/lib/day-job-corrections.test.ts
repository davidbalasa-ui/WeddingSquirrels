import assert from "node:assert/strict";
import test from "node:test";
import { RECONCILED_TIMELINE } from "./reconciled-timeline";
import { SCHEDULE_DAY_JOBS, planDayJobRewords, planDayJobs } from "./day-job-corrections";

test("every schedule job is quoted word for word from the reconciled timeline", () => {
  const lines = RECONCILED_TIMELINE.flatMap((moment) => moment.lines);
  for (const job of SCHEDULE_DAY_JOBS) assert.ok(lines.includes(job.title), job.title);
});

test("a job already on Day-of assignments is not added again", () => {
  assert.equal(planDayJobs([{ title: "Wendy and Kurt begin setup" }]).length, SCHEDULE_DAY_JOBS.length - 1);
  assert.equal(planDayJobs([]).length, 4);
});

// David, 2026-10-10: "it says san instead of dan, that needs corrected everywhere".
test("the getaway job card 2 added as San is corrected to Dan once, never added a second time", () => {
  const added = {
    id: "job-1",
    title: "MOB or another helper meets San Vandenheede.",
    notes: "8:20 PM · Getaway vehicle arrives. Show San where to park, give him the “Just Married” sign, and tell the groom.",
  };
  assert.ok(SCHEDULE_DAY_JOBS.every((job) => !/\bSan\b/.test(`${job.title} ${job.notes}`)));
  assert.equal(planDayJobs([added]).length, 3);
  assert.deepEqual(planDayJobRewords([added]), [
    {
      id: "job-1",
      title: "MOB or another helper meets Dan Vandenheede.",
      notes: "8:20 PM · Getaway vehicle arrives. Show Dan where to park, give him the “Just Married” sign, and tell the groom.",
      before: added.title,
      correction: "San → Dan",
    },
  ]);
  // A job David edited keeps his words.
  assert.deepEqual(planDayJobRewords([{ ...added, notes: `${added.notes} He drives a Mustang.` }]), []);
  // After the correction there is nothing left to do.
  const fixed = planDayJobRewords([added])[0]!;
  assert.deepEqual(planDayJobRewords([fixed]), []);
  assert.equal(planDayJobs([fixed]).length, 3);
});
