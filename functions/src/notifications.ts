// Purpose: FCM push notification scheduler logic, ported from the old
// backend/notifications.ts. The reminder rules (15/10/5-minute and
// exact-start-time reminders, morning/evening summaries, quiet hours) are
// unchanged. Two things were necessarily adapted for the Cloud Functions
// execution model instead of a long-lived Express process:
//   1. Sends are awaited instead of fire-and-forget, since a scheduled
//      function invocation can be frozen/recycled once it returns.
//   2. De-duplication is persisted in Firestore (see db.ts) instead of an
//      in-memory Set, since a scheduled invocation isn't guaranteed to
//      reuse the same warm instance from one minute to the next.

import { getMessaging } from 'firebase-admin/messaging';
import { getTaskSegmentsForDate } from './dateUtils';
import { Task } from './types';
import { loadTasksForUser, getAllUsersWithTokens, hasNotificationBeenSent, markNotificationSent } from './db';

// Offline fallback quote list — only used if the Quotable API is
// unreachable when /api/quote is called (see index.ts).
export const INSPIRATIONAL_QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Do not let what you cannot do interfere with what you can do.", author: "John Wooden" },
  { text: "You do not find a happy life. You make it.", author: "Thomas S. Monson" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "One of these days is none of these days.", author: "German Proverb" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Ordinary people think merely of spending time. Great people think of using it.", author: "Arthur Schopenhauer" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "Time is a created thing. To say 'I don't have time' is to say 'I don't want to'.", author: "Lao Tzu" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "Mastering others is strength. Mastering yourself is true power.", author: "Lao Tzu" },
  { text: "Better three hours too soon than a minute too late.", author: "William Shakespeare" },
  { text: "The time for action is now. It's never too late to do something.", author: "Antoine de Saint-Exupéry" },
  { text: "He who holds the key to his hours controls the destiny of his day.", author: "Hourglass Philosophy" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "It's not about having time. It's about making time.", author: "Unknown" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Flow with the hour, build for the day.", author: "Ledger Wisdom" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Clarity breeds momentum.", author: "James Clear" }
];

// Sends a single push notification to one device token via Firebase Cloud
// Messaging, with both Android and Web Push presentation options set.
export async function sendFCMNotification(token: string, payload: { title: string; body: string; data?: Record<string, string> }) {
  const message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      notification: {
        sound: 'default',
        channelId: 'default',
        color: '#0d1a13',
        icon: 'stock_ticker_update',
      },
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icon-maskable.svg',
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
      },
      fcmOptions: {
        link: '/',
      },
    },
  };
  return getMessaging().send(message);
}

