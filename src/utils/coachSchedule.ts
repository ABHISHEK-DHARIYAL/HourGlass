// Purpose: Turns a roadmap into a dated study schedule (one topic per study day).

import { CoachScheduleItem, CoachTopic } from '../types';
import { formatDate, parseLocalDate } from './dateUtils';

interface ScheduleOptions {
  topics: CoachTopic[];
  startDate: string; // YYYY-MM-DD
  studyDays: number[]; // 0 = Sunday ... 6 = Saturday
  preferredHour: number; // 0–23
  hoursPerDay: number; // 1–4
}

export function buildSchedule({ topics, startDate, studyDays, preferredHour, hoursPerDay }: ScheduleOptions): CoachScheduleItem[] {
  const days = studyDays.length ? studyDays : [1, 2, 3, 4, 5];
  const startHour = Math.min(22, Math.max(0, preferredHour));
  const endHour = Math.min(23, startHour + Math.max(1, hoursPerDay));
  const cursor = parseLocalDate(startDate);
  const items: CoachScheduleItem[] = [];

  for (const topic of topics) {
    let guard = 0;
    while (!days.includes(cursor.getDay()) && guard++ < 8) cursor.setDate(cursor.getDate() + 1);
    items.push({ topicId: topic.id, date: formatDate(cursor), startHour, endHour });
    cursor.setDate(cursor.getDate() + 1);
  }
  return items;
}
