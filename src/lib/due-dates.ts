import { addDays, subDays } from "date-fns";

const WEDDING = new Date("2026-10-16T12:00:00");

export function weddingDate() {
  return WEDDING;
}

/** Infer a sensible due date from task title relative to wedding day. */
export function inferDueDate(title: string): Date | null {
  const t = title.toLowerCase();

  if (t.includes("get married") || t.includes("bang my wife")) {
    return WEDDING;
  }
  if (t.includes("thank you")) {
    return addDays(WEDDING, 21);
  }
  if (t.includes("final guest count") || t.includes("2 weeks before")) {
    return subDays(WEDDING, 14);
  }
  if (t.includes("1 month before") || t.includes("verify makeup 1 month")) {
    return subDays(WEDDING, 30);
  }
  if (
    t.includes("week of") ||
    t.includes("relax before") ||
    t.includes("tip envelopes") ||
    t.includes("charge devices")
  ) {
    return subDays(WEDDING, 7);
  }
  if (
    t.includes("send wedding invites") ||
    t.includes("address invitations") ||
    t.includes("order wedding invites")
  ) {
    return new Date("2026-08-15T12:00:00");
  }
  if (t.includes("remind guests to rsvp")) {
    return new Date("2026-09-15T12:00:00");
  }
  if (t.includes("rehersal") || t.includes("rehearsal")) {
    return subDays(WEDDING, 1);
  }
  if (t.startsWith("pay ") || t.includes("pay venue") || t.includes("pay for")) {
    return subDays(WEDDING, 21);
  }
  if (t.includes("confirm") || t.includes("provide")) {
    return subDays(WEDDING, 45);
  }
  if (t.includes("order ") || t.includes("buy ") || t.includes("purchase")) {
    return subDays(WEDDING, 60);
  }
  if (t.includes("decide") || t.includes("solidify") || t.includes("plan")) {
    return subDays(WEDDING, 75);
  }

  return subDays(WEDDING, 45);
}
