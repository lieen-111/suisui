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
    assert.match(await css(page, '--wall'), /lake\.jpg/, 'Glass lays the wallpaper under the app');
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

  /* 1.10 home cards: one card per group, finished items at the bottom, subtasks under their task */
  {
    const { context, page } = await open({});
    assert.deepEqual(await page.locator('.group-card').evaluateAll(c => c.map(e => e.dataset.groupCard)), ['work', 'life'], 'One card per group that has something today');
    assert.match(await page.locator('.group-card[data-group-card=work] .group-card-head').textContent(), /💼\s*工作\s*0\/1/);
    await page.locator('.task-row[data-task-id=a] [data-action=complete]').click();
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.group-card[data-group-card=work] .card-done-row[data-completed-id=a]').count(), 1, 'Finished item stays in its card');
    assert.match(await page.locator('.group-card[data-group-card=work] .group-count').textContent(), /1\/1/);
    await page.locator('.card-done-row[data-completed-id=a] [data-action=restore]').click();
    assert.equal(await page.locator('.group-card[data-group-card=work] .task-row[data-task-id=a]').count(), 1, 'Tapping the filled circle restores it');
    // Only one group has to-dos → only one card.
    await page.evaluate(k => { const r = JSON.parse(localStorage.getItem(k)); r.tasks = r.tasks.filter(t => t.group === 'life'); r.tasks[0].subtasks = [{ id: 's1', title: '牛排', done: false }, { id: 's2', title: '麦片', done: false }]; localStorage.setItem(k, JSON.stringify(r)); }, STORE);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.group-card').count(), 1);
    assert.equal(await page.locator('.group-card .sub-row').count(), 2, 'Subtasks are listed under their task');
    await page.locator('.sub-row', { hasText: '牛排' }).click();
    const subs = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).tasks[0].subtasks.map(x => x.done), STORE);
    assert.deepEqual(subs, [true, false], 'A subtask can be ticked right in the list');
    await page.screenshot({ path: path.join(review, 'v110-one-card-390.png') });
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: 1.10 group cards (one per group, done at the bottom, restore, inline subtasks); 1.9 glass/paper/night styles (night forced dark + neon, back to ink), lock-card styles keep the app colour, stacked add rows, settings home preview + list, English UI + English quick-add + switching back.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
