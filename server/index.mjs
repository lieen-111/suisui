#!/usr/bin/env node
/* 碎碎清单 Pro 管理后台 — one file, no npm packages. Node.js 22.13 or newer (built-in node:sqlite).

   What it does
   - Sells Pro outside the App Store (Android and web): 扫码付款 (your own collection QR code, confirmed by you in the
     admin page) or 爱发电 (paid on afdian, checked automatically against afdian's API), and 兑换码 (codes you create).
   - Every unlock is a signed licence (ECDSA P-256). The app checks the signature with the public key built into it, so
     Pro keeps working offline; the server is only needed when someone pays or redeems.
   - The admin page (/admin) shows sales, confirms orders, creates and exports codes, and lists unlocked devices.

   Run:  node server/index.mjs          (data goes to server/data; see server/README.md for a real server)
   Env:  PORT=8787  DATA_DIR=./data  TRUST_PROXY=1 (behind Caddy/Nginx) */
import http from 'node:http';
import os from 'node:os';
import { exec } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA = path.resolve(process.env.DATA_DIR || path.join(HERE, 'data'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
/* Optional: also serve the 碎碎清单 web app (the app/ folder) at / — used by the one-click Windows package. */
const APP_DIR = process.env.APP_DIR ? path.resolve(process.env.APP_DIR) : '';
const VERSION = '1.0.0';
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true });

/* ---------------- database ---------------- */
const db = new DatabaseSync(path.join(DATA, 'suisui.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS codes (
    code TEXT PRIMARY KEY, batch TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', max_devices INTEGER NOT NULL DEFAULT 3,
    created_at INTEGER NOT NULL, expires_at INTEGER, disabled INTEGER NOT NULL DEFAULT 0, order_id TEXT);
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, channel TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL,
    payer_note TEXT NOT NULL DEFAULT '', ext_no TEXT UNIQUE, device TEXT, platform TEXT, code TEXT,
    created_at INTEGER NOT NULL, paid_at INTEGER, closed_at INTEGER, raw TEXT);
  CREATE TABLE IF NOT EXISTS activations (
    id TEXT PRIMARY KEY, code TEXT, order_id TEXT, device TEXT NOT NULL, platform TEXT NOT NULL DEFAULT '',
    app_version TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, revoked_at INTEGER, last_seen INTEGER);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS orders_status ON orders(status, created_at);
  CREATE INDEX IF NOT EXISTS act_code ON activations(code);
  CREATE INDEX IF NOT EXISTS act_device ON activations(device);
`);
const q = sql => db.prepare(sql);
const now = () => Date.now();
const getSetting = (k, d = '') => q('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? d;
const setSetting = (k, v) => q('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
const audit = (action, detail = '') => q('INSERT INTO audit(at, action, detail) VALUES(?, ?, ?)').run(now(), action, typeof detail === 'string' ? detail : JSON.stringify(detail));
const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

/** Shop settings with their defaults. Money is in fen (¥28 = 2800). */
const DEFAULTS = {
  price: 2800, listPrice: 3990, priceNote: '首发价', maxDevices: 3,
  payMode: 'qr', // qr = your own 收款码, you confirm each payment; afdian = 爱发电, checked automatically; off = codes only
  qrLabel: '微信或支付宝扫码', instructions: '付款时在备注里填订单号，我们核对后为你开通。',
  afdianUrl: '', afdianUserId: '', afdianToken: '', afdianPlanId: '',
  contact: '', publicUrl: '',
};
const shop = () => Object.fromEntries(Object.entries(DEFAULTS).map(([k, d]) => { const v = getSetting('shop.' + k, null); return [k, v == null ? d : typeof d === 'number' ? Number(v) : v]; }));

/* ---------------- licence keys ---------------- */
const KEY_FILE = path.join(DATA, 'license-key.pem');
if (!fs.existsSync(KEY_FILE)) {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.writeFileSync(KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
}
const PRIVATE = crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
const PUBLIC_JWK = (() => { const { kty, crv, x, y } = crypto.createPublicKey(PRIVATE).export({ format: 'jwk' }); return { kty, crv, x, y }; })();
const b64u = buf => Buffer.from(buf).toString('base64url');
/** A licence: base64url(JSON) + '.' + base64url(P-256 signature, r||s). The app verifies it with the public key. */
function licence(act) {
  const body = b64u(JSON.stringify({ v: 1, lid: act.id, dev: act.device, src: act.order_id ? 'order' : 'code', ref: act.order_id || act.code, code: act.code || '', iat: act.created_at }));
  const sig = crypto.sign('sha256', Buffer.from(body), { key: PRIVATE, dsaEncoding: 'ieee-p1363' });
  return `${body}.${b64u(sig)}`;
}

/* ---------------- codes and ids ---------------- */
const ABC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I
const rand = n => { const b = crypto.randomBytes(n); return [...b].map(x => ABC[x & 31]).join(''); };
const newCode = () => { for (;;) { const c = rand(12); if (!q('SELECT 1 FROM codes WHERE code = ?').get(c)) return c; } };
const newOrderId = () => { for (;;) { const id = 'S' + rand(6); if (!q('SELECT 1 FROM orders WHERE id = ?').get(id)) return id; } };
const newId = () => crypto.randomUUID();
const normCode = v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^SUISUI/, '');
const showCode = c => `SUISUI-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
const cleanDevice = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const cleanText = (v, n = 80) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

