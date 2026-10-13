import assert from "node:assert/strict";
import test from "node:test";
import { parseBlockNotes } from "@/lib/day-of-now";
import { buildMcRunOfShow } from "@/lib/mc-run-of-show";
import { PRODUCTION_CUE_BLOCKS } from "@/lib/mc-cue-fixture";
import { MC_SONGS, withMcSongs } from "@/lib/mc-songs";

test("older saved placeholders read as the songs on David's MC tab", () => {
  assert.deepEqual(
    withMcSongs([
      "Grand Entrance Song: Special Dances Playlist",
      "Music: First Dance and Father Daughter",
      "Music: Dollar Dance Song, Special Dances Playlist",
      "Music: Last Dance Song, Special Dances Playlist",
    ]),
    [MC_SONGS.grandEntrance, MC_SONGS.firstDances, MC_SONGS.dollarDance, MC_SONGS.lastDance],
  );
  assert.equal(MC_SONGS.dollarDance, "Music: Dollar Dance- Isn’t She Lovely (In Special Dances Playlist)");
});

test("the recessional song follows the aisle playlist once", () => {
  const lines = withMcSongs(["Under the shelter", "Playlist: Walking Down The Aisle"]);
  assert.deepEqual(lines, ["Under the shelter", "Playlist: Walking Down The Aisle", MC_SONGS.recessional]);
  assert.deepEqual(withMcSongs(lines), lines);
});

test("a line David typed himself stays as he wrote it", () => {
  assert.deepEqual(withMcSongs(["Music: our own dollar dance pick"]), ["Music: our own dollar dance pick"]);
  assert.equal(parseBlockNotes("Dollar dance\nMusic: Dollar Dance Song, Special Dances Playlist").detailLines[0], MC_SONGS.dollarDance);
});

test("the MC run of show prints every song from the MC tab, none of the placeholders", () => {
  const show = buildMcRunOfShow(PRODUCTION_CUE_BLOCKS.map((row) => ({ ...row, schedule: "wedding" })));
  const music = show.cues.flatMap((cue) => cue.music).join("\n");
  for (const song of ["Heather on the Hill", "Long Night Ahead", "Fairytale", "My Girl", "Isn’t She Lovely", "Last Dance- Moon"]) {
    assert.match(music, new RegExp(song), song);
  }
  assert.doesNotMatch(music, /Dollar Dance Song|Last Dance Song|Grand Entrance Song: Special/);
  const recessional = show.cues.find((cue) => cue.music.some((line) => /Heather on the Hill/.test(line)));
  assert.equal(recessional?.time, "4:00 PM");
});
