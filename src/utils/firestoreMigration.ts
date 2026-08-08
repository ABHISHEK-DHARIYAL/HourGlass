// Purpose: Migration utilities for transferring local guest/IndexedDB data into user's Firestore collections

import { db, collection, doc, setDoc } from '../firebase';
import { getAllFromStore } from './offlineStore';

export async function migrateLocalDataToFirestore(uid: string): Promise<void> {
  // Strict UID ownership: Do not automatically import guest or local storage data into authenticated user accounts.
  return;
}
