// Purpose: Application preferences panel (theme, active timezone, and installable PWA instructions) for SettingsView

import React from 'react';
import { Sun, Moon, Globe, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsAppPreferencesPanelProps {
  theme: 'dark' | 'paper';
  onToggleTheme: () => void;
  userTimezone: string;
}

export default function SettingsAppPreferencesPanel({
  theme,
  onToggleTheme,
  userTimezone
}: SettingsAppPreferencesPanelProps) {
  const isPaper = theme === 'paper';
  return (
    <>
      <h4 className="text-[11px] text-ledger-paper-dim uppercase tracking-widest font-bold border-b border-ledger-line pb-2">
        Preferences
      </h4>

      <div className="flex items-start gap-3.5 pb-4 border-b border-ledger-line">
        <div className="p-2.5 rounded-xl bg-ledger-slate-light text-ledger-gold mt-0.5">
          {isPaper ? <Sun className="w-5 h-5 text-ledger-coral" /> : <Moon className="w-5 h-5 text-ledger-gold" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ledger-paper">Appearance</div>
            <button
              type="button"
              onClick={onToggleTheme}
              id="theme-preference-toggle-button"
              role="switch"
              aria-checked={!isPaper}
              className="relative w-12 h-7 rounded-full cursor-pointer transition-colors"
              style={{ background: isPaper ? 'var(--color-ledger-slate-lighter)' : 'var(--color-ledger-coral)' }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                style={{ left: isPaper ? '4px' : '26px' }}
              />
            </button>
          </div>
          <p className="text-[11px] text-ledger-paper-dim mt-1.5 leading-relaxed">
            {isPaper ? 'Light theme' : 'Dark theme'} — {isPaper ? 'clean white surfaces, best in bright rooms.' : 'deep charcoal surfaces, easy on the eyes at night.'}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3.5 py-4 border-b border-ledger-line">
        <div className="p-2.5 rounded-xl bg-ledger-slate-light text-ledger-gold mt-0.5">
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ledger-paper">Active Timezone</div>
          <div className="font-mono text-xs text-ledger-paper-dim mt-0.5">
            {userTimezone}
          </div>
          <p className="text-[11px] text-ledger-paper-dim/70 mt-1 leading-snug">
            Notifications and schedules automatically follow your local time on this device.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3.5 pt-1">
        <div className="p-2.5 rounded-xl bg-ledger-slate-light text-ledger-paper-dim mt-0.5">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ledger-paper">Install as an app</div>
          <p className="text-[11px] text-ledger-paper-dim mt-1 leading-relaxed">
            Add Hourglass to your homescreen for an app-like experience that launches instantly.
          </p>
          <div className="mt-2 text-[10px] text-ledger-paper-dim/70 leading-snug">
            Open your browser menu (or the share icon in Safari) and tap <strong className="text-ledger-paper">"Add to Home Screen"</strong>.
          </div>
        </div>
      </div>
    </>
  );
}
