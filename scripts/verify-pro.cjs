// Pro (app/pro.js): free users see Pro but keep the free app; try-on, trial, purchase (simulated), Pro themes,
// completion effects, the jar, weekly art, countdowns, the all-done celebration, and the two ways to pay
// (App Store on iPhone, redeem code on Android and the web).
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work', repeat: 'none' };
  const tasks = [{ ...base, id: 'a', title: '口播剪辑收尾' }, { ...base, id: 'b', title: '动效素材' }, { ...base, id: 'c', title: '健身', group: 'life' }];
  const open = async (settings = {}, query = '') => {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const rec = JSON.stringify({ schema: 2, rev: 1, day: new Date().toISOString().slice(0, 10), tasks, archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0', icon: 'briefcase' }, { id: 'life', name: '生活', color: '#d2566f', icon: 'leaf' }], settings: { palette2: true, tipsSeen: true, firstUse: Date.now(), ...settings } });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, rec]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + query, { waitUntil: 'networkidle' });
    return { context, page };
  };
  const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);
  const html = (page, k) => page.evaluate(k => document.documentElement.dataset[k] || '', k);

  /* Free: the free app is unchanged, Pro is visible and locked */
  {
    const { context, page } = await open();
    assert.equal(await html(page, 'proTheme'), '', 'No Pro theme for a free user');
    assert.equal(await page.locator('#pro-jar-button').isVisible(), true, 'The jar is visible on 今天');
    assert.equal(await page.locator('#pro-jar-lock').isVisible(), true, '… with a lock');
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.waitForTimeout(120);
    assert.ok(await page.locator('.shard').count() > 0, 'Free completion keeps the shatter');
    await page.waitForTimeout(900);
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#pro-banner-state').textContent(), '¥28');
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('[data-pro-theme-pick]').count(), 8, '外观 shows 跟随时间 and the seven Pro themes');
    assert.equal(await page.locator('[data-pro-theme-pick=day] .pro-lock-badge').count(), 1, '… locked');
    await page.locator('#settings-back').click();
    await page.locator('#pro-banner').click();
    assert.equal(await page.locator('#pro-sheet').isVisible(), true, 'Pro page opens');
    for (const part of ['effects', 'themes', 'jar']) assert.equal(await page.locator(`[data-pro-section=${part}]`).count(), 1, `Pro page has ${part}`);
    await page.locator('[data-pro-effect=dots]').click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('.pro-fx').count() > 0, 'Effects can be tried before buying');
    await page.screenshot({ path: path.join(review, 'pro-sheet-free-390.png') });
    // Try-on: the theme shows, nothing is saved, it ends
    await page.waitForTimeout(1400);
    await page.locator('[data-pro-theme=day]').click();
    assert.equal(await html(page, 'proTheme'), 'day', 'Try-on shows the theme');
    assert.equal(await page.locator('#pro-tryon').isVisible(), true);
    assert.equal((await saved(page)).proTheme || '', '', 'Try-on saves nothing');
    await page.locator('#pro-tryon-end').click();
    assert.equal(await html(page, 'proTheme'), '', 'Try-on ends');
    assert.equal(await html(page, 'style'), 'glass', 'The free style comes back');
    await context.close();
  }

  /* Trial, then purchase: themes, effects, jar, art, countdowns, celebration */
  {
    const { context, page } = await open();
    await page.evaluate(() => window.SuiSuiPro.open());
    assert.equal(await page.locator('#fab-add').isVisible(), false, 'The add bar never covers the Pro page');
    await page.locator('#pro-trial').click();
    const p1 = (await saved(page)).pro;
    assert.equal(p1.trialUsed, true); assert.ok(p1.trialEnds > Date.now() + 2.9 * 864e5, '3-day trial');
    assert.equal(await page.locator('#pro-trial').count(), 0, 'Trial is offered once');
    // Android and the web: the same checkout as release builds (扫码 / 爱发电 / 兑换码), against a stand-in server here
    assert.equal(await page.locator('#pro-buy').textContent(), '开通 Pro · ¥28', 'The web build sells Pro at the launch price');
    await page.locator('#pro-buy').click();
    assert.equal(await page.locator('#pro-pay').isVisible(), true, 'Checkout opens');
    await page.locator('#pro-start-qr').waitFor();
    assert.match(await page.locator('.pro-pay-amt').textContent(), /¥28/);
    await page.locator('#pro-pay-code').fill('suisui aaaa');
    assert.equal(await page.locator('#pro-pay-code').inputValue(), 'SUISUI-AAAA', 'The code formats itself as you type');
    await page.locator('#pro-pay-redeem button[type=submit]').click();
    assert.match(await page.locator('.pro-pay-note.is-error').textContent(), /12 位/, 'A malformed code says what is wrong');
    assert.equal((await saved(page)).pro.owned, false, 'A wrong code unlocks nothing');
    await page.locator('#pro-pay-code').fill('SUISUI-2222-3333-4444'); await page.locator('#pro-pay-redeem button[type=submit]').click();
    await page.locator('.pro-pay-note.is-error').waitFor(); assert.match(await page.locator('.pro-pay-note').textContent(), /不存在/, 'An unknown code says so');
    // 扫码付款: order number, then 我已付款 → confirmed (the stand-in confirms after a few seconds) → unlocked
    await page.locator('#pro-start-qr').click();
    await page.locator('#pro-qr-img').waitFor();
    assert.match(await page.locator('.pro-order-id b').textContent(), /^S[0-9A-Z]{6}$/, 'An order number to write in the payment note');
    assert.equal(await page.locator('.pro-pay-howto li').count(), 3, '① 扫码 ② 付款并备注订单号 ③ 我已付款');
    await page.locator('#pro-paid').click();
    await page.locator('.pro-pay-wait').waitFor();
    await page.locator('.pro-pay-done').waitFor({ timeout: 9000 });
    assert.equal((await saved(page)).pro.owned, true, 'The confirmed order unlocks Pro and is remembered');
    assert.equal((await saved(page)).pro.via, 'order');
    assert.match(await page.locator('.pro-pay-code-box b').textContent(), /^SUISUI-/, 'The buyer gets a code for their other devices');
    assert.equal(await page.locator('.pro-pay-themes button').count(), 7, 'Unlocked: pick one of the seven themes');
    await page.locator('#pro-pay-finish').click();
    await page.locator('#pro-close').click();
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#pro-banner-state').textContent(), '已开通');
    await page.locator('[data-settings-page=look]').click();
    await page.locator('[data-pro-theme-pick=room]').click();
    assert.equal(await html(page, 'proTheme'), 'room'); assert.equal(await html(page, 'style'), 'paper', '屋 sits on 纸墨');
    assert.equal(await html(page, 'proSkin'), 'room', 'The theme brings its own background and header');
    assert.equal(await page.locator('#pro-head').count(), 1);
    assert.equal((await saved(page)).proTheme, 'room');
    await page.locator('[data-pro-effect-pick=gold]').click();
    assert.equal((await saved(page)).proEffect, 'gold');
    await page.screenshot({ path: path.join(review, 'pro-look-room-390.png') });
    // A free style takes the Pro theme off
    await page.locator('[data-ui-style=paper]').click();
    await page.waitForTimeout(50);
    assert.equal(await html(page, 'proTheme'), '', 'Picking 纸墨 takes off 暮');
    await page.locator('[data-pro-theme-pick=dawn]').click();
    assert.equal(await html(page, 'style'), 'glass', '晨 sits on 玻璃');
    await page.locator('#settings-back').click();
    await page.locator('.nav-button[data-view=tasks]').click();
    // Countdown
    await page.evaluate(() => window.SuiSuiPro.open('settings'));
    const d = new Date(); d.setDate(d.getDate() + 12);
    await page.locator('#pro-cd-title').fill('期末考试');
    await page.locator('#pro-cd-date').fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    await page.locator('#pro-cd-add button').click();
    await page.locator('#pro-close').click();
    assert.match(await page.locator('#pro-head').textContent(), /12天期末考试/, 'Countdown in the theme header');
    // Each theme draws today its own way
    const marks = { dawn: '.ph-wave', day: 'rect', night: 'circle', bloom: 'text', riso: 'rect', room: 'path', fluff: 'image' };
    for (const id of ['dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff']) {
      await page.evaluate(t => { window.suisui.pro.state.settings.proTheme = t; window.suisui.pro.applySettings(); window.suisui.pro.render(); }, id);
      assert.equal(await html(page, 'proSkin'), id);
      assert.ok(await page.locator(`#pro-head.pro-head-${id} svg.ph-art ${marks[id]}`).count() > 0, `${id} draws its own header`);
    }
    await page.evaluate(() => { window.suisui.pro.state.settings.proTheme = 'dawn'; window.suisui.pro.applySettings(); window.suisui.pro.render(); });
    // Pro completion: the chosen effect, no shatter; shards fly to the jar
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.shard').count(), 0, 'Pro effect replaces the shatter');
    assert.ok(await page.locator('.pro-fx').count() > 0, 'Pro effect runs');
    await page.waitForTimeout(1400);
    await page.locator('.task-row[data-task-id=b] .check-task').click(); await page.waitForTimeout(1300);
    await page.locator('.task-row[data-task-id=c] .check-task').click(); await page.waitForTimeout(1600);
    assert.equal(await page.locator('#pro-celebrate').isVisible(), true, 'All done → celebration');
    for (const [id, sel] of [['day', '.ph-circle'], ['night', '.ph-star']]) {
      await page.evaluate(t => { window.suisui.pro.state.settings.proTheme = t; window.suisui.pro.applySettings(); window.suisui.pro.render(); }, id);
      assert.equal(await page.locator(`#pro-head ${sel}`).count(), 3, `${id}: one mark per finished task`);
    }
    await page.evaluate(() => { window.suisui.pro.state.settings.proTheme = 'dawn'; window.suisui.pro.applySettings(); window.suisui.pro.render(); });
    await page.screenshot({ path: path.join(review, 'pro-celebrate-390.png') });
    await page.locator('#pro-cel-close').click();
    assert.equal((await saved(page)).proCelebrated, await page.evaluate(() => window.suisui.dayKey()), 'Celebration once a day');
    // Jar page + weekly art
    await page.locator('#pro-jar-button').click();
    assert.equal(await page.locator('#pro-jar-sheet').isVisible(), true);
    assert.match(await page.locator('.pro-jar-big p').textContent(), /3 件今天完成/);
    const art = await page.evaluate(() => { const c = window.SuiSuiPro.drawArt(window.suisui.pro.state.log, new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5)); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] !== d[0] || d[i + 1] !== d[1]) n++; return { w: c.width, h: c.height, varied: n }; });
    assert.equal(art.w, 1080); assert.equal(art.h, 1350); assert.ok(art.varied > 500, 'Weekly art has content');
    const arts = await page.evaluate(() => ['dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff'].map(id => { const c = window.SuiSuiPro.drawArt(window.suisui.pro.state.log, new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5), window.SuiSuiPro.THEMES[id], 270); return c.toDataURL().length + ':' + c.toDataURL().slice(-200); }));
    assert.equal(new Set(arts).size, 7, 'Seven themes, seven different weekly pictures');
    await page.screenshot({ path: path.join(review, 'pro-jar-390.png') });
    await page.locator('#pro-jar-close').click();
    // Reset (local preview only)
    await page.evaluate(() => window.SuiSuiPro.reset());
    assert.equal(await html(page, 'proTheme'), '', 'After reset the free look is back');
    assert.equal(await page.locator('#pro-head').count(), 0, 'and the theme header is gone');
    assert.equal(await page.locator('#today-side #pro-jar-button').count(), 1, 'the jar is back next to the ring');
    await context.close();
  }

  /* The completion moment: the pieces fly into the picture, and only the task that landed animates */
  {
    const { context, page } = await open({ pro: { owned: true }, proTheme: 'day' });
    assert.equal(await page.locator('#pro-head .ph-circle').count(), 0);
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#pro-head .ph-circle').count(), 0, 'Not circled until the ink lands');
    await page.waitForTimeout(2600);
    assert.equal(await page.locator('#pro-head .ph-circle').count(), 1, 'Circled once it lands');
    assert.equal(await page.locator('#pro-head .ph-circle.ph-new').count(), 1, 'Only the new circle animates');
    await page.evaluate(() => window.suisui.pro.render());
    assert.equal(await page.locator('#pro-head .ph-new').count(), 0, 'A later render does not animate it again');
    assert.deepEqual(await page.evaluate(() => [...document.fonts].filter(f => /Bodoni|Noto Serif SC/.test(f.family) && f.status !== 'error').length > 2), true, 'Bundled Pro fonts are declared');
    await context.close();
  }

  /* The Android lock screen follows the theme (and can be told not to) */
  for (const proLock of [undefined, false]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const rec = JSON.stringify({ schema: 2, rev: 1, day: new Date().toISOString().slice(0, 10), tasks, archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0', icon: 'briefcase' }, { id: 'life', name: '生活', color: '#d2566f', icon: 'leaf' }], settings: { palette2: true, tipsSeen: true, firstUse: Date.now(), pro: { owned: true }, proTheme: 'day', ...(proLock === false ? { proLock } : {}) } });
    await context.addInitScript(raw => { let r = raw; window.SuiSuiAndroid = { load: () => r, save: j => { r = j; }, isLockMode: () => true, notificationsAllowed: () => true, permissions: () => '{"notifications":true,"overlay":true}', requestNotificationPermission() {}, openNotificationSettings() {}, openOverlaySettings() {}, openAppPermissions() {}, unlock() {}, exportBackup() {}, version: () => 'test', hasSystemWallpaper: () => false }; }, rec);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '?mode=lock', { waitUntil: 'networkidle' });
    if (proLock === false) {
      assert.equal(await html(page, 'proLock'), '', 'Lock theme turned off → the plain lock card');
      assert.equal(await page.locator('#pro-lock-strip').count(), 0);
    } else {
      assert.equal(await html(page, 'proLock'), 'day', 'The lock screen wears the theme');
      assert.equal(await page.locator('#pro-lock-strip svg text').count(), 3, '昼 writes a three-character line for three tasks');
      await page.locator('.lock-task[data-id=a]').click(); await page.waitForTimeout(1500);
      assert.equal(await page.locator('#pro-lock-strip circle').count(), 1, 'One task done → one character circled on the lock screen');
    }
    await context.close();
  }

  /* iPhone: App Store purchase and restore */
  {
    const { context, page } = await open({}, '?pay=ios');
    await page.evaluate(() => window.SuiSuiPro.open());
    assert.equal(await page.locator('#pro-buy').textContent(), '购买 · ¥28');
    assert.equal(await page.locator('#pro-restore').count(), 1, 'Restore purchases on iPhone');
    await page.locator('#pro-buy').click();
    { const h = await page.locator('.pro-pay-card').evaluate(c => c.getBoundingClientRect().height - (c.querySelector('.pro-pay-sim')?.offsetHeight || 0)); assert.ok(h < 844 * .4, `Checkout stays small (${Math.round(h)}px) so the app is still usable behind it`); }
    assert.equal(await page.locator('.pro-pay-redeem').count(), 0, 'No redeem code on iPhone');
    assert.match(await page.locator('#pro-pay-go').textContent(), /用 App Store 购买 ¥28/);
    for (const [outcome, says] of [['cancel', /没有扣款/], ['fail', /再试一次/], ['ask', /家长同意/]]) {
      await page.evaluate(o => window.SuiSuiPro.simOutcome(o), outcome); await page.locator('#pro-pay-go').click();
      assert.equal(await page.locator('.pro-pay-working').isVisible(), true, 'Waiting for the App Store');
      await page.waitForTimeout(1400);
      assert.match(await page.locator('.pro-pay-note').textContent(), says, `${outcome} is explained`);
      assert.equal(!!(await saved(page)).pro?.owned, false);
    }
    await page.locator('#pro-pay-restore').click(); await page.waitForTimeout(1200);
    // the simulated outcome is still 家长同意 → nothing to restore
    assert.match(await page.locator('.pro-pay-note').textContent(), /没有买过/, 'Restore with nothing bought says so');
    await page.evaluate(() => window.SuiSuiPro.simOutcome('ok')); await page.locator('#pro-pay-go').click(); await page.waitForTimeout(1400);
    assert.equal((await saved(page)).pro.owned, true); assert.equal((await saved(page)).pro.via, 'appstore');
    assert.equal(await page.locator('.pro-pay-done').isVisible(), true, 'Unlocked screen');
    await context.close();
  }

  /* 暮 · 金 was removed: a saved 'dusk' shows 夜 */
  {
    const { context, page } = await open({ pro: { owned: true }, proTheme: 'dusk' });
    assert.equal(await html(page, 'proTheme'), 'night', 'A saved 暮 falls back to 夜');
    await context.close();
  }

  /* Cold start with a saved theme: the theme's base style wins over the free style, and keeps winning after a settings change */
  for (const [th, base] of [['night', 'night'], ['room', 'paper'], ['dawn', 'glass']]) {
    const { context, page } = await open({ pro: { owned: true }, proTheme: th, uiStyle: 'glass' });
    assert.equal(await html(page, 'style'), base, `${th}: opens on its own base style (${base})`);
    await page.evaluate(() => { window.suisui.pro.state.settings.motion = !window.suisui.pro.state.settings.motion; window.suisui.pro.applySettings(); });
    assert.equal(await html(page, 'style'), base, `${th}: still ${base} after another setting changes`);
    await context.close();
  }

  /* Reduced motion: the room's end-of-day picture is still drawn (it waits for its pictures) */
  {
    const { context, page } = await open({ pro: { owned: true }, proTheme: 'room', motion: false });
    for (const id of ['a', 'b', 'c']) { await page.locator(`.task-row[data-task-id=${id}] .check-task`).click(); await page.waitForTimeout(500); }
    await page.waitForTimeout(2500);
    assert.equal(await page.locator('#pro-celebrate.pro-cel-room').isVisible(), true);
    const ink = await page.evaluate(() => { const c = document.getElementById('pro-cel-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 13) if (d[i] > 40) n++; return n; });
    assert.ok(ink > 800, 'Motion off: the furnished room is drawn at once');
    await context.close();
  }

  /* Test builds (app/pro-config.js freeForTesters): everything works without paying; checkout is still there and simulated */
  {
    const context = await browser.newContext({ demo: false, proFree: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => window.SuiSuiPro.isPro()), true, 'Test build: Pro is on for everyone');
    assert.equal(await page.locator('#pro-jar-lock').isHidden(), true, 'Test build: no lock on the jar');
    await page.evaluate(() => window.SuiSuiPro.open());
    assert.doesNotMatch(await page.locator('.pro-buy').textContent(), /测试版|模拟|示例/, 'Test build: the footer reads like a release');
    assert.equal(await page.locator('#pro-trial').count(), 0, 'Test build: no trial button');
    await page.locator('#pro-buy').click();
    assert.equal(await page.locator('.pro-pay-card').isVisible(), true, 'Test build: the checkout can still be tried');
    await page.evaluate(() => window.SuiSuiPro.closePay());
    await page.locator('[data-pro-theme=fluff]').first().click();
    assert.equal(await html(page, 'proTheme'), 'fluff', 'Test build: themes apply straight away, no try-on timer');
    await context.close();
  }

  /* 乐 · 纸带 was replaced too: a saved 'tape' shows 夜 */
  {
    const { context, page } = await open({ pro: { owned: true }, proTheme: 'tape' });
    assert.equal(await html(page, 'proTheme'), 'night', 'A saved 乐 falls back to 夜');
    await context.close();
  }

  /* 屋 and 毛: the picture grows with the day, lock strip, the end-of-day moment, the jar's lock badge hides */
  for (const th of ['room', 'fluff']) {
    const { context, page } = await open({ pro: { owned: true }, proTheme: th });
    assert.equal(await page.locator('#pro-jar-lock').isHidden(), true, `${th}: owner sees no lock badge on the jar`);
    const before = await page.locator('#pro-head svg.ph-art').innerHTML();
    await page.locator('.task-row[data-task-id=a] .check-task').click(); await page.waitForTimeout(2600);
    assert.notEqual(await page.locator('#pro-head svg.ph-art').innerHTML(), before, `${th}: finishing a task changes the picture`);
    if (th === 'room') assert.match(await page.locator('#pro-head').textContent(), /布置了 1 件/);
    else assert.match(await page.locator('#pro-head').textContent(), /毛长了 33%/);
    await page.locator('.task-row[data-task-id=b] .check-task').click(); await page.waitForTimeout(1300);
    await page.locator('.task-row[data-task-id=c] .check-task').click(); await page.waitForTimeout(4600);
    assert.equal(await page.locator(`#pro-celebrate.pro-cel-${th}`).isVisible(), true, `${th}: its own end-of-day moment`);
    const ink = await page.evaluate(() => { const c = document.getElementById('pro-cel-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 13) if (d[i] > 40) n++; return n; });
    assert.ok(ink > 800, `${th}: the end-of-day picture is drawn`);
    await page.screenshot({ path: path.join(review, `pro-celebrate-${th}-390.png`) });
    await page.locator('#pro-cel-close').click();
    const strip = await page.evaluate(t => { window.SuiSuiSkins.lockStrip(t); return document.getElementById('pro-lock-strip')?.textContent || ''; }, th);
    assert.match(strip, th === 'room' ? /房间布置好了/ : /它醒了/, `${th}: lock strip says the day is done`);
    await context.close();
  }

  /* An ended trial: the saved theme stays saved but is not shown */
  {
    const { context, page } = await open({ pro: { owned: false, trialUsed: true, trialEnds: Date.now() - 1000 }, proTheme: 'night' });
    assert.equal(await html(page, 'proTheme'), '', 'Ended trial → free look');
    assert.equal(await page.evaluate(() => window.SuiSuiPro.isPro()), false);
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: Pro visible and locked for free users (shatter kept), effects and themes can be tried, try-on saves nothing, 3-day trial once, purchase, Pro themes on their base styles, free style takes them off, countdowns, Pro effects replace the shatter, all-done celebration once a day, jar page, 1080×1350 weekly art, ended trial falls back, four distinct theme headers and weekly pictures, redeem code on Android/web (wrong code refused), App Store purchase on iPhone (cancel / fail / parental approval / restore explained), ¥28 launch price, six themes, completion flies into the theme picture and only that task animates, bundled fonts, themed Android lock screen with its own strip (and a switch to keep it plain).');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
