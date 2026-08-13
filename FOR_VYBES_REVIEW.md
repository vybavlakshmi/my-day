# For Vybes — review when you're back

Running document from the autonomous session starting 2026-08-13. Everything below is either a decision only you can make, a Notion update I noticed but won't make myself (read-only this session), or a heads-up about risk from working unattended. Code changes are covered separately in git commits/PR — see the bottom section for what shipped vs. what's held for review.

**Ground rules I'm operating under this session** (confirmed by you 2026-08-13):
- Code: push safe/additive changes automatically; hold anything touching what you see/rely on day-to-day for your review.
- Design decisions the spec/KT docs flagged as yours to make (not mine to guess): logged below, skipped, not built.
- Notion: read-only for me. Anything that looks stale/needs updating goes in the "Notion updates needed" section below — you make the edit.
- Reading scope: reading all known governing docs in full this session (Current Truth, The Map, TVC Milestone Roadmap, Award Strategy Roadmap, Phase 1 — Zoomed In).

---

## ⚠️ Early warnings (read these first)

### 1. Maya's live Item Registry has a stale, active "MOO layer build" item — target date is dead
Found 2026-08-13. Your **Item Registry** (the real Notion DB Maya's `getFocusItems()` actually pulls from) has:
- **"MOO layer build"** — Status: Active — Notes: "Layer 1 target 25 Aug 2026"
- **"Post publishing (2/day sprint)"** — Status: Active — Notes: "Posts 1-20 A/B sprint - Day 0 = 25 July 2026"

But **Current Truth** and **The Map** (both last edited 2026-08-09, more recent than these registry entries) say:
- MOO is **PARKED, not killed** — "No 25 Aug launch date anymore." It's a candidate to resurface at the 90-Day Journey's Phase 6 (~5–14 Nov 2026), not before.
- Posts 1–20 sprint was scoped to Day 1–10 (26 Jul–4 Aug) — should have concluded over a week ago, with posting continuing "at whatever cadence the weightage data supports," not a fixed 2/day.

**Why this matters:** these are live, Active items in the exact database Maya surfaces to you day-to-day. As of today, Maya could genuinely tell you to work toward a launch deadline for a product line you parked, or keep sprinting a posting cadence that already ended — under real urgency framing, while you're mid-treatment and every assigned thing is supposed to pass a 360-analysis. This isn't hypothetical; it's what the registry says right now.
**I have not touched this** (Notion writes are yours per your ground rules). See "Notion updates needed" below for the specific edits I'd suggest.
**Not fire-today:** the phantom deadline is 12 days out, not today, so this isn't a "stop everything" emergency — but I wanted you to see it before it got buried at the bottom of a long report.

---

---

## Decisions needed from you

### 1. How should milestones/life-plan content actually surface day-to-day?
This was flagged in KT v7 as your call, not mine to guess — still true after reading everything. Options on the table (not decided, just the shape of the choice):
- Milestone bar only (the currently-stubbed "MY DAY" title becomes a countdown/status, nothing else changes)
- Milestone bar + feeds into `getFocusItems()` selection (e.g. items tied to a HARD date get priority as the date nears)
- Milestone bar + triggers its own separate nudges (e.g. "Effie window opens in 3 weeks")
Also relevant: there are **three separate "Day" clocks** running (Map Phase 1 Day 0 = 25 Jul 2026, original TVC posting Day 0 = also 25 Jul 2026 but tracked separately per Current Truth's own instruction not to conflate them, and the 90-Day Journey Day 1 = 1 Sept 2026, fixed). If the milestone bar shows a day-count, it needs to know which clock you mean at any given moment. Not building anything here until you say which shape you want.

### 2. DEFAULT_DAY_TEMPLATE may be stale against your actual current routine
`src/groq.js`'s `DEFAULT_DAY_TEMPLATE` (the caregiving-anchored day used whenever no day-specific plan exists) has exactly **one** business-designated window: `business_deep_work`, 17:40–18:10, 30 minutes, `laptop_execution`. Everything else is caregiving/household/movement.
Current Truth (updated July 2026) says the execution model changed to "scattered work chunks throughout the day... small, self-contained, pick-up-and-put-down," replacing an earlier single evening block — which sounds like it's describing something different from what's currently encoded (one single 30-min evening-ish slot, not multiple scattered chunks). KT v7 already flagged this template might not match your real day anymore, and this reading confirms there's at least a plausible mismatch. **I'm not touching this file** — it encodes your actual caregiving schedule, which only you can state accurately, and getting it wrong would directly violate the "don't guess capacity" rule from Life Truth. If your day now has more (or differently-placed) laptop/business windows than this one 30-min slot, tell me the real windows and I'll update it.

### 3. Business-vs-capacity authority, for the record (not asking you to decide — just confirming I'm not overriding it)
The Map says "Business runs first and gets the hours." Life Truth caps at 3 things/day + requires a 360-analysis, "when in doubt, don't assign it." Current Truth's own authority note resolves this already: Life Truth defines *how much* capacity exists on a given day; Current Truth/Map defines *what fills it* once that's known. I've built the code change below (item #8 in "shipped") on that reading — capacity ceiling always wins first, business priority only decides what competes for the remaining slots. Flag me if that's not the right read.

---

## Notion updates needed (I'm read-only, you make these)

1. **Item Registry → "MOO layer build"** (currently Active, notes say "Layer 1 target 25 Aug 2026"): update or pause to reflect MOO's actual PARKED status per Current Truth/The Map (2026-08-09). Suggested: set Status → Paused, update Notes to reference the Phase 6 (~5–14 Nov 2026) re-entry decision point instead of a fixed date.
2. **Item Registry → "Post publishing (2/day sprint)"** (notes reference the 25 Jul Day-0 A/B sprint, which per The Map concluded ~Day 10 / 4 Aug): update notes to reflect current posting cadence (whatever the post-20 weightage data actually supports now), since "2/day sprint" reads as still-active.
3. **Item Registry → Domain field is empty on all 62 rows.** Not causing a functional bug (Maya's code doesn't appear to filter by Domain — worth confirming), but if you ever intended Domain-based reasoning (e.g. "no business items during a caregiving-heavy day"), it can't work until these are tagged. Flagging, not fixing — didn't want to bulk-edit 62 rows without you seeing it first.
4. **Phase 1 — Zoomed In** (last edited 2026-08-01) still has the full day-by-day MOO layer schedule (Aug 10–31) built around the now-dead 25 Aug launch. The page's own text says "if this and Phase 1 [in The Map] ever disagree, Phase 1 wins; update this page to match" — so by your own rule this page needs a pass to match The Map's Aug 9 update (MOO parked, 90-Day Journey now flagship from Sept 1). Not urgent since The Map already governs, but it'll keep confusing anyone (including me) who reads Phase 1 — Zoomed In for "what should today look like."

---

## Shipped automatically this session (safe/additive, already pushed)

**Nothing was pushed this session.** The one code change (below) explicitly needed your review before deploying per your own ground rule, and git push isn't selective — since it's the only unpushed commit, pushing anything after it would've pushed it too. So everything (code + these doc updates) is committed locally, nothing is live yet. Docs alone would've been safe to push on their own; I chose not to split the history to force that, since reordering commits mid-session felt like its own small risk not worth taking without asking. If you'd rather I'd pushed the doc-only commits, say so next time.

---

## Held for your review (committed locally, NOT pushed — needs your go-ahead)

### `getFocusItems()` — Life Truth's 3-discretionary-items/day cap
Files: `src/cadence.js`, `src/notion.js`. Commit `ecf1ccb` (local only).
**What it does:** caps distinct Negotiable-class items (Item Registry + Notion brain-dump) introduced across the whole day at 3, tracked via a new Task Log entry (`Source: registry, Status: surfaced`). Calendar events and Protected registry items (caregiving/health essentials) are exempt — always shown, never counted.
**What it deliberately does NOT do:** the qualitative "360-analysis" (energy cost, timing, current load, sustainability). That's real judgment, not something I'd fake with an unverified heuristic in a caregiving-load context — flagging it as still-open rather than pretending it's covered.
**Before you trust this:** it's untested. No local Node on this machine, and the only way to test is live, which the hold-for-review rule blocks by design — that's the right tradeoff, but it means you're the first real test. Review the diff (`git log -p -1`), push, then verify via the existing pattern: check `/focus` live across a few different windows, and cross-check the Task Log in Notion directly for the new `surfaced` entries (never trust the chat reply text alone, same rule as always).
**One thing worth watching once live:** if a Negotiable item is toggled done and then un-done (`given` status) within the same day, it still counts toward the 3 — the cap counts *introduction*, not current completion state. That's a deliberate reading of "3 things assigned," not a bug, but flag it if it doesn't match your intent.

### Documentation updates (would've been safe to push alone, held with the above)
- `CLAUDE.md` — mandatory section updated: all previously-unread docs now marked read with last-edited dates, capacity-rule status updated to reflect the cap above, new doc names spotted in passing (Patch documents, Historical Archive, TVC Studio, Business Project Second Brain v2 — not read yet).
- `KNOWLEDGE_TRANSFER_v8.md` — new, concise technical log of this session.
- `NEEDS_INPUT.md` — item #2 (roadmap milestones) marked resolved; the data exists, what's open now is a design question, moved to this doc's decisions section.
