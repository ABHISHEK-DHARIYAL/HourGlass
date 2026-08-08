// Purpose: Main settings view managing theme, timezones, notifications, categories, and account lifecycle

import React, { useState, useEffect } from 'react';
import { auth, firebaseSignOut, db, googleProvider, User, doc, setDoc, messaging } from '../firebase';
import { deleteUser, reauthenticateWithPopup, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { clearAllOfflineStores } from '../utils/offlineStore';
import { deleteUserDataCollections, clearLocalBrowserStorage } from '../utils/accountCleanup';
import { getToken, deleteToken } from 'firebase/messaging';
import { TaskCategory } from '../types';
import { 
  loadNotificationSettings, 
  saveNotificationSettings, 
  clearFcmTokenOnServer,
  NotificationSettings
} from '../utils/notificationService';
import { 
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
  Moon
} from 'lucide-react';
import TaskCategoriesManager from './TaskCategoriesManager';
import NotificationSettingsPanel from './NotificationSettingsPanel';
import ReauthModal from './ReauthModal';
import AccountManagementSection from './AccountManagementSection';
import SettingsProfileHeader from './SettingsProfileHeader';
import SettingsAppPreferencesPanel from './SettingsAppPreferencesPanel';

interface SettingsViewProps {
  user: User;
  onBack: () => void;
  theme: 'dark' | 'paper';
  onToggleTheme: () => void;
  categories: TaskCategory[];
  onAddCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAccountDeleted?: () => void;
}

export default function SettingsView({ 
  user, 
  onBack, 
  theme, 
  onToggleTheme,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAccountDeleted
}: SettingsViewProps) {
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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

      const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
      const token = await getToken(messaging, { vapidKey });
      if (!token) {
        throw new Error('Failed to generate a registration token.');
      }

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
      if (onAccountDeleted) {
        onAccountDeleted();
      }
      return;
    }
    clearFcmTokenOnServer(user.uid).finally(() => {
      firebaseSignOut(auth)
        .then(() => {})
        .catch((err) => {
          console.error('signOut failure:', err);
        });
    });
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
      await reauthenticateWithPopup(currentUser, googleProvider);
      setShowReauthModal(false);
      setReauthPassword('');
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
      const credential = EmailAuthProvider.credential(currentUser.email || '', reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      setShowReauthModal(false);
      setReauthPassword('');
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
        await clearLocalBrowserStorage();
        setSuccessMessage('Guest account and all cached data have been deleted.');
        if (onAccountDeleted) {
          onAccountDeleted();
        }
      } finally {
        setDeletingAccount(false);
      }
      return;
    }

    setDeletingAccount(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    localStorage.setItem('hourglass_deleting_account', 'true');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser && !forceSkipAuthDelete) {
        throw new Error('No user is currently signed in.');
      }

      try {
        if (messaging) {
          await deleteToken(messaging);
        }
      } catch (err) {
        console.warn('Failed to delete FCM token during account deletion:', err);
      }

      await clearAllOfflineStores().catch((e) => console.warn('Failed clearing offline stores:', e));

      await deleteUserDataCollections(user.uid);

      try {
        await fetch('/api/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        });
      } catch (serverErr) {
        console.error('Failed to request server-side cleanup:', serverErr);
      }

      if (currentUser && !forceSkipAuthDelete) {
        try {
          await deleteUser(currentUser);
        } catch (authDeleteErr: any) {
          if (authDeleteErr && (authDeleteErr.code === 'auth/requires-recent-login' || authDeleteErr.message?.includes('requires-recent-login'))) {
            setShowReauthModal(true);
            setDeletingAccount(false);
            return;
          } else if (authDeleteErr && (authDeleteErr.code === 'auth/user-not-found' || authDeleteErr.message?.includes('user-not-found'))) {
            console.log('User account was already deleted from Firebase Auth.');
          } else {
            setErrorMessage(authDeleteErr.message || 'Failed to delete user account from Firebase Auth.');
            setDeletingAccount(false);
            throw authDeleteErr;
          }
        }
      }

      try {
        await firebaseSignOut(auth);
      } catch (signOutErr) {
        console.error('signOut failure:', signOutErr);
      }

      await clearLocalBrowserStorage();

      setSuccessMessage('Your account and all associated data have been permanently deleted from Firebase.');
      if (onAccountDeleted) {
        onAccountDeleted();
      }

    } catch (err: any) {
      console.error('Error during account deletion process:', err);
      if (err?.code === 'auth/requires-recent-login' || err?.message?.includes('requires-recent-login')) {
        setShowReauthModal(true);
      } else {
        setErrorMessage(err.message || 'An error occurred while deleting your account.');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-ledger-dark text-ledger-paper p-5 flex flex-col gap-5 animate-fade-up">
      <SettingsProfileHeader user={user} onBack={onBack} />

      <div className="surface-card p-5 flex flex-col gap-5">
        
        <SettingsAppPreferencesPanel
          theme={theme}
          onToggleTheme={onToggleTheme}
          userTimezone={userTimezone}
        />

        <NotificationSettingsPanel
          isSubscribed={isSubscribed}
          pushSupported={pushSupported}
          permissionStatus={permissionStatus}
          loading={loading}
          notifSettings={notifSettings}
          handleSubscribe={handleSubscribe}
          handleUnsubscribe={handleUnsubscribe}
          handleUpdateNotifSetting={handleUpdateNotifSetting}
        />
      </div>

      <TaskCategoriesManager
        categories={categories}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        setSuccessMessage={setSuccessMessage}
        setErrorMessage={setErrorMessage}
      />

      {errorMessage && (
        <div className="p-4 rounded-xl bg-ledger-danger/10 border border-ledger-danger/30 text-ledger-danger text-xs flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-ledger-success/10 border border-ledger-success/30 text-ledger-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="mt-auto pt-6 flex flex-col gap-4">
        <AccountManagementSection
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSignOut={handleSignOut}
          showDeleteAccountConfirm={showDeleteAccountConfirm}
          setShowDeleteAccountConfirm={setShowDeleteAccountConfirm}
          deletingAccount={deletingAccount}
          onDeleteAccount={() => handleDeleteAccount()}
        />

        <div className="text-center text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest">
          Version 1.0.0 (Stable)
        </div>
      </div>

      {showReauthModal && (
        <ReauthModal
          user={user}
          reauthorizing={reauthorizing}
          reauthError={reauthError}
          reauthPassword={reauthPassword}
          setReauthPassword={setReauthPassword}
          onClose={() => setShowReauthModal(false)}
          handleReauthenticateAndRetry={handleReauthenticateAndRetry}
          handlePasswordReauthenticateAndRetry={handlePasswordReauthenticateAndRetry}
        />
      )}
    </div>
  );
}
