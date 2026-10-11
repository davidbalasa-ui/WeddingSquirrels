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
 * them. 2026-10-11 12:46: the 4:50 PM last-pour announcement replaces the 4:55 "nearing its end" cue,
 * and the toasts cue moves from 6:00 to 5:50 PM.
 */
const REPLACED_MC_CUES = [/cocktail hour is nearing its end/i, /^MC cue(?: at)? 6:00(?: PM)?\s*[:—–-]\s*["“]?As dinner winds down/i];

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
