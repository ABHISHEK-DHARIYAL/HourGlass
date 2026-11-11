// Purpose: Date/segment helper functions needed by the notification scheduler.
// This is a scoped, behavior-identical copy of the relevant functions from
// src/utils/dateUtils.ts — Cloud Functions deploy only this functions/
// directory, so it can't import from the main app's src/ at deploy time.
// Keep this in sync with src/utils/dateUtils.ts if that logic changes.

import { Task, Recurrence, TaskException, ExceptionType } from './types';

// Formats a Date as a local YYYY-MM-DD string (not UTC — avoids the
// off-by-one-day bug toISOString() causes near midnight in most timezones).
export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Parses a YYYY-MM-DD string back into a local Date (midnight local time),
// the inverse of formatDate.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Returns the date `days` away from dateStr (negative to go backward).
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

// Returns the calendar day immediately before dateStr.
export function getPreviousDate(dateStr: string): string {
  return addDays(dateStr, -1);
}

// Determines whether a task occurs on a given date, accounting for its
// recurrence rule (none/daily/weekly/monthly/yearly), its anchor date, and
// any per-date exclusions.
export function isTaskActiveOnDate(task: Task, dateStr: string): boolean {
  if (task.excludedDates && task.excludedDates.includes(dateStr)) {
    return false;
  }
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
  isWrapped: boolean;
}

// Expands a list of tasks into the concrete time segments they occupy on
// one specific date — applying SKIPPED/MODIFIED exceptions for that date,
// and splitting tasks that run past midnight into a wrapped segment on the
// following day. This is the shared source of truth the notification
// scheduler uses to know what's actually scheduled 'today'.
export function getTaskSegmentsForDate(tasks: Task[], dateStr: string, exceptions: TaskException[] = []): TaskSegment[] {
  const segments: TaskSegment[] = [];

  for (const task of tasks) {
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
        segments.push({
          task: effectiveTaskToday,
          startHour: effectiveTaskToday.startHour,
          endHour: effectiveTaskToday.endHour,
          isWrapped: false
        });
      } else {
        segments.push({
          task: effectiveTaskToday,
          startHour: effectiveTaskToday.startHour,
          endHour: 24,
          isWrapped: false
        });
      }
    }

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
