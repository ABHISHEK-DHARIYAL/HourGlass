/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, Recurrence, TaskException, ExceptionType, TaskCompletion, CompletionStatus } from '../types';

/**
 * Returns the date string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses YYYY-MM-DD in local time
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adds offset days to a YYYY-MM-DD string
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function getPreviousDate(dateStr: string): string {
  return addDays(dateStr, -1);
}

export function getNextDate(dateStr: string): string {
  return addDays(dateStr, 1);
}

/**
 * Determines if a task's recurrence rule makes it active on a specific date (D)
 */
export function isTaskActiveOnDate(task: Task, dateStr: string): boolean {
  if (task.excludedDates && task.excludedDates.includes(dateStr)) {
    return false;
  }
  // Task is only active on or after its anchorDate
  if (dateStr < task.anchorDate) {
    return false;
  }

  if (task.recurrence === Recurrence.NONE) {
    return dateStr === task.anchorDate;
  }

  if (task.recurrence === Recurrence.DAILY) {
    return true;
  }

  const dDate = parseLocalDate(dateStr);
  const anchorDate = parseLocalDate(task.anchorDate);

  if (task.recurrence === Recurrence.WEEKLY) {
    return dDate.getDay() === anchorDate.getDay();
  }

  if (task.recurrence === Recurrence.MONTHLY) {
    return dDate.getDate() === anchorDate.getDate();
  }

  if (task.recurrence === Recurrence.YEARLY) {
    return (
      dDate.getMonth() === anchorDate.getMonth() &&
      dDate.getDate() === anchorDate.getDate()
    );
  }

  return false;
}

export interface TaskSegment {
  task: Task;
  startHour: number;
  endHour: number;
  isWrapped: boolean; // True if this is the portion that carried over from the previous day
}

/**
 * Retrieves all active task segments for a specific date (including parts that wrapped from previous day), supporting TaskExceptions.
 */
export function getTaskSegmentsForDate(tasks: Task[], dateStr: string, exceptions: TaskException[] = []): TaskSegment[] {
  const segments: TaskSegment[] = [];

  for (const task of tasks) {
    // 1. Check if task started on this day
    const currentException = exceptions.find(e => e.taskId === task.id && e.date === dateStr);
    const isSkippedToday = currentException?.type === ExceptionType.SKIPPED;

    let effectiveTaskToday = task;
    if (currentException?.type === ExceptionType.MODIFIED) {
      effectiveTaskToday = {
        ...task,
        title: currentException.overrideTitle ?? task.title,
        startHour: currentException.overrideStartHour ?? task.startHour,
        endHour: currentException.overrideEndHour ?? task.endHour,
        notes: currentException.overrideNotes ?? task.notes,
        color: currentException.overrideCategoryColor ?? task.color,
        priority: currentException.overridePriority ?? task.priority,
      };
    }

    if (isTaskActiveOnDate(task, dateStr) && !isSkippedToday) {
      if (effectiveTaskToday.endHour > effectiveTaskToday.startHour) {
        // Standard non-wrapping task
        segments.push({
          task: effectiveTaskToday,
          startHour: effectiveTaskToday.startHour,
          endHour: effectiveTaskToday.endHour,
          isWrapped: false
        });
      } else {
        // Wrapping task - first segment from startHour to 24
        segments.push({
          task: effectiveTaskToday,
          startHour: effectiveTaskToday.startHour,
          endHour: 24,
          isWrapped: false
        });
      }
    }

    // 2. Check if task started on the previous day and wrapped into this day
    const prevDateStr = getPreviousDate(dateStr);
    const prevException = exceptions.find(e => e.taskId === task.id && e.date === prevDateStr);
    const isSkippedPrev = prevException?.type === ExceptionType.SKIPPED;

    let effectiveTaskPrev = task;
    if (prevException?.type === ExceptionType.MODIFIED) {
      effectiveTaskPrev = {
        ...task,
        title: prevException.overrideTitle ?? task.title,
        startHour: prevException.overrideStartHour ?? task.startHour,
        endHour: prevException.overrideEndHour ?? task.endHour,
        notes: prevException.overrideNotes ?? task.notes,
        color: prevException.overrideCategoryColor ?? task.color,
        priority: prevException.overridePriority ?? task.priority,
      };
    }

    if (isTaskActiveOnDate(task, prevDateStr) && !isSkippedPrev && effectiveTaskPrev.endHour <= effectiveTaskPrev.startHour) {
      // Second segment from 0 to endHour
      if (effectiveTaskPrev.endHour > 0) {
        segments.push({
          task: effectiveTaskPrev,
          startHour: 0,
          endHour: effectiveTaskPrev.endHour,
          isWrapped: true
        });
      }
    }
  }

  return segments;
}

/**
 * Format hour 0-23 into standard display (e.g., "12:00 AM", "5:00 PM")
 */
export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

/**
 * Calculates current streak for a task based on completions list
 */
export function calculateStreak(taskId: string, completions: TaskCompletion[]): number {
  const taskComps = completions
    .filter(c => c.taskId === taskId && c.status === CompletionStatus.DONE)
    .sort((a, b) => b.date.localeCompare(a.date)); // descending by date
  if (taskComps.length === 0) return 0;
  
  let streak = 0;
  const currentDate = new Date();
  
  let expectedDateStr = formatDate(currentDate);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  
  // If the latest completion is not today or yesterday, streak is broken
  if (taskComps[0].date !== expectedDateStr && taskComps[0].date !== yesterdayStr) {
    return 0;
  }
  
  let checkDateStr = taskComps[0].date;
  for (let i = 0; i < taskComps.length; i++) {
    const comp = taskComps.find(tc => tc.date === checkDateStr);
    if (comp) {
      streak++;
      const d = parseLocalDate(checkDateStr);
      d.setDate(d.getDate() - 1);
      checkDateStr = formatDate(d);
    } else {
      break;
    }
  }
  return streak;
}
