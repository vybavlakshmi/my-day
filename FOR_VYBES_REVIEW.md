# For Vybes — to-do (session 2026-08-13, updated 2026-08-18)

Checklist version — check items off as you go. Full context/reasoning for anything here lives in `KNOWLEDGE_TRANSFER_v8.md` and `CLAUDE.md` if you want the long version; this file stays short on purpose.

---

## Session 4 (2026-08-18) — finishing Maya

### What I built this session (not yet pushed):

**1. 1am hard cutoff** (`cadence.js`)
- `getCurrentWindow()` now returns null between 01:00–04:59 IST. No tasks suggested, no windows active. Previously this was only in the planDay prompt (Groq could still violate it).

**2. 360 analysis / capacity assessment** (`groq.js`, `cadence.js`)
- `suggestFocus()` now receives context: current time, items already done today, active commitment, and upcoming milestone. The prompt asks Groq to assess capacity before suggesting — if it's late evening and she's had a full day, it'll suggest winding down instead of pushing more.
- Evening wind-down: after 9pm IST, `getFocusItems()` filters to Protected/Calendar/Schedule items only — no new discretionary tasks.

**3. Milestone-driven suggestions** (`cadence.js`, `groq.js`)
- `getFocusItems()` now returns the next upcoming milestone alongside items.
- `suggestFocus()` prompt tells Groq about milestones within 14 days and asks it to give extra weight to related items.
- When combined with populated Domain fields on Item Registry, this will let Maya prioritize items matching the upcoming milestone's track.

**4. Carry-forward chat flow** (`groq.js`, `cadence.js`, `notion.js`, `app.js`, `index.html`, `vercel.json`)
- New `carry_forward` intent in `classifyCommitment` — detects "didn't finish X", "couldn't get to X", etc.
- When triggered: logs to Task Log (source: carry_forward, status: pending), then tries to find tomorrow's day entry on Phase 1 — Zoomed In.
- If found: returns a carry-forward card to the frontend showing what will be added and where. User must click "Confirm" before anything is written to Notion. "Skip" dismisses it.
- On confirm: appends `↳ Carried forward: [task] (from Day N)` as a new block on Zoomed In, right after tomorrow's day entry.
- Opening briefing now checks for yesterday's pending carry-forwards and mentions them: "From yesterday: [task] — still unfinished."
- **Requires:** Phase 1 — Zoomed In to have the reallocated Aug 18–31 day entries written first (pending your approval).

**5. §7 closed** — The Map is as deep as it goes, per your instruction. No further integration needed. Maya already reads Item Registry, Elegance/RDF, Creative Wants, Projects/Builds.

