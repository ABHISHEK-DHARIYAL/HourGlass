/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, firebaseSignOut, db, googleProvider, User, doc, getDoc, setDoc, messaging } from '../firebase';
import { deleteUser, reauthenticateWithPopup, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { clearAllOfflineStores } from '../utils/offlineStore';
import { getToken, deleteToken } from 'firebase/messaging';
import { urlBase64ToUint8Array } from '../utils/pushUtils';
import { TaskCategory } from '../types';
import { 
  loadNotificationSettings, 
  saveNotificationSettings, 
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS
} from '../utils/notificationService';
import { 
  Bell, 
  BellOff, 
  LogOut, 
  User as UserIcon, 
  UserX,
  Globe, 
  Settings as SettingsIcon,
  ShieldAlert,
  Smartphone,
  ChevronLeft,
  CheckCircle2,
  Sun,
  Moon,
  Plus,
  Trash2,
  Edit2,
  Save,
  Tag,
  X,
  Volume2,
  VolumeX,
  Zap,
  Clock,
  Sparkles,
  Coffee,
  Calendar,
  Moon as MoonStar,
  Activity,
  Lock,
  KeyRound
} from 'lucide-react';

interface SettingsViewProps {
  user: User;
  onBack: () => void;
  theme: 'dark' | 'paper';
  onToggleTheme: () => void;
  categories: TaskCategory[];
  onAddCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export default function SettingsView({ 
  user, 
  onBack, 
  theme, 
  onToggleTheme,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}: SettingsViewProps) {
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');

  // Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#e56b55');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState('');

  const CATEGORY_PRESET_COLORS = [
    '#e56b55', // Coral
    '#d4af37', // Muted Gold
    '#3f7c62', // Teal Sage
    '#6678a3', // Indigo Clay
    '#8a5a82', // Plum Ink
    '#506e5d', // Charcoal Sage
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  const handleAddNewCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await onAddCategory(newCatName.trim(), newCatColor);
      setNewCatName('');
      setSuccessMessage('Category created successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to create category.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleStartEditCategory = (cat: TaskCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatColor(cat.color);
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    try {
      await onUpdateCategory(id, editingCatName.trim(), editingCatColor);
      setEditingCatId(null);
      setSuccessMessage('Category updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to update category.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteCategoryClick = async (id: string) => {
    if (confirm('Are you sure you want to delete this category? Tasks using this category will remain, but will lose their category label.')) {
      try {
        await onDeleteCategory(id);
        setSuccessMessage('Category deleted.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setErrorMessage('Failed to delete category.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    }
  };
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => {
    return loadNotificationSettings(user.uid);
  });

  const handleUpdateNotifSetting = async (key: keyof NotificationSettings, value: any) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    await saveNotificationSettings(user.uid, updated);
  };

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Check support and current subscription on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window && messaging) {
      setPushSupported(true);
      setPermissionStatus(Notification.permission);
      checkCurrentSubscription();
    }
  }, []);

  const checkCurrentSubscription = async () => {
    if (!messaging) return;
    try {
      if (Notification.permission === 'granted') {
        const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
        const token = await getToken(messaging, { vapidKey });
        if (token) {
          setIsSubscribed(true);
          try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
              fcmToken: token,
              notificationSettings: notifSettings,
              timezone: userTimezone,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (firestoreErr) {
            console.warn('Failed to save push subscription to Firestore, syncing with backend as fallback:', firestoreErr);
          }
          // Always synchronize token and settings with backend
          await saveNotificationSettings(user.uid, notifSettings);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.warn('Failed to check push subscription:', err);
      setIsSubscribed(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Request Browser Permission
      if (!('Notification' in window)) {
        setErrorMessage('Notifications are not supported by this browser.');
        setLoading(false);
        return;
      }

      let permission: NotificationPermission = 'default';
      try {
        permission = await Notification.requestPermission();
      } catch (err) {
        console.warn('Failed to request permission:', err);
        permission = 'denied';
      }

      setPermissionStatus(permission);
      if (permission !== 'granted') {
        const isIframe = window.self !== window.top;
        const msg = isIframe
          ? 'Notification permission was denied. Because this app is running inside an iframe, please open the application in a new tab (using the button in the top-right corner) to grant notification permission.'
          : 'Notification permission was denied. Please enable notifications in your browser site settings (usually by clicking the lock icon next to the URL).';
        setErrorMessage(msg);
        setLoading(false);
        return;
      }

      if (!messaging) {
        throw new Error('Firebase Messaging is not configured correctly on this app.');
      }

      // 2. Get FCM Token
      const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
      const token = await getToken(messaging, { vapidKey });
      if (!token) {
        throw new Error('Failed to generate a registration token.');
      }

      // 3. Save FCM Token to Firestore users/{uid}
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          fcmToken: token,
          notificationSettings: notifSettings,
          timezone: userTimezone,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn('Failed to save push subscription to Firestore, syncing with backend as fallback:', firestoreErr);
      }

      // Always synchronize token and settings with backend
      await saveNotificationSettings(user.uid, notifSettings);

      setIsSubscribed(true);
      setSuccessMessage('Push notifications successfully enabled on this device.');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to enable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (messaging) {
        await deleteToken(messaging);
      }
      
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          fcmToken: '',
          notificationSettings: notifSettings,
          timezone: userTimezone,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn('Failed to clear push subscription in Firestore, syncing with backend as fallback:', firestoreErr);
      }

      // Always synchronize settings (and cleared token) with backend
      await saveNotificationSettings(user.uid, notifSettings);

      setIsSubscribed(false);
      setSuccessMessage('Notifications disabled successfully on this device.');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to disable notifications.');
    } finally {
      setLoading(false);
    }
  };



  const handleSignOut = () => {
    if (user.uid === 'guest_user') {
      localStorage.removeItem('hourglass_guest_user');
      window.location.reload();
      return;
    }
    firebaseSignOut(auth).catch(console.error);
  };

  const handleReauthenticateAndRetry = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrorMessage('No authenticated user found for re-authentication.');
      setShowReauthModal(false);
      return;
    }

    setReauthorizing(true);
    setReauthError(null);
    setErrorMessage(null);
    try {
      console.log('Initiating Google re-authentication via popup...');
      await reauthenticateWithPopup(currentUser, googleProvider);
      console.log('Re-authentication successful! Resuming account deletion...');
      setShowReauthModal(false);
      setReauthPassword('');
      // Automatically retry account deletion now that we are recently authenticated
      await handleDeleteAccount();
    } catch (reauthErr: any) {
      console.error('Google re-authentication failed:', reauthErr);
      let errMsg = reauthErr.message || 'Failed to verify identity. Please try again.';
      if (reauthErr.code === 'auth/popup-blocked') {
        errMsg = 'Re-authentication popup was blocked by your browser. Please allow popups or open the app in a new tab, then try again.';
      } else if (reauthErr.code === 'auth/popup-closed-by-user') {
        errMsg = 'Re-authentication popup was closed before completion. Please try again.';
      }
      setReauthError(errMsg);
    } finally {
      setReauthorizing(false);
    }
  };

  const handlePasswordReauthenticateAndRetry = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrorMessage('No authenticated user found for re-authentication.');
      setShowReauthModal(false);
      return;
    }

    if (!reauthPassword) {
      setReauthError('Please enter your password.');
      return;
    }

    setReauthorizing(true);
    setReauthError(null);
    setErrorMessage(null);
    try {
      console.log('Initiating Password re-authentication...');
      const credential = EmailAuthProvider.credential(currentUser.email || '', reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      console.log('Password re-authentication successful! Resuming account deletion...');
      setShowReauthModal(false);
      setReauthPassword('');
      // Automatically retry account deletion now that we are recently authenticated
      await handleDeleteAccount();
    } catch (reauthErr: any) {
      console.error('Password re-authentication failed:', reauthErr);
      let errMsg = reauthErr.message || 'Failed to verify identity. Please check your password and try again.';
      if (reauthErr.code === 'auth/wrong-password') {
        errMsg = 'Incorrect password. Please try again.';
      }
      setReauthError(errMsg);
    } finally {
      setReauthorizing(false);
    }
  };

  const handleDeleteAccount = async (forceSkipAuthDelete: boolean = false) => {
    if (user.uid === 'guest_user') {
      setDeletingAccount(true);
      try {
        localStorage.clear();
        sessionStorage.clear();
        await clearAllOfflineStores().catch(console.warn);
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
        setSuccessMessage('Guest account and all cached data have been deleted. Redirecting...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } finally {
        setDeletingAccount(false);
      }
      return;
    }

    setDeletingAccount(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Mark account deletion in progress so snapshot listeners do not re-seed default data
    localStorage.setItem('hourglass_deleting_account', 'true');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser && !forceSkipAuthDelete) {
        throw new Error('No user is currently signed in.');
      }

      console.log('Starting account deletion flow...');

      // 1. Delete FCM push notification token locally if active
      try {
        if (messaging) {
          await deleteToken(messaging);
          console.log('Deleted FCM token successfully.');
        }
      } catch (err) {
        console.warn('Failed to delete FCM token during account deletion:', err);
      }

      // 2. Clear IndexedDB offline cache stores first so local items do not resurrect in state
      console.log('Clearing offline IndexedDB cache stores...');
      await clearAllOfflineStores().catch((e) => console.warn('Failed clearing offline stores:', e));

      // 3. Fetch and delete all user data across all Firestore collections BEFORE deleting Auth user
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

      console.log('Starting complete user data deletion in Firestore for user:', user.uid);
      for (const colName of collectionsToDelete) {
        try {
          const colRef = collection(db, colName);
          const q = query(colRef, where('userId', '==', user.uid));
          
          while (true) {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) break;
            
            const batch = writeBatch(db);
            const chunk = querySnapshot.docs.slice(0, 400);
            chunk.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
            console.log(`Finished batch deletion chunk of ${chunk.length} docs for Firestore collection: "${colName}"`);
            
            if (querySnapshot.size <= 400) break;
          }
        } catch (colErr: any) {
          console.error(`Error deleting documents from collection "${colName}":`, colErr);
        }
      }

      // Explicitly delete any category docs prefixed with user.uid
      try {
        const catColRef = collection(db, 'categories');
        const catSnapshot = await getDocs(catColRef);
        const batch = writeBatch(db);
        let count = 0;
        catSnapshot.docs.forEach((docSnap) => {
          if (docSnap.id.startsWith(`${user.uid}_`)) {
            batch.delete(docSnap.ref);
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          console.log(`Deleted ${count} prefixed category documents.`);
        }
      } catch (catErr) {
        console.warn('Prefixed categories deletion note:', catErr);
      }

      // 4. Delete user profile document from Firestore
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        console.log('Deleted user profile document.');
      } catch (err) {
        console.warn('Failed to delete user profile document:', err);
      }

      // 5. Request server-side cleanup (Firestore and tasks.json)
      try {
        const serverCleanupResponse = await fetch('/api/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        });

        if (!serverCleanupResponse.ok) {
          console.warn('Backend server-side database cleanup failed or returned an error.');
        } else {
          console.log('Backend server-side database cleanup completed successfully.');
        }
      } catch (serverErr) {
        console.error('Failed to request server-side cleanup:', serverErr);
      }

      // 6. FINALLY delete Firebase Authentication user
      if (currentUser && !forceSkipAuthDelete) {
        try {
          console.log('Attempting Firebase Auth deletion...');
          await deleteUser(currentUser);
          console.log('Firebase Authentication user deleted successfully.');
        } catch (authDeleteErr: any) {
          if (authDeleteErr && authDeleteErr.code === 'auth/requires-recent-login') {
            console.warn('Account deletion client note: requires recent login. Proceeding with sign-out and redirection...');
          } else if (authDeleteErr && (authDeleteErr.code === 'auth/user-not-found' || authDeleteErr.message?.includes('user-not-found'))) {
            console.log('User account was already deleted from Firebase Auth.');
          } else {
            console.warn('Client auth user deletion note:', authDeleteErr);
          }
        }
      }

      // 7. Sign the user out from Firebase
      try {
        await firebaseSignOut(auth);
      } catch (signOutErr) {
        console.warn('Post-deletion sign-out error (non-blocking):', signOutErr);
      }

      // 8. Clear Client-Side Cache, Service Workers, IndexedDB, LocalStorage, SessionStorage
      console.log('Clearing local caches, databases, service workers, and localStorage...');
      localStorage.clear();
      sessionStorage.clear();

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
          console.log('Unregistered service workers.');
        } catch (swErr) {
          console.warn('Service worker unregistration note:', swErr);
        }
      }

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('HourglassOfflineDB');
        req.onsuccess = () => {
          console.log('IndexedDB HourglassOfflineDB deleted.');
          resolve();
        };
        req.onerror = (err) => {
          console.error('IndexedDB deletion error:', err);
          resolve();
        };
        req.onblocked = () => {
          console.warn('IndexedDB deletion blocked.');
          resolve();
        };
      });

      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
          console.log('Cleared all window cache stores.');
        } catch (cacheErr) {
          console.error('Failed to clear window caches:', cacheErr);
        }
      }

      setSuccessMessage('Your account and all associated data have been permanently deleted from Firebase. Redirecting to Google Sign-In...');
      setTimeout(() => {
        window.location.href = '/'; // Full page reload/redirect to index ensuring clean app state
      }, 500);

    } catch (err: any) {
      console.error('Error during account deletion process:', err);
      // Ensure the user is signed out and redirected to the login screen
      try {
        await firebaseSignOut(auth);
      } catch (signOutErr) {
        console.warn('Sign out error:', signOutErr);
      }
      localStorage.clear();
      sessionStorage.clear();
      setSuccessMessage('Account data cleared. Redirecting to Sign In screen...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-ledger-dark text-ledger-paper p-5 flex flex-col font-sans">
      
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          id="back-to-dashboard-button"
          className="p-1.5 rounded-lg hover:bg-ledger-slate border border-ledger-line text-ledger-paper cursor-pointer transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-ledger-paper flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-ledger-gold" />
          <span>Hourglass Settings</span>
        </h2>
      </div>

      {/* User profile card */}
      <div className="bg-ledger-slate rounded-2xl border border-ledger-line p-5 mb-5 flex items-center gap-4 shadow-lg">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User Profile'}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full border border-ledger-line"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-ledger-slate-light border border-ledger-line flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-ledger-paper-dim" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h3 className="font-serif text-lg font-bold truncate text-ledger-paper">
            {user.displayName || 'Hourglass Member'}
          </h3>
          <p className="font-mono text-[10px] text-ledger-paper-dim/60 truncate uppercase tracking-widest">
            {user.email || 'No email associated'}
          </p>
        </div>
      </div>

      {/* Settings list container */}
      <div className="bg-ledger-slate rounded-2xl border border-ledger-line p-5 shadow-lg flex flex-col gap-5">
        
        {/* Title */}
        <h4 className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold border-b border-ledger-line pb-2">
          Application Preferences
        </h4>

        {/* Theme Preference Toggle */}
        <div className="flex items-start gap-3.5 pb-2 border-b border-ledger-line/30">
          <div className="p-2 rounded-lg bg-ledger-slate-light text-ledger-gold mt-0.5">
            {theme === 'paper' ? <Sun className="w-5 h-5 text-ledger-coral" /> : <Moon className="w-5 h-5 text-ledger-gold" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ledger-paper">Contrast & Theme</div>
              <button
                type="button"
                onClick={onToggleTheme}
                id="theme-preference-toggle-button"
                className="px-2.5 py-1 text-[9px] font-mono font-bold bg-ledger-coral text-ledger-dark hover:opacity-90 rounded-lg uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
              >
                Switch to {theme === 'paper' ? 'Slate' : 'Paper'}
              </button>
            </div>
            <p className="text-[11px] text-ledger-paper-dim/85 mt-1 leading-relaxed">
              Currently in <span className="text-ledger-gold font-bold">{theme === 'paper' ? 'High-Contrast Paper (Light)' : 'Classic Slate (Dark)'}</span>. High-contrast Paper enhances legibility under bright sunlight.
            </p>
          </div>
        </div>

        {/* Timezone Info */}
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-lg bg-ledger-slate-light text-ledger-gold mt-0.5">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ledger-paper">Active Timezone</div>
            <div className="font-mono text-xs text-ledger-paper-dim mt-0.5">
              {userTimezone}
            </div>
            <p className="text-[10px] text-ledger-paper-dim/40 mt-1 leading-snug">
              Notifications and date schedules are automatically aligned with your local time on this browser.
            </p>
          </div>
        </div>

        {/* Web Push Notifications Card */}
        <div className="flex items-start gap-3.5 pt-2">
          <div className={`p-2 rounded-lg mt-0.5 ${isSubscribed ? 'bg-ledger-coral/15 text-ledger-coral' : 'bg-ledger-slate-light text-ledger-paper-dim'}`}>
            {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ledger-paper flex items-center gap-1.5">
              <span>Push Notifications</span>
              {isSubscribed && (
                <span className="font-mono text-[8px] bg-ledger-coral/10 text-ledger-coral px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                  Active
                </span>
              )}
            </div>
            
            <p className="text-[11px] text-ledger-paper-dim/75 mt-1 leading-relaxed">
              Triggers a system-level notification at the exact start of your booked hours. Runs even when the app is completely closed.
            </p>

            {pushSupported ? (
              <div className="mt-4">
                <button
                  onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                  disabled={loading}
                  id="push-subscription-toggle-button"
                  className={`w-full h-10 px-4 rounded-xl font-sans font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                    isSubscribed
                      ? 'bg-ledger-slate-light hover:bg-ledger-slate-light/95 text-ledger-coral border border-ledger-line'
                      : 'bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark'
                  }`}
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  ) : isSubscribed ? (
                    <>
                      <BellOff className="w-4 h-4" />
                      <span>Disable Push Alerts</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>Enable System Push Alerts</span>
                    </>
                  )}
                </button>

                {/* Comprehensive Notification Control Dashboard */}
                <div className="mt-5 border-t border-ledger-line/40 pt-4 space-y-4 animate-in fade-in duration-350">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-ledger-paper uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-ledger-coral" />
                        <span>Interactive Engine Settings</span>
                      </h4>
                      <p className="text-[10px] text-ledger-paper-dim/60 mt-0.5">
                        Configure client & background alert properties
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateNotifSetting('enabled', !notifSettings.enabled)}
                      id="master-notification-switch"
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        notifSettings.enabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-ledger-dark shadow-sm" />
                    </button>
                  </div>

                  {notifSettings.enabled && (
                    <div className="space-y-3.5 pl-1.5 animate-in fade-in slide-in-from-top-1.5 duration-200">
                      
                      {/* Audio & Vibration */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-ledger-paper-dim flex items-center gap-1.5">
                            {notifSettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-ledger-coral" /> : <VolumeX className="w-3.5 h-3.5 text-ledger-paper-dim/50" />}
                            <span>Audio Chimes</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('soundEnabled', !notifSettings.soundEnabled)}
                            id="sound-alert-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.soundEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>

                        <div className="p-2.5 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-ledger-paper-dim flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-ledger-coral" />
                            <span>Vibrations</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('vibrationEnabled', !notifSettings.vibrationEnabled)}
                            id="vibrate-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.vibrationEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>
                      </div>

                      {/* Reminder Timing */}
                      <div className="p-2.5 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-ledger-coral" />
                            <span>Upcoming Reminders</span>
                          </div>
                          <p className="text-[9px] text-ledger-paper-dim/60">
                            Pre-alert offset timing prior to task start
                          </p>
                        </div>
                        <select
                          value={notifSettings.reminderTiming}
                          onChange={(e) => handleUpdateNotifSetting('reminderTiming', parseInt(e.target.value, 10))}
                          className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                        >
                          <option value="5">5 Minutes</option>
                          <option value="10">10 Minutes</option>
                          <option value="15">15 Minutes</option>
                          <option value="30">30 Minutes</option>
                        </select>
                      </div>

                      {/* Daily Morning Summary */}
                      <div className="p-3 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-ledger-coral" />
                            <span>Morning Briefing</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('morningSummaryEnabled', !notifSettings.morningSummaryEnabled)}
                            id="morning-summary-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.morningSummaryEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>
                        {notifSettings.morningSummaryEnabled && (
                          <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                            <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Daily Delivery Time</span>
                            <input
                              type="time"
                              value={notifSettings.morningSummaryTime}
                              onChange={(e) => handleUpdateNotifSetting('morningSummaryTime', e.target.value)}
                              className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                            />
                          </div>
                        )}
                      </div>

                      {/* Daily Evening Summary */}
                      <div className="p-3 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                            <MoonStar className="w-3.5 h-3.5 text-ledger-coral" />
                            <span>Evening Briefing</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('eveningSummaryEnabled', !notifSettings.eveningSummaryEnabled)}
                            id="evening-summary-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.eveningSummaryEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>
                        {notifSettings.eveningSummaryEnabled && (
                          <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                            <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Daily Delivery Time</span>
                            <input
                              type="time"
                              value={notifSettings.eveningSummaryTime}
                              onChange={(e) => handleUpdateNotifSetting('eveningSummaryTime', e.target.value)}
                              className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                            />
                          </div>
                        )}
                      </div>

                      {/* Habit Reminders & Smart Break advices */}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="p-2.5 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-ledger-coral" />
                              <span>Habit Alerts</span>
                            </div>
                            <p className="text-[9px] text-ledger-paper-dim/60">
                              Notify if daily habits are pending
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('habitRemindersEnabled', !notifSettings.habitRemindersEnabled)}
                            id="habit-alerts-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.habitRemindersEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>

                        <div className="p-3 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                                <Coffee className="w-3.5 h-3.5 text-ledger-coral" />
                                <span>Smart Break Advice</span>
                              </div>
                              <p className="text-[9px] text-ledger-paper-dim/60">
                                Suggest stretch breaks during deep focus
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateNotifSetting('breakRemindersEnabled', !notifSettings.breakRemindersEnabled)}
                              id="break-reminders-switch"
                              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                                notifSettings.breakRemindersEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                            </button>
                          </div>
                          {notifSettings.breakRemindersEnabled && (
                            <div className="flex items-center justify-between pl-5 pt-1 animate-in fade-in duration-150">
                              <span className="text-[9px] text-ledger-paper-dim/60 font-medium">Interval Threshold</span>
                              <select
                                value={notifSettings.breakIntervalMinutes}
                                onChange={(e) => handleUpdateNotifSetting('breakIntervalMinutes', parseInt(e.target.value, 10))}
                                className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono"
                              >
                                <option value="30">30 minutes</option>
                                <option value="45">45 minutes</option>
                                <option value="60">60 minutes</option>
                                <option value="90">90 minutes</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quiet Hours / Do Not Disturb */}
                      <div className="p-3 bg-ledger-dark/45 border border-ledger-line/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-ledger-paper flex items-center gap-1.5">
                              <MoonStar className="w-3.5 h-3.5 text-ledger-coral" />
                              <span>Quiet Hours</span>
                            </span>
                            <p className="text-[9px] text-ledger-paper-dim/60">
                              Suppress alerts during specific hours
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifSetting('quietHoursEnabled', !notifSettings.quietHoursEnabled)}
                            id="quiet-hours-switch"
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              notifSettings.quietHoursEnabled ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-ledger-dark" />
                          </button>
                        </div>
                        {notifSettings.quietHoursEnabled && (
                          <div className="grid grid-cols-2 gap-3 pl-5 pt-1.5 animate-in fade-in duration-150">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] text-ledger-paper-dim/60 uppercase font-bold">Start</span>
                              <input
                                type="time"
                                value={notifSettings.quietHoursStart}
                                onChange={(e) => handleUpdateNotifSetting('quietHoursStart', e.target.value)}
                                className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono w-full"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] text-ledger-paper-dim/60 uppercase font-bold">End</span>
                              <input
                                type="time"
                                value={notifSettings.quietHoursEnd}
                                onChange={(e) => handleUpdateNotifSetting('quietHoursEnd', e.target.value)}
                                className="bg-ledger-dark border border-ledger-line text-ledger-paper text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral font-mono w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

                {permissionStatus === 'denied' && (
                  <div className="mt-3 p-3 rounded-xl bg-ledger-coral/10 border border-ledger-coral/20 text-ledger-paper-dim text-[11px] flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 font-semibold text-ledger-coral">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Notification Access Blocked</span>
                    </div>
                    <p className="leading-relaxed">
                      {window.self !== window.top ? (
                        <>
                          Because this app is running inside an iframe, standard browser push notifications are restricted. Please <strong className="text-ledger-paper font-semibold">open the application in a new tab</strong> (using the button in the top-right corner of the window) to allow and receive notifications.
                        </>
                      ) : (
                        <>
                          Notifications are blocked in your browser settings. Please click the lock or settings icon next to the URL in your browser's address bar and set "Notifications" to <strong className="text-ledger-paper font-semibold">Allow</strong>.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 p-3 rounded-lg bg-ledger-coral/10 border border-ledger-coral/20 text-ledger-paper-dim text-[10px] flex gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-ledger-coral" />
                <span>
                  Push Notifications are not supported in this browser environment. Try opening on Google Chrome, Firefox, or Safari on Mobile.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PWA Installer status banner */}
        <div className="flex items-start gap-3.5 pt-2 border-t border-ledger-line">
          <div className="p-2 rounded-lg bg-ledger-slate-light text-ledger-paper-dim mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ledger-paper">Installable PWA App</div>
            <p className="text-[11px] text-ledger-paper-dim/75 mt-1 leading-relaxed">
              Hourglass can be saved directly to your phone's homescreen. It will run in its own immersive app frame and launch in milliseconds.
            </p>
            <div className="mt-2 text-[10px] font-mono text-ledger-paper-dim/40 leading-snug">
              To install: open the browser menu (or share icon in Safari) and tap <strong className="text-ledger-paper">"Add to Home Screen"</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* Task Categories Card */}
      <div className="bg-ledger-slate rounded-2xl border border-ledger-line p-5 shadow-lg flex flex-col gap-5">
        <h4 className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold border-b border-ledger-line pb-2 flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-ledger-gold" />
          <span>Task Categories</span>
        </h4>

        <p className="text-xs text-ledger-paper-dim leading-relaxed">
          Define custom labels and colors for your hour blocks to organize them beautifully.
        </p>

        {/* Add New Category Form */}
        <form onSubmit={handleAddNewCategorySubmit} className="bg-ledger-dark/40 border border-ledger-line/50 rounded-xl p-3 flex flex-col gap-3">
          <span className="font-mono text-[9px] text-ledger-gold uppercase tracking-widest">
            Create Custom Category
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Work, Gym, Sleep..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 bg-ledger-dark border border-ledger-line rounded-lg text-xs px-3 py-1.5 text-ledger-paper placeholder-ledger-paper-dim/30 focus:outline-none focus:border-ledger-coral font-sans"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-ledger-coral text-ledger-dark font-sans font-bold text-xs rounded-lg hover:opacity-90 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Preset Color Selection for Add Form */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CATEGORY_PRESET_COLORS.map((col) => (
                <button
                  key={`preset-add-${col}`}
                  type="button"
                  onClick={() => setNewCatColor(col)}
                  className="w-5.5 h-5.5 rounded-full border transition-all relative cursor-pointer active:scale-90"
                  style={{ 
                    backgroundColor: col, 
                    borderColor: newCatColor === col ? '#f4efe2' : 'transparent',
                    boxShadow: newCatColor === col ? '0 0 0 1px #e56b55' : 'none'
                  }}
                  title={col}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Category List */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9px] text-ledger-paper-dim/60 uppercase tracking-widest">
            Your Categories ({categories.length})
          </span>

          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isEditing = editingCatId === cat.id;
              return (
                <div 
                  key={cat.id} 
                  className="flex flex-col gap-2 bg-ledger-dark/25 border border-ledger-line/30 rounded-xl p-2.5 transition-all"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="flex-1 bg-ledger-dark border border-ledger-line rounded-lg text-xs px-2.5 py-1 text-ledger-paper focus:outline-none focus:border-ledger-coral font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditCategory(cat.id)}
                          className="p-1 text-ledger-gold hover:opacity-80"
                          title="Save Changes"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="p-1 text-ledger-paper-dim hover:text-ledger-paper"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Editing Colors Selector */}
                      <div className="flex flex-wrap gap-1">
                        {CATEGORY_PRESET_COLORS.map((col) => (
                          <button
                            key={`preset-edit-${cat.id}-${col}`}
                            type="button"
                            onClick={() => setEditingCatColor(col)}
                            className="w-4.5 h-4.5 rounded-full border transition-all relative cursor-pointer"
                            style={{ 
                              backgroundColor: col, 
                              borderColor: editingCatColor === col ? '#f4efe2' : 'transparent',
                              boxShadow: editingCatColor === col ? '0 0 0 1px #e56b55' : 'none'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span 
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" 
                          style={{ backgroundColor: cat.color }} 
                        />
                        <span className="text-xs font-semibold text-ledger-paper truncate">
                          {cat.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="p-1.5 rounded-md hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper transition-all cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategoryClick(cat.id)}
                          className="p-1.5 rounded-md hover:bg-ledger-coral/15 text-ledger-paper-dim hover:text-ledger-coral transition-all cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {categories.length === 0 && (
              <div className="text-center py-4 text-ledger-paper-dim/40 text-xs">
                No custom categories defined.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error alert popups */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-ledger-coral/10 border border-ledger-coral/30 text-ledger-coral text-xs flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-4 rounded-xl bg-ledger-slate-light border border-ledger-gold/30 text-ledger-gold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-ledger-gold" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Bottom Actions footer */}
      <div className="mt-auto pt-8 flex flex-col gap-4">
        {showDeleteAccountConfirm ? (
          <div className="bg-ledger-coral/10 border border-ledger-coral/20 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-ledger-coral shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-ledger-paper block">
                  Permanently Delete Your Account?
                </span>
                <span className="text-[11px] text-ledger-paper-dim/80 leading-relaxed block mt-1">
                  This is irreversible. All of your hour blocks, schedules, and active push notification subscriptions will be permanently erased from our database.
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountConfirm(false);
                  setErrorMessage(null);
                }}
                disabled={deletingAccount}
                className="flex-1 h-10 bg-ledger-slate border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light active:scale-98 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAccount()}
                disabled={deletingAccount}
                className="flex-1 h-10 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark text-xs font-bold rounded-lg active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingAccount ? (
                  <span className="w-4 h-4 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Sign out button */}
            <button
              onClick={handleSignOut}
              id="logout-button"
              className="w-full h-12 flex items-center justify-center gap-2 border border-ledger-line hover:bg-ledger-coral/10 hover:text-ledger-coral transition-colors font-sans font-bold text-sm text-ledger-paper-dim rounded-xl cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out from Hourglass</span>
            </button>

            {/* Delete Account toggle */}
            <button
              onClick={() => setShowDeleteAccountConfirm(true)}
              id="delete-account-toggle-button"
              className="w-full h-11 flex items-center justify-center gap-2 text-ledger-coral/75 hover:text-ledger-coral hover:bg-ledger-coral/5 transition-all font-sans font-semibold text-xs rounded-xl cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              <span>Delete Account Permanently</span>
            </button>
          </div>
        )}

        <div className="text-center text-[10px] font-mono text-ledger-paper-dim/40 uppercase tracking-widest">
          Version 1.0.0 (Stable)
        </div>
      </div>

      {/* Re-authentication Dialog / Modal */}
      {showReauthModal && (() => {
        const currentUser = auth.currentUser;
        const isPasswordUser = currentUser?.providerData.some(p => p.providerId === 'password') ?? false;
        const isGoogleUser = !isPasswordUser || (currentUser?.providerData.some(p => p.providerId === 'google.com') ?? true);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-ledger-slate border border-ledger-line rounded-2xl p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-ledger-coral/10 border border-ledger-coral/30 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6 text-ledger-coral" />
              </div>

              <h3 className="font-serif text-lg font-bold text-ledger-paper mb-2">
                Verification Required
              </h3>
              
              <p className="text-xs text-ledger-paper-dim/90 leading-relaxed mb-6">
                For security, deleting your account requires verifying your identity. Please verify to permanently delete your data and authentication record.
              </p>

              {reauthError && (
                <div className="mb-4 p-3 rounded-lg bg-ledger-coral/10 border border-ledger-coral/30 text-ledger-coral text-xs text-left flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{reauthError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReauthModal(false);
                      handleDeleteAccount(true);
                    }}
                    className="mt-1 text-[11px] font-bold underline text-ledger-coral hover:text-ledger-coral/80 text-left cursor-pointer"
                  >
                    Purge All Data &amp; Sign Out
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {/* Google verification option */}
                {isGoogleUser && (
                  <button
                    type="button"
                    onClick={handleReauthenticateAndRetry}
                    disabled={reauthorizing}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-ledger-coral hover:bg-ledger-coral/95 active:scale-98 transition-all text-ledger-dark font-sans font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {reauthorizing ? (
                      <span className="w-5 h-5 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.81-.63-1.41-1.52-1.66-2.63z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Verify Identity with Google</span>
                      </>
                    )}
                  </button>
                )}

                {isGoogleUser && isPasswordUser && (
                  <div className="flex items-center gap-2 my-1">
                    <hr className="flex-1 border-ledger-line" />
                    <span className="text-[10px] font-mono text-ledger-paper-dim uppercase tracking-wider">or</span>
                    <hr className="flex-1 border-ledger-line" />
                  </div>
                )}

                {/* Password verification option */}
                {isPasswordUser && (
                  <form onSubmit={handlePasswordReauthenticateAndRetry} className="text-left">
                    <label className="block text-[10px] font-mono text-ledger-paper-dim uppercase tracking-wider mb-1.5">
                      Enter Password
                    </label>
                    <div className="relative mb-3">
                      <input
                        type="password"
                        value={reauthPassword}
                        onChange={(e) => setReauthPassword(e.target.value)}
                        disabled={reauthorizing}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 pl-9 bg-ledger-dark border border-ledger-line text-ledger-paper rounded-xl text-xs font-sans focus:outline-none focus:border-ledger-coral/50 transition-colors"
                      />
                      <Lock className="w-4 h-4 text-ledger-paper-dim absolute left-3 top-3" />
                    </div>
                    <button
                      type="submit"
                      disabled={reauthorizing}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-ledger-coral hover:bg-ledger-coral/95 active:scale-98 transition-all text-ledger-dark font-sans font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {reauthorizing ? (
                        <span className="w-5 h-5 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify with Password</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowReauthModal(false);
                    handleDeleteAccount(true);
                  }}
                  disabled={reauthorizing}
                  className="w-full h-10 border border-ledger-coral/40 text-ledger-coral text-xs font-semibold rounded-xl hover:bg-ledger-coral/10 active:scale-98 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Force Purge All Data &amp; Sign Out
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReauthModal(false);
                    setDeletingAccount(false);
                    setReauthError(null);
                    setReauthPassword('');
                  }}
                  disabled={reauthorizing}
                  className="w-full h-10 border border-ledger-line text-xs font-semibold rounded-xl text-ledger-paper-dim hover:text-ledger-paper hover:bg-ledger-slate-light active:scale-98 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
