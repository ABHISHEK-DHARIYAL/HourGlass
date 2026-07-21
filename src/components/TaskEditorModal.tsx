/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Recurrence, TaskException, ExceptionType, TaskCategory } from '../types';
import { formatHourLabel, getTaskSegmentsForDate } from '../utils/dateUtils';
import { Trash2, X, Bell, BellOff, Calendar, AlertCircle, Sparkles, Star, Tag } from 'lucide-react';

interface TaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  onSaveException?: (exceptionData: TaskException) => void;
  onDelete?: (taskId: string, deleteOption: 'one' | 'all') => void;
  selectedDateStr: string;
  taskToEdit?: Task | null;
  defaultStartHour?: number;
  tasks: Task[];
  exceptions: TaskException[];
  categories: TaskCategory[];
}

const PALETTE_COLORS = [
  { name: 'Coral', value: '#e56b55' },
  { name: 'Muted Gold', value: '#d4af37' },
  { name: 'Teal Sage', value: '#3f7c62' },
  { name: 'Indigo Clay', value: '#6678a3' },
  { name: 'Plum Ink', value: '#8a5a82' },
  { name: 'Charcoal Line', value: '#506e5d' },
];

export default function TaskEditorModal({
  isOpen,
  onClose,
  onSave,
  onSaveException,
  onDelete,
  selectedDateStr,
  taskToEdit,
  defaultStartHour = 9,
  tasks,
  exceptions,
  categories = []
}: TaskEditorModalProps) {
  const [naturalInput, setNaturalInput] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [anchorDate, setAnchorDate] = useState(selectedDateStr);
  const [recurrence, setRecurrence] = useState<Recurrence>(Recurrence.NONE);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [priority, setPriority] = useState(false);
  const [color, setColor] = useState(PALETTE_COLORS[0].value);
  const [categoryId, setCategoryId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    if (catId) {
      const selectedCat = categories.find(c => c.id === catId);
      if (selectedCat) {
        setColor(selectedCat.color);
      }
    }
  };
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveChoices, setShowSaveChoices] = useState(false);

  // Sync state with edit mode or default values when opening
  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      setShowSaveChoices(false);
      setNaturalInput('');
      setIsSaving(false);
      
      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setNotes(taskToEdit.notes || '');
        setStartHour(taskToEdit.startHour);
        setEndHour(taskToEdit.endHour);
        setAnchorDate(taskToEdit.anchorDate);
        setRecurrence(taskToEdit.recurrence);
        setNotifyEnabled(taskToEdit.notifyEnabled);
        setPriority(taskToEdit.priority || false);
        setColor(taskToEdit.color || PALETTE_COLORS[0].value);
        setCategoryId(taskToEdit.categoryId || '');
      } else {
        setTitle('');
        setNotes('');
        const start = defaultStartHour;
        const end = (defaultStartHour + 1) % 24;
        setStartHour(start);
        setEndHour(end === 0 ? 24 : end);
        setAnchorDate(selectedDateStr);
        setRecurrence(Recurrence.NONE);
        setNotifyEnabled(true);
        setPriority(false);
        setColor(PALETTE_COLORS[0].value);
        setCategoryId('');
      }
      setValidationError(null);
    }
  }, [isOpen, taskToEdit, selectedDateStr, defaultStartHour]);

  if (!isOpen) return null;

  // Natural language parsing logic
  const handleParseNatural = () => {
    if (!naturalInput.trim()) return;

    let parsedTitle = naturalInput.trim();
    let parsedStart = startHour;
    let parsedEnd = endHour;
    let parsedRecur = recurrence;

    // 1. Recurrence check
    if (/\bdaily\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.DAILY;
      parsedTitle = parsedTitle.replace(/\bdaily\b/i, '');
    } else if (/\bweekly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.WEEKLY;
      parsedTitle = parsedTitle.replace(/\bweekly\b/i, '');
    } else if (/\bmonthly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.MONTHLY;
      parsedTitle = parsedTitle.replace(/\bmonthly\b/i, '');
    } else if (/\byearly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.YEARLY;
      parsedTitle = parsedTitle.replace(/\byearly\b/i, '');
    }

    // 2. Match ranges e.g. 7am-8am, 2pm to 3pm, 14:00-15:00
    const rangeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const rangeMatch = parsedTitle.match(rangeRegex);

    if (rangeMatch) {
      parsedTitle = parsedTitle.replace(rangeRegex, '');
      
      let h1 = parseInt(rangeMatch[1], 10);
      const p1 = rangeMatch[3]?.toLowerCase();

      let h2 = parseInt(rangeMatch[4], 10);
      const p2 = rangeMatch[6]?.toLowerCase();

      if (p1 === 'pm' && h1 < 12) h1 += 12;
      if (p1 === 'am' && h1 === 12) h1 = 0;

      if (p2 === 'pm' && h2 < 12) h2 += 12;
      if (p2 === 'am' && h2 === 12) h2 = 0;

      if (!p1 && p2) {
        if (p2 === 'pm' && h1 < h2) {
          if (h1 < 12) h1 += 12;
        }
      }

      parsedStart = h1 % 24;
      parsedEnd = h2 % 24 || 24;
    } else {
      // Single hour match e.g. at 3pm, at 14:00
      const singleRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
      const singleMatch = parsedTitle.match(singleRegex);
      if (singleMatch) {
        parsedTitle = parsedTitle.replace(singleMatch[0], '');
        let h1 = parseInt(singleMatch[1], 10);
        const p1 = singleMatch[3]?.toLowerCase();

        if (p1 === 'pm' && h1 < 12) h1 += 12;
        if (p1 === 'am' && h1 === 12) h1 = 0;

        parsedStart = h1 % 24;
        parsedEnd = (h1 + 1) % 24 || 24;
      }
    }

    parsedTitle = parsedTitle.replace(/\s+/g, ' ').replace(/(?:at|on|for)\s*$/, '').trim();

    if (parsedTitle) {
      setTitle(parsedTitle);
      setStartHour(parsedStart);
      setEndHour(parsedEnd);
      setRecurrence(parsedRecur);
    }
  };

  // Soft overlap & back-to-back checks
  const getConflictWarning = () => {
    // Get segments today excluding this task itself
    const otherSegs = getTaskSegmentsForDate(tasks, selectedDateStr, exceptions)
      .filter(seg => !taskToEdit || seg.task.id !== taskToEdit.id);

    let overlapName = '';
    let backToBack = false;

    for (const seg of otherSegs) {
      // Overlap check
      if (startHour < seg.endHour && endHour > seg.startHour) {
        overlapName = seg.task.title;
        break;
      }
      // Back-to-back check
      if (startHour === seg.endHour || endHour === seg.startHour) {
        backToBack = true;
      }
    }

    if (overlapName) {
      return { type: 'danger', message: `Conflict Warning: Overlaps with existing slot "${overlapName}"!` };
    }
    if (backToBack) {
      return { type: 'warning', message: 'Buffer Warning: Back-to-back blocks. Consider scheduling a 15-minute breather.' };
    }
    return null;
  };

  const conflict = getConflictWarning();

  const handleTriggerSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('Please enter a title for this hour block.');
      return;
    }

    if (startHour === endHour) {
      setValidationError('Start Hour and End Hour cannot be the same.');
      return;
    }

    // If it's a recurring task in Edit Mode, let the user choose "Just Today" or "All Occurrences"
    if (taskToEdit && taskToEdit.recurrence !== Recurrence.NONE) {
      setShowSaveChoices(true);
    } else {
      handleFinalSave('all');
    }
  };

  const handleFinalSave = async (option: 'one' | 'all') => {
    if (isSaving) return;
    setIsSaving(true);
    setValidationError(null);
    try {
      if (option === 'one' && taskToEdit && onSaveException) {
        // Create/update exception
        const exceptionId = `${taskToEdit.id}_${selectedDateStr}`;
        await onSaveException({
          id: exceptionId,
          taskId: taskToEdit.id,
          date: selectedDateStr,
          type: ExceptionType.MODIFIED,
          overrideTitle: title.trim(),
          overrideStartHour: startHour,
          overrideEndHour: endHour,
          overrideNotes: notes.trim(),
          overrideCategoryColor: color,
          overridePriority: priority
        });
        // Clear/Reset Form State on success
        setTitle('');
        setNotes('');
        setNaturalInput('');
        onClose();
      } else {
        // Standard save
        await onSave({
          title: title.trim(),
          notes: notes.trim() || '',
          startHour,
          endHour,
          anchorDate,
          recurrence,
          notifyEnabled,
          priority,
          color,
          categoryId
        });
        // Clear/Reset Form State on success
        setTitle('');
        setNotes('');
        setNaturalInput('');
        onClose();
      }
    } catch (err: any) {
      console.error('Error saving task block:', err);
      setValidationError(err?.message || 'Failed to save task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const endHours = Array.from({ length: 25 }, (_, i) => i).filter(h => h > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs font-sans">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="w-full sm:max-w-[440px] bg-ledger-slate border-t sm:border border-ledger-line rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative z-10 flex flex-col max-h-[90vh] sm:max-h-[620px] overflow-y-auto">
        
        <div className="w-12 h-1 bg-ledger-line rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl font-bold text-ledger-paper">
            {taskToEdit ? 'Edit Hour Block' : 'Book Hour Slot'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-lg bg-ledger-coral/10 border border-ledger-coral/30 text-ledger-coral text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleTriggerSave} className="flex flex-col gap-4">

          {/* Natural Language Input (Only in Create Mode to prevent editing accidents) */}
          {!taskToEdit && (
            <div className="bg-ledger-dark/30 border border-ledger-line/60 rounded-xl p-3 flex flex-col gap-2">
              <span className="font-mono text-[9px] text-ledger-gold uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Natural Language Quick Add</span>
              </span>
              <div className="flex gap-2">
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    placeholder="e.g. Gym 7am-8am daily or Coffee at 3pm"
                    value={naturalInput}
                    onChange={(e) => setNaturalInput(e.target.value)}
                    className="w-full bg-ledger-dark border border-ledger-line rounded-lg text-xs px-2.5 py-1.5 text-ledger-paper placeholder-ledger-paper-dim/30 focus:outline-none focus:border-ledger-coral font-sans"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleParseNatural}
                  className="px-3 bg-ledger-slate-light border border-ledger-line text-xs font-bold rounded-lg text-ledger-coral hover:border-ledger-coral/50 transition-colors cursor-pointer"
                >
                  Parse
                </button>
              </div>
            </div>
          )}
          
          {/* Title & Priority Row */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
                Activity Title
              </label>
              
              <button
                type="button"
                onClick={() => setPriority(!priority)}
                className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  priority 
                    ? 'bg-ledger-coral/15 border-ledger-coral text-ledger-coral font-bold' 
                    : 'bg-ledger-dark border-ledger-line text-ledger-paper-dim/40'
                }`}
              >
                <Star className={`w-3 h-3 ${priority ? 'fill-ledger-coral' : ''}`} />
                <span>{priority ? 'High Priority' : 'Normal'}</span>
              </button>
            </div>
            
            <div className="relative flex items-center">
              <input
                type="text"
                required
                placeholder="e.g. Sleep, Deep Work, Workout"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper placeholder-ledger-paper-dim/30 focus:outline-none focus:border-ledger-coral transition-colors font-sans"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
              Notes / Sub-items (Optional)
            </label>
            <textarea
              placeholder="Add more details or a log..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="p-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper placeholder-ledger-paper-dim/30 focus:outline-none focus:border-ledger-coral transition-colors resize-none text-xs"
            />
          </div>

          {/* Double time-slot pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
                Start Hour
              </label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value, 10))}
                className="h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper focus:outline-none focus:border-ledger-coral transition-colors cursor-pointer text-xs"
              >
                {hours.map((h) => (
                  <option key={`sh-${h}`} value={h}>
                    {formatHourLabel(h)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
                End Hour
              </label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value, 10))}
                className="h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper focus:outline-none focus:border-ledger-coral transition-colors cursor-pointer text-xs"
              >
                {endHours.map((h) => (
                  <option key={`eh-${h}`} value={h}>
                    {formatHourLabel(h === 24 ? 0 : h)} {h === 24 ? '(Midnight)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Wrap past midnight hint */}
          {endHour <= startHour && (
            <div className="p-2 bg-ledger-gold/5 border border-ledger-gold/20 rounded-lg text-ledger-gold text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Note: This task wraps past midnight and will span into the next day.</span>
            </div>
          )}

          {/* Active Overlap or Buffer Warning Display */}
          {conflict && (
            <div className={`p-2.5 rounded-lg border text-[10px] flex items-start gap-2 ${
              conflict.type === 'danger' 
                ? 'bg-ledger-coral/10 border-ledger-coral/30 text-ledger-coral' 
                : 'bg-ledger-gold/5 border-ledger-gold/20 text-ledger-gold'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{conflict.message}</span>
            </div>
          )}

          {/* Anchor Date & Recurrence Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Anchor Date</span>
              </label>
              <input
                type="date"
                required
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper focus:outline-none focus:border-ledger-coral transition-colors cursor-pointer text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
                Repeats Schedule
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                className="h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper focus:outline-none focus:border-ledger-coral transition-colors cursor-pointer text-xs"
              >
                <option value={Recurrence.NONE}>Just this once</option>
                <option value={Recurrence.DAILY}>Every single day</option>
                <option value={Recurrence.WEEKLY}>Every week</option>
                <option value={Recurrence.MONTHLY}>Every month</option>
                <option value={Recurrence.YEARLY}>Every year</option>
              </select>
            </div>
          </div>

          {/* Notification toggles */}
          <div className="flex items-center justify-between py-2 border-b border-ledger-line">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-ledger-paper">Send Notifications</span>
              <span className="text-[10px] text-ledger-paper-dim/60">Pushes a ping when this hour begins</span>
            </div>
            <button
              type="button"
              onClick={() => setNotifyEnabled(!notifyEnabled)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                notifyEnabled 
                  ? 'bg-ledger-coral/15 border-ledger-coral text-ledger-coral' 
                  : 'bg-ledger-dark border-ledger-line text-ledger-paper-dim/40'
              }`}
            >
              {notifyEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
          </div>

          {/* Category Dropdown Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-ledger-gold" />
              <span>Label Category</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-11 px-3 bg-ledger-dark border border-ledger-line rounded-xl text-ledger-paper focus:outline-none focus:border-ledger-coral transition-colors cursor-pointer text-xs"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme custom colors */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold">
              Hourglass Category Accent
            </label>
            <div className="flex items-center gap-2">
              {PALETTE_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onClick={() => setColor(col.value)}
                  className="w-8 h-8 rounded-full border-2 transition-all relative cursor-pointer active:scale-90"
                  style={{ 
                    backgroundColor: col.value, 
                    borderColor: color === col.value ? '#f4efe2' : 'transparent',
                    boxShadow: color === col.value ? '0 0 0 1px #e56b55' : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Choice Prompt: Just Today vs All Occurrences when editing recurring task */}
          {showSaveChoices && taskToEdit ? (
            <div className="bg-ledger-slate/60 border border-ledger-line rounded-xl p-4 mt-2 flex flex-col gap-2.5">
              <span className="text-xs font-mono text-ledger-gold uppercase tracking-wider text-center block">
                Save Options for Recurring Block
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleFinalSave('one')}
                  className="flex-1 h-11 bg-ledger-slate-light border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light/90 active:scale-98 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Only for Today'}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleFinalSave('all')}
                  className="flex-1 h-11 bg-ledger-coral/20 border border-ledger-coral/40 text-xs font-semibold rounded-lg text-ledger-coral hover:bg-ledger-coral/30 active:scale-98 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save for All Occurrences'}
                </button>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowSaveChoices(false)}
                className="text-center text-[10px] font-sans text-ledger-paper-dim/80 underline cursor-pointer hover:text-ledger-paper mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Go Back
              </button>
            </div>
          ) : showDeleteConfirm && taskToEdit && onDelete ? (
            <div className="bg-ledger-slate/60 border border-ledger-line rounded-xl p-3.5 mt-2 flex flex-col gap-2.5">
              <span className="text-xs font-mono text-ledger-paper-dim uppercase tracking-wider text-center block">
                This is a recurring block.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(taskToEdit.id, 'one');
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 h-11 bg-ledger-slate-light border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light/90 active:scale-98 transition-colors cursor-pointer"
                >
                  Delete Only Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(taskToEdit.id, 'all');
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 h-11 bg-ledger-coral/20 border border-ledger-coral/40 text-xs font-semibold rounded-lg text-ledger-coral hover:bg-ledger-coral/30 active:scale-98 transition-colors cursor-pointer"
                >
                  Delete All Series
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-center text-[11px] font-sans text-ledger-paper-dim/80 underline cursor-pointer hover:text-ledger-paper mt-1"
              >
                Keep it
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              {taskToEdit && onDelete && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    if (recurrence !== Recurrence.NONE) {
                      setShowDeleteConfirm(true);
                    } else {
                      onDelete(taskToEdit.id, 'all');
                    }
                  }}
                  className="w-12 h-12 shrink-0 flex items-center justify-center bg-ledger-slate border border-ledger-line hover:bg-ledger-coral/10 hover:text-ledger-coral transition-colors text-ledger-paper-dim rounded-xl cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="flex-1 h-12 bg-ledger-slate-light hover:bg-ledger-slate-light/90 border border-ledger-line rounded-xl text-ledger-paper font-sans font-semibold text-sm cursor-pointer transition-colors active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 h-12 bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark rounded-xl font-sans font-bold text-sm cursor-pointer transition-colors active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Block'}
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
