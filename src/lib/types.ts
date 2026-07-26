export type SessionAccount = {
  id: string;
  name: string;
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canManageAccounts: boolean;
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
  assigneeFilter: string[];
};
