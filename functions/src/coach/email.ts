// Purpose: Optional email alerts for AI Coach (SMTP via nodemailer). Works with any SMTP
// provider; for Gmail use smtp.gmail.com + an App Password. Configure in functions/.env.

import nodemailer from 'nodemailer';
import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { getDb } from '../db';

export interface MailItem {
  date: string;
  startHour: number;
  endHour: number;
  title: string;
}

export function emailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html
  });
}

export function scheduleHtml(courseTitle: string, intro: string, items: MailItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#667085">${esc(i.date)}</td>` +
        `<td style="padding:6px 12px 6px 0;color:#667085">${hourLabel(i.startHour)}–${hourLabel(i.endHour)}</td>` +
        `<td style="padding:6px 0"><b>${esc(i.title)}</b></td></tr>`
    )
    .join('');
  return (
    `<div style="font-family:Arial,sans-serif;max-width:560px">` +
    `<h2 style="margin:0 0 4px">📚 ${esc(courseTitle)}</h2><p style="color:#444">${esc(intro)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">${rows}</table>` +
    `<p style="color:#98a0ad;font-size:12px;margin-top:16px">Sent by HourGlass AI Coach</p></div>`
  );
}

// Hourly job: emails each opted-in user their lessons for "today" (in their own timezone)
// at the hour they chose. users/{uid}.coachEmail = { enabled, hour, timezone, lastSent }.
export async function sendDailyDigests(): Promise<void> {
  if (!emailConfigured()) return;
  const db = getDb();
  const snap = await db.collection('users').where('coachEmail.enabled', '==', true).get();

  for (const userDoc of snap.docs) {
    try {
      const data = userDoc.data();
      const pref = data.coachEmail || {};
      const tz: string = pref.timezone || data.timezone || 'UTC';
      const wantedHour = Number(pref.hour ?? 7);

      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
      const today = `${get('year')}-${get('month')}-${get('day')}`;
      if (Number(get('hour')) !== wantedHour || pref.lastSent === today) continue;

      const courses = await userDoc.ref.collection('coach_courses').get();
      const items: MailItem[] = [];
      let courseName = '';
      courses.docs.forEach((c) => {
        const course = c.data();
        if (course.emailAlerts === false) return;
        (course.schedule || []).forEach((s: any) => {
          if (s.date !== today) return;
          const topic = (course.topics || []).find((t: any) => t.id === s.topicId);
          courseName = courseName || course.topic;
          items.push({ date: s.date, startHour: s.startHour, endHour: s.endHour, title: `${topic?.title || 'Study session'} (${course.topic})` });
        });
      });
      if (!items.length) continue;

      const email = (await getAuth().getUser(userDoc.id)).email;
      if (!email) continue;
      await sendMail(email, `Today's learning plan — ${courseName}`, scheduleHtml(courseName, 'Here is what is planned for you today:', items));
      await userDoc.ref.set({ coachEmail: { lastSent: today } }, { merge: true });
    } catch (err) {
      logger.error(`Coach digest failed for ${userDoc.id}`, err);
    }
  }
}
