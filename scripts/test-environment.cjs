const fs = require('node:fs');
const path = require('node:path');
const { chromium: realChromium } = require('playwright');
// The app starts empty for real users. Tests that rely on the six sample tasks get them through
// window.SUISUI_DEMO, added to every context; pass { demo: false } to newContext for a real first run.
const demoScript = () => { window.SUISUI_DEMO = true; };
const chromium = {
  ...realChromium,
  async launch(options) {
    const browser = await realChromium.launch(options);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (opts = {}) => {
      const { demo = true, ...rest } = opts;
      const ctx = await newContext(rest);
      if (demo) await ctx.addInitScript(demoScript);
      return ctx;
    };
    browser.newPage = async (opts = {}) => (await browser.newContext(opts)).newPage();
    return browser;
  }
};
const review = path.resolve(__dirname, '../test-results');
fs.mkdirSync(review, { recursive: true });
// 1.8 sheets show options one row at a time: open the row (add toolbar or edit line) before using its chips.
async function openPanel(page, kind, name) {
  const head = page.locator(`[data-${kind}-panel=${name}]`);
  if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
}
// Phones have no tab bar: the list is reached with 完成 in settings or ‹ 清单 in the review; already there is fine.
async function toTasks(page) {
  const done = page.locator('.nav-button[data-view=tasks]');
  if (await done.isVisible()) return done.click();
  if (await page.locator('#review-back').isVisible()) return page.locator('#review-back').click();
  if (await page.evaluate(() => document.body.dataset.view) !== 'tasks') return done.click();
}
module.exports = {
  toTasks,
  openPanel,
  chromium,
  review,
  url: process.env.LOCKTODO_URL || 'http://localhost:8793',
  launchOptions: {
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : process.platform === 'win32' ? { channel: 'msedge' } : {})
  }
};
