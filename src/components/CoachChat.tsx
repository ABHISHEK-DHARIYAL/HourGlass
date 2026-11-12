// Purpose: Q&A chatbot for follow-up questions, aware of the course and the current topic's notes.

import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { coachApi } from '../utils/coachApi';
import MarkdownRenderer from './MarkdownRenderer';

interface Msg { role: 'user' | 'model'; text: string }
interface Props { course: string; topicTitle?: string; notes?: string }

export default function CoachChat({ course, topicTitle, notes }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    const history = messages;
    setMessages([...history, { role: 'user', text: message }]);
    setInput(''); setError(''); setBusy(true);
    try {
      const { reply } = await coachApi.chat({ course, topicTitle, notes, history, message });
      setMessages((m) => [...m, { role: 'model', text: reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-panel flex flex-col h-[60vh] min-h-[360px]">
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-ledger-paper-dim">
            Ask anything about <b className="text-ledger-paper">{topicTitle || course}</b> — “explain it with an example”, “why does this matter?”, “quiz me on the hard part”.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'self-end bg-ledger-coral text-[#0a0c10]' : 'self-start bg-ledger-slate-light text-ledger-paper'}`}>
            {m.role === 'user' ? m.text : <MarkdownRenderer text={m.text} />}
          </div>
        ))}
        {busy && <Loader2 className="w-4 h-4 animate-spin text-ledger-paper-dim" aria-label="Thinking" />}
        {error && <p role="alert" className="text-xs text-ledger-danger">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="p-2.5 border-t border-ledger-line flex gap-2">
        <input className="input-base flex-1" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask a follow-up question…" aria-label="Ask the coach" maxLength={1500} />
        <button className="btn-primary" onClick={send} disabled={busy || !input.trim()} aria-label="Send"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
