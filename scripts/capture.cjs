const { chromium, review, url, launchOptions } = require('./test-environment.cjs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch(launchOptions);
  for (const [width, height] of [[320,568], [390,844], [430,932]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    console.log(width, await page.locator('.navigation').evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility, display: getComputedStyle(el).display })));
    await page.screenshot({ path: path.resolve(__dirname, `../test-results/mobile-${width}.png`), fullPage: true });
    await page.locator('.nav-button[data-view=tasks]').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.resolve(__dirname, `../test-results/tasks-${width}.png`), fullPage: true });
    await page.locator('.nav-button[data-view=settings]').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.resolve(__dirname, `../test-results/settings-${width}.png`), fullPage: true });
    await context.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
