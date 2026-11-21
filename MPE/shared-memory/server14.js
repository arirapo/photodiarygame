'use strict';
// MPE 1.3 — Deep Memory / isolated research server.
// Node.js 20+. Port 3004; isolated state memory14.json.
// Local trusted network only. Never publish the admin key.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = __dirname;
const PORT = Number(process.env.PORT || 3004);
const DATA = path.join(DIR, 'memory14.json');
const SOURCE = path.join(DIR, 'memory13.json');
const KEY = process.env.MPE_ADMIN_KEY || '';
if (KEY.length < 24) throw Error('Set MPE_ADMIN_KEY (at least 24 characters)');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const random = () => crypto.randomInt(0, 0x100000000) / 0x100000000;
const rnd = (a, b) => a + random() * (b - a);
const now = () => Date.now();

const base = [0.31, 0.44, 0.39, 0.60, 0.40, 0.50, 0.35, 0.65];
const names = ['Stillness', 'Bloom', 'Turbulence', 'Dissolve', 'Dream'];
const photos = ['IMG_6484.jpeg', 'R0011164.jpeg', 'R0011165.jpeg', 'R0012243.jpeg', 'R0012371.jpeg', 'R0015191.jpeg', 'R0015290.jpeg'];

const DEEP_W = 64;
const DEEP_H = 32;
const DEEP_SIZE = DEEP_W * DEEP_H;

const emptyPool = () => Array.from({ length: 8 }, () => ({ mass: 0, hue: 0 }));
const emptyDeep = () => Array(DEEP_SIZE).fill(0);

function initial() {
  return {
    version: 14,
    last: now(),
    days: 0,
    offers: 0,
    forgotten: 0,
    expired: 0,
    capacity: 0,
    merged: 0,
    weather: 0,
    epoch: 1,
    weatherAge: 0,
    field: base.slice(),
    residue: Array(8).fill(0),
    history: [0.24, 0.68, 0.39],
    layers: [],
    pools: emptyPool(),
    regenerations: 0,
    dreamActivity: 1,
    regenerationPaused: false,
    deep: emptyDeep(),
    deepMoments: 0,
    nodes: [
      { x: 0.18, y: 0.34, s: 1, p: 1, h: 32, anchor: true, ready: 0 },
      { x: 0.70, y: 0.27, s: 1, p: 1, h: 183, anchor: true, ready: 0 },
      { x: 0.50, y: 0.75, s: 1, p: 1, h: 275, anchor: true, ready: 0 }
    ]
  };
}

function migrate(m) {
  if (![13, 14].includes(m.version) || !Array.isArray(m.nodes)) throw Error('Incompatible source memory');
  const result = { ...initial(), ...m, version: 14, last: now() };
  result.nodes = m.nodes.map(n => ({ ...n, echo: !!n.echo }));
  result.pools = Array.isArray(m.pools) && m.pools.length === 8 ? m.pools : emptyPool();
  result.regenerations = m.regenerations || 0;
  result.dreamActivity = Number.isFinite(m.dreamActivity) ? clamp(m.dreamActivity, 0.1, 3) : 1;
  result.regenerationPaused = !!m.regenerationPaused;
  result.residue = Array.isArray(m.residue) && m.residue.length === 8 ? m.residue : base.map(() => 0);
  result.history = Array.isArray(m.history) && m.history.length === 3 ? m.history : [0.24, 0.68, 0.39];
  result.layers = Array.isArray(m.layers) ? m.layers : [];
  result.expired = m.expired || 0;
  result.capacity = m.capacity || 0;
  result.merged = m.merged || 0;
  result.deep = Array.isArray(m.deep) && m.deep.length === DEEP_SIZE ? m.deep.map(v => clamp(Number(v) || 0)) : emptyDeep();
  result.deepMoments = m.deepMoments || 0;
  return result;
}

