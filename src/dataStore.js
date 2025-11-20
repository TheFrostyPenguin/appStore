const { existsSync } = require('fs');
const path = require('path');

const useFirebase = process.env.USE_FIREBASE === 'true';
let admin;
let firestore;
let storageBucket;

const seedApps = [
  {
    id: 'atlas-schematic-designer',
    name: 'Atlas Schematic Designer',
    category: 'Engineering',
    tags: ['PCB', 'Schematics', 'Simulation'],
    description: 'Secure circuit design and simulation toolkit with change history.',
    downloads: 240,
    rating: 4.7,
    ratingCount: 38,
    feedback: [
      {
        user: 'Priya',
        persona: 'viewer',
        rating: 5,
        comment: 'Reliable SI tools and BOM export.',
        createdAt: new Date().toISOString(),
      },
    ],
    updateInfo: 'v2.3.1 – Export validation added',
    lastUpdated: new Date('2024-02-02T00:00:00.000Z').toISOString(),
    downloadUrl: 'https://example.com/downloads/atlas-schematic-designer.zip',
  },
  {
    id: 'ops-automation-workbench',
    name: 'Ops Automation Workbench',
    category: 'Automation',
    tags: ['RPA', 'Scheduling', 'Compliance'],
    description: 'Orchestrate runbooks, deploy agents, and audit changes.',
    downloads: 180,
    rating: 4.3,
    ratingCount: 21,
    feedback: [
      {
        user: 'Devon',
        persona: 'viewer',
        rating: 4,
        comment: 'Agent rollout and audit trails are clear.',
        createdAt: new Date().toISOString(),
      },
    ],
    updateInfo: 'v1.9.0 – Linux agents added',
    lastUpdated: new Date('2024-01-18T00:00:00.000Z').toISOString(),
    downloadUrl: 'https://example.com/downloads/ops-automation-workbench.zip',
  },
  {
    id: 'safety-inspection-suite',
    name: 'Safety Inspection Suite',
    category: 'Safety',
    tags: ['Compliance', 'Field'],
    description: 'Offline-ready checklists, site evidence capture, and approval routing.',
    downloads: 120,
    rating: 4.5,
    ratingCount: 19,
    feedback: [
      {
        user: 'Miguel',
        persona: 'viewer',
        rating: 5,
        comment: 'Sync holds up on poor Wi‑Fi sites.',
        createdAt: new Date().toISOString(),
      },
    ],
    updateInfo: 'v3.0.0 – Photo annotations',
    lastUpdated: new Date('2024-03-12T00:00:00.000Z').toISOString(),
    downloadUrl: 'https://example.com/downloads/safety-inspection-suite.zip',
  },
];

const validCategories = ['Engineering', 'Automation', 'Safety', 'Operations', 'Data', 'Monitoring', 'Productivity', 'DevOps'];

let memoryApps = [...seedApps];

