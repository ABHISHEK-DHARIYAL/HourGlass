// Purpose: Custom hook managing Hourglass real-time Firestore listeners, offline IndexedDB sync, and model CRUD logic with strict UID ownership
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  getRedirectResult,
  GoogleAuthProvider,
  auth, 
  collection, 
  db, 
  onSnapshot,
  doc,
  setDoc,
  User,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { 
  Task, 
  Recurrence, 
  TaskException, 
  TaskCompletion, 
  MustDoItem, 
  TaskTemplate, 
  ExceptionType, 
  CompletionStatus, 
  TodoItem, 
  DayReflection, 
  DailyGoal, 
  Habit, 
  HabitHistory, 
  TaskCategory 
} from '../types';
import { formatDate, parseLocalDate, getTaskSegmentsForDate } from '../utils/dateUtils';
import { logDebug } from '../utils/debugLogger';
import { getAllFromStore, putToStore, deleteFromStore, clearStore, getQueue } from '../utils/offlineStore';
import { queueOfflineWrite, subscribeToSyncStatus, SyncStatus } from '../utils/offlineSyncManager';
import { migrateLocalDataToFirestore } from '../utils/firestoreMigration';
import { saveGuestStorageItem } from '../utils/guestStorage';
import { useHourglassListeners } from './useHourglassListeners';

const DEFAULT_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#6678a3' },
  { id: 'personal', name: 'Personal', color: '#e56b55' },
  { id: 'fitness', name: 'Fitness', color: '#3f7c62' },
  { id: 'leisure', name: 'Leisure', color: '#d4af37' },
  { id: 'study', name: 'Study', color: '#8a5a82' },
];

