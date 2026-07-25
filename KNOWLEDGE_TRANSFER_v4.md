# Personal Operations System — Knowledge Transfer v4
### Continues v3. Backend is built. Google Calendar OAuth setup is in progress (stuck point documented below). Replit deploy not started.

---

## 0. WHERE WE ARE
- **Frontend:** done, unchanged in spirit from v3 — `public/index.html` (moved from project root into a `public/` folder so `server.js` can serve it).
- **Backend:** all 9 files built — see §2.
- **Groq API key:** obtained, saved privately by Vybes (not in any file).
- **Notion integration:** created ("My Day Manager"), connected to all 3 required items.
- **Google Calendar OAuth:** in progress — blocked on `redirect_uri_mismatch`, fix in motion. See §4.
- **Replit deploy:** not started — everything below is prep for that last step.

---

## 1. CORRECTIONS VS v3 (the code deviates from the original doc in these specific ways — read before touching notion.js or calendar.js)

- **"Open Tasks — Brain Dump" is a regular Notion PAGE with checkbox to-do blocks, NOT a database.** (v3 assumed a database.) `notion.js` reads/writes it via the Notion **Blocks API** (`blocks.children.list` / `blocks.update`), not `databases.query`. `getOpenTasks(3)` returns the first 3 unchecked top-level checkboxes on that page. `markTaskDone(blockId, done)` ticks the real checkbox.
- **Excuse Ledger and Task Log ARE real databases** — schemas confirmed directly from Notion, no guessing:
  - Excuse Ledger: `Task`(title), `Excuse`(text), `Reply`(text), `Verdict`(select: genuine/weak), `Logged`(created_time, read-only)
  - Task Log: `Task`(title), `Date`(date), `Source`(select: protected/notion/calendar), `Status`(select: given/done/missed/rescheduled), `Logged`(created_time, read-only)
