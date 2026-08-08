// Purpose: Main top navigation header for Hourglass app with sync indicators and settings triggers

import React from 'react';
import { User } from '../firebase';
import { 
  Hourglass, 
  Settings, 
  Search, 
  Sun, 
  Moon, 
  Loader2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { SyncStatus } from '../utils/offlineSyncManager';

interface AppHeaderProps {
  user: User;
  theme: 'dark' | 'paper';
  syncStatus: SyncStatus;
  quote: { text: string; author: string };
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onRefreshQuote?: () => void;
  isRefreshingQuote?: boolean;
}

export default function AppHeader({
  user,
  theme,
  syncStatus,
  quote,
  onToggleTheme,
  onOpenSettings,
  onOpenSearch,
  onRefreshQuote,
  isRefreshingQuote = false,
}: AppHeaderProps) {
  return (
    <header className="w-full bg-ledger-slate/95 backdrop-blur-md border-b border-ledger-line sticky top-0 z-40" style={{ boxShadow: "var(--shadow-xs)" }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-ledger-coral/12 text-ledger-coral">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-ledger-paper flex items-center gap-2">
              <span>Hourglass</span>
              {syncStatus === 'Syncing' && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ledger-gold bg-ledger-gold/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing
                </span>
              )}
            </h1>
            <p className="text-[11px] text-ledger-paper-dim hidden sm:block">
              Plan your day, block by block
            </p>
          </div>
        </div>

        {quote.text && (
          <div className="hidden md:flex items-center gap-2 max-w-sm text-center px-3 py-1.5 rounded-full bg-ledger-slate-light border border-ledger-line">
            <Sparkles className="w-3.5 h-3.5 text-ledger-gold shrink-0" />
            <div className="flex flex-col text-left overflow-hidden">
              <p className="text-[11px] italic text-ledger-paper-dim line-clamp-1">
                "{quote.text}"
              </p>
              <span className="font-mono text-[9px] text-ledger-paper-dim/60 font-semibold uppercase tracking-wider">
                — {quote.author}
              </span>
            </div>
            {onRefreshQuote && (
              <button
                onClick={onRefreshQuote}
                disabled={isRefreshingQuote}
                id="header-refresh-quote-button"
                className="p-1 rounded-md text-ledger-paper-dim hover:text-ledger-gold transition-colors cursor-pointer shrink-0"
                title="Get New Random Quote"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingQuote ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            id="global-search-trigger-button"
            className="btn-secondary !px-3 !py-2 text-xs"
            title="Search Schedule"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline">Search</span>
          </button>

          <button
            onClick={onToggleTheme}
            id="header-theme-toggle-button"
            className="btn-icon surface-panel !rounded-xl"
            title={theme === 'paper' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'paper' ? (
              <Sun className="w-4.5 h-4.5 text-ledger-coral" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-ledger-gold" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            id="header-settings-button"
            className="btn-icon surface-panel !rounded-xl relative"
            title="Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User Profile'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border-2 border-ledger-line"
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#0a0c10]" style={{ background: "var(--color-ledger-coral)" }}>
              {(user.displayName || user.email || 'H').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Quote Bar: Visible on smaller screens (< md) */}
      {quote.text && (
        <div className="md:hidden border-t border-ledger-line bg-ledger-slate-light/60 px-4 py-1.5 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="w-3 h-3 text-ledger-gold shrink-0" />
            <p className="text-[10px] italic text-ledger-paper-dim truncate">
              "{quote.text}" <span className="font-mono text-[9px] not-italic text-ledger-paper-dim/60">— {quote.author}</span>
            </p>
          </div>
          {onRefreshQuote && (
            <button
              onClick={onRefreshQuote}
              disabled={isRefreshingQuote}
              id="mobile-refresh-quote-button"
              className="p-1 text-ledger-paper-dim hover:text-ledger-gold transition-colors shrink-0"
              title="Get New Random Quote"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingQuote ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
