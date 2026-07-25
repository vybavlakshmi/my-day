const notion = require('./notion');
const calendar = require('./calendar');
const groq = require('./groq');

const PROTECTED_TASKS = ['Health block', 'Caregiver check-in', 'CAV — one post', 'Mental health / wind-down'];

const EXCUSE_KEYWORDS = [
  'sorry', "couldn't", 'could not', "didn't", 'did not', 'missed', 'skip',
  'skipped', 'forgot', 'busy', 'excuse', 'later', 'tomorrow', 'postpone',
];

async function getAllTasks() {
  const [notionResult, calendarResult] = await Promise.allSettled([
    notion.getOpenTasks(3),
    calendar.getTodayEvents(),
  ]);
  if (calendarResult.status === 'rejected') {
    console.error('Calendar fetch failed:', calendarResult.reason.message);
  }
  const protectedTasks = PROTECTED_TASKS.map(title => ({ title, done: false }));
  return {
    protected: protectedTasks,
    notion: notionResult.status === 'fulfilled' ? notionResult.value : [],
    calendar: calendarResult.status === 'fulfilled' ? calendarResult.value : [],
  };
}

function findReferencedTask(text, tasks) {
  const lower = text.toLowerCase();
  const groups = [
    ['protected', tasks.protected],
    ['notion', tasks.notion],
    ['calendar', tasks.calendar],
  ];
  for (const [source, list] of groups) {
    for (const t of list) {
      const words = t.title.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
      if (words.some(w => lower.includes(w))) return { title: t.title, source };
    }
  }
  return null;
}

function looksLikeExcuse(text) {
  const lower = text.toLowerCase();
  return EXCUSE_KEYWORDS.some(k => lower.includes(k));
}

async function handleChat(text) {
  const tasks = await getAllTasks();
  const referenced = findReferencedTask(text, tasks);

  if (referenced && looksLikeExcuse(text)) {
    const ledger = await notion.getLedgerSummary();
    const { verdict, reply } = await groq.judgeExcuse(referenced.title, text, ledger);
    await notion.logExcuse({ task: referenced.title, excuse: text, verdict, reply });
    await notion.logTaskEvent({
      task: referenced.title,
      source: referenced.source,
      status: verdict === 'genuine' ? 'rescheduled' : 'missed',
    });
    return reply;
  }

  const summary = [...tasks.protected, ...tasks.notion, ...tasks.calendar]
    .map(t => `- ${t.title}`)
    .join('\n') || '(nothing on the list today)';
  return groq.chatReply(text, summary);
}

module.exports = { getAllTasks, handleChat };
