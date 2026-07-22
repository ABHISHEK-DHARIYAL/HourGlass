/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
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
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfigJson from '../firebase-applet-config.json';

// Support override via environment variables
const metaEnv = (import.meta as any).env || {};

const getDatabaseId = () => {
  const envVal = metaEnv.VITE_FIREBASE_DATABASE_ID;
  if (envVal && envVal !== '(default)' && envVal.trim() !== '') {
    return envVal;
  }
  if (firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)' && firebaseConfigJson.firestoreDatabaseId.trim() !== '') {
    return firebaseConfigJson.firestoreDatabaseId;
  }
  return '(default)';
};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
  firestoreDatabaseId: getDatabaseId()
};

// Silence internal Firestore warning/error logs in sandbox/test/dev environments
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('Failed to set Firestore log level:', e);
}

// Initialize Firebase with the config
const app = initializeApp(firebaseConfig);

export const isFirebaseConfigured = !!(
  metaEnv.VITE_FIREBASE_API_KEY ||
  (firebaseConfigJson.apiKey && !firebaseConfigJson.apiKey.includes('remixed-'))
);

export const auth = getAuth(app);

// During Firebase initialization execute await setPersistence(auth, browserLocalPersistence) before any sign-in occurs
try {
  await setPersistence(auth, browserLocalPersistence);
} catch (err) {
  console.warn('Failed to set Auth persistence:', err);
}

// Use initializeFirestore with long polling enabled to bypass iframe socket blocks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Messaging
export const messaging = typeof window !== 'undefined' && isFirebaseConfigured ? getMessaging(app) : null;

/**
 * Request notification permissions from the user and generate an FCM registration token.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isFirebaseConfigured) {
    console.warn('Firebase is not configured. Cannot request notification permission.');
    return null;
  }

  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission was not granted.');
      return null;
    }

    if (!messaging) {
      console.warn('Firebase Messaging is not initialized.');
      return null;
    }

    const vapidKey = metaEnv.VITE_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, { vapidKey });
    return token || null;
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    return null;
  }
}

/**
 * Listen for Firebase Cloud Messaging foreground messages.
 */
export function initializeForegroundNotifications(onMessageCallback: (payload: any) => void): (() => void) | null {
  if (typeof window === 'undefined' || !messaging) {
    return null;
  }

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Received foreground notification message:', payload);
      onMessageCallback(payload);
    });
    return unsubscribe;
  } catch (error) {
    console.error('Error initializing foreground notifications:', error);
    return null;
  }
}

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
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const gcalProvider = new GoogleAuthProvider();
gcalProvider.setCustomParameters({
  prompt: 'consent'
});

export { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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
