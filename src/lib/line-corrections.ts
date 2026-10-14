/**
 * Lines the app itself once wrote that David has since corrected. Wherever an older saved row still
 * carries one word for word, it shows and prints his newer words (or not at all); a line he typed stays.
 * David, 2026-10-13 22:01: "Avalon is now planning on 11 am to 7 pm for her time frame".
 */
import { CAKE_CUE, TOASTS_CUE } from "@/lib/evening-cues";

const AVALON_TIME_FRAME_LINE = "Avalon’s time frame is 11:00 AM to 7:00 PM (David, Oct 13). She is the main point of contact.";

const CORRECTED: Array<{ from: RegExp; to: string | null }> = [
  { from: /^Avalon arrives at 10:30 AM and is the main point of contact\.?$/i, to: AVALON_TIME_FRAME_LINE },
  { from: /^Avalon \(coordinator\) arrives 10:30 or 11:00 AM\.?$/i, to: AVALON_TIME_FRAME_LINE },
  // His 11 to 7 answers how late she stays.
  { from: /^Open items:\s*Confirm how late Avalon stays\.?$/i, to: null },
  // David, 2026-10-14 16:57, his edit of the Master: cake cutting and toasts 6:30–6:45 PM (the cake line, then the
  // toasts line), formal dances 6:50–7:00 PM, open dancing 7:00 PM; 19:00: "The kids playlist is just starting at 7 now."
  // The app's two older cues stood toasts first; they show as his cake line, then his toasts line.
  { from: /^MC cue 6:00(?: PM)?: "As dinner winds down, please return to your seats\."$/, to: CAKE_CUE },
  { from: /^MC cue 6:15(?: PM)?: "With the toasts complete, gather near the cake table\."$/, to: TOASTS_CUE },
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
