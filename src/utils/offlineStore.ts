// Purpose: IndexedDB local persistence engine managing offline collection caches and pending sync queues with strict multi-user UID isolation
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'HourglassOfflineDB';
const DB_VERSION = 2;

export interface SyncQueueItem {
  id: string; // generated queue id
  userId: string;
  collectionName: string;
  action: 'set' | 'delete';
  itemId: string;
  data?: any;
  timestamp: number;
}

const STORES = [
  'tasks',
  'exceptions',
  'completions',
  'mustdos',
  'templates',
  'todos',
  'day_reflections',
  'daily_goals',
  'habits',
  'habit_history',
  'categories',
  'notes',
  'sync_queue'
];

// Opens (creating on first run) the app's IndexedDB database and ensures
// every object store listed in STORES exists.
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });
}

// Reads every record from a store, filtered to one user's data. Safe by
// default: if userId is omitted, returns an empty array rather than every
// user's cached data, so a missing UID can never leak data across accounts.
export async function getAllFromStore<T>(storeName: string, userId?: string): Promise<T[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as T[];
      if (userId) {
        if (userId === 'guest_user') {
          resolve(results.filter((item: any) => item && (item.userId === 'guest_user' || !item.userId)));
        } else {
          resolve(results.filter((item: any) => item && item.userId === userId));
        }
      } else {
        // Never load unscoped records
        resolve([]);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Writes (inserts or updates) a single record into a store, stamping it
// with the given userId so later reads can be filtered correctly.
export async function putToStore<T extends { id: string; userId?: string }>(storeName: string, item: T, userId?: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Deep clone to avoid issues with non-cloneable objects
    const cloned = JSON.parse(JSON.stringify(item));
    if (userId && !cloned.userId) {
      cloned.userId = userId;
    }
    const request = store.put(cloned);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Removes a single record from a store by id.
export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Empties every record out of a single store.
export async function clearStore(storeName: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Adds a pending write to the offline sync queue, to be flushed to
// Firestore once connectivity returns (see offlineSyncManager.ts).
export async function addToQueue(item: SyncQueueItem): Promise<void> {
  await putToStore('sync_queue', item, item.userId);
}

// Reads all pending sync-queue items for one user (see the safe-by-default
// note on getAllFromStore above — same UID-scoping applies here).
export async function getQueue(userId?: string): Promise<SyncQueueItem[]> {
  const items = await getAllFromStore<SyncQueueItem>('sync_queue', userId);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

// Removes one item from the sync queue once it's been successfully
// written to Firestore.
export async function removeFromQueue(id: string): Promise<void> {
  await deleteFromStore('sync_queue', id);
}

// Empties every store in the database — used during full account
// deletion/sign-out cleanup, not scoped to a single user.
export async function clearAllOfflineStores(): Promise<void> {
  for (const storeName of STORES) {
    try {
      await clearStore(storeName);
    } catch (e) {
      console.warn(`Failed to clear offline store ${storeName}:`, e);
    }
  }
}

// Removes only one user's records from every store, leaving any other
// cached account's data untouched — used when switching accounts without a
// full app reload.
export async function clearUserDataFromIndexedDB(userId: string): Promise<void> {
  if (!userId) return;
  for (const storeName of STORES) {
    try {
      const items = await getAllFromStore<any>(storeName, userId);
      for (const item of items) {
        if (item && item.id) {
          await deleteFromStore(storeName, item.id);
        }
      }
    } catch (e) {
      console.warn(`Failed clearing user ${userId} data from store ${storeName}:`, e);
    }
  }
}
