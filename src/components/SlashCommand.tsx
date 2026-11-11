// Purpose: Notion-style "/" slash command extension and floating menu for the note editor (inspired by Novel)
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Extension, Editor, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import {
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, TextQuote, Terminal, Minus
} from 'lucide-react';

export interface SlashItem {
  title: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  run: (editor: Editor, range: Range) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  { title: 'Text', description: 'Plain paragraph', keywords: ['paragraph', 'p'], icon: Pilcrow,
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: 'Heading 1', description: 'Large section title', keywords: ['h1', 'title'], icon: Heading1,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', description: 'Medium section title', keywords: ['h2', 'subtitle'], icon: Heading2,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', description: 'Small section title', keywords: ['h3'], icon: Heading3,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { title: 'To-do list', description: 'Checklist with tick boxes', keywords: ['todo', 'task', 'check'], icon: ListChecks,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Bullet list', description: 'Simple bulleted list', keywords: ['ul', 'unordered'], icon: List,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', description: 'Ordered list', keywords: ['ol', 'ordered'], icon: ListOrdered,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'Quote', description: 'Highlight a passage', keywords: ['blockquote', 'cite'], icon: TextQuote,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', description: 'Monospaced code snippet', keywords: ['code', 'pre'], icon: Terminal,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', description: 'Horizontal line', keywords: ['hr', 'line', 'rule'], icon: Minus,
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

export interface SlashMenuState {
  items: SlashItem[];
  rect: DOMRect | null;
  index: number;
  select: (index: number) => void;
}

// Builds the "/" suggestion extension. The menu itself is rendered by React
// (<SlashMenu />) from the state this extension reports through onChange.
export function createSlashExtension(onChange: (state: SlashMenuState | null) => void) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: '/',
          allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
          items: ({ query }) => {
            const q = query.toLowerCase().trim();
            if (!q) return SLASH_ITEMS;
            return SLASH_ITEMS.filter(
              (i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q))
            );
          },
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let current: any = null;
            let index = 0;
            const push = () => {
              if (!current) return;
              onChange({
                items: current.items,
                rect: current.clientRect?.() ?? null,
                index,
                select: (i: number) => {
                  const item = current.items[i];
                  if (item) current.command(item);
                },
              });
            };
            return {
              onStart: (p) => { current = p; index = 0; push(); },
              onUpdate: (p) => { current = p; index = 0; push(); },
              onKeyDown: ({ event }) => {
                if (!current || current.items.length === 0) return false;
                const len = current.items.length;
                if (event.key === 'ArrowUp') { index = (index + len - 1) % len; push(); return true; }
                if (event.key === 'ArrowDown') { index = (index + 1) % len; push(); return true; }
                if (event.key === 'Enter') {
                  const item = current.items[index];
                  if (item) current.command(item);
                  return true;
                }
                if (event.key === 'Escape') { onChange(null); return true; }
                return false;
              },
              onExit: () => { current = null; onChange(null); },
            };
          },
        }),
      ];
    },
  });
}

// Floating list of block types shown while the user types "/".
export function SlashMenu({ state }: { state: SlashMenuState | null }) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state?.index]);

  if (!state || !state.rect || state.items.length === 0) return null;

  const MENU_W = 260;
  const left = Math.max(8, Math.min(state.rect.left, window.innerWidth - MENU_W - 8));
  const below = window.innerHeight - state.rect.bottom > 280;
  const style: React.CSSProperties = below
    ? { left, top: state.rect.bottom + 6, width: MENU_W }
    : { left, bottom: window.innerHeight - state.rect.top + 6, width: MENU_W };

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="fixed z-[60] max-h-64 overflow-y-auto surface-card p-1.5 flex flex-col gap-0.5"
      style={{ ...style, boxShadow: 'var(--shadow-lg)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) => {
        const Icon = item.icon;
        const active = i === state.index;
        return (
          <button
            key={item.title}
            ref={active ? activeRef : undefined}
            role="option"
            aria-selected={active}
            onClick={() => state.select(i)}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-colors ${active ? 'bg-ledger-slate-light' : 'hover:bg-ledger-slate-light'}`}
          >
            <span className="w-8 h-8 rounded-lg bg-ledger-slate-lighter flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-ledger-paper" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ledger-paper">{item.title}</span>
              <span className="block text-[11px] text-ledger-paper-dim truncate">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
