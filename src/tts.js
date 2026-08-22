const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function textToSpeech(text, voice = 'coral') {
  const response = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: text,
    instructions: 'Speak at a calm, measured pace. Warm and professional tone, like a trusted chief of staff giving a morning briefing. Pause briefly between sections.',
    response_format: 'mp3',
  });

  return Buffer.from(await response.arrayBuffer());
}

function stripMarkdown(text) {
  return text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/[─━═]/g, '')
    .replace(/[•→]/g, ', ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .trim();
}

module.exports = { textToSpeech, stripMarkdown };
