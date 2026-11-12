// Purpose: Cloud Functions entry point. Replaces the old Railway/Express
// backend (backend/server.ts) with Firebase-native infrastructure:
//   - onRequest HTTP functions for each /api/* route, exposed at the same
//     paths via Firebase Hosting rewrites (see ../firebase.json), so the
//     frontend's existing fetch('/api/...') calls needed no changes.
//   - onSchedule for the notification scheduler, replacing the old
//     setInterval(checkAndSendNotifications, 60 * 1000).
//
// The Admin SDK authenticates automatically in this environment — no
// service account file or env var needed, unlike the old Railway backend.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

import {
  getDb,
  updateUserDoc,
  deleteUserDoc,
  disassociateFcmTokenFromOtherUsers,
  clearUserFcmToken
} from './db';
import { INSPIRATIONAL_QUOTES, checkAndSendNotifications } from './notifications';
import { handleCoach } from './coach/coach';
import { sendDailyDigests } from './coach/email';

initializeApp();

// Every HTTP function below runs in the same region; keep them together so
// Hosting rewrites (see firebase.json) stay simple and predictable.
const REGION = 'us-central1';

// GET /api/quote — daily or random inspirational quote, sourced from the
// Quotable API (api.quotable.io) instead of the fixed local list. The
// fixed INSPIRATIONAL_QUOTES array is kept as an offline fallback only,
// used if Quotable is ever unreachable, so /api/quote never hard-fails.

// Deterministic same-quote-all-day fallback: hashes today's date string to
// always pick the same index into the local list for a given calendar day.
function localFallbackQuote(dateStr: string) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const quoteIndex = Math.abs(hash) % INSPIRATIONAL_QUOTES.length;
  return INSPIRATIONAL_QUOTES[quoteIndex];
}

// Fetches one random quote directly from Quotable, mapping its
// `content` field to `text` so the response shape matches what the
// frontend has always expected.
async function fetchQuotableRandom(): Promise<{ text: string; author: string }> {
  const res = await fetch('https://api.quotable.io/random');
  if (!res.ok) {
    throw new Error(`Quotable request failed with status ${res.status}`);
  }
  const data: any = await res.json();
  if (!data?.content || !data?.author) {
    throw new Error('Quotable response missing content/author');
  }
  return { text: data.content, author: data.author };
}

// Same quote for every user on a given calendar day, cached in Firestore so
// only one Quotable request is made per day (not one per page load).
async function getDailyQuote(dateStr: string): Promise<{ text: string; author: string }> {
  const db = getDb();
  const docRef = db.collection('system').doc('dailyQuote');
  const snap = await docRef.get();
  const cached = snap.data();
  if (cached && cached.date === dateStr && cached.text && cached.author) {
    return { text: cached.text, author: cached.author };
  }

  const fresh = await fetchQuotableRandom();
  await docRef.set({ date: dateStr, text: fresh.text, author: fresh.author }, { merge: true });
  return fresh;
}

export const quote = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const isRandom = req.query.random === 'true';
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    if (isRandom) {
      const q = await fetchQuotableRandom();
      res.json(q);
      return;
    }
    const q = await getDailyQuote(dateStr);
    res.json(q);
  } catch (err) {
    logger.error('Quotable fetch failed, using local fallback quote:', err);
    res.json(isRandom
      ? INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]
      : localFallbackQuote(dateStr)
    );
  }
});

// POST /api/debug-log — client-side debug log line. Cloud Functions have no
// persistent filesystem to append a log file to (and the old Railway
// container's debug-logs.txt wasn't durable either); this now writes to
// Cloud Logging instead, which is the equivalent durable, searchable store
// in this environment. View it with `firebase functions:log` or in the
// Google Cloud Console's Logs Explorer.
export const debugLog = onRequest({ region: REGION, cors: true }, (req, res) => {
  const { message, level, timestamp } = req.body || {};
  const logLine = `[${timestamp || new Date().toISOString()}] ${message}`;
  if (level === 'ERROR') {
    logger.error(logLine);
  } else if (level === 'WARN') {
    logger.warn(logLine);
  } else {
    logger.info(logLine);
  }
  res.json({ success: true });
});

