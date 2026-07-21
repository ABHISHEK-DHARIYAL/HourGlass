/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, TaskException, TaskCompletion, Habit, HabitHistory, CompletionStatus, ExceptionType } from '../types';

export interface NotificationSettings {
  enabled: boolean;
  reminderTiming: number; // 5, 10, 15, or 30 minutes
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  morningSummaryEnabled: boolean;
  morningSummaryTime: string; // "08:00"
  eveningSummaryEnabled: boolean;
  eveningSummaryTime: string; // "21:00"
  habitRemindersEnabled: boolean;
  breakRemindersEnabled: boolean;
  breakIntervalMinutes: number; // 90
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  calendarRemindersEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderTiming: 15,
  soundEnabled: true,
  vibrationEnabled: true,
  morningSummaryEnabled: true,
  morningSummaryTime: '08:00',
  eveningSummaryEnabled: true,
  eveningSummaryTime: '21:00',
  habitRemindersEnabled: true,
  breakRemindersEnabled: true,
  breakIntervalMinutes: 90,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  calendarRemindersEnabled: true
};

/**
 * Play a high-fidelity synthetic sound using the browser's Web Audio API.
 * This guarantees offline support and pristine, crisp, modern, app-like audio chimes without downloading assets.
 */
export function playNotificationSound(type: 'success' | 'alert' | 'info' | 'break' = 'info') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const dest = ctx.destination;
    
    // Synthesize physical-sounding tones
    if (type === 'success') {
      // Elegant warm digital rising chime (major triad)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.4);
        
        osc.connect(gain);
        gain.connect(dest);
        
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.45);
      });
    } else if (type === 'alert') {
      // Dual-tone high-attention warning alert chime
      const notes = [587.33, 587.33]; // D5
      notes.forEach((freq, idx) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.2);
        osc2.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + idx * 0.2); // perfect fifth overlay
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.2);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.2 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.2 + 0.35);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);
        
        osc1.start(ctx.currentTime + idx * 0.2);
        osc2.start(ctx.currentTime + idx * 0.2);
        osc1.stop(ctx.currentTime + idx * 0.2 + 0.4);
        osc2.stop(ctx.currentTime + idx * 0.2 + 0.4);
      });
    } else if (type === 'break') {
      // Relaxation breath-like double-sine hum
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3 soft baseline
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 1.2); // up to E4
      
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(3, ctx.currentTime); // 3Hz vibrato
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 2.0);
    } else {
      // Muted modern ambient notification ping (info)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high bell ping
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // rapid smooth slide down to A4
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(dest);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch (e) {
    console.warn('AudioContext playback blocked or failed:', e);
  }
}

/**
 * Triggers a browser-level system notification if permission is granted.
 */
export async function triggerSystemNotification(title: string, body: string, actions?: NotificationAction[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      // Filter out actions for regular standard triggers if unsupported, but support is ideal
      const options: any = {
        body,
        icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=192&h=192&q=80',
        badge: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=192&h=192&q=80',
        tag: 'hourglass_alert',
        vibrate: [200, 100, 200],
        data: { time: Date.now() },
        actions: actions ? actions.map(act => ({
          action: act.action,
          title: act.title,
          icon: act.icon
        })) : []
      };
      await reg.showNotification(title, options);
      return true;
    } else {
      new Notification(title, { body });
      return true;
    }
  } catch (err) {
    console.error('Failed to trigger system notification:', err);
    // Fallback to basic window Notification
    try {
      new Notification(title, { body });
    } catch (_) {}
    return null;
  }
}

/**
 * Save user notification settings to local storage and sync with backend
 */
export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<boolean> {
  try {
    localStorage.setItem(`hourglass_settings_${userId}`, JSON.stringify(settings));
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    // Attempt to load FCM token for sync
    let fcmToken = '';
    try {
      const { messaging } = await import('../firebase');
      const { getToken } = await import('firebase/messaging');
      if (messaging && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
        const token = await getToken(messaging, { vapidKey });
        if (token) {
          fcmToken = token;
        }
      }
    } catch (e) {
      console.warn('Could not retrieve FCM token for setting sync:', e);
    }

    // Synchronize to Express backend
    const response = await fetch('/api/notification-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        settings,
        timezone,
        fcmToken: fcmToken || undefined
      })
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to save notification settings:', err);
    return false;
  }
}

/**
 * Load user notification settings from local storage
 */
