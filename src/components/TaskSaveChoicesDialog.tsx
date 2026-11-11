// Purpose: Sub-dialog choices for saving or deleting recurring task blocks inside TaskEditorModal

import React from 'react';

interface TaskSaveChoicesDialogProps {
  isSaving: boolean;
  onSaveChoice: (option: 'one' | 'all') => void;
  onCancel: () => void;
}

export function TaskSaveChoicesDialog({ isSaving, onSaveChoice, onCancel }: TaskSaveChoicesDialogProps) {
  return (
    <div className="surface-panel rounded-xl p-4 mt-2 flex flex-col gap-2.5 animate-fade-up">
      <span className="text-[11px] font-semibold text-ledger-gold uppercase tracking-wider text-center block">
        Save Options for Recurring Block
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSaveChoice('one')}
          className="btn-secondary flex-1 h-11 text-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Only for Today'}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onSaveChoice('all')}
          className="flex-1 h-11 bg-ledger-coral/15 border border-ledger-coral/40 text-xs font-bold rounded-xl text-ledger-coral hover:bg-ledger-coral/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save for All Occurrences'}
        </button>
      </div>
      <button
        type="button"
        disabled={isSaving}
        onClick={onCancel}
        className="text-center text-[11px] text-ledger-paper-dim underline cursor-pointer hover:text-ledger-paper mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="surface-panel rounded-xl p-3.5 mt-2 flex flex-col gap-2.5 animate-fade-up">
      <span className="text-[11px] font-semibold text-ledger-paper-dim uppercase tracking-wider text-center block">
        This is a recurring block.
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDeleteChoice('one')}
          className="btn-secondary flex-1 h-11 text-xs active:scale-95"
        >
          Delete Only Today
        </button>
        <button
          type="button"
          onClick={() => onDeleteChoice('all')}
          className="flex-1 h-11 bg-ledger-danger/12 border border-ledger-danger/40 text-xs font-bold rounded-xl text-ledger-danger hover:bg-ledger-danger/20 active:scale-95 transition-all cursor-pointer"
        >
          Delete All Series
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-center text-[11px] text-ledger-paper-dim underline cursor-pointer hover:text-ledger-paper mt-1"
      >
        Keep it
      </button>
    </div>
  );
}
