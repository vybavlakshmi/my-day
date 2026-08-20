require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const path = require('path');
const express = require('express');
const healthRouter = require('./health');
const cadence = require('./cadence');
const notion = require('./notion');
const maya = require('./maya');
const milestones = require('./milestones');

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
    const [activeCommitment, parked, carryForwards] = await Promise.all([
      notion.getActiveCommitment(),
      notion.getParkedThreads(),
      notion.getPendingCarryForwards().catch(() => []),
    ]);
    res.json({
      activeCommitment: activeCommitment ? activeCommitment.commitment : null,
      parkedCount: parked.length,
      milestone: milestones.getMilestoneStatus().display,
      carryForwards: carryForwards.map(c => ({ id: c.id, task: c.task })),
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

app.post('/focus/toggle', async (req, res) => {
  try {
    const { title, done } = req.body;
    await notion.logRegistryDone(title, done);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const result = await cadence.handleChat(req.body.text);
    if (typeof result === 'string') {
      res.json({ reply: result });
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/carry-forward', async (req, res) => {
  try {
    const { parentId, afterBlockId, taskName, fromDay, logId } = req.body;
    await notion.appendCarryForwardBlock(parentId, afterBlockId, taskName, fromDay);
    if (logId) await notion.resolveCarryForward(logId, 'done').catch(() => {});
    res.json({ ok: true });
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
      if (!res.headersSent) res.status(500).json({ error: 'speech synthesis failed' });
    });
  } catch (err) {
    console.error('speak error:', err);
    res.status(500).json({ error: 'speech synthesis failed' });
  }
});

// TEMPORARY: batch day-schedule migration endpoint (remove after use)
app.post('/admin/set-day-plan', async (req, res) => {
  try {
    const { date, plan } = req.body;
    if (!date || !plan) return res.status(400).json({ error: 'date and plan required' });
    await notion.setDayPlanForDate(date, plan);
    res.json({ ok: true, date });
  } catch (err) {
    console.error('set-day-plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
