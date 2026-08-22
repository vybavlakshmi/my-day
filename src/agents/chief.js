const { chatJSON } = require('../llm');
const cadence = require('../cadence');
const notion = require('../notion');
const milestones = require('../milestones');
const calendar = require('../calendar');
const weather = require('../weather');
const gmail = require('../gmail');

const AGENTS = {
  maya: 'Focus, commitments, schedule, excuses — the core engine',
  bizops: 'Business admin, content accountability, follow-ups, invoices, ideation pushes',
  capacity: 'Energy levels, workload, recovery, bandwidth assessment',
  sales: 'Freelance gigs, job opportunities, pitch ideas',
  nutrition: 'Meal planning, grocery lists, cooking with available ingredients',
  lifeops: 'Household admin, appointments, errands, prescriptions, personal admin',
  comms: 'Drafting difficult messages, triaging incoming communications',
  news: 'Daily news briefing, industry updates',
  social: 'Content calendar, social media posting, repurposing',
  networking: 'Relationship tracking, follow-ups with contacts (personal + professional)',
  reputation: 'Online reputation monitoring, comment replies, brand presence',
  paidmedia: 'Ad strategy, campaign planning, audience targeting',
  entertainment: 'Leisure recommendations — shows, games, books',
  concierge: 'Personal logistics, booking, finding services',
  fashion: 'Clothing inventory, outfit planning, style advice',
};

const ROUTE_PROMPT = `You are the Chief of Staff — Vybes' single point of contact. Your job is to figure out which specialist agent should handle her message and route it there.

Available agents:
${Object.entries(AGENTS).map(([k, v]) => `- "${k}": ${v}`).join('\n')}

Rules:
- If the message is about focus, what to do next, commitments, schedule changes, excuses, or general chat → "maya"
- If the message could fit multiple agents, pick the most relevant one
- If it's a greeting or small talk, route to "maya"
- If she's asking for her morning brief, route to "brief" (special command)
- If she's asking about energy, tiredness, capacity, or how much she can handle → "capacity"
- If she's asking about money, jobs, freelance, opportunities → "sales"
- If she's asking about food, cooking, meals, groceries → "nutrition"
- If she's asking about what to watch, play, read → "entertainment"
- If she's asking to draft a message, email, reply → "comms"
- If she's asking about posting, content, social media → "social"
- If she's asking about ads, campaigns, marketing spend → "paidmedia"
- If she's asking about household, errands, appointments, prescriptions → "lifeops"
- If she's asking about contacts, people, relationships, networking → "networking"
- If she's asking about reputation, reviews, what people say about her → "reputation"
- If she's asking about clothes, outfit, style, what to wear → "fashion"
- If she's asking to book, find, arrange something → "concierge"
- Business admin, invoices, registrations, follow-ups, "I haven't posted in days" → "bizops"

Reply with ONLY a JSON object: {"agent": "agent_key", "reason": "one-line reason"}`;

async function route(message) {
  const result = await chatJSON([
    { role: 'system', content: ROUTE_PROMPT },
    { role: 'user', content: message },
  ]);

  if (result && AGENTS[result.agent]) return result.agent;
  if (result && result.agent === 'brief') return 'brief';
  return 'maya';
}

async function handleMessage(text) {
  const agentKey = await route(text);

  if (agentKey === 'brief') return generateBrief();
  if (agentKey === 'maya') return cadence.handleChat(text);

  const agent = loadAgent(agentKey);
  if (agent) return agent.handle(text);

  return cadence.handleChat(text);
}

function loadAgent(key) {
  try {
    return require(`./${key}`);
  } catch {
    return null;
  }
}

const PHASE1_DAY0 = new Date('2026-07-25');

function getPhase1DayNumber() {
  const now = new Date();
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  return Math.floor((today - PHASE1_DAY0) / (1000 * 60 * 60 * 24));
}

