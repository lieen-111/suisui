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
module.exports = {
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
