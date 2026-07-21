/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DayReflection } from '../types';
import { BookOpen, Maximize2, Minimize2, Check, Loader2, Save, X } from 'lucide-react';

interface DailyReflectionSectionProps {
  selectedDateStr: string;
  reflections: DayReflection[];
  onSaveReflection: (date: string, note: string) => Promise<void>;
}

export default function DailyReflectionSection({
  selectedDateStr,
  reflections,
  onSaveReflection
}: DailyReflectionSectionProps) {
  // Find current day's reflection
  const existingReflection = reflections.find(r => r.date === selectedDateStr);
  const existingNote = existingReflection?.note || '';

  const [note, setNote] = useState(existingNote);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize local note state when active date or database value changes
  useEffect(() => {
    setNote(existingNote);
    setSavingStatus('idle');
  }, [selectedDateStr, existingNote]);

  // Sync modal note when modal opens or date changes
  useEffect(() => {
    if (isModalOpen) {
      setModalNote(note);
    }
  }, [isModalOpen, selectedDateStr]);

  // Auto-save debouncing
  const handleNoteChange = (text: string) => {
    setNote(text);
    setSavingStatus('saving');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        await onSaveReflection(selectedDateStr, text);
        setSavingStatus('saved');
        // Clear saved indicator after 2 seconds
        setTimeout(() => setSavingStatus('idle'), 2000);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSavingStatus('error');
      }
    }, 1200); // 1.2s debounce
  };

  const handleBlur = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Only save if there was a discrepancy to avoid redundant writes
    if (note !== existingNote) {
      setSavingStatus('saving');
      try {
        await onSaveReflection(selectedDateStr, note);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
      } catch (err) {
        console.error('Blur save error:', err);
        setSavingStatus('error');
      }
    }
  };

  // Modal save handler
  const handleSaveModal = async () => {
    setSavingStatus('saving');
    try {
      await onSaveReflection(selectedDateStr, modalNote);
      setNote(modalNote);
      setSavingStatus('saved');
      setIsModalOpen(false);
      setTimeout(() => setSavingStatus('idle'), 2000);
    } catch (err) {
      console.error('Modal save error:', err);
      setSavingStatus('error');
    }
  };

  return (
    <div className="w-full flex flex-col bg-ledger-slate p-4 rounded-2xl border border-ledger-line shadow-xl font-sans mt-2">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-ledger-coral" />
          <h4 className="font-serif text-sm font-bold text-ledger-paper">
            Daily Reflection
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          {savingStatus === 'saving' && (
            <span className="flex items-center gap-1 font-mono text-[9px] text-ledger-gold">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {savingStatus === 'saved' && (
            <span className="flex items-center gap-0.5 font-mono text-[9px] text-teal-400">
              <Check className="w-3 h-3" />
              <span>Saved</span>
            </span>
          )}
          {savingStatus === 'error' && (
            <span className="font-mono text-[9px] text-ledger-coral">
              Error saving
            </span>
          )}

          {/* Expand Modal Trigger Icon */}
          <button
            onClick={() => {
              setModalNote(note);
              setIsModalOpen(true);
            }}
            id="expand-reflection-modal"
            className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper cursor-pointer transition-all"
            title="Open reflection modal"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Textarea Input */}
      <textarea
        value={note}
        onChange={(e) => handleNoteChange(e.target.value)}
        onBlur={handleBlur}
        id="reflection-textarea"
        placeholder="Write down any thoughts, goals, or freeform notes about today..."
        className="w-full h-24 p-3 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral/50 transition-all resize-none placeholder:text-ledger-paper-dim/40 leading-relaxed font-sans"
      />

      <span className="font-mono text-[8px] text-ledger-paper-dim/30 text-right mt-1.5 select-none">
        Saves automatically as you type
      </span>

      {/* Reflection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ledger-dark/80 backdrop-blur-sm">
          <div className="bg-ledger-slate border border-ledger-line rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-ledger-line p-4 bg-ledger-dark/30">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-ledger-gold" />
                <h3 className="font-serif text-base font-bold text-ledger-paper">
                  Today's Reflection
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-ledger-slate-light text-ledger-paper-dim hover:text-ledger-paper cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-ledger-paper-dim/60">
                  Date: {selectedDateStr}
                </span>
              </div>
              <textarea
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                id="modal-reflection-textarea"
                placeholder="How did today feel? What did you discover? Write without boundaries..."
                className="w-full h-64 p-4 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral/50 transition-all resize-none placeholder:text-ledger-paper-dim/40 leading-relaxed font-sans"
                autoFocus
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-ledger-line bg-ledger-dark/10 flex items-center justify-between">
              <span className="font-mono text-[9px] text-ledger-paper-dim/30">
                {modalNote.length} characters
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-ledger-slate-light hover:bg-ledger-slate-light/80 text-ledger-paper border border-ledger-line text-xs font-medium rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModal}
                  id="modal-save-reflection"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark font-sans font-bold text-xs rounded-lg cursor-pointer transition-all shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
