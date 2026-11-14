// Simulates the iPhone shell (ios/App/WebShell.swift) in Chromium: the bridge script is taken from the Swift
// source itself, with window.webkit.messageHandlers stubbed. Checks booting from the stored file, saves and
// stale-save refusal, a Lock Screen tick flowing back, the iPhone lock settings, timer, export and image save.
const fs = require('node:fs');
const path = require('node:path');
const { chromium, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');

const swift = fs.readFileSync(path.resolve(__dirname, '../ios/App/WebShell.swift'), 'utf8');
const template = swift.slice(swift.indexOf('let source = """') + 'let source = """'.length, swift.indexOf('"""', swift.indexOf('let source = """') + 20));
const today = new Date(); const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const stored = JSON.stringify({ schema: 2, rev: 3, day, log: [], timer: null,
  tasks: [{ id: 'a', title: '读书', group: 'work', pinned: false, done: false, completedAt: 0, repeat: 'none', createdAt: 1, date: '', note: '第三章', duration: 25, subtasks: [{ id: 's1', title: '3.1', done: false }] },
          { id: 'b', title: '买菜', group: 'life', pinned: false, done: false, completedAt: 0, repeat: 'none', createdAt: 2, date: '', time: '18:00' }],
  archive: [], groups: [{ id: 'work', name: '工作', color: '#13765b' }, { id: 'life', name: '生活', color: '#b14c6b' }], settings: {} });
const shim = template.replace('\\(Self.jsString(data))', JSON.stringify(stored)).replace('\\(Self.jsonText(status))', '{}');
assert(!shim.includes('\\('), 'All Swift interpolations replaced');

let browser;
(async () => {
  browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    window.__posts = [];
    window.webkit = { messageHandlers: { suisui: { postMessage: m => window.__posts.push(m) } } };
  });
  await context.addInitScript(shim);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.goto(url, { waitUntil: 'networkidle' });
  const posts = m => page.evaluate(name => window.__posts.filter(p => p.m === name), m);
  const lastSaved = async () => JSON.parse((await posts('save')).at(-1).a);

  // Boots from the stored file, shows web-only fields, no browser install UI, no service worker.
  assert.deepEqual(await page.locator('#task-list .task-title').allTextContents(), ['读书', '买菜']);
  assert.match(await page.locator('.task-row', { hasText: '买菜' }).locator('.task-meta').textContent(), /18:00/);
  assert.equal((await posts('ready')).length, 1);
  assert.equal(await page.locator('#install-banner').isVisible(), false);
  assert.match(await page.locator('#offline-status').textContent(), /iPhone App 版/);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.() || []).length), 0);

  // Adding a task saves through the bridge with a newer revision; web-only fields stay.
  await page.locator('#fab-add').click();
  await page.locator('#task-input').fill('跑步 30分钟');
  await page.locator('#add-form button[type=submit]').click();
  await page.locator('#add-backdrop').click();
  let saved = await lastSaved();
  assert(saved.rev > 3, 'Revision bumped');
  assert.equal(saved.tasks.find(t => t.id === 'a').note, '第三章');
  assert.equal(saved.tasks.find(t => t.title === '跑步').duration, 30);
  assert.equal(await page.evaluate(() => JSON.parse(SuiSuiIOS.load()).rev), saved.rev, 'Bridge keeps the page\'s copy');

  // A Lock Screen tick: the native side stores a newer record and hands it over.
  const ticked = { ...saved, rev: saved.rev + 1, tasks: saved.tasks.map(t => t.id === 'b' ? { ...t, done: true, completedAt: Date.now() } : t) };
  await page.evaluate(raw => { SuiSuiIOS._set(raw); suisuiNativeChanged(); }, JSON.stringify(ticked));
  assert.equal(await page.locator('#task-list .task-row', { hasText: '买菜' }).count(), 0, 'Finished on the Lock Screen');
  assert.equal(await page.locator('#done-list .task-row, #done-list .done-row, #completed-section', { hasText: '买菜' }).count() > 0, true);

  // A save from a stale page is refused and the page takes the stored copy instead of overwriting it.
  const newer = { ...ticked, rev: ticked.rev + 5, tasks: [...ticked.tasks, { id: 'c', title: '锁屏上新加的', group: 'work', pinned: false, done: false, completedAt: 0, repeat: 'none', createdAt: 3, date: '' }] };
  const before = (await posts('save')).length;
  await page.evaluate(raw => SuiSuiIOS._set(raw), JSON.stringify(newer));
  await page.locator('.task-row', { hasText: '读书' }).locator('.check-task').click();
  await page.waitForTimeout(1200);
  assert.equal((await posts('save')).length, before, 'Stale save not sent to the native side');
  assert.equal(await page.locator('#task-list .task-row', { hasText: '锁屏上新加的' }).count(), 1, 'Took the stored copy');

  // Timer: the native side gets the task id, title and end time.
  await page.locator('.task-row', { hasText: '读书' }).locator('[data-action=timer]').click();
  const timer = JSON.parse((await posts('setTimer')).filter(p => p.a).at(-1).a);
  assert.equal(timer.id, 'a'); assert.equal(timer.title, '读书'); assert(timer.endsAt > Date.now());
  await page.locator('#focus-stop').click();

  // First launch: once the native side reports what is allowed, the lock-screen setup sheet opens by itself, once.
  await page.evaluate(() => { SuiSuiIOS._status({ live: false, liveAllowed: true, liveWanted: false, notifications: 'default' }); suisuiIOSStatus(); });
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#ios-setup').isVisible(), true, 'First launch asks for the lock-screen setup');
  assert.equal(await page.locator('#ios-setup-notify').evaluate(e => e.classList.contains('done')), false);
  await page.locator('#ios-setup [data-ios-setup=notify]').click();
  await page.locator('#ios-setup [data-ios-setup=live]').click();
  assert.equal((await posts('requestNotifications')).length, 1, 'Setup asks for notifications');
  assert.deepEqual((await posts('liveActivity')).map(p => p.a), [true], 'Setup turns the Live Activity on');
  await page.evaluate(() => { SuiSuiIOS._status({ live: true, liveAllowed: true, liveWanted: true, notifications: 'granted' }); suisuiIOSStatus(); });
  assert.equal(await page.locator('#ios-setup-notify').evaluate(e => e.classList.contains('done')), true, 'Granted notifications tick off');
  assert.equal(await page.locator('#ios-setup-live').evaluate(e => e.classList.contains('done')), true);
  await page.locator('#finish-ios-setup').click();
  assert.equal(await page.locator('#ios-setup').isVisible(), false);
  assert.equal((await lastSaved()).settings.iosSetupSeen, true, 'Asked only once');
  assert((await posts('haptic')).length > 0, 'Haptics through the bridge');
  await page.evaluate(() => window.__posts.splice(0)); // the checks below count from here

  // iPhone lock settings: Live Activity and notifications instead of the web notification switch.
  await page.locator('.nav-button[data-view=settings]').click();
  await page.locator('[data-settings-page=lock]').click();
  assert.equal(await page.locator('#notify-row').isVisible(), false);
  assert.equal(await page.locator('#ios-lock-settings').isVisible(), true);
  await page.evaluate(() => { SuiSuiIOS._status({ live: true, liveAllowed: true, liveWanted: true, notifications: 'default' }); suisuiIOSStatus(); });
  assert.equal(await page.locator('#live-toggle').isChecked(), true);
  assert.match(await page.locator('#live-status').textContent(), /灵动岛/);
  assert.equal(await page.locator('#ios-notify-button').isVisible(), true);
  await page.locator('#ios-notify-button').click();
  assert.equal((await posts('requestNotifications')).length, 1);
  await page.locator('label[for=live-toggle]').click();
  assert.deepEqual((await posts('liveActivity')).map(p => p.a), [false]);
  await page.evaluate(() => { SuiSuiIOS._status({ live: false, liveAllowed: false, liveWanted: false, notifications: 'granted' }); suisuiIOSStatus(); });
  assert.match(await page.locator('#live-status').textContent(), /系统里被关闭/);
  assert.equal(await page.locator('#ios-notify-button').isVisible(), false);

  // Export goes to the native share sheet; no download link.
  await page.locator('.settings-back, [data-settings-back]').first().click().catch(() => {});
  await page.evaluate(() => document.getElementById('export-button').click());
  const exp = (await posts('exportBackup')).at(-1).a;
  assert.match(exp.name, /^suisui-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(JSON.parse(exp.json).app, 'suisui');
  assert.equal(await page.locator('#settings-install').isVisible(), false);

  // Under the status bar: with a 59px safe area the settings bar starts below it (class set before the page draws).
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ios-shell')), true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  await page.evaluate(() => window.suisuiBack()); await page.evaluate(() => { while (document.body.dataset.view !== 'tasks') window.suisuiBack(); });
  await page.locator('.nav-button[data-view=settings]').click();
  await page.locator('[data-settings-page=lock]').click();
  const bar = await page.locator('.settings-top').evaluate(e => ({ pad: parseFloat(getComputedStyle(e).paddingTop), back: e.querySelector('.settings-back').getBoundingClientRect().top, title: e.querySelector('h1').getBoundingClientRect() }));
  assert(bar.pad >= 59, `Settings bar clears the status bar (${bar.pad}px)`);
  assert(bar.back >= 59, 'Back button is below the status bar');

  // Edge swipe from the left goes back: lock page → settings home → list.
  const swipe = async () => {
    const t = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 420 }] });
    await t('touchStart', 6); for (const x of [30, 70, 120, 170, 220]) { await t('touchMove', x); await page.waitForTimeout(16); } await t('touchEnd'); await page.waitForTimeout(450);
  };
  await swipe();
  assert.equal(await page.evaluate(() => document.body.dataset.settingsPage), 'index', 'Edge swipe: back to settings home');
  await swipe();
  assert.equal(await page.evaluate(() => document.body.dataset.view), 'tasks', 'Edge swipe: back to the list');
  await swipe();
  assert.equal(await page.evaluate(() => document.body.dataset.view), 'tasks', 'Edge swipe on the list does nothing');
  await page.evaluate(() => window.SuiSuiPro?.open());
  if (await page.locator('#pro-sheet').isVisible()) { await swipe(); assert.equal(await page.locator('#pro-sheet').isVisible(), false, 'Edge swipe closes the Pro page'); }

  assert.deepEqual(errors, []);
  console.log('PASS: iOS bridge — boots from the stored file, saves with revision, stale save refused, Lock Screen tick flows back, first-launch lock-screen setup, timer, Live Activity + notification settings, native export, haptics, status-bar safe area, edge swipe back.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exit(1); });
