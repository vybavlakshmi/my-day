const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const OPEN_TASKS_PAGE_ID = process.env.OPEN_TASKS_PAGE_ID;
const EXCUSE_LEDGER_DB = process.env.EXCUSE_LEDGER_DB;
const TASK_LOG_DB = process.env.TASK_LOG_DB;
const ACTIVE_COMMITMENT_DB = process.env.ACTIVE_COMMITMENT_DB;
const PARKED_THREADS_DB = process.env.PARKED_THREADS_DB;
const COMMITMENT_HISTORY_DB = process.env.COMMITMENT_HISTORY_DB;
const ITEM_REGISTRY_DB = process.env.ITEM_REGISTRY_DB;
const DAY_SCHEDULE_DB = process.env.DAY_SCHEDULE_DB;
const GROCERY_LIST_DB = process.env.GROCERY_LIST_DB;
const ELEGANCE_RDF_DB = process.env.ELEGANCE_RDF_DB;
const CREATIVE_WANTS_DB = process.env.CREATIVE_WANTS_DB;
const PROJECTS_BUILDS_DB = process.env.PROJECTS_BUILDS_DB;

function plainText(richTextArray) {
  return (richTextArray || []).map(t => t.plain_text).join('');
}

// Reads the first `limit` unchecked checkboxes from the Open Tasks — Brain Dump page,
// walking into nested/toggled blocks (e.g. collapsible headings) since to-dos often live there.
async function getOpenTasks(limit = 3) {
  const tasks = [];

  async function walk(blockId) {
    let cursor;
    do {
      const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
      for (const block of res.results) {
        if (block.type === 'to_do' && !block.to_do.checked) {
          tasks.push({ id: block.id, title: plainText(block.to_do.rich_text), done: false });
        }
        if (tasks.length >= limit) return;
        if (block.has_children) {
          await walk(block.id);
          if (tasks.length >= limit) return;
        }
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor && tasks.length < limit);
  }

  await walk(OPEN_TASKS_PAGE_ID);
  return tasks;
}

// Ticks (or unticks) the real checkbox on the Notion page.
async function markTaskDone(blockId, done) {
  await notion.blocks.update({
    block_id: blockId,
    to_do: { checked: done },
  });
}

async function logExcuse({ task, excuse, verdict, reply }) {
  await notion.pages.create({
    parent: { database_id: EXCUSE_LEDGER_DB },
    properties: {
      Task: { title: [{ text: { content: task } }] },
      Excuse: { rich_text: [{ text: { content: excuse } }] },
      Reply: { rich_text: [{ text: { content: reply || '' } }] },
      Verdict: { select: { name: verdict } },
    },
  });
}

// Recent excuse history, used to give Groq context on repeated patterns.
async function getLedgerSummary(limit = 10) {
  const res = await notion.databases.query({
    database_id: EXCUSE_LEDGER_DB,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: limit,
  });
  return res.results.map(page => ({
    task: plainText(page.properties.Task.title),
    excuse: plainText(page.properties.Excuse.rich_text),
    verdict: page.properties.Verdict.select ? page.properties.Verdict.select.name : 'weak',
  }));
}

async function logTaskEvent({ task, source, status, date, detail }) {
  const properties = {
    Task: { title: [{ text: { content: task } }] },
    Source: { select: { name: source } },
    Status: { select: { name: status } },
    Date: { date: { start: date || todayISO() } },
  };
  if (detail) properties.Detail = { rich_text: [{ text: { content: detail } }] };
  await notion.pages.create({ parent: { database_id: TASK_LOG_DB }, properties });
}

// The one open commitment right now — a singleton row, updated in place rather than
// re-created each time, so there is always at most one non-archived row.
async function getActiveCommitment() {
  const res = await notion.databases.query({
    database_id: ACTIVE_COMMITMENT_DB,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 1,
  });
  if (!res.results.length) return null;
  const page = res.results[0];
  return {
    id: page.id,
    commitment: plainText(page.properties.Commitment.title),
    started: page.properties.Started.date ? page.properties.Started.date.start : null,
  };
}

async function setActiveCommitment(text) {
  const current = await getActiveCommitment();
  const properties = {
    Commitment: { title: [{ text: { content: text } }] },
    Started: { date: { start: todayISO() } },
  };
  if (current) {
    await notion.pages.update({ page_id: current.id, properties });
  } else {
    await notion.pages.create({ parent: { database_id: ACTIVE_COMMITMENT_DB }, properties });
  }
}

async function clearActiveCommitment() {
  const current = await getActiveCommitment();
  if (current) {
    await notion.pages.update({ page_id: current.id, archived: true });
  }
}

async function addParkedThread(text) {
  await notion.pages.create({
    parent: { database_id: PARKED_THREADS_DB },
    properties: {
      Thread: { title: [{ text: { content: text } }] },
      'Parked At': { date: { start: todayISO() } },
      Status: { select: { name: 'parked' } },
    },
  });
}

// Threads still awaiting a decision — not yet resumed or dropped.
async function getParkedThreads() {
  const res = await notion.databases.query({
    database_id: PARKED_THREADS_DB,
    filter: { property: 'Status', select: { equals: 'parked' } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return res.results.map(page => ({
    id: page.id,
    thread: plainText(page.properties.Thread.title),
  }));
}

async function updateParkedThreadStatus(id, status) {
  await notion.pages.update({
    page_id: id,
    properties: { Status: { select: { name: status } } },
  });
}

async function closeCommitment(text, started, outcome) {
  const properties = {
    Commitment: { title: [{ text: { content: text } }] },
    Closed: { date: { start: todayISO() } },
    Outcome: { select: { name: outcome } },
  };
  if (started) properties.Started = { date: { start: started } };
  await notion.pages.create({ parent: { database_id: COMMITMENT_HISTORY_DB }, properties });
}

// The full master list of recurring intentions, as tagged by Vybes (class/cadence/domain/window-fit).
// Selecting 1-2 for the current window is the Timing Engine's job, not this function's.
async function getItemRegistry() {
  const res = await notion.databases.query({ database_id: ITEM_REGISTRY_DB, page_size: 100 });
  return res.results.map(page => ({
    id: page.id,
    title: plainText(page.properties.Title.title),
    class: page.properties.Class.select ? page.properties.Class.select.name : null,
    cadence: page.properties.Cadence.select ? page.properties.Cadence.select.name : null,
    domain: page.properties.Domain && page.properties.Domain.select ? page.properties.Domain.select.name : null,
    status: page.properties.Status && page.properties.Status.select ? page.properties.Status.select.name : null,
    notes: page.properties.Notes ? plainText(page.properties.Notes.rich_text) : '',
    windowFit: page.properties['Window-fit'] && page.properties['Window-fit'].multi_select
      ? page.properties['Window-fit'].multi_select.map(o => o.name)
      : [],
  }));
}

function todayISO() {
  // NOT toISOString() — that returns the UTC date, which is wrong for hours after
  // midnight IST but before midnight UTC (00:00-05:30 IST is still "yesterday" in UTC).
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Today's schedule, if Maya has planned/replanned it at least once today. One row
// per calendar day (not a strict singleton) — updated in place through the day,
// naturally leaving a history of past days' plans once a new day starts.
async function getDayPlan() {
  const today = todayISO();
  const res = await notion.databases.query({
    database_id: DAY_SCHEDULE_DB,
    filter: { property: 'Day', date: { equals: today } },
    page_size: 1,
  });
  if (!res.results.length) return null;
  const page = res.results[0];
  try {
    return { id: page.id, plan: JSON.parse(plainText(page.properties.Plan.rich_text)) };
  } catch {
    return { id: page.id, plan: [] };
  }
}

async function setDayPlan(plan) {
  const today = todayISO();
  const existing = await getDayPlan();
  const properties = {
    Date: { title: [{ text: { content: today } }] },
    Day: { date: { start: today } },
    Plan: { rich_text: [{ text: { content: JSON.stringify(plan) } }] },
  };
  if (existing) {
    await notion.pages.update({ page_id: existing.id, properties });
  } else {
    await notion.pages.create({ parent: { database_id: DAY_SCHEDULE_DB }, properties });
  }
}

// Inform-only per Maya v2 §5 — Maya just adds these and states it, no confirmation wait.
async function addGroceryItems(items) {
  const today = todayISO();
  await Promise.all(items.map(item => notion.pages.create({
    parent: { database_id: GROCERY_LIST_DB },
    properties: {
      Item: { title: [{ text: { content: item } }] },
      Added: { date: { start: today } },
    },
  })));
}

async function getGroceryList() {
  const res = await notion.databases.query({
    database_id: GROCERY_LIST_DB,
    filter: { property: 'Bought', checkbox: { equals: false } },
  });
  return res.results.map(page => ({ id: page.id, item: plainText(page.properties.Item.title) }));
}

async function markGroceryBought(id, bought) {
  await notion.pages.update({ page_id: id, properties: { Bought: { checkbox: bought } } });
}

async function getEleganceRDFPlans() {
  const res = await notion.databases.query({ database_id: ELEGANCE_RDF_DB, page_size: 100 });
  return res.results.map(page => ({
    id: page.id,
    title: plainText(page.properties.Title.title),
    cadence: page.properties.Cadence.select ? page.properties.Cadence.select.name : null,
    notes: plainText(page.properties.Notes.rich_text),
  }));
}

// Inform-only per §5 — same tier as grocery.
async function addCreativeWant(title, type, notes) {
  const properties = {
    Title: { title: [{ text: { content: title } }] },
    Type: { select: { name: type || 'other' } },
  };
  if (notes) properties.Notes = { rich_text: [{ text: { content: notes } }] };
  await notion.pages.create({ parent: { database_id: CREATIVE_WANTS_DB }, properties });
}

async function getCreativeWants() {
  const res = await notion.databases.query({ database_id: CREATIVE_WANTS_DB, page_size: 100 });
  return res.results.map(page => ({
    id: page.id,
    title: plainText(page.properties.Title.title),
    type: page.properties.Type.select ? page.properties.Type.select.name : null,
    notes: plainText(page.properties.Notes.rich_text),
  }));
}

async function getProjectsBuilds() {
  const res = await notion.databases.query({ database_id: PROJECTS_BUILDS_DB, page_size: 100 });
  return res.results.map(page => ({
    id: page.id,
    title: plainText(page.properties.Title.title),
    nextAction: plainText(page.properties['Next Action'].rich_text),
    status: page.properties.Status.select ? page.properties.Status.select.name : null,
    notes: plainText(page.properties.Notes.rich_text),
  }));
}

// Completion tracking for Item Registry entries — logs each toggle to Task Log
// (source: 'registry') rather than adding a new DB, reusing §6's extended schema.
async function logRegistryDone(title, done) {
  await logTaskEvent({ task: title, source: 'registry', status: done ? 'done' : 'given' });
}

// Titles whose MOST RECENT registry-source log entry today says 'done' — supports
// toggling back and forth within the same day, not just a one-way mark.
async function getTodayDoneRegistryTitles() {
  const today = todayISO();
  const res = await notion.databases.query({
    database_id: TASK_LOG_DB,
    filter: {
      and: [
        { property: 'Source', select: { equals: 'registry' } },
        { property: 'Date', date: { equals: today } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 100,
  });
  const latestStatusByTitle = new Map();
  for (const page of res.results) {
    const title = plainText(page.properties.Task.title);
    if (!latestStatusByTitle.has(title)) {
      latestStatusByTitle.set(title, page.properties.Status.select ? page.properties.Status.select.name : null);
    }
  }
  return new Set([...latestStatusByTitle].filter(([, status]) => status === 'done').map(([title]) => title));
}

// Marks a Negotiable registry item as introduced today, for Life Truth's 3-discretionary-
// items/day cap. Only called once per distinct title per day (see getFocusItems) — this
// is a log-once event, not a per-request write.
async function logRegistrySurfaced(title) {
  await logTaskEvent({ task: title, source: 'registry', status: 'surfaced' });
}

// Distinct registry titles already logged as newly-surfaced today. Deliberately separate
// from getTodayDoneRegistryTitles (a 'done' entry already implies the item was surfaced,
// so the two sets get unioned by the caller rather than merged here).
async function getTodaySurfacedRegistryTitles() {
  const today = todayISO();
  const res = await notion.databases.query({
    database_id: TASK_LOG_DB,
    filter: {
      and: [
        { property: 'Source', select: { equals: 'registry' } },
        { property: 'Date', date: { equals: today } },
        { property: 'Status', select: { equals: 'surfaced' } },
      ],
    },
    page_size: 100,
  });
  return new Set(res.results.map(page => plainText(page.properties.Task.title)));
}

module.exports = {
  getOpenTasks,
  markTaskDone,
  logExcuse,
  getLedgerSummary,
  logTaskEvent,
  getActiveCommitment,
  setActiveCommitment,
  clearActiveCommitment,
  addParkedThread,
  getParkedThreads,
  getDayPlan,
  setDayPlan,
  updateParkedThreadStatus,
  closeCommitment,
  getItemRegistry,
  addGroceryItems,
  getGroceryList,
  markGroceryBought,
  getEleganceRDFPlans,
  addCreativeWant,
  getCreativeWants,
  getProjectsBuilds,
  logRegistryDone,
  getTodayDoneRegistryTitles,
  logRegistrySurfaced,
  getTodaySurfacedRegistryTitles,
};
