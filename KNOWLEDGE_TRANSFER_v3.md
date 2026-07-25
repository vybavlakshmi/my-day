# Personal Operations System v2 — Knowledge Transfer v3
### For: the next chat / Claude Code session. Nothing spared. Read fully before building.

**Owner:** Vybes · Chennai · IST (Asia/Kolkata) · working on laptop.
**Where we are:** Frontend DONE. Backend NOT built. This doc hands off the backend build + Replit deploy.

---

## 0. HOW TO WORK WITH VYBES (carry these rules)
- Before every response: give **task → steps**, say **what running it does**, note **when ChatGPT/Gemini/Perplexity vs Claude** saves tokens (unbiased), offer a **lower-token alternative** if one exists. Then **ask before proceeding. Only proceed after approval.**
- Be **explicit about what IS and ISN'T possible** up front. No "actually that's not possible, here's an alternative" surprises.
- **Keep a running message count.** Notify at 15. At 13, list actionable items.
- **≤100 words per response** unless Vybes says "Word Count Override".
- Don't assume unstated facts; but connect what's already implied. Only ask when info is genuinely missing.

---

## 1. WHAT THIS PROJECT IS
An operations **manager** (not a passive dashboard). It assigns tasks, checks completion, judges excuses, and pushes back / reschedules / argues. Runs always-on so it can nudge Vybes throughout the day and at night.

---

## 2. ARCHITECTURE (LOCKED)
- **ONE Replit backend** (free tier), kept awake by **cron-job.org** pinging `/health` every 5 min. Manual Replit refresh every ~25 days.
- **Two surfaces:** Web Dashboard (primary — Emma speaks here) + Telegram bot (optional/deferred).
- **Reasoning brain: Groq API (Llama 3.3 70B).** Free tier, no card, ₹0. ~14k requests/day (never hit for personal use). **This REPLACES the earlier Gemini Flash decision — Vybes swapped to Groq for sharper reasoning + cleaner docs + speed.** Only task titles + excuses go to Groq — **NEVER health data.**
- **Voice out: Emma** = Edge TTS voice `en-US-EmmaNeural` (free, unlimited, laptop-side). Jenny `en-US-JennyNeural` is the backup toggle. Speaks on the **dashboard**, not inside Telegram.
- **Voice in:** handled by **Wispr Flow** on Vybes's mobile (already set up) → dictation becomes plain text into the input bar. **No Whisper build needed.**
- **Memory: all in Notion** (not Supabase). Manager checks Notion before acting. Includes an **Excuse Ledger**. Chosen because the whole stack already lives in Notion, human-readable, editable, zero migration, portable to any LLM.

---

## 3. FRONTEND — DONE ✅ (`index.html`, single file)
Already built and approved. Vybes has the file. Full spec so you can rebuild/extend without seeing it:

**Palette:** blue gradient `#1E7FFF → #7EB8FF`, white bg, ink `#1C2B36`, soft `#8FA3B0`, hairline `#EAF0F5`.
**Fonts:** ALL SANS — Inter (headings) + Poppins (body). Playfair REJECTED.
**Layout (top → bottom):**
- Top bar: centered "MY DAY". (Calendar chip + settings dots were tried and REJECTED — removed.)
- Status pill "Manager online" (blue dot pulse; flips to red "Manager offline" if `/health` fails). Currently the live-fetch is commented out — uncomment `checkHealth()` once backend is deployed.
- Date line (e.g. "SUNDAY, 5 JULY") — live, updates daily.
- Greeting: time-aware + name → "Good morning/afternoon/evening, Vybes." (client-side JS, zero token cost.)
- Three cards, each with a dotted source-tag:
  1. **"Day to day tasks"** (tag: daily) — renamed from "Protected".
  2. **"From Notion"** (tag: brain dump).
  3. **"Calendar"** (tag: today) — empty-state shows "Nothing scheduled."
- Tasks are **clickable** (tap toggles done — tick fills blue, strikethrough).
- **Emma = minimal gradient semicircle anchored at BOTTOM** (concentric subtle white arcs). On speak: gentle "breathe" scale + two blue ripples. **IMPORTANT: semicircle MUST stay bottom-anchored** — moving it to the top crops it into a square/arch. This was tried (orb, top-hero, mandala) and ALL rejected. Minimal bottom semicircle is the final, approved choice.
- Floating dock: up-arrow "back to top" button + input bar ("Tell me an excuse, or ask…") + sparkle send button.
- "▶ Preview Emma" demo button (top-right) triggers the speak animation for testing. Remove or keep as you like.

**Frontend hooks the backend must feed:**
- `renderList(elId, items)` — replace placeholder `DATA` with real API data for `protectedList`, `notionList`, `calendarList`. Each item: `{ title, done }`.
- `startSpeaking(ms)` — call when Emma begins talking; stop when audio ends.
- `checkHealth()` — uncomment; polls `/health`.
- Task click → must POST to backend to sync (see §5).

---

## 4. CADENCE ENGINE (already spec'd in v2 — keep as-is)
- TZ forced Asia/Kolkata.
- **DAILY (now labelled "Day to day tasks"):** Health, Caregiver, CAV, Mental Health — given each AM; carry forward if not given.
- **WEEKLY_ROTATING:** 7 slots. **MONTHLY:** 6 slots. Relationships → Calendar.
- **OBSERVE MODE:** first 7 days = observe-only, no pushback (calibration), driven by `START_DATE`.
- **Task sources (3):** protected tasks Vybes gives each morning + 3 from Notion Open Tasks Brain Dump + Google Calendar events.
- **CRON (all IST):** 23:30 buildNightBrief · 08:00 morningResync · every 2h abandonmentCheck · 09:00 nineAmCheck · Sunday 20:00 runWeeklyReview.
- **handleExcuse():** observe mode → just log. Else → Groq judges → logs to Excuse Ledger → reschedules (genuine) or contests (weak).
- Abandonment: one re-entry msg, then nudge every 2h till 12AM IST; 9AM next-day check.

