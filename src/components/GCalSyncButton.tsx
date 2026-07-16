import React, { useState } from 'react';
import { Task, Recurrence } from '../types';
import { Calendar, RefreshCw, Check, ArrowRight, ShieldAlert } from 'lucide-react';

interface GCalSyncButtonProps {
  userId: string;
  selectedDateStr: string;
  tasks: Task[];
  onImportEvent: (taskData: Partial<Task>) => Promise<void>;
  onImportComplete: () => void;
}

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export default function GCalSyncButton({ userId, selectedDateStr, tasks, onImportEvent, onImportComplete }: GCalSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getAccessToken = () => {
    return localStorage.getItem('google_access_token');
  };

  const fetchGoogleCalendarEvents = async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMsg('Google Calendar access token not found. Please log out and sign back in to grant permission.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setStatusMsg('Connecting to Google Calendar...');

    try {
      // Calculate selectedDateStr day boundaries (UTC ISO string)
      const startOfDay = new Date(`${selectedDateStr}T00:00:00`);
      const endOfDay = new Date(`${selectedDateStr}T23:59:59`);

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Google Calendar session expired. Please log out and sign back in.');
        }
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const data = await response.json();
      const items: GCalEvent[] = data.items || [];
      setEvents(items);
      setStatusMsg(`Found ${items.length} Google Calendar event(s) for today!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch Google Calendar events.');
      setStatusMsg(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImportEvent = async (event: GCalEvent) => {
    if (!event.start || (!event.start.dateTime && !event.start.date)) return;

    try {
      // Determine start and end hour (default to 9 AM - 10 AM if all-day event)
      let startHour = 9;
      let endHour = 10;

      if (event.start.dateTime) {
        const startD = new Date(event.start.dateTime);
        startHour = startD.getHours();
      }
      if (event.end && event.end.dateTime) {
        const endD = new Date(event.end.dateTime);
        endHour = endD.getHours();
        if (endHour === startHour) endHour = (startHour + 1) % 24;
      }

      await onImportEvent({
        title: event.summary || 'Google Calendar Event',
        notes: event.description || 'Imported from Google Calendar',
        startHour,
        endHour,
        anchorDate: selectedDateStr,
        recurrence: Recurrence.NONE,
        notifyEnabled: false,
        color: '#6366f1', // Indigo for GCal imports
        priority: false
      });

      // Filter out imported event from local state list
      setEvents(prev => prev.filter(e => e.id !== event.id));
      onImportComplete();
    } catch (err: any) {
      console.error('Failed to import event:', err);
      setErrorMsg('Failed to import event into Hourglass.');
    }
  };

  const handlePushToGoogleCalendar = async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMsg('Google Calendar access token not found. Please log out and sign back in.');
      return;
    }

    // Filter tasks that belong to this date
    const dayTasks = tasks.filter(t => t.anchorDate === selectedDateStr);
    if (dayTasks.length === 0) {
      setErrorMsg('No scheduled tasks today to push.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setStatusMsg('Pushing tasks to Google Calendar...');

    try {
      let successCount = 0;
      for (const t of dayTasks) {
        // Construct start and end dates
        const startISO = new Date(`${selectedDateStr}T${String(t.startHour).padStart(2, '0')}:00:00`).toISOString();
        const endISO = new Date(`${selectedDateStr}T${String(t.endHour).padStart(2, '0')}:00:00`).toISOString();

        const eventPayload = {
          summary: t.title,
          description: t.notes || 'Created in Hourglass App',
          start: { dateTime: startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          end: { dateTime: endISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventPayload)
        });

        if (response.ok) successCount++;
      }

      setStatusMsg(`Successfully pushed ${successCount} tasks to Google Calendar!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to push tasks to Google Calendar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-ledger-slate/40 rounded-2xl border border-ledger-line p-4 shadow-md font-sans">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-sm font-bold text-ledger-paper flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#4285F4]" />
          <span>Google Calendar Sync</span>
        </h4>
        <span className="font-mono text-[9px] text-ledger-paper-dim/40 uppercase tracking-widest">Two-Way Integration</span>
      </div>

      {errorMsg && (
        <div className="mb-3 p-2 bg-ledger-coral/10 border border-ledger-coral/30 rounded-xl text-[11px] text-ledger-coral flex items-start gap-2 font-mono">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div className="mb-3 text-[11px] text-ledger-gold font-mono flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Sync Control Buttons */}
      <div className="flex gap-2">
        <button
          onClick={fetchGoogleCalendarEvents}
          disabled={loading}
          className="flex-1 h-9 flex items-center justify-center gap-2 bg-ledger-dark border border-ledger-line hover:border-ledger-coral text-[11px] text-ledger-paper hover:text-ledger-coral rounded-xl transition-all cursor-pointer font-medium disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Fetch Today's Events</span>
        </button>

        <button
          onClick={handlePushToGoogleCalendar}
          disabled={loading || tasks.filter(t => t.anchorDate === selectedDateStr).length === 0}
          className="flex-1 h-9 flex items-center justify-center gap-2 bg-ledger-coral hover:bg-ledger-coral/90 active:scale-95 text-ledger-dark text-[11px] rounded-xl transition-all cursor-pointer font-bold disabled:opacity-50"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>Push Tasks to GCal</span>
        </button>
      </div>

      {/* GCal Event List for Selection */}
      {events.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-ledger-line/50 pt-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ledger-paper-dim/50">
            Convert event to Hourglass task:
          </p>
          <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
            {events.map((evt) => {
              // Parse duration preview
              let timeText = 'All Day';
              if (evt.start?.dateTime) {
                const date = new Date(evt.start.dateTime);
                timeText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
              return (
                <div 
                  key={evt.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-ledger-dark/50 border border-ledger-line/50 hover:border-ledger-coral/30"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs font-sans text-ledger-paper truncate font-medium">
                      {evt.summary || 'No Title'}
                    </p>
                    <p className="text-[9px] font-mono text-ledger-paper-dim/60">
                      {timeText}
                    </p>
                  </div>
                  <button
                    onClick={() => handleImportEvent(evt)}
                    className="h-7 px-2.5 bg-ledger-slate-light border border-ledger-line text-[10px] text-ledger-coral font-bold rounded-lg hover:border-ledger-coral transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Import</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