function getMonthlyGoal() {
  const dayNum = getPhase1DayNumber();

  if (dayNum <= 10) {
    return 'Posts 1-20 live on Instagram (2/day). Product sentence by 31 July.';
  }
  if (dayNum <= 37) {
    return 'The 90-Day Journey prep. Daily posting continues. LinkedIn weekly. RDF drill on every client call.';
  }
  if (dayNum <= 60) {
    return '90-Day Journey launches 1 Sept. Resume/portfolio warmed and ready. Weight tracking active.';
  }
  if (dayNum <= 90) {
    return 'Trigger window: if TVC at ₹0, career goes active. Otherwise, business gets more hours.';
  }
  return 'Phase 1 complete. Evaluate Phase 2 transition based on TVC revenue status.';
}

async function generateBrief() {
  const [
    focus,
    status,
    milestoneStatus,
    calendarEvents,
    weatherData,
    emailData,
    dayPlan,
  ] = await Promise.all([
    cadence.getFocusItems(),
    getQuickStatus(),
    Promise.resolve(milestones.getMilestoneStatus()),
    calendar.getTodayEvents().catch(() => []),
    weather.getCurrentWeather().catch(() => null),
    gmail.getUnreadEmails(15).catch(() => ({ needReply: [], readOnly: [] })),
    notion.getDayPlan().catch(() => null),
  ]);

  const hour = parseInt(new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }));

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dayName = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });
  const dayNum = getPhase1DayNumber();

  const sections = [];

  sections.push(`*${greeting}, Vybes.* It's ${dayName}, ${dateStr}. Phase 1, Day ${dayNum}.\n`);

  // 1. Milestone
  if (milestoneStatus.next) {
    const d = milestoneStatus.next.daysUntil;
    sections.push(`*Upcoming milestone:* ${milestoneStatus.next.title} — ${d} day${d === 1 ? '' : 's'} to go\n`);
  }

  // 2. Weather
  if (weatherData) {
    sections.push(`*Weather:* ${weatherData.summary}\n`);
  }

  // 3. Emails
  if (emailData.needReply && emailData.needReply.length > 0) {
    sections.push(`*Emails to reply to (${emailData.needReply.length}):*`);
    emailData.needReply.slice(0, 5).forEach(e => {
      sections.push(`  → *${e.from}* — ${e.subject}`);
    });
    if (emailData.needReply.length > 5) {
      sections.push(`  _...and ${emailData.needReply.length - 5} more_`);
    }
    sections.push('');
  }

  if (emailData.readOnly && emailData.readOnly.length > 0) {
    sections.push(`*FYI emails (${emailData.readOnly.length}):*`);
    emailData.readOnly.slice(0, 5).forEach(e => {
      sections.push(`  ${e.from} — ${e.subject}`);
    });
    if (emailData.readOnly.length > 5) {
      sections.push(`  _...and ${emailData.readOnly.length - 5} more_`);
    }
    sections.push('');
  }

  if ((!emailData.needReply || emailData.needReply.length === 0) && (!emailData.readOnly || emailData.readOnly.length === 0)) {
    if (!emailData.error) {
      sections.push(`*Email:* Inbox clear.\n`);
    }
  }

  // 4. Calendar
  if (calendarEvents.length > 0) {
    sections.push(`*Today's calendar (${calendarEvents.length}):*`);
    calendarEvents.forEach(e => {
      const time = e.start ? formatEventTime(e.start) : '';
      sections.push(`  ${time ? time + ' — ' : ''}${e.title}`);
    });
    sections.push('');
  } else {
    sections.push(`*Calendar:* Nothing scheduled today.\n`);
  }

  // 5. Top priorities (focus items + carry forwards)
  const priorities = [];

  if (status.carryForwards && status.carryForwards.length) {
    status.carryForwards.forEach(c => priorities.push(`${c.task} _(carried forward)_`));
  }
  if (status.activeCommitment) {
    priorities.push(`${status.activeCommitment} _(active commitment)_`);
  }
  if (focus.items.length) {
    focus.items.forEach(i => {
      if (!priorities.some(p => p.includes(i.title))) {
        priorities.push(i.title);
      }
    });
  }

  if (priorities.length > 0) {
    sections.push(`*Top priorities today:*`);
    priorities.slice(0, 5).forEach((p, i) => sections.push(`  ${i + 1}. ${p}`));
    sections.push('');
  }

  // 6. Monthly goal (from The Map)
  sections.push(`*Monthly goal:* ${getMonthlyGoal()}\n`);

  // 7. Today's Zoomed In tasks
  const zoomedIn = await getZoomedInTasks(dayNum);
  if (zoomedIn && zoomedIn.length > 0) {
    sections.push(`*From Zoomed In (Day ${dayNum}):*`);
    zoomedIn.forEach(t => sections.push(`  • ${t}`));
    sections.push('');
  }

  // 8. Schedule
  if (dayPlan && dayPlan.plan && dayPlan.plan.length > 0) {
    const upcoming = getUpcomingWindows(dayPlan.plan, 4);
    if (upcoming.length > 0) {
      sections.push(`*Coming up in your schedule:*`);
      upcoming.forEach(w => sections.push(`  ${w.start}–${w.end} ${w.name}`));
      sections.push('');
    }
  }

  // Parked threads
  if (status.parkedCount > 0) {
    sections.push(`*Parked:* ${status.parkedCount} thread${status.parkedCount === 1 ? '' : 's'} waiting\n`);
  }

  // Agent briefs
  const agentBriefs = await collectAgentBriefs();
  if (agentBriefs.length) {
    sections.push(`───── *From your team* ─────`);
    sections.push(...agentBriefs);
    sections.push('');
  }

  sections.push(`_What do you want to tackle first?_`);

  return sections.join('\n');
}

