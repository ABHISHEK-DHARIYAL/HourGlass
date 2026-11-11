// Purpose: Task categories management section within settings

import React, { useState } from 'react';
import { TaskCategory } from '../types';
import { Plus, Trash2, Edit2, Save, Tag, X } from 'lucide-react';

interface TaskCategoriesManagerProps {
  categories: TaskCategory[];
  onAddCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  setSuccessMessage: (msg: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
}

const CATEGORY_PRESET_COLORS = [
  '#e56b55', // Coral
  '#d4af37', // Muted Gold
  '#3f7c62', // Teal Sage
  '#6678a3', // Indigo Clay
  '#8a5a82', // Plum Ink
  '#506e5d', // Charcoal Sage
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

export default function TaskCategoriesManager({
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  setSuccessMessage,
  setErrorMessage
}: TaskCategoriesManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#e56b55');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState('');

  const handleAddNewCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await onAddCategory(newCatName.trim(), newCatColor);
      setNewCatName('');
      setSuccessMessage('Category created successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to create category.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleStartEditCategory = (cat: TaskCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatColor(cat.color);
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    try {
      await onUpdateCategory(id, editingCatName.trim(), editingCatColor);
      setEditingCatId(null);
      setSuccessMessage('Category updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to update category.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteCategoryClick = async (id: string) => {
    if (confirm('Are you sure you want to delete this category? Tasks using this category will remain, but will lose their category label.')) {
      try {
        await onDeleteCategory(id);
        setSuccessMessage('Category deleted.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setErrorMessage('Failed to delete category.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    }
  };

  return (
    <div className="surface-card p-5 flex flex-col gap-5">
      <h4 className="text-[11px] text-ledger-paper-dim uppercase tracking-widest font-bold border-b border-ledger-line pb-2.5 flex items-center gap-1.5">
        <Tag className="w-4 h-4 text-ledger-gold" />
        <span>Task Categories</span>
      </h4>

      <p className="text-xs text-ledger-paper-dim leading-relaxed">
        Define custom labels and colors for your hour blocks to organize them beautifully.
      </p>

      <form onSubmit={handleAddNewCategorySubmit} className="surface-panel p-3.5 flex flex-col gap-3">
        <span className="text-[10px] text-ledger-gold uppercase tracking-widest font-semibold">
          Create Custom Category
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="e.g. Work, Gym, Sleep..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="input-base flex-1 text-xs !py-1.5"
            />
            <button
              type="submit"
              className="btn-primary !px-3 !py-1.5 text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            {CATEGORY_PRESET_COLORS.map((col) => (
              <button
                key={`preset-add-${col}`}
                type="button"
                onClick={() => setNewCatColor(col)}
                className="w-5.5 h-5.5 rounded-full border transition-all relative cursor-pointer active:scale-90"
                style={{ 
                  backgroundColor: col, 
                  borderColor: newCatColor === col ? '#f4efe2' : 'transparent',
                  boxShadow: newCatColor === col ? '0 0 0 1px #e56b55' : 'none'
                }}
                title={col}
              />
            ))}
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-ledger-paper-dim uppercase tracking-widest font-semibold">
          Your Categories ({categories.length})
        </span>

        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
          {categories.map((cat) => {
            const isEditing = editingCatId === cat.id;
            return (
              <div 
                key={cat.id} 
                className="flex flex-col gap-2 surface-panel rounded-xl p-3 transition-all"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="input-base flex-1 text-xs !py-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditCategory(cat.id)}
                        className="p-1.5 rounded-lg text-ledger-gold hover:bg-ledger-slate-light transition-colors"
                        title="Save Changes"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="p-1.5 rounded-lg text-ledger-paper-dim hover:text-ledger-paper hover:bg-ledger-slate-light transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {CATEGORY_PRESET_COLORS.map((col) => (
                        <button
                          key={`preset-edit-${cat.id}-${col}`}
                          type="button"
                          onClick={() => setEditingCatColor(col)}
                          className="w-4.5 h-4.5 rounded-full border transition-all relative cursor-pointer"
                          style={{ 
                            backgroundColor: col, 
                            borderColor: editingCatColor === col ? '#f4efe2' : 'transparent',
                            boxShadow: editingCatColor === col ? '0 0 0 1px #e56b55' : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span 
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" 
                        style={{ backgroundColor: cat.color }} 
                      />
                      <span className="text-xs font-semibold text-ledger-paper truncate">
                        {cat.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditCategory(cat)}
                        className="p-1.5 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper transition-all cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryClick(cat.id)}
                        className="p-1.5 rounded-lg hover:bg-ledger-danger/15 text-ledger-paper-dim hover:text-ledger-danger transition-all cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {categories.length === 0 && (
            <div className="text-center py-4 text-ledger-paper-dim text-xs">
              No custom categories defined.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
