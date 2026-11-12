// Purpose: Pushes the study schedule into the user's Google Calendar straight from the
// browser using Google Identity Services (OAuth token, calendar.events scope only).
// Needs VITE_GOOGLE_CLIENT_ID (a Web OAuth client ID) — see README section "AI Coach".

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const calendarConfigured = (): boolean => !!(import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Could not load Google sign-in. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

async function getAccessToken(): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: (import.meta as any).env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r: any) => (r?.access_token ? resolve(r.access_token) : reject(new Error(r?.error_description || r?.error || 'Google access was denied.'))),
      error_callback: (e: any) => reject(new Error(e?.message || 'Google sign-in was closed.'))
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export interface CalendarItem {
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  title: string;
  description?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Creates one event per study session with email (60 min before) and popup (10 min before)
// reminders — Google itself sends the email alert. Returns how many events were created.
export async function addScheduleToGoogleCalendar(items: CalendarItem[]): Promise<number> {
  const token = await getAccessToken();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let created = 0;

  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((item) =>
        fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: item.title,
            description: item.description || '',
            start: { dateTime: `${item.date}T${pad(item.startHour)}:00:00`, timeZone },
            end: { dateTime: `${item.date}T${pad(item.endHour)}:00:00`, timeZone },
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 10 }] }
          })
        })
      )
    );
    for (const res of results) {
      if (res.ok) created++;
      else if (res.status === 401 || res.status === 403) {
        throw new Error('Google Calendar refused access. Enable the Calendar API and add yourself as a test user.');
      }
    }
  }
  return created;
}
