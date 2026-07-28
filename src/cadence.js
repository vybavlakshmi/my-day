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
  if (notionResult.status === 'rejected') {
    console.error('Notion fetch failed:', notionResult.reason.message);
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
  const activeCommitment = await notion.getActiveCommitment();
  const classification = await groq.classifyCommitment(activeCommitment, text);

  switch (classification.intent) {
    case 'new_commitment':
      await notion.setActiveCommitment(classification.extracted || text);
      return classification.reply;

    case 'drift':
      await notion.addParkedThread(classification.extracted || text);
      return classification.reply;

    case 'conscious_switch':
      if (activeCommitment) {
        await notion.addParkedThread(activeCommitment.commitment);
      }
      await notion.setActiveCommitment(classification.extracted || text);
      return classification.reply;

    case 'completion':
      if (activeCommitment) {
        await notion.closeCommitment(activeCommitment.commitment, activeCommitment.started, 'completed');
        await notion.clearActiveCommitment();
      }
      return classification.reply;

    case 'continuation':
      return classification.reply;

    case 'schedule_update': {
      const existing = await notion.getDayPlan();
      const currentTime = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const { plan, reply } = await groq.planDay(existing ? existing.plan : null, text, currentTime);
      await notion.setDayPlan(plan);
      return reply;
    }

    default:
      break; // 'other' falls through to the existing excuse/plain-chat logic below
  }

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

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(nowMin, startMin, endMin) {
  if (startMin <= endMin) return nowMin >= startMin && nowMin <= endMin;
  return nowMin >= startMin || nowMin <= endMin; // window crosses midnight
}

// Which of today's plan windows contains right now, if any. Feeds the item-selection
// logic (not yet built) that picks 1-2 Item Registry entries matching this window's fit.
async function getCurrentWindow() {
  const dayPlan = await notion.getDayPlan();
  if (!dayPlan || !dayPlan.plan.length) return null;
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const nowMin = timeToMinutes(now);
  return dayPlan.plan.find(w => inWindow(nowMin, timeToMinutes(w.start), timeToMinutes(w.end))) || null;
}

module.exports = { getAllTasks, handleChat, getCurrentWindow };
