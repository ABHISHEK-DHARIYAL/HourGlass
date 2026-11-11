// Purpose: Custom hook providing task, habit, todo, goal, and item CRUD handlers for the App component

import React from 'react';
import { User } from '../firebase';
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
  HabitHistory 
} from '../types';
import { formatDate, parseLocalDate } from '../utils/dateUtils';
import { queueOfflineWrite } from '../utils/offlineSyncManager';

interface UseAppActionsProps {
  user: User | null;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  exceptions: TaskException[];
  setExceptions: React.Dispatch<React.SetStateAction<TaskException[]>>;
  completions: TaskCompletion[];
  setCompletions: React.Dispatch<React.SetStateAction<TaskCompletion[]>>;
  mustdos: MustDoItem[];
  setMustdos: React.Dispatch<React.SetStateAction<MustDoItem[]>>;
  templates: TaskTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<TaskTemplate[]>>;
  todos: TodoItem[];
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  reflections: DayReflection[];
  setReflections: React.Dispatch<React.SetStateAction<DayReflection[]>>;
  dailyGoals: DailyGoal[];
  setDailyGoals: React.Dispatch<React.SetStateAction<DailyGoal[]>>;
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  habitHistory: HabitHistory[];
  taskToEdit: Task | null;
  setTaskToEdit: (t: Task | null) => void;
  setIsEditorOpen: (open: boolean) => void;
  setSelectedDateStr: (d: string) => void;
  selectedDateStr: string;
  viewMode: 'both' | 'day' | 'week';
  setViewMode: (v: 'both' | 'day' | 'week') => void;
  copyTargetDate: string;
  copyTargetWeekMonday: string;
  setShowCopyDayDialog: (open: boolean) => void;
  setShowCopyWeekDialog: (open: boolean) => void;
  saveGuestTasks: (newList: Task[]) => void;
  saveGuestExceptions: (newList: TaskException[]) => void;
  saveGuestCompletions: (newList: TaskCompletion[]) => void;
  saveGuestMustdos: (newList: MustDoItem[]) => void;
  saveGuestTemplates: (newList: TaskTemplate[]) => void;
  saveGuestTodos: (newList: TodoItem[]) => void;
  saveGuestReflections: (newList: DayReflection[]) => void;
  saveGuestDailyGoals: (newList: DailyGoal[]) => void;
  saveGuestHabits: (newList: Habit[]) => void;
  saveGuestHabitHistory: (newList: HabitHistory[]) => void;
}

