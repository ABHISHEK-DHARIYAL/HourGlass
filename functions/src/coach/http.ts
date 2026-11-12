// Purpose: Shared helpers for the AI Coach API — typed errors, Firebase ID-token auth,
// and a per-user daily quota so one account can't burn through the Gemini key.

import { getAuth } from 'firebase-admin/auth';
import { getDb } from '../db.js';

// Minimal request/response shapes so the same code runs on Firebase Functions and Vercel.
export interface ReqLike {
  method?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}
export interface ResLike {
  status(code: number): ResLike;
  json(body: unknown): unknown;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthedUser {
  uid: string;
  email?: string;
}

// Verifies the "Authorization: Bearer <Firebase ID token>" header sent by the frontend.
export async function requireUser(req: ReqLike): Promise<AuthedUser> {
  const match = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''));
  if (!match) throw new HttpError(401, 'Please sign in to use AI Coach.');
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new HttpError(401, 'Your session expired. Please sign in again.');
  }
}

// Counts AI calls per user per UTC day in users/{uid}/coach_usage/{YYYY-MM-DD}.
export async function consumeQuota(uid: string): Promise<void> {
  const limit = Number(process.env.COACH_DAILY_LIMIT || 80);
  const day = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const ref = db.collection('users').doc(uid).collection('coach_usage').doc(day);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.data()?.count as number) || 0;
    if (used >= limit) {
      throw new HttpError(429, `Daily AI Coach limit (${limit} requests) reached. Try again tomorrow.`);
    }
    tx.set(ref, { count: used + 1, userId: uid, date: day }, { merge: true });
  });
}
