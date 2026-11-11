// Purpose: Firestore data-access helpers for the Cloud Functions backend.
//
// Unlike the old Railway/Express backend, Cloud Functions have no
// persistent filesystem to fall back on, and don't need one: they run
// inside the same Firebase project, so the Admin SDK authenticates
// automatically via the function's built-in service account (no
// serviceAccount.json or FIREBASE_SERVICE_ACCOUNT_* env var required).
// Firestore is always available here, so all local-JSON-cache fallback
// logic from the old backend/db.ts has been dropped as unnecessary.

import { getFirestore } from 'firebase-admin/firestore';

// Returns the Admin SDK Firestore instance for the default database.
export function getDb() {
  return getFirestore();
}

export interface UserRecord {
  id: string;
  fcmToken?: string;
  timezone?: string;
  notificationSettings?: any;
  smartReminders?: boolean;
  notifiedKeys?: Record<string, number>;
}

// Writes (or merges into) a user's top-level Firestore doc — used for
// storing FCM tokens, notification settings, timezone, and smart-reminder
// preferences.
export async function updateUserDoc(userId: string, data: any, merge = true): Promise<void> {
  const db = getDb();
  await db.collection('users').doc(userId).set(data, { merge });
}

// Deletes a user's top-level Firestore doc (part of account deletion).
export async function deleteUserDoc(userId: string): Promise<void> {
  const db = getDb();
  await db.collection('users').doc(userId).delete();
}

// If the same device's FCM token was previously registered to a different
// account (e.g. after switching Google accounts on one device), strips it
// from every other user so notifications only go to the current owner.
export async function disassociateFcmTokenFromOtherUsers(currentUserId: string, fcmToken: string): Promise<void> {
  if (!fcmToken || !currentUserId) return;
  const db = getDb();
  const snapshot = await db.collection('users').where('fcmToken', '==', fcmToken).get();
  if (snapshot.empty) return;

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
  }
}

// Clears a single user's stored FCM token, e.g. on sign-out, so a signed-
// out device stops receiving that account's push notifications.
export async function clearUserFcmToken(userId: string): Promise<void> {
  if (!userId) return;
  await updateUserDoc(userId, { fcmToken: '' });
}

// Fetches every user document that has a registered FCM token — the pool
// of users the scheduled notification check needs to evaluate each minute.
export async function getAllUsersWithTokens(): Promise<UserRecord[]> {
  const db = getDb();
  const snapshot = await db.collection('users').get();
  const usersList: UserRecord[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.fcmToken) {
      usersList.push({ id: docSnap.id, ...data } as UserRecord);
    }
  }
  return usersList;
}

// Reads a single user's tasks directly from the same /users/{userId}/tasks
// collection the frontend already writes to. No data duplication, no
// Firestore structure change — just a read of the existing collection.
export async function loadTasksForUser(userId: string): Promise<any[]> {
  const db = getDb();
  const snapshot = await db.collection('users').doc(userId).collection('tasks').get();
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

// --- Persistent notification de-duplication ---
//
// The old Railway backend de-duplicated notifications with an in-memory
// Set, which worked because it ran as one long-lived process. Cloud
// Functions scheduled invocations are not guaranteed to reuse the same
// warm instance, so an in-memory Set can't be trusted here — it would
// risk re-sending the same reminder on a cold start. Instead we persist
// sent-notification keys on the user's own Firestore document (small map,
// pruned of anything older than 3 hours on every write) so de-duplication
// survives across invocations and instances.
const DEDUPE_TTL_MS = 3 * 60 * 60 * 1000;

// Checks whether a specific reminder (identified by a unique key such as
// `push_upcoming_15_<uid>_<taskId>_<date>`) has already been sent today.
export async function hasNotificationBeenSent(userId: string, key: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection('users').doc(userId).get();
  const notifiedKeys = (snap.data()?.notifiedKeys || {}) as Record<string, number>;
  return typeof notifiedKeys[key] === 'number';
}

// Records that a reminder was sent (so it isn't sent again this cycle),
// and prunes any keys older than DEDUPE_TTL_MS to keep the map small.
export async function markNotificationSent(userId: string, key: string): Promise<void> {
  const db = getDb();
  const userRef = db.collection('users').doc(userId);
  const snap = await userRef.get();
  const notifiedKeys = (snap.data()?.notifiedKeys || {}) as Record<string, number>;

  const now = Date.now();
  notifiedKeys[key] = now;

  // Prune stale keys so this map never grows unbounded.
  for (const k of Object.keys(notifiedKeys)) {
    if (now - notifiedKeys[k] > DEDUPE_TTL_MS) {
      delete notifiedKeys[k];
    }
  }

  await userRef.set({ notifiedKeys }, { merge: true });
}
