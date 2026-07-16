import React, { useState } from 'react';
import { MustDoItem } from '../types';
import { CheckSquare, Square, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface MustDoSectionProps {
  userId: string;
  dateStr: string;
  items: MustDoItem[];
  onAddItem: (title: string) => Promise<void>;
  onToggleItem: (item: MustDoItem) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onClearCompleted?: () => Promise<void>;
}

export default function MustDoSection({ 
  userId, 
  dateStr, 
  items, 
  onAddItem, 
  onToggleItem, 
  onDeleteItem,
  onClearCompleted
}: MustDoSectionProps) {
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (items.length >= 5) {
      setError('Limit of 5 non-negotiables per day reached.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await onAddItem(newTitle.trim());
      setNewTitle('');
    } catch (err) {
      console.error('Failed to add must-do item:', err);
    }
  };

  const handleToggleItem = async (item: MustDoItem) => {
    try {
      await onToggleItem(item);
    } catch (err) {
      console.error('Failed to toggle must-do item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await onDeleteItem(itemId);
    } catch (err) {
      console.error('Failed to delete must-do item:', err);
    }
  };

  return (
    <div className="w-full bg-ledger-slate/60 rounded-2xl border border-ledger-line p-4 shadow-md font-sans">
      <div className="flex items-center justify-between mb-3 border-b border-ledger-line/50 pb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-2">
            <span className="text-ledger-coral font-mono text-xs">◆</span>
            <span>Today's Must-Dos</span>
            <span className="font-mono text-[9px] text-ledger-paper-dim/60 ml-1">({items.filter(i => i.done).length}/{items.length})</span>
          </h4>
          {onClearCompleted && items.some(i => i.done) && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="ml-1 px-2 py-0.5 text-[8px] font-mono font-bold bg-ledger-coral/10 hover:bg-ledger-coral/25 border border-ledger-coral/30 hover:border-ledger-coral text-ledger-coral rounded uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
            >
              Clear Completed
            </button>
          )}
        </div>
        <span className="font-mono text-[9px] text-ledger-paper-dim/40 uppercase tracking-wider">Non-Negotiable</span>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-ledger-coral/10 border border-ledger-coral/30 rounded-lg text-[11px] text-ledger-coral flex items-center gap-1.5 font-mono">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List of items */}
      {items.length === 0 ? (
        <p className="text-xs text-ledger-paper-dim/50 italic py-2 text-center font-sans">
          No non-negotiables declared for today yet.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-ledger-slate-light/40 transition-all border border-transparent hover:border-ledger-line/30"
            >
              <button
                onClick={() => handleToggleItem(item)}
                className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
              >
                {item.done ? (
                  <CheckSquare className="w-4 h-4 text-ledger-coral shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-ledger-paper-dim/60 hover:text-ledger-paper shrink-0" />
                )}
                <span className={`text-xs ${item.done ? 'line-through text-ledger-paper-dim/40' : 'text-ledger-paper'} font-sans leading-relaxed break-all`}>
                  {item.title}
                </span>
              </button>

              <button
                onClick={() => handleDeleteItem(item.id)}
                className="text-ledger-paper-dim/30 hover:text-ledger-coral p-1 rounded transition-colors"
                title="Remove Item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Item form */}
      {items.length < 5 && (
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            type="text"
            placeholder="Add a daily non-negotiable..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 bg-ledger-dark/50 border border-ledger-line text-xs font-sans text-ledger-paper placeholder-ledger-paper-dim/30 rounded-xl px-3 py-1.5 focus:outline-none focus:border-ledger-coral"
            maxLength={100}
          />
          <button
            type="submit"
            className="bg-ledger-slate-light border border-ledger-line hover:border-ledger-coral text-ledger-paper hover:text-ledger-coral p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
