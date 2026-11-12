/* Lock-screen wallpapers for the two illustration themes (屋 · 线描, 毛 · 团), drawn by the app's own
   illustration code so they always match the header. Needs the local server running (npm start) and Playwright:
       LOCKTODO_URL=http://localhost:8793 node scripts/make-pro-illus-wallpapers.cjs
   Writes app/assets/wallpapers/pro-room.jpg, pro-fluff.jpg (1080 × 2340) and their 216 × 468 thumbnails.
   Layout rule shared with make-pro-wallpapers.py: clock at 8–15 % height, cards 20–65 %, the picture along the bottom. */
const fs = require('fs'), path = require('path');
const { chromium, url, launchOptions } = require('./test-environment.cjs');
const OUT = path.join(__dirname, '..', 'app', 'assets', 'wallpapers');
(async () => {
  const b = await chromium.launch(launchOptions), page = await b.newPage();
  await page.goto(url + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.SuiSuiSkins?.roomImg);
  const shots = await page.evaluate(async () => {
    const SK = window.SuiSuiSkins, W = 1080, H = 2340, out = {};
    const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
    const grain = (ctx, ink, n, seed) => { const r = rng(seed); for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${ink},${.03 + r() * .05})`; ctx.fillRect(r() * W, r() * H, 1.6, 1.6); } };
    const finish = (c, name) => { const t = document.createElement('canvas'); t.width = 216; t.height = 468; t.getContext('2d').drawImage(c, 0, 0, 216, 468); out[name] = c.toDataURL('image/jpeg', .9); out[`${name}-thumb`] = t.toDataURL('image/jpeg', .84); };

    { // 屋: pale green paper, a strip of ground along the bottom, the furnished room with its lamp on
      const [c, ctx] = make(), line = '#2c3a20';
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#eef3dd'); g.addColorStop(1, '#e2ebcb'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      grain(ctx, '44,58,32', 26000, 3);
      // clear-line clouds by the clock
      ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.fillStyle = '#fbf8ee'; ctx.lineJoin = 'round';
      [[150, 150, .62], [940, 175, .5]].forEach(([x, y, s]) => { const bumps = [[-62, -10, 34], [-20, -38, 46], [34, -24, 38], [70, -4, 26]], base = () => { ctx.beginPath(); bumps.forEach(([dx, dy, r]) => { ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); }); ctx.rect(x - 92 * s, y - 14 * s, 184 * s, 22 * s); };
        ctx.lineWidth = 6; ctx.strokeStyle = line; base(); ctx.stroke(); ctx.fillStyle = '#fbf8ee'; base(); ctx.fill(); });
      // the ground
      const gy = 1790; ctx.fillStyle = '#b39a5f'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#8fb35e'; ctx.fillRect(0, gy - 26, W, 30);
      ctx.beginPath(); ctx.moveTo(0, gy - 26); ctx.lineTo(W, gy - 26); ctx.moveTo(0, gy + 4); ctx.lineTo(W, gy + 4); ctx.stroke();
      const r = rng(7); ctx.lineWidth = 2;
      for (let i = 0; i < 70; i++) { const x = r() * W, y = gy - 26; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 12 - r() * 8); ctx.stroke(); }
      ctx.globalAlpha = .35; for (let i = 0; i < 260; i++) { const x = r() * W, y = gy + 20 + r() * (H - gy - 30); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 18); ctx.stroke(); } ctx.globalAlpha = 1;
      ctx.lineWidth = 2.4; for (let i = 0; i < 14; i++) { const x = r() * W, y = gy + 60 + r() * (H - gy - 120), rx = 14 + r() * 20; ctx.fillStyle = '#e6dbb6'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .6, (r() - .5) * .8, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(44,58,32,.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { let x = 80 + r() * (W - 160), y = gy + 6; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { const nx = x + (r() - .5) * 60, ny = y + 26 + r() * 30; ctx.quadraticCurveTo(x + (r() - .5) * 50, (y + ny) / 2, nx, ny); x = nx; y = ny; } ctx.stroke(); }
      // the room: furnished, lit
      const img = SK.roomImg({ done: 14, total: 14, lit: true }); await img.decode();
      const s = 4.4, w = 200 * s, h = 224 * s, x = (W - w) / 2, y = H - h - 70;
      const glow = ctx.createRadialGradient(W / 2 + 60, y + h * .35, 0, W / 2 + 60, y + h * .35, w * .8); glow.addColorStop(0, 'rgba(255,226,140,.35)'); glow.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, x, y, w, h);
      finish(c, 'pro-room');
    }
    { // 毛: off-white paper; the cat peeks up from the bottom edge, awake
      const [c, ctx] = make();
      ctx.fillStyle = '#f8f7f4'; ctx.fillRect(0, 0, W, H); grain(ctx, '20,20,22', 30000, 5);
      const s = 7.6, x = W / 2 - 90 * s, y = H - 125 * s;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); SK.furStrokes(ctx, 0, SK.furTotal()); SK.furFace(ctx, 1, 1); ctx.restore();
      // a few loose hairs drifting just above its ears
      const r = rng(11); ctx.strokeStyle = 'rgba(20,20,22,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const hx = 140 + r() * (W - 280), hy = 1520 + r() * 160, a = r() * 6, l = 26 + r() * 30; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + Math.cos(a + .7) * l * .6, hy + Math.sin(a + .7) * l * .6, hx + Math.cos(a) * l, hy + Math.sin(a) * l); ctx.stroke(); }
      finish(c, 'pro-fluff');
    }
    return out;
  });
  for (const [name, data] of Object.entries(shots)) { fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(data.split(',')[1], 'base64')); console.log('made', name); }
  await b.close();
})();
