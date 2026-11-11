// Purpose: Weekly review analytics dashboard showing completion rates, focus hours, category breakdown, and streaks
import React, { useState } from 'react';
import { Task, TaskCompletion, CompletionStatus, TaskException, ExceptionType } from '../types';
import { calculateStreak, formatDate, parseLocalDate } from '../utils/dateUtils';
import { BarChart3, TrendingUp, Flame, Award, Calendar, ArrowLeft, PieChart, Clock, Zap } from 'lucide-react';
import RadialProgress from './RadialProgress';

const COLOR_TO_CATEGORY: Record<string, string> = {
  '#e56b55': 'Core Focused',
  '#d4af37': 'Study & Learning',
  '#3f7c62': 'Health & Routine',
  '#6678a3': 'Work & Projects',
  '#8a5a82': 'Leisure & Creative',
  '#506e5d': 'Admin & Chore',
};

const getCategoryName = (color: string, taskTitle: string) => {
  return COLOR_TO_CATEGORY[color] || taskTitle.split(' ')[0] || 'Tasks';
};

interface WeeklyReviewViewProps {
  userId: string;
  tasks: Task[];
  exceptions?: TaskException[];
  completions: TaskCompletion[];
  onBack: () => void;
}

export default function WeeklyReviewView({ userId, tasks, exceptions = [], completions, onBack }: WeeklyReviewViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Get date range for the selected week
  const getWeekRange = () => {
    const today = new Date();
    // Shift by weekOffset weeks
    today.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7)); // Monday of this/shifted week
    
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(formatDate(d));
    }
    return dates;
  };

  const weekDates = getWeekRange();
  const startOfWeekStr = weekDates[0];
  const endOfWeekStr = weekDates[6];

  // Group completions for this week
  const weekCompletions = completions.filter(c => weekDates.includes(c.date));
  const doneComps = weekCompletions.filter(c => c.status === CompletionStatus.DONE);
  const skippedComps = weekCompletions.filter(c => c.status === CompletionStatus.SKIPPED);
  
  // Calculate planned hours vs actual hours completed
  let totalPlannedHours = 0;
  let totalCompletedHours = 0;

  // Let's analyze categories by color
  // Let's analyze categories by color
  const categoryStats: Record<string, { name: string; planned: number; completed: number; color: string }> = {};

  // For each day in the week, look at the tasks that were active
  weekDates.forEach(dateStr => {
    // Standard simulation of active tasks on this date
    tasks.forEach(task => {
      // Is task active on this date?
      const isNone = task.recurrence === 'NONE' && dateStr === task.anchorDate;
      const isDaily = task.recurrence === 'DAILY' && dateStr >= task.anchorDate;
      const isWeekly = task.recurrence === 'WEEKLY' && dateStr >= task.anchorDate && parseLocalDate(dateStr).getDay() === parseLocalDate(task.anchorDate).getDay();
      
      const isActive = isNone || isDaily || isWeekly;
      const isSkipped = exceptions.some(e => e.taskId === task.id && e.date === dateStr && e.type === ExceptionType.SKIPPED);
      if (isActive && !isSkipped) {
        // Calculate task duration
        let duration = task.endHour > task.startHour ? task.endHour - task.startHour : (24 - task.startHour) + task.endHour;
        totalPlannedHours += duration;

        const catKey = task.color || '#e56b55';
        const catName = getCategoryName(catKey, task.title);
        if (!categoryStats[catName]) {
          categoryStats[catName] = {
            name: catName,
            planned: 0,
            completed: 0,
            color: catKey
          };
        }
        categoryStats[catName].planned += duration;

        // Check if completed
        const comp = completions.find(c => c.taskId === task.id && c.date === dateStr);
        if (comp && comp.status === CompletionStatus.DONE) {
          totalCompletedHours += duration;
          categoryStats[catName].completed += duration;
        }
      }
    });
  });

  const completionRate = totalPlannedHours > 0 ? Math.round((totalCompletedHours / totalPlannedHours) * 100) : 0;

  // Monthly completion — same hour-weighted method as the weekly rate above,
  // scoped to the current calendar month. Computed entirely from the tasks/
  // exceptions/completions already passed in as props; no extra data fetch
  // and nothing new written back to Firestore.
  const monthAnchor = new Date();
  const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const monthEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
  const monthDates: string[] = [];
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    monthDates.push(formatDate(new Date(d)));
  }

  let monthPlannedHours = 0;
  let monthCompletedHours = 0;
  monthDates.forEach(dateStr => {
    tasks.forEach(task => {
      const isNone = task.recurrence === 'NONE' && dateStr === task.anchorDate;
      const isDaily = task.recurrence === 'DAILY' && dateStr >= task.anchorDate;
      const isWeekly = task.recurrence === 'WEEKLY' && dateStr >= task.anchorDate && parseLocalDate(dateStr).getDay() === parseLocalDate(task.anchorDate).getDay();
      const isActive = isNone || isDaily || isWeekly;
      const isSkipped = exceptions.some(e => e.taskId === task.id && e.date === dateStr && e.type === ExceptionType.SKIPPED);
      if (isActive && !isSkipped) {
        const duration = task.endHour > task.startHour ? task.endHour - task.startHour : (24 - task.startHour) + task.endHour;
        monthPlannedHours += duration;
        const comp = completions.find(c => c.taskId === task.id && c.date === dateStr);
        if (comp && comp.status === CompletionStatus.DONE) {
          monthCompletedHours += duration;
        }
      }
    });
  });
  const monthlyCompletionRate = monthPlannedHours > 0 ? Math.round((monthCompletedHours / monthPlannedHours) * 100) : 0;
  const monthLabel = monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Suggest the most productive hours of the day
  // Let's count successful completions and total scheduled blocks for each hour (0 to 23)
  const hourStats = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    completed: 0,
    total: 0,
  }));

  // Look through all dates in this week
  weekDates.forEach(dateStr => {
    tasks.forEach(task => {
      // Is task scheduled for this date?
      const isNone = task.recurrence === 'NONE' && dateStr === task.anchorDate;
      const isDaily = task.recurrence === 'DAILY' && dateStr >= task.anchorDate;
      const isWeekly = task.recurrence === 'WEEKLY' && dateStr >= task.anchorDate && parseLocalDate(dateStr).getDay() === parseLocalDate(task.anchorDate).getDay();
      
      if (isNone || isDaily || isWeekly) {
        // Find if completed
        const comp = completions.find(c => c.taskId === task.id && c.date === dateStr);
        const isDone = comp && comp.status === CompletionStatus.DONE;

        // Mark all hours in this task's block
        const start = task.startHour;
        const end = task.endHour;
        
        let h = start;
        let iterations = 0;
        const targetEnd = end % 24;
        while (h !== targetEnd && iterations < 24) {
          hourStats[h].total += 1;
          if (isDone) {
            hourStats[h].completed += 1;
          }
          h = (h + 1) % 24;
          iterations++;
        }
      }
    });
  });

  // Sort hours by number of completed items (descending), and fallback to completion rate
  const activeHourStats = hourStats.filter(hs => hs.total > 0);
  const sortedByProductivity = [...activeHourStats].sort((a, b) => {
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }
    const rateA = a.total > 0 ? a.completed / a.total : 0;
    const rateB = b.total > 0 ? b.completed / b.total : 0;
    return rateB - rateA;
  });

  // Get top 2 productive hours
  const topHours = sortedByProductivity.slice(0, 2).filter(h => h.completed > 0);

  const formatHourLabelLocal = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  // Compute tasks with active streaks
  const streaksList = tasks
    .filter(t => t.recurrence !== 'NONE')
    .map(t => ({
      task: t,
      streak: calculateStreak(t.id, completions)
    }))
    .filter(item => item.streak > 0)
    .sort((a, b) => b.streak - a.streak);

  return (
    <div className="min-h-screen bg-ledger-dark text-ledger-paper font-sans flex flex-col pb-10">
      <div className="w-full max-w-[430px] mx-auto p-4 flex flex-col gap-5 animate-fade-up">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-icon surface-card"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-ledger-paper leading-tight tracking-tight">
              Statistics
            </h2>
            <p className="text-[11px] text-ledger-paper-dim mt-0.5">
              Reflect on your follow-through, day by day
            </p>
          </div>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center justify-between surface-card p-1.5">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="btn-ghost px-3 py-1.5"
          >
            ← Prev
          </button>
          <span className="text-xs font-semibold text-ledger-paper">
            {startOfWeekStr} → {endOfWeekStr}
          </span>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="btn-ghost px-3 py-1.5"
          >
            Next →
          </button>
        </div>

        {/* Daily/Monthly progress rings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-card p-4 flex flex-col items-center gap-1">
            <RadialProgress percent={completionRate} size={104} strokeWidth={9} />
            <span className="text-[11px] font-semibold text-ledger-paper mt-1">This Week</span>
            <span className="text-[10px] text-ledger-paper-dim">Follow-through rate</span>
          </div>
          <div className="surface-card p-4 flex flex-col items-center gap-1">
            <RadialProgress percent={monthlyCompletionRate} size={104} strokeWidth={9} color="var(--color-ledger-gold)" />
            <span className="text-[11px] font-semibold text-ledger-paper mt-1">{monthLabel}</span>
            <span className="text-[10px] text-ledger-paper-dim">Monthly completion</span>
          </div>
        </div>

        {/* Follow-through summary scorecard */}
        <div className="surface-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] text-ledger-paper-dim uppercase tracking-wide font-semibold">
                Follow-Through Rate
              </p>
              <h3 className="text-3xl font-extrabold text-ledger-coral mt-1 font-mono">
                {completionRate}%
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-ledger-gold/12 flex items-center justify-center">
              <Award className="w-5 h-5 text-ledger-gold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ledger-line">
            <div className="surface-panel p-3">
              <span className="text-[10px] text-ledger-paper-dim uppercase font-semibold block">Planned</span>
              <span className="text-lg font-bold text-ledger-paper mt-0.5 block font-mono">{totalPlannedHours} hrs</span>
            </div>
            <div className="surface-panel p-3">
              <span className="text-[10px] text-ledger-paper-dim uppercase font-semibold block">Completed</span>
              <span className="text-lg font-bold text-ledger-gold mt-0.5 block font-mono">{totalCompletedHours} hrs</span>
            </div>
          </div>
        </div>

        {/* Category breakdown (Planned vs Actual Spent hours) */}
        <div className="surface-card p-5 animate-fade-up">
          <h4 className="text-sm font-bold text-ledger-paper mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-ledger-coral" />
            <span>Weekly Time Allocation Chart</span>
          </h4>

          {Object.keys(categoryStats).length === 0 ? (
            <p className="text-xs text-ledger-paper-dim/50 italic text-center py-6 font-sans">
              No task statistics recorded for this week.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Stacked Proportional Distribution Strip */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-ledger-paper-dim/50 uppercase tracking-wider block">
                  Time Allocation Ratio
                </span>
                <div className="h-5 w-full bg-ledger-dark/60 rounded-xl overflow-hidden flex border border-ledger-line/50 p-[2px]">
                  {Object.values(categoryStats).map((stat, idx) => {
                    const sharePercent = totalCompletedHours > 0 
                      ? (stat.completed / totalCompletedHours) * 100 
                      : (stat.planned / totalPlannedHours) * 100;
                    if (sharePercent === 0) return null;
                    return (
                      <div
                        key={idx}
                        style={{ 
                          width: `${sharePercent}%`, 
                          backgroundColor: stat.color 
                        }}
                        className="h-full transition-all duration-500 first:rounded-l-[9px] last:rounded-r-[9px] hover:opacity-90 relative group cursor-pointer"
                        title={`${stat.name}: ${Math.round(sharePercent)}%`}
                      />
                    );
                  })}
                </div>
                {/* Horizontal strip legends */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                  {Object.values(categoryStats).map((stat, idx) => {
                    const sharePercent = totalCompletedHours > 0 
                      ? Math.round((stat.completed / totalCompletedHours) * 100) 
                      : Math.round((stat.planned / totalPlannedHours) * 100);
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stat.color }} />
                        <span className="text-ledger-paper-dim/80">{stat.name}</span>
                        <span className="text-ledger-gold font-bold">{sharePercent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Planned vs Completed Bar Chart */}
              <div className="pt-4 border-t border-ledger-line/40 space-y-4">
                <span className="text-[10px] font-mono text-ledger-paper-dim/50 uppercase tracking-wider block">
                  Planned vs Completed (Hours)
                </span>
                <div className="space-y-3">
                  {Object.values(categoryStats).map((stat, idx) => {
                    const planPercent = Math.min(100, Math.round((stat.completed / stat.planned) * 100)) || 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-sans">
                          <span className="font-medium text-ledger-paper flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                            {stat.name}
                          </span>
                          <span className="font-mono text-[10px] text-ledger-paper-dim/70">
                            {stat.completed} / {stat.planned} hrs ({planPercent}%)
                          </span>
                        </div>
                        {/* Double progress bar: outer is planned, inner is actual completed */}
                        <div className="h-2.5 bg-ledger-dark/60 rounded-full overflow-hidden relative border border-ledger-line/30">
                          <div 
                            className="h-full opacity-35" 
                            style={{ width: '100%', backgroundColor: stat.color }}
                          />
                          <div 
                            className="h-full absolute top-0 left-0 rounded-full transition-all" 
                            style={{ width: `${planPercent}%`, backgroundColor: stat.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active Streaks Section */}
        <div className="surface-card p-5">
          <h4 className="text-sm font-bold text-ledger-paper mb-3.5 flex items-center gap-2">
            <Flame className="w-4.5 h-4.5 text-ledger-coral" />
            <span>Habit & Routine Streaks</span>
          </h4>

          {streaksList.length === 0 ? (
            <p className="text-xs text-ledger-paper-dim/50 italic text-center py-4 font-sans">
              No active habit streaks yet. Complete recurring tasks consecutively to build streaks!
            </p>
          ) : (
            <div className="space-y-2.5">
              {streaksList.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 rounded-xl bg-ledger-dark/40 border border-ledger-line/50 hover:border-ledger-coral/30 transition-all"
                >
                  <span className="text-xs font-sans text-ledger-paper font-semibold">
                    {item.task.title}
                  </span>
                  <span className="flex items-center gap-1 bg-ledger-coral/10 border border-ledger-coral/20 px-2 py-0.5 rounded-full text-xs font-mono font-bold text-ledger-coral">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{item.streak} days</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Productive Hours Summary Section */}
        <div className="surface-card p-5 flex flex-col gap-3">
          <h4 className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-ledger-gold" />
            <span>Circadian Focus & Peak Hours</span>
          </h4>

          {topHours.length === 0 ? (
            <div className="text-center py-5 px-4 bg-ledger-dark/30 rounded-xl border border-ledger-line/30">
              <span className="text-lg">🕯️</span>
              <p className="text-[11px] text-ledger-paper-dim/60 font-mono mt-2">
                Need more logged hour blocks
              </p>
              <p className="text-[10px] text-ledger-paper-dim/40 font-sans mt-1">
                Mark scheduled tasks as completed this week to identify your peak circadian energy windows!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-ledger-paper-dim/80 leading-relaxed font-sans">
                Based on your actual completion habits, your peak productivity spikes around:
              </p>
              
              <div className="grid grid-cols-2 gap-2.5">
                {topHours.map((th, idx) => {
                  const rate = th.total > 0 ? Math.round((th.completed / th.total) * 100) : 0;
                  return (
                    <div 
                      key={idx} 
                      className="bg-ledger-dark/40 border border-ledger-line/70 rounded-xl p-3 flex flex-col gap-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-1">
                        <Zap className="w-3 h-3 text-ledger-gold animate-pulse" />
                      </div>
                      <span className="font-mono text-[9px] text-ledger-paper-dim/50 uppercase tracking-widest block">
                        Rank #{idx + 1} Hour
                      </span>
                      <span className="font-serif text-sm font-black text-ledger-coral block">
                        {formatHourLabelLocal(th.hour)}
                      </span>
                      <span className="font-mono text-[9px] text-ledger-gold/80 block mt-0.5">
                        {th.completed} Completed ({rate}% Rate)
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-ledger-gold/5 border border-ledger-gold/20 rounded-xl p-3 mt-1 text-[11px] font-sans text-ledger-paper-dim/90 leading-relaxed">
                <span className="font-bold text-ledger-paper block mb-0.5">💡 Strategy Suggestion:</span>
                Your focus level is consistently at its absolute highest around{' '}
                <span className="text-ledger-coral font-semibold">
                  {formatHourLabelLocal(topHours[0].hour)}
                </span>
                . Protect this block of your day like a temple: schedule your highest-cognitive-demand deep work, creative writing, or complex problem solving specifically in this slot.
              </div>
            </div>
          )}
        </div>

        {/* Micro-insight Calibrator Advice */}
        <div className="surface-panel p-4 text-xs text-ledger-paper-dim leading-relaxed flex gap-2.5">
          <span className="text-base text-ledger-coral shrink-0">💡</span>
          <div>
            <span className="font-bold text-ledger-paper block mb-0.5">Calibrator Insight</span>
            {completionRate > 75 
              ? "Superb follow-through! Your energy allocation matches your planning. Keep this pace or add micro-rewards."
              : "Consider planning smaller duration task-blocks next week or scheduling dedicated blank 'buffer hours' to absorb delays."}
          </div>
        </div>

      </div>
    </div>
  );
}
