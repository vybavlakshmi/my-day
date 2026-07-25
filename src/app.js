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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
