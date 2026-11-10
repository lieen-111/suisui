/* 碎碎清单 Pro skins — four restrained, stylised themes. The list stays the subject: each theme speaks through
   type, colour, material and one or two details, over a quiet background.
     liquid 液态玻璃   pearl light, glass with rim highlights, thin numerals
     ink    东方留白   warm paper, thin Song type, one cinnabar point
     dot    点阵       monochrome, dot-matrix numerals, one red dot
     noir   暗金       deep black, champagne-gold hairlines, N° numbering
   pro.js decides which theme is on; this file draws the background, header, jar and weekly picture. */
(() => {
  const API = window.suisui?.pro;
  if (!API) return;
  const $ = id => document.getElementById(id);
  const reduce = () => !API.state.settings.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const DIG = '零一二三四五六七八九';
  const cn = n => n < 10 ? DIG[n] : n < 20 ? `十${n % 10 ? DIG[n % 10] : ''}` : n < 100 ? `${DIG[Math.floor(n / 10)]}十${n % 10 ? DIG[n % 10] : ''}` : String(n);
  const WEEK = '日一二三四五六';
  const esc = v => API.esc(v);
  const hexA = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const two = n => String(n).padStart(2, '0');
  const CINNABAR = '#b43a2c', GOLD = '#c8a66a', RED = '#d71921';
  const SONG = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SERIF = '"Didot","Bodoni 72","Playfair Display","Noto Serif","Times New Roman",serif';

  /* ---------- 5×7 dot-matrix glyphs ---------- */
  const GLYPH = {
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'], '.': ['.', '.', '.', '.', '.', '.', '#'], ':': ['.', '#', '.', '.', '.', '#', '.'],
    '-': ['...', '...', '...', '###', '...', '...', '...'], ' ': ['..', '..', '..', '..', '..', '..', '..']
  };
  /** Dot-matrix text as SVG: lit dots in colour, unlit dots faint, like an LED panel. */
  function dotSvg(text, { d = 4, gap = 1.6, color = '#111', dim = .09, cls = '' } = {}) {
    const step = d + gap; let x = 0, dots = '';
    for (const ch of String(text)) {
      const g = GLYPH[ch] || GLYPH[' '], w = g[0].length;
      g.forEach((row, y) => [...row].forEach((p, i) => { if (p !== '#' && !dim) return; dots += `<circle cx="${(x + i * step + d / 2).toFixed(1)}" cy="${(y * step + d / 2).toFixed(1)}" r="${(d / 2).toFixed(2)}"${p === '#' ? '' : ` opacity="${dim}"`}/>`; }));
      x += w * step + step;
    }
    const W = Math.max(1, x - step), H = 7 * step - gap;
    return `<svg class="dot-svg ${cls}" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="${color}" aria-hidden="true">${dots}</svg>`;
  }
  function dotCanvas(ctx, text, x0, y0, d, color, dim = .08) {
    const step = d * 1.4; let x = x0;
    for (const ch of String(text)) { const g = GLYPH[ch] || GLYPH[' ']; g.forEach((row, y) => [...row].forEach((p, i) => { if (p !== '#' && !dim) return; ctx.fillStyle = p === '#' ? color : hexA(color, dim); ctx.beginPath(); ctx.arc(x + i * step + d / 2, y0 + y * step + d / 2, d / 2, 0, 7); ctx.fill(); })); x += (g[0].length + 1) * step; }
    return x - x0;
  }

  /* ---------- Backgrounds: quiet ---------- */
  function grain(ctx, w, h, alpha, seed = 3, color = '0,0,0') {
    const r = rng(seed), n = Math.round(w * h / 9);
    for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${color},${alpha * r()})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  }
  const BG = {
    liquid(ctx, w, h, t = 0) { // at 1/5 resolution; the browser's smoothing turns it into soft light
      ctx.fillStyle = '#eef0f4'; ctx.fillRect(0, 0, w, h);
      [['#c9c2ff', .22, .18, .9, 1], ['#bfeee2', .82, .34, .8, 1.4], ['#ffd9c7', .3, .78, .85, 1.9], ['#d6e4ff', .78, .9, .7, 2.6]].forEach(([c, x, y, r, p]) => {
        const cx = (x + .06 * Math.sin(t / 7000 + p)) * w, cy = (y + .05 * Math.cos(t / 8000 + p * 2)) * h, R = r * Math.max(w, h) * .55, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, hexA(c, .7)); g.addColorStop(1, hexA(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
    },
    ink(ctx, w, h) { ctx.fillStyle = '#f5f2ec'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, .05, 4, '90,70,40'); },
    dot(ctx, w, h) { ctx.fillStyle = '#f1f1ee'; ctx.fillRect(0, 0, w, h); },
    noir(ctx, w, h) {
      ctx.fillStyle = '#0d0c0a'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * .5, -h * .1, 10, w * .5, -h * .1, h * 1.1); g.addColorStop(0, 'rgba(200,166,106,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, .05, 9, '255,240,210');
    }
  };
  const RES = { liquid: 5 }, FPS = { liquid: 120 };
  let current = '', loop = 0;
  function paint(t = 0) {
    const c = $('pro-skin')?.querySelector('canvas'); if (!c || !BG[current]) return;
    const k = RES[current] || 1, dpr = k === 1 ? Math.min(2, devicePixelRatio || 1) : 1 / k;
    const W = Math.max(1, Math.round(innerWidth * dpr)), H = Math.max(1, Math.round(innerHeight * dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d');
    if (k === 1) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); BG[current](ctx, innerWidth, innerHeight, t); } else { ctx.setTransform(1, 0, 0, 1, 0, 0); BG[current](ctx, W, H, t); }
  }
  function animate() {
    clearTimeout(loop);
    if (!FPS[current] || reduce()) return;
    const t0 = performance.now();
    const step = () => { if (!current) return; if (!document.hidden) paint(performance.now() - t0); loop = setTimeout(step, document.hidden ? 1000 : FPS[current]); };
    loop = setTimeout(step, FPS[current]);
  }
  const onResize = () => paint();
  function mount(id) {
    if (current === id) return;
    unmount(); current = id;
    const layer = document.createElement('div'); layer.id = 'pro-skin'; layer.setAttribute('aria-hidden', 'true'); layer.innerHTML = '<canvas></canvas>';
    document.body.prepend(layer); document.documentElement.dataset.proSkin = id;
    paint(); animate(); addEventListener('resize', onResize); head();
  }
  function unmount() {
    clearTimeout(loop); removeEventListener('resize', onResize);
    $('pro-skin')?.remove(); delete document.documentElement.dataset.proSkin;
    const jar = $('pro-jar-button'), side = $('today-side'); if (jar && side && !side.contains(jar)) side.prepend(jar);
    $('pro-head')?.remove(); current = '';
  }

  /* ---------- Headers: compact, the list stays first ---------- */
  function data() {
    const st = API.state, todo = API.pending(), done = st.tasks.filter(t => t.done), d = new Date();
    const cds = (Array.isArray(st.settings.countdowns) ? st.settings.countdowns : []).map(c => { const [y, m, dd] = String(c.date).split('-').map(Number); return { title: c.title, n: Math.round((new Date(y, m - 1, dd) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5) }; }).filter(c => c.n >= 0).sort((a, b) => a.n - b.n);
    const lunar = (() => { try { return API.lunar(d) || ''; } catch { return ''; } })();
    return { left: todo.length, done: done.length, total: todo.length + done.length, d, lunar, cds };
  }
  function head() {
    if (!current) return;
    const top = $('tasks-panel')?.querySelector('.today-top'); if (!top) return;
    let el = $('pro-head'); if (!el) { el = document.createElement('div'); el.id = 'pro-head'; top.before(el); }
    const keepJar = $('pro-jar-button'); if (keepJar && el.contains(keepJar)) $('today-side')?.prepend(keepJar);
    const D = data(), pct = D.total ? D.done / D.total : 0, m = D.d.getMonth() + 1, day = D.d.getDate(), wk = WEEK[D.d.getDay()];
    el.className = `pro-head pro-head-${current}`;
    if (current === 'liquid') {
      el.innerHTML = `<div class="lq-row"><p class="lq-count"><b>${D.done}</b><span>/${D.total}</span></p><p class="lq-date"><strong>星期${wk}</strong><small>${m}月${day}日 · ${D.left ? `还有 ${D.left} 件` : D.total ? '都完成了' : '今天很空'}</small></p><span class="pro-head-jar"></span></div>
        <div class="lq-bar" aria-hidden="true"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
        ${D.cds.length ? `<div class="lq-cds">${D.cds.slice(0, 3).map(c => `<span><b>${c.n || '今天'}</b>${c.n ? '<small>天</small>' : ''}${esc(c.title)}</span>`).join('')}</div>` : ''}`;
    } else if (current === 'ink') {
      el.innerHTML = `<div class="ik-row"><div><h1 class="ik-title">今日</h1><p class="ik-date">${cn(m)}月${cn(day)}日　星期${wk}${D.lunar ? `　${esc(D.lunar.replace(/^.+?年/, ''))}` : ''}</p></div><p class="ik-count" aria-label="完成 ${D.done} / ${D.total}"><b>${cn(D.done)}</b><i></i><span>${cn(D.total)}</span></p><span class="pro-head-jar"></span></div>
        ${D.cds.length ? `<p class="ik-cds">${D.cds.slice(0, 3).map(c => `${esc(c.title)}${c.n ? `，尚有<b>${cn(c.n)}</b>日` : '，<b>就在今日</b>'}`).join('<span>·</span>')}</p>` : ''}`;
    } else if (current === 'dot') {
      el.innerHTML = `<div class="dt-row">${dotSvg(`${two(D.done)}/${two(D.total)}`, { d: 6, gap: 2.2, color: '#111' })}<span class="pro-head-jar"></span></div>
        <div class="dt-meta"><span><i class="dt-rec${D.left ? '' : ' off'}"></i>${D.left ? '进行中' : D.total ? '已完成' : '待命'}</span>${dotSvg(`${two(m)}.${two(day)}`, { d: 2.4, gap: 1.1, color: '#111', dim: 0 })}<span>周${wk}</span></div>
        <div class="dt-dots" aria-hidden="true">${Array.from({ length: Math.max(D.total, 1) }, (_, i) => `<i class="${i < D.done ? 'on' : ''}"></i>`).join('')}</div>
        ${D.cds.length ? `<div class="dt-cds">${D.cds.slice(0, 3).map(c => `<span>${esc(c.title)}${dotSvg(`-${c.n}`, { d: 2.2, gap: 1, color: RED, dim: 0 })}</span>`).join('')}</div>` : ''}`;
    } else if (current === 'noir') {
      el.innerHTML = `<div class="nr-row"><p class="nr-no"><small>N°</small><b>${two(D.done)}</b><span>/ ${two(D.total)}</span></p><span class="pro-head-jar"></span></div>
        <p class="nr-date"><span>${m}月${day}日</span><i>◆</i><span>星期${wk}</span>${D.lunar ? `<i>◆</i><span>${esc(D.lunar.replace(/^.+?年/, ''))}</span>` : ''}</p>
        ${D.cds.length ? `<div class="nr-cds">${D.cds.slice(0, 3).map(c => `<span>${esc(c.title)}<b>${c.n ? `${c.n} 天` : '今天'}</b></span>`).join('')}</div>` : ''}`;
    }
    const jar = $('pro-jar-button'), slot = el.querySelector('.pro-head-jar'); if (jar && slot) slot.append(jar);
  }

  /* ---------- Jars ---------- */
  function jarPath(ctx, x, y, w, h, shape = 'jar') {
    ctx.beginPath();
    if (shape === 'vase') {
      const cx = x + w / 2, mouth = w * .3;
      ctx.moveTo(cx - mouth / 2, y + h * .05); ctx.lineTo(cx - mouth / 2, y + h * .13);
      ctx.bezierCurveTo(x - w * .05, y + h * .2, x - w * .04, y + h * .72, x + w * .2, y + h * .93);
      ctx.lineTo(x + w * .26, y + h); ctx.lineTo(x + w * .74, y + h); ctx.lineTo(x + w * .8, y + h * .93);
      ctx.bezierCurveTo(x + w * 1.04, y + h * .72, x + w * 1.05, y + h * .2, cx + mouth / 2, y + h * .13); ctx.lineTo(cx + mouth / 2, y + h * .05); ctx.closePath();
      return;
    }
    const neck = w * .44, nx = x + (w - neck) / 2, bodyTop = y + h * .2, r = w * .24;
    ctx.moveTo(nx, y + h * .06); ctx.lineTo(nx, y + h * .14);
    ctx.quadraticCurveTo(nx, bodyTop, x + r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(x, bodyTop + r * .4, x, bodyTop + r);
    ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h); ctx.lineTo(x + w - r, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, bodyTop + r); ctx.quadraticCurveTo(x + w, bodyTop + r * .4, x + w - r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(nx + neck, bodyTop, nx + neck, y + h * .14);
    ctx.lineTo(nx + neck, y + h * .06); ctx.closePath();
  }
  function shardShape(kind, ctx, s, color, r, onDark) {
    if (kind === 'dot') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, s * .32, 0, 7); ctx.fill(); return; }
    if (kind === 'ink') { if (r() < .3) { ctx.fillStyle = hexA(CINNABAR, .85); ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, 7); ctx.fill(); } else { ctx.fillStyle = hexA('#1d1a16', .35 + r() * .45); ctx.beginPath(); ctx.ellipse(0, 0, s * (.28 + r() * .16), s * (.18 + r() * .1), r() * 3, 0, 7); ctx.fill(); } return; }
    if (kind === 'noir') { ctx.fillStyle = hexA(color, .9); ctx.beginPath(); ctx.moveTo(-s * .4, -s * .1); ctx.lineTo(s * .1, -s * .35); ctx.lineTo(s * .42, s * .05); ctx.lineTo(-s * .05, s * .32); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,.5)'; ctx.lineWidth = .6; ctx.stroke(); return; }
    const n = 3 + (r() < .4 ? 1 : 0); ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r() * 1.3, rad = s * (.34 + r() * .3); i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * .82) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad * .82); } ctx.closePath();
    ctx.fillStyle = hexA(color, onDark ? .6 : .55); ctx.fill(); ctx.strokeStyle = onDark ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(.6, s / 22); ctx.stroke();
  }
  function jar(kind, ctx, x, y, w, h, shards, { ms = 0, lid = true, onDark = true } = {}) {
    const vase = kind === 'ink';
    ctx.save(); jarPath(ctx, x, y, w, h, vase ? 'vase' : 'jar');
    let fill;
    if (vase) { fill = ctx.createLinearGradient(x, y, x + w, y + h); fill.addColorStop(0, 'rgba(196,214,200,.5)'); fill.addColorStop(1, 'rgba(150,178,162,.36)'); }
    else if (kind === 'noir') { fill = ctx.createLinearGradient(x, 0, x + w, 0); fill.addColorStop(0, 'rgba(60,52,40,.5)'); fill.addColorStop(.5, 'rgba(20,18,14,.3)'); fill.addColorStop(1, 'rgba(60,52,40,.45)'); }
    else if (kind === 'dot') fill = 'rgba(255,255,255,.55)';
    else { fill = ctx.createLinearGradient(x, 0, x + w, 0); fill.addColorStop(0, onDark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.7)'); fill.addColorStop(.5, onDark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.3)'); fill.addColorStop(1, onDark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.62)'); }
    ctx.fillStyle = fill; ctx.fill(); ctx.clip();
    if ((kind === 'plain' || kind === 'noir') && onDark) ctx.globalCompositeOperation = 'lighter';
    for (const s of shards) { const r = rng(s.seed); ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = ms ? .82 + .18 * Math.sin(s.seed % 7 + ms / 500) : 1; shardShape(kind, ctx, s.s, s.color, r, onDark); ctx.restore(); }
    ctx.globalCompositeOperation = 'source-over';
    if (ms && kind !== 'dot') { const sx = x - w + ((ms / 3000) % 1) * w * 3, g = ctx.createLinearGradient(sx, 0, sx + w * .5, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, kind === 'noir' ? 'rgba(232,210,160,.14)' : 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    if (vase) { jarPath(ctx, x, y, w, h, 'vase'); ctx.strokeStyle = 'rgba(29,26,22,.55)'; ctx.lineWidth = Math.max(.8, w / 110); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1, w / 50); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + w * .17, y + h * .34); ctx.quadraticCurveTo(x + w * .1, y + h * .55, x + w * .19, y + h * .76); ctx.stroke(); return; }
    jarPath(ctx, x, y, w, h);
    if (kind === 'dot') { ctx.setLineDash([.1, Math.max(3, w / 22)]); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.6, w / 40); ctx.strokeStyle = '#111'; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.lineWidth = Math.max(.8, w / 90); ctx.strokeStyle = kind === 'noir' ? hexA(GOLD, .85) : onDark ? 'rgba(235,245,255,.7)' : 'rgba(30,34,44,.35)'; ctx.stroke(); }
    if (kind !== 'dot') { const bodyTop = y + h * .2, r = w * .24; ctx.beginPath(); ctx.moveTo(x + w * .14, bodyTop + r * .9); ctx.lineTo(x + w * .14, y + h - r * 1.1); ctx.strokeStyle = kind === 'noir' ? 'rgba(232,210,160,.25)' : onDark ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1.2, w / 34); ctx.lineCap = 'round'; ctx.stroke(); }
    if (lid) { const neck = w * .44, nx = x + (w - neck) / 2, lh = h * .06; ctx.fillStyle = kind === 'noir' ? GOLD : kind === 'dot' ? '#111' : onDark ? 'rgba(235,245,255,.82)' : 'rgba(30,34,44,.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(nx - w * .04, y, neck + w * .08, lh, lh / 2.4); else ctx.rect(nx - w * .04, y, neck + w * .08, lh); ctx.fill(); }
  }

  /* ---------- Weekly pictures ---------- */
  function isoWeek(d) { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y0) / 864e5 + 1) / 7); }
  function weekInfo(entries) { const focus = entries.reduce((n, e) => n + (e.min || 0), 0), by = new Array(7).fill(0); entries.forEach(e => { by[(new Date(e.at).getDay() + 6) % 7]++; }); return { focus, by, best: entries.length ? by.indexOf(Math.max(...by)) : -1 }; }
  function brush(ctx, pts, w0, w1, color, alpha, seed) {
    const r = rng(seed); let total = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d; }
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = segs[i - 1], n = Math.max(2, Math.ceil(d / 1.4));
      for (let k = 0; k < n; k++) { const t = k / n, pos = (acc + d * t) / total, wd = w0 + (w1 - w0) * pos, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; ctx.fillStyle = hexA(color, alpha * (.6 + r() * .4)); ctx.beginPath(); ctx.ellipse(x, y, wd / 2, wd / 2.4, Math.atan2(by - ay, bx - ax), 0, 7); ctx.fill(); }
      acc += d;
    }
  }
  const curve = (a, b, bend, n = 18) => { const mx = (a[0] + b[0]) / 2 + bend[0], my = (a[1] + b[1]) / 2 + bend[1]; return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]; }); };
  const ART = {
    // 东方留白: a single plum branch, painted sparingly; one blossom per thing done
    ink(entries, start, size = 1080) {
      const W = size, H = Math.round(size * 1.25), k = W / 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#f5f2ec'; ctx.fillRect(0, 0, W, H); grain(ctx, W, H, .05, 8, '90,70,40');
      const r = rng(hash(`${start.getTime()}`)), info = weekInfo(entries), INK = '#1d1a16';
      const nodes = [[W * .02, H * .78]], dirs = [-.3, -.48, -.26, -.55, -.38, -.62, -.44];
      for (let d = 0; d < 7; d++) { const a = dirs[d] + (r() - .5) * .2, len = W * (.12 + r() * .03) * (1 - d * .04), [px, py] = nodes[d]; nodes.push([px + Math.cos(a) * len, py + Math.sin(a) * len]); }
      for (let d = 0; d < 7; d++) brush(ctx, curve(nodes[d], nodes[d + 1], [(r() - .5) * 40 * k, (r() - .3) * 40 * k]), (30 - d * 3.3) * k, (27 - d * 3.4) * k, INK, .88, 100 + d);
      const byDay = Array.from({ length: 7 }, () => []); entries.forEach(e => byDay[(new Date(e.at).getDay() + 6) % 7].push(e));
      byDay.forEach((list, d) => list.forEach((e, i) => {
        const rr = rng(hash(`${e.id}${e.at}`)), t = .2 + rr() * .7, [ax, ay] = nodes[d], [bx, by] = nodes[d + 1], px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
        const side = i % 2 ? 1 : -1, a = Math.atan2(by - ay, bx - ax) + side * (.8 + rr() * .5), tl = (30 + rr() * 70) * k, tip = [px + Math.cos(a) * tl, py + Math.sin(a) * tl];
        brush(ctx, curve([px, py], tip, [side * 8 * k, -6 * k], 10), 5 * k, 1.6 * k, INK, .8, 300 + d * 40 + i);
        const s = (11 + Math.min(e.min || 0, 90) / 12 + rr() * 4) * k;
        for (let p = 0; p < 5; p++) { const pa = p / 5 * 6.283 + rr() * .4; ctx.fillStyle = hexA(CINNABAR, .78); ctx.beginPath(); ctx.arc(tip[0] + Math.cos(pa) * s * .55, tip[1] + Math.sin(pa) * s * .55, s * .48, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(248,232,206,.95)'; ctx.beginPath(); ctx.arc(tip[0], tip[1], s * .22, 0, 7); ctx.fill();
      }));
      ctx.fillStyle = INK; ctx.font = `300 ${64 * k}px ${SONG}`; ctx.textAlign = 'right';
      ctx.fillText(`第${cn(isoWeek(start))}周`, W - 96 * k, H - 250 * k);
      ctx.fillStyle = '#7a7166'; ctx.font = `300 ${28 * k}px ${SONG}`;
      ctx.fillText(entries.length ? `开花${cn(entries.length)}朵${info.focus ? `　专注${cn(Math.max(1, Math.round(info.focus / 60)))}时` : ''}` : '这一周，枝上还空着', W - 96 * k, H - 190 * k);
      ctx.fillText(`${start.getMonth() + 1}月${start.getDate()}日起`, W - 96 * k, H - 146 * k);
      ctx.fillStyle = CINNABAR; ctx.fillRect(W - 96 * k - 16 * k, H - 104 * k, 16 * k, 16 * k);
      ctx.textAlign = 'left';
      return c;
    },
    // 点阵: a calendar of dots — one column a day, one dot per thing done
    dot(entries, start, size = 1080) {
      const W = size, H = Math.round(size * 1.25), k = W / 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
      ctx.fillStyle = '#f1f1ee'; ctx.fillRect(0, 0, W, H);
      const info = weekInfo(entries), P = 90 * k, end = new Date(start.getTime() + 6 * 864e5);
      const wW = dotCanvas(ctx, two(isoWeek(start)), P, P, 22 * k, '#111');
      ctx.fillStyle = '#111'; ctx.font = `500 ${32 * k}px Geist,"PingFang SC",sans-serif`; ctx.fillText('周', P + wW + 8 * k, P + 206 * k);
      ctx.fillStyle = '#6b6b66'; ctx.font = `400 ${26 * k}px Geist,"PingFang SC",sans-serif`; ctx.fillText(`${start.getMonth() + 1}.${start.getDate()} – ${end.getMonth() + 1}.${end.getDate()}`, P, P + 270 * k);
      const gx = P, gy = 470 * k, cw = (W - P * 2) / 7, rows = 10, d = 26 * k;
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row < rows; row++) { const lit = row < info.by[col], x = gx + col * cw + cw / 2, y = gy + (rows - 1 - row) * d * 1.9; ctx.fillStyle = lit ? (col === info.best && row === info.by[col] - 1 ? RED : '#111') : 'rgba(17,17,17,.07)'; ctx.beginPath(); ctx.arc(x, y, d / 2, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#6b6b66'; ctx.font = `400 ${24 * k}px Geist,"PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('一二三四五六日'[col], gx + col * cw + cw / 2, gy + rows * d * 1.9 + 20 * k); ctx.textAlign = 'left';
      }
      const fy = H - P - 110 * k;
      const nW = dotCanvas(ctx, two(entries.length), P, fy, 9 * k, '#111');
      ctx.fillStyle = '#111'; ctx.font = `500 ${26 * k}px Geist,"PingFang SC",sans-serif`; ctx.fillText('件完成', P + nW + 14 * k, fy + 80 * k);
      if (info.focus) { const fx = P + 420 * k, fW = dotCanvas(ctx, String(info.focus), fx, fy, 9 * k, '#111'); ctx.fillText('分钟专注', fx + fW + 14 * k, fy + 80 * k); }
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W - P, fy + 40 * k, 9 * k, 0, 7); ctx.fill();
      return c;
    }
  };

  /* ---------- Thumbnails for theme cards ---------- */
  function thumb(id, w = 196, h = 132) {
    const c = document.createElement('canvas'), dpr = 2; c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    if (id === 'liquid') { const low = document.createElement('canvas'); low.width = 40; low.height = 27; BG.liquid(low.getContext('2d'), 40, 27, 0); ctx.drawImage(low, 0, 0, w, h); } else BG[id](ctx, w, h, 0);
    const rows = ['把想法做出来', '整理拍摄素材', '给家里打电话'];
    if (id === 'liquid') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(10, 42, w - 20, 80, 14); else ctx.rect(10, 42, w - 20, 80); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1; ctx.stroke(); }
    rows.forEach((t, i) => {
      const y = 58 + i * 25;
      if (id === 'liquid') { const g = ctx.createRadialGradient(22, y - 2, 1, 23, y, 7); g.addColorStop(0, '#fff'); g.addColorStop(1, i ? 'rgba(120,130,160,.25)' : 'rgba(110,120,255,.55)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(23, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1d24'; ctx.font = '12px Geist,"PingFang SC",sans-serif'; ctx.fillText(t, 36, y + 4); }
      if (id === 'ink') { ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(20, y, 5.5, 0, 7); ctx.stroke(); ctx.fillStyle = i ? '#1d1a16' : '#9b948a'; ctx.font = `300 12px ${SONG}`; ctx.fillText(t, 34, y + 4); if (!i) { ctx.fillStyle = '#9b948a'; ctx.fillRect(34, y, 72, .8); } ctx.fillStyle = 'rgba(29,26,22,.12)'; ctx.fillRect(34, y + 12, w - 48, .6); }
      if (id === 'dot') { ctx.fillStyle = '#111'; for (let a = 0; a < 12; a++) { const an = a / 12 * 6.283; ctx.beginPath(); ctx.arc(20 + Math.cos(an) * 5.5, y + Math.sin(an) * 5.5, .9, 0, 7); ctx.fill(); } ctx.font = '12px Geist,"PingFang SC",sans-serif'; ctx.fillText(t, 34, y + 4); }
      if (id === 'noir') { ctx.strokeStyle = hexA(GOLD, .8); ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(20, y, 5.5, 0, 7); ctx.stroke(); ctx.fillStyle = '#efe6d6'; ctx.font = '12px Geist,"PingFang SC",sans-serif'; ctx.fillText(t, 34, y + 4); ctx.fillStyle = hexA(GOLD, .3); ctx.fillRect(34, y + 12, w - 48, .5); }
    });
    if (id === 'liquid') { ctx.fillStyle = '#1b1d24'; ctx.font = '200 28px Geist,sans-serif'; ctx.fillText('2/6', 14, 32); }
    if (id === 'ink') { ctx.fillStyle = '#1d1a16'; ctx.font = `300 20px ${SONG}`; ctx.fillText('今日', 14, 30); ctx.fillStyle = CINNABAR; ctx.beginPath(); ctx.arc(62, 24, 2.5, 0, 7); ctx.fill(); }
    if (id === 'dot') { dotCanvas(ctx, '02/06', 14, 12, 2.6, '#111'); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(w - 18, 20, 3, 0, 7); ctx.fill(); }
    if (id === 'noir') { ctx.fillStyle = GOLD; ctx.font = `400 26px ${SERIF}`; ctx.fillText('N° 02', 14, 32); }
    return c.toDataURL('image/png');
  }

  window.SuiSuiSkins = { mount, unmount, head, jar, art: (id, entries, start, size) => ART[id] ? ART[id](entries, start, size) : null, thumb, dotSvg, isoWeek, fonts() {}, fontReady: () => Promise.resolve() };
})();
