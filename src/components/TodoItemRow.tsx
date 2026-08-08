// Purpose: Interactive single item row and inline scheduling form for the To-Do List view

import React from 'react';
import { TodoItem } from '../types';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Calendar, 
  AlertTriangle, 
  ArrowUp, 
  ArrowDown, 
  Star,
  GripVertical,
  CalendarPlus,
  X
} from 'lucide-react';

interface TodoItemRowProps {
  key?: string;
  todo: TodoItem;
  index: number;
  activeIndex: number;
  filter: string;
  draggedIndex: number | null;
  activeTodosCount: number;
  schedulingTodoId: string | null;
  scheduleDate: string;
  scheduleStartHour: number;
  scheduleEndHour: number;
  setSchedulingTodoId: (id: string | null) => void;
  setScheduleDate: (date: string) => void;
  setScheduleStartHour: (hour: number) => void;
  setScheduleEndHour: (hour: number) => void;
  handleToggleTodo: (todo: TodoItem) => Promise<void>;
  handleTogglePriority: (todo: TodoItem) => Promise<void>;
  handleMoveOrder: (index: number, direction: 'up' | 'down') => Promise<void>;
  handleConfirmSchedule: (todo: TodoItem) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  formatHourLabel: (hour: number) => string;
}

export default function TodoItemRow({
  todo,
  activeIndex,
  filter,
  draggedIndex,
  activeTodosCount,
  schedulingTodoId,
  scheduleDate,
  scheduleStartHour,
  scheduleEndHour,
  setSchedulingTodoId,
  setScheduleDate,
  setScheduleStartHour,
  setScheduleEndHour,
  handleToggleTodo,
  handleTogglePriority,
  handleMoveOrder,
  handleConfirmSchedule,
  onDeleteTodo,
  handleDragStart,
  handleDragOver,
  handleDrop,
  formatHourLabel
}: TodoItemRowProps) {
  const isOverdue = (t: TodoItem) => {
    if (!t.dueDate || t.done) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate < today;
  };

  return (
    <div 
      draggable={filter === 'all'}
      onDragStart={(e) => handleDragStart(e, activeIndex)}
      onDragOver={(e) => handleDragOver(e, activeIndex)}
      onDrop={(e) => handleDrop(e, activeIndex)}
      className={`flex flex-col gap-2 p-3 rounded-xl bg-ledger-slate/40 border border-ledger-line/30 hover:border-ledger-line/80 transition-all ${draggedIndex === activeIndex ? 'opacity-40 bg-ledger-slate-light/20' : ''}`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {filter === 'all' && (
            <div className="text-ledger-paper-dim/20 cursor-grab active:cursor-grabbing hover:text-ledger-paper-dim/50 p-0.5 shrink-0">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
          
          <button
            onClick={() => handleToggleTodo(todo)}
            className="text-left cursor-pointer shrink-0"
          >
            {todo.done ? (
              <CheckSquare className="w-4.5 h-4.5 text-ledger-coral" />
            ) : (
              <Square className="w-4.5 h-4.5 text-ledger-paper-dim/55 hover:text-ledger-paper transition-colors" />
            )}
          </button>

          <div className="flex flex-col min-w-0 flex-1 pl-0.5">
            <span className="text-xs text-ledger-paper font-sans leading-relaxed break-all font-medium">
              {todo.title}
            </span>
            
            {todo.dueDate && (
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="w-3 h-3 text-ledger-paper-dim/50" />
                <span className={`font-mono text-[9px] ${isOverdue(todo) ? 'text-ledger-coral font-bold' : 'text-ledger-paper-dim/60'}`}>
                  {todo.dueDate} {isOverdue(todo) && '(Overdue)'}
                </span>
                {isOverdue(todo) && (
                  <AlertTriangle className="w-3 h-3 text-ledger-coral shrink-0" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (schedulingTodoId === todo.id) {
                setSchedulingTodoId(null);
              } else {
                setSchedulingTodoId(todo.id);
                setScheduleStartHour(9);
                setScheduleEndHour(10);
              }
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${schedulingTodoId === todo.id ? 'bg-ledger-coral/15 text-ledger-coral font-bold' : 'text-ledger-paper-dim/30 hover:text-ledger-paper-dim/60'}`}
            title="Schedule on Calendar"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleTogglePriority(todo)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${todo.priority ? 'text-ledger-coral hover:bg-ledger-coral/10' : 'text-ledger-paper-dim/30 hover:text-ledger-paper-dim/60'}`}
            title={todo.priority ? 'Remove Priority' : 'Mark Priority'}
          >
            <Star className={`w-3.5 h-3.5 ${todo.priority ? 'fill-ledger-coral text-ledger-coral' : ''}`} />
          </button>

          {filter === 'all' && (
            <>
              <button
                onClick={() => handleMoveOrder(activeIndex, 'up')}
                disabled={activeIndex === 0}
                className="p-1 rounded text-ledger-paper-dim/30 hover:text-ledger-paper disabled:opacity-10 transition-colors"
                title="Move Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleMoveOrder(activeIndex, 'down')}
                disabled={activeIndex === activeTodosCount - 1}
                className="p-1 rounded text-ledger-paper-dim/30 hover:text-ledger-paper disabled:opacity-10 transition-colors"
                title="Move Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            onClick={() => onDeleteTodo(todo.id)}
            className="p-1.5 rounded-lg text-ledger-paper-dim/20 hover:text-ledger-coral transition-colors ml-1"
            title="Delete Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {schedulingTodoId === todo.id && (
        <div className="mt-1 border-t border-ledger-line/20 pt-2.5 pb-1 px-1 flex flex-col gap-2.5 animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between text-[10px] font-mono text-ledger-coral uppercase tracking-wider font-semibold">
            <span>Schedule onto hourly layout</span>
            <button 
              type="button"
              onClick={() => setSchedulingTodoId(null)}
              className="text-ledger-paper-dim/40 hover:text-ledger-coral p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-ledger-paper-dim/60 font-mono">Date:</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full bg-ledger-dark border border-ledger-line text-xs font-sans text-ledger-paper rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-ledger-coral cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-ledger-paper-dim/60 font-mono">Start Time:</label>
                <select
                  value={scheduleStartHour}
                  onChange={(e) => {
                    const start = parseInt(e.target.value);
                    setScheduleStartHour(start);
                    setScheduleEndHour((start + 1) % 24 || 24);
                  }}
                  className="w-full bg-ledger-dark border border-ledger-line text-xs font-sans text-ledger-paper rounded-lg px-2 py-1.5 focus:outline-none focus:border-ledger-coral cursor-pointer"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{formatHourLabel(h)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-ledger-paper-dim/60 font-mono">End Time:</label>
                <select
                  value={scheduleEndHour}
                  onChange={(e) => setScheduleEndHour(parseInt(e.target.value))}
                  className="w-full bg-ledger-dark border border-ledger-line text-xs font-sans text-ledger-paper rounded-lg px-2 py-1.5 focus:outline-none focus:border-ledger-coral cursor-pointer"
                >
                  {Array.from({ length: 24 }).map((_, h) => {
                    const hourVal = h + 1;
                    return (
                      <option key={hourVal} value={hourVal}>{formatHourLabel(hourVal === 24 ? 0 : hourVal)}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleConfirmSchedule(todo)}
            className="w-full h-8 flex items-center justify-center gap-1.5 bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark font-sans font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer mt-1"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Confirm Schedule</span>
          </button>
        </div>
      )}
    </div>
  );
}
