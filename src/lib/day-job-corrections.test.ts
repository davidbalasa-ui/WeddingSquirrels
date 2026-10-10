import assert from "node:assert/strict";
import test from "node:test";
import { RECONCILED_TIMELINE } from "./reconciled-timeline";
import { SCHEDULE_DAY_JOBS, planDayJobs } from "./day-job-corrections";

test("every schedule job is quoted word for word from the reconciled timeline", () => {
  const lines = RECONCILED_TIMELINE.flatMap((moment) => moment.lines);
  for (const job of SCHEDULE_DAY_JOBS) assert.ok(lines.includes(job.title), job.title);
});

test("a job already on Day-of assignments is not added again", () => {
  assert.equal(planDayJobs([{ title: "Wendy and Kurt begin setup" }]).length, SCHEDULE_DAY_JOBS.length - 1);
  assert.equal(planDayJobs([]).length, 4);
});
