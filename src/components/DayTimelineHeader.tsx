// Purpose: Header navigation, view mode toggle, and sort preference controls for DayTimelineView

import React from 'react';
import { ChevronLeft, ChevronRight, Clock, List, ArrowUpDown, Star } from 'lucide-react';

interface DayTimelineHeaderProps {
  formattedDayHeader: string;
  currentDateStr: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  layoutMode: 'timeline' | 'list';
  onLayoutModeChange: (mode: 'timeline' | 'list') => void;
  sortBy: 'time' | 'priority';
  onSortChange: (sort: 'time' | 'priority') => void;
}

export default function DayTimelineHeader({
  formattedDayHeader,
  currentDateStr,
  onPrevDay,
  onNextDay,
  layoutMode,
  onLayoutModeChange,
  sortBy,
  onSortChange
}: DayTimelineHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-ledger-line p-4 bg-ledger-dark/40">
        <button
          onClick={onPrevDay}
          id="prev-day-button"
          className="btn-icon !w-9 !h-9"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h3 className="text-lg font-bold text-ledger-paper">
            {formattedDayHeader}
          </h3>
          <p className="text-[11px] text-ledger-paper-dim mt-0.5">
            {currentDateStr}
          </p>
        </div>

        <button
          onClick={onNextDay}
          id="next-day-button"
          className="btn-icon !w-9 !h-9"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between border-b border-ledger-line/30 px-4 py-2 bg-ledger-dark/25 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ledger-paper-dim uppercase tracking-widest font-bold">View:</span>
          <div className="flex bg-ledger-dark/40 rounded-lg p-0.5 border border-ledger-line/30">
            <button
              onClick={() => onLayoutModeChange('timeline')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                layoutMode === 'timeline'
                  ? 'bg-ledger-coral text-[#0a0c10] shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => onLayoutModeChange('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                layoutMode === 'list'
                  ? 'bg-ledger-coral text-[#0a0c10] shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ledger-paper-dim uppercase tracking-widest font-bold">Sort:</span>
          <div className="flex bg-ledger-dark/40 rounded-lg p-0.5 border border-ledger-line/30">
            <button
              onClick={() => onSortChange('time')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                sortBy === 'time'
                  ? 'bg-ledger-coral text-[#0a0c10] shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Time</span>
            </button>
            <button
              onClick={() => onSortChange('priority')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                sortBy === 'priority'
                  ? 'bg-ledger-coral text-[#0a0c10] shadow-sm'
                  : 'text-ledger-paper-dim hover:text-ledger-paper'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Priority</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
