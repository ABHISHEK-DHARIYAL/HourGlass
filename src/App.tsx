/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
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
  User
} from './firebase';
import { Task, Recurrence, TaskException, TaskCompletion, MustDoItem, TaskTemplate, ExceptionType, CompletionStatus, TodoItem, DayReflection, DailyGoal, Habit, HabitHistory, TaskCategory } from './types';
import { formatDate, parseLocalDate, addDays, getTaskSegmentsForDate, formatHourLabel } from './utils/dateUtils';
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
import { motion } from 'motion/react';
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
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatDate(new Date()));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultStartHour, setDefaultStartHour] = useState(9);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'both' | 'month' | 'day' | 'review' | 'clock' | 'todos'>('month');
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);
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
      .then(res => res.json())
      .then(data => {
        if (data && data.text) {
          setQuote(data);
        }
      })
      .catch(err => console.warn('Failed to fetch quote:', err));
  }, []);

  // Copying state & UI inputs
  const [showCopyDayDialog, setShowCopyDayDialog] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(formatDate(new Date()));
  
  const [showCopyWeekDialog, setShowCopyWeekDialog] = useState(false);
  const [copyTargetWeekMonday, setCopyTargetWeekMonday] = useState(formatDate(new Date()));

  // Listen for Auth changes
  useEffect(() => {
    // Check if guest user session is stored in localStorage
    const savedGuest = localStorage.getItem('hourglass_guest_user');
    if (savedGuest) {
      setUser(JSON.parse(savedGuest));
      setAuthLoading(false);
      setViewMode('month');
      setShowSettings(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        setViewMode('month');
        setShowSettings(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Guest save helpers to synchronize state and localStorage
  const saveGuestTasks = (newList: Task[]) => {
    setTasks(newList);
    localStorage.setItem('hourglass_tasks', JSON.stringify(newList));
  };
  const saveGuestExceptions = (newList: TaskException[]) => {
    setExceptions(newList);
    localStorage.setItem('hourglass_exceptions', JSON.stringify(newList));
  };
  const saveGuestCompletions = (newList: TaskCompletion[]) => {
    setCompletions(newList);
    localStorage.setItem('hourglass_completions', JSON.stringify(newList));
  };
  const saveGuestMustdos = (newList: MustDoItem[]) => {
    setMustdos(newList);
    localStorage.setItem('hourglass_mustdos', JSON.stringify(newList));
  };
  const saveGuestTemplates = (newList: TaskTemplate[]) => {
    setTemplates(newList);
    localStorage.setItem('hourglass_templates', JSON.stringify(newList));
  };
  const saveGuestTodos = (newList: TodoItem[]) => {
    setTodos(newList);
    localStorage.setItem('hourglass_todos', JSON.stringify(newList));
  };
  const saveGuestReflections = (newList: DayReflection[]) => {
    setReflections(newList);
    localStorage.setItem('hourglass_reflections', JSON.stringify(newList));
  };
  const saveGuestDailyGoals = (newList: DailyGoal[]) => {
    setDailyGoals(newList);
    localStorage.setItem('hourglass_daily_goals', JSON.stringify(newList));
  };
  const saveGuestHabits = (newList: Habit[]) => {
    setHabits(newList);
    localStorage.setItem('hourglass_habits', JSON.stringify(newList));
  };
  const saveGuestHabitHistory = (newList: HabitHistory[]) => {
    setHabitHistory(newList);
    localStorage.setItem('hourglass_habit_history', JSON.stringify(newList));
  };
  const saveGuestCategories = (newList: TaskCategory[]) => {
    setCategories(newList);
    localStorage.setItem('hourglass_categories', JSON.stringify(newList));
  };

  // Set up real-time listener for tasks
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_tasks');
      setTasks(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as Task);
      });
      setTasks(list);
    }, (err) => console.error('Tasks listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for exceptions
  useEffect(() => {
    if (!user) {
      setExceptions([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_exceptions');
      setExceptions(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'exceptions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskException[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as TaskException);
      });
      setExceptions(list);
    }, (err) => console.error('Exceptions listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for completions
  useEffect(() => {
    if (!user) {
      setCompletions([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_completions');
      setCompletions(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'completions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskCompletion[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as TaskCompletion);
      });
      setCompletions(list);
    }, (err) => console.error('Completions listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for daily must-dos
  useEffect(() => {
    if (!user) {
      setMustdos([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_mustdos');
      setMustdos(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'mustdos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MustDoItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as MustDoItem);
      });
      setMustdos(list);
    }, (err) => console.error('Must-dos listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for templates
  useEffect(() => {
    if (!user) {
      setTemplates([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_templates');
      setTemplates(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'templates'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskTemplate[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as TaskTemplate);
      });
      setTemplates(list);
    }, (err) => console.error('Templates listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for todos
  useEffect(() => {
    if (!user) {
      setTodos([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_todos');
      setTodos(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'todos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TodoItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as TodoItem);
      });
      setTodos(list);
    }, (err) => console.error('Todos listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for day_reflections
  useEffect(() => {
    if (!user) {
      setReflections([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_reflections');
      setReflections(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'day_reflections'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DayReflection[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as DayReflection);
      });
      setReflections(list);
    }, (err) => console.error('Day reflections listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for daily_goals
  useEffect(() => {
    if (!user) {
      setDailyGoals([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_daily_goals');
      setDailyGoals(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'daily_goals'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DailyGoal[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as DailyGoal);
      });
      setDailyGoals(list);
    }, (err) => console.error('Daily goals listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for habits
  useEffect(() => {
    if (!user) {
      setHabits([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habits');
      setHabits(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Habit[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as Habit);
      });
      setHabits(list);
    }, (err) => console.error('Habits listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for habit history
  useEffect(() => {
    if (!user) {
      setHabitHistory([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_habit_history');
      setHabitHistory(stored ? JSON.parse(stored) : []);
      return;
    }
    const q = query(collection(db, 'habit_history'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: HabitHistory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as HabitHistory);
      });
      setHabitHistory(list);
    }, (err) => console.error('Habit history listener error:', err));
    return () => unsubscribe();
  }, [user]);

  // Set up real-time listener for categories
  useEffect(() => {
    if (!user) {
      setCategories([]);
      return;
    }
    if (user.uid === 'guest_user') {
      const stored = localStorage.getItem('hourglass_categories');
      if (stored) {
        setCategories(JSON.parse(stored));
      } else {
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: 'guest_user',
          createdAt: new Date().toISOString()
        }));
        localStorage.setItem('hourglass_categories', JSON.stringify(seeded));
        setCategories(seeded);
      }
      return;
    }
    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: TaskCategory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as TaskCategory);
      });
      
      if (list.length === 0) {
        const seeded = DEFAULT_CATEGORIES.map(c => ({
          ...c,
          userId: user.uid,
          createdAt: new Date().toISOString()
        }));
        // Seed Firestore
        for (const cat of seeded) {
          const docRef = doc(db, 'categories', `${user.uid}_${cat.id}`);
          await setDoc(docRef, cat, { merge: true });
        }
      } else {
        // Sort categories by createdAt or id to maintain consistent order
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
        setCategories(list);
      }
    }, (err) => console.error('Categories listener error:', err));
    return () => unsubscribe();
  }, [user]);

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
      const newList = [...categories, newCat];
      saveGuestCategories(newList);
      return;
    }

    try {
      const docRef = doc(db, 'categories', catId);
      await setDoc(docRef, newCat);
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
      const docRef = doc(db, 'categories', id);
      await setDoc(docRef, { name, color }, { merge: true });
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
      const docRef = doc(db, 'categories', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Sync tasks with server for background push notifications
  useEffect(() => {
    if (user && tasks.length > 0) {
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
        const currentTasks = [...tasks];
        if (taskToEdit && taskToEdit.id) {
          const index = currentTasks.findIndex(t => t.id === taskToEdit.id);
          if (index !== -1) {
            currentTasks[index] = {
              ...currentTasks[index],
              ...sanitizedData,
              updatedAt: new Date().toISOString()
            } as Task;
          }
        } else {
          const newTask: Task = {
            id: 'task_' + Math.random().toString(36).substr(2, 9),
            userId: user.uid,
            title: sanitizedData.title || '',
            notes: sanitizedData.notes || '',
            startHour: sanitizedData.startHour ?? 9,
            endHour: sanitizedData.endHour ?? 10,
            anchorDate: sanitizedData.anchorDate || selectedDateStr,
            recurrence: sanitizedData.recurrence || Recurrence.NONE,
            notifyEnabled: sanitizedData.notifyEnabled ?? true,
            color: sanitizedData.color || '#e56b55',
            priority: sanitizedData.priority ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          currentTasks.push(newTask);
        }
        saveGuestTasks(currentTasks);
      } else {
        if (taskToEdit && taskToEdit.id) {
          // Edit entire series (or single non-recurring)
          const taskDocRef = doc(db, 'tasks', taskToEdit.id);
          await updateDoc(taskDocRef, {
            ...sanitizedData,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Create new series
          const tasksCollectionRef = collection(db, 'tasks');
          await addDoc(tasksCollectionRef, {
            ...sanitizedData,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task block. Please check connection and try again.');
    }
  };

  // Save a single-occurrence exception (override fields just for this date)
  const handleSaveException = async (excData: TaskException) => {
    if (!user) return;
    try {
      if (user.uid === 'guest_user') {
        const currentExceptions = [...exceptions];
        const index = currentExceptions.findIndex(e => e.id === excData.id);
        if (index !== -1) {
          currentExceptions[index] = excData;
        } else {
          currentExceptions.push(excData);
        }
        saveGuestExceptions(currentExceptions);
      } else {
        const excDocRef = doc(db, 'exceptions', excData.id);
        await setDoc(excDocRef, {
          ...excData,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving task exception:', error);
      alert('Failed to save task exception.');
    }
  };

  // Delete a task series or a single occurrence
  const handleDeleteTask = async (taskId: string, deleteOption: 'one' | 'all' = 'all') => {
    if (!user) return;
    try {
      if (user.uid === 'guest_user') {
        if (deleteOption === 'one') {
          const exceptionId = `${taskId}_${selectedDateStr}`;
          const newExc: TaskException = {
            id: exceptionId,
            taskId,
            date: selectedDateStr,
            type: ExceptionType.SKIPPED
          };
          saveGuestExceptions([...exceptions, newExc]);
        } else {
          saveGuestTasks(tasks.filter(t => t.id !== taskId));
        }
      } else {
        if (deleteOption === 'one') {
          // Exclude single occurrence by saving exception of type SKIPPED
          const exceptionId = `${taskId}_${selectedDateStr}`;
          const excDocRef = doc(db, 'exceptions', exceptionId);
          await setDoc(excDocRef, {
            id: exceptionId,
            userId: user.uid,
            taskId,
            date: selectedDateStr,
            type: ExceptionType.SKIPPED,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Delete entire series
          const taskDocRef = doc(db, 'tasks', taskId);
          await deleteDoc(taskDocRef);
        }
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

    try {
      if (user?.uid === 'guest_user') {
        const duplicated = dayTasks.map(t => ({
          ...t,
          id: 'task_' + Math.random().toString(36).substr(2, 9),
          anchorDate: copyTargetDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        saveGuestTasks([...tasks, ...duplicated]);
      } else {
        const tasksRef = collection(db, 'tasks');
        for (const t of dayTasks) {
          await addDoc(tasksRef, {
            userId: user?.uid,
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
          });
        }
      }
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

    try {
      if (user?.uid === 'guest_user') {
        const duplicated: Task[] = [];
        for (const t of weekTasks) {
          const dayIdx = sourceDates.indexOf(t.anchorDate);
          if (dayIdx !== -1) {
            const targetDate = targetDates[dayIdx];
            duplicated.push({
              ...t,
              id: 'task_' + Math.random().toString(36).substr(2, 9),
              anchorDate: targetDate,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
        saveGuestTasks([...tasks, ...duplicated]);
      } else {
        const tasksRef = collection(db, 'tasks');
        for (const t of weekTasks) {
          const dayIdx = sourceDates.indexOf(t.anchorDate);
          if (dayIdx !== -1) {
            const targetDate = targetDates[dayIdx];
            await addDoc(tasksRef, {
              userId: user?.uid,
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
      }
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

    try {
      if (user.uid === 'guest_user') {
        const updatedTasks = tasks.map(t => {
          if (taskIds.includes(t.id)) {
            return {
              ...t,
              anchorDate: targetDate,
              updatedAt: new Date().toISOString()
            };
          }
          return t;
        });
        saveGuestTasks(updatedTasks);
      } else {
        for (const taskId of taskIds) {
          const taskDocRef = doc(db, 'tasks', taskId);
          await updateDoc(taskDocRef, {
            anchorDate: targetDate,
            updatedAt: new Date().toISOString()
          });
        }
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
      const newList = [...habits, newHabit];
      saveGuestHabits(newList);
    } else {
      try {
        await setDoc(doc(db, 'habits', newHabit.id), newHabit);
      } catch (err) {
        console.error('Failed to create habit:', err);
      }
    }
  };

  const handleToggleHabit = async (habitId: string, date: string, done: boolean) => {
    if (!user) return;
    const histId = `${habitId}_${date}`;
    const newHist: HabitHistory = {
      id: histId,
      habitId,
      date,
      done
    };

    if (user.uid === 'guest_user') {
      let newList = [...habitHistory];
      const index = newList.findIndex(h => h.id === histId);
      if (index !== -1) {
        if (!done) {
          newList = newList.filter(h => h.id !== histId);
        } else {
          newList[index] = newHist;
        }
      } else if (done) {
        newList.push(newHist);
      }
      saveGuestHabitHistory(newList);
    } else {
      try {
        const docRef = doc(db, 'habit_history', histId);
        if (!done) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, { ...newHist, userId: user.uid });
        }
      } catch (err) {
        console.error('Failed to toggle habit status:', err);
      }
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      const filteredHabits = habits.filter(h => h.id !== habitId);
      const filteredHist = habitHistory.filter(h => h.habitId !== habitId);
      saveGuestHabits(filteredHabits);
      saveGuestHabitHistory(filteredHist);
    } else {
      try {
        await deleteDoc(doc(db, 'habits', habitId));
      } catch (err) {
        console.error('Failed to delete habit:', err);
      }
    }
  };

  const handleUpdateTaskTimes = async (taskId: string, startHour: number, endHour: number) => {
    if (!user) return;
    try {
      if (user.uid === 'guest_user') {
        const updated = tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              startHour,
              endHour,
              updatedAt: new Date().toISOString()
            };
          }
          return t;
        });
        saveGuestTasks(updated);
      } else {
        await updateDoc(doc(db, 'tasks', taskId), {
          startHour,
          endHour,
          updatedAt: new Date().toISOString()
        });
      }
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

    try {
      // Create scheduled task block
      if (user.uid === 'guest_user') {
        saveGuestTasks([...tasks, newTask]);
        // Complete the todo item so it is scheduled and marked resolved
        const updatedTodos = todos.map(t => {
          if (t.id === todoId) {
            return { ...t, done: true, completedAt: new Date().toISOString() };
          }
          return t;
        });
        saveGuestTodos(updatedTodos);
      } else {
        await setDoc(doc(db, 'tasks', newTaskId), newTask);
        await updateDoc(doc(db, 'todos', todoId), {
          done: true,
          completedAt: new Date().toISOString()
        });
      }
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

    if (status === CompletionStatus.NO_RESPONSE) {
      if (user.uid === 'guest_user') {
        const newList = completions.filter(c => c.id !== compId);
        saveGuestCompletions(newList);
        return;
      }
      try {
        const compRef = doc(db, 'completions', compId);
        await deleteDoc(compRef);
      } catch (err) {
        console.error('Failed to clear completion status:', err);
      }
      return;
    }

    if (user.uid === 'guest_user') {
      const newCompletion: TaskCompletion = {
        id: compId,
        taskId,
        date,
        status,
        completedAt: new Date().toISOString()
      };
      const newList = completions.filter(c => c.id !== compId);
      newList.push(newCompletion);
      saveGuestCompletions(newList);

      // Trigger confetti if all tasks on this date are finished
      if (status === CompletionStatus.DONE) {
        const segments = getTaskSegmentsForDate(tasks, date, exceptions);
        if (segments.length > 0) {
          const allDone = segments.every(seg => {
            const c = newList.find(comp => comp.taskId === seg.task.id && comp.date === date);
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

    try {
      const compRef = doc(db, 'completions', compId);
      await setDoc(compRef, {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status,
        completedAt: new Date().toISOString()
      });

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
      const updated: TaskCompletion = {
        id: compId,
        taskId,
        date,
        status: existing?.status || CompletionStatus.NO_RESPONSE,
        completedAt: existing?.completedAt || null,
        actualDuration: existing?.actualDuration || 0,
        timerStartedAt: nowStr
      };
      const newList = completions.filter(c => c.id !== compId);
      newList.push(updated);
      saveGuestCompletions(newList);
      return;
    }

    try {
      const compRef = doc(db, 'completions', compId);
      await setDoc(compRef, {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing?.status || CompletionStatus.NO_RESPONSE,
        completedAt: existing?.completedAt || null,
        actualDuration: existing?.actualDuration || 0,
        timerStartedAt: nowStr
      }, { merge: true });
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
      const updated: TaskCompletion = {
        id: compId,
        taskId,
        date,
        status: existing.status,
        completedAt: existing.completedAt || null,
        actualDuration: newDuration,
        timerStartedAt: null
      };
      const newList = completions.filter(c => c.id !== compId);
      newList.push(updated);
      saveGuestCompletions(newList);
      return;
    }

    try {
      const compRef = doc(db, 'completions', compId);
      await setDoc(compRef, {
        id: compId,
        userId: user.uid,
        taskId,
        date,
        status: existing.status,
        completedAt: existing.completedAt || null,
        actualDuration: newDuration,
        timerStartedAt: null
      }, { merge: true });
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  };

  // Must-do handlers
  const handleAddMustDo = async (title: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newItem: MustDoItem = {
        id: 'mustdo_' + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        date: selectedDateStr,
        title,
        done: false,
        createdAt: new Date().toISOString()
      };
      saveGuestMustdos([...mustdos, newItem]);
      return;
    }

    const mustdosRef = collection(db, 'mustdos');
    await addDoc(mustdosRef, {
      userId: user.uid,
      date: selectedDateStr,
      title,
      done: false,
      createdAt: new Date().toISOString()
    });
  };

  const handleToggleMustDo = async (item: MustDoItem) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = mustdos.map(m => m.id === item.id ? { ...m, done: !m.done } : m);
      saveGuestMustdos(newList);
      return;
    }

    const itemDocRef = doc(db, 'mustdos', item.id);
    await updateDoc(itemDocRef, {
      done: !item.done
    });
  };

  const handleDeleteMustDo = async (itemId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = mustdos.filter(m => m.id !== itemId);
      saveGuestMustdos(newList);
      return;
    }

    const itemDocRef = doc(db, 'mustdos', itemId);
    await deleteDoc(itemDocRef);
  };

  // Template handlers
  const handleDeleteTemplate = async (templateId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = templates.filter(t => t.id !== templateId);
      saveGuestTemplates(newList);
      return;
    }

    const templateDocRef = doc(db, 'templates', templateId);
    await deleteDoc(templateDocRef);
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
      const currentTodos = [...todos];
      if (todoData.id) {
        const index = currentTodos.findIndex(t => t.id === todoData.id);
        if (index !== -1) {
          currentTodos[index] = {
            ...currentTodos[index],
            ...sanitizedData
          } as TodoItem;
        }
      } else {
        const newTodo: TodoItem = {
          id: 'todo_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          title: sanitizedData.title || '',
          done: sanitizedData.done ?? false,
          order: sanitizedData.order ?? 0,
          priority: sanitizedData.priority ?? false,
          notes: sanitizedData.notes || '',
          dueDate: sanitizedData.dueDate || undefined,
          createdAt: sanitizedData.createdAt || new Date().toISOString(),
          completedAt: sanitizedData.completedAt || undefined
        };
        currentTodos.push(newTodo);
      }
      saveGuestTodos(currentTodos);
      return;
    }

    if (todoData.id) {
      // Update existing
      const todoDocRef = doc(db, 'todos', todoData.id);
      await setDoc(todoDocRef, sanitizedData, { merge: true });
    } else {
      // Create new
      const todosCollectionRef = collection(db, 'todos');
      await addDoc(todosCollectionRef, {
        ...sanitizedData,
        userId: user.uid
      });
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!user) return;

    if (user.uid === 'guest_user') {
      const newList = todos.filter(t => t.id !== todoId);
      saveGuestTodos(newList);
      return;
    }

    const todoDocRef = doc(db, 'todos', todoId);
    await deleteDoc(todoDocRef);
  };

  const handleClearCompletedTodos = async () => {
    if (!user) return;
    const completedList = todos.filter(t => t.done);
    if (completedList.length === 0) return;

    if (user.uid === 'guest_user') {
      const newList = todos.filter(t => !t.done);
      saveGuestTodos(newList);
      return;
    }

    try {
      const deletePromises = completedList.map(todo => {
        const todoDocRef = doc(db, 'todos', todo.id);
        return deleteDoc(todoDocRef);
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Failed to clear completed todos:', err);
    }
  };

  const handleClearCompletedMustDos = async () => {
    if (!user) return;
    const completedList = mustdos.filter(m => m.date === selectedDateStr && m.done);
    if (completedList.length === 0) return;

    if (user.uid === 'guest_user') {
      const newList = mustdos.filter(m => !(m.date === selectedDateStr && m.done));
      saveGuestMustdos(newList);
      return;
    }

    try {
      const deletePromises = completedList.map(item => {
        const itemDocRef = doc(db, 'mustdos', item.id);
        return deleteDoc(itemDocRef);
      });
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Failed to clear completed must-dos:', err);
    }
  };

  const handleSaveReflection = async (date: string, note: string) => {
    if (!user) return;
    const existing = reflections.find(r => r.date === date);

    if (user.uid === 'guest_user') {
      let newList = [...reflections];
      if (existing) {
        if (!note.trim()) {
          newList = newList.filter(r => r.id !== existing.id);
        } else {
          newList = newList.map(r => r.id === existing.id ? { ...r, note } : r);
        }
      } else if (note.trim()) {
        newList.push({
          id: 'reflection_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          date,
          note,
          createdAt: new Date().toISOString()
        });
      }
      saveGuestReflections(newList);
      return;
    }

    try {
      if (existing) {
        if (!note.trim()) {
          const refDoc = doc(db, 'day_reflections', existing.id);
          await deleteDoc(refDoc);
        } else {
          const refDoc = doc(db, 'day_reflections', existing.id);
          await setDoc(refDoc, { note }, { merge: true });
        }
      } else if (note.trim()) {
        const collectionRef = collection(db, 'day_reflections');
        await addDoc(collectionRef, {
          userId: user.uid,
          date,
          note,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

  const handleSaveDailyGoal = async (date: string, goal: string) => {
    if (!user) return;
    const existing = dailyGoals.find(g => g.date === date);

    if (user.uid === 'guest_user') {
      let newList = [...dailyGoals];
      if (existing) {
        if (!goal.trim()) {
          newList = newList.filter(g => g.id !== existing.id);
        } else {
          newList = newList.map(g => g.id === existing.id ? { ...g, goal } : g);
        }
      } else if (goal.trim()) {
        newList.push({
          id: 'goal_' + Math.random().toString(36).substr(2, 9),
          userId: user.uid,
          date,
          goal,
          createdAt: new Date().toISOString()
        });
      }
      saveGuestDailyGoals(newList);
      return;
    }

    try {
      if (existing) {
        if (!goal.trim()) {
          const goalDoc = doc(db, 'daily_goals', existing.id);
          await deleteDoc(goalDoc);
        } else {
          const goalDoc = doc(db, 'daily_goals', existing.id);
          await setDoc(goalDoc, { goal }, { merge: true });
        }
      } else if (goal.trim()) {
        const collectionRef = collection(db, 'daily_goals');
        await addDoc(collectionRef, {
          userId: user.uid,
          date,
          goal,
          createdAt: new Date().toISOString()
        });
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
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        title: taskData.title || '',
        notes: taskData.notes || '',
        startHour: taskData.startHour ?? 9,
        endHour: taskData.endHour ?? 10,
        anchorDate: taskData.anchorDate || selectedDateStr,
        recurrence: taskData.recurrence || Recurrence.NONE,
        notifyEnabled: taskData.notifyEnabled ?? false,
        color: taskData.color || '#6366f1',
        priority: taskData.priority ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveGuestTasks([...tasks, newTask]);
      return;
    }

    const tasksCollectionRef = collection(db, 'tasks');
    await addDoc(tasksCollectionRef, {
      ...taskData,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
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
  const dailySegments = getTaskSegmentsForDate(tasks, selectedDateStr);
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
              <span className="font-mono text-[9px] text-ledger-paper-dim/60 uppercase tracking-widest mt-0.5 block">
                24H PLANNER
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
        {!focusMode && quote && (
          <div id="daily-inspirational-quote" className="px-5 py-2.5 bg-ledger-slate/10 border-b border-ledger-line flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-300">
            <p className="font-serif italic text-[11px] text-ledger-paper leading-relaxed">
              "{quote.text}"
            </p>
            <p className="text-right font-mono text-[9px] text-ledger-gold font-semibold uppercase tracking-wider">
              — {quote.author}
            </p>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 p-4 flex flex-col gap-4">
          
          {focusMode ? (
            <FocusModeView
              userId={user.uid}
              tasks={tasks}
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
        
      </div>
    </div>
  );
}
