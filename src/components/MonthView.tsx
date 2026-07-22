/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, TaskException } from '../types';
import { getTaskSegmentsForDate, parseLocalDate, formatDate } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface MonthViewProps {
  currentDateStr: string;
  tasks: Task[];
  exceptions?: TaskException[];
  onSelectDate: (dateStr: string) => void;
}

export default function MonthView({ currentDateStr, tasks, exceptions = [], onSelectDate }: MonthViewProps) {
  // Use a local Date object representing the month view focus
  const focusedDate = parseLocalDate(currentDateStr);
  const [viewDate, setViewDate] = React.useState<Date>(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));

  // Sync with prop when selected date changes drastically
  React.useEffect(() => {
    const d = parseLocalDate(currentDateStr);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [currentDateStr]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate days in month and starting day of the week
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday = 0
  // Shift Sunday to index 6 to start week on Monday
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Create list of days to display
  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const date = new Date(prevMonthYear, prevMonth, dayNum);
    days.push({
      dateStr: formatDate(date),
      dayNum,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    days.push({
      dateStr: formatDate(date),
      dayNum: d,
      isCurrentMonth: true
    });
  }

  // Next month padding to fill grid (usually 42 cells total for a standard 6-row layout)
  const remainingCells = 42 - days.length;
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  for (let d = 1; d <= remainingCells; d++) {
    const date = new Date(nextMonthYear, nextMonth, d);
    days.push({
      dateStr: formatDate(date),
      dayNum: d,
      isCurrentMonth: false
    });
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    onSelectDate(formatDate(today));
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Check if a date has at least one active task
  const hasActiveTasks = (dateStr: string) => {
    return getTaskSegmentsForDate(tasks, dateStr, exceptions).length > 0;
  };

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = formatDate(new Date());

  return (
    <div className="w-full bg-ledger-slate rounded-2xl border border-ledger-line p-5 shadow-xl flex flex-col font-sans">
      {/* Month Selection Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl font-bold text-ledger-paper tracking-tight flex items-center gap-2">
          {monthNames[month]} <span className="font-mono text-base font-light text-ledger-paper-dim">{year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            id="prev-month-button"
            className="p-1.5 rounded-lg hover:bg-ledger-slate-light border border-transparent hover:border-ledger-line text-ledger-paper transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleJumpToToday}
            id="jump-to-today-button"
            className="px-3 py-1.5 rounded-lg hover:bg-ledger-slate-light border border-ledger-line text-xs font-mono font-medium tracking-wide text-ledger-coral transition-all cursor-pointer"
          >
            Today
          </button>

          <button
            onClick={handleNextMonth}
            id="next-month-button"
            className="p-1.5 rounded-lg hover:bg-ledger-slate-light border border-transparent hover:border-ledger-line text-ledger-paper transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center mb-2">
        {weekdays.map((day) => (
          <span
            key={day}
            className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-widest font-bold py-1"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
          const isSelected = dateStr === currentDateStr;
          const isToday = dateStr === todayStr;
          const hasTasks = hasActiveTasks(dateStr);

          return (
            <button
              key={`${dateStr}-${idx}`}
              onClick={() => onSelectDate(dateStr)}
              id={`calendar-day-${dateStr}`}
              className={`
                aspect-square relative rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer group
                ${isSelected ? 'bg-ledger-coral/15 border border-ledger-coral text-ledger-coral' : 'border border-transparent'}
                ${!isSelected && isCurrentMonth ? 'text-ledger-paper hover:bg-ledger-slate-light' : ''}
                ${!isCurrentMonth ? 'text-ledger-paper-dim/30 hover:bg-ledger-slate-light/40' : ''}
              `}
            >
              <span
                className={`
                  text-sm font-mono font-medium
                  ${isToday && !isSelected ? 'text-ledger-coral border-b border-dashed border-ledger-coral' : ''}
                `}
              >
                {dayNum}
              </span>
              
              {/* Task indicator dot */}
              {hasTasks && (
                <span
                  className={`
                    absolute bottom-1 w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-125
                    ${isSelected ? 'bg-ledger-coral' : 'bg-ledger-gold'}
                  `}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
