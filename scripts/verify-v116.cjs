// 1.16: backup state + reminder, add sheet defaults light, quiet timer pill, 外观 tabs, group rows that open,
// rows glide after completing (FLIP), sections open with height, every used icon has its own animation.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const day = '2026-11-05';
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work', repeat: 'none' };
  const tasks = [{ ...base, id: 'a', title: '口播剪辑收尾' }, { ...base, id: 'b', title: '动效素材', duration: 30 }, { ...base, id: 'c', title: '健身', group: 'life' },
    { ...base, id: 'd', title: '读书', group: 'life' }, { ...base, id: 'e', title: '交房租', date: '2026-11-07' }];
  const open = async (settings = {}, opts = {}) => {
    const context = await browser.newContext({ demo: false, lookTabs: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...opts });
    const rec = JSON.stringify({ schema: 2, rev: 1, day, tasks, archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0', icon: 'briefcase' }, { id: 'life', name: '生活', color: '#d2566f', icon: 'leaf' }], settings: { palette2: true, ...settings } });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, rec]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(`${day}T10:00:00`) });
    await page.goto(url, { waitUntil: 'networkidle' });
    return { context, page };
  };
  const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);

  /* Backup: state on the data page, reminder after two weeks without one (at most weekly) */
  {
    const old = Date.parse(`${day}T10:00:00`) - 20 * 864e5;
    const { context, page } = await open({ firstUse: old });
    await page.clock.runFor(2000);
    assert.match(await page.locator('#toast-message').textContent(), /建议备份/, 'Never backed up for 20 days → reminder');
    assert.equal(await page.locator('#undo-button').textContent(), '备份');
    assert.ok((await saved(page)).backupNudged > 0, 'The reminder is remembered (no nagging)');
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=data]').click();
    assert.equal(await page.locator('#backup-state').textContent(), '还没有备份过');
    assert.equal(await page.locator('#backup-state').evaluate(e => e.classList.contains('is-old')), true);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-button').click()]);
    assert.ok(download.suggestedFilename().startsWith('suisui-backup-'));
    assert.equal(await page.locator('#backup-state').textContent(), '今天已备份');
    assert.ok((await saved(page)).lastBackup > 0);
    await page.screenshot({ path: path.join(review, 'v116-data-390.png') });
    await context.close();
  }
  {
    const { context, page } = await open({ firstUse: Date.parse(`${day}T08:00:00`) - 3 * 864e5 });
    await page.clock.runFor(2000);
    assert.equal(await page.locator('#toast').isVisible(), false, 'No reminder in the first two weeks');
    await context.close();
  }

  /* Add sheet: untouched choices light, changed choices dark; idle timer is an outline */
  {
    const { context, page } = await open({ firstUse: Date.now() });
    const bg = loc => loc.evaluate(e => getComputedStyle(e).backgroundColor);
    const pill = page.locator('.task-row[data-task-id=b] .timer-pill');
    assert.equal(await bg(pill), 'rgba(0, 0, 0, 0)', 'Idle timer pill has no fill');
    await page.locator('#fab-add').click();
    assert.equal(await page.locator('#add-form .chip.active.is-default').count(), 5, 'All five rows start on their light default');
    await page.locator('[data-add-repeat=daily]').click();
    assert.equal(await page.locator('[data-add-repeat=daily]').evaluate(e => e.classList.contains('is-default')), false);
    assert.notEqual(await bg(page.locator('[data-add-repeat=daily]')), await bg(page.locator('[data-add-time=""]')), 'The changed choice looks different from the defaults');
    await page.screenshot({ path: path.join(review, 'v116-add-390.png') });
    await context.close();
  }

  /* 外观 tabs, one selection style; group rows open into an editor */
  {
    const { context, page } = await open({ firstUse: Date.now() });
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('[data-ui-style=glass]').isVisible(), true);
    assert.equal(await page.locator('[data-theme-preset=mist]').isVisible(), false, 'Lock-card controls are on the other tab');
    assert.equal(await page.locator('#motion-toggle').isVisible(), true, '动效 lives with the App settings');
    await page.locator('[data-look-tab=card]').click();
    assert.equal(await page.locator('[data-theme-preset=mist]').isVisible(), true);
    assert.equal(await page.locator('[data-ui-style=glass]').isVisible(), false);
    assert.equal(await page.locator('[data-look-tab=card]').getAttribute('aria-selected'), 'true');
    await page.screenshot({ path: path.join(review, 'v116-look-card-390.png') });
    await page.locator('#settings-back').click();
    await page.locator('[data-settings-page=list]').click();
    assert.equal(await page.locator('.group-name').first().isVisible(), false, 'Group rows start closed');
    assert.match(await page.locator('[data-group-toggle=work]').textContent(), /工作\s*3 件/);
    await page.locator('[data-group-toggle=work]').click();
    assert.equal(await page.locator('#group-name-work').isVisible(), true);
    assert.equal(await page.locator('[data-group-delete=work]').isVisible(), true);
    await page.locator('[data-group-toggle=life]').click();
    assert.equal(await page.locator('#group-name-work').isVisible(), false, 'One group open at a time');
    await page.screenshot({ path: path.join(review, 'v116-groups-390.png') });
    await context.close();
  }

  /* Motion: rows glide up after a completion, 以后 opens with height, every icon the app uses has an animation */
  {
    const { context, page } = await open({ firstUse: Date.now(), tipsSeen: true });
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.clock.runFor(1500);
    const glides = await page.evaluate(() => [...document.querySelectorAll('#task-list .task-row')].flatMap(r => r.getAnimations()).length);
    assert.ok(glides > 0, 'Remaining rows glide into place');
    await page.locator('#later-section summary').click();
    assert.equal(await page.locator('#later-section').evaluate(d => d.open), true);
    await page.clock.runFor(500);
    await page.locator('#later-section summary').click();
    await page.clock.runFor(600);
    await page.waitForFunction(() => !document.getElementById('later-section').open);
    const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8') + fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
    const used = new Set([...html.matchAll(/data-lucide="([a-z0-9-]+)"/g), ...html.matchAll(/icon\('([a-z0-9-]+)'\)/g)].map(m => m[1]));
    const known = await page.evaluate(() => Object.keys(window.SuiSuiMotion.ICONS));
    assert.deepEqual([...used].filter(n => !known.includes(n)), [], 'Every icon in the app has its own animation');
    await context.close();
  }
  {
    const { context, page } = await open({ firstUse: Date.now(), tipsSeen: true, motion: false });
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.clock.runFor(1500);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#task-list .task-row')].flatMap(r => r.getAnimations()).length), 0, 'No glide with 动效 off');
    await context.close();
  }

  /* 1.16.1: the running timer on the Android lock screen stays readable on light and dark cards */
  for (const cardText of ['light', 'dark']) {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const now = Date.parse(`${day}T10:00:00`);
    const rec = JSON.stringify({ schema: 2, rev: 1, day, tasks, archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0', icon: 'briefcase' }, { id: 'life', name: '生活', color: '#d2566f', icon: 'leaf' }],
      timer: { id: 'b', total: 30 * 60000, endsAt: now + 20 * 60000, left: 0 }, settings: { palette2: true, firstUse: now, tipsSeen: true, cardText, cardColor: '#ffffff' } });
    await context.addInitScript(raw => { window.SuiSuiAndroid = { load: () => raw, save: j => { raw = j; return true; }, isLockMode: () => true, notificationsAllowed: () => true, permissions: () => '{"notifications":true,"overlay":true}', unlock: () => {}, version: () => 't' }; }, rec);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(now) });
    await page.goto(url + '/?mode=lock', { waitUntil: 'networkidle' });
    const pill = page.locator('.lock-timer.is-on');
    assert.equal(await pill.count(), 1, 'The running timer shows on the lock card');
    const ratio = await pill.evaluate(el => {
      const rgb = c => { const x = document.createElement('i'); x.style.color = c; document.body.append(x); const v = getComputedStyle(x).color.match(/[\d.]+/g).map(Number); x.remove(); return v; };
      const lum = ([r, g, b]) => [r, g, b].reduce((s, v, i) => { v /= 255; return s + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i]; }, 0);
      const cs = getComputedStyle(el), bg = rgb(cs.backgroundColor), fg = rgb(cs.color);
      if (bg.length > 3 && bg[3] < .9) return 0; // a see-through pill is what made it unreadable
      const a = lum(bg), b = lum(fg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= 7, `Running timer text is readable on a ${cardText}-text card (contrast ${ratio.toFixed(1)})`);
    if (cardText === 'light') await page.screenshot({ path: path.join(review, 'v1161-lock-timer-390.png') });
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: 1.16 backup state + two-week reminder (once a week at most), add sheet defaults light / changes dark, outlined idle timer, 外观 App/锁屏 tabs, group rows open one at a time, rows glide after completion, sections animate, every icon animated, nothing moves with 动效 off, running timer readable on the lock card.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
