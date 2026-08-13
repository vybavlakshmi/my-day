# Personal Operations System — Knowledge Transfer v7
### Continues v6. START HERE, but not only here: `CLAUDE.md`'s new top section is now MANDATORY reading before any planning/scheduling/task-selection work — it explains why and links the documents. This doc covers what changed technically since v6, and what got discovered that changes the shape of the remaining work.

---

## 0. THE HEADLINE THING THAT CHANGED

Vybes has an extensive, structured personal + business planning system already built in Notion (Current Truth, Life Truth, The Map, dated milestone roadmaps, day-by-day phase plans) that **Maya has never been connected to**. This was discovered late in the previous session, after most of the Maya v2 spec's literal build order was already implemented. Real governing constraints were missed as a direct result (see §2 below). Vybes was direct about this: she wants a standing system so it can't happen again, not just a one-time fix. That system is now `CLAUDE.md`'s mandatory top section — **read it before doing anything else**, every session, not just this handoff.

Her own words on scope: **"everything matters for day to day nudging."** Don't triage her planning documents into "load-bearing" vs. "just reference" on your own judgment — if it's not `[ARCHIVED]`, treat it as relevant.

---

## 1. WHERE WE ARE (technical, everything since KT v6)

All of Maya v2's spec build order (§2-§9) is implemented and live at **https://my-day-lovat.vercel.app**. But per §0 above, "spec implemented" ≠ "done" — the life-plan integration is a real, still-open piece, bigger than anything in the original spec's own list.

### Bug fixes from live-use feedback (all verified live)
- **Voice output was completely broken** — root cause: `msedge-tts` was pinned to `^1.3.4`, which never implemented Microsoft's now-required `Sec-MS-GEC` security token for the TTS connection (confirmed via the package's own GitHub source — v2.0.7, released days before this was found, added it). Bumped to `^2.0.7`. NOT an IP-blocking issue — that was the first theory, explicitly ruled out before acting, per Vybes' own instruction not to guess.
- **Maya's replies weren't visible as text** — only ever spoken via audio, so a voice failure meant total silence. Fixed: replies always render as text immediately, independent of whether voice succeeds.
- **Vybes' own typed messages weren't shown anywhere** — different bug from the above, found in a follow-up round. Fixed as part of the frontend overhaul (see below) — the conversation thread now shows both sides.
- **Text-to-voice gap felt "glitched"** — real gap between text rendering and audio starting (network + synthesis time) had zero visual indication. Added a subtle `.preparing` pulse on the semicircle for that specific gap.
- **Dashboard showed "between windows"/empty every single day by default** — `getCurrentWindow()` returned `null` whenever nobody had told Maya that day's schedule yet via chat, which is every day until you proactively text her. Fixed: falls back to `DEFAULT_DAY_TEMPLATE` (Vybes' real routine) instead of returning nothing.
- **Focus-item completion didn't persist** — ticking something as done reverted on reload. Built real persistence: `POST /focus/toggle` logs to Task Log (`source: 'registry'`), `getFocusItems()` excludes anything done today before picking the top N — so completing one reveals the next (spec's "depth-one reveal"). Per-day only, doesn't yet respect weekly/monthly cadence (a weekly item marked done reappears tomorrow, not hidden all week).

### Focus surface now blends 3 sources, not just Item Registry
Real gap Vybes caught directly: `getFocusItems()` only ever pulled from Item Registry, despite Calendar and Notion open-tasks being fully wired in the backend already. Fixed with her confirmed priority order:
1. Calendar events happening now-ish (ongoing, or starting within the next hour) — highest priority, time-fixed
2. Item Registry, protected class
3. Item Registry, negotiable
4. Notion open tasks (brain dump) — lowest priority fill

`calendar.js`'s `getTodayEvents()` now returns `start`/`end` (was title-only). Toggle behavior branches by source: registry → Task Log persistence, notion → ticks the real Notion checkbox, calendar → visual-only (not something this app marks "done").

### Frontend rebuilt: conversation-first
Direct feedback: "I explained a lot of things far and wide and I get a single page list" — wanted something closer to Jarvis, where the conversation *is* the interface. The reasoning/intelligence was always in the chat backend; the UI just buried it behind dashboard cards. Rebuilt `public/index.html`:
- Scrollable conversation thread is now the primary surface — every exchange (both sides) appends as a message, not a single popup that gets replaced.
- Commitment strip + focus list condensed into small context chips above the thread — same functionality (parked tap-to-expand, focus tap-to-complete), demoted visually, not removed.
- Maya "opens" the conversation on load with a briefing composed client-side from already-fetched `/status` + `/focus` data (no extra API call).
- Backend untouched by this — presentation layer only.

