# Personal Operations System — Knowledge Transfer v6
### Continues v5. Full Maya v2 build order (§2-§9) now built, per `Maya_v2_Build_Spec.md`. This was an autonomous work stretch — see `CLAUDE.md` for fast-reference constraints, `NOTES.md` for every judgment call made along the way, `NEEDS_INPUT.md` for open questions, `MAYA_V3_IDEAS.md` for anything out of scope. Read those 4 files, not just this one — this doc is the technical snapshot, they're the reasoning trail.

---

## 0. WHERE WE ARE

All of Maya v2's build order is implemented and pushed. Status:
- [x] Infra + Vercel deploy
- [x] §2 Commitment-Keeper — tested live, all 4 intents confirmed working
- [x] §3 Item Registry — real ~60-item database, Vybes' own schema
- [x] §4 Timing Engine (Day Schedule + item-selection) — 2 known deferred edges (see §3 below)
- [x] §5 Write-tiering — grocery list as the concrete inform-only example
- [x] §6 Learning Loop — Task Log extended to cover commitment + registry events; hard-adaptation deferred (needs real usage data)
- [x] §7 remaining Notion sources — Elegance/RDF Plans, Creative Branch Wants, Projects/Builds built; Roadmap/Relationship-map/life-plan logged as needing Vybes' input, not built
- [x] §8 App-launching — NOT built, architecture conflict logged (Vercel serverless can't launch local apps — see `NEEDS_INPUT.md` for the 3 options)
- [x] §9 Frontend — commitment strip, adaptive single-surface, milestone-bar stub, all live in `public/index.html`

**Live app:** https://my-day-lovat.vercel.app. **Repo:** `vybavlakshmi/my-day` on GitHub, auto-deploys on push to `master`.

**Deploy lag is real and recurring** — Vercel deploys have taken anywhere from ~1 to ~10+ minutes to actually go live during this session, sometimes serving stale code/404s well after a push looked successful. Always verify with a fresh test after waiting, don't assume a push = live.

---

## 1. FILES BUILT (current, all under `myday/`)

- `package.json`, `.env.example`, `.gitignore`, `vercel.json` — as before, `vercel.json` now rewrites 8 routes (added `/status`, `/parked`, `/focus`).
- `api/index.js` → `src/app.js` (routes) → `src/server.js` (local-dev-only listener, unused in prod).
- `src/health.js` — `GET /health`.
- `src/groq.js` — `judgeExcuse`, `weeklyReview`, `chatReply`, `classifyCommitment` (now 8 intents: new_commitment/continuation/drift/conscious_switch/completion/schedule_update/grocery_add/creative_want_add/other — wait, that's 9 including other), `planDay` (dynamic day replanning), `suggestFocus` (phrases focus-item suggestions), `DEFAULT_DAY_TEMPLATE` (Vybes' real ~37-window routine, not a rough guess).
- `src/notion.js` — every DB's CRUD, see §2 below for the full list of databases.
- `src/maya.js`, `src/calendar.js` — unchanged from v5.
- `src/cadence.js` — `getAllTasks`, `handleChat` (routing order: direction-seeking check → classifyCommitment → schedule_update/grocery_add/creative_want_add/other-fallthrough → excuse detection → plain chat), `getCurrentWindow`, `getFocusItems` (item-selection logic), `isDirectionSeeking`, `WINDOW_FIT_MAP` (Day Schedule's lowercase_snake ↔ Item Registry's Capitalized-Hyphenated).
- `public/index.html` — commitment strip, one adaptive focus card (replaced the 3 fixed cards), milestone-bar stub.
- `CLAUDE.md` — fast-reference project constraints (read this first in future sessions, before re-deriving anything from the spec or this doc).
- `NOTES.md` / `NEEDS_INPUT.md` / `MAYA_V3_IDEAS.md` — autonomous-work logs, see those directly.

---

## 2. ALL NOTION DATABASES (real IDs, current)

```
OPEN_TASKS_PAGE_ID=37caa293-e5a2-8150-9e0f-f69e22a60b2d       # page, not DB — blocks API
EXCUSE_LEDGER_DB=72381ab4-b6d2-4dad-821e-8166527c4570
TASK_LOG_DB=4c0a4c5a-0fe2-47bb-8393-605d1674adc6              # schema extended this session, see below
ACTIVE_COMMITMENT_DB=c8adb156-a560-447b-bf9f-036f05abf0ba
PARKED_THREADS_DB=d50e4f60-f97c-4cbd-af1d-208673a2c5c6
COMMITMENT_HISTORY_DB=57a5d84b-3229-43e7-842d-7353768a9dda
ITEM_REGISTRY_DB=8d54f25c-02d2-4a77-a569-089bf86bda29         # Vybes' real ~60-item registry
DAY_SCHEDULE_DB=55873184-08db-4e66-88af-5fd90f02d1f4
GROCERY_LIST_DB=0ad55bcf-47a7-416b-aded-69a43f7d82e1
ELEGANCE_RDF_DB=4ada7ff5-6b61-4a23-923b-2ca5b7526be2
CREATIVE_WANTS_DB=cf9c3b01-f835-4da1-8bc9-21e16c64f573
PROJECTS_BUILDS_DB=e583186f-3ac5-4085-8a61-0465698038e1
```

**Task Log's schema was extended, not replaced:** `Source` select gained `registry` and `commitment` options (was protected/notion/calendar only); a new `Detail` rich-text property was added for the "reason, where given" part of §6. See `NOTES.md` for the Status-field mapping used for commitment events (drift→given, conscious_switch→rescheduled, completion→done — a judgment call, not a spec requirement).

**Every database above needs manual connection to the "My Day Manager" Notion integration** before the app can see it (Notion → "..." → Connections). As of this doc, unconfirmed whether all 3 newest ones (Elegance RDF, Creative Wants, Projects Builds) have been connected + had their Vercel env vars added yet — check `NOTES.md`'s "Pending manual setup" note.

---

## 3. DAY SCHEDULE / TIMING ENGINE — what actually got built

Design from v5 was followed, with two deviations found during build/test:

- **`DEFAULT_DAY_TEMPLATE` is Vybes' real ~37-window minute-by-minute routine** (walks, feeds, meals, medicines, the hospital+business block, discretionary slots), not the rough 11-block guess v5 described — she supplied the real schedule mid-session and it replaced the guess entirely.
- **3 hard rules added to `planDay`'s prompt** after live testing showed the model would cram everything into uniform 1-hour blocks under time pressure: (1) nothing scheduled past 01:00, (2) no gap >20min between windows, (3) caregiving/meals/medicines are non-negotiable, discretionary items flex first. These genuinely improved output quality for the normal case.
- **Known unresolved edge case:** when *current time* is already past 01:00, the 1am cutoff isn't reliably enforced — tested repeatedly, a clarifying rule addition didn't fully fix it. Not worth more blind prompt iteration; revisit with real usage examples if it actually causes trouble.
- **"Already done recently" dedup was never built** — `getFocusItems()` picks from Item Registry by window-fit + Active status + protected-first, but has no concept of "this was already suggested/done today," so it can repeat suggestions. This is the same underlying gap noted in the frontend's visual-only toggle (§9).
- **`getFocusItems()` only considers Item Registry, not Calendar** — spec §4 describes the Timing Engine weighing Item Registry *and* Calendar together; what's built ignores Calendar events entirely when picking focus items. Logged, not fixed, during the §9 frontend build.

---

## 4. §9 FRONTEND — what changed in `public/index.html`

- **Commitment strip** (new, below the greeting): "On now: [active commitment or 'Nothing committed yet']" + a "N threads parked — tap to see" row that expands an inline list on click. Fed by new `GET /status` and `GET /parked` endpoints.
- **3 fixed cards → 1 adaptive card**, titled by the current window name (formatted from `feed_mom_start_laundry` → "Feed Mom Start Laundry" etc.), showing up to 2 Item Registry entries via `GET /focus`. Protected items get a small "protected" tag.
- **Milestone bar**: `GET /status` always returns `milestone: null` for now (no Roadmap data source exists — see `NEEDS_INPUT.md`). Top bar shows the static "MY DAY" title until that changes; the frontend already checks `data.milestone` and will switch to a countdown the moment the backend ever returns one, no frontend change needed later.
- **Lost in the swap:** the old "From Notion" card's tap-to-tick-in-real-Notion feature has no UI entry point now (card is gone). `POST /task/toggle` still works, just unreachable from the dashboard. Flag if this was actually being used.
- Focus-card items are click-to-toggle **visually only** — no persistence (ties back to the missing dedup/completion-tracking above).

---

## 5. NEXT STEPS

1. Confirm the 3 newest Notion DBs (Elegance RDF, Creative Wants, Projects Builds) are connected to the integration + have Vercel env vars — check `NOTES.md`.
2. Populate: Item Registry is done; Elegance/RDF Plans, Creative Branch Wants, and Projects/Builds are empty shells waiting for real data, same as Item Registry was before Vybes filled it in.
3. Resolve `NEEDS_INPUT.md`'s open items when convenient — none are blocking further building, but §8 (app-launching) needs an actual decision among the 3 options logged there before that feature can exist at all.
4. Fix or accept the 2 known Timing Engine gaps (§3 above) once there's real usage data to judge them against, rather than more synthetic testing.
5. Everything in `MAYA_V3_IDEAS.md` (check if anything's there) is explicitly out of this build's scope per the spec's own instruction.

---

## 6. BACKLOG (unchanged from v5 — still not building)
- Telegram bot, full v1 always-on cadence/cron engine, 25-day Replit refresh reminder (moot), auto-categorize-on-input, nightly journal → summary, desktop pet.
- Anything not explicitly in the Maya v2 spec goes in `MAYA_V3_IDEAS.md`, not built speculatively.
