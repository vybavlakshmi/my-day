require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const path = require('path');
const express = require('express');
const healthRouter = require('./health');
const cadence = require('./cadence');
const notion = require('./notion');
const maya = require('./maya');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(healthRouter);

app.get('/tasks', async (req, res) => {
  try {
    const tasks = await cadence.getAllTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/status', async (req, res) => {
  try {
    const [activeCommitment, parked] = await Promise.all([
      notion.getActiveCommitment(),
      notion.getParkedThreads(),
    ]);
    res.json({
      activeCommitment: activeCommitment ? activeCommitment.commitment : null,
      parkedCount: parked.length,
      milestone: null, // stubbed — no Roadmap data source exists yet, see NEEDS_INPUT.md
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/parked', async (req, res) => {
  try {
    const parked = await notion.getParkedThreads();
    res.json({ parked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/focus', async (req, res) => {
  try {
    const { windowName, items } = await cadence.getFocusItems();
    res.json({ windowName, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const reply = await cadence.handleChat(req.body.text);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/task/toggle', async (req, res) => {
  try {
    const { source, id, done } = req.body;
    if (source === 'notion') {
      await notion.markTaskDone(id, done);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/speak', async (req, res) => {
  try {
    const { text, voice } = req.body;
    const audioStream = await maya.speak(text, voice);
    res.set('Content-Type', 'audio/webm');
    audioStream.pipe(res);
    audioStream.on('error', err => {
      console.error('speak stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: String(err && (err.message || err)) });
    });
  } catch (err) {
    console.error('speak error:', err);
    res.status(500).json({ error: String(err && (err.message || err)), name: err && err.name, stack: err && err.stack });
  }
});

module.exports = app;
