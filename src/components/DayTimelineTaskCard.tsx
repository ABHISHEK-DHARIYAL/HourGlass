// Purpose: Positioned task block component on the day timeline grid

import React from 'react';
import { Task, TaskCompletion } from '../types';
import { formatHourLabel } from '../utils/dateUtils';
import { Clock, Repeat, Bell, Check, Star, Play, Pause } from 'lucide-react';
import { motion } from 'motion/react';
import MarkdownRenderer from './MarkdownRenderer';

interface PositionedSegment {
  task: Task;
  startHour: number;
  endHour: number;
  isWrapped?: boolean;
  left: number;
  width: number;
}

interface DayTimelineTaskCardProps {
  key?: string;
  seg: PositionedSegment;
  idx: number;
  hourRowHeight: number;
  currentDateStr: string;
  isSelectMode: boolean;
  isSelected: boolean;
  toggleSelectTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  completions: TaskCompletion[];
  onStartTimer?: (taskId: string, date: string) => Promise<void>;
  onStopTimer?: (taskId: string, date: string) => Promise<void>;
}

export default function DayTimelineTaskCard({
  seg,
  idx,
  hourRowHeight,
  currentDateStr,
  isSelectMode,
  isSelected,
  toggleSelectTask,
  onEditTask,
  completions,
  onStartTimer,
  onStopTimer,
}: DayTimelineTaskCardProps) {
  const { task, startHour, endHour, isWrapped } = seg;
  const topOffset = startHour * hourRowHeight;
  const blockHeight = (endHour - startHour) * hourRowHeight;

  const bgStyle = { backgroundColor: `${task.color}1e`, borderColor: task.color, color: task.color };
  const isHex = task.color.startsWith('#');
  const isPriority = task.priority === true;

  let cardBgStyle: React.CSSProperties = isSelected
    ? { backgroundColor: `${task.color}3b`, borderColor: '#e5c07b', color: task.color }
    : (isHex ? bgStyle : {});

  if (isPriority && !isSelected) {
    cardBgStyle = {
      ...cardBgStyle,
      borderColor: '#d4af37',
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
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isTimerRunning = !!comp?.timerStartedAt;
  if (isTimerRunning) {
    cardBgStyle = {
      ...cardBgStyle,
      boxShadow: '0 0 12px rgba(235, 110, 100, 0.45)',
      borderColor: '#eb6e64',
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
      className={`absolute px-3 py-2 rounded-xl border-l-4 shadow-md transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer overflow-hidden flex flex-col justify-between backdrop-blur-[1px] ${
        isSelected ? 'ring-2 ring-ledger-gold' : ''
      } ${
        isPriority ? 'ring-1 ring-ledger-gold/50 shadow-[0_0_10px_rgba(212,175,55,0.35)]' : ''
      } ${
        isTimerRunning ? 'ring-1 ring-ledger-coral/50 animate-pulse-subtle' : ''
      } cursor-grab active:cursor-grabbing`}
      style={{
        top: `${topOffset + 2}px`,
        height: `${blockHeight - 4}px`,
        left: `${task.color ? '0' : '2'}%`,
        width: `${task.color ? '96' : '96'}%`,
        marginLeft: '2%',
        zIndex: isSelected ? 11 : 10,
        ...cardBgStyle
      }}
    >
      <div>
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
            <span className="text-sm font-semibold tracking-tight line-clamp-1">
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
        
        {task.notes && blockHeight >= 45 && (
          <div className="text-[11px] opacity-75 mt-0.5 line-clamp-2 font-light leading-snug">
            <MarkdownRenderer text={task.notes} />
          </div>
        )}
      </div>

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
}
