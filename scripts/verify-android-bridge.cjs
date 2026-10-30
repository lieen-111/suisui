// Simulates the Android shell's SuiSuiAndroid bridge (android/app/.../MainActivity.kt) in Chromium:
// data handed to native storage, a lock-screen "完成" tap flowing back, export and notification copy.
const { chromium, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
let browser;
(async () => {
  browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    const store = { raw: sessionStorage.getItem('native') || '', saves: 0, exports: [], permissionAsked: 0 };
    window.__native = store;
    window.SuiSuiAndroid = {
      load: () => store.raw,
      save: json => { store.raw = json; store.saves++; sessionStorage.setItem('native', json); },
      notificationsAllowed: () => true,
      isLockMode: () => false,
      permissions: () => JSON.stringify({ notifications: true, overlay: false, lockScreenRunning: false, brand: 'xiaomi' }),
      openOverlaySettings: () => { store.overlayOpened = (store.overlayOpened || 0) + 1; },
      openAppPermissions: () => {},
      unlock: () => {},
      requestNotificationPermission: () => { store.permissionAsked++; },
      openNotificationSettings: () => {},
      exportBackup: (json, name) => store.exports.push({ json, name }),
      version: () => 'test'
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });

  // First launch guides through the lock-screen permissions.
  await page.locator('#android-setup[open]').waitFor();
  assert.equal(await page.locator('#setup-notify').evaluate(li => li.classList.contains('done')), true);
  await page.locator('#finish-android-setup').click();
  const first = await page.evaluate(() => JSON.parse(window.__native.raw));
  assert.equal(first.settings.lockScreen, true, 'Lock view starts on in the Android app');
  assert.equal(first.settings.androidSetupSeen, true);
  assert.equal(first.settings.lockNotify, true, 'Lock-screen card starts on in the Android app');
  assert.equal(first.tasks.length, 6);
  assert.equal(await page.locator('#install-banner').isVisible(), false, 'No browser install banner inside the app');
  assert.match(await page.locator('#offline-status').textContent(), /安卓 App 版/);

  // Wallpaper photos stay out of the native copy.
  await page.locator('.nav-button[data-view=settings]').click();
  await page.locator('#wallpaper-file').setInputFiles(require('node:path').resolve(__dirname, '../app/assets/lake.jpg'));
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => JSON.parse(window.__native.raw).settings.photo), '');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('suisui-locktodo-v1')).settings.photo.startsWith('data:image/')));
  assert.match(await page.locator('#notify-status').textContent(), /已开启/);

  // A "完成" tap on the lock screen: native marks seed-3 done, then calls suisuiNativeChanged().
  await page.evaluate(() => {
    const s = JSON.parse(window.__native.raw);
    const t = s.tasks.find(x => x.id === 'seed-3');
    t.done = true; t.completedAt = Date.now() + 1000;
    window.__native.raw = JSON.stringify(s);
    sessionStorage.setItem('native', window.__native.raw);
    window.suisuiNativeChanged();
  });
  assert.equal(await page.locator('.lock-task[data-id=seed-3]').getAttribute('aria-pressed'), 'true', 'Lock-screen completion shows in the app');
  assert.equal(await page.locator('.done-row[data-completed-id=seed-3]').count(), 1);
  assert.equal(await page.locator('.lock-task').last().getAttribute('data-id'), 'seed-3', 'Completed item moved to the end');
  assert(await page.locator('#wallpaper').evaluate(img => img.src.startsWith('data:image/')), 'Photo kept after native reload');

  // Reload: native copy wins, photo comes back from localStorage.
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.lock-task.is-done').count(), 1);
  assert(await page.locator('#wallpaper').evaluate(img => img.src.startsWith('data:image/')));

  // Turning the card off and on asks for permission through the bridge.
  await page.locator('.nav-button[data-view=settings]').click();
  await page.locator('#notify-toggle').uncheck();
  assert.equal(await page.evaluate(() => JSON.parse(window.__native.raw).settings.lockNotify), false);
  await page.locator('#notify-toggle').check();
  assert.equal(await page.evaluate(() => window.__native.permissionAsked), 1);

  // Export goes through the native file picker.
  await page.locator('#settings-export').click();
  const exported = await page.evaluate(() => window.__native.exports[0]);
  assert.match(exported.name, /^suisui-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(JSON.parse(exported.json).tasks.length, 6);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  assert.deepEqual(errors, []);
  console.log('PASS: Android bridge — native copy without photo, lock-screen completion sync, reload, card toggle + permission, native export, no install banner.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
