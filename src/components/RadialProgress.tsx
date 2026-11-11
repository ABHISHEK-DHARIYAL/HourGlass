// Purpose: Reusable animated SVG radial progress ring used for the Daily and
// Monthly completion indicators. Pure presentational component — it receives
// an already-computed percentage and renders/animates it. No data fetching,
// no Firestore access, no business logic.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';

interface RadialProgressProps {
  /** Completion percentage, 0-100. Values are clamped for safety. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** CSS color for the progress arc. Defaults to the brand accent token. */
  color?: string;
  label?: string;
  sublabel?: string;
  /** Compact mode renders a smaller ring without the label lines. */
  compact?: boolean;
}

export default function RadialProgress({
  percent,
  size = 132,
  strokeWidth = 10,
  color = 'var(--color-ledger-coral)',
  label,
  sublabel,
  compact = false,
}: RadialProgressProps) {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center justify-center gap-2.5" role="img" aria-label={`${label ? label + ': ' : ''}${Math.round(clamped)} percent complete`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-ledger-slate-light)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className={compact ? 'text-sm font-bold font-mono text-ledger-paper' : 'text-2xl font-bold font-mono text-ledger-paper'}
          >
            {Math.round(clamped)}%
          </motion.span>
        </div>
      </div>
      {!compact && (label || sublabel) && (
        <div className="text-center">
          {label && <div className="text-[11px] font-semibold uppercase tracking-wider text-ledger-paper">{label}</div>}
          {sublabel && <div className="text-[10px] text-ledger-paper-dim mt-0.5">{sublabel}</div>}
        </div>
      )}
    </div>
  );
}
