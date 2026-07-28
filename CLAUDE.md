# Maya — project constraints

Full spec: `Maya_v2_Build_Spec.md`. Full technical history: `KNOWLEDGE_TRANSFER_v5.md`. Read both before making architectural changes. This file is the fast-reference summary so neither needs re-reading in full every session.

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
- **`GET /tasks`, `POST /chat`, `POST /task/toggle`, `POST /speak`, `GET /health`** are the only endpoints so far. Frontend (`public/index.html`) is still v1's 3-fixed-card layout — §9 (adaptive surface, commitment strip, milestone bar) not yet built as of this file's creation.
- **§8 app-launching is architecturally in conflict with the hosting choice** — Vercel serverless has no access to Vybes' local filesystem or ability to launch local apps on her laptop. Needs a different mechanism (e.g. local companion process) not yet designed. See `NEEDS_INPUT.md`.
- **Write-tiering (§5):** inform-only (grocery, notes/ideas) vs. confirm-first (finance, calendar changes) — confirm-first currently has no real target since no finance-logging or calendar-write feature exists yet. All current writes are correctly inform-only.

## Build order status (update as sections complete)

- [x] Infra + Vercel deploy
- [x] §2 Commitment-Keeper
- [x] §3 Item Registry (real data, Vybes' own richer schema)
- [x] §4 Timing Engine (Day Schedule + item-selection) — 2 known deferred edges: "already done recently" dedup not built, 1am cutoff not reliably enforced when *now* is already past it
- [x] §5 Write-tiering (grocery list as the concrete example)
- [ ] §6 Learning Loop
- [ ] §7 remaining Notion sources
- [ ] §8 App-launching (blocked — see above)
- [ ] §9 Frontend adaptive surface

## Testing pattern

Local Node.js is not available on this machine — all testing happens live: push → GitHub → Vercel auto-deploy → verify via Browser tool `fetch()` calls to the live endpoints → cross-check the actual Notion write via the Notion MCP tools (never trust the chat reply text alone, it can be right even when the underlying write is wrong, or vice versa).
