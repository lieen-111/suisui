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
      // HARVEST_ZH=file: collect every Chinese UI string the tests make visible (used to build app/i18n.js).
      if (process.env.HARVEST_ZH) {
        await ctx.exposeBinding('__zhReport', (_, list) => fs.appendFileSync(process.env.HARVEST_ZH, list.join('\n') + '\n'));
        await ctx.addInitScript(() => {
          const seen = new Set(), out = [], zh = /[\u4e00-\u9fff]/;
          const user = '.task-title,.lock-task-label,.mini-row-label,.done-text,.completed-title,.subtask-title,.review-table,.search-results mark';
          const take = v => { v = (v || '').trim(); if (v && zh.test(v) && !seen.has(v)) { seen.add(v); out.push(v); } };
          const walk = root => {
            const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
            for (let n = w.currentNode; n; n = w.nextNode()) {
              if (n.nodeType === 3) { if (!n.parentElement?.closest(user) && !n.parentElement?.closest('script,style')) take(n.nodeValue); }
              else ['aria-label', 'placeholder', 'title', 'alt'].forEach(k => take(n.getAttribute?.(k)));
            }
          };
          const flush = () => { if (document.body) walk(document.body); if (out.length) window.__zhReport(out.splice(0)).catch(() => {}); };
          setInterval(flush, 250); addEventListener('pagehide', flush);
        });
      }
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
  if (kind === 'add') return; // 1.9: the add sheet shows every row again
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
