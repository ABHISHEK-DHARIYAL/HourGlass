import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion, CompletionStatus } from '../types';
import { getTaskSegmentsForDate, formatHourLabel } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Play, CheckCircle, AlertCircle, Ban, ArrowRight, EyeOff } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface FocusModeViewProps {
  userId: string;
  tasks: Task[];
  completions: TaskCompletion[];
  currentDateStr: string;
  onSetStatus: (taskId: string, date: string, status: CompletionStatus) => Promise<void>;
  onEditTask?: (task: Task) => void;
}

export default function FocusModeView({ 
  userId, 
  tasks, 
  completions, 
  currentDateStr, 
  onSetStatus 
}: FocusModeViewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Get active segments for today
  const segments = getTaskSegmentsForDate(tasks, currentDateStr);

  // Find currently active segment
  const currentSegment = segments.find(seg => currentHour >= seg.startHour && currentHour < seg.endHour);

  // Find next upcoming segment today after the current hour
  const nextSegment = segments
    .filter(seg => seg.startHour > currentHour)
    .sort((a, b) => a.startHour - b.startHour)[0];

  // Check if current task is already completed/skipped
  const currentComp = currentSegment 
    ? completions.find(c => c.taskId === currentSegment.task.id && c.date === currentDateStr)
    : null;

  const handleSetStatus = async (status: CompletionStatus) => {
    if (!currentSegment) return;
    try {
      await onSetStatus(currentSegment.task.id, currentDateStr, status);
    } catch (err) {
      console.error('Failed to update task status in Focus Mode:', err);
    }
  };

  // Calculate remaining minutes in current hour block
  const minutesRemaining = 60 - currentMinute;

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-6 px-4">
      <AnimatePresence mode="wait">
        
        {/* CASE 1: Currently Active Task */}
        {currentSegment ? (
          <motion.div 
            key={`active-${currentSegment.task.id}-${currentComp?.status || 'none'}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full flex flex-col gap-6"
          >
            {/* Pulsating Focus Ring Card */}
            <div className="relative w-full bg-ledger-slate/30 border border-ledger-line rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-xl overflow-hidden">
              
              {/* Subtle ambient light dot in background */}
              <div 
                className="absolute -top-12 -left-12 w-32 h-32 rounded-full opacity-10 blur-2xl transition-colors"
                style={{ backgroundColor: currentSegment.task.color || '#e56b55' }}
              />

              {/* Pulsating status dot */}
              <div className="flex items-center gap-2 mb-4 bg-ledger-dark/50 px-3.5 py-1.5 rounded-full border border-ledger-line/50">
                <span className="relative flex h-2 w-2">
                  <span 
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: currentSegment.task.color || '#e56b55' }}
                  />
                  <span 
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: currentSegment.task.color || '#e56b55' }}
                  />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-paper-dim/80 font-bold">
                  Active Focus Block
                </span>
              </div>

              {/* Title with category colored bottom border */}
              <div className="flex flex-col items-center gap-2 max-w-full">
                <h2 className="font-serif text-2xl md:text-3xl font-black text-ledger-paper tracking-tight leading-tight break-words px-2">
                  {currentSegment.task.title}
                </h2>
                <div 
                  className="w-12 h-1 rounded-full mt-2"
                  style={{ backgroundColor: currentSegment.task.color || '#e56b55' }}
                />
              </div>

              {/* Time Details */}
              <div className="flex flex-col items-center gap-1 mt-6 font-mono">
                <span className="text-sm text-ledger-coral font-bold">
                  {formatHourLabel(currentSegment.startHour)} – {formatHourLabel(currentSegment.endHour)}
                </span>
                <span className="text-[10px] text-ledger-paper-dim/60">
                  {minutesRemaining} {minutesRemaining === 1 ? 'minute' : 'minutes'} left in this block
                </span>
              </div>

              {/* Notes block if present */}
              {currentSegment.task.notes && (
                <div className="mt-6 w-full max-w-md bg-ledger-dark/30 border border-ledger-line/60 rounded-xl p-4 text-left">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-ledger-paper-dim/40 block mb-1">
                    Block Notes
                  </span>
                  <div className="text-xs text-ledger-paper-dim/90 font-sans leading-relaxed italic">
                    <MarkdownRenderer text={currentSegment.task.notes} />
                  </div>
                </div>
              )}

              {/* Action State */}
              <div className="mt-8 w-full border-t border-ledger-line/30 pt-6 flex flex-col items-center justify-center gap-3">
                {currentComp ? (
                  <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <div className="w-10 h-10 rounded-full bg-ledger-coral/20 border border-ledger-coral/50 flex items-center justify-center text-ledger-coral">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="font-serif text-sm font-bold text-ledger-paper">
                        Logged as {currentComp.status}
                      </p>
                      <p className="text-[10px] font-mono text-ledger-paper-dim/60 mt-0.5">
                        Focus target reached. Peaceful space maintained.
                      </p>
                    </div>
                    
                    {/* Undo option */}
                    <button
                      onClick={() => handleSetStatus(CompletionStatus.NO_RESPONSE)}
                      className="mt-2 text-[10px] font-mono text-ledger-paper-dim/50 hover:text-ledger-coral cursor-pointer underline transition-colors"
                    >
                      Reset Focus Status
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
                    <button
                      onClick={() => handleSetStatus(CompletionStatus.DONE)}
                      className="w-full h-11 bg-ledger-coral hover:bg-ledger-coral/90 text-ledger-dark font-mono text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                      <span>Complete Block</span>
                    </button>
                    <button
                      onClick={() => handleSetStatus(CompletionStatus.SKIPPED)}
                      className="w-full h-11 bg-ledger-slate border border-ledger-line hover:border-ledger-coral text-ledger-paper-dim hover:text-ledger-coral font-mono text-[11px] font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Skip Session</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-widget: Next Scheduled Block */}
            {nextSegment && (
              <div className="w-full bg-ledger-slate/15 border border-ledger-line/50 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-ledger-dark border border-ledger-line flex items-center justify-center text-ledger-paper-dim/60">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-paper-dim/40 block">
                      Up Next Scheduled
                    </span>
                    <span className="font-serif text-sm font-bold text-ledger-paper truncate block mt-0.5">
                      {nextSegment.task.title}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs text-ledger-gold font-semibold block">
                    {formatHourLabel(nextSegment.startHour)}
                  </span>
                  <span className="font-mono text-[9px] text-ledger-paper-dim/50 block">
                    in {nextSegment.startHour - currentHour} hr(s)
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        ) : nextSegment ? (
          /* CASE 2: No active, but has next upcoming */
          <motion.div 
            key={`next-${nextSegment.task.id}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full flex flex-col gap-5"
          >
            <div className="w-full bg-ledger-slate/30 border border-ledger-line rounded-3xl p-8 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
              
              <div className="w-12 h-12 rounded-full bg-ledger-slate-light border border-ledger-line/80 flex items-center justify-center text-ledger-gold mb-4 animate-pulse">
                <Play className="w-5 h-5 fill-ledger-gold/20" />
              </div>

              <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-paper-dim/50 font-bold mb-2">
                Rest & Breathing Cushion
              </span>

              <h2 className="font-serif text-xl font-bold text-ledger-paper max-w-xs leading-snug">
                Space to unwind and clear your thoughts
              </h2>
              
              <p className="mt-3 text-xs text-ledger-paper-dim/70 max-w-sm font-sans leading-relaxed">
                Take a clean Offline Break. No schedule blocks are currently active this hour. Use this buffer to hydrate, stretch, or read.
              </p>

              <div className="mt-8 pt-6 border-t border-ledger-line/30 w-full flex flex-col items-center">
                <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-gold block mb-3">
                  Upcoming focus target
                </span>

                <div 
                  className="w-full max-w-xs p-4 bg-ledger-dark/40 border border-ledger-line rounded-2xl flex items-center justify-between text-left relative overflow-hidden group hover:border-ledger-coral/30 cursor-pointer transition-all"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1" 
                    style={{ backgroundColor: nextSegment.task.color || '#e56b55' }}
                  />
                  <div className="pl-2 min-w-0">
                    <h4 className="font-serif text-sm font-bold text-ledger-paper group-hover:text-ledger-coral transition-all truncate">
                      {nextSegment.task.title}
                    </h4>
                    <p className="font-mono text-[10px] text-ledger-paper-dim/60 mt-0.5">
                      Starts at {formatHourLabel(nextSegment.startHour)} ({nextSegment.startHour - currentHour} hr(s) from now)
                    </p>
                  </div>
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 ml-2" 
                    style={{ backgroundColor: nextSegment.task.color || '#e56b55' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* CASE 3: Fully Free Slate */
          <motion.div 
            key="empty-slate"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full"
          >
            <div className="w-full bg-ledger-slate/20 border border-ledger-line/60 rounded-3xl p-8 flex flex-col items-center text-center shadow-md">
              <span className="text-3xl mb-4">🍃</span>
              
              <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-coral font-bold mb-2">
                Peaceful Slate
              </span>

              <h2 className="font-serif text-lg font-bold text-ledger-paper leading-snug">
                Your focus schedule is empty
              </h2>

              <p className="mt-3 text-xs text-ledger-paper-dim/60 max-w-xs font-sans leading-relaxed">
                You have no scheduled focus blocks remaining for today. Enjoy this unstructured time to disconnect.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
