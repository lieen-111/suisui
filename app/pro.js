/* 碎碎清单 Pro — the upgrade on top of the free app.
   Everything here reads and writes the app state through window.suisui.pro (app.js). Without Pro the
   free app is unchanged; locked parts stay visible (try-on, previews) and open the Pro page.
   Purchase is simulated in this local build (settings.pro.owned); the real build will use App Store purchase. */
(() => {
  const API = window.suisui?.pro;
  if (!API) return;
  const $ = id => document.getElementById(id);
  const S = () => API.state.settings;
  const reduce = () => !S().motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PRICE = '¥18', LIST_PRICE = '¥28', TRIAL_DAYS = 3;

  /* ---------- Themes: each one is a whole world (colours, type, shard material, completion effect, sound) ---------- */
  const SANS = 'Geist,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', SONG = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SERIF = '"Didot","Bodoni 72","Playfair Display","Noto Serif","Times New Roman",serif';
  /* 「一日四时」: four times of day. Each theme draws today in its own way (measuring glass, manuscript paper, sunset
     dial, constellation), has its own check and its own weekly picture. Shared: things break into pieces when done,
     in the theme's material, and the pieces go into the same jar. */
  const THEMES = {
    dawn: { name: '晨', full: '晨 · 玻璃', line: '一只量杯，做完一件，满一点', base: 'glass', material: 'glass', effect: 'shards', sound: 'glass', accent: '#1b1d24', soft: '#1b1d240f', on: '#ffffff',
      shards: ['#9d97ff', '#7fdcc6', '#ffb79c', '#93b8ff'], bg: '#eef0f4', ink: '#1b1d24', muted: '#6b7080', mode: 'multiply', font: SANS, display: SANS },
    day: { name: '昼', full: '昼 · 纸', line: '稿纸一格一个字，做完画个红圈', base: 'paper', material: 'paper', effect: 'shards', sound: 'paper', accent: '#1d1a16', soft: '#1d1a160f', on: '#f5f2ec',
      shards: ['#fbf8f1', '#e9e2d4', '#d9d0bf', '#1d1a16', '#b43a2c'], bg: '#f5f2ec', ink: '#1d1a16', muted: '#8a8279', mode: 'source-over', font: SONG, display: SONG },
    dusk: { name: '暮', full: '暮 · 金', line: '太阳跟着进度走，清空就日落', base: 'night', material: 'gold', effect: 'shards', sound: 'chime', accent: '#c8a66a', soft: '#c8a66a1f', on: '#15110c',
      shards: ['#c8a66a', '#e8d3a4', '#9c7f47', '#f4e8cc'], bg: '#15110c', ink: '#efe6d6', muted: '#8c8170', mode: 'screen', font: SANS, display: SERIF },
    night: { name: '夜', full: '夜 · 光', line: '每件事一颗星，做完连成星座', base: 'night', material: 'light', effect: 'shards', sound: 'night', accent: '#dfe6ff', soft: '#dfe6ff1a', on: '#07080d',
      shards: ['#dfe6ff', '#9fb4ff', '#ffffff', '#ffd9a0'], bg: '#07080d', ink: '#e8ecf7', muted: '#7d8496', mode: 'screen', font: SANS, display: SANS }
  };
  const ORDER = ['dawn', 'day', 'dusk', 'night'];
  /** 跟随时间: 5–10 晨, 10–17 昼, 17–20 暮, 20–5 夜. */
  const byTime = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 10 ? 'dawn' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'; };
  const BRAND = { shards: ['#d9d6ff', '#c9f0e6', '#ffe0d2', '#f5f5f7'] };
  const SOON = [{ name: '二十四节气', line: '每个节气，一种新的材质' }];
  const PLAIN = { material: 'plain', shards: ['#9fd8ff', '#ffffff', '#a7b4ff', '#7ee0c8'], bg: '#0c0e14', ink: '#f1f3f7', muted: '#8b93a3', accent: '#9fd8ff', mode: 'screen', font: SANS, display: SANS };
  const EFFECTS = { auto: '跟随主题', shards: '碎裂', stardust: '流光', ink: '墨染', plane: '纸飞机', dots: '点阵', gold: '金箔' };
  const EFFECT_LINE = { shards: '按主题的材质碎开', stardust: '化成一缕光', ink: '墨晕开，落一点红', plane: '折成纸飞机飞走', dots: '散成一粒粒点', gold: '金箔慢慢飘落' };

  /* ---------- Entitlement (simulated purchase in this build) ---------- */
  const info = () => { const p = S().pro; return p && typeof p === 'object' ? p : (S().pro = { owned: false, trialEnds: 0, trialUsed: false }); };
  const isPro = () => !!info().owned || (info().trialEnds || 0) > Date.now();
  const trialLeft = () => Math.max(0, Math.ceil(((info().trialEnds || 0) - Date.now()) / 864e5));
  const status = () => info().owned ? '已解锁' : isPro() ? `试用中 · 剩 ${trialLeft()} 天` : '';
  let tryOn = '';
  const activeTheme = () => tryOn || (!isPro() ? '' : S().proTheme === 'auto' ? byTime() : THEMES[S().proTheme] ? S().proTheme : '');
  const look = () => THEMES[activeTheme()] || PLAIN;
  function persist() { API.save(); }
  function buy() { info().owned = true; if (!info().via) info().via = payPlatform() === 'ios' ? 'appstore' : 'code'; persist(); endTry(false); applyTheme(); refreshAll(); celebrateUnlock(); }
  function startTrial() { const p = info(); if (p.trialUsed) return; p.trialUsed = true; p.trialEnds = Date.now() + TRIAL_DAYS * 864e5; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast(`已开始 ${TRIAL_DAYS} 天免费试用，Pro 全部可用`); }
  function restore() { API.showToast(info().owned ? '已恢复购买' : '没有找到购买记录（本地预览）'); }
  /* ---------- How people pay, by platform ----------
     iPhone: App Store in-app purchase (a non-consumable), restored with the Apple account. Apple requires this for
       digital unlocks in an iOS app, and the app may not point to other ways to pay.
     Android (no Google Play in China) and the web: a redeem code bought on a payment page; the code unlocks Pro.
     This build simulates both. Real codes need a small server that issues and checks them (see 基础版与Pro.md). */
  let payPreview = '';
  const payPlatform = () => payPreview || new URLSearchParams(location.search).get('pay') || API.platform || 'web';
  const CODE_ABC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codeSum = body => { let h = 7; for (const ch of body) h = (h * 31 + CODE_ABC.indexOf(ch) + 1) % 1024; return CODE_ABC[h >> 5] + CODE_ABC[h & 31]; };
  const normCode = v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^SUISUI/, '');
  /** Preview-only check (a checksum). The real build asks the code server instead. */
  const codeOk = v => { const b = normCode(v); return b.length === 12 && [...b].every(ch => CODE_ABC.includes(ch)) && codeSum(b.slice(0, 10)) === b.slice(10); };
  const demoCode = (() => { const b = 'SUPRWEEK26'; const full = b + codeSum(b); return `SUISUI-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8)}`; })();
  function redeem(value) {
    if (!codeOk(value)) { API.showToast('兑换码不对，检查一下有没有输错'); return false; }
    info().via = 'code'; info().code = normCode(value); buy(); return true;
  }
  function resetLocal() { S().pro = { owned: false, trialEnds: 0, trialUsed: false }; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast('已重置为未购买（本地预览）'); }

  /* ---------- Small helpers ---------- */
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t;
  const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const weekStart = (d = new Date()) => { const x = startOfDay(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
  const isoWeek = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y0) / 864e5 + 1) / 7); };
  const logBetween = (a, b) => (API.state.log || []).filter(e => e.at >= a && e.at < b);
  const todayLog = () => logBetween(startOfDay().getTime(), startOfDay().getTime() + 864e5);
  const icon = (name, cls = '') => `<i data-lucide="${name}" ${cls ? `class="${cls}"` : ''}></i>`;
  const groupColor = id => API.groupOf(id)?.color || '#9aa0a6';
  function hex(c, a) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function shardColor(e, i, L = look()) { return L === PLAIN ? groupColor(e.group) : L.shards[(hash(`${e.id}${e.at}`) + i) % L.shards.length]; }
  function canvasFor(el, w, h) { const dpr = Math.min(2, devicePixelRatio || 1); el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); el.style.width = `${w}px`; el.style.height = `${h}px`; const c = el.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return c; }

  /* ---------- Sound: each theme has its own completion sound, synthesised (no audio files) ---------- */
  let ac = null;
  function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch { return null; } }
  function tone(c, { f, f2, type = 'sine', t = 0, d = .4, g = .15 }) {
    const o = c.createOscillator(), v = c.createGain(), at = c.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + d);
    v.gain.setValueAtTime(.0001, at); v.gain.exponentialRampToValueAtTime(g, at + .008); v.gain.exponentialRampToValueAtTime(.0001, at + d);
    o.connect(v).connect(c.destination); o.start(at); o.stop(at + d + .05);
  }
  function hiss(c, { t = 0, d = .06, g = .2, hp = 1200, lp = 9000 }) {
    const n = Math.round(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), h = c.createBiquadFilter(), l = c.createBiquadFilter(), v = c.createGain(), at = c.currentTime + t;
    s.buffer = b; h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp; v.gain.value = g;
    s.connect(h).connect(l).connect(v).connect(c.destination); s.start(at);
  }
  const SOUNDS = {
    glass: c => { tone(c, { f: 1568, d: .9, g: .1 }); tone(c, { f: 2349, t: .05, d: .7, g: .06 }); tone(c, { f: 3136, t: .11, d: .5, g: .035 }); },
    wood: c => { tone(c, { f: 520, f2: 300, d: .18, g: .2, type: 'triangle' }); hiss(c, { d: .04, g: .07, hp: 300, lp: 2200 }); tone(c, { f: 784, t: .12, d: .45, g: .04 }); },
    shutter: c => { hiss(c, { d: .025, g: .28, hp: 2600 }); hiss(c, { t: .075, d: .045, g: .2, hp: 1400 }); tone(c, { f: 150, f2: 90, t: .075, d: .12, g: .06, type: 'square' }); },
    chip: c => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, type: 'square', t: i * .055, d: .09, g: .045 })); },
    soft: c => { tone(c, { f: 880, f2: 1320, d: .18, g: .07 }); tone(c, { f: 1760, t: .06, d: .3, g: .025 }); },
    paper: c => { hiss(c, { d: .09, g: .14, hp: 900, lp: 5200 }); hiss(c, { t: .07, d: .12, g: .09, hp: 1400, lp: 6000 }); },
    night: c => { tone(c, { f: 1568, d: .7, g: .05 }); tone(c, { f: 2349, t: .09, d: .8, g: .035 }); tone(c, { f: 3136, t: .2, d: .6, g: .02 }); },
    click: c => { hiss(c, { d: .012, g: .22, hp: 3200 }); tone(c, { f: 2400, d: .035, g: .04, type: 'square' }); hiss(c, { t: .06, d: .01, g: .12, hp: 4000 }); },
    chime: c => { tone(c, { f: 660, d: 1.3, g: .075 }); tone(c, { f: 990, t: .02, d: 1.1, g: .045 }); tone(c, { f: 1485, t: .04, d: .8, g: .02 }); }
  };
  const soundOn = () => S().proSound !== false;
  function playSound(id) { if (!soundOn()) return; const c = audio(); if (!c) return; try { (SOUNDS[id] || SOUNDS.soft)(c); } catch { /* optional */ } }
  const themeSound = () => THEMES[activeTheme()]?.sound || 'soft';

  /* ---------- Completion effects (replace the free shatter) ---------- */
  function chosenEffect() {
    if (demoEffect) return demoEffect;
    if (!isPro() && !tryOn) return '';
    const e = S().proEffect || 'auto';
    return e === 'auto' ? (THEMES[activeTheme()]?.effect || 'shards') : e;
  }
  let demoEffect = '';
  function sampleText(textNode, step) {
    const r = textNode.getBoundingClientRect(), cs = getComputedStyle(textNode);
    const w = Math.ceil(r.width) + 8, h = Math.ceil(r.height) + 8, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d'), text = textNode.textContent.trim(), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35;
    x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; x.fillStyle = cs.color; x.textBaseline = 'middle';
    const lines = []; let cur = '';
    for (const ch of text) { if (x.measureText(cur + ch).width > r.width + 1 && cur) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    const top = (h - lines.length * lh) / 2;
    lines.forEach((l, i) => x.fillText(l, 4, top + lh * (i + .5)));
    const data = x.getImageData(0, 0, w, h).data, pts = [];
    for (let y = 0; y < h; y += step) for (let xx = 0; xx < w; xx += step) if (data[(y * w + xx) * 4 + 3] > 110) pts.push({ x: r.left - 4 + xx, y: r.top - 4 + y });
    return { pts, image: c, left: r.left - 4, top: r.top - 4, w, h, color: cs.color, rect: r };
  }
  function overlay(duration, draw, resolveAt = 540) {
    return new Promise(resolve => {
      const c = document.createElement('canvas'); c.className = 'pro-fx';
      const ctx = canvasFor(c, innerWidth, innerHeight); document.body.append(c);
      const t0 = performance.now();
      const tick = now => { const ms = now - t0; ctx.clearRect(0, 0, innerWidth, innerHeight); draw(ctx, ms); if (ms < duration) requestAnimationFrame(tick); else c.remove(); };
      requestAnimationFrame(tick); setTimeout(resolve, resolveAt);
    });
  }
  const LIGHT = ['dawn', 'day'];
  const dark = () => !LIGHT.includes(activeTheme());
  const FX = {
    /** 碎裂, in the theme's material: glass flies apart, paper scraps flutter down, gold leaf falls, light drifts up. */
    shards(src, s) {
      const mat = look().material || 'glass', L = look(), cols = Math.max(4, Math.round(s.w / 24)), rows = 2, cw = s.w / cols, ch = s.h / rows, pieces = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (let t = 0; t < 2; t++) {
        const x0 = s.left + x * cw, y0 = s.top + y * ch, pts = t ? [[x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]] : [[x0, y0], [x0 + cw, y0], [x0, y0 + ch]];
        const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3, r = rng(x * 31 + y * 7 + t * 3 + 1), spread = x / Math.max(1, cols - 1) - .5;
        const v = mat === 'paper' ? { vx: spread * 70 + (r() - .5) * 40, vy: -24 - r() * 30, g: 300, spin: (r() - .5) * 3.4, sway: 12 + r() * 16 }
          : mat === 'gold' ? { vx: spread * 44 + (r() - .5) * 30, vy: -14 - r() * 20, g: 190, spin: (r() - .5) * 2.6, sway: 9 + r() * 12 }
          : mat === 'light' ? { vx: spread * 60 + (r() - .5) * 30, vy: -40 - r() * 60, g: -8, spin: (r() - .5) * 2, sway: 0 }
          : { vx: spread * (150 + r() * 90), vy: (y - .5) * 50 - 40 - r() * 50, g: 130, spin: (r() - .5) * 5, sway: 0 };
        pieces.push({ pts, cx, cy, ...v, d: Math.abs(spread) * 60 + r() * 40, c: L.shards[(x + y + t) % L.shards.length] });
      }
      const dur = mat === 'paper' || mat === 'gold' ? 1450 : 1050;
      return overlay(dur, (ctx, ms) => {
        for (const p of pieces) {
          const tt = Math.max(0, (ms - p.d) / 1000), life = clamp((ms - p.d) / (dur - p.d)), a = 1 - life * life;
          if (a <= 0) continue;
          const dx = p.vx * tt + Math.sin(tt * 6 + p.cx) * p.sway * tt, dy = p.vy * tt + .5 * p.g * tt * tt;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(p.cx + dx, p.cy + dy); ctx.rotate(p.spin * tt); ctx.translate(-p.cx, -p.cy);
          ctx.beginPath(); ctx.moveTo(...p.pts[0]); ctx.lineTo(...p.pts[1]); ctx.lineTo(...p.pts[2]); ctx.closePath();
          if (mat === 'paper') { ctx.shadowColor = 'rgba(60,40,20,.2)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = '#fbf8f1'; ctx.fill(); ctx.shadowColor = 'transparent'; }
          else if (mat === 'gold') { const g = ctx.createLinearGradient(p.pts[0][0], p.pts[0][1], p.pts[1][0], p.pts[2][1]); g.addColorStop(0, '#9c7f47'); g.addColorStop(.5, '#f4e8cc'); g.addColorStop(1, '#c8a66a'); ctx.fillStyle = g; ctx.globalAlpha = a * .8; ctx.fill(); ctx.globalAlpha = a; }
          else if (mat === 'glass') { ctx.fillStyle = hex(p.c, .2); ctx.fill(); }
          else if (mat === 'plain') { ctx.fillStyle = 'rgba(160,200,255,.22)'; ctx.fill(); }
          ctx.save(); ctx.clip(); if (mat === 'light') ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(s.image, s.left, s.top); ctx.restore();
          if (mat === 'light') { ctx.shadowColor = p.c; ctx.shadowBlur = 8; }
          ctx.strokeStyle = mat === 'paper' ? 'rgba(29,26,22,.14)' : mat === 'gold' ? 'rgba(255,240,210,.75)' : mat === 'light' ? hex(p.c, .85) : 'rgba(255,255,255,.8)';
          ctx.lineWidth = mat === 'light' ? 1 : .8; ctx.stroke(); ctx.restore();
        }
      });
    },
    stardust(src, s) {
      const L = look(), parts = s.pts.slice(0, 900).map((p, i) => { const r = rng(i * 977 + 13); return { ...p, vx: (r() - .35) * 46, vy: -(28 + r() * 90), size: 1 + r() * 1.8, c: L.shards[i % L.shards.length], ph: r() * 6, d: (p.x - s.left) / s.w * 260 }; });
      return overlay(1200, (ctx, ms) => {
        const sweep = s.left + (ms / 260) * s.w;
        ctx.save(); ctx.beginPath(); ctx.rect(sweep, s.top, s.w + 40, s.h); ctx.clip(); ctx.drawImage(s.image, s.left, s.top); ctx.restore();
        ctx.globalCompositeOperation = dark() ? 'lighter' : 'source-over';
        for (const p of parts) {
          const t = clamp((ms - p.d) / 900); if (t <= 0) continue;
          const e = easeOut(t), a = (1 - t) * (.6 + .4 * Math.sin(p.ph + ms / 60));
          ctx.fillStyle = hex(p.c, clamp(a)); ctx.beginPath(); ctx.arc(p.x + p.vx * e, p.y + p.vy * e, p.size * (1 + .6 * (1 - t)), 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      });
    },
    dots(src, s) {
      const parts = s.pts.map((p, i) => { const r = rng(i * 31 + 7); return { ...p, d: (p.x - s.left) / s.w * 300 + r() * 120, vy: -(8 + r() * 26), vx: (r() - .5) * 16, red: false }; });
      return overlay(1100, (ctx, ms) => {
        for (const p of parts) {
          const t = clamp((ms - p.d) / 520), sc = t <= 0 ? 1 : 1 - easeOut(t);
          if (sc <= .02) continue; ctx.fillStyle = p.red ? '#d71921' : s.color;
          ctx.beginPath(); ctx.arc(p.x + p.vx * easeOut(t), p.y + p.vy * easeOut(t), 1.7 * sc + (t > 0 ? .4 : 0), 0, 7); ctx.fill();
        }
      });
    },
    gold(src, s) {
      const parts = s.pts.filter((_, i) => i % 3 === 0).map((p, i) => { const r = rng(i * 13 + 5); return { ...p, d: r() * 260, sway: 8 + r() * 18, ph: r() * 6, sz: 2 + r() * 3.5, spin: (r() - .5) * 8, fall: 60 + r() * 90, c: ['#c8a66a', '#e8d3a4', '#f4e8cc', '#9c7f47'][i % 4] }; });
      return overlay(1500, (ctx, ms) => {
        ctx.globalAlpha = clamp(1 - ms / 380); ctx.drawImage(s.image, s.left, s.top); ctx.globalAlpha = 1;
        for (const p of parts) {
          const t = clamp((ms - p.d) / 1150); if (t <= 0 || t >= 1) continue;
          const x = p.x + Math.sin(p.ph + t * 5) * p.sway * t, y = p.y + p.fall * t * t + t * 10, a = t < .15 ? t / .15 : 1 - (t - .15) / .85;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * t); ctx.scale(1, Math.abs(Math.cos(p.ph + t * 7)) * .8 + .2); ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * .7); ctx.restore();
        }
        ctx.globalAlpha = 1;
      });
    },
    ink(src, s) {
      const r = rng(hash(src.textContent || 'x')), blots = Array.from({ length: 7 }, (_, i) => ({ x: s.left + s.w * (.08 + i / 7.4) + (r() - .5) * 10, y: s.top + s.h / 2 + (r() - .5) * s.h * .4, R: 14 + r() * 20, d: i * 40 }));
      const dots = Array.from({ length: 14 }, () => ({ x: s.left + r() * s.w, y: s.top + s.h / 2 + (r() - .5) * s.h * 1.8, R: 1 + r() * 2.6, d: 120 + r() * 200 }));
      const seal = { x: Math.min(innerWidth - 46, s.rect.right + 18), y: s.top + s.h / 2 };
      return overlay(1300, (ctx, ms) => {
        const fade = clamp(1 - (ms - 800) / 500);
        ctx.globalAlpha = clamp(1 - (ms - 150) / 450) ; ctx.drawImage(s.image, s.left, s.top); ctx.globalAlpha = 1;
        ctx.filter = 'blur(2.5px)';
        for (const b of [...blots, ...dots]) {
          const t = clamp((ms - b.d) / 520); if (t <= 0) continue;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.R * easeOut(t) + .1);
          g.addColorStop(0, `rgba(29,26,22,${.62 * fade})`); g.addColorStop(.7, `rgba(29,26,22,${.38 * fade})`); g.addColorStop(1, 'rgba(29,26,22,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.R * easeOut(t) + .1, 0, 7); ctx.fill();
        }
        ctx.filter = 'none';
        const st = clamp((ms - 300) / 220); if (st > 0) {
          const k = 1.5 - .5 * easeOut(st); ctx.save(); ctx.translate(seal.x, seal.y); ctx.scale(k, k); ctx.globalAlpha = clamp(st * 1.4) * fade;
          ctx.fillStyle = '#b43a2c'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
        }
      });
    },
    plane(src, s) {
      const P = { x: s.left + 10, y: s.top + s.h / 2 }, end = { x: innerWidth + 60, y: Math.max(-40, s.top - 260) };
      const c1 = { x: P.x + 120, y: P.y + 40 }, c2 = { x: innerWidth * .7, y: P.y - 60 };
      const at = t => { const u = 1 - t; return { x: u * u * u * P.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x, y: u * u * u * P.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y }; };
      const parts = s.pts.filter((_, i) => i % 2 === 0).map((p, i) => ({ ...p, d: rng(i + 9)() * 120 }));
      const L = look(), stroke = L === PLAIN ? '#7fb2ff' : L.accent;
      return overlay(1350, (ctx, ms) => {
        ctx.fillStyle = s.color;
        for (const p of parts) { const t = easeIn(clamp((ms - p.d) / 300)); if (t >= 1) continue; ctx.globalAlpha = 1 - t * .6; ctx.fillRect(p.x + (P.x - p.x) * t, p.y + (P.y - p.y) * t, 1.6, 1.6); }
        ctx.globalAlpha = 1;
        const ft = clamp((ms - 330) / 950); if (ft <= 0) return;
        const e = easeIn(ft) * .85 + ft * .15, pos = at(e), nxt = at(Math.min(1, e + .02)), ang = Math.atan2(nxt.y - pos.y, nxt.x - pos.x);
        ctx.setLineDash([3, 6]); ctx.strokeStyle = hex(stroke.length === 7 ? stroke : '#7fb2ff', .35); ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k <= 24; k++) { const q = at(e * k / 24); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(ang); const k = 1 + .25 * Math.sin(ft * 3);
        ctx.scale(k, k); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = stroke; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -10); ctx.lineTo(-6, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, 0); ctx.stroke(); ctx.restore();
      });
    }
  };
  function effect(source, textNode) {
    const id = chosenEffect();
    if (!id || !FX[id]) return null;
    try { const s = sampleText(textNode, id === 'dots' ? 4 : id === 'stardust' ? 2 : id === 'shards' ? 6 : 3); return FX[id](source, s); } catch { return null; }
  }

  /* ---------- 碎片罐: today's completions as shards in a glass jar ---------- */
  function jarShape(x, y, w, h) {
    const neck = w * .44, nx = x + (w - neck) / 2, bodyTop = y + h * .2, r = w * .24;
    return { x, y, w, h, nx, neck, bodyTop, r, path(ctx) {
      ctx.beginPath(); ctx.moveTo(nx, y + h * .06); ctx.lineTo(nx, y + h * .14);
      ctx.quadraticCurveTo(nx, bodyTop, x + r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(x, bodyTop + r * .4, x, bodyTop + r);
      ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h); ctx.lineTo(x + w - r, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
      ctx.lineTo(x + w, bodyTop + r); ctx.quadraticCurveTo(x + w, bodyTop + r * .4, x + w - r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(nx + neck, bodyTop, nx + neck, y + h * .14);
      ctx.lineTo(nx + neck, y + h * .06); ctx.closePath();
    } };
  }
  /** Lays the shards in a pile, deterministically: the same day always looks the same. */
  function pile(entries, J, per, sz, colorOf = shardColor) {
    const cols = Math.max(4, Math.round(J.w / (sz * .95))), cw = (J.w - sz * .6) / cols, level = new Array(cols).fill(0), out = [];
    let full = false;
    entries.forEach(e => {
      const r = rng(hash(`${e.id}${e.at}`));
      for (let k = 0; k < per; k++) {
        const a = Math.floor(r() * cols), b = Math.floor(r() * cols), col = level[a] <= level[b] ? a : b;
        const x = J.x + sz * .3 + (col + .5) * cw + (r() - .5) * cw * .7, y = J.y + J.h - sz * .55 - level[col] * sz * .5 - r() * sz * .15;
        if (y < J.bodyTop + sz * .9) { full = true; continue; }
        level[col] += 1;
        out.push({ x, y, rot: r() * 6.28, s: sz * (.9 + r() * .5), color: colorOf(e, k), seed: hash(`${e.id}${e.at}${k}`) });
      }
    });
    return { shards: out, full };
  }
  const pageDark = () => { const t = activeTheme(), st = document.documentElement.dataset.style; return t ? t !== 'ink' : st === 'night' || (st === 'glass' && matchMedia('(prefers-color-scheme: dark)').matches); };
  const jarKind = () => activeTheme() || 'plain';
  function drawJar(ctx, x, y, w, h, entries, { per = 4, sz = w / 7, ms = 0, lid = true, dark } = {}) {
    const kind = jarKind(), J = jarShape(x, y, w, h), onDark = dark ?? !LIGHT.includes(kind);
    const { shards } = pile(entries, J, per, sz);
    window.SuiSuiSkins.jar(kind, ctx, x, y, w, h, shards, { ms, lid, onDark });
    return shards.length;
  }

  /* ---------- 每周碎片画: a picture only this week of yours could make ---------- */
  /** The weekly picture. Each theme draws the week its own way:
      晨 seven glasses filled with the day's things, 昼 a manuscript page with one character per thing,
      暮 a setting sun with one ray per thing, 夜 a star map with one constellation per day. */
  const CN = n => { const D = '零一二三四五六七八九'; return n < 10 ? D[n] : n < 20 ? `十${n % 10 ? D[n % 10] : ''}` : n < 100 ? `${D[Math.floor(n / 10)]}十${n % 10 ? D[n % 10] : ''}` : String(n); };
  const firstChar = s => Array.from(String(s || '').trim())[0] || '·';
  const mixWhite = (c, t) => { const n = parseInt(c.slice(1), 16), m = v => Math.round(v + (255 - v) * t); return `rgb(${m(n >> 16 & 255)},${m(n >> 8 & 255)},${m(n & 255)})`; };
  function weekStats(entries) {
    const focus = entries.reduce((m, e) => m + (e.min || 0), 0), byDay = new Array(7).fill(0);
    entries.forEach(e => { byDay[(new Date(e.at).getDay() + 6) % 7]++; });
    const busiest = entries.length ? '一二三四五六日'[byDay.indexOf(Math.max(...byDay))] : '';
    const focusText = focus ? `专注 ${Math.floor(focus / 60) ? `${Math.floor(focus / 60)} 小时 ` : ''}${focus % 60 ? `${focus % 60} 分钟` : ''}`.trim() : '';
    return { focus, byDay, busiest, focusText };
  }
  function drawArt(entries, start, L = look(), size = 1080) {
    entries = [...entries].sort((a, b) => a.at - b.at);
    const W = size, H = Math.round(size * 1.25), k = W / 1080, sc = v => v * k, mat = L.material || 'plain';
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d');
    const st = weekStats(entries), end = new Date(start.getTime() + 6 * 864e5), fmt = d => `${d.getMonth() + 1}月${d.getDate()}日`, Pd = sc(84);
    const byDay = Array.from({ length: 7 }, (_, d) => entries.filter(e => (new Date(e.at).getDay() + 6) % 7 === d));
    const th = THEMES[Object.keys(THEMES).find(id => THEMES[id] === L)];
    const summary = entries.length ? [`${entries.length} 件`, [st.focusText, `周${st.busiest}最多`].filter(Boolean).join('，')] : ['这一周还空着', '完成一件事，画就开始长'];
    const caption = (font, title, sub, color = L.ink, subColor = L.muted) => {
      ctx.fillStyle = color; ctx.font = font; ctx.fillText(title, Pd, Pd + sc(70));
      ctx.fillStyle = subColor; ctx.font = `400 ${sc(28)}px ${SANS}`; ctx.fillText(sub, Pd, Pd + sc(122));
    };
    const footer = (bigFont, color = L.ink, subColor = L.muted) => {
      ctx.fillStyle = color; ctx.font = bigFont; ctx.fillText(summary[0], Pd, H - Pd - sc(70));
      ctx.fillStyle = subColor; ctx.font = `400 ${sc(27)}px ${SANS}`; ctx.fillText(summary[1], Pd, H - Pd - sc(24));
      ctx.fillStyle = hex(L.muted, .9); ctx.font = `500 ${sc(24)}px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText('碎碎清单', W - Pd, H - Pd - sc(24)); ctx.textAlign = 'left';
    };
    const range = `${th ? `${th.full}　` : ''}${fmt(start)} 至 ${fmt(end)}`;

    if (mat === 'glass') { /* ---- 晨: seven glasses ---- */
      ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
      [['#c9c2ff', .15, .12, 760], ['#bfeee2', .9, .45, 700], ['#ffd9c7', .25, .92, 720], ['#d6e4ff', .8, 1, 520]].forEach(([c, x, y, r]) => { const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, sc(r)); g.addColorStop(0, hex(c, .8)); g.addColorStop(1, hex(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      caption(`600 ${sc(76)}px ${SANS}`, `第 ${isoWeek(start)} 周`, range);
      const gw = sc(106), gap = (W - 2 * Pd - 7 * gw) / 6, top = sc(330), bot = sc(1000), most = Math.max(1, ...byDay.map(d => d.reduce((m, e) => m + 1 + Math.min(e.min || 0, 90) / 30, 0)));
      byDay.forEach((list, d) => {
        const x = Pd + d * (gw + gap), inset = sc(8), path = () => { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + inset, bot - sc(26)); ctx.quadraticCurveTo(x + inset, bot, x + inset + sc(26), bot); ctx.lineTo(x + gw - inset - sc(26), bot); ctx.quadraticCurveTo(x + gw - inset, bot, x + gw - inset, bot - sc(26)); ctx.lineTo(x + gw, top); };
        path(); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
        ctx.save(); path(); ctx.closePath(); ctx.clip();
        const room = bot - top - sc(40), unit = room / Math.max(most, 4); let y = bot;
        list.forEach((e, i) => {
          const hgt = unit * (1 + Math.min(e.min || 0, 90) / 30), c = mixWhite(groupColor(e.group), .55), g = ctx.createLinearGradient(x, 0, x + gw, 0);
          g.addColorStop(0, c); g.addColorStop(.5, mixWhite(groupColor(e.group), .72)); g.addColorStop(1, c);
          ctx.fillStyle = g; ctx.fillRect(x, y - hgt, gw, hgt); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x, y - hgt, gw, sc(i === list.length - 1 ? 3 : 1.4)); y -= hgt;
        });
        ctx.restore();
        path(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = sc(2.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + sc(16), top + sc(30)); ctx.lineTo(x + sc(22), bot - sc(60)); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = sc(5); ctx.lineCap = 'round'; ctx.stroke();
        ctx.fillStyle = L.muted; ctx.font = `400 ${sc(26)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(`周${'一二三四五六日'[d]}`, x + gw / 2, bot + sc(56));
        ctx.fillStyle = L.ink; ctx.font = `600 ${sc(30)}px ${SANS}`; ctx.fillText(String(list.length), x + gw / 2, bot + sc(98)); ctx.textAlign = 'left';
      });
      footer(`600 ${sc(44)}px ${SANS}`);
      return canvas;
    }

    if (mat === 'paper') { /* ---- 昼: a manuscript page, written right to left ---- */
      ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
      { const r = rng(4); for (let i = 0; i < W * H / 40; i++) { ctx.fillStyle = `rgba(90,70,40,${.05 * r()})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5); } }
      const cell = sc(96), rows = 8, gx = W - Pd - 7 * cell, gy = sc(250), red = '#b43a2c';
      for (let d = 0; d < 7; d++) {
        const x = W - Pd - (d + 1) * cell, list = byDay[d];
        ctx.fillStyle = red; ctx.font = `400 ${sc(26)}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText(`周${'一二三四五六日'[d]}`, x + cell / 2, gy - sc(22));
        for (let r = 0; r < rows; r++) {
          const y = gy + r * cell, cx = x + cell / 2, cy = y + cell / 2;
          ctx.strokeStyle = hex(red, .45); ctx.lineWidth = sc(1.3); ctx.strokeRect(x, y, cell, cell);
          ctx.save(); ctx.setLineDash([sc(4), sc(5)]); ctx.strokeStyle = hex(red, .15); ctx.lineWidth = sc(1); ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + cell, cy); ctx.moveTo(cx, y); ctx.lineTo(cx, y + cell); ctx.stroke(); ctx.restore();
          const e = list[r]; if (!e) continue;
          const more = r === rows - 1 && list.length > rows;
          ctx.fillStyle = '#1d1a16'; ctx.font = `300 ${sc(more ? 34 : 58)}px ${SONG}`; ctx.fillText(more ? `+${list.length - rows + 1}` : firstChar(e.title), cx, cy + sc(more ? 12 : 20));
          if (!more && (e.min || 0) >= 20) { const q = rng(hash(`${e.id}${e.at}`)); ctx.save(); ctx.translate(cx, cy); ctx.rotate((q() - .5) * .8); ctx.strokeStyle = red; ctx.lineWidth = sc(3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(0, 0, sc(38), sc(35), 0, .25, Math.PI * 2 - .05); ctx.stroke(); ctx.restore(); }
        }
      }
      ctx.textAlign = 'center';
      Array.from(`第${CN(isoWeek(start))}周`).forEach((ch, i) => { ctx.fillStyle = '#1d1a16'; ctx.font = `300 ${sc(64)}px ${SONG}`; ctx.fillText(ch, Pd + sc(44), gy + sc(60) + i * sc(80)); });
      Array.from(`${CN(start.getMonth() + 1)}月${CN(start.getDate())}日起`).forEach((ch, i) => { ctx.fillStyle = L.muted; ctx.font = `400 ${sc(24)}px ${SONG}`; ctx.fillText(ch, Pd + sc(130), gy + sc(40) + i * sc(34)); });
      // seal
      const sx = Pd + sc(4), sy = gy + rows * cell - sc(150), s = sc(140);
      ctx.save(); ctx.translate(sx + s / 2, sy + s / 2); ctx.rotate(-.05); ctx.fillStyle = red; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = '#f5f2ec'; ctx.font = `600 ${sc(50)}px ${SONG}`; [['碎', -1, -1], ['碎', -1, 1], ['清', 1, -1], ['单', 1, 1]].forEach(([c, cxk, cyk]) => ctx.fillText(c, -cxk * s * .23, cyk * s * .23 + sc(17)));
      { const r = rng(11); ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 180; i++) { ctx.fillStyle = `rgba(0,0,0,${.3 + r() * .5})`; ctx.fillRect((r() - .5) * s, (r() - .5) * s, sc(1 + r() * 3), sc(1 + r() * 2)); } }
      ctx.restore(); ctx.textAlign = 'left';
      ctx.fillStyle = '#1d1a16'; ctx.font = `300 ${sc(40)}px ${SONG}`; ctx.fillText(entries.length ? `${CN(entries.length)}件事` : '这一页还空着', Pd, H - Pd - sc(70));
      ctx.fillStyle = L.muted; ctx.font = `400 ${sc(26)}px ${SONG}`; ctx.fillText(entries.length ? `${st.focusText ? `${st.focusText}，` : ''}周${st.busiest}写得最多。朱圈是专注过的事` : '完成一件事，就写下第一个字', Pd, H - Pd - sc(24));
      return canvas;
    }

    if (mat === 'gold') { /* ---- 暮: the week as a setting sun ---- */
      ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
      const hz = sc(900), cx = W / 2, R = sc(118);
      { const g = ctx.createRadialGradient(cx, hz, 0, cx, hz, sc(820)); g.addColorStop(0, 'rgba(200,150,90,.26)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      const span = 7 * 864e5, rays = entries.map((e, i) => { const r = rng(hash(`${e.id}${e.at}`)), f = clamp((e.at - start.getTime()) / span, 0, 1); return { a: Math.PI - (.04 + f * .92) * Math.PI + (r() - .5) * .02, len: sc(170 + Math.min(e.min || 0, 120) * 2.6 + r() * 120), w: sc(5 + r() * 5 + Math.min(e.min || 0, 90) / 18), e }; });
      const drawRays = (mirror, alpha) => rays.forEach(({ a, len, w }) => {
        const dx = Math.cos(a), dy = -Math.sin(a) * mirror, px = -dy, py = dx, r0 = R + sc(26), x0 = cx + dx * r0, y0 = hz + dy * r0, x1 = cx + dx * (r0 + len), y1 = hz + dy * (r0 + len);
        const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(244,232,204,${alpha})`); g.addColorStop(.35, `rgba(200,166,106,${alpha * .9})`); g.addColorStop(1, 'rgba(156,127,71,0)');
        ctx.beginPath(); ctx.moveTo(x0 + px * w / 2, y0 + py * w / 2); ctx.lineTo(x1, y1); ctx.lineTo(x0 - px * w / 2, y0 - py * w / 2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      });
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip(); drawRays(1, 1);
      const sun = ctx.createRadialGradient(cx - R * .3, hz - R * .4, 0, cx, hz, R); sun.addColorStop(0, '#f4e8cc'); sun.addColorStop(.6, '#c8a66a'); sun.addColorStop(1, '#9c7f47'); ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, hz, R, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip(); ctx.globalAlpha = .22; drawRays(-.55, .8); ctx.restore();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(200,166,106,${.32 - i * .045})`; const wv = R * (1.6 - i * .2); ctx.fillRect(cx - wv, hz + sc(16 + i * 18), wv * 2, sc(2)); }
      ctx.fillStyle = 'rgba(200,166,106,.7)'; ctx.fillRect(Pd, hz, W - 2 * Pd, sc(1.5));
      ctx.textAlign = 'center'; ctx.font = `italic 400 ${sc(28)}px ${SERIF}`;
      ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].forEach((t, d) => { const a = Math.PI - (.04 + (d + .5) / 7 * .92) * Math.PI, rr = sc(520); ctx.fillStyle = byDay[d].length ? 'rgba(200,166,106,.8)' : 'rgba(200,166,106,.3)'; ctx.fillText(t, cx + Math.cos(a) * rr, hz - Math.sin(a) * rr); });
      ctx.textAlign = 'left';
      caption(`400 ${sc(80)}px ${SERIF}`, `第 ${isoWeek(start)} 周`, range, '#c8a66a', L.muted);
      footer(`400 ${sc(46)}px ${SERIF}`, '#efe6d6');
      return canvas;
    }

    /* ---- 夜 (and the free preview): a star map, one constellation per day ---- */
    ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
    { const r = rng(17); for (let i = 0; i < 300; i++) { const s = r() < .05 ? 2 : .5 + r(); ctx.fillStyle = `rgba(225,232,255,${.08 + r() * .4})`; ctx.beginPath(); ctx.arc(r() * W, r() * H, sc(s), 0, 7); ctx.fill(); } }
    const cx = W / 2, cy = sc(680), R = sc(410);
    { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2); g.addColorStop(0, mat === 'plain' ? 'rgba(80,140,255,.10)' : 'rgba(90,110,190,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.strokeStyle = 'rgba(223,230,255,.18)'; ctx.lineWidth = sc(1.2); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.save(); ctx.setLineDash([sc(2), sc(10)]); [R * .36, R * .68].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }); ctx.restore();
    ctx.textAlign = 'center'; ctx.font = `400 ${sc(24)}px ${SANS}`;
    for (let d = 0; d < 7; d++) {
      const a0 = -Math.PI / 2 + d / 7 * Math.PI * 2, am = a0 + Math.PI / 7;
      ctx.strokeStyle = 'rgba(223,230,255,.08)'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * sc(40), cy + Math.sin(a0) * sc(40)); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.stroke();
      ctx.fillStyle = byDay[d].length ? 'rgba(223,230,255,.75)' : 'rgba(223,230,255,.3)'; ctx.fillText(`周${'一二三四五六日'[d]}`, cx + Math.cos(am) * (R + sc(42)), cy + Math.sin(am) * (R + sc(42)) + sc(8));
      const pts = byDay[d].map(e => { const when = new Date(e.at), hr = when.getHours() + when.getMinutes() / 60, r = rng(hash(`${e.id}${e.at}`)), a = a0 + (.12 + .76 * (hr / 24) + (r() - .5) * .1) * Math.PI * 2 / 7, rad = sc(70) + (R - sc(100)) * clamp((hr - 5) / 19 + (r() - .5) * .08, .04, 1); return { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad, e }; });
      if (pts.length > 1) { ctx.strokeStyle = 'rgba(223,230,255,.34)'; ctx.lineWidth = sc(1.4); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
      pts.forEach((p, i) => {
        const s = sc(9 + Math.min(p.e.min || 0, 90) / 7), col = mat === 'plain' ? groupColor(p.e.group) : L.shards[(hash(p.e.id) + i) % 3];
        ctx.save(); ctx.translate(p.x, p.y); ctx.shadowColor = col; ctx.shadowBlur = s * 1.6; ctx.fillStyle = '#f4f6ff';
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .12, -s * .12, s, 0); ctx.quadraticCurveTo(s * .12, s * .12, 0, s); ctx.quadraticCurveTo(-s * .12, s * .12, -s, 0); ctx.quadraticCurveTo(-s * .12, -s * .12, 0, -s); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = hex(col.startsWith('#') ? col : '#9fb4ff', .25); ctx.beginPath(); ctx.arc(0, 0, s * 1.4, 0, 7); ctx.fill(); ctx.restore();
      });
    }
    ctx.textAlign = 'left';
    caption(`300 ${sc(80)}px ${SANS}`, `第 ${isoWeek(start)} 周`, range);
    footer(`500 ${sc(44)}px ${SANS}`);
    return canvas;
  }

  /* ---------- Demo data for previews (free users see what Pro makes) ---------- */
  function demoEntries(start = weekStart(), n = 26) {
    const r = rng(42), groups = API.state.groups.map(g => g.id);
    return Array.from({ length: n }, (_, i) => { const d = Math.floor(r() * 7), h = 8 + Math.floor(r() * 14); return { id: `demo-${i}`, at: start.getTime() + d * 864e5 + h * 36e5 + Math.floor(r() * 60) * 6e4, group: groups[i % groups.length], min: r() < .5 ? Math.round(r() * 90) : 0 }; });
  }

  /* ---------- Applying a theme to the app ---------- */
  function applyTheme() {
    const html = document.documentElement, id = activeTheme(), t = THEMES[id];
    if (API.lockMode) return;
    if (!t) {
      if (html.dataset.proTheme) { delete html.dataset.proTheme; window.SuiSuiSkins.unmount(); API.applySettings(); }
      return;
    }
    html.dataset.proTheme = id; html.dataset.style = t.base; html.dataset.palette = 'pro';
    const r = html.style;
    r.setProperty('--accent', t.accent); r.setProperty('--accent-fill', t.accent); r.setProperty('--accent-soft', t.soft); r.setProperty('--on-accent', t.on);
    r.setProperty('--pro-font', t.font);
    if (id === 'day') r.setProperty('--app-font', t.font);
    window.SuiSuiSkins.mount(id);
  }
  function setTheme(id) {
    if (!isPro()) { startTry(id === 'auto' ? byTime() : id); return; }
    S().proTheme = S().proTheme === id ? '' : id; persist(); applyTheme(); refreshAll();
  }
  let tryTimer = 0;
  function startTry(id) {
    if (id === 'auto') id = byTime();
    tryOn = id; applyTheme(); closeSheet();
    const bar = $('pro-tryon'); bar.hidden = false;
    bar.querySelector('b').textContent = `正在试穿「${THEMES[id].full}」`;
    clearTimeout(tryTimer); tryTimer = setTimeout(() => endTry(true), 90000);
    API.render(); refreshAll();
  }
  function endTry(announce) {
    if (!tryOn) return;
    tryOn = ''; clearTimeout(tryTimer); $('pro-tryon').hidden = true; applyTheme(); API.render(); refreshAll();
    if (announce) API.showToast('试穿结束，已换回原来的样子');
  }

  /* ---------- UI: entries into Pro ---------- */
  function mount() {
    const shell = document.createElement('div');
    shell.innerHTML = `
      <div class="pro-tryon" id="pro-tryon" hidden role="status"><b></b><span>完成一件事试试效果</span><button type="button" id="pro-tryon-end">换回</button><button type="button" class="pro-tryon-buy" id="pro-tryon-buy">解锁</button></div>
      <section class="pro-sheet" id="pro-sheet" hidden aria-label="碎碎清单 Pro"></section>
      <section class="pro-sheet pro-jar-sheet" id="pro-jar-sheet" hidden aria-label="碎片罐"></section>
      <div class="pro-celebrate" id="pro-celebrate" hidden role="dialog" aria-label="今天全部完成"></div>`;
    document.body.append(...shell.children);
    $('pro-tryon-end').addEventListener('click', () => endTry(false));
    $('pro-tryon-buy').addEventListener('click', () => openSheet());
    // Settings home: the Pro entry under the lock preview
    const hero = $('home-hero');
    if (hero) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pro-banner'; b.id = 'pro-banner';
      b.innerHTML = `<canvas id="pro-banner-jar" aria-hidden="true"></canvas><span class="pro-banner-text"><b>碎碎清单 Pro</b><small>主题、碎片罐、完成动效，都在这里</small></span><span class="pro-banner-state" id="pro-banner-state"></span>`;
      hero.after(b); b.addEventListener('click', () => openSheet());
    }
    // Today: the jar next to the progress ring
    const side = $('today-side');
    if (side) {
      const j = document.createElement('button'); j.type = 'button'; j.className = 'pro-jar-button'; j.id = 'pro-jar-button'; j.setAttribute('aria-label', '碎片罐');
      j.innerHTML = '<canvas id="pro-jar-mini" aria-hidden="true"></canvas><span class="pro-lock-badge" id="pro-jar-lock">' + icon('lock') + '</span>';
      side.prepend(j); j.addEventListener('click', () => isPro() ? openJar() : openSheet('jar'));
    }
    // Today: countdowns under the heading
    const top = document.querySelector('#tasks-panel .today-top');
    if (top) { const c = document.createElement('div'); c.className = 'pro-countdowns'; c.id = 'pro-countdowns'; top.after(c); }
    // Lock view (Android): countdowns under the clock
    const clock = document.querySelector('.lock-clock');
    if (clock) { const c = document.createElement('div'); c.className = 'pro-countdowns lock-countdowns'; c.id = 'pro-lock-countdowns'; clock.after(c); }
    // 外观: Pro themes and effects stay visible with a lock
    const appLook = document.querySelector('.look-section[data-look=app] .ui-styles');
    if (appLook) { const f = document.createElement('fieldset'); f.className = 'pro-look'; f.id = 'pro-look'; appLook.after(f); }
    const motionSet = document.querySelector('.motion-settings');
    if (motionSet) { const f = document.createElement('div'); f.className = 'pro-effects-inline'; f.id = 'pro-effects-inline'; motionSet.append(f); }
    document.addEventListener('click', e => { if (e.target.closest('[data-settings-page=look]')) loadThumbFonts(); }, true);
    // Choosing a free interface style takes off a Pro theme
    document.addEventListener('click', e => { if (e.target.closest('[data-ui-style]') && S().proTheme) { S().proTheme = ''; setTimeout(() => { applyTheme(); refreshAll(); }, 0); } }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('pro-celebrate').hidden) closeCelebrate(); else if (!$('pro-jar-sheet').hidden) closeJar(); else if (!$('pro-sheet').hidden) closeSheet(); } });
  }

  function themeMock(id) { return window.SuiSuiSkins.mock(id); }
  function loadThumbFonts() { /* the themes use system and bundled fonts only; nothing to wait for */ }
  function renderLookInline() {
    const f = $('pro-look'); if (!f) return;
    const pro = isPro(), cur = tryOn || (pro ? S().proTheme || '' : '');
    f.innerHTML = `<legend>Pro 主题 · 一日四时${pro ? '' : '<span class="pro-pill">Pro</span>'}</legend><div class="pro-theme-row">${['auto', ...ORDER].map(id => `<button type="button" class="pro-theme-chip${cur === id ? ' active' : ''}" data-pro-theme-pick="${id}" aria-pressed="${cur === id}">${themeMock(id)}<strong>${id === 'auto' ? '跟随时间' : THEMES[id].full}</strong><small>${id === 'auto' ? `现在是${THEMES[byTime()].name}` : pro ? (cur === id ? '使用中' : '使用') : '试穿'}</small>${pro ? '' : `<span class="pro-lock-badge">${icon('lock')}</span>`}</button>`).join('')}</div>`;
    f.querySelectorAll('[data-pro-theme-pick]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.proThemePick)));
    const e = $('pro-effects-inline');
    if (e) {
      const curE = S().proEffect || 'auto';
      e.innerHTML = `<div class="ag-row"><h3 class="ag-title">完成动效${pro ? '' : '<span class="pro-pill">Pro</span>'}</h3></div><div class="pro-effect-row">${Object.keys(EFFECTS).map(id => `<button type="button" class="chip${pro && curE === id ? ' active' : ''}" data-pro-effect-pick="${id}">${EFFECTS[id]}${pro ? '' : icon('lock', 'pro-chip-lock')}</button>`).join('')}</div>`;
      e.querySelectorAll('[data-pro-effect-pick]').forEach(b => b.addEventListener('click', () => { if (!isPro()) { openSheet('effects'); return; } S().proEffect = b.dataset.proEffectPick; persist(); renderLookInline(); }));
    }
    API.icons(f); if (e) API.icons(e);
  }

  /* ---------- The Pro page ---------- */
  function openSheet(section = '') {
    loadThumbFonts();
    const s = $('pro-sheet'); renderSheet(); s.hidden = false; document.body.classList.add('pro-open');
    s.scrollTop = 0; startHero();
    if (section) requestAnimationFrame(() => s.querySelector(`[data-pro-section=${section}]`)?.scrollIntoView({ block: 'start' }));
  }
  function closeSheet() { const s = $('pro-sheet'); if (s.hidden) return; s.hidden = true; document.body.classList.remove('pro-open'); stopHero(); }
  function renderSheet() {
    const s = $('pro-sheet'), pro = isPro(), owned = info().owned, cur = activeTheme(), curE = S().proEffect || 'auto';
    s.innerHTML = `
      <header class="pro-hero">
        <button type="button" class="pro-close" id="pro-close" aria-label="关闭">${icon('x')}</button>
        <canvas id="pro-hero-jar" aria-hidden="true"></canvas>
        <h1>碎碎清单 Pro</h1>
        <p>每做完一件事，都变成一片光，收进你的碎片罐。</p>
        ${pro ? `<span class="pro-state">${status()}</span>` : ''}
      </header>

      <section class="pro-part" data-pro-section="effects">
        <h2>完成的那一下</h2>
        <p class="pro-lead">点圆圈试试。六种完成动效，每一种都配了声音。</p>
        <div class="pro-demo-row"><button type="button" class="pro-demo-check" id="pro-demo-check" aria-label="试一下完成动效"><span class="check-circle"></span></button><span class="pro-demo-title" id="pro-demo-title">把锁屏待办的想法做出来</span></div>
        <div class="pro-effect-grid">${Object.keys(EFFECTS).filter(id => id !== 'auto').map(id => `<button type="button" class="pro-effect${(pro ? curE === id : id === (demoPick || 'shards')) ? ' active' : ''}" data-pro-effect="${id}"><b>${EFFECTS[id]}</b><small>${EFFECT_LINE[id]}</small></button>`).join('')}
        ${pro ? `<button type="button" class="pro-effect${curE === 'auto' ? ' active' : ''}" data-pro-effect="auto"><b>跟随主题</b><small>每个主题用自己的动效</small></button>` : ''}</div>
      </section>

      <section class="pro-part" data-pro-section="themes">
        <h2>一日四时</h2>
        <p class="pro-lead">一天里的四个时刻，四种看今天的方式：清晨的杯子一点点满起来，白天在稿纸上一格一格圈掉，傍晚太阳随着进度落下，夜里每件事是一颗星。打开“跟随时间”，一天里会自己换。${pro ? '' : '每套都可以先试穿 90 秒。'}</p>
        <div class="pro-themes">${['auto', ...ORDER].map(id => { const t = THEMES[id], on = (pro ? S().proTheme : tryOn) === id; return `<article class="pro-theme${on ? ' active' : ''}" data-theme-card="${id}">${themeMock(id)}<h3>${id === 'auto' ? '跟随时间' : t.full}</h3><p>${id === 'auto' ? '晨 5 点，昼 10 点，暮 17 点，夜 20 点' : t.line}</p><small>${id === 'auto' ? `现在是${THEMES[byTime()].full}` : `碎成${{ glass: '玻璃', paper: '纸屑', gold: '金箔', light: '光点' }[t.material]} · ${{ glass: '玻璃轻响', paper: '纸页一声', chime: '铜铃余音', night: '夜里一声轻响' }[t.sound]}`}</small><button type="button" data-pro-theme="${id}">${pro ? (on ? '使用中' : '使用') : '试穿'}</button></article>`; }).join('')}
        ${SOON.map(t => `<article class="pro-theme soon"><span class="pro-mock" data-mock="soon" aria-hidden="true">${icon('sparkles')}</span><h3>${t.name}</h3><p>${t.line}</p><small>即将上线，已购用户免费</small></article>`).join('')}</div>
      </section>

      <section class="pro-part" data-pro-section="jar">
        <h2>碎片罐和每周碎片画</h2>
        <p class="pro-lead">今天完成的事落进罐子；每周结束，这一周按你做事的时间和分组，长成一幅只属于你的画。</p>
        <div class="pro-jar-demo"><canvas id="pro-demo-jar" aria-hidden="true"></canvas><img id="pro-demo-art" alt="每周碎片画示例"></div>
        <p class="pro-fine">${pro ? '在“今天”页右上角点罐子就能打开。' : '示例来自演示数据。'}</p>
      </section>

      <section class="pro-part">
        <h2>还有</h2>
        <ul class="pro-more">
          <li>${icon('calendar-clock')}<span><b>倒数日</b>考试、生日、出发的日子，挂在清单和锁屏上</span></li>
          <li>${icon('party-popper')}<span><b>清空时刻</b>当天全部做完，有一段专门的庆祝</span></li>
          <li>${icon('volume-2')}<span><b>主题音效</b>每个主题一套完成的声音</span></li>
          <li>${icon('gift')}<span><b>以后的新主题</b>一次买断，之后上线的主题都免费</span></li>
        </ul>
      </section>

      ${pro ? `<section class="pro-part" data-pro-section="settings">
        <h2>Pro 设置</h2>
        <label class="pro-switch"><span><b>完成音效</b><small>跟着主题换声音</small></span><input type="checkbox" class="switch" id="pro-sound" ${soundOn() ? 'checked' : ''}></label>
        <h3 class="pro-sub">倒数日</h3>
        <div class="pro-cd-list" id="pro-cd-list"></div>
        <form class="pro-cd-add" id="pro-cd-add"><input id="pro-cd-title" maxlength="12" placeholder="比如：考试" aria-label="倒数日名称" required><input type="date" id="pro-cd-date" aria-label="日期" required><button type="submit" class="primary-button">添加</button></form>
      </section>` : ''}

      <footer class="pro-buy" data-pay="${payPlatform()}">
        ${owned ? `<p class="pro-owned">${icon('badge-check')}已解锁 Pro，谢谢你。${info().via === 'code' ? '<small>兑换码解锁</small>' : info().via === 'appstore' ? '<small>App Store 购买</small>' : ''}</p>`
          : `<div class="pro-price"><b>${PRICE}</b><s>${LIST_PRICE}</s><span>首发价，一次买断，永久使用</span></div>
             <div class="pro-actions">${info().trialUsed ? '' : `<button type="button" class="pro-trial" id="pro-trial">免费试用 ${TRIAL_DAYS} 天</button>`}<button type="button" class="pro-cta" id="pro-buy">${payPlatform() === 'ios' ? 'App Store 购买' : '购买兑换码'}</button></div>
             ${payPlatform() === 'ios' ? '<p class="pro-paynote">用 Apple 账户付款。换了手机，点下面的“恢复购买”。</p>'
              : `<form class="pro-redeem" id="pro-redeem"><input id="pro-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="已有兑换码？输入兑换" aria-label="兑换码"><button type="submit">兑换</button></form>
                 <p class="pro-paynote" id="pro-paynote">付款后会收到一串兑换码，安卓和网页都能用。</p>`}`}
        <p class="pro-legal">${payPlatform() === 'ios' ? '<button type="button" id="pro-restore">恢复购买</button>' : '<span></span>'}<span>本地预览：付款是模拟的</span><button type="button" id="pro-reset">重置</button></p>
        <div class="pro-paypreview" role="group" aria-label="预览付款方式"><span>预览付款方式</span>${[['ios', 'iPhone'], ['android', '安卓'], ['web', '网页']].map(([id, n]) => `<button type="button" data-pay-preview="${id}" aria-pressed="${payPlatform() === id}">${n}</button>`).join('')}</div>
      </footer>`;
    API.icons(s);
    $('pro-close').addEventListener('click', closeSheet);
    $('pro-demo-check').addEventListener('click', playDemo);
    s.querySelectorAll('[data-pro-effect]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.proEffect;
      if (isPro()) { S().proEffect = id; persist(); renderLookInline(); } else demoPick = id;
      s.querySelectorAll('[data-pro-effect]').forEach(x => x.classList.toggle('active', x === b));
      if (id !== 'auto') playDemo();
    }));
    s.querySelectorAll('[data-pro-theme]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.proTheme)));
    $('pro-buy')?.addEventListener('click', () => {
      if (payPlatform() === 'ios') { buy(); return; }
      const note = $('pro-paynote'); if (!note) return;
      note.innerHTML = `正式版会打开付款页，付完显示兑换码。本地预览可以用这个：<button type="button" id="pro-fill-code">${demoCode}</button>`;
      $('pro-fill-code').addEventListener('click', () => { $('pro-code').value = demoCode; $('pro-code').focus(); });
    });
    $('pro-redeem')?.addEventListener('submit', e => { e.preventDefault(); redeem($('pro-code').value); });
    s.querySelectorAll('[data-pay-preview]').forEach(b => b.addEventListener('click', () => { payPreview = b.dataset.payPreview; renderSheet(); s.querySelector('.pro-buy')?.scrollIntoView({ block: 'end' }); }));
    $('pro-trial')?.addEventListener('click', startTrial);
    $('pro-restore')?.addEventListener('click', restore);
    $('pro-reset').addEventListener('click', resetLocal);
    $('pro-sound')?.addEventListener('change', e => { S().proSound = e.target.checked; persist(); if (e.target.checked) playSound(themeSound()); });
    $('pro-cd-add')?.addEventListener('submit', addCountdown);
    renderCountdownList();
    // Demo jar + art
    const dj = $('pro-demo-jar'); if (dj) { const ctx = canvasFor(dj, 132, 168); drawJarWith(BRAND, ctx, 8, 6, 116, 156, demoEntries(startOfDay(), 9), 0); }
    const art = drawArt(pro && logBetween(weekStart().getTime(), Date.now() + 1).length ? logBetween(weekStart().getTime(), weekStart().getTime() + 7 * 864e5) : demoEntries(), weekStart(), look(), 540);
    $('pro-demo-art').src = art.toDataURL('image/png');
  }
  let demoPick = '';
  function playDemo() {
    const title = $('pro-demo-title'), check = $('pro-demo-check');
    if (!title || title.dataset.busy) return;
    const pick = isPro() ? ((S().proEffect || 'auto') === 'auto' ? (THEMES[activeTheme()]?.effect || 'shards') : S().proEffect) : (demoPick || 'shards');
    title.dataset.busy = '1'; check.classList.add('done');
    playSound(isPro() && !(S().proEffect && S().proEffect !== 'auto') ? themeSound() : ({ shards: themeSound() === 'soft' ? 'glass' : themeSound(), stardust: 'glass', ink: 'wood', dots: 'click', gold: 'chime' }[pick] || 'soft'));
    const run = pick === 'shatter' ? shatterDemo(title) : (demoEffect = pick, FX[pick](title, sampleText(title, pick === 'dots' ? 4 : pick === 'stardust' ? 2 : pick === 'shards' ? 6 : 3)));
    demoEffect = '';
    title.style.visibility = 'hidden';
    Promise.resolve(run).then(() => setTimeout(() => { title.style.visibility = ''; check.classList.remove('done'); delete title.dataset.busy; title.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }, 700));
  }
  function shatterDemo(el) {
    const r = el.getBoundingClientRect(), layer = $('fragments'), cols = 8;
    for (let i = 0; i < cols * 2; i++) {
      const p = document.createElement('div'), x = i % cols, y = Math.floor(i / cols);
      Object.assign(p.style, { position: 'fixed', left: `${r.left + x * r.width / cols}px`, top: `${r.top + y * r.height / 2}px`, width: `${r.width / cols}px`, height: `${r.height / 2}px`, background: 'rgba(160,200,255,.35)', clipPath: i % 3 ? 'polygon(0 0,100% 0,0 100%)' : 'polygon(100% 0,100% 100%,0 100%)' });
      layer.append(p);
      p.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(x / cols - .5) * 160}px,${-40 - Math.random() * 60}px) rotate(${(Math.random() - .5) * 140}deg) scale(.3)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => p.remove();
    }
    return new Promise(res => setTimeout(res, 520));
  }
  let heroRaf = 0;
  function startHero() {
    stopHero();
    const c = $('pro-hero-jar'); if (!c) return;
    const W = 170, H = 214, ctx = canvasFor(c, W, H), base = demoEntries(startOfDay(), 8), t0 = performance.now(), still = reduce();
    const frame = now => {
      const ms = now - t0, shown = still ? base.length : Math.min(base.length, Math.floor(ms / 700) + 2);
      ctx.clearRect(0, 0, W, H);
      drawJarWith(BRAND, ctx, 22, 12, 126, 190, base.slice(0, shown), still ? 0 : ms);
      if (!still && shown < base.length) { // one shard falling into the jar
        const t = (ms % 700) / 700, x = 85 + Math.sin(shown) * 18, y = -10 + easeIn(t) * 120;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4); ctx.fillStyle = hex(BRAND.shards[shown % 4], .85); ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (!still && !$('pro-sheet').hidden) heroRaf = requestAnimationFrame(frame);
    };
    heroRaf = requestAnimationFrame(frame);
  }
  function stopHero() { cancelAnimationFrame(heroRaf); heroRaf = 0; }
  /** The Pro page's own jar: brand colours, whatever theme is on. */
  function drawJarWith(brand, ctx, x, y, w, h, entries, ms) {
    const { shards } = pile(entries, jarShape(x, y, w, h), 4, w / 7, (e, k) => brand.shards[(hash(`${e.id}${e.at}`) + k) % brand.shards.length]);
    window.SuiSuiSkins.jar('plain', ctx, x, y, w, h, shards, { ms, onDark: true }); return shards.length;
  }

  /* ---------- The jar page ---------- */
  let jarRaf = 0, weekOffset = 0;
  function openJar() { weekOffset = 0; const s = $('pro-jar-sheet'); renderJar(); s.hidden = false; s.scrollTop = 0; document.body.classList.add('pro-open'); }
  function closeJar() { const s = $('pro-jar-sheet'); s.hidden = true; document.body.classList.remove('pro-open'); cancelAnimationFrame(jarRaf); tiltOff?.(); }
  function renderJar() {
    const s = $('pro-jar-sheet'), L = look(); s.style.setProperty('--js-bg', L.bg); s.style.setProperty('--js-ink', L.ink); s.style.setProperty('--js-muted', L.muted); s.dataset.light = LIGHT.includes(activeTheme()) ? '1' : '';
    const today = todayLog(), ws = new Date(weekStart().getTime() + weekOffset * 7 * 864e5), we = ws.getTime() + 7 * 864e5, week = logBetween(ws.getTime(), we);
    const days = Array.from({ length: 7 }, (_, d) => logBetween(ws.getTime() + d * 864e5, ws.getTime() + (d + 1) * 864e5));
    s.innerHTML = `
      <header class="pro-jar-top"><button type="button" class="pro-close" id="pro-jar-close" aria-label="关闭">${icon('x')}</button><h1>碎片罐</h1></header>
      <div class="pro-jar-big"><canvas id="pro-jar-big" aria-hidden="true"></canvas><p><b>${today.length}</b> 件今天完成${today.length ? '' : '，第一片还在路上'}</p>${today.length ? '<small>拖动罐子，或倾斜手机，碎片会滚动</small>' : ''}</div>
      <div class="pro-week-nav"><button type="button" class="icon-button" id="pro-week-prev" aria-label="上一周">${icon('chevron-left')}</button><strong>${weekOffset ? `第 ${isoWeek(ws)} 周` : '这一周'}</strong><button type="button" class="icon-button" id="pro-week-next" aria-label="下一周" ${weekOffset >= 0 ? 'disabled' : ''}>${icon('chevron-right')}</button></div>
      <div class="pro-week">${days.map((d, i) => `<span><canvas data-day-jar="${i}" aria-hidden="true"></canvas><small>周${'一二三四五六日'[i]}</small><b>${d.length}</b></span>`).join('')}</div>
      <div class="pro-art"><img id="pro-art-img" alt="本周碎片画"><button type="button" class="primary-button" id="pro-art-save">${icon('image-down')}保存这幅碎片画</button></div>`;
    API.icons(s);
    $('pro-jar-close').addEventListener('click', closeJar);
    $('pro-week-prev').addEventListener('click', () => { weekOffset--; renderJar(); });
    $('pro-week-next').addEventListener('click', () => { if (weekOffset < 0) { weekOffset++; renderJar(); } });
    s.querySelectorAll('[data-day-jar]').forEach(c => { const ctx = canvasFor(c, 34, 44); drawJar(ctx, 2, 2, 30, 40, days[Number(c.dataset.dayJar)], { per: 2, sz: 6, lid: false }); });
    const art = drawArt(week, ws, look(), 1080);
    $('pro-art-img').src = art.toDataURL('image/png');
    $('pro-art-save').addEventListener('click', () => API.saveImage(art, `碎碎清单-第${isoWeek(ws)}周碎片画.png`));
    physicsJar($('pro-jar-big'), today, s);
  }
  /** The big jar: shards fall in one by one, pile up, and roll when the jar is dragged or the phone is tilted. */
  let tiltOff = null;
  function physicsJar(canvas, entries, sheet) {
    cancelAnimationFrame(jarRaf); tiltOff?.();
    const W = 220, H = 280, ctx = canvasFor(canvas, W, H), jx = 20, jy = 8, jw = 180, jh = 264, J = jarShape(jx, jy, jw, jh), kind = jarKind();
    const vase = false, L = look(), neckL = vase ? jx + jw * .35 : J.nx, neckR = vase ? jx + jw * .65 : J.nx + J.neck;
    const left = jx + (vase ? jw * .1 : 4), right = jx + jw - (vase ? jw * .1 : 4), bottom = jy + jh - 5, bodyTop = vase ? jy + jh * .24 : J.bodyTop + J.r * .5, R = vase ? jw * .32 : J.r;
    const queue = []; entries.forEach(e => { const r = rng(hash(`${e.id}${e.at}`)); for (let k = 0; k < 5; k++) queue.push({ s: 20 * (.85 + r() * .5), color: shardColor(e, k, L), seed: hash(`${e.id}${e.at}${k}`), rot: r() * 6.28 }); });
    queue.splice(150);
    const bodies = []; let spawnAt = 0, g = [0, 1], calm = 0, last = performance.now(), t0 = last;
    if (reduce()) { // no motion: the settled pile, drawn once
      ctx.clearRect(0, 0, W, H); drawJar(ctx, jx, jy, jw, jh, entries, { per: 5, sz: 22 }); return;
    }
    const spawn = () => { const q = queue.shift(); if (!q) return; bodies.push({ ...q, x: (neckL + neckR) / 2 + (Math.random() - .5) * 14, y: jy + jh * .08, vx: (Math.random() - .5) * 40, vy: 60, vr: (Math.random() - .5) * 6, r: q.s * .38 }); };
    const wall = b => {
      const top = b.y < bodyTop, lo = top ? neckL : left, hi = top ? neckR : right;
      if (b.x < lo + b.r) { b.x = lo + b.r; b.vx = Math.abs(b.vx) * .25; b.vr += b.vy * .004; }
      if (b.x > hi - b.r) { b.x = hi - b.r; b.vx = -Math.abs(b.vx) * .25; b.vr -= b.vy * .004; }
      if (b.y > bottom - b.r) { b.y = bottom - b.r; b.vy = -Math.abs(b.vy) * .2; b.vx *= .9; b.vr = b.vr * .8 + b.vx * .02; }
      if (b.y < jy + 6) { b.y = jy + 6; b.vy = Math.abs(b.vy) * .2; }
      for (const cx of [left + R, right - R]) { // rounded bottom corners
        const cy = bottom - R; if ((cx < (left + right) / 2 ? b.x < cx : b.x > cx) && b.y > cy) { const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), max = R - b.r; if (d > max) { const nx = dx / d, ny = dy / d; b.x = cx + nx * max; b.y = cy + ny * max; const vn = b.vx * nx + b.vy * ny; if (vn > 0) { b.vx -= 1.25 * vn * nx; b.vy -= 1.25 * vn * ny; } } }
      }
    };
    const step = dt => {
      for (const b of bodies) { b.vx += g[0] * 1500 * dt; b.vy += g[1] * 1500 * dt; b.vx *= .998; b.vy *= .998; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.vr *= .985; }
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { const imp = -1.15 * rv / 2; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; const tx = -ny, ty = nx, rt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty; a.vr += rt * .01; b.vr -= rt * .01; a.vx += tx * rt * .05; b.vx -= tx * rt * .05; }
        }
        bodies.forEach(wall);
      }
    };
    const frame = now => {
      if (sheet.hidden) return;
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      if (queue.length && now - t0 > spawnAt) { spawn(); spawnAt += queue.length > 40 ? 45 : 90; }
      step(dt / 2); step(dt / 2);
      ctx.clearRect(0, 0, W, H);
      window.SuiSuiSkins.jar(kind, ctx, jx, jy, jw, jh, bodies, { ms: now - t0, onDark: !LIGHT.includes(kind) });
      const moving = bodies.some(b => Math.abs(b.vx) + Math.abs(b.vy) > 12);
      calm = moving || queue.length ? 0 : calm + dt;
      jarRaf = requestAnimationFrame(frame);
    };
    jarRaf = requestAnimationFrame(frame);
    // Drag to shake; tilt to pour
    let drag = null;
    canvas.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); };
    canvas.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; bodies.forEach(b => { b.vx += dx * 14; b.vy += dy * 14; b.vr += dx * .05; }); };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
    const tilt = e => { if (e.gamma == null) return; const gx = Math.sin((e.gamma || 0) * Math.PI / 180), gy = Math.max(.25, Math.cos((e.gamma || 0) * Math.PI / 180) * Math.sign(Math.cos(((e.beta ?? 90) - 0) * Math.PI / 180) || 1)); const n = Math.hypot(gx, gy) || 1; g = [gx / n, gy / n]; };
    addEventListener('deviceorientation', tilt); tiltOff = () => removeEventListener('deviceorientation', tilt);
    const ask = window.DeviceOrientationEvent?.requestPermission; if (ask) canvas.addEventListener('click', () => ask().catch(() => {}), { once: true });
  }
  function drawMiniJar(bump) {
    const c = $('pro-jar-mini'); if (!c) return;
    const ctx = canvasFor(c, 30, 38); ctx.clearRect(0, 0, 30, 38);
    drawJar(ctx, 2, 1, 26, 36, todayLog(), { per: 2, sz: 5, dark: pageDark() });
    $('pro-jar-lock').hidden = isPro();
    if (bump && !reduce()) $('pro-jar-button').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16) rotate(-4deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
  function flyToJar(rect) {
    const jar = $('pro-jar-button'); if (!jar || reduce()) { drawMiniJar(false); return; }
    const j = jar.getBoundingClientRect(); if (!j.width || j.bottom < 0 || j.top > innerHeight) { drawMiniJar(false); return; }
    const L = look(), from = { x: rect.left + rect.width * .35, y: rect.top + rect.height / 2 }, to = { x: j.left + j.width / 2, y: j.top + j.height * .45 };
    const bits = Array.from({ length: 7 }, (_, i) => ({ d: i * 45, dx: (rng(i + 5)() - .5) * 60, c: L.shards[i % L.shards.length] }));
    overlay(900, (ctx, ms) => {
      for (const b of bits) {
        const t = clamp((ms - b.d) / 620); if (t <= 0 || t >= 1) continue;
        const e = easeOut(t), x = from.x + b.dx * (1 - e) + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(t * Math.PI) * 70;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5); ctx.globalAlpha = 1 - t * .3; ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(4, 3); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }, 0);
    setTimeout(() => drawMiniJar(true), 640);
  }

  /* ---------- 倒数日 ---------- */
  const countdowns = () => (Array.isArray(S().countdowns) ? S().countdowns : []).filter(c => c && typeof c.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date));
  const daysTo = date => { const [y, m, d] = date.split('-').map(Number); return Math.round((new Date(y, m - 1, d) - startOfDay()) / 864e5); };
  function addCountdown(e) {
    e.preventDefault();
    const title = $('pro-cd-title').value.trim(), date = $('pro-cd-date').value;
    if (!title || !date) return;
    S().countdowns = [...countdowns(), { id: `cd-${Date.now()}`, title: title.slice(0, 12), date }].slice(-5); persist();
    $('pro-cd-title').value = ''; renderCountdownList(); renderCountdowns(); API.showToast(`已添加倒数日「${title}」`);
  }
  function renderCountdownList() {
    const box = $('pro-cd-list'); if (!box) return;
    const list = countdowns();
    box.innerHTML = list.length ? list.map(c => `<div class="pro-cd-item"><span><b>${API.esc(c.title)}</b><small>${c.date}</small></span><em>${cdText(c)}</em><button type="button" class="icon-button" data-cd-del="${API.esc(c.id)}" aria-label="删除 ${API.esc(c.title)}">${icon('trash-2')}</button></div>`).join('') : '<p class="pro-fine">还没有倒数日。</p>';
    box.querySelectorAll('[data-cd-del]').forEach(b => b.addEventListener('click', () => { S().countdowns = countdowns().filter(c => c.id !== b.dataset.cdDel); persist(); renderCountdownList(); renderCountdowns(); }));
    API.icons(box);
  }
  function cdText(c) { const n = daysTo(c.date); return n > 0 ? `还有 ${n} 天` : n === 0 ? '就是今天' : `已过 ${-n} 天`; }
  function renderCountdowns() {
    window.SuiSuiSkins?.head();
    const list = isPro() ? countdowns().filter(c => daysTo(c.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)) : [];
    [$('pro-countdowns'), $('pro-lock-countdowns')].forEach(box => {
      if (!box) return;
      box.hidden = !list.length;
      box.innerHTML = list.map(c => { const n = daysTo(c.date); return `<span class="pro-cd"><b>${n || '今天'}</b>${n ? '<small>天</small>' : ''}<span>${API.esc(c.title)}</span></span>`; }).join('');
    });
  }

  /* ---------- 清空时刻 ---------- */
  function celebrate() {
    if (!isPro() || API.lockMode) return;
    const key = API.dayKey(); if (S().proCelebrated === key) return;
    S().proCelebrated = key; persist();
    const box = $('pro-celebrate'), today = todayLog(), focus = today.reduce((n, e) => n + (e.min || 0), 0), L = look();
    box.style.setProperty('--cel-bg', L.bg); box.style.setProperty('--cel-ink', L.ink); box.style.setProperty('--cel-muted', L.muted);
    box.innerHTML = `<canvas id="pro-cel-canvas" aria-hidden="true"></canvas><div class="pro-cel-text"><h2>今天的事，全部完成。</h2><p>${today.length} 件${focus ? `，专注 ${focus} 分钟` : ''}，都收进碎片罐了。</p><button type="button" id="pro-cel-close">收好了</button></div>`;
    box.hidden = false;
    $('pro-cel-close').addEventListener('click', closeCelebrate);
    box.addEventListener('click', e => { if (e.target === box) closeCelebrate(); });
    playSound(themeSound()); setTimeout(() => playSound(themeSound()), 260);
    const c = $('pro-cel-canvas'), W = Math.min(innerWidth, 520), H = 360, ctx = canvasFor(c, W, H), t0 = performance.now(), still = reduce();
    const rain = Array.from({ length: 36 }, (_, i) => { const r = rng(i * 7 + 1); return { x: W / 2 + (r() - .5) * 120, d: r() * 900, rot: r() * 6, c: L.shards[i % L.shards.length] }; });
    const frame = now => {
      const ms = now - t0; ctx.clearRect(0, 0, W, H);
      drawJar(ctx, W / 2 - 80, 110, 160, 230, today, { per: 6, sz: 20, ms: still ? 0 : ms });
      if (!still) for (const r of rain) { const t = clamp((ms - r.d) / 900); if (t <= 0 || t >= 1) continue; const y = -20 + easeIn(t) * 270; ctx.save(); ctx.translate(r.x, y); ctx.rotate(r.rot + t * 6); ctx.globalAlpha = 1 - t * .2; ctx.fillStyle = r.c; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (!box.hidden && !still && ms < 4000) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function closeCelebrate() { $('pro-celebrate').hidden = true; }
  function celebrateUnlock() { API.showToast('Pro 已解锁，去“外观”或“今天”页的罐子看看'); }

  /* ---------- Wiring ---------- */
  function refreshAll() {
    renderLookInline(); renderCountdowns(); drawMiniJar(false);
    const st = $('pro-banner-state'); if (st) st.textContent = isPro() ? (info().owned ? '已解锁' : `试用 ${trialLeft()} 天`) : PRICE;
    const bj = $('pro-banner-jar'); if (bj) { const ctx = canvasFor(bj, 44, 56); drawJarWith(BRAND, ctx, 4, 2, 36, 52, demoEntries(startOfDay(), 6), 0); }
    if (!$('pro-sheet').hidden) { const top = $('pro-sheet').scrollTop; renderSheet(); $('pro-sheet').scrollTop = top; startHero(); }
  }
  window.SuiSuiPro = { effect, isPro, redeem, demoCode, payPlatform, open: openSheet, openJar, drawArt, THEMES, EFFECTS, buy, startTrial, reset: resetLocal, tryTheme: startTry, endTry };
  mount();
  applyTheme(); refreshAll();
  window.addEventListener('suisui:settings', () => { applyTheme(); renderLookInline(); });
  window.addEventListener('suisui:render', () => { window.SuiSuiSkins.head(); renderCountdowns(); drawMiniJar(false); });
  window.addEventListener('suisui:completing', () => { if (isPro() || tryOn) playSound(themeSound()); });
  window.addEventListener('suisui:done', e => {
    const { rect, allDone } = e.detail || {};
    if (rect) flyToJar(rect); else drawMiniJar(true);
    if (allDone) setTimeout(celebrate, 900);
  });
  // A trial that ends while the app is open: the free look comes back.
  setInterval(() => { const was = document.documentElement.dataset.proTheme || ''; if (was !== activeTheme()) { applyTheme(); API.render(); refreshAll(); } }, 60000);
})();
