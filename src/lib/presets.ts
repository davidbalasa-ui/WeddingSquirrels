import type { AccountModuleFlags } from "@/lib/types";

export type PresetId =
  | "full"
  | "partner"
  | "helper"
  | "sharedMoney"
  | "vendor"
  | "weddingParty"
  | "custom";

export type Preset = {
  label: string;
  description: string;
  /** null = Custom (doesn't change flags; opens fine-tuning). */
  flags: AccountModuleFlags | null;
};

export const PRESETS: Record<PresetId, Preset> = {
  full: {
    label: "Full access",
    description: "Everything, including account management",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: true,
      canEditBudget: true,
      canSeeTimeline: true,
      canEditTimeline: true,
      canSeeGuests: true,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditDinner: true,
      canEditRehearsal: true,
      canManageAccounts: true,
    },
  },
  partner: {
    label: "Partner",
    description: "All modules + money/day-of edit; no account admin",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: true,
      canEditBudget: true,
      canSeeTimeline: true,
      canEditTimeline: true,
      canSeeGuests: true,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditDinner: true,
      canEditRehearsal: true,
      canManageAccounts: false,
    },
  },
  helper: {
    label: "Helper",
    description: "Tasks, people, calendar, shop, requests — no money/guests admin",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: true,
      canSeeBudget: false,
      canEditBudget: false,
      canSeeTimeline: false,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: true,
      canSeeStay: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
  sharedMoney: {
    label: "Shared-only money viewer",
    description: "Read-only money; other modules off (pair with shared items)",
    flags: {
      canSeeTasks: false,
      canSeePeople: false,
      canSeeCalendar: false,
      canSeeShop: false,
      canSeeBudget: true,
      canEditBudget: false,
      canSeeTimeline: false,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: false,
      canSeeStay: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
  vendor: {
    label: "Vendor",
    description: "Day-of schedule and asks — nothing else",
    flags: {
      canSeeTasks: false,
      canSeePeople: false,
      canSeeCalendar: false,
      canSeeShop: false,
      canSeeBudget: false,
      canEditBudget: false,
      canSeeTimeline: true,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: true,
      canSeeStay: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
  weddingParty: {
    label: "Wedding party",
    description: "Tasks, day-of schedule, stay, asks",
    flags: {
      canSeeTasks: true,
      canSeePeople: true,
      canSeeCalendar: true,
      canSeeShop: false,
      canSeeBudget: false,
      canEditBudget: false,
      canSeeTimeline: true,
      canEditTimeline: false,
      canSeeGuests: false,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    },
  },
  custom: {
    label: "Custom",
    description: "Fine-tune each module yourself",
    flags: null,
  },
};

export const PRESET_ORDER: PresetId[] = [
  "full",
  "partner",
  "helper",
  "sharedMoney",
  "vendor",
  "weddingParty",
  "custom",
];

export const DEFAULT_CREATE_FLAGS: AccountModuleFlags = {
  canSeeTasks: true,
  canSeePeople: true,
  canSeeCalendar: true,
  canSeeShop: true,
  canSeeBudget: false,
  canEditBudget: false,
  canSeeTimeline: false,
  canEditTimeline: false,
  canSeeGuests: false,
  canSeeRequests: true,
  canSeeStay: false,
  canSeeDinner: false,
  canEditDinner: false,
  canEditRehearsal: false,
  canManageAccounts: false,
};

export function flagsMatchPreset(flags: AccountModuleFlags, id: PresetId): boolean {
  const preset = PRESETS[id];
  if (!preset.flags) return false;
  for (const key of Object.keys(flags) as (keyof AccountModuleFlags)[]) {
    if (preset.flags[key] !== flags[key]) return false;
  }
  return true;
}

/** Which named preset the flags match, or "custom". */
export function matchPreset(flags: AccountModuleFlags): PresetId {
  for (const id of PRESET_ORDER) {
    if (id === "custom") continue;
    if (flagsMatchPreset(flags, id)) return id;
  }
  return "custom";
}
