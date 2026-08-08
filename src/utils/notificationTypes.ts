// Purpose: Type definitions and default settings for notification preferences and rich alerts

export interface NotificationSettings {
  enabled: boolean;
  reminderTiming: number; // 5, 10, 15, or 30 minutes
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  morningSummaryEnabled: boolean;
  morningSummaryTime: string; // "08:00"
  eveningSummaryEnabled: boolean;
  eveningSummaryTime: string; // "21:00"
  habitRemindersEnabled: boolean;
  breakRemindersEnabled: boolean;
  breakIntervalMinutes: number; // 90
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  calendarRemindersEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderTiming: 15,
  soundEnabled: true,
  vibrationEnabled: true,
  morningSummaryEnabled: true,
  morningSummaryTime: '08:00',
  eveningSummaryEnabled: true,
  eveningSummaryTime: '21:00',
  habitRemindersEnabled: true,
  breakRemindersEnabled: true,
  breakIntervalMinutes: 90,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  calendarRemindersEnabled: true
};

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface RichNotification {
  id: string;
  type: 'upcoming_reminder' | 'task_start' | 'task_end' | 'next_preview' | 'overdue_task' | 'morning_summary' | 'evening_summary' | 'missed_task' | 'habit_reminder' | 'break_reminder' | 'calendar_reminder';
  title: string;
  body: string;
  category: 'info' | 'success' | 'alert' | 'break';
  actions: NotificationAction[];
}
