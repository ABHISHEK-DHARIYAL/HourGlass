// Purpose: Global search dialog allowing search across tasks, todos, and habits

import React, { useEffect } from 'react';
import { Task, TodoItem, Habit, Note } from '../types';
import { Search, X, Clock, CheckSquare, Calendar, ArrowRight, StickyNote } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tasks: Task[];
  todos: TodoItem[];
  habits: Habit[];
  notes?: Note[];
  onSelectNote?: (id: string) => void;
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
  notes = [],
  onSelectNote,
  onSelectTask,
  onSelectDate,
}: GlobalSearchModalProps) {
  // Close on Escape key (hook must run before the early return below)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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

  const matchingNotes = query
    ? notes.filter(n => !n.trashed && (n.title.toLowerCase().includes(query) || n.plainText.toLowerCase().includes(query) || n.tags.some(t => t.includes(query))))
    : [];

  const hasResults = matchingTasks.length > 0 || matchingTodos.length > 0 || matchingHabits.length > 0 || matchingNotes.length > 0;

  return (
    <div
      className="dialog-overlay items-start pt-20"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dialog-panel max-w-lg w-full p-5 flex flex-col gap-4 relative max-h-[80vh] animate-fade-up">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-ledger-gold absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, todos, habits, or notes..."
              className="input-base w-full h-12 pl-11 pr-4 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="btn-icon !w-10 !h-10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
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

          {matchingNotes.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-ledger-gold uppercase tracking-widest font-bold flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                <span>Notes ({matchingNotes.length})</span>
              </span>
              {matchingNotes.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  onClick={() => { onSelectNote?.(n.id); onClose(); }}
                  className="p-3 surface-panel hover:border-ledger-coral rounded-xl cursor-pointer transition-all group"
                >
                  <h5 className="font-semibold text-xs text-ledger-paper truncate group-hover:text-ledger-coral">{n.title || 'Untitled'}</h5>
                  {n.plainText && <p className="text-[11px] text-ledger-paper-dim truncate mt-0.5">{n.plainText.slice(0, 100)}</p>}
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
