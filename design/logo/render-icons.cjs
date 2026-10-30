const { chromium } = require('playwright'); const fs = require('fs');
const R = require('path').resolve(__dirname, '../..'), L = R + '/design/logo/';
const jobs = [
  ['suisui-logo.svg', 'app/icons/icon-192.png', 192, true], ['suisui-logo.svg', 'app/icons/icon-512.png', 512, true],
  ['suisui-logo-square.svg', 'app/icons/apple-touch-icon.png', 180, false], ['suisui-logo-square.svg', 'app/icons/icon-maskable-512.png', 512, false],
  ['suisui-logo-square.svg', 'ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png', 1024, false],
  ['suisui-logo.svg', 'design/logo/suisui-logo-1024.png', 1024, true],
  ...[['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]].map(([d, px]) => ['suisui-logo.svg', `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, px, true]),
  ...[['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432]].map(([d, px]) => ['suisui-logo-foreground.svg', `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, px, true]),
];
(async () => {
  const b = await chromium.launch();
  for (const [svg, out, px, transparent] of jobs) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<body style="margin:0;background:transparent">${fs.readFileSync(L + svg, 'utf8').replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`);
    await p.screenshot({ path: R + '/' + out, omitBackground: transparent });
    await p.close();
  }
  await b.close(); console.log('rendered', jobs.length);
})();
