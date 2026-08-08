// Purpose: Express backend server entry point and API route handlers

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getAuth } from 'firebase-admin/auth';
import {
  isFirestoreAvailable,
  initFirestoreAvailabilityCheck,
  getDb,
  loadTasks,
  saveTasks,
  updateUserDoc,
  deleteUserDoc,
  disassociateFcmTokenFromOtherUsers,
  clearUserFcmToken
} from './db';
import {
  INSPIRATIONAL_QUOTES,
  checkAndSendNotifications
} from './notifications';

const app = express();
app.use(express.json());

// Railway assigns the port dynamically via $PORT; 3000 remains the local dev fallback.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Fetch inspiring daily quote or random quote endpoint
app.get('/api/quote', (req, res) => {
  const isRandom = req.query.random === 'true';
  if (isRandom) {
    const randomIndex = Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length);
    return res.json(INSPIRATIONAL_QUOTES[randomIndex]);
  }

  // Seeded daily quote based on date string so it remains consistent across devices on the same day
  const dateStr = new Date().toISOString().split('T')[0];
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const quoteIndex = Math.abs(hash) % INSPIRATIONAL_QUOTES.length;
  res.json(INSPIRATIONAL_QUOTES[quoteIndex]);
});

const DEBUG_LOGS_FILE = path.join(process.cwd(), 'debug-logs.txt');

app.post('/api/debug-log', (req, res) => {
  const { message, level, timestamp } = req.body;
  const logLine = `[${timestamp || new Date().toISOString()}] [${level || 'INFO'}] ${message}\n`;
  try {
    fs.appendFileSync(DEBUG_LOGS_FILE, logLine, 'utf-8');
    if (level === 'ERROR') {
      console.error(logLine.trim());
    } else if (level === 'WARN') {
      console.warn(logLine.trim());
    }
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
    if (fcmToken) {
      await disassociateFcmTokenFromOtherUsers(userId, fcmToken);
    }

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

// Clear FCM token for account isolation on sign out
app.post('/api/clear-fcm-token', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    await clearUserFcmToken(userId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to clear FCM token:', err);
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
    console.log(`[API /api/delete-account] Initiating backend deletion for user: ${userId}`);

    const allTasks = loadTasks();
    if (allTasks[userId]) {
      delete allTasks[userId];
      saveTasks(allTasks);
      console.log(`[API /api/delete-account] Removed user ${userId} from tasks.json`);
    }

    await deleteUserDoc(userId);

    if (isFirestoreAvailable) {
      const db = getDb();
      if (db) {
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
          'habit_history'
        ];

        for (const colName of collectionsToDelete) {
          try {
            const snapshot = await db.collection('users').doc(userId).collection(colName).get();
            if (!snapshot.empty) {
              console.log(`[API /api/delete-account] Deleting ${snapshot.size} docs from user subcollection "${colName}" for user ${userId}`);
              const batch = db.batch();
              snapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();
            }
          } catch (colErr: any) {
            console.error(`[API /api/delete-account] Error deleting user subcollection "${colName}":`, colErr.message || colErr);
          }
        }
      }
    }

    try {
      const authAdmin = getAuth();
      await authAdmin.deleteUser(userId);
      console.log(`[API /api/delete-account] Admin Auth successfully deleted user ${userId}`);
    } catch (authErr: any) {
      console.warn(`[API /api/delete-account] Admin Auth note for user ${userId}:`, authErr.message || authErr);
    }

    res.json({ success: true, message: 'Account and all data permanently deleted' });
  } catch (err: any) {
    console.error('Failed to delete user account data:', err);
    res.status(500).json({ error: err.message });
  }
});

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
