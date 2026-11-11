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
      className={`flex flex-col gap-2 p-3 surface-panel rounded-xl hover:border-ledger-coral/30 transition-all ${draggedIndex === activeIndex ? 'opacity-40 bg-ledger-slate-light' : ''}`}
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
            <span className="text-xs text-ledger-paper leading-relaxed break-all font-medium">
              {todo.title}
            </span>
            
            {todo.dueDate && (
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="w-3 h-3 text-ledger-paper-dim/50" />
                <span className={`font-mono text-[10px] ${isOverdue(todo) ? 'text-ledger-danger font-bold' : 'text-ledger-paper-dim'}`}>
                  {todo.dueDate} {isOverdue(todo) && '(Overdue)'}
                </span>
                {isOverdue(todo) && (
                  <AlertTriangle className="w-3 h-3 text-ledger-danger shrink-0" />
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
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${schedulingTodoId === todo.id ? 'bg-ledger-coral/15 text-ledger-coral font-bold' : 'text-ledger-paper-dim/50 hover:text-ledger-paper hover:bg-ledger-slate-light'}`}
            title="Schedule on Calendar"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleTogglePriority(todo)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${todo.priority ? 'text-ledger-gold hover:bg-ledger-gold/10' : 'text-ledger-paper-dim/50 hover:text-ledger-paper hover:bg-ledger-slate-light'}`}
            title={todo.priority ? 'Remove Priority' : 'Mark Priority'}
          >
            <Star className={`w-3.5 h-3.5 ${todo.priority ? 'fill-ledger-gold text-ledger-gold' : ''}`} />
          </button>

          {filter === 'all' && (
            <>
              <button
                onClick={() => handleMoveOrder(activeIndex, 'up')}
                disabled={activeIndex === 0}
                className="p-1.5 rounded-lg text-ledger-paper-dim/50 hover:text-ledger-paper hover:bg-ledger-slate-light disabled:opacity-20 transition-colors"
                title="Move Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleMoveOrder(activeIndex, 'down')}
                disabled={activeIndex === activeTodosCount - 1}
                className="p-1.5 rounded-lg text-ledger-paper-dim/50 hover:text-ledger-paper hover:bg-ledger-slate-light disabled:opacity-20 transition-colors"
                title="Move Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            onClick={() => onDeleteTodo(todo.id)}
            className="p-1.5 rounded-lg text-ledger-paper-dim/50 hover:text-ledger-danger hover:bg-ledger-danger/10 transition-colors ml-1"
            title="Delete Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {schedulingTodoId === todo.id && (
        <div className="mt-1 border-t border-ledger-line pt-2.5 pb-1 px-1 flex flex-col gap-2.5 animate-fade-up">
          <div className="flex items-center justify-between text-[11px] text-ledger-coral uppercase tracking-wider font-semibold">
            <span>Schedule onto hourly layout</span>
            <button 
              type="button"
              onClick={() => setSchedulingTodoId(null)}
              className="text-ledger-paper-dim/60 hover:text-ledger-coral p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-ledger-paper-dim font-medium">Date:</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="input-base w-full text-xs !py-1.5 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-ledger-paper-dim font-medium">Start Time:</label>
                <select
                  value={scheduleStartHour}
                  onChange={(e) => {
                    const start = parseInt(e.target.value);
                    setScheduleStartHour(start);
                    setScheduleEndHour((start + 1) % 24 || 24);
                  }}
                  className="input-base w-full text-xs !px-2 !py-1.5 cursor-pointer"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{formatHourLabel(h)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-ledger-paper-dim font-medium">End Time:</label>
                <select
                  value={scheduleEndHour}
                  onChange={(e) => setScheduleEndHour(parseInt(e.target.value))}
                  className="input-base w-full text-xs !px-2 !py-1.5 cursor-pointer"
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
            className="btn-primary w-full h-9 text-xs mt-1"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>Confirm Schedule</span>
          </button>
        </div>
      )}
    </div>
  );
}
