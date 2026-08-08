// Purpose: FCM push notifications and quote service for the backend server

import { getMessaging } from 'firebase-admin/messaging';
import { getTaskSegmentsForDate } from '../src/utils/dateUtils';
import { Task } from '../src/types';
import { loadTasksForUser, getAllUsersWithTokens } from './db';

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

export async function sendFCMNotification(token: string, payload: { title: string; body: string; data?: Record<string, string> }) {
  try {
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
    const response = await getMessaging().send(message);
    console.log('Successfully sent FCM message:', response);
    return response;
  } catch (error) {
    console.error('Error sending FCM message:', error);
    throw error;
  }
}

const sentNotifications = new Set<string>();

setInterval(() => {
  sentNotifications.clear();
  console.log('Cleared sent notifications cache.');
}, 2 * 60 * 60 * 1000);

export async function checkAndSendNotifications() {
  try {
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

      // Fetch this user's live tasks once per cycle (Firestore-first, local
      // cache as fallback) and reuse below for both the summary count and
      // the per-task reminder segments.
      const userTasksList = await loadTasksForUser(userId);

      const [mH, mM] = settings.morningSummaryTime.split(':').map(Number);
      const [eH, eM] = settings.eveningSummaryTime.split(':').map(Number);

      if (settings.morningSummaryEnabled && localHour === mH && localMinute === mM) {
        const morningKey = `morning_push_${userId}_${localDateStr}`;
        if (!sentNotifications.has(morningKey)) {
          const activeCount = userTasksList.length;
          
          sendFCMNotification(fcmToken, {
            title: '🌞 Good Morning',
            body: `Today: • ${activeCount} Scheduled Tasks • Track your focus flow and make today incredibly productive!`,
            data: {
              actions: JSON.stringify([{ action: 'open', title: 'Open Hourglass' }])
            }
          })
            .then(() => {
              sentNotifications.add(morningKey);
            })
            .catch(err => console.error('Morning summary FCM fail:', err));
        }
      }

      if (settings.eveningSummaryEnabled && localHour === eH && localMinute === eM) {
        const eveningKey = `evening_push_${userId}_${localDateStr}`;
        if (!sentNotifications.has(eveningKey)) {
          sendFCMNotification(fcmToken, {
            title: '🌙 Day Complete',
            body: `Great work! Remember to log your reflection and review completed blocks on your timeline.`,
            data: {
              actions: JSON.stringify([{ action: 'open', title: 'Review Day' }])
            }
          })
            .then(() => {
              sentNotifications.add(eveningKey);
            })
            .catch(err => console.error('Evening summary FCM fail:', err));
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
          const upcomingKey = `push_upcoming_15_${userId}_${task.id}_${localDateStr}`;
          if (!sentNotifications.has(upcomingKey)) {
            sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 15 minutes.`,
              data: {
                actions: JSON.stringify([{ action: 'open', title: 'View Schedule' }])
              }
            })
              .then(() => sentNotifications.add(upcomingKey))
              .catch(err => console.error('FCM upcoming 15 fail:', err));
          }
        }

        if (settings.reminderTiming >= 10 && diffMinutes === 10) {
          const upcomingKey = `push_upcoming_10_${userId}_${task.id}_${localDateStr}`;
          if (!sentNotifications.has(upcomingKey)) {
            sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 10 minutes.`,
              data: {
                actions: JSON.stringify([{ action: 'open', title: 'View Schedule' }])
              }
            })
              .then(() => sentNotifications.add(upcomingKey))
              .catch(err => console.error('FCM upcoming 10 fail:', err));
          }
        }

        if (diffMinutes === 5) {
          const upcomingKey = `push_upcoming_5_${userId}_${task.id}_${localDateStr}`;
          if (!sentNotifications.has(upcomingKey)) {
            sendFCMNotification(fcmToken, {
              title: `📅 Upcoming Task: ${task.title}`,
              body: `"${task.title}" starts in 5 minutes.`,
              data: {
                actions: JSON.stringify([{ action: 'open', title: 'Open Hourglass' }])
              }
            })
              .then(() => sentNotifications.add(upcomingKey))
              .catch(err => console.error('FCM upcoming 5 fail:', err));
          }
        }

        if (diffMinutes === 0) {
          const startKey = `push_start_${userId}_${task.id}_${localDateStr}`;
          if (!sentNotifications.has(startKey)) {
            sendFCMNotification(fcmToken, {
              title: '🚀 Time to Start',
              body: `It's time to begin "${task.title}".`,
              data: {
                actions: JSON.stringify([
                  { action: `start_task_${task.id}`, title: 'Start' },
                  { action: `snooze_5_task_${task.id}`, title: 'Snooze 5 Min' }
                ])
              }
            })
              .then(() => sentNotifications.add(startKey))
              .catch(err => console.error('FCM start task fail:', err));
          }
        }
      }
    }
  } catch (error) {
    console.error('Error running checkAndSendNotifications:', error);
  }
}
