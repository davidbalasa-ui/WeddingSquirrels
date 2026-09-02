export type GuestPersonRole = "guest" | "wedding_party" | "family" | "vendor";

const ROLE_LABELS: Record<GuestPersonRole, string> = {
  guest: "Guest",
  wedding_party: "Wedding",
  family: "Family",
  vendor: "Vendor",
};

const ROLE_CYCLE: GuestPersonRole[] = ["guest", "wedding_party", "family", "vendor"];

export function guestPersonRoleLabel(role: GuestPersonRole): string {
  return ROLE_LABELS[role];
}

export function resolveGuestPersonRole(input: {
  directoryLabel?: string | null;
}): GuestPersonRole {
  const label = input.directoryLabel?.trim().toLowerCase() ?? "";
  if (label.includes("vendor")) return "vendor";
  if (label.includes("wedding") || label.includes("party")) return "wedding_party";
  if (label.includes("family")) return "family";
  return "guest";
}

export function directoryLabelForRole(role: GuestPersonRole): string | null {
  if (role === "guest") return null;
  return ROLE_LABELS[role];
}

export function nextGuestPersonRole(current: GuestPersonRole): GuestPersonRole {
  const index = ROLE_CYCLE.indexOf(current);
  return ROLE_CYCLE[(index + 1) % ROLE_CYCLE.length];
}

export function isDayOfRole(role: GuestPersonRole): boolean {
  return role !== "guest";
}
