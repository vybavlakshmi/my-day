const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const OPEN_TASKS_PAGE_ID = process.env.OPEN_TASKS_PAGE_ID;
const EXCUSE_LEDGER_DB = process.env.EXCUSE_LEDGER_DB;
const TASK_LOG_DB = process.env.TASK_LOG_DB;
const ACTIVE_COMMITMENT_DB = process.env.ACTIVE_COMMITMENT_DB;
const PARKED_THREADS_DB = process.env.PARKED_THREADS_DB;
const COMMITMENT_HISTORY_DB = process.env.COMMITMENT_HISTORY_DB;

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

async function logTaskEvent({ task, source, status, date }) {
  await notion.pages.create({
    parent: { database_id: TASK_LOG_DB },
    properties: {
      Task: { title: [{ text: { content: task } }] },
      Source: { select: { name: source } },
      Status: { select: { name: status } },
      Date: { date: { start: date || new Date().toISOString().slice(0, 10) } },
    },
  });
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
    Started: { date: { start: new Date().toISOString().slice(0, 10) } },
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
      'Parked At': { date: { start: new Date().toISOString().slice(0, 10) } },
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
    Closed: { date: { start: new Date().toISOString().slice(0, 10) } },
    Outcome: { select: { name: outcome } },
  };
  if (started) properties.Started = { date: { start: started } };
  await notion.pages.create({ parent: { database_id: COMMITMENT_HISTORY_DB }, properties });
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
  updateParkedThreadStatus,
  closeCommitment,
};
