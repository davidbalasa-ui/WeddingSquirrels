/** Same-origin internal return paths for the Task workspace. */

export const TASKS_HOME = "/plan/tasks";

const ALLOWED_PREFIXES = [
  "/plan",
  "/today",
  "/people",
  "/money",
  "/shop",
  "/day",
  "/work",
  "/home",
  "/requests",
  "/guests",
];

function pathOf(value: string): string {
  return value.split("?")[0].split("#")[0];
}

function isAllowedInternalPath(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Reject open redirects. Unknown or external values fall back to Task home. */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return TASKS_HOME;
  let value = raw.trim();
  if (!value || value.length > 512) return TASKS_HOME;
  if (value.includes("%")) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return TASKS_HOME;
    }
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return TASKS_HOME;
  if (value.includes("://") || value.includes("\\") || value.includes("\n") || value.includes("\r")) {
    return TASKS_HOME;
  }
  const path = pathOf(value);
  if (!path.startsWith("/") || path.startsWith("//")) return TASKS_HOME;
  if (!isAllowedInternalPath(path)) return TASKS_HOME;
  return value;
}

export function withReturnTo(href: string, returnTo?: string | null): string {
  if (!returnTo) return href;
  const safe = safeReturnTo(returnTo);
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const [pathAndQuery] = withoutHash.split("#");
  const params = new URLSearchParams(pathAndQuery.includes("?") ? pathAndQuery.slice(pathAndQuery.indexOf("?") + 1) : "");
  params.set("returnTo", safe);
  const path = pathAndQuery.split("?")[0];
  const query = params.toString();
  return `${path}?${query}${hash}`;
}

export function taskWorkspaceBackLabel(returnTo: string): string {
  const path = pathOf(safeReturnTo(returnTo));
  if (path === TASKS_HOME) return "← Back to Tasks";
  return "← Back";
}

export function planTasksPath(view?: string | null): string {
  if (!view || view === "open") return TASKS_HOME;
  return `${TASKS_HOME}?view=${encodeURIComponent(view)}`;
}