**This still isn't necessarily "enough" Jarvis** — it's a step in the right direction per her direct approval ("This looks pretty good"), but the deeper gap (life-plan integration, proactive reasoning) is what §0/§2 are about.

---

## 2. LIFE-PLAN INTEGRATION — the actual next major body of work

**Read `CLAUDE.md`'s mandatory section first** — it has the document list, IDs, and the specific Life Truth rules already confirmed. Summarized pointer here, not duplicated:

- **Life Truth** — read in full. Highest authority on personal capacity/health/caregiving. Key unbuilt rules: **3 things/day max during treatment**, a **360-analysis capacity check** before assigning anything (energy, timing, current load, sustainability — "when in doubt, don't assign it"), no community/social-commitment tasks during treatment.
- **Current Truth** — NOT yet read. Highest authority on business/TVC. Do this first next session.
- **The Map, TVC Milestone Roadmap, Award Strategy Roadmap, Phase 1 — Zoomed In (Aug 1-31 day-by-day)** — found, mostly not yet read/processed. Likely source for the milestone bar (currently stubbed to always show the static "MY DAY" title) and for reconciling Day Schedule's `DEFAULT_DAY_TEMPLATE` against her actual current routine, which she says has changed since it was built.
- Archived documents (e.g. "[ARCHIVED] The Roadmap") exclude automatically — don't read these as instruction, historical context only.

**What "integration" concretely means, not yet designed:** how milestones from these documents actually surface in Maya day-to-day (the milestone bar is one channel; whether/how they should also inform `getFocusItems()`'s selection, or trigger their own nudges, is undecided). Don't guess this alone — it's exactly the kind of scope decision that caused the original miss. Confirm approach with Vybes before building.

---

## 3. ALL NOTION DATABASES (unchanged from v6, still current)
```
OPEN_TASKS_PAGE_ID=37caa293-e5a2-8150-9e0f-f69e22a60b2d
EXCUSE_LEDGER_DB=72381ab4-b6d2-4dad-821e-8166527c4570
TASK_LOG_DB=4c0a4c5a-0fe2-47bb-8393-605d1674adc6
ACTIVE_COMMITMENT_DB=c8adb156-a560-447b-bf9f-036f05abf0ba
PARKED_THREADS_DB=d50e4f60-f97c-4cbd-af1d-208673a2c5c6
COMMITMENT_HISTORY_DB=57a5d84b-3229-43e7-842d-7353768a9dda
ITEM_REGISTRY_DB=8d54f25c-02d2-4a77-a569-089bf86bda29
DAY_SCHEDULE_DB=55873184-08db-4e66-88af-5fd90f02d1f4
GROCERY_LIST_DB=0ad55bcf-47a7-416b-aded-69a43f7d82e1
ELEGANCE_RDF_DB=4ada7ff5-6b61-4a23-923b-2ca5b7526be2
CREATIVE_WANTS_DB=cf9c3b01-f835-4da1-8bc9-21e16c64f573
PROJECTS_BUILDS_DB=e583186f-3ac5-4085-8a61-0465698038e1
```
Every one needs manual connection to "My Day Manager" + a matching Vercel env var before it's live — this has been the single most repeated setup step all project. `TASK_LOG_DB`'s schema was extended (not replaced): `Source` gained `registry`/`commitment` options, new `Detail` rich-text field.

---

## 4. NEXT STEPS, IN ORDER
1. Read `CLAUDE.md`'s mandatory section, then **Current Truth** in full (not yet done).
2. Read The Map, TVC Milestone Roadmap, Award Strategy Roadmap, Phase 1 — Zoomed In.
3. Confirm with Vybes: how should milestones/life-plan content actually surface day-to-day? (Milestone bar only? Feed into focus selection? Trigger separate nudges?) Don't design this alone.
4. Build the Life Truth capacity rules into `getFocusItems()`: 3/day cap, 360-analysis check.
5. Everything else in `NEEDS_INPUT.md` and `MAYA_V3_IDEAS.md` — check both, still current.
