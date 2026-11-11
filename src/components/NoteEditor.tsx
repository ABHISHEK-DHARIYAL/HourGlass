// Purpose: Rich-text note editor (Tiptap) with title, tags, pin/color/trash controls, slash menu, bubble toolbar and debounced autosave
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import {
  ArrowLeft, Pin, PinOff, Trash2, RotateCcw, Download, X, Bold, Italic,
  Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon, Highlighter, Tag
} from 'lucide-react';
import { Note } from '../types';
import type { NotePatch } from '../hooks/useNoteActions';
import { createSlashExtension, SlashMenu, SlashMenuState } from './SlashCommand';

export const NOTE_COLORS = ['#ff6a49', '#eab74e', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];

interface NoteEditorProps {
  note: Note;
  onChange: (id: string, patch: NotePatch) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onBack: () => void;
}

// Editor for a single note. Rendered with key={note.id} by the parent, so
// switching notes remounts it with fresh state.
export default function NoteEditor({ note, onChange, onTrash, onRestore, onDeleteForever, onBack }: NoteEditorProps) {
  const readOnly = note.trashed;
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [slash, setSlash] = useState<SlashMenuState | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // ---- Debounced autosave -------------------------------------------------
  const pending = useRef<NotePatch | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (pending.current) {
      const patch = pending.current;
      pending.current = null;
      onChangeRef.current(note.id, patch);
      setStatus('saved');
    }
  }, [note.id]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const queueSave = useCallback((patch: NotePatch) => {
    pending.current = { ...(pending.current || {}), ...patch };
    setStatus('saving');
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), 700);
  }, []);

  // Save anything pending when the editor closes, the tab hides, or the page unloads.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushRef.current(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      flushRef.current();
    };
  }, []);

  // ---- Editor ---------------------------------------------------------------
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : "Write something, or type '/' for blocks"),
      includeChildren: true,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
    Underline,
    Highlight,
    CharacterCount,
    Markdown.configure({ html: false, tightLists: true, linkify: true, transformPastedText: true }),
    createSlashExtension(setSlash),
  ], []);

  const editor = useEditor({
    extensions,
    content: note.content,
    editable: !readOnly,
    editorProps: { attributes: { class: 'hg-prose', 'aria-label': 'Note body' } },
    onCreate: ({ editor }) => setWordCount(editor.storage.characterCount.words()),
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount.words());
      queueSave({ content: editor.getJSON(), plainText: editor.getText({ blockSeparator: ' ' }) });
    },
  }, [note.id]);

  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  // Focus the title of a brand-new, empty note so typing can start right away.
  const titleRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!readOnly && !note.title && !note.plainText) titleRef.current?.focus();
  }, []);

  // ---- Toolbar helpers ------------------------------------------------------
  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link address', prev || 'https://');
    if (url === null) return;
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    const safe = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
  };

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').toLowerCase();
    if (!t || note.tags.includes(t)) { setTagDraft(''); return; }
    flush();
    onChange(note.id, { tags: [...note.tags, t] });
    setTagDraft('');
  };

  const exportMarkdown = () => {
    if (!editor) return;
    const md = `# ${title || 'Untitled'}\n\n${(editor.storage as any).markdown.getMarkdown()}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'note').replace(/[^\w\- ]+/g, '').trim() || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bubbleBtn = (active: boolean) =>
    `w-8 h-8 inline-flex items-center justify-center rounded-lg cursor-pointer transition-colors ${active ? 'bg-ledger-coral text-[#0a0c10]' : 'text-ledger-paper hover:bg-ledger-slate-lighter'}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 border-b border-ledger-line">
        <button onClick={() => { flush(); onBack(); }} className="btn-icon md:hidden" aria-label="Back to notes">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-[11px] text-ledger-paper-dim font-medium" aria-live="polite">
          {readOnly ? 'In trash' : status === 'saving' ? 'Saving…' : 'Saved'}
        </span>
        <span className="text-[11px] text-ledger-paper-dim ml-1 hidden sm:inline">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {readOnly ? (
            <>
              <button onClick={() => onRestore(note.id)} className="btn-secondary !py-1.5 !px-3 text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Restore
              </button>
              <button
                onClick={() => { if (window.confirm('Delete this note forever? This cannot be undone.')) onDeleteForever(note.id); }}
                className="btn-ghost !py-1.5 !px-3 text-xs !text-ledger-danger"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete forever
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { flush(); onChange(note.id, { pinned: !note.pinned }); }}
                className="btn-icon" aria-label={note.pinned ? 'Unpin note' : 'Pin note'} aria-pressed={note.pinned}
              >
                {note.pinned ? <PinOff className="w-4 h-4 text-ledger-coral" /> : <Pin className="w-4 h-4" />}
              </button>
              <button onClick={exportMarkdown} className="btn-icon" aria-label="Export as Markdown">
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => { flush(); onTrash(note.id); }}
                className="btn-icon hover:!text-ledger-danger" aria-label="Move to trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrolling document */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <input
            ref={titleRef}
            value={title}
            readOnly={readOnly}
            onChange={(e) => { setTitle(e.target.value); queueSave({ title: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start'); } }}
            placeholder="Untitled"
            aria-label="Note title"
            className="w-full bg-transparent outline-none text-2xl sm:text-3xl font-bold text-ledger-paper placeholder-ledger-paper-dim/40"
          />

          {/* Tags + color */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 mb-5">
            {note.tags.map((t) => (
              <span key={t} className="chip">
                #{t}
                {!readOnly && (
                  <button
                    onClick={() => { flush(); onChange(note.id, { tags: note.tags.filter(x => x !== t) }); }}
                    aria-label={`Remove tag ${t}`} className="cursor-pointer hover:text-ledger-danger"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <label className="chip !bg-transparent focus-within:!border-ledger-coral">
                <Tag className="w-3 h-3" />
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); }
                    if (e.key === 'Backspace' && !tagDraft && note.tags.length) {
                      flush(); onChange(note.id, { tags: note.tags.slice(0, -1) });
                    }
                  }}
                  onBlur={() => tagDraft && addTag(tagDraft)}
                  placeholder="Add tag"
                  aria-label="Add tag"
                  className="bg-transparent outline-none w-20 text-[11px] text-ledger-paper placeholder-ledger-paper-dim/60"
                />
              </label>
            )}
            {!readOnly && (
              <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Note color">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { flush(); onChange(note.id, { color: note.color === c ? '' : c }); }}
                    aria-label={`Color ${c}`} aria-pressed={note.color === c}
                    className="w-4 h-4 rounded-full cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: c, boxShadow: note.color === c ? `0 0 0 2px var(--color-ledger-slate), 0 0 0 4px ${c}` : undefined }}
                  />
                ))}
              </div>
            )}
          </div>

          {editor && !readOnly && (
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 120, maxWidth: 'none' }}
              shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock')}
              className="surface-card !rounded-xl flex items-center gap-0.5 p-1"
            >
              <button className={bubbleBtn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline"><UnderlineIcon className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()} aria-label="Highlight"><Highlighter className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()} aria-label="Inline code"><Code className="w-4 h-4" /></button>
              <button className={bubbleBtn(editor.isActive('link'))} onClick={setLink} aria-label="Link"><LinkIcon className="w-4 h-4" /></button>
            </BubbleMenu>
          )}

          <EditorContent editor={editor} />
        </div>
      </div>

      <SlashMenu state={slash} />
    </div>
  );
}
