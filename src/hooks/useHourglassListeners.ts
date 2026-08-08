// Purpose: Custom hook attaching real-time Firestore collection listeners for user collections
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, db, onSnapshot, doc, setDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { 
  Task, 
  TaskException, 
  TaskCompletion, 
  MustDoItem, 
  TaskTemplate, 
  TodoItem, 
  DayReflection, 
  DailyGoal, 
  Habit, 
  HabitHistory, 
  TaskCategory 
} from '../types';

interface UseHourglassListenersProps {
  user: User | null;
  isCacheLoaded: boolean;
  syncCollectionWithSnapshot: <T extends { id: string }>(
    collectionName: string,
    firestoreList: T[],
    setState: (updater: T[] | ((prev: T[]) => T[])) => void
  ) => Promise<void>;
  setTasks: (updater: Task[] | ((prev: Task[]) => Task[])) => void;
  setExceptions: (updater: TaskException[] | ((prev: TaskException[]) => TaskException[])) => void;
  setCompletions: (updater: TaskCompletion[] | ((prev: TaskCompletion[]) => TaskCompletion[])) => void;
  setMustdos: (updater: MustDoItem[] | ((prev: MustDoItem[]) => MustDoItem[])) => void;
  setTemplates: (updater: TaskTemplate[] | ((prev: TaskTemplate[]) => TaskTemplate[])) => void;
  setTodos: (updater: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) => void;
  setReflections: (updater: DayReflection[] | ((prev: DayReflection[]) => DayReflection[])) => void;
  setDailyGoals: (updater: DailyGoal[] | ((prev: DailyGoal[]) => DailyGoal[])) => void;
  setHabits: (updater: Habit[] | ((prev: Habit[]) => Habit[])) => void;
  setHabitHistory: (updater: HabitHistory[] | ((prev: HabitHistory[]) => HabitHistory[])) => void;
  setCategories: (updater: TaskCategory[] | ((prev: TaskCategory[]) => TaskCategory[])) => void;
  saveGuestCategories: (newList: TaskCategory[]) => void;
  DEFAULT_CATEGORIES: Array<{ id: string; name: string; color: string }>;
}

export function useHourglassListeners({
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
}: UseHourglassListenersProps) {

  // Tasks
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTasks([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_tasks');
      setTasks(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'tasks');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Task);
      });
      syncCollectionWithSnapshot('tasks', list, setTasks);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/tasks`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Exceptions
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setExceptions([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_exceptions');
      setExceptions(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'exceptions');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: TaskException[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskException);
      });
      syncCollectionWithSnapshot('exceptions', list, setExceptions);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/exceptions`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Completions
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setCompletions([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_completions');
      setCompletions(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'completions');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: TaskCompletion[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskCompletion);
      });
      syncCollectionWithSnapshot('completions', list, setCompletions);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/completions`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Mustdos
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setMustdos([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_mustdos');
      setMustdos(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'mustdos');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: MustDoItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as MustDoItem);
      });
      syncCollectionWithSnapshot('mustdos', list, setMustdos);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/mustdos`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Templates
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTemplates([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_templates');
      setTemplates(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'templates');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: TaskTemplate[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskTemplate);
      });
      syncCollectionWithSnapshot('templates', list, setTemplates);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/templates`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Todos
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setTodos([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_todos');
      setTodos(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'todos');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: TodoItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TodoItem);
      });
      syncCollectionWithSnapshot('todos', list, setTodos);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/todos`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Reflections
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setReflections([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_reflections');
      setReflections(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'day_reflections');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: DayReflection[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DayReflection);
      });
      syncCollectionWithSnapshot('day_reflections', list, setReflections);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/day_reflections`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Daily Goals
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setDailyGoals([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_daily_goals');
      setDailyGoals(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'daily_goals');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: DailyGoal[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DailyGoal);
      });
      syncCollectionWithSnapshot('daily_goals', list, setDailyGoals);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/daily_goals`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Habits
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setHabits([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habits');
      setHabits(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'habits');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: Habit[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Habit);
      });
      syncCollectionWithSnapshot('habits', list, setHabits);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/habits`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Habit History
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setHabitHistory([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habit_history');
      setHabitHistory(stored ? JSON.parse(stored) : []);
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'habit_history');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: HabitHistory[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as HabitHistory);
      });
      syncCollectionWithSnapshot('habit_history', list, setHabitHistory);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/habit_history`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);

  // Categories
  useEffect(() => {
    if (!user || !isCacheLoaded) {
      if (!user) setCategories([]);
      return;
    }
    const currentUid = user.uid;
    if (currentUid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_categories');
      const list = stored ? JSON.parse(stored) : [];
      if (list.length === 0) {
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: currentUid,
          createdAt: new Date().toISOString()
        }));
        saveGuestCategories(seeded);
      } else {
        list.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
        setCategories(list);
      }
      return;
    }
    const colRef = collection(db, 'users', currentUid, 'categories');
    const unsubscribe = onSnapshot(colRef, async (snapshot) => {
      if (auth.currentUser?.uid !== currentUid) return;
      const list: TaskCategory[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskCategory);
      });
      
      if (list.length === 0) {
        const isDeleting = localStorage.getItem('hourglass_deleting_account') === 'true';
        if (isDeleting || !auth.currentUser) {
          setCategories([]);
          return;
        }
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: currentUid,
          createdAt: new Date().toISOString()
        }));
        for (const cat of seeded) {
          const docRef = doc(db, 'users', currentUid, 'categories', cat.id);
          await setDoc(docRef, cat, { merge: true });
        }
      } else {
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
        syncCollectionWithSnapshot('categories', list, setCategories);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUid}/categories`));

    return () => {
      unsubscribe();
    };
  }, [user?.uid, isCacheLoaded]);
}
