const notion = require('./notion');

const CADENCE_DAYS = {
  Daily: 1,
  'Twice a week': 3,
  Weekly: 7,
  Biweekly: 14,
  Monthly: 30,
  Quarterly: 90,
};

async function getItemsDueToday(registryItems) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  const dayOfMonth = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' });

  const completionHistory = await getCompletionHistory(30);
  const due = [];

  for (const item of registryItems) {
    if (!item.cadence || item.cadence === 'One-off') continue;
    if (item.status === 'Paused' || item.status === 'Archived') continue;

    const intervalDays = CADENCE_DAYS[item.cadence];
    if (!intervalDays) continue;

    if (item.cadence === 'Daily') {
      due.push(item);
      continue;
    }

    const lastDone = completionHistory.get(item.title);

    if (!lastDone) {
      const pattern = inferPatternFromHistory(item.title, completionHistory);
      if (pattern && pattern.preferredDay) {
        if (matchesPreferredDay(pattern, dayOfWeek, dayOfMonth)) {
          due.push(item);
        }
      } else {
        due.push(item);
      }
      continue;
    }

    const daysSinceDone = dateDiffDays(lastDone, today);
    if (daysSinceDone >= intervalDays) {
      due.push(item);
    }
  }

  return due;
}

async function getCompletionHistory(lookbackDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffISO = cutoff.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  try {
    const { Client } = require('@notionhq/client');
    const notionClient = new Client({ auth: process.env.NOTION_TOKEN });
    const res = await notionClient.databases.query({
      database_id: process.env.TASK_LOG_DB,
      filter: {
        and: [
          { property: 'Source', select: { equals: 'registry' } },
          { property: 'Status', select: { equals: 'done' } },
          { property: 'Date', date: { on_or_after: cutoffISO } },
        ],
      },
      sorts: [{ property: 'Date', direction: 'descending' }],
      page_size: 100,
    });

    const history = new Map();
    const allCompletions = new Map();

    for (const page of res.results) {
      const title = (page.properties.Task.title || []).map(t => t.plain_text).join('');
      const date = page.properties.Date.date ? page.properties.Date.date.start : null;
      if (!title || !date) continue;

      if (!history.has(title)) {
        history.set(title, date);
      }

      if (!allCompletions.has(title)) {
        allCompletions.set(title, []);
      }
      allCompletions.get(title).push(date);
    }

    history._allCompletions = allCompletions;
    return history;
  } catch (err) {
    console.error('Completion history error:', err.message);
    return new Map();
  }
}

function inferPatternFromHistory(title, history) {
  const allCompletions = history._allCompletions;
  if (!allCompletions || !allCompletions.has(title)) return null;

  const dates = allCompletions.get(title);
  if (dates.length < 2) return null;

  const dayNames = dates.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'long' }));
  const dayCount = {};
  for (const day of dayNames) {
    dayCount[day] = (dayCount[day] || 0) + 1;
  }

  let maxDay = null;
  let maxCount = 0;
  for (const [day, count] of Object.entries(dayCount)) {
    if (count > maxCount) {
      maxCount = count;
      maxDay = day;
    }
  }

  if (maxCount >= 2) {
    return { preferredDay: maxDay, confidence: maxCount / dates.length };
  }

  const dayOfMonthNums = dates.map(d => parseInt(new Date(d).toLocaleDateString('en-US', { day: 'numeric' })));
  const domCount = {};
  for (const dom of dayOfMonthNums) {
    domCount[dom] = (domCount[dom] || 0) + 1;
  }

  let maxDom = null;
  let maxDomCount = 0;
  for (const [dom, count] of Object.entries(domCount)) {
    if (count > maxDomCount) {
      maxDomCount = count;
      maxDom = parseInt(dom);
    }
  }

  if (maxDomCount >= 2) {
    return { preferredDayOfMonth: maxDom, confidence: maxDomCount / dates.length };
  }

  return null;
}

function matchesPreferredDay(pattern, dayOfWeek, dayOfMonth) {
  if (pattern.preferredDay && dayOfWeek === pattern.preferredDay) return true;
  if (pattern.preferredDayOfMonth && parseInt(dayOfMonth) === pattern.preferredDayOfMonth) return true;
  return false;
}

function dateDiffDays(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

module.exports = { getItemsDueToday };
