// 1.0 features: list-first phones, dates and "以后", weekday/weekly repeats, custom groups,
// theme presets, lock-screen privacy (Android lock view + notification text), rapid completion.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;
const bridgeStub = (lock) => `
  const store = { raw: sessionStorage.getItem('native') || '' };
  window.__native = store;
  window.SuiSuiAndroid = { load: () => store.raw, save: j => { store.raw = j; sessionStorage.setItem('native', j); },
    isLockMode: () => ${lock}, notificationsAllowed: () => true,
    permissions: () => JSON.stringify({ notifications: true, overlay: true, lockScreenRunning: true, brand: 'test' }),
    requestNotificationPermission() {}, openNotificationSettings() {}, openOverlaySettings() {}, openAppPermissions() {},
    unlock: openApp => { store.unlocked = openApp; }, exportBackup() {}, version: () => 'test' };`;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };

  /* Phones open on the list; there is no in-app fake lock screen or "锁屏" tab. */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-10-30T09:00:00') }); // Friday
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#tasks-panel').isVisible(), true);
    assert.equal(await page.locator('#preview-panel').isVisible(), false);
    assert.equal(await page.locator('.nav-button[data-view=preview]').count(), 0);
    assert.equal(await page.locator('.phone-top, .phone-bottom, .home-indicator').count(), 0, 'No fake phone chrome anywhere');
    await page.evaluate(store => { const s = JSON.parse(localStorage.getItem(store)); s.settings.motion = false; localStorage.setItem(store, JSON.stringify(s)); }, STORE);
    await page.reload({ waitUntil: 'networkidle' });

    // Dates: tomorrow goes to "以后", picked date shows its label, today stays on today's list.
    const closeSheet = async () => { await page.locator('#add-backdrop').click(); await page.locator('#add-form').waitFor({ state: 'hidden' }); };
    await page.locator('#fab-add').click();
    await page.locator('#task-input').fill('明天交方案');
    await page.locator('[data-add-when=tomorrow]').click();
    await page.locator('#add-form button[type=submit]').click();
    assert.match(await page.locator('#toast-message').textContent(), /以后.*明天/);
    assert.equal(await page.locator('#task-list .task-row', { hasText: '明天交方案' }).count(), 0);
    assert.equal(await page.locator('#later-list .task-row', { hasText: '明天交方案' }).locator('.meta-flag', { hasText: '明天' }).count(), 1);
    await page.locator('[data-add-when=pick]').click();
    await page.locator('#task-date').fill('2026-11-05');
    await page.locator('#task-input').fill('交房租');
    await page.locator('#add-form button[type=submit]').click();
    assert.equal(await page.locator('#later-list .task-row', { hasText: '交房租' }).locator('.meta-flag', { hasText: '11月5日' }).count(), 1);
    assert.equal(await page.locator('.lock-task', { hasText: '交房租' }).count(), 0, 'Future tasks stay off the lock card');
    // Weekly on Friday shows today; weekdays not shown on Saturday.
    await page.locator('[data-add-when=today]').click();
    await page.locator('[data-add-repeat=weekly]').click();
    await page.locator('#task-input').fill('周五复盘');
    await page.locator('#add-form button[type=submit]').click();
    assert.equal(await page.locator('#task-list .task-row', { hasText: '周五复盘' }).locator('.meta-flag', { hasText: '每五' }).count(), 1);
    await page.locator('[data-add-repeat=weekdays]').click();
    assert.equal(await page.locator('[data-add-when=tomorrow]').isDisabled(), true, 'Daily-type repeats have no date');
    await page.locator('#task-input').fill('打卡');
    await page.locator('#add-form button[type=submit]').click();
    await closeSheet();
    await page.locator('#task-list .task-row', { hasText: '打卡' }).locator('[data-action=complete]').click();
    await page.locator('#task-list .task-row', { hasText: '周五复盘' }).locator('[data-action=complete]').click();
    // Saturday: tomorrow's task is due, weekday/weekly ones reset but move to "以后".
    await page.clock.setSystemTime(new Date('2026-10-31T08:00:00'));
    await page.clock.runFor(31000);
    assert.equal(await page.locator('#task-list .task-row', { hasText: '明天交方案' }).count(), 1, 'Yesterday\'s “tomorrow” task is on today\'s list');
    assert.equal(await page.locator('.lock-task', { hasText: '明天交方案' }).count(), 1, 'and on the lock card');
    assert.equal(await page.locator('#task-list .task-row', { hasText: '打卡' }).count(), 0, 'Weekdays task hidden on Saturday');
    assert.equal(await page.locator('#later-list .task-row', { hasText: '打卡' }).count(), 1);
    assert.equal(await page.locator('#later-list .task-row', { hasText: '周五复盘' }).count(), 1, 'Weekly task waits for next Friday');
    // Monday: an undone dated task from Saturday shows as overdue.
    await page.clock.setSystemTime(new Date('2026-11-02T08:00:00'));
    await page.clock.runFor(31000);
    assert.equal(await page.locator('#task-list .task-row', { hasText: '明天交方案' }).locator('.meta-flag.overdue').count(), 1);
    assert.equal(await page.locator('#task-list .task-row', { hasText: '打卡' }).count(), 1, 'Weekdays task back on Monday');

    // Edit: change repeat and date.
    await page.locator('#task-list .task-row', { hasText: '明天交方案' }).getByRole('button', { name: /^编辑/ }).click();
    await page.locator('.edit-form input[name=date]').fill('2026-11-10');
    await page.locator('.edit-form button.primary-button').click();
    assert.equal(await page.locator('#later-list .task-row', { hasText: '明天交方案' }).count(), 1);

    // Groups: create, rename, recolor, use, delete (tasks move), undo.
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=list]').click();
    await page.locator('#add-group').click();
    const input = page.locator('.group-name').last();
    await input.fill('学习');
    await input.press('Enter');
    const newId = await input.getAttribute('data-group-id');
    await page.locator(`.group-color[data-group-id="${newId}"][data-group-color="#226a9a"]`).click();
    await page.locator('.nav-button[data-view=tasks]').click();
    assert.equal(await page.locator('#filter-tabs button', { hasText: '学习' }).count(), 1);
    await page.locator('#fab-add').click();
    await page.locator(`[data-add-group="${newId}"]`).click();
    await page.locator('#task-input').fill('背单词');
    await page.locator('#add-form button[type=submit]').click();
    await closeSheet();
    await page.locator(`[data-filter="${newId}"]`).click();
    assert.equal(await page.locator('#task-list .task-row').count(), 1);
    assert.equal(await page.locator('#task-list .task-row .task-meta').first().evaluate(el => el.textContent.includes('学习')), true);
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=list]').click();
    await page.locator(`[data-group-delete="${newId}"]`).click();
    assert.match(await page.locator('#toast-message').textContent(), /已删除“学习”，1 件移到“工作”/);
    await page.locator('#undo-button').click();
    assert.equal(await page.locator('.group-name').count(), 3);
    for (const width of [320, 430]) { await page.setViewportSize({ width, height: 800 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings fit ${width}`); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(review, 'v1-settings-390.png'), fullPage: true });
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.locator('[data-filter=all]').click();
    await page.screenshot({ path: path.join(review, 'v1-tasks-390.png'), fullPage: true });

    // Persisted shape stays importable by the native apps.
    const saved = await page.evaluate(store => JSON.parse(localStorage.getItem(store)), STORE);
    assert.equal(saved.groups.length, 3);
    assert(saved.tasks.some(t => t.repeat === 'weekly' && t.repeatDay === 5));
    assert(saved.tasks.some(t => t.date === '2026-11-10'));
    await context.close();
  }

  /* Themes and folded appearance settings */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('#more-appearance').evaluate(d => d.open), false, 'Detailed appearance is folded by default');
    await page.locator('[data-theme-preset=mist]').click();
    assert.equal(await page.locator('[data-theme-preset=mist]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#activity').evaluate(el => el.style.getPropertyValue('--card-blur')), '7px');
    assert.equal(await page.locator('#activity').evaluate(el => el.style.getPropertyValue('--card-ink')), '#182b22');
    await page.locator('[data-theme-preset=lake]').click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#226a9a');
    assert.equal(await page.locator('[data-theme-preset=mist]').getAttribute('aria-pressed'), 'false');
    await context.close();
  }

  /* Rapid completion: a second tap during the first shatter is not lost */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.lock-task[data-id=seed-2]').click();
    await page.waitForTimeout(120);
    await page.locator('.lock-task[data-id=seed-3]').click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.lock-task.is-done').count(), 2, 'Both quick taps complete');
    const order = await page.locator('.lock-task.is-done').evaluateAll(els => els.map(e => e.dataset.id));
    assert.deepEqual(order, ['seed-2', 'seed-3'], 'Completion order kept');
    await context.close();
  }

  /* Privacy: Android lock view hides content; web notification body hides titles */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(bridgeStub(true));
    const page = await context.newPage(); watch(page);
    await page.goto(url + '/?mode=lock', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.lock-task').count(), 6);
    assert(await page.locator('.lock-task').first().evaluate(el => el.getBoundingClientRect().height >= 44));
    await page.screenshot({ path: path.join(review, 'v1-lock-390.png') });
    await page.evaluate(store => { const s = JSON.parse(localStorage.getItem(store)); s.settings.lockPrivacy = true; localStorage.setItem(store, JSON.stringify(s)); sessionStorage.setItem('native', JSON.stringify(s)); }, STORE);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.lock-task').count(), 0, 'No titles on the lock screen in privacy mode');
    assert.match(await page.locator('#activity .lock-private').textContent(), /今天还有 6 件待办/);
    assert.equal(await page.locator('#activity').textContent().then(t => t.includes('把锁屏待办')), false);
    await page.screenshot({ path: path.join(review, 'v1-lock-private-390.png') });
    await page.locator('#lock-reveal').click();
    assert.equal(await page.evaluate(() => window.__native.unlocked), true, 'Reveal asks the system to unlock, then opens the app');
    await context.close();

    const web = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const wp = await web.newPage(); watch(wp);
    await wp.goto(url, { waitUntil: 'networkidle' });
    await wp.locator('.nav-button[data-view=settings]').click();
    await wp.locator('[data-settings-page=lock]').click();
    await wp.locator('#privacy-toggle').check();
    const content = await wp.evaluate(() => window.suisui.notificationContent());
    assert.equal(content.body, '打开碎碎清单查看');
    assert.match(await wp.locator('#mini-list').textContent(), /今天还有 6 件待办/, 'Settings preview shows the private card');
    await web.close();
  }

  /* 1.1: edit sheet (pin, group, repeat), Android phone wallpaper in previews, back button closes layers */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(bridgeStub(false).replace('version: () =>', 'hasSystemWallpaper: () => true, version: () =>'));
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#android-setup[open]').waitFor(); // first run explains the lock-screen permissions
    await page.locator('#finish-android-setup').click();
    assert.equal(await page.locator('.task-row .icon-button').count(), 0, 'Rows have no tiny icon buttons; tap the text to edit');
    await page.locator('.task-row', { hasText: '给家里打个电话' }).locator('.task-body').click();
    assert.equal(await page.locator('#edit-sheet').evaluate(d => d.open), true);
    await page.locator('[data-edit-group=work]').click();
    await page.locator('[data-edit-repeat=daily]').click();
    assert.equal(await page.locator('#edit-date').isDisabled(), true);
    await page.locator('#edit-pinned').check();
    await page.locator('.edit-form button.primary-button').click();
    const row = page.locator('#task-list .task-row').nth(1);
    assert.match(await row.textContent(), /给家里打个电话/, 'Pinned rows move up');
    assert.match(await row.locator('.task-meta').textContent(), /工作.*每天.*置顶/);
    // Swipe: right finishes, left deletes with undo, a short drag springs back and does not open the editor.
    const drag = async (nth, dx) => { const r = await page.locator('#task-list .task-row').nth(nth).boundingBox(); const y = r.y + r.height / 2; await page.mouse.move(r.x + 200, y); await page.mouse.down(); await page.mouse.move(r.x + 200 + dx, y, { steps: 8 }); await page.mouse.up(); };
    assert.equal(await page.locator('#gesture-tips').isVisible(), true, 'First use shows the gesture tips');
    const before = await page.locator('#task-list .task-row').count();
    await drag(2, 40);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#edit-sheet').evaluate(d => d.open), false, 'Short drag is not a tap');
    assert.equal(await page.locator('#task-list .task-row').count(), before);
    await drag(2, 140);
    await page.waitForTimeout(900);
    assert.equal(await page.locator('#task-list .task-row').count(), before - 1, 'Swipe right completes');
    await drag(2, -140);
    assert.equal(await page.locator('#task-list .task-row').count(), before - 2, 'Swipe left deletes');
    assert.match(await page.locator('#toast-message').textContent(), /已删除/);
    await page.locator('#undo-button').click();
    assert.equal(await page.locator('#task-list .task-row').count(), before - 1, 'Delete undo');
    await page.locator('#tips-close').click();
    assert.equal(await page.locator('#gesture-tips').isVisible(), false);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#gesture-tips').isVisible(), false, 'Tips stay dismissed');
    // Back: closes the sheet, then the settings page, then settings.
    await page.locator('.task-row').first().locator('.task-body').click();
    assert.equal(await page.evaluate(() => window.suisuiBack()), true);
    assert.equal(await page.locator('#edit-sheet').evaluate(d => d.open), false);
    await page.locator('#fab-add').click();
    assert.equal(await page.evaluate(() => window.suisuiBack()), true);
    await page.locator('#add-form').waitFor({ state: 'hidden' });
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wallpaper-hole')), true, 'Settings preview shows the phone wallpaper');
    assert.equal(await page.locator('#mini-wallpaper').isVisible(), false);
    assert.equal(await page.locator('#settings-preview').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
    for (const sel of ['.app-header', '.settings-top', '#settings-scroll', '.navigation']) assert.notEqual(await page.locator(sel).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', `${sel} stays opaque`);
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('[data-wallpaper=system]').getAttribute('aria-pressed'), 'true', 'Phone wallpaper is the default in the Android app');
    await page.locator('[data-wallpaper=aurora]').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wallpaper-hole')), false, 'A library wallpaper replaces the phone wallpaper');
    assert.match(await page.locator('#mini-wallpaper').getAttribute('src'), /wallpapers\/aurora\.jpg/);
    await page.locator('[data-wallpaper=system]').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wallpaper-hole')), true);
    assert.equal(await page.evaluate(() => window.suisuiBack()), true);
    assert.equal(await page.locator('#settings-index').isVisible(), true);
    await page.locator('[data-settings-page=data]').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wallpaper-hole')), false, 'No preview, no hole');
    assert.equal(await page.evaluate(() => window.suisuiBack()), true);
    assert.equal(await page.evaluate(() => window.suisuiBack()), true);
    assert.equal(await page.locator('#tasks-panel').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wallpaper-hole')), false, 'List paints its own background');
    assert.equal(await page.evaluate(() => window.suisuiBack()), false, 'Nothing open: leave the app');
    await context.close();
    const lock = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await lock.addInitScript(bridgeStub(true).replace('version: () =>', 'hasSystemWallpaper: () => true, version: () =>'));
    const lp = await lock.newPage(); watch(lp);
    await lp.goto(url + '/?mode=lock', { waitUntil: 'networkidle' });
    assert.equal(await lp.locator('#wallpaper').isVisible(), false, 'Lock view sits on the phone wallpaper');
    assert.equal(await lp.locator('#lockscreen').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await lock.close();
  }

  assert.deepEqual(errors, []);
  /* Wallpaper library on the web: every wallpaper loads, choice persists */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage(); watch(page);
    await page.goto(url + '/?view=settings&page=look', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#wallpaper-library .wallpaper-choice').count(), 10);
    assert.equal(await page.locator('[data-wallpaper=system]').count(), 0, 'No phone-wallpaper option where it cannot work');
    const broken = await page.locator('#wallpaper-library img').evaluateAll(async imgs => { await Promise.all(imgs.map(i => i.decode().catch(() => {}))); return imgs.filter(i => !i.naturalWidth).length; });
    assert.equal(broken, 0, 'All thumbnails load');
    await page.locator('[data-wallpaper=dusk]').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('#wallpaper').getAttribute('src'), /wallpapers\/dusk\.jpg/, 'Choice persists');
    assert.equal(await page.locator('#wallpaper').evaluate(async i => { await i.decode(); return i.naturalWidth; }), 1080);
    await context.close();
  }

  /* Dark mode follows the system */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, colorScheme: 'dark' });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(bg, 'rgb(16, 20, 18)', 'Dark background');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#5cc59c', 'Lighter accent text on dark');
    assert.equal(await page.locator('#fab-add').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(19, 118, 91)', 'Buttons keep the brand fill');
    await page.screenshot({ path: path.join(review, 'v12-dark-390.png') });
    await context.close();
  }

  console.log('PASS: swipe complete/delete/undo, gesture tips, dark mode (1.2), edit sheet + back button + phone wallpaper (1.1), list-first phones without fake lock screen, dates/later/overdue, weekdays/weekly repeats, edit date, custom groups (add/rename/recolor/filter/delete/undo), theme presets + folded settings, rapid completion, lock-screen privacy (lock view, reveal, notification text, preview), 320/390/430 layouts.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
