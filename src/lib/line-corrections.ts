/**
 * Lines the app itself once wrote that David has since corrected. Wherever an older saved row still
 * carries one word for word, it shows and prints his newer words (or not at all); a line he typed stays.
 * David, 2026-10-13 22:01: "Avalon is now planning on 11 am to 7 pm for her time frame".
 */
const AVALON_TIME_FRAME_LINE = "Avalon’s time frame is 11:00 AM to 7:00 PM (David, Oct 13). She is the main point of contact.";

const CORRECTED: Array<{ from: RegExp; to: string | null }> = [
  { from: /^Avalon arrives at 10:30 AM and is the main point of contact\.?$/i, to: AVALON_TIME_FRAME_LINE },
  { from: /^Avalon \(coordinator\) arrives 10:30 or 11:00 AM\.?$/i, to: AVALON_TIME_FRAME_LINE },
  // His 11 to 7 answers how late she stays.
  { from: /^Open items:\s*Confirm how late Avalon stays\.?$/i, to: null },
  // David, 2026-10-14 14:53: formal dances are back at 6:30–6:45 PM, and open dancing starts at 6:45 PM.
  { from: /^MC cue 6:40: "Please turn your attention to the center of the space\."$/, to: 'MC cue 6:30: "Please turn your attention to the center of the space."' },
  { from: /^MC cue 7:00: "The dance floor is officially open in the glass house\."$/, to: 'MC cue 6:45: "The dance floor is officially open in the glass house."' },
  { from: /^Playlist: Wedding - Kids Section 7:00–8:15$/, to: "Playlist: Wedding - Kids Section 6:45–8:15" },
  { from: /^Dance floor opens at 7:00 PM in the glass house \(not the older 7:45 PDF time\)$/i, to: "Dance floor opens at 6:45 PM in the glass house (not the older 7:45 PDF time)" },
  // His golden hour at 6:25 answers which 10 minutes Barry takes outside.
  { from: /^Open items:\s*Ask Barry to confirm the best 10 minutes for outdoor photos\.?$/i, to: null },
];

const TARGETS = new Set(CORRECTED.map((row) => row.to).filter((to): to is string => to != null));

export function withLineCorrections(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const fix = CORRECTED.find((row) => row.from.test(line.trim()));
    const next = fix ? fix.to : line;
    // A corrected line shows once, even where the row also carries the newer words.
    if (next != null && !(TARGETS.has(next.trim()) && out.some((seen) => seen.trim() === next.trim()))) out.push(next);
  }
  return out;
}
