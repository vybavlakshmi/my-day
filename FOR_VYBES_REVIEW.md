# For Vybes — to-do (session 2026-08-13)

Checklist version — check items off as you go. Full context/reasoning for anything here lives in `KNOWLEDGE_TRANSFER_v8.md` and `CLAUDE.md` if you want the long version; this file stays short on purpose.

---

## ⚠️ Notion edits (only you can make these — I'm read-only)

- [ ] **Item Registry → "MOO layer build"**: set Status → Paused, update Notes off "Layer 1 target 25 Aug 2026" (dead — MOO is parked per Current Truth/The Map, both Aug 9). Point notes at the Phase 6 re-entry window (~5–14 Nov 2026) instead.
  *Why it matters: this item is still Active, so Maya could currently nudge you toward it as if the deadline's real.*
- [ ] **Item Registry → "Post publishing (2/day sprint)"**: update Notes — the sprint ended ~4 Aug per The Map. Reflect current posting cadence, not a fixed 2/day.
- [ ] **Item Registry → Domain field**: empty on all 62 rows. Only matters if you want domain-based reasoning later (e.g. "no business items on a heavy caregiving day"). Populate or ignore — your call, flagging only.
- [ ] **Phase 1 — Zoomed In (Notion page)**: its Aug 10–31 day-by-day section still assumes MOO's dead 25 Aug launch. Its own text says it should defer to The Map when they disagree — worth a pass so it stops being misleading to read.

---

## Decisions needed (check off once you've told me / decided)

- [ ] **Milestone surfacing** — pick one: (a) milestone bar only, (b) bar + feeds into `getFocusItems()` selection, (c) bar + triggers its own nudges. Nothing's built here until you pick.
- [ ] **Which "Day 0" clock** the milestone bar should use, if built — Map Phase 1 (25 Jul), original posting clock (25 Jul, tracked separately), or 90-Day Journey (1 Sept). May depend on the answer above.
- [ ] **`DEFAULT_DAY_TEMPLATE` accuracy** — right now it has exactly one 30-min business window (17:40–18:10). Current Truth's July update describes scattered work chunks through the day instead. Confirm whether your real day still matches the one-slot version, or tell me the real windows if not — I won't guess this one.
- [ ] *(No action needed, just confirming)* — I built the capacity-cap code (below) on the reading that Life Truth sets the daily ceiling and The Map's business priority only decides what fills it. Flag me if that's wrong.

---

## Code review (before you push)

- [ ] Review commit `ecf1ccb` — `git log -p -1` — adds the 3-discretionary-items/day cap to `getFocusItems()`.
- [ ] Push if it looks right — nothing's live yet.
- [ ] After pushing: check `/focus` live across a couple of different windows.
- [ ] Cross-check Notion Task Log directly for the new `surfaced` entries — don't just trust the chat reply.
- [ ] Note for later: toggling an item done→un-done same day still counts it toward the 3 (intentional — it's "assigned," not "currently complete." Flag me if you want it to work differently).

---

## Background (no action — for context only)
- Nothing was pushed this session; code + doc commits are bundled together locally.
- `NEEDS_INPUT.md` #2 (roadmap milestones) is marked resolved — the data exists now; the real open question moved to Decisions above.
- `CLAUDE.md` and new `KNOWLEDGE_TRANSFER_v8.md` are updated to reflect everything read this session.
