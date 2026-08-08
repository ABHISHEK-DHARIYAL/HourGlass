// Purpose: Re-authentication modal dialog for sensitive operations like account deletion

import React from 'react';
import { User } from '../firebase';
import { Lock, KeyRound, ShieldAlert, X } from 'lucide-react';

interface ReauthModalProps {
  user: User;
  reauthorizing: boolean;
  reauthError: string | null;
  reauthPassword: string;
  setReauthPassword: (val: string) => void;
  onClose: () => void;
  handleReauthenticateAndRetry: () => Promise<void>;
  handlePasswordReauthenticateAndRetry: (e: React.FormEvent) => Promise<void>;
}

export default function ReauthModal({
  user,
  reauthorizing,
  reauthError,
  reauthPassword,
  setReauthPassword,
  onClose,
  handleReauthenticateAndRetry,
  handlePasswordReauthenticateAndRetry,
}: ReauthModalProps) {
  const currentUser = user;
  const isPasswordUser = (currentUser as any)?.providerData?.some((p: any) => p.providerId === 'password') ?? false;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-ledger-slate border border-ledger-line rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 font-sans relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-ledger-paper-dim hover:text-ledger-paper hover:bg-ledger-slate-light"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-ledger-coral/15 text-ledger-coral">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-ledger-paper">
              Security Verification Required
            </h3>
            <p className="font-mono text-[10px] text-ledger-paper-dim/60 uppercase tracking-wider">
              Recent authentication needed
            </p>
          </div>
        </div>

        <p className="text-xs text-ledger-paper-dim leading-relaxed">
          For your security, deleting your account and all associated data requires a recent authentication session. Please verify your credentials to continue.
        </p>

        {reauthError && (
          <div className="p-3 rounded-xl bg-ledger-coral/10 border border-ledger-coral/30 text-ledger-coral text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{reauthError}</span>
          </div>
        )}

        {isPasswordUser ? (
          <form onSubmit={handlePasswordReauthenticateAndRetry} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-ledger-paper-dim">
                Enter Account Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-9 bg-ledger-dark border border-ledger-line rounded-xl text-xs text-ledger-paper focus:outline-none focus:border-ledger-coral font-mono"
                />
                <KeyRound className="w-4 h-4 text-ledger-paper-dim/40 absolute right-3 top-3" />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={reauthorizing}
                className="flex-1 h-10 bg-ledger-dark border border-ledger-line text-xs font-semibold rounded-xl text-ledger-paper hover:bg-ledger-slate-light cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reauthorizing || !reauthPassword}
                className="flex-1 h-10 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                {reauthorizing ? (
                  <span className="w-4 h-4 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>Verify & Proceed</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleReauthenticateAndRetry}
              disabled={reauthorizing}
              className="w-full h-11 bg-ledger-coral hover:bg-ledger-coral/95 text-ledger-dark font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              {reauthorizing ? (
                <span className="w-4 h-4 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Re-authenticate with Google</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={reauthorizing}
              className="w-full h-10 bg-transparent text-ledger-paper-dim hover:text-ledger-paper text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
