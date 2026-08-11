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

export type AccountPermissionsInput = {
  name: string;
  pin: string;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canManageAccounts: boolean;
  assigneeFilter: string[];
};
