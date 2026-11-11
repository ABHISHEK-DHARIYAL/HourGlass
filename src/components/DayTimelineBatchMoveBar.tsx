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
      <div className="p-4 border-t border-ledger-line bg-ledger-slate-light/50 flex flex-col gap-3 animate-fade-up">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ledger-gold">
            {selectedCount} blocks selected
          </span>
          <button
            onClick={onCancelSelect}
            className="btn-ghost !px-2 !py-1 text-xs underline"
          >
            Cancel
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={moveTargetDate}
            onChange={(e) => setMoveTargetDate(e.target.value)}
            className="input-base flex-1 h-9 !py-0 text-xs"
          />
          <button
            onClick={onBatchMove}
            disabled={selectedCount === 0 || !moveTargetDate}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all ${
              selectedCount > 0 && moveTargetDate
                ? 'bg-ledger-coral hover:brightness-105 text-[#0a0c10]'
                : 'bg-ledger-slate-light text-ledger-paper-dim/40 border border-ledger-line pointer-events-none'
            }`}
            style={selectedCount > 0 && moveTargetDate ? { boxShadow: 'var(--shadow-glow-accent)' } : undefined}
          >
            Move Blocks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-ledger-line bg-ledger-slate-light/30 flex items-center justify-between">
      <button
        onClick={onEnableSelectMode}
        className="btn-secondary !px-2.5 !py-1.5 text-xs"
      >
        <CalendarDays className="w-3.5 h-3.5 text-ledger-gold" />
        <span>Batch Move</span>
      </button>
      
      <button
        onClick={onAddTask}
        id="add-task-fab"
        className="btn-primary !px-4 !py-2 text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>New Hour Block</span>
      </button>
    </div>
  );
}
