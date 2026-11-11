/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || firebaseConfigJson.projectId
};

console.log('Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log('Signing in anonymously...');
  try {
    const cred = await signInAnonymously(auth);
    const user = cred.user;
    console.log('Signed in successfully! User ID:', user.uid);

    // 1. Create three unique tasks
    const tasks = [
      {
        id: `task_test_1_${Date.now()}`,
        userId: user.uid,
        title: 'Diagnostic Task 1',
        anchorDate: '2026-07-20',
        startHour: 9,
        endHour: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `task_test_2_${Date.now()}`,
        userId: user.uid,
        title: 'Diagnostic Task 2',
        anchorDate: '2026-07-20',
        startHour: 10,
        endHour: 11,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `task_test_3_${Date.now()}`,
        userId: user.uid,
        title: 'Diagnostic Task 3',
        anchorDate: '2026-07-20',
        startHour: 11,
        endHour: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    console.log('\n--- PHASE 1: WRITING 3 TASKS TO FIRESTORE ---');
    for (const task of tasks) {
      console.log(`Writing task to Firestore: docId=${task.id}, title="${task.title}"`);
      const docRef = doc(db, 'tasks', task.id);
      await setDoc(docRef, task);
      console.log(`Successfully wrote task: ${task.id}`);
    }

    console.log('\n--- PHASE 2: QUERYING FIRESTORE BACK ---');
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    console.log(`Query returned ${querySnapshot.size} documents.`);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log(`Retrieved from Firestore: docId=${docSnap.id}, title="${data.title}"`);
    });

    console.log('\nDiagnostic complete. Success!');
    process.exit(0);
  } catch (err) {
    console.error('Diagnostic failed with error:', err);
    process.exit(1);
  }
}

run();
