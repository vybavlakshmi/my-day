const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

async function getUnreadEmails(maxResults = 10) {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults,
    });

    if (!res.data.messages || !res.data.messages.length) {
      return { needReply: [], readOnly: [] };
    }

    const emails = await Promise.all(
      res.data.messages.map(msg => getEmailSummary(msg.id))
    );

    const needReply = [];
    const readOnly = [];

    for (const email of emails) {
      if (!email) continue;
      if (isReplyNeeded(email)) {
        needReply.push(email);
      } else {
        readOnly.push(email);
      }
    }

    return { needReply, readOnly };
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
    return { needReply: [], readOnly: [], error: err.message };
  }
}

async function getEmailSummary(messageId) {
  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = res.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    const fromName = from.includes('<') ? from.split('<')[0].trim().replace(/"/g, '') : from;
    const fromEmail = from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from;

    return {
      id: messageId,
      from: fromName,
      fromEmail,
      subject,
      date,
      snippet: res.data.snippet || '',
    };
  } catch {
    return null;
  }
}

function isReplyNeeded(email) {
  const noReplyPatterns = [
    /noreply/i, /no-reply/i, /donotreply/i, /notification/i,
    /newsletter/i, /updates@/i, /alert@/i, /info@/i,
    /support@.*\.com/i, /billing@/i, /receipt/i, /invoice/i,
    /order.*confirm/i, /shipping.*update/i, /delivery.*update/i,
  ];

  const fromLower = (email.fromEmail || '').toLowerCase();
  const subjectLower = (email.subject || '').toLowerCase();

  for (const pattern of noReplyPatterns) {
    if (pattern.test(fromLower) || pattern.test(subjectLower)) return false;
  }

  return true;
}

module.exports = { getUnreadEmails };
