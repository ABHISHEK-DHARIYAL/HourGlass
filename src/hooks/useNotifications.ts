/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Task, TaskException, TaskCompletion, Habit, HabitHistory, CompletionStatus, ExceptionType } from '../types';
import { 
  NotificationSettings, 
  RichNotification, 
  loadNotificationSettings, 
  checkForActiveNotifications, 
  playNotificationSound,
  triggerSystemNotification
} from '../utils/notificationService';

interface UseNotificationsProps {
  userId: string;
  tasks: Task[];
  exceptions: TaskException[];
  completions: TaskCompletion[];
  habits: Habit[];
  habitHistory: HabitHistory[];
  onSaveCompletion: (completion: TaskCompletion) => Promise<void>;
  onSaveException: (exception: TaskException) => Promise<void>;
  onSaveTask: (task: Partial<Task>) => Promise<void>;
  onToggleHabit: (id: string, date: string, done: boolean) => Promise<void>;
}

export function useNotifications({
  userId,
  tasks,
  exceptions,
  completions,
  habits,
  habitHistory,
  onSaveCompletion,
  onSaveException,
  onSaveTask,
  onToggleHabit
}: UseNotificationsProps) {
  const [activeNotifications, setActiveNotifications] = useState<RichNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings(userId));
  const focusTimerRef = useRef<number>(0);
  const lastInteractionRef = useRef<number>(Date.now());

  // Keep settings synchronized when userId changes
  useEffect(() => {
    setSettings(loadNotificationSettings(userId));
  }, [userId]);

  // Track user continuous focus (smart break monitoring)
  // Let's assume user is focused if a timer is active on any task.
  useEffect(() => {
    const activeTimer = completions.find(c => c.timerStartedAt);
    let interval: NodeJS.Timeout | null = null;
    
    if (activeTimer) {
      interval = setInterval(() => {
        focusTimerRef.current += 1; // Accumulate focused minutes
      }, 60 * 1000); // increment every minute
    } else {
      // Reset focused timer if no task is active
      focusTimerRef.current = 0;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [completions]);

  // High-precision scheduler that runs every 10 seconds to check active notification alerts
  useEffect(() => {
    if (!userId || !settings.enabled) return;

    // Trigger check immediately and set interval
    const runCheck = () => {
      checkForActiveNotifications(
        userId,
        tasks,
        exceptions,
        completions,
        habits,
        habitHistory,
        focusTimerRef.current,
        lastInteractionRef.current,
        (newNotification) => {
          // Add to state list
          setActiveNotifications(prev => {
            if (prev.some(n => n.id === newNotification.id)) return prev;
            return [...prev, newNotification];
          });

          // Play synth chime sound if enabled
          if (settings.soundEnabled) {
            playNotificationSound(newNotification.category);
          }

          // Trigger system-level desktop push notification
          triggerSystemNotification(newNotification.title, newNotification.body, newNotification.actions);
        }
      );
    };

    runCheck();
    const checkInterval = setInterval(runCheck, 10000); // 10 seconds checking loop

    return () => {
      clearInterval(checkInterval);
    };
  }, [userId, tasks, exceptions, completions, habits, habitHistory, settings]);

  // Close / Dismiss in-app toast alerts
  const handleDismissNotification = (id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Process Interactive Notification Actions
  const handleExecuteNotificationAction = async (id: string, action: string) => {
    // Dismiss notification from list
    handleDismissNotification(id);

    const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

    // 1. General Open Action
    if (action === 'open') {
      window.focus();
      return;
    }

    // 2. Break Snooze
    if (action === 'snooze_10') {
      // Custom alarm schedule helper
      setTimeout(() => {
        const snoozeKey = `snoozed_break_${Date.now()}`;
        setActiveNotifications(prev => [...prev, {
          id: snoozeKey,
          type: 'break_reminder',
          title: '☕ Take a Break (Snoozed)',
          body: 'You promised to step away and take a break 10 minutes ago!',
          category: 'break',
          actions: [{ action: 'skip_break', title: 'Dismiss' }]
        }]);
        if (settings.soundEnabled) {
          playNotificationSound('break');
        }
      }, 10 * 60 * 1000);
      return;
    }

    // 3. Complete Habit Action
    if (action.startsWith('complete_habit_')) {
      const habitId = action.replace('complete_habit_', '');
      await onToggleHabit(habitId, nowStr, true);
      return;
    }

    // 4. Start Task Action
    if (action.startsWith('start_task_')) {
      const taskId = action.replace('start_task_', '');
      const existing = completions.find(c => c.taskId === taskId && c.date === nowStr);
      await onSaveCompletion({
        id: existing?.id || `${taskId}_${nowStr}`,
        taskId,
        date: nowStr,
        status: CompletionStatus.DONE,
        timerStartedAt: new Date().toISOString(),
        actualDuration: existing?.actualDuration || 0
      });
      return;
    }

    // 5. Complete Task Action
    if (action.startsWith('complete_task_')) {
      const taskId = action.replace('complete_task_', '');
      const existing = completions.find(c => c.taskId === taskId && c.date === nowStr);
      
      let duration = existing?.actualDuration || 0;
      if (existing?.timerStartedAt) {
        const elapsed = Math.round((Date.now() - new Date(existing.timerStartedAt).getTime()) / 1000);
        duration += elapsed;
      }

      await onSaveCompletion({
        id: existing?.id || `${taskId}_${nowStr}`,
        taskId,
        date: nowStr,
        status: CompletionStatus.DONE,
        actualDuration: duration,
        completedAt: new Date().toISOString()
      });
      return;
    }

    // 6. Snooze Task (5 minutes)
    if (action.startsWith('snooze_5_task_')) {
      const taskId = action.replace('snooze_5_task_', '');
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      setTimeout(() => {
        const snoozeKey = `snoozed_task_${taskId}_${Date.now()}`;
        setActiveNotifications(prev => [...prev, {
          id: snoozeKey,
          type: 'task_start',
          title: `🔔 Snoozed Task: ${task.title}`,
          body: `Snooze finished. It is time to start "${task.title}".`,
          category: 'info',
          actions: [
            { action: `start_task_${taskId}`, title: 'Start' },
            { action: `snooze_5_task_${taskId}`, title: 'Snooze 5 Min' }
          ]
        }]);
        if (settings.soundEnabled) {
          playNotificationSound('info');
        }
      }, 5 * 60 * 1000);
      return;
    }

    // 7. Skip Task (Creates exceptions / mark skipped)
    if (action.startsWith('skip_task_')) {
      const taskId = action.replace('skip_task_', '');
      const exceptionId = `${taskId}_${nowStr}`;
      await onSaveException({
        id: exceptionId,
        taskId,
        date: nowStr,
        type: ExceptionType.SKIPPED
      });
      return;
    }

    // 8. Reschedule / Move task to next free slot
    if (action.startsWith('reschedule_task_')) {
      const taskId = action.replace('reschedule_task_', '');
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Find first hour after current hour with no scheduled task
      const currentHour = new Date().getHours();
      let targetHour = (currentHour + 1) % 24;
      
      // Look for a free slot
      for (let i = 0; i < 24; i++) {
        const hour = (currentHour + 1 + i) % 24;
        const hourOccupied = tasks.some(t => {
          if (t.id === taskId) return false;
          if (t.anchorDate !== nowStr) return false; // simple check
          return hour >= t.startHour && hour < t.endHour;
        });
        if (!hourOccupied) {
          targetHour = hour;
          break;
        }
      }

      // Save reschedule (update anchor date/hours or exception modified)
      const duration = (task.endHour - task.startHour + 24) % 24 || 1;
      await onSaveTask({
        ...task,
        startHour: targetHour,
        endHour: (targetHour + duration) % 24,
        anchorDate: nowStr
      });
      return;
    }

    // 9. Schedule Tomorrow
    if (action.startsWith('tomorrow_task_')) {
      const taskId = action.replace('tomorrow_task_', '');
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

      // Move task or exception to skipped today and scheduled for tomorrow
      await onSaveException({
        id: `${taskId}_${nowStr}`,
        taskId,
        date: nowStr,
        type: ExceptionType.SKIPPED
      });

      await onSaveTask({
        ...task,
        anchorDate: tomorrowStr
      });
      return;
    }
  };

  return {
    activeNotifications,
    settings,
    setSettings,
    handleDismissNotification,
    handleExecuteNotificationAction
  };
}