// POST /api/smart-reminders — update the user's smart-reminders toggle.
export const smartReminders = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const { userId, enabled } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'Missing userId' });
    return;
  }
  try {
    await updateUserDoc(userId, { smartReminders: !!enabled });
    res.json({ success: true, enabled: !!enabled });
  } catch (err: any) {
    logger.error('Failed to update smart reminders preference:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync-tasks — retained for API compatibility with any external
// caller, though the frontend never calls this endpoint (the scheduler
// reads tasks straight from Firestore via loadTasksForUser). Since Cloud
// Functions have no persistent local cache to write to, and none is
// needed, this simply acknowledges the request.
export const syncTasks = onRequest({ region: REGION, cors: true }, (req, res) => {
  const { userId, tasks } = req.body || {};
  if (!userId || !Array.isArray(tasks)) {
    res.status(400).json({ error: 'Missing userId or tasks data' });
    return;
  }
  res.json({ success: true });
});

// POST /api/notification-settings — save FCM token + notification prefs.
export const notificationSettings = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const { userId, settings, timezone, fcmToken } = req.body || {};
  if (!userId || !settings) {
    res.status(400).json({ error: 'Missing userId or settings' });
    return;
  }

  try {
    if (fcmToken) {
      await disassociateFcmTokenFromOtherUsers(userId, fcmToken);
    }

    const updateData: any = { notificationSettings: settings };
    if (timezone) updateData.timezone = timezone;
    if (fcmToken) updateData.fcmToken = fcmToken;

    await updateUserDoc(userId, updateData);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to save notification settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clear-fcm-token — clear FCM token for account isolation on sign out.
export const clearFcmToken = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'Missing userId' });
    return;
  }
  try {
    await clearUserFcmToken(userId);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to clear FCM token:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delete-account — permanently delete a user's Firestore data and
// Firebase Auth account. Deletes the same set of subcollections as before.
export const deleteAccount = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'Missing userId' });
    return;
  }

  try {
    logger.info(`[deleteAccount] Initiating deletion for user: ${userId}`);

    await deleteUserDoc(userId);

    const db = getDb();
    const collectionsToDelete = [
      'tasks',
      'exceptions',
      'completions',
      'mustdos',
      'templates',
      'todos',
      'day_reflections',
      'daily_goals',
      'subscriptions',
      'categories',
      'habits',
      'habit_history',
      'notes',
      'coach_courses',
      'coach_notes',
      'coach_attempts',
      'coach_usage'
    ];

    for (const colName of collectionsToDelete) {
      try {
        const snapshot = await db.collection('users').doc(userId).collection(colName).get();
        if (!snapshot.empty) {
          logger.info(`[deleteAccount] Deleting ${snapshot.size} docs from "${colName}" for user ${userId}`);
          const batch = db.batch();
          snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      } catch (colErr: any) {
        logger.error(`[deleteAccount] Error deleting subcollection "${colName}":`, colErr.message || colErr);
      }
    }

    try {
      await getAuth().deleteUser(userId);
      logger.info(`[deleteAccount] Auth user ${userId} deleted`);
    } catch (authErr: any) {
      logger.warn(`[deleteAccount] Auth deletion note for user ${userId}:`, authErr.message || authErr);
    }

    res.json({ success: true, message: 'Account and all data permanently deleted' });
  } catch (err: any) {
    logger.error('Failed to delete user account data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Scheduled reminder check — replaces the old setInterval(..., 60 * 1000).
export const scheduledNotifications = onSchedule(
  { schedule: 'every 1 minutes', region: REGION, timeoutSeconds: 120 },
  async () => {
    try {
      await checkAndSendNotifications();
    } catch (err) {
      logger.error('checkAndSendNotifications failed:', err);
    }
  }
);

// POST /api/coach/<roadmap|notes|quiz|chat|email-schedule> — AI Coach (Gemini + SMTP).
// Hosting caps rewritten requests at 60s, so keep the function timeout at or under that.
export const coachApi = onRequest(
  { region: REGION, cors: true, timeoutSeconds: 60, memory: '512MiB' },
  handleCoach
);

// Hourly: email opted-in users their lessons for today at their chosen local hour.
export const scheduledCoachEmails = onSchedule(
  { schedule: 'every 60 minutes', region: REGION, timeoutSeconds: 300 },
  async () => {
    try {
      await sendDailyDigests();
    } catch (err) {
      logger.error('sendDailyDigests failed:', err);
    }
  }
);
