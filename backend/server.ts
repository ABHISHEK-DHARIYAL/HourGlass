/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { getTaskSegmentsForDate } from '../src/utils/dateUtils';
import { Task } from '../src/types';

// Local storage paths
const TASKS_FILE = path.join(process.cwd(), 'tasks.json');

function loadTasks(): Record<string, any[]> {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading tasks:', err);
  }
  return {};
}

function saveTasks(tasks: Record<string, any[]>) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error saving tasks:', err);
  }
}

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

let isFirestoreAvailable = false;

// Initialize Firebase Admin using serviceAccount.json if present
const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully using serviceAccount.json');
    isFirestoreAvailable = true;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin with serviceAccount.json:', err);
    try {
      initializeApp({
        projectId: firebaseConfig.projectId || process.env.VITE_FIREBASE_PROJECT_ID
      });
    } catch (e) {
      console.warn('Failed to initialize fallback Firebase Admin app:', e);
    }
  }
} else {
  console.log('serviceAccount.json not found, initializing Firebase Admin with default credentials');
  try {
    initializeApp({
      projectId: firebaseConfig.projectId || process.env.VITE_FIREBASE_PROJECT_ID
    });
  } catch (e) {
    console.warn('Failed to initialize default Firebase Admin app:', e);
  }
}

async function initFirestoreAvailabilityCheck() {
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('[Firebase Admin] No serviceAccount.json detected. Skipping database permission test and using local JSON storage for backend cache.');
    isFirestoreAvailable = false;
    return;
  }

  try {
    // Temporarily enable to run verification query
    isFirestoreAvailable = true;
    const db = getDb();
    if (db) {
      const snapshot = await db.collection('users').limit(1).get();
      console.log(`[Firebase Admin] Firestore connection validated. Found ${snapshot.size} users.`);
      isFirestoreAvailable = true;
    } else {
      isFirestoreAvailable = false;
    }
  } catch (err: any) {
    console.log(`[Firebase Admin] Firestore connection check reported permission limits: ${err.message || err}. Disabling Firestore Admin queries (falling back to local cache).`);
    isFirestoreAvailable = false;
  }
}

function getDb() {
  if (!isFirestoreAvailable) {
    return null;
  }
  try {
    const databaseId = firebaseConfig.firestoreDatabaseId && 
                       firebaseConfig.firestoreDatabaseId.trim() !== '' &&
                       firebaseConfig.firestoreDatabaseId !== '(default)'
      ? firebaseConfig.firestoreDatabaseId
      : undefined;
    if (databaseId) {
      return getFirestore(databaseId);
    }
    return getFirestore();
  } catch (err: any) {
    console.log(`[getDb] Firestore Admin DB is not fully available (${err.message || err}).`);
    return null;
  }
}

// Local users fallback storage to guarantee robustness
const USERS_FILE = path.join(process.cwd(), 'users.json');

function loadUsers(): Record<string, any> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

function saveUsers(users: Record<string, any>) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

interface UserRecord {
  id: string;
  fcmToken?: string;
  timezone?: string;
  notificationSettings?: any;
  smartReminders?: boolean;
}

async function updateUserDoc(userId: string, data: any, merge = true) {
  // 1. Try Firestore
  try {
    const db = getDb();
    if (db) {
      await db.collection('users').doc(userId).set(data, { merge });
      console.log(`Successfully synced user ${userId} to Firestore`);
    }
  } catch (err: any) {
    console.log(`[Firestore Fallback] updateUserDoc failed for user ${userId}, using local cache (${err.message || err}).`);
  }

  // 2. Always update local users.json as fallback/cache
  try {
    const users = loadUsers();
    const existing = users[userId] || {};
    if (merge) {
      users[userId] = { ...existing, ...data, updatedAt: new Date().toISOString() };
    } else {
      users[userId] = { ...data, updatedAt: new Date().toISOString() };
    }
    saveUsers(users);
  } catch (err) {
    console.error('Failed to update local user fallback:', err);
  }
}

async function deleteUserDoc(userId: string) {
  // 1. Try Firestore
  try {
    const db = getDb();
    if (db) {
      await db.collection('users').doc(userId).delete();
      console.log(`Successfully deleted user ${userId} from Firestore`);
    }
  } catch (err: any) {
    console.log(`[Firestore Fallback] deleteUserDoc failed for user ${userId}, using local cache (${err.message || err}).`);
  }

  // 2. Local fallback delete
  try {
    const users = loadUsers();
    if (users[userId]) {
      delete users[userId];
      saveUsers(users);
    }
  } catch (err) {
    console.error('Failed to delete local user fallback:', err);
  }
}

async function getAllUsersWithTokens(): Promise<UserRecord[]> {
  const usersList: UserRecord[] = [];
  const visitedIds = new Set<string>();

  // 1. Try Firestore first
  try {
    const db = getDb();
    if (db) {
      const snapshot = await db.collection('users').get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.fcmToken) {
          usersList.push({
            id: doc.id,
            ...data
          });
          visitedIds.add(doc.id);
        }
      }
      console.log(`Loaded ${usersList.length} users with FCM tokens from Firestore`);
    }
  } catch (err: any) {
    console.log(`[Firestore Fallback] getAllUsersWithTokens failed, using local fallback (${err.message || err}).`);
  }

  // 2. Fallback / Merge with local users.json
  try {
    const localUsers = loadUsers();
    for (const [userId, data] of Object.entries(localUsers)) {
      if (!visitedIds.has(userId) && data && (data as any).fcmToken) {
        usersList.push({
          id: userId,
          ...(data as any)
        });
        visitedIds.add(userId);
      }
    }
  } catch (err) {
    console.error('Failed to load local users fallback:', err);
  }

  return usersList;
}

