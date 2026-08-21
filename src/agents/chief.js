const { chatJSON } = require('../llm');
const cadence = require('../cadence');
const notion = require('../notion');
const milestones = require('../milestones');

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
  ], { temperature: 0.3 });

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

async function generateBrief() {
  const [focus, status, milestoneStatus] = await Promise.all([
    cadence.getFocusItems(),
    getQuickStatus(),
    Promise.resolve(milestones.getMilestoneStatus()),
  ]);

  const sections = [];
  sections.push(`*Good morning, Vybes.* Here's your brief.\n`);

  if (milestoneStatus.next) {
    sections.push(`*Milestone:* ${milestoneStatus.next.title} — ${milestoneStatus.next.daysUntil} days to go`);
  }

  if (focus.items.length) {
    const focusLines = focus.items.map(i => `  • ${i.title} (${i.source})`).join('\n');
    sections.push(`*Right now (${focus.windowName}):*\n${focusLines}`);
  }

  if (status.activeCommitment) {
    sections.push(`*Active commitment:* ${status.activeCommitment}`);
  }

  if (status.parkedCount > 0) {
    sections.push(`*Parked threads:* ${status.parkedCount} waiting`);
  }

  if (status.carryForwards && status.carryForwards.length) {
    const cfLines = status.carryForwards.map(c => `  • ${c.task}`).join('\n');
    sections.push(`*Carried forward:*\n${cfLines}`);
  }

  const agentBriefs = await collectAgentBriefs();
  if (agentBriefs.length) {
    sections.push(`\n*From your team:*`);
    sections.push(...agentBriefs);
  }

  return sections.join('\n');
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
