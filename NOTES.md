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
