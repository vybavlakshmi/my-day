# Personal Operations System — Knowledge Transfer v5
### Continues v4. Pivoted from "My Day" v1 to Maya v2 (see `Maya_v2_Build_Spec.md`). Infra done, deployed to Vercel (not Replit — v4 is stale on this point). Commitment-Keeper and Item Registry built and live. Day Schedule (dynamic replanning) is designed below but NOT YET BUILT — read §3 before writing any code for it.

---

## 0. WHERE WE ARE
- **Hosting:** Vercel, not Replit — v4's Replit-deploy plan was superseded before it was ever executed. Live at **https://my-day-lovat.vercel.app**. GitHub repo: `vybavlakshmi/my-day` (private), auto-deploys on push to `master`.
- **Backend architecture:** Express app split into `src/app.js` (routes, exported) + `src/server.js` (tiny local-dev-only listener) + `api/index.js` (Vercel's actual entry point, just re-exports `app.js`) + `vercel.json` (rewrites `/health`, `/tasks`, `/chat`, `/task/toggle`, `/speak` to the function; static `index.html` served directly by Vercel from `public/`).
- **Voice:** renamed Emma → Maya throughout (`src/emma.js` → `src/maya.js`). The underlying Microsoft TTS voice model is still literally `en-US-EmmaNeural` — that's Microsoft's own name, can't be changed, only our label for it.
- **Commitment-Keeper (Maya v2 §2):** built, deployed, tested live end-to-end (new_commitment / drift / conscious_switch / completion all confirmed writing correctly to Notion). This is the current MVP core.
- **Item Registry (Maya v2 §3):** built and **populated by Vybes with ~60 real items** across health/caregiving/career/creative/relationships. Uses Vybes' own richer schema (see §2 below), not the placeholder schema originally built — the placeholder was deleted.
- **Day Schedule / Timing Engine (Maya v2 §4):** NOT YET BUILT. Design finalized, see §3 of this doc. This is the next thing to build.
- **Local testing:** still not possible — Node.js is not installed on Vybes' laptop. All testing happens live on Vercel via direct `/chat` calls or the dashboard.

---

## 1. CORRECTION TO THE MAYA v2 BUILD SPEC ITSELF (important — §1 of `Maya_v2_Build_Spec.md` is wrong)

The build spec's §1 "the real day" table is a **fixed schedule** (hospital always 10-12, etc.). This does not match reality. Confirmed directly by Vybes:
- Hospital timing varies day to day (e.g. 10-12 one day, 11-2 the next).
- Other things shift it too: lunch at a relative's house cuts into the morning cook window; an unplanned long nap after hospital eats into dinner-prep time.
- **This is not a "give one anchor in the morning, derive the rest" problem.** Vybes will be nudging Maya with small updates *throughout the day* ("napped for hours," "lunch at uncle's"), and Maya needs to replan the *remaining* windows each time, continuously — not compute a fixed derivation once.

Do not implement §4's window logic against the static §1 table as written. Build the dynamic Day Schedule described in §3 below instead.

---

## 2. FILES BUILT (all under `myday/`, current as of this doc)
- `package.json` — deps: express, dotenv, groq-sdk, @notionhq/client, googleapis, msedge-tts. `engines.node >=18` pinned for Vercel.
- `.env.example` — template of every env var name needed, with real (non-secret) Notion DB/page IDs filled in where known.
- `.gitignore` — `node_modules/`, `.env`, `.vercel/`.
- `vercel.json` — rewrites the 5 API routes to `api/index.js`; static files served by Vercel automatically.
- `api/index.js` — `module.exports = require('../src/app')`. Vercel's entry point.
- `src/app.js` — the actual Express app + all routes (moved out of `server.js`).
- `src/server.js` — local-dev-only: `require('./app')` + `app.listen()`.
- `src/health.js` — `GET /health` heartbeat.
- `src/groq.js` — `judgeExcuse(task, excuse, ledger)`, `weeklyReview(log)`, `chatReply(text, tasksSummary)`, `classifyCommitment(activeCommitment, message)` (the Commitment-Keeper classifier: returns `{intent, extracted, reply}`, intent is one of new_commitment/continuation/drift/conscious_switch/completion/other). Model: `llama-3.3-70b-versatile`.
- `src/notion.js` — Open Tasks (`getOpenTasks`, `markTaskDone`), Excuse Ledger (`logExcuse`, `getLedgerSummary`), Task Log (`logTaskEvent`), Commitment-Keeper (`getActiveCommitment`, `setActiveCommitment`, `clearActiveCommitment`, `addParkedThread`, `getParkedThreads`, `updateParkedThreadStatus`, `closeCommitment`), Item Registry (`getItemRegistry`, matches Vybes' real schema — see below).
- `src/maya.js` — `speak(text, voice)` via `msedge-tts`. Voice keys are `maya` (→ `en-US-EmmaNeural`) / `jenny` (→ `en-US-JennyNeural`).
- `src/calendar.js` — `getTodayEvents()`, OAuth2 refresh-token flow, Asia/Kolkata.
- `src/cadence.js` — `getAllTasks()`, `handleChat(text)`. `handleChat` now routes through `classifyCommitment` FIRST; only the `'other'` intent falls through to the old excuse/plain-chat logic.
- `public/index.html` — unchanged since v4 (frontend adaptive surface is Maya v2 §9, explicitly last in the build order — not started).

### Item Registry's real schema (Vybes' own, richer than what was first built)
Database: `Item Registry` (ID below). Properties:
- `Title` (title)
- `Class` — select: `Protected` / `Negotiable` (capitalized — differs from the Commitment-Keeper's lowercase convention, don't normalize, just match it)
- `Cadence` — select: `Daily` / `Weekly` / `Fortnightly` / `Monthly` / `Ad hoc`
- `Domain` — select: Caregiving / Health / CAV-TVC / Career / Finance / Fashion-Elegance / Household / Creative / Relationships / Mental Health / Personal Admin / Learning
- `Status` — select: `Active` / `Paused` / `Dropped`
- `Notes` — rich text, often empty
- `Window-fit` — **multi_select** (not single-select): `Movement` / `Seated-screen` / `Seated-thinking` / `Hands-busy-voice` / `Laptop-execution` / `Any`. Some rows have no Window-fit set at all (e.g. "Sleep by ~1am").

`notion.js`'s `getItemRegistry()` already matches this exact schema — read it before assuming a simpler shape.

---

## 3. DAY SCHEDULE — DESIGN (confirmed with Vybes, not yet built)

**Problem:** Maya needs to know "what kind of window is it right now" to pick relevant Item Registry entries (by `Window-fit`). The day's actual structure is not fixed and gets nudged by Vybes throughout the day via plain chat messages.

**Architecture:**
1. **New Notion DB: "Day Schedule"** — a singleton (like Active Commitment), holding:
   - `Date` (date) — which day this plan is for. If it doesn't match today, treat as stale/no plan yet.
   - `Plan` (rich text) — the day's remaining windows as **structured JSON**: an array of `{name, start (HH:MM), end (HH:MM), windowFit}`. Must be machine-parseable, not prose, since the Timing Engine needs to compute "which window contains right-now."
   - Not yet created in Notion — create this DB before writing `notion.js` functions for it.

2. **Default template** (used to seed a fresh day, derived loosely from the old static §1 table, but only as a *starting point* — not authoritative): wake 6:30, cook/feed 6:30-9:00, cab-to-hospital 9:15-9:40, hospital 10:00-12:00, cab-home 12:30-1:00, settle 1:00-4:30, nap-fork ~4:30, fragile hour 6:30-7:30, dinner prep 7:30-9:30, own dinner 9:30-11:30 (protected), cleanup 11:30-12:30, midnight desk 12:30-2:00.

3. **`groq.js`: new function `planDay(existingPlanJson, updateMessage, currentTime)`** → returns `{plan: [...new windows...], reply: "confirmation in Maya's voice"}`. Given the current plan (or the default template if none exists yet today) plus Vybes' natural-language update ("napped for hours," "lunch at uncle's cut morning cooking short"), re-works the *remaining* windows for the rest of today. This is a reasoning call, not a formula — expect iteration, likely more than the drift classifier since it's judging real time budgets from vague input.

4. **`notion.js`: `getDayPlan()` / `setDayPlan(planJson)`** — read/write the singleton, same pattern as Active Commitment.

5. **`cadence.js`: schedule-update detection** — needs a way to tell "this message is a schedule update" apart from a commitment/excuse/plain-chat message. Not yet designed in detail — figure out ordering against the existing `classifyCommitment` call when building this (probably needs its own classification pass, or an extra intent value).

6. **`getCurrentWindow()` helper** — reads today's plan, finds which window contains the current time (Asia/Kolkata), returns its `windowFit`. This is what the actual item-selection logic (picking 1-2 Item Registry entries) will filter on. Item-selection logic itself is not yet designed in detail.

**Explicitly deferred within this feature** (per Maya v2 §4, discussed and confirmed still deferred): the hospital-window "reserve for one highest-leverage thinking task + it decides tonight's midnight item" special rule, and the 4:30pm nap-fork tradeoff prompt. Build the general dynamic-replanning + window-fit-filtering version first.

---

## 4. NOTION DATABASE IDs (real, current)
```
OPEN_TASKS_PAGE_ID=37caa293-e5a2-8150-9e0f-f69e22a60b2d
EXCUSE_LEDGER_DB=72381ab4-b6d2-4dad-821e-8166527c4570
TASK_LOG_DB=4c0a4c5a-0fe2-47bb-8393-605d1674adc6
ACTIVE_COMMITMENT_DB=c8adb156-a560-447b-bf9f-036f05abf0ba
PARKED_THREADS_DB=d50e4f60-f97c-4cbd-af1d-208673a2c5c6
COMMITMENT_HISTORY_DB=57a5d84b-3229-43e7-842d-7353768a9dda
ITEM_REGISTRY_DB=8d54f25c-02d2-4a77-a569-089bf86bda29   # Vybes' real registry, not the placeholder
```
`DAY_SCHEDULE_DB` — not created yet, will be added here once built.

All of the above (plus `GROQ_API_KEY`, `NOTION_TOKEN`, the 3 Google Calendar values, `TZ`, `PORT`) are set as **Vercel Environment Variables** (Production scope) — not in any committed file. `.env.example` has the same names as a template for local `.env` testing, with the non-secret DB IDs filled in for convenience.

**Recurring gotcha:** every new Notion database created for this project needs to be manually connected to the "My Day Manager" integration (Notion page/DB → "..." → Connections) before the app's `NOTION_TOKEN` can see it. Easy to forget — caused two separate debugging sessions already (Open Tasks page originally, then each Commitment-Keeper DB, then Item Registry).

---

## 5. NEXT STEPS
1. Build the Day Schedule feature per §3 above.
2. Then design + build the actual item-selection logic (pick 1-2 Item Registry entries for the current window, respecting Class/Status/cadence-dedup via Task Log) — this is the rest of Maya v2 §4, not yet designed in detail.
3. Continue down the Maya v2 build order: §5 write-tiering, §6 learning loop, §7 remaining Notion sources, §8 app-launching, §9 frontend adaptive surface.

---

## 6. BACKLOG (confirmed not building — from both v1 and Maya v2 §10)
- Telegram bot
- Full v1 cadence/cron engine (night brief, abandonment nudges, 9am check, weekly review, observe mode) — Maya v2 explicitly doesn't need to be always-on, request/response only.
- 25-day Replit refresh reminder — moot, not on Replit.
- Auto-categorize-on-input, nightly journal → summary, desktop pet.
- Anything not explicitly in the Maya v2 spec — goes in a "Maya v3" Notion doc per the spec's own instruction, not built speculatively here.
