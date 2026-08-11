export type SessionAccount = {
  id: string;
  name: string;
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  canManageAccounts: boolean;
  /** null/empty means all tasks (including for non-masters). */
  assigneeFilter: string[] | null;
  linkedPersonId: string | null;
};

export type AccountModuleFlags = {
  canSeeTasks: boolean;
  canSeePeople: boolean;
  canSeeCalendar: boolean;
  canSeeShop: boolean;
  canSeeBudget: boolean;
  canEditBudget: boolean;
  canSeeTimeline: boolean;
  canEditTimeline: boolean;
  canSeeGuests: boolean;
  canSeeRequests: boolean;
  canManageAccounts: boolean;
};

export type AccountPermissionsInput = AccountModuleFlags & {
  name: string;
  pin: string;
  linkedPersonId: string | null;
  assigneeFilter: string[];
  /** Optional WP3 share lists (budget item ids / task ids). */
  sharedBudgetItemIds?: string[];
  sharedTaskIds?: string[];
};

export type PersonOption = {
  id: string;
  name: string;
};

export type ShareOption = {
  id: string;
  label: string;
};
