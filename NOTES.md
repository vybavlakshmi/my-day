# Autonomous build notes

Running log of minor decisions/caveats made without stopping to check in. Read when back. Newest entries at the bottom.

---

## §6 Learning Loop
- Reused the existing Task Log DB rather than creating a new one, per the plan. Extended its `Source` select with two new options (`registry`, `commitment`) and added a new `Detail` rich-text property for the "reason, where given" part of the spec's ask. Confirmed via `notion-update-data-source` that adding new select options + a new column to an existing DB works cleanly — no issue there.
- Status field is still just `given`/`done`/`missed`/`rescheduled` (didn't add new options for this one). Mapped commitment events onto it rather than inventing new statuses, to keep the schema from sprawling:
  - `drift` → `given` (something was offered/parked)
  - `conscious_switch` → `rescheduled` (the old commitment effectively got rescheduled)
  - `completion` → `done`
  - This is a judgment call, not a spec requirement — if the mapping reads oddly in the actual log once there's real data, worth revisiting.
- Focus-item suggestions (`getFocusItems`/`suggestFocus`) now also log to Task Log with `source: 'registry'`, `status: 'given'`, only when items were actually found (empty suggestions aren't logged — nothing happened, nothing to log).
- **Hard adaptation NOT built** — per spec §6, this explicitly needs 1 week to 1 month of real observation data first ("Maya asks more, assumes less, logs everything" during the beta window). The logging hooks above are that beta-mode data collection. Revisit hard-adaptation logic once there's real usage history to look at, not synthetic test data.

## §7 remaining sources
- Elegance/RDF Plans, Creative Branch Wants, Projects Builds — all 3 built as separate small DBs rather than cramming into Item Registry, since their fields don't overlap with it (no class/window-fit relevance) and mixing concerns would make Item Registry's queries messier.
- Creative Branch Wants got a write path (`creative_want_add` classifier intent) since "capturing an idea" is squarely inform-only per §5, same shape as grocery. Elegance/RDF and Projects/Builds are read-only from the app for now — no natural "Maya, add an RDF plan" chat trigger came to mind that wouldn't just be duplicating the grocery/creative-want pattern without a clear need for it yet; can add later if it turns out useful.

## Pending manual setup (batched — same pattern as every new DB all session)
3 new databases from this stretch of work need connecting to "My Day Manager" + a matching Vercel env var before they're live: **Elegance RDF Plans** (`ELEGANCE_RDF_DB`), **Creative Branch Wants** (`CREATIVE_WANTS_DB`), **Projects Builds** (`PROJECTS_BUILDS_DB`). IDs are in `.env.example`. Task Log's schema change (§6) does NOT need a new connection — it's an existing, already-connected database, only its schema changed. Continuing other work rather than blocking on these three being connected. (Confirmed §6 itself works live via a fresh test — Task Log correctly shows a `commitment`/`done` row.)

## §9 Frontend — design calls before building
- **3 new backend endpoints** needed for the frontend rework: `GET /status` (active commitment + parked count, for the commitment strip), `GET /focus` (current window + 1-2 registry items, for the adaptive surface — reuses the already-built `getFocusItems()`), `GET /parked` (full parked-threads list, for the strip's "tap to see"). None of these existed before; `/tasks` stays as-is for now since removing it would break `getAllTasks()`'s other internal uses (excuse-detection still needs protected/notion/calendar task titles to match against).
- **Known gap, not fixed here:** `getFocusItems()` (built during §4) only pulls from Item Registry. Spec §4 describes the Timing Engine as considering Item Registry *and* Calendar together ("today's Calendar (hospital timing, chores-with-repeats)"), but what got built doesn't factor in Calendar events at all. This is a §4 completeness gap surfaced while building §9's UI for it, not something to silently expand now mid-frontend-task — logging it here rather than scope-creeping the fix in.
- **Left `PROTECTED_TASKS` (the hardcoded 4-item list) alone in `cadence.js`** — it's still used by excuse-detection (`findReferencedTask`) for the "Day to day tasks" excuse-judging flow, which is a still-valid v1 feature, not something §9 asked to touch. §9's "remove the hardcoded protected list" reads as being about the *dashboard display* (the "Day to day tasks" card, now replaced by the adaptive surface), not the excuse-matching logic underneath it. If this reads wrong once you're using it, flag it — easy to change either way.
- Calendar card and "From Notion" card both go away per spec's explicit instruction to replace all 3 fixed cards with one surface — their underlying data (calendar.js, notion.getOpenTasks) isn't removed, just not shown on the dashboard directly anymore. They're still used in `/chat`'s excuse-detection.
- **UX trade-off worth flagging:** the old "From Notion" card's tap-to-tick-in-Notion feature (`POST /task/toggle`, source `notion`) has no UI entry point anymore, since that card is gone. The endpoint still exists and still works, just nothing in the new frontend calls it. Real Notion checkbox-ticking is currently only reachable if you ask Maya to do it via chat, and there's no chat trigger built for that either. Not fixed here — flagging in case it's a feature you actually used.
- Focus-surface items are click-to-toggle **visually only**, no backend persistence (same root cause as the deferred "already done recently" dedup from §4 — there's no completion-tracking for Item Registry entries at all yet). A refresh will show the item again. Honest UI, not broken UI, but worth knowing before relying on it.
- Milestone bar: implemented as a conditional — `GET /status` always returns `milestone: null` right now (no Roadmap data source exists), so the top bar always shows the static "MY DAY" title. The frontend code checks `data.milestone` and will swap in the countdown text automatically the moment a real value comes from the backend — no frontend change needed once Roadmap exists, only a backend one.
- **Verified end-to-end live**, including the actual click interaction (not just data fetching): commitment strip shows a real active commitment ("portfolio site") and correct parked count, the "tap to see" expand shows the real parked thread, and the focus card correctly showed 2 protected-tagged real Item Registry items for an "any"-fit window, protected-first as designed.

## Test data left in Notion (fake, from verification testing)
Same pattern as every other feature this session — testing writes real rows. Active Commitment currently holds **"portfolio site"** (fake, from the §9 end-to-end test) and Parked Threads has **"competitor pricing"** (fake, from an earlier §6 test). Delete both when convenient, same as previous cleanups this session — not urgent, doesn't block anything.

---

## Session complete — all 9 planned tasks done
§6 (Learning Loop), §7 (3 new Notion sources + input logged for the 3 that need your own definitions), §8 (architecture conflict logged, not built), §9 (frontend) — all built, pushed, and live-verified except where noted above as pending your manual Notion-connection + Vercel env var steps. See `KNOWLEDGE_TRANSFER_v6.md` for the full technical snapshot, `NEEDS_INPUT.md` for what's still waiting on you.

---

## Bugs reported by Vybes after live use — for tomorrow, not yet investigated

1. **No audio output at all.**
2. **Typed messages "go into oblivion"** — no visible response of any kind.

These two are likely the same root cause: `handleSend()` in `index.html` never renders Maya's reply as *text* anywhere — the reply only ever gets spoken via `/speak` + `audio.play()`. So if `/speak` fails (candidates: Edge TTS behaving differently inside Vercel's serverless environment than it did in earlier ad-hoc testing, since `msedge-tts` talks to Microsoft's service over a connection that serverless cold-starts/short function lifetimes could disrupt; or a browser autoplay-policy issue, since `audio.play()` fires after an `await fetch()`, and some browsers no longer treat that as within the original click's "user gesture" window), the result is exactly what got reported: total silence, nothing visible. Tomorrow: check browser console + Network tab on an actual failed send first, don't guess blind. Likely fix has two parts — find why `/speak`/playback fails, AND add a text rendering of the reply so a voice failure isn't a total-silence failure.

3. **Ticking a focus-card item as done reverts on reload.** Not a new bug — already logged above as a known, shipped-as-is gap (no completion-tracking exists for Item Registry items). Confirmed real by her report. Fix requires building actual persistence (a "done today" concept for registry items), which is the same underlying work the deferred §4 "already done recently" dedup needs — worth doing both together tomorrow rather than separately.

## Bugs 1 & 2 — root cause found and fixed
NOT an IP-blocking issue (ruled that theory out per Vybes' request before acting on it). Real cause: `/speak` was returning `"Connect Error: [object Object]"` — `msedge-tts` v1.x doesn't implement Microsoft's now-required `Sec-MS-GEC` security token for the underlying WebSocket connection (confirmed via the npm package's own GitHub source — v2.0.7, published 7 days before this session, added `generateSecMsGec()` specifically for this). `package.json` was pinned to `^1.3.4`, which npm/Vercel would never upgrade past 1.x. Fixed:
- `package.json`: `msedge-tts` bumped to `^2.0.7`. Confirmed the public API (constructor/setMetadata/toStream shape) is unchanged between majors, so `maya.js` didn't need restructuring.
- `maya.js`: added `escapeForSpeech()` (basic XML-entity escaping) before sending text, per the library's own docs now recommending this — the connection uses SSML under the hood, unescaped `&`/`<`/`>`/quotes could also break requests.
- `app.js`: `/speak`'s error responses no longer leak stack traces to the client (was temporarily verbose for this debugging session) — server-side `console.error` still logs full detail.
- `index.html`: `/chat` and `/speak` are now handled as two separate try/catches, not one. The reply text renders in a new visible bubble as soon as `/chat` succeeds, *before* `/speak` is even attempted — so a future voice failure degrades to text-only, never back to total silence. This is the actual fix for bug #2, independent of whatever caused bug #1.

**Verified live, end-to-end, through the actual UI** (not just the raw endpoint): `/speak` returns 200 with real audio data (36KB webm blob) directly; sending a message through the real input box shows the reply as visible text in the new bubble immediately, and the network log confirms `/speak` succeeding (200) for that same interaction. Sec-MS-GEC theory was the whole story — no further TTS issue found.

## 4 more fixes from further live-use feedback

1. **"What I type still goes into oblivion"** was a *different* bug than what got fixed above — the reply bubble showed Maya's side, never Vybes' own typed message. Fixed: `showReply()` now takes both, renders a "You: ..." line above Maya's reply. Both survive a failed `/chat` call too (shows what you typed plus an error line), not just the happy path.
2. **Text-to-voice gap felt "glitched," not intentional.** Root cause: real gap between text rendering and audio starting (network round-trip + TTS synthesis time), with zero visual indication anything was happening during it. Added a subtle `.preparing` pulse on the semicircle for that gap specifically (distinct from the full `.speaking` breathe+ripple), so it reads as "still working" instead of "broken."
3. **Dashboard always showed "between windows" / empty, every single day, regardless of Item Registry having 60 real items.** Real cause: `getCurrentWindow()` returned `null` whenever no one had told Maya today's schedule yet (via a `schedule_update` chat message) — which is every day until you proactively text her, so the *default* experience was always empty. Fixed: falls back to `groq.DEFAULT_DAY_TEMPLATE` (the real daily routine) when no day-specific plan exists, instead of returning nothing. You still don't have to explicitly seed every day, only tell Maya about actual deviations.
4. **Completion-tracking built** (the deferred piece from §4/§9, now actually done): new `POST /focus/toggle` logs to Task Log (`source: 'registry'`, reusing §6's schema) when a focus-card item is marked done. `getFocusItems()` now excludes anything logged done *today* before picking the top 1-2 — so completing an item makes the next one surface, matching spec's "depth-one reveal," and the state survives reloads. Tracking is per-day only (resets naturally the next calendar day since it's a fresh Task Log query on `todayISO()`) — doesn't yet respect weekly/monthly cadence (a weekly item marked done will reappear tomorrow, not stay hidden all week). That refinement not built — flag if it matters in practice.

Not yet live-verified — pushing now.
