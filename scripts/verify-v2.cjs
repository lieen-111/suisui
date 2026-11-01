// 1.4 requirements: empty first run, task durations with a start button and countdown,
// weekly / monthly review table and a designed poster image.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };

  /* First run: no sample tasks, an invitation to add the first one. */
  {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-11-04T09:00:00') }); // Wednesday
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.task-row').count(), 0, 'No sample tasks for a new user');
    assert.equal(await page.locator('.first-run').isVisible(), true);
    assert.equal(await page.locator('#filter-tabs').isVisible(), false);
    assert.equal(await page.locator('#reset-button').isVisible(), false, 'No "restore samples" in the real app');
    await page.screenshot({ path: path.join(review, 'v2-first-run-390.png') });

    // Durations: chips in the add sheet; tasks without one get no start button.
    await page.locator('[data-action=first-add]').click();
    await page.locator('#task-input').fill('读书');
    await page.locator('[data-add-duration="30"]').click();
    await page.locator('#add-form button[type=submit]').click();
    assert.equal(await page.locator('[data-add-duration="0"]').getAttribute('aria-pressed'), 'true', 'Duration resets after adding');
    await page.locator('#task-input').fill('写周报');
    await page.locator('#add-form button[type=submit]').click();
    await page.locator('#task-input').fill('冥想');
    await page.locator('[data-add-duration=custom]').click();
    await page.locator('#task-duration-custom').fill('1');
    await page.locator('#add-form button[type=submit]').click();
    await page.locator('#add-backdrop').click();
    await page.locator('#add-form').waitFor({ state: 'hidden' });
    const rowOf = title => page.locator('#task-list .task-row', { hasText: title });
    assert.match(await rowOf('读书').locator('.timer-pill').textContent(), /30分/);
    assert.equal(await rowOf('写周报').locator('.timer-pill').count(), 0, 'No duration, no start button');
    assert.match(await rowOf('冥想').locator('.timer-pill').textContent(), /1分/);

    // Start, pause, resume, stop.
    await rowOf('读书').locator('.timer-pill').click();
    await page.clock.runFor(5000);
    assert.match(await rowOf('读书').locator('[data-timer-text]').textContent(), /^29:5\d$/);
    await rowOf('读书').locator('.timer-pill').click(); // pause
    const paused = await rowOf('读书').locator('[data-timer-text]').textContent();
    await page.clock.runFor(10000);
    assert.equal(await rowOf('读书').locator('[data-timer-text]').textContent(), paused, 'Paused timer holds');
    await rowOf('读书').locator('.timer-stop').click();
    assert.equal(await rowOf('读书').locator('.timer-pill').textContent().then(t => t.includes('30分')), true, 'Stopped timer shows the duration again');

    // A timer that runs out: toast with "标记完成", focus time goes into the review log.
    await rowOf('冥想').locator('.timer-pill').click();
    // Lock card shows the running timer too.
    assert.equal(await page.evaluate(() => document.querySelectorAll('.lock-row .lock-timer.is-on').length), 1);
    await page.clock.runFor(61000);
    assert.match(await page.locator('#toast-message').textContent(), /时间到：冥想/);
    assert.equal(await page.locator('#undo-button').textContent(), '标记完成');
    await page.locator('#undo-button').click();
    await page.waitForTimeout(100);
    await page.clock.runFor(1500);
    const saved = await page.evaluate(store => JSON.parse(localStorage.getItem(store)), STORE);
    const entry = saved.log.find(e => e.title === '冥想');
    assert(entry, 'Completion logged');
    assert.equal(entry.min, 1, 'Focus minutes recorded');
    assert.equal(saved.timer, null);
    // Undo a normal completion removes its log line.
    await rowOf('写周报').locator('[data-action=complete]').click();
    await page.clock.runFor(1500);
    assert.equal(await page.evaluate(store => JSON.parse(localStorage.getItem(store)).log.length, STORE), 2);
    await page.locator('#undo-button').click();
    assert.equal(await page.evaluate(store => JSON.parse(localStorage.getItem(store)).log.length, STORE), 1, 'Undo removes the log line');
    // Edit sheet changes the duration.
    await rowOf('写周报').locator('.task-body').click();
    await page.locator('[data-edit-duration="45"]').click();
    await page.locator('.edit-form button.primary-button').click();
    assert.match(await rowOf('写周报').locator('.timer-pill').textContent(), /45分/);
    await page.screenshot({ path: path.join(review, 'v2-timers-390.png') });
    await context.close();
  }

  /* Review: week and month tables from the log, group filter, poster image. */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-11-04T20:00:00') }); // Wednesday evening
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(store => {
      const s = JSON.parse(localStorage.getItem(store));
      const at = (d, h) => new Date(`2026-${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
      s.log = [
        { id: 'a', title: '上个月的事', group: 'work', at: at('10-20', 10), min: 0 },
        { id: 'b', title: '上周日', group: 'life', at: at('11-01', 10), min: 0 },
        { id: 'c', title: '剪口播视频', group: 'work', at: at('11-02', 9), min: 45 },
        { id: 'd', title: '回客户邮件', group: 'work', at: at('11-02', 15), min: 0 },
        { id: 'e', title: '跑步', group: 'life', at: at('11-03', 7), min: 30 },
        { id: 'f', title: '写选题 <b>', group: 'work', at: at('11-04', 11), min: 25 }
      ];
      s.rev = (s.rev || 0) + 1;
      localStorage.setItem(store, JSON.stringify(s));
    }, STORE);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-review').click();
    assert.equal(await page.locator('#review-panel').isVisible(), true);
    assert.equal(await page.locator('#rs-count').textContent(), '4', 'This week (Mon–Sun) has four');
    assert.equal(await page.locator('#rs-focus').textContent(), '1.7', '100 minutes');
    assert.equal(await page.locator('#rs-days').textContent(), '3');
    assert.equal(await page.locator('.review-chart .bar').count(), 7);
    assert.equal(await page.locator('.rt-row').count(), 4);
    assert.equal(await page.locator('.rt-title', { hasText: '写选题 <b>' }).count(), 1, 'Titles are escaped');
    await page.locator('[data-review-group=work]').click();
    assert.equal(await page.locator('#rs-count').textContent(), '3');
    await page.locator('[data-review-group=all]').click();
    await page.locator('[data-shift="-1"]').click();
    assert.equal(await page.locator('#rs-count').textContent(), '1', 'Last week');
    assert.equal(await page.locator('#review-next').isDisabled(), false);
    await page.locator('[data-period=month]').click();
    assert.equal(await page.locator('#review-range').textContent(), '2026年11月');
    assert.equal(await page.locator('#rs-count').textContent(), '5');
    assert.equal(await page.locator('.review-chart .bar').count(), 30);
    assert.equal(await page.locator('#review-next').isDisabled(), true, 'No future months');
    await page.locator('[data-period=week]').click();
    await page.screenshot({ path: path.join(review, 'v2-review-390.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Review fits the phone');

    await page.locator('#review-export').scrollIntoViewIfNeeded();
    await page.locator('#review-export').click();
    await page.locator('#poster-dialog[open]').waitFor();
    const size = await page.locator('#poster-image').evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; });
    assert.equal(size[0], 1080, 'Poster is 1080px wide');
    assert(size[1] > 1600, 'Poster has the table');
    const shot = await page.locator('#poster-image').getAttribute('src');
    require('node:fs').writeFileSync(path.join(review, 'v2-poster.png'), Buffer.from(shot.split(',')[1], 'base64'));
    await page.locator('#close-poster').click();

    // Backups carry the log.
    const backup = await page.evaluate(() => window.suisui && JSON.parse(localStorage.getItem('suisui-locktodo-v1')).log.length);
    assert.equal(backup, 6);
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: empty first run, durations (presets, custom, edit), start/pause/stop, time-up with 标记完成 and focus minutes, lock-card timer, completion log + undo, weekly/monthly review with group filter and navigation, 1080px poster.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
