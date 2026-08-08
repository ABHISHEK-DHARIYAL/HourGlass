// Purpose: Batch move controls and action bar for DayTimelineView

import React from 'react';
import { CalendarDays, Plus } from 'lucide-react';

interface DayTimelineBatchMoveBarProps {
  isSelectMode: boolean;
  selectedCount: number;
  moveTargetDate: string;
  setMoveTargetDate: (date: string) => void;
  onBatchMove: () => void;
  onCancelSelect: () => void;
  onEnableSelectMode: () => void;
  onAddTask: () => void;
}

export default function DayTimelineBatchMoveBar({
  isSelectMode,
  selectedCount,
  moveTargetDate,
  setMoveTargetDate,
  onBatchMove,
  onCancelSelect,
  onEnableSelectMode,
  onAddTask
}: DayTimelineBatchMoveBarProps) {
  if (isSelectMode) {
    return (
      <div className="p-4 border-t border-ledger-line bg-ledger-dark/35 flex flex-col gap-3 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-ledger-gold">
            {selectedCount} blocks selected
          </span>
          <button
            onClick={onCancelSelect}
            className="text-xs text-ledger-paper-dim hover:text-ledger-paper underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={moveTargetDate}
            onChange={(e) => setMoveTargetDate(e.target.value)}
            className="flex-1 h-9 px-3 bg-ledger-dark border border-ledger-line rounded-lg text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral/50 font-sans"
          />
          <button
            onClick={onBatchMove}
            disabled={selectedCount === 0 || !moveTargetDate}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-lg font-sans font-bold text-xs cursor-pointer transition-all ${
              selectedCount > 0 && moveTargetDate
                ? 'bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark shadow-md'
                : 'bg-ledger-slate-light text-ledger-paper-dim/40 border border-ledger-line pointer-events-none'
            }`}
          >
            Move Blocks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-ledger-line bg-ledger-dark/20 flex items-center justify-between">
      <button
        onClick={onEnableSelectMode}
        className="flex items-center gap-1.5 text-xs text-ledger-paper-dim hover:text-ledger-paper hover:bg-ledger-slate-light/50 px-2.5 py-1.5 rounded-lg border border-ledger-line/50 transition-all cursor-pointer font-sans"
      >
        <CalendarDays className="w-3.5 h-3.5 text-ledger-gold" />
        <span>Batch Move</span>
      </button>
      
      <button
        onClick={onAddTask}
        id="add-task-fab"
        className="flex items-center gap-2 bg-ledger-coral hover:bg-ledger-coral/95 active:scale-95 transition-all text-ledger-dark font-sans font-bold px-4 py-2 rounded-xl shadow-lg cursor-pointer text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>New Hour Block</span>
      </button>
    </div>
  );
}
