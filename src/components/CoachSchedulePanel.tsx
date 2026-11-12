// Purpose: Schedule tab — shows the study plan and sends it to the HourGlass planner,
// Google Calendar (with email reminders) and/or your inbox (SMTP email + daily digest).

import React, { useState } from 'react';
import { CalendarPlus, CalendarCheck, Mail, LayoutGrid, Loader2 } from 'lucide-react';
import { CoachCourse, Recurrence, Task } from '../types';
import { coachApi } from '../utils/coachApi';
import { addScheduleToGoogleCalendar, calendarConfigured } from '../utils/googleCalendar';
import { formatDate, parseLocalDate } from '../utils/dateUtils';
import { hourLabel } from './CoachCreateForm';

interface Props {
  course: CoachCourse;
  onSaveCourse: (c: CoachCourse) => Promise<void>;
  onAddTasks: (tasks: Partial<Task>[]) => Promise<void>;
  onSaveEmailPrefs: (enabled: boolean, hour: number) => Promise<void>;
}

export default function CoachSchedulePanel({ course, onSaveCourse, onAddTasks, onSaveEmailPrefs }: Props) {
  const [busy, setBusy] = useState<'' | 'planner' | 'calendar' | 'email'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [digestHour, setDigestHour] = useState(7);
  const today = formatDate(new Date());

  const rows = course.schedule.map((s) => ({
    ...s,
    title: `📚 ${course.topics.find((t) => t.id === s.topicId)?.title || 'Study session'}`
  }));

  const run = async (kind: 'planner' | 'calendar' | 'email', fn: () => Promise<string>) => {
    setBusy(kind); setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); }
    catch (e: any) { setMsg({ ok: false, text: e.message || 'Something went wrong.' }); }
    finally { setBusy(''); }
  };

  const addToPlanner = () => run('planner', async () => {
    const upcoming = rows.filter((r) => r.date >= today);
    await onAddTasks(upcoming.map((r) => ({
      title: r.title,
      notes: `AI Coach · ${course.title}`,
      startHour: r.startHour,
      endHour: r.endHour,
      anchorDate: r.date,
      recurrence: Recurrence.NONE,
      notifyEnabled: true,
      color: '#60a5fa',
      categoryColor: '#60a5fa'
    })));
    await onSaveCourse({ ...course, plannerSynced: true });
    return `Added ${upcoming.length} sessions to your HourGlass planner (with reminders).`;
  });

  const addToCalendar = () => run('calendar', async () => {
    const upcoming = rows.filter((r) => r.date >= today);
    const n = await addScheduleToGoogleCalendar(upcoming.map((r) => ({
      date: r.date, startHour: r.startHour, endHour: r.endHour, title: r.title, description: `AI Coach · ${course.title}`
    })));
    await onSaveCourse({ ...course, calendarSynced: true });
    return `Created ${n} Google Calendar events with email + popup reminders.`;
  });

  const emailNow = () => run('email', async () => {
    await coachApi.emailSchedule(course.title, rows.filter((r) => r.date >= today).map((r) => ({ date: r.date, startHour: r.startHour, endHour: r.endHour, title: r.title })));
    return 'Schedule sent to your email.';
  });

  const toggleDigest = () => run('email', async () => {
    const next = !course.emailAlerts;
    if (next) await onSaveEmailPrefs(true, digestHour);
    await onSaveCourse({ ...course, emailAlerts: next });
    return next ? `Daily email on study days at ${hourLabel(digestHour)}.` : 'Daily email turned off.';
  });

  const Btn = ({ kind, onClick, done, icon, label }: { kind: 'planner' | 'calendar' | 'email'; onClick: () => void; done?: boolean; icon: React.ReactNode; label: string }) => (
    <button className="btn-secondary" onClick={onClick} disabled={!!busy}>
      {busy === kind ? <Loader2 className="w-4 h-4 animate-spin" /> : icon} {label}{done ? ' ✓' : ''}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-panel p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Btn kind="planner" onClick={addToPlanner} done={course.plannerSynced} icon={<LayoutGrid className="w-4 h-4" />} label="Add to HourGlass planner" />
          {calendarConfigured() && <Btn kind="calendar" onClick={addToCalendar} done={course.calendarSynced} icon={course.calendarSynced ? <CalendarCheck className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4" />} label="Add to Google Calendar" />}
          <Btn kind="email" onClick={emailNow} icon={<Mail className="w-4 h-4" />} label="Email me this schedule" />
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-ledger-paper-dim">
          <label htmlFor="digest-hour">Daily email at</label>
          <select id="digest-hour" className="input-base !py-1 !w-auto" value={digestHour} onChange={(e) => setDigestHour(Number(e.target.value))} disabled={course.emailAlerts}>
            {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <button className={`btn-ghost !py-1 text-xs ${course.emailAlerts ? '!text-ledger-coral' : ''}`} onClick={toggleDigest} disabled={!!busy} aria-pressed={course.emailAlerts}>
            {course.emailAlerts ? 'On — tap to turn off' : 'Turn on'}
          </button>
        </div>
        {!calendarConfigured() && <p className="text-[11px] text-ledger-paper-dim">Google Calendar sync appears once VITE_GOOGLE_CLIENT_ID is set.</p>}
        {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-ledger-success' : 'text-ledger-danger'}`}>{msg.text}</p>}
      </div>

      <ol className="flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const d = parseLocalDate(r.date);
          return (
            <li key={i} className={`flex items-center gap-3 rounded-xl border border-ledger-line px-3 py-2 ${r.date < today ? 'opacity-50' : ''}`}>
              <span className="w-14 text-center shrink-0">
                <span className="block text-[10px] uppercase text-ledger-paper-dim">{d.toLocaleDateString([], { weekday: 'short' })}</span>
                <span className="block text-sm font-bold text-ledger-paper">{d.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ledger-paper truncate">{r.title.replace('📚 ', '')}</span>
                <span className="block text-xs text-ledger-paper-dim">{hourLabel(r.startHour)} – {hourLabel(r.endHour)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
