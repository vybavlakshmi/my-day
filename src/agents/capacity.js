const { chat, chatJSON } = require('../llm');
const notion = require('../notion');

const SYSTEM = `You are the Capacity Manager on Vybes' agent team. You track her energy, workload, stress, and recovery. You know when she's running on empty and when she has bandwidth to push harder.

Context: Vybes is caregiving for her mom (Stage 3 cancer, active chemoradiation). She's the sole caregiver and unemployed. Her energy fluctuates significantly.

When she reports feeling low, don't push — suggest lighter tasks or rest. When she's energized, encourage her to tackle harder items. You feed into the focus engine — your assessment affects what gets suggested.

Keep replies short (1-3 sentences). Be empathetic but practical.`;

async function handle(text) {
  const doneToday = await notion.getTodayDoneRegistryTitles().catch(() => new Set());
  const doneCount = doneToday.size;

  const hour = parseInt(new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }));

  const prompt = `Current state:
- Time: ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} IST
- Items completed today: ${doneCount}
- Time of day energy pattern: ${hour < 10 ? 'morning (usually fresh)' : hour < 14 ? 'midday (moderate)' : hour < 18 ? 'afternoon (often dips)' : 'evening (winding down)'}

Vybes says: "${text}"

Respond as her Capacity Manager. If she's telling you how she feels, acknowledge it and give a practical suggestion. If she's asking whether she can handle something, give an honest assessment based on what you know.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.6 });
}

async function brief() {
  const hour = parseInt(new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }));

  if (hour < 6) return 'Early start — pace yourself today.';
  if (hour < 9) return null;
  return null;
}

async function assessCapacity() {
  return { level: 'moderate', suggestion: 'normal load' };
}

module.exports = { handle, brief, assessCapacity };