// The core scheduler logic, run once a minute by the scheduledNotifications
// Cloud Function (see index.ts). For every user with a registered FCM
// token: checks quiet hours, sends the morning/evening summary at the
// user's configured local time, and sends the 15/10/5-minute-before and
// exact-start-time reminders for each of today's scheduled task segments.
export async function checkAndSendNotifications() {
  const usersWithTokens = await getAllUsersWithTokens();
  if (usersWithTokens.length === 0) return;

  const now = new Date();

  for (const userRecord of usersWithTokens) {
    const userId = userRecord.id;
    const fcmToken = userRecord.fcmToken || '';
    if (!fcmToken) continue;

    const timezone = userRecord.timezone || 'UTC';
    const settings = userRecord.notificationSettings || {
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
      quietHoursEnd: '07:00'
    };

    if (!settings.enabled) continue;

    let localDateStr = '';
    let localHour = 0;
    let localMinute = 0;

    try {
      localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
      const hourStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: timezone });
      localHour = parseInt(hourStr, 10);
      const minStr = now.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', timeZone: timezone });
      localMinute = parseInt(minStr, 10);
    } catch (err) {
      localDateStr = now.toISOString().split('T')[0];
      localHour = now.getUTCHours();
      localMinute = now.getUTCMinutes();
    }

    let inQuietHours = false;
    if (settings.quietHoursEnabled) {
      const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
      const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
      const currentMinutes = localHour * 60 + localMinute;
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        inQuietHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else {
        inQuietHours = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }
    }
    if (inQuietHours) continue;

    let userTasksList: any[] = [];
    try {
      userTasksList = await loadTasksForUser(userId);
    } catch (err) {
      console.error(`Failed to load tasks for user ${userId}:`, err);
      continue;
    }

    const [mH, mM] = settings.morningSummaryTime.split(':').map(Number);
    const [eH, eM] = settings.eveningSummaryTime.split(':').map(Number);

    if (settings.morningSummaryEnabled && localHour === mH && localMinute === mM) {
      const morningKey = `morning_push_${userId}_${localDateStr}`;
      if (!(await hasNotificationBeenSent(userId, morningKey))) {
        const activeCount = userTasksList.length;
        try {
          await sendFCMNotification(fcmToken, {
            title: '🌞 Good Morning',
            body: `Today: • ${activeCount} Scheduled Tasks • Track your focus flow and make today incredibly productive!`,
            data: { actions: JSON.stringify([{ action: 'open', title: 'Open Hourglass' }]) }
          });
          await markNotificationSent(userId, morningKey);
        } catch (err) {
          console.error('Morning summary FCM fail:', err);
        }
      }
    }

    if (settings.eveningSummaryEnabled && localHour === eH && localMinute === eM) {
      const eveningKey = `evening_push_${userId}_${localDateStr}`;
      if (!(await hasNotificationBeenSent(userId, eveningKey))) {
        try {
          await sendFCMNotification(fcmToken, {
            title: '🌙 Day Complete',
            body: `Great work! Remember to log your reflection and review completed blocks on your timeline.`,
            data: { actions: JSON.stringify([{ action: 'open', title: 'Review Day' }]) }
          });
          await markNotificationSent(userId, eveningKey);
        } catch (err) {
          console.error('Evening summary FCM fail:', err);
        }
      }
    }

    const activeTasks = userTasksList.filter((task: any) => task.notifyEnabled === true);
    if (activeTasks.length === 0) continue;

    const segments = getTaskSegmentsForDate(activeTasks as Task[], localDateStr);
    for (const segment of segments) {
      const { task, startHour: segStart } = segment;

      const targetStartMinutes = segStart * 60;
      const currentLocalMinutes = localHour * 60 + localMinute;
      const diffMinutes = targetStartMinutes - currentLocalMinutes;

      if (settings.reminderTiming >= 15 && diffMinutes === 15) {
        const key = `push_upcoming_15_${userId}_${task.id}_${localDateStr}`;
        if (!(await hasNotificationBeenSent(userId, key))) {
          try {
            await sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 15 minutes.`,
              data: { actions: JSON.stringify([{ action: 'open', title: 'View Schedule' }]) }
            });
            await markNotificationSent(userId, key);
          } catch (err) {
            console.error('FCM upcoming 15 fail:', err);
          }
        }
      }

      if (settings.reminderTiming >= 10 && diffMinutes === 10) {
        const key = `push_upcoming_10_${userId}_${task.id}_${localDateStr}`;
        if (!(await hasNotificationBeenSent(userId, key))) {
          try {
            await sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 10 minutes.`,
              data: { actions: JSON.stringify([{ action: 'open', title: 'View Schedule' }]) }
            });
            await markNotificationSent(userId, key);
          } catch (err) {
            console.error('FCM upcoming 10 fail:', err);
          }
        }
      }

      if (diffMinutes === 5) {
        const key = `push_upcoming_5_${userId}_${task.id}_${localDateStr}`;
        if (!(await hasNotificationBeenSent(userId, key))) {
          try {
            await sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 5 minutes.`,
              data: { actions: JSON.stringify([{ action: 'open', title: 'Open Hourglass' }]) }
            });
            await markNotificationSent(userId, key);
          } catch (err) {
            console.error('FCM upcoming 5 fail:', err);
          }
        }
      }

      if (diffMinutes === 0) {
        const key = `push_start_${userId}_${task.id}_${localDateStr}`;
        if (!(await hasNotificationBeenSent(userId, key))) {
          try {
            await sendFCMNotification(fcmToken, {
              title: '🚀 Time to Start',
              body: `It's time to begin "${task.title}".`,
              data: {
                actions: JSON.stringify([
                  { action: `start_task_${task.id}`, title: 'Start' },
                  { action: `snooze_5_task_${task.id}`, title: 'Snooze 5 Min' }
                ])
              }
            });
            await markNotificationSent(userId, key);
          } catch (err) {
            console.error('FCM start task fail:', err);
          }
        }
      }
    }
  }
}
