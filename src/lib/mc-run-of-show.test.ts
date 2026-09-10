import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMcCues, isMcDirectoryLabel, mcPeopleFromDirectory } from "./print-center";
import { PRODUCTION_CUE_BLOCKS } from "./mc-cue-fixture";
import { buildMcRunOfShow } from "./mc-run-of-show";

test("MC Run of Show projects timeline cues in order with next-cue pointers", () => {
  const show = buildMcRunOfShow(PRODUCTION_CUE_BLOCKS, [
    { name: "Kurt Huizenga", directoryLabel: "MC" },
    { name: "Wendy Rush", directoryLabel: "Mistress of Ceremonies" },
  ]);
  const spoken = show.cues.filter((cue) => cue.kind === "spoken");
  const fromTimeline = extractMcCues(PRODUCTION_CUE_BLOCKS);

  assert.deepEqual(
    spoken.map((cue) => cue.time),
    fromTimeline.map((cue) => cue.time),
  );
  assert.deepEqual(
    spoken.map((cue) => cue.spoken),
    fromTimeline.map((cue) => cue.spoken),
  );
  assert.equal(show.cues.some((cue) => cue.kind === "music" && /While They Wait/i.test(cue.music.join(" "))), true);
  assert.equal(show.cues[0]?.nextTitle != null, true);
  assert.equal(show.cues.at(-1)?.nextTitle, null);
  assert.deepEqual(show.mcNames, ["Kurt Huizenga", "Wendy Rush"]);
});

test("processional playlist is a ceremony-start music bed, not the 4:00 conclusion speech", () => {
  const show = buildMcRunOfShow(PRODUCTION_CUE_BLOCKS);
  const aisle = show.cues.find((cue) => /Walking Down The Aisle/i.test(cue.music.join(" ")));
  const conclusion = show.cues.find((cue) => /ceremony has concluded/i.test(cue.spoken));
  assert.ok(aisle);
  assert.equal(aisle.kind, "music");
  assert.equal(aisle.time, "3:30 PM");
  assert.equal(conclusion?.music.some((line) => /Walking Down The Aisle/i.test(line)), false);
});

test("waiting-playlist music bed is a separate 3:00 cue from the 3:25 spoken welcome", () => {
  const show = buildMcRunOfShow(PRODUCTION_CUE_BLOCKS);
  const wait = show.cues.find((cue) => cue.kind === "music" && /While They Wait/i.test(cue.music.join(" ")));
  const welcome = show.cues.find((cue) => cue.kind === "spoken" && /welcome/i.test(cue.spoken));
  assert.ok(wait);
  assert.ok(welcome);
  assert.equal(wait.time, "3:00 PM");
  assert.equal(welcome.time, "3:25 PM");
  assert.equal(wait.spoken, "");
});

test("MC projection does not invent a second editable cue list", () => {
  const show = buildMcRunOfShow(PRODUCTION_CUE_BLOCKS);
  const spoken = show.cues.filter((cue) => cue.kind === "spoken");
  const keys = spoken.map((cue) => `${cue.time}|${cue.spoken}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(
    spoken.every((cue) => PRODUCTION_CUE_BLOCKS.some((block) => block.notes.includes(cue.spoken))),
    true,
  );
});

test("Mistress of Ceremonies and MC are both operator labels", () => {
  assert.equal(isMcDirectoryLabel("MC"), true);
  assert.equal(isMcDirectoryLabel("Mistress of Ceremonies"), true);
  assert.equal(isMcDirectoryLabel("Setup / teardown / cleanup contact"), false);
  assert.deepEqual(
    mcPeopleFromDirectory([
      { name: "Kurt Huizenga", directoryLabel: "MC" },
      { name: "Wendy Rush", directoryLabel: "Mistress of Ceremonies" },
    ]),
    ["Kurt Huizenga", "Wendy Rush"],
  );
});
