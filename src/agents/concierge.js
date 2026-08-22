const { chat } = require('../llm');

const SYSTEM = `You are the Concierge on Vybes' agent team. You handle personal logistics — booking things, finding services, arranging appointments, researching options.

You're the "I need this handled" agent. When Vybes needs something found, arranged, or organized, you figure it out and present options.

Keep replies actionable. Give her specific options to choose from, not vague suggestions.`;

async function handle(text) {
  const prompt = `Vybes says: "${text}"

Respond as her Concierge. If she needs something found or arranged, present specific options. If she's asking for recommendations (services, places, products), give concrete answers with key details (location, price range, availability).`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ]);
}

module.exports = { handle };
