const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// Maya's spoken voice is Microsoft's "en-US-EmmaNeural" model — that model name
// is Microsoft's own identifier and can't be renamed, only the label we use for it.
const VOICES = {
  maya: 'en-US-EmmaNeural',
  jenny: 'en-US-JennyNeural',
};

// The connection uses SSML under the hood — unescaped &/</>/quotes in the text
// can break the request. Escape before sending, per the library's own guidance.
function escapeForSpeech(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Returns a Node audio stream (webm/opus) in the given voice, ready to pipe to a response.
async function speak(text, voice = 'maya') {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICES[voice] || VOICES.maya, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
  const { audioStream } = await tts.toStream(escapeForSpeech(text));
  return audioStream;
}

module.exports = { speak, VOICES };
