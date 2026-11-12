// Purpose: AI Coach "new course" form — topic, goal, level, daily time and study days.
// Calls the backend to build the roadmap, then builds the dated schedule locally.

import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { CoachCourse, CoachLevel } from '../types';
import { coachApi } from '../utils/coachApi';
import { buildSchedule } from '../utils/coachSchedule';
import { formatDate } from '../utils/dateUtils';

const LEVELS: CoachLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LENGTHS = [{ label: 'Short', n: 10 }, { label: 'Standard', n: 15 }, { label: 'Deep', n: 24 }];
export const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

interface Props {
  userId: string;
  onCreate: (course: CoachCourse) => Promise<void>;
  onCancel?: () => void;
}

export default function CoachCreateForm({ userId, onCreate, onCancel }: Props) {
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState<CoachLevel>('Beginner');
  const [length, setLength] = useState(15);
  const [hoursPerDay, setHoursPerDay] = useState(1);
  const [preferredHour, setPreferredHour] = useState(19);
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (d: number) => setStudyDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = async () => {
    if (!topic.trim()) return setError('Enter what you want to learn.');
    if (!studyDays.length) return setError('Pick at least one study day.');
    setError('');
    setBusy(true);
    try {
      const { title, topics } = await coachApi.roadmap({ topic: topic.trim(), goal: goal.trim(), level, topicCount: length });
      const now = new Date().toISOString();
      await onCreate({
        id: `course_${Date.now().toString(36)}`,
        userId,
        topic: topic.trim(),
        title,
        goal: goal.trim() || undefined,
        level,
        topics,
        schedule: buildSchedule({ topics, startDate, studyDays, preferredHour, hoursPerDay }),
        hoursPerDay,
        preferredHour,
        studyDays,
        startDate,
        emailAlerts: false,
        createdAt: now,
        updatedAt: now
      });
    } catch (e: any) {
      setError(e.message || 'Could not create the course.');
    } finally {
      setBusy(false);
    }
  };

  const label = 'text-[11px] font-semibold uppercase tracking-wide text-ledger-paper-dim mb-1.5 block';
  const pill = (active: boolean) => `chip cursor-pointer px-3 py-1.5 text-xs font-semibold border ${active ? 'border-ledger-coral text-ledger-coral' : 'border-ledger-line text-ledger-paper-dim'}`;

  return (
    <div className="surface-card p-5 max-w-2xl mx-auto flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-ledger-paper flex items-center gap-2"><Sparkles className="w-5 h-5 text-ledger-coral" /> New AI Coach course</h2>
        <p className="text-xs text-ledger-paper-dim mt-1">Tell the coach what to learn. It builds a roadmap, notes, quizzes and a daily schedule.</p>
      </div>

      <div>
        <label className={label} htmlFor="coach-topic">Topic</label>
        <input id="coach-topic" className="input-base w-full" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. System Design, Machine Learning, Spanish" maxLength={120} />
      </div>
      <div>
        <label className={label} htmlFor="coach-goal">Goal (optional)</label>
        <input id="coach-goal" className="input-base w-full" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. crack backend interviews in 3 months" maxLength={300} />
      </div>

      <div>
        <span className={label}>Your current level</span>
        <div className="flex gap-2 flex-wrap">{LEVELS.map((l) => <button key={l} type="button" className={pill(level === l)} onClick={() => setLevel(l)}>{l}</button>)}</div>
      </div>
      <div>
        <span className={label}>Roadmap length</span>
        <div className="flex gap-2 flex-wrap">{LENGTHS.map((l) => <button key={l.n} type="button" className={pill(length === l.n)} onClick={() => setLength(l.n)}>{l.label} · {l.n} topics</button>)}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="coach-hours">Hours / day</label>
          <select id="coach-hours" className="input-base w-full" value={hoursPerDay} onChange={(e) => setHoursPerDay(Number(e.target.value))}>
            {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="coach-time">Start time</label>
          <select id="coach-time" className="input-base w-full" value={preferredHour} onChange={(e) => setPreferredHour(Number(e.target.value))}>
            {Array.from({ length: 23 }, (_, h) => h).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={label} htmlFor="coach-start">Start date</label>
          <input id="coach-start" type="date" className="input-base w-full" value={startDate} min={formatDate(new Date())} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div>
        <span className={label}>Study days</span>
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} aria-pressed={studyDays.includes(i)}
              className={`w-9 h-9 rounded-full text-xs font-bold border cursor-pointer ${studyDays.includes(i) ? 'bg-ledger-coral text-[#0a0c10] border-ledger-coral' : 'border-ledger-line text-ledger-paper-dim'}`}>{d}</button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-ledger-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Building roadmap…</> : <><Sparkles className="w-4 h-4" /> Build my roadmap</>}
        </button>
      </div>
    </div>
  );
}
