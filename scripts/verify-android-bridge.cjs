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
      // Mirrors TodoStore.writeFromPage: a page with an older revision is refused.
      save: json => {
        const rev = s => { try { return JSON.parse(s).rev || 0; } catch { return 0; } };
        if (store.raw && rev(store.raw) > 0 && rev(json) <= rev(store.raw)) { store.rejected = (store.rejected || 0) + 1; return false; }
        store.raw = json; store.saves++; sessionStorage.setItem('native', json); return true;
      },
      notificationsAllowed: () => true,
      isLockMode: () => false,
      permissions: () => JSON.stringify({ notifications: true, overlay: false, lockScreenRunning: false, brand: 'xiaomi', battery: false, fullScreen: true, needsFullScreenSetting: true, screenOffs: 10, shown: 6 }),
      requestBatteryExemption: () => { store.battery = (store.battery || 0) + 1; },
      openFullScreenSettings: () => {},
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
  await page.locator('[data-settings-page=look]').click();
  await page.locator('#wallpaper-file').setInputFiles(require('node:path').resolve(__dirname, '../app/assets/lake.jpg'));
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => JSON.parse(window.__native.raw).settings.photo), '');
  assert(await page.evaluate(() => localStorage.getItem('suisui-wallpaper-photo').startsWith('data:image/')), 'Photo saved under its own key');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('suisui-locktodo-v1')).settings.photo), '', 'Main record stays small');
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
  await page.locator('[data-settings-page=lock]').click();
  await page.locator('#notify-toggle').uncheck();
  assert.equal(await page.evaluate(() => JSON.parse(window.__native.raw).settings.lockNotify), false);
  await page.locator('#notify-toggle').check();
  assert.equal(await page.evaluate(() => window.__native.permissionAsked), 1);

  // Lock-screen reliability: battery step, stats in settings.
  assert.match(await page.locator('#lock-stats').textContent(), /最近 10 次熄屏，碎碎清单锁屏出现了 6 次.*不限制电池/);
  await page.locator('#open-android-setup').click();
  assert.equal(await page.locator('#setup-battery').evaluate(li => li.classList.contains('done')), false);
  await page.locator('[data-setup=battery]').click();
  assert.equal(await page.evaluate(() => window.__native.battery), 1);
  assert.equal(await page.locator('#setup-fullscreen').isVisible(), true);
  await page.locator('#finish-android-setup').click();

  // A newer copy written elsewhere (lock view / lock-screen card) is never overwritten by this page's older copy.
  await page.evaluate(() => {
    const s = JSON.parse(window.__native.raw);
    s.rev += 5; s.settings.density = 'compact'; s.settings.lockPrivacy = true;
    window.__native.raw = JSON.stringify(s); // no suisuiNativeChanged: this page does not know yet
  });
  await page.locator('#notify-toggle').click(); // the page's save is refused and it reloads the newer copy
  const after = await page.evaluate(() => JSON.parse(window.__native.raw));
  assert.equal(after.settings.density, 'compact', 'Stale save refused; the newer settings stay');
  assert.equal(after.settings.lockPrivacy, true);
  assert.equal(await page.evaluate(() => window.__native.rejected), 1);
  assert.equal(await page.locator('#privacy-toggle').isChecked(), true, 'Page reloaded the newer settings');
  // Overnight: a page left open must take the stored copy before its new-day cleanup.
  await page.evaluate(() => {
    const s = JSON.parse(window.__native.raw);
    s.rev += 3; s.settings.density = 'comfortable'; s.day = '2020-01-01';
    window.__native.raw = JSON.stringify(s);
    window.suisui.rollover();
  });
  const morning = await page.evaluate(() => JSON.parse(window.__native.raw));
  assert.equal(morning.settings.density, 'comfortable', 'Rollover started from the newest settings');
  assert.notEqual(morning.day, '2020-01-01');

  // Export goes through the native file picker.
  await page.locator('#settings-back').click();
  await page.locator('[data-settings-page=data]').click();
  await page.locator('#export-button').click();
  const exported = await page.evaluate(() => window.__native.exports[0]);
  assert.match(exported.name, /^suisui-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(JSON.parse(exported.json).tasks.length, 6);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  assert.deepEqual(errors, []);
  console.log('PASS: Android bridge — native copy without photo, lock-screen completion sync, reload, card toggle + permission, native export, no install banner.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
