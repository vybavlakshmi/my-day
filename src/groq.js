const Groq = require('groq-sdk');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

const MANAGER_VOICE = `You are Maya, a personal operations manager. You are warm but firm — you
hold Vybes accountable, you don't just nod along. You judge excuses on their merits, notice
repeated patterns, and push back on weak ones while accepting genuine ones gracefully.
You NEVER see or discuss health data — only task titles and excuse text.`;

async function judgeExcuse(task, excuse, ledger) {
  const ledgerSummary = (ledger || [])
    .map(e => `- "${e.task}": excuse "${e.excuse}" -> ${e.verdict}`)
    .join('\n') || '(no prior excuses on record)';

  const prompt = `Task missed: "${task}"
Excuse given: "${excuse}"

Past excuse history for context:
${ledgerSummary}

Judge this excuse. Reply with ONLY a JSON object: {"verdict": "genuine" or "weak", "reply": "a short spoken reply, 1-2 sentences, in Maya's voice"}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MANAGER_VOICE },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  });

  const raw = completion.choices[0].message.content;
  try {
    const parsed = JSON.parse(raw);
    return { verdict: parsed.verdict === 'genuine' ? 'genuine' : 'weak', reply: parsed.reply };
  } catch {
    return { verdict: 'weak', reply: raw };
  }
}

async function weeklyReview(log) {
  const logSummary = (log || [])
    .map(e => `- "${e.task}": ${e.done ? 'done' : 'missed'}${e.excuse ? ` (excuse: "${e.excuse}")` : ''}`)
    .join('\n') || '(no tasks logged this week)';

  const prompt = `Here is this week's task log:
${logSummary}

Write exactly 3 short lines:
1. What slipped
2. The pattern behind it
3. What to change next week

No preamble, just the 3 lines.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MANAGER_VOICE },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
  });

  return completion.choices[0].message.content.trim();
}

async function chatReply(text, tasksSummary) {
  const prompt = `Today's open tasks:
${tasksSummary}

Vybes says: "${text}"

Reply naturally as Maya, 1-3 sentences. This is a plain question or comment, not an excuse to judge.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MANAGER_VOICE },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  });

  return completion.choices[0].message.content.trim();
}

const COMMITMENT_INTENTS = [
  'new_commitment', 'continuation', 'drift', 'conscious_switch', 'completion', 'schedule_update', 'other',
];

// The Commitment-Keeper core: classifies what an incoming message means for the
// current active commitment, and drafts Maya's reply in the same call.
async function classifyCommitment(activeCommitment, message) {
  const contextLine = activeCommitment
    ? `Current active commitment: "${activeCommitment.commitment}" (started ${activeCommitment.started || 'recently'}).`
    : 'No active commitment right now.';

  const prompt = `${contextLine}

Vybes just said: "${message}"

Classify this message as exactly one of:
- "new_commitment": there is no active commitment, and this states a fresh intent to commit to something
- "continuation": this is about progressing or discussing the current active commitment, not a new topic
- "drift": there IS an active commitment, and this introduces a different new task or idea (a tangent)
- "conscious_switch": Vybes is explicitly saying the new thing should replace the current commitment right now (e.g. "actually let's do X instead", "no this is more important")
- "completion": Vybes is saying the current active commitment is finished or done
- "schedule_update": Vybes is telling Maya something that changes today's actual schedule/timing (e.g. "hospital's 11 to 2 today", "napped for hours", "lunch at uncle's cut my morning short") — NOT about a task commitment, about the shape of the day itself
- "other": general question or comment, not related to any of the above

Reply with ONLY a JSON object:
{"intent": "one of the above", "extracted": "a short 3-8 word label for the commitment or thread involved, or empty string if intent is schedule_update or other", "reply": "Maya's short spoken reply, 1-2 sentences. Warm and enthusiastic about any new idea, but firm about the current commitment when relevant — never nagging, never guilting, never a flat refusal. On drift: name the new idea warmly and park it, don't reject it. On conscious_switch: accept the switch, don't resist it. On schedule_update: just acknowledge briefly, the actual replan happens separately."}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MANAGER_VOICE },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  });

  const raw = completion.choices[0].message.content;
  try {
    const parsed = JSON.parse(raw);
    return {
      intent: COMMITMENT_INTENTS.includes(parsed.intent) ? parsed.intent : 'other',
      extracted: parsed.extracted || '',
      reply: parsed.reply || raw,
    };
  } catch {
    return { intent: 'other', extracted: '', reply: raw };
  }
}