- **Google Calendar uses a refresh-token OAuth flow**, not the single `GOOGLE_ACCESS_TOKEN` v3 mentioned — access tokens expire hourly, useless for an always-on server. Env vars are `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`.
- The Google Cloud OAuth consent screen must be **Published** (not left in "Testing"), or the refresh token expires every 7 days. "Unverified app" warning is expected and fine to click through for personal use.
- `groq.js` has a **third function**, `chatReply(text, tasksSummary)`, beyond v3's original two (`judgeExcuse`, `weeklyReview`) — added so `/chat` can answer plain questions ("what's left today?") without forcing everything through excuse-judgment.
- **The full cadence/cron engine from v3 §4 is NOT built** (night brief, abandonment nudges, 9am check, Sunday weekly review, observe mode). Per v3's own MVP line ("everything else is backlog"), only `/tasks`, `/chat`, Maya speaking, and `/task/toggle` Notion sync were built. `node-cron` was removed from `package.json` since nothing uses it yet.
- **"Day to day tasks" (protected) is a hardcoded static list** for now: Health block, Caregiver check-in, CAV — one post, Mental health / wind-down. No morning-resync automation.
- **`/chat` routing logic (in `cadence.js`):** if the message mentions a real task title AND contains excuse-flavored words (sorry, missed, forgot, busy, didn't, etc.) → goes through `judgeExcuse`, gets logged to Excuse Ledger + Task Log. Otherwise → goes through `chatReply` for a plain conversational answer, nothing logged. This is simple keyword matching, not full NLU.
- `getAllTasks()` uses `Promise.allSettled`, not `Promise.all` — if Google Calendar isn't connected or fails, Notion + protected cards still load; Calendar card just shows "Nothing scheduled."

---

## 2. FILES BUILT (all under `myday/`)
- `package.json` — deps: express, dotenv, groq-sdk, @notionhq/client, googleapis, msedge-tts
- `.env.example` — template of every secret name needed (see §3)
- `src/health.js` — `GET /health` heartbeat, `{status:'alive', ts}`
- `src/groq.js` — `judgeExcuse(task, excuse, ledger)`, `weeklyReview(log)`, `chatReply(text, tasksSummary)`. Model: `llama-3.3-70b-versatile`.
- `src/notion.js` — `getOpenTasks(3)`, `markTaskDone(blockId, done)`, `logExcuse()`, `getLedgerSummary()`, `logTaskEvent()`
- `src/calendar.js` — `getTodayEvents()`, OAuth2 refresh-token flow, today only, Asia/Kolkata
- `src/maya.js` (was `emma.js` — renamed when the assistant's persona was renamed Emma → Maya) — `speak(text, voice)` via `msedge-tts`. Voice model is still Microsoft's `en-US-EmmaNeural` (their name, can't be renamed) / `en-US-JennyNeural` toggle, streams webm/opus audio, no files saved to disk
- `src/cadence.js` — `getAllTasks()`, `handleChat(text)` — the manager brain tying groq/notion/calendar together
- `src/server.js` — Express entry: serves `public/`, mounts `/health`, `GET /tasks`, `POST /chat`, `POST /task/toggle`, `POST /speak`
- `public/index.html` — moved from project root; now fetches real `/tasks` on load, POSTs task toggles (Notion source only), POSTs `/chat` then `/speak` and plays real audio, polls `/health` every 60s

---

## 3. SECRETS CHECKLIST (names from `.env.example` — real values go in Replit Secrets only, never committed)
```
PORT=3000
TZ=Asia/Kolkata
START_DATE=2026-07-05
GROQ_API_KEY=              # obtained, saved privately by Vybes
NOTION_TOKEN=               # obtained, integration "My Day Manager" connected to all 3 items below
OPEN_TASKS_PAGE_ID=37caa293-e5a2-8150-9e0f-f69e22a60b2d
EXCUSE_LEDGER_DB=72381ab4-b6d2-4dad-821e-8166527c4570
TASK_LOG_DB=4c0a4c5a-0fe2-47bb-8393-605d1674adc6
GOOGLE_CLIENT_ID=           # in progress — see §4, use the Web application client
GOOGLE_CLIENT_SECRET=       # in progress — same Web application client
GOOGLE_REFRESH_TOKEN=       # blocked on §4
GOOGLE_CALENDAR_ID=primary
```

---

## 4. WHERE WE GOT STUCK — Google Calendar OAuth
1. Created a Google Cloud project, enabled the Calendar API, configured + **Published** the OAuth consent screen (User type: External — the only option on a personal Gmail; "Internal" needs Google Workspace. Scope: `.../auth/calendar.readonly`).
2. Adding a test user failed ("ineligible") — sidestepped by publishing directly (test users are only relevant pre-publish anyway).
3. First OAuth client was created as type **Desktop app** — this type does not support a custom redirect URI, which caused `Error 400: redirect_uri_mismatch` when authorizing via Google's OAuth Playground (`developers.google.com/oauthplayground`).
4. **Fix in progress:** create a SECOND OAuth client, type **Web application**, with Authorized redirect URI set to exactly `https://developers.google.com/oauthplayground`. Use THIS client's ID/Secret in the Playground's "Use your own OAuth credentials" setting, retry Authorize APIs → Allow → Exchange authorization code for tokens → copy the Refresh Token.
5. Once obtained: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` = the **Web application** client's values (not the Desktop app one — that one can be deleted, it's unused).

---

## 5. NEXT STEPS (in order)
1. Finish the Google Calendar refresh token (§4).
2. Deploy to Replit: create a Node.js Repl, import everything under `myday/` (skip `node_modules` — Replit installs fresh), add all §3 secrets as Replit Secrets, run `npm install` then `npm start`.
3. **cron-job.org** → GET `https://<your-repl-url>/health` every 5 min (keep-alive so Replit's free tier doesn't sleep).
4. **UptimeRobot** → dead-man's switch, alert if `/health` goes silent for 24h.
5. Live test: dashboard loads real tasks → type a message → Groq replies → Maya speaks → tick a "From Notion" task → confirm the real Notion checkbox ticked.

---

## 6. BACKLOG (confirmed NOT built, per v3's own MVP scope — do not re-litigate without Vybes' say-so)
- Telegram bot
- Full cadence/cron engine: night brief, abandonment nudges, 9am check, Sunday weekly review, observe mode
- 25-day Replit refresh reminder mechanism
- Auto-categorize-on-input, nightly journal → Groq summary, desktop pet (v2, post-30-days-of-v1-usage)
