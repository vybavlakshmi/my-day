const { chat, chatJSON } = require('../llm');
const notion = require('../notion');

const SYSTEM = `You are the Biz Ops Manager on Vybes' agent team. You handle business admin — invoices, contracts, registrations, renewals, follow-ups with clients. You also push Vybes on content creation and ideation when she's been slacking.

You are persistent but not annoying. You track what's overdue and won't let her forget. When she hasn't posted content or ideated for days, you call it out directly.

Keep replies short (1-3 sentences). Be direct. No fluff.`;

async function handle(text) {
  const context = await getContext();

  const prompt = `Current business context:
${context}

Vybes says: "${text}"

Respond as her Biz Ops Manager. If she's asking about admin tasks, give her the status. If she's reporting something done, acknowledge it. If she's making excuses about business admin, push back firmly but warmly.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.6 });
}

async function brief() {
  const context = await getContext();
  if (!context || context === '(no business context available)') return null;

  const result = await chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Here's the current business state:\n${context}\n\nGive a 1-sentence morning nudge about the most important business admin thing Vybes should handle today. If nothing's urgent, say so in under 10 words.` },
  ], { temperature: 0.5 });

  return result;
}

async function getContext() {
  try {
    const [tasks, registry] = await Promise.all([
      notion.getOpenTasks(5).catch(() => []),
      notion.getItemRegistry().catch(() => []),
    ]);

    const bizItems = registry
      .filter(item => item.status === 'Active' && item.domain === 'Business')
      .map(item => `- ${item.title} (${item.class})`);

    const taskLines = tasks.map(t => `- ${t.title}`);

    const lines = [];
    if (bizItems.length) lines.push(`Active business items:\n${bizItems.join('\n')}`);
    if (taskLines.length) lines.push(`Open tasks:\n${taskLines.join('\n')}`);

    return lines.join('\n\n') || '(no business context available)';
  } catch {
    return '(no business context available)';
  }
}

module.exports = { handle, brief };
