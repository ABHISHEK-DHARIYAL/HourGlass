/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  getRedirectResult,
  GoogleAuthProvider,
  auth, 
  collection, 
  db, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  User,
  messaging
} from './firebase';
import { onMessage } from 'firebase/messaging';
import { Task, Recurrence, TaskException, TaskCompletion, MustDoItem, TaskTemplate, ExceptionType, CompletionStatus, TodoItem, DayReflection, DailyGoal, Habit, HabitHistory, TaskCategory } from './types';
import { formatDate, parseLocalDate, addDays, getTaskSegmentsForDate, formatHourLabel } from './utils/dateUtils';
import { logDebug } from './utils/debugLogger';
import LoginScreen from './components/LoginScreen';
import MonthView from './components/MonthView';
import DayTimelineView from './components/DayTimelineView';
import TaskEditorModal from './components/TaskEditorModal';
import SettingsView from './components/SettingsView';
import MustDoSection from './components/MustDoSection';
import HabitTrackerSection from './components/HabitTrackerSection';
import RewardConfetti from './components/RewardConfetti';
import TaskTemplateSection from './components/TaskTemplateSection';
import GlanceView from './components/GlanceView';
import GCalSyncButton from './components/GCalSyncButton';
import WeeklyReviewView from './components/WeeklyReviewView';
import ClockView from './components/ClockView';
import AnimatedHourglass from './components/AnimatedHourglass';
import HourglassPreloader from './components/HourglassPreloader';
import TodoListPage from './components/TodoListPage';
import DailyReflectionSection from './components/DailyReflectionSection';
import DailyGoalInput from './components/DailyGoalInput';
import FocusModeView from './components/FocusModeView';
import { motion, AnimatePresence } from 'motion/react';
import { getAllFromStore, putToStore, clearStore, deleteFromStore, getQueue } from './utils/offlineStore';
import { queueOfflineWrite, subscribeToSyncStatus, triggerSync, SyncStatus } from './utils/offlineSyncManager';
import { useNotifications } from './hooks/useNotifications';
import { 
  Hourglass, 
  Settings, 
  Calendar, 
  ListTodo, 
  Loader2,
  CalendarDays,
  Sparkles,
  Copy,
  LineChart,
  ArrowRight,
  Bookmark,
  Clock,
  CheckSquare,
  Search,
  X,
  Target
} from 'lucide-react';

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

const getRecurrenceLabel = (task: Task) => {
  if (task.recurrence === Recurrence.NONE) {
    const d = parseLocalDate(task.anchorDate);
    return `One-time • ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  
  const anchor = parseLocalDate(task.anchorDate);
  const weekday = anchor.toLocaleDateString(undefined, { weekday: 'long' });
  const dayOfMonth = anchor.getDate();
  const monthName = anchor.toLocaleDateString(undefined, { month: 'long' });
  
  switch (task.recurrence) {
    case Recurrence.DAILY:
      return 'Repeats Daily';
    case Recurrence.WEEKLY:
      return `Repeats Weekly on ${weekday}s`;
    case Recurrence.MONTHLY:
      return `Repeats Monthly on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
    case Recurrence.YEARLY:
      return `Repeats Yearly on ${monthName} ${dayOfMonth}`;
    default:
      return 'Repeats';
  }
};

