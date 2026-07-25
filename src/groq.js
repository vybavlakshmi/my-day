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

module.exports = { judgeExcuse, weeklyReview, chatReply };
