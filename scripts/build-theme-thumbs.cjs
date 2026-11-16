// Pictures for the 外观 theme gallery: the real home screen of every theme, two tasks already done.
// node scripts/build-theme-thumbs.cjs  (needs the local server; LOCKTODO_URL to point elsewhere)
// Writes app/assets/themes/<id>.png, then scripts/build-theme-thumbs.py turns them into small JPEGs (随光 = three themes in one).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const url = process.env.LOCKTODO_URL || 'http://localhost:8793';
const out = path.join(__dirname, '..', 'app', 'assets', 'themes'); fs.mkdirSync(out, { recursive: true });
const ids = ['ui-glass', 'ui-paper', 'ui-night', 'dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff'];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await c.newPage();
  for (const lang of ['zh', 'en']) for (const id of ids) {
    await p.goto(`${url}/?showcase=${id}&view=home${lang === 'en' ? '&lang=en' : ''}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    for (const n of [2, 1]) { await p.locator('#task-list [data-action=complete]').nth(n).click(); await p.waitForTimeout(900); }
    await p.evaluate(() => document.querySelector('.toast')?.remove());
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `${id}${lang === 'en' ? '-en' : ''}.png`) });
    console.log(id, lang);
  }
  await b.close();
})();
