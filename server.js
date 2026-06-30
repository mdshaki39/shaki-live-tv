// server.js — SHAKI_Live.TV backend
// Proxies football-data.org (free, registered-forever-free tier) so the
// API key never reaches the browser, and caches responses so we never
// blow past the free 10 requests/minute limit.

require('dotenv').config();
const express = require('express');
const path = require('path');
const NodeCache = require('node-cache');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const API_BASE = 'https://api.football-data.org/v4';

// All 12 competitions that are free-forever on football-data.org's free tier.
// World Cup is first/default since that's the current tournament; the rest
// cover club football for once the World Cup ends.
const COMPETITIONS = [
  { code: 'WC',  name: 'বিশ্বকাপ ২০২৬',        nameEn: 'FIFA World Cup' },
  { code: 'CL',  name: 'চ্যাম্পিয়ন্স লিগ',       nameEn: 'UEFA Champions League' },
  { code: 'PL',  name: 'প্রিমিয়ার লিগ',         nameEn: 'Premier League' },
  { code: 'PD',  name: 'লা লিগা',               nameEn: 'La Liga' },
  { code: 'BL1', name: 'বুন্দেসলিগা',           nameEn: 'Bundesliga' },
  { code: 'SA',  name: 'সিরি আ',                nameEn: 'Serie A' },
  { code: 'FL1', name: 'লিগ ১',                 nameEn: 'Ligue 1' },
  { code: 'DED', name: 'এরেডিভিজি',             nameEn: 'Eredivisie' },
  { code: 'PPL', name: 'প্রিমেইরা লিগা',         nameEn: 'Primeira Liga' },
  { code: 'ELC', name: 'চ্যাম্পিয়নশিপ',         nameEn: 'Championship' },
  { code: 'BSA', name: 'ব্রাজিল সিরি আ',         nameEn: 'Brasileirão' },
  { code: 'EC',  name: 'ইউরো',                  nameEn: 'European Championship' }
];
const VALID_CODES = new Set(COMPETITIONS.map(c => c.code));
const DEFAULT_COMPETITION = 'WC';

// Cache: matches refresh often (live scores), standings/groups refresh slower.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
const STANDINGS_TTL = 300; // 5 min
const MATCHES_TTL = 45;    // 45s — safe under the 10 req/min free limit

const FALLBACK_PATH = path.join(__dirname, 'config', 'fallback-data.json');
function loadFallback() {
  try {
    return JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf8'));
  } catch (e) {
    return { matches: [], standings: [], isFallback: true };
  }
}

function safeCompetition(code) {
  return VALID_CODES.has(code) ? code : DEFAULT_COMPETITION;
}

async function fetchFromApi(endpoint) {
  if (!API_KEY) {
    const err = new Error('NO_API_KEY');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`API_ERROR_${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

async function getCached(key, ttl, endpoint) {
  const hit = cache.get(key);
  if (hit) return { data: hit, live: true, cached: true };

  try {
    const data = await fetchFromApi(endpoint);
    cache.set(key, data, ttl);
    // Keep a "last known good" copy in case the API goes down/rate-limits later.
    cache.set(`${key}:lastgood`, data, 0); // 0 = no expiry
    return { data, live: true, cached: false };
  } catch (e) {
    const lastGood = cache.get(`${key}:lastgood`);
    if (lastGood) {
      return { data: lastGood, live: false, cached: true, stale: true, error: e.message };
    }
    throw e;
  }
}

app.use(express.json());

// ---- API routes -----------------------------------------------------

app.get('/api/competitions', (req, res) => {
  res.json({ competitions: COMPETITIONS, default: DEFAULT_COMPETITION });
});

app.get('/api/matches', async (req, res) => {
  try {
    const comp = safeCompetition(req.query.comp);
    const { dateFrom, dateTo, status, stage, group } = req.query;
    const qs = new URLSearchParams();
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    if (status) qs.set('status', status);
    if (stage) qs.set('stage', stage);
    if (group) qs.set('group', group);
    const key = `matches:${comp}:${qs.toString()}`;
    const result = await getCached(key, MATCHES_TTL, `/competitions/${comp}/matches?${qs.toString()}`);
    res.json({ source: 'live', competition: comp, ...result });
  } catch (e) {
    const fb = loadFallback();
    const comp = safeCompetition(req.query.comp);
    res.json({ source: 'fallback', competition: comp, live: false, error: e.code || e.message, data: { matches: comp === 'WC' ? fb.matches : [] } });
  }
});

app.get('/api/standings', async (req, res) => {
  try {
    const comp = safeCompetition(req.query.comp);
    const result = await getCached(`standings:${comp}`, STANDINGS_TTL, `/competitions/${comp}/standings`);
    res.json({ source: 'live', competition: comp, ...result });
  } catch (e) {
    const fb = loadFallback();
    const comp = safeCompetition(req.query.comp);
    res.json({ source: 'fallback', competition: comp, live: false, error: e.code || e.message, data: { standings: comp === 'WC' ? fb.standings : [] } });
  }
});

app.get('/api/competition', async (req, res) => {
  try {
    const comp = safeCompetition(req.query.comp);
    const result = await getCached(`competition:${comp}`, 3600, `/competitions/${comp}`);
    res.json({ source: 'live', competition: comp, ...result });
  } catch (e) {
    res.json({ source: 'fallback', live: false, error: e.code || e.message, data: null });
  }
});

app.get('/api/channels', (req, res) => {
  try {
    const channels = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'channels.json'), 'utf8'));
    res.json(channels);
  } catch (e) {
    res.json({ defaultLink: { label: 'Find legal stream', type: 'link', url: 'https://www.livesoccertv.com/' }, rules: [] });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: !!API_KEY, time: new Date().toISOString() });
});

// ---- Static frontend --------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Vercel serverless support -----------------------------------------
// On Vercel, this file is required by api/index.js and the exported `app`
// is used directly as the request handler — no app.listen(), no keep-alive
// self-ping needed (serverless functions don't sleep the same way).
const IS_VERCEL = !!process.env.VERCEL;

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`SHAKI_Live.TV dashboard running on port ${PORT}`);
    if (!API_KEY) {
      console.warn('WARNING: FOOTBALL_DATA_API_KEY not set — serving fallback/demo data only.');
    }
  });

  // ---- Keep-alive self-ping (Render/Back4app free tiers sleep when idle) --
  // Render auto-sets RENDER_EXTERNAL_URL; for other hosts set SELF_PING_URL
  // manually as an env var. Pinging /api/health every 10 minutes keeps the
  // instance awake so visitors always get an instantly-loaded server.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || '';
  if (SELF_URL) {
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
      https.get(`${SELF_URL}/api/health`, (res) => {
        console.log(`[keep-alive] pinged self, status ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn(`[keep-alive] self-ping failed: ${err.message}`);
      });
    }, PING_INTERVAL_MS);
    console.log(`[keep-alive] self-ping enabled -> ${SELF_URL}/api/health every ${PING_INTERVAL_MS / 60000} min`);
  } else {
    console.log('[keep-alive] SELF_PING_URL/RENDER_EXTERNAL_URL not set — self-ping disabled (fine for local dev).');
  }
}

module.exports = app;

