// Purpose: Global search dialog allowing search across tasks, todos, and habits

import React from 'react';
import { Task, TodoItem, Habit } from '../types';
import { Search, X, Clock, CheckSquare, Calendar, ArrowRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tasks: Task[];
  todos: TodoItem[];
  habits: Habit[];
  onSelectTask: (task: Task) => void;
  onSelectDate: (dateStr: string) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  tasks = [],
  todos = [],
  habits = [],
  onSelectTask,
  onSelectDate,
}: GlobalSearchModalProps) {
  if (!isOpen) return null;

  const query = searchQuery.trim().toLowerCase();

  const matchingTasks = query
    ? tasks.filter(t => t.title.toLowerCase().includes(query) || (t.notes && t.notes.toLowerCase().includes(query)))
    : [];

  const matchingTodos = query
    ? todos.filter(t => t.title.toLowerCase().includes(query) || (t.notes && t.notes.toLowerCase().includes(query)))
    : [];

  const matchingHabits = query
    ? habits.filter(h => h.title.toLowerCase().includes(query))
    : [];

  const hasResults = matchingTasks.length > 0 || matchingTodos.length > 0 || matchingHabits.length > 0;

  return (
    <div className="dialog-overlay items-start pt-20">
      <div className="dialog-panel max-w-lg w-full p-5 flex flex-col gap-4 relative max-h-[80vh] animate-fade-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon !w-8 !h-8"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative">
          <Search className="w-5 h-5 text-ledger-gold absolute left-3.5 top-3" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, todos, habits, or notes..."
            className="input-base w-full h-12 pl-11 pr-4 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
          {!query && (
            <div className="text-center py-8 text-ledger-paper-dim text-xs uppercase tracking-wider">
              Type keywords to search schedule
            </div>
          )}

          {query && !hasResults && (
            <div className="text-center py-8 text-ledger-paper-dim text-xs uppercase tracking-wider">
              No matching schedule items found for "{searchQuery}"
            </div>
          )}

          {matchingTasks.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-ledger-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Hour Blocks ({matchingTasks.length})</span>
              </span>
              {matchingTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onSelectTask(t);
                    onClose();
                  }}
                  className="p-3 surface-panel hover:border-ledger-coral rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-xs text-ledger-paper truncate group-hover:text-ledger-coral">
                      {t.title}
                    </h5>
                    <p className="font-mono text-[11px] text-ledger-paper-dim mt-0.5">
                      {t.anchorDate} • {t.startHour}:00 - {t.endHour}:00
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ledger-paper-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))}
            </div>
          )}

          {matchingTodos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-ledger-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Inbox Todos ({matchingTodos.length})</span>
              </span>
              {matchingTodos.map((td) => (
                <div
                  key={td.id}
                  className="p-3 surface-panel rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h5 className={`font-semibold text-xs ${td.done ? 'line-through text-ledger-paper-dim/50' : 'text-ledger-paper'}`}>
                      {td.title}
                    </h5>
                    {td.notes && (
                      <p className="text-[10px] text-ledger-paper-dim/60 truncate mt-0.5">
                        {td.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {matchingHabits.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-ledger-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Habits ({matchingHabits.length})</span>
              </span>
              {matchingHabits.map((h) => (
                <div
                  key={h.id}
                  className="p-3 surface-panel rounded-xl flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                  <span className="font-semibold text-xs text-ledger-paper truncate">
                    {h.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
