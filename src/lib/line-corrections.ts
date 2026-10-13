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
];

export function withLineCorrections(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const fix = CORRECTED.find((row) => row.from.test(line.trim()));
    if (!fix) out.push(line);
    else if (fix.to != null && !out.includes(fix.to)) out.push(fix.to);
  }
  return out;
}
