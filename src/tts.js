const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function textToSpeech(text, voice = 'nova') {
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
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
