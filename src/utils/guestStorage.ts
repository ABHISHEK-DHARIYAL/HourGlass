// Purpose: Guest mode local storage and IndexedDB persistence helpers

import { 
  Task, 
  TaskException, 
  TaskCompletion, 
  MustDoItem, 
  TaskTemplate, 
  TodoItem, 
  DayReflection, 
  DailyGoal, 
  Habit, 
  HabitHistory, 
  TaskCategory 
} from '../types';
import { clearStore, putToStore } from './offlineStore';

export function saveGuestStorageItem<T extends { id: string }>(
  key: string,
  storeName: string,
  newList: T[],
  setState: (list: T[]) => void
) {
  setState(newList);
  localStorage.setItem(key, JSON.stringify(newList));
  clearStore(storeName).then(() => newList.forEach(item => putToStore(storeName, item)));
}
