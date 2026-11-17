// Real checkout against the real backend: starts server/index.mjs, points the app at it (release config: no free Pro),
// then in Chromium: 扫码付款 order → confirmed in the admin API → the app's poll turns Pro on → reload keeps it (licence
// verified offline) → a forged licence is refused → 兑换码 on a second device → device limit message → refund withdraws.
// Needs the app server (npm start) like the other tests; LOCKTODO_URL points at it.
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { chromium, url, launchOptions } = require('./test-environment.cjs');
const PORT = 8890 + Math.floor(Math.random() * 90), SERVER = `http://127.0.0.1:${PORT}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'suisui-pay-'));

(async () => {
  const proc = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server', 'index.mjs')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: data, NO_BACKUP: '1', HOST: '127.0.0.1' } });
  let log = ''; proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 50 && !/设置口令是/.test(log); i++) await new Promise(r => setTimeout(r, 100));
  const token = /设置口令是\s+(\S+)/.exec(log)[1];
  let cookie = '';
  const admin = async (p, method = 'GET', body) => { const r = await fetch(SERVER + p, { method, headers: { 'x-suisui-admin': '1', 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }); const s = r.headers.get('set-cookie'); if (s) cookie = s.split(';')[0]; return r.json(); };
  const browser = await chromium.launch(launchOptions);
  try {
    await admin('/admin/api/setup', 'POST', { token, password: 'pay test password' });
    await admin('/admin/api/settings', 'PUT', { payMode: 'qr', price: 2800, listPrice: 3990, contact: '测试联系人', maxDevices: 2 });
    const png = fs.readFileSync(path.join(__dirname, '..', 'app', 'icons', 'icon-192.png'));
    await fetch(SERVER + '/admin/api/qr', { method: 'POST', headers: { 'x-suisui-admin': '1', 'content-type': 'image/png', cookie }, body: png });
    const { publicKey } = await admin('/admin/api/app-config');
    const release = { freeForTesters: false, server: SERVER, publicKey };

    const device = async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.addInitScript(cfg => { window.SUISUI_PRO_CONFIG = cfg; }, release);
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(url + '/?view=settings', { waitUntil: 'networkidle' });
      return { ctx, page, errors };
    };
    const isPro = page => page.evaluate(() => window.SuiSuiPro.isPro());

    // ---- phone A pays by QR
    const A = await device();
    assert.equal(await isPro(A.page), false, 'release build starts without Pro');
    await A.page.evaluate(() => window.SuiSuiPro.openPay());
    await A.page.locator('#pro-start-qr').waitFor();
    assert.match(await A.page.locator('.pro-pay-amt').textContent(), /¥28/, 'price comes from the server');
    assert.match(await A.page.locator('#pro-pay').textContent(), /测试联系人/, 'contact from the server is shown');
    await A.page.locator('#pro-start-qr').click();
    await A.page.locator('#pro-qr-img').waitFor();
    assert.ok(await A.page.locator('#pro-qr-img').evaluate(i => i.decode().then(() => i.naturalWidth > 0)), 'the uploaded QR shows');
    const orderId = (await A.page.locator('.pro-order-id b').textContent()).trim(); assert.match(orderId, /^S[2-9A-Z]{6}$/);
    await A.page.locator('#pro-paid').click();
    await A.page.locator('.pro-pay-wait').waitFor();
    const orders = await admin('/admin/api/orders?status=pending'); assert.equal(orders[0].id, orderId, 'the order is waiting in the admin page');
    await admin(`/admin/api/orders/${orderId}/confirm`, 'POST');
    await A.page.locator('.pro-pay-done').waitFor({ timeout: 9000 });
    assert.equal(await isPro(A.page), true, 'confirmed in the admin page → Pro on the phone');
    const code = (await A.page.locator('.pro-pay-code-box b').textContent()).trim(); assert.match(code, /^SUISUI-/, 'the buyer sees their code for other devices');
    await A.page.reload({ waitUntil: 'networkidle' }); await A.page.waitForTimeout(400);
    assert.equal(await isPro(A.page), true, 'Pro survives a restart (licence verified on the device)');

    // a forged licence (tampered body) is refused at start
    await A.page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('suisui-locktodo-v1')); const [b, s] = raw.settings.pro.licence.split('.'); const body = JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/'))); body.dev = 'someone-else'; raw.settings.pro.licence = btoa(JSON.stringify(body)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.' + s; localStorage.setItem('suisui-locktodo-v1', JSON.stringify(raw)); });
    await A.page.reload({ waitUntil: 'networkidle' }); await A.page.waitForTimeout(600);
    assert.equal(await isPro(A.page), false, 'a tampered licence does not unlock Pro');
    // owned:true without any licence is not Pro either
    await A.page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('suisui-locktodo-v1')); raw.settings.pro = { owned: true }; localStorage.setItem('suisui-locktodo-v1', JSON.stringify(raw)); });
    await A.page.reload({ waitUntil: 'networkidle' }); assert.equal(await isPro(A.page), false, 'owned:true alone is not enough');
    // the same code brings it back on the same phone (restore)
    await A.page.evaluate(() => window.SuiSuiPro.openPay());
    await A.page.locator('#pro-pay-code').fill(code); await A.page.locator('#pro-pay-redeem button[type=submit]').click();
    await A.page.locator('.pro-pay-done').waitFor({ timeout: 6000 }); assert.equal(await isPro(A.page), true, 'the code restores Pro on the same phone');

    // ---- tablet B uses the code; phone C hits the device limit (2)
    const B = await device();
    await B.page.evaluate(() => window.SuiSuiPro.openPay());
    await B.page.locator('#pro-pay-code').fill(code.toLowerCase()); await B.page.locator('#pro-pay-redeem button[type=submit]').click();
    await B.page.locator('.pro-pay-done').waitFor({ timeout: 6000 }); assert.equal(await isPro(B.page), true);
    const C = await device();
    await C.page.evaluate(() => window.SuiSuiPro.openPay());
    await C.page.locator('#pro-pay-code').fill(code); await C.page.locator('#pro-pay-redeem button[type=submit]').click();
    await C.page.locator('.pro-pay-note.is-error').waitFor({ timeout: 6000 });
    assert.match(await C.page.locator('.pro-pay-note').textContent(), /设备已满/, 'device limit is explained');
    await C.page.locator('#pro-pay-code').fill('SUISUI-2222-3333-4444'); await C.page.locator('#pro-pay-redeem button[type=submit]').click();
    await C.page.waitForTimeout(800); assert.match(await C.page.locator('.pro-pay-note').textContent(), /不存在/, 'a wrong code says so');
    assert.equal(await isPro(C.page), false);

    // ---- refund: B's next check turns Pro off
    await admin(`/admin/api/orders/${orderId}/refund`, 'POST');
    await B.page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('suisui-locktodo-v1')); raw.settings.pro.checkedAt = 0; localStorage.setItem('suisui-locktodo-v1', JSON.stringify(raw)); });
    await B.page.reload({ waitUntil: 'networkidle' }); await B.page.waitForTimeout(1200);
    assert.equal(await isPro(B.page), false, 'a refunded order is withdrawn on the next check');

    // ---- offline: a licensed phone keeps Pro without the server
    proc.kill(); await new Promise(r => setTimeout(r, 300));
    await A.page.reload({ waitUntil: 'networkidle' }); await A.page.waitForTimeout(500);
    // A was refunded too, but has not checked in yet (checked recently), so it keeps working until it can ask
    assert.equal(await isPro(A.page), true, 'Pro works offline from the signed licence');
    await A.page.evaluate(() => window.SuiSuiPro.openPay()); await A.page.waitForTimeout(300);
    for (const d of [A, B, C]) assert.deepEqual(d.errors, []);
    console.log('PASS: checkout — QR order confirmed in admin unlocks the phone, licence survives restart and works offline, forged/owned-only refused, code restores, second device, device limit, wrong code, refund withdraws');
  } catch (e) { console.error(log.slice(-2000)); throw e; } finally { await browser.close(); proc.kill(); fs.rmSync(data, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