async function getZoomedInTasks(dayNum) {
  try {
    const entry = await notion.findZoomedInDayEntry(dayNum);
    if (!entry) return [];

    const { Client } = require('@notionhq/client');
    const notionClient = new Client({ auth: process.env.NOTION_TOKEN });
    const res = await notionClient.blocks.children.list({ block_id: entry.blockId });

    const tasks = [];
    for (const block of res.results) {
      if (block.type === 'to_do' && !block.to_do.checked) {
        const text = (block.to_do.rich_text || []).map(t => t.plain_text).join('');
        if (text) tasks.push(text);
      }
      if (block.type === 'bulleted_list_item') {
        const text = (block.bulleted_list_item.rich_text || []).map(t => t.plain_text).join('');
        if (text) tasks.push(text);
      }
    }
    return tasks;
  } catch {
    return [];
  }
}

function getUpcomingWindows(plan, count) {
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return plan
    .filter(w => w.start > currentTime)
    .slice(0, count)
    .map(w => ({ name: w.name, start: w.start, end: w.end }));
}

function formatEventTime(startStr) {
  try {
    if (startStr.length <= 10) return 'All day';
    const d = new Date(startStr);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return '';
  }
}

async function getQuickStatus() {
  const [activeCommitment, parked, carryForwards] = await Promise.all([
    notion.getActiveCommitment(),
    notion.getParkedThreads(),
    notion.getPendingCarryForwards().catch(() => []),
  ]);
  return {
    activeCommitment: activeCommitment ? activeCommitment.commitment : null,
    parkedCount: parked.length,
    carryForwards: carryForwards.map(c => ({ id: c.id, task: c.task })),
  };
}

async function collectAgentBriefs() {
  const briefs = [];
  const agentKeys = ['bizops', 'capacity', 'sales', 'nutrition', 'lifeops', 'news'];

  for (const key of agentKeys) {
    const agent = loadAgent(key);
    if (agent && typeof agent.brief === 'function') {
      try {
        const b = await agent.brief();
        if (b) briefs.push(`_${AGENTS[key].split(',')[0]}:_ ${b}`);
      } catch (err) {
        console.error(`Brief failed for ${key}:`, err.message);
      }
    }
  }

  return briefs;
}

module.exports = { handleMessage, generateBrief, route };
