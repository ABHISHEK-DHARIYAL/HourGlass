// Purpose: Alternative compact list view mode for day timeline view

import React from 'react';
import { Task, Recurrence, TaskCompletion } from '../types';
import { TaskSegment, formatHourLabel } from '../utils/dateUtils';
import { Clock, FileText, Repeat, Bell, Check, Star, Play, Pause } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface DayTimelineListViewProps {
  listSegments: TaskSegment[];
  currentDateStr: string;
  isSelectMode: boolean;
  selectedTaskIds: Set<string>;
  toggleSelectTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  completions: TaskCompletion[];
  onStartTimer?: (taskId: string, date: string) => Promise<void>;
  onStopTimer?: (taskId: string, date: string) => Promise<void>;
}

export default function DayTimelineListView({
  listSegments,
  currentDateStr,
  isSelectMode,
  selectedTaskIds,
  toggleSelectTask,
  onEditTask,
  completions,
  onStartTimer,
  onStopTimer,
}: DayTimelineListViewProps) {
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
    <div className="h-[480px] overflow-y-auto p-4 flex flex-col gap-3 bg-ledger-slate select-none animate-in fade-in duration-200 font-sans">
      {listSegments.length > 0 ? (
        listSegments.map(({ task, startHour, endHour }, idx) => {
          const isPriority = task.priority === true;
          const isSelected = selectedTaskIds.has(task.id);
          
          const comp = completions.find(c => c.taskId === task.id && c.date === currentDateStr);
          let runningSeconds = 0;
          if (comp?.timerStartedAt) {
            runningSeconds = Math.floor((Date.now() - new Date(comp.timerStartedAt).getTime()) / 1000);
          }
          const totalActualSeconds = (comp?.actualDuration || 0) + runningSeconds;
          const isTimerRunning = !!comp?.timerStartedAt;

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

                  <h4 className="font-serif text-sm font-bold text-ledger-paper leading-snug mt-0.5">
                    {task.title}
                  </h4>
                </div>

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

              {task.notes && (
                <div className="text-[11px] opacity-75 mt-0.5 font-light leading-snug border-t border-ledger-line/20 pt-1.5">
                  <MarkdownRenderer text={task.notes} />
                </div>
              )}

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
  );
}
