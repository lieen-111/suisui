// Pro (app/pro.js): free users see Pro but keep the free app; try-on, trial, purchase (simulated), Pro themes,
// completion effects, the jar, weekly shard art, countdowns and the all-done celebration.
const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const STORE = 'suisui-locktodo-v1';
let browser;

(async () => {
  browser = await chromium.launch(launchOptions);
  const errors = [];
  const base = { pinned: false, done: false, completedAt: 0, date: '', createdAt: 1, group: 'work', repeat: 'none' };
  const tasks = [{ ...base, id: 'a', title: '口播剪辑收尾' }, { ...base, id: 'b', title: '动效素材' }, { ...base, id: 'c', title: '健身', group: 'life' }];
  const open = async (settings = {}) => {
    const context = await browser.newContext({ demo: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const rec = JSON.stringify({ schema: 2, rev: 1, day: new Date().toISOString().slice(0, 10), tasks, archive: [], log: [], groups: [{ id: 'work', name: '工作', color: '#2f6fd0', icon: 'briefcase' }, { id: 'life', name: '生活', color: '#d2566f', icon: 'leaf' }], settings: { palette2: true, tipsSeen: true, firstUse: Date.now(), ...settings } });
    await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [STORE, rec]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    return { context, page };
  };
  const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).settings, STORE);
  const html = (page, k) => page.evaluate(k => document.documentElement.dataset[k] || '', k);

  /* Free: the free app is unchanged, Pro is visible and locked */
  {
    const { context, page } = await open();
    assert.equal(await html(page, 'proTheme'), '', 'No Pro theme for a free user');
    assert.equal(await page.locator('#pro-jar-button').isVisible(), true, 'The jar is visible on 今天');
    assert.equal(await page.locator('#pro-jar-lock').isVisible(), true, '… with a lock');
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.waitForTimeout(120);
    assert.ok(await page.locator('.shard').count() > 0, 'Free completion keeps the shatter');
    await page.waitForTimeout(900);
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#pro-banner-state').textContent(), '¥18');
    await page.locator('[data-settings-page=look]').click();
    assert.equal(await page.locator('[data-pro-theme-pick]').count(), 4, '外观 shows the four Pro themes');
    assert.equal(await page.locator('[data-pro-theme-pick=ink] .pro-lock-badge').count(), 1, '… locked');
    await page.locator('#settings-back').click();
    await page.locator('#pro-banner').click();
    assert.equal(await page.locator('#pro-sheet').isVisible(), true, 'Pro page opens');
    for (const part of ['effects', 'themes', 'jar']) assert.equal(await page.locator(`[data-pro-section=${part}]`).count(), 1, `Pro page has ${part}`);
    await page.locator('[data-pro-effect=dots]').click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('.pro-fx').count() > 0, 'Effects can be tried before buying');
    await page.screenshot({ path: path.join(review, 'pro-sheet-free-390.png') });
    // Try-on: the theme shows, nothing is saved, it ends
    await page.waitForTimeout(1400);
    await page.locator('[data-pro-theme=ink]').click();
    assert.equal(await html(page, 'proTheme'), 'ink', 'Try-on shows the theme');
    assert.equal(await page.locator('#pro-tryon').isVisible(), true);
    assert.equal((await saved(page)).proTheme || '', '', 'Try-on saves nothing');
    await page.locator('#pro-tryon-end').click();
    assert.equal(await html(page, 'proTheme'), '', 'Try-on ends');
    assert.equal(await html(page, 'style'), 'glass', 'The free style comes back');
    await context.close();
  }

  /* Trial, then purchase: themes, effects, jar, art, countdowns, celebration */
  {
    const { context, page } = await open();
    await page.evaluate(() => window.SuiSuiPro.open());
    await page.locator('#pro-trial').click();
    const p1 = (await saved(page)).pro;
    assert.equal(p1.trialUsed, true); assert.ok(p1.trialEnds > Date.now() + 2.9 * 864e5, '3-day trial');
    assert.equal(await page.locator('#pro-trial').count(), 0, 'Trial is offered once');
    await page.locator('#pro-buy').click();
    assert.equal((await saved(page)).pro.owned, true, 'Purchase is remembered');
    await page.locator('#pro-close').click();
    await page.locator('.nav-button[data-view=settings]').click();
    assert.equal(await page.locator('#pro-banner-state').textContent(), '已解锁');
    await page.locator('[data-settings-page=look]').click();
    await page.locator('[data-pro-theme-pick=noir]').click();
    assert.equal(await html(page, 'proTheme'), 'noir'); assert.equal(await html(page, 'style'), 'night', '暗金 sits on 夜光');
    assert.equal(await html(page, 'proSkin'), 'noir', 'The theme brings its own background and header');
    assert.equal(await page.locator('#pro-head').count(), 1);
    assert.equal((await saved(page)).proTheme, 'noir');
    await page.locator('[data-pro-effect-pick=gold]').click();
    assert.equal((await saved(page)).proEffect, 'gold');
    await page.screenshot({ path: path.join(review, 'pro-look-noir-390.png') });
    // A free style takes the Pro theme off
    await page.locator('[data-ui-style=paper]').click();
    await page.waitForTimeout(50);
    assert.equal(await html(page, 'proTheme'), '', 'Picking 纸墨 takes off 暗金');
    await page.locator('[data-pro-theme-pick=liquid]').click();
    assert.equal(await html(page, 'style'), 'glass', '液态玻璃 sits on 玻璃');
    await page.locator('#settings-back').click();
    await page.locator('.nav-button[data-view=tasks]').click();
    // Countdown
    await page.evaluate(() => window.SuiSuiPro.open('settings'));
    const d = new Date(); d.setDate(d.getDate() + 12);
    await page.locator('#pro-cd-title').fill('期末考试');
    await page.locator('#pro-cd-date').fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    await page.locator('#pro-cd-add button').click();
    await page.locator('#pro-close').click();
    assert.match(await page.locator('#pro-head').textContent(), /12天期末考试/, 'Countdown in the theme header');
    // Pro completion: the chosen effect, no shatter; shards fly to the jar
    await page.locator('.task-row[data-task-id=a] .check-task').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.shard').count(), 0, 'Pro effect replaces the shatter');
    assert.ok(await page.locator('.pro-fx').count() > 0, 'Pro effect runs');
    await page.waitForTimeout(1400);
    await page.locator('.task-row[data-task-id=b] .check-task').click(); await page.waitForTimeout(1300);
    await page.locator('.task-row[data-task-id=c] .check-task').click(); await page.waitForTimeout(1600);
    assert.equal(await page.locator('#pro-celebrate').isVisible(), true, 'All done → celebration');
    await page.screenshot({ path: path.join(review, 'pro-celebrate-390.png') });
    await page.locator('#pro-cel-close').click();
    assert.equal((await saved(page)).proCelebrated, await page.evaluate(() => window.suisui.dayKey()), 'Celebration once a day');
    // Jar page + weekly art
    await page.locator('#pro-jar-button').click();
    assert.equal(await page.locator('#pro-jar-sheet').isVisible(), true);
    assert.match(await page.locator('.pro-jar-big p').textContent(), /3 件今天完成/);
    const art = await page.evaluate(() => { const c = window.SuiSuiPro.drawArt(window.suisui.pro.state.log, new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 864e5)); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] !== d[0] || d[i + 1] !== d[1]) n++; return { w: c.width, h: c.height, varied: n }; });
    assert.equal(art.w, 1080); assert.equal(art.h, 1350); assert.ok(art.varied > 500, 'Weekly art has content');
    await page.screenshot({ path: path.join(review, 'pro-jar-390.png') });
    await page.locator('#pro-jar-close').click();
    // Reset (local preview only)
    await page.evaluate(() => window.SuiSuiPro.reset());
    assert.equal(await html(page, 'proTheme'), '', 'After reset the free look is back');
    assert.equal(await page.locator('#pro-head').count(), 0, 'and the theme header is gone');
    assert.equal(await page.locator('#today-side #pro-jar-button').count(), 1, 'the jar is back next to the ring');
    await context.close();
  }

  /* An ended trial: the saved theme stays saved but is not shown */
  {
    const { context, page } = await open({ pro: { owned: false, trialUsed: true, trialEnds: Date.now() - 1000 }, proTheme: 'dot' });
    assert.equal(await html(page, 'proTheme'), '', 'Ended trial → free look');
    assert.equal(await page.evaluate(() => window.SuiSuiPro.isPro()), false);
    await context.close();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: Pro visible and locked for free users (shatter kept), effects and themes can be tried, try-on saves nothing, 3-day trial once, purchase, Pro themes on their base styles, free style takes them off, countdowns, Pro effects replace the shatter, all-done celebration once a day, jar page, 1080×1350 weekly art, ended trial falls back.');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exit(1); });
