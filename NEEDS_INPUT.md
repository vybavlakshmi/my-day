# Needs input from Vybes

Questions blocked on her, logged with enough context to answer without re-reading the whole session. None of these block other work — each is noted as such.

---

## 1. `item_registry.csv` doesn't exist
You referenced this as an attached file when kicking off the autonomous build. It's not present anywhere in the working directory (checked). Not a blocker — the live Notion "Item Registry" database is already built, populated with your real ~60 items, connected to the integration, and fully wired into the app. If the CSV was meant to be a *different* or *updated* source, let me know and I'll reconcile; otherwise no action needed.

## 2. Roadmap (dated milestones)
Spec §7 lists this as needed for the §9 milestone countdown ("127 days until first Effie submission"-style), explicitly noting it's "not yet built by Vybes." Needed: your dated milestones (first post → Effie → conglomerate, or whatever the current real sequence is). Until this exists, the milestone bar in §9 will render a neutral "no roadmap set" state instead of a countdown — not blocking the rest of §9.

## 3. Relationship map
Spec §7: "close people + how to communicate with them (definition pending from Vybes)." Needed: who counts as close people for this, and what "how to communicate with them" should actually capture (tone preferences? contact frequency? something else?) — the spec flags the definition itself as undecided, not just the data. Not blocking anything else in the current build order.

## 4. Compiled life plan
Spec §7: "single reconciled priority document, written by Vybes, sits above everything else Maya reads. Not yet delivered." This is explicitly your document to write, not mine to draft. Not blocking anything else in the current build order.

## 5. §8 App-launching conflicts with the hosting architecture — needs a decision, not just data
Spec §8: "Maya can be asked to open local tools directly — e.g., 'let's finish that reel' → Maya opens the reel editor from local files." The backend runs on **Vercel serverless** (cloud). It has no access to your laptop's filesystem and no way to launch a local application on your machine — a cloud function physically cannot do this. This isn't a missing-data problem like the others above, it's an architecture gap the spec didn't account for.

Real options, for when you're back:
1. **A local companion process** on your laptop that polls Maya's backend (or listens for a webhook) and launches apps locally when told to. Real infra work, a second thing to keep running.
2. **Drop this feature** — have Maya name the tool/file to open and tell you to open it yourself, rather than actually launching it.
3. **Something else** — if you had a different mechanism in mind when writing the spec, tell me and I'll build against that instead of guessing.

Not blocking §9 (frontend doesn't require this to exist). Not attempting a workaround without your call — this is a real "changes the architecture" decision per your own escalation rule, flagging it here rather than silently picking one.

---
