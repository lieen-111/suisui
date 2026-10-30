// Verifies the 2026-10-29 beta additions: import/merge/replace, new-day rollover, daily repeat,
// history, install guidance and the lock-screen notification setting. Browser evidence only.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let browser;
const STORE = 'suisui-locktodo-v1';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };

  /* 1. Import: merge, replace, undo, invalid file, native-style array export */
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.nav-button[data-view=tasks]').click();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suisui-'));
    const backup = path.join(dir, 'backup.json');
    fs.writeFileSync(backup, JSON.stringify({ app: 'suisui', version: 2, tasks: [
      { id: 'seed-1', title: '重复 id 不应重复加入', group: 'work' },
      { id: 'imp-1', title: '导入的工作', group: 'work', pinned: true },
      { id: 'imp-2', title: '<b>导入的生活</b>', group: 'life', done: true, completedAt: Date.now() },
      { id: 'bad', title: '   ' }
    ], archive: [{ id: 'old-1', title: '以前完成的', group: 'life', completedAt: 1, archivedAt: 2 }], settings: { accent: 'blue' } }));
    await page.locator('#import-file').setInputFiles(backup);
    await page.locator('#import-dialog[open]').waitFor();
    assert.match(await page.locator('#import-summary').textContent(), /3 件待办、1 条历史.*加入其中 2 件/);
    await page.locator('#import-settings').check();
    await page.locator('#import-merge').click();
    assert.equal(await page.locator('.lock-task').count(), 8, 'Merge adds only new ids');
    assert.equal(await page.locator('.task-row').count(), 7);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#226a9a', 'Settings import is opt-in and applied');
    assert.equal(await page.locator('#archive-count').textContent(), '1');
    assert.equal(await page.locator('.done-text', { hasText: '<b>导入的生活</b>' }).count(), 1, 'Imported text stays escaped');
    await page.locator('#undo-button').click();
    assert.equal(await page.locator('.lock-task').count(), 6, 'Undo import');
    await page.locator('#import-file').setInputFiles(backup);
    await page.locator('#import-replace').click();
    assert.equal(await page.locator('.lock-task').count(), 3, 'Replace uses the backup only');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.lock-task').count(), 3, 'Imported data persists');
    const arrayFile = path.join(dir, 'array.json');
    fs.writeFileSync(arrayFile, JSON.stringify([{ id: 'n-1', title: '原生版导出的数组', group: 'work' }]));
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.locator('#import-file').setInputFiles(arrayFile);
    await page.locator('#import-merge').click();
    assert.equal(await page.locator('.lock-task').count(), 4, 'Plain array backups import');
    const badFile = path.join(dir, 'bad.json');
    fs.writeFileSync(badFile, '{not json');
    await page.locator('#import-file').setInputFiles(badFile);
    await page.locator('#toast-message', { hasText: '不是有效的 JSON' }).waitFor();
    assert.equal(await page.locator('#import-dialog').evaluate(d => d.open), false);
    // Round trip: export then re-import replace keeps everything.
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=data]').click();
    const wait = page.waitForEvent('download');
    await page.locator('#export-button').click();
    const exported = JSON.parse(fs.readFileSync(await (await wait).path(), 'utf8'));
    assert.equal(exported.tasks.length, 4); assert.equal(exported.archive.length, 1); assert.equal('photo' in exported.settings, false, 'Wallpaper photo stays out of backups');
    await context.close();
  }

  /* 2. A new day: daily items reset, yesterday's finished items move to history, today's stay */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-10-29T21:00:00') });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(store => { const s = JSON.parse(localStorage.getItem(store)); s.settings.motion = false; localStorage.setItem(store, JSON.stringify(s)); }, STORE);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.task-row[data-task-id=seed-4] [data-action=complete]').click(); // daily
    await page.locator('.task-row[data-task-id=seed-2] [data-action=complete]').click(); // one-off
    assert.equal(await page.locator('.lock-task.is-done').count(), 2);
    await page.clock.setSystemTime(new Date('2026-10-30T07:30:00'));
    await page.clock.runFor(31000);
    await page.locator('#toast-message', { hasText: '新的一天' }).waitFor();
    assert.match(await page.locator('#toast-message').textContent(), /1 件已完成移入历史，1 件重复事项已重置/);
    assert.equal(await page.locator('.lock-task').count(), 5, 'Yesterday\'s one-off left the lock card');
    assert.equal(await page.locator('.lock-task.is-done').count(), 0, 'Daily item is pending again');
    assert.equal(await page.locator('.lock-task[data-id=seed-4]').getAttribute('data-action'), 'complete');
    assert.equal(await page.evaluate(store => JSON.parse(localStorage.getItem(store)).day, STORE), '2026-10-30');
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.locator('#archive-section summary').click();
    await page.locator('[data-action=unarchive]').first().click();
    assert.equal(await page.locator('.lock-task').count(), 6, 'History item can be put back');
    // Manual "move to history" keeps daily items and is undoable.
    await page.locator('.task-row[data-task-id=seed-1] [data-action=complete]').click();
    await page.locator('.task-row[data-task-id=seed-4] [data-action=complete]').click();
    await page.locator('#completed-section').evaluate(el => { el.open = true; });
    await page.locator('#clear-done').click();
    assert.equal(await page.locator('.done-row:not(.archive-row)').count(), 1, 'Daily item stays until tomorrow');
    await page.locator('#undo-button').click();
    assert.equal(await page.locator('.done-row:not(.archive-row)').count(), 2);
    // Auto archive off: next day keeps finished one-offs in the card.
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=list]').click();
    await page.locator('#archive-toggle').uncheck();
    await page.clock.setSystemTime(new Date('2026-10-31T08:00:00'));
    await page.clock.runFor(31000);
    assert.equal(await page.locator('.lock-task.is-done').count(), 1, 'Auto-archive can be turned off');
    // Repeat option from the add form and edit form.
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.locator('#fab-add').click();
    await page.locator('#task-input').fill('每天喝水');
    await page.locator('[data-add-repeat=daily]').click();
    await page.locator('#add-form button[type=submit]').click();
    assert.equal(await page.locator('#add-form').isVisible(), true, 'Sheet stays open for the next item');
    assert.equal(await page.locator('[data-add-repeat=none]').getAttribute('aria-pressed'), 'true', 'Repeat resets after adding');
    await page.locator('#add-backdrop').click();
    await page.locator('#add-form').waitFor({ state: 'hidden', timeout: 2000 }); // tap outside closes the sheet
    assert.equal(await page.locator('.task-row', { hasText: '每天喝水' }).locator('.meta-flag', { hasText: '每天' }).count(), 1);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const view of ['tasks', 'settings']) {
        await page.locator(`.nav-button[data-view=${view}]`).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow ${view} ${width}`);
      }
    }
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=look]').click(); await page.locator('#more-appearance').evaluate(d => { d.open = true; });
    await page.screenshot({ path: path.join(review, 'beta-settings-390.png'), fullPage: true });
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.screenshot({ path: path.join(review, 'beta-tasks-430.png'), fullPage: true });
    await context.close();
  }

  /* 3. iPhone Safari (not installed): install guidance, notification setting explains the requirement */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
    await context.addInitScript(() => { delete window.Notification; });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#install-banner').isVisible(), true, 'Install banner on iPhone Safari');
    await page.screenshot({ path: path.join(review, 'beta-install-banner-390.png') });
    for (const width of [320, 430]) { await page.setViewportSize({ width, height: 700 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Banner fits ${width}`); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#install-howto').click();
    assert.equal(await page.locator('#install-dialog').evaluate(d => d.open), true);
    await page.screenshot({ path: path.join(review, 'beta-install-steps-390.png') });
    await page.locator('#close-install').click();
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=lock]').click();
    assert.equal(await page.locator('#notify-toggle').isDisabled(), true);
    assert.match(await page.locator('#notify-status').textContent(), /添加到主屏幕/);
    await page.locator('#install-later').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#install-banner').isVisible(), false, 'Dismissal remembered');
    await context.close();
  }

  /* 4. Notification path where supported. Headless Chromium always denies permission, so the
        permission is stubbed and showNotification calls are recorded instead of displayed. */
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
      window.__shown = [];
      ServiceWorkerRegistration.prototype.showNotification = async function (title, options) { window.__shown.push({ title, ...options }); };
      ServiceWorkerRegistration.prototype.getNotifications = async function () { return []; };
    });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const content = await page.evaluate(() => window.suisui.notificationContent());
    assert.equal(content.title, '今天还有 6 件待办');
    assert.equal(content.body.split('\n').length, 6);
    assert(content.body.startsWith('○ 把锁屏待办的想法做出来'), 'Pinned first in notification');
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=lock]').click();
    await page.locator('#notify-toggle').check();
    await page.locator('#notify-test').waitFor({ state: 'visible' });
    assert.match(await page.locator('#notify-status').textContent(), /已开启/);
    await page.locator('#notify-test').click();
    await page.waitForFunction(() => window.__shown.length === 1);
    const shown = await page.evaluate(() => window.__shown[0]);
    assert.equal(shown.tag, 'suisui-today'); assert.equal(shown.silent, true); assert.match(shown.body, /把锁屏待办的想法做出来/);
    // Leaving the app refreshes the notification only when the content changed.
    const hide = () => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await hide(); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__shown.length), 1, 'Unchanged list does not re-notify');
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => document.querySelector('.lock-task').click());
    await page.waitForTimeout(1300);
    await hide(); await page.waitForTimeout(200);
    const second = await page.evaluate(() => window.__shown.at(-1));
    assert.equal(second.title, '今天还有 5 件待办', 'Leaving after a change refreshes the lock-screen list');
    await page.evaluate(() => { delete document.visibilityState; });
    await page.locator('#notify-toggle').uncheck();
    assert.equal(await page.evaluate(store => JSON.parse(localStorage.getItem(store)).settings.lockNotify, STORE), false);
    await context.close();
  }

  /* 5. Schema-1 data from the published site upgrades without loss */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(store => localStorage.setItem(store, JSON.stringify({ tasks: [{ id: 'old', title: '旧版数据', group: 'life', pinned: false, done: true, completedAt: 5 }], settings: { accent: 'rose', cardTransparency: 40 } })), STORE);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.lock-task.is-done').count(), 1, 'Old completed data is not archived on upgrade day');
    const saved = await page.evaluate(store => JSON.parse(localStorage.getItem(store)), STORE);
    assert.equal(saved.schema, 2); assert.equal(saved.tasks[0].repeat, 'none'); assert.equal(saved.settings.cardTransparency, 40);
    await context.close();
  }

  /* 6. Appearance is visible while adjusting it: sticky mini preview on phones, sticky side preview on wider screens */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.nav-button[data-view=settings]').click(); await page.locator('[data-settings-page=look]').click(); await page.locator('#more-appearance').evaluate(d => { d.open = true; });
    const mini = page.locator('#settings-preview');
    assert.equal(await mini.isVisible(), true, 'Mini preview shown in phone settings');
    assert.equal(await page.locator('.mini-row').count(), 3);
    await page.locator('#card-transparency').evaluate(el => { el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('[data-material=flat]').click();
    await page.locator('[data-card-color="#f5f7f3"]').click();
    const same = await page.evaluate(() => ['--card-bg', '--card-blur', '--card-ink'].every(k => document.getElementById('mini-card').style.getPropertyValue(k) === document.getElementById('activity').style.getPropertyValue(k)));
    assert(same, 'Mini preview uses the same card appearance');
    const before = await mini.boundingBox();
    await page.locator('#intensity').scrollIntoViewIfNeeded();
    assert(await page.locator('#settings-scroll').evaluate(el => el.scrollTop > 300), 'Settings actually scrolled');
    const box = await mini.boundingBox();
    assert(box && Math.abs(box.y - before.y) < 1 && box.y < 140, 'Mini preview stays in place while the settings scroll under it');
    await page.screenshot({ path: path.join(review, 'beta-settings-preview-390.png') });
    await page.locator('[data-density=compact]').scrollIntoViewIfNeeded();
    await page.locator('[data-density=compact]').click();
    assert.equal(await page.locator('.mini-row').count(), 4, 'Density reflected in the mini preview');
    await page.locator('[data-wallpaper=mono]').click();
    assert.equal(await page.locator('#mini-wallpaper').evaluate(el => el.classList.contains('monochrome')), true);
    for (const width of [320, 430]) { await page.setViewportSize({ width, height: 700 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings preview fits ${width}`); }
    await page.setViewportSize({ width: 1280, height: 820 });
    assert.equal(await mini.isVisible(), false, 'Wide screens use the side preview instead');
    await page.locator('#reset-settings').scrollIntoViewIfNeeded();
    const lock = await page.locator('#lockscreen').boundingBox();
    assert(lock && lock.y >= 0 && lock.y + lock.height <= 820, 'Side preview stays fully in view while scrolling settings');
    await page.screenshot({ path: path.join(review, 'beta-settings-desktop-scrolled.png') });
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: import merge/replace/undo/escaping/invalid file, backup round trip, new-day rollover, daily repeat, history restore, manual archive, auto-archive toggle, iPhone install guidance, notification copy and refresh, schema-1 upgrade, settings live preview (sticky, synced), 320/390/430 layouts.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
