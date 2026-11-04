// 1.9: three interface styles, lock-card styles separate from the app colour, stacked add rows,
// settings home (preview + list), and the English interface with English quick-add.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;
const css = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  const day = '2026-11-04';
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work', repeat: 'none' };
  const record = settings => JSON.stringify({ schema: 2, rev: 1, day, tasks: [{ ...base, id: 'a', title: '回复客户邮件' }, { ...base, id: 'b', title: '健身', repeat: 'daily', group: 'life' }],
    archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0' }, { id: 'life', name: '生活', color: '#d2566f' }], settings: { palette2: true, ...settings } });
  const open = async settings => {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, record(settings)]);
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date(`${day}T09:00:00`) });
    await page.goto(url, { waitUntil: 'networkidle' });
    return { context, page };
  };

  /* Styles */
  {
    const { context, page } = await open({});
    assert.equal(await page.evaluate(() => document.documentElement.dataset.style), 'glass', '玻璃 is the default style');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--wall').includes('data:image/jpeg'));
    // Glass lays a pre-blurred (tiny, upscaled) copy of the wallpaper under the app: no live blur filter.
    assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').filter), 'none');
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#home-hero').isVisible(), true, 'Settings home starts with the lock-card preview');
    assert.equal(await page.locator('.settings-list [data-settings-page]').count(), 5);
    assert.match(await page.locator('#sum-look').textContent(), /玻璃/);
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('#swatch-lime').isVisible(), false, '荧光 only in 夜光');
    // Lock-card styles change the card, never the app colour.
    await page.locator('[name=accent][value=indigo]').check();
    await page.locator('[data-theme-preset=mist]').click();
    assert.equal(await css(page, '--accent'), '#4c5bd4', 'A card style keeps the app colour');
    assert.match(await page.locator('#toast-message').textContent(), /锁屏卡片已换成“雾白”/);
    await page.locator('[name=accent][value=ink]').check();
    // 夜光: always dark, comes with 荧光; leaving gives 墨黑 back.
    await page.locator('[data-ui-style=night]').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.style), 'night');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(10, 10, 11)', '夜光 is dark in light mode too');
    assert.equal(await css(page, '--accent'), '#d8ff3d');
    assert.equal(await page.locator('#swatch-lime').isVisible(), true);
    await page.screenshot({ path: path.join(review, 'v19-night-look-390.png') });
    await page.locator('[data-ui-style=paper]').click();
    assert.equal(await css(page, '--accent'), '#1d1d1f', 'Leaving 夜光 returns to 墨黑');
    await page.locator('.nav-button[data-view=tasks]').click();
    assert.equal(await page.locator('.hero-day').isVisible(), true, '纸墨 shows the big day number');
    assert.equal(await page.locator('.hero-day').textContent(), '04');
    assert.equal(await page.locator('.today-top h1').isVisible(), false);
    await page.screenshot({ path: path.join(review, 'v19-paper-390.png') });
    // Add sheet: every row visible with its label, no toolbar.
    await page.locator('#fab-add').click();
    assert.equal(await page.locator('.add-row').count(), 5);
    assert.equal(await page.locator('[data-add-duration="30"]').isVisible(), true, 'Options are visible without opening anything');
    assert.equal(await page.locator('#add-toolbar').count(), 0);
    await page.locator('#add-backdrop').click({ position: { x: 20, y: 20 } });
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);
    assert.equal(saved.uiStyle, 'paper'); assert.equal(saved.accent, 'ink');
    await context.close();
  }

  /* English */
  {
    const { context, page } = await open({ lang: 'en', uiStyle: 'glass' });
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.locator('.today-top h1').textContent(), 'Today');
    assert.match(await page.locator('#progress-copy').textContent(), /^Wed, November 4 · 2 left, 0 done$/);
    assert.equal(await page.locator('.task-row[data-task-id=a] .task-title').textContent(), '回复客户邮件', 'User text is never translated');
    assert.match(await page.locator('.task-row[data-task-id=b] .meta-repeat').textContent(), /Daily/);
    assert.match(await page.locator('[data-filter=work]').textContent(), /Work/);
    await page.locator('#fab-add').click();
    assert.equal(await page.locator('#task-input').getAttribute('placeholder'), 'What to do? e.g. meeting tomorrow 3pm');
    await page.locator('#task-input').fill('Call mom every fri 8pm 30 min');
    await page.waitForTimeout(200);
    assert.match(await page.locator('#parse-hint').textContent(), /Recognized: Every Fri · remind 20:00 · 30 min/);
    await page.locator('#add-form button[type=submit]').click();
    const t = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).tasks.find(x => x.title === 'Call mom'), STORE);
    assert.ok(t, 'English quick-add keeps only the title');
    assert.equal(t.repeat, 'weekly'); assert.equal(t.repeatDay, 5); assert.equal(t.time, '20:00'); assert.equal(t.duration, 30);
    assert.match(await page.locator('#toast-message').textContent(), /Added to Later: Every Fri/);
    await page.locator('#task-input').fill('Pay rent tomorrow 9am');
    await page.locator('#add-form button[type=submit]').click();
    const r = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).tasks.find(x => x.title === 'Pay rent'), STORE);
    assert.equal(r.date, '2026-11-05'); assert.equal(r.time, '09:00');
    await page.locator('#add-backdrop').click({ position: { x: 20, y: 20 } });
    assert.match(await page.locator('#later-list .task-row', { hasText: 'Pay rent' }).locator('.meta-flag').first().textContent(), /Tomorrow|09:00/);
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#settings-title').textContent(), 'Settings');
    assert.equal(await page.locator('#sum-lang').textContent(), 'English');
    await page.screenshot({ path: path.join(review, 'v19-en-settings-390.png') });
    // Back to Chinese: the page reloads in Chinese.
    await page.locator('[data-settings-page=language]').click();
    await Promise.all([page.waitForEvent('load'), page.locator('[name=lang][value=zh]').check()]);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.today-top h1').textContent(), '今天');
    await context.close();
  }

  /* 1.11 lock screen: one card per group (only groups with something today), subtasks, ✓ and + buttons */
  {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const rec = JSON.parse(record({}));
    rec.tasks[0].subtasks = [{ id: 's1', title: '牛排', done: false }];
    rec.tasks.push({ ...base, id: 'c', title: '确认合同', done: true, completedAt: Date.parse(`${day}T08:00:00`) });
    await context.addInitScript(raw => { window.__unlock = []; window.SuiSuiAndroid = { load: () => raw, save: j => { raw = j; return true; }, isLockMode: () => true, notificationsAllowed: () => true, permissions: () => '{"notifications":true,"overlay":true}', unlock: o => window.__unlock.push(o), version: () => 't' }; }, JSON.stringify(rec));
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date(`${day}T09:00:00`) });
    await page.goto(url + '/?mode=lock', { waitUntil: 'networkidle' });
    assert.deepEqual(await page.locator('.lock-group').evaluateAll(g => g.map(e => e.dataset.lockGroup)), ['work', 'life']);
    assert.match(await page.locator('.lock-group[data-lock-group=work] .lock-group-head').textContent(), /^\s*工作\s*1\/2\s*$/);
    assert.equal(await page.locator('.lock-group[data-lock-group=work] .lock-group-icon svg').count(), 1, 'Groups carry a line icon (Lucide), not an emoji');
    assert.equal(await page.locator('.activity-heading').isVisible(), true, 'The 今天的待办 heading is still there');
    assert.equal(await page.locator('#see-all').isVisible(), true, 'The remaining/done line with 全部清单 is still there');
    assert.deepEqual(await page.locator('.lock-group[data-lock-group=work] .lock-task').evaluateAll(b => b.map(e => e.dataset.id)), ['a', 'c'], 'Finished items sit at the bottom of their card');
    assert.equal(await page.locator('.lock-group[data-lock-group=work] .lock-sub').count(), 1, 'Subtasks are listed under their task');
    await page.locator('.lock-sub').click();
    assert.equal(await page.locator('.lock-sub.is-done').count(), 1, 'A subtask can be ticked on the lock screen');
    assert.match(await page.locator('#lock-date').textContent(), /11月4日周三 · .+年.+月.+/, 'Lock date shows the Chinese calendar date');
    await page.screenshot({ path: path.join(review, 'v111-lock-groups-390.png') });
    await page.locator('#lock-add').click();
    assert.deepEqual(await page.evaluate(() => window.__unlock), [true], '+ opens the app');
    assert.ok(await page.evaluate(() => localStorage.getItem('suisui-open-add')), '… and asks it to open the add sheet');
    await page.locator('#lock-open').click();
    assert.deepEqual(await page.evaluate(() => window.__unlock), [true, true]);
    await context.close();
  }
  /* 1.11 cute fonts: picked in settings, loaded only when needed */
  {
    const { context, page } = await open({});
    assert.equal(await page.locator('#cute-fonts').count(), 0, 'Cute fonts are not loaded until needed');
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('#cute-fonts').count(), 1, 'Opening the look page loads them for the previews');
    assert.equal(await page.locator('[data-font]').count(), 7);
    await page.locator('[data-font=kuaile]').click();
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-font')), 'var(--font-kuaile)');
    await page.waitForFunction(() => document.fonts.check('16px "ZCOOL KuaiLe"', '碎碎'));
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: 1.12 line icons + summary kept; 1.11 lock screen group cards (subtasks, ✓/+, lunar date) and cute fonts; 1.9 glass/paper/night styles (night forced dark + neon, back to ink), lock-card styles keep the app colour, stacked add rows, settings home preview + list, English UI + English quick-add + switching back.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
