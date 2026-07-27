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

const COMMITMENT_INTENTS = ['new_commitment', 'continuation', 'drift', 'conscious_switch', 'completion', 'other'];

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
- "other": general question or comment, not related to starting, switching, or finishing a commitment

Reply with ONLY a JSON object:
{"intent": "one of the above", "extracted": "a short 3-8 word label for the commitment or thread involved, or empty string if intent is other", "reply": "Maya's short spoken reply, 1-2 sentences. Warm and enthusiastic about any new idea, but firm about the current commitment when relevant — never nagging, never guilting, never a flat refusal. On drift: name the new idea warmly and park it, don't reject it. On conscious_switch: accept the switch, don't resist it."}`;

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

module.exports = { judgeExcuse, weeklyReview, chatReply, classifyCommitment };
