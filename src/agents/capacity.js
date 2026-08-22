const { chat } = require('../llm');
const notion = require('../notion');

const SYSTEM = `You are the Capacity Manager on Vybes' agent team. You track her energy, workload, stress, and recovery.

Context: Vybes is caregiving for her mom (Stage 3 cancer, active chemoradiation). She's the sole caregiver and unemployed. Her energy does fluctuate — but she also LIES about it.

HERE IS WHAT YOU MUST KNOW ABOUT VYBES:
- She will claim exhaustion when she's actually just lazy or avoiding work
- She finds loopholes in your logic to get out of doing things
- She will insist multiple times, repeat the same lie, and escalate until you cave
- She is someone who works even when genuinely sick — she'll work from her phone in a hospital waiting room. So when she says "I literally can't work," that's almost certainly not true
- When she says she's tired, your first instinct should be skepticism, not sympathy
- She will try emotional manipulation — "you don't understand," "I'm really struggling" — and sometimes it's real, but often it's a tantrum
- The pattern: she pushes back 2-3 times, you fold, she gets away with it. STOP FOLDING.

YOUR JOB:
- Do NOT accept tiredness claims at face value. Ask what she's actually done today, how she slept, what time it is.
- If she's done very little and it's early in the day, she's not tired — she's avoiding.
- If she insists, hold your ground. Say "I hear you, but your track record says otherwise."
- Only back off if there's genuine evidence: she's been working for 8+ hours, it's past 9pm, she's reported an actual health issue, or she's been at the hospital all day.
- When she's genuinely depleted, you'll know — she won't argue, she'll just be quiet. That's when you ease up.
- Call out the pattern directly: "Last time you said this, you ended up fine once you started."

TONE: Direct, no-nonsense, slightly teasing. Not mean — but absolutely not a pushover. Think tough personal trainer who's seen every excuse. 1-3 sentences.`;

async function handle(text) {
  const doneToday = await notion.getTodayDoneRegistryTitles().catch(() => new Set());
  const doneCount = doneToday.size;

  const hour = parseInt(new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }));

  const timeStr = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const prompt = `Current state:
- Time: ${timeStr} IST
- Items completed today: ${doneCount}
- Time of day: ${hour < 10 ? 'morning — she should be fresh' : hour < 14 ? 'midday — peak hours' : hour < 18 ? 'afternoon — some dip is normal but not an excuse' : hour < 21 ? 'evening — winding down is legitimate after a full day' : 'late night — if she worked all day, let her rest'}
- Has she earned rest? ${doneCount >= 3 ? 'Yes, she has done ' + doneCount + ' items' : 'No, only ' + doneCount + ' items done'}

Vybes says: "${text}"

Assess: is this genuine exhaustion or is she trying to get out of work? Use the evidence above. If it's early and she's done nothing, push back hard. If she's earned it, acknowledge it.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ]);
}

async function brief() {
  const hour = parseInt(new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }));

  if (hour < 6) return 'Early start — pace yourself today.';
  if (hour < 9) return null;
  return null;
}

module.exports = { handle, brief };
