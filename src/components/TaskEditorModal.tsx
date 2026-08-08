// Purpose: Modal dialog for creating and editing scheduled task time blocks, exceptions, and recurrence

import React, { useState, useEffect } from 'react';
import { Task, Recurrence, TaskException, ExceptionType, TaskCategory } from '../types';
import { formatHourLabel, getTaskSegmentsForDate } from '../utils/dateUtils';
import { Trash2, X, Bell, BellOff, Calendar, AlertCircle, Star, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { TaskSaveChoicesDialog, TaskDeleteChoicesDialog } from './TaskSaveChoicesDialog';
import NaturalLanguageQuickAdd from './NaturalLanguageQuickAdd';

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

  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      setShowSaveChoices(false);
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

  const getConflictWarning = () => {
    const otherSegs = getTaskSegmentsForDate(tasks, selectedDateStr, exceptions)
      .filter(seg => !taskToEdit || seg.task.id !== taskToEdit.id);

    let overlapName = '';
    let backToBack = false;

    for (const seg of otherSegs) {
      if (startHour < seg.endHour && endHour > seg.startHour) {
        overlapName = seg.task.title;
        break;
      }
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
        setTitle('');
        setNotes('');
        onClose();
      } else {
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
        setTitle('');
        setNotes('');
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
    <div className="dialog-overlay">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="dialog-panel w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 relative z-10 flex flex-col max-h-[90vh] sm:max-h-[620px] overflow-y-auto"
      >
        
        <div className="w-12 h-1 bg-ledger-line rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ledger-paper">
            {taskToEdit ? 'Edit Hour Block' : 'Book Hour Slot'}
          </h3>
          <button
            onClick={onClose}
            className="btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="mb-4 p-3 rounded-xl bg-ledger-danger/10 border border-ledger-danger/30 text-ledger-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleTriggerSave} className="flex flex-col gap-4">

          {!taskToEdit && (
            <NaturalLanguageQuickAdd
              startHour={startHour}
              endHour={endHour}
              recurrence={recurrence}
              onParsed={({ title: pTitle, startHour: pStart, endHour: pEnd, recurrence: pRecur }) => {
                setTitle(pTitle);
                setStartHour(pStart);
                setEndHour(pEnd);
                setRecurrence(pRecur);
              }}
            />
          )}
          
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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
              <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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

          {endHour <= startHour && (
            <div className="p-2 bg-ledger-gold/5 border border-ledger-gold/20 rounded-lg text-ledger-gold text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Note: This task wraps past midnight and will span into the next day.</span>
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest flex items-center gap-1">
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
              <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest flex items-center gap-1.5">
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

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[11px] text-ledger-paper-dim uppercase tracking-widest">
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

          {showSaveChoices && taskToEdit ? (
            <TaskSaveChoicesDialog
              isSaving={isSaving}
              onSaveChoice={(opt) => handleFinalSave(opt)}
              onCancel={() => setShowSaveChoices(false)}
            />
          ) : showDeleteConfirm && taskToEdit && onDelete ? (
            <TaskDeleteChoicesDialog
              onDeleteChoice={(opt) => {
                onDelete(taskToEdit.id, opt);
                setShowDeleteConfirm(false);
              }}
              onCancel={() => setShowDeleteConfirm(false)}
            />
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
                  className="w-12 h-12 shrink-0 flex items-center justify-center bg-ledger-slate-light border border-ledger-line hover:border-ledger-danger hover:bg-ledger-danger/10 hover:text-ledger-danger transition-all text-ledger-paper-dim rounded-xl cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="btn-secondary flex-1 h-12 !rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary flex-1 h-12 !rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Block'}
              </button>
            </div>
          )}

        </form>
      </motion.div>
    </div>
  );
}
