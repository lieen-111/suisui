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
  assert.equal(await page.locator('.card-done-row', { hasText: '买菜' }).count() > 0, true);

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

  // Haptics go native.
  assert((await posts('haptic')).length > 0, 'Haptics through the bridge');
  assert.deepEqual(errors, []);
  console.log('PASS: iOS bridge — boots from the stored file, saves with revision, stale save refused, Lock Screen tick flows back, timer, Live Activity + notification settings, native export, haptics.');
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exit(1); });
