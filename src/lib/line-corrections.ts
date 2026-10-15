/**
 * Lines the app itself once wrote that David has since corrected. Wherever an older saved row still
 * carries one word for word, it shows and prints his newer words (or not at all); a line he typed stays.
 * David, 2026-10-13 22:01: "Avalon is now planning on 11 am to 7 pm for her time frame".
 */
import { CAKE_CUE, CAKE_CUE_OCT14, TOASTS_CUE_OCT14 } from "@/lib/evening-cues";

const AVALON_TIME_FRAME_LINE = "Avalon’s time frame is 11:00 AM to 7:00 PM (David, Oct 13). She is the main point of contact.";

function exactly(line: string): RegExp {
  return new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

const CORRECTED: Array<{ from: RegExp; to: string | null }> = [
  { from: /^Avalon arrives at 10:30 AM and is the main point of contact\.?$/i, to: AVALON_TIME_FRAME_LINE },
  { from: /^Avalon \(coordinator\) arrives 10:30 or 11:00 AM\.?$/i, to: AVALON_TIME_FRAME_LINE },
  // His 11 to 7 answers how late she stays.
  { from: /^Open items:\s*Confirm how late Avalon stays\.?$/i, to: null },
  // The Master of Oct 15 (David, 01:48 "Ok let's update"): cake cutting at 6:10 PM with his cake line; the toasts line
  // is the 6:35 PM speeches' own, so an older saved toasts cue in the cake moment shows no more.
  { from: /^MC cue 6:00(?: PM)?: "As dinner winds down, please return to your seats\."$/, to: CAKE_CUE },
  { from: /^MC cue 6:15(?: PM)?: "With the toasts complete, gather near the cake table\."$/, to: CAKE_CUE },
  { from: exactly(CAKE_CUE_OCT14), to: CAKE_CUE },
  { from: exactly(TOASTS_CUE_OCT14), to: null },
  { from: /^Speeches: Braxton, Andi, John$/, to: null },
  // The Master of Oct 15's photo times, over the app's older timed lines.
  { from: /^1:15 PM — Haley first look with Dad$/, to: "1:30 PM — Haley first look with Dad" },
  { from: /^1:30 PM — bridal portraits$/, to: "1:45 PM — bridal portraits" },
  { from: /^1:45 PM — groom portraits$/, to: "1:15 PM — groom portraits" },
  { from: /^2:30 PM — immediate family portraits$/, to: "2:35 PM — couple with parents and girls portraits" },
  { from: /^4:05 PM — family photos; Wendy to help$/, to: "4:10 PM — family photos; Wendy to help" },
  { from: /^Marriage license signing time still TBD \(before ceremony vs 4:00 PM\)$/, to: null },
  // David, 2026-10-14 16:57, his edit of the Master: cake cutting and toasts 6:30–6:45 PM (the cake line, then the
  // toasts line), formal dances 6:50–7:00 PM, open dancing 7:00 PM; 19:00: "The kids playlist is just starting at 7 now."
  { from: /^Best man, MOH, and FOB toasts\.?$/i, to: null },
  { from: /^Cake cutting stays at 6:15 with toasts \(not the 5:15 if-by-the-bar maybe\)$/i, to: null },
  { from: /^5:45 PM — sunset photos$/i, to: "6:15 PM — sunset photos" },
  { from: /^MC cue 6:(?:30|40): "Please turn your attention to the center of the space\."$/, to: 'MC cue 6:50: "Please turn your attention to the center of the space."' },
  { from: /^MC cue 6:45: "The dance floor is officially open in the glass house\."$/, to: 'MC cue 7:00: "The dance floor is officially open in the glass house."' },
  { from: /^Playlist: Wedding - Kids Section 6:45–8:15$/, to: "Playlist: Wedding - Kids Section 7:00–8:15" },
  { from: /^Dance floor opens at 6:45 PM in the glass house \(not the older 7:45 PDF time\)$/i, to: "Dance floor opens at 7:00 PM in the glass house (not the older 7:45 PDF time)" },
  // His golden hour at 6:25 answers which 10 minutes Barry takes outside.
  { from: /^Open items:\s*Ask Barry to confirm the best 10 minutes for outdoor photos\.?$/i, to: null },
  // David, 2026-10-14 15:09: "we do need to update trash to being Tracy and Victor."
  { from: /^Trash: Haley's parents\.?$/i, to: "Trash: Tracy and Victor" },
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
