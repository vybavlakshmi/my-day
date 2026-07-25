const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const VOICES = {
  emma: 'en-US-EmmaNeural',
  jenny: 'en-US-JennyNeural',
};

// Returns a Node audio stream (webm/opus) in the given voice, ready to pipe to a response.
async function speak(text, voice = 'emma') {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICES[voice] || VOICES.emma, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
  const { audioStream } = await tts.toStream(text);
  return audioStream;
}

module.exports = { speak, VOICES };
