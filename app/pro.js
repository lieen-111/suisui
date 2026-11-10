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
  const THEMES = {
    aurora: { name: '极光', line: '深夜天幕，流光掠过', base: 'night', effect: 'stardust', sound: 'glass', accent: '#7ef0d8', soft: '#7ef0d81f', on: '#04211c',
      shards: ['#7ef0d8', '#7fb2ff', '#c59bff', '#e9fbff'], bg: '#070b1f', ink: '#eaf6ff', muted: '#8ea3c0', mode: 'screen', font: 'Geist,"PingFang SC","Microsoft YaHei",sans-serif' },
    ink: { name: '宣纸', line: '墨落纸上，盖一枚朱印', base: 'paper', effect: 'ink', sound: 'wood', accent: '#b8322a', soft: '#b8322a14', on: '#fff8ef',
      shards: ['#1d1a16', '#3d362e', '#6d6358', '#b8322a'], bg: '#f1ebdd', ink: '#1d1a16', muted: '#7a7166', mode: 'multiply', font: '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif' },
    darkroom: { name: '暗房', line: '红灯下，显影一整天', base: 'night', effect: 'burn', sound: 'shutter', accent: '#ff5b3a', soft: '#ff5b3a1c', on: '#1a0805',
      shards: ['#ff5b3a', '#ffb36b', '#9c2f1c', '#f3e2cf'], bg: '#120907', ink: '#f3e2cf', muted: '#9c8070', mode: 'screen', font: 'Geist,"PingFang SC","Microsoft YaHei",sans-serif' },
    pixel: { name: '像素', line: '四种绿，一台老掌机', base: 'night', effect: 'pixel', sound: 'chip', accent: '#9bbc0f', soft: '#9bbc0f26', on: '#0f380f',
      shards: ['#9bbc0f', '#8bac0f', '#306230', '#cfe28a'], bg: '#0f380f', ink: '#cfe28a', muted: '#8bac0f', mode: 'source-over', font: '"Courier New",ui-monospace,monospace' }
  };
  const SOON = [{ name: '猫咪', line: '一只猫陪你做完今天' }, { name: '二十四节气', line: '每个节气自动换装' }];
  const PLAIN = { shards: ['#9fd8ff', '#ffffff', '#a7b4ff', '#7ee0c8'], bg: '#0c0e14', ink: '#f1f3f7', muted: '#8b93a3', accent: '#9fd8ff', mode: 'screen', font: 'Geist,"PingFang SC","Microsoft YaHei",sans-serif' };
  const EFFECTS = { auto: '跟随主题', shatter: '碎裂', stardust: '星尘', ink: '墨染', plane: '纸飞机', burn: '燃尽', pixel: '像素' };
  const EFFECT_LINE = { shatter: '文字碎成玻璃片', stardust: '散成一把星尘', ink: '墨晕开，盖上朱印', plane: '折成纸飞机飞走', burn: '从左烧到右', pixel: '一格一格掉落' };

  /* ---------- Entitlement (simulated purchase in this build) ---------- */
  const info = () => { const p = S().pro; return p && typeof p === 'object' ? p : (S().pro = { owned: false, trialEnds: 0, trialUsed: false }); };
  const isPro = () => !!info().owned || (info().trialEnds || 0) > Date.now();
  const trialLeft = () => Math.max(0, Math.ceil(((info().trialEnds || 0) - Date.now()) / 864e5));
  const status = () => info().owned ? '已解锁' : isPro() ? `试用中 · 剩 ${trialLeft()} 天` : '';
  let tryOn = '';
  const activeTheme = () => tryOn || (isPro() && THEMES[S().proTheme] ? S().proTheme : '');
  const look = () => THEMES[activeTheme()] || PLAIN;
  function persist() { API.save(); }
  function buy() { info().owned = true; persist(); endTry(false); applyTheme(); refreshAll(); celebrateUnlock(); }
  function startTrial() { const p = info(); if (p.trialUsed) return; p.trialUsed = true; p.trialEnds = Date.now() + TRIAL_DAYS * 864e5; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast(`已开始 ${TRIAL_DAYS} 天免费试用，Pro 全部可用`); }
  function restore() { API.showToast(info().owned ? '已恢复购买' : '没有找到购买记录（本地预览）'); }
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
    soft: c => { tone(c, { f: 880, f2: 1320, d: .18, g: .07 }); tone(c, { f: 1760, t: .06, d: .3, g: .025 }); }
  };
  const soundOn = () => S().proSound !== false;
  function playSound(id) { if (!soundOn()) return; const c = audio(); if (!c) return; try { (SOUNDS[id] || SOUNDS.soft)(c); } catch { /* optional */ } }
  const themeSound = () => THEMES[activeTheme()]?.sound || 'soft';

  /* ---------- Completion effects (replace the free shatter) ---------- */
  function chosenEffect() {
    if (demoEffect) return demoEffect;
    if (!isPro() && !tryOn) return '';
    const e = S().proEffect || 'auto';
    return e === 'auto' ? (THEMES[activeTheme()]?.effect || 'shatter') : e;
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
  const dark = () => look() !== THEMES.ink;
  const FX = {
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
    pixel(src, s) {
      const L = look(), step = 4, parts = s.pts.filter((_, i) => i % 1 === 0).map((p, i) => { const r = rng(i * 31 + 7); return { ...p, d: r() * 380, vx: (r() - .5) * 60, c: r() < .5 ? s.color : L.shards[i % 2] }; });
      return overlay(1150, (ctx, ms) => {
        for (const p of parts) {
          const t = Math.max(0, ms - p.d) / 1000, y = p.y + .5 * 1700 * t * t, a = clamp(1 - (ms - p.d - 380) / 380);
          if (a <= 0) continue; ctx.fillStyle = p.c; ctx.globalAlpha = a;
          ctx.fillRect(Math.round((p.x + p.vx * t) / step) * step, Math.round(y / step) * step, step, step);
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
          const k = 1.7 - .7 * easeOut(st); ctx.save(); ctx.translate(seal.x, seal.y); ctx.rotate(-.08); ctx.scale(k, k); ctx.globalAlpha = clamp(st * 1.4) * fade;
          ctx.fillStyle = '#b8322a'; ctx.fillRect(-15, -15, 30, 30); ctx.fillStyle = '#fbf3e6'; ctx.font = '600 17px "Songti SC","STSong","SimSun",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('完', 0, 1); ctx.restore(); ctx.globalAlpha = 1;
        }
      });
    },
    burn(src, s) {
      const parts = s.pts.filter((_, i) => i % 2 === 0).map((p, i) => { const r = rng(i * 53 + 3); return { ...p, vx: (r() - .5) * 26, vy: -(30 + r() * 70), life: 420 + r() * 380, size: 1 + r() * 1.6 }; });
      const sweepMs = 620;
      return overlay(1250, (ctx, ms) => {
        const line = s.left + easeIn(clamp(ms / sweepMs)) * 0 + clamp(ms / sweepMs) * (s.w + 16);
        ctx.save(); ctx.beginPath(); ctx.rect(line, s.top, s.w + 40, s.h); ctx.clip(); ctx.drawImage(s.image, s.left, s.top); ctx.restore();
        if (ms < sweepMs + 60) { const g = ctx.createLinearGradient(line - 10, 0, line + 6, 0); g.addColorStop(0, 'rgba(255,91,58,0)'); g.addColorStop(.6, 'rgba(255,140,70,.85)'); g.addColorStop(1, 'rgba(255,214,150,0)'); ctx.fillStyle = g; ctx.fillRect(line - 10, s.top + 2, 16, s.h - 4); }
        ctx.globalCompositeOperation = dark() ? 'lighter' : 'source-over';
        for (const p of parts) {
          const born = (p.x - s.left) / (s.w + 16) * sweepMs, t = clamp((ms - born) / p.life); if (t <= 0 || t >= 1) continue;
          const e = easeOut(t), heat = 1 - t; ctx.fillStyle = `rgba(255,${Math.round(90 + 130 * heat)},${Math.round(40 + 60 * heat)},${heat})`;
          ctx.beginPath(); ctx.arc(p.x + p.vx * e, p.y + p.vy * e, p.size, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      });
    },
    plane(src, s) {
      const P = { x: s.left + 10, y: s.top + s.h / 2 }, end = { x: innerWidth + 60, y: Math.max(-40, s.top - 260) };
      const c1 = { x: P.x + 120, y: P.y + 40 }, c2 = { x: innerWidth * .7, y: P.y - 60 };
      const at = t => { const u = 1 - t; return { x: u * u * u * P.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x, y: u * u * u * P.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y }; };
      const parts = s.pts.filter((_, i) => i % 2 === 0).map((p, i) => ({ ...p, d: rng(i + 9)() * 120 }));
      const L = look(), stroke = L === THEMES.ink ? '#1d1a16' : L.accent || '#7fb2ff';
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
    if (!id || id === 'shatter' || !FX[id]) return null;
    try { const s = sampleText(textNode, id === 'pixel' ? 4 : id === 'stardust' ? 2 : 3); return FX[id](source, s); } catch { return null; }
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
  function pile(entries, J, per, sz) {
    const cols = Math.max(4, Math.round(J.w / (sz * .95))), cw = (J.w - sz * .6) / cols, level = new Array(cols).fill(0), out = [];
    let full = false;
    entries.forEach(e => {
      const r = rng(hash(`${e.id}${e.at}`));
      for (let k = 0; k < per; k++) {
        const a = Math.floor(r() * cols), b = Math.floor(r() * cols), col = level[a] <= level[b] ? a : b;
        const x = J.x + sz * .3 + (col + .5) * cw + (r() - .5) * cw * .7, y = J.y + J.h - sz * .55 - level[col] * sz * .5 - r() * sz * .15;
        if (y < J.bodyTop + sz * .9) { full = true; continue; }
        level[col] += 1;
        const nPts = 3 + (r() < .4 ? 1 : 0);
        const pts = Array.from({ length: nPts }, (_, i) => { const ang = (i / nPts) * Math.PI * 2 + r() * 1.4, rad = sz * (.32 + r() * .32); return [x + Math.cos(ang) * rad, y + Math.sin(ang) * rad * .8]; });
        out.push({ pts, color: shardColor(e, k), tw: r() * 6 });
      }
    });
    return { shards: out, full };
  }
  const pageDark = () => { const t = activeTheme(), st = document.documentElement.dataset.style; return t ? t !== 'ink' : st === 'night' || (st === 'glass' && matchMedia('(prefers-color-scheme: dark)').matches); };
  function drawJar(ctx, x, y, w, h, entries, { per = 4, sz = w / 7, ms = 0, lid = true, dark } = {}) {
    const J = jarShape(x, y, w, h), L = look(), onDark = dark ?? L !== THEMES.ink;
    ctx.save(); J.path(ctx);
    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, onDark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.55)'); body.addColorStop(.5, onDark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.25)'); body.addColorStop(1, onDark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.5)');
    ctx.fillStyle = body; ctx.fill(); ctx.clip();
    const { shards } = pile(entries, J, per, sz);
    ctx.globalCompositeOperation = onDark ? 'lighter' : 'multiply';
    for (const s of shards) {
      const glint = ms ? .78 + .22 * Math.sin(s.tw + ms / 500) : .9;
      ctx.beginPath(); s.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
      ctx.fillStyle = hex(s.color, onDark ? .55 * glint : .7); ctx.fill();
      ctx.strokeStyle = onDark ? `rgba(255,255,255,${.35 * glint})` : 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(.6, sz / 22); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (ms) { const sx = x - w + ((ms / 2600) % 1) * w * 3, g = ctx.createLinearGradient(sx, 0, sx + w * .5, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    J.path(ctx); ctx.strokeStyle = onDark ? 'rgba(235,245,255,.7)' : 'rgba(40,34,28,.55)'; ctx.lineWidth = Math.max(1, w / 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * .14, J.bodyTop + J.r * .9); ctx.lineTo(x + w * .14, y + h - J.r * 1.1); ctx.strokeStyle = onDark ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1.2, w / 34); ctx.lineCap = 'round'; ctx.stroke();
    if (lid) { ctx.fillStyle = onDark ? 'rgba(235,245,255,.82)' : 'rgba(40,34,28,.75)'; const lh = h * .07; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(J.nx - w * .04, y, J.neck + w * .08, lh, lh / 2.4) : ctx.rect(J.nx - w * .04, y, J.neck + w * .08, lh); ctx.fill(); }
    return shards.length;
  }

  /* ---------- 每周碎片画: a picture only this week of yours could make ---------- */
  function drawArt(entries, start, L = look(), size = 1080) {
    const W = size, H = Math.round(size * 1.25), k = W / 1080, pixel = L === THEMES.pixel;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const out = canvas.getContext('2d');
    const work = pixel ? document.createElement('canvas') : canvas; if (pixel) { work.width = Math.round(W / 6); work.height = Math.round(H / 6); }
    const ctx = work.getContext('2d'), q = pixel ? 1 / 6 : 1, sc = v => v * k * q;
    ctx.fillStyle = L.bg; ctx.fillRect(0, 0, work.width, work.height);
    const cx = work.width / 2, cy = sc(650);
    if (L === THEMES.aurora || L === PLAIN) { [['#1fd1b5', -.25, .3, 620], ['#6b4bff', .3, .1, 560], ['#2f7bff', 0, .55, 520]].forEach(([c, dx, dy, r]) => { const g = ctx.createRadialGradient(cx + dx * work.width, sc(dy * 1350), 0, cx + dx * work.width, sc(dy * 1350), sc(r)); g.addColorStop(0, hex(c, L === PLAIN ? .16 : .3)); g.addColorStop(1, hex(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, work.width, work.height); }); }
    if (L === THEMES.ink) { const r = rng(7); ctx.strokeStyle = 'rgba(120,100,70,.08)'; ctx.lineWidth = sc(1.2); for (let i = 0; i < 900; i++) { const x = r() * work.width, y = r() * work.height, a = r() * 6.3, l = sc(6 + r() * 26); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); } }
    if (L === THEMES.darkroom) { const g = ctx.createRadialGradient(cx, cy, sc(80), cx, cy, sc(900)); g.addColorStop(0, 'rgba(255,91,58,.16)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, work.width, work.height); }
    ctx.strokeStyle = hex(L.muted, .28); ctx.lineWidth = sc(1.2);
    for (let d = 0; d < 7; d++) { const a = -Math.PI / 2 + d / 7 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * sc(492), cy + Math.sin(a) * sc(492)); ctx.lineTo(cx + Math.cos(a) * sc(510), cy + Math.sin(a) * sc(510)); ctx.stroke(); }
    ctx.globalCompositeOperation = L.mode;
    entries.forEach((e, i) => {
      const r = rng(hash(`${e.id}${e.at}`)), when = new Date(e.at), d = (when.getDay() + 6) % 7, hr = when.getHours() + when.getMinutes() / 60;
      const a = -Math.PI / 2 + (d + hr / 24) / 7 * Math.PI * 2 + (r() - .5) * .06, dir = [Math.cos(a), Math.sin(a)], perp = [-dir[1], dir[0]];
      const d0 = sc(26 + r() * 50), len = sc(150 + Math.min(e.min || 0, 120) * 2.1 + r() * 130), wb = sc(22 + r() * 46), kink = (r() - .5) * wb * .9;
      const B1 = [cx + dir[0] * d0 + perp[0] * wb / 2, cy + dir[1] * d0 + perp[1] * wb / 2], B2 = [cx + dir[0] * d0 - perp[0] * wb / 2, cy + dir[1] * d0 - perp[1] * wb / 2];
      const M = [cx + dir[0] * (d0 + len * .56) + perp[0] * kink, cy + dir[1] * (d0 + len * .56) + perp[1] * kink], T = [cx + dir[0] * (d0 + len), cy + dir[1] * (d0 + len)];
      const c = shardColor(e, i, L), g = ctx.createLinearGradient(cx + dir[0] * d0, cy + dir[1] * d0, T[0], T[1]);
      g.addColorStop(0, hex(c, L === THEMES.ink ? .82 : .92)); g.addColorStop(1, hex(c, L === THEMES.ink ? .3 : .16));
      ctx.beginPath(); ctx.moveTo(...B1); ctx.lineTo(...M); ctx.lineTo(...T); ctx.lineTo(...B2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = L === THEMES.ink ? 'rgba(29,26,22,.25)' : 'rgba(255,255,255,.3)'; ctx.lineWidth = sc(1); ctx.stroke();
      // two thin splinters beside each shard, so a quiet week still reads as glass
      for (const side of [-1, 1]) {
        const a2 = a + side * (.05 + r() * .09), d2 = [Math.cos(a2), Math.sin(a2)], p2 = [-d2[1], d2[0]], s0 = d0 + len * (.15 + r() * .2), l2 = len * (.35 + r() * .35), w2 = wb * (.18 + r() * .2);
        const q1 = [cx + d2[0] * s0 + p2[0] * w2 / 2, cy + d2[1] * s0 + p2[1] * w2 / 2], q2 = [cx + d2[0] * s0 - p2[0] * w2 / 2, cy + d2[1] * s0 - p2[1] * w2 / 2], qt = [cx + d2[0] * (s0 + l2), cy + d2[1] * (s0 + l2)];
        const g2 = ctx.createLinearGradient(cx + d2[0] * s0, cy + d2[1] * s0, qt[0], qt[1]); g2.addColorStop(0, hex(c, L === THEMES.ink ? .55 : .6)); g2.addColorStop(1, hex(c, 0));
        ctx.beginPath(); ctx.moveTo(...q1); ctx.lineTo(...qt); ctx.lineTo(...q2); ctx.closePath(); ctx.fillStyle = g2; ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, sc(60)); core.addColorStop(0, hex(L === THEMES.ink ? '#b8322a' : L.shards[0], L === THEMES.ink ? .9 : .8)); core.addColorStop(1, hex(L.shards[0], 0));
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, sc(60), 0, 7); ctx.fill();
    if (pixel) { out.imageSmoothingEnabled = false; out.drawImage(work, 0, 0, W, H); }
    // Words
    const P = 84 * k, end = new Date(start.getTime() + 6 * 864e5), fmt = d => `${d.getMonth() + 1}月${d.getDate()}日`;
    const focus = entries.reduce((n, e) => n + (e.min || 0), 0), byDay = new Array(7).fill(0); entries.forEach(e => { byDay[(new Date(e.at).getDay() + 6) % 7]++; });
    const busiest = entries.length ? '一二三四五六日'[byDay.indexOf(Math.max(...byDay))] : '';
    out.fillStyle = L.ink; out.textBaseline = 'alphabetic';
    out.font = `600 ${76 * k}px ${L.font}`; out.fillText(`第 ${isoWeek(start)} 周`, P, P + 70 * k);
    out.fillStyle = L.muted; out.font = `400 ${30 * k}px ${L.font}`; out.fillText(`${start.getFullYear()} · ${fmt(start)} 至 ${fmt(end)}`, P, P + 122 * k);
    const lines = entries.length ? [`${entries.length} 件完成`, focus ? `${Math.floor(focus / 60) ? `${Math.floor(focus / 60)} 小时 ` : ''}${focus % 60} 分钟专注` : '这周没有计时', `周${busiest}最忙`] : ['这周还没有碎片', '完成一件事，就会长出第一片'];
    out.fillStyle = L.ink; out.font = `600 ${40 * k}px ${L.font}`; out.fillText(lines[0], P, H - P - 92 * k);
    out.fillStyle = L.muted; out.font = `400 ${28 * k}px ${L.font}`; out.fillText(lines.slice(1).join('，'), P, H - P - 44 * k);
    if (L === THEMES.ink) { out.save(); out.translate(W - P - 34 * k, H - P - 70 * k); out.rotate(-.06); out.fillStyle = '#b8322a'; out.fillRect(-34 * k, -34 * k, 68 * k, 68 * k); out.fillStyle = '#fbf3e6'; out.font = `600 ${40 * k}px ${L.font}`; out.textAlign = 'center'; out.textBaseline = 'middle'; out.fillText('碎', 0, 2 * k); out.restore(); }
    else { out.fillStyle = hex(L.muted.length === 7 ? L.muted : '#8b93a3', .9); out.font = `500 ${24 * k}px ${L.font}`; out.textAlign = 'right'; out.fillText('碎碎清单 Pro', W - P, H - P - 44 * k); out.textAlign = 'left'; }
    if (L === THEMES.darkroom) { const r = rng(3), img = out.getImageData(0, 0, W, H), dt = img.data; for (let i = 0; i < dt.length; i += 4 * 3) { const n = (r() - .5) * 22; dt[i] += n; dt[i + 1] += n; dt[i + 2] += n; } out.putImageData(img, 0, 0); }
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
      if (html.dataset.proTheme) { delete html.dataset.proTheme; API.applySettings(); }
      return;
    }
    html.dataset.proTheme = id; html.dataset.style = t.base; html.dataset.palette = 'pro';
    const r = html.style;
    r.setProperty('--accent', t.accent); r.setProperty('--accent-fill', t.accent); r.setProperty('--accent-soft', t.soft); r.setProperty('--on-accent', t.on);
    r.setProperty('--pro-font', t.font);
    if (id === 'ink' || id === 'pixel') r.setProperty('--app-font', t.font);
  }
  function setTheme(id) {
    if (!isPro()) { startTry(id); return; }
    S().proTheme = S().proTheme === id ? '' : id; persist(); applyTheme(); refreshAll();
  }
  let tryTimer = 0;
  function startTry(id) {
    tryOn = id; applyTheme(); closeSheet();
    const bar = $('pro-tryon'); bar.hidden = false;
    bar.querySelector('b').textContent = `正在试穿「${THEMES[id].name}」`;
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
    // Choosing a free interface style takes off a Pro theme
    document.addEventListener('click', e => { if (e.target.closest('[data-ui-style]') && S().proTheme) { S().proTheme = ''; setTimeout(() => { applyTheme(); refreshAll(); }, 0); } }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('pro-celebrate').hidden) closeCelebrate(); else if (!$('pro-jar-sheet').hidden) closeJar(); else if (!$('pro-sheet').hidden) closeSheet(); } });
  }

  function themeMock(id) {
    const t = THEMES[id];
    void t; return `<span class="pro-mock" data-mock="${id}" aria-hidden="true"><b>${{ aurora: '4/7', ink: '十', darkroom: '04', pixel: '3/5' }[id] || ''}</b><i></i><i></i><i></i></span>`;
  }
  function renderLookInline() {
    const f = $('pro-look'); if (!f) return;
    const pro = isPro(), cur = activeTheme();
    f.innerHTML = `<legend>Pro 主题${pro ? '' : '<span class="pro-pill">Pro</span>'}</legend><div class="pro-theme-row">${Object.keys(THEMES).map(id => `<button type="button" class="pro-theme-chip${cur === id ? ' active' : ''}" data-pro-theme-pick="${id}" aria-pressed="${cur === id}">${themeMock(id)}<strong>${THEMES[id].name}</strong><small>${pro ? (cur === id ? '使用中' : '使用') : '试穿'}</small>${pro ? '' : `<span class="pro-lock-badge">${icon('lock')}</span>`}</button>`).join('')}</div>`;
    f.querySelectorAll('[data-pro-theme-pick]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.proThemePick)));
    const e = $('pro-effects-inline');
    if (e) {
      const curE = S().proEffect || 'auto';
      e.innerHTML = `<div class="ag-row"><h3 class="ag-title">完成动效${pro ? '' : '<span class="pro-pill">Pro</span>'}</h3></div><div class="pro-effect-row">${Object.keys(EFFECTS).map(id => `<button type="button" class="chip${pro && curE === id ? ' active' : ''}" data-pro-effect-pick="${id}">${EFFECTS[id]}${pro || id === 'shatter' ? '' : icon('lock', 'pro-chip-lock')}</button>`).join('')}</div>`;
      e.querySelectorAll('[data-pro-effect-pick]').forEach(b => b.addEventListener('click', () => { if (!isPro()) { openSheet('effects'); return; } S().proEffect = b.dataset.proEffectPick; persist(); renderLookInline(); }));
    }
    API.icons(f); if (e) API.icons(e);
  }

  /* ---------- The Pro page ---------- */
  function openSheet(section = '') {
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
        <div class="pro-effect-grid">${Object.keys(EFFECTS).filter(id => id !== 'auto').map(id => `<button type="button" class="pro-effect${(pro ? curE === id : id === (demoPick || 'stardust')) ? ' active' : ''}" data-pro-effect="${id}"><b>${EFFECTS[id]}</b><small>${EFFECT_LINE[id]}</small></button>`).join('')}
        ${pro ? `<button type="button" class="pro-effect${curE === 'auto' ? ' active' : ''}" data-pro-effect="auto"><b>跟随主题</b><small>每个主题用自己的动效</small></button>` : ''}</div>
      </section>

      <section class="pro-part" data-pro-section="themes">
        <h2>主题</h2>
        <p class="pro-lead">不只是换颜色：字体、碎片的材质、完成的动效和声音，整套一起换。${pro ? '' : '可以先试穿 90 秒。'}</p>
        <div class="pro-themes">${Object.keys(THEMES).map(id => `<article class="pro-theme${cur === id ? ' active' : ''}" data-theme-card="${id}">${themeMock(id)}<h3>${THEMES[id].name}</h3><p>${THEMES[id].line}</p><small>${EFFECTS[THEMES[id].effect]} · ${{ glass: '玻璃铃声', wood: '木鱼轻响', shutter: '快门声', chip: '掌机音效' }[THEMES[id].sound]}</small><button type="button" data-pro-theme="${id}">${pro ? (cur === id ? '使用中' : '使用') : '试穿'}</button></article>`).join('')}
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

      <footer class="pro-buy">
        ${owned ? `<p class="pro-owned">${icon('badge-check')}已解锁 Pro，谢谢你。</p>`
          : `<div class="pro-price"><b>${PRICE}</b><s>${LIST_PRICE}</s><span>首发价，一次买断，永久使用</span></div>
             <div class="pro-actions">${info().trialUsed ? '' : `<button type="button" class="pro-trial" id="pro-trial">免费试用 ${TRIAL_DAYS} 天</button>`}<button type="button" class="pro-cta" id="pro-buy">解锁 Pro</button></div>`}
        <p class="pro-legal"><button type="button" id="pro-restore">恢复购买</button><span>本地预览：购买是模拟的，不会扣费</span><button type="button" id="pro-reset">重置</button></p>
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
    $('pro-buy')?.addEventListener('click', buy);
    $('pro-trial')?.addEventListener('click', startTrial);
    $('pro-restore').addEventListener('click', restore);
    $('pro-reset').addEventListener('click', resetLocal);
    $('pro-sound')?.addEventListener('change', e => { S().proSound = e.target.checked; persist(); if (e.target.checked) playSound(themeSound()); });
    $('pro-cd-add')?.addEventListener('submit', addCountdown);
    renderCountdownList();
    // Demo jar + art
    const dj = $('pro-demo-jar'); if (dj) { const ctx = canvasFor(dj, 132, 168); drawJarWith(THEMES.aurora, ctx, 8, 6, 116, 156, demoEntries(startOfDay(), 9), 0); }
    const art = drawArt(pro && logBetween(weekStart().getTime(), Date.now() + 1).length ? logBetween(weekStart().getTime(), weekStart().getTime() + 7 * 864e5) : demoEntries(), weekStart(), look(), 540);
    $('pro-demo-art').src = art.toDataURL('image/png');
  }
  let demoPick = '';
  function playDemo() {
    const title = $('pro-demo-title'), check = $('pro-demo-check');
    if (!title || title.dataset.busy) return;
    const pick = isPro() ? ((S().proEffect || 'auto') === 'auto' ? (THEMES[activeTheme()]?.effect || 'shatter') : S().proEffect) : (demoPick || 'stardust');
    title.dataset.busy = '1'; check.classList.add('done');
    playSound(isPro() && !(S().proEffect && S().proEffect !== 'auto') ? themeSound() : ({ stardust: 'glass', ink: 'wood', burn: 'shutter', pixel: 'chip' }[pick] || 'soft'));
    const run = pick === 'shatter' ? shatterDemo(title) : (demoEffect = pick, FX[pick](title, sampleText(title, pick === 'pixel' ? 4 : pick === 'stardust' ? 2 : 3)));
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
      const L0 = look(); const saved = THEMES.aurora; // the Pro hero always speaks 极光
      drawJarWith(saved, ctx, 22, 12, 126, 190, base.slice(0, shown), still ? 0 : ms);
      if (!still && shown < base.length) { // one shard falling into the jar
        const t = (ms % 700) / 700, x = 85 + Math.sin(shown) * 18, y = -10 + easeIn(t) * 120;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4); ctx.fillStyle = hex(THEMES.aurora.shards[shown % 4], .85); ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      void L0;
      if (!still && !$('pro-sheet').hidden) heroRaf = requestAnimationFrame(frame);
    };
    heroRaf = requestAnimationFrame(frame);
  }
  function stopHero() { cancelAnimationFrame(heroRaf); heroRaf = 0; }
  function drawJarWith(theme, ctx, x, y, w, h, entries, ms) { const keep = tryOn; tryOn = theme === THEMES.aurora ? 'aurora' : tryOn; const n = drawJar(ctx, x, y, w, h, entries, { per: 4, sz: w / 7, ms }); tryOn = keep; return n; }

  /* ---------- The jar page ---------- */
  let jarRaf = 0, weekOffset = 0;
  function openJar() { weekOffset = 0; const s = $('pro-jar-sheet'); renderJar(); s.hidden = false; document.body.classList.add('pro-open'); }
  function closeJar() { const s = $('pro-jar-sheet'); s.hidden = true; document.body.classList.remove('pro-open'); cancelAnimationFrame(jarRaf); }
  function renderJar() {
    const s = $('pro-jar-sheet'), L = look(); s.style.setProperty('--js-bg', L.bg); s.style.setProperty('--js-ink', L.ink); s.style.setProperty('--js-muted', L.muted); s.dataset.light = L === THEMES.ink ? '1' : '';
    const today = todayLog(), ws = new Date(weekStart().getTime() + weekOffset * 7 * 864e5), we = ws.getTime() + 7 * 864e5, week = logBetween(ws.getTime(), we);
    const days = Array.from({ length: 7 }, (_, d) => logBetween(ws.getTime() + d * 864e5, ws.getTime() + (d + 1) * 864e5));
    s.innerHTML = `
      <header class="pro-jar-top"><button type="button" class="pro-close" id="pro-jar-close" aria-label="关闭">${icon('x')}</button><h1>碎片罐</h1></header>
      <div class="pro-jar-big"><canvas id="pro-jar-big" aria-hidden="true"></canvas><p><b>${today.length}</b> 件今天完成${today.length ? '' : '，第一片还在路上'}</p></div>
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
    const big = $('pro-jar-big'), W = 220, H = 280, ctx = canvasFor(big, W, H), t0 = performance.now(), still = reduce();
    cancelAnimationFrame(jarRaf);
    const frame = now => { ctx.clearRect(0, 0, W, H); drawJar(ctx, 20, 8, 180, 264, today, { per: 5, sz: 22, ms: still ? 0 : now - t0 }); if (!still && !s.hidden) jarRaf = requestAnimationFrame(frame); };
    jarRaf = requestAnimationFrame(frame);
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
    const bj = $('pro-banner-jar'); if (bj) { const ctx = canvasFor(bj, 44, 56); const keep = tryOn; tryOn = 'aurora'; drawJar(ctx, 4, 2, 36, 52, demoEntries(startOfDay(), 6), { per: 3, sz: 7 }); tryOn = keep; }
    if (!$('pro-sheet').hidden) { const top = $('pro-sheet').scrollTop; renderSheet(); $('pro-sheet').scrollTop = top; startHero(); }
  }
  window.SuiSuiPro = { effect, isPro, open: openSheet, openJar, drawArt, THEMES, EFFECTS, buy, startTrial, reset: resetLocal, tryTheme: startTry, endTry };
  mount();
  applyTheme(); refreshAll();
  window.addEventListener('suisui:settings', () => { applyTheme(); renderLookInline(); });
  window.addEventListener('suisui:render', () => { renderCountdowns(); drawMiniJar(false); });
  window.addEventListener('suisui:completing', () => { if (isPro() || tryOn) playSound(themeSound()); });
  window.addEventListener('suisui:done', e => {
    const { rect, allDone } = e.detail || {};
    if (rect) flyToJar(rect); else drawMiniJar(true);
    if (allDone) setTimeout(celebrate, 900);
  });
  // A trial that ends while the app is open: the free look comes back.
  setInterval(() => { const was = document.documentElement.dataset.proTheme || ''; if (was && !activeTheme()) { applyTheme(); refreshAll(); } }, 60000);
})();
