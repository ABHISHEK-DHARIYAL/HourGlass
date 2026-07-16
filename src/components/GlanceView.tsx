import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion, CompletionStatus } from '../types';
import { getTaskSegmentsForDate, formatDate, formatHourLabel } from '../utils/dateUtils';
import { Clock, Play, AlertCircle, CheckCircle, Ban } from 'lucide-react';

interface GlanceViewProps {
  userId: string;
  tasks: Task[];
  completions: TaskCompletion[];
  currentDateStr: string;
  onSetStatus: (taskId: string, date: string, status: CompletionStatus) => Promise<void>;
}

export default function GlanceView({ userId, tasks, completions, currentDateStr, onSetStatus }: GlanceViewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  
  // Get active segments for today
  const segments = getTaskSegmentsForDate(tasks, currentDateStr);

  // Find currently active segment
  const currentSegment = segments.find(seg => currentHour >= seg.startHour && currentHour < seg.endHour);

  // Find next upcoming segment today after the current hour
  const nextSegment = segments
    .filter(seg => seg.startHour > currentHour)
    .sort((a, b) => a.startHour - b.startHour)[0];

  // Check if current task is already completed or skipped
  const currentComp = currentSegment 
    ? completions.find(c => c.taskId === currentSegment.task.id && c.date === currentDateStr)
    : null;

  const handleSetStatus = async (status: CompletionStatus) => {
    if (!currentSegment) return;
    try {
      await onSetStatus(currentSegment.task.id, currentDateStr, status);
    } catch (err) {
      console.error('Failed to set completion status:', err);
    }
  };

  return (
    <div className="w-full bg-ledger-slate rounded-2xl border border-ledger-line p-5 shadow-lg flex flex-col gap-4 font-sans">
      <div className="flex justify-between items-center border-b border-ledger-line/50 pb-2.5">
        <h4 className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-2">
          <Clock className="w-4 h-4 text-ledger-coral animate-pulse" />
          <span>Now & Next Glance</span>
        </h4>
        <span className="font-mono text-[9px] bg-ledger-slate-light border border-ledger-line px-2 py-0.5 rounded-md text-ledger-coral font-bold tracking-wide">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* 1. Now Block */}
      <div className="bg-ledger-dark/40 p-4 rounded-xl border border-ledger-line/40 flex flex-col gap-2.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-paper-dim/50">
          ● Current Block
        </span>

        {currentSegment ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <h5 className="font-serif text-base font-bold text-ledger-paper leading-tight">
                  {currentSegment.task.title}
                </h5>
                <p className="font-mono text-[10px] text-ledger-paper-dim/60 mt-0.5">
                  {formatHourLabel(currentSegment.startHour)} – {formatHourLabel(currentSegment.endHour)}
                </p>
              </div>
              <span 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: currentSegment.task.color }} 
              />
            </div>

            {/* Completion Quick Controls */}
            <div className="flex items-center gap-2 pt-2 border-t border-ledger-line/30">
              {currentComp ? (
                <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-ledger-gold">
                  <CheckCircle className="w-3.5 h-3.5 text-ledger-coral" />
                  <span>Marked as {currentComp.status}</span>
                </div>
              ) : (
                <>
                  <span className="text-[10px] font-mono text-ledger-paper-dim/40 mr-1">Log occurrence:</span>
                  <button
                    onClick={() => handleSetStatus(CompletionStatus.DONE)}
                    className="px-2.5 py-1 bg-ledger-coral/15 border border-ledger-coral hover:bg-ledger-coral hover:text-ledger-dark text-[10px] font-mono text-ledger-coral font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Done</span>
                  </button>
                  <button
                    onClick={() => handleSetStatus(CompletionStatus.SKIPPED)}
                    className="px-2.5 py-1 bg-ledger-slate-light border border-ledger-line hover:border-ledger-coral text-[10px] font-mono text-ledger-paper-dim hover:text-ledger-coral rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Ban className="w-3 h-3" />
                    <span>Skip</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ledger-paper-dim/60 italic font-sans py-1.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ledger-gold shrink-0" />
            <span>No task scheduled this hour. Deep breathing cushion space.</span>
          </p>
        )}
      </div>

      {/* 2. Next Block */}
      <div className="bg-ledger-dark/20 p-3.5 rounded-xl border border-ledger-line/30 flex flex-col gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-ledger-paper-dim/40">
          ◆ Next Scheduled
        </span>

        {nextSegment ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h6 className="font-serif text-xs font-bold text-ledger-paper truncate">
                {nextSegment.task.title}
              </h6>
              <p className="font-mono text-[9px] text-ledger-paper-dim/50">
                Starts at {formatHourLabel(nextSegment.startHour)} ({nextSegment.startHour - currentHour} hr(s) from now)
              </p>
            </div>
            <span 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: nextSegment.task.color }} 
            />
          </div>
        ) : (
          <p className="text-[10px] text-ledger-paper-dim/40 italic font-mono">
            No further tasks scheduled today. Enjoy your evening!
          </p>
        )}
      </div>
    </div>
  );
}