---

## 5. BACKEND — TO BUILD (this is the job)
Node + Express. Files (src/):

- **server.js** — Express entry. Mounts `/health`, serves static `/public` (`app.use(express.static('public'))`), starts scheduler. Add the new endpoints below.
- **health.js** — `/health` returns `{status:'alive', ts}`.
- **groq.js** — NEW, replaces gemini.js. Two functions, mirror old signatures:
  - `judgeExcuse(task, excuse, ledger) -> {verdict:'genuine'|'weak', reply}`
  - `weeklyReview(log) -> 3 lines (what slipped / pattern / what to change)`
  - Model: Llama 3.3 70B via Groq. Only titles + excuses sent. NEVER health data.
- **notion.js** — `getOpenTasks(3)`, `logExcuse()`, `getLedgerSummary()`, `logTaskEvent()`, **PLUS new `markTaskDone(pageId, done)`** for two-way sync.
- **calendar.js** — `getTodayEvents()` from Google Calendar, TZ Asia/Kolkata, events → tasks.
- **cadence.js** — the manager brain (§4). Point all reasoning calls to groq.js.
- **emma.js** — NEW. Edge TTS wrapper. `speak(text) -> audio` using `en-US-EmmaNeural` (default) / `en-US-JennyNeural` (toggle). Free npm option: `msedge-tts` or `edge-tts` equivalent. Streams audio to dashboard.
- **package.json** — deps: express, node-cron, groq-sdk (or fetch), @notionhq/client, msedge-tts. start script.
- **.env.example** — `PORT, TZ, START_DATE, GROQ_API_KEY, NOTION_TOKEN, EXCUSE_LEDGER_DB, TASK_LOG_DB, GOOGLE_ACCESS_TOKEN`. (GEMINI_API_KEY removed.)

**NEW API endpoints the dashboard needs:**
- `GET /tasks` → `{ protected:[], notion:[], calendar:[] }` (feeds renderList).
- `POST /chat` → body `{text}`; runs Groq (+ Notion context) → returns `{reply}`; dashboard calls `startSpeaking()` + plays Emma audio.
- `POST /task/toggle` → body `{source, id, done}`; if `source==='notion'` call `markTaskDone(id, done)` to update the real Notion page. **Two-way sync ONLY applies to the "From Notion" card** — "Day to day tasks" and Calendar are not Notion pages and won't sync there. (Confirmed with Vybes.)
- `POST /speak` (optional) → `{text}` → Emma audio, for night brief etc.

---

## 6. NOTION IDs (hardcoded/known)
- **Open Tasks Brain Dump DB:** `37caa293-e5a2-8150-9e0f-f69e22a60b2d`
- Health Intelligence Dossier: `38caa293-e5a2-819b-a37f-e79bc9a6307c`
- Business Second Brain: `33caa293-e5a2-81d3-9ed5-f94ed135713f`
- Career Second Brain: `33baa293-e5a2-8162-bb5f-da480a55a46b`
- CAV 60-post grid: `eba3a5ab-f539-448f-8a65-b3138385353c`
(Excuse Ledger DB + Task Log DB IDs go in .env once created in Notion.)

---

## 7. GET THE FREE GROQ API KEY
1. Go to **console.groq.com** → sign in (Google, no card).
2. **API Keys → Create API Key** → copy it.
3. Paste into Replit **Secrets** as `GROQ_API_KEY`.
4. Model string to use: a current Llama 3.3 70B versatile model (verify exact name in Groq docs at build time — model IDs change).
5. Rate limits live on Groq's "rate limits" page — free tier is ample for one person.

---

## 8. CLAUDE CODE / REPLIT DEPLOY (laptop-only)
1. Open the project in **Claude Code** (best for this — edits files, runs terminal, deploys). A plain chat can't touch Replit.
2. Create/paste all src/ files + public/index.html into Replit.
3. Add **Secrets** (real keys/DB IDs) — never commit them.
4. Terminal: `npm install` then `npm start`.
5. **cron-job.org** → GET `https://<your-repl>/health` every 5 min (keep-alive).
6. **UptimeRobot** → dead-man's switch (alert on 24h silence).
7. Uncomment `checkHealth()` in index.html so the pill goes live.
8. Live-test: type in dashboard → Groq replies → Emma speaks → semicircle animates. Tick a "From Notion" task → confirm the Notion page updates.

---

## 9. OPEN / NOT BUILT (backlog)
1. Telegram bot module (deferred — dashboard is primary).
2. 25-day Replit refresh reminder mechanism.
3. Jarvis redesign extras: auto-categorize-on-input (Groq sorts a fired thought into protected domains + Open Tasks, logs to Notion, no manual entry); nightly journal → Groq summary → stored → pattern-training loop. All optional, post-MVP.

---

## 10. DECISIONS THAT ARE FINAL (do not re-litigate)
- Groq over Gemini. ✅
- Emma (Edge TTS) for voice out; Wispr Flow for voice in. ✅
- Notion as memory (not Supabase). ✅
- Minimal bottom-anchored semicircle for the frontend — NOT mandala, NOT orb, NOT top-hero. ✅
- Dashboard is the primary surface; Telegram deferred. ✅

**MVP definition (ship this first, iterate after):** deployed backend + `/tasks` feeding the three cards + `/chat` with Groq + Emma speaking on the dashboard + `/task/toggle` Notion sync. Everything else is backlog. Vybes's known pattern: plans outpace deployment — so DEPLOY THE BORING VERSION FIRST.
