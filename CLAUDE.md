# Maya — project constraints

## ⚠️ MANDATORY — DO THIS BEFORE ANY PLANNING, BUILDING, OR TASK-SUGGESTION WORK

A full session's worth of Maya v2 work was built without knowing Vybes has an extensive, structured personal + business planning system already living in Notion. Real governing constraints (see below) were missed as a direct result — this is not a hypothetical risk, it already happened once. This section exists so it cannot happen again. Do not skip it because the session "seems like" a small task — you don't know that until you've checked.

**Every session that touches planning, scheduling, task-selection, or milestone logic must, before doing anything else:**
1. Search Notion for Vybes' governing documents (search terms like "Current Truth", "Life Truth", "roadmap", "the map", plus whatever the specific task touches). Do not assume the list below is complete or current — it's a starting point, not the final word.
2. Read **Life Truth** and **Current Truth** in full (see IDs below) — these are the two highest-authority documents (personal/capacity and business/TVC respectively). Neither overrides the other; they answer different questions.
3. Follow their references to whatever they name as currently active (e.g. "The Map", dated milestone roadmaps, day-by-day phase plans) and read those too before making planning/scheduling decisions.
4. **Automatically exclude anything titled or tagged `[ARCHIVED]`** — explicitly superseded, kept only as historical context, never treated as instruction.
5. Re-check for updates every session — Life Truth's own rule is "update when life changes, not on a schedule," meaning these documents can go stale between sessions without warning. Don't assume what you read last time still holds.
6. Per Vybes directly: **"everything matters for day to day nudging"** — do not sort documents into "load-bearing" vs. "just reference" on your own judgment. If it's not archived, treat it as relevant until you have a specific reason not to.

