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

  /* Time on a task: pick a time (shown on the task, silent by default); 响铃提醒 is a separate choice per task */
  {
    const { context, page } = await open();
    const tasksNow = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)).tasks, STORE);
    await page.locator('#fab-add').click();
    assert.equal(await page.locator('#add-ring-row').isHidden(), true, 'No ring choice until a time is picked');
    await page.locator('#task-input').fill('交周报');
    await page.locator('[data-add-panel=time]').click();
    await page.locator('[data-add-time="18:00"]').click();
    assert.equal(await page.locator('#add-ring-row').isVisible(), true, 'Picking a time shows 只显示时间 / 响铃提醒');
    assert.equal(await page.locator('[data-add-ring="0"]').getAttribute('aria-pressed'), 'true', 'Default: only show the time');
    await page.locator('#add-form').evaluate(f => f.requestSubmit());
    let t = (await tasksNow()).find(x => x.title === '交周报');
    assert.equal(t.time, '18:00'); assert.equal(t.ring, false, 'Saved without ringing');
    const row = page.locator('.task-row', { hasText: '交周报' });
    assert.match(await row.locator('.meta-time').textContent(), /18:00/, 'The time shows on the task');
    assert.equal(await row.locator('.meta-time.is-ring').count(), 0);

    if (await page.locator('#fab-add').isVisible()) await page.locator('#fab-add').click(); // the sheet may stay open for the next one
    await page.locator('#task-input').fill('吃药');
    await page.locator('[data-add-panel=time]').click();
    await page.locator('[data-add-time="21:00"]').click();
    await page.locator('[data-add-ring="1"]').click();
    await page.locator('#add-form').evaluate(f => f.requestSubmit());
    t = (await tasksNow()).find(x => x.title === '吃药');
    assert.equal(t.ring, true, '响铃提醒 is saved on that task');
    assert.equal(await page.locator('#add-ring-row').isHidden(), true, 'The next new task starts without a time or ring');
    await page.evaluate(() => window.suisuiBack());
    assert.equal(await page.locator('.task-row', { hasText: '吃药' }).locator('.meta-time.is-ring').count(), 1, 'Ringing tasks show a bell');

    // Editing: turn ringing off again, then clear the time
    await page.locator('.task-row', { hasText: '吃药' }).locator('.task-title').click();
    await page.locator('[data-edit-panel=time]').click();
    assert.match(await page.locator('#fv-time').textContent(), /21:00 · 响铃/);
    await page.locator('[data-edit-ring="0"]').click();
    await page.locator('#edit-form').evaluate(f => f.requestSubmit());
    assert.equal((await tasksNow()).find(x => x.title === '吃药').ring, false, 'Edit turns ringing off');

    // At the time: only ringing tasks remind
    await page.evaluate(() => { window.__notes = []; });
    await page.locator('.task-row', { hasText: '交周报' }).locator('.task-title').click();
    await page.locator('[data-edit-panel=time]').click();
    await page.locator('[data-edit-ring="1"]').click();
    await page.locator('#edit-form').evaluate(f => f.requestSubmit());
    await page.clock.fastForward('08:01:00');
    await page.clock.runFor(20000);
    assert.match(await page.locator('#toast-message').textContent(), /18:00 交周报/, 'A ringing task reminds at its time');
    await page.clock.fastForward('03:00:00');
    await page.clock.runFor(20000);
    assert.doesNotMatch(await page.locator('#toast-message').textContent(), /吃药/, 'A time-only task stays quiet');
    assert.equal(await page.locator('#ring-toggle').count(), 0, 'No global ring switch any more');
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

  /* Test build: the checkout is one quiet row that scrolls with the page, not a sticky block; light Pro wallpapers get a light veil */
  {
    const { context, page } = await open({ proTheme: 'room' }, { proFree: true });
    await page.locator('.nav-button[data-view=settings]').click();
    const veil = await page.locator('#home-hero').evaluate(e => getComputedStyle(e, '::after').backgroundImage);
    assert.match(veil, /251, 250, 246/, 'Room: the clock sits on a light veil (dark ink stays readable)');
    await page.evaluate(() => window.SuiSuiPro.open());
    assert.equal(await page.locator('.pro-free-bar').count(), 0, '1.21: the test build shows the same official footer as a release');
    assert.doesNotMatch(await page.locator('.pro-buy').textContent(), /测试版|模拟|示例|本地预览/, 'No placeholder or test wording on the purchase footer');
    await page.locator('#pro-buy').click();
    assert.equal(await page.locator('.pro-pay-card').isVisible(), true, 'The demo checkout still opens');
    await context.close();
  }

  /* Every Pro theme: the piece lands with a ring in the theme's ink, the check uses the theme colour, the day's end hides the undo toast */
  for (const th of ['dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff']) {
    const { context, page } = await open({ proTheme: th }, { proFree: true });
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.clock.runFor(120);
    const fill = await page.locator('.fx-check').first().evaluate(e => getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor);
    assert.doesNotMatch(fill, /rgb\(29, 29, 31\)$/, `${th}: the check is drawn in the theme's colour`);
    let landed = 0;
    for (let k = 0; k < 20 && !landed; k++) { await page.clock.runFor(60); landed = await page.locator('.pro-land').count(); }
    assert.ok(landed, `${th}: the piece lands in the header with a ring`);
    await page.clock.runFor(1500);
    await page.locator('.task-row[data-task-id=b] .check-task').click(); await page.clock.runFor(1500);
    await page.locator('.task-row[data-task-id=c] .check-task').click(); await page.clock.runFor(2000);
    assert.equal(await page.locator('#pro-celebrate').isVisible(), true, `${th}: end-of-day moment`);
    assert.equal(await page.locator('#toast').evaluate(e => getComputedStyle(e).opacity), '0', `${th}: the undo toast steps aside`);
    await context.close();
  }

  /* Settings system: the corner titles use the plain face at fixed weights in every theme; choosing a tile never moves or resizes it */
  for (const th of ['', 'night', 'day', 'fluff']) {
    const { context, page } = await open(th ? { proTheme: th } : {}, { proFree: true, lookTabs: true });
    await page.locator('.nav-button[data-view=settings]').click();
    const top = await page.evaluate(() => { const h = getComputedStyle(document.querySelector('#settings-title')), d = getComputedStyle(document.querySelector('.settings-top .nav-button[data-view=tasks]')); return [h.fontWeight, h.fontFamily.split(',')[0], d.fontWeight]; });
    assert.equal(top[0], '700', `${th || 'glass'}: 设置 is bold, not a thin display face`);
    assert.match(top[1], /Geist/);
    assert.equal(top[2], '600');
    await page.locator('[data-settings-page=look]').first().click(); await page.waitForTimeout(500);
    const tiles = page.locator('.font-chip');
    await tiles.nth(1).scrollIntoViewIfNeeded();
    const before = await tiles.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
    await tiles.nth(1).click(); await page.waitForTimeout(80);
    const during = await tiles.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
    assert.deepEqual(during, before, `${th || 'glass'}: choosing a font moves nothing`);
    await page.waitForTimeout(300);
    const badge = await tiles.nth(1).evaluate(e => getComputedStyle(e, '::before').opacity);
    assert.equal(badge, '1', 'The chosen tile shows its check');
    const outline = await tiles.nth(1).evaluate(e => getComputedStyle(e).outlineStyle + getComputedStyle(e).borderStyle);
    assert.match(outline, /none/, 'No border pops out around the chosen tile');
    await tiles.nth(0).click();
    await context.close();
  }

  /* Choosing a finishing effect plays it on a sample row first; every settings row says what is inside */
  {
    const { context, page } = await open({ proTheme: 'night' }, { proFree: true, lookTabs: true });
    await page.locator('.nav-button[data-view=settings]').click();
    const subs = await page.locator('.settings-home .row-sub').allTextContents();
    assert.equal(subs.length, 6, 'Each settings row has a one-line description');
    assert.ok(subs.every(t => t.trim().length > 3));
    await page.locator('[data-settings-page=look]').first().click(); await page.waitForTimeout(400);
    await page.locator('#fx-stage').scrollIntoViewIfNeeded();
    await page.locator('[data-pro-effect-pick=ink]').click();
    await page.waitForTimeout(60);
    assert.equal(await page.locator('#fx-sample').evaluate(e => e.classList.contains('is-done')), true, 'The sample row is ticked');
    assert.ok(await page.locator('body > canvas').count() >= 1, 'The effect plays on the sample row');
    assert.equal(await page.evaluate(() => window.suisui.pro.state.settings.proEffect), 'ink');
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('#fx-sample-text').evaluate(e => e.style.visibility), '', 'The sample comes back for the next try');
    await page.locator('#fx-replay').click(); await page.waitForTimeout(60);
    assert.equal(await page.locator('#fx-sample').evaluate(e => e.classList.contains('is-done')), true, '再看一次 plays it again');
    assert.ok(await page.locator('#settings-panel .section-hint').count() >= 2, 'Look sections explain themselves');
    assert.match(await page.locator('#theme-about').textContent(), /\S{6,}/, 'The chosen theme says what it is');
    assert.equal(await page.locator('#theme-rail .theme-card').count(), 11, '1.19: one gallery holds the three free looks, 随光 and the seven Pro themes');
    assert.equal(await page.locator('#theme-rail img').evaluateAll(async imgs => { await Promise.all(imgs.map(i => i.decode().catch(() => {}))); return imgs.filter(i => !i.naturalWidth).length; }), 0, 'Every theme is pictured');
    await context.close();
  }

  /* Pro intro: tapping a theme opens a showcase of the real app in that theme (home, lock, finishing, the day's picture),
     which never touches the saved list; theme names, icon set and the corner buttons */
  {
    const { context, page } = await open({}, { proFree: true });
    const before = await page.evaluate(k => localStorage.getItem(k), STORE);
    await page.evaluate(() => window.SuiSuiPro.open());
    const names = await page.locator('.pro-tcard:not(.is-auto) h3').allTextContents();
    assert.deepEqual(names, ['琉璃', '素笺', '星河', '洇色', '套色', '小筑', '绒绒'], 'The seven themes have their new names');
    await page.locator('[data-pro-stage=night]').first().click();
    assert.equal(await page.locator('#pro-stage').isVisible(), true);
    assert.equal(await page.locator('.pro-stage-name b').textContent(), '星河');
    assert.equal(await page.locator('.pro-stage-frame').count(), 4, '主页 · 锁屏 · 完成的那一下 · 全部做完');
    const home = page.frameLocator('.pro-stage-frame[data-frame=home] iframe');
    await home.locator('#task-list .task-row').first().waitFor();
    assert.equal(await home.locator('html').getAttribute('data-pro-skin'), 'night', 'The frame shows the real app in 星河');
    await page.locator('[data-stage-go="1"]').click();
    const lock = page.frameLocator('.pro-stage-frame[data-frame=lock] iframe');
    await lock.locator('body.lock-mode').waitFor({ timeout: 8000 });
    assert.equal(await page.evaluate(k => localStorage.getItem(k), STORE), before, 'The showcase never writes the user\'s list');
    await page.evaluate(() => window.suisuiBack());
    assert.equal(await page.locator('#pro-stage').isVisible(), false, 'Back closes the showcase first');
    await page.evaluate(() => window.suisuiBack());
    // icons and corner buttons
    assert.ok(await page.locator('svg.ph').count() > 5, 'Icons come from the new set');
    await page.locator('.nav-button[data-view=settings]').click();
    await page.locator('[data-settings-page=look]').first().click();
    const corner = await page.evaluate(() => { const b = document.querySelector('.settings-top .settings-back'), d = document.querySelector('.settings-top .nav-button[data-view=tasks]'); const rb = b.getBoundingClientRect(), rd = d.getBoundingClientRect(); return [Math.round(rb.width), Math.round(rb.height), Math.round(rd.width), Math.round(rd.height), getComputedStyle(b.querySelector('span')).display]; });
    assert.deepEqual(corner, [40, 40, 40, 40, 'none'], 'Back and done are 40px circles without words');
    await context.close();
  }

  assert.deepEqual(errors, []);
  {
    // 1.19: every theme draws its home picture for any number of tasks (素笺 had no line for 7 and broke)
    const page = await browser.newPage({ proFree: true }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    const bad = await page.evaluate(() => { const out = []; for (const id of ['dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff']) for (let n = 0; n <= 22; n++) for (const done of [0, Math.floor(n / 2), n]) {
      try { const html = window.SuiSuiSkins.art(id, { left: n - done, done, total: n, d: new Date(2026, 10, 16, 9), lunar: '', cds: [], items: Array.from({ length: n }, (_, i) => ({ id: 'x' + i, title: '事' + i, done: i < done, at: i })) }); if (!html || html.includes('undefined')) out.push(`${id} ${done}/${n}`); } catch (e) { out.push(`${id} ${done}/${n}: ${e.message}`); } }
      return out; });
    assert.deepEqual(bad, [], 'Theme pictures draw for 0–22 tasks'); assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: yearly review (12 months, previous year, back to week), time on a task is silent by default, 响铃提醒 per task (add/edit, only those remind), no sound when finishing, quick finishing moment cleans up, calm settings home with slim Pro bar in glass/paper/night.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
