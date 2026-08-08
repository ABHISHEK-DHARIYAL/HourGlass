// Purpose: Main Hourglass application component orchestrating layout, hooks, and views
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Habit 
} from './types';
import { formatDate, parseLocalDate, getTaskSegmentsForDate, formatHourLabel, getRecurrenceLabel } from './utils/dateUtils';
import { queueOfflineWrite, triggerSync } from './utils/offlineSyncManager';
import { useNotifications } from './hooks/useNotifications';
import { useHourglassData } from './hooks/useHourglassData';
import { useAppActions } from './hooks/useAppActions';
import LoginScreen from './components/LoginScreen';
import HourglassPreloader from './components/HourglassPreloader';
import AppHeader from './components/AppHeader';
import AppNavigation, { ViewMode } from './components/AppNavigation';
import GlobalSearchModal from './components/GlobalSearchModal';
import SettingsView from './components/SettingsView';
import WeeklyReviewView from './components/WeeklyReviewView';
import ClockView from './components/ClockView';
import FocusModeView from './components/FocusModeView';
import GlanceView from './components/GlanceView';
import MonthView from './components/MonthView';
import DailyGoalInput from './components/DailyGoalInput';
import MustDoSection from './components/MustDoSection';
import HabitTrackerSection from './components/HabitTrackerSection';
import DayTimelineView from './components/DayTimelineView';
import TodoListPage from './components/TodoListPage';
import TaskTemplateSection from './components/TaskTemplateSection';
import GCalSyncButton from './components/GCalSyncButton';
import DailyReflectionSection from './components/DailyReflectionSection';
import TaskEditorModal from './components/TaskEditorModal';
import RewardConfetti from './components/RewardConfetti';
import AnimatedHourglass from './components/AnimatedHourglass';
import { Copy, Calendar, Clock, ListTodo, CheckSquare, ArrowRight, Target, Settings, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { messaging, onMessage } from './firebase';

export default function App() {
  const {
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
    saveGuestHabitHistory
  } = useHourglassData();

  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatDate(new Date()));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultStartHour, setDefaultStartHour] = useState(9);
  const [showSettings, setShowSettings] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [quote, setQuote] = useState<{ text: string; author: string }>({
    text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
    author: "Stephen Covey"
  });
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);

  const handleRefreshQuote = useCallback(() => {
    setIsRefreshingQuote(true);
    fetch('/api/quote?random=true')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.text && data?.author) setQuote(data); })
      .catch(() => {})
      .finally(() => setIsRefreshingQuote(false));
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState<boolean>(() => localStorage.getItem('hourglass_focus_mode') === 'true');
  const [theme, setTheme] = useState<'dark' | 'paper'>(() => (localStorage.getItem('hourglass_theme') === 'paper' ? 'paper' : 'dark'));

  const [showCopyDayDialog, setShowCopyDayDialog] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(formatDate(new Date()));
  const [showCopyWeekDialog, setShowCopyWeekDialog] = useState(false);
  const [copyTargetWeekMonday, setCopyTargetWeekMonday] = useState(formatDate(new Date()));

  // Reset UI dialog/modal state whenever active user changes or logs out
  useEffect(() => {
    setIsEditorOpen(false);
    setTaskToEdit(null);
    setIsSearchOpen(false);
    setShowSettings(false);
    setShowCopyDayDialog(false);
    setShowCopyWeekDialog(false);
  }, [user?.uid]);

  useEffect(() => {
    if (theme === 'paper') {
      document.documentElement.classList.add('theme-paper');
    } else {
      document.documentElement.classList.remove('theme-paper');
    }
    localStorage.setItem('hourglass_theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('/api/quote')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.text && data?.author) setQuote(data); })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_ACTION_CLICK') {
        handleExecuteNotificationAction(`bg_push_${Date.now()}`, event.data.action);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [handleExecuteNotificationAction]);

  useEffect(() => {
    if (!messaging) return;
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Hourglass Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=192&h=192&q=80' });
      }
    });
  }, [messaging]);

  const {
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
  } = useAppActions({
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
  });

  if (authLoading) return <HourglassPreloader loadingText="Opening Hourglass..." />;
  if (!user) return <LoginScreen />;

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
        onAccountDeleted={() => {
          setUser(null);
          setShowSettings(false);
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
        }}
      />
    );
  }

  if (viewMode === 'review') {
    return <WeeklyReviewView userId={user.uid} tasks={tasks} exceptions={exceptions} completions={completions} onBack={() => setViewMode('month')} />;
  }

  if (viewMode === 'clock') {
    return <ClockView onBack={() => setViewMode('month')} />;
  }

  const todayMustDos = mustdos.filter(m => m.date === selectedDateStr);

  return (
    <div className="min-h-screen bg-ledger-dark text-ledger-paper">
      <AppHeader
        user={user}
        theme={theme}
        syncStatus={syncStatus}
        quote={quote}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'paper' : 'dark')}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onRefreshQuote={handleRefreshQuote}
        isRefreshingQuote={isRefreshingQuote}
      />

      <AppNavigation viewMode={viewMode} setViewMode={setViewMode} />

      <main className="max-w-7xl mx-auto p-4 flex flex-col gap-6">
        <AnimatePresence mode="wait">
        {focusMode ? (
          <motion.div
            key="focus"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
          <FocusModeView
            userId={user.uid}
            tasks={tasks}
            exceptions={exceptions}
            completions={completions}
            currentDateStr={selectedDateStr}
            onSetStatus={handleSetCompletionStatus}
          />
          </motion.div>
        ) : (
          <motion.div
            key={viewMode}
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {(viewMode === 'both' || viewMode === 'month') && (
              <MonthView
                currentDateStr={selectedDateStr}
                tasks={tasks}
                exceptions={exceptions}
                onSelectDate={(date) => {
                  setSelectedDateStr(date);
                  if (viewMode === 'month') setViewMode('both');
                }}
              />
            )}

            {viewMode !== 'month' && viewMode !== 'todos' && (
              <>
                <GlanceView
                  userId={user.uid}
                  tasks={tasks}
                  exceptions={exceptions}
                  completions={completions}
                  currentDateStr={selectedDateStr}
                  onSetStatus={handleSetCompletionStatus}
                />
                <DailyGoalInput
                  selectedDateStr={selectedDateStr}
                  dailyGoals={dailyGoals}
                  onSaveDailyGoal={handleSaveDailyGoal}
                />
                <MustDoSection
                  userId={user.uid}
                  dateStr={selectedDateStr}
                  items={todayMustDos}
                  onAddItem={handleAddMustDo}
                  onToggleItem={handleToggleMustDo}
                  onDeleteItem={handleDeleteMustDo}
                  onClearCompleted={handleClearCompletedMustDos}
                />
                <HabitTrackerSection
                  userId={user.uid}
                  dateStr={selectedDateStr}
                  habits={habits}
                  habitHistory={habitHistory}
                  onAddHabit={handleAddHabit}
                  onToggleHabit={handleToggleHabit}
                  onDeleteHabit={handleDeleteHabit}
                />
              </>
            )}

            {(viewMode === 'both' || viewMode === 'day') && (
              <DayTimelineView
                currentDateStr={selectedDateStr}
                tasks={tasks}
                exceptions={exceptions}
                onSelectDate={setSelectedDateStr}
                onAddTask={(hour) => { setTaskToEdit(null); setDefaultStartHour(hour); setIsEditorOpen(true); }}
                onEditTask={(task) => { setTaskToEdit(task); setIsEditorOpen(true); }}
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

            {viewMode !== 'month' && viewMode !== 'todos' && (
              <div className="flex gap-2.5">
                <button onClick={() => setShowCopyDayDialog(true)} className="btn-secondary flex-1 h-10 text-xs">
                  <Copy className="w-4 h-4" /> Duplicate Day Blocks
                </button>
                <button onClick={() => setShowCopyWeekDialog(true)} className="btn-secondary flex-1 h-10 text-xs">
                  <Copy className="w-4 h-4" /> Duplicate Week Blocks
                </button>
              </div>
            )}

            {viewMode !== 'month' && viewMode !== 'todos' && (
              <>
                <TaskTemplateSection
                  userId={user.uid}
                  templates={templates}
                  onSelectTemplate={(tpl) => {
                    setDefaultStartHour(tpl.startHour ?? 9);
                    setTaskToEdit({ id: '', userId: user.uid, title: tpl.title || '', notes: tpl.notes || '', startHour: tpl.startHour ?? 9, endHour: tpl.endHour ?? 10, anchorDate: selectedDateStr, recurrence: tpl.recurrence || Recurrence.NONE, notifyEnabled: false, priority: tpl.priority || false, color: tpl.categoryColor || '#e56b55', createdAt: '', updatedAt: '' });
                    setIsEditorOpen(true);
                  }}
                  onDeleteTemplate={handleDeleteTemplate}
                />
                <GCalSyncButton userId={user.uid} selectedDateStr={selectedDateStr} tasks={tasks} onImportEvent={handleImportTask} onImportComplete={() => {}} />
                <DailyReflectionSection selectedDateStr={selectedDateStr} reflections={reflections} onSaveReflection={handleSaveReflection} />
              </>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      <footer className="w-full py-6 border-t border-ledger-line text-center text-xs text-ledger-paper-dim font-medium">
        By Abhishek.DL
      </footer>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        tasks={tasks}
        todos={todos}
        habits={habits}
        onSelectTask={(task) => {
          setTaskToEdit(task);
          setSelectedDateStr(task.anchorDate);
          setIsEditorOpen(true);
        }}
        onSelectDate={(dateStr) => {
          setSelectedDateStr(dateStr);
          setViewMode('both');
        }}
      />

      <TaskEditorModal
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setTaskToEdit(null); }}
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

      <RewardConfetti active={showConfetti} />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3.5 max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {activeNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              layout
              className="w-full surface-card overflow-hidden p-4 flex flex-col gap-3.5" style={{ boxShadow: "var(--shadow-lg)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-ledger-coral flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ledger-coral animate-ping" />
                    {notif.type.replace('_', ' ')}
                  </span>
                  <h4 className="text-xs font-bold text-ledger-paper mt-0.5 leading-snug">{notif.title}</h4>
                  <p className="text-[11px] text-ledger-paper-dim/80 mt-1 leading-relaxed whitespace-pre-line">{notif.body}</p>
                </div>
                <button onClick={() => handleDismissNotification(notif.id)} className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {notif.actions && notif.actions.length > 0 && (
                <div className="flex gap-2 pt-0.5">
                  {notif.actions.map((act) => (
                    <button key={act.action} onClick={() => handleExecuteNotificationAction(notif.id, act.action)} className="flex-1 h-8 bg-ledger-slate-light hover:bg-ledger-coral hover:text-ledger-dark border border-ledger-line hover:border-ledger-coral rounded-xl text-[10px] font-sans font-bold text-ledger-paper transition-all cursor-pointer flex items-center justify-center gap-1">
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
  );
}
