// Phase 1's original clock, confirmed by Vybes 2026-08-14 (corrected from an earlier
// mistaken assumption that the 90-Day Journey's Sept 1 was a new Day-1 reset — it isn't).
const PHASE_1_DAY_0 = '2026-07-25';

// Curated, not auto-synced from Notion. Deliberately a short, high-confidence list built
// from TVC Milestone Roadmap + the reworked Aug plan (2026-08-13) — NOT the full roadmap.
// Excludes items tied to the now-parked MOO plan (product fix-list, product video,
// faceless-to-founder switch) since MOO's dates no longer reflect reality; surfacing those
// here would repeat the exact stale-data mistake flagged in FOR_VYBES_REVIEW.md earlier
// this session. Re-curate by hand when the Map / Milestone Roadmap materially changes.
const MILESTONES = [
  { date: '2026-09-01', title: 'New product launch (reworked Aug plan)', track: 'Business', hard: false },
  { date: '2026-09-17', title: 'Day 60 trigger — TVC revenue check / career fork', track: 'Business/Career', hard: true },
  { date: '2026-11-10', title: '74→68kg physical target', track: 'Physical', hard: true },
  { date: '2026-11-15', title: 'Maya scope frozen, v1 built', track: 'Business', hard: false },
];

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function daysBetween(isoA, isoB) {
  return Math.round((new Date(`${isoB}T00:00:00Z`) - new Date(`${isoA}T00:00:00Z`)) / 86400000);
}

function formatDateShort(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// Returns a display-ready milestone status: which Phase 1 day it is, and the nearest
// not-yet-passed curated milestone. Deliberately just the display bar for now — this does
// NOT yet feed into getFocusItems()'s selection (the second half of what Vybes asked for);
// that's a separate, not-yet-built increment.
function getMilestoneStatus() {
  const today = todayIST();
  const dayNumber = daysBetween(PHASE_1_DAY_0, today);
  const upcoming = MILESTONES
    .filter(m => m.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  if (!upcoming) {
    return { display: `Day ${dayNumber} · Phase 1`, dayNumber, next: null };
  }

  const daysUntil = daysBetween(today, upcoming.date);
  const whenText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `${daysUntil} days`;
  const display = `Day ${dayNumber} · Phase 1 · next: ${upcoming.title}, ${whenText} (${formatDateShort(upcoming.date)})`;

  return {
    display,
    dayNumber,
    next: { title: upcoming.title, date: upcoming.date, daysUntil, track: upcoming.track, hard: upcoming.hard },
  };
}

module.exports = { getMilestoneStatus, PHASE_1_DAY_0, MILESTONES };
