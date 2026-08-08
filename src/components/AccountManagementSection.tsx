// Purpose: Account management section for sign out, theme toggling, and account deletion workflows

import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, ShieldAlert, UserX, Sun, Moon, User as UserIcon } from 'lucide-react';

interface AccountManagementSectionProps {
  user: User;
  theme: 'dark' | 'paper';
  onToggleTheme: () => void;
  onSignOut: () => void;
  showDeleteAccountConfirm: boolean;
  setShowDeleteAccountConfirm: (show: boolean) => void;
  deletingAccount: boolean;
  onDeleteAccount: () => void;
}

export default function AccountManagementSection({
  user,
  theme,
  onToggleTheme,
  onSignOut,
  showDeleteAccountConfirm,
  setShowDeleteAccountConfirm,
  deletingAccount,
  onDeleteAccount
}: AccountManagementSectionProps) {
  return (
    <div className="bg-ledger-slate rounded-2xl border border-ledger-line p-5 flex flex-col gap-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-ledger-line pb-3">
        <UserIcon className="w-4 h-4 text-ledger-coral" />
        <h3 className="font-serif text-sm font-bold text-ledger-paper">Account & Session</h3>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between p-3 bg-ledger-dark/30 rounded-xl border border-ledger-line/50">
          <div>
            <span className="text-xs font-bold text-ledger-paper block">{user.displayName || 'Hourglass User'}</span>
            <span className="text-[11px] font-mono text-ledger-paper-dim">{user.email || user.uid}</span>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ledger-slate-light hover:bg-ledger-coral hover:text-ledger-dark rounded-lg border border-ledger-line text-xs font-bold text-ledger-paper transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-ledger-dark/30 rounded-xl border border-ledger-line/50">
          <div>
            <span className="text-xs font-bold text-ledger-paper block">App Visual Theme</span>
            <span className="text-[11px] text-ledger-paper-dim">Switch between Dark Ledger and Warm Paper theme</span>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ledger-slate-light hover:bg-ledger-gold hover:text-ledger-dark rounded-lg border border-ledger-line text-xs font-bold text-ledger-paper transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Paper Theme' : 'Dark Theme'}</span>
          </button>
        </div>

        <div className="border-t border-ledger-line/30 pt-3 mt-1">
          {showDeleteAccountConfirm ? (
            <div className="bg-ledger-coral/10 border border-ledger-coral/30 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-ledger-coral font-bold text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Delete Account & All Data?</span>
              </div>
              <p className="text-[11px] text-ledger-paper-dim leading-relaxed">
                This action is permanent and will remove all tasks, habits, and settings associated with your account from cloud storage and this device.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  disabled={deletingAccount}
                  className="flex-1 h-9 bg-ledger-slate-light hover:bg-ledger-slate-light/90 border border-ledger-line rounded-lg text-xs font-bold text-ledger-paper transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 h-9 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {deletingAccount ? (
                    <span>Deleting...</span>
                  ) : (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteAccountConfirm(true)}
              className="w-full h-10 flex items-center justify-center gap-2 bg-ledger-coral/10 hover:bg-ledger-coral/20 border border-ledger-coral/30 rounded-xl text-xs font-bold text-ledger-coral transition-all cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