const DEFAULT_DAY_TEMPLATE = [
  { name: 'cook', start: '06:30', end: '09:00', windowFit: 'hands_busy_voice' },
  { name: 'cab_to_hospital', start: '09:15', end: '09:40', windowFit: 'seated_screen' },
  { name: 'hospital', start: '10:00', end: '12:00', windowFit: 'seated_thinking' },
  { name: 'cab_home', start: '12:30', end: '13:00', windowFit: 'seated_screen' },
  { name: 'settle', start: '13:00', end: '16:30', windowFit: 'any' },
  { name: 'nap_fork', start: '16:30', end: '16:30', windowFit: 'any' },
  { name: 'fragile_hour', start: '18:30', end: '19:30', windowFit: 'any' },
  { name: 'dinner_prep', start: '19:30', end: '21:30', windowFit: 'hands_busy_voice' },
  { name: 'own_dinner', start: '21:30', end: '23:30', windowFit: 'any' },
  { name: 'cleanup', start: '23:30', end: '00:30', windowFit: 'hands_busy_voice' },
  { name: 'midnight_desk', start: '00:30', end: '02:00', windowFit: 'laptop_execution' },
];

const WINDOW_FITS = ['movement', 'seated_screen', 'seated_thinking', 'hands_busy_voice', 'laptop_execution', 'any'];

// Re-works the remaining windows of today given a plain-language update from Vybes.
// Not a formula — a reasoning call, since it has to judge how e.g. a long nap or a
// shortened cook window ripples into what follows. Expect real iteration here.
async function planDay(existingPlan, updateMessage, currentTime) {
  const planLines = (existingPlan && existingPlan.length ? existingPlan : DEFAULT_DAY_TEMPLATE)
    .map(w => `- ${w.name}: ${w.start}-${w.end} (${w.windowFit})`)
    .join('\n');

  const prompt = `It is currently ${currentTime} (Asia/Kolkata, 24-hour time).

${existingPlan && existingPlan.length ? "Today's current plan for the rest of the day" : "No plan exists yet today — this is the default template"}:
${planLines}

Vybes just said: "${updateMessage}"

Re-work the remaining windows for today based on this update. Use judgment on how it ripples into what follows — e.g. a long nap shrinks or delays what comes after it, a shortened cook window just shrinks that one window. Don't blindly shift every later window by the same amount.

Keep each window's duration realistic for what it actually is (dinner prep needs real time, not a token slot) — if there genuinely isn't enough time left for everything, DROP or MERGE lower-priority windows rather than compressing every window to a uniform short block. Never invent uniform back-to-back 1-hour slots just to fit everything in.

If it is already very late (post-midnight, early hours) and a lot of the evening hasn't happened yet, don't force-cram the full remaining routine into the few hours before dawn — it's fine and often correct for the plan to be short (e.g. just a wind-down/rest window), with a reply that names the tradeoff plainly rather than pretending a full evening still fits.

Keep window names simple (cook, cab_to_hospital, hospital, cab_home, settle, nap_fork, fragile_hour, dinner_prep, own_dinner, cleanup, midnight_desk, or a new name if genuinely new). Only include windows from now onward — drop anything already fully in the past. Each window's windowFit must be exactly one of: ${WINDOW_FITS.join(', ')}.

Reply with ONLY a JSON object:
{"plan": [{"name": "...", "start": "HH:MM", "end": "HH:MM", "windowFit": "..."}], "reply": "Maya's short spoken confirmation, 1-2 sentences"}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MANAGER_VOICE },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const raw = completion.choices[0].message.content;
  try {
    const parsed = JSON.parse(raw);
    const plan = Array.isArray(parsed.plan)
      ? parsed.plan.filter(w => w.name && w.start && w.end && WINDOW_FITS.includes(w.windowFit))
      : [];
    return { plan, reply: parsed.reply || raw };
  } catch {
    return { plan: existingPlan || [], reply: raw };
  }
}

module.exports = {
  judgeExcuse,
  weeklyReview,
  chatReply,
  classifyCommitment,
  planDay,
  DEFAULT_DAY_TEMPLATE,
};
