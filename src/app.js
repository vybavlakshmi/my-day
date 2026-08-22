require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const path = require('path');
const express = require('express');
const healthRouter = require('./health');
const cadence = require('./cadence');
const notion = require('./notion');
const maya = require('./maya');
const milestones = require('./milestones');
const telegram = require('./telegram');
const chief = require('./agents/chief');
const tts = require('./tts');

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

app.post('/telegram/webhook', async (req, res) => {
  try {
    const msg = telegram.extractMessage(req.body);
    if (!msg || !msg.text) return res.json({ ok: true });
    if (msg.isCallback) await telegram.answerCallback(msg.callbackId);

    if (msg.text.toLowerCase() === '/mychatid') {
      await telegram.sendMessage(msg.chatId, `Your chat ID is: ${msg.chatId}`);
      return res.json({ ok: true });
    }

    const reply = await chief.handleMessage(msg.text);
    const text = typeof reply === 'string' ? reply : (reply.reply || JSON.stringify(reply));
    await telegram.sendMessage(msg.chatId, text);
    res.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
    res.json({ ok: true });
  }
});

app.get('/telegram/setup', async (req, res) => {
  try {
    const host = req.query.host || `https://${req.headers.host}`;
    const webhookUrl = `${host}/telegram/webhook`;
    const result = await telegram.setWebhook(webhookUrl);
    res.json({ webhookUrl, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/telegram/status', async (req, res) => {
  try {
    const info = await telegram.getWebhookInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/agent/chat', async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await chief.handleMessage(text);
    if (typeof reply === 'string') {
      res.json({ reply });
    } else {
      res.json(reply);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/agent/brief', async (req, res) => {
  try {
    const brief = await chief.generateBrief();
    res.json({ brief });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/brief/auto', async (req, res) => {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });

    const brief = await chief.generateBrief();
    await telegram.sendMessage(chatId, brief);

    try {
      const plainBrief = tts.stripMarkdown(brief);
      const audioBuffer = await tts.textToSpeech(plainBrief);
      await telegram.sendVoice(chatId, audioBuffer);
    } catch (ttsErr) {
      console.error('TTS failed, text brief still sent:', ttsErr.message);
    }

    res.json({ ok: true, delivered: 'telegram+voice' });
  } catch (err) {
    console.error('Auto brief error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
