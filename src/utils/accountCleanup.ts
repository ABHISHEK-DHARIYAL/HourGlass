// Purpose: Helper utilities for deleting user data collections and performing account cleanup

import { User } from 'firebase/auth';
import { db, firebaseSignOut, auth } from '../firebase';
import { collection, getDocs, deleteDoc, writeBatch, doc } from 'firebase/firestore';
import { clearAllOfflineStores } from './offlineStore';

// Deletes every document in every user-owned Firestore subcollection
// (tasks, exceptions, completions, mustdos, templates, todos, day
// reflections, daily goals, subscriptions, categories, habits, habit
// history) plus the user's own top-level profile doc. Batches deletes in
// chunks of 400 to stay under Firestore's per-batch write limit. Called
// during account deletion — see SettingsView.tsx's handleDeleteAccount.
export async function deleteUserDataCollections(userId: string): Promise<void> {
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
    'notes'
  ];

  for (const colName of collectionsToDelete) {
    try {
      const colRef = collection(db, 'users', userId, colName);
      while (true) {
        const querySnapshot = await getDocs(colRef);
        if (querySnapshot.empty) break;

        const batch = writeBatch(db);
        const chunk = querySnapshot.docs.slice(0, 400);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();

        if (querySnapshot.size <= 400) break;
      }
    } catch (colErr: any) {
      console.error(`Error deleting documents from subcollection "${colName}":`, colErr);
    }
  }

  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('Failed to delete user profile document:', err);
  }
}

// Wipes everything the browser has cached locally for this app:
// localStorage, sessionStorage, registered service workers, the entire
// offline IndexedDB database, and the Cache Storage API — so no trace of
// a deleted account's data can resurface after logout/reload.
export async function clearLocalBrowserStorage(): Promise<void> {
  localStorage.clear();
  sessionStorage.clear();

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    } catch (swErr) {
      console.warn('Service worker unregistration note:', swErr);
    }
  }

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('HourglassOfflineDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (e) {
      console.warn(e);
    }
  }
}
