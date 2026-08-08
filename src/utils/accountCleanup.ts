// Purpose: Helper utilities for deleting user data collections and performing account cleanup

import { User } from 'firebase/auth';
import { db, firebaseSignOut, auth } from '../firebase';
import { collection, getDocs, deleteDoc, writeBatch, doc } from 'firebase/firestore';
import { clearAllOfflineStores } from './offlineStore';

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
    'habit_history'
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
