// Purpose: AI Coach tab — lists your courses, creates new ones, and opens a course.

import React, { useState } from 'react';
import { GraduationCap, Plus, Loader2 } from 'lucide-react';
import { CoachCourse, Task } from '../types';
import { useCoachData } from '../hooks/useCoachData';
import CoachCreateForm from './CoachCreateForm';
import CoachCourseView from './CoachCourseView';

interface Props {
  userId: string;
  onAddTasks: (tasks: Partial<Task>[]) => Promise<void>;
}

export default function CoachView({ userId, onAddTasks }: Props) {
  const data = useCoachData(userId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!data.enabled) {
    return (
      <div className="surface-card p-8 text-center max-w-md mx-auto">
        <GraduationCap className="w-8 h-8 text-ledger-coral mx-auto mb-2" />
        <h2 className="text-base font-bold text-ledger-paper">AI Coach needs an account</h2>
        <p className="text-sm text-ledger-paper-dim mt-1">Sign in with Google to save courses and use the AI features.</p>
      </div>
    );
  }
  if (data.loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ledger-paper-dim" aria-label="Loading" /></div>;
  }

  const active = data.courses.find((c) => c.id === activeId);
  if (active) return <CoachCourseView course={active} data={data} onBack={() => setActiveId(null)} onAddTasks={onAddTasks} />;

  const create = async (course: CoachCourse) => {
    await data.saveCourse(course);
    setCreating(false);
    setActiveId(course.id);
  };

  if (creating || data.courses.length === 0) {
    return <CoachCreateForm userId={userId} onCreate={create} onCancel={data.courses.length ? () => setCreating(false) : undefined} />;
  }

  const sorted = [...data.courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center">
        <h2 className="text-lg font-bold text-ledger-paper flex items-center gap-2 mr-auto"><GraduationCap className="w-5 h-5 text-ledger-coral" /> AI Coach</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New course</button>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {sorted.map((c) => {
          const passed = c.topics.filter((t) => data.attempts.some((a) => a.courseId === c.id && a.topicId === t.id && a.total && a.score / a.total >= 0.7)).length;
          const pct = c.topics.length ? Math.round((passed / c.topics.length) * 100) : 0;
          return (
            <li key={c.id}>
              <button onClick={() => setActiveId(c.id)} className="w-full text-left surface-card surface-card-hover p-4 cursor-pointer">
                <span className="block text-sm font-bold text-ledger-paper truncate">{c.title}</span>
                <span className="block text-xs text-ledger-paper-dim mt-0.5">{c.level} start · {c.topics.length} topics</span>
                <span className="block h-1.5 rounded-full bg-ledger-slate-lighter overflow-hidden mt-3"><span className="block h-full bg-ledger-success" style={{ width: `${pct}%` }} /></span>
                <span className="block text-[11px] text-ledger-paper-dim mt-1">{pct}% complete</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
