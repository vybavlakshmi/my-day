const notion = require('./notion');
const calendar = require('./calendar');
const groq = require('./groq');

const PROTECTED_TASKS = ['Health block', 'Caregiver check-in', 'CAV — one post', 'Mental health / wind-down'];

const EXCUSE_KEYWORDS = [
  'sorry', "couldn't", 'could not', "didn't", 'did not', 'missed', 'skip',
  'skipped', 'forgot', 'busy', 'excuse', 'later', 'tomorrow', 'postpone',
];

const DIRECTION_PHRASES = [
  'what should i do', 'what now', "what's next", 'whats next',
  'what do i do', 'what next', 'what can i do', 'focus on',
];

// Day Schedule uses lowercase_snake window-fit names; Item Registry uses the
// capitalized-hyphenated names Vybes built the database with. These don't match
// as strings, so map explicitly rather than normalizing either one.
const WINDOW_FIT_MAP = {
  movement: 'Movement',
  seated_screen: 'Seated-screen',
  seated_thinking: 'Seated-thinking',
  hands_busy_voice: 'Hands-busy-voice',
  laptop_execution: 'Laptop-execution',
  any: 'Any',
};

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
  // Checked first, before commitment classification — "what should I do now" was
  // getting misread as a new_commitment ("Commitment: what should I do now") rather
  // than a request for a suggestion, since the classifier never saw this concept.
  if (isDirectionSeeking(text)) {
    const { windowName, items } = await getFocusItems();
    if (items.length) {
      await notion.logTaskEvent({
        task: items.map(i => i.title).join(' / '), source: 'registry', status: 'given',
        detail: `Suggested for window "${windowName}"`,
      });
    }
    return groq.suggestFocus(windowName, items);
  }

  const activeCommitment = await notion.getActiveCommitment();
  const classification = await groq.classifyCommitment(activeCommitment, text);

  switch (classification.intent) {
    case 'new_commitment':
      await notion.setActiveCommitment(classification.extracted || text);
      return classification.reply;

    case 'drift': {
      const thread = classification.extracted || text;
      await notion.addParkedThread(thread);
      await notion.logTaskEvent({
        task: thread, source: 'commitment', status: 'given',
        detail: `Drift from "${activeCommitment ? activeCommitment.commitment : '(none)'}": parked "${thread}"`,
      });
      return classification.reply;
    }

    case 'conscious_switch': {
      const newCommitment = classification.extracted || text;
      if (activeCommitment) {
        await notion.addParkedThread(activeCommitment.commitment);
      }
      await notion.setActiveCommitment(newCommitment);
      await notion.logTaskEvent({
        task: newCommitment, source: 'commitment', status: 'rescheduled',
        detail: `Conscious switch from "${activeCommitment ? activeCommitment.commitment : '(none)'}" to "${newCommitment}"`,
      });
      return classification.reply;
    }

    case 'completion':
      if (activeCommitment) {
        await notion.closeCommitment(activeCommitment.commitment, activeCommitment.started, 'completed');
        await notion.clearActiveCommitment();
        await notion.logTaskEvent({
          task: activeCommitment.commitment, source: 'commitment', status: 'done',
        });
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

    case 'grocery_add':
      if (classification.groceryItems.length) {
        await notion.addGroceryItems(classification.groceryItems);
      }
      return classification.reply;

    case 'creative_want_add':
      if (classification.creativeWant) {
        await notion.addCreativeWant(classification.creativeWant.title, classification.creativeWant.type, text);
      }
      return classification.reply;

    default:
      break; // 'other' falls through to the excuse/plain-chat logic below
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

// Which of today's plan windows contains right now, if any. Falls back to the
// default routine template when nobody's told Maya today's actual schedule yet —
// previously this just returned null every day until the first schedule_update
// message, which made the dashboard look empty/broken by default.
async function getCurrentWindow() {
  const dayPlan = await notion.getDayPlan();
  const plan = (dayPlan && dayPlan.plan.length) ? dayPlan.plan : groq.DEFAULT_DAY_TEMPLATE;
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const nowMin = timeToMinutes(now);
  return plan.find(w => inWindow(nowMin, timeToMinutes(w.start), timeToMinutes(w.end))) || null;
}

function isDirectionSeeking(text) {
  const lower = text.toLowerCase();
  return DIRECTION_PHRASES.some(p => lower.includes(p));
}

// A calendar event counts as "now-ish" if it's ongoing, or starts within the next
// hour — time-fixed commitments outrank everything else since they can't just be
// rescheduled by choice the way a registry item or brain-dump task can.
function isEventNowish(event, now) {
  if (!event.start) return false;
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return false;
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 30 * 60000);
  const soonWindow = new Date(start.getTime() - 60 * 60000);
  return now >= soonWindow && now <= end;
}

// Life Truth: max 3 discretionary things assigned per day during treatment. This is the
// concrete, countable half of that rule — it caps distinct NEGOTIABLE items (registry +
// notion brain-dump) introduced across the whole day, not per window. Calendar events and
// Protected registry items (caregiving/health essentials) are exempt — they're fixed
// obligations, not discretionary load, so they never count against or get blocked by this.
// NOT built here: the qualitative "360-analysis" (energy cost, timing, current load,
// sustainability) Life Truth also names. That needs real judgment, not a formula this
// codebase can fake — flagged in FOR_VYBES_REVIEW.md rather than approximated silently.
const DAILY_DISCRETIONARY_CAP = 3;

// Picks up to `limit` items for the current window, blended from 3 sources —
// Calendar (time-fixed, highest priority), Item Registry (protected before
// negotiable, excluding anything done today so completing one reveals the next —
// spec's "depth-one reveal"), and open Notion tasks (lowest priority fill).
async function getFocusItems(limit = 2) {
  const window = await getCurrentWindow();
  if (!window) return { windowName: null, items: [] };

  const [registry, doneToday, surfacedToday, calendarResult, notionResult] = await Promise.all([
    notion.getItemRegistry(),
    notion.getTodayDoneRegistryTitles(),
    notion.getTodaySurfacedRegistryTitles(),
    calendar.getTodayEvents().catch(err => { console.error('focus calendar fetch failed:', err.message); return []; }),
    notion.getOpenTasks(3).catch(err => { console.error('focus notion fetch failed:', err.message); return []; }),
  ]);

  const now = new Date();
  const calendarCandidates = calendarResult
    .filter(e => isEventNowish(e, now))
    .map(e => ({ title: e.title, class: 'Protected', source: 'calendar' }));

  // Titles already counted toward today's discretionary cap — a 'done' entry implies the
  // item was surfaced at some point today, so the two logs are unioned here.
  const negotiableCountedToday = new Set(
    [...doneToday, ...surfacedToday].filter(title => {
      const item = registry.find(r => r.title === title);
      return item && item.class === 'Negotiable';
    })
  );
  let capReached = negotiableCountedToday.size >= DAILY_DISCRETIONARY_CAP;

  const wantedFit = WINDOW_FIT_MAP[window.windowFit];
  const activeRegistry = registry.filter(item => item.status === 'Active' && !doneToday.has(item.title));
  const fitFilteredRegistry = window.windowFit === 'any'
    ? activeRegistry
    : activeRegistry.filter(item => item.windowFit.includes(wantedFit) || item.windowFit.includes('Any'));

  const registryCandidates = [];
  for (const item of fitFilteredRegistry) {
    if (item.class !== 'Negotiable') {
      registryCandidates.push({ title: item.title, class: item.class, source: 'registry' });
      continue;
    }
    if (negotiableCountedToday.has(item.title)) {
      registryCandidates.push({ title: item.title, class: item.class, source: 'registry' });
      continue;
    }
    if (capReached) continue; // new discretionary item, but today's 3 are already spent
    registryCandidates.push({ title: item.title, class: item.class, source: 'registry' });
    negotiableCountedToday.add(item.title);
    if (negotiableCountedToday.size >= DAILY_DISCRETIONARY_CAP) capReached = true;
    await notion.logRegistrySurfaced(item.title).catch(err => console.error('surfaced log failed:', err.message));
  }

  // Notion brain-dump tasks have no surfaced-tracking of their own yet, so once the cap is
  // spent they're suppressed entirely rather than risking an uncounted new item slipping
  // through — "when in doubt, don't assign it."
  const notionCandidates = capReached
    ? []
    : notionResult.map(t => ({ title: t.title, class: 'Negotiable', source: 'notion', id: t.id }));

  const priorityRank = c => {
    if (c.source === 'calendar') return 0;
    if (c.source === 'registry' && c.class === 'Protected') return 1;
    if (c.source === 'registry') return 2;
    return 3;
  };
  const candidates = [...calendarCandidates, ...registryCandidates, ...notionCandidates]
    .sort((a, b) => priorityRank(a) - priorityRank(b));

  return { windowName: window.name, items: candidates.slice(0, limit) };
}

module.exports = { getAllTasks, handleChat, getCurrentWindow, getFocusItems };
