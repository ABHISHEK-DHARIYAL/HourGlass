// Purpose: Minimal type definitions needed by the notification scheduler.
// This is a scoped copy of the relevant subset of src/types.ts — Cloud
// Functions deploy only the contents of this functions/ directory, so
// cross-directory imports from the main app's src/ are not deployable.
// Keep these definitions in sync with src/types.ts if those shapes change.

export enum Recurrence {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  startHour: number; // 0–23
  endHour: number; // 0–23
  anchorDate: string; // YYYY-MM-DD
  recurrence: Recurrence;
  notifyEnabled: boolean;
  priority?: boolean;
  categoryColor?: string;
  categoryId?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  excludedDates?: string[];
}

export enum ExceptionType {
  SKIPPED = 'SKIPPED',
  MODIFIED = 'MODIFIED'
}

export interface TaskException {
  id: string;
  taskId: string;
  date: string;
  type: ExceptionType;
  userId?: string;
  overrideTitle?: string;
  overrideStartHour?: number;
  overrideEndHour?: number;
  overrideNotes?: string;
  overrideCategoryColor?: string;
  overridePriority?: boolean;
}
