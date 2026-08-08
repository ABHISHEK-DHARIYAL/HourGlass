// Purpose: IndexedDB local persistence engine managing offline collection caches and pending sync queues with strict multi-user UID isolation
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'HourglassOfflineDB';
const DB_VERSION = 1;

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
  'sync_queue'
];

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

export async function addToQueue(item: SyncQueueItem): Promise<void> {
  await putToStore('sync_queue', item, item.userId);
}

export async function getQueue(userId?: string): Promise<SyncQueueItem[]> {
  const items = await getAllFromStore<SyncQueueItem>('sync_queue', userId);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeFromQueue(id: string): Promise<void> {
  await deleteFromStore('sync_queue', id);
}

export async function clearAllOfflineStores(): Promise<void> {
  for (const storeName of STORES) {
    try {
      await clearStore(storeName);
    } catch (e) {
      console.warn(`Failed to clear offline store ${storeName}:`, e);
    }
  }
}

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
