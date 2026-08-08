// Purpose: Sub-dialog choices for saving or deleting recurring task blocks inside TaskEditorModal

import React from 'react';

interface TaskSaveChoicesDialogProps {
  isSaving: boolean;
  onSaveChoice: (option: 'one' | 'all') => void;
  onCancel: () => void;
}

export function TaskSaveChoicesDialog({ isSaving, onSaveChoice, onCancel }: TaskSaveChoicesDialogProps) {
  return (
    <div className="bg-ledger-slate/60 border border-ledger-line rounded-xl p-4 mt-2 flex flex-col gap-2.5">
      <span className="text-xs font-mono text-ledger-gold uppercase tracking-wider text-center block">
        Save Options for Recurring Block
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSaveChoice('one')}
          className="flex-1 h-11 bg-ledger-slate-light border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light/90 active:scale-98 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Only for Today'}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSaveChoice('all')}
          className="flex-1 h-11 bg-ledger-coral/20 border border-ledger-coral/40 text-xs font-semibold rounded-lg text-ledger-coral hover:bg-ledger-coral/30 active:scale-98 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save for All Occurrences'}
        </button>
      </div>
      <button
        type="button"
        disabled={isSaving}
        onClick={onCancel}
        className="text-center text-[10px] font-sans text-ledger-paper-dim/80 underline cursor-pointer hover:text-ledger-paper mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Go Back
      </button>
    </div>
  );
}

interface TaskDeleteChoicesDialogProps {
  onDeleteChoice: (option: 'one' | 'all') => void;
  onCancel: () => void;
}

export function TaskDeleteChoicesDialog({ onDeleteChoice, onCancel }: TaskDeleteChoicesDialogProps) {
  return (
    <div className="bg-ledger-slate/60 border border-ledger-line rounded-xl p-3.5 mt-2 flex flex-col gap-2.5">
      <span className="text-xs font-mono text-ledger-paper-dim uppercase tracking-wider text-center block">
        This is a recurring block.
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDeleteChoice('one')}
          className="flex-1 h-11 bg-ledger-slate-light border border-ledger-line text-xs font-semibold rounded-lg text-ledger-paper hover:bg-ledger-slate-light/90 active:scale-98 transition-colors cursor-pointer"
        >
          Delete Only Today
        </button>
        <button
          type="button"
          onClick={() => onDeleteChoice('all')}
          className="flex-1 h-11 bg-ledger-coral/20 border border-ledger-coral/40 text-xs font-semibold rounded-lg text-ledger-coral hover:bg-ledger-coral/30 active:scale-98 transition-colors cursor-pointer"
        >
          Delete All Series
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-center text-[11px] font-sans text-ledger-paper-dim/80 underline cursor-pointer hover:text-ledger-paper mt-1"
      >
        Keep it
      </button>
    </div>
  );
}
