// Purpose: Main to-do list page view component for capturing and managing whenever/someday tasks

import React, { useState, useMemo } from 'react';
import { TodoItem } from '../types';
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Star
} from 'lucide-react';
import TodoItemRow from './TodoItemRow';

interface TodoListPageProps {
  userId: string;
  todos: TodoItem[];
  onSaveTodo: (todo: Partial<TodoItem>) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onClearCompletedTodos: () => Promise<void>;
  onScheduleTodo: (todoId: string, title: string, notes: string, date: string, startHour: number, endHour: number, priority?: boolean) => Promise<void>;
}

type FilterType = 'all' | 'due' | 'priority' | 'completed';

export default function TodoListPage({ userId, todos, onSaveTodo, onDeleteTodo, onClearCompletedTodos, onScheduleTodo }: TodoListPageProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Inline Scheduling state
  const [schedulingTodoId, setSchedulingTodoId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [scheduleStartHour, setScheduleStartHour] = useState<number>(9);
  const [scheduleEndHour, setScheduleEndHour] = useState<number>(10);

  const formatHourLabel = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  const handleConfirmSchedule = async (todo: TodoItem) => {
    try {
      if (onScheduleTodo) {
        await onScheduleTodo(
          todo.id,
          todo.title,
          todo.notes || '',
          scheduleDate,
          scheduleStartHour,
          scheduleEndHour,
          todo.priority
        );
        setSchedulingTodoId(null);
      }
    } catch (err) {
      console.error('Failed to schedule todo:', err);
    }
  };

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Separate active and completed todos
  const activeTodos = useMemo(() => {
    return todos
      .filter(t => !t.done)
      .sort((a, b) => a.order - b.order);
  }, [todos]);

  const completedTodos = useMemo(() => {
    return todos
      .filter(t => t.done)
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA; // Most recently completed first
      });
  }, [todos]);

  // Filtered active todos based on selected tab
  const filteredActiveTodos = useMemo(() => {
    switch (filter) {
      case 'due':
        return activeTodos
          .filter(t => !!t.dueDate)
          .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          });
      case 'priority':
        return activeTodos.filter(t => t.priority);
      case 'all':
      default:
        return activeTodos;
    }
  }, [activeTodos, filter]);

  // Handle Add Todo
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const maxOrder = activeTodos.reduce((max, item) => item.order > max ? item.order : max, -1);
    const order = maxOrder + 1;

    const todoData: Partial<TodoItem> = {
      userId,
      title: newTitle.trim(),
      done: false,
      priority: newPriority,
      order,
      createdAt: new Date().toISOString(),
    };

    if (newDueDate) {
      todoData.dueDate = newDueDate;
    }

    try {
      await onSaveTodo(todoData);
      setNewTitle('');
      setNewDueDate('');
      setNewPriority(false);
    } catch (err) {
      console.error('Failed to create todo:', err);
    }
  };

  // Toggle Todo Status
  const handleToggleTodo = async (todo: TodoItem) => {
    const isNowDone = !todo.done;
    const updated: Partial<TodoItem> = {
      ...todo,
      done: isNowDone,
      completedAt: isNowDone ? new Date().toISOString() : undefined
    };
    try {
      await onSaveTodo(updated);
    } catch (err) {
      console.error('Failed to toggle todo status:', err);
    }
  };

  // Toggle Priority
  const handleTogglePriority = async (todo: TodoItem) => {
    const updated: Partial<TodoItem> = {
      ...todo,
      priority: !todo.priority
    };
    try {
      await onSaveTodo(updated);
    } catch (err) {
      console.error('Failed to toggle priority:', err);
    }
  };

  // Move todo up or down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTodos.length) return;

    const itemA = activeTodos[index];
    const itemB = activeTodos[targetIndex];

    const orderA = itemA.order;
    const orderB = itemB.order;

    try {
      await onSaveTodo({ ...itemA, order: orderB });
      await onSaveTodo({ ...itemB, order: orderA });
    } catch (err) {
      console.error('Failed to update todo order:', err);
    }
  };

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const items = [...activeTodos];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    try {
      for (let i = 0; i < items.length; i++) {
        if (items[i].order !== i) {
          await onSaveTodo({ ...items[i], order: i });
        }
      }
    } catch (err) {
      console.error('Error saving reordered list:', err);
    }

    setDraggedIndex(null);
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-ledger-dark text-ledger-paper p-4 font-sans flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-ledger-line/30 pb-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ledger-paper">To-Do List</h2>
          <p className="font-mono text-[9px] text-ledger-paper-dim/60 uppercase tracking-widest mt-0.5">
            SOMEDAY & WHENEVER
          </p>
        </div>
        <span className="font-mono text-[10px] bg-ledger-slate border border-ledger-line text-ledger-coral px-2.5 py-1 rounded-full font-bold">
          {activeTodos.length} Open
        </span>
      </div>

      <div className="flex bg-ledger-slate rounded-xl border border-ledger-line p-0.5 w-full">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-serif transition-colors cursor-pointer text-center ${filter === 'all' ? 'bg-ledger-slate-light text-ledger-coral font-bold' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('due')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-serif transition-colors cursor-pointer text-center ${filter === 'due' ? 'bg-ledger-slate-light text-ledger-coral font-bold' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
        >
          Due Soon
        </button>
        <button
          onClick={() => setFilter('priority')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-serif transition-colors cursor-pointer text-center ${filter === 'priority' ? 'bg-ledger-slate-light text-ledger-coral font-bold' : 'text-ledger-paper-dim hover:text-ledger-paper'}`}
        >
          Priority
        </button>
      </div>

      <form onSubmit={handleAddTodo} className="bg-ledger-slate/60 border border-ledger-line rounded-2xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex gap-2">
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              placeholder="Add a new to-do item..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-ledger-dark/50 border border-ledger-line text-xs font-sans text-ledger-paper placeholder-ledger-paper-dim/35 rounded-xl px-3 py-2.5 focus:outline-none focus:border-ledger-coral"
              maxLength={200}
            />
          </div>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="bg-ledger-coral disabled:bg-ledger-coral/40 text-ledger-dark p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ledger-paper-dim/60 font-mono">Due Date:</span>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-ledger-dark/50 border border-ledger-line text-[10px] font-mono text-ledger-paper rounded-lg px-2 py-1 focus:outline-none focus:border-ledger-coral cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => setNewPriority(!newPriority)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${newPriority ? 'bg-ledger-coral/10 border-ledger-coral text-ledger-coral' : 'border-ledger-line hover:border-ledger-paper-dim text-ledger-paper-dim'}`}
          >
            <Star className={`w-3.5 h-3.5 ${newPriority ? 'fill-ledger-coral text-ledger-coral' : ''}`} />
            <span>High Priority</span>
          </button>
        </div>
      </form>

      <div className="flex-1 min-h-[150px]">
        {filteredActiveTodos.length === 0 ? (
          <div className="text-center py-12 px-4 bg-ledger-slate/20 rounded-2xl border border-ledger-line/20">
            <p className="text-xs text-ledger-paper-dim/60 italic font-serif">
              No open tasks in this view.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredActiveTodos.map((todo, index) => {
              const activeIndex = activeTodos.findIndex(t => t.id === todo.id);
              return (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  index={index}
                  activeIndex={activeIndex}
                  filter={filter}
                  draggedIndex={draggedIndex}
                  activeTodosCount={activeTodos.length}
                  schedulingTodoId={schedulingTodoId}
                  scheduleDate={scheduleDate}
                  scheduleStartHour={scheduleStartHour}
                  scheduleEndHour={scheduleEndHour}
                  setSchedulingTodoId={setSchedulingTodoId}
                  setScheduleDate={setScheduleDate}
                  setScheduleStartHour={setScheduleStartHour}
                  setScheduleEndHour={setScheduleEndHour}
                  handleToggleTodo={handleToggleTodo}
                  handleTogglePriority={handleTogglePriority}
                  handleMoveOrder={handleMoveOrder}
                  handleConfirmSchedule={handleConfirmSchedule}
                  onDeleteTodo={onDeleteTodo}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  formatHourLabel={formatHourLabel}
                />
              );
            })}
          </div>
        )}
      </div>

      {completedTodos.length > 0 && (
        <div className="border-t border-ledger-line/30 pt-3">
          <div className="flex items-center justify-between py-1 border-b border-ledger-line/10 pb-2 mb-2">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 font-serif text-xs font-bold text-ledger-paper-dim/80 hover:text-ledger-paper transition-colors cursor-pointer"
            >
              {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>Completed ({completedTodos.length})</span>
            </button>
            <button
              type="button"
              onClick={onClearCompletedTodos}
              className="px-2 py-1 text-[8px] font-mono font-bold bg-ledger-coral/10 hover:bg-ledger-coral/25 border border-ledger-coral/30 hover:border-ledger-coral text-ledger-coral rounded uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
            >
              Clear Completed
            </button>
          </div>

          {showCompleted && (
            <div className="mt-2 space-y-2.5 animate-fadeIn">
              {completedTodos.map((todo) => (
                <div 
                  key={todo.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-ledger-slate/15 border border-ledger-line/10"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleTodo(todo)}
                      className="cursor-pointer shrink-0"
                    >
                      <CheckSquare className="w-4 h-4 text-ledger-paper-dim/30" />
                    </button>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs line-through text-ledger-paper-dim/40 font-sans break-all">
                        {todo.title}
                      </span>
                      {todo.completedAt && (
                        <span className="font-mono text-[8px] text-ledger-paper-dim/30">
                          Completed on {new Date(todo.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTodo(todo.id)}
                    className="p-1 rounded hover:text-ledger-coral text-ledger-paper-dim/20 transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
