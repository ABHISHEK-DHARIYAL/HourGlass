/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  initializeFirestore,
  getDocFromServer,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Support override via environment variables
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: (metaEnv.VITE_FIREBASE_API_KEY as string) || firebaseConfigJson.apiKey,
  authDomain: (metaEnv.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfigJson.authDomain,
  projectId: (metaEnv.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfigJson.projectId,
  storageBucket: (metaEnv.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfigJson.storageBucket,
  messagingSenderId: (metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfigJson.messagingSenderId,
  appId: (metaEnv.VITE_FIREBASE_APP_ID as string) || firebaseConfigJson.appId,
  measurementId: (metaEnv.VITE_FIREBASE_MEASUREMENT_ID as string) || firebaseConfigJson.measurementId,
  firestoreDatabaseId: (metaEnv.VITE_FIREBASE_DATABASE_ID as string) || firebaseConfigJson.firestoreDatabaseId || firebaseConfigJson.projectId
};

// Silence internal Firestore warning/error logs in sandbox/test/dev environments
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('Failed to set Firestore log level:', e);
}

// Initialize Firebase with the config
const app = initializeApp(firebaseConfig);

export const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('remixed-');

export const auth = getAuth(app);

// Use initializeFirestore with long polling enabled to bypass iframe socket blocks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Validate Connection to Firestore on startup
async function testConnection() {
  if (typeof window === 'undefined' || !navigator.onLine || !isFirebaseConfigured) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or database is not fully provisioned yet.");
    } else {
      console.warn("Firestore validation ping: ", error);
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();
// Set standard scopes if needed
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

export { 
  signInWithPopup, 
  firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  onSnapshot
};
export type { User };
