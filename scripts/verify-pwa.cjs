const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../app');
const results = path.resolve(__dirname, '../pwa-test-results');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
let version = 1;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  fs.readFile(file, (error, bytes) => {
    if (error) return res.writeHead(404).end();
    if (pathname === '/sw.js') bytes = Buffer.from(bytes.toString().replace(/const VERSION = '[^']+';/, `const VERSION = 'test-${version}';`));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  });
});

(async () => {
  fs.mkdirSync(results, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://localhost:${server.address().port}`;
  const engines = [['chromium', chromium, process.platform === 'win32' ? { channel: 'msedge' } : (process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})]];
  if (fs.existsSync(webkit.executablePath())) engines.push(['webkit', webkit, {}]);
  const report = [];
  try {
    for (const [name, engine, options] of engines) {
      version = 1;
      const browser = await engine.launch({ ...options, headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.waitForFunction(() => navigator.serviceWorker.controller && document.getElementById('offline-status').textContent.includes('已准备好'));
        const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
        assert.equal(manifest.display, 'standalone');
        for (const icon of manifest.icons) {
          const size = await page.evaluate(src => new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
            image.onerror = () => resolve('error');
            image.src = src;
          }), icon.src);
          assert.equal(size, icon.sizes);
        }
        await page.locator('[data-view="tasks"]').click();
        await page.locator('#task-input').fill('PWA offline persistence');
        await page.locator('#add-form button[type="submit"]').click();
        await page.locator('[data-view="settings"]').click();
        await page.locator('[data-material="glass"]').click();
        await context.setOffline(true);
        await page.reload();
        await page.waitForFunction(() => document.getElementById('offline-status').textContent === '离线可用');
        assert.equal(await page.locator('.lock-task').count(), 7);
        assert(await page.locator('#wallpaper').evaluate(img => img.complete && img.naturalWidth > 0));
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('suisui-locktodo-v1')).settings.cardMaterial), 'glass');
        await page.locator('.lock-task').first().click();
        await page.waitForTimeout(900);
        assert.equal(await page.locator('.lock-task.is-done').count(), 1);
        await page.screenshot({ path: path.join(results, `${name}-offline.png`), fullPage: true });
        await page.reload();
        assert.equal(await page.locator('.lock-task.is-done').count(), 1);
        const saved = await page.evaluate(() => localStorage.getItem('suisui-locktodo-v1'));
        await context.setOffline(false);
        version = 2;
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.waitForFunction(() => !document.getElementById('pwa-update').hidden);
        assert.equal(await page.evaluate(() => localStorage.getItem('suisui-locktodo-v1')), saved);
        await page.locator('#header-about').click();
        await page.locator('#pwa-update').click();
        await page.waitForFunction(async () => (await caches.keys()).some(key => key.endsWith('test-2')));
        await page.waitForFunction(() => document.getElementById('offline-status')?.textContent.includes('已准备好'));
        assert.equal(await page.evaluate(() => localStorage.getItem('suisui-locktodo-v1')), saved);
        assert(!(await page.evaluate(() => caches.keys())).some(key => key.endsWith('test-1')));
        await context.setOffline(true);
        await page.reload();
        assert.equal(await page.locator('.lock-task.is-done').count(), 1);
        for (const width of [320, 390, 430, 1440]) {
          await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
          await page.locator('#header-about').click();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.locator('#close-about').click();
        }
        assert.deepEqual(errors, []);
        report.push({ engine: name, offlineReload: true, persistedTasksAndAppearance: true, offlineCompletion: true, updatePreservesData: true, oldCacheRemoved: true, layoutWidths: [320, 390, 430, 1440] });
      } finally { await browser.close(); }
    }
    if (engines.length === 1) report.push({ engine: 'webkit', tested: false, reason: 'Browser binary not installed' });
    fs.writeFileSync(path.join(results, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