function buildCredentialFromEnv(adminLib) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const credentialPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!existsSync(credentialPath)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found at ${credentialPath}`);
    }
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return adminLib.credential.cert(require(credentialPath));
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
    return adminLib.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  return adminLib.credential.applicationDefault();
}

function ensureFirebase() {
  if (!useFirebase) return;
  admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: buildCredentialFromEnv(admin),
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  firestore = admin.firestore();
  storageBucket = admin.storage().bucket();
}

function toSafeApp(app = {}) {
  return {
    ...app,
    tags: Array.isArray(app.tags) ? app.tags.slice(0, 10) : [],
    category: validCategories.includes(app.category) ? app.category : 'General',
    feedback: Array.isArray(app.feedback) ? app.feedback : [],
  };
}

function matchFilters(app, { category, tag, q }) {
  let ok = true;
  if (category) {
    ok = ok && app.category.toLowerCase() === category.toLowerCase();
  }
  if (tag) {
    ok = ok && Array.isArray(app.tags) && app.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }
  if (q) {
    const term = q.toLowerCase();
    ok =
      ok &&
      (app.name.toLowerCase().includes(term) ||
        app.description.toLowerCase().includes(term) ||
        (app.tags || []).some((t) => t.toLowerCase().includes(term)));
  }
  return ok;
}

async function listApps(filters = {}) {
  if (!useFirebase) {
    return memoryApps.filter((app) => matchFilters(app, filters));
  }

  ensureFirebase();
  const snapshot = await firestore.collection('apps').get();
  const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return results.filter((app) => matchFilters(app, filters));
}

async function getApp(id) {
  if (!useFirebase) {
    return memoryApps.find((app) => app.id === id);
  }
  ensureFirebase();
  const doc = await firestore.collection('apps').doc(id).get();
  return doc.exists ? { id, ...doc.data() } : null;
}

async function createApp(appData) {
  const safeApp = toSafeApp({
    ...appData,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    feedback: [],
    lastUpdated: new Date().toISOString(),
  });

  if (!useFirebase) {
    if (await getApp(safeApp.id)) {
      return { ok: false, status: 409, error: 'App id already exists' };
    }
    memoryApps.push(safeApp);
    return { ok: true, app: safeApp };
  }

  ensureFirebase();
  const docRef = firestore.collection('apps').doc(safeApp.id);
  const existing = await docRef.get();
  if (existing.exists) {
    return { ok: false, status: 409, error: 'App id already exists' };
  }
  await docRef.set(safeApp);
  return { ok: true, app: { id: safeApp.id, ...safeApp } };
}

async function incrementDownload(id) {
  if (!useFirebase) {
    const app = await getApp(id);
    if (!app) return { ok: false, status: 404, error: 'App not found' };
    app.downloads += 1;
    memoryApps = memoryApps.map((item) => (item.id === id ? app : item));
    return { ok: true, data: { downloadUrl: app.downloadUrl, downloads: app.downloads } };
  }

  ensureFirebase();
  const ref = firestore.collection('apps').doc(id);
  try {
    const data = await firestore.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const app = doc.data();
      const downloads = (app.downloads || 0) + 1;
      tx.update(ref, { downloads });
      return { downloadUrl: app.downloadUrl, downloads };
    });
    if (!data) return { ok: false, status: 404, error: 'App not found' };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, status: 500, error: error.message };
  }
}

async function addRating(id, payload) {
  const entry = {
    user: payload.user.slice(0, 80),
    persona: payload.persona,
    rating: payload.rating,
    comment: payload.comment.slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  if (!useFirebase) {
    const app = await getApp(id);
    if (!app) return { ok: false, status: 404, error: 'App not found' };
    const newRatingCount = (app.ratingCount || 0) + 1;
    const ratingSum = (app.rating || 0) * (app.ratingCount || 0) + payload.rating;
    const rating = Number((ratingSum / newRatingCount).toFixed(2));
    const updated = {
      ...app,
      rating,
      ratingCount: newRatingCount,
      feedback: [...(app.feedback || []), entry],
    };
    memoryApps = memoryApps.map((item) => (item.id === id ? updated : item));
    return { ok: true, data: { rating, ratingCount: newRatingCount, feedback: updated.feedback } };
  }

  ensureFirebase();
  const ref = firestore.collection('apps').doc(id);
  try {
    const result = await firestore.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const app = doc.data();
      const newRatingCount = (app.ratingCount || 0) + 1;
      const ratingSum = (app.rating || 0) * (app.ratingCount || 0) + payload.rating;
      const rating = Number((ratingSum / newRatingCount).toFixed(2));
      const feedback = [...(app.feedback || []), entry];
      tx.update(ref, { rating, ratingCount: newRatingCount, feedback });
      return { rating, ratingCount: newRatingCount, feedback };
    });
    if (!result) return { ok: false, status: 404, error: 'App not found' };
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, status: 500, error: error.message };
  }
}

async function addFeedback(id, payload) {
  const entry = {
    user: payload.user.slice(0, 80),
    persona: payload.persona,
    comment: payload.comment.slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  if (!useFirebase) {
    const app = await getApp(id);
    if (!app) return { ok: false, status: 404, error: 'App not found' };
    const updated = { ...app, feedback: [...(app.feedback || []), entry] };
    memoryApps = memoryApps.map((item) => (item.id === id ? updated : item));
    return { ok: true, data: entry };
  }

  ensureFirebase();
  const ref = firestore.collection('apps').doc(id);
  try {
    const result = await firestore.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const app = doc.data();
      const feedback = [...(app.feedback || []), entry];
      tx.update(ref, { feedback });
      return entry;
    });
    if (!result) return { ok: false, status: 404, error: 'App not found' };
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, status: 500, error: error.message };
  }
}

async function listCategories() {
  const categories = new Set(validCategories);
  const apps = await listApps();
  apps.forEach((app) => categories.add(app.category));
  return Array.from(categories);
}

async function getStats() {
  const apps = await listApps();
  const totals = apps.reduce(
    (acc, app) => {
      acc.downloads += app.downloads || 0;
      acc.ratingSum += (app.rating || 0) * (app.ratingCount || 0);
      acc.ratingCount += app.ratingCount || 0;
      acc.categoryBreakdown[app.category] = (acc.categoryBreakdown[app.category] || 0) + 1;
      return acc;
    },
    { downloads: 0, ratingSum: 0, ratingCount: 0, categoryBreakdown: {} }
  );

  return {
    totalDownloads: totals.downloads,
    averageRating: totals.ratingCount ? Number((totals.ratingSum / totals.ratingCount).toFixed(2)) : 0,
    categoryBreakdown: totals.categoryBreakdown,
    appCount: apps.length,
  };
}

module.exports = {
  listApps,
  getApp,
  createApp,
  incrementDownload,
  addRating,
  addFeedback,
  listCategories,
  getStats,
  validCategories,
  storageBucket,
  useFirebase,
};
