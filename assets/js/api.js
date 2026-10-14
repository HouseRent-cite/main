// Загрузка данных для публичных страниц.
// Порядок: база Supabase → последняя удачная копия в браузере → резервные данные из fallback.js.

import { SUPABASE_URL, SUPABASE_ANON_KEY, REQUEST_TIMEOUT } from './config.js';
import { FALLBACK } from './fallback.js';

const CACHE_KEY = 'tb-site-cache-v1';

export const isConfigured = () =>
  !!SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

async function rest(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      // Старый ключ anon (начинается с eyJ) передаём и в Authorization; новый sb_publishable_ — только в apikey
      headers: SUPABASE_ANON_KEY.startsWith('eyJ')
        ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        : { apikey: SUPABASE_ANON_KEY },
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* хранилище недоступно — не страшно */ }
}

// Недостающие поля настроек берём из резервных данных, чтобы вёрстка не ломалась
function withDefaults(settings) {
  const out = { ...FALLBACK.settings };
  if (settings) for (const [k, v] of Object.entries(settings)) if (v !== undefined) out[k] = v;
  return out;
}

function fallbackData() {
  const d = JSON.parse(JSON.stringify(FALLBACK));
  d.settings = withDefaults(d.settings);
  d.properties = (d.properties || []).filter((p) => p.visible !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  d.reviews = (d.reviews || []).filter((r) => r.visible !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return { ...d, source: 'fallback' };
}

export async function loadSiteData() {
  if (!isConfigured()) return fallbackData();
  try {
    const [settingsRows, properties, reviews] = await Promise.all([
      rest('site_settings?id=eq.1&select=*'),
      rest('properties?visible=eq.true&select=*&order=sort_order.asc,created_at.asc'),
      rest('reviews?visible=eq.true&select=*&order=sort_order.asc,created_at.asc')
    ]);
    const data = { settings: withDefaults(settingsRows[0]), properties, reviews };
    writeCache(data);
    return { ...data, source: 'live' };
  } catch (err) {
    console.warn('База недоступна, показываю резервные данные:', err);
    const cached = readCache();
    if (cached) return { ...cached, source: 'cache' };
    return fallbackData();
  }
}

// Клиент Supabase для админки (грузится только там)
let clientPromise = null;
export function getClient() {
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      }));
  }
  return clientPromise;
}
