/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Task, DailyGoal, Recurrence } from '../types';
import { 
  getTaskSegmentsForDate, 
  formatHourLabel, 
  parseLocalDate, 
  formatDate,
  TaskSegment 
} from '../utils/dateUtils';
import { Plus, Clock, FileText, Repeat, Bell, ChevronLeft, ChevronRight, Target, CalendarDays, Check, Star, Sparkles, Wand2, Play, Pause, List, ArrowUpDown } from 'lucide-react';
import { TodoItem, TaskCompletion } from '../types';
import { motion } from 'motion/react';
import MarkdownRenderer from './MarkdownRenderer';

interface DayTimelineViewProps {
  currentDateStr: string;
  tasks: Task[];
  onSelectDate: (dateStr: string) => void;
  onAddTask: (startHour: number) => void;
  onEditTask: (task: Task) => void;
  dailyGoals?: DailyGoal[];
  onMoveTasks?: (taskIds: string[], targetDate: string) => Promise<void>;
  todos?: TodoItem[];
  onScheduleTodo?: (todoId: string, title: string, notes: string, date: string, startHour: number, endHour: number, priority?: boolean) => Promise<void>;
  onUpdateTaskTimes?: (taskId: string, startHour: number, endHour: number) => Promise<void>;
  completions?: TaskCompletion[];
  onStartTimer?: (taskId: string, date: string) => Promise<void>;
  onStopTimer?: (taskId: string, date: string) => Promise<void>;
}

interface PositionedSegment extends TaskSegment {
  left: number;  // percentage (0-100)
  width: number; // percentage (0-100)
}

