/**
 * Same-origin return path for /work/{id}.
 * Direct visits and rejected origins fall back to Plan Tasks, never Today.
 */

export type WorkReturn = {
  href: string;
  label: string;
};

export const WORK_RETURN_FALLBACK: WorkReturn = {
  href: "/plan/tasks",
  label: "Plan Tasks",
};

const ALLOWED: Array<{ prefix: string; label: string }> = [
  { prefix: "/plan/tasks", label: "Plan Tasks" },
  { prefix: "/plan/timeline", label: "Wedding Day" },
  { prefix: "/plan/rehearsal", label: "Rehearsal" },
  { prefix: "/plan/shopping", label: "Shopping" },
  { prefix: "/plan/calendar", label: "Calendar" },
  { prefix: "/today", label: "Today" },
  { prefix: "/people", label: "People" },
  { prefix: "/money", label: "Money" },
  { prefix: "/plan", label: "Plan" },
];

const LOCAL_ORIGIN = "https://weddingsquirrels.local";

function firstString(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "string") return value;
  return null;
}

function allowedForPath(pathname: string): { prefix: string; label: string } | null {
  for (const row of ALLOWED) {
    if (row.prefix === "/plan") {
      if (pathname === "/plan") return row;
      continue;
    }
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) return row;
  }
  return null;
}

/** Parsed origin, or null when missing/unsafe. Direct /work visits are not origins. */
export function parseWorkReturn(from: string | string[] | null | undefined): WorkReturn | null {
  const raw = firstString(from)?.trim();
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw, LOCAL_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== LOCAL_ORIGIN) return null;
  if (url.username || url.password) return null;
  if (url.pathname.includes("//") || url.pathname.includes("/.")) return null;
  if (url.pathname === "/work" || url.pathname.startsWith("/work/")) return null;

  const match = allowedForPath(url.pathname);
  if (!match) return null;

  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    label: match.label,
  };
}

export function resolveWorkReturn(from: string | string[] | null | undefined): WorkReturn {
  return parseWorkReturn(from) ?? { ...WORK_RETURN_FALLBACK };
}

export function workBackLabel(returnTo: WorkReturn): string {
  return `← Back to ${returnTo.label}`;
}

/** Attach a safe `from` query to a /work/{id} href. Leaves other hrefs unchanged. */
export function workHrefWithFrom(href: string, from: string | null | undefined): string {
  if (!href.startsWith("/work/")) return href;
  const parsed = parseWorkReturn(from);
  const raw = firstString(from)?.trim();
  if (!parsed || !raw) return href;

  try {
    const url = new URL(href, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return href;
    if (url.searchParams.has("from")) return href;
    url.searchParams.set("from", raw);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
