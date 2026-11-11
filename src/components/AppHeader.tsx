// Purpose: Main top navigation header for Hourglass app with sync indicators and settings triggers

import React, { useEffect, useRef } from 'react';
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
import { AnimatePresence, motion } from 'framer-motion';
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
  onQuoteHoverChange?: (hovering: boolean) => void;
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
  onQuoteHoverChange,
}: AppHeaderProps) {
  // The header's height now changes with the quote length, so publish it as a
  // CSS variable for the sticky navigation bar to sit directly beneath it.
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--hg-header-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="w-full bg-ledger-slate/95 backdrop-blur-md border-b border-ledger-line sticky top-0 z-40" style={{ boxShadow: "var(--shadow-xs)" }}>
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
          <div
            className="hidden md:flex items-center gap-3 flex-1 min-w-0 max-w-xl px-4 py-2 rounded-2xl bg-ledger-slate-light border border-ledger-line"
            onMouseEnter={() => onQuoteHoverChange?.(true)}
            onMouseLeave={() => onQuoteHoverChange?.(false)}
            onFocus={() => onQuoteHoverChange?.(true)}
            onBlur={() => onQuoteHoverChange?.(false)}
          >
            <Sparkles className="w-4 h-4 text-ledger-gold shrink-0" />
            <div className="flex-1 min-w-0" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={quote.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-left"
                >
                  <p className="text-xs italic leading-snug text-ledger-paper-dim break-words">
                    “{quote.text}”
                  </p>
                  <span className="block mt-0.5 text-[11px] font-semibold text-ledger-paper-dim/70">
                    — {quote.author}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
            {onRefreshQuote && (
              <button
                onClick={onRefreshQuote}
                disabled={isRefreshingQuote}
                id="header-refresh-quote-button"
                className="p-1.5 rounded-md text-ledger-paper-dim hover:text-ledger-gold transition-colors cursor-pointer shrink-0"
                title="Show another quote"
                aria-label="Show another quote"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuote ? 'animate-spin' : ''}`} />
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
        <div className="md:hidden border-t border-ledger-line bg-ledger-slate-light/60 px-4 py-2 flex items-start justify-between gap-2">
          <Sparkles className="w-3.5 h-3.5 text-ledger-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={quote.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] italic leading-snug text-ledger-paper-dim break-words"
              >
                “{quote.text}” <span className="not-italic font-semibold text-ledger-paper-dim/70">— {quote.author}</span>
              </motion.p>
            </AnimatePresence>
          </div>
          {onRefreshQuote && (
            <button
              onClick={onRefreshQuote}
              disabled={isRefreshingQuote}
              id="mobile-refresh-quote-button"
              className="p-1 text-ledger-paper-dim hover:text-ledger-gold transition-colors shrink-0 cursor-pointer"
              title="Show another quote"
              aria-label="Show another quote"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuote ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
