/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  priority?: boolean; // high-priority flag
  categoryColor?: string; // hex or token
  categoryId?: string; // custom category ID
  color: string; // Tailwind bg color class or hex string for compatibility
  createdAt: string;
  updatedAt: string;
  excludedDates?: string[];
}

export enum ExceptionType {
  SKIPPED = 'SKIPPED',
  MODIFIED = 'MODIFIED'
}

export interface TaskException {
  id: string; // taskId_date
  taskId: string;
  date: string; // YYYY-MM-DD
  type: ExceptionType;
  overrideTitle?: string;
  overrideStartHour?: number;
  overrideEndHour?: number;
  overrideNotes?: string;
  overrideCategoryColor?: string;
  overridePriority?: boolean;
}

export enum CompletionStatus {
  DONE = 'DONE',
  SKIPPED = 'SKIPPED',
  NO_RESPONSE = 'NO_RESPONSE'
}

export interface TaskCompletion {
  id: string; // taskId_date
  taskId: string;
  date: string; // YYYY-MM-DD
  status: CompletionStatus;
  completedAt?: string;
  actualDuration?: number; // in seconds
  timerStartedAt?: string; // ISO string if timer is running
}

export interface MustDoItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  done: boolean;
  createdAt?: string;
}

export interface TaskTemplate {
  id: string;
  userId: string;
  title: string;
  startHour: number;
  endHour: number;
  recurrence: Recurrence;
  categoryColor: string;
  categoryId?: string;
  priority: boolean;
  notes?: string;
}

export interface TaskCategory {
  id: string;
  userId: string;
  name: string;
  color: string; // hex color code
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface TodoItem {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
  priority?: boolean;
  order: number;
  createdAt: string;
  completedAt?: string;
}

export interface DayReflection {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
}

export interface DailyGoal {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  goal: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  color: string;
  createdAt: string;
}

export interface HabitHistory {
  id: string; // habitId_date
  habitId: string;
  date: string; // YYYY-MM-DD
  done: boolean;
}


