// ===========================================
// PRODUCT USAGE - Help make Event Book better (the rules; pure)
// Opt in on this device (off by default). Event Book's own events then go as {type, at,
// stream}: the event's data is always dropped (no names, no text, no comments, no model
// content); the book's id becomes a stream token, a SHA-256 of a secret that never leaves the
// device, salted per payload, so the same book is one token within a payload and can't be
// matched across payloads. The device keeps a small log of its own: Opted In / Opted Out /
// Sent. The first send always shows the exact payload; after that, a week at a time by itself.
// SV: Retries and Drop Off read what was sent (S7, S8).
// ===========================================

export const APP = 'eventpad';
const DAY = 86400000, WEEK = 7 * DAY;
const OFF = 'Not switched on: Settings → Help make Event Book better';

// ---------- the device's log ----------

export function isOn(log) {
  const last = [...(log || [])].reverse().find(e => e.type === 'ProductUsageOptedIn' || e.type === 'ProductUsageOptedOut');
  return last?.type === 'ProductUsageOptedIn';
}
const sends = log => (log || []).filter(e => e.type === 'ProductUsageSent');

// SC: Opt In To Product Usage / Opt Out
export function decideOptIn(log, { deviceId, at }) {
  if (isOn(log)) return { rejected: 'Already helping: thank you' };
  return { events: [{ type: 'ProductUsageOptedIn', data: { deviceId, at } }] };
}
export function decideOptOut(log, { deviceId, at }) {
  if (!isOn(log)) return { rejected: 'Not switched on' };
  return { events: [{ type: 'ProductUsageOptedOut', data: { deviceId, at } }] };
}

// ---------- S3 Prepare ----------

// SHA-256 of a string (UTF-8), as hex: the stream token, sync so this stays a pure rule
const K = Uint32Array.from([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(text) {
  const bytes = new TextEncoder().encode(String(text));
  const len = bytes.length, words = new Uint32Array(((len + 9 + 63) >> 6) << 4);
  bytes.forEach((b, i) => { words[i >> 2] |= b << (24 - (i % 4) * 8); });
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  words[words.length - 1] = len * 8;
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < words.length; o += 16) {
    for (let i = 0; i < 64; i++) {
      w[i] = i < 16 ? words[o + i]
        : (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10)) + w[i - 7] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 16];
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, k].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return [...h].map(v => v.toString(16).padStart(8, '0')).join('');
}

const round = (iso, to) => {
  if (to !== 'hour') return new Date(iso).toISOString();
  const d = new Date(iso); d.setUTCMinutes(0, 0, 0); return d.toISOString();
};

// books: [{ id, events }] on this device; since/until: the window (ISO); secret: this device's
// → { payload: { app, since, until, events: [{ type, at, stream }] } } or { refused }
export function prepareUsage(books, { since, until, secret, roundTo = null }) {
  const from = Date.parse(since), to = Date.parse(until);
  const events = [];
  for (const b of books || []) {
    const stream = sha256(`${secret}|${since}|${b.id}`).slice(0, 16);
    for (const e of b.events || []) {
      const t = Date.parse(e.timestamp);
      if (!(t >= from && t <= to)) continue;
      events.push({ type: String(e.type), at: round(e.timestamp, roundTo), stream });
    }
  }
  if (!events.length) return { refused: 'Nothing to send in that window' };
  events.sort((a, b) => a.at.localeCompare(b.at));
  return { payload: { app: APP, since: new Date(from).toISOString(), until: new Date(to).toISOString(), events } };
}

// ---------- S4 Preview ----------

const n = (k, one, many = `${one}s`) => `${k.toLocaleString('en')} ${k === 1 ? one : many}`;
export function usageSummary(payload) {
  if (!payload) return '';
  const types = new Set(payload.events.map(e => e.type)).size, streams = new Set(payload.events.map(e => e.stream)).size;
  const days = Math.max(1, Math.round((Date.parse(payload.until) - Date.parse(payload.since)) / DAY));
  return `${n(payload.events.length, 'event')} · ${n(types, 'type')} · ${n(streams, 'anonymous book')} · ${n(days, 'day')}`;
}

// ---------- S5 / S11 Send ----------

export function sendRefusal(log, payload) {
  if (!isOn(log)) return OFF;
  if (!payload?.events?.length) return 'Prepare it first';
  if (sends(log).some(s => s.data.since === payload.since && s.data.until === payload.until)) return 'Already sent for that window';
  return null;
}

// When the next payload is due: the first time (shown before it goes), then a week after the last
export function nextSend(log, now) {
  if (!isOn(log)) return { due: false };
  const t = Date.parse(now);
  const last = sends(log).map(s => s.data.until).sort().pop();
  if (!last) return { due: true, show: true, since: new Date(t - WEEK).toISOString() };
  return t - Date.parse(last) >= WEEK ? { due: true, show: false, since: last } : { due: false };
}

// ---------- S7, S8: what was sent shows ----------

const spaced = type => String(type).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ');

// SV: Retries — the same event type on one stream, again and again, each within `within` of the last
export function retries(events, { withinMs = 5 * 60000, min = 3 } = {}) {
  const runs = new Map();   // type → { attempts, streams:Set }
  const byKey = new Map();
  [...events].sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach(e => {
    const k = `${e.stream}|${e.type}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  });
  for (const list of byKey.values()) {
    let run = [list[0]];
    const close = () => {
      if (run.length >= min) {
        const r = runs.get(run[0].type) || { attempts: 0, streams: new Set() };
        r.attempts += run.length; r.streams.add(run[0].stream); runs.set(run[0].type, r);
      }
    };
    for (let i = 1; i < list.length; i++) {
      if (Date.parse(list[i].at) - Date.parse(list[i - 1].at) <= withinMs) run.push(list[i]);
      else { close(); run = [list[i]]; }
    }
    close();
  }
  return [...runs].map(([type, r]) => ({ type, attempts: r.attempts, streams: r.streams.size, within: `${Math.round(withinMs / 60000)} minutes` }))
    .sort((a, b) => b.attempts - a.attempts);
}

// SV: Drop Off — each stream's last event: where many of them stop
export function dropOff(events) {
  const last = new Map();
  [...events].sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach(e => last.set(e.stream, e.type));
  const total = last.size, counts = new Map();
  // In the order streams first appear, so ties keep a stable order
  const order = [...new Set(events.map(e => e.stream))];
  order.forEach(s => { const t = last.get(s); counts.set(t, (counts.get(t) || 0) + 1); });
  return [...counts].map(([type, k]) => ({ after: spaced(type), share: Math.round((k / total) * 100) / 100, streams: k }))
    .sort((a, b) => b.streams - a.streams);
}
