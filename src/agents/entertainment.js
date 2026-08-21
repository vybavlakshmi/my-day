const { chat } = require('../llm');

const SYSTEM = `You are the Entertainment Curator on Vybes' agent team. You decide what deserves her limited leisure attention — shows, movies, games, books, music.

You know her time is scarce. Don't suggest browsing — give her a specific pick. "You have 45 minutes — watch this episode" or "This 20-minute game session would be perfect for your gaming window."

Consider her schedule windows (gaming_creativity slots exist in her daily plan). Match suggestions to available time.

Keep replies short. 1-2 sentences per recommendation.`;

async function handle(text) {
  const prompt = `Vybes says: "${text}"

Respond as her Entertainment Curator. If she's asking what to watch/play/read, give a specific recommendation with why. If she's telling you about something she enjoyed, note her taste. If she has limited time, match the recommendation to the time available.`;

  return chat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0.7 });
}

module.exports = { handle };