### Known authoritative documents (last full pass 2026-08-13 — verify these still exist and re-read for changes, don't trust this list blindly next session)
- **Life Truth** (`36daa293-e5a2-8142-a10d-e80b15da6ba4`) — highest authority on personal capacity/health/caregiving. Read in full. Last edited 2026-07-19 (checked 2026-08-13, unchanged since last read — no drift).
- **Current Truth** (`372aa293-e5a2-813b-958f-c5c3f50874e2`) — highest authority on TVC/business. **Read in full 2026-08-13.** Last edited 2026-08-09. Key point: the Custom AI Build product line was killed in full July 2026 (competence gap); MOO is now PARKED (not killed, no fixed launch date); **The 90-Day Journey** (Day 1 = 1 Sept 2026, fixed) is the new flagship. Full extract in `KNOWLEDGE_TRANSFER_v8.md`.
- **The Map — 2026 → 2028+** (`39faa293-e5a2-81cf-a486-cebd8d0fac18`) — multi-year 7-track phased plan. **Read in full 2026-08-13.** Last edited 2026-08-09 — already reconciled with Current Truth's MOO-parked/Journey-flagship pivot (struck through the old 31-July product-sentence non-negotiable with a note pointing at the new status). This page is the actual source of truth for Phase 1's current state, not Phase 1 — Zoomed In below.
- **TVC Milestone Roadmap — 2026 → 2031** (`3a3aa293-e5a2-81c9-a148-da5a3f96c8d8`) — dated milestones pulled from The Map. **Read in full 2026-08-13.** Last edited 2026-07-29 — pre-dates the MOO-parked pivot, treat its Aug/Sept business dates as secondary to The Map.
- **Award Strategy Roadmap — Vybav (2026–2031)** (`34baa293-e5a2-81cd-82e8-e1fdf2f7d549`) — **Read in full 2026-08-13.** Last edited 2026-04-23 (oldest of the set) — 5-year award-entry strategy (IDMA → Effie → Webby tracks), not business-execution-date-sensitive so staleness matters less here.
- **Phase 1 — Zoomed In** (`3a3aa293-e5a2-8129-863a-de0c35e936bf`) — "August 1–31, day by day." **Read in full 2026-08-13.** Last edited 2026-08-01, **now stale**: its day-by-day plan for Aug 10–31 is built entirely around MOO's now-dead 25 Aug launch. Its own text says "if this and Phase 1 [in The Map] disagree, Phase 1 wins" — so The Map governs, this page needs a pass to catch up (logged for Vybes in `FOR_VYBES_REVIEW.md`, not done by Claude — Notion is read-only this session). Do not use this page's Aug 10+ specifics without cross-checking The Map first.
- **Known ARCHIVED, exclude:** "[ARCHIVED] The Roadmap" (`3a0aa293-e5a2-8105-a0c3-d90a81554b74`).
- **Other docs surfaced but not read in full (seen only via search, 2026-08-13):** "Patch documents" (referenced by Current Truth's authority hierarchy as where future initiatives live — not yet located/enumerated), "Historical Archive" (`372aa293-e5a2-815d-b82c-f91c5f48943a`, explicitly not a source of truth), "TVC Studio" (`3a0aa293-e5a2-8112-a8e2-ecec95e4c8b3`, parent hub for TVC execution docs), "Business Project Second Brain v2" (`33caa293-e5a2-81d3-9ed5-f94ed135713f`). Worth a look next session if the task touches business execution docs specifically.

### Rules from Life Truth already confirmed, status as of 2026-08-13
- **Three things a day max during treatment.** **Partially built 2026-08-13** — `getFocusItems()` now caps distinct Negotiable-class items (registry + notion) introduced per day at 3 (`DAILY_DISCRETIONARY_CAP` in `src/cadence.js`), tracked via a new Task Log 'surfaced' status. Calendar events and Protected registry items are exempt. **Held for Vybes' review, not yet pushed/deployed** — see `FOR_VYBES_REVIEW.md`.
- **360 analysis before assigning anything:** energy cost, timing, current load, whether she can actually sustain it. "When in doubt, don't assign it." **Still NOT built** — the cap above is the countable half of this rule; the qualitative energy/sustainability judgment needs real reasoning (likely a Groq call, similar to `planDay()`), deliberately not faked with an unverified heuristic. Open work.
- **No community/networking/social-commitment tasks during the treatment period.** Still not built — `getFocusItems()` doesn't currently filter registry items by this criterion at all (Item Registry's `Domain` field is empty on all 62 rows as of 2026-08-13, so domain-based filtering isn't wired to any data yet regardless).
- Context: Mom has Stage 3 anorectal cancer + Type 2 diabetes, active chemoradiation Mon–Fri at Kauvery. Vybes is sole caregiver, unemployed since May 31 2026 (no income floor). This is why the capacity rules above are non-negotiable, not stylistic preferences.

---

Full spec: `Maya_v2_Build_Spec.md`. Full technical history: `KNOWLEDGE_TRANSFER_v5.md` → `v6` → `v7` → `v8` (read the latest first, it supersedes earlier ones on anything they disagree about). Read all before making architectural changes. This file is the fast-reference summary so none of them need re-reading in full every session.

## What Maya is

A prioritization/timing/focus-enforcement engine, not a task dashboard. Core loop: hold one active commitment, catch drift, park tangents warmly, redirect — never nag, never guilt, never flatly refuse. See spec §0.

## Architecture (locked, reuse — don't rebuild)

- **Hosting:** Vercel serverless. `api/index.js` re-exports `src/app.js` (the real Express app + routes). `src/server.js` is local-dev-only (`app.listen()`), not used in production. `vercel.json` rewrites `/health`, `/tasks`, `/chat`, `/task/toggle`, `/speak` to the function; static `public/` served directly by Vercel.
- **Reasoning:** Groq, `llama-3.3-70b-versatile`, via `src/groq.js`. Only task titles/excuses/messages go to Groq — never health data.
- **Memory:** Notion, via `src/notion.js` (`@notionhq/client`). Every new database must be manually connected to the "My Day Manager" integration (Notion → "..." → Connections) before the app's `NOTION_TOKEN` can see it — this has been the single most repeated setup mistake.
- **Voice:** `src/maya.js`, Edge TTS (`msedge-tts`). Voice keys are `maya`→`en-US-EmmaNeural` / `jenny`→`en-US-JennyNeural`. The Microsoft voice model name itself can't be renamed.
- **Calendar:** `src/calendar.js`, Google OAuth refresh-token flow (not a raw access token — those expire hourly). Read-only.
- **Manager brain:** `src/cadence.js` — routes `/chat` messages: direction-seeking phrases first → commitment classification → schedule_update/grocery_add/other → excuse detection → plain chat, in that order. See "Known gotchas" below for why this order matters.

## Corrections vs. the written spec (the spec is not fully authoritative — these were found wrong in practice)

- **§1's static day table is wrong.** Real schedule shifts day to day (hospital timing, unplanned naps, lunches out). Built as a *dynamic replan* instead: `groq.planDay()` takes the current plan (or `DEFAULT_DAY_TEMPLATE`, which mirrors Vybes' actual ~37-window routine, not the spec's rough table) plus a plain-language update, and re-works remaining windows. Stored in Notion "Day Schedule" DB, one row per calendar day.
- **Window-fit naming mismatch:** Day Schedule uses lowercase_snake (`movement`, `seated_screen`, ...); Item Registry (Vybes' own real database) uses Capitalized-Hyphenated (`Movement`, `Seated-screen`, ...) plus `Any`, and is multi-select not single-select. Mapped explicitly via `WINDOW_FIT_MAP` in `cadence.js` — don't assume these match as strings anywhere new code touches both.
- **Dates: always compute via `Asia/Kolkata`, never `toISOString()`** (that's UTC — wrong for 00:00-05:30 IST, which is still "yesterday" in UTC). `notion.js`'s `todayISO()` is the one correct helper; route all date-stamping through it.
- **Notion checkbox writes use `{ checkbox: true/false }`** via `@notionhq/client` — NOT the `__YES__`/`__NO__` convention (that's specific to a different Notion tool's abstraction, not the real API).

## Known gotchas / architecture notes

- **Classification ordering matters.** `classifyCommitment` (Groq) runs on nearly every message and will misclassify open-ended questions like "what should I do now" as a `new_commitment` if given the chance — it gets forced into one of its known intents. Direction-seeking phrase detection (`isDirectionSeeking`) MUST run *before* calling `classifyCommitment`, not after, or it gets swallowed.
- **Endpoints (current):** `GET /health`, `GET /tasks`, `GET /status`, `GET /parked`, `GET /focus`, `POST /focus/toggle`, `POST /task/toggle`, `POST /chat`, `POST /speak`. Frontend (`public/index.html`) is conversation-first as of the latest session — a scrollable message thread is the primary surface, with commitment/parked/focus state condensed into small chips above it, not full cards. `getFocusItems()` blends Calendar (highest priority, "now-ish" events) + Item Registry (protected before negotiable) + Notion open tasks (lowest priority) — do not assume it's Item-Registry-only, that was an earlier, since-fixed gap.
- **§8 app-launching is architecturally in conflict with the hosting choice** — Vercel serverless has no access to Vybes' local filesystem or ability to launch local apps on her laptop. Needs a different mechanism (e.g. local companion process) not yet designed. See `NEEDS_INPUT.md`.
- **Write-tiering (§5):** inform-only (grocery, notes/ideas) vs. confirm-first (finance, calendar changes) — confirm-first currently has no real target since no finance-logging or calendar-write feature exists yet. All current writes are correctly inform-only.
- **Deploys lag unpredictably** — anywhere from under a minute to 10+ minutes, and static HTML changes can additionally be stuck in browser/CDN cache even after the server has the fresh file (confirmed via direct `fetch(url, {cache:'no-store'})` returning new content while a `navigate()`'d tab still showed old — that's tab cache, not deploy lag; a cache-busting query param or hard reload fixes it). Don't conclude "broken" from one quick check.

## Build order status (update as sections complete)

- [x] Infra + Vercel deploy
- [x] §2 Commitment-Keeper
- [x] §3 Item Registry (real data, Vybes' own richer schema)
- [x] §4 Timing Engine (Day Schedule + item-selection) — blends Calendar + Registry + Notion now (see above). Falls back to `DEFAULT_DAY_TEMPLATE` when no day-specific plan exists. 3/day cap built (DAILY_DISCRETIONARY_CAP). 360 analysis built (2026-08-18): suggestFocus sends time/load/milestone context to Groq for capacity assessment; after 9pm only Protected items shown. 1am hard cutoff enforced in code (getCurrentWindow returns null 01:00–04:59). "Already done" dedup for registry items IS built (Task Log-backed, survives reload).
- [x] §5 Write-tiering (grocery list as the concrete example)
- [x] §6 Learning Loop (behavioral logging built; hard-adaptation deferred, needs real usage data)
- [x] §7 remaining Notion sources (Elegance/RDF, Creative Wants, Projects/Builds built; Roadmap/Relationship-map/life-plan turned out to already exist in far more developed form than the spec implied — see mandatory section at top of this file, this supersedes the original NEEDS_INPUT.md framing of "needs Vybes' input")
- [x] §8 App-launching logged as architecturally blocked (see NEEDS_INPUT.md) — NOT built, needs a decision first
- [x] §9 Frontend — rebuilt conversation-first per direct feedback ("felt like a dumb dashboard, not an assistant"). Commitment strip + focus list condensed to chips, conversation thread is now primary, Maya opens with a composed briefing on load.

Spec's literal build order (§2-§9) is implemented. §7 closed (2026-08-18): The Map is as deep as it goes, per Vybes — no further integration needed. §8 parked: app-launching is architecturally blocked on Vercel serverless, needs a local companion process, not building. **Carry-forward chat flow built (2026-08-18):** detects unfinished tasks, proposes Zoomed In edits, requires user confirmation before writing. See `FOR_VYBES_REVIEW.md` Session 4 for details.

## Testing pattern

Local Node.js is not available on this machine — all testing happens live: push → GitHub → Vercel auto-deploy → verify via Browser tool `fetch()` calls to the live endpoints → cross-check the actual Notion write via the Notion MCP tools (never trust the chat reply text alone, it can be right even when the underlying write is wrong, or vice versa).
