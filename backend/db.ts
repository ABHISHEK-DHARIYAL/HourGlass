// Purpose: Firebase Admin and local JSON storage database management for the backend server

import path from 'path';
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// DATA_DIR lets a Railway Volume (or any persistent mount) hold the local
// JSON cache instead of the container's ephemeral filesystem. Defaults to
// process.cwd() so local/dev behavior is completely unchanged if unset.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');

let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

export let isFirestoreAvailable = false;

// Resolve the Firebase Admin service account credential.
// Priority: FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON
// env vars (used on Railway, since committing serviceAccount.json to git is
// unsafe), then the existing local serviceAccount.json file (unchanged
// behavior for local/AI Studio environments that already have that file).
function loadServiceAccountFromEnv(): any | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', err);
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err);
    }
  }
  return null;
}

const serviceAccountPath = path.join(process.cwd(), 'serviceAccount.json');
const envServiceAccount = loadServiceAccountFromEnv();

if (envServiceAccount) {
  try {
    initializeApp({
      credential: cert(envServiceAccount)
    });
    console.log('Firebase Admin initialized successfully using service account from environment variable');
    isFirestoreAvailable = true;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin with env service account:', err);
  }
} else if (fs.existsSync(serviceAccountPath)) {
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

export function getDb() {
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

export async function initFirestoreAvailabilityCheck() {
  try {
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
    console.log(`[Firebase Admin] Firestore connection check note: ${err.message || err}.`);
    isFirestoreAvailable = false;
  }
}

export function loadTasks(): Record<string, any[]> {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading tasks:', err);
  }
  return {};
}

export function saveTasks(tasks: Record<string, any[]>) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error saving tasks:', err);
  }
}

// Reads a single user's tasks, preferring live Firestore data (the same
// /users/{userId}/tasks collection the frontend already writes to) and
// falling back to the local JSON cache populated by /api/sync-tasks.
// This does NOT change the Firestore structure — it only reads the
// existing 'tasks' subcollection already defined in firebase-blueprint.json.
export async function loadTasksForUser(userId: string): Promise<any[]> {
  if (isFirestoreAvailable) {
    try {
      const db = getDb();
      if (db) {
        const snapshot = await db.collection('users').doc(userId).collection('tasks').get();
        if (!snapshot.empty) {
          return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
      }
    } catch (err: any) {
      console.log(`[Firestore Fallback] loadTasksForUser failed for user ${userId}, using local cache (${err.message || err}).`);
    }
  }

  const allTasks = loadTasks();
  return allTasks[userId] || [];
}

export function loadUsers(): Record<string, any> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
  return {};
}

export function saveUsers(users: Record<string, any>) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

export interface UserRecord {
  id: string;
  fcmToken?: string;
  timezone?: string;
  notificationSettings?: any;
  smartReminders?: boolean;
}

export async function updateUserDoc(userId: string, data: any, merge = true) {
  if (isFirestoreAvailable) {
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(userId).set(data, { merge });
        console.log(`Successfully synced user ${userId} to Firestore`);
      }
    } catch (err: any) {
      console.log(`[Firestore Fallback] updateUserDoc failed for user ${userId}, using local cache (${err.message || err}).`);
    }
  }

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

export async function deleteUserDoc(userId: string) {
  if (isFirestoreAvailable) {
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(userId).delete();
        console.log(`Successfully deleted user ${userId} from Firestore`);
      }
    } catch (err: any) {
      console.log(`[Firestore Fallback] deleteUserDoc failed for user ${userId}, using local cache (${err.message || err}).`);
    }
  }

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

export async function disassociateFcmTokenFromOtherUsers(currentUserId: string, fcmToken: string) {
  if (!fcmToken || !currentUserId) return;

  if (isFirestoreAvailable) {
    try {
      const db = getDb();
      if (db) {
        const snapshot = await db.collection('users').where('fcmToken', '==', fcmToken).get();
        if (!snapshot.empty) {
          const batch = db.batch();
          let count = 0;
          for (const docSnap of snapshot.docs) {
            if (docSnap.id !== currentUserId) {
              batch.update(docSnap.ref, { fcmToken: '' });
              count++;
            }
          }
          if (count > 0) {
            await batch.commit();
            console.log(`Disassociated FCM token from ${count} previous user(s) in Firestore`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Failed to disassociate FCM token in Firestore:', err.message || err);
    }
  }

  try {
    const users = loadUsers();
    let updated = false;
    for (const [uId, userData] of Object.entries(users)) {
      if (uId !== currentUserId && userData && (userData as any).fcmToken === fcmToken) {
        (users[uId] as any).fcmToken = '';
        updated = true;
      }
    }
    if (updated) {
      saveUsers(users);
      console.log(`Disassociated FCM token from previous user(s) in local users.json`);
    }
  } catch (err) {
    console.error('Failed to disassociate FCM token in local users fallback:', err);
  }
}

export async function clearUserFcmToken(userId: string) {
  if (!userId) return;
  await updateUserDoc(userId, { fcmToken: '' });
}

export async function getAllUsersWithTokens(): Promise<UserRecord[]> {
  const usersList: UserRecord[] = [];
  const visitedIds = new Set<string>();

  if (isFirestoreAvailable) {
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
  }

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
