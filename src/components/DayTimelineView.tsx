// Purpose: Main day timeline schedule view with timeline grid, auto-scheduler, and batch management

import React, { useEffect, useRef, useState } from 'react';
import { Task, DailyGoal, TaskException } from '../types';
import { 
  getTaskSegmentsForDate, 
  formatHourLabel, 
  parseLocalDate, 
  formatDate,
  TaskSegment 
} from '../utils/dateUtils';
import { Plus, Clock, ChevronLeft, ChevronRight, Target, CalendarDays, Star, List, ArrowUpDown } from 'lucide-react';
import { TodoItem, TaskCompletion } from '../types';
import AutoScheduleInboxAssistant from './AutoScheduleInboxAssistant';
import DayTimelineListView from './DayTimelineListView';
import DayTimelineTaskCard from './DayTimelineTaskCard';
import DayTimelineBatchMoveBar from './DayTimelineBatchMoveBar';
import DayTimelineHeader from './DayTimelineHeader';

interface DayTimelineViewProps {
  currentDateStr: string;
  tasks: Task[];
  exceptions?: TaskException[];
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
  left: number;
  width: number;
}

export default function DayTimelineView({
  currentDateStr,
  tasks,
  exceptions = [],
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
  
  const [, setTick] = useState(0);

  useEffect(() => {
    const activeTimers = completions.filter(c => c.date === currentDateStr && c.timerStartedAt);
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [completions, currentDateStr]);

  const hourRowHeight = 72;

  const activeSegments = getTaskSegmentsForDate(tasks, currentDateStr, exceptions);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsSelectMode(false);
    setSelectedTaskIds(new Set());
    setMoveTargetDate(currentDateStr);

    const todayStr = formatDate(new Date());
    if (currentDateStr === todayStr && containerRef.current) {
      const currentHour = new Date().getHours();
      const scrollHour = Math.max(0, currentHour - 2);
      containerRef.current.scrollTop = scrollHour * hourRowHeight;
    } else if (containerRef.current) {
      containerRef.current.scrollTop = 7 * hourRowHeight;
    }
  }, [currentDateStr]);

  const getPositionedSegments = (segs: TaskSegment[]): PositionedSegment[] => {
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
      for (let c = 0; c < activeColumns.length; c++) {
        const lastInCol = activeColumns[c][activeColumns[c].length - 1];
        if (seg.startHour >= lastInCol.endHour) {
          const posSeg: PositionedSegment = { ...seg, left: 0, width: 0 };
          activeColumns[c].push(posSeg);
          positioned.push(posSeg);
          placed = true;
          break;
        }
      }

      if (!placed) {
        const posSeg: PositionedSegment = { ...seg, left: 0, width: 0 };
        activeColumns.push([posSeg]);
        positioned.push(posSeg);
      }
    }

    positioned.forEach((seg) => {
      const overlaps = positioned.filter(
        other => !(seg.endHour <= other.startHour || seg.startHour >= other.endHour)
      );

      const cols = overlaps.map(o => {
        return activeColumns.findIndex(col => col.some(item => item.task.id === o.task.id && item.startHour === o.startHour));
      });

      const totalColsNeeded = activeColumns.length;
      const colIdx = activeColumns.findIndex(col => col.some(item => item.task.id === seg.task.id && item.startHour === seg.startHour));
      
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
      <DayTimelineHeader
        formattedDayHeader={formattedDayHeader}
        currentDateStr={currentDateStr}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
      />

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

      <AutoScheduleInboxAssistant
        incompleteTodos={incompleteTodos}
        suggestedSlots={suggestedSlots}
        currentDateStr={currentDateStr}
        showAutoSchedule={showAutoSchedule}
        setShowAutoSchedule={setShowAutoSchedule}
        onScheduleTodo={onScheduleTodo}
      />

      {layoutMode === 'list' ? (
        <DayTimelineListView
          listSegments={listSegments}
          currentDateStr={currentDateStr}
          isSelectMode={isSelectMode}
          selectedTaskIds={selectedTaskIds}
          toggleSelectTask={toggleSelectTask}
          onEditTask={onEditTask}
          completions={completions}
          onStartTimer={onStartTimer}
          onStopTimer={onStopTimer}
        />
      ) : (
        <div 
          ref={containerRef}
          className="relative h-[480px] overflow-y-auto scroll-smooth flex flex-row animate-in fade-in duration-200"
        >
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

          <div className="flex-1 relative">
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

            {positionedSegments.map((seg, idx) => (
              <DayTimelineTaskCard
                key={`task-card-${seg.task.id}-${idx}`}
                seg={seg}
                idx={idx}
                hourRowHeight={hourRowHeight}
                currentDateStr={currentDateStr}
                isSelectMode={isSelectMode}
                isSelected={selectedTaskIds.has(seg.task.id)}
                toggleSelectTask={toggleSelectTask}
                onEditTask={onEditTask}
                completions={completions}
                onStartTimer={onStartTimer}
                onStopTimer={onStopTimer}
              />
            ))}

            {isToday && (
              <div
                className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                style={{
                  top: `${(currentTime.getHours() + currentTime.getMinutes() / 60) * hourRowHeight}px`
                }}
              >
                <div className="w-full h-[2px] bg-ledger-coral relative">
                  <div className="absolute -left-1.5 -top-1 w-2.5 h-2.5 rounded-full bg-ledger-coral" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <DayTimelineBatchMoveBar
        isSelectMode={isSelectMode}
        selectedCount={selectedTaskIds.size}
        moveTargetDate={moveTargetDate}
        setMoveTargetDate={setMoveTargetDate}
        onBatchMove={handleBatchMove}
        onCancelSelect={() => {
          setIsSelectMode(false);
          setSelectedTaskIds(new Set());
        }}
        onEnableSelectMode={() => {
          setIsSelectMode(true);
          setMoveTargetDate(currentDateStr);
        }}
        onAddTask={() => onAddTask(new Date().getHours())}
      />
    </div>
  );
}
