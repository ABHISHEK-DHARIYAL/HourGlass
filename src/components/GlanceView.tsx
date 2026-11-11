// Purpose: Executive summary view presenting current task status, upcoming agenda, and day progress at a glance
import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion, CompletionStatus, TaskException } from '../types';
import { getTaskSegmentsForDate, formatDate, formatHourLabel } from '../utils/dateUtils';
import { Clock, Play, AlertCircle, CheckCircle, Ban } from 'lucide-react';
import RadialProgress from './RadialProgress';

interface GlanceViewProps {
  userId: string;
  tasks: Task[];
  exceptions?: TaskException[];
  completions: TaskCompletion[];
  currentDateStr: string;
  onSetStatus: (taskId: string, date: string, status: CompletionStatus) => Promise<void>;
}

export default function GlanceView({ userId, tasks, exceptions = [], completions, currentDateStr, onSetStatus }: GlanceViewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = now.getHours();
  
  // Get active segments for today
  const segments = getTaskSegmentsForDate(tasks, currentDateStr, exceptions);

  // Daily completion % — hour-weighted across today's segments, using the
  // completions already loaded for the app. Purely a render-time
  // computation; nothing new is fetched or written.
  let dailyPlannedHours = 0;
  let dailyCompletedHours = 0;
  segments.forEach(seg => {
    const duration = seg.endHour - seg.startHour;
    dailyPlannedHours += duration;
    const comp = completions.find(c => c.taskId === seg.task.id && c.date === currentDateStr);
    if (comp && comp.status === CompletionStatus.DONE) {
      dailyCompletedHours += duration;
    }
  });
  const dailyCompletionPercent = dailyPlannedHours > 0 ? (dailyCompletedHours / dailyPlannedHours) * 100 : 0;

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
    <div className="w-full surface-card p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-ledger-line pb-3">
        <h4 className="text-sm font-bold text-ledger-paper flex items-center gap-2">
          <Clock className="w-4 h-4 text-ledger-coral" />
          <span>Now & Next</span>
        </h4>
        <span className="font-mono text-[11px] bg-ledger-slate-light border border-ledger-line px-2.5 py-1 rounded-lg text-ledger-coral font-bold">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <RadialProgress percent={dailyCompletionPercent} size={84} strokeWidth={7} compact />
        <div>
          <div className="text-[11px] font-semibold text-ledger-paper uppercase tracking-wide">Today's Progress</div>
          <div className="text-[11px] text-ledger-paper-dim mt-0.5">
            {dailyCompletedHours} of {dailyPlannedHours} scheduled hrs done
          </div>
        </div>
      </div>

      {/* 1. Now Block */}
      <div className="surface-panel p-4 flex flex-col gap-2.5">
        <span className="text-[10px] uppercase tracking-widest text-ledger-paper-dim font-semibold">
          Current Block
        </span>

        {currentSegment ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <h5 className="text-base font-bold text-ledger-paper leading-tight">
                  {currentSegment.task.title}
                </h5>
                <p className="font-mono text-[11px] text-ledger-paper-dim mt-0.5">
                  {formatHourLabel(currentSegment.startHour)} – {formatHourLabel(currentSegment.endHour)}
                </p>
              </div>
              <span 
                className="w-3 h-3 rounded-full shrink-0 mt-1" 
                style={{ backgroundColor: currentSegment.task.color }} 
              />
            </div>

            {/* Completion Quick Controls */}
            <div className="flex items-center gap-2 pt-2 border-t border-ledger-line">
              {currentComp ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-ledger-gold">
                  <CheckCircle className="w-3.5 h-3.5 text-ledger-coral" />
                  <span>Marked as {currentComp.status}</span>
                </div>
              ) : (
                <>
                  <span className="text-[11px] text-ledger-paper-dim mr-1">Log occurrence:</span>
                  <button
                    onClick={() => handleSetStatus(CompletionStatus.DONE)}
                    className="px-3 py-1.5 bg-ledger-coral/15 border border-ledger-coral hover:bg-ledger-coral hover:text-[#0a0c10] text-[11px] text-ledger-coral font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                  <button
                    onClick={() => handleSetStatus(CompletionStatus.SKIPPED)}
                    className="px-3 py-1.5 bg-ledger-slate-light border border-ledger-line hover:border-ledger-coral text-[11px] text-ledger-paper-dim hover:text-ledger-coral rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Skip</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ledger-paper-dim italic py-1.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ledger-gold shrink-0" />
            <span>No task scheduled this hour. Enjoy the open space.</span>
          </p>
        )}
      </div>

      {/* 2. Next Block */}
      <div className="surface-panel p-3.5 flex flex-col gap-1.5 bg-ledger-dark/30">
        <span className="text-[10px] uppercase tracking-widest text-ledger-paper-dim font-semibold">
          Next Scheduled
        </span>

        {nextSegment ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h6 className="text-xs font-bold text-ledger-paper truncate">
                {nextSegment.task.title}
              </h6>
              <p className="font-mono text-[10px] text-ledger-paper-dim">
                Starts at {formatHourLabel(nextSegment.startHour)} ({nextSegment.startHour - currentHour} hr(s) from now)
              </p>
            </div>
            <span 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: nextSegment.task.color }} 
            />
          </div>
        ) : (
          <p className="text-[11px] text-ledger-paper-dim italic">
            No further tasks scheduled today. Enjoy your evening!
          </p>
        )}
      </div>
    </div>
  );
}
