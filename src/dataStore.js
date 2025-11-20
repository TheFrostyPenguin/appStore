const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Supabase is mandatory.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const validCategories = ['Engineering', 'Automation', 'Safety', 'Operations', 'Data', 'Monitoring', 'Productivity', 'DevOps'];

function toSafeApp(app = {}) {
  return {
    ...app,
    tags: Array.isArray(app.tags) ? app.tags.slice(0, 10) : [],
    category: validCategories.includes(app.category) ? app.category : 'General',
    store: app.store || 'Main',
    feedback: Array.isArray(app.feedback) ? app.feedback : [],
  };
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
  let query = supabase.from('apps').select('*');

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.store) {
    query = query.eq('store', filters.store);
  }
  if (filters.tag) {
    query = query.contains('tags', [filters.tag]);
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(
      `name.ilike.${term},description.ilike.${term},tags.ilike.${term}`
    );
  }

  if (filters.sort === 'downloads') {
    query = query.order('downloads', { ascending: false });
  } else if (filters.sort === 'rating') {
    query = query.order('rating', { ascending: false });
  } else if (filters.sort === 'updated') {
    query = query.order('lastUpdated', { ascending: false });
  } else {
    query = query.order('name', { ascending: true });
  }

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Supabase listApps error', error.message);
    return [];
  }
  return data.map(toSafeApp);
}

async function getApp(id) {
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
};
