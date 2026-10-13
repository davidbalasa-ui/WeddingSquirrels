/**
 * The songs on the MC's "MC Schedule/Script" tab of David's Schedule doc, word for word.
 * Older saved rows still carry the app's placeholders ("Dollar Dance Song, Special Dances
 * Playlist"); wherever one is read it shows and prints his song instead. A line David
 * typed himself never matches, so it stays as he wrote it.
 */
export const MC_SONGS = {
  recessional: "Music: Recessional Song- Heather on the Hill (In Special Dances Playlist)",
  grandEntrance: "Music: Grand Entrance Song- Long Night Ahead (In Special Dances Playlist)",
  firstDances: "Music: First Dance- Fairytale and Father Daughter- My Girl (In Special Dances Playlist)",
  dollarDance: "Music: Dollar Dance- Isn’t She Lovely (In Special Dances Playlist)",
  lastDance: "Music: Last Dance- Moon (In Special Dances Playlist)",
} as const;

const PLACEHOLDERS: Array<{ from: RegExp; to: string }> = [
  { from: /^Grand Entrance Song:\s*Special Dances Playlist\.?$/i, to: MC_SONGS.grandEntrance },
  { from: /^Music:\s*First Dance and Father Daughter\.?$/i, to: MC_SONGS.firstDances },
  { from: /^Music:\s*Dollar Dance Song,\s*Special Dances Playlist\.?$/i, to: MC_SONGS.dollarDance },
  { from: /^Music:\s*Last Dance Song,\s*Special Dances Playlist\.?$/i, to: MC_SONGS.lastDance },
];

/** The aisle playlist line the app wrote; the recessional song follows it. */
const AISLE_PLAYLIST = /^Playlist:\s*Walking Down The Aisle\b/i;
const RECESSIONAL = /\brecessional\b/i;

export function withMcSong(line: string): string {
  const trimmed = line.trim();
  return PLACEHOLDERS.find((row) => row.from.test(trimmed))?.to ?? line;
}

/** A moment's lines with his songs in place of the placeholders, and the recessional after the aisle playlist. */
export function withMcSongs(lines: string[]): string[] {
  const out = lines.map(withMcSong);
  const aisle = out.findIndex((line) => AISLE_PLAYLIST.test(line.trim()));
  if (aisle >= 0 && !out.some((line) => /^(Music|Playlist)\s*:/i.test(line.trim()) && RECESSIONAL.test(line))) {
    out.splice(aisle + 1, 0, MC_SONGS.recessional);
  }
  return out;
}