export default function DayTimelineView({
  currentDateStr,
  tasks,
  onSelectDate,
  onAddTask,
  onEditTask,
  dailyGoals = [],
  onMoveTasks,
  todos = [],
  onScheduleTodo,
  onUpdateTaskTimes,
  completions = [],
  onStartTimer,
  onStopTimer,
}: DayTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [moveTargetDate, setMoveTargetDate] = useState(currentDateStr);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  
  const [sortBy, setSortBy] = useState<'time' | 'priority'>(() => {
    return (localStorage.getItem('hourglass_day_sort_preference') as 'time' | 'priority') || 'time';
  });

  const [layoutMode, setLayoutMode] = useState<'timeline' | 'list'>(() => {
    return (localStorage.getItem('hourglass_day_layout_preference') as 'timeline' | 'list') || 'timeline';
  });

  const handleSortChange = (preference: 'time' | 'priority') => {
    setSortBy(preference);
    localStorage.setItem('hourglass_day_sort_preference', preference);
  };

  const handleLayoutModeChange = (preference: 'timeline' | 'list') => {
    setLayoutMode(preference);
    localStorage.setItem('hourglass_day_layout_preference', preference);
  };
  
  const [tick, setTick] = useState(0);

  // Active timer real-time clock ticking effect
  useEffect(() => {
    const activeTimers = completions.filter(c => c.date === currentDateStr && c.timerStartedAt);
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [completions, currentDateStr]);

  const hourRowHeight = 72; // px per hour slot

  const activeSegments = getTaskSegmentsForDate(tasks, currentDateStr);

  const getOccupiedHours = (): Set<number> => {
    const busy = new Set<number>();
    activeSegments.forEach(seg => {
      let h = seg.startHour;
      let iterations = 0;
      const targetEnd = seg.endHour % 24;
      while (h !== targetEnd && iterations < 24) {
        busy.add(h);
        h = (h + 1) % 24;
        iterations++;
      }
    });
    return busy;
  };

  const getSuggestedSlotsForTodos = (activeTodos: TodoItem[]): Record<string, { start: number; end: number }> => {
    const suggestions: Record<string, { start: number; end: number }> = {};
    const busy = getOccupiedHours();

    const preferredHours = [
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      7, 6, 22, 23, 0, 1, 2, 3, 4, 5
    ];

    let currentPreferredIdx = 0;

    activeTodos.forEach(todo => {
      while (currentPreferredIdx < preferredHours.length) {
        const h = preferredHours[currentPreferredIdx];
        if (!busy.has(h)) {
          suggestions[todo.id] = { start: h, end: (h + 1) % 24 || 24 };
          busy.add(h);
          currentPreferredIdx++;
          break;
        }
        currentPreferredIdx++;
      }
    });

    return suggestions;
  };

  const incompleteTodos = todos.filter(t => !t.done);
  const suggestedSlots = getSuggestedSlotsForTodos(incompleteTodos);

  // Refresh current time indicator every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to active hour on load if it's today + reset select mode
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedTaskIds(new Set());
    setMoveTargetDate(currentDateStr);

    const todayStr = formatDate(new Date());
    if (currentDateStr === todayStr && containerRef.current) {
      const currentHour = new Date().getHours();
      // Scroll to approx 2 hours before the current hour so it's centered nicely
      const scrollHour = Math.max(0, currentHour - 2);
      containerRef.current.scrollTop = scrollHour * hourRowHeight;
    } else if (containerRef.current) {
      // Scroll to morning hours (e.g., 7 AM) for general view
      containerRef.current.scrollTop = 7 * hourRowHeight;
    }
  }, [currentDateStr]);

  // Layout algorithm to handle overlapping tasks side-by-side
  const getPositionedSegments = (segs: TaskSegment[]): PositionedSegment[] => {
    // Sort by chosen preference (priority or start time)
    const sorted = [...segs].sort((a, b) => {
      if (sortBy === 'priority') {
        const aPri = a.task.priority ? 1 : 0;
        const bPri = b.task.priority ? 1 : 0;
        if (aPri !== bPri) return bPri - aPri;
      }
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return (b.endHour - b.startHour) - (a.endHour - a.startHour);
    });

    const positioned: PositionedSegment[] = [];
    const activeColumns: PositionedSegment[][] = [];

    for (const seg of sorted) {
      let placed = false;
      // Try to place in an existing column where it doesn't overlap with the last element
      for (let c = 0; c < activeColumns.length; c++) {
        const lastInCol = activeColumns[c][activeColumns[c].length - 1];
        if (seg.startHour >= lastInCol.endHour) {
          const posSeg: PositionedSegment = { ...seg, left: 0, width: 0 }; // temporary values
          activeColumns[c].push(posSeg);
          positioned.push(posSeg);
          placed = true;
          break;
        }
      }

      if (!placed) {
        // Create new column
        const posSeg: PositionedSegment = { ...seg, left: 0, width: 0 };
        activeColumns.push([posSeg]);
        positioned.push(posSeg);
      }
    }

    // Now calculate actual left and width percentages for overlapping sets
    // A simple overlap group solver
    positioned.forEach((seg) => {
      // Find all segments that overlap with this segment
      const overlaps = positioned.filter(
        other => !(seg.endHour <= other.startHour || seg.startHour >= other.endHour)
      );

      // Map these overlaps to find their column index
      const cols = overlaps.map(o => {
        // Find which column in activeColumns contains this overlap
        return activeColumns.findIndex(col => col.some(item => item.task.id === o.task.id && item.startHour === o.startHour));
      });

      const maxColIdx = Math.max(...cols, 0);
      const totalColsNeeded = activeColumns.length; // Max overlapping columns we have globally or in this set

      const colIdx = activeColumns.findIndex(col => col.some(item => item.task.id === seg.task.id && item.startHour === seg.startHour));
      
      // Let's set responsive side-by-side widths
      seg.width = 100 / totalColsNeeded;
      seg.left = colIdx * seg.width;
    });

    return positioned;
  };

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchMove = async () => {
    if (selectedTaskIds.size === 0 || !moveTargetDate) return;
    if (onMoveTasks) {
      try {
        const ids = Array.from(selectedTaskIds) as string[];
        await onMoveTasks(ids, moveTargetDate);
        setIsSelectMode(false);
        setSelectedTaskIds(new Set());
      } catch (err) {
        console.error('Batch move failed:', err);
      }
    }
  };

  const positionedSegments = getPositionedSegments(activeSegments);

  const listSegments = [...activeSegments].sort((a, b) => {
    if (sortBy === 'priority') {
      const aPri = a.task.priority ? 1 : 0;
      const bPri = b.task.priority ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
    }
    if (a.startHour !== b.startHour) return a.startHour - b.startHour;
    return (b.endHour - b.startHour) - (a.endHour - a.startHour);
  });

  const currentDailyGoalObj = dailyGoals.find(g => g.date === currentDateStr);
  const currentDailyGoal = currentDailyGoalObj?.goal || '';

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isToday = currentDateStr === formatDate(currentTime);
  const todayDate = parseLocalDate(currentDateStr);
  
  const formattedDayHeader = todayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const handlePrevDay = () => {
    const d = parseLocalDate(currentDateStr);
    d.setDate(d.getDate() - 1);
    onSelectDate(formatDate(d));
  };

  const handleNextDay = () => {
    const d = parseLocalDate(currentDateStr);
    d.setDate(d.getDate() + 1);
    onSelectDate(formatDate(d));
  };

  return (
    <div className="w-full flex flex-col bg-ledger-slate rounded-2xl border border-ledger-line shadow-xl font-sans overflow-hidden">
      {/* Date navigation bar */}
      <div className="flex items-center justify-between border-b border-ledger-line p-4 bg-ledger-dark/40">
        <button
          onClick={handlePrevDay}
          id="prev-day-button"
          className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h3 className="font-serif text-lg font-bold text-ledger-paper">
            {formattedDayHeader}
          </h3>
          <p className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest mt-0.5">
            {currentDateStr}
          </p>
        </div>

        <button
          onClick={handleNextDay}
          id="next-day-button"
          className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper transition-all cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* View & Sorting Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-ledger-line/30 px-4 py-2 bg-ledger-dark/25 gap-2">
        {/* Layout Modes */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-ledger-paper-dim/50 uppercase tracking-widest font-bold">View:</span>
          <div className="flex bg-ledger-dark/40 rounded-lg p-0.5 border border-ledger-line/30">
            <button
              onClick={() => handleLayoutModeChange('timeline')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-sans font-bold transition-all cursor-pointer ${
                layoutMode === 'timeline'
                  ? 'bg-ledger-coral text-ledger-dark shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => handleLayoutModeChange('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-sans font-bold transition-all cursor-pointer ${
                layoutMode === 'list'
                  ? 'bg-ledger-coral text-ledger-dark shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Sorting Toggles */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-ledger-paper-dim/50 uppercase tracking-widest font-bold">Sort:</span>
          <div className="flex bg-ledger-dark/40 rounded-lg p-0.5 border border-ledger-line/30">
            <button
              onClick={() => handleSortChange('time')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-sans font-bold transition-all cursor-pointer ${
                sortBy === 'time'
                  ? 'bg-ledger-coral text-ledger-dark shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Time</span>
            </button>
            <button
              onClick={() => handleSortChange('priority')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-sans font-bold transition-all cursor-pointer ${
                sortBy === 'priority'
                  ? 'bg-ledger-coral text-ledger-dark shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Priority</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Daily Goal banner */}
      {currentDailyGoal && (
        <div id="timeline-daily-goal-banner" className="bg-ledger-dark/20 border-b border-ledger-line px-5 py-3 flex items-center gap-3 animate-in fade-in duration-200">
          <div className="p-1.5 rounded-lg bg-ledger-coral/10 text-ledger-coral flex-none">
            <Target className="w-4 h-4 text-ledger-coral" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[8px] text-ledger-coral uppercase tracking-widest block font-bold">
              Primary Goal of the Day
            </span>
            <p className="font-serif text-sm font-bold text-ledger-paper leading-relaxed mt-0.5" title={currentDailyGoal}>
              {currentDailyGoal}
            </p>
          </div>
        </div>
      )}

      {/* Auto-Schedule Inbox Assistant */}
      {incompleteTodos.length > 0 && (
        <div className="bg-ledger-slate-light/10 border-b border-ledger-line p-3 px-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAutoSchedule(!showAutoSchedule)}
              className="flex items-center gap-2 hover:text-ledger-coral text-xs font-serif font-bold text-ledger-paper transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-ledger-coral animate-pulse" />
              <span>Unscheduled Inbox To-Dos ({incompleteTodos.length})</span>
              <span className="text-[10px] bg-ledger-gold/15 text-ledger-gold px-1.5 py-0.5 rounded font-mono uppercase font-bold shrink-0">
                Auto-Schedule
              </span>
            </button>
            
            <button
              onClick={() => setShowAutoSchedule(!showAutoSchedule)}
              className="text-[10px] text-ledger-paper-dim hover:text-ledger-paper underline cursor-pointer font-medium"
            >
              {showAutoSchedule ? 'Hide Assistant' : 'Show Suggestions'}
            </button>
          </div>

          {showAutoSchedule && (
            <div className="flex flex-col gap-2.5 border-t border-ledger-line/30 pt-2.5 animate-in fade-in duration-200">
              <p className="text-[11px] text-ledger-paper-dim font-sans leading-relaxed">
                Based on your active hours today, the assistant can optimally schedule these tasks into free blocks. Waking hours (8 AM – 10 PM) are prioritized!
              </p>

              <div className="max-h-44 overflow-y-auto flex flex-col gap-2 pr-1">
                {incompleteTodos.map(todo => {
                  const slot = suggestedSlots[todo.id];
                  return (
                    <div key={todo.id} className="p-2.5 bg-ledger-dark/30 border border-ledger-line/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-serif font-bold text-ledger-paper block truncate">
                          {todo.title}
                        </span>
                        {slot ? (
                          <span className="font-mono text-[9px] text-ledger-coral font-semibold">
                            Suggested: {formatHourLabel(slot.start)} – {formatHourLabel(slot.end)}
                          </span>
                        ) : (
                          <span className="font-mono text-[9px] text-ledger-paper-dim/50 italic">
                            No empty slots available today
                          </span>
                        )}
                      </div>

                      {slot && onScheduleTodo && (
                        <button
                          onClick={async () => {
                            await onScheduleTodo(todo.id, todo.title, todo.notes || '', currentDateStr, slot.start, slot.end, todo.priority);
                          }}
                          className="px-2.5 py-1 bg-ledger-coral/15 hover:bg-ledger-coral text-ledger-coral hover:text-ledger-dark border border-ledger-coral/20 rounded-lg text-[10px] font-sans font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Schedule</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {incompleteTodos.some(t => suggestedSlots[t.id]) && onScheduleTodo && (
                <button
                  onClick={async () => {
                    for (const todo of incompleteTodos) {
                      const slot = suggestedSlots[todo.id];
                      if (slot) {
                        await onScheduleTodo(todo.id, todo.title, todo.notes || '', currentDateStr, slot.start, slot.end, todo.priority);
                      }
                    }
                  }}
                  className="w-full h-8 flex items-center justify-center gap-1.5 bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark font-sans font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Schedule All Inbox To-Dos</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {layoutMode === 'list' ? (
        <div className="h-[480px] overflow-y-auto p-4 flex flex-col gap-3 bg-ledger-slate select-none animate-in fade-in duration-200">
          {listSegments.length > 0 ? (
            listSegments.map(({ task, startHour, endHour, isWrapped }, idx) => {
              const isPriority = task.priority === true;
              const isSelected = selectedTaskIds.has(task.id);
              
              const comp = completions.find(c => c.taskId === task.id && c.date === currentDateStr);
              let runningSeconds = 0;
              if (comp?.timerStartedAt) {
                runningSeconds = Math.floor((Date.now() - new Date(comp.timerStartedAt).getTime()) / 1000);
              }
              const totalActualSeconds = (comp?.actualDuration || 0) + runningSeconds;
              const isTimerRunning = !!comp?.timerStartedAt;

              const formatDuration = (seconds: number): string => {
                if (!seconds || seconds <= 0) return '0s';
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = seconds % 60;
                if (h > 0) return `${h}h ${m}m`;
                if (m > 0) return `${m}m ${s}s`;
                return `${s}s`;
              };

              return (
                <div
                  key={`list-task-${task.id}-${idx}`}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelectTask(task.id);
                    } else {
                      onEditTask(task);
                    }
                  }}
                  className={`p-3.5 bg-ledger-dark/35 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden group ${
                    isSelectMode ? 'hover:border-ledger-coral/50' : 'hover:border-ledger-coral/40'
                  } ${
                    isSelected ? 'border-ledger-gold ring-1 ring-ledger-gold/30 bg-ledger-gold/5' : 'border-ledger-line/50'
                  }`}
                  style={{
                    borderLeftWidth: '5px',
                    borderLeftColor: task.color || '#e56b55'
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      {/* Time and metadata row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-ledger-coral font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatHourLabel(startHour)} – {formatHourLabel(endHour)}</span>
                        </span>
                        
                        {isPriority && (
                          <span className="text-[9px] bg-ledger-gold/15 text-ledger-gold px-1.5 py-0.5 rounded font-mono uppercase font-bold flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-ledger-gold" />
                            <span>High Priority</span>
                          </span>
                        )}

                        {task.recurrence && task.recurrence !== Recurrence.NONE && (
                          <span className="text-[9px] bg-ledger-slate-light/40 text-ledger-paper-dim/80 px-1.5 py-0.5 rounded font-mono uppercase flex items-center gap-0.5" title="Recurring Task">
                            <Repeat className="w-2.5 h-2.5" />
                            <span>{task.recurrence}</span>
                          </span>
                        )}

                        {task.notifyEnabled && (
                          <span className="p-0.5 text-ledger-paper-dim/40" title="Notifications Enabled">
                            <Bell className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      {/* Task title */}
                      <h4 className="font-serif text-sm font-bold text-ledger-paper leading-snug mt-0.5">
                        {task.title}
                      </h4>
                    </div>

                    {/* Timer Actions & Select Buttons */}
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isSelectMode ? (
                        <div 
                          onClick={() => toggleSelectTask(task.id)}
                          className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-ledger-gold border-ledger-gold text-ledger-dark' 
                              : 'border-ledger-line bg-ledger-dark/20 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isTimerRunning ? (
                            <button
                              onClick={async () => {
                                if (onStopTimer) await onStopTimer(task.id, currentDateStr);
                              }}
                              className="h-7 px-2.5 bg-ledger-coral text-ledger-dark hover:opacity-90 transition-all font-sans font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 shadow"
                            >
                              <Pause className="w-3 h-3 fill-ledger-dark" />
                              <span>Stop</span>
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (onStartTimer) await onStartTimer(task.id, currentDateStr);
                              }}
                              className="h-7 px-2.5 bg-ledger-dark border border-ledger-line hover:border-ledger-coral text-ledger-paper hover:text-ledger-coral transition-all font-sans font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-ledger-paper" />
                              <span>Start</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Markdown Notes rendering with safety checks */}
                  {task.notes && (
                    <div className="text-[11px] opacity-75 mt-0.5 font-light leading-snug border-t border-ledger-line/20 pt-1.5">
                      <MarkdownRenderer text={task.notes} />
                    </div>
                  )}

                  {/* Spent time indicator */}
                  {totalActualSeconds > 0 && (
                    <div className="flex items-center gap-1 font-mono text-[9px] text-ledger-coral font-bold mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full bg-ledger-coral shrink-0 ${isTimerRunning ? 'animate-ping' : ''}`} />
                      <span>Spent: {formatDuration(totalActualSeconds)}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
              <div className="p-3 bg-ledger-dark/20 rounded-2xl border border-ledger-line">
                <FileText className="w-6 h-6 text-ledger-paper-dim/40" />
              </div>
              <div className="flex flex-col gap-1">
                <h5 className="font-serif text-sm font-bold text-ledger-paper">
                  No blocks scheduled
                </h5>
                <p className="text-xs text-ledger-paper-dim max-w-[200px] leading-relaxed mx-auto">
                  Click below to fill this day with organized, focused hours!
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div 
          ref={containerRef}
          className="relative h-[480px] overflow-y-auto scroll-smooth flex flex-row animate-in fade-in duration-200"
        >
        {/* Left side: Hour labels column */}
        <div className="w-16 flex-none border-r border-ledger-line bg-ledger-dark/10 select-none">
          {hours.map((hour) => (
            <div
              key={`label-${hour}`}
              className="flex items-center justify-center font-mono text-[10px] text-ledger-paper-dim/50 font-medium"
              style={{ height: `${hourRowHeight}px` }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Right side: Interactive slots and task overlays */}
        <div className="flex-1 relative">
          {/* Tappable background hour rows */}
          {hours.map((hour) => (
            <div
              key={`slot-${hour}`}
              onClick={() => onAddTask(hour)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverHour(hour);
              }}
              onDragLeave={() => {
                setDragOverHour(null);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverHour(null);
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId && onUpdateTaskTimes) {
                  const seg = positionedSegments.find(s => s.task.id === taskId);
                  if (seg) {
                    const duration = (seg.endHour - seg.startHour + 24) % 24 || 1;
                    const newStartHour = hour;
                    const newEndHour = (hour + duration) % 24 || 24;
                    await onUpdateTaskTimes(taskId, newStartHour, newEndHour);
                  }
                }
              }}
              id={`hour-row-${hour}`}
              className={`border-b border-ledger-line/40 hover:bg-ledger-slate-light/10 transition-all cursor-pointer relative ${
                dragOverHour === hour ? 'bg-ledger-coral/15 border-t-2 border-t-ledger-coral' : ''
              }`}
              style={{ height: `${hourRowHeight}px` }}
            >
              {/* Subtle visual dividing helper */}
              <div className="absolute top-0 left-0 right-0 h-full border-t border-ledger-line/10 pointer-events-none" />
              {dragOverHour === hour && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-mono text-ledger-coral font-bold uppercase tracking-wider bg-ledger-dark px-2 py-0.5 rounded border border-ledger-coral/30">
                    Drop to Schedule at {formatHourLabel(hour)}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Task cards absolutely positioned */}
          {positionedSegments.map(({ task, startHour, endHour, isWrapped }, idx) => {
            const topOffset = startHour * hourRowHeight;
            const blockHeight = (endHour - startHour) * hourRowHeight;

            // Determine custom color classes based on the task color preference
            let colorClasses = 'bg-ledger-coral/20 border-ledger-coral text-ledger-coral';
            let bgStyle = { backgroundColor: `${task.color}1e`, borderColor: task.color, color: task.color };
            
            // If color is a standard Tailwind hex, we style directly, otherwise use a smart fallback
            const isHex = task.color.startsWith('#');

            const isPriority = task.priority === true;
            const isSelected = selectedTaskIds.has(task.id);
            let cardBgStyle = isSelected
              ? { backgroundColor: `${task.color}3b`, borderColor: '#e5c07b', color: task.color }
              : (isHex ? bgStyle : {});

            if (isPriority && !isSelected) {
              cardBgStyle = {
                ...cardBgStyle,
                borderColor: '#d4af37', // ledger-gold
              };
            }

            const comp = completions.find(c => c.taskId === task.id && c.date === currentDateStr);
            let runningSeconds = 0;
            if (comp?.timerStartedAt) {
              runningSeconds = Math.floor((Date.now() - new Date(comp.timerStartedAt).getTime()) / 1000);
            }
            const totalActualSeconds = (comp?.actualDuration || 0) + runningSeconds;
            const duration = (endHour - startHour + 24) % 24 || 1;

            const formatDuration = (seconds: number): string => {
              if (!seconds || seconds <= 0) return '0s';
              const h = Math.floor(seconds / 3600);
              const m = Math.floor((seconds % 3600) / 60);
              const s = seconds % 60;
              if (h > 0) {
                return `${h}h ${m}m`;
              }
              if (m > 0) {
                return `${m}m ${s}s`;
              }
              return `${s}s`;
            };

            const isTimerRunning = !!comp?.timerStartedAt;
            if (isTimerRunning) {
              cardBgStyle = {
                ...cardBgStyle,
                boxShadow: '0 0 12px rgba(235, 110, 100, 0.45)', // subtle red glowing outline
                borderColor: '#eb6e64', // ledger-coral active color
              };
            }

            return (
              <motion.div
                key={`task-block-${task.id}-${idx}`}
                layout
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelectMode) {
                    toggleSelectTask(task.id);
                  } else {
                    onEditTask(task);
                  }
                }}
                draggable={!isSelectMode}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', task.id);
                  e.currentTarget.style.opacity = '0.5';
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                id={`task-block-${task.id}`}
                className={`absolute px-3 py-2 rounded-lg border-l-4 shadow-md font-sans transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer overflow-hidden flex flex-col justify-between ${
                  isSelected ? 'ring-2 ring-ledger-gold' : ''
                } ${
                  isPriority ? 'ring-1 ring-ledger-gold/50 shadow-[0_0_10px_rgba(212,175,55,0.35)]' : ''
                } ${
                  isTimerRunning ? 'ring-1 ring-ledger-coral/50 animate-pulse-subtle' : ''
                } cursor-grab active:cursor-grabbing`}
                style={{
                  top: `${topOffset + 2}px`,
                  height: `${blockHeight - 4}px`,
                  left: `${task.color ? '0' : '2'}%`, // offset if we overlap
                  width: `${task.color ? '96' : '96'}%`,
                  marginLeft: '2%',
                  zIndex: isSelected ? 11 : 10,
                  ...cardBgStyle
                }}
              >
                <div>
                  {/* Task Header info */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSelectMode && (
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          isSelected 
                            ? 'bg-ledger-gold border-ledger-gold text-ledger-dark' 
                            : 'border-ledger-paper-dim/40'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3] text-ledger-dark" />}
                        </div>
                      )}
                      <span className="font-serif text-sm font-semibold tracking-tight line-clamp-1">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPriority && (
                        <Star className="w-3.5 h-3.5 text-ledger-gold fill-ledger-gold animate-pulse shrink-0" title="High Priority" />
                      )}
                      {task.recurrence !== 'NONE' && (
                        <Repeat className="w-3 h-3 text-ledger-gold" title="Recurring task" />
                      )}
                      {task.notifyEnabled && (
                        <Bell className="w-3 h-3 text-ledger-coral" title="Reminders enabled" />
                      )}
                      {/* Active Duration Timer Button */}
                      {!isSelectMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTimerRunning) {
                              onStopTimer?.(task.id, currentDateStr);
                            } else {
                              onStartTimer?.(task.id, currentDateStr);
                            }
                          }}
                          className={`p-0.5 rounded cursor-pointer hover:bg-ledger-slate-light/30 transition-colors shrink-0 flex items-center justify-center ${
                            isTimerRunning ? 'text-ledger-coral animate-pulse' : 'text-ledger-paper-dim/60 hover:text-ledger-gold'
                          }`}
                          title={isTimerRunning ? "Stop/Pause Timer" : "Start Active Timer"}
                        >
                          {isTimerRunning ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Task notes preview */}
                  {task.notes && blockHeight >= 45 && (
                    <div className="text-[11px] opacity-75 mt-0.5 line-clamp-2 font-light leading-snug">
                      <MarkdownRenderer text={task.notes} />
                    </div>
                  )}
                </div>

                {/* Subtitle duration helper and elapsed timer tracker */}
                {blockHeight >= 35 && (
                  <div className="flex flex-col gap-0.5 w-full mt-1 shrink-0">
                    <div className="flex items-center gap-1 opacity-65 font-mono text-[9px]">
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {isWrapped ? 'Carryover till ' : ''}
                        {formatHourLabel(startHour)} – {formatHourLabel(endHour === 24 ? 0 : endHour)}
                        {` (${duration}h)`}
                      </span>
                    </div>
                    {totalActualSeconds > 0 && (
                      <div className="flex items-center gap-1 font-mono text-[9px] text-ledger-coral font-bold mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full bg-ledger-coral shrink-0 ${isTimerRunning ? 'animate-ping' : ''}`} />
                        <span>Spent: {formatDuration(totalActualSeconds)}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Current Time Indicator line */}
          {isToday && (
            <div
              className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
              style={{
                top: `${(currentTime.getHours() + currentTime.getMinutes() / 60) * hourRowHeight}px`
              }}
            >
              {/* Line */}
              <div className="w-full h-[2px] bg-ledger-coral relative">
                {/* Micro-dot overlay at start */}
                <div className="absolute -left-1.5 -top-1 w-2.5 h-2.5 rounded-full bg-ledger-coral" />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Footer controls & prompt button */}
      {isSelectMode ? (
        <div className="p-4 border-t border-ledger-line bg-ledger-dark/35 flex flex-col gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-ledger-gold">
              {selectedTaskIds.size} blocks selected
            </span>
            <button
              onClick={() => {
                setIsSelectMode(false);
                setSelectedTaskIds(new Set());
              }}
              className="text-xs text-ledger-paper-dim hover:text-ledger-paper underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={moveTargetDate}
              onChange={(e) => setMoveTargetDate(e.target.value)}
              className="flex-1 h-9 px-3 bg-ledger-dark border border-ledger-line rounded-lg text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral/50 font-sans"
            />
            <button
              onClick={handleBatchMove}
              disabled={selectedTaskIds.size === 0 || !moveTargetDate}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-lg font-sans font-bold text-xs cursor-pointer transition-all ${
                selectedTaskIds.size > 0 && moveTargetDate
                  ? 'bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark shadow-md'
                  : 'bg-ledger-slate-light text-ledger-paper-dim/40 border border-ledger-line pointer-events-none'
              }`}
            >
              Move Blocks
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-ledger-line bg-ledger-dark/20 flex items-center justify-between">
          <button
            onClick={() => {
              setIsSelectMode(true);
              setMoveTargetDate(currentDateStr);
            }}
            className="flex items-center gap-1.5 text-xs text-ledger-paper-dim hover:text-ledger-paper hover:bg-ledger-slate-light/50 px-2.5 py-1.5 rounded-lg border border-ledger-line/50 transition-all cursor-pointer font-sans"
          >
            <CalendarDays className="w-3.5 h-3.5 text-ledger-gold" />
            <span>Batch Move</span>
          </button>
          
          <button
            onClick={() => onAddTask(new Date().getHours())}
            id="add-task-fab"
            className="flex items-center gap-2 bg-ledger-coral hover:bg-ledger-coral/95 active:scale-95 transition-all text-ledger-dark font-sans font-bold px-4 py-2 rounded-xl shadow-lg cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Hour Block</span>
          </button>
        </div>
      )}
    </div>
  );
}