// Reusable helper function to send FCM notifications
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

const app = express();
app.use(express.json());

const PORT = 3000;

const INSPIRATIONAL_QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Do not let what you cannot do interfere with what you can do.", author: "John Wooden" },
  { text: "You do not find happy life. You make it.", author: "Thomas S. Monson" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "One of these days is none of these days.", author: "German Proverb" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Ordinary people think merely of spending time. Great people think of using it.", author: "Arthur Schopenhauer" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" }
];

// Fetch inspiring daily quote endpoint
app.get('/api/quote', (req, res) => {
  // Determine a deterministic quote for the day so it only changes once per day
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const quoteIndex = dayOfYear % INSPIRATIONAL_QUOTES.length;
  res.json(INSPIRATIONAL_QUOTES[quoteIndex]);
});

const DEBUG_LOGS_FILE = path.join(process.cwd(), 'debug-logs.txt');

app.post('/api/debug-log', (req, res) => {
  const { message, level, timestamp } = req.body;
  const logLine = `[${timestamp || new Date().toISOString()}] [${level || 'INFO'}] ${message}\n`;
  try {
    fs.appendFileSync(DEBUG_LOGS_FILE, logLine, 'utf-8');
    console.log(logLine.trim());
  } catch (err) {
    console.error('Failed to append to debug-logs.txt:', err);
  }
  res.json({ success: true });
});

// Update user smart-reminders toggle preference
app.post('/api/smart-reminders', async (req, res) => {
  const { userId, enabled } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    await updateUserDoc(userId, {
      smartReminders: !!enabled
    });
    res.json({ success: true, enabled: !!enabled });
  } catch (err: any) {
    console.error('Failed to update smart reminders preference:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sync user tasks for push notifications
app.post('/api/sync-tasks', async (req, res) => {
  const { userId, tasks } = req.body;
  if (!userId || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Missing userId or tasks data' });
  }

  try {
    const allTasks = loadTasks();
    allTasks[userId] = tasks;
    saveTasks(allTasks);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to sync tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sync user notification preferences
app.post('/api/notification-settings', async (req, res) => {
  const { userId, settings, timezone, fcmToken } = req.body;
  if (!userId || !settings) {
    return res.status(400).json({ error: 'Missing userId or settings' });
  }

  try {
    const updateData: any = {
      notificationSettings: settings,
    };
    if (timezone) {
      updateData.timezone = timezone;
    }
    if (fcmToken) {
      updateData.fcmToken = fcmToken;
    }
    await updateUserDoc(userId, updateData);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to save notification settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user account data completely from local JSON files and Firestore
app.post('/api/delete-account', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    // 1. Delete user from tasks.json
    const allTasks = loadTasks();
    if (allTasks[userId]) {
      delete allTasks[userId];
      saveTasks(allTasks);
    }

    // 2. Delete user document from local fallback and Firestore
    await deleteUserDoc(userId);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete user account data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Track already notified tasks to avoid duplicates within the hour
const sentNotifications = new Set<string>();

// Helper to clear notifications older than 2 hours to save memory
setInterval(() => {
  sentNotifications.clear();
  console.log('Cleared sent notifications cache.');
}, 2 * 60 * 60 * 1000);

// Notification background engine (runs every minute)
async function checkAndSendNotifications() {
  try {
    const allTasks = loadTasks();

    // Query users with an fcmToken (using Firestore with a local users.json fallback)
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

      // 1. Calculate local date, hour, and minutes for the user's timezone
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

      // Check quiet hours
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

      // Check morning and evening summaries
      const [mH, mM] = settings.morningSummaryTime.split(':').map(Number);
      const [eH, eM] = settings.eveningSummaryTime.split(':').map(Number);

      // Daily Morning Summary
      if (settings.morningSummaryEnabled && localHour === mH && localMinute === mM) {
        const morningKey = `morning_push_${userId}_${localDateStr}`;
        if (!sentNotifications.has(morningKey)) {
          const userTasksList = allTasks[userId] || [];
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

      // Daily Evening Summary
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

      // Check all tasks for this user
      const userTasksList = allTasks[userId] || [];
      const activeTasks = userTasksList.filter((task: any) => task.notifyEnabled === true);

      if (activeTasks.length === 0) continue;

      const segments = getTaskSegmentsForDate(activeTasks as Task[], localDateStr);
      for (const segment of segments) {
        const { task, startHour: segStart } = segment;

        // Start time check
        const targetStartMinutes = segStart * 60;
        const currentLocalMinutes = localHour * 60 + localMinute;
        const diffMinutes = targetStartMinutes - currentLocalMinutes;

        // Upcoming task: 15 minutes before
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

        // Upcoming task: 5 minutes before
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

        // Exact start time notification
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

// Check every 60 seconds
setInterval(checkAndSendNotifications, 60 * 1000);

// Vite middleware setup or production static files serving
async function startServer() {
  await initFirestoreAvailabilityCheck();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
