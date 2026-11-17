// 碎碎清单 Pro 后台: starts server/index.mjs on a throwaway data folder and walks every flow —
// setup and sign-in, codes (create, redeem, device limit, restore on the same device, disable, reset), 扫码付款 orders
// (create → confirm → the app's poll gets a licence), refunds revoke, licences verify with WebCrypto exactly like the app,
// admin endpoints refuse requests without a session or the CSRF header, rate limits, stats.
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const PORT = 8790 + Math.floor(Math.random() * 100), BASE = `http://127.0.0.1:${PORT}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'suisui-server-'));

(async () => {
  const proc = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server', 'index.mjs')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: data, NO_BACKUP: '1', HOST: '127.0.0.1' } });
  let log = ''; proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 50 && !/设置口令是/.test(log); i++) await new Promise(r => setTimeout(r, 100));
  const token = /设置口令是\s+(\S+)/.exec(log)?.[1]; assert.ok(token, 'server prints a one-time setup token:\n' + log);
  let cookie = '';
  const call = async (p, { method = 'GET', body, admin = true, raw, type } = {}) => {
    const headers = {}; if (admin) { headers['x-suisui-admin'] = '1'; if (cookie) headers.cookie = cookie; }
    if (body !== undefined) headers['content-type'] = type || 'application/json';
    const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set && admin) cookie = set.split(';')[0];
    const ct = r.headers.get('content-type') || ''; return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text(), headers: r.headers };
  };
  try {
    // ---- setup and auth
    assert.equal((await call('/admin/api/state')).body.setup, true);
    assert.equal((await call('/admin/api/setup', { method: 'POST', body: { token: 'nope', password: 'abcdefghijk' } })).status, 403, 'wrong setup token is refused');
    assert.equal((await call('/admin/api/setup', { method: 'POST', body: { token, password: 'short' } })).status, 400, 'short password is refused');
    assert.equal((await call('/admin/api/setup', { method: 'POST', body: { token, password: 'correct horse battery' } })).status, 200);
    assert.equal((await call('/admin/api/setup', { method: 'POST', body: { token, password: 'another password' } })).status, 400, 'setup works once');
    const saved = cookie; cookie = '';
    assert.equal((await call('/admin/api/stats')).status, 401, 'admin API needs a session');
    assert.equal((await call('/admin/api/login', { method: 'POST', body: { password: 'wrong wrong' } })).status, 401);
    assert.equal((await call('/admin/api/login', { method: 'POST', body: { password: 'correct horse battery' } })).status, 200);
    assert.ok(cookie && cookie !== saved, 'login sets a session cookie');
    assert.equal((await fetch(BASE + '/admin/api/codes', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{"count":1}' })).status, 403, 'writes need the CSRF header');
    const page = await fetch(BASE + '/admin/'); assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);

    // ---- licence key published for the app
    const cfg = (await call('/admin/api/app-config')).body; assert.equal(cfg.publicKey.crv, 'P-256');
    const key = await crypto.subtle.importKey('jwk', { ...cfg.publicKey, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const verify = async lic => { const [b, s] = lic.split('.'); const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(s, 'base64url'), new TextEncoder().encode(b)); return ok && JSON.parse(Buffer.from(b, 'base64url').toString()); };

    // ---- codes
    const made = (await call('/admin/api/codes', { method: 'POST', body: { count: 3, maxDevices: 2, batch: '测试批次', note: 'x' } })).body;
    assert.equal(made.codes.length, 3); assert.match(made.codes[0], /^SUISUI-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    const code = made.codes[0], pub = (p, body) => call(p, { method: 'POST', body, admin: false });
    let r = await pub('/api/redeem', { code: code.toLowerCase().replace(/-/g, ' '), device: 'dev-a', platform: 'android', version: '1.20' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); const lic = await verify(r.body.licence); assert.ok(lic, 'licence signature verifies with WebCrypto'); assert.equal(lic.dev, 'dev-a');
    const again = await pub('/api/redeem', { code, device: 'dev-a', platform: 'android' }); assert.equal(again.status, 200, 'same device redeems again (restore)'); assert.equal((await verify(again.body.licence)).lid, lic.lid, 'restore returns the same unlock');
    assert.equal((await pub('/api/redeem', { code, device: 'dev-b', platform: 'web' })).status, 200);
    r = await pub('/api/redeem', { code, device: 'dev-c', platform: 'web' }); assert.equal(r.body.error, 'full', 'device limit holds'); assert.match(r.body.message, /已满/);
    assert.equal((await pub('/api/redeem', { code: 'SUISUI-2222-2222-2222', device: 'dev-a' })).body.error, 'bad');
    assert.equal((await call(`/admin/api/codes/${code}/reset`, { method: 'POST' })).status, 200);
    assert.equal((await pub('/api/redeem', { code, device: 'dev-c', platform: 'web' })).status, 200, 'reset frees the devices');
    assert.equal((await pub('/api/check', { lid: lic.lid, device: 'dev-a' })).body.ok, false, 'reset withdrew dev-a');
    await call(`/admin/api/codes/${made.codes[1]}/disable`, { method: 'POST' });
    assert.equal((await pub('/api/redeem', { code: made.codes[1], device: 'dev-a' })).body.error, 'disabled');
    const list = (await call('/admin/api/codes?batch=' + encodeURIComponent('测试批次'))).body; assert.equal(list.list.length, 3);
    const csv = await call('/admin/api/codes.csv'); assert.match(csv.body, /兑换码,批次/); assert.match(csv.body, new RegExp(code));

    // ---- 扫码付款 order
    await call('/admin/api/settings', { method: 'PUT', body: { payMode: 'qr', price: 2800, contact: '小红书 @碎碎清单' } });
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    assert.equal((await call('/admin/api/qr', { method: 'POST', body: png, raw: true, type: 'image/png' })).status, 200);
    const pubCfg = (await call('/api/config', { admin: false })).body; assert.equal(pubCfg.pay.mode, 'qr'); assert.equal(pubCfg.pay.hasQr, true); assert.equal(pubCfg.price, 2800);
    assert.equal((await fetch(BASE + '/api/qr')).headers.get('access-control-allow-origin'), '*');
    const o = (await pub('/api/orders', { device: 'phone-1', platform: 'android', note: '微信' })).body; assert.match(o.id, /^S[2-9A-Z]{6}$/); assert.equal(o.status, 'pending');
    assert.equal((await pub('/api/orders', { device: 'phone-1', platform: 'android' })).body.id, o.id, 'one open order per device');
    assert.equal((await pub(`/api/orders/${o.id}/status`, { device: 'phone-1' })).body.status, 'pending');
    assert.equal((await pub(`/api/orders/${o.id}/status`, { device: 'someone-else' })).body.error, 'not-found', 'only the ordering device can poll it');
    assert.equal((await call(`/admin/api/orders/${o.id}/confirm`, { method: 'POST' })).status, 200);
    const paid = (await pub(`/api/orders/${o.id}/status`, { device: 'phone-1', platform: 'android' })).body;
    assert.equal(paid.status, 'paid'); assert.match(paid.code, /^SUISUI-/); const ol = await verify(paid.licence); assert.equal(ol.src, 'order'); assert.equal(ol.ref, o.id);
    assert.equal((await pub('/api/redeem', { code: paid.code, device: 'tablet-1', platform: 'web' })).status, 200, "the order's code unlocks the buyer's other devices");
    // refund withdraws everything the order unlocked
    assert.equal((await call(`/admin/api/orders/${o.id}/refund`, { method: 'POST' })).status, 200);
    assert.equal((await pub('/api/check', { lid: ol.lid, device: 'phone-1' })).body.ok, false, 'refund revokes');
    assert.equal((await pub('/api/redeem', { code: paid.code, device: 'phone-9' })).body.error, 'disabled');
    // a rejected order
    const o2 = (await pub('/api/orders', { device: 'phone-2', platform: 'android' })).body; await call(`/admin/api/orders/${o2.id}/reject`, { method: 'POST' });
    assert.equal((await pub(`/api/orders/${o2.id}/status`, { device: 'phone-2' })).body.status, 'rejected');

    // ---- 爱发电 without a token cannot be claimed (never trusted blindly)
    await call('/admin/api/settings', { method: 'PUT', body: { payMode: 'afdian' } });
    assert.equal((await pub('/api/afdian/claim', { tradeNo: '202611171234567890', device: 'x1' })).body.error, 'afdian-off');
    const hook = await call('/api/afdian/webhook', { method: 'POST', body: { ec: 200, data: { type: 'order', order: { out_trade_no: '202611171234567890', status: 2, total_amount: '28.00' } } }, admin: false });
    assert.deepEqual(hook.body, { ec: 200, em: '' }, 'webhook answers afdian in its format');
    assert.equal((await pub('/api/afdian/claim', { tradeNo: '202611171234567890', device: 'x1' })).body.error, 'afdian-off', 'an unsigned webhook alone does not create a paid order');
    assert.equal((await pub('/api/orders', { device: 'phone-3' })).body.error, 'closed', 'QR orders stop when the mode changes');

    // ---- stats and settings
    const st = (await call('/admin/api/stats?days=7')).body;
    assert.equal(st.orders.paid, 0, 'refunded order no longer counts as paid'); assert.equal(st.orders.refunded, 1); assert.equal(st.daily.length, 7);
    assert.equal(st.unlocks, 1, 'only dev-c still holds an unlock'); assert.equal(st.codes.total, 3);
    const set = (await call('/admin/api/settings')).body; assert.equal(set.contact, '小红书 @碎碎清单'); assert.equal(set.hasQr, true);
    assert.equal((await call('/admin/api/settings', { method: 'PUT', body: { maxDevices: 99 } })).status, 400);

    // ---- rate limit on redeem guesses
    let limited = false; for (let i = 0; i < 9; i++) { const x = await pub('/api/redeem', { code: 'SUISUI-3333-3333-333' + (i % 8 + 2), device: 'guess' }); if (x.status === 429) { limited = true; break; } }
    assert.ok(limited, 'guessing codes gets rate limited (per device)');
    assert.equal((await pub('/api/redeem', { code: made.codes[2], device: 'honest-phone' })).status, 200, 'a right code from the same IP still works');

    // ---- backup download is a SQLite file; password change signs other sessions out
    const bk = await fetch(BASE + '/admin/api/backup', { headers: { cookie } }); assert.equal(bk.status, 200); assert.equal(Buffer.from(await bk.arrayBuffer()).subarray(0, 15).toString(), 'SQLite format 3');
    const old = cookie; assert.equal((await call('/admin/api/password', { method: 'POST', body: { old: 'correct horse battery', password: 'a brand new password' } })).status, 200);
    const stale = await fetch(BASE + '/admin/api/stats', { headers: { cookie: old } }); assert.equal(stale.status, 401, 'old session is signed out');
    console.log('PASS: server — setup/login/CSRF, codes (redeem, device limit, restore, reset, disable, CSV), QR orders (confirm → licence, reject, refund revokes), afdian guarded, licences verify with WebCrypto, stats, rate limit, backup, password change');
  } catch (e) { console.error(log); throw e; } finally { proc.kill(); fs.rmSync(data, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
