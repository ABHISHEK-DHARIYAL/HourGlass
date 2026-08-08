// Purpose: Header navigation and user profile summary card for SettingsView

import React from 'react';
import { User } from 'firebase/auth';
import { ChevronLeft, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';

interface SettingsProfileHeaderProps {
  user: User;
  onBack: () => void;
}

export default function SettingsProfileHeader({ user, onBack }: SettingsProfileHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          id="back-to-dashboard-button"
          className="btn-icon surface-card !w-9 !h-9 !rounded-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-extrabold tracking-tight text-ledger-paper flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-ledger-gold" />
          <span>Hourglass Settings</span>
        </h2>
      </div>

      <div className="surface-card p-5 flex items-center gap-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User Profile'}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full border-2 border-ledger-line"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-ledger-slate-light border border-ledger-line flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-ledger-paper-dim" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h3 className="text-lg font-bold truncate text-ledger-paper">
            {user.displayName || 'Hourglass Member'}
          </h3>
          <p className="text-[11px] text-ledger-paper-dim truncate">
            {user.email || 'No email associated'}
          </p>
        </div>
      </div>
    </>
  );
}
