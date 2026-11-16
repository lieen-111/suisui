// Layout audit for every settings page (1.18): in each look and on web / Android / iPhone shells,
// every visible thing inside a section card keeps inside the card with an inner margin, cards line up
// with each other, nothing scrolls sideways, and no text is clipped.
const { chromium, url, launchOptions } = require('./test-environment.cjs');
const assert = require('node:assert/strict');

const LOOKS = ['glass', 'paper', 'night', 'dawn', 'day', 'bloom', 'riso', 'room', 'fluff'];
const SHELLS = ['web', 'android', 'ios'];
const PAGES = ['look', 'lock', 'list', 'data', 'language'];

const androidStub = () => {
  let r = null; window.SuiSuiAndroid = {
    load: () => r, save: j => { r = j; return true; }, notificationsAllowed: () => true, isLockMode: () => false, hasSystemWallpaper: () => false,
    permissions: () => JSON.stringify({ notifications: true, overlay: true, lockScreenRunning: true, brand: 'x', battery: true, fullScreen: true, needsFullScreenSetting: false, screenOffs: 1, shown: 1 }),
    unlock() {}, version: () => 't', requestBatteryExemption() {}, openFullScreenSettings() {}, openOverlaySettings() {}, openAppPermissions() {}, requestNotificationPermission() {}, openNotificationSettings() {}
  };
};
const iosStub = () => {
  window.webkit = { messageHandlers: { suisui: { postMessage() {} } } };
  window.SuiSuiIOS = { status: { live: true, liveAllowed: true, liveWanted: true, notifications: 'granted' }, liveActivity() {}, requestNotifications() {}, openSettings() {} };
};

(async () => {
  const browser = await chromium.launch(launchOptions);
  const problems = [];
  for (const shell of SHELLS) for (const look of LOOKS) {
    const context = await browser.newContext({ lookTabs: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, proFree: true });
    if (shell === 'android') await context.addInitScript(androidStub);
    if (shell === 'ios') await context.addInitScript(iosStub);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(l => { const s = window.suisui.pro.state.settings; s.tipsSeen = true; s.androidSetupSeen = true; s.iosSetupSeen = true; if (['glass', 'paper', 'night'].includes(l)) { s.uiStyle = l; s.proTheme = ''; } else s.proTheme = l; window.suisui.pro.save(); }, look);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    await page.locator('.nav-button[data-view=settings]').click();
    for (const pg of PAGES) {
      const btn = page.locator(`[data-settings-page=${pg}]`).first();
      await btn.click(); await page.waitForTimeout(450);
      const tabs = await page.locator('[data-look-tab]').count();
      for (let t = 0; t < (pg === 'look' && tabs ? tabs : 1); t++) {
        if (pg === 'look' && tabs) { await page.locator('[data-look-tab]').nth(t).click(); await page.waitForTimeout(250); }
        const found = await page.evaluate(() => {
          const out = [], vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
          const pageEl = document.querySelector('.settings-page:not([hidden])');
          if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`sideways scroll ${document.documentElement.scrollWidth}`);
          // 1.19: the theme gallery runs edge to edge on purpose; its text keeps the page margin
          for (const g of pageEl.querySelectorAll('fieldset.ui-styles')) { if (!vis(g)) continue;
            for (const el of g.querySelectorAll('legend, .theme-about')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.left < 28 || r.right > innerWidth - 28) out.push(`主题: ${el.className || el.tagName} at ${Math.round(r.left)}…${Math.round(innerWidth - r.right)} from the screen edges`); }
            const first = g.querySelector('.theme-card'); if (first && vis(first) && g.querySelector('.theme-rail').scrollLeft === 0 && first.getBoundingClientRect().left < 28) out.push('主题: first theme starts at the screen edge'); }
          const cards = [...pageEl.querySelectorAll('fieldset')].filter(vis).filter(c => !c.matches('.ui-styles'));
          const lefts = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))), rights = new Set(cards.map(c => Math.round(c.getBoundingClientRect().right)));
          if (lefts.size > 1 || rights.size > 1) out.push(`cards not aligned: left ${[...lefts]} right ${[...rights]}`);
          for (const c of cards) {
            const cr = c.getBoundingClientRect(), name = c.querySelector('legend')?.textContent.trim() || c.id || c.className;
            if (cr.left < 8 || cr.right > innerWidth - 8) out.push(`${name}: card touches the screen edge`);
            for (const el of c.querySelectorAll('span, p, b, strong, small, label, button, input, output, h3, .font-sample, .style-demo, .chip')) {
              if (!vis(el) || el.closest('legend') || el.closest('.wallpaper-choice') && el.tagName === 'SPAN') continue;
              if (getComputedStyle(el).position === 'fixed') continue;
              const r = el.getBoundingClientRect();
              // full-width rows (dividers, inline row buttons) may run to the card edge; their text must not
              const edgeRow = el.matches('.secondary-button.inline, .setting-row, .ag-switch, .slider-row, .group-row, .group-list > *, .look-tabs, .look-tabs *');
              const inset = edgeRow ? -1 : 14;
              if (r.left < cr.left + inset - .5 || r.right > cr.right - inset + .5) { out.push(`${name}: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || el.value || '').trim().slice(0, 14)}" sits at ${Math.round(r.left - cr.left)}…${Math.round(cr.right - r.right)} from the card edges`); }
              if (!edgeRow && /^(P|SMALL|B|STRONG|LABEL)$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow !== 'ellipsis') out.push(`${name}: clipped text "${el.textContent.trim().slice(0, 14)}"`);
            }
            // text inside full-width rows keeps the card's inner margin
            for (const row of c.querySelectorAll('.secondary-button.inline, .setting-row')) {
              if (!vis(row)) continue;
              const range = document.createRange(); range.selectNodeContents(row); const rects = [...range.getClientRects()].filter(r => r.width > 0);
              const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right));
              if (left < cr.left + 14 || right > cr.right - 14) out.push(`${name}: row "${row.textContent.trim().slice(0, 14)}" content at ${Math.round(left - cr.left)}…${Math.round(cr.right - right)} from the card edges`);
            }
          }
          return [...new Set(out)];
        });
        found.forEach(f => problems.push(`${shell}/${look}/${pg}${t ? '#' + t : ''}: ${f}`));
      }
      await page.evaluate(() => window.suisuiBack()); await page.waitForTimeout(300);
    }
    await context.close();
  }
  await browser.close();
  if (problems.length) { console.log(problems.slice(0, 80).join('\n')); console.log(`${problems.length} layout problems`); process.exit(1); }
  console.log(`PASS: every settings page in ${LOOKS.length} looks × ${SHELLS.length} shells keeps its content inside aligned cards, with inner margins, no clipping, no sideways scroll.`);
})().catch(e => { console.error(e); process.exit(1); });
