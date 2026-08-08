// Purpose: Quick-add natural language input parser and UI for the task editor modal

import React, { useState } from 'react';
import { Recurrence } from '../types';
import { Sparkles } from 'lucide-react';

interface NaturalLanguageQuickAddProps {
  startHour: number;
  endHour: number;
  recurrence: Recurrence;
  onParsed: (parsed: {
    title: string;
    startHour: number;
    endHour: number;
    recurrence: Recurrence;
  }) => void;
}

export default function NaturalLanguageQuickAdd({
  startHour,
  endHour,
  recurrence,
  onParsed
}: NaturalLanguageQuickAddProps) {
  const [naturalInput, setNaturalInput] = useState('');

  const handleParseNatural = () => {
    if (!naturalInput.trim()) return;

    let parsedTitle = naturalInput.trim();
    let parsedStart = startHour;
    let parsedEnd = endHour;
    let parsedRecur = recurrence;

    if (/\bdaily\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.DAILY;
      parsedTitle = parsedTitle.replace(/\bdaily\b/i, '');
    } else if (/\bweekly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.WEEKLY;
      parsedTitle = parsedTitle.replace(/\bweekly\b/i, '');
    } else if (/\bmonthly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.MONTHLY;
      parsedTitle = parsedTitle.replace(/\bmonthly\b/i, '');
    } else if (/\byearly\b/i.test(parsedTitle)) {
      parsedRecur = Recurrence.YEARLY;
      parsedTitle = parsedTitle.replace(/\byearly\b/i, '');
    }

    const rangeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const rangeMatch = parsedTitle.match(rangeRegex);

    if (rangeMatch) {
      parsedTitle = parsedTitle.replace(rangeRegex, '');
      
      let h1 = parseInt(rangeMatch[1], 10);
      const p1 = rangeMatch[3]?.toLowerCase();

      let h2 = parseInt(rangeMatch[4], 10);
      const p2 = rangeMatch[6]?.toLowerCase();

      if (p1 === 'pm' && h1 < 12) h1 += 12;
      if (p1 === 'am' && h1 === 12) h1 = 0;

      if (p2 === 'pm' && h2 < 12) h2 += 12;
      if (p2 === 'am' && h2 === 12) h2 = 0;

      if (!p1 && p2) {
        if (p2 === 'pm' && h1 < h2) {
          if (h1 < 12) h1 += 12;
        }
      }

      parsedStart = h1 % 24;
      parsedEnd = h2 % 24 || 24;
    } else {
      const singleRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
      const singleMatch = parsedTitle.match(singleRegex);
      if (singleMatch) {
        parsedTitle = parsedTitle.replace(singleMatch[0], '');
        let h1 = parseInt(singleMatch[1], 10);
        const p1 = singleMatch[3]?.toLowerCase();

        if (p1 === 'pm' && h1 < 12) h1 += 12;
        if (p1 === 'am' && h1 === 12) h1 = 0;

        parsedStart = h1 % 24;
        parsedEnd = (h1 + 1) % 24 || 24;
      }
    }

    parsedTitle = parsedTitle.replace(/\s+/g, ' ').replace(/(?:at|on|for)\s*$/, '').trim();

    if (parsedTitle) {
      onParsed({
        title: parsedTitle,
        startHour: parsedStart,
        endHour: parsedEnd,
        recurrence: parsedRecur
      });
      setNaturalInput('');
    }
  };

  return (
    <div className="bg-ledger-dark/30 border border-ledger-line/60 rounded-xl p-3 flex flex-col gap-2">
      <span className="font-mono text-[9px] text-ledger-gold uppercase tracking-widest flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Natural Language Quick Add</span>
      </span>
      <div className="flex gap-2">
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            placeholder="e.g. Gym 7am-8am daily or Coffee at 3pm"
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            className="w-full bg-ledger-dark border border-ledger-line rounded-lg text-xs px-2.5 py-1.5 text-ledger-paper placeholder-ledger-paper-dim/30 focus:outline-none focus:border-ledger-coral font-sans"
          />
        </div>
        <button
          type="button"
          onClick={handleParseNatural}
          className="px-3 bg-ledger-slate-light border border-ledger-line text-xs font-bold rounded-lg text-ledger-coral hover:border-ledger-coral/50 transition-colors cursor-pointer"
        >
          Parse
        </button>
      </div>
    </div>
  );
}
