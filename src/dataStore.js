const { createClient } = require('@supabase/supabase-js');

const useSupabase = process.env.USE_SUPABASE === 'true';
let supabase;

const seedApps = [
  {
    id: 'atlas-schematic-designer',
    name: 'Atlas Schematic Designer',
    category: 'Engineering',
    store: 'Core Engineering',
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
    store: 'Operations',
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
    store: 'Field',
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

function ensureSupabase() {
  if (!useSupabase) return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set when USE_SUPABASE=true');
  }
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
}

function toSafeApp(app = {}) {
  return {
    ...app,
    tags: Array.isArray(app.tags) ? app.tags.slice(0, 10) : [],
    category: validCategories.includes(app.category) ? app.category : 'General',
    store: app.store || 'Main',
    feedback: Array.isArray(app.feedback) ? app.feedback : [],
  };
}

function matchFilters(app, { category, tag, q, store }) {
  let ok = true;
  if (category) {
    ok = ok && app.category.toLowerCase() === category.toLowerCase();
  }
  if (store) {
    ok = ok && (app.store || '').toLowerCase() === store.toLowerCase();
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

function sortApps(apps = [], sort) {
  switch (sort) {
    case 'downloads':
      return [...apps].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    case 'rating':
      return [...apps].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'updated':
      return [...apps].sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
    default:
      return [...apps].sort((a, b) => a.name.localeCompare(b.name));
  }
}

async function listApps(filters = {}) {
  if (!useSupabase) {
    const filtered = memoryApps.filter((app) => matchFilters(app, filters));
    return sortApps(filtered, filters.sort);
  }

  ensureSupabase();
  const { data, error } = await supabase.from('apps').select('*');
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Supabase listApps error', error.message);
    return [];
  }
  const filtered = data.filter((app) => matchFilters(app, filters));
  return sortApps(filtered, filters.sort);
}

async function getApp(id) {
  if (!useSupabase) {
    return memoryApps.find((app) => app.id === id);
  }
  ensureSupabase();
  const { data, error } = await supabase.from('apps').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    // eslint-disable-next-line no-console
    console.error('Supabase getApp error', error.message);
    return null;
  }
  return data || null;
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

  if (!useSupabase) {
    if (await getApp(safeApp.id)) {
      return { ok: false, status: 409, error: 'App id already exists' };
    }
    memoryApps.push(safeApp);
    return { ok: true, app: safeApp };
  }

  ensureSupabase();
  const { data: existing } = await supabase.from('apps').select('id').eq('id', safeApp.id).maybeSingle();
  if (existing) {
    return { ok: false, status: 409, error: 'App id already exists' };
  }
  const { error } = await supabase.from('apps').insert([safeApp]);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true, app: { id: safeApp.id, ...safeApp } };
}

async function incrementDownload(id) {
  if (!useSupabase) {
    const app = await getApp(id);
    if (!app) return { ok: false, status: 404, error: 'App not found' };
    app.downloads += 1;
    memoryApps = memoryApps.map((item) => (item.id === id ? app : item));
    return { ok: true, data: { downloadUrl: app.downloadUrl, downloads: app.downloads } };
  }

  ensureSupabase();
  const app = await getApp(id);
  if (!app) return { ok: false, status: 404, error: 'App not found' };
  const downloads = (app.downloads || 0) + 1;
  const { error } = await supabase.from('apps').update({ downloads }).eq('id', id);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true, data: { downloadUrl: app.downloadUrl, downloads } };
}

async function addRating(id, payload) {
  const entry = {
    user: payload.user.slice(0, 80),
    persona: payload.persona,
    rating: payload.rating,
    comment: payload.comment.slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  if (!useSupabase) {
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

  ensureSupabase();
  const app = await getApp(id);
  if (!app) return { ok: false, status: 404, error: 'App not found' };
  const newRatingCount = (app.ratingCount || 0) + 1;
  const ratingSum = (app.rating || 0) * (app.ratingCount || 0) + payload.rating;
  const rating = Number((ratingSum / newRatingCount).toFixed(2));
  const feedback = [...(app.feedback || []), entry];
  const { error } = await supabase
    .from('apps')
    .update({ rating, ratingCount: newRatingCount, feedback })
    .eq('id', id);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true, data: { rating, ratingCount: newRatingCount, feedback } };
}

async function addFeedback(id, payload) {
  const entry = {
    user: payload.user.slice(0, 80),
    persona: payload.persona,
    comment: payload.comment.slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  if (!useSupabase) {
    const app = await getApp(id);
    if (!app) return { ok: false, status: 404, error: 'App not found' };
    const updated = { ...app, feedback: [...(app.feedback || []), entry] };
    memoryApps = memoryApps.map((item) => (item.id === id ? updated : item));
    return { ok: true, data: entry };
  }

  ensureSupabase();
  const app = await getApp(id);
  if (!app) return { ok: false, status: 404, error: 'App not found' };
  const feedback = [...(app.feedback || []), entry];
  const { error } = await supabase.from('apps').update({ feedback }).eq('id', id);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true, data: entry };
}

async function listCategories() {
  const categories = new Set(validCategories);
  const apps = await listApps();
  apps.forEach((app) => categories.add(app.category));
  return Array.from(categories);
}

async function listStores() {
  const stores = new Set();
  const apps = await listApps();
  apps.forEach((app) => stores.add(app.store || 'Main'));
  return Array.from(stores);
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
  listStores,
  getStats,
  validCategories,
  useSupabase,
};
