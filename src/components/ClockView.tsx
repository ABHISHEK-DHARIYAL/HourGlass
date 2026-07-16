import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Eye } from 'lucide-react';

interface ClockViewProps {
  onBack: () => void;
}

export default function ClockView({ onBack }: ClockViewProps) {
  const [time, setTime] = useState(new Date());
  const [is24Hour, setIs24Hour] = useState(false);
  const [showAnalog, setShowAnalog] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format digital time
  const formatTime = () => {
    let hours = time.getHours();
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    let ampm = '';

    if (!is24Hour) {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
    }

    const formattedHours = String(hours).padStart(2, '0');
    return `${formattedHours}:${minutes}:${seconds}${ampm}`;
  };

  // Format date
  const formatDateString = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return time.toLocaleDateString(undefined, options);
  };

  // Analog clock parameters
  const getAnalogHands = () => {
    const h = time.getHours();
    const m = time.getMinutes();
    const s = time.getSeconds();

    const hDeg = ((h % 12) * 30) + (m * 0.5);
    const mDeg = (m * 6) + (s * 0.1);
    const sDeg = s * 6;

    return { hDeg, mDeg, sDeg };
  };

  const { hDeg, mDeg, sDeg } = getAnalogHands();

  return (
    <div className="min-h-screen bg-ledger-dark text-ledger-paper p-6 flex flex-col justify-between select-none">
      {/* Upper Navigation & Controls */}
      <div className="w-full max-w-[430px] mx-auto flex items-center justify-between pb-4 border-b border-ledger-line/30">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-ledger-paper-dim hover:text-ledger-coral transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Planner</span>
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setIs24Hour(!is24Hour)}
            className="px-2 py-1 border border-ledger-line/50 hover:border-ledger-coral/50 rounded-lg text-[10px] font-mono text-ledger-paper-dim hover:text-ledger-coral cursor-pointer transition-all"
            title="Toggle 12/24-hour mode"
          >
            {is24Hour ? '24H' : '12H'}
          </button>
          <button
            onClick={() => setShowAnalog(!showAnalog)}
            className="flex items-center gap-1 px-2.5 py-1 border border-ledger-line/50 hover:border-ledger-coral/50 rounded-lg text-[10px] font-mono text-ledger-paper-dim hover:text-ledger-coral cursor-pointer transition-all"
            title="Toggle Analog view"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showAnalog ? 'Digital' : 'Analog'}</span>
          </button>
        </div>
      </div>

      {/* Center Clock Face */}
      <div className="flex-1 flex flex-col justify-center items-center py-12">
        {showAnalog ? (
          <div className="relative w-64 h-64 rounded-full border-2 border-ledger-line/60 bg-ledger-slate/10 flex items-center justify-center shadow-xl">
            {/* Clock center pivot */}
            <div className="absolute w-3 h-3 rounded-full bg-ledger-coral z-30" />

            {/* Clock numbers (12, 3, 6, 9) */}
            <div className="absolute top-4 text-xs font-mono font-semibold text-ledger-paper-dim/80">12</div>
            <div className="absolute right-4 text-xs font-mono font-semibold text-ledger-paper-dim/80">3</div>
            <div className="absolute bottom-4 text-xs font-mono font-semibold text-ledger-paper-dim/80">6</div>
            <div className="absolute left-4 text-xs font-mono font-semibold text-ledger-paper-dim/80">9</div>

            {/* Hour hand */}
            <div 
              className="absolute w-1 h-16 bg-ledger-paper/90 origin-bottom bottom-[50%] z-10 rounded-full transition-transform duration-300 ease-out"
              style={{ transform: `rotate(${hDeg}deg)` }}
            />

            {/* Minute hand */}
            <div 
              className="absolute w-0.75 h-24 bg-ledger-paper-dim origin-bottom bottom-[50%] z-15 rounded-full transition-transform duration-300 ease-out"
              style={{ transform: `rotate(${mDeg}deg)` }}
            />

            {/* Second hand */}
            <div 
              className="absolute w-0.5 h-24 bg-ledger-coral origin-bottom bottom-[50%] z-20 transition-transform duration-100 ease-linear"
              style={{ transform: `rotate(${sDeg}deg)` }}
            />
          </div>
        ) : (
          <div className="text-center">
            {/* Minimal Digital Display with Monospace font */}
            <div className="font-mono text-5xl md:text-6xl font-bold tracking-widest text-ledger-paper drop-shadow-lg">
              {formatTime()}
            </div>
          </div>
        )}

        {/* Date Display */}
        <div className="mt-8 text-center">
          <p className="font-serif text-base text-ledger-coral/95 font-medium leading-relaxed">
            {formatDateString()}
          </p>
          <p className="font-mono text-[9px] text-ledger-paper-dim/40 uppercase tracking-widest mt-1.5">
            HOURGLASS STANDALONE CHRONOMETER
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full text-center pb-2 text-[10px] text-ledger-paper-dim/30 font-mono">
        BATTERY-EFFICIENT SECOND-TICK PATTERN
      </div>
    </div>
  );
}