// Hook exposing every user-triggered mutation handler for tasks, exceptions,
// habits, must-dos, templates, todos, reflections, and daily goals — each
// handler writes to Firestore (or guest localStorage/IndexedDB when signed
// in as the guest user) and updates the corresponding React state.
export function useAppActions({
  user,
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
  taskToEdit,
  setTaskToEdit,
  setIsEditorOpen,
  setSelectedDateStr,
  selectedDateStr,
  viewMode,
  setViewMode,
  copyTargetDate,
  copyTargetWeekMonday,
  setShowCopyDayDialog,
  setShowCopyWeekDialog,
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
}: UseAppActionsProps) {

  // Creates a new task or updates an existing one being edited.
  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!user) return;
    const sanitizedData = Object.entries(taskData).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      return acc;
    }, {} as Record<string, any>);

    if (user.uid === 'guest_user') {
      if (taskToEdit?.id) {
        saveGuestTasks(tasks.map(t => t.id === taskToEdit.id ? { ...t, ...sanitizedData, updatedAt: new Date().toISOString() } : t));
      } else {
        const newTask: Task = { ...sanitizedData, id: `task_${Date.now()}`, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task;
        saveGuestTasks([...tasks, newTask]);
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
      if (taskData.anchorDate) setSelectedDateStr(taskData.anchorDate);
      if (viewMode !== 'both' && viewMode !== 'day') setViewMode('both');
      return;
    }

    try {
      if (taskToEdit?.id) {
        const updatedTask = { ...taskToEdit, ...sanitizedData, userId: user.uid, updatedAt: new Date().toISOString() } as Task;
        setTasks(prev => prev.map(t => t.id === taskToEdit.id ? updatedTask : t));
        await queueOfflineWrite(user.uid, 'tasks', taskToEdit.id, 'set', updatedTask);
      } else {
        const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTask = { ...sanitizedData, id: newTaskId, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task;
        setTasks(prev => [...prev, newTask]);
        await queueOfflineWrite(user.uid, 'tasks', newTaskId, 'set', newTask);
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
      if (taskData.anchorDate) setSelectedDateStr(taskData.anchorDate);
      if (viewMode !== 'both' && viewMode !== 'day') setViewMode('both');
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  // Saves a SKIPPED or MODIFIED exception for one occurrence of a
  // recurring task, without altering the task's own recurrence rule.
  const handleSaveException = async (excData: TaskException) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      saveGuestExceptions([...exceptions.filter(e => e.id !== excData.id), excData]);
      setIsEditorOpen(false);
      setTaskToEdit(null);
      if (excData.date) setSelectedDateStr(excData.date);
      if (viewMode !== 'both' && viewMode !== 'day') setViewMode('both');
      return;
    }
    const updatedExc = { ...excData, userId: user.uid, updatedAt: new Date().toISOString() };
    setExceptions(prev => [...prev.filter(e => e.id !== excData.id), updatedExc]);
    await queueOfflineWrite(user.uid, 'exceptions', excData.id, 'set', updatedExc);
    setIsEditorOpen(false);
    setTaskToEdit(null);
    if (excData.date) setSelectedDateStr(excData.date);
    if (viewMode !== 'both' && viewMode !== 'day') setViewMode('both');
  };

  // Deletes a task, either just today's occurrence (adds a SKIPPED
  // exception) or the entire recurring series ('all').
  const handleDeleteTask = async (taskId: string, deleteOption: 'one' | 'all' = 'all') => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      if (deleteOption === 'one') {
        saveGuestExceptions([...exceptions, { id: `${taskId}_${selectedDateStr}`, userId: user.uid, taskId, date: selectedDateStr, type: ExceptionType.SKIPPED }]);
      } else {
        saveGuestTasks(tasks.filter(t => t.id !== taskId));
      }
      setIsEditorOpen(false);
      setTaskToEdit(null);
      return;
    }
    if (deleteOption === 'one') {
      const exceptionId = `${taskId}_${selectedDateStr}`;
      const newExc: TaskException = { id: exceptionId, userId: user.uid, taskId, date: selectedDateStr, type: ExceptionType.SKIPPED };
      setExceptions(prev => [...prev, newExc]);
      await queueOfflineWrite(user.uid, 'exceptions', exceptionId, 'set', newExc);
    } else {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      await queueOfflineWrite(user.uid, 'tasks', taskId, 'delete');
    }
    setIsEditorOpen(false);
    setTaskToEdit(null);
  };

  // Duplicates every task scheduled on the selected day onto the chosen
  // target date.
  const handleCopyDay = async () => {
    const dayTasks = tasks.filter(t => t.anchorDate === selectedDateStr && t.recurrence === Recurrence.NONE);
    if (dayTasks.length === 0) return alert('No non-recurring blocks found on this day to duplicate.');
    if (user?.uid === 'guest_user') {
      const newTasks: Task[] = dayTasks.map((t, idx) => ({ ...t, id: `task_${Date.now()}_${idx}`, anchorDate: copyTargetDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      saveGuestTasks([...tasks, ...newTasks]);
      setShowCopyDayDialog(false);
      setSelectedDateStr(copyTargetDate);
      return;
    }
    const newTasks: Task[] = [];
    for (const t of dayTasks) {
      const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask = { ...t, userId: user!.uid, id: newId, anchorDate: copyTargetDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      newTasks.push(newTask);
      await queueOfflineWrite(user!.uid, 'tasks', newId, 'set', newTask);
    }
    setTasks(prev => [...prev, ...newTasks]);
    setShowCopyDayDialog(false);
    setSelectedDateStr(copyTargetDate);
  };

  // Duplicates the current week's schedule onto the week starting at the
  // chosen target Monday.
  const handleCopyWeek = async () => {
    const sourceDateObj = parseLocalDate(selectedDateStr);
    const dayOfWeek = sourceDateObj.getDay();
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const sourceMondayObj = new Date(sourceDateObj);
    sourceMondayObj.setDate(sourceDateObj.getDate() + offsetToMonday);

    const sourceDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sourceMondayObj);
      d.setDate(sourceMondayObj.getDate() + i);
      sourceDates.push(formatDate(d));
    }

    const targetMondayObj = parseLocalDate(copyTargetWeekMonday);
    const targetDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMondayObj);
      d.setDate(targetMondayObj.getDate() + i);
      targetDates.push(formatDate(d));
    }

    const weekTasks = tasks.filter(t => t.recurrence === Recurrence.NONE && sourceDates.includes(t.anchorDate));
    if (weekTasks.length === 0) return alert('No non-recurring blocks found in this week to duplicate.');

    if (user?.uid === 'guest_user') {
      const newTasks: Task[] = weekTasks.map((t, idx) => ({ ...t, id: `task_${Date.now()}_${idx}`, anchorDate: targetDates[sourceDates.indexOf(t.anchorDate)], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      saveGuestTasks([...tasks, ...newTasks]);
      setShowCopyWeekDialog(false);
      setSelectedDateStr(copyTargetWeekMonday);
      return;
    }

    const newTasks: Task[] = [];
    for (const t of weekTasks) {
      const targetDate = targetDates[sourceDates.indexOf(t.anchorDate)];
      const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask = { ...t, userId: user!.uid, id: newId, anchorDate: targetDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      newTasks.push(newTask);
      await queueOfflineWrite(user!.uid, 'tasks', newId, 'set', newTask);
    }
    setTasks(prev => [...prev, ...newTasks]);
    setShowCopyWeekDialog(false);
    setSelectedDateStr(copyTargetWeekMonday);
  };

  // Moves a batch of selected task occurrences to a new date.
  const handleMoveTasks = async (taskIds: string[], targetDate: string) => {
    if (!user || taskIds.length === 0) return;
    if (user.uid === 'guest_user') {
      saveGuestTasks(tasks.map(t => taskIds.includes(t.id) ? { ...t, anchorDate: targetDate, updatedAt: new Date().toISOString() } : t));
      setSelectedDateStr(targetDate);
      return;
    }
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, anchorDate: targetDate, updatedAt: new Date().toISOString() } : t));
    for (const taskId of taskIds) {
      const existing = tasks.find(t => t.id === taskId) || {};
      await queueOfflineWrite(user.uid, 'tasks', taskId, 'set', { ...existing, userId: user.uid, anchorDate: targetDate, updatedAt: new Date().toISOString() });
    }
    setSelectedDateStr(targetDate);
  };

  // Creates a new daily habit to track.
  const handleAddHabit = async (title: string, color: string) => {
    if (!user) return;
    const newHabit: Habit = { id: `habit_${Math.random().toString(36).substr(2, 9)}`, userId: user.uid, title, color, createdAt: new Date().toISOString() };
    if (user.uid === 'guest_user') return saveGuestHabits([...habits, newHabit]);
    setHabits(prev => [...prev, newHabit]);
    await queueOfflineWrite(user.uid, 'habits', newHabit.id, 'set', newHabit);
  };

  // Deletes a habit and its tracking history.
  const handleDeleteHabit = async (habitId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      saveGuestHabits(habits.filter(h => h.id !== habitId));
      saveGuestHabitHistory(habitHistory.filter(h => h.habitId !== habitId));
      return;
    }
    setHabits(prev => prev.filter(h => h.id !== habitId));
    await queueOfflineWrite(user.uid, 'habits', habitId, 'delete');
  };

  // Updates a task's start/end hour, e.g. after a drag-to-resize on the
  // timeline.
  const handleUpdateTaskTimes = async (taskId: string, startHour: number, endHour: number) => {
    if (!user) return;
    if (user.uid === 'guest_user') {
      return saveGuestTasks(tasks.map(t => t.id === taskId ? { ...t, startHour, endHour, updatedAt: new Date().toISOString() } : t));
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, startHour, endHour, updatedAt: new Date().toISOString() } : t));
    const existing = tasks.find(t => t.id === taskId) || {};
    await queueOfflineWrite(user.uid, 'tasks', taskId, 'set', { ...existing, userId: user.uid, startHour, endHour, updatedAt: new Date().toISOString() });
  };

  // Converts an unscheduled Inbox todo into a scheduled task on the
  // timeline, then removes it from the todo list.
  const handleScheduleTodo = async (todoId: string, title: string, notes: string, date: string, startHour: number, endHour: number, priority?: boolean) => {
    if (!user) return;
    const newTaskId = `task_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = { id: newTaskId, userId: user.uid, title, notes, startHour, endHour, anchorDate: date, recurrence: Recurrence.NONE, notifyEnabled: true, priority: priority ?? false, color: '#e56b55', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (user.uid === 'guest_user') {
      saveGuestTasks([...tasks, newTask]);
      saveGuestTodos(todos.map(t => t.id === todoId ? { ...t, done: true, completedAt: new Date().toISOString() } : t));
      return;
    }
    setTasks(prev => [...prev, newTask]);
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, done: true, completedAt: new Date().toISOString() } : t));
    await queueOfflineWrite(user.uid, 'tasks', newTaskId, 'set', newTask);
    const existingTodo = todos.find(t => t.id === todoId) || {};
    await queueOfflineWrite(user.uid, 'todos', todoId, 'set', { ...existingTodo, userId: user.uid, done: true, completedAt: new Date().toISOString() });
  };

  // Marks a task occurrence as DONE/SKIPPED/etc. for a specific date —
  // this is what powers the daily/monthly completion percentages.
  const handleSetCompletionStatus = async (taskId: string, date: string, status: CompletionStatus) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;
    if (user.uid === 'guest_user') {
      if (status === CompletionStatus.NO_RESPONSE) return saveGuestCompletions(completions.filter(c => c.id !== compId));
      const newComp: TaskCompletion = { id: compId, userId: user.uid, taskId, date, status, completedAt: new Date().toISOString() };
      saveGuestCompletions([...completions.filter(c => c.id !== compId), newComp]);
      return;
    }
    if (status === CompletionStatus.NO_RESPONSE) {
      setCompletions(prev => prev.filter(c => c.id !== compId));
      return await queueOfflineWrite(user.uid, 'completions', compId, 'delete');
    }
    const newComp: TaskCompletion = { id: compId, userId: user.uid, taskId, date, status, completedAt: new Date().toISOString() };
    setCompletions(prev => [...prev.filter(c => c.id !== compId), newComp]);
    await queueOfflineWrite(user.uid, 'completions', compId, 'set', newComp);
  };

  // Starts the focus timer for a task occurrence.
  const handleStartTimer = async (taskId: string, date: string) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;
    const existing = completions.find(c => c.taskId === taskId && c.date === date);
    const updated = { id: compId, userId: user.uid, taskId, date, status: existing?.status || CompletionStatus.NO_RESPONSE, completedAt: existing?.completedAt || null, actualDuration: existing?.actualDuration || 0, timerStartedAt: new Date().toISOString() };
    if (user.uid === 'guest_user') return saveGuestCompletions([...completions.filter(c => c.id !== compId), updated]);
    setCompletions(prev => [...prev.filter(c => c.id !== compId), updated]);
    await queueOfflineWrite(user.uid, 'completions', compId, 'set', updated);
  };

  // Stops the focus timer for a task occurrence.
  const handleStopTimer = async (taskId: string, date: string) => {
    if (!user) return;
    const compId = `${taskId}_${date}`;
    const existing = completions.find(c => c.taskId === taskId && c.date === date);
    if (!existing?.timerStartedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(existing.timerStartedAt).getTime()) / 1000);
    const updated = { id: compId, userId: user.uid, taskId, date, status: existing.status, completedAt: existing.completedAt || null, actualDuration: (existing.actualDuration || 0) + elapsed, timerStartedAt: null };
    if (user.uid === 'guest_user') return saveGuestCompletions([...completions.filter(c => c.id !== compId), updated]);
    setCompletions(prev => [...prev.filter(c => c.id !== compId), updated]);
    await queueOfflineWrite(user.uid, 'completions', compId, 'set', updated);
  };

  // Adds a new non-negotiable 'must do today' item.
  const handleAddMustDo = async (title: string) => {
    if (!user) return;
    const newItem: MustDoItem = { id: `mustdo_${Math.random().toString(36).substr(2, 9)}`, userId: user.uid, date: selectedDateStr, title, done: false, createdAt: new Date().toISOString() };
    if (user.uid === 'guest_user') return saveGuestMustdos([...mustdos, newItem]);
    setMustdos(prev => [...prev, newItem]);
    await queueOfflineWrite(user.uid, 'mustdos', newItem.id, 'set', newItem);
  };

  // Toggles a must-do item's completed state.
  const handleToggleMustDo = async (item: MustDoItem) => {
    if (!user) return;
    if (user.uid === 'guest_user') return saveGuestMustdos(mustdos.map(m => m.id === item.id ? { ...m, done: !item.done } : m));
    const updated = { ...item, done: !item.done, userId: user.uid };
    setMustdos(prev => prev.map(m => m.id === item.id ? updated : m));
    await queueOfflineWrite(user.uid, 'mustdos', item.id, 'set', updated);
  };

  // Deletes a single must-do item.
  const handleDeleteMustDo = async (itemId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') return saveGuestMustdos(mustdos.filter(m => m.id !== itemId));
    setMustdos(prev => prev.filter(m => m.id !== itemId));
    await queueOfflineWrite(user.uid, 'mustdos', itemId, 'delete');
  };

  // Deletes a saved hour-block template.
  const handleDeleteTemplate = async (templateId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') return saveGuestTemplates(templates.filter(t => t.id !== templateId));
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    await queueOfflineWrite(user.uid, 'templates', templateId, 'delete');
  };

  // Creates a new Inbox todo or updates an existing one.
  const handleSaveTodo = async (todoData: Partial<TodoItem>) => {
    if (!user) return;
    const sanitized = Object.entries(todoData).reduce((acc, [k, v]) => { if (v !== undefined) acc[k] = v; return acc; }, {} as Record<string, any>);
    if (user.uid === 'guest_user') {
      if (todoData.id) return saveGuestTodos(todos.map(t => t.id === todoData.id ? { ...t, ...sanitized } : t) as TodoItem[]);
      return saveGuestTodos([...todos, { ...sanitized, id: `todo_${Math.random().toString(36).substr(2, 9)}`, userId: user.uid, done: false, createdAt: new Date().toISOString() } as TodoItem]);
    }
    if (todoData.id) {
      const existing = todos.find(t => t.id === todoData.id) || {};
      const updated = { ...existing, ...sanitized, userId: user.uid } as TodoItem;
      setTodos(prev => prev.map(t => t.id === todoData.id ? updated : t));
      await queueOfflineWrite(user.uid, 'todos', todoData.id, 'set', updated);
    } else {
      const newId = `todo_${Math.random().toString(36).substr(2, 9)}`;
      const newTodo = { ...sanitized, id: newId, userId: user.uid, done: false, createdAt: new Date().toISOString() } as TodoItem;
      setTodos(prev => [...prev, newTodo]);
      await queueOfflineWrite(user.uid, 'todos', newId, 'set', newTodo);
    }
  };

  // Deletes a single Inbox todo.
  const handleDeleteTodo = async (todoId: string) => {
    if (!user) return;
    if (user.uid === 'guest_user') return saveGuestTodos(todos.filter(t => t.id !== todoId));
    setTodos(prev => prev.filter(t => t.id !== todoId));
    await queueOfflineWrite(user.uid, 'todos', todoId, 'delete');
  };

  // Bulk-deletes every completed Inbox todo.
  const handleClearCompletedTodos = async () => {
    if (!user) return;
    const completed = todos.filter(t => t.done);
    if (user.uid === 'guest_user') return saveGuestTodos(todos.filter(t => !t.done));
    setTodos(prev => prev.filter(t => !t.done));
    for (const t of completed) await queueOfflineWrite(user.uid, 'todos', t.id, 'delete');
  };

  // Bulk-deletes every completed must-do item.
  const handleClearCompletedMustDos = async () => {
    if (!user) return;
    const completed = mustdos.filter(m => m.date === selectedDateStr && m.done);
    if (user.uid === 'guest_user') return saveGuestMustdos(mustdos.filter(m => !(m.date === selectedDateStr && m.done)));
    setMustdos(prev => prev.filter(m => !(m.date === selectedDateStr && m.done)));
    for (const m of completed) await queueOfflineWrite(user.uid, 'mustdos', m.id, 'delete');
  };

  // Saves the end-of-day reflection note for a given date.
  const handleSaveReflection = async (date: string, note: string) => {
    if (!user) return;
    const existing = reflections.find(r => r.date === date);
    if (user.uid === 'guest_user') {
      if (existing) return saveGuestReflections(note.trim() ? reflections.map(r => r.id === existing.id ? { ...r, note } : r) : reflections.filter(r => r.id !== existing.id));
      if (note.trim()) saveGuestReflections([...reflections, { id: `refl_${Math.random().toString(36).substr(2, 9)}`, userId: user.uid, date, note, createdAt: new Date().toISOString() }]);
      return;
    }
    if (existing) {
      if (!note.trim()) {
        await queueOfflineWrite(user.uid, 'day_reflections', existing.id, 'delete');
      } else {
        const updated = { ...existing, note, userId: user.uid };
        await queueOfflineWrite(user.uid, 'day_reflections', existing.id, 'set', updated);
      }
    } else if (note.trim()) {
      const newId = `refl_${Math.random().toString(36).substr(2, 9)}`;
      await queueOfflineWrite(user.uid, 'day_reflections', newId, 'set', { id: newId, userId: user.uid, date, note, createdAt: new Date().toISOString() });
    }
  };

  // Saves the user's stated daily goal/intention for a given date.
  const handleSaveDailyGoal = async (date: string, goal: string) => {
    if (!user) return;
    const existing = dailyGoals.find(g => g.date === date);
    if (user.uid === 'guest_user') {
      if (existing) return saveGuestDailyGoals(goal.trim() ? dailyGoals.map(g => g.id === existing.id ? { ...g, goal } : g) : dailyGoals.filter(g => g.id !== existing.id));
      if (goal.trim()) saveGuestDailyGoals([...dailyGoals, { id: `goal_${Math.random().toString(36).substr(2, 9)}`, userId: user.uid, date, goal, createdAt: new Date().toISOString() }]);
      return;
    }
    if (existing) {
      if (!goal.trim()) {
        await queueOfflineWrite(user.uid, 'daily_goals', existing.id, 'delete');
      } else {
        await queueOfflineWrite(user.uid, 'daily_goals', existing.id, 'set', { ...existing, goal, userId: user.uid });
      }
    } else if (goal.trim()) {
      const newId = `goal_${Math.random().toString(36).substr(2, 9)}`;
      await queueOfflineWrite(user.uid, 'daily_goals', newId, 'set', { id: newId, userId: user.uid, date, goal, createdAt: new Date().toISOString() });
    }
  };

  // Creates a task from an external source (e.g. Google Calendar import
  // or the natural-language quick-add parser).
  const handleImportTask = async (taskData: Partial<Task>) => {
    if (!user) return;
    if (user.uid === 'guest_user') return saveGuestTasks([...tasks, { ...taskData, id: `task_${Date.now()}`, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task]);
    const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask = { ...taskData, id: newId, userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Task;
    setTasks(prev => [...prev, newTask]);
    await queueOfflineWrite(user.uid, 'tasks', newId, 'set', newTask);
  };

  return {
    handleSaveTask,
    handleSaveException,
    handleDeleteTask,
    handleCopyDay,
    handleCopyWeek,
    handleMoveTasks,
    handleAddHabit,
    handleDeleteHabit,
    handleUpdateTaskTimes,
    handleScheduleTodo,
    handleSetCompletionStatus,
    handleStartTimer,
    handleStopTimer,
    handleAddMustDo,
    handleToggleMustDo,
    handleDeleteMustDo,
    handleDeleteTemplate,
    handleSaveTodo,
    handleDeleteTodo,
    handleClearCompletedTodos,
    handleClearCompletedMustDos,
    handleSaveReflection,
    handleSaveDailyGoal,
    handleImportTask,
  };
}
