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

  /* 1.5: quick add understands dates / repeats / durations / #groups; long-press menu; focus bar everywhere and on the lock view. */
  {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-11-04T09:00:00') }); // Wednesday
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#fab-add').click();
    const add = async text => { await page.locator('#task-input').fill(text); await page.locator('#add-form button[type=submit]').click(); };
    await page.locator('#task-input').fill('明天读书30分钟');
    assert.match(await page.locator('#parse-hint').textContent(), /明天 · 30分钟/);
    assert.equal(await page.locator('[data-add-when=tomorrow]').getAttribute('aria-pressed'), 'true', 'Chips follow what was typed');
    assert.equal(await page.locator('[data-add-duration="30"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#add-form button[type=submit]').click();
    await add('每周五 周会复盘 1小时 #工作');
    await add('下周一交房租');
    await add('跑步半小时');
    await page.locator('#task-input').fill('周五见面');
    await page.locator('#parse-off').click(); // keep the words as typed
    await page.locator('#add-form button[type=submit]').click();
    await page.locator('#add-backdrop').click();
    await page.locator('#add-form').waitFor({ state: 'hidden' });
    const tasks = await page.evaluate(store => JSON.parse(localStorage.getItem(store)).tasks, STORE);
    const by = t => tasks.find(x => x.title === t);
    assert.deepEqual([by('读书').date, by('读书').duration], ['2026-11-05', 30]);
    assert.deepEqual([by('周会复盘').repeat, by('周会复盘').repeatDay, by('周会复盘').duration, by('周会复盘').group], ['weekly', 5, 60, 'work']);
    assert.equal(by('交房租').date, '2026-11-09', '下周一 = next Monday');
    assert.equal(by('跑步').duration, 30);
    assert(by('周五见面') && !by('周五见面').date, '保留原文 keeps the text and sets nothing');

    // Long press → quick actions (move to tomorrow, start timer).
    const row = page.locator('#task-list .task-row', { hasText: '跑步' });
    const box = await row.locator('.task-body').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 20);
    await row.locator('.task-body').dispatchEvent('contextmenu');
    assert.equal(await page.locator('#quick-menu').evaluate(d => d.open), true);
    assert.equal(await page.locator('[data-quick=timer]').count(), 1);
    await page.locator('[data-quick=timer]').click();
    // Focus bar shows the running timer in every view.
    assert.equal(await page.locator('#focus-bar').isVisible(), true);
    assert.equal(await page.locator('#focus-title').textContent(), '跑步');
    await page.clock.runFor(3000);
    assert.match(await page.locator('#focus-bar [data-timer-text]').textContent(), /^29:5\d$/);
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#focus-bar').isVisible(), true, 'Visible on other pages too');
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.locator('#focus-toggle').click();
    assert.equal(await page.locator('#focus-state').textContent(), '已暂停');
    await page.screenshot({ path: path.join(review, 'v2-focus-bar-390.png') });
    await page.locator('#focus-done').click();
    await page.clock.runFor(1500);
    assert.equal(await page.locator('#focus-bar').isVisible(), false, 'Done from the bar');
    assert.equal(await page.evaluate(store => JSON.parse(localStorage.getItem(store)).log.at(-1).title, STORE), '跑步');
    // Move to tomorrow from the menu.
    await page.locator('#task-list .task-row', { hasText: '周五见面' }).locator('.task-body').dispatchEvent('contextmenu');
    await page.locator('[data-quick=tomorrow]').click();
    assert.equal(await page.locator('#later-list .task-row', { hasText: '周五见面' }).count(), 1);
    await context.close();

    // Lock view: the running timer sits under the clock.
    const lock = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await lock.addInitScript(() => {
      const store = { raw: '' };
      window.SuiSuiAndroid = { load: () => store.raw, save: j => { store.raw = j; return true; }, isLockMode: () => true, notificationsAllowed: () => true,
        permissions: () => JSON.stringify({ notifications: true, overlay: true }), unlock() {}, version: () => 'test' };
    });
    const lp = await lock.newPage(); watch(lp);
    await lp.goto(url + '/?mode=lock', { waitUntil: 'networkidle' });
    await lp.evaluate(() => { const s = window.SuiSuiAndroid; });
    await lp.evaluate(store => {
      const s = JSON.parse(localStorage.getItem(store));
      s.tasks[1].duration = 25; s.timer = { id: s.tasks[1].id, total: 1500000, endsAt: Date.now() + 1200000, left: 0 }; s.rev += 1;
      localStorage.setItem(store, JSON.stringify(s));
    }, STORE);
    await lp.reload({ waitUntil: 'networkidle' });
    assert.equal(await lp.locator('#focus-bar').isVisible(), true, 'Timer visible on the lock view');
    const bar = await lp.locator('#focus-bar').boundingBox(), card = await lp.locator('#activity').boundingBox();
    assert(bar.y + bar.height <= card.y, 'Focus bar sits above the to-do card');
    await lp.screenshot({ path: path.join(review, 'v2-lock-focus-390.png') });
    await lock.close();
  }

  /* 1.6: reminders (parse + in-app alert), notes and subtasks, drag to reorder, search. */
  {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); watch(page);
    await page.clock.install({ time: new Date('2026-11-04T14:58:00') });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#fab-add').click();
    for (const t of ['下午3点开会', '明早9点半 晨跑', '买菜', '读书']) { await page.locator('#task-input').fill(t); await page.locator('#add-form button[type=submit]').click(); }
    await page.locator('#add-backdrop').click(); await page.locator('#add-form').waitFor({ state: 'hidden' });
    const saved = () => page.evaluate(store => JSON.parse(localStorage.getItem(store)).tasks, STORE);
    let tasks = await saved();
    assert.equal(tasks.find(t => t.title === '开会').time, '15:00');
    assert.deepEqual([tasks.find(t => t.title === '晨跑').time, tasks.find(t => t.title === '晨跑').date], ['09:30', '2026-11-05']);
    assert.match(await page.locator('.task-row', { hasText: '开会' }).locator('.meta-time').textContent(), /15:00/);
    // In-app reminder at 15:00 with a 完成 button.
    for (let i = 0; i < 40 && !/开会/.test(await page.locator('#toast-message').textContent()); i++) await page.clock.runFor(5000);
    assert.match(await page.locator('#toast-message').textContent(), /15:00 开会/);
    await page.locator('#undo-button').click();
    await page.clock.runFor(1500);
    tasks = await saved();
    assert.equal(tasks.find(t => t.title === '开会').done, true, 'Completed from the reminder');
    // Notes and subtasks save instantly.
    await page.locator('.task-row', { hasText: '读书' }).locator('.task-body').click();
    await page.locator('#edit-note').fill('第三章');
    await page.locator('#subtask-input').fill('读完 3.1'); await page.locator('#subtask-input').press('Enter');
    await page.locator('#subtask-input').fill('写摘要'); await page.locator('#subtask-input').press('Enter');
    await page.locator('[data-sub-toggle]').first().click();
    assert.equal(await page.locator('#edit-sheet').evaluate(d => d.open), true, 'Enter in the subtask field does not submit');
    await page.locator('[data-action=cancel-edit]').click();
    await page.clock.runFor(1000);
    tasks = await saved();
    const book = tasks.find(t => t.title === '读书');
    assert.equal(book.note, '第三章');
    assert.deepEqual(book.subtasks.map(s => [s.title, s.done]), [['读完 3.1', true], ['写摘要', false]]);
    assert.match(await page.locator('.task-row', { hasText: '读书' }).locator('.task-meta').textContent(), /1\/2/);
    // Drag: long press 读书 and move it above 买菜.
    const before = await page.locator('#task-list .task-title').allTextContents();
    assert.deepEqual(before, ['买菜', '读书']);
    const r = await page.locator('#task-list .task-row').nth(1).boundingBox();
    await page.mouse.move(r.x + 160, r.y + r.height / 2); await page.mouse.down();
    await page.clock.runFor(600);
    await page.mouse.move(r.x + 160, r.y - r.height * .9, { steps: 8 }); await page.mouse.up();
    assert.deepEqual(await page.locator('#task-list .task-title').allTextContents(), ['读书', '买菜'], 'Drag reorders');
    // Long press without moving still opens the menu.
    const r2 = await page.locator('#task-list .task-row').nth(1).boundingBox();
    await page.mouse.move(r2.x + 160, r2.y + r2.height / 2); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
    assert.equal(await page.locator('#quick-menu').evaluate(d => d.open), true);
    await page.keyboard.press('Escape');
    // Search finds notes, subtasks and finished items.
    await page.locator('#open-search').click();
    await page.locator('#search-input').fill('摘要');
    assert.equal(await page.locator('#search-results .task-row', { hasText: '读书' }).count(), 1, 'Matches a subtask');
    await page.locator('#search-input').fill('开会');
    assert.equal(await page.locator('#search-results .done-row', { hasText: '开会' }).count(), 1, 'Finds finished items');
    await page.locator('#search-input').fill('没有这个');
    assert.match(await page.locator('#search-results').textContent(), /没有找到/);
    await page.locator('#search-cancel').click();
    assert.equal(await page.locator('#task-list').isVisible(), true);
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
  console.log('PASS: empty first run, durations (presets, custom, edit), start/pause/stop, time-up with 标记完成 and focus minutes, lock-card timer, completion log + undo, weekly/monthly review with group filter and navigation, 1080px poster, reminders, notes/subtasks, drag sort, search.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