export function useHourglassData() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [tasks, rawSetTasks] = useState<Task[]>([]);
  const setTasks = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    rawSetTasks(prev => typeof updater === 'function' ? updater(prev) : updater);
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

  const activeUidRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Clear state immediately whenever user UID changes or becomes null
  useEffect(() => {
    const newUid = user?.uid || null;
    if (activeUidRef.current !== newUid) {
      activeUidRef.current = newUid;
      setIsCacheLoaded(false);
      setTasks([]);
      setExceptions([]);
      setCompletions([]);
      setMustdos([]);
      setTemplates([]);
      setTodos([]);
      setReflections([]);
      setDailyGoals([]);
      setHabits([]);
      setHabitHistory([]);
      setCategories([]);
    }

    if (!user) {
      return;
    }

    let isMounted = true;
    const currentUid = user.uid;

    const loadCachedData = async () => {
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
          getAllFromStore<Task>('tasks', currentUid),
          getAllFromStore<TaskException>('exceptions', currentUid),
          getAllFromStore<TaskCompletion>('completions', currentUid),
          getAllFromStore<MustDoItem>('mustdos', currentUid),
          getAllFromStore<TaskTemplate>('templates', currentUid),
          getAllFromStore<TodoItem>('todos', currentUid),
          getAllFromStore<DayReflection>('day_reflections', currentUid),
          getAllFromStore<DailyGoal>('daily_goals', currentUid),
          getAllFromStore<Habit>('habits', currentUid),
          getAllFromStore<HabitHistory>('habit_history', currentUid),
          getAllFromStore<TaskCategory>('categories', currentUid)
        ]);

        if (!isMounted || activeUidRef.current !== currentUid) return;

        setTasks(cachedTasks);
        setExceptions(cachedExceptions);
        setCompletions(cachedCompletions);
        setMustdos(cachedMustdos);
        setTemplates(cachedTemplates);
        setTodos(cachedTodos);
        setReflections(cachedReflections);
        setDailyGoals(cachedDailyGoals);
        setHabits(cachedHabits);
        setHabitHistory(cachedHabitHistory);
        setCategories(cachedCategories);
      } catch (err) {
        console.warn('[StartupCache] Failed to load initial offline cache:', err);
      } finally {
        if (isMounted && activeUidRef.current === currentUid) {
          setIsCacheLoaded(true);
        }
      }
    };

    loadCachedData();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

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
      if (firebaseUser) {
        migrateLocalDataToFirestore(firebaseUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const syncCollectionWithSnapshot = async <T extends { id: string; userId?: string }>(
    collectionName: string,
    firestoreList: T[],
    setState: (updater: T[] | ((prev: T[]) => T[])) => void
  ) => {
    try {
      const currentUid = user?.uid || auth.currentUser?.uid;
      if (!currentUid || activeUidRef.current !== currentUid) {
        setState([]);
        return;
      }
      const queue = await getQueue(currentUid);
      const pendingItems = queue.filter(q => q.collectionName === collectionName && q.userId === currentUid);
      const pendingDeletes = new Set(pendingItems.filter(q => q.action === 'delete').map(q => q.itemId));

      const mergedMap = new Map<string, T>();

      firestoreList.forEach(item => {
        if (!pendingDeletes.has(item.id)) {
          mergedMap.set(item.id, { ...item, userId: item.userId || currentUid });
        }
      });

      pendingItems.forEach(q => {
        if (q.action === 'set' && q.data) {
          mergedMap.set(q.itemId, { id: q.itemId, ...q.data, userId: currentUid } as T);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      if (activeUidRef.current === currentUid) {
        setState(mergedList);
      }

      // Fetch existing user items in IndexedDB to remove deleted ones without wiping other accounts' data
      const existingUserItems = await getAllFromStore<T>(collectionName, currentUid);
      const mergedIds = new Set(mergedList.map(item => item.id));

      for (const existingItem of existingUserItems) {
        if (!mergedIds.has(existingItem.id) && !pendingItems.some(p => p.itemId === existingItem.id)) {
          await deleteFromStore(collectionName, existingItem.id);
        }
      }

      for (const item of mergedList) {
        await putToStore(collectionName, { ...item, userId: currentUid }, currentUid);
      }
    } catch (err) {
      console.error(`[syncCollectionWithSnapshot] Failed to merge ${collectionName}:`, err);
      if (activeUidRef.current === (user?.uid || auth.currentUser?.uid)) {
        setState(firestoreList);
      }
    }
  };

  // Guest Storage Helpers
  const saveGuestTasks = (newList: Task[]) => saveGuestStorageItem('hourglass_tasks', 'tasks', newList, setTasks);
  const saveGuestExceptions = (newList: TaskException[]) => saveGuestStorageItem('hourglass_exceptions', 'exceptions', newList, setExceptions);
  const saveGuestCompletions = (newList: TaskCompletion[]) => saveGuestStorageItem('hourglass_completions', 'completions', newList, setCompletions);
  const saveGuestMustdos = (newList: MustDoItem[]) => saveGuestStorageItem('hourglass_mustdos', 'mustdos', newList, setMustdos);
  const saveGuestTemplates = (newList: TaskTemplate[]) => saveGuestStorageItem('hourglass_templates', 'templates', newList, setTemplates);
  const saveGuestTodos = (newList: TodoItem[]) => saveGuestStorageItem('hourglass_todos', 'todos', newList, setTodos);
  const saveGuestReflections = (newList: DayReflection[]) => saveGuestStorageItem('hourglass_reflections', 'day_reflections', newList, setReflections);
  const saveGuestDailyGoals = (newList: DailyGoal[]) => saveGuestStorageItem('hourglass_daily_goals', 'daily_goals', newList, setDailyGoals);
  const saveGuestHabits = (newList: Habit[]) => saveGuestStorageItem('hourglass_habits', 'habits', newList, setHabits);
  const saveGuestHabitHistory = (newList: HabitHistory[]) => saveGuestStorageItem('hourglass_habit_history', 'habit_history', newList, setHabitHistory);
  const saveGuestCategories = (newList: TaskCategory[]) => saveGuestStorageItem('hourglass_categories', 'categories', newList, setCategories);

  // Real-time Listeners
  useHourglassListeners({
    user,
    isCacheLoaded,
    syncCollectionWithSnapshot,
    setTasks,
    setExceptions,
    setCompletions,
    setMustdos,
    setTemplates,
    setTodos,
    setReflections,
    setDailyGoals,
    setHabits,
    setHabitHistory,
    setCategories,
    saveGuestCategories,
    DEFAULT_CATEGORIES
  });

  // Model Operation Handlers
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
      setCategories(prev => [...prev, newCat]);
      await queueOfflineWrite(user.uid, 'categories', catId, 'set', newCat);
    } catch (err) {
      console.error('Failed to add category:', err);
    }
  };

  const handleUpdateCategory = async (id: string, name: string, color: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestCategories(categories.map(c => c.id === id ? { ...c, name, color } : c));
      return;
    }

    try {
      const updatedCat = { id, userId: user.uid, name, color, createdAt: new Date().toISOString() };
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name, color } : c));
      await queueOfflineWrite(user.uid, 'categories', id, 'set', updatedCat);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      saveGuestCategories(categories.filter(c => c.id !== id));
      return;
    }

    try {
      setCategories(prev => prev.filter(c => c.id !== id));
      await queueOfflineWrite(user.uid, 'categories', id, 'delete');
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleSaveTaskDirect = async (tData: Partial<Task>) => {
    if (!user) return;
    const tId = tData.id;
    if (!tId) return;
    
    if (user.uid === 'guest_user') {
      saveGuestTasks(tasks.map(t => t.id === tId ? { ...t, ...tData, updatedAt: new Date().toISOString() } : t));
      return;
    }
    try {
      setTasks(prev => prev.map(t => t.id === tId ? { ...t, ...tData, updatedAt: new Date().toISOString() } : t));
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

  const handleSaveCompletionDirect = async (comp: TaskCompletion) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      saveGuestCompletions([...completions.filter(c => c.id !== comp.id), comp]);
      return;
    }
    try {
      const updatedComp = { ...comp, userId: user.uid, updatedAt: new Date().toISOString() };
      setCompletions(prev => [...prev.filter(c => c.id !== comp.id), updatedComp]);
      await queueOfflineWrite(user.uid, 'completions', comp.id, 'set', updatedComp);
    } catch (err) {
      console.error('Failed to save completion direct:', err);
    }
  };

  const handleSaveExceptionDirect = async (exc: TaskException) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      saveGuestExceptions([...exceptions.filter(e => e.id !== exc.id), exc]);
      return;
    }
    try {
      const updatedExc = { ...exc, userId: user.uid };
      setExceptions(prev => [...prev.filter(e => e.id !== exc.id), updatedExc]);
      await queueOfflineWrite(user.uid, 'exceptions', exc.id, 'set', updatedExc);
    } catch (err) {
      console.error('Failed to save exception direct:', err);
    }
  };

  async function handleToggleHabit(habitId: string, date: string, done: boolean) {
    if (!user) return;
    const histId = `${habitId}_${date}`;
    const newHist: HabitHistory = { id: histId, habitId, date, done };

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
        setHabitHistory(prev => prev.filter(h => h.id !== histId));
        await queueOfflineWrite(user.uid, 'habit_history', histId, 'delete');
      } else {
        const fullHist = { ...newHist, userId: user.uid };
        setHabitHistory(prev => [...prev.filter(h => h.id !== histId), fullHist]);
        await queueOfflineWrite(user.uid, 'habit_history', histId, 'set', fullHist);
      }
    } catch (err) {
      console.error('Failed to toggle habit status:', err);
    }
  }

  return {
    user,
    setUser,
    authLoading,
    tasks,
    setTasks,
    exceptions,
    setExceptions,
    completions,
    setCompletions,
    mustdos,
    setMustdos,
    templates,
    setTemplates,
    todos,
    setTodos,
    reflections,
    setReflections,
    dailyGoals,
    setDailyGoals,
    habits,
    setHabits,
    habitHistory,
    setHabitHistory,
    categories,
    setCategories,
    showConfetti,
    setShowConfetti,
    syncStatus,
    isCacheLoaded,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleSaveTaskDirect,
    handleSaveCompletionDirect,
    handleSaveExceptionDirect,
    handleToggleHabit,
    saveGuestTasks,
    saveGuestExceptions,
    saveGuestCompletions,
    saveGuestMustdos,
    saveGuestTemplates,
    saveGuestTodos,
    saveGuestReflections,
    saveGuestDailyGoals,
    saveGuestHabits,
    saveGuestHabitHistory,
    saveGuestCategories
  };
}
