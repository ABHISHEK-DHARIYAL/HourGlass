## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `FireBase API` in [.env.local](.env.local)
3. Run the app:
   `npm run dev`

---

## 🎓 AI Coach (new)

Tab **AI Coach** → enter a topic → get a Beginner → Intermediate → Advanced roadmap, per-topic notes,
5-question scored quizzes, a Q&A chatbot, and a daily study schedule you can push to the HourGlass planner,
Google Calendar (with email reminders) and your inbox.

**Architecture:** React tab → `/api/coach/*` (Firebase Hosting rewrite) → Cloud Function `coachApi` → Gemini.
The browser sends a Firebase ID token; the Gemini key never leaves the backend.

### Frontend env (`.env`, project root)
| Variable | Needed? | Purpose |
|---|---|---|
| `VITE_FIREBASE_*` | already required | existing Firebase config |
| `VITE_GOOGLE_CLIENT_ID` | optional | "Add to Google Calendar" (Web OAuth client ID) |

### Backend env (`functions/.env`, copy from `functions/.env.example`)
| Variable | Needed? | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | **required** | from https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | optional | default `gemini-3.8-flash`; change to any current model id |
| `COACH_DAILY_LIMIT` | optional | AI calls per user per day (default 80) |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | optional | email schedule + daily digest (Gmail: App Password) |

### Run locally
```bash
npm install && (cd functions && npm install --legacy-peer-deps)
cp functions/.env.example functions/.env      # add GEMINI_API_KEY
firebase emulators:start                      # terminal 1 (needs `cd functions && npm run build` first)
npm run dev                                   # terminal 2 — /api is proxied to the emulator
```
Deploy: `npm run build && firebase deploy`.

### Google Calendar setup (optional)
1. Google Cloud Console → enable **Google Calendar API** (same project as Firebase).
2. OAuth consent screen → add yourself as a test user.
3. Credentials → OAuth client ID → *Web application* → add `http://localhost:5173` and your hosted URL under **Authorized JavaScript origins**.
4. Put the client ID in `VITE_GOOGLE_CLIENT_ID`.
