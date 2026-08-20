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

// TEMPORARY: one-shot migration of Day Schedule Aug 20-31 to current template (remove after use)
app.get('/admin/migrate-schedule', async (req, res) => {
  try {
    const { DEFAULT_DAY_TEMPLATE } = require('./groq');
    const dayDetails = {
      '2026-08-20': { b1: 'Build.', b2: "Post today's 3, queued. Networking 1." },
      '2026-08-21': { b1: 'Build.', b2: "Post today's 3, queued. Portfolio." },
      '2026-08-22': { b1: 'Build.', b2: "Post today's 3, queued. Networking 2. Caregiving note." },
      '2026-08-23': { b1: 'Cold-read. Mid-point check.', b2: "Post today's 3, queued. Portfolio. Runway math." },
      '2026-08-24': { b1: 'Build/polish.', b2: "Post today's 3, queued. Portfolio." },
      '2026-08-25': { b1: 'Build/polish.', b2: "Post today's 3, queued. Networking 1." },
      '2026-08-26': { b1: 'Cold-read as stranger, fix list.', b2: "Post today's 3, queued. Portfolio." },
      '2026-08-27': { b1: 'Final structural pass, correctness pass.', b2: "Post today's 3, queued. Networking 2." },
      '2026-08-28': { b1: 'Red-team.', b2: "Post today's 3, queued. Portfolio." },
      '2026-08-29': { b1: 'Delivery setup.', b2: "Post today's 3, queued. Portfolio — final push. Caregiving note." },
      '2026-08-30': { b1: 'Launch copy.', b2: "Post today's 3, queued. Portfolio — close out. Runway math." },
      '2026-08-31': { b1: 'Final go/no-go.', b2: "Post today's 3, queued — last day. Month review." },
    };
    const results = [];
    for (const [date, details] of Object.entries(dayDetails)) {
      const plan = DEFAULT_DAY_TEMPLATE.map(w => {
        const obj = { ...w };
        if (w.name === 'business_1') obj.detail = details.b1;
        if (w.name === 'business_2') obj.detail = details.b2;
        return obj;
      });
      await notion.setDayPlanForDate(date, plan);
      results.push({ date, ok: true, windows: plan.length });
    }
    res.json({ migrated: results.length, results });
  } catch (err) {
    console.error('migrate-schedule error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = app;