let memory;
if (fs.existsSync(DATA)) {
  memory = migrate(JSON.parse(fs.readFileSync(DATA, 'utf8')));
} else if (fs.existsSync(SOURCE)) {
  memory = migrate(JSON.parse(fs.readFileSync(SOURCE, 'utf8')));
  console.log('Imported an independent copy of memory13.json');
} else {
  memory = initial();
  console.log('No memory13.json found; starting an independent empty deep memory');
}

let dirty = true;
function persist() {
  if (!dirty) return;
  const temp = DATA + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(memory));
  fs.renameSync(temp, DATA);
  dirty = false;
}

function deepIndex(x, y) {
  return y * DEEP_W + x;
}

function stampDeep(nx, ny, mass = 0.1, radiusBoost = 0) {
  const cx = clamp(nx, 0, 1) * (DEEP_W - 1);
  const cy = clamp(ny, 0, 1) * (DEEP_H - 1);
  const radius = 1.5 + mass * 6 + radiusBoost;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(DEEP_W - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(DEEP_H - 1, Math.ceil(cy + radius));
  const spread = Math.max(0.65, radius * radius * 0.55);
  let touched = false;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const value = mass * Math.exp(-(dx * dx + dy * dy) / (2 * spread));
      if (value < 0.0015) continue;
      const i = deepIndex(x, y);
      memory.deep[i] = clamp(memory.deep[i] + value * 0.22, 0, 1);
      touched = true;
    }
  }
  if (touched) memory.deepMoments++;
}

function deepStats() {
  let total = 0;
  let max = 0;
  let active = 0;
  for (const v of memory.deep) {
    total += v;
    if (v > max) max = v;
    if (v > 0.06) active++;
  }
  return {
    mean: total / DEEP_SIZE,
    max,
    active
  };
}

