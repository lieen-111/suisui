const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
    await page.setContent('<style>body{margin:0;background:#13765b;display:grid;place-items:center;height:100vh}svg{width:52%;height:52%;color:white;stroke-width:1.7}</style><i data-lucide="square-check-big"></i>');
    await page.addScriptTag({ path: path.resolve(__dirname, '../app/vendor/lucide.min.js') });
    await page.evaluate(() => lucide.createIcons());
    const root = path.resolve(__dirname, '../app/icons');
    fs.mkdirSync(root, { recursive: true });
    // `--ios-only` keeps the published web icons byte-identical.
    if (!process.argv.includes('--ios-only')) for (const [file, size] of [['icon-512.png', 512], ['icon-maskable-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
      await page.setViewportSize({ width: size, height: size });
      await page.screenshot({ path: path.join(root, file) });
    }
    // Native iOS app icon: one opaque 1024 px image; Xcode derives every other size.
    const ios = path.resolve(__dirname, '../ios/App/Assets.xcassets/AppIcon.appiconset');
    fs.mkdirSync(ios, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 1024 });
    await page.screenshot({ path: path.join(ios, 'AppIcon-1024.png'), omitBackground: false });
    console.log('Rendered opaque PNG app icons (web + iOS 1024) using the existing Lucide brand glyph.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
