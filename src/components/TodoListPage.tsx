import React, { useState, useMemo } from 'react';
import { TodoItem } from '../types';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertTriangle, 
  ArrowUp, 
  ArrowDown, 
  ChevronDown, 
  ChevronRight, 
  Star,
  GripVertical,
  Mic,
  MicOff
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface TodoListPageProps {
  userId: string;
  todos: TodoItem[];
  onSaveTodo: (todo: Partial<TodoItem>) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onClearCompletedTodos: () => Promise<void>;
}

type FilterType = 'all' | 'due' | 'priority' | 'completed';

export default function TodoListPage({ userId, todos, onSaveTodo, onDeleteTodo, onClearCompletedTodos }: TodoListPageProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const [isListening, setIsListening] = useState(false);

  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setNewTitle(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
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
        // Has due date and incomplete
        return activeTodos
          .filter(t => !!t.dueDate)
          .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          });
      case 'priority':
        // High priority and incomplete
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

    // Calculate order (place at the end of active todos)
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

  // Move todo up or down (reorder buttons)
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTodos.length) return;

    const itemA = activeTodos[index];
    const itemB = activeTodos[targetIndex];

    // Swap orders
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

    // Create a copy of active todos to manipulate
    const items = [...activeTodos];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    // Save new orders
    try {
      // Reassign order sequentially and save items whose order has changed
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

  // Check if a todo is overdue
  const isOverdue = (todo: TodoItem) => {
    if (!todo.dueDate || todo.done) return false;
    const today = new Date().toISOString().split('T')[0];
    return todo.dueDate < today;
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-ledger-dark text-ledger-paper p-4 font-sans flex flex-col gap-4">
      {/* Page Title & Navigation */}
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

      {/* Filter Tabs */}
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

      {/* Add New To-Do Form */}
      <form onSubmit={handleAddTodo} className="bg-ledger-slate/60 border border-ledger-line rounded-2xl p-4 flex flex-col gap-3 shadow-md">
        <div className="flex gap-2">
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              placeholder="Add a new to-do item..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-ledger-dark/50 border border-ledger-line text-xs font-sans text-ledger-paper placeholder-ledger-paper-dim/35 rounded-xl pl-3 pr-9 py-2.5 focus:outline-none focus:border-ledger-coral"
              maxLength={200}
            />
            <button
              type="button"
              onClick={startDictation}
              className={`absolute right-2.5 p-1 rounded-full transition-all cursor-pointer ${
                isListening 
                  ? 'text-ledger-coral bg-ledger-coral/15 animate-pulse' 
                  : 'text-ledger-paper-dim/40 hover:text-ledger-coral'
              }`}
              title="Dictate with voice"
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="bg-ledger-coral disabled:bg-ledger-coral/40 text-ledger-dark p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
          </button>
        </div>

        {/* Due Date & Priority controls */}
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

      {/* Active To-Dos list */}
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
                <div 
                  key={todo.id} 
                  draggable={filter === 'all'} // Only support DnD when list is in original order
                  onDragStart={(e) => handleDragStart(e, activeIndex)}
                  onDragOver={(e) => handleDragOver(e, activeIndex)}
                  onDrop={(e) => handleDrop(e, activeIndex)}
                  className={`flex items-center justify-between gap-2.5 p-3 rounded-xl bg-ledger-slate/40 border border-ledger-line/30 hover:border-ledger-line/80 transition-all ${draggedIndex === activeIndex ? 'opacity-40 bg-ledger-slate-light/20' : ''}`}
                >
                  {/* Grip & Checkbox */}
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
                      
                      {/* Due date and status indicators */}
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

                  {/* Actions & Ordering Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Priority Toggle */}
                    <button
                      onClick={() => handleTogglePriority(todo)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${todo.priority ? 'text-ledger-coral hover:bg-ledger-coral/10' : 'text-ledger-paper-dim/30 hover:text-ledger-paper-dim/60'}`}
                      title={todo.priority ? 'Remove Priority' : 'Mark Priority'}
                    >
                      <Star className={`w-3.5 h-3.5 ${todo.priority ? 'fill-ledger-coral text-ledger-coral' : ''}`} />
                    </button>

                    {/* Order buttons (excellent touch alternative to DnD) */}
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
                          disabled={activeIndex === activeTodos.length - 1}
                          className="p-1 rounded text-ledger-paper-dim/30 hover:text-ledger-paper disabled:opacity-10 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => onDeleteTodo(todo.id)}
                      className="p-1.5 rounded-lg text-ledger-paper-dim/20 hover:text-ledger-coral transition-colors ml-1"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Section (collapsible so they don't vanish immediately but keep screen clean) */}
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
