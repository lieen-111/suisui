// 1.7: repeating tasks are findable (row tag, lock mark, "重复" filter), 墨黑 palette with migration,
// and the edit/add sheets show dates and times as chips instead of raw form fields.
const { toTasks, openPanel, chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;
const css = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  const day = '2026-11-04'; // Wednesday
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work' };
  const record = settings => JSON.stringify({ schema: 2, rev: 1, day, tasks: [
    { ...base, id: 'a', title: '晨跑', repeat: 'daily' },
    { ...base, id: 'b', title: '周报', repeat: 'weekly', repeatDay: 5 },
    { ...base, id: 'c', title: '回邮件', repeat: 'none' }
  ], archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#13765b' }], settings });

  /* Old settings: green was the default, so it becomes 墨黑; the old default card colour follows. */
  {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, record({ accent: 'green', cardColor: '#112b24', cardTransparency: 15 })]);
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date(`${day}T09:00:00`) });
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await css(page, '--accent'), '#1d1d1f', 'Old default green migrates to 墨黑');
    assert.equal(await css(page, '--a-700'), '#3a3a3c');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);
    assert.equal(saved.accent, 'ink'); assert.equal(saved.palette2, true); assert.equal(saved.cardColor, '#1c1c1e');

    // Choosing green again sticks (no second migration).
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('[name=accent][value=green]').isVisible(), true, 'App 主色 is on the look page, not folded away');
    await page.locator('[name=accent][value=green]').check();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await css(page, '--accent'), '#13765b', 'A green picked in 1.7 is kept');

    /* Repeat: tag on the row, mark on the lock card, a 重复 filter with tasks not due today. */
    await toTasks(page);
    assert.match(await page.locator('.task-row[data-task-id=a] .meta-repeat').textContent(), /每天/);
    assert.equal(await page.locator('.lock-task[data-id=a] .lock-repeat').count(), 1, 'Lock card marks repeating rows');
    assert.equal(await page.locator('.lock-task[data-id=c] .lock-repeat').count(), 0);
    await page.locator('[data-filter=repeat]').click();
    assert.match(await page.locator('[data-filter=repeat]').textContent(), /重复\s*2/);
    assert.deepEqual(await page.locator('#task-list .task-row').evaluateAll(r => r.map(e => e.dataset.taskId)), ['a']);
    assert.deepEqual(await page.locator('#later-list .task-row').evaluateAll(r => r.map(e => e.dataset.taskId)), ['b'], 'A weekly task due Friday shows under 以后');
    assert.match(await page.locator('#later-list .task-row[data-task-id=b] .meta-repeat').textContent(), /每周五/);
    await page.screenshot({ path: path.join(review, 'v17-repeat-filter-390.png') });

    /* Picker chips: words instead of raw date/time fields; the native input still drives the value. */
    await page.locator('[data-filter=all]').click();
    await page.locator('.task-row[data-task-id=c] .task-body').click();
    await page.locator('#edit-sheet[open]').waitFor();
    const label = id => page.locator(`.pick-chip[data-pick=${id}] .pick-label`).textContent();
    assert.equal(await label('edit-time'), '选时间');
    assert.equal(await label('edit-date'), '其他日期');
    assert.equal(await page.locator('[data-edit-time]').getAttribute('aria-pressed'), 'true', '不提醒 is selected while no time is set');
    await openPanel(page, 'edit', 'time'); await page.locator('#edit-time').fill('15:30');
    assert.equal(await label('edit-time'), '15:30');
    assert.equal(await page.locator('[data-edit-time]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.pick-chip[data-pick=edit-time]').evaluate(e => e.classList.contains('active')), true);
    await openPanel(page, 'edit', 'when'); await page.locator('#edit-date').fill('2026-11-09');
    await openPanel(page, 'edit', 'when'); await page.locator('#edit-date').dispatchEvent('change');
    assert.match(await label('edit-date'), /11月9日|周一/);
    assert.equal(await page.locator('#edit-note').evaluate(e => getComputedStyle(e).resize), 'none');
    await page.screenshot({ path: path.join(review, 'v17-edit-pickers-390.png') });
    await page.locator('.edit-form button.primary-button').click();
    const c = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).tasks.find(t => t.id === 'c'), STORE);
    assert.equal(c.time, '15:30'); assert.equal(c.date, '2026-11-09');

    // Add sheet: "选日期" opens a chip with the chosen day.
    await page.locator('#fab-add').click();
    assert.equal(await page.locator('.pick-chip[data-pick=task-date]').isVisible(), false);
    await openPanel(page, 'add', 'when'); await page.locator('[data-add-when=pick]').click();
    assert.equal(await page.locator('.pick-chip[data-pick=task-date]').isVisible(), true);
    assert.match(await label('task-date'), /11月6日|周五/);
    await context.close();
  }

  /* Fresh install: 墨黑, neutral greys, no green left in the computed page colours. */
  {
    const context = await browser.newContext({ demo: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await css(page, '--accent'), '#1d1d1f');
    const greenish = await page.evaluate(() => {
      const hits = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor]) {
          const m = v.match(/rgba?\((\d+), (\d+), (\d+)/); if (!m) continue;
          const [r, g, b] = m.slice(1).map(Number);
          if (g - Math.max(r, b) > 18 && !el.closest('.dot, .group-color, .swatch, [style*="--chip"], .theme-chip')) hits.add(`${el.className || el.tagName}:${v}`);
        }
      }
      return [...hits];
    });
    assert.deepEqual(greenish, [], 'No green-tinted UI colours on the default palette');
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: 1.7 repeat tag + lock mark + 重复 filter (incl. not-due-today), palette migration and 墨黑 default, picker chips for date/time, no raw resize handle.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
