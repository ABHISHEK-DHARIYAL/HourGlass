// Purpose: Vercel serverless entry for AI Coach — serves /api/coach/<roadmap|notes|quiz|chat|email-schedule>
// and the cron-only /api/coach/digest. Reuses the exact same logic as the Firebase function
// (functions/src/coach/*), so you can deploy the backend on either platform.

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { handleCoach } from '../../functions/src/coach/coach.js';
import { sendDailyDigests } from '../../functions/src/coach/email.js';

// Vercel has no built-in Firebase credentials, so a service-account JSON is required.
function initAdmin(): void {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in the Vercel environment variables.');
  const account = JSON.parse(raw);
  if (typeof account.private_key === 'string') account.private_key = account.private_key.replace(/\\n/g, '\n');
  initializeApp({ credential: cert(account) });
}

export default async function handler(req: any, res: any) {
  try {
    initAdmin();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
    return;
  }

  const action = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;

  if (action === 'digest') {
    // Called by Vercel Cron, which sends "Authorization: Bearer $CRON_SECRET".
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await sendDailyDigests();
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('digest failed', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  await handleCoach(req, res, action);
}
