/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, firebaseSignOut, db, googleProvider, User } from '../firebase';
import { deleteUser, reauthenticateWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { urlBase64ToUint8Array } from '../utils/pushUtils';
import { TaskCategory } from '../types';
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
  X
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
  const [smartReminders, setSmartReminders] = useState(() => {
    return localStorage.getItem('hourglass_smart_reminders') === 'true';
  });

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Check support and current subscription on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      setPermissionStatus(Notification.permission);
      checkCurrentSubscription();
    }
  }, []);

  const checkCurrentSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.warn('Failed to check push subscription:', err);
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

      // 2. Fetch public key from our server
      const response = await fetch('/api/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to retrieve VAPID public key from backend.');
      }
      const { publicKey } = await response.json();

      // 3. Register push subscription on service worker
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 4. Send subscription data to our Express backend
      const subscribeResponse = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscription,
          timezone: userTimezone,
          smartReminders: localStorage.getItem('hourglass_smart_reminders') === 'true'
        })
      });

      if (!subscribeResponse.ok) {
        throw new Error('Failed to register subscription with the backend server.');
      }

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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // 1. Unsubscribe locally
        await subscription.unsubscribe();

        // 2. Tell backend to delete
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      }

      setIsSubscribed(false);
      setSuccessMessage('Notifications disabled successfully on this device.');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to disable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSmartReminders = async () => {
    const nextVal = !smartReminders;
    setSmartReminders(nextVal);
    localStorage.setItem('hourglass_smart_reminders', String(nextVal));

    try {
      const response = await fetch('/api/smart-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          enabled: nextVal
        })
      });
      if (!response.ok) {
        throw new Error('Failed to update smart reminders on server.');
      }
    } catch (err) {
      console.error('Failed to sync smart reminders preference:', err);
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

  const handleDeleteAccount = async (forceReauth = false) => {
    if (user.uid === 'guest_user') {
      setDeletingAccount(true);
      try {
        localStorage.removeItem('hourglass_guest_user');
        localStorage.removeItem('hourglass_tasks');
        localStorage.removeItem('hourglass_exceptions');
        localStorage.removeItem('hourglass_completions');
        localStorage.removeItem('hourglass_mustdos');
        localStorage.removeItem('hourglass_templates');
        window.location.reload();
      } finally {
        setDeletingAccount(false);
      }
      return;
    }
    setDeletingAccount(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is currently signed in.');
      }

      // If we are forcing reauth, reauthenticate with popup first
      if (forceReauth) {
        try {
          await reauthenticateWithPopup(currentUser, googleProvider);
          setNeedsReauth(false);
        } catch (reauthErr: any) {
          console.error('Reauthentication failed:', reauthErr);
          if (reauthErr.code === 'auth/popup-blocked') {
            throw new Error('Re-authentication popup was blocked by your browser. Please allow popups or open the app in a new tab, then try again.');
          } else {
            throw new Error(reauthErr.message || 'Failed to verify identity. Please try again.');
          }
        }
      }

      // 1. Unsubscribe push notifications locally if active
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
      } catch (err) {
        console.warn('Failed to unsubscribe push notifications during account deletion:', err);
      }

      // 2. Fetch and delete all tasks for this user from Firestore
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });
      await Promise.all(deletePromises);

      // 3. Request server-side cleanup (subscriptions.json and tasks.json)
      const serverCleanupResponse = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      if (!serverCleanupResponse.ok) {
        console.warn('Backend server-side database cleanup failed or returned an error.');
      }

      // 4. Delete Auth user from Firebase Authentication
      await deleteUser(currentUser);

    } catch (err: any) {
      if (err && err.code === 'auth/requires-recent-login') {
        console.warn('Account deletion requires recent login. Prompting for verification.');
        setNeedsReauth(true);
        setErrorMessage('For security reasons, deleting your account requires verifying your identity. Please click "Verify Identity & Delete" below to verify and complete the deletion.');
      } else {
        console.error('Failed to completely delete account:', err);
        setErrorMessage(err.message || 'An error occurred while deleting your account. Please try again.');
      }
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

                {isSubscribed && (
                  <div className="mt-3 p-3 bg-ledger-dark/50 border border-ledger-line/50 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-ledger-paper">Smart Reminders</div>
                      <p className="text-[10px] text-ledger-paper-dim/70 mt-0.5 leading-relaxed">
                        Triggers push notifications 15 minutes before your high-priority tasks begin to help you prepare.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleSmartReminders}
                      id="smart-reminders-toggle"
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer shrink-0 flex items-center ${
                        smartReminders ? 'bg-ledger-coral justify-end' : 'bg-ledger-slate-light justify-start border border-ledger-line'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full transition-all ${
                        smartReminders ? 'bg-ledger-dark' : 'bg-ledger-paper-dim'
                      }`} />
                    </button>
                  </div>
                )}

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
                  setNeedsReauth(false);
                  setErrorMessage(null);
                }}
                disabled={deletingAccount}
                className="flex-1 h-10 bg-ledger-slate border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light active:scale-98 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAccount(needsReauth)}
                disabled={deletingAccount}
                className="flex-1 h-10 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark text-xs font-bold rounded-lg active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingAccount ? (
                  <span className="w-4 h-4 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    <span>{needsReauth ? 'Verify & Delete' : 'Delete Account'}</span>
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
              <span>Permanently Delete Account</span>
            </button>
          </div>
        )}

        <div className="text-center text-[10px] font-mono text-ledger-paper-dim/40 uppercase tracking-widest">
          Version 1.0.0 (Stable)
        </div>
      </div>

    </div>
  );
}
