// Purpose: Real-time Firestore data + CRUD for AI Coach (courses, generated notes, quiz attempts).
// Stored under users/{uid}/coach_courses | coach_notes | coach_attempts (covered by the existing rules).

import { useCallback, useEffect, useState } from 'react';
import { auth, collection, db, deleteDoc, doc, onSnapshot, setDoc } from '../firebase';
import { CoachAttempt, CoachCourse, CoachNote } from '../types';

// Firestore rejects `undefined`; a JSON round-trip drops those keys.
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function useCoachData(uid: string | undefined) {
  const [courses, setCourses] = useState<CoachCourse[]>([]);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [attempts, setAttempts] = useState<CoachAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const enabled = !!uid && uid !== 'guest_user';

  useEffect(() => {
    if (!enabled || !uid) {
      setCourses([]); setNotes([]); setAttempts([]); setLoading(false);
      return;
    }
    setLoading(true);
    const listen = <T,>(name: string, set: (v: T[]) => void, markLoaded = false) =>
      onSnapshot(
        collection(db, 'users', uid, name),
        (snap) => { set(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)); if (markLoaded) setLoading(false); },
        (err) => { console.error(`[coach] ${name} listener failed`, err); if (markLoaded) setLoading(false); }
      );
    const unsubs = [
      listen<CoachCourse>('coach_courses', setCourses, true),
      listen<CoachNote>('coach_notes', setNotes),
      listen<CoachAttempt>('coach_attempts', setAttempts)
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, enabled]);

  const saveCourse = useCallback(async (course: CoachCourse) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'coach_courses', course.id), clean({ ...course, userId: uid, updatedAt: new Date().toISOString() }));
  }, [uid]);

  const saveNote = useCallback(async (note: CoachNote) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'coach_notes', note.id), clean({ ...note, userId: uid }));
  }, [uid]);

  const saveAttempt = useCallback(async (attempt: CoachAttempt) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'coach_attempts', attempt.id), clean({ ...attempt, userId: uid }));
  }, [uid]);

  const deleteCourse = useCallback(async (courseId: string) => {
    if (!uid) return;
    await Promise.all([
      ...notes.filter((n) => n.courseId === courseId).map((n) => deleteDoc(doc(db, 'users', uid, 'coach_notes', n.id))),
      ...attempts.filter((a) => a.courseId === courseId).map((a) => deleteDoc(doc(db, 'users', uid, 'coach_attempts', a.id)))
    ]);
    await deleteDoc(doc(db, 'users', uid, 'coach_courses', courseId));
  }, [uid, notes, attempts]);

  // Saved on the user doc so the hourly Cloud Function can find opted-in users with one query.
  const saveEmailPrefs = useCallback(async (enabledPref: boolean, hour: number) => {
    const id = auth.currentUser?.uid;
    if (!id) return;
    await setDoc(doc(db, 'users', id), {
      coachEmail: { enabled: enabledPref, hour, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    }, { merge: true });
  }, []);

  return { courses, notes, attempts, loading, enabled, saveCourse, saveNote, saveAttempt, deleteCourse, saveEmailPrefs };
}

export type CoachData = ReturnType<typeof useCoachData>;