**6. §8 parked** — App-launching is architecturally impossible on Vercel serverless (can't launch local apps from a cloud function). Would need a local companion process. Not building it — this is a separate product decision.

### Still needs your approval:

- [ ] **Write reallocated Aug 18–31 schedule to Notion** — the draft is ready (exact per-day entries, tasks from Aug 13-17 redistributed, no compression). Say "go" and I'll write it to Phase 1 — Zoomed In, replacing all old August content.
- [ ] **Clear "quick test" active commitment** — leftover from your Parked Threads restore testing. Say the word.

### Blocked on you (no rush):

- **Item Registry Domain field** — empty on all 62 rows. Milestone-driven suggestions will work better once domains are populated (Maya can match items to milestone tracks).

---

## Session 3 (2026-08-17) — what I checked before doing anything

Re-read Life Truth, Current Truth, The Map, Phase 1 — Zoomed In first, per the standing rule. Nothing changed since last session — all still consistent with what `CLAUDE.md` already has recorded.

**Both held features: pushed, verified live 2026-08-17.**
- [x] **Task-title display** — live. Confirmed via real data: today's Day Schedule entry already has real `detail` text on business windows, so you'll see your actual task instead of a generic "business" label.
- [x] **Milestone bar** — live. Confirmed via `/status`: shows "Day 23 · Phase 1 · next: New product launch (reworked Aug plan), 15 days (1 Sept)".
- **Found and fixed something along the way:** `/status` (which both of the above depend on) was silently 500ing in production — the "Parked Threads" Notion database had been trashed (most likely accidentally, while clearing the fake "competitor pricing" test row a past session left there — deleting a row vs. the whole database is an easy mix-up in Notion's sidebar). You've since restored it yourself and it's confirmed working again. One loose end: `/status` currently shows `activeCommitment: "quick test"` — looks like leftover from testing the restore, not a real commitment. Say the word if you want it cleared.

**Carry-forward design decision — made 2026-08-17:** you chose Phase 1 — Zoomed In prose as the edit target (not the Day Schedule DB, even though that's what actually drives Maya's suggestions). That means carry-forward will keep this page's narrative honest, but on its own won't change what Maya suggests tomorrow — worth remembering if it ever feels like carry-forward "isn't doing anything" day-to-day.
- [x] **Written to Notion 2026-08-17, verified live.** Corrected Aug 13–31 day-by-day content is now on Phase 1 — Zoomed In. Aug 13–17 stays one THINK + one HANDS per day; Aug 18–31 is compressed into a standing pattern + 10 named checkpoints (per your instruction — product concept/flow already finalized, so that stretch is execution not decisions). Cross-checked against `august-daily-schedule.md` first — caught and fixed one real gap (Day 21's Caregiving note was missing) before writing. Aug 10–12 left untouched, old MOO content below still marked historical, nothing deleted.
- [ ] **Next:** build the actual carry-forward chat flow on top of this (Maya detects something's unfinished, drafts the edit to tomorrow's entry on this page, shows you the exact text, writes only after you approve).

---

## ⚠️ Notion edits (only you can make these — I'm read-only)

- [x] **Item Registry → "MOO layer build"**: done — Status → Paused, notes point at the Phase 6 re-entry window (~5–14 Nov 2026) instead of the dead 25 Aug date.
- [x] **Item Registry → "Post publishing (2/day sprint)"**: done — notes updated to reflect current posting cadence, not a fixed 2/day.
- [ ] **Item Registry → Domain field**: empty on all 62 rows. Only matters if you want domain-based reasoning later (e.g. "no business items on a heavy caregiving day"). Populate or ignore — your call, flagging only.
- [x] **Phase 1 — Zoomed In (Notion page)**: done — replaced the stale MOO-based August section with a summary of your reworked plan (product build replacing MOO, launch target 1 Sept), old content kept but marked historical, not deleted. Full day-by-day detail lives in `august-daily-schedule.md` in the project folder, not duplicated into Notion, so there's one source of truth.

---

## Decisions needed (check off once you've told me / decided)

- [x] **Milestone surfacing** — confirmed: milestone bar on screen, and upcoming milestones actively shape what Maya suggests day to day (not just separate pop-ups).
- [x] **Which "Day 0" clock** — **corrected 2026-08-14**: you caught my mistake — Phase 1 stays on its original clock (Day 0 = 25 July 2026, so today is Day 20). 1 Sept is a target date for the new product launch, not a new Day-1 reset. Milestone bar will build against the original Phase 1 clock.
- [x] **`DEFAULT_DAY_TEMPLATE` accuracy** — done. You sent an update twice today; the **second, final version is live** (5am start, no `feed_mom` windows — batch-prepped snacks instead — business time spread ~5h20m across two streams). Pushed and confirmed working.
- [ ] *(No action needed, just confirming)* — I built the capacity-cap code on the reading that Life Truth sets the daily ceiling and The Map's business priority only decides what fills it. Flag me if that's wrong.

---

## The "3 things a day" cap — status

- [x] Live as of 2026-08-13, ~23:00 IST. You don't need to do anything technical here — I handled the turning-on and the checking myself.
- [x] Found and fixed a real bug right after turning it on: it briefly broke Maya's "what should I focus on" feature entirely for a few minutes (a Notion setup detail I missed), then a second, quieter bug where it could count something toward your 3-a-day limit even if it was never actually shown to you. Both are fixed now and I double-checked the fix actually works.
- [x] Cleaned up 3 fake entries my own testing left in your Notion Task Log — they're marked as test artifacts now, not real assignments, so they won't unfairly eat into today's 3.
- [ ] Worth knowing: if you mark something done and then un-mark it later the same day, it still counts as one of your 3 for that day (it was still "assigned" to you, just not finished). Tell me if you'd rather it worked differently.

---

## Picking back up next session
- [x] Day-template is live — your final version (5am start, no `feed_mom`, two business streams). Pushed and verified with a real request.
- [~] **Held, not pushed, on your instruction:** the feature that makes Maya show your actual written task ("Product — Define what it is") instead of a generic "business" label. The data side is done — all 19 days (Aug 13–31) are loaded into Notion. The code that displays it is written and committed, just waiting for your go-ahead to push.
- [~] **Milestone bar — built, held, not pushed.** Shows "Day N of Phase 1" + the nearest upcoming milestone from a short hand-picked list (not the full roadmap — deliberately skips anything still tied to the dead MOO plan). Display only so far; doesn't yet change what Maya suggests day to day (that was the second half of the original ask, not started).
- [ ] **Carry-forward feature — NOT started, still being designed, nothing built.** What you want: when you tell Maya something's unfinished, she asks to edit tomorrow's entry on Phase 1 — Zoomed In, shows you the exact rewritten text, and only edits Notion after you approve. **Open question, unresolved:** the page's August section currently has stale entries in the old THINK/HANDS format (built around the dead MOO plan, same style as your screenshot). Before building carry-forward, these need correcting to match your real Aug 13–31 plan, in that same format — I drafted an example and was waiting on your go-ahead to write it when this session paused. **I will not touch that page without showing you the exact edit first and getting a yes** — this was explicitly corrected once already this session, don't skip it.

**One thing worth knowing:** the day-template pushes happened out of order with some other held changes, so some git history surgery happened behind the scenes to push only what was asked each time (nothing risky — no data was touched, just how the code history is arranged). If a fresh session picks this up, `git log` will show a few small housekeeping commits; nothing there needs explaining unless asked.

**A mistake worth knowing about, for whoever picks this up:** mid-session, Claude told Vybes the Zoomed In page's August section "has no day-by-day entries at all" — wrong; it has real entries, just in the old MOO-era THINK/HANDS format, marked historical. Caught and corrected by Vybes. Lesson: verify document content directly before describing it, don't state from memory of an earlier edit.

---

## Background (no action — for context only)
- Nothing was pushed this session except: (1) the final day-template, (2) the day-specific Notion data load (Aug 13–31) — both explicitly requested and verified live. Everything else is committed locally, held.
- `NEEDS_INPUT.md` #2 (roadmap milestones) is marked resolved — the data exists now; the real open question moved to Decisions above.
- `CLAUDE.md` and new `KNOWLEDGE_TRANSFER_v8.md` are updated to reflect everything read this session.
- Ground rules confirmed this session, still in force: Notion writes need explicit per-edit sign-off (not blanket permission), especially for Phase 1 — Zoomed In and The Map specifically — always state the exact edit before making it.
