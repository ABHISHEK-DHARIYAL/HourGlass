/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Habit, HabitHistory } from '../types';
import { formatDate, parseLocalDate } from '../utils/dateUtils';
import { Sparkles, Trash2, Check, Flame, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HabitTrackerSectionProps {
  userId: string;
  dateStr: string;
  habits: Habit[];
  habitHistory: HabitHistory[];
  onAddHabit: (title: string, color: string) => Promise<void>;
  onToggleHabit: (habitId: string, date: string, done: boolean) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
}

// Custom pastel colors matching our ledger aesthetic
const PRESET_COLORS = [
  '#e56b55', // Coral
  '#e5c07b', // Gold / Yellow
  '#98c379', // Sage Green
  '#61afef', // Ice Blue
  '#c678dd', // Orchid Purple
];

// Helper to get Mon-Sun of the current week
export function getWeekDates(dateStr: string): string[] {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  // Adjust so Monday is first day of the week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    dates.push(formatDate(nextDay));
  }
  return dates;
}

export function calculateHabitStreak(habitId: string, history: HabitHistory[], referenceDateStr: string): number {
  let streak = 0;
  let checkDate = parseLocalDate(referenceDateStr);
  
  const isDoneOn = (dStr: string) => {
    return history.some(h => h.habitId === habitId && h.date === dStr && h.done);
  };

  const todayStr = referenceDateStr;
  const yesterday = new Date(checkDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // If not done today and not done yesterday, streak is 0
  if (!isDoneOn(todayStr) && !isDoneOn(yesterdayStr)) {
    return 0;
  }

  // Start counting backwards from whichever is done
  let currentCheck = isDoneOn(todayStr) ? checkDate : yesterday;
  while (true) {
    const currentStr = formatDate(currentCheck);
    if (isDoneOn(currentStr)) {
      streak++;
      currentCheck.setDate(currentCheck.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function HabitTrackerSection({
  userId,
  dateStr,
  habits,
  habitHistory,
  onAddHabit,
  onToggleHabit,
  onDeleteHabit,
}: HabitTrackerSectionProps) {
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isAdding, setIsAdding] = useState(false);

  const weekDates = getWeekDates(dateStr);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    await onAddHabit(newHabitTitle.trim(), selectedColor);
    setNewHabitTitle('');
    setIsAdding(false);
  };

  return (
    <div className="bg-ledger-slate/40 border border-ledger-line rounded-2xl p-4 flex flex-col gap-4 shadow-lg animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-ledger-gold/10 text-ledger-gold">
            <Sparkles className="w-4 h-4 fill-ledger-gold" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-ledger-paper">Daily Rituals</h3>
            <p className="font-mono text-[9px] text-ledger-paper-dim/60 tracking-wider uppercase mt-0.5">
              Habit Tracking & Streaks
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-ledger-slate-light hover:bg-ledger-slate-light/80 text-ledger-paper-dim hover:text-ledger-paper border border-ledger-line/50 transition-all text-[11px] font-sans cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>New Habit</span>
        </button>
      </div>

      {/* Add Habit Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate}
            className="flex flex-col gap-3 overflow-hidden border-b border-ledger-line/30 pb-3"
          >
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase">Habit Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Drink 3L Water, Evening Walk..."
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                className="w-full bg-ledger-dark/50 border border-ledger-line rounded-xl text-xs px-3 py-2 text-ledger-paper placeholder-ledger-paper-dim/35 focus:outline-none focus:border-ledger-coral font-sans"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                      selectedColor === color ? 'border-ledger-paper' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2.5 py-1 text-[11px] text-ledger-paper-dim hover:text-ledger-paper font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-ledger-coral text-ledger-dark hover:bg-ledger-coral/95 rounded-lg text-[11px] font-sans font-bold cursor-pointer"
                >
                  Create Habit
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Habits List */}
      {habits.length === 0 ? (
        <div className="text-center py-6 px-4 bg-ledger-dark/10 rounded-xl border border-ledger-line/30">
          <span className="text-xl">✨</span>
          <p className="text-[11px] text-ledger-paper-dim/60 font-mono mt-1.5">
            No habits configured yet
          </p>
          <p className="text-[10px] text-ledger-paper-dim/40 font-sans mt-1">
            Build consistency through compounding: add a recurring ritual above!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {habits.map((habit) => {
            const currentStreak = calculateHabitStreak(habit.id, habitHistory, dateStr);

            return (
              <div
                key={habit.id}
                className="p-3 bg-ledger-dark/20 border border-ledger-line/75 hover:border-ledger-line rounded-xl flex flex-col gap-3 group relative overflow-hidden transition-all"
              >
                {/* Custom edge category color */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: habit.color }}
                />

                {/* Habit Header & Streaks */}
                <div className="pl-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-serif font-bold text-xs text-ledger-paper block leading-tight">
                      {habit.title}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <Flame className={`w-3.5 h-3.5 ${currentStreak > 0 ? 'text-ledger-coral fill-ledger-coral' : 'text-ledger-paper-dim/40'}`} />
                      <span className="font-mono text-[10px] text-ledger-coral font-bold">
                        {currentStreak} Day{currentStreak === 1 ? '' : 's'} Streak
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteHabit(habit.id)}
                    className="p-1 rounded text-ledger-paper-dim/40 hover:text-ledger-coral hover:bg-ledger-coral/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Delete habit"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* 7-day tracker row */}
                <div className="grid grid-cols-7 gap-1 bg-ledger-slate/30 border border-ledger-line/30 p-1.5 rounded-lg">
                  {weekDates.map((dStr) => {
                    const parsed = parseLocalDate(dStr);
                    // Single character weekday (M, T, W, T, F, S, S)
                    const weekdayLetter = parsed.toLocaleDateString(undefined, { weekday: 'narrow' });
                    const dayOfMonth = parsed.getDate();
                    
                    const hist = habitHistory.find(h => h.habitId === habit.id && h.date === dStr);
                    const isCompleted = hist?.done || false;
                    const isCurrentDate = dStr === dateStr;

                    return (
                      <button
                        key={dStr}
                        onClick={() => onToggleHabit(habit.id, dStr, !isCompleted)}
                        className={`flex flex-col items-center justify-center p-1 rounded-md transition-all cursor-pointer relative ${
                          isCompleted
                            ? 'bg-ledger-coral/15 border border-ledger-coral text-ledger-coral'
                            : isCurrentDate
                            ? 'bg-ledger-slate-light/60 border border-ledger-gold text-ledger-paper'
                            : 'border border-ledger-line/40 hover:border-ledger-line/80 text-ledger-paper-dim/60'
                        }`}
                        title={`${isCompleted ? 'Mark Incomplete' : 'Mark Completed'} for ${dStr}`}
                      >
                        <span className="font-mono text-[8px] uppercase tracking-wider font-semibold opacity-60">
                          {weekdayLetter}
                        </span>
                        <span className="font-serif text-[11px] font-bold mt-0.5">
                          {dayOfMonth}
                        </span>

                        {isCompleted && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ledger-coral rounded-full flex items-center justify-center border border-ledger-dark shadow-sm">
                            <Check className="w-1.5 h-1.5 text-ledger-dark stroke-[4]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
