// Purpose: Thin Gemini REST client (no SDK needed). The API key lives ONLY in the
// backend env (functions/.env -> GEMINI_API_KEY) and is never sent to the browser.

import { HttpError } from './http';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface GenerateOptions {
  system: string;
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generate({ system, messages, json = false, temperature = 0.7 }: GenerateOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY is not set in functions/.env on the backend.');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: 'application/json' } : {})
    }
  };

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });
    lastStatus = res.status;
    if (res.ok) {
      const data: any = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim();
      if (!text) throw new HttpError(502, 'The AI returned an empty answer. Please try again.');
      return text;
    }
    if (res.status === 429 || res.status === 503) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    const detail = await res.text().catch(() => '');
    throw new HttpError(502, `Gemini request failed (${res.status}). ${detail.slice(0, 200)}`);
  }
  throw new HttpError(
    lastStatus === 429 ? 429 : 503,
    lastStatus === 429 ? 'Gemini rate limit hit. Wait a minute and try again.' : 'Gemini is busy. Please try again.'
  );
}

// Parses JSON even if the model wrapped it in ```json fences.
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new HttpError(502, 'The AI returned malformed data. Please try again.');
  }
}
