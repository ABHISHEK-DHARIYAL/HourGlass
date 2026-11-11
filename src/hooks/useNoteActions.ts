// Purpose: CRUD actions for notes (create, autosave update, pin, tag, trash, restore, delete forever) with guest-mode and offline-queue support
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from 'react';
import { Note } from '../types';
import { queueOfflineWrite } from '../utils/offlineSyncManager';

interface UseNoteActionsProps {
  user: { uid: string } | null;
  notes: Note[];
  setNotes: (updater: Note[] | ((prev: Note[]) => Note[])) => void;
  saveGuestNotes: (list: Note[]) => void;
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'plainText' | 'tags' | 'pinned' | 'color' | 'trashed' | 'trashedAt' | 'linkedTaskId'>>;

// Returns stable handlers for note persistence. Guest users write to
// localStorage/IndexedDB through saveGuestNotes; signed-in users update
// React state immediately and queue the Firestore write through the same
// offline-first sync queue used by tasks and todos.
export function useNoteActions({ user, notes, setNotes, saveGuestNotes }: UseNoteActionsProps) {
  // Always read the latest list so debounced autosaves never write a stale snapshot.
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;

  const uid = user?.uid;

  const persist = useCallback(async (note: Note) => {
    if (!uid) return;
    if (uid === 'guest_user') {
      const exists = notesRef.current.some(n => n.id === note.id);
      const next = exists
        ? notesRef.current.map(n => (n.id === note.id ? note : n))
        : [...notesRef.current, note];
      notesRef.current = next;
      saveGuestNotes(next);
      return;
    }
    setNotes(prev => (prev.some(n => n.id === note.id) ? prev.map(n => (n.id === note.id ? note : n)) : [...prev, note]));
    notesRef.current = notesRef.current.some(n => n.id === note.id)
      ? notesRef.current.map(n => (n.id === note.id ? note : n))
      : [...notesRef.current, note];
    try {
      await queueOfflineWrite(uid, 'notes', note.id, 'set', note);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, [uid, setNotes, saveGuestNotes]);

  // Creates an empty note and returns its id so the UI can open it.
  const handleCreateNote = useCallback(async (initial: NotePatch = {}): Promise<string | null> => {
    if (!uid) return null;
    const now = new Date().toISOString();
    const id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const note: Note = {
      id,
      userId: uid,
      title: '',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      plainText: '',
      tags: [],
      pinned: false,
      trashed: false,
      createdAt: now,
      updatedAt: now,
      ...initial,
    };
    await persist(note);
    return id;
  }, [uid, persist]);

  // Applies a partial update to an existing note (used by autosave and toolbar toggles).
  const handleUpdateNote = useCallback(async (id: string, patch: NotePatch) => {
    if (!uid) return;
    const existing = notesRef.current.find(n => n.id === id);
    if (!existing) return;
    const clean = Object.entries(patch).reduce((acc, [k, v]) => {
      if (v !== undefined) (acc as any)[k] = v;
      return acc;
    }, {} as NotePatch);
    await persist({ ...existing, ...clean, userId: uid, updatedAt: new Date().toISOString() });
  }, [uid, persist]);

  const handleTrashNote = useCallback((id: string) =>
    handleUpdateNote(id, { trashed: true, trashedAt: new Date().toISOString(), pinned: false }), [handleUpdateNote]);

  const handleRestoreNote = useCallback(async (id: string) => {
    if (!uid) return;
    const existing = notesRef.current.find(n => n.id === id);
    if (!existing) return;
    const { trashedAt, ...rest } = existing;
    await persist({ ...rest, trashed: false, userId: uid, updatedAt: new Date().toISOString() });
  }, [uid, persist]);

  const handleDeleteNoteForever = useCallback(async (id: string) => {
    if (!uid) return;
    if (uid === 'guest_user') {
      const next = notesRef.current.filter(n => n.id !== id);
      notesRef.current = next;
      saveGuestNotes(next);
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== id));
    notesRef.current = notesRef.current.filter(n => n.id !== id);
    try {
      await queueOfflineWrite(uid, 'notes', id, 'delete');
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }, [uid, setNotes, saveGuestNotes]);

  const handleEmptyTrash = useCallback(async () => {
    const trashed = notesRef.current.filter(n => n.trashed);
    for (const n of trashed) {
      await handleDeleteNoteForever(n.id);
    }
  }, [handleDeleteNoteForever]);

  return {
    handleCreateNote,
    handleUpdateNote,
    handleTrashNote,
    handleRestoreNote,
    handleDeleteNoteForever,
    handleEmptyTrash,
  };
}
