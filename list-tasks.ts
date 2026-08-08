/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

// Initialize with project ID from config
const app = initializeApp({
  projectId: firebaseConfigJson.projectId
});

const db = getFirestore(app);

async function listAllTasks() {
  console.log('Fetching tasks from Firestore for project:', firebaseConfigJson.projectId);
  try {
    const collections = ['tasks', 'exceptions', 'completions', 'mustdos', 'templates', 'todos', 'day_reflections', 'daily_goals', 'habits', 'habit_history', 'categories'];
    for (const colName of collections) {
      console.log(`\n--- Collection: ${colName} ---`);
      const ref = db.collection(colName);
      const snapshot = await ref.get();
      console.log(`Count: ${snapshot.size}`);
      snapshot.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log('Data:', doc.data());
      });
    }
  } catch (err) {
    console.error('Failed to list tasks:', err);
  }
}

listAllTasks();
