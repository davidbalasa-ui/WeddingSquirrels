import { profileIdForPerson } from "@/lib/people-directory";

/** Canonical URLs for trustworthy wedding entities. Do not scatter these. */

export function peopleProfileHref(profileId: string): string {
  return `/people/${encodeURIComponent(profileId)}`;
}

export function personProfileHref(personId: string): string {
  return peopleProfileHref(profileIdForPerson(personId));
}

export function taskHref(taskId: string): string {
  return `/work/${encodeURIComponent(taskId)}`;
}

export function moneyHref(itemId: string, opts?: { paymentId?: string }): string {
  const path = `/money/${encodeURIComponent(itemId)}`;
  if (!opts?.paymentId) return path;
  return `${path}?payment=${encodeURIComponent(opts.paymentId)}`;
}

/** Asks live on Today; deep-link expands the exact thread. */
export function requestHref(requestId: string): string {
  return `/today?filter=asks&ask=${encodeURIComponent(requestId)}`;
}

export function timelineHref(opts?: {
  schedule?: "wedding" | "rehearsal";
  blockId?: string;
}): string {
  const schedule = opts?.schedule ?? "wedding";
  const path = schedule === "rehearsal" ? "/plan/rehearsal" : "/plan/timeline";
  if (!opts?.blockId) return path;
  return `${path}#block-${encodeURIComponent(opts.blockId)}`;
}

export function dayAssignmentHref(): string {
  return "/people/responsibilities";
}

export function calendarHref(): string {
  return "/plan/calendar";
}

export function moneyContractHref(contractId: string, opts?: { paymentId?: string }): string {
  return moneyHref(contractId, opts);
}

export function profileHref(profileId: string): string {
  return peopleProfileHref(profileId);
}
