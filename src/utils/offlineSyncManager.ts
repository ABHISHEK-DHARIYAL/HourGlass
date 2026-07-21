/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, doc, setDoc, deleteDoc, auth, onAuthStateChanged } from '../firebase';
import { 
  getQueue, 
  removeFromQueue, 
  addToQueue, 
  putToStore, 
  deleteFromStore, 
  SyncQueueItem 
} from './offlineStore';
import { logDebug } from './debugLogger';

export type SyncStatus = 'Offline' | 'Syncing' | 'Synced' | 'Sync Failed';

let isSyncing = false;
let currentSyncStatus: SyncStatus = 'Synced';
const statusListeners = new Set<(status: SyncStatus) => void>();

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function updateSyncStatus(newStatus: SyncStatus) {
  currentSyncStatus = newStatus;
  statusListeners.forEach((listener) => listener(currentSyncStatus));
}

export function getSyncStatus(): SyncStatus {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Offline';
  }
  return currentSyncStatus;
}

/**
 * Dedupes and queues an operation in IndexedDB sync queue, then attempts sync
 */
export async function queueOfflineWrite(
  userId: string,
  collectionName: string,
  itemId: string,
  action: 'set' | 'delete',
  data?: any
): Promise<void> {
  logDebug(`[queueOfflineWrite] ENTER. collectionName="${collectionName}", itemId="${itemId}", action="${action}", userId="${userId}"`);

  // 1. Instantly write or delete from the local IndexedDB collection
  if (action === 'set') {
    await putToStore(collectionName, { id: itemId, ...data });
    logDebug(`[queueOfflineWrite] Local IndexedDB putToStore complete. collectionName="${collectionName}", itemId="${itemId}"`);
  } else {
    await deleteFromStore(collectionName, itemId);
    logDebug(`[queueOfflineWrite] Local IndexedDB deleteFromStore complete. collectionName="${collectionName}", itemId="${itemId}"`);
  }

  // 2. Guest user doesn't sync with Firestore
  if (userId === 'guest_user' || !userId) {
    logDebug(`[queueOfflineWrite] Guest or undefined user, skipping Firestore sync: userId="${userId}"`);
    return;
  }

  // 3. Queue mutation for remote Firestore sync
  const queue = await getQueue();
  
  // Find and delete any existing duplicate operations for the same item in this collection
  const duplicates = queue.filter(
    (item) => item.collectionName === collectionName && item.itemId === itemId
  );

  for (const dup of duplicates) {
    logDebug(`[queueOfflineWrite] Removing duplicate queue item: id="${dup.id}"`);
    await removeFromQueue(dup.id);
  }

  // If the item was created offline (has a set action) and we are now deleting it,
  // we do not need to perform any sync action remotely.
  const wasCreatedOffline = duplicates.some(dup => dup.action === 'set');
  if (action === 'delete' && wasCreatedOffline) {
    logDebug('[queueOfflineWrite] Item was created offline and immediately deleted. Skipping Firestore sync queue.');
    return;
  }

  const queueId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queueItem: SyncQueueItem = {
    id: queueId,
    userId,
    collectionName,
    action,
    itemId,
    data,
    timestamp: Date.now()
  };

  await addToQueue(queueItem);
  logDebug(`[queueOfflineWrite] Enqueued sync item queueId="${queueId}": action="${action}", itemId="${itemId}"`);

  // 4. Trigger Firestore sync
  triggerSync();
}

/**
 * Process the local IndexedDB sync queue and push mutations to Firestore
 */
export async function triggerSync(): Promise<void> {
  if (isSyncing) {
    logDebug('[triggerSync] triggerSync called but a sync session is already in progress.');
    return;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    logDebug('[triggerSync] Skip sync: No authenticated user.');
    return;
  }

  isSyncing = true;
  updateSyncStatus('Syncing');
  logDebug('[triggerSync] Starting Firestore synchronization sync_queue loop...');

  try {
    let queue = await getQueue();
    logDebug(`[triggerSync] Initial queue fetched: ${queue.length} items`);
    if (queue.length > 0) {
      logDebug(`[triggerSync] Queue contents: ${JSON.stringify(queue.map(q => ({ id: q.id, userId: q.userId, collection: q.collectionName, itemId: q.itemId, action: q.action })))}`);
    }

    while (queue.length > 0) {
      const userItems = queue.filter(item => item.userId === currentUser.uid);
      if (userItems.length === 0) {
        logDebug('[triggerSync] No items in queue belong to the current authenticated user. Breaking loop.');
        break;
      }

      for (const item of userItems) {
        const docRef = doc(db, item.collectionName, item.itemId);
        logDebug(`[triggerSync] Processing item: queueId="${item.id}", collection="${item.collectionName}", itemId="${item.itemId}", action="${item.action}"`);
        
        try {
          if (item.action === 'set') {
            logDebug(`[triggerSync] [CREATE_OR_UPDATE] Firestore setDoc initiating: path="${item.collectionName}/${item.itemId}" data=${JSON.stringify(item.data)}`);
            await setDoc(docRef, item.data, { merge: true });
            logDebug(`[triggerSync] [CREATE_OR_UPDATE] Firestore setDoc succeeded: path="${item.collectionName}/${item.itemId}"`);
          } else if (item.action === 'delete') {
            logDebug(`[triggerSync] [DELETE] Firestore deleteDoc initiating: path="${item.collectionName}/${item.itemId}"`);
            await deleteDoc(docRef);
            logDebug(`[triggerSync] [DELETE] Firestore deleteDoc succeeded: path="${item.collectionName}/${item.itemId}"`);
          }
          
          // Successfully synced this item, remove from queue
          await removeFromQueue(item.id);
          logDebug(`[triggerSync] Removed item from sync queue: queueId="${item.id}"`);
        } catch (itemErr: any) {
          logDebug(`[triggerSync] [ERROR] Sync failed for item queueId="${item.id}": ${itemErr?.message || itemErr}`, 'ERROR');
          throw itemErr;
        }
      }
      
      // Fetch queue again to handle any items enqueued while we were writing to firestore
      queue = await getQueue();
      if (queue.length > 0) {
        logDebug(`[triggerSync] Found ${queue.length} newly enqueued items during previous batch. Continuing loop...`);
      }
    }
    
    logDebug('[triggerSync] Firestore synchronization loop complete. Queue is empty.');
    updateSyncStatus('Synced');
  } catch (err: any) {
    logDebug(`[triggerSync] [ERROR] Overall sync process failed with error: ${err?.message || err}`, 'ERROR');
    updateSyncStatus('Sync Failed');
  } finally {
    isSyncing = false;
  }
}

// Automatically retry failed syncs when connection changes, auth state changes, or periodically
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    triggerSync();
  });
  window.addEventListener('offline', () => {
    updateSyncStatus('Offline');
  });

  // Automatically trigger sync when auth user loads/changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      logDebug(`[offlineSyncManager] Auth state changed: user is logged in (uid="${user.uid}"). Triggering sync...`);
      triggerSync();
    }
  });

  // Run initial sync check
  setTimeout(() => {
    triggerSync();
  }, 3000);

  // Periodically retry failed syncs if online
  setInterval(() => {
    if (navigator.onLine && (currentSyncStatus === 'Sync Failed' || currentSyncStatus === 'Offline')) {
      triggerSync();
    }
  }, 15000);
}
