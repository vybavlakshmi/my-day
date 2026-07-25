const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const OPEN_TASKS_PAGE_ID = process.env.OPEN_TASKS_PAGE_ID;
const EXCUSE_LEDGER_DB = process.env.EXCUSE_LEDGER_DB;
const TASK_LOG_DB = process.env.TASK_LOG_DB;

function plainText(richTextArray) {
  return (richTextArray || []).map(t => t.plain_text).join('');
}

// Reads the first `limit` unchecked checkbox lines from the Open Tasks — Brain Dump page.
async function getOpenTasks(limit = 3) {
  const tasks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: OPEN_TASKS_PAGE_ID,
      start_cursor: cursor,
    });
    for (const block of res.results) {
      if (block.type === 'to_do' && !block.to_do.checked) {
        tasks.push({ id: block.id, title: plainText(block.to_do.rich_text), done: false });
        if (tasks.length >= limit) return tasks;
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
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

module.exports = { getOpenTasks, markTaskDone, logExcuse, getLedgerSummary, logTaskEvent };
