// Purpose: Frontend client for the AI Coach backend (/api/coach/*). Every call sends the
// Firebase ID token so the Cloud Function can verify who is asking. No AI key lives here.

import { auth } from '../firebase';
import { CoachLevel, CoachQuizQuestion, CoachTopic } from '../types';

async function call<T>(action: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in with Google to use AI Coach.');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`/api/coach/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('Cannot reach the AI Coach server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export interface RoadmapInput {
  topic: string;
  goal?: string;
  level: CoachLevel;
  topicCount: number;
}

export const coachApi = {
  roadmap: (input: RoadmapInput) => call<{ title: string; topics: CoachTopic[] }>('roadmap', input),
  notes: (course: string, topicTitle: string, level: CoachLevel) =>
    call<{ markdown: string }>('notes', { course, topicTitle, level }),
  quiz: (course: string, topicTitle: string, count = 5) =>
    call<{ questions: CoachQuizQuestion[] }>('quiz', { course, topicTitle, count }),
  chat: (payload: { course: string; topicTitle?: string; notes?: string; history: { role: 'user' | 'model'; text: string }[]; message: string }) =>
    call<{ reply: string }>('chat', payload),
  emailSchedule: (courseTitle: string, items: { date: string; startHour: number; endHour: number; title: string }[]) =>
    call<{ success: boolean }>('email-schedule', { courseTitle, items })
};