function strongestDeepSpot() {
  let best = 0;
  let bestIndex = -1;
  for (let i = 0; i < DEEP_SIZE; i++) {
    const v = memory.deep[i] + random() * 0.005;
    if (v > best) {
      best = v;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  const x = bestIndex % DEEP_W;
  const y = Math.floor(bestIndex / DEEP_W);
  return {
    x: (x + 0.5) / DEEP_W,
    y: (y + 0.5) / DEEP_H,
    strength: best
  };
}

function absorb(n, amount = 1) {
  const k = Math.floor((((n.h || 0) % 360) + 360) % 360 / 45) % 8;
  const mass = clamp((n.s || 0.1) * amount, 0, 1);
  const pool = memory.pools[k];
  pool.mass = clamp(pool.mass + mass * 0.08, 0, 5);
  pool.hue = k * 45;
  memory.residue[k] = clamp(memory.residue[k] + mass * 0.012);
  memory.history[k % 3] = clamp(memory.history[k % 3] * 0.998 + (n.p || 0.3) * 0.002);
  stampDeep(n.x || random(), n.y || random(), Math.max(0.05, mass * 0.35), 0.3);
}

function compact() {
  if (memory.nodes.length <= 490) return;
  const anchors = memory.nodes.filter(n => n.anchor);
  const others = memory.nodes
    .filter(n => !n.anchor)
    .sort((a, b) => (b.s + b.p * 0.25) - (a.s + a.p * 0.25));
  const gone = others.splice(Math.max(0, 470));
  gone.forEach(n => absorb(n));
  memory.capacity += gone.length;
  memory.forgotten += gone.length;
  memory.nodes = anchors.concat(others);
}

function regenerate(force = false) {
  if (memory.regenerationPaused && !force) return false;
  const total = memory.pools.reduce((s, p) => s + p.mass, 0);
  if (total < 0.005 || memory.nodes.length > 475) return false;
  let chosen = random() * total;
  let index = 0;
  for (; index < 7; index++) {
    chosen -= memory.pools[index].mass;
    if (chosen <= 0) break;
  }
  const p = memory.pools[index];
  if (p.mass < 0.005) return false;

  const hot = strongestDeepSpot();
  const anchors = memory.nodes.filter(n => n.anchor);
  const a = anchors[Math.floor(random() * anchors.length)] || { x: 0.5, y: 0.5 };
  const origin = hot && hot.strength > 0.045 ? hot : a;

  const node = {
    x: clamp(origin.x + rnd(-0.16, 0.16), 0.025, 0.975),
    y: clamp(origin.y + rnd(-0.16, 0.16), 0.025, 0.975),
    s: clamp(0.13 + p.mass * 0.065, 0.12, 0.4),
    p: 0.18 + rnd(0, 0.18),
    h: (p.hue + rnd(-22, 22) + 360) % 360,
    ready: memory.days,
    anchor: false,
    echo: true
  };

  memory.nodes.push(node);
  p.mass = Math.max(0, p.mass - 0.045);
  memory.regenerations++;
  stampDeep(node.x, node.y, 0.03, 0.1);
  dirty = true;
  return true;
}

function evolveDeepField(dt) {
  const old = memory.deep;
  const next = old.slice();
  const diffusion = 0.035 + memory.field[1] * 0.04 + memory.history[1] * 0.015;
  const erosion = 0.003 + (1 - memory.field[7]) * 0.004 + (memory.weather === 3 ? 0.003 : 0);
  const pulse = 0.0012 * Math.sin(memory.days * 0.009 + memory.history[0] * 7);

  for (let y = 0; y < DEEP_H; y++) {
    for (let x = 0; x < DEEP_W; x++) {
      const i = deepIndex(x, y);
      const self = old[i];
      const left = old[deepIndex(Math.max(0, x - 1), y)];
      const right = old[deepIndex(Math.min(DEEP_W - 1, x + 1), y)];
      const up = old[deepIndex(x, Math.max(0, y - 1))];
      const down = old[deepIndex(x, Math.min(DEEP_H - 1, y + 1))];
      const diag = (
        old[deepIndex(Math.max(0, x - 1), Math.max(0, y - 1))] +
        old[deepIndex(Math.min(DEEP_W - 1, x + 1), Math.max(0, y - 1))] +
        old[deepIndex(Math.max(0, x - 1), Math.min(DEEP_H - 1, y + 1))] +
        old[deepIndex(Math.min(DEEP_W - 1, x + 1), Math.min(DEEP_H - 1, y + 1))]
      ) / 4;
      const avg = (left + right + up + down + diag + self * 2) / 7;
      const band = (x / (DEEP_W - 1)) * 7;
      const poolIndex = Math.max(0, Math.min(7, Math.floor(band)));
      const poolPush = memory.pools[poolIndex].mass * 0.00015;
      const residuePush = memory.residue[poolIndex] * 0.002;
      const historicalPush = memory.layers.length ? memory.layers[(poolIndex + Math.floor(memory.days)) % memory.layers.length].field[poolIndex] * 0.0004 : 0;
      const drift = 0.0003 * (memory.field[5] - 0.5) * Math.sin(y * 0.31 + memory.days * 0.01);
      next[i] = clamp(self + dt * (diffusion * (avg - self) - erosion * self + pulse + poolPush + residuePush + historicalPush + drift), 0, 1);
    }
  }
  memory.deep = next;
}

function evolveStep(dt) {
  memory.days += dt;
  memory.weatherAge += dt;

  const old = memory.field.slice();
  const layer = memory.layers.at(-1)?.field || base;
  const cycle = Math.sin(memory.days * 0.011 + memory.history[0] * 6) + 0.65 * Math.sin(memory.days * 0.005 + memory.history[1] * 4);
  const activity = 0.43 * old[0] + 0.31 * old[6] + 0.14 * cycle + 0.12 * layer[2];
  const wanted = activity > 0.72 ? 2 : activity > 0.56 ? 1 : old[7] > 0.71 ? 0 : cycle < -0.55 ? 3 : 4;
  if (memory.weatherAge > 12 && (wanted !== memory.weather || memory.weatherAge > 85)) {
    memory.weather = wanted;
    memory.weatherAge = 0;
    memory.epoch++;
    memory.layers.push({ day: +memory.days.toFixed(2), weather: wanted, field: old.map(v => +v.toFixed(3)) });
    if (memory.layers.length > 18) {
      const removed = memory.layers.shift();
      memory.history = memory.history.map((v, i) => clamp(v * 0.997 + removed.field[i] * 0.003));
    }
  }

  for (let i = 0; i < 8; i++) {
    const phase = memory.days * (0.004 + i * 0.00071) + memory.history[i % 3] * 7 + layer[i] * 3;
    const target = 0.49 + 0.17 * Math.sin(phase) + 0.1 * Math.sin(phase * 0.41 + 2 * i) + 0.08 * (layer[i] - 0.5);
    const coupling = 0.0025 * (old[(i + 1) % 8] - old[(i + 4) % 8]);
    const push = [0, 0.01, -0.012, -0.006, 0.007][memory.weather] * (i % 2 ? 1 : -1);
    const poolPush = (memory.pools[i].mass - 0.5) * 0.0004;
    memory.field[i] = clamp(old[i] + dt * (0.037 * (target - old[i]) + coupling + push + poolPush), 0.08, 0.92);
  }

  evolveDeepField(dt);

  const keep = [];
  const decay = [0.7, 0.85, 1.2, 1.5, 0.9][memory.weather];
  for (const n of memory.nodes) {
    if (n.anchor || n.ready > memory.days) {
      keep.push(n);
      continue;
    }
    n.s *= Math.exp(-dt * 0.0035 * decay * (1 - 0.67 * n.p) * (n.echo ? 1.8 : 1));
    n.x = clamp(n.x + Math.sin(memory.days * 0.016 + n.h) * dt * 0.000065, 0.02, 0.98);
    n.y = clamp(n.y + Math.cos(memory.days * 0.013 + n.h) * dt * 0.000065, 0.02, 0.98);
    if (n.s < 0.035) {
      if (!n.echo) {
        memory.expired++;
        memory.forgotten++;
        absorb(n);
      }
    } else {
      keep.push(n);
    }
  }
  memory.nodes = keep;

  const available = memory.nodes.filter(n => !n.anchor && !n.echo && n.ready <= memory.days);
  for (let i = 0; i < Math.min(18, Math.floor(available.length / 5)); i++) {
    const a = available[Math.floor(random() * available.length)];
    const b = available[Math.floor(random() * available.length)];
    if (!a || !b || a === b || !memory.nodes.includes(a) || !memory.nodes.includes(b)) continue;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance < 0.16) {
      a.s = clamp(a.s + 0.002 * dt * (1 - distance / 0.16));
      b.s = clamp(b.s + 0.002 * dt * (1 - distance / 0.16));
    }
    if (distance < 0.048 && random() < Math.min(0.4, 0.07 * dt)) {
      const sum = a.s + b.s;
      const child = {
        x: (a.x * a.s + b.x * b.s) / sum,
        y: (a.y * a.s + b.y * b.s) / sum,
        s: clamp(sum * 0.78),
        p: clamp((a.p + b.p) / 2 + 0.07),
        h: (a.h * a.s + b.h * b.s) / sum,
        anchor: false,
        echo: false,
        ready: memory.days
      };
      memory.nodes.splice(memory.nodes.indexOf(a), 1);
      memory.nodes.splice(memory.nodes.indexOf(b), 1);
      memory.nodes.push(child);
      memory.merged++;
      absorb({ x: child.x, y: child.y, h: child.h, s: 0.05, p: child.p }, 0.4);
    }
  }

  for (const p of memory.pools) p.mass *= Math.exp(-dt * 0.000035);
  memory.residue = memory.residue.map(v => v * Math.exp(-dt * 0.00009));
  const chance = Math.min(0.5, dt * 0.017 * memory.dreamActivity * memory.pools.reduce((s, p) => s + p.mass, 0));
  if (random() < chance) regenerate();

  compact();
  dirty = true;
}

function advance(days) {
  let left = Math.max(0, days);
  while (left > 1e-7) {
    const dt = Math.min(2, left);
    evolveStep(dt);
    left -= dt;
  }
}

function evolve() {
  const t = now();
  const elapsed = Math.min(3650, Math.max(0, t - memory.last) / 60000);
  memory.last = t;
  if (elapsed > 0.0001) advance(elapsed);
}

function submit(features) {
  if (!Array.isArray(features) || features.length !== 8 || features.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) return false;
  evolve();
  const anchors = memory.nodes.filter(n => n.anchor);
  const a = anchors[Math.floor(Math.random() * anchors.length)] || { x: 0.5, y: 0.5 };
  const roam = random() < 0.52;
  const n = {
    x: roam ? rnd(0.05, 0.95) : clamp(a.x + rnd(-0.16, 0.16), 0.03, 0.97),
    y: roam ? rnd(0.05, 0.95) : clamp(a.y + rnd(-0.16, 0.16), 0.03, 0.97),
    s: rnd(0.48, 0.88),
    p: rnd(0.13, 0.63),
    h: (features[0] * 170 + random() * 190) % 360,
    anchor: false,
    echo: false,
    ready: memory.days + rnd(0.2, 3.2)
  };
  memory.nodes.push(n);
  memory.offers++;
  memory.field = memory.field.map((v, i) => clamp(v + (features[i] - 0.5) * 0.009, 0.08, 0.92));
  stampDeep(n.x, n.y, 0.035 + n.p * 0.04, 0.2);
  for (const other of memory.nodes) {
    if (other === n) continue;
    const d = Math.hypot(n.x - other.x, n.y - other.y);
    if (d < 0.17) {
      other.s = clamp(other.s + 0.009 * (1 - d / 0.17));
      n.p = clamp(n.p + 0.007);
    }
  }
  compact();
  dirty = true;
  return true;
}

function snapshot() {
  evolve();
  const deep = deepStats();
  return {
    version: 14,
    days: +memory.days.toFixed(3),
    offers: memory.offers,
    forgotten: memory.forgotten,
    merged: memory.merged,
    waiting: memory.nodes.filter(n => !n.anchor && n.ready > memory.days).length,
    field: memory.field.map(v => +v.toFixed(4)),
    residue: memory.residue.map(v => +v.toFixed(4)),
    weather: names[memory.weather],
    epoch: memory.epoch,
    regenerations: memory.regenerations,
    echoes: memory.nodes.filter(n => n.echo && n.ready <= memory.days).length,
    deepField: memory.deep.map(v => +v.toFixed(3)),
    deepStats: { mean: +deep.mean.toFixed(4), max: +deep.max.toFixed(4), active: deep.active, moments: memory.deepMoments },
    nodes: memory.nodes
      .filter(n => n.anchor || n.ready <= memory.days)
      .map(n => ({ x: +n.x.toFixed(4), y: +n.y.toFixed(4), s: +n.s.toFixed(4), h: +n.h.toFixed(2), anchor: !!n.anchor, echo: !!n.echo }))
  };
}

function diagnostic() {
  const state = snapshot();
  return {
    ...state,
    expired: memory.expired,
    capacity: memory.capacity,
    layers: memory.layers.length,
    anchors: memory.nodes.filter(n => n.anchor).length,
    visible: state.nodes.length,
    pools: memory.pools.map(x => +x.mass.toFixed(4)),
    dreamActivity: memory.dreamActivity,
    regenerationPaused: memory.regenerationPaused
  };
}

function authorized(req) {
  const supplied = req.headers['x-mpe-admin-key'];
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function respond(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(obj));
}

function readJSON(req, limit, cb) {
  let input = '';
  let large = false;
  req.on('data', chunk => {
    input += chunk;
    if (input.length > limit) large = true;
  });
  req.on('end', () => {
    if (large) return cb(Error('too_large'));
    try {
      cb(null, JSON.parse(input));
    } catch {
      cb(Error('invalid_json'));
    }
  });
  req.on('error', () => cb(Error('request_error')));
}

const rates = new Map();
function allowed(ip) {
  const t = now();
  const q = (rates.get(ip) || []).filter(v => t - v < 60000);
  if (q.length >= 12) {
    rates.set(ip, q);
    return false;
  }
  q.push(t);
  rates.set(ip, q);
  return true;
}

const pages = new Set(['/', '/test12.html', '/research14.html']);
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && p === '/api/state') return respond(res, 200, snapshot());

  if (p.startsWith('/api/research/')) {
    if (!authorized(req)) return respond(res, 401, { error: 'admin_key_required' });
    if (req.method === 'GET' && p === '/api/research/diagnostics') return respond(res, 200, diagnostic());
    if (req.method !== 'POST' || p !== '/api/research/experiment') return respond(res, 405, { error: 'method_not_allowed' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'origin' });
    return readJSON(req, 1024, (err, v) => {
      if (err) return respond(res, 400, { error: err.message });
      evolve();
      if (v.action === 'simulate' && Number.isInteger(v.count) && v.count >= 1 && v.count <= 200) {
        for (let i = 0; i < v.count; i++) submit(Array.from({ length: 8 }, random));
      } else if (v.action === 'advance' && Number.isInteger(v.days) && v.days >= 1 && v.days <= 365) {
        advance(v.days);
        memory.last = now();
      } else if (v.action === 'regenerate') {
        for (let i = 0; i < Math.min(10, v.count || 1); i++) regenerate(true);
      } else if (v.action === 'activity' && typeof v.level === 'number' && v.level >= 0.1 && v.level <= 3) {
        memory.dreamActivity = v.level;
      } else if (v.action === 'pause' && typeof v.paused === 'boolean') {
        memory.regenerationPaused = v.paused;
      } else {
        return respond(res, 400, { error: 'invalid_action' });
      }
      dirty = true;
      persist();
      respond(res, 200, { ok: true, metrics: diagnostic() });
    });
  }

  if (req.method === 'POST' && p === '/api/trace') {
    if (!sameOrigin(req)) return respond(res, 403, { error: 'origin' });
    if (!allowed(req.socket.remoteAddress || '?')) return respond(res, 429, { error: 'rate_limit' });
    return readJSON(req, 4096, (err, v) => {
      if (err) return respond(res, 400, { error: err.message });
      if (!submit(v.features)) return respond(res, 400, { error: 'invalid_features' });
      persist();
      respond(res, 202, { accepted: true });
    });
  }

  if (req.method === 'GET' && pages.has(p)) {
    const file = path.join(DIR, p === '/' ? 'test12.html' : p.slice(1));
    if (!fs.existsSync(file)) return respond(res, 404, { error: 'missing_page' });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    return res.end(fs.readFileSync(file));
  }

  if (req.method === 'GET' && photos.includes(p.slice(1))) {
    const file = path.join(DIR, p.slice(1));
    if (!fs.existsSync(file)) return respond(res, 404, { error: 'missing_photo' });
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
    return res.end(fs.readFileSync(file));
  }

  respond(res, 404, { error: 'not_found' });
});

const timer = setInterval(() => {
  evolve();
  persist();
  const t = now();
  for (const [ip, q] of rates) if (q.every(v => t - v > 60000)) rates.delete(ip);
}, 15000);

function stop() {
  clearInterval(timer);
  evolve();
  persist();
  server.close(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

persist();
server.listen(PORT, '0.0.0.0', () => console.log(`MPE 1.3 Deep Memory — http://localhost:${PORT} (memory14.json)`));