export function loadNotificationSettings(userId: string): NotificationSettings {
  try {
    const saved = localStorage.getItem(`hourglass_settings_${userId}`);
    if (saved) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Failed to load notification settings:', err);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * Check if the current hour/minute sits within quiet hours
 */
export function isInQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
  const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Quiet hours cross midnight (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * Simple key logger to ensure we don't trigger duplicates in local active frame
 */
const triggeredKeys = new Set<string>();

export function clearTriggeredKeys() {
  triggeredKeys.clear();
}

/**
 * Formats standard time into printable string
 */
export function formatTimeLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${ampm}`;
}

/**
 * Checks for upcoming, start, end, overdue, and summary alert conditions on the active state.
 * Returns an array of rich notification data structures to display as interactive toasts in UI.
 */
export function checkForActiveNotifications(
  userId: string,
  tasks: Task[],
  exceptions: TaskException[],
  completions: TaskCompletion[],
  habits: Habit[],
  habitHistory: HabitHistory[],
  activeFocusedMinutes: number, // continuously focused time
  lastInteractionTime: number,
  onTriggerNotification: (notification: RichNotification) => void
) {
  const settings = loadNotificationSettings(userId);
  if (!settings.enabled || isInQuietHours(settings)) return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); // YYYY-MM-DD
  
  // Calculate continuous minutes for overdue & alerts
  const todayMinutes = currentHour * 60 + currentMinute;

  // Helpers to fetch exception overrides
  const getTaskForDate = (task: Task): { title: string; startHour: number; endHour: number; notes: string; isSkipped: boolean; priority: boolean } => {
    const exception = exceptions.find(e => e.taskId === task.id && e.date === dateStr);
    if (exception) {
      return {
        title: exception.overrideTitle !== undefined ? exception.overrideTitle : task.title,
        startHour: exception.overrideStartHour !== undefined ? exception.overrideStartHour : task.startHour,
        endHour: exception.overrideEndHour !== undefined ? exception.overrideEndHour : task.endHour,
        notes: exception.overrideNotes !== undefined ? exception.overrideNotes : (task.notes || ''),
        isSkipped: exception.type === ExceptionType.SKIPPED,
        priority: exception.overridePriority !== undefined ? exception.overridePriority : (task.priority || false)
      };
    }
    return {
      title: task.title,
      startHour: task.startHour,
      endHour: task.endHour,
      notes: task.notes || '',
      isSkipped: false,
      priority: task.priority || false
    };
  };

  // Helper to check task active state for recurrence
  const isTaskActiveToday = (task: Task): boolean => {
    // If exact date anchor
    if (task.anchorDate === dateStr) return true;
    
    // Check custom exclusion lists
    if (task.excludedDates?.includes(dateStr)) return false;

    // Check recurrence rules
    const anchor = new Date(task.anchorDate);
    const target = new Date(dateStr);
    
    // Ensure anchor date is not in the future
    if (anchor > target) return false;

    const diffTime = target.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (task.recurrence === 'DAILY') {
      return true;
    } else if (task.recurrence === 'WEEKLY') {
      return anchor.getDay() === target.getDay();
    } else if (task.recurrence === 'MONTHLY') {
      return anchor.getDate() === target.getDate();
    } else if (task.recurrence === 'YEARLY') {
      return anchor.getMonth() === target.getMonth() && anchor.getDate() === target.getDate();
    }
    return false;
  };

  // 1. Check morning and evening summaries
  const morningTimeStr = settings.morningSummaryTime; // e.g. "08:00"
  const eveningTimeStr = settings.eveningSummaryTime; // e.g. "21:00"
  
  const [mH, mM] = morningTimeStr.split(':').map(Number);
  const [eH, eM] = eveningTimeStr.split(':').map(Number);

  // Trigger Morning Summary
  if (settings.morningSummaryEnabled && currentHour === mH && currentMinute === mM) {
    const morningKey = `morning_summary_${dateStr}`;
    if (!triggeredKeys.has(morningKey)) {
      triggeredKeys.add(morningKey);
      
      const todaysTasks = tasks.filter(t => isTaskActiveToday(t)).map(t => getTaskForDate(t)).filter(t => !t.isSkipped);
      const totalEstimatedFocus = todaysTasks.reduce((acc, t) => acc + ((t.endHour - t.startHour + 24) % 24), 0);
      const meetingsCount = todaysTasks.filter(t => t.title.toLowerCase().includes('meet') || t.title.toLowerCase().includes('call')).length;
      const workoutsCount = todaysTasks.filter(t => t.title.toLowerCase().includes('workout') || t.title.toLowerCase().includes('gym') || t.title.toLowerCase().includes('run')).length;
      
      const body = `Today: • ${todaysTasks.length} Tasks • ${meetingsCount} Meetings • ${workoutsCount} Workouts • Focus Time: ~${totalEstimatedFocus}h`;
      
      onTriggerNotification({
        id: morningKey,
        type: 'morning_summary',
        title: '🌞 Good Morning',
        body,
        category: 'info',
        actions: [{ action: 'open', title: 'Open Hourglass' }]
      });
    }
  }

  // Trigger Evening Summary
  if (settings.eveningSummaryEnabled && currentHour === eH && currentMinute === eM) {
    const eveningKey = `evening_summary_${dateStr}`;
    if (!triggeredKeys.has(eveningKey)) {
      triggeredKeys.add(eveningKey);
      
      const todaysTasks = tasks.filter(t => isTaskActiveToday(t)).map(t => getTaskForDate(t)).filter(t => !t.isSkipped);
      const doneCompletions = completions.filter(c => c.date === dateStr && c.status === CompletionStatus.DONE);
      const totalFocusMinutes = completions.reduce((acc, c) => acc + (c.actualDuration || 0), 0) / 60;
      
      const productivityPercentage = todaysTasks.length > 0 
        ? Math.round((doneCompletions.length / todaysTasks.length) * 100) 
        : 100;
        
      const body = `Completed: ${doneCompletions.length} / ${todaysTasks.length} Tasks\nFocus Time: ${Math.round(totalFocusMinutes / 60)}h ${Math.round(totalFocusMinutes % 60)}m\nProductivity: ${productivityPercentage}%`;
      
      onTriggerNotification({
        id: eveningKey,
        type: 'evening_summary',
        title: '🌙 Day Complete',
        body,
        category: 'success',
        actions: [{ action: 'open', title: 'Review Day' }]
      });
    }
  }

  // Active tasks analysis
  const todaysTasks = tasks.filter(t => isTaskActiveToday(t)).map(t => {
    const resolved = getTaskForDate(t);
    return { ...t, resolved };
  }).filter(t => !t.resolved.isSkipped);

  // Check smart continuous break reminders
  if (settings.breakRemindersEnabled && activeFocusedMinutes >= settings.breakIntervalMinutes) {
    const breakKey = `smart_break_reminder_${Math.floor(activeFocusedMinutes / settings.breakIntervalMinutes)}`;
    if (!triggeredKeys.has(breakKey)) {
      triggeredKeys.add(breakKey);
      onTriggerNotification({
        id: breakKey,
        type: 'break_reminder',
        title: '☕ Take a Break',
        body: `You've been focused continuously for ${activeFocusedMinutes} minutes. Step away for some water and stretch!`,
        category: 'break',
        actions: [
          { action: 'snooze_10', title: 'Remind in 10m' },
          { action: 'skip_break', title: 'Dismiss' }
        ]
      });
    }
  }

  // Habits checking (Habit Reminders)
  if (settings.habitRemindersEnabled) {
    habits.forEach(habit => {
      // Check if not completed today
      const historyKey = `${habit.id}_${dateStr}`;
      const isDone = habitHistory.some(h => h.id === historyKey && h.done);
      
      if (!isDone) {
        // Trigger habit reminders after midday or evening if still undone
        const habitTimeCheck = currentHour === 14 && currentMinute === 30; // 2:30 PM reminder
        if (habitTimeCheck) {
          const habitReminderKey = `habit_reminder_${habit.id}_${dateStr}`;
          if (!triggeredKeys.has(habitReminderKey)) {
            triggeredKeys.add(habitReminderKey);
            onTriggerNotification({
              id: habitReminderKey,
              type: 'habit_reminder',
              title: `💧 Habit Reminder: ${habit.title}`,
              body: `Time to complete your daily habit: "${habit.title}"! Keep your streak going!`,
              category: 'info',
              actions: [
                { action: `complete_habit_${habit.id}`, title: 'Mark Done' },
                { action: 'skip', title: 'Ignore' }
              ]
            });
          }
        }
      }
    });
  }

  // Cycle through tasks for starting/upcoming/overdue/missed alert evaluations
  todaysTasks.forEach(taskObj => {
    const { resolved } = taskObj;
    const { startHour, endHour, title } = resolved;
    
    const taskStartMinutes = startHour * 60;
    const taskEndMinutes = endHour * 60;
    
    const completion = completions.find(c => c.taskId === taskObj.id && c.date === dateStr);
    const isCompleted = completion?.status === CompletionStatus.DONE;

    // 2. Overdue task check: Task is currently past its scheduled end hour but is incomplete
    if (todayMinutes > taskEndMinutes && todayMinutes < taskEndMinutes + 120 && !isCompleted) {
      const overdueKey = `overdue_task_${taskObj.id}_${dateStr}`;
      if (!triggeredKeys.has(overdueKey)) {
        triggeredKeys.add(overdueKey);
        onTriggerNotification({
          id: overdueKey,
          type: 'overdue_task',
          title: "⚠️ You're running behind.",
          body: `Keep focusing on "${title}"?`,
          category: 'alert',
          actions: [
            { action: `continue_task_${taskObj.id}`, title: 'Continue' },
            { action: `complete_task_${taskObj.id}`, title: 'Complete Task' },
            { action: `skip_task_${taskObj.id}`, title: 'Skip' }
          ]
        });
      }
    }

    // 3. Upcoming task checks (15 min before, 5 min before, and exact start time)
    const diffMinutes = taskStartMinutes - todayMinutes;

    // Reminder: 15 minutes before
    if (settings.reminderTiming >= 15 && diffMinutes === 15) {
      const upcoming15Key = `upcoming_15_${taskObj.id}_${dateStr}`;
      if (!triggeredKeys.has(upcoming15Key)) {
        triggeredKeys.add(upcoming15Key);
        onTriggerNotification({
          id: upcoming15Key,
          type: 'upcoming_reminder',
          title: `📅 Upcoming Task`,
          body: `"${title}" starts in 15 minutes.`,
          category: 'info',
          actions: [{ action: 'open', title: 'View Schedule' }]
        });
      }
    }

    // Reminder: 5 minutes before
    if (diffMinutes === 5) {
      const upcoming5Key = `upcoming_5_${taskObj.id}_${dateStr}`;
      if (!triggeredKeys.has(upcoming5Key)) {
        triggeredKeys.add(upcoming5Key);
        onTriggerNotification({
          id: upcoming5Key,
          type: 'upcoming_reminder',
          title: `📅 Upcoming Task`,
          body: `"${title}" starts in 5 minutes.`,
          category: 'info',
          actions: [{ action: 'open', title: 'Open Hourglass' }]
        });
      }
    }

    // Exact Start Notification
    if (diffMinutes === 0) {
      const startNotificationKey = `start_task_${taskObj.id}_${dateStr}`;
      if (!triggeredKeys.has(startNotificationKey)) {
        triggeredKeys.add(startNotificationKey);
        onTriggerNotification({
          id: startNotificationKey,
          type: 'task_start',
          title: `🚀 Time to Start`,
          body: `It's time to begin "${title}".`,
          category: 'info',
          actions: [
            { action: `start_task_${taskObj.id}`, title: 'Start' },
            { action: `snooze_5_task_${taskObj.id}`, title: 'Snooze 5 Min' }
          ]
        });
      }
    }

    // Missed task evaluation: if we missed starting a task and 20 minutes have passed without start/timer
    if (todayMinutes > taskStartMinutes + 20 && todayMinutes < taskEndMinutes && !isCompleted && !completion?.timerStartedAt) {
      const missedKey = `missed_task_${taskObj.id}_${dateStr}`;
      if (!triggeredKeys.has(missedKey)) {
        triggeredKeys.add(missedKey);
        onTriggerNotification({
          id: missedKey,
          type: 'missed_task',
          title: `You missed ${title}.`,
          body: `What would you like to do?`,
          category: 'alert',
          actions: [
            { action: `reschedule_task_${taskObj.id}`, title: 'Move to Next Free Slot' },
            { action: `tomorrow_task_${taskObj.id}`, title: 'Schedule Tomorrow' },
            { action: 'skip', title: 'Ignore' }
          ]
        });
      }
    }
  });
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface RichNotification {
  id: string;
  type: 'upcoming_reminder' | 'task_start' | 'task_end' | 'next_preview' | 'overdue_task' | 'morning_summary' | 'evening_summary' | 'missed_task' | 'habit_reminder' | 'break_reminder' | 'calendar_reminder';
  title: string;
  body: string;
  category: 'info' | 'success' | 'alert' | 'break';
  actions: NotificationAction[];
}