const DEFAULT_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#6678a3' }, // Indigo Clay
  { id: 'personal', name: 'Personal', color: '#e56b55' }, // Coral
  { id: 'fitness', name: 'Fitness', color: '#3f7c62' }, // Teal Sage
  { id: 'leisure', name: 'Leisure', color: '#d4af37' }, // Muted Gold
  { id: 'study', name: 'Study', color: '#8a5a82' }, // Plum Ink
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Real-time Firestore Collections States
  const [tasks, rawSetTasks] = useState<Task[]>([]);
  const setTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    rawSetTasks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      logDebug(`[setTasks] State update count: ${prev.length} -> ${next.length}`);
      logDebug(`[setTasks] State before update: ${JSON.stringify(prev.map(t => ({ id: t.id, title: t.title, userId: t.userId, anchorDate: t.anchorDate, recurrence: t.recurrence })))}`);
      logDebug(`[setTasks] State after update: ${JSON.stringify(next.map(t => ({ id: t.id, title: t.title, userId: t.userId, anchorDate: t.anchorDate, recurrence: t.recurrence })))}`);
      return next;
    });
  };
  const [exceptions, setExceptions] = useState<TaskException[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [mustdos, setMustdos] = useState<MustDoItem[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [reflections, setReflections] = useState<DayReflection[]>([]);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitHistory, setHabitHistory] = useState<HabitHistory[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('Synced');
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  // Subscribe to sync status updates
  useEffect(() => {
    return subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Load initial cached data from IndexedDB on startup
  useEffect(() => {
    if (!user) {
      setIsCacheLoaded(false);
      return;
    }
    const loadCachedData = async () => {
      console.log('[StartupCache] Load initiated for user:', user.uid);
      try {
        const [
          cachedTasks,
          cachedExceptions,
          cachedCompletions,
          cachedMustdos,
          cachedTemplates,
          cachedTodos,
          cachedReflections,
          cachedDailyGoals,
          cachedHabits,
          cachedHabitHistory,
          cachedCategories
        ] = await Promise.all([
          getAllFromStore<Task>('tasks'),
          getAllFromStore<TaskException>('exceptions'),
          getAllFromStore<TaskCompletion>('completions'),
          getAllFromStore<MustDoItem>('mustdos'),
          getAllFromStore<TaskTemplate>('templates'),
          getAllFromStore<TodoItem>('todos'),
          getAllFromStore<DayReflection>('day_reflections'),
          getAllFromStore<DailyGoal>('daily_goals'),
          getAllFromStore<Habit>('habits'),
          getAllFromStore<HabitHistory>('habit_history'),
          getAllFromStore<TaskCategory>('categories')
        ]);

        console.log('[StartupCache] Loaded sizes from IndexedDB:', {
          tasks: cachedTasks.length,
          exceptions: cachedExceptions.length,
          completions: cachedCompletions.length,
          mustdos: cachedMustdos.length,
          templates: cachedTemplates.length,
          todos: cachedTodos.length,
          reflections: cachedReflections.length,
          dailyGoals: cachedDailyGoals.length,
          habits: cachedHabits.length,
          habitHistory: cachedHabitHistory.length,
          categories: cachedCategories.length
        });

        if (cachedTasks.length > 0) setTasks(cachedTasks);
        if (cachedExceptions.length > 0) setExceptions(cachedExceptions);
        if (cachedCompletions.length > 0) setCompletions(cachedCompletions);
        if (cachedMustdos.length > 0) setMustdos(cachedMustdos);
        if (cachedTemplates.length > 0) setTemplates(cachedTemplates);
        if (cachedTodos.length > 0) setTodos(cachedTodos);
        if (cachedReflections.length > 0) setReflections(cachedReflections);
        if (cachedDailyGoals.length > 0) setDailyGoals(cachedDailyGoals);
        if (cachedHabits.length > 0) setHabits(cachedHabits);
        if (cachedHabitHistory.length > 0) setHabitHistory(cachedHabitHistory);
        if (cachedCategories.length > 0) setCategories(cachedCategories);
      } catch (err) {
        console.warn('[StartupCache] Failed to load initial offline IndexedDB cache:', err);
      } finally {
        setIsCacheLoaded(true);
        console.log('[StartupCache] Initial cache load completed. isCacheLoaded marked true.');
      }
    };
    loadCachedData();
  }, [user]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatDate(new Date()));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultStartHour, setDefaultStartHour] = useState(9);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'both' | 'month' | 'day' | 'review' | 'clock' | 'todos'>('month');
  const [quote, setQuote] = useState<{ text: string; author: string }>(() => {
    return {
      text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
      author: "Stephen Covey"
    };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    return localStorage.getItem('hourglass_focus_mode') === 'true';
  });
  
  const [theme, setTheme] = useState<'dark' | 'paper'>(() => {
    const saved = localStorage.getItem('hourglass_theme');
    return (saved === 'paper' ? 'paper' : 'dark') as 'dark' | 'paper';
  });

  // Keep HTML class in sync with theme state
  useEffect(() => {
    if (theme === 'paper') {
      document.documentElement.classList.add('theme-paper');
    } else {
      document.documentElement.classList.remove('theme-paper');
    }
    localStorage.setItem('hourglass_theme', theme);
  }, [theme]);

  // Fetch inspirational quote
  useEffect(() => {
    fetch('/api/quote')
      .then(res => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.text && data.author) {
          setQuote(data);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch quote:', err);
        // Fallback is already loaded as the initial state
      });
  }, []);

  // Wrapper handlers for the useNotifications engine
  const handleSaveCompletionDirect = async (comp: TaskCompletion) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      const updatedList = [
        ...completions.filter(c => c.id !== comp.id),
        comp
      ];
      saveGuestCompletions(updatedList);
      return;
    }
    try {
      const updatedComp = {
        ...comp,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };
      setCompletions(prev => [...prev.filter(c => c.id !== comp.id), updatedComp]); // Optimistic update
      await queueOfflineWrite(user.uid, 'completions', comp.id, 'set', updatedComp);
    } catch (err) {
      console.error('Failed to save completion direct:', err);
    }
  };

  const handleSaveExceptionDirect = async (exc: TaskException) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      const updatedList = [
        ...exceptions.filter(e => e.id !== exc.id),
        exc
      ];
      saveGuestExceptions(updatedList);
      return;
    }
    try {
      const updatedExc = {
        ...exc,
        userId: user.uid
      };
      setExceptions(prev => [...prev.filter(e => e.id !== exc.id), updatedExc]); // Optimistic update
      await queueOfflineWrite(user.uid, 'exceptions', exc.id, 'set', updatedExc);
    } catch (err) {
      console.error('Failed to save exception direct:', err);
    }
  };

  const handleSaveTaskDirect = async (tData: Partial<Task>) => {
    if (!user) return;
    const tId = tData.id;
    if (!tId) return;
    
    if (user.uid === 'guest_user') {
      const updatedList = tasks.map(t => t.id === tId ? { ...t, ...tData, updatedAt: new Date().toISOString() } : t);
      saveGuestTasks(updatedList);
      return;
    }
    try {
      setTasks(prev => prev.map(t => t.id === tId ? { ...t, ...tData, updatedAt: new Date().toISOString() } : t)); // Optimistic update
      const existingTask = tasks.find(t => t.id === tId) || {};
      const updatedTask = {
        ...existingTask,
        ...tData,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };
      await queueOfflineWrite(user.uid, 'tasks', tId, 'set', updatedTask);
    } catch (err) {
      console.error('Failed to save task direct:', err);
    }
  };

  const {
    activeNotifications,
    handleDismissNotification,
    handleExecuteNotificationAction
  } = useNotifications({
    userId: user?.uid || '',
    tasks,
    exceptions,
    completions,
    habits,
    habitHistory,
    onSaveCompletion: handleSaveCompletionDirect,
    onSaveException: handleSaveExceptionDirect,
    onSaveTask: handleSaveTaskDirect,
    onToggleHabit: handleToggleHabit
  });

  // Listen to background service worker events for system notification actions click
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_ACTION_CLICK') {
        const action = event.data.action;
        handleExecuteNotificationAction(`bg_push_${Date.now()}`, action);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [handleExecuteNotificationAction]);

  // Listen to foreground FCM notifications
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Received foreground FCM message:', payload);
      const title = payload.notification?.title || payload.data?.title || 'Hourglass Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=192&h=192&q=80'
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [messaging]);

  // Copying state & UI inputs
  const [showCopyDayDialog, setShowCopyDayDialog] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(formatDate(new Date()));
  
  const [showCopyWeekDialog, setShowCopyWeekDialog] = useState(false);
  const [copyTargetWeekMonday, setCopyTargetWeekMonday] = useState(formatDate(new Date()));

  // Listen for Auth changes
  useEffect(() => {
    const isGuest = localStorage.getItem('hourglass_guest_user') === 'true';
    if (isGuest) {
      setUser({
        uid: 'guest_user',
        displayName: 'Guest User',
        email: 'guest@example.com',
        photoURL: null,
      } as User);
      setAuthLoading(false);
      return;
    }

    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            localStorage.setItem('google_access_token', credential.accessToken);
          }
        }
      })
      .catch((err) => {
        console.warn('App getRedirectResult error:', err);
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      setShowSettings(false);
      if (firebaseUser) {
        setViewMode('month');
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper to safely merge Firestore snapshots with pending offline queue and local IndexedDB store items
  const syncCollectionWithSnapshot = async <T extends { id: string }>(
    collectionName: string,
    firestoreList: T[],
    setState: (updater: T[] | ((prev: T[]) => T[])) => void
  ) => {
    try {
      const queue = await getQueue();
      const pendingItems = queue.filter(q => q.collectionName === collectionName);
      const pendingDeletes = new Set(pendingItems.filter(q => q.action === 'delete').map(q => q.itemId));
      const localItems = await getAllFromStore<T>(collectionName);

      const mergedMap = new Map<string, T>();

      // 1. Add Firestore items that have not been pending-deleted locally
      firestoreList.forEach(item => {
        if (!pendingDeletes.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      // 2. Add local store items that are not in Firestore yet and not pending-deleted
      localItems.forEach(item => {
        if (!pendingDeletes.has(item.id) && !mergedMap.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });

      // 3. Add or overwrite pending 'set' queue items (local user actions are most recent)
      pendingItems.forEach(q => {
        if (q.action === 'set' && q.data) {
          mergedMap.set(q.itemId, { id: q.itemId, ...q.data } as T);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      setState(mergedList);

      // Persist merged set back to local IndexedDB
      await clearStore(collectionName);
      for (const item of mergedList) {
        await putToStore(collectionName, item);
      }
    } catch (err) {
      console.error(`[syncCollectionWithSnapshot] Failed to merge ${collectionName}:`, err);
      setState(firestoreList);
    }
  };

  // Guest Storage Helpers
  const saveGuestTasks = (newList: Task[]) => {
    setTasks(newList);
    localStorage.setItem('hourglass_tasks', JSON.stringify(newList));
    clearStore('tasks').then(() => {
      newList.forEach(item => putToStore('tasks', item));
    });
  };
  const saveGuestExceptions = (newList: TaskException[]) => {
    setExceptions(newList);
    localStorage.setItem('hourglass_exceptions', JSON.stringify(newList));
    clearStore('exceptions').then(() => {
      newList.forEach(item => putToStore('exceptions', item));
    });
  };
  const saveGuestCompletions = (newList: TaskCompletion[]) => {
    setCompletions(newList);
    localStorage.setItem('hourglass_completions', JSON.stringify(newList));
    clearStore('completions').then(() => {
      newList.forEach(item => putToStore('completions', item));
    });
  };
  const saveGuestMustdos = (newList: MustDoItem[]) => {
    setMustdos(newList);
    localStorage.setItem('hourglass_mustdos', JSON.stringify(newList));
    clearStore('mustdos').then(() => {
      newList.forEach(item => putToStore('mustdos', item));
    });
  };
  const saveGuestTemplates = (newList: TaskTemplate[]) => {
    setTemplates(newList);
    localStorage.setItem('hourglass_templates', JSON.stringify(newList));
    clearStore('templates').then(() => {
      newList.forEach(item => putToStore('templates', item));
    });
  };
  const saveGuestTodos = (newList: TodoItem[]) => {
    setTodos(newList);
    localStorage.setItem('hourglass_todos', JSON.stringify(newList));
    clearStore('todos').then(() => {
      newList.forEach(item => putToStore('todos', item));
    });
  };
  const saveGuestReflections = (newList: DayReflection[]) => {
    setReflections(newList);
    localStorage.setItem('hourglass_reflections', JSON.stringify(newList));
    clearStore('day_reflections').then(() => {
      newList.forEach(item => putToStore('day_reflections', item));
    });
  };
  const saveGuestDailyGoals = (newList: DailyGoal[]) => {
    setDailyGoals(newList);
    localStorage.setItem('hourglass_daily_goals', JSON.stringify(newList));
    clearStore('daily_goals').then(() => {
      newList.forEach(item => putToStore('daily_goals', item));
    });
  };
  const saveGuestHabits = (newList: Habit[]) => {
    setHabits(newList);
    localStorage.setItem('hourglass_habits', JSON.stringify(newList));
    clearStore('habits').then(() => {
      newList.forEach(item => putToStore('habits', item));
    });
  };
  const saveGuestHabitHistory = (newList: HabitHistory[]) => {
    setHabitHistory(newList);
    localStorage.setItem('hourglass_habit_history', JSON.stringify(newList));
    clearStore('habit_history').then(() => {
      newList.forEach(item => putToStore('habit_history', item));
    });
  };
  const saveGuestCategories = (newList: TaskCategory[]) => {
    setCategories(newList);
    localStorage.setItem('hourglass_categories', JSON.stringify(newList));
    clearStore('categories').then(() => {
      newList.forEach(item => putToStore('categories', item));
    });
  };

  // Set up real-time listener for tasks
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTasks([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_tasks');
      setTasks(stored ? JSON.parse(stored) : []);
      return;
    }
    logDebug(`[onSnapshot] Subscribing to tasks collection for user: userId="${user.uid}"`);
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      logDebug(`[onSnapshot] snapshot_received: collection=tasks, size=${snapshot.size}, fromCache=${snapshot.metadata.fromCache}, hasPendingWrites=${snapshot.metadata.hasPendingWrites}`);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logDebug(`[onSnapshot] snapshot_item: docId="${docSnap.id}", userId="${data.userId}", title="${data.title}", anchorDate="${data.anchorDate}", recurrence="${data.recurrence}"`);
        list.push({ id: docSnap.id, ...data } as Task);
      });
      logDebug(`[onSnapshot] Snapshot processing complete: listCount=${list.length}`);
      syncCollectionWithSnapshot('tasks', list, setTasks);
    }, (err: any) => {
      logDebug(`[onSnapshot] [ERROR] Tasks listener error: ${err?.message || err}`, 'ERROR');
    });
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for exceptions
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setExceptions([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_exceptions');
      setExceptions(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to exceptions collection for user:', user.uid);
    const q = query(collection(db, 'exceptions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskException[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as TaskException);
      });
      console.log(`[Firestore] Snapshot received: exceptions count = ${list.length}`);
      syncCollectionWithSnapshot('exceptions', list, setExceptions);
    }, (err) => console.error('[Firestore] Exceptions listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for completions
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setCompletions([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_completions');
      setCompletions(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to completions collection for user:', user.uid);
    const q = query(collection(db, 'completions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskCompletion[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as TaskCompletion);
      });
      console.log(`[Firestore] Snapshot received: completions count = ${list.length}`);
      syncCollectionWithSnapshot('completions', list, setCompletions);
    }, (err) => console.error('[Firestore] Completions listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for daily must-dos
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setMustdos([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_mustdos');
      setMustdos(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to mustdos collection for user:', user.uid);
    const q = query(collection(db, 'mustdos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MustDoItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as MustDoItem);
      });
      console.log(`[Firestore] Snapshot received: mustdos count = ${list.length}`);
      syncCollectionWithSnapshot('mustdos', list, setMustdos);
    }, (err) => console.error('[Firestore] Must-dos listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for templates
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTemplates([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_templates');
      setTemplates(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to templates collection for user:', user.uid);
    const q = query(collection(db, 'templates'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskTemplate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as TaskTemplate);
      });
      console.log(`[Firestore] Snapshot received: templates count = ${list.length}`);
      syncCollectionWithSnapshot('templates', list, setTemplates);
    }, (err) => console.error('[Firestore] Templates listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for todos
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTodos([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_todos');
      setTodos(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to todos collection for user:', user.uid);
    const q = query(collection(db, 'todos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TodoItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as TodoItem);
      });
      console.log(`[Firestore] Snapshot received: todos count = ${list.length}`);
      syncCollectionWithSnapshot('todos', list, setTodos);
    }, (err) => console.error('[Firestore] Todos listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for day_reflections
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setReflections([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_reflections');
      setReflections(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to day_reflections collection for user:', user.uid);
    const q = query(collection(db, 'day_reflections'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DayReflection[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as DayReflection);
      });
      console.log(`[Firestore] Snapshot received: day_reflections count = ${list.length}`);
      syncCollectionWithSnapshot('day_reflections', list, setReflections);
    }, (err) => console.error('[Firestore] Day reflections listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for daily_goals
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setDailyGoals([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_daily_goals');
      setDailyGoals(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to daily_goals collection for user:', user.uid);
    const q = query(collection(db, 'daily_goals'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DailyGoal[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as DailyGoal);
      });
      console.log(`[Firestore] Snapshot received: daily_goals count = ${list.length}`);
      syncCollectionWithSnapshot('daily_goals', list, setDailyGoals);
    }, (err) => console.error('[Firestore] Daily goals listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for habits
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setHabits([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habits');
      setHabits(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to habits collection for user:', user.uid);
    const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Habit[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as Habit);
      });
      console.log(`[Firestore] Snapshot received: habits count = ${list.length}`);
      syncCollectionWithSnapshot('habits', list, setHabits);
    }, (err) => console.error('[Firestore] Habits listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for habit history
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setHabitHistory([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habit_history');
      setHabitHistory(stored ? JSON.parse(stored) : []);
      return;
    }
    console.log('[Firestore] Subscribing to habit_history collection for user:', user.uid);
    const q = query(collection(db, 'habit_history'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: HabitHistory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as HabitHistory);
      });
      console.log(`[Firestore] Snapshot received: habit_history count = ${list.length}`);
      syncCollectionWithSnapshot('habit_history', list, setHabitHistory);
    }, (err) => console.error('[Firestore] Habit history listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Set up real-time listener for categories
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setCategories([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_categories');
      const list = stored ? JSON.parse(stored) : [];
      if (list.length === 0) {
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: user.uid,
          createdAt: new Date().toISOString()
        }));
        saveGuestCategories(seeded);
      } else {
        list.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
        setCategories(list);
      }
      return;
    }
    console.log('[Firestore] Subscribing to categories collection for user:', user.uid);
    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: TaskCategory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as TaskCategory);
      });
      console.log(`[Firestore] Snapshot received: categories count = ${list.length}`);
      
      if (list.length === 0) {
        const isDeleting = localStorage.getItem('hourglass_deleting_account') === 'true';
        if (isDeleting || !auth.currentUser) {
          setCategories([]);
          return;
        }
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: user.uid,
          createdAt: new Date().toISOString()
        }));
        console.log('[Firestore] Seeding default categories for user:', user.uid);
        for (const cat of seeded) {
          const docRef = doc(db, 'categories', `${user.uid}_${cat.id}`);
          await setDoc(docRef, cat, { merge: true });
        }
      } else {
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
        syncCollectionWithSnapshot('categories', list, setCategories);
      }
    }, (err) => console.error('[Firestore] Categories listener error:', err));
    return () => unsubscribe();
  }, [user, isCacheLoaded]);

  // Save/Update/Delete Category handlers
  const handleAddCategory = async (name: string, color: string) => {
    if (!user) return;
    const catId = `cat_${Date.now()}`;
    const newCat: TaskCategory = {
      id: catId,
      userId: user.uid,
      name,
      color,
      createdAt: new Date().toISOString()
    };

    if (user.uid === 'guest_user') {
      saveGuestCategories([...categories, newCat]);
      return;
    }

    try {
      setCategories(prev => [...prev, newCat]); // Optimistic update
      await queueOfflineWrite(user.uid, 'categories', catId, 'set', newCat);
    } catch (err) {
      console.error('Failed to add category:', err);
    }
  };

  const handleUpdateCategory = async (id: string, name: string, color: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = categories.map(c => c.id === id ? { ...c, name, color } : c);
      saveGuestCategories(newList);
      return;
    }

    try {
      const updatedCat = { id, userId: user.uid, name, color, createdAt: new Date().toISOString() };
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name, color } : c)); // Optimistic update
      await queueOfflineWrite(user.uid, 'categories', id, 'set', updatedCat);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = categories.filter(c => c.id !== id);
      saveGuestCategories(newList);
      return;
    }

    try {
      setCategories(prev => prev.filter(c => c.id !== id)); // Optimistic update
      await queueOfflineWrite(user.uid, 'categories', id, 'delete');
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Sync tasks with server for background push notifications
  useEffect(() => {
    if (user && user.uid !== 'guest_user' && tasks.length > 0) {
      fetch('/api/sync-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, tasks })
      }).catch(err => console.error('Failed to sync tasks with backend:', err));
    }
  }, [user, tasks]);

  // Save (Create/Update) a task series
  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!user) return;

    try {
      const sanitizedData = Object.entries(taskData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      if (user.uid === 'guest_user') {
        if (taskToEdit && taskToEdit.id) {
          const newList = tasks.map(t => t.id === taskToEdit.id ? { ...t, ...sanitizedData, updatedAt: new Date().toISOString() } : t) as Task[];
          saveGuestTasks(newList);
        } else {
          const newTask: Task = {
            ...sanitizedData,
            id: `task_${Date.now()}`,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Task;
          saveGuestTasks([...tasks, newTask]);
        }
        setIsEditorOpen(false);
        setTaskToEdit(null);
        if (taskData.anchorDate) {
          setSelectedDateStr(taskData.anchorDate);
        }
        if (viewMode !== 'both' && viewMode !== 'day') {
          setViewMode('both');
        }
        return;
      }

      if (taskToEdit && taskToEdit.id) {
        // Edit entire series (or single non-recurring)
        const updatedTask = {
          ...taskToEdit,
          ...sanitizedData,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        } as Task;
        setTasks(prev => prev.map(t => t.id === taskToEdit.id ? updatedTask : t)); // Optimistic update
        await queueOfflineWrite(user.uid, 'tasks', taskToEdit.id, 'set', updatedTask);
      } else {
        // Create new series
        const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTask = {
          ...sanitizedData,
          id: newTaskId,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Task;
        setTasks(prev => [...prev, newTask]); // Optimistic update
        await queueOfflineWrite(user.uid, 'tasks', newTaskId, 'set', newTask);
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
      if (taskData.anchorDate) {
        setSelectedDateStr(taskData.anchorDate);
      }
      if (viewMode !== 'both' && viewMode !== 'day') {
        setViewMode('both');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task block. Please check connection and try again.');
      throw error;
    }
  };

  // Save a single-occurrence exception (override fields just for this date)
  const handleSaveException = async (excData: TaskException) => {
    if (!user) return;
    try {
      if (user.uid === 'guest_user') {
        const idx = exceptions.findIndex(e => e.id === excData.id);
        let newList: TaskException[];
        if (idx !== -1) {
          newList = exceptions.map(e => e.id === excData.id ? excData : e);
        } else {
          newList = [...exceptions, excData];
        }
        saveGuestExceptions(newList);
        setIsEditorOpen(false);
        setTaskToEdit(null);
        if (excData.date) {
          setSelectedDateStr(excData.date);
        }
        if (viewMode !== 'both' && viewMode !== 'day') {
          setViewMode('both');
        }
        return;
      }

      const updatedExc = {
        ...excData,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };
      setExceptions(prev => {
        const idx = prev.findIndex(e => e.id === excData.id);
        if (idx !== -1) return prev.map(e => e.id === excData.id ? updatedExc : e);
        return [...prev, updatedExc];
      }); // Optimistic update
      await queueOfflineWrite(user.uid, 'exceptions', excData.id, 'set', updatedExc);

      setIsEditorOpen(false);
      setTaskToEdit(null);
      if (excData.date) {
        setSelectedDateStr(excData.date);
      }
      if (viewMode !== 'both' && viewMode !== 'day') {
        setViewMode('both');
      }
    } catch (error) {
      console.error('Error saving task exception:', error);
      alert('Failed to save task exception.');
      throw error;
    }
  };

  // Delete a task series or a single occurrence
  const handleDeleteTask = async (taskId: string, deleteOption: 'one' | 'all' = 'all') => {
    if (!user) return;
    try {
      if (user.uid === 'guest_user') {
        if (deleteOption === 'one') {
          const exceptionId = `${taskId}_${selectedDateStr}`;
          const newException: TaskException = {
            id: exceptionId,
            userId: user.uid,
            taskId,
            date: selectedDateStr,
            type: ExceptionType.SKIPPED,
          };
          saveGuestExceptions([...exceptions, newException]);
        } else {
          saveGuestTasks(tasks.filter(t => t.id !== taskId));
        }
        setIsEditorOpen(false);
        setTaskToEdit(null);
        return;
      }

      if (deleteOption === 'one') {
        // Exclude single occurrence by saving exception of type SKIPPED
        const exceptionId = `${taskId}_${selectedDateStr}`;
        const newException: TaskException = {
          id: exceptionId,
          userId: user.uid,
          taskId,
          date: selectedDateStr,
          type: ExceptionType.SKIPPED
        };
        setExceptions(prev => [...prev, newException]); // Optimistic update
        await queueOfflineWrite(user.uid, 'exceptions', exceptionId, 'set', newException);
      } else {
        // Delete entire series
        setTasks(prev => prev.filter(t => t.id !== taskId)); // Optimistic update
        await queueOfflineWrite(user.uid, 'tasks', taskId, 'delete');
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task.');
    }
  };

  // Quick select a template to book
  const handleSelectTemplate = (template: Partial<TaskTemplate>) => {
    setTaskToEdit(null);
    setTitlePresetFromTemplate(template);
  };

  const setTitlePresetFromTemplate = (template: Partial<TaskTemplate>) => {
    // Create pre-filled state
    setDefaultStartHour(template.startHour ?? 9);
    setTaskToEdit({
      id: '',
      userId: user?.uid || '',
      title: template.title || '',
      notes: template.notes || '',
      startHour: template.startHour ?? 9,
      endHour: template.endHour ?? 10,
      anchorDate: selectedDateStr,
      recurrence: template.recurrence || Recurrence.NONE,
      notifyEnabled: false,
      priority: template.priority || false,
      color: template.categoryColor || '#e56b55',
      createdAt: '',
      updatedAt: ''
    });
    setIsEditorOpen(true);
  };

  // Duplicate Day Scheduled Blocks Action
  const handleCopyDay = async () => {
    const dayTasks = tasks.filter(t => t.anchorDate === selectedDateStr && t.recurrence === Recurrence.NONE);
    if (dayTasks.length === 0) {
      alert('No non-recurring blocks found on this day to duplicate.');
      return;
    }

    if (user && user.uid === 'guest_user') {
      const newTasks: Task[] = dayTasks.map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        userId: user.uid,
        title: t.title,
        notes: t.notes || '',
        startHour: t.startHour,
        endHour: t.endHour,
        anchorDate: copyTargetDate,
        recurrence: Recurrence.NONE,
        notifyEnabled: t.notifyEnabled,
        color: t.color,
        priority: t.priority || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      saveGuestTasks([...tasks, ...newTasks]);
      setShowCopyDayDialog(false);
      setSelectedDateStr(copyTargetDate);
      alert(`Successfully duplicated ${dayTasks.length} blocks to ${copyTargetDate}!`);
      return;
    }

    try {
      const newTasks: Task[] = [];
      for (const t of dayTasks) {
        const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTask = {
          userId: user.uid,
          id: newId,
          title: t.title,
          notes: t.notes || '',
          startHour: t.startHour,
          endHour: t.endHour,
          anchorDate: copyTargetDate,
          recurrence: Recurrence.NONE,
          notifyEnabled: t.notifyEnabled,
          color: t.color,
          priority: t.priority || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Task;
        newTasks.push(newTask);
        await queueOfflineWrite(user.uid, 'tasks', newId, 'set', newTask);
      }
      setTasks(prev => [...prev, ...newTasks]); // Optimistic update
      setShowCopyDayDialog(false);
      setSelectedDateStr(copyTargetDate);
      alert(`Successfully duplicated ${dayTasks.length} blocks to ${copyTargetDate}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to duplicate day blocks.');
    }
  };

  // Duplicate Week Scheduled Blocks Action
  const handleCopyWeek = async () => {
    // Determine the source Monday of the current selectedDateStr
    const sourceDateObj = parseLocalDate(selectedDateStr);
    const dayOfWeek = sourceDateObj.getDay(); // Sunday is 0
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const sourceMondayObj = new Date(sourceDateObj);
    sourceMondayObj.setDate(sourceDateObj.getDate() + offsetToMonday);
    const sourceMondayStr = formatDate(sourceMondayObj);

    // Generate dates for source week
    const sourceDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sourceMondayObj);
      d.setDate(sourceMondayObj.getDate() + i);
      sourceDates.push(formatDate(d));
    }

    // Generate dates for target week based on chosen copyTargetWeekMonday
    const targetMondayObj = parseLocalDate(copyTargetWeekMonday);
    const targetDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMondayObj);
      d.setDate(targetMondayObj.getDate() + i);
      targetDates.push(formatDate(d));
    }

    // Filter non-recurring blocks of source week
    const weekTasks = tasks.filter(t => t.recurrence === Recurrence.NONE && sourceDates.includes(t.anchorDate));
    if (weekTasks.length === 0) {
      alert('No non-recurring blocks found in this week to duplicate.');
      return;
    }

    if (user && user.uid === 'guest_user') {
      const newTasks: Task[] = [];
      for (const t of weekTasks) {
        const dayIdx = sourceDates.indexOf(t.anchorDate);
        if (dayIdx !== -1) {
          const targetDate = targetDates[dayIdx];
          newTasks.push({
            id: `task_${Date.now()}_${newTasks.length}`,
            userId: user.uid,
            title: t.title,
            notes: t.notes || '',
            startHour: t.startHour,
            endHour: t.endHour,
            anchorDate: targetDate,
            recurrence: Recurrence.NONE,
            notifyEnabled: t.notifyEnabled,
            color: t.color,
            priority: t.priority || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      saveGuestTasks([...tasks, ...newTasks]);
      setShowCopyWeekDialog(false);
      setSelectedDateStr(copyTargetWeekMonday);
      alert(`Successfully duplicated ${weekTasks.length} blocks to week starting ${copyTargetWeekMonday}!`);
      return;
    }

    try {
      const newTasks: Task[] = [];
      for (const t of weekTasks) {
        const dayIdx = sourceDates.indexOf(t.anchorDate);
        if (dayIdx !== -1) {
          const targetDate = targetDates[dayIdx];
          const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newTask = {
            userId: user.uid,
            id: newId,
            title: t.title,
            notes: t.notes || '',
            startHour: t.startHour,
            endHour: t.endHour,
            anchorDate: targetDate,
            recurrence: Recurrence.NONE,
            notifyEnabled: t.notifyEnabled,
            color: t.color,
            priority: t.priority || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Task;
          newTasks.push(newTask);
          await queueOfflineWrite(user.uid, 'tasks', newId, 'set', newTask);
        }
      }
      setTasks(prev => [...prev, ...newTasks]); // Optimistic update
      setShowCopyWeekDialog(false);
      setSelectedDateStr(copyTargetWeekMonday);
      alert(`Successfully duplicated ${weekTasks.length} blocks to week starting ${copyTargetWeekMonday}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to duplicate week blocks.');
    }
  };

  const handleMoveTasks = async (taskIds: string[], targetDate: string) => {
    if (!user) return;
    if (taskIds.length === 0) return;

    if (user.uid === 'guest_user') {
      const newList = tasks.map(t => taskIds.includes(t.id) ? { ...t, anchorDate: targetDate, updatedAt: new Date().toISOString() } : t);
      saveGuestTasks(newList);
      setSelectedDateStr(targetDate);
      return;
    }

    try {
      setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, anchorDate: targetDate, updatedAt: new Date().toISOString() } : t)); // Optimistic update
      for (const taskId of taskIds) {
        const existingTask = tasks.find(t => t.id === taskId) || {};
        const updatedTask = {
          ...existingTask,
          userId: user.uid,
          anchorDate: targetDate,
          updatedAt: new Date().toISOString()
        };
        await queueOfflineWrite(user.uid, 'tasks', taskId, 'set', updatedTask);
      }
      setSelectedDateStr(targetDate);
    } catch (err) {
      console.error('Error moving tasks:', err);
      alert('Failed to move tasks.');
    }
  };

  const handleAddHabit = async (title: string, color: string) => {
    if (!user) return;
    const newHabit: Habit = {
      id: 'habit_' + Math.random().toString(36).substr(2, 9),
      userId: user.uid,
      title,
      color,
      createdAt: new Date().toISOString()
    };

    if (user.uid === 'guest_user') {
      saveGuestHabits([...habits, newHabit]);
      return;
    }

    try {
      setHabits(prev => [...prev, newHabit]); // Optimistic update
      await queueOfflineWrite(user.uid, 'habits', newHabit.id, 'set', newHabit);
    } catch (err) {
      console.error('Failed to create habit:', err);
    }
  };

  async function handleToggleHabit(habitId: string, date: string, done: boolean) {
    if (!user) return;
    const histId = `${habitId}_${date}`;
    const newHist: HabitHistory = {
      id: histId,
      habitId,
      date,
      done
    };

    if (user.uid === 'guest_user') {
      if (!done) {
        saveGuestHabitHistory(habitHistory.filter(h => h.id !== histId));
      } else {
        saveGuestHabitHistory([...habitHistory.filter(h => h.id !== histId), { ...newHist, userId: user.uid }]);
      }
      return;
    }

    try {
      if (!done) {
        setHabitHistory(prev => prev.filter(h => h.id !== histId)); // Optimistic update
        await queueOfflineWrite(user.uid, 'habit_history', histId, 'delete');
      } else {
        const fullHist = { ...newHist, userId: user.uid };
        setHabitHistory(prev => [...prev.filter(h => h.id !== histId), fullHist]); // Optimistic update
        await queueOfflineWrite(user.uid, 'habit_history', histId, 'set', fullHist);
      }
    } catch (err) {
      console.error('Failed to toggle habit status:', err);
    }
  }

  const handleDeleteHabit = async (habitId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestHabits(habits.filter(h => h.id !== habitId));
      saveGuestHabitHistory(habitHistory.filter(h => h.habitId !== habitId));
      return;
    }

    try {
      setHabits(prev => prev.filter(h => h.id !== habitId)); // Optimistic update
      await queueOfflineWrite(user.uid, 'habits', habitId, 'delete');
    } catch (err) {
      console.error('Failed to delete habit:', err);
    }
  };

  const handleUpdateTaskTimes = async (taskId: string, startHour: number, endHour: number) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = tasks.map(t => t.id === taskId ? { ...t, startHour, endHour, updatedAt: new Date().toISOString() } : t);
      saveGuestTasks(newList);
      return;
    }

    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, startHour, endHour, updatedAt: new Date().toISOString() } : t)); // Optimistic update
      const existingTask = tasks.find(t => t.id === taskId) || {};
      const updatedTask = {
        ...existingTask,
        userId: user.uid,
        startHour,
        endHour,
        updatedAt: new Date().toISOString()
      };
      await queueOfflineWrite(user.uid, 'tasks', taskId, 'set', updatedTask);
    } catch (err) {
      console.error('Failed to drag and drop task update:', err);
    }
  };

  const handleScheduleTodo = async (todoId: string, title: string, notes: string, date: string, startHour: number, endHour: number, priority?: boolean) => {
    if (!user) return;
    const newTaskId = 'task_' + Math.random().toString(36).substr(2, 9);
    const newTask: Task = {
      id: newTaskId,
      userId: user.uid,
      title,
      notes,
      startHour,
      endHour,
      anchorDate: date,
      recurrence: Recurrence.NONE,
      notifyEnabled: true,
      priority: priority ?? false,
      color: '#e56b55', // default coral
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (user.uid === 'guest_user') {
      saveGuestTasks([...tasks, newTask]);
      saveGuestTodos(todos.map(t => t.id === todoId ? { ...t, done: true, completedAt: new Date().toISOString() } : t));
      return;
    }

    try {
      // Optimistic updates
      setTasks(prev => [...prev, newTask]);
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, done: true, completedAt: new Date().toISOString() } : t));

      // Create scheduled task block and complete todo in offline store
      await queueOfflineWrite(user.uid, 'tasks', newTaskId, 'set', newTask);

      const existingTodo = todos.find(t => t.id === todoId) || {};
      const updatedTodo = {
        ...existingTodo,
        userId: user.uid,
        done: true,
        completedAt: new Date().toISOString()
      };
      await queueOfflineWrite(user.uid, 'todos', todoId, 'set', updatedTodo);
    } catch (err) {
      console.error('Failed to auto-schedule todo:', err);
    }
  };

  const handleOpenAddTask = (hour: number) => {
    setTaskToEdit(null);
    setDefaultStartHour(hour);
    setIsEditorOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsEditorOpen(true);
  };

  // Completion Status handler
  const handleSetCompletionStatus = async (taskId: string, date: string, status: CompletionStatus) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;

    if (user.uid === 'guest_user') {
      if (status === CompletionStatus.NO_RESPONSE) {
        saveGuestCompletions(completions.filter(c => c.id !== compId));
        return;
      }
      const newComp: TaskCompletion = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status,
        completedAt: new Date().toISOString()
      };
      const updatedCompletions = [
        ...completions.filter(c => c.id !== compId),
        newComp
      ];
      saveGuestCompletions(updatedCompletions);

      if (status === CompletionStatus.DONE) {
        const segments = getTaskSegmentsForDate(tasks, date, exceptions);
        if (segments.length > 0) {
          const allDone = segments.every(seg => {
            const c = updatedCompletions.find(comp => comp.taskId === seg.task.id && comp.date === date);
            return c?.status === CompletionStatus.DONE || c?.status === CompletionStatus.SKIPPED;
          });
          if (allDone) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 6000);
          }
        }
      }
      return;
    }

    if (status === CompletionStatus.NO_RESPONSE) {
      try {
        setCompletions(prev => prev.filter(c => c.id !== compId)); // Optimistic update
        await queueOfflineWrite(user.uid, 'completions', compId, 'delete');
      } catch (err) {
        console.error('Failed to clear completion status:', err);
      }
      return;
    }

    try {
      const newComp: TaskCompletion = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status,
        completedAt: new Date().toISOString()
      };
      setCompletions(prev => [...prev.filter(c => c.id !== compId), newComp]); // Optimistic update
      await queueOfflineWrite(user.uid, 'completions', compId, 'set', newComp);

      // Trigger confetti if all tasks on this date are finished
      if (status === CompletionStatus.DONE) {
        const segments = getTaskSegmentsForDate(tasks, date, exceptions);
        if (segments.length > 0) {
          const updatedCompletions = [
            ...completions.filter(c => c.id !== compId),
            { id: compId, taskId, date, status }
          ];
          const allDone = segments.every(seg => {
            const c = updatedCompletions.find(comp => comp.taskId === seg.task.id && comp.date === date);
            return c?.status === CompletionStatus.DONE || c?.status === CompletionStatus.SKIPPED;
          });
          if (allDone) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 6000);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save completion status:', err);
    }
  };

  // Timer Handlers
  const handleStartTimer = async (taskId: string, date: string) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;
    const nowStr = new Date().toISOString();

    const existing = completions.find(c => c.taskId === taskId && c.date === date);

    if (user.uid === 'guest_user') {
      const updated = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing?.status || CompletionStatus.NO_RESPONSE,
        completedAt: existing?.completedAt || null,
        actualDuration: existing?.actualDuration || 0,
        timerStartedAt: nowStr
      };
      saveGuestCompletions([...completions.filter(c => c.id !== compId), updated]);
      return;
    }

    try {
      const updated = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing?.status || CompletionStatus.NO_RESPONSE,
        completedAt: existing?.completedAt || null,
        actualDuration: existing?.actualDuration || 0,
        timerStartedAt: nowStr
      };
      setCompletions(prev => [...prev.filter(c => c.id !== compId), updated]); // Optimistic update
      await queueOfflineWrite(user.uid, 'completions', compId, 'set', updated);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  const handleStopTimer = async (taskId: string, date: string) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;

    const existing = completions.find(c => c.taskId === taskId && c.date === date);
    if (!existing || !existing.timerStartedAt) return;

    const elapsed = Math.floor((Date.now() - new Date(existing.timerStartedAt).getTime()) / 1000);
    const newDuration = (existing.actualDuration || 0) + elapsed;

    if (user.uid === 'guest_user') {
      const updated = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing.status,
        completedAt: existing.completedAt || null,
        actualDuration: newDuration,
        timerStartedAt: null
      };
      saveGuestCompletions([...completions.filter(c => c.id !== compId), updated]);
      return;
    }

    try {
      const updated = {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing.status,
        completedAt: existing.completedAt || null,
        actualDuration: newDuration,
        timerStartedAt: null
      };
      setCompletions(prev => [...prev.filter(c => c.id !== compId), updated]); // Optimistic update
      await queueOfflineWrite(user.uid, 'completions', compId, 'set', updated);
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  };

  // Must-do handlers
  const handleAddMustDo = async (title: string) => {
    if (!user) return;

    const newItem: MustDoItem = {
      id: 'mustdo_' + Math.random().toString(36).substr(2, 9),
      userId: user.uid,
      date: selectedDateStr,
      title,
      done: false,
      createdAt: new Date().toISOString()
    };

    if (user.uid === 'guest_user') {
      saveGuestMustdos([...mustdos, newItem]);
      return;
    }

    try {
      setMustdos(prev => [...prev, newItem]); // Optimistic update
      await queueOfflineWrite(user.uid, 'mustdos', newItem.id, 'set', newItem);
    } catch (err) {
      console.error('Failed to add must-do:', err);
    }
  };

  const handleToggleMustDo = async (item: MustDoItem) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = mustdos.map(m => m.id === item.id ? { ...m, done: !item.done } : m);
      saveGuestMustdos(newList);
      return;
    }

    try {
      const updatedItem = { ...item, done: !item.done, userId: user.uid };
      setMustdos(prev => prev.map(m => m.id === item.id ? updatedItem : m)); // Optimistic update
      await queueOfflineWrite(user.uid, 'mustdos', item.id, 'set', updatedItem);
    } catch (err) {
      console.error('Failed to toggle must-do:', err);
    }
  };

  const handleDeleteMustDo = async (itemId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestMustdos(mustdos.filter(m => m.id !== itemId));
      return;
    }

    try {
      setMustdos(prev => prev.filter(m => m.id !== itemId)); // Optimistic update
      await queueOfflineWrite(user.uid, 'mustdos', itemId, 'delete');
    } catch (err) {
      console.error('Failed to delete must-do:', err);
    }
  };

  // Template handlers
  const handleDeleteTemplate = async (templateId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestTemplates(templates.filter(t => t.id !== templateId));
      return;
    }

    try {
      setTemplates(prev => prev.filter(t => t.id !== templateId)); // Optimistic update
      await queueOfflineWrite(user.uid, 'templates', templateId, 'delete');
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  // Todo handlers
  const handleSaveTodo = async (todoData: Partial<TodoItem>) => {
    if (!user) return;

    // Filter out undefined values to prevent Firestore errors
    const sanitizedData = Object.entries(todoData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    if (user.uid === 'guest_user') {
      if (todoData.id) {
        const newList = todos.map(t => t.id === todoData.id ? { ...t, ...sanitizedData } : t) as TodoItem[];
        saveGuestTodos(newList);
      } else {
        const newTodo: TodoItem = {
          ...sanitizedData,
          id: 'todo_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          done: false,
          createdAt: new Date().toISOString()
        } as TodoItem;
        saveGuestTodos([...todos, newTodo]);
      }
      return;
    }

    try {
      if (todoData.id) {
        // Update existing
        const existingTodo = todos.find(t => t.id === todoData.id) || {};
        const updatedTodo = {
          ...existingTodo,
          ...sanitizedData,
          userId: user.uid
        } as TodoItem;
        setTodos(prev => prev.map(t => t.id === todoData.id ? updatedTodo : t)); // Optimistic update
        await queueOfflineWrite(user.uid, 'todos', todoData.id, 'set', updatedTodo);
      } else {
        // Create new
        const newTodoId = 'todo_' + Math.random().toString(36).substr(2, 9);
        const newTodo = {
          ...sanitizedData,
          id: newTodoId,
          userId: user.uid,
          done: false,
          createdAt: new Date().toISOString()
        } as TodoItem;
        setTodos(prev => [...prev, newTodo]); // Optimistic update
        await queueOfflineWrite(user.uid, 'todos', newTodoId, 'set', newTodo);
      }
    } catch (err) {
      console.error('Failed to save todo:', err);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestTodos(todos.filter(t => t.id !== todoId));
      return;
    }

    try {
      setTodos(prev => prev.filter(t => t.id !== todoId)); // Optimistic update
      await queueOfflineWrite(user.uid, 'todos', todoId, 'delete');
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const handleClearCompletedTodos = async () => {
    if (!user) return;
    const completedList = todos.filter(t => t.done);
    if (completedList.length === 0) return;

    if (user.uid === 'guest_user') {
      saveGuestTodos(todos.filter(t => !t.done));
      return;
    }

    try {
      setTodos(prev => prev.filter(t => !t.done)); // Optimistic update
      for (const todo of completedList) {
        await queueOfflineWrite(user.uid, 'todos', todo.id, 'delete');
      }
    } catch (err) {
      console.error('Failed to clear completed todos:', err);
    }
  };

  const handleClearCompletedMustDos = async () => {
    if (!user) return;
    const completedList = mustdos.filter(m => m.date === selectedDateStr && m.done);
    if (completedList.length === 0) return;

    if (user.uid === 'guest_user') {
      saveGuestMustdos(mustdos.filter(m => !(m.date === selectedDateStr && m.done)));
      return;
    }

    try {
      setMustdos(prev => prev.filter(m => !(m.date === selectedDateStr && m.done))); // Optimistic update
      for (const item of completedList) {
        await queueOfflineWrite(user.uid, 'mustdos', item.id, 'delete');
      }
    } catch (err) {
      console.error('Failed to clear completed must-dos:', err);
    }
  };

  const handleSaveReflection = async (date: string, note: string) => {
    if (!user) return;
    const existing = reflections.find(r => r.date === date);

    if (user.uid === 'guest_user') {
      if (existing) {
        if (!note.trim()) {
          saveGuestReflections(reflections.filter(r => r.id !== existing.id));
        } else {
          saveGuestReflections(reflections.map(r => r.id === existing.id ? { ...r, note } : r));
        }
      } else if (note.trim()) {
        const newRef: DayReflection = {
          id: 'refl_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          date,
          note,
          createdAt: new Date().toISOString()
        };
        saveGuestReflections([...reflections, newRef]);
      }
      return;
    }

    try {
      if (existing) {
        if (!note.trim()) {
          setReflections(prev => prev.filter(r => r.id !== existing.id)); // Optimistic update
          await queueOfflineWrite(user.uid, 'day_reflections', existing.id, 'delete');
        } else {
          const updatedRef = { ...existing, note, userId: user.uid };
          setReflections(prev => prev.map(r => r.id === existing.id ? updatedRef : r)); // Optimistic update
          await queueOfflineWrite(user.uid, 'day_reflections', existing.id, 'set', updatedRef);
        }
      } else if (note.trim()) {
        const newId = 'refl_' + Math.random().toString(36).substr(2, 9);
        const newRef = {
          id: newId,
          userId: user.uid,
          date,
          note,
          createdAt: new Date().toISOString()
        };
        setReflections(prev => [...prev, newRef]); // Optimistic update
        await queueOfflineWrite(user.uid, 'day_reflections', newId, 'set', newRef);
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

  const handleSaveDailyGoal = async (date: string, goal: string) => {
    if (!user) return;
    const existing = dailyGoals.find(g => g.date === date);

    if (user.uid === 'guest_user') {
      if (existing) {
        if (!goal.trim()) {
          saveGuestDailyGoals(dailyGoals.filter(g => g.id !== existing.id));
        } else {
          saveGuestDailyGoals(dailyGoals.map(g => g.id === existing.id ? { ...g, goal } : g));
        }
      } else if (goal.trim()) {
        const newGoal: DailyGoal = {
          id: 'goal_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          date,
          goal,
          createdAt: new Date().toISOString()
        };
        saveGuestDailyGoals([...dailyGoals, newGoal]);
      }
      return;
    }

    try {
      if (existing) {
        if (!goal.trim()) {
          setDailyGoals(prev => prev.filter(g => g.id !== existing.id)); // Optimistic update
          await queueOfflineWrite(user.uid, 'daily_goals', existing.id, 'delete');
        } else {
          const updatedGoal = { ...existing, goal, userId: user.uid };
          setDailyGoals(prev => prev.map(g => g.id === existing.id ? updatedGoal : g)); // Optimistic update
          await queueOfflineWrite(user.uid, 'daily_goals', existing.id, 'set', updatedGoal);
        }
      } else if (goal.trim()) {
        const newId = 'goal_' + Math.random().toString(36).substr(2, 9);
        const newGoal = {
          id: newId,
          userId: user.uid,
          date,
          goal,
          createdAt: new Date().toISOString()
        };
        setDailyGoals(prev => [...prev, newGoal]); // Optimistic update
        await queueOfflineWrite(user.uid, 'daily_goals', newId, 'set', newGoal);
      }
    } catch (error) {
      console.error('Error saving daily goal:', error);
    }
  };

  // GCal Import / partial Task creation handler
  const handleImportTask = async (taskData: Partial<Task>) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newTask: Task = {
        ...taskData,
        id: `task_${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Task;
      saveGuestTasks([...tasks, newTask]);
      return;
    }

    try {
      const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask = {
        ...taskData,
        id: newId,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Task;
      setTasks(prev => [...prev, newTask]); // Optimistic update
      await queueOfflineWrite(user.uid, 'tasks', newId, 'set', newTask);
    } catch (error) {
      console.error('Error importing task:', error);
    }
  };

  // Loading Screen
  if (authLoading) {
    return <HourglassPreloader loadingText="Opening Hourglass..." />;
  }

  // Auth Screen
  if (!user) {
    return <LoginScreen />;
  }

  // Settings Panel Screen
  if (showSettings) {
    return (
      <SettingsView 
        user={user} 
        onBack={() => setShowSettings(false)} 
        theme={theme}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'paper' : 'dark')}
        categories={categories}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />
    );
  }

  // Weekly review Screen
  if (viewMode === 'review') {
    return (
      <WeeklyReviewView
        userId={user.uid}
        tasks={tasks}
        exceptions={exceptions}
        completions={completions}
        onBack={() => setViewMode('month')}
      />
    );
  }

  // Standalone Clock Screen
  if (viewMode === 'clock') {
    return (
      <ClockView
        onBack={() => setViewMode('month')}
      />
    );
  }

  const todayMustDos = mustdos.filter(m => m.date === selectedDateStr);

  // Compute daily productivity percentage
  const dailySegments = getTaskSegmentsForDate(tasks, selectedDateStr, exceptions);
  const totalScheduled = dailySegments.length;
  const completedScheduled = dailySegments.filter(seg => 
    completions.some(c => c.taskId === seg.task.id && c.date === selectedDateStr && c.status === CompletionStatus.DONE)
  ).length;

  const totalMustDosCount = todayMustDos.length;
  const completedMustDosCount = todayMustDos.filter(m => m.done).length;

  const overallTotal = totalScheduled + totalMustDosCount;
  const overallCompleted = completedScheduled + completedMustDosCount;
  const completionPercentage = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  const todayStr = formatDate(new Date());
  const isSelectedDateToday = selectedDateStr === todayStr;
  const currentHourNow = new Date().getHours();
  const isAnyTaskActiveNow = isSelectedDateToday && dailySegments.some(seg => currentHourNow >= seg.startHour && currentHourNow < seg.endHour);

  // Search filter computations
  const matchedTasks = searchQuery.trim().length > 0 
    ? tasks.filter(task => {
        const query = searchQuery.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const notesMatch = task.notes ? task.notes.toLowerCase().includes(query) : false;
        return titleMatch || notesMatch;
      })
    : [];

  const matchedMustdos = searchQuery.trim().length > 0
    ? mustdos.filter(m => {
        const query = searchQuery.toLowerCase();
        return m.title.toLowerCase().includes(query);
      })
    : [];

  const matchedTodos = searchQuery.trim().length > 0
    ? todos.filter(t => {
        const query = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(query);
        const notesMatch = t.notes ? t.notes.toLowerCase().includes(query) : false;
        return titleMatch || notesMatch;
      })
    : [];

  return (
    <div className="min-h-screen bg-ledger-dark text-ledger-paper font-sans">
      <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col pb-8">
        
        {/* Hourglass Elegant Header */}
        <header className="p-5 flex items-center justify-between border-b border-ledger-line bg-ledger-slate/35">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center">
              <AnimatedHourglass size={34} isActive={isAnyTaskActiveNow} />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-ledger-paper tracking-tight leading-none">
                Hourglass
              </h1>
              <span className="font-mono text-[9px] text-ledger-paper-dim/60 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <span>24H PLANNER</span>
                <span className="text-ledger-line">•</span>
                <button 
                  onClick={() => triggerSync()} 
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer text-left focus:outline-none"
                  title="Click to trigger manual synchronization retry"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'Synced' ? 'bg-emerald-500' :
                    syncStatus === 'Syncing' ? 'bg-amber-400 animate-pulse' :
                    syncStatus === 'Offline' ? 'bg-slate-400' :
                    'bg-red-500'
                  }`} />
                  <span className={`font-mono text-[8px] uppercase tracking-wider font-semibold ${
                    syncStatus === 'Synced' ? 'text-emerald-500' :
                    syncStatus === 'Syncing' ? 'text-amber-400' :
                    syncStatus === 'Offline' ? 'text-slate-400' :
                    'text-red-400'
                  }`}>
                    {syncStatus}
                  </span>
                </button>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Split, Month, Day, Review Navigation */}
            <div className="flex bg-ledger-slate rounded-lg border border-ledger-line p-0.5">
              <button
                onClick={() => setViewMode('both')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'both' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="Split view"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'month' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="Month calendar"
              >
                <CalendarDays className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'day' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="24h Timeline"
              >
                <ListTodo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('todos')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'todos' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="To-Do List page"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('review')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'review' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="Weekly Review insights"
              >
                <LineChart className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('clock')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'clock' ? 'bg-ledger-slate-light text-ledger-coral' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
                title="Standalone Clock"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Focus Mode trigger */}
            <button
              onClick={() => setFocusMode(prev => {
                const next = !prev;
                localStorage.setItem('hourglass_focus_mode', String(next));
                return next;
              })}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                focusMode 
                  ? 'bg-ledger-coral/20 border-ledger-coral text-ledger-coral' 
                  : 'border-ledger-line bg-ledger-slate text-ledger-paper-dim hover:text-ledger-paper'
              }`}
              title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
              <Target className="w-4 h-4" />
            </button>

            {/* Settings trigger */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg border border-ledger-line bg-ledger-slate text-ledger-paper-dim hover:text-ledger-paper cursor-pointer transition-all"
              title="Preferences & Notifications"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Daily Productivity Progress Bar */}
        {!focusMode && (
          <div id="daily-productivity-progress" className="bg-ledger-slate/15 border-b border-ledger-line px-5 py-3 flex flex-col gap-1.5 font-sans">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-ledger-paper-dim/60 uppercase tracking-widest font-semibold">
                Daily Productivity
              </span>
              <div className="overflow-hidden">
                <motion.span 
                  key={completionPercentage}
                  initial={{ scale: 0.8, y: 5, opacity: 0.3 }}
                  animate={{ scale: [1.25, 1], y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="font-mono text-xs font-bold text-ledger-coral block"
                >
                  {completionPercentage}%
                </motion.span>
              </div>
            </div>
            
            <div className="w-full h-1.5 bg-ledger-dark border border-ledger-line/50 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-ledger-coral rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth easeOutExpo
              />
            </div>
            
            <div className="flex items-center justify-between text-[9px] font-mono text-ledger-paper-dim/50">
              <span>
                {overallCompleted} of {overallTotal} tasks completed
              </span>
              {overallTotal === 0 && (
                <span>No scheduled blocks or must-dos today</span>
              )}
            </div>
          </div>
        )}

        {/* Daily Inspirational Quote */}
        <div id="daily-inspirational-quote" className="px-5 py-2.5 bg-ledger-slate/10 border-b border-ledger-line flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-300">
          <p className="font-serif italic text-[11px] text-ledger-paper leading-relaxed">
            "{quote.text}"
          </p>
          <p className="text-right font-mono text-[9px] text-ledger-gold font-semibold uppercase tracking-wider">
            — {quote.author}
          </p>
        </div>

        {/* Main Body */}
        <main className="flex-1 p-4 flex flex-col gap-4">
          
          {focusMode ? (
            <FocusModeView
              userId={user.uid}
              tasks={tasks}
              exceptions={exceptions}
              completions={completions}
              currentDateStr={selectedDateStr}
              onSetStatus={handleSetCompletionStatus}
            />
          ) : (
            <>
              {/* Global Search Bar */}
              <div className="w-full relative">
            <input
              type="text"
              placeholder="Search tasks, notes, or to-dos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 bg-ledger-slate/20 hover:bg-ledger-slate/30 focus:bg-ledger-slate/35 border border-ledger-line focus:border-ledger-coral/45 rounded-xl text-xs text-ledger-paper placeholder-ledger-paper-dim/40 outline-none transition-all font-sans"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-ledger-paper-dim/60" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-1 text-ledger-paper-dim/60 hover:text-ledger-coral cursor-pointer transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchQuery.trim().length > 0 ? (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-ledger-line pb-2">
                <span className="font-mono text-[10px] text-ledger-gold font-semibold uppercase tracking-widest">
                  Search Results
                </span>
                <span className="font-mono text-[9px] text-ledger-paper-dim/60 bg-ledger-slate/30 px-2 py-0.5 rounded-full">
                  {matchedTasks.length + matchedMustdos.length + matchedTodos.length} matches
                </span>
              </div>

              {/* Matching Tasks / Hourly Blocks */}
              {matchedTasks.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <h3 className="font-serif text-xs font-semibold text-ledger-paper/90 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-ledger-coral shrink-0" />
                    <span className="uppercase tracking-wider font-mono text-[10px] text-ledger-paper-dim/80">Schedule Blocks</span>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {matchedTasks.map(task => (
                      <div 
                        key={task.id} 
                        className="p-3 bg-ledger-slate/25 hover:bg-ledger-slate/35 border border-ledger-line/70 rounded-xl flex items-center justify-between gap-3 hover:border-ledger-coral/30 cursor-pointer transition-all relative overflow-hidden group"
                        onClick={() => {
                          setTaskToEdit(task);
                          setSelectedDateStr(task.anchorDate);
                          setIsEditorOpen(true);
                        }}
                      >
                        {/* Custom edge category color */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1" 
                          style={{ backgroundColor: task.color || '#e56b55' }}
                        />
                        
                        <div className="pl-2 flex-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-xs text-ledger-paper group-hover:text-ledger-coral transition-colors">
                              {task.title}
                            </span>
                            {task.priority && (
                              <span className="text-[8px] bg-ledger-gold/15 text-ledger-gold px-1 rounded font-mono uppercase tracking-widest font-semibold shrink-0">
                                High
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-ledger-paper-dim/80">
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-2.5 h-2.5 text-ledger-paper-dim/50" />
                              {formatHourLabel(task.startHour)} – {formatHourLabel(task.endHour)}
                            </span>
                            <span className="text-ledger-paper-dim/40 shrink-0">•</span>
                            <span className="text-ledger-gold/90 shrink-0">
                              {getRecurrenceLabel(task)}
                            </span>
                          </div>

                          {task.notes && (
                            <p className="mt-1 text-[11px] text-ledger-paper-dim/70 italic pl-1.5 border-l border-ledger-line/50 line-clamp-1">
                              {task.notes}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateStr(task.anchorDate);
                            setViewMode('day');
                            setSearchQuery('');
                          }}
                          className="p-2 bg-ledger-slate/60 border border-ledger-line/85 hover:border-ledger-coral/50 hover:text-ledger-coral text-ledger-paper-dim rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Jump to date"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Must-Do Items */}
              {matchedMustdos.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-2">
                  <h3 className="font-serif text-xs font-semibold text-ledger-paper/90 flex items-center gap-2">
                    <ListTodo className="w-3.5 h-3.5 text-ledger-coral shrink-0" />
                    <span className="uppercase tracking-wider font-mono text-[10px] text-ledger-paper-dim/80">Daily Must-Dos</span>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {matchedMustdos.map(m => (
                      <div 
                        key={m.id} 
                        className="p-3 bg-ledger-slate/25 border border-ledger-line/70 rounded-xl flex items-center justify-between gap-3 hover:border-ledger-line transition-all relative overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            onClick={() => handleToggleMustDo(m)}
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                              m.done 
                                ? 'bg-ledger-coral border-ledger-coral text-ledger-dark' 
                                : 'border-ledger-paper-dim/40 hover:border-ledger-coral/50 bg-ledger-dark'
                            }`}
                          >
                            {m.done && (
                              <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs block truncate ${m.done ? 'line-through text-ledger-paper-dim/50' : 'text-ledger-paper'}`}>
                              {m.title}
                            </span>
                            <span className="text-[9px] font-mono text-ledger-gold/90 mt-0.5 block">
                              For Date: {m.date}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedDateStr(m.date);
                            setViewMode('day');
                            setSearchQuery('');
                          }}
                          className="p-2 bg-ledger-slate/60 border border-ledger-line/85 hover:border-ledger-coral/50 hover:text-ledger-coral text-ledger-paper-dim rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Jump to date"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Inbox To-Dos */}
              {matchedTodos.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-2">
                  <h3 className="font-serif text-xs font-semibold text-ledger-paper/90 flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-ledger-coral shrink-0" />
                    <span className="uppercase tracking-wider font-mono text-[10px] text-ledger-paper-dim/80">Inbox To-Dos</span>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {matchedTodos.map(t => (
                      <div 
                        key={t.id} 
                        className="p-3 bg-ledger-slate/25 border border-ledger-line/70 rounded-xl flex items-center justify-between gap-3 hover:border-ledger-line transition-all relative overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            onClick={() => handleSaveTodo({ id: t.id, done: !t.done, completedAt: !t.done ? new Date().toISOString() : undefined })}
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                              t.done 
                                ? 'bg-ledger-coral border-ledger-coral text-ledger-dark' 
                                : 'border-ledger-paper-dim/40 hover:border-ledger-coral/50 bg-ledger-dark'
                            }`}
                          >
                            {t.done && (
                              <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs block truncate ${t.done ? 'line-through text-ledger-paper-dim/50' : 'text-ledger-paper'}`}>
                              {t.title}
                            </span>
                            {t.notes && (
                              <span className="text-[10px] text-ledger-paper-dim block truncate italic">
                                {t.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setViewMode('todos');
                            setSearchQuery('');
                          }}
                          className="p-2 bg-ledger-slate/60 border border-ledger-line/85 hover:border-ledger-coral/50 hover:text-ledger-coral text-ledger-paper-dim rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Go to To-Dos page"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Matches Fallback */}
              {matchedTasks.length === 0 && matchedMustdos.length === 0 && matchedTodos.length === 0 && (
                <div className="p-8 text-center bg-ledger-slate/10 border border-ledger-line/50 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <span className="text-xl">🔍</span>
                  <p className="font-serif text-sm font-bold text-ledger-paper">
                    No results match "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-ledger-paper-dim/70 leading-relaxed max-w-[250px]">
                    Check spelling or try a broader keyword to find active schedule blocks, non-negotiable must-dos, or general inbox to-dos.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Active Duplicator Dialog (Copy Day) */}
          {showCopyDayDialog && (
            <div className="p-4 bg-ledger-slate rounded-2xl border border-ledger-line flex flex-col gap-3 shadow-lg">
              <span className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-ledger-coral" />
                <span>Duplicate Day Blocks</span>
              </span>
              <p className="text-[11px] text-ledger-paper-dim font-sans leading-relaxed">
                Copy all non-recurring schedule blocks from {selectedDateStr} to another day:
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={copyTargetDate}
                  onChange={(e) => setCopyTargetDate(e.target.value)}
                  className="flex-1 h-9 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper cursor-pointer"
                />
                <button
                  onClick={handleCopyDay}
                  className="px-4 h-9 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark font-mono text-[11px] font-bold rounded-xl cursor-pointer"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => setShowCopyDayDialog(false)}
                  className="px-3 h-9 bg-ledger-slate-light border border-ledger-line text-xs rounded-xl text-ledger-paper"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active Duplicator Dialog (Copy Week) */}
          {showCopyWeekDialog && (
            <div className="p-4 bg-ledger-slate rounded-2xl border border-ledger-line flex flex-col gap-3 shadow-lg">
              <span className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-ledger-gold animate-pulse" />
                <span>Duplicate Week Blocks</span>
              </span>
              <p className="text-[11px] text-ledger-paper-dim font-sans leading-relaxed">
                Copy all non-recurring blocks of the current week to another target week (starting on the specified Monday):
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={copyTargetWeekMonday}
                  onChange={(e) => setCopyTargetWeekMonday(e.target.value)}
                  className="flex-1 h-9 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper cursor-pointer"
                />
                <button
                  onClick={handleCopyWeek}
                  className="px-4 h-9 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark font-mono text-[11px] font-bold rounded-xl cursor-pointer"
                >
                  Duplicate Week
                </button>
                <button
                  onClick={() => setShowCopyWeekDialog(false)}
                  className="px-3 h-9 bg-ledger-slate-light border border-ledger-line text-xs rounded-xl text-ledger-paper"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* 1. Now & Next Glance Widget */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <GlanceView
              userId={user.uid}
              tasks={tasks}
              exceptions={exceptions}
              completions={completions}
              currentDateStr={selectedDateStr}
              onSetStatus={handleSetCompletionStatus}
            />
          )}

          {/* 2. Month Calendar Block */}
          {(viewMode === 'both' || viewMode === 'month') && (
            <MonthView
              currentDateStr={selectedDateStr}
              tasks={tasks}
              exceptions={exceptions}
              onSelectDate={(date) => {
                setSelectedDateStr(date);
                if (viewMode === 'month') {
                  setViewMode('both');
                }
              }}
            />
          )}

          {/* Daily Goal input Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <DailyGoalInput
              selectedDateStr={selectedDateStr}
              dailyGoals={dailyGoals}
              onSaveDailyGoal={handleSaveDailyGoal}
            />
          )}

          {/* 3. Daily non-negotiables must-do Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <MustDoSection
              userId={user.uid}
              dateStr={selectedDateStr}
              items={todayMustDos}
              onAddItem={handleAddMustDo}
              onToggleItem={handleToggleMustDo}
              onDeleteItem={handleDeleteMustDo}
              onClearCompleted={handleClearCompletedMustDos}
            />
          )}

          {/* 3.5. Daily Habits Tracker Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <HabitTrackerSection
              userId={user.uid}
              dateStr={selectedDateStr}
              habits={habits}
              habitHistory={habitHistory}
              onAddHabit={handleAddHabit}
              onToggleHabit={handleToggleHabit}
              onDeleteHabit={handleDeleteHabit}
            />
          )}

          {/* 4. Day 24-Hour vertical Timeline Block */}
          {(viewMode === 'both' || viewMode === 'day') && (
            <DayTimelineView
              currentDateStr={selectedDateStr}
              tasks={tasks}
              exceptions={exceptions}
              onSelectDate={setSelectedDateStr}
              onAddTask={handleOpenAddTask}
              onEditTask={handleOpenEditTask}
              dailyGoals={dailyGoals}
              onMoveTasks={handleMoveTasks}
              todos={todos}
              onScheduleTodo={handleScheduleTodo}
              onUpdateTaskTimes={handleUpdateTaskTimes}
              completions={completions}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
            />
          )}

          {/* To-Do List Dedicated Screen */}
          {viewMode === 'todos' && (
            <TodoListPage
              userId={user.uid}
              todos={todos}
              onSaveTodo={handleSaveTodo}
              onDeleteTodo={handleDeleteTodo}
              onClearCompletedTodos={handleClearCompletedTodos}
              onScheduleTodo={handleScheduleTodo}
            />
          )}

          {/* 5. Copy & Duplicate Actions row */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowCopyDayDialog(true)}
                className="flex-1 h-10 flex items-center justify-center gap-2 bg-ledger-slate/50 hover:bg-ledger-slate-light/60 border border-ledger-line rounded-xl text-xs font-serif text-ledger-paper hover:text-ledger-coral cursor-pointer transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>Duplicate Day Blocks</span>
              </button>
              <button
                onClick={() => setShowCopyWeekDialog(true)}
                className="flex-1 h-10 flex items-center justify-center gap-2 bg-ledger-slate/50 hover:bg-ledger-slate-light/60 border border-ledger-line rounded-xl text-xs font-serif text-ledger-paper hover:text-ledger-coral cursor-pointer transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>Duplicate Week Blocks</span>
              </button>
            </div>
          )}

          {/* 6. Quick Presets Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <TaskTemplateSection
              userId={user.uid}
              templates={templates}
              onSelectTemplate={handleSelectTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          )}

          {/* 7. Google Calendar Sync Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <GCalSyncButton
              userId={user.uid}
              selectedDateStr={selectedDateStr}
              tasks={tasks}
              onImportEvent={handleImportTask}
              onImportComplete={() => {}}
            />
          )}

          {/* 8. Daily Reflection Section */}
          {viewMode !== 'month' && viewMode !== 'todos' && (
            <DailyReflectionSection
              selectedDateStr={selectedDateStr}
              reflections={reflections}
              onSaveReflection={handleSaveReflection}
            />
          )}

            </>
          )}

            </>
          )}

        </main>

        {/* Floating Task Editor Modal Sheet */}
        <TaskEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setTaskToEdit(null);
          }}
          onSave={handleSaveTask}
          onSaveException={handleSaveException}
          onDelete={handleDeleteTask}
          selectedDateStr={selectedDateStr}
          taskToEdit={taskToEdit}
          defaultStartHour={defaultStartHour}
          tasks={tasks}
          exceptions={exceptions}
          categories={categories}
        />

        {/* Reward Confetti & Congrats Dialog Overlay */}
        <RewardConfetti active={showConfetti} />

        {/* Floating In-App Interactive Toast Alerts Overlay */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3.5 max-w-sm w-full px-4 sm:px-0">
          <AnimatePresence>
            {activeNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                layout
                id={`in-app-toast-${notif.id}`}
                className="w-full bg-ledger-slate border border-ledger-line rounded-2xl shadow-xl overflow-hidden p-4 flex flex-col gap-3.5"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-ledger-coral flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-ledger-coral animate-ping" />
                      {notif.type.replace('_', ' ')}
                    </span>
                    <h4 className="text-xs font-bold text-ledger-paper mt-0.5 leading-snug">
                      {notif.title}
                    </h4>
                    <p className="text-[11px] text-ledger-paper-dim/80 mt-1 leading-relaxed whitespace-pre-line">
                      {notif.body}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismissNotification(notif.id)}
                    className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Actions Row */}
                {notif.actions && notif.actions.length > 0 && (
                  <div className="flex gap-2 pt-0.5">
                    {notif.actions.map((act) => (
                      <button
                        key={act.action}
                        onClick={() => handleExecuteNotificationAction(notif.id, act.action)}
                        className="flex-1 h-8 bg-ledger-slate-light hover:bg-ledger-coral hover:text-ledger-dark border border-ledger-line hover:border-ledger-coral rounded-xl text-[10px] font-sans font-bold text-ledger-paper transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        {act.title}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
      </div>
    </div>
  );
}
