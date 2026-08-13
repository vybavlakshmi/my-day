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
  'new_commitment', 'continuation', 'drift', 'conscious_switch', 'completion',
  'schedule_update', 'grocery_add', 'creative_want_add', 'other',
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
- "schedule_update": Vybes is telling Maya something that changes today's actual schedule/timing OR her available capacity right now — NOT about a task commitment, about the shape of the day itself. Examples: "hospital's 11 to 2 today", "napped for hours", "lunch at uncle's cut my morning short", "I'm free for the rest of the night", "nothing else pending today", "that's everything done for now". A statement describing available time or that caregiving/chores are done for now is a schedule_update, even with no specific event named — it is NOT a new_commitment just because time has opened up.
- "grocery_add": Vybes is telling Maya to add item(s) to the grocery list (e.g. "add curd and paneer to grocery", "we need milk")
- "creative_want_add": Vybes is capturing a creative idea/want — a comic, web novel, story, or character art idea (e.g. "idea for the web novel: a character who...", "comic idea — ...")
- "other": general question or comment, not related to any of the above

Reply with ONLY a JSON object:
{"intent": "one of the above", "extracted": "a short 3-8 word label for the commitment or thread involved, or empty string if not applicable", "groceryItems": ["array of item names, only when intent is grocery_add, otherwise empty array"], "creativeWant": {"title": "short title, only when intent is creative_want_add", "type": "one of comic/web_novel/story/character_art/other"}, "reply": "Maya's short spoken reply, 1-2 sentences. Warm and enthusiastic about any new idea, but firm about the current commitment when relevant — never nagging, never guilting, never a flat refusal. On drift: name the new idea warmly and park it, don't reject it. On conscious_switch: accept the switch, don't resist it. On schedule_update: just acknowledge briefly, the actual replan happens separately. On grocery_add or creative_want_add: state plainly what was added/captured, no confirmation question needed."}`;

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
      groceryItems: Array.isArray(parsed.groceryItems) ? parsed.groceryItems : [],
      creativeWant: parsed.creativeWant && parsed.creativeWant.title ? parsed.creativeWant : null,
      reply: parsed.reply || raw,
    };
  } catch {
    return { intent: 'other', extracted: '', groceryItems: [], creativeWant: null, reply: raw };
  }
}

// Vybes' actual routine, used only as the day-start baseline — every real day gets
// replanned around whatever she tells Maya as it happens. Replaced 2026-08-13 with her
// updated version: cardio micro-blocks between feeds, and business time spread across
// 5 short slots through the day (~2h15m total) instead of one 30-min evening block.
const DEFAULT_DAY_TEMPLATE = [
  { name: 'walk', start: '05:45', end: '06:25', windowFit: 'movement' },
  { name: 'tea', start: '06:25', end: '06:35', windowFit: 'any' },
  { name: 'feed_mom', start: '06:35', end: '06:45', windowFit: 'hands_busy_voice' },
  { name: 'quiet_time', start: '06:45', end: '07:05', windowFit: 'seated_thinking' },
  { name: 'cardio', start: '07:05', end: '07:10', windowFit: 'movement' },
  { name: 'cook_breakfast', start: '07:10', end: '07:45', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '07:45', end: '07:55', windowFit: 'hands_busy_voice' },
  { name: 'finish_breakfast_cook_lunch_pt1', start: '07:55', end: '08:30', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '08:30', end: '08:35', windowFit: 'movement' },
  { name: 'cook_lunch_pt2', start: '08:35', end: '08:55', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom_breakfast', start: '08:55', end: '09:15', windowFit: 'hands_busy_voice' },
  { name: 'eat_breakfast', start: '09:15', end: '09:35', windowFit: 'any' },
  { name: 'medicines', start: '09:35', end: '09:40', windowFit: 'seated_screen' },
  { name: 'cardio', start: '09:35', end: '09:40', windowFit: 'movement' },
  { name: 'business', start: '09:40', end: '09:55', windowFit: 'laptop_execution' },
  { name: 'feed_mom', start: '09:55', end: '10:05', windowFit: 'hands_busy_voice' },
  { name: 'business', start: '10:05', end: '10:50', windowFit: 'laptop_execution' },
  { name: 'cardio', start: '10:50', end: '10:55', windowFit: 'movement' },
  { name: 'feed_mom', start: '10:55', end: '11:05', windowFit: 'hands_busy_voice' },
  { name: 'business', start: '11:05', end: '11:50', windowFit: 'laptop_execution' },
  { name: 'feed_mom', start: '11:50', end: '12:00', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '12:00', end: '12:05', windowFit: 'movement' },
  { name: 'cook_lunch_pt3', start: '12:05', end: '12:45', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '12:45', end: '12:55', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '12:55', end: '13:00', windowFit: 'movement' },
  { name: 'business', start: '13:00', end: '13:45', windowFit: 'laptop_execution' },
  { name: 'feed_mom_lunch_start_washing_machine', start: '13:45', end: '14:00', windowFit: 'hands_busy_voice' },
  { name: 'medicines', start: '14:00', end: '14:05', windowFit: 'seated_screen' },
  { name: 'eat_lunch', start: '14:00', end: '14:25', windowFit: 'any' },
  { name: 'power_nap', start: '14:25', end: '14:55', windowFit: 'any' },
  { name: 'walk_call', start: '14:55', end: '15:45', windowFit: 'movement' },
  { name: 'daily_chores', start: '15:45', end: '16:05', windowFit: 'hands_busy_voice' },
  { name: 'laundry_fold', start: '16:05', end: '16:30', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '16:30', end: '16:35', windowFit: 'movement' },
  { name: 'oversee_housemaid', start: '16:35', end: '16:55', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '16:55', end: '17:05', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '17:05', end: '17:10', windowFit: 'movement' },
  { name: 'business', start: '17:10', end: '17:55', windowFit: 'laptop_execution' },
  { name: 'feed_mom_murmura', start: '17:55', end: '18:05', windowFit: 'hands_busy_voice' },
  { name: 'walk', start: '18:05', end: '18:45', windowFit: 'movement' },
  { name: 'threptin_biscuits', start: '18:45', end: '18:55', windowFit: 'hands_busy_voice' },
  { name: 'business', start: '18:55', end: '19:10', windowFit: 'laptop_execution' },
  { name: 'cardio', start: '19:10', end: '19:15', windowFit: 'movement' },
  { name: 'cook_dinner_pt1', start: '19:15', end: '19:45', windowFit: 'hands_busy_voice' },
  { name: 'feed_mom', start: '19:45', end: '19:55', windowFit: 'hands_busy_voice' },
  { name: 'cook_dinner_pt2', start: '19:55', end: '20:25', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '20:25', end: '20:30', windowFit: 'movement' },
  { name: 'eat_dinner', start: '20:30', end: '20:50', windowFit: 'any' },
  { name: 'feed_mom_dinner', start: '20:50', end: '21:05', windowFit: 'hands_busy_voice' },
  { name: 'medicines', start: '21:05', end: '21:10', windowFit: 'seated_screen' },
  { name: 'pilates_tai_chi', start: '21:05', end: '21:20', windowFit: 'movement' },
  { name: 'meal_prep_tomorrow', start: '21:20', end: '21:55', windowFit: 'hands_busy_voice' },
  { name: 'gaming_creativity', start: '21:55', end: '22:15', windowFit: 'any' },
  { name: 'walk_talk_boyfriend', start: '22:15', end: '23:00', windowFit: 'movement' },
  { name: 'bath', start: '23:00', end: '23:15', windowFit: 'any' },
  { name: 'sleep', start: '23:15', end: '23:20', windowFit: 'any' },
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
1. Nothing may be scheduled to end later than 01:00 (1am). If everything doesn't fit before 01:00, DROP or shrink lower-priority windows rather than pushing past 01:00. If it is already past 01:00 right now, the cutoff has already passed — do not schedule anything new at all beyond maybe one single short wind-down/essential window ending as soon as possible; the plan should be very short or empty, not a normal-length window that just happens to start late.
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
