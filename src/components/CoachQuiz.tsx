// Purpose: Topic quiz — AI generates questions, the student answers, gets a score and explanations.

import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { CoachQuizQuestion } from '../types';
import { coachApi } from '../utils/coachApi';

interface Props {
  course: string;
  topicTitle: string;
  onScored: (score: number, total: number) => void;
}

export default function CoachQuiz({ course, topicTitle, onScored }: Props) {
  const [questions, setQuestions] = useState<CoachQuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true); setError(''); setSubmitted(false);
    try {
      const { questions: qs } = await coachApi.quiz(course, topicTitle, 5);
      setQuestions(qs);
      setAnswers(qs.map(() => null));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const score = questions ? questions.reduce((n, q, i) => n + (answers[i] === q.answerIndex ? 1 : 0), 0) : 0;

  const submit = () => {
    if (!questions) return;
    setSubmitted(true);
    onScored(score, questions.length);
  };

  if (!questions) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button className="btn-primary" onClick={start} disabled={busy}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing quiz…</> : 'Take a 5-question quiz'}
        </button>
        {error && <p role="alert" className="text-xs text-ledger-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="surface-panel p-3.5">
          <legend className="sr-only">Question {qi + 1}</legend>
          <p className="text-sm font-semibold text-ledger-paper mb-2.5">{qi + 1}. {q.question}</p>
          <div className="flex flex-col gap-1.5">
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const correct = submitted && oi === q.answerIndex;
              const wrong = submitted && picked && oi !== q.answerIndex;
              return (
                <button key={oi} type="button" disabled={submitted}
                  onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                  aria-pressed={picked}
                  className={`text-left text-sm rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                    correct ? 'border-ledger-success text-ledger-success' : wrong ? 'border-ledger-danger text-ledger-danger' : picked ? 'border-ledger-coral text-ledger-paper' : 'border-ledger-line text-ledger-paper-dim hover:text-ledger-paper'}`}>
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && (
            <p className="text-xs text-ledger-paper-dim mt-2 flex gap-1.5">
              {answers[qi] === q.answerIndex ? <CheckCircle2 className="w-4 h-4 text-ledger-success shrink-0" /> : <XCircle className="w-4 h-4 text-ledger-danger shrink-0" />}
              <span>{q.explanation}</span>
            </p>
          )}
        </fieldset>
      ))}

      {submitted ? (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-bold text-ledger-paper">
            Score: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%) —{' '}
            <span className={score / questions.length >= 0.7 ? 'text-ledger-success' : 'text-ledger-gold'}>
              {score / questions.length >= 0.7 ? 'Topic passed!' : 'Review the notes and retry'}
            </span>
          </p>
          <button className="btn-secondary" onClick={start} disabled={busy}><RotateCcw className="w-4 h-4" /> New quiz</button>
        </div>
      ) : (
        <button className="btn-primary self-start" onClick={submit} disabled={answers.some((a) => a === null)}>Submit answers</button>
      )}
    </div>
  );
}
