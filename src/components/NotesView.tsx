// Purpose: Notes tab — searchable, taggable note list with pinned section, trash, and the rich-text editor pane
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pin, Trash2, StickyNote, X } from 'lucide-react';
import { Note } from '../types';
import type { NotePatch } from '../hooks/useNoteActions';
import NoteEditor from './NoteEditor';

interface NotesViewProps {
  notes: Note[];
  onCreate: (initial?: NotePatch) => Promise<string | null>;
  onUpdate: (id: string, patch: NotePatch) => Promise<void> | void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onEmptyTrash: () => void;
  requestedNoteId?: string | null;
  onRequestedNoteHandled?: () => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function NotesView({
  notes, onCreate, onUpdate, onTrash, onRestore, onDeleteForever, onEmptyTrash,
  requestedNoteId, onRequestedNoteHandled
}: NotesViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Open a note requested from outside (e.g. global search).
  useEffect(() => {
    if (!requestedNoteId) return;
    const target = notes.find(n => n.id === requestedNoteId);
    if (target) {
      setShowTrash(target.trashed);
      setSelectedId(target.id);
      onRequestedNoteHandled?.();
    }
  }, [requestedNoteId, notes]);

  const liveNotes = useMemo(() => notes.filter(n => !n.trashed), [notes]);
  const trashedNotes = useMemo(() => notes.filter(n => n.trashed), [notes]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    liveNotes.forEach(n => n.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [liveNotes]);

  // If the active tag disappears (last note using it was edited/trashed), clear the filter.
  useEffect(() => {
    if (activeTag && !allTags.some(([t]) => t === activeTag)) setActiveTag(null);
  }, [allTags, activeTag]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = showTrash ? trashedNotes : liveNotes;
    return pool
      .filter(n => (activeTag && !showTrash ? n.tags.includes(activeTag) : true))
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q) || n.tags.some(t => t.includes(q)))
      .sort((a, b) => {
        if (!showTrash && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [liveNotes, trashedNotes, query, activeTag, showTrash]);

  const selected = notes.find(n => n.id === selectedId) || null;

  // Drop the selection if the note vanished or moved between the list and trash.
  useEffect(() => {
    if (selected && selected.trashed !== showTrash) setSelectedId(null);
    if (selectedId && !selected) setSelectedId(null);
  }, [selected, selectedId, showTrash]);

  const handleNew = async () => {
    setShowTrash(false);
    setQuery('');
    const id = await onCreate(activeTag ? { tags: [activeTag] } : {});
    if (id) setSelectedId(id);
  };

  const renderRow = (n: Note) => {
    const isActive = n.id === selectedId;
    return (
      <li key={n.id}>
        <button
          onClick={() => setSelectedId(n.id)}
          aria-current={isActive}
          className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors cursor-pointer flex gap-2.5 ${isActive ? 'bg-ledger-slate-light border-ledger-coral/60' : 'border-transparent hover:bg-ledger-slate-light'}`}
        >
          <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: n.color || 'transparent' }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {n.pinned && <Pin className="w-3 h-3 text-ledger-coral shrink-0" aria-label="Pinned" />}
              <span className={`text-sm font-semibold truncate ${n.title ? 'text-ledger-paper' : 'text-ledger-paper-dim'}`}>{n.title || 'Untitled'}</span>
              <span className="ml-auto text-[10px] text-ledger-paper-dim shrink-0">{formatWhen(n.updatedAt)}</span>
            </span>
            <span className="block text-xs text-ledger-paper-dim truncate mt-0.5">{n.plainText.trim() ? n.plainText.slice(0, 120) : 'No content yet'}</span>
            {n.tags.length > 0 && (
              <span className="flex gap-1 mt-1.5 overflow-hidden">
                {n.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] text-ledger-paper-dim">#{t}</span>)}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  const pinned = visible.filter(n => n.pinned && !showTrash);
  const others = visible.filter(n => showTrash || !n.pinned);

  return (
    <div className="surface-card overflow-hidden flex h-[calc(100vh-190px)] min-h-[480px]">
      {/* List pane */}
      <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-ledger-line min-h-0`}>
        <div className="p-3 flex flex-col gap-2.5 border-b border-ledger-line">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ledger-paper mr-auto">{showTrash ? 'Trash' : 'Notes'}</h2>
            <button
              onClick={() => { setShowTrash(v => !v); setSelectedId(null); }}
              className={`btn-ghost !px-2.5 !py-1.5 text-xs ${showTrash ? '!text-ledger-coral' : ''}`}
              aria-pressed={showTrash}
            >
              <Trash2 className="w-3.5 h-3.5" /> {trashedNotes.length > 0 ? trashedNotes.length : ''}
              <span className="sr-only">Show trash</span>
            </button>
            {!showTrash && (
              <button onClick={handleNew} className="btn-primary !px-3 !py-1.5 text-xs">
                <Plus className="w-4 h-4" /> New note
              </button>
            )}
            {showTrash && trashedNotes.length > 0 && (
              <button
                onClick={() => { if (window.confirm(`Delete ${trashedNotes.length} note(s) forever?`)) onEmptyTrash(); }}
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                Empty trash
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-ledger-paper-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={showTrash ? 'Search trash' : 'Search notes'}
              aria-label="Search notes"
              className="input-base !pl-9 !py-2 text-xs"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ledger-paper-dim hover:text-ledger-paper cursor-pointer" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!showTrash && allTags.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
              {allTags.map(([t, count]) => (
                <button
                  key={t}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                  aria-pressed={activeTag === t}
                  className={`chip shrink-0 cursor-pointer transition-colors ${activeTag === t ? '!bg-ledger-coral !border-ledger-coral !text-[#0a0c10]' : 'hover:!text-ledger-paper'}`}
                >
                  #{t} <span className="opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3 text-ledger-paper-dim">
              <StickyNote className="w-8 h-8 opacity-50" />
              {showTrash ? (
                <p className="text-xs">Trash is empty. Deleted notes stay here until you remove them.</p>
              ) : query || activeTag ? (
                <p className="text-xs">No notes match. Try a different search or clear the tag filter.</p>
              ) : (
                <>
                  <p className="text-xs">No notes yet. Capture an idea, a plan, or a checklist.</p>
                  <button onClick={handleNew} className="btn-primary !py-2 text-xs"><Plus className="w-4 h-4" /> Write your first note</button>
                </>
              )}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold text-ledger-paper-dim">Pinned</p>
                  <ul className="flex flex-col gap-0.5 mb-2">{pinned.map(renderRow)}</ul>
                  {others.length > 0 && <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold text-ledger-paper-dim">Notes</p>}
                </>
              )}
              <ul className="flex flex-col gap-0.5">{others.map(renderRow)}</ul>
            </>
          )}
        </div>
      </aside>

      {/* Editor pane */}
      <section className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col min-h-0`}>
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onChange={onUpdate}
            onTrash={onTrash}
            onRestore={onRestore}
            onDeleteForever={onDeleteForever}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-ledger-paper-dim px-6">
            <StickyNote className="w-10 h-10 opacity-40" />
            <p className="text-sm">Select a note to read or edit it, or start a new one.</p>
          </div>
        )}
      </section>
    </div>
  );
}
