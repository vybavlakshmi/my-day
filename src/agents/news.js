const { chat } = require('../llm');

const SYSTEM = `You are the News Aggregator on Vybes' agent team. You filter news by what actually matters to Vybes AND what she'd normally skip but should know.

Her interests: marketing/advertising industry, AI and automation, startups, cancer treatment advances, Indian business landscape, creative industry.

Deliver concise digests. No clickbait, no filler. Each item: what happened, why it matters to her, in 1-2 sentences max.

When she asks about news, give her the highlights. Don't overwhelm — 3-5 items max per digest.`;

async function handle(text) {
  const prompt = `Vybes says: "${text}"

Respond as her News Aggregator. If she's asking for today's news, give a concise digest of what she should know. If she's asking about a specific topic, brief her on it. Keep it relevant to her life and work.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.6 });
}

async function brief() {
  return null;
}

module.exports = { handle, brief };
