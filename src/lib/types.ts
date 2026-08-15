export type SessionAccount = {
  id: string;
  name: string;
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canManageAccounts: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canSeeDinner: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  linkedPersonId: string | null;
  /** null/empty means all tasks (including for non-masters). */
  assigneeFilter: string[] | null;
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
  canSeeDinner: boolean;
  canManageAccounts: boolean;
};

export type AccountPermissionsInput = AccountModuleFlags & {
  name: string;
  pin: string;
  linkedPersonId: string | null;
  assigneeFilter: string[];
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
