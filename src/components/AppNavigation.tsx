// Purpose: Main navigation bar and view tab switcher for Hourglass app

import React from 'react';
import { 
  CalendarDays, 
  Clock, 
  Calendar, 
  ListTodo, 
  LineChart, 
  Target 
} from 'lucide-react';
import { motion } from 'framer-motion';

export type ViewMode = 'both' | 'month' | 'day' | 'review' | 'clock' | 'todos';

interface AppNavigationProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export default function AppNavigation({ viewMode, setViewMode }: AppNavigationProps) {
  const tabs = [
    { id: 'month', label: 'Month', icon: CalendarDays },
    { id: 'both', label: 'Month + Day', icon: Calendar },
    { id: 'day', label: 'Day Timeline', icon: Clock },
    { id: 'todos', label: 'Inbox', icon: ListTodo },
    { id: 'review', label: 'Statistics', icon: LineChart },
    { id: 'clock', label: 'Timer', icon: Target },
  ] as const;

  return (
    <nav className="w-full bg-ledger-dark/70 backdrop-blur-sm border-b border-ledger-line px-4 py-2.5 overflow-x-auto no-scrollbar sticky top-[57px] z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-start md:justify-center gap-1 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              id={`nav-tab-${tab.id}`}
              className="relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'var(--color-ledger-coral)', boxShadow: 'var(--shadow-glow-accent)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-[#0a0c10]' : 'text-ledger-paper-dim'}`} />
              <span className={`relative z-10 ${isActive ? 'text-[#0a0c10]' : 'text-ledger-paper-dim'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
