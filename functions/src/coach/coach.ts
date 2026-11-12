// Purpose: AI Coach API — one HTTP function routed as /api/coach/<action>.
// Actions: roadmap, notes, quiz, chat (Gemini) and email-schedule (SMTP).

import { generate, parseJson, ChatMessage } from './gemini.js';
import { HttpError, requireUser, consumeQuota, ReqLike, ResLike } from './http.js';
import { emailConfigured, sendMail, scheduleHtml, MailItem } from './email.js';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const COACH_SYSTEM =
  'You are an expert, encouraging mentor who coaches learners step by step. ' +
  'Be accurate, concrete and concise. Never invent facts, libraries or links.';

async function roadmap(body: any) {
  const topic = text(body.topic, 120);
  if (!topic) throw new HttpError(400, 'Please enter a topic.');
  const goal = text(body.goal, 300);
  const level = LEVELS.includes(body.level) ? body.level : 'Beginner';
  const count = clamp(Number(body.topicCount) || 15, 6, 30);

  const prompt =
    `Create a learning roadmap for "${topic}".\nLearner's current level: ${level}.\n` +
    (goal ? `Learner's goal: ${goal}.\n` : '') +
    `Return ONLY JSON: {"title": string, "topics": [{"title": string, "summary": string (max 25 words), ` +
    `"level": "Beginner"|"Intermediate"|"Advanced", "estMinutes": number (30-180)}]}.\n` +
    `Give exactly ${count} topics in learning order, progressing Beginner -> Intermediate -> Advanced, ` +
    `each topic small enough for one study session. Skip topics below the learner's current level only if they are trivial.`;

  const raw = parseJson<any>(await generate({ system: COACH_SYSTEM, messages: [{ role: 'user', text: prompt }], json: true, temperature: 0.4 }));
  const topics = (Array.isArray(raw?.topics) ? raw.topics : [])
    .map((t: any) => ({
      title: text(t?.title, 120),
      summary: text(t?.summary, 300),
      level: LEVELS.includes(t?.level) ? t.level : 'Beginner',
      estMinutes: clamp(Number(t?.estMinutes) || 60, 15, 240)
    }))
    .filter((t: any) => t.title)
    .sort((a: any, b: any) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .map((t: any, i: number) => ({ id: `t${i + 1}`, ...t }));
  if (topics.length < 3) throw new HttpError(502, 'The AI could not build a roadmap. Please try again.');
  return { title: text(raw?.title, 120) || topic, topics };
}

async function notes(body: any) {
  const course = text(body.course, 120);
  const title = text(body.topicTitle, 120);
  if (!course || !title) throw new HttpError(400, 'Missing course or topic.');
  const level = LEVELS.includes(body.level) ? body.level : 'Beginner';
  const prompt =
    `Write study notes for "${title}" (part of a "${course}" course, ${level} level).\n` +
    `Use ONLY this Markdown: ## headings, - bullet lists, 1. numbered lists, **bold**, \`inline code\`, fenced code blocks. ` +
    `No tables, no images, no HTML. Structure: ## Overview, ## Key Concepts, ## Example, ## Common Mistakes, ## Summary. ` +
    `Keep it under 600 words.`;
  const markdown = await generate({ system: COACH_SYSTEM, messages: [{ role: 'user', text: prompt }], temperature: 0.5 });
  return { markdown };
}

async function quiz(body: any) {
  const course = text(body.course, 120);
  const title = text(body.topicTitle, 120);
  if (!course || !title) throw new HttpError(400, 'Missing course or topic.');
  const count = clamp(Number(body.count) || 5, 3, 10);
  const prompt =
    `Write ${count} multiple-choice questions testing "${title}" (from a "${course}" course).\n` +
    `Return ONLY JSON: {"questions": [{"question": string, "options": [4 strings], "answerIndex": 0-3, "explanation": string (max 30 words)}]}.\n` +
    `Exactly one option is correct. Vary the correct position. Mix recall and applied questions.`;
  const raw = parseJson<any>(await generate({ system: COACH_SYSTEM, messages: [{ role: 'user', text: prompt }], json: true, temperature: 0.6 }));
  const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q: any) => ({
      question: text(q?.question, 400),
      options: Array.isArray(q?.options) ? q.options.map((o: any) => text(o, 200)) : [],
      answerIndex: Number(q?.answerIndex),
      explanation: text(q?.explanation, 300)
    }))
    .filter((q: any) => q.question && q.options.length === 4 && q.options.every(Boolean) && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4);
  if (!questions.length) throw new HttpError(502, 'The AI could not build a quiz. Please try again.');
  return { questions };
}

async function chat(body: any) {
  const course = text(body.course, 120);
  const message = text(body.message, 1500);
  if (!course || !message) throw new HttpError(400, 'Missing question.');
  const topicTitle = text(body.topicTitle, 120);
  const context = text(body.notes, 6000);
  const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : [])
    .slice(-10)
    .map((m: any) => ({ role: m?.role === 'model' ? 'model' : 'user', text: text(m?.text, 1500) }))
    .filter((m: ChatMessage) => m.text);

  const system =
    `${COACH_SYSTEM} You are answering follow-up questions for a learner studying "${course}"` +
    (topicTitle ? `, currently on "${topicTitle}"` : '') + '. ' +
    'Answer clearly in under 250 words, use Markdown (bold, bullets, code blocks) and end with one short check-your-understanding question when helpful.' +
    (context ? `\n\nThe learner's notes for this topic:\n${context}` : '');
  const reply = await generate({ system, messages: [...history, { role: 'user', text: message }], temperature: 0.5 });
  return { reply };
}

async function emailSchedule(body: any, email?: string) {
  if (!emailConfigured()) throw new HttpError(501, 'Email is not configured on the backend (set SMTP_* in functions/.env).');
  if (!email) throw new HttpError(400, 'Your account has no email address.');
  const items: MailItem[] = (Array.isArray(body.items) ? body.items : []).slice(0, 60).map((i: any) => ({
    date: text(i?.date, 10),
    startHour: clamp(Number(i?.startHour) || 0, 0, 23),
    endHour: clamp(Number(i?.endHour) || 0, 0, 23),
    title: text(i?.title, 160)
  })).filter((i: MailItem) => i.date && i.title);
  if (!items.length) throw new HttpError(400, 'No schedule to send.');
  const title = text(body.courseTitle, 120) || 'Your learning plan';
  await sendMail(email, `Your learning schedule — ${title}`, scheduleHtml(title, 'Your study schedule is ready:', items));
  return { success: true };
}

export async function handleCoach(req: ReqLike, res: ResLike, actionOverride?: string): Promise<void> {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const action = actionOverride || (req.path || '').split('/').filter(Boolean).pop();
    const user = await requireUser(req);
    const body = req.body || {};

    if (action === 'email-schedule') {
      res.json(await emailSchedule(body, user.email));
      return;
    }
    const handlers: Record<string, (b: any) => Promise<unknown>> = { roadmap, notes, quiz, chat };
    const fn = action ? handlers[action] : undefined;
    if (!fn) throw new HttpError(404, 'Unknown AI Coach action.');
    await consumeQuota(user.uid);
    res.json(await fn(body));
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('AI Coach error:', err);
    res.status(status).json({ error: err?.message || 'Something went wrong.' });
  }
}
