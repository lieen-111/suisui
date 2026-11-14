// 1.18: yearly review next to week/month, 到点响铃 (off = silent notification), no theme sounds,
// calmer settings home (short preview strip + one grouped list), slim Pro bar, quick finishing moment.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const day = '2026-11-14';
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work', repeat: 'none' };
  const tasks = [{ ...base, id: 'a', title: '口播剪辑收尾' }, { ...base, id: 'b', title: '动效素材' }, { ...base, id: 'c', title: '健身', group: 'life' }];
  const at = s => Date.parse(`${s}T10:00:00`);
  const log = [['a1', '2026-01-08'], ['a2', '2026-03-02'], ['a3', '2026-03-20'], ['a4', '2026-11-02'], ['a5', '2025-06-01']]
    .map(([id, d]) => ({ id, title: `做完 ${id}`, group: 'work', at: at(d), min: 0 }));
  const open = async (settings = {}, opts = {}) => {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...opts });
    const rec = JSON.stringify({ schema: 2, rev: 1, day, tasks, archive: [], log, settings: { tipsSeen: true, ...settings } });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, rec]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(`${day}T10:00:00`) });
    await page.goto(url, { waitUntil: 'networkidle' });
    return { context, page };
  };
  const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);

  /* Yearly review: 12 monthly bars, this year's count, poster says YEARLY */
  {
    const { context, page } = await open();
    await page.locator('#open-review').click();
    await page.locator('[data-period=year]').click();
    assert.equal(await page.locator('[data-period=year]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#review-chart .bar').count(), 12, 'A year has twelve monthly bars');
    assert.equal(await page.locator('#rs-count').textContent(), '4', 'Only this year’s four completions count');
    assert.equal(await page.locator('#review-chart .bar').nth(2).locator('.bar-val').textContent(), '2', 'March has two');
    assert.match(await page.locator('#review-range').textContent(), /2026/);
    assert.match(await page.locator('.review-card h3').first().textContent(), /每月完成/);
    await page.screenshot({ path: path.join(review, 'v118-year-390.png') });
    await page.locator('[data-shift="-1"]').click();
    assert.equal(await page.locator('#rs-count').textContent(), '1', 'Last year has one');
    await page.locator('[data-period=week]').click();
    assert.equal(await page.locator('#review-chart .bar').count(), 7, 'Week still works');
    await context.close();
  }

  /* The highlighted stat card stays readable in every base style (night used a light accent with white text) */
  for (const look of ['glass', 'paper', 'night']) {
    const { context, page } = await open({ uiStyle: look });
    await page.locator('#open-review').click();
    const ratio = await page.locator('.review-stats>div:first-child').evaluate(el => {
      const rgb = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const cs = getComputedStyle(el), bgc = cs.backgroundColor, img = cs.backgroundImage;
      const bg = img && img !== 'none' ? rgb(img.match(/rgba?\([^)]*\)/)[0]) : rgb(bgc);
      const fg = rgb(getComputedStyle(el.querySelector('b')).color);
      const [a, b] = [lum(bg), lum(fg)].sort((x, y) => y - x); return (a + .05) / (b + .05);
    });
    assert.ok(ratio >= 3, `${look}: the highlighted stat card is readable (${ratio.toFixed(2)})`);
    await context.close();
  }

  /* 到点响铃: off by default; on turns into a ringing, persistent notification on the web */
  {
    const { context, page } = await open();
    await page.evaluate(() => {
      window.__notes = [];
      window.Notification = class { constructor(title, o) { window.__notes.push({ title, ...o }); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
    });
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=lock]').click();
    assert.equal(await page.locator('#ring-toggle').isChecked(), false, 'Default: no ringing');
    assert.match(await page.locator('#ring-note').textContent(), /静音通知/);
    assert.equal((await saved(page)).remindRing, false);
    await page.locator('label[for=ring-toggle]').click();
    assert.equal((await saved(page)).remindRing, true, 'The choice is saved');
    assert.match(await page.locator('#toast-message').textContent(), /提示音|铃声/);
    await page.locator('label[for=ring-toggle]').click();
    assert.equal((await saved(page)).remindRing, false);
    assert.match(await page.locator('#toast-message').textContent(), /静音通知/);
    await context.close();
  }

  /* Android bridge sees the setting in the stored JSON (native picks the ringing channel from it) */
  {
    const { context, page } = await open({ remindRing: true });
    assert.equal((await saved(page)).remindRing, true, 'remindRing survives a reload');
    await context.close();
  }

  /* No sound anywhere: theme sounds are gone and finishing makes no audio */
  {
    const { context, page } = await open({ proTheme: 'night' }, { proFree: true });
    await page.evaluate(() => {
      window.__audio = 0;
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) { const o = A.prototype.createOscillator, b = A.prototype.createBufferSource; A.prototype.createOscillator = function () { window.__audio++; return o.call(this); }; A.prototype.createBufferSource = function () { window.__audio++; return b.call(this); }; }
      const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__audio++; return play.call(this); };
    });
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.clock.runFor(150);
    assert.ok(await page.locator('.fx-check').count() >= 1, 'The check springs in');
    assert.ok(await page.locator('.fx-spark').count() >= 4, 'A few fine sparks');
    await page.clock.runFor(2500);
    assert.equal(await page.locator('.fx-check, .fx-ring, .fx-glint, .fx-spark').count(), 0, 'The finishing moment cleans up after itself');
    assert.equal(await page.evaluate(() => window.__audio), 0, 'Finishing plays no sound');
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#pro-sound').count(), 0, 'No theme sound switch');
    assert.doesNotMatch(await page.locator('#settings-panel').textContent(), /音效/);
    await context.close();
  }

  /* Settings home: short preview strip, one list of rows, slim Pro bar, nothing overflows */
  for (const look of ['glass', 'paper', 'night']) {
    const { context, page } = await open({ uiStyle: look });
    await page.locator('.nav-button[data-view=settings]').click();
    const hero = await page.locator('#home-hero').boundingBox();
    assert.ok(hero.height <= 140, `${look}: preview is a short strip (${hero.height}px)`);
    const rows = page.locator('.settings-tiles > button');
    assert.equal(await rows.count(), 4);
    const boxes = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ x: r.x, w: r.width, h: r.height })));
    assert.ok(boxes.every(b => b.h >= 48 && b.h <= 64), `${look}: rows are comfortable list rows`);
    assert.ok(new Set(boxes.map(b => Math.round(b.x))).size === 1, `${look}: rows are one column, not tiles`);
    const pro = await page.locator('.pro-banner').boundingBox();
    if (pro) assert.ok(pro.height <= 60, `${look}: the Pro bar is slim (${pro.height}px)`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${look}: no sideways scroll`);
    await page.screenshot({ path: path.join(review, `v118-settings-${look}-390.png`) });
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: yearly review (12 months, previous year, back to week), 到点响铃 off by default and saved, no sound when finishing, quick finishing moment cleans up, calm settings home with slim Pro bar in glass/paper/night.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
