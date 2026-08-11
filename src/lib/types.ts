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
  canEditBudget: boolean;
  canEditTimeline: boolean;
  linkedPersonId: string | null;
  assigneeFilter: string[] | null;
};

export type AccountPermissionsInput = {
  name: string;
  pin: string;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canManageAccounts: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  linkedPersonId: string | null;
  assigneeFilter: string[];
};