/** Unlock `device` with a code (or reuse its earlier unlock of the same code). Returns { act } or { error }. */
function activate({ code, orderId = null, device, platform, version }) {
  return tx(() => {
    const row = q('SELECT * FROM codes WHERE code = ?').get(code);
    if (!row) return { error: 'bad' };
    if (row.disabled) return { error: 'disabled' };
    if (row.expires_at && row.expires_at < now()) return { error: 'expired' };
    const mine = q('SELECT * FROM activations WHERE code = ? AND device = ? AND revoked_at IS NULL').get(code, device);
    if (mine) { q('UPDATE activations SET last_seen = ? WHERE id = ?').run(now(), mine.id); return { act: mine, code: row }; }
    const used = q('SELECT COUNT(*) n FROM activations WHERE code = ? AND revoked_at IS NULL').get(code).n;
    if (used >= row.max_devices) return { error: 'full', max: row.max_devices };
    const act = { id: newId(), code, order_id: orderId || row.order_id || null, device, platform, app_version: version, created_at: now() };
    q('INSERT INTO activations(id, code, order_id, device, platform, app_version, created_at, last_seen) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
      .run(act.id, act.code, act.order_id, act.device, act.platform, act.app_version, act.created_at, act.created_at);
    return { act, code: row };
  });
}
/** A paid order gets its own code (so the buyer can unlock their other phones too) — made once. */
function codeForOrder(order) {
  if (order.code) return order.code;
  const code = newCode(), s = shop();
  q('INSERT INTO codes(code, batch, note, max_devices, created_at, order_id) VALUES(?, ?, ?, ?, ?, ?)').run(code, 'order', `订单 ${order.id}`, s.maxDevices, now(), order.id);
  q('UPDATE orders SET code = ? WHERE id = ?').run(code, order.id);
  return code;
}
function unlockForOrder(order, device, platform, version) {
  const code = codeForOrder(order);
  const r = activate({ code, orderId: order.id, device, platform, version });
  return r.error ? r : { licence: licence(r.act), code: showCode(code) };
}

/* ---------------- 爱发电 ---------------- */
async function afdianOrder(tradeNo) {
  const s = shop(); if (!s.afdianUserId || !s.afdianToken) return { error: 'afdian-off' };
  const params = JSON.stringify({ out_trade_no: tradeNo }), ts = Math.floor(now() / 1000);
  const sign = crypto.createHash('md5').update(`${s.afdianToken}params${params}ts${ts}user_id${s.afdianUserId}`).digest('hex');
  try {
    const r = await fetch('https://afdian.com/api/open/query-order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: s.afdianUserId, params, ts, sign }), signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.ec !== 200) return { error: 'afdian-error', detail: j.em };
    const o = (j.data?.list || []).find(x => x.out_trade_no === tradeNo);
    return o ? { order: o } : { error: 'not-found' };
  } catch (e) { return { error: 'afdian-unreachable', detail: e.message }; }
}
async function afdianPing() {
  const s = shop(); if (!s.afdianUserId || !s.afdianToken) return { ok: false, detail: '还没填 user_id 和 token' };
  const params = JSON.stringify({ unix: Math.floor(now() / 1000) }), ts = Math.floor(now() / 1000);
  const sign = crypto.createHash('md5').update(`${s.afdianToken}params${params}ts${ts}user_id${s.afdianUserId}`).digest('hex');
  try { const r = await fetch('https://afdian.com/api/open/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: s.afdianUserId, params, ts, sign }), signal: AbortSignal.timeout(8000) }); const j = await r.json(); return { ok: j.ec === 200, detail: j.em || '' }; }
  catch (e) { return { ok: false, detail: e.message }; }
}
/** Record a paid afdian order (from the webhook or a claim). Amount must reach the price; a plan can be required. */
function upsertAfdian(o) {
  const s = shop(), amount = Math.round(Number(o.total_amount || 0) * 100);
  if (Number(o.status) !== 2) return { error: 'unpaid' };
  if (s.afdianPlanId && o.plan_id && o.plan_id !== s.afdianPlanId) return { error: 'other-plan' };
  if (amount < s.price) return { error: 'amount' };
  const hit = q('SELECT * FROM orders WHERE ext_no = ?').get(o.out_trade_no);
  if (hit) return { order: hit };
  const order = { id: newOrderId(), channel: 'afdian', amount, status: 'paid', ext_no: o.out_trade_no, created_at: now(), paid_at: now() };
  q('INSERT INTO orders(id, channel, amount, status, ext_no, created_at, paid_at, payer_note, raw) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(order.id, order.channel, order.amount, order.status, order.ext_no, order.created_at, order.paid_at, cleanText(o.remark, 120), JSON.stringify(o).slice(0, 4000));
  audit('afdian.paid', { order: order.id, trade: o.out_trade_no, amount });
  return { order: q('SELECT * FROM orders WHERE id = ?').get(order.id) };
}

/* ---------------- admin auth ---------------- */
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const checkPw = (pw, stored) => { const [salt, h] = String(stored).split(':'); if (!salt || !h) return false; const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(pw, salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
let setupToken = '';
/* Forgotten password: start once with RESET_ADMIN=1. Only the admin password and sign-ins are cleared;
   orders, codes, licences and the signing key stay. A new setup token is printed as on first use. */
if (process.env.RESET_ADMIN === '1' && getSetting('admin.password')) {
  q("DELETE FROM settings WHERE key = 'admin.password'").run();
  q('DELETE FROM sessions').run();
  audit('admin.reset');
  console.log('\n  管理密码已清除（订单、兑换码和其他数据都还在）。请用下面的设置口令重新设一个密码。');
}
if (!getSetting('admin.password')) {
  setupToken = crypto.randomBytes(18).toString('base64url');
}
function sessionOk(req) {
  const m = /(?:^|;\s*)ss_admin=([\w-]+)/.exec(req.headers.cookie || ''); if (!m) return false;
  const row = q('SELECT * FROM sessions WHERE token_hash = ?').get(sha(m[1]));
  return !!row && row.expires_at > now();
}
function newSession(res, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  q('INSERT INTO sessions(token_hash, created_at, expires_at) VALUES(?, ?, ?)').run(sha(token), now(), now() + 14 * 864e5);
  q('DELETE FROM sessions WHERE expires_at < ?').run(now());
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ss_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${14 * 86400}${secure}`);
}

/* ---------------- rate limits (per IP, in memory) ---------------- */
const hits = new Map();
/** Counts an attempt and says whether `key` went over `max` in the window. */
function limited(key, max, windowMs) {
  const t = now(), list = (hits.get(key) || []).filter(x => t - x < windowMs);
  list.push(t); hits.set(key, list); return list.length > max;
}
/** Over the limit already? (does not count) — for limits that count only failures. */
const over = (key, max, windowMs) => (hits.get(key) || []).filter(x => now() - x < windowMs).length >= max;
setInterval(() => { const t = now(); for (const [k, v] of hits) if (!v.some(x => t - x < 36e5)) hits.delete(k); }, 6e5).unref();
const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

/* ---------------- http helpers ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.apk': 'application/vnd.android.package-archive' };
function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const ok = (res, body) => send(res, 200, body);
const fail = (res, status, error, extra = {}) => send(res, status, { error, ...extra });
async function readBody(req, limit = 64 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function json(req) { const b = await readBody(req); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); } }
const PUBLIC_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400' };

/* ---------------- stats ---------------- */
function dayKey(t, tz = 8) { const d = new Date(t + tz * 3600e3); return d.toISOString().slice(0, 10); } // days in China time
function stats(days = 30) {
  const t = now(), start = new Date(dayKey(t - (days - 1) * 864e5) + 'T00:00:00+08:00').getTime();
  const paid = q("SELECT amount, paid_at, channel FROM orders WHERE status = 'paid' AND paid_at IS NOT NULL").all();
  const sum = since => paid.filter(o => o.paid_at >= since).reduce((a, o) => a + o.amount, 0);
  const todayStart = new Date(dayKey(t) + 'T00:00:00+08:00').getTime();
  const daily = Array.from({ length: days }, (_, i) => ({ date: dayKey(start + i * 864e5), revenue: 0, orders: 0, unlocks: 0 }));
  const at = new Map(daily.map(d => [d.date, d]));
  for (const o of paid) { const d = at.get(dayKey(o.paid_at)); if (d) { d.revenue += o.amount; d.orders++; } }
  for (const a of q('SELECT created_at FROM activations WHERE created_at >= ?').all(start)) { const d = at.get(dayKey(a.created_at)); if (d) d.unlocks++; }
  const channels = {}; for (const o of paid) channels[o.channel] = (channels[o.channel] || 0) + o.amount;
  const codes = q(`SELECT COUNT(*) total, SUM(disabled) disabled,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM activations a WHERE a.code = codes.code AND a.revoked_at IS NULL) THEN 1 ELSE 0 END) used
      FROM codes WHERE order_id IS NULL`).get();
  return {
    revenue: { today: sum(todayStart), d7: sum(todayStart - 6 * 864e5), d30: sum(todayStart - 29 * 864e5), all: sum(0) },
    orders: { paid: paid.length, pending: q("SELECT COUNT(*) n FROM orders WHERE status = 'pending'").get().n, refunded: q("SELECT COUNT(*) n FROM orders WHERE status = 'refunded'").get().n },
    devices: q('SELECT COUNT(DISTINCT device) n FROM activations WHERE revoked_at IS NULL').get().n,
    unlocks: q('SELECT COUNT(*) n FROM activations WHERE revoked_at IS NULL').get().n,
    codes: { total: codes.total || 0, used: codes.used || 0, disabled: codes.disabled || 0 },
    channels, daily,
    recent: q('SELECT at, action, detail FROM audit ORDER BY id DESC LIMIT 12').all(),
  };
}

/* ---------------- backups: one copy a day, 14 kept ---------------- */
function backup(dest) {
  const file = dest || path.join(DATA, 'backups', `suisui-${dayKey(now())}.db`);
  if (fs.existsSync(file)) fs.rmSync(file);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const all = fs.readdirSync(path.join(DATA, 'backups')).filter(f => /^suisui-\d{4}-\d\d-\d\d\.db$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(DATA, 'backups', f));
  return file;
}
if (process.env.NO_BACKUP !== '1') { setTimeout(() => { try { backup(); } catch (e) { console.error('backup failed', e.message); } }, 5000).unref(); setInterval(() => { try { backup(); } catch (e) { console.error('backup failed', e.message); } }, 864e5).unref(); }

/* ---------------- routes ---------------- */
const ERR_TEXT = { bad: '兑换码不存在', disabled: '这个兑换码已停用', expired: '兑换码已过期', full: '这个兑换码绑定的设备已满', unpaid: '订单还没付款', amount: '订单金额不对', 'other-plan': '这不是 Pro 的订单', 'not-found': '没找到这个订单号', 'afdian-off': '爱发电还没接好', 'afdian-unreachable': '暂时连不上爱发电，稍后再试', 'afdian-error': '爱发电返回错误', rate: '试得太频繁了，过一会儿再试', closed: '现在不能扫码下单', device: '缺少设备信息' };

async function publicApi(req, res, url) {
  const p = url.pathname, ip = ipOf(req);
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', PUBLIC_CORS);
  const out = (status, body) => send(res, status, body, 'application/json; charset=utf-8', PUBLIC_CORS);
  const err = (error, extra) => out(error === 'rate' ? 429 : 400, { error, message: ERR_TEXT[error] || error, ...extra });
  if (p === '/api/health') return out(200, { ok: true, version: VERSION });
  if (p === '/api/config' && req.method === 'GET') {
    const s = shop();
    return out(200, { price: s.price, listPrice: s.listPrice, priceNote: s.priceNote, maxDevices: s.maxDevices, contact: s.contact,
      pay: { mode: s.payMode, qrLabel: s.qrLabel, instructions: s.instructions, hasQr: fs.existsSync(path.join(DATA, 'pay-qr')), afdianUrl: s.afdianUrl } });
  }
  if (p === '/api/qr' && req.method === 'GET') {
    const f = path.join(DATA, 'pay-qr'); if (!fs.existsSync(f)) return out(404, { error: 'none' });
    return send(res, 200, fs.readFileSync(f), getSetting('qr.type', 'image/png'), { ...PUBLIC_CORS, 'Cache-Control': 'public, max-age=300' });
  }
  if (req.method !== 'POST') return out(404, { error: 'not-found' });
  const b = await json(req), device = cleanDevice(b.device), platform = cleanText(b.platform, 12), version = cleanText(b.version, 24);
  if (p === '/api/afdian/webhook') {
    const o = b?.data?.order; if (!o?.out_trade_no) return out(200, { ec: 200, em: '' });
    // the webhook is not signed: only trust what afdian's own API confirms (when the token is set)
    const a = await afdianOrder(o.out_trade_no);
    if (!a.error) upsertAfdian(a.order); else audit('afdian.webhook', { trade: o.out_trade_no, check: a.error });
    return out(200, { ec: 200, em: '' });
  }
  if (!device) return err('device');

  if (p === '/api/redeem') {
    // only wrong codes count toward the limit: many phones in China share one public IP
    if (over('redeem-fail:' + ip, 10, 10 * 60e3) || over('redeem-fail:' + device, 6, 10 * 60e3)) return err('rate');
    const code = normCode(b.code); if (code.length !== 12) { limited('redeem-fail:' + ip, 1e9, 10 * 60e3); limited('redeem-fail:' + device, 1e9, 10 * 60e3); return err('bad'); }
    const r = activate({ code, device, platform, version });
    if (r.error) { if (r.error === 'bad') { limited('redeem-fail:' + ip, 1e9, 10 * 60e3); limited('redeem-fail:' + device, 1e9, 10 * 60e3); } audit('redeem.fail', { code: code.slice(0, 4) + '…', error: r.error }); return err(r.error, r.max ? { max: r.max } : {}); }
    audit('redeem', { code: showCode(code), device: device.slice(0, 8), platform });
    return out(200, { licence: licence(r.act), code: showCode(code) });
  }
  if (p === '/api/orders') { // 扫码付款: an order number to write in the payment note; you confirm it in the admin page
    const s = shop(); if (s.payMode !== 'qr') return err('closed');
    if (limited('order:' + device, 6, 60 * 60e3) || limited('order-ip:' + ip, 60, 60 * 60e3)) return err('rate');
    let order = q("SELECT * FROM orders WHERE device = ? AND status = 'pending' AND channel = 'qr' ORDER BY created_at DESC").get(device);
    if (!order) {
      order = { id: newOrderId(), channel: 'qr', amount: s.price, status: 'pending', device, platform, created_at: now() };
      q('INSERT INTO orders(id, channel, amount, status, device, platform, created_at, payer_note) VALUES(?, ?, ?, ?, ?, ?, ?, ?)').run(order.id, 'qr', order.amount, 'pending', device, platform, order.created_at, cleanText(b.note, 60));
      audit('order.new', { order: order.id, platform });
    } else if (b.note) q('UPDATE orders SET payer_note = ? WHERE id = ?').run(cleanText(b.note, 60), order.id);
    return out(200, { id: order.id, amount: order.amount, status: order.status });
  }
  const m = /^\/api\/orders\/(S[0-9A-Z]{6})\/status$/.exec(p);
  if (m) {
    if (limited('poll:' + device, 1200, 60 * 60e3)) return err('rate');
    const order = q('SELECT * FROM orders WHERE id = ?').get(m[1]);
    if (!order || order.device !== device) return err('not-found');
    if (order.status !== 'paid') return out(200, { id: order.id, status: order.status });
    const r = unlockForOrder(order, device, platform, version);
    return r.error ? err(r.error) : out(200, { id: order.id, status: 'paid', ...r });
  }
  if (p === '/api/afdian/claim') { // the buyer pastes the afdian order number; it is checked with afdian itself
    if (over('claim-fail:' + device, 8, 10 * 60e3) || over('claim-fail:' + ip, 20, 10 * 60e3)) return err('rate');
    const miss = e => { limited('claim-fail:' + device, 1e9, 10 * 60e3); limited('claim-fail:' + ip, 1e9, 10 * 60e3); return err(e); };
    const trade = String(b.tradeNo || '').replace(/\D/g, '').slice(0, 40); if (trade.length < 12) return miss('not-found');
    let order = q('SELECT * FROM orders WHERE ext_no = ?').get(trade);
    if (!order) { const a = await afdianOrder(trade); if (a.error) return a.error === 'not-found' ? miss(a.error) : err(a.error); const u = upsertAfdian(a.order); if (u.error) return err(u.error); order = u.order; }
    if (order.status !== 'paid') return err(order.status === 'refunded' ? 'disabled' : 'unpaid');
    if (!order.device) q('UPDATE orders SET device = ?, platform = ? WHERE id = ?').run(device, platform, order.id);
    const r = unlockForOrder(q('SELECT * FROM orders WHERE id = ?').get(order.id), device, platform, version);
    if (r.error) return err(r.error);
    audit('afdian.claim', { order: order.id, device: device.slice(0, 8) });
    return out(200, { status: 'paid', ...r });
  }
  if (p === '/api/check') { // the app asks now and then whether its unlock still stands (refunds)
    if (limited('check:' + device, 30, 60 * 60e3)) return err('rate');
    const lid = cleanText(b.lid, 40); const a = q('SELECT * FROM activations WHERE id = ?').get(lid);
    if (!a || a.device !== device) return out(200, { ok: false });
    q('UPDATE activations SET last_seen = ? WHERE id = ?').run(now(), lid);
    return out(200, { ok: !a.revoked_at });
  }
  return out(404, { error: 'not-found' });
}

async function adminApi(req, res, url) {
  const p = url.pathname.replace(/^\/admin\/api/, ''), ip = ipOf(req);
  if (req.method !== 'GET' && req.headers['x-suisui-admin'] !== '1') return fail(res, 403, 'csrf');
  if (p === '/state') {
    const setup = !getSetting('admin.password');
    /* One-click local package only: a browser on this same computer gets the setup token filled in for it
       (anyone at this computer can already read it in the console window). Never on a server behind a proxy. */
    const local = process.env.LOCAL_PACKAGE === '1' && !TRUST_PROXY && /^(127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress || '');
    return ok(res, { setup, signedIn: sessionOk(req), version: VERSION, ...(setup && local && setupToken ? { token: setupToken } : {}) });
  }
  if (p === '/setup' && req.method === 'POST') {
    if (getSetting('admin.password')) return fail(res, 400, 'done');
    const b = await json(req);
    if (!setupToken || b.token !== setupToken) return fail(res, 403, 'token', { message: '设置口令不对：看服务器启动时打印的那一行' });
    if (String(b.password || '').length < 10) return fail(res, 400, 'weak', { message: '密码至少 10 位' });
    setSetting('admin.password', hashPw(b.password)); setupToken = ''; audit('admin.setup'); newSession(res, req); return ok(res, { ok: true });
  }
  if (p === '/login' && req.method === 'POST') {
    if (limited('login:' + ip, 8, 15 * 60e3)) return fail(res, 429, 'rate', { message: '登录尝试太多，15 分钟后再试' });
    if (!getSetting('admin.password')) return fail(res, 409, 'setup', { message: '还没有设置管理密码，请先设置' });
    const b = await json(req);
    if (!checkPw(String(b.password || ''), getSetting('admin.password'))) { audit('admin.login.fail', ip); return fail(res, 401, 'wrong', { message: '密码不对' }); }
    newSession(res, req); audit('admin.login', ip); return ok(res, { ok: true });
  }
  if (!sessionOk(req)) return fail(res, 401, 'signin');
  if (p === '/logout' && req.method === 'POST') {
    const m = /(?:^|;\s*)ss_admin=([\w-]+)/.exec(req.headers.cookie || ''); if (m) q('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
    res.setHeader('Set-Cookie', 'ss_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return ok(res, { ok: true });
  }
  if (p === '/stats') return ok(res, stats(Math.min(90, Math.max(7, Number(url.searchParams.get('days')) || 30))));

  if (p === '/orders' && req.method === 'GET') {
    const st = url.searchParams.get('status') || '', term = `%${(url.searchParams.get('q') || '').trim()}%`;
    const rows = q(`SELECT * FROM orders WHERE (? = '' OR status = ?) AND (id LIKE ? OR payer_note LIKE ? OR IFNULL(ext_no,'') LIKE ? OR IFNULL(code,'') LIKE ?) ORDER BY created_at DESC LIMIT 300`).all(st, st, term, term, term, term);
    return ok(res, rows.map(({ raw, ...o }) => ({ ...o, code: o.code ? showCode(o.code) : '' })));
  }
  let m = /^\/orders\/(S[0-9A-Z]{6})\/(confirm|reject|refund)$/.exec(p);
  if (m && req.method === 'POST') {
    const order = q('SELECT * FROM orders WHERE id = ?').get(m[1]); if (!order) return fail(res, 404, 'not-found');
    if (m[2] === 'confirm') { if (order.status !== 'pending') return fail(res, 400, 'state'); q("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(now(), order.id); codeForOrder(q('SELECT * FROM orders WHERE id = ?').get(order.id)); audit('order.confirm', order.id); }
    if (m[2] === 'reject') { if (order.status !== 'pending') return fail(res, 400, 'state'); q("UPDATE orders SET status = 'rejected', closed_at = ? WHERE id = ?").run(now(), order.id); audit('order.reject', order.id); }
    if (m[2] === 'refund') { // refund: the order's code stops working and its unlocks are withdrawn
      if (order.status !== 'paid') return fail(res, 400, 'state');
      tx(() => { q("UPDATE orders SET status = 'refunded', closed_at = ? WHERE id = ?").run(now(), order.id); if (order.code) { q('UPDATE codes SET disabled = 1 WHERE code = ?').run(order.code); q('UPDATE activations SET revoked_at = ? WHERE code = ? AND revoked_at IS NULL').run(now(), order.code); } });
      audit('order.refund', order.id);
    }
    return ok(res, { ok: true });
  }

  if (p === '/codes' && req.method === 'GET') {
    const st = url.searchParams.get('status') || '', batch = url.searchParams.get('batch') || '', term = normCode(url.searchParams.get('q') || '');
    const rows = q(`SELECT c.*, (SELECT COUNT(*) FROM activations a WHERE a.code = c.code AND a.revoked_at IS NULL) used, (SELECT MAX(created_at) FROM activations a WHERE a.code = c.code) last_used
      FROM codes c WHERE (? = '' OR c.batch = ?) AND (? = '' OR c.code LIKE ?) ORDER BY c.created_at DESC LIMIT 1000`).all(batch, batch, term, `%${term}%`);
    const list = rows.map(c => ({ ...c, display: showCode(c.code), state: c.disabled ? 'disabled' : c.expires_at && c.expires_at < now() ? 'expired' : c.used ? (c.used >= c.max_devices ? 'full' : 'used') : 'unused' }))
      .filter(c => !st || c.state === st || (st === 'used' && c.state === 'full'));
    const batches = q("SELECT batch, COUNT(*) n, MIN(created_at) at FROM codes WHERE batch != '' GROUP BY batch ORDER BY at DESC").all();
    return ok(res, { list, batches });
  }
  if (p === '/codes' && req.method === 'POST') {
    const b = await json(req), n = Math.min(500, Math.max(1, Number(b.count) || 1)), max = Math.min(10, Math.max(1, Number(b.maxDevices) || shop().maxDevices));
    const days = Number(b.expiresDays) || 0, batch = cleanText(b.batch, 30) || `批次 ${dayKey(now())}`, note = cleanText(b.note, 80), t = now();
    const made = tx(() => Array.from({ length: n }, () => { const c = newCode(); q('INSERT INTO codes(code, batch, note, max_devices, created_at, expires_at) VALUES(?, ?, ?, ?, ?, ?)').run(c, batch, note, max, t, days > 0 ? t + days * 864e5 : null); return showCode(c); }));
    audit('codes.create', { batch, count: n }); return ok(res, { batch, codes: made });
  }
  m = /^\/codes\/([0-9A-Z-]+)\/(disable|enable|reset)$/.exec(p);
  if (m && req.method === 'POST') {
    const code = normCode(m[1]); if (!q('SELECT 1 FROM codes WHERE code = ?').get(code)) return fail(res, 404, 'not-found');
    if (m[2] === 'reset') q('UPDATE activations SET revoked_at = ? WHERE code = ? AND revoked_at IS NULL').run(now(), code); // frees its devices (the buyer changed phones)
    else q('UPDATE codes SET disabled = ? WHERE code = ?').run(m[2] === 'disable' ? 1 : 0, code);
    audit('code.' + m[2], showCode(code)); return ok(res, { ok: true });
  }
  if (p === '/codes.csv') {
    const batch = url.searchParams.get('batch') || '';
    const rows = q(`SELECT c.*, (SELECT COUNT(*) FROM activations a WHERE a.code = c.code AND a.revoked_at IS NULL) used FROM codes c WHERE (? = '' OR batch = ?) ORDER BY created_at`).all(batch, batch);
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿兑换码,批次,备注,可用设备,已用,状态,创建时间\n' + rows.map(c => [showCode(c.code), c.batch, c.note, c.max_devices, c.used, c.disabled ? '停用' : c.used ? '已用' : '未用', new Date(c.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })].map(cell).join(',')).join('\n');
    return send(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="suisui-codes${batch ? '-' + encodeURIComponent(batch) : ''}.csv"` });
  }

  if (p === '/activations' && req.method === 'GET') {
    const term = `%${(url.searchParams.get('q') || '').trim()}%`, code = normCode(url.searchParams.get('q') || '');
    const rows = q(`SELECT * FROM activations WHERE device LIKE ? OR IFNULL(order_id,'') LIKE ? OR (? != '' AND IFNULL(code,'') LIKE ?) ORDER BY created_at DESC LIMIT 500`).all(term, term, code, `%${code}%`);
    return ok(res, rows.map(a => ({ ...a, code: a.code ? showCode(a.code) : '' })));
  }
  m = /^\/activations\/([\w-]+)\/revoke$/.exec(p);
  if (m && req.method === 'POST') { q('UPDATE activations SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(now(), m[1]); audit('unlock.revoke', m[1]); return ok(res, { ok: true }); }

  if (p === '/settings' && req.method === 'GET') { const s = shop(); return ok(res, { ...s, afdianToken: s.afdianToken ? '••••••' : '', hasQr: fs.existsSync(path.join(DATA, 'pay-qr')) }); }
  if (p === '/settings' && req.method === 'PUT') {
    const b = await json(req);
    for (const [k, d] of Object.entries(DEFAULTS)) {
      if (!(k in b)) continue;
      if (k === 'afdianToken' && (b[k] === '••••••' || b[k] == null)) continue;
      let v = b[k];
      if (typeof d === 'number') { v = Math.round(Number(v)); if (!Number.isFinite(v) || v < 0) return fail(res, 400, 'value', { message: `${k} 不是有效数字` }); }
      else v = cleanText(v, k === 'instructions' ? 200 : 160);
      if (k === 'payMode' && !['qr', 'afdian', 'off'].includes(v)) return fail(res, 400, 'value');
      if (k === 'maxDevices' && (v < 1 || v > 10)) return fail(res, 400, 'value', { message: '每个码可用设备 1–10 台' });
      setSetting('shop.' + k, v);
    }
    audit('settings', Object.keys(b).filter(k => k !== 'afdianToken').join(',')); return ok(res, { ok: true });
  }
  if (p === '/qr' && req.method === 'POST') {
    const type = String(req.headers['content-type'] || ''); if (!/^image\/(png|jpeg|webp)$/.test(type)) return fail(res, 400, 'type', { message: '只支持 PNG / JPG / WebP' });
    const buf = await readBody(req, 2 * 1024 * 1024); fs.writeFileSync(path.join(DATA, 'pay-qr'), buf); setSetting('qr.type', type); audit('qr.upload', `${buf.length} bytes`); return ok(res, { ok: true });
  }
  if (p === '/qr' && req.method === 'DELETE') { fs.rmSync(path.join(DATA, 'pay-qr'), { force: true }); audit('qr.remove'); return ok(res, { ok: true }); }
  if (p === '/afdian/test' && req.method === 'POST') return ok(res, await afdianPing());
  if (p === '/app-config') {
    const base = shop().publicUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    return ok(res, { server: base.replace(/\/$/, ''), publicKey: PUBLIC_JWK, webhook: base.replace(/\/$/, '') + '/api/afdian/webhook' });
  }
  if (p === '/password' && req.method === 'POST') {
    const b = await json(req);
    if (!checkPw(String(b.old || ''), getSetting('admin.password'))) return fail(res, 400, 'wrong', { message: '原密码不对' });
    if (String(b.password || '').length < 10) return fail(res, 400, 'weak', { message: '新密码至少 10 位' });
    setSetting('admin.password', hashPw(b.password)); q('DELETE FROM sessions').run(); newSession(res, req); audit('admin.password'); return ok(res, { ok: true });
  }
  if (p === '/backup') {
    const file = path.join(DATA, 'backups', `download-${now()}.db`); backup(file);
    const buf = fs.readFileSync(file); fs.rmSync(file);
    audit('backup.download');
    return send(res, 200, buf, 'application/octet-stream', { 'Content-Disposition': `attachment; filename="suisui-backup-${dayKey(now())}.db"` });
  }
  if (p === '/audit') return ok(res, q('SELECT * FROM audit ORDER BY id DESC LIMIT 300').all());
  return fail(res, 404, 'not-found');
}

function appFile(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'bad path', 'text/plain'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(APP_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!(f === APP_DIR || f.startsWith(APP_DIR + path.sep)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
}

function staticFile(res, file) {
  const f = path.join(HERE, 'admin', file);
  if (!f.startsWith(path.join(HERE, 'admin')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream', {
    'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) return await publicApi(req, res, url);
    if (url.pathname.startsWith('/admin/api/')) return await adminApi(req, res, url);
    if ((url.pathname === '/' && !APP_DIR) || url.pathname === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    if (url.pathname.startsWith('/admin/')) return staticFile(res, url.pathname.slice(7) || 'index.html');
    if (APP_DIR && (req.method === 'GET' || req.method === 'HEAD')) return appFile(res, url.pathname);
    send(res, 404, 'not found', 'text/plain');
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'server', ...(e.status ? {} : { message: '服务器出错了' }) }, 'application/json; charset=utf-8', url.pathname.startsWith('/api/') ? PUBLIC_CORS : {});
    if (!e.status) console.error(e);
  }
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`端口 ${PORT} 已被占用：后台可能已经在另一个窗口里运行了。直接打开 http://localhost:${PORT}/admin/ 即可。`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  if (process.env.LOCAL_PACKAGE === '1') {
    const lan = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
    console.log('');
    console.log('  碎碎清单已在这台电脑上运行。这个窗口不要关，关掉就停了。');
    console.log('');
    console.log(`  电脑上：  网页版 http://localhost:${PORT}/      管理后台 http://localhost:${PORT}/admin/`);
    for (const ip of lan) console.log(`  手机上（连同一个 Wi-Fi）：  网页版 http://${ip}:${PORT}/      管理后台 http://${ip}:${PORT}/admin/`);
    if (!lan.length) console.log('  没有检测到局域网地址：手机要和电脑连同一个 Wi-Fi 才能打开。');
    if (APP_DIR && fs.existsSync(path.join(APP_DIR, 'suisui.apk'))) for (const ip of lan) console.log(`  安卓手机下载安装包（同一个 Wi-Fi）：  http://${ip}:${PORT}/suisui.apk`);
    console.log(`  数据保存在：${DATA}`);
    if (setupToken) console.log(`\n  第一次打开管理后台时，设置口令是：  ${setupToken}  （用一次就失效）`);
    console.log('');
    if (process.platform === 'win32' && process.env.OPEN_BROWSER === '1') exec(`start "" "http://localhost:${PORT}/"`);
    return;
  }
  console.log(`碎碎清单后台 ${VERSION} · http://localhost:${PORT}/admin/ · 数据在 ${DATA}`);
  if (setupToken) console.log(`第一次使用：打开 http://localhost:${PORT}/admin/ ，设置口令是  ${setupToken}  （用一次就失效）`);
});
export { server, db, licence, PUBLIC_JWK };
