# Needs input from Vybes

Questions blocked on her, logged with enough context to answer without re-reading the whole session. None of these block other work — each is noted as such.

---

## 1. `item_registry.csv` doesn't exist
You referenced this as an attached file when kicking off the autonomous build. It's not present anywhere in the working directory (checked). Not a blocker — the live Notion "Item Registry" database is already built, populated with your real ~60 items, connected to the integration, and fully wired into the app. If the CSV was meant to be a *different* or *updated* source, let me know and I'll reconcile; otherwise no action needed.

## 2. Roadmap (dated milestones) — RESOLVED 2026-08-13, this existed already
Turned out these already exist in far more developed form than the spec implied: **TVC Milestone Roadmap — 2026 → 2031** (dated, tracked, tiered [C]/[P]/[D]) plus The Map's phase structure. What's still actually open is not "does the data exist" but "how should it surface in Maya" — moved to `FOR_VYBES_REVIEW.md`'s decisions-needed section rather than left here, since it's now a design question, not a missing-data one.

## 3. Relationship map — CLOSED 2026-08-18
§7 closed per Vybes: "The Map is as deep as it goes." Maya already reads Item Registry, Elegance/RDF, Creative Wants, Projects/Builds. No further integration needed.

## 4. Compiled life plan — CLOSED 2026-08-18
§7 closed per Vybes. Life Truth and Current Truth serve as the governing documents. No separate "compiled life plan" needed.

## 5. §8 App-launching conflicts with the hosting architecture — needs a decision, not just data
Spec §8: "Maya can be asked to open local tools directly — e.g., 'let's finish that reel' → Maya opens the reel editor from local files." The backend runs on **Vercel serverless** (cloud). It has no access to your laptop's filesystem and no way to launch a local application on your machine — a cloud function physically cannot do this. This isn't a missing-data problem like the others above, it's an architecture gap the spec didn't account for.

Real options, for when you're back:
1. **A local companion process** on your laptop that polls Maya's backend (or listens for a webhook) and launches apps locally when told to. Real infra work, a second thing to keep running.
2. **Drop this feature** — have Maya name the tool/file to open and tell you to open it yourself, rather than actually launching it.
3. **Something else** — if you had a different mechanism in mind when writing the spec, tell me and I'll build against that instead of guessing.

Not blocking §9 (frontend doesn't require this to exist). Not attempting a workaround without your call — this is a real "changes the architecture" decision per your own escalation rule, flagging it here rather than silently picking one.

---
