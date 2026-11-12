// Purpose: One AI Coach course — Roadmap (Beginner→Advanced), Study (notes + quiz), Schedule, Ask.

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Trash2, Loader2, CheckCircle2, BookOpen, Map as MapIcon, CalendarDays, MessageCircle, RefreshCw } from 'lucide-react';
import { CoachCourse, CoachLevel, Task } from '../types';
import type { CoachData } from '../hooks/useCoachData';
import { coachApi } from '../utils/coachApi';
import MarkdownRenderer from './MarkdownRenderer';
import CoachQuiz from './CoachQuiz';
import CoachChat from './CoachChat';
import CoachSchedulePanel from './CoachSchedulePanel';

type Tab = 'roadmap' | 'study' | 'schedule' | 'ask';
const LEVELS: CoachLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const PASS = 0.7;

interface Props {
  course: CoachCourse;
  data: CoachData;
  onBack: () => void;
  onAddTasks: (tasks: Partial<Task>[]) => Promise<void>;
}

export default function CoachCourseView({ course, data, onBack, onAddTasks }: Props) {
  const [tab, setTab] = useState<Tab>('roadmap');
  const [topicId, setTopicId] = useState(course.topics[0]?.id || '');
  const [notesBusy, setNotesBusy] = useState(false);
  const [error, setError] = useState('');

  // Best quiz result per topic (0..1).
  const best = useMemo(() => {
    const m = new Map<string, number>();
    data.attempts.filter((a) => a.courseId === course.id).forEach((a) => {
      const r = a.total ? a.score / a.total : 0;
      m.set(a.topicId, Math.max(m.get(a.topicId) ?? 0, r));
    });
    return m;
  }, [data.attempts, course.id]);

  const passed = course.topics.filter((t) => (best.get(t.id) ?? 0) >= PASS).length;
  const percent = course.topics.length ? Math.round((passed / course.topics.length) * 100) : 0;
  const topic = course.topics.find((t) => t.id === topicId) || course.topics[0];
  const note = data.notes.find((n) => n.id === `${course.id}_${topic?.id}`);

  const generateNotes = async () => {
    if (!topic) return;
    setNotesBusy(true); setError('');
    try {
      const { markdown } = await coachApi.notes(course.topic, topic.title, topic.level);
      await data.saveNote({ id: `${course.id}_${topic.id}`, userId: course.userId, courseId: course.id, topicId: topic.id, markdown, createdAt: new Date().toISOString() });
    } catch (e: any) { setError(e.message); }
    finally { setNotesBusy(false); }
  };

  const openTopic = (id: string) => { setTopicId(id); setError(''); setTab('study'); };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'roadmap', label: 'Roadmap', icon: MapIcon },
    { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    { id: 'ask', label: 'Ask', icon: MessageCircle }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn-icon" onClick={onBack} aria-label="Back to courses"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ledger-paper truncate">{course.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 flex-1 rounded-full bg-ledger-slate-lighter overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-ledger-success transition-all" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-[11px] text-ledger-paper-dim">{passed}/{course.topics.length} passed</span>
          </div>
        </div>
        <button className="btn-icon" aria-label="Delete course" onClick={() => { if (confirm('Delete this course, its notes and scores?')) { data.deleteCourse(course.id); onBack(); } }}><Trash2 className="w-4 h-4" /></button>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-ledger-line">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer border-b-2 -mb-px ${tab === id ? 'border-ledger-coral text-ledger-coral' : 'border-transparent text-ledger-paper-dim'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'roadmap' && (
        <div className="flex flex-col gap-5">
          {LEVELS.map((lvl) => {
            const list = course.topics.filter((t) => t.level === lvl);
            if (!list.length) return null;
            return (
              <section key={lvl}>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-ledger-gold mb-2">{lvl}</h3>
                <ul className="flex flex-col gap-1.5">
                  {list.map((t) => {
                    const r = best.get(t.id);
                    return (
                      <li key={t.id}>
                        <button onClick={() => openTopic(t.id)} className="w-full text-left surface-card-hover rounded-xl border border-ledger-line px-3 py-2.5 flex items-start gap-3 cursor-pointer">
                          <span className="mt-0.5">{r !== undefined && r >= PASS ? <CheckCircle2 className="w-4 h-4 text-ledger-success" /> : <span className="block w-4 h-4 rounded-full border border-ledger-line" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ledger-paper">{t.title}</span>
                            <span className="block text-xs text-ledger-paper-dim mt-0.5">{t.summary}</span>
                          </span>
                          <span className="text-[11px] text-ledger-paper-dim shrink-0 text-right">{t.estMinutes} min{r !== undefined && <><br />best {Math.round(r * 100)}%</>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {tab === 'study' && topic && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="coach-topic-select" className="sr-only">Topic</label>
            <select id="coach-topic-select" className="input-base w-full" value={topic.id} onChange={(e) => { setTopicId(e.target.value); setError(''); }}>
              {course.topics.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.title} ({t.level})</option>)}
            </select>
          </div>

          <section className="surface-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-ledger-paper mr-auto">Notes</h3>
              {note && <button className="btn-ghost !py-1 text-xs" onClick={generateNotes} disabled={notesBusy}><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>}
            </div>
            {note ? <MarkdownRenderer text={note.markdown} /> : (
              <button className="btn-primary" onClick={generateNotes} disabled={notesBusy}>
                {notesBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing notes…</> : 'Generate notes for this topic'}
              </button>
            )}
            {error && <p role="alert" className="text-xs text-ledger-danger mt-2">{error}</p>}
          </section>

          <section className="surface-panel p-4">
            <h3 className="text-sm font-bold text-ledger-paper mb-3">Quiz</h3>
            <CoachQuiz key={topic.id} course={course.topic} topicTitle={topic.title}
              onScored={(score, total) => data.saveAttempt({ id: `att_${Date.now().toString(36)}`, userId: course.userId, courseId: course.id, topicId: topic.id, score, total, createdAt: new Date().toISOString() })} />
          </section>
        </div>
      )}

      {tab === 'schedule' && (
        <CoachSchedulePanel course={course} onSaveCourse={data.saveCourse} onAddTasks={onAddTasks} onSaveEmailPrefs={data.saveEmailPrefs} />
      )}

      {tab === 'ask' && topic && (
        <div className="flex flex-col gap-2">
          <label htmlFor="coach-ask-topic" className="text-[11px] font-semibold uppercase tracking-wide text-ledger-paper-dim">Discussing</label>
          <select id="coach-ask-topic" className="input-base w-full" value={topic.id} onChange={(e) => setTopicId(e.target.value)}>
            {course.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <CoachChat key={topic.id} course={course.topic} topicTitle={topic.title} notes={note?.markdown} />
        </div>
      )}
    </div>
  );
}
