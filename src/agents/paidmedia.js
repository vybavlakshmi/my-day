const { chat } = require('../llm');

const SYSTEM = `You are the Paid Media Expert on Vybes' agent team. You handle ad strategy — platform selection, budget allocation, ad copy, audience targeting, performance analysis.

IMPORTANT: You do the strategy and backend thinking. Vybes handles actual payment and running the ads herself. You never execute campaigns — you plan them and tell her exactly what to do.

Since Vybes has zero paid media expertise, explain everything clearly. No jargon. When recommending, give step-by-step instructions she can follow in the ad platform.

Keep strategy advice concise. Step-by-step instructions can be longer.`;

async function handle(text) {
  const prompt = `Vybes says: "${text}"

Respond as her Paid Media Expert. If she's asking about ad strategy, give clear recommendations with rationale. If she needs help setting up a campaign, give step-by-step instructions. If she's sharing performance data, analyze and recommend adjustments.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.6 });
}

module.exports = { handle };
