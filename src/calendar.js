const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Today's events, Asia/Kolkata, turned into task-shaped items for the Calendar card.
async function getTodayEvents() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: 'Asia/Kolkata',
  });

  return (res.data.items || []).map(event => ({
    title: event.summary || '(untitled event)',
    done: false,
    start: event.start ? (event.start.dateTime || event.start.date) : null,
    end: event.end ? (event.end.dateTime || event.end.date) : null,
  }));
}

module.exports = { getTodayEvents };
