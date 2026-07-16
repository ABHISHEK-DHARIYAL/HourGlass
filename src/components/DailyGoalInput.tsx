/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DailyGoal } from '../types';
import { Target, Check, Loader2 } from 'lucide-react';

interface DailyGoalInputProps {
  selectedDateStr: string;
  dailyGoals: DailyGoal[];
  onSaveDailyGoal: (date: string, goal: string) => Promise<void>;
}

export default function DailyGoalInput({
  selectedDateStr,
  dailyGoals,
  onSaveDailyGoal
}: DailyGoalInputProps) {
  const existingGoalObj = dailyGoals.find(g => g.date === selectedDateStr);
  const existingGoal = existingGoalObj?.goal || '';

  const [goal, setGoal] = useState(existingGoal);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize input when selected date or actual value changes
  useEffect(() => {
    setGoal(existingGoal);
    setSavingStatus('idle');
  }, [selectedDateStr, existingGoal]);

  const handleGoalChange = (text: string) => {
    setGoal(text);
    setSavingStatus('saving');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        await onSaveDailyGoal(selectedDateStr, text);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
      } catch (err) {
        console.error('Auto-save goal error:', err);
        setSavingStatus('error');
      }
    }, 1000); // 1.0s debounce
  };

  const handleBlur = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (goal !== existingGoal) {
      setSavingStatus('saving');
      try {
        await onSaveDailyGoal(selectedDateStr, goal);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus('idle'), 2000);
      } catch (err) {
        console.error('Blur save goal error:', err);
        setSavingStatus('error');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="w-full bg-ledger-slate p-4 rounded-2xl border border-ledger-line shadow-xl font-sans mb-1 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-ledger-coral" />
          <h4 className="font-serif text-sm font-bold text-ledger-paper">
            Primary Daily Goal
          </h4>
        </div>

        {/* Save Status Indicators */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="relative flex items-center">
        <input
          type="text"
          value={goal}
          onChange={(e) => handleGoalChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          id="daily-goal-input-field"
          placeholder="Define your single primary focus for today..."
          className="w-full h-10 pl-3 pr-10 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral/50 transition-all placeholder:text-ledger-paper-dim/40 leading-relaxed font-sans"
        />
        <div className="absolute right-3 text-ledger-paper-dim/40 pointer-events-none select-none">
          <Target className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
