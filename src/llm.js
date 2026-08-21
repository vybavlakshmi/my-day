const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

async function chat(messages, options = {}) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.6,
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return completion.choices[0].message.content.trim();
}

async function chatJSON(messages, options = {}) {
  const raw = await chat(messages, { ...options, json: true });
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { chat, chatJSON, MODEL };
