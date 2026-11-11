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
    <div className="dialog-overlay">
      <div className="dialog-panel max-w-sm w-full p-6 flex flex-col gap-4 relative animate-fade-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon !w-8 !h-8"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-ledger-coral/15 text-ledger-coral">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ledger-paper">
              Security Verification Required
            </h3>
            <p className="text-[11px] text-ledger-paper-dim uppercase tracking-wider mt-0.5">
              Recent authentication needed
            </p>
          </div>
        </div>

        <p className="text-xs text-ledger-paper-dim leading-relaxed">
          For your security, deleting your account and all associated data requires a recent authentication session. Please verify your credentials to continue.
        </p>

        {reauthError && (
          <div className="p-3 rounded-xl bg-ledger-danger/10 border border-ledger-danger/30 text-ledger-danger text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{reauthError}</span>
          </div>
        )}

        {isPasswordUser ? (
          <form onSubmit={handlePasswordReauthenticateAndRetry} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ledger-paper-dim">
                Enter Account Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base w-full h-11 pr-9 text-sm font-mono"
                />
                <KeyRound className="w-4 h-4 text-ledger-paper-dim/50 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={reauthorizing}
                className="btn-secondary flex-1 h-11 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reauthorizing || !reauthPassword}
                className="btn-primary flex-1 h-11 text-xs disabled:opacity-50"
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
              className="btn-primary w-full h-11 text-xs disabled:opacity-50"
            >
              {reauthorizing ? (
                <span className="w-4 h-4 border-2 border-[#0a0c10] border-t-transparent rounded-full animate-spin"></span>
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
              className="btn-ghost w-full h-10 text-xs disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
