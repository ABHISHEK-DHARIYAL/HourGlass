// Purpose: Auto-schedule assistant banner and controls for unscheduled inbox to-dos in the timeline view

import React from 'react';
import { TodoItem } from '../types';
import { formatHourLabel } from '../utils/dateUtils';
import { Sparkles, Wand2 } from 'lucide-react';

interface AutoScheduleInboxAssistantProps {
  incompleteTodos: TodoItem[];
  suggestedSlots: Record<string, { start: number; end: number }>;
  currentDateStr: string;
  showAutoSchedule: boolean;
  setShowAutoSchedule: (show: boolean) => void;
  onScheduleTodo?: (todoId: string, title: string, notes: string, date: string, startHour: number, endHour: number, priority?: boolean) => Promise<void>;
}

export default function AutoScheduleInboxAssistant({
  incompleteTodos,
  suggestedSlots,
  currentDateStr,
  showAutoSchedule,
  setShowAutoSchedule,
  onScheduleTodo,
}: AutoScheduleInboxAssistantProps) {
  if (incompleteTodos.length === 0) return null;

  return (
    <div className="bg-ledger-slate-light/10 border-b border-ledger-line p-3 px-5 flex flex-col gap-2.5 font-sans">
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
  );
}
