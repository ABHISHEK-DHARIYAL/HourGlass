# Deploying Hourglass on Firebase (Cloud Functions + Hosting)

This replaces the old Railway/Express backend. Notifications, account
deletion, and the other API routes now run as Cloud Functions, and the
built frontend is served by Firebase Hosting.

## 1. Blaze plan (required)

Cloud Functions — including the scheduled reminder check — only run on
Firebase's **Blaze (pay-as-you-go)** plan. The free Spark plan cannot run
Cloud Functions or Cloud Scheduler at all.

- Check: Firebase Console → your project → bottom-left plan badge.
- Upgrade: Firebase Console → ⚙️ Project settings → Usage and billing →
  "Modify plan" → Blaze. You'll attach a billing account (a Google Cloud
  Billing account, which needs a card on file).
- Cost reality for an app this size: Cloud Functions has a permanent free
  tier (2M invocations/month, 400K GB-seconds/month, etc.). A once-a-minute
  scheduled function is ~43,200 invocations/month — comfortably inside the
  free tier on its own. You'd only see real charges from heavy Firestore
  reads/writes or FCM volume far beyond a personal app's usage. There's no
  extra "Cloud Scheduler" line item either — the first 3 scheduler jobs per
  project are free, and this app uses exactly 1.

## 2. One-time setup

```bash
npm install -g firebase-tools   # if not already installed
firebase login
```

From the project root:

```bash
firebase use hourglass-fadb8    # confirms the project alias in .firebaserc
```

Install dependencies in both places (they're separate npm projects):

```bash
npm install              # root — frontend
cd functions && npm install && cd ..   # functions — Cloud Functions
```

## 3. Local testing (recommended before every deploy)

Terminal 1:
```bash
firebase emulators:start
```
This serves Hosting on :5000, Functions on :5001, and a local Firestore/Auth
emulator, all wired together the same way production will be.

Terminal 2 (optional, for frontend hot-reload while iterating on UI):
```bash
npm run dev
```
`vite.config.ts` proxies `/api/*` from the Vite dev server to the Hosting
emulator on :5000, so `/api/quote`, `/api/delete-account`, etc. all work
during `npm run dev` too — as long as the emulators are running.

## 4. Deploy

```bash
npm run deploy
```
This runs `vite build` then `firebase deploy` (Hosting + Functions + the
existing Firestore rules). Or deploy pieces individually:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only functions:scheduledNotifications
```

## 5. Verify after deploying

- Open the Hosting URL Firebase prints (or your custom domain) — the app
  should load exactly as before.
- Firebase Console → Functions: confirm `quote`, `debugLog`,
  `smartReminders`, `syncTasks`, `notificationSettings`, `clearFcmToken`,
  `deleteAccount`, and `scheduledNotifications` all show as deployed and
  healthy.
- Firebase Console → Functions → `scheduledNotifications` → check it's
  been triggering every minute with no errors.
- Sign in, enable notifications, create a task starting in ~16 minutes,
  and confirm the 15/10/5-minute and start-time pushes arrive.
- Delete a test account and confirm the same checklist you already used to
  verify account deletion (Firestore docs gone, Auth user gone, redirected
  to login).
- `firebase functions:log` (or Cloud Logging) to see the `debugLog`
  output that used to go to `debug-logs.txt`.

## What changed vs. what didn't

**Changed:**
- Where the backend runs (Cloud Functions instead of a Railway container)
- How Admin SDK credentials are supplied (automatic in Cloud Functions —
  no more `FIREBASE_SERVICE_ACCOUNT_BASE64` env var to manage)
- How notification de-duplication persists (a small `notifiedKeys` map on
  each user's Firestore doc, instead of an in-memory Set) — necessary
  because scheduled Cloud Function invocations aren't guaranteed to reuse
  the same process
- Where debug logs go (Cloud Logging instead of a local file)
- `/api/quote` now sources quotes from the [Quotable API](https://github.com/lukepeavey/quotable)
  (api.quotable.io) instead of the fixed 30-quote local list. The local
  list is kept only as an offline fallback if Quotable is unreachable, so
  `/api/quote` never hard-fails. The daily (non-random) quote is cached in
  a new `system/dailyQuote` Firestore document so every user sees the same
  quote on a given day and Quotable is only called once per day, not once
  per page load. The response shape the frontend expects
  (`{ text, author }`) is unchanged — Quotable's own `content` field is
  mapped to `text` inside the function.

**Unchanged:**
- Every `/api/...` URL the frontend calls
- The reminder timing rules (15/10/5-minute and exact-start-time, morning/
  evening summaries, quiet hours)
- Firestore collection names, document shapes, and security rules
- Firebase Authentication, Firestore, and FCM client-side code
- Account deletion behavior and the collections it clears
- Everything in `src/` (no frontend code was touched for this migration)
