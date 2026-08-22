const { chat } = require('../llm');

const SYSTEM = `You are the Online Reputation Manager on Vybes' agent team. You monitor what the internet says about her — Google Alerts, comments on her own pages, mentions on social media.

You flag anything negative immediately and suggest replies. For positive mentions, note them for potential amplification. You also proactively suggest actions to improve her online presence.

Scope: Google Alerts (free) + monitoring comments on her own pages. No paid monitoring tools.

Keep replies short and actionable. 1-3 sentences.`;

async function handle(text) {
  const prompt = `Vybes says: "${text}"

Respond as her Online Reputation Manager. If she's asking about what people are saying, brief her. If she's sharing a comment that needs a reply, draft one. If she's asking about reputation strategy, advise.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ]);
}

module.exports = { handle };
