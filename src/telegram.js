const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, options = {}) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (options.replyMarkup) body.reply_markup = JSON.stringify(options.replyMarkup);
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function setWebhook(url) {
  const res = await fetch(`${API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

async function getWebhookInfo() {
  const res = await fetch(`${API}/getWebhookInfo`);
  return res.json();
}

function extractMessage(update) {
  const msg = update.message || update.callback_query?.message;
  if (!msg) return null;
  return {
    chatId: msg.chat.id,
    text: update.callback_query?.data || msg.text || '',
    userId: (update.callback_query?.from || msg.from)?.id,
    firstName: (update.callback_query?.from || msg.from)?.first_name || '',
    isCallback: !!update.callback_query,
    callbackId: update.callback_query?.id,
  };
}

async function answerCallback(callbackId) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId }),
  });
}

async function sendVoice(chatId, audioBuffer) {
  const boundary = '----MayaBrief' + Date.now();
  const CRLF = '\r\n';

  const chatIdPart = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}` +
    `${chatId}${CRLF}`
  );

  const voiceHeader = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="voice"; filename="brief.mp3"${CRLF}` +
    `Content-Type: audio/mpeg${CRLF}${CRLF}`
  );

  const voiceFooter = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

  const body = Buffer.concat([chatIdPart, voiceHeader, audioBuffer, voiceFooter]);

  const res = await fetch(`${API}/sendVoice`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  return res.json();
}

module.exports = { sendMessage, sendVoice, setWebhook, getWebhookInfo, extractMessage, answerCallback };
