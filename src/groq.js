const Groq = require('groq-sdk');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

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
  'schedule_update', 'grocery_add', 'creative_want_add', 'carry_forward', 'other',
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
- "carry_forward": Vybes is saying something planned for today or recently didn't get done, isn't finished yet, or needs to move to tomorrow. Key signals: "didn't finish", "couldn't get to", "still need to", "carry over", "not done yet", "incomplete", "still pending", "tomorrow instead". This is about an unfinished TASK — if she's reporting what DID happen (like "hospital was 11 to 2"), that's schedule_update. If she's starting something new, that's new_commitment.
- "other": general question or comment, not related to any of the above

Reply with ONLY a JSON object:
{"intent": "one of the above", "extracted": "a short 3-8 word label for the commitment or thread involved, or empty string if not applicable", "groceryItems": ["array of item names, only when intent is grocery_add, otherwise empty array"], "creativeWant": {"title": "short title, only when intent is creative_want_add", "type": "one of comic/web_novel/story/character_art/other"}, "reply": "Maya's short spoken reply, 1-2 sentences. Warm and enthusiastic about any new idea, but firm about the current commitment when relevant — never nagging, never guilting, never a flat refusal. On drift: name the new idea warmly and park it, don't reject it. On conscious_switch: accept the switch, don't resist it. On schedule_update: just acknowledge briefly, the actual replan happens separately. On grocery_add or creative_want_add: state plainly what was added/captured, no confirmation question needed. On carry_forward: acknowledge what didn't get done without guilt, name it clearly, and say it'll carry to tomorrow."}`;

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
// replanned around whatever she tells Maya as it happens. Replaced 2026-08-14 (second
// revision same day): day now starts 5:00, no feed_mom windows at all (prior versions
// all had ~8/day — batch-prepped snacks instead, per her update), and business time is
// ~5h20m spread across 11 slots across two named streams (business_1/business_2)
// instead of the 5-slot ~2h15m version from earlier today.
const DEFAULT_DAY_TEMPLATE = [
  { name: 'tea', start: '05:00', end: '05:10', windowFit: 'any' },
  { name: 'walk_30', start: '05:10', end: '05:40', windowFit: 'movement' },
  { name: 'quiet_time', start: '05:40', end: '06:00', windowFit: 'seated_thinking' },
  { name: 'business_1', start: '06:00', end: '06:30', windowFit: 'laptop_execution' },
  { name: 'cook_batch_pt1', start: '06:30', end: '07:20', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '07:20', end: '07:22', windowFit: 'movement' },
  { name: 'cook_batch_pt2_box_moms_snacks', start: '07:22', end: '08:30', windowFit: 'hands_busy_voice' },
  { name: 'eat_breakfast', start: '08:30', end: '08:50', windowFit: 'any' },
  { name: 'walk_30', start: '08:50', end: '09:20', windowFit: 'movement' },
  { name: 'medicines', start: '09:20', end: '09:25', windowFit: 'seated_screen' },
  { name: 'daily_chores', start: '09:20', end: '09:40', windowFit: 'hands_busy_voice' },
  { name: 'business_1', start: '09:40', end: '10:20', windowFit: 'laptop_execution' },
  { name: 'cardio', start: '10:20', end: '10:22', windowFit: 'movement' },
  { name: 'dry_fold_laundry', start: '10:22', end: '10:47', windowFit: 'hands_busy_voice' },
  { name: 'business_1', start: '10:47', end: '11:27', windowFit: 'laptop_execution' },
  { name: 'walk_30', start: '11:27', end: '11:57', windowFit: 'movement' },
  { name: 'business_1', start: '11:57', end: '12:37', windowFit: 'laptop_execution' },
  { name: 'gaming_creativity', start: '12:37', end: '12:57', windowFit: 'any' },
  { name: 'cardio', start: '12:57', end: '12:59', windowFit: 'movement' },
  { name: 'business_1', start: '12:59', end: '13:29', windowFit: 'laptop_execution' },
  { name: 'eat_lunch', start: '13:29', end: '13:54', windowFit: 'any' },
  { name: 'power_nap', start: '13:54', end: '14:24', windowFit: 'any' },
  { name: 'walk_call', start: '14:24', end: '14:54', windowFit: 'movement' },
  { name: 'business_1', start: '14:54', end: '15:34', windowFit: 'laptop_execution' },
  { name: 'buffer', start: '15:34', end: '15:46', windowFit: 'any' },
  { name: 'cardio', start: '15:46', end: '15:48', windowFit: 'movement' },
  { name: 'business_2', start: '15:48', end: '16:16', windowFit: 'laptop_execution' },
  { name: 'business_2', start: '16:16', end: '16:30', windowFit: 'laptop_execution' },
  { name: 'oversee_housemaid', start: '16:30', end: '17:00', windowFit: 'hands_busy_voice' },
  { name: 'walk_30', start: '17:00', end: '17:30', windowFit: 'movement' },
  { name: 'business_2', start: '17:30', end: '18:00', windowFit: 'laptop_execution' },
  { name: 'business_1', start: '18:00', end: '18:20', windowFit: 'laptop_execution' },
  { name: 'cardio', start: '18:20', end: '18:22', windowFit: 'movement' },
  { name: 'business_2', start: '18:22', end: '18:30', windowFit: 'laptop_execution' },
  { name: 'cook_dinner_pt1', start: '18:30', end: '19:30', windowFit: 'hands_busy_voice' },
  { name: 'cardio', start: '19:30', end: '19:32', windowFit: 'movement' },
  { name: 'cook_dinner_pt2', start: '19:32', end: '20:30', windowFit: 'hands_busy_voice' },
  { name: 'eat_dinner', start: '20:30', end: '20:55', windowFit: 'any' },
  { name: 'medicines', start: '20:55', end: '21:00', windowFit: 'seated_screen' },
  { name: 'pilates_tai_chi', start: '20:55', end: '21:10', windowFit: 'movement' },
  { name: 'meal_prep_pt1', start: '21:10', end: '21:30', windowFit: 'hands_busy_voice' },
  { name: 'gaming_creativity_pt2', start: '21:30', end: '21:50', windowFit: 'any' },
  { name: 'walk_talk_boyfriend', start: '21:50', end: '22:20', windowFit: 'movement' },
  { name: 'meal_prep_pt2', start: '22:20', end: '22:40', windowFit: 'hands_busy_voice' },
  { name: 'meal_prep_pt3', start: '22:40', end: '23:00', windowFit: 'hands_busy_voice' },
  { name: 'walk_30', start: '23:00', end: '23:30', windowFit: 'movement' },
  { name: 'bath', start: '23:30', end: '23:45', windowFit: 'any' },
  { name: 'sleep', start: '23:45', end: '23:50', windowFit: 'any' },
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
async function suggestFocus(windowName, items, context = {}) {
  if (!items.length) {
    return "Nothing specific queued for right now — you're between windows, or the registry's just quiet here.";
  }
  const { milestone, doneCount = 0, currentTime, activeCommitment } = context;
  const itemLines = items.map(i => `- ${i.title} (${i.class}, ${i.domain || 'general'})`).join('\n');

  let capacityBlock = '';
  if (currentTime) capacityBlock += `Current time: ${currentTime} IST. `;
  if (doneCount > 0) capacityBlock += `Items completed today: ${doneCount}. `;
  if (activeCommitment) capacityBlock += `Active commitment: "${activeCommitment}". `;
  if (milestone && milestone.daysUntil <= 14) {
    capacityBlock += `Upcoming milestone: "${milestone.title}" in ${milestone.daysUntil} days (${milestone.track}) — if any item relates, give it extra weight.`;
  }

  const prompt = `Current window: ${windowName}.
${capacityBlock ? `\nContext: ${capacityBlock}\n` : ''}
Candidate items that fit this window right now:
${itemLines}

Before suggesting, quickly assess: given the time of day${doneCount > 0 ? ` and ${doneCount} item${doneCount > 1 ? 's' : ''} already done` : ''}, does Vybes realistically have capacity for these right now? If it's late evening and she's had a full day, suggest winding down instead of pushing more. If she has capacity, suggest the items — warm and brief, 1-2 sentences for the whole reply. If any item is protected, be gently persistent with an easy off-ramp ("even 10 minutes counts"), never guilt. Never present the full backlog — just these.`;

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
