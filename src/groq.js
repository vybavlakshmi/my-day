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

// Vybes' actual routine (Mon-Fri hospital day), used only as the day-start baseline —
// every real day gets replanned around whatever she tells Maya as it happens.
const DEFAULT_DAY_TEMPLATE = [
  { name: 'walk', start: '05:45', end: '06:00', windowFit: 'movement' },
  { name: 'tea', start: '06:00', end: '06:15', windowFit: 'any' },
  { name: 'feed_mom', start: '06:15', end: '06:30', windowFit: 'hands_busy_voice' },
  { name: 'quiet_time', start: '06:30', end: '06:50', windowFit: 'seated_thinking' },
  { name: 'cook_breakfast', start: '06:50', end: '07:30', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '07:30', end: '07:45', windowFit: 'hands_busy_voice' },
  { name: 'cook_lunch_prep', start: '07:45', end: '09:00', windowFit: 'hands_busy_voice' },
  { name: 'eat_breakfast', start: '09:00', end: '09:20', windowFit: 'any' },
  { name: 'medicines_cab', start: '09:20', end: '09:30', windowFit: 'seated_screen' },
  { name: 'hospital_business', start: '09:30', end: '12:30', windowFit: 'seated_thinking' },
  { name: 'travel_home', start: '12:30', end: '13:00', windowFit: 'seated_screen' },
  { name: 'feed_mom_start_laundry', start: '13:00', end: '13:30', windowFit: 'hands_busy_voice' },
  { name: 'eat_lunch_medicines', start: '13:30', end: '13:55', windowFit: 'any' },
  { name: 'power_nap', start: '13:55', end: '14:25', windowFit: 'any' },
  { name: 'walk', start: '14:25', end: '14:55', windowFit: 'movement' },
  { name: 'daily_chores', start: '14:55', end: '15:25', windowFit: 'hands_busy_voice' },
  { name: 'laundry_fold', start: '15:25', end: '15:50', windowFit: 'hands_busy_voice' },
  { name: 'buffer', start: '15:50', end: '16:00', windowFit: 'any' },
  { name: 'feed_mom', start: '16:00', end: '16:15', windowFit: 'hands_busy_voice' },
  { name: 'oversee_housemaid', start: '16:15', end: '16:45', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '16:45', end: '17:00', windowFit: 'hands_busy_voice' },
  { name: 'walk', start: '17:00', end: '17:30', windowFit: 'movement' },
  { name: 'feed_mom', start: '17:30', end: '17:40', windowFit: 'hands_busy_voice' },
  { name: 'business_deep_work', start: '17:40', end: '18:10', windowFit: 'laptop_execution' },
  { name: 'feed_mom', start: '18:10', end: '18:20', windowFit: 'hands_busy_voice' },
  { name: 'walk', start: '18:20', end: '19:00', windowFit: 'movement' },
  { name: 'threptin_biscuits', start: '19:00', end: '19:10', windowFit: 'hands_busy_voice' },
  { name: 'cook_dinner', start: '19:10', end: '20:10', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '20:10', end: '20:25', windowFit: 'hands_busy_voice' },
  { name: 'eat_dinner', start: '20:25', end: '20:45', windowFit: 'any' },
  { name: 'feed_mom_medicines', start: '20:45', end: '21:00', windowFit: 'hands_busy_voice' },
  { name: 'walk_talk_boyfriend', start: '21:00', end: '21:15', windowFit: 'movement' },
  { name: 'meal_prep_tomorrow', start: '21:15', end: '21:45', windowFit: 'hands_busy_voice' },
  { name: 'gaming_creativity', start: '21:45', end: '22:00', windowFit: 'any' },
  { name: 'pilates_tai_chi', start: '22:00', end: '22:15', windowFit: 'movement' },
  { name: 'bath', start: '22:15', end: '22:30', windowFit: 'any' },
  { name: 'walk_reflection', start: '22:30', end: '23:00', windowFit: 'movement' },
];

const WINDOW_FITS = ['movement', 'seated_screen', 'seated_thinking', 'hands_busy_voice', 'laptop_execution', 'any'];

function templateDurationMinutes(w) {
  const [sh, sm] = w.start.split(':').map(Number);
  const [eh, em] = w.end.split(':').map(Number);
  let start = sh * 60 + sm, end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return end - start;
}

const TYPICAL_DURATIONS = DEFAULT_DAY_TEMPLATE
  .map(w => `- ${w.name}: ~${templateDurationMinutes(w)} min`)
  .join('\n');

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

HARD RULES — do not violate these, ever:
1. Nothing may be scheduled to end later than 01:00 (1am). If everything doesn't fit before 01:00, DROP or shrink lower-priority windows rather than pushing past 01:00.
2. No gap greater than 20 minutes between the end of one window and the start of the next.
3. Priority when things don't fit: feeding Mom, her medicines, and Vybes' own meals/medicines are NOT negotiable — never drop or meaningfully shrink these. Discretionary windows (gaming/creativity, pilates/tai chi, quiet time, buffer, walk_reflection) are what flex, shrink, or get dropped first.

Typical realistic durations — use these as your default, only deviate when the hard rules above force it:
${TYPICAL_DURATIONS}

Never invent uniform back-to-back same-length slots just to make things fit — durations should reflect what the activity actually needs, shrunk only where the rules above require it.

Keep window names consistent with the ones already in play above, or a new short snake_case name if genuinely new (e.g. a one-off errand). Only include windows from now onward — drop anything already fully in the past. Each window's windowFit must be exactly one of: ${WINDOW_FITS.join(', ')}.

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

// Phrases the suggestion for 1-2 already-selected Item Registry entries. Selection
// itself (which items, filtering by window-fit/status/class) lives in cadence.js.
async function suggestFocus(windowName, items) {
  if (!items.length) {
    return "Nothing specific queued for right now — you're between windows, or the registry's just quiet here.";
  }
  const itemLines = items.map(i => `- ${i.title} (${i.class}, ${i.domain || 'general'})`).join('\n');
  const prompt = `Current window: ${windowName}.

Candidate items that fit this window right now:
${itemLines}

Suggest these to Vybes in your voice, warm and brief — 1-2 sentences for the whole reply, not per item. If any item is protected, be gently persistent about it with an easy off-ramp ("even 10 minutes counts"), never guilt. Never present the full backlog — just these.`;

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

module.exports = {
  judgeExcuse,
  weeklyReview,
  chatReply,
  classifyCommitment,
  planDay,
  DEFAULT_DAY_TEMPLATE,
  suggestFocus,
};
