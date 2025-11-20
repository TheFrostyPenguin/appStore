const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const store = require('./src/dataStore');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const sanitizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/apps', async (req, res) => {
  const { category, tag, q } = req.query;
  const apps = await store.listApps({ category, tag, q });
  res.json({ apps });
});

app.get('/api/apps/:id', async (req, res) => {
  const appRecord = await store.getApp(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  res.json(appRecord);
});

app.post('/api/apps', async (req, res) => {
  const role = req.header('x-user-role');
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' });
  }

  const {
    id,
    name,
    category,
    tags = [],
    description = '',
    downloadUrl,
    updateInfo = '',
  } = req.body || {};

  if (!id || !name || !downloadUrl) {
    return res.status(400).json({ error: 'id, name, and downloadUrl are required' });
  }

  const result = await store.createApp({
    id,
    name,
    category,
    tags,
    description,
    downloadUrl,
    updateInfo,
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error || 'Unable to create app' });
  }

  res.status(201).json(result.app);
});

app.post('/api/apps/:id/download', async (req, res) => {
  const result = await store.incrementDownload(req.params.id);
  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  res.json(result.data);
});

app.post('/api/apps/:id/rate', async (req, res) => {
  const rating = sanitizeNumber(req.body?.rating);
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }

  const result = await store.addRating(req.params.id, {
    rating,
    comment: (req.body?.comment || '').toString(),
    user: (req.body?.user || 'anonymous').toString(),
    persona: (req.body?.persona || 'viewer').toString(),
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  res.json(result.data);
});

app.post('/api/apps/:id/feedback', async (req, res) => {
  const result = await store.addFeedback(req.params.id, {
    comment: (req.body?.comment || '').toString(),
    user: (req.body?.user || 'anonymous').toString(),
    persona: (req.body?.persona || 'viewer').toString(),
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  res.status(201).json(result.data);
});

app.get('/api/categories', async (_req, res) => {
  const categories = await store.listCategories();
  res.json({ categories });
});

app.get('/api/stats', async (_req, res) => {
  const stats = await store.getStats();
  res.json(stats);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API ready on http://localhost:${PORT}`);
});
