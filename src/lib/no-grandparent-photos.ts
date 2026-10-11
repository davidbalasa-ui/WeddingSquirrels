/**
 * David, 2026-10-10 (crossed out on page 12 of his binder) and again 2026-10-11 12:31:
 * "I never asked for pictures of grandparents and I keep telling you to remove them."
 * No shot, photo line or photo question about grandparents or the extended family is
 * ever shown or printed, whatever an older saved row says.
 */
const GRANDPARENTS_OR_EXTENDED = /\bgrand ?(?:ma|pa|parents?|mother|father)s?\b|\bextended family\b|\b(?:paternal|maternal|parental) side of (?:the )?family\b/i;
const ABOUT_PHOTOS = /\bphotos?\b|\bportraits?\b|\bshots?\b|\bpictures?\b|\bwith\b|\bgather\b/i;

export function isGrandparentPhoto(text: string): boolean {
  return GRANDPARENTS_OR_EXTENDED.test(text) && ABOUT_PHOTOS.test(text);
}

/**
 * App-written MC cues David has since replaced, dropped wherever an older saved row still carries
 * them. 2026-10-11 12:46: the 4:50 PM last-pour announcement replaces the 4:55 "nearing its end" cue.
 * (The toasts cue went to 5:50 PM at 12:46 and back to 6:00 PM at 16:15, so the 6:00 cue prints again.)
 */
const REPLACED_MC_CUES = [/cocktail hour is nearing its end/i];

export function isReplacedMcCue(text: string): boolean {
  return /\bMC cue\b|^\s*\d{1,2}:\d{2}/i.test(text) && REPLACED_MC_CUES.some((re) => re.test(text));
}

/**
 * David, 2026-10-11 15:13: "1:30 is the first look with dad, straight into parent photos."
 * Older saved rows carry the app's earlier "1:15 PM — Haley first look with Dad"; it is not printed.
 */
export function isReplacedFirstLookTime(text: string): boolean {
  return /^\s*1:15(?: PM)?\s*[—–-]\s*Haley(?:’s|'s)? first look with (?:her )?dad\b/i.test(text);
}

/**
 * David, 2026-10-11 16:01: "remove the 2 pm line about denise and lise picking up the cake from the air BNB.
 * Braxton is responsible to bring the cake from the air bnb to the venue the night before."
 * 16:03: "make sure the 2-230 time frame also doesnt have the cake reference anymore".
 * No line or job about the cake on Friday's 2:00–2:30 PM, or about Denise and Lisa and the cake,
 * is shown or printed, whatever an older saved row or job says. Thursday's Braxton line stays.
 */
export function isRemovedCakePickup(text: string): boolean {
  const friday = /(?:^|\D)2:(?:00|30)\b/.test(text);
  // The old line prints in two halves; the second ("2:30 PM arrive at BSS (fridge by suites)") never names the cake.
  if (friday && /\bfridge by (?:the )?suites\b/i.test(text)) return true;
  if (!/\bcake\b/i.test(text)) return false;
  return /\b(?:denise|lisa)\b/i.test(text) || friday;
}

/** Day-of jobs as every page and printout shows them: never the cake pickup David removed. */
export function withoutRemovedJobs<T extends { title: string; notes: string | null }>(jobs: T[]): T[] {
  return jobs.filter((job) => !isRemovedCakePickup(`${job.title} ${job.notes ?? ""}`));
}
