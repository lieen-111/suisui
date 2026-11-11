/* 碎碎清单 Pro skins —「一日四时」: four times of day, each with its own way of drawing today.
     dawn  晨 · 玻璃   a measuring glass that fills with light as things get done
     day   昼 · 纸     manuscript paper: one character per task, circled in red when done
     dusk  暮 · 金     a sunset dial: the sun crosses the sky and sets when the list is clear
     night 夜 · 光     a constellation: every task is a star, done ones light up and join
   What they share: completion still breaks the task into pieces (in the theme's material), and the pieces go into
   the same jar. Everything else — header, check, rows, weekly picture — belongs to the theme.
   The list stays the subject: backgrounds are quiet. pro.js decides which theme is on. */
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
  const CINNABAR = '#b43a2c', GOLD = '#c8a66a';
  const SONG = '"Noto Serif SC","Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SERIF = '"Bodoni Moda","Didot","Bodoni 72","Playfair Display","Noto Serif","Times New Roman",serif';
  const MAT = { dawn: 'glass', day: 'paper', dusk: 'gold', night: 'light' };

  /* ---------- Backgrounds: quiet ---------- */
  function grain(ctx, w, h, alpha, seed = 3, color = '0,0,0') {
    const r = rng(seed), n = Math.round(w * h / 9);
    for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${color},${alpha * r()})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  }
  function stars(ctx, w, h, n, seed, a = .5) { const r = rng(seed); for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(223,230,255,${.1 + r() * a})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, r() < .05 ? 1.3 : .35 + r() * .5, 0, 7); ctx.fill(); } }
  const BG = {
    dawn(ctx, w, h, t = 0) { // drawn at 1/5 resolution; the browser's smoothing makes it soft light
      ctx.fillStyle = '#eef0f4'; ctx.fillRect(0, 0, w, h);
      [['#c9c2ff', .22, .18, .9, 1], ['#bfeee2', .82, .34, .8, 1.4], ['#ffd9c7', .3, .78, .85, 1.9], ['#d6e4ff', .78, .9, .7, 2.6]].forEach(([c, x, y, r, p]) => {
        const cx = (x + .06 * Math.sin(t / 7000 + p)) * w, cy = (y + .05 * Math.cos(t / 8000 + p * 2)) * h, R = r * Math.max(w, h) * .55, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, hexA(c, .7)); g.addColorStop(1, hexA(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
    },
    day(ctx, w, h) { ctx.fillStyle = '#f5f2ec'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, .05, 4, '90,70,40'); },
    dusk(ctx, w, h) {
      ctx.fillStyle = '#15110c'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * .5, -h * .1, 10, w * .5, -h * .1, h * 1.1); g.addColorStop(0, 'rgba(200,150,90,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, .05, 9, '255,240,210');
    },
    night(ctx, w, h) {
      ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * .5, -h * .2, 10, w * .5, -h * .2, h); g.addColorStop(0, 'rgba(90,110,190,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      stars(ctx, w, h * .9, Math.round(w * h / 2600), 77, .45);
    }
  };
  const RES = { dawn: 5 }, FPS = { dawn: 120 };
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

  /* ---------- Today, as the header and the theme cards see it ---------- */
  function data() {
    const st = API.state, todo = API.pending(), done = st.tasks.filter(t => t.done).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0)), d = new Date();
    const cds = (Array.isArray(st.settings.countdowns) ? st.settings.countdowns : []).map(c => { const [y, m, dd] = String(c.date).split('-').map(Number); return { title: c.title, n: Math.round((new Date(y, m - 1, dd) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5) }; }).filter(c => c.n >= 0).sort((a, b) => a.n - b.n);
    const lunar = (() => { try { return (API.lunar(d) || '').replace(/^.+?年/, ''); } catch { return ''; } })();
    // the list's own order, so a cell or a star never moves when its task gets done
    const today = new Set([...todo, ...done].map(t => t.id)), items = st.tasks.filter(t => today.has(t.id)).map(t => ({ id: t.id, title: t.title, done: !!t.done, at: t.completedAt || 0 }));
    return { left: todo.length, done: done.length, total: todo.length + done.length, d, lunar, cds, items };
  }
  const DEMO = (() => {
    const titles = ['把想法做出来', '整理拍摄素材', '给家里打电话', '读二十页书', '跑步三公里', '回复客户'];
    return { left: 4, done: 2, total: 6, d: new Date(2026, 10, 10, 9), lunar: '九月廿一', cds: [], items: titles.map((t, i) => ({ id: `demo${i}`, title: t, done: i < 2, at: i })) };
  })();
  const first = s => esc(Array.from(String(s).trim())[0] || '·');
  const f1 = v => Math.round(v * 10) / 10;
  const SANS_UI = "Geist,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
  const dateLine = D => `${D.d.getMonth() + 1}月${D.d.getDate()}日 · 星期${WEEK[D.d.getDay()]}`;
  // A = the task that just landed in the picture: { id, from: how many were done before it }. Only that one animates.

  /* 晨 · 玻璃 — a measuring glass: it fills as the day's things get done */
  function dawnArt(D, A) {
    const W = 340, H = 156, lv = p => H - 12 - p * (H - 34), pct = D.total ? D.done / D.total : 0, level = D.done ? lv(pct) : H - 6, n = Math.min(D.total, 14);
    const from = A && D.total ? (A.from ? lv(A.from / D.total) : H - 6) : level, rise = f1(from - level);
    const wave = (y, amp, ph) => { let p = `M0 ${f1(y)}`; for (let x = 0; x <= W * 2; x += 17) p += ` L${x} ${f1(y + Math.sin(x / 340 * Math.PI * 4 + ph) * amp)}`; return `${p} L${W * 2} ${H + 40} L0 ${H + 40} Z`; };
    let ticks = '';
    for (let i = 1; i <= n; i++) { const y = f1(lv(i / n)), on = i <= D.done, fresh = A && i === D.done; ticks += `<line class="${fresh ? 'ph-new ph-grow' : ''}" style="transform-origin:${W - 16}px ${y}px" x1="${W - 16}" x2="${on ? W - 30 : W - 23}" y1="${y}" y2="${y}" stroke="#1b1d24" stroke-opacity="${on ? .5 : .18}" stroke-width="1.1" stroke-linecap="round"/>`; }
    const r = rng(9); let bubbles = '';
    if (D.done) for (let i = 0; i < 9; i++) { const x = f1(30 + r() * 250), s = f1(1.2 + r() * 2.2); bubbles += `<circle class="ph-bubble" cx="${x}" cy="${H - 4}" r="${s}" fill="#fff" fill-opacity=".75" style="--b:${f1(level - H + 10)}px;animation-delay:${f1(r() * 6)}s;animation-duration:${f1(4 + r() * 4)}s"/>`; }
    const state = D.total ? (D.left ? `满了 ${Math.round(pct * 100)}%，还差 ${D.left} 件` : '满了。今天的都做完了') : '今天是一只空杯子';
    return { H, land: { x: 200, y: level }, svg: `<defs><linearGradient id="pd-liq" x1="0" y1="0" x2="1" y2=".5"><stop offset="0" stop-color="#a99fff"/><stop offset=".5" stop-color="#86dcc6"/><stop offset="1" stop-color="#ffb99b"/></linearGradient><linearGradient id="pd-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3c3a8a" stop-opacity=".12"/></linearGradient><clipPath id="pd-clip"><rect width="${W}" height="${H}" rx="30"/></clipPath></defs>
      <g clip-path="url(#pd-clip)"><g class="${A ? 'ph-rise' : ''}" style="--rise:${rise}px">
        <g class="ph-wave ph-wave-b"><path d="${wave(level - 4, 4, 1.4)}" fill="url(#pd-liq)" opacity=".42"/></g>
        <g class="ph-wave"><path d="${wave(level, 4.5, 0)}" fill="url(#pd-liq)" opacity=".9"/></g>
        <rect y="${f1(level)}" width="${W}" height="${H}" fill="url(#pd-deep)"/>${bubbles}
        ${A ? `<ellipse class="ph-ripple" cx="200" cy="${f1(level)}" rx="26" ry="5" fill="none" stroke="#fff" stroke-width="1.4"/>` : ''}
      </g></g>${ticks}
      <text class="${A ? 'ph-pop' : ''}" x="24" y="66" font-family="${SANS_UI}" fill="#1b1d24"><tspan font-size="58" font-weight="200" letter-spacing="-2">${D.done}</tspan><tspan font-size="22" fill-opacity=".38" dx="5">/ ${D.total}</tspan></text>
      <text x="26" y="92" font-family="${SANS_UI}" font-size="12.5" fill="#5d6273" letter-spacing=".3">${dateLine(D)}${D.lunar ? ` · ${esc(D.lunar)}` : ''}</text>
      <text x="26" y="${H - 18}" font-family="${SANS_UI}" font-size="12.5" font-weight="500" fill="#1b1d24" fill-opacity=".78">${state}</text>` };
  }

  /* 昼's words: a line of encouragement with one character per task. Not yet done = traced in light red, like a
     copybook (描红); done = written in ink and circled. Finish the day and the whole line is written.
     "|" is where the line breaks onto the next row of the grid (at most 7 per row). */
  const PHRASES = {
    1: ['成', '好'], 2: ['加油', '很棒'], 3: ['你真棒', '稳稳的'],
    4: ['天天向上', '好好生活', '心想事成'], 5: ['日日是好日', '今天也很棒', '慢慢就会好'],
    6: ['今日事今日毕', '一步一个脚印', '慢慢来比较快'], // the header always uses the first for 6 7: ['星光不问赶路人', '积跬步以至千里'],
    8: ['千里之行|始于足下', '日拱一卒|功不唐捐', '行而不辍|未来可期'], 9: ['慢慢来|一切都来得及'],
    10: ['所有的努力|都不会白费'], 11: ['今天的你|比昨天更好一点'], 12: ['你今天做的|每一件事都算数'],
    13: ['认真生活的人|运气都不会太差'], 14: ['长风破浪会有时|直挂云帆济沧海', '宝剑锋从磨砺出|梅花香自苦寒来']
  };
  /** The line for n tasks (more than 14 share a 14-character line). Stays the same all day for the same n. */
  function phrase(n, seed = '', step = 0) {
    const k = Math.max(1, Math.min(14, n)), list = PHRASES[k], line = list[seed === '' ? step % list.length : (hash(`${seed}:${k}`) + step) % list.length];
    return { text: line.replace('|', ''), rows: line.split('|').map(r => Array.from(r)) };
  }
  const dayKeyOf = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function dayArt(D, A) {
    const cell = 35, n = D.total || 4, P = n === 6 ? phrase(6, '', 0) : phrase(n, dayKeyOf(D.d)), len = P.text.length;
    // with more than 14 tasks the line fills in proportion
    const written = D.total ? (D.total <= 14 ? D.done : D.left ? Math.floor(D.done / D.total * len) : len) : 0;
    const before = A ? (D.total <= 14 ? A.from : Math.floor(A.from / D.total * len)) : written;
    const gridH = P.rows.length * cell, H = Math.max(gridH + 64, 150);
    let g = '', k = 0, land = { x: cell / 2, y: cell / 2 + 4.5 };
    P.rows.forEach((row, r) => row.forEach((ch, c) => {
      const x = c * cell + .5, y = r * cell + 4.5, cx = x + cell / 2, cy = y + cell / 2, on = k < written, fresh = on && k >= before;
      if (k === before) land = { x: cx, y: cy };
      g += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${CINNABAR}" stroke-opacity=".5" stroke-width=".8"/>
        <path d="M${x} ${cy}H${x + cell}M${cx} ${y}V${y + cell}M${x} ${y}L${x + cell} ${y + cell}M${x + cell} ${y}L${x} ${y + cell}" stroke="${CINNABAR}" stroke-opacity=".13" stroke-width=".55" stroke-dasharray="2 2.4"/>
        <text class="${fresh ? 'ph-written' : ''}" x="${cx}" y="${cy + 7.4}" text-anchor="middle" font-family='${SONG}' font-size="21" fill="${on ? '#1d1a16' : CINNABAR}" fill-opacity="${on ? .92 : .3}">${esc(ch)}</text>`;
      if (on) { const q = rng(hash(`${ch}${k}`)), rot = f1((q() - .5) * 50); g += `<path class="ph-circle${fresh ? ' ph-new' : ''}" pathLength="1" transform="rotate(${rot} ${cx} ${cy})" d="M${cx - 14} ${cy - 1}C${cx - 14} ${cy - 13} ${cx + 13} ${cy - 15} ${cx + 14.5} ${cy - 1}C${cx + 15.5} ${cy + 12} ${cx - 6} ${cy + 16.5} ${cx - 13} ${cy + 6}C${cx - 15} ${cy + 1} ${cx - 12} ${cy - 7} ${cx - 6} ${cy - 11.5}" fill="none" stroke="${CINNABAR}" stroke-width="1.7" stroke-linecap="round"/>`; }
      k++;
    }));
    let v = '';
    Array.from(`${cn(D.d.getMonth() + 1)}月${cn(D.d.getDate())}日`).forEach((ch, i) => { v += `<text x="324" y="${22 + i * 22}" text-anchor="middle" font-family='${SONG}' font-size="19" fill="#1d1a16">${ch}</text>`; });
    Array.from(`星期${WEEK[D.d.getDay()]}${D.lunar ? `　${D.lunar}` : ''}`).slice(0, 8).forEach((ch, i) => { v += `<text x="300" y="${21 + i * 16}" text-anchor="middle" font-family='${SONG}' font-size="12" fill="#8a8279">${esc(ch)}</text>`; });
    const hint = `<text x="1" y="${gridH + 27}" font-family='${SONG}' font-size="11.5" fill="#8a8279" fill-opacity=".85" letter-spacing="1">${!D.total ? '加一件事，就多一个字' : D.total <= 14 ? '做完一件，写下一个字' : '做得越多，写下的字越多'}</text>`;
    const foot = D.total ? `<tspan fill="#8a8279">做完 </tspan><tspan fill="${CINNABAR}">${cn(D.done)}</tspan><tspan fill="#8a8279"> / ${cn(D.total)}</tspan>${D.left ? '' : `<tspan fill="${CINNABAR}">　今日毕</tspan>`}` : '<tspan fill="#8a8279">今天的稿纸还空着</tspan>';
    return { H, land, svg: `${g}${v}${hint}<text x="1" y="${H - 14}" font-family='${SONG}' font-size="14" letter-spacing="1.5">${foot}</text>` };
  }

  /* 暮 · 金 — sunset: the sun crosses the sky as tasks get done and sets when the list is clear */
  function duskArt(D, A) {
    const W = 340, H = 178, hz = 146, cx = 170, R = 116, n = Math.min(D.total, 24), pct = D.total ? D.done / D.total : 0, p0 = A && D.total ? A.from / D.total : pct;
    let ticks = '';
    for (let i = 0; i < n; i++) { const a = Math.PI - (i + .5) / n * Math.PI, on = i < D.done, fresh = A && i === D.done - 1, r0 = R + 7, r1 = r0 + (on ? 14 : 5); ticks += `<line class="${fresh ? 'ph-new ph-grow-r' : ''}" style="transform-origin:${f1(cx + Math.cos(a) * r0)}px ${f1(hz - Math.sin(a) * r0)}px" x1="${f1(cx + Math.cos(a) * r0)}" y1="${f1(hz - Math.sin(a) * r0)}" x2="${f1(cx + Math.cos(a) * r1)}" y2="${f1(hz - Math.sin(a) * r1)}" stroke="${GOLD}" stroke-opacity="${on ? 1 : .32}" stroke-width="${on ? 1.4 : .8}" stroke-linecap="round"/>`; }
    // the sun is drawn at the left horizon and turned about the dial's centre, so a move is one rotation
    const deg = f1(pct * 180), from = f1(p0 * 180), x0 = cx - R;
    const arc = `M${cx - R} ${hz}A${R} ${R} 0 0 1 ${cx + R} ${hz}`;
    return { H, land: { x: f1(cx + Math.cos(Math.PI - p0 * Math.PI) * R), y: f1(hz - Math.sin(Math.PI - p0 * Math.PI) * R) }, svg: `<defs><radialGradient id="pk-sun" cx=".38" cy=".34"><stop offset="0" stop-color="#fbf1da"/><stop offset=".55" stop-color="#d9b97c"/><stop offset="1" stop-color="#9c7f47"/></radialGradient><radialGradient id="pk-glow"><stop offset="0" stop-color="#e2c48a" stop-opacity=".42"/><stop offset="1" stop-color="#c8a66a" stop-opacity="0"/></radialGradient><clipPath id="pk-sky"><rect x="-20" y="-20" width="${W + 40}" height="${hz + 20}"/></clipPath></defs>
      <path d="${arc}" fill="none" stroke="${GOLD}" stroke-opacity=".28" stroke-width=".8" stroke-dasharray="1.5 4.5"/>
      <path class="${A ? 'ph-arc' : ''}" style="--a0:${f1(p0 * 1000) / 1000}" d="${arc}" pathLength="1" stroke-dasharray="${f1(pct * 1000) / 1000} 1" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>${ticks}
      <g clip-path="url(#pk-sky)"><g class="ph-sun${A ? ' ph-sunmove' : ''}" style="--from:${from}deg;--to:${deg}deg;transform-origin:${cx}px ${hz}px;transform:rotate(${deg}deg)">
        <circle class="${A ? 'ph-flare' : ''}" cx="${x0}" cy="${hz}" r="46" fill="url(#pk-glow)"/><circle cx="${x0}" cy="${hz}" r="11.5" fill="url(#pk-sun)"/></g></g>
      <line x1="0" x2="${W}" y1="${hz}" y2="${hz}" stroke="${GOLD}" stroke-opacity=".65" stroke-width=".8"/>
      <line x1="${cx - 60}" x2="${cx + 60}" y1="${hz + 5}" y2="${hz + 5}" stroke="${GOLD}" stroke-opacity=".18" stroke-width=".7"/>
      <text class="${A ? 'ph-pop' : ''}" x="${cx}" y="${hz - 32}" text-anchor="middle" font-family='${SERIF}' font-size="52" fill="${GOLD}" letter-spacing="-.5">${two(D.done)}</text>
      <text x="${cx}" y="${hz - 12}" text-anchor="middle" font-family='${SONG}' font-size="11.5" fill="#9c907c" letter-spacing="3">${D.total ? (D.left ? `共 ${D.total} 件` : '日落　收工') : '今天还没有安排'}</text>
      <text x="${cx}" y="${hz + 26}" text-anchor="middle" font-family='${SONG}' font-size="11.5" fill="#b3a68e" letter-spacing="2.5">${D.d.getMonth() + 1}月${D.d.getDate()}日　星期${WEEK[D.d.getDay()]}${D.lunar ? `　${esc(D.lunar)}` : ''}</text>` };
  }

  /* 夜 · 光 — a constellation: every task is a star; done ones light up and join into today's shape */
  const SPARK = (x, y, s) => `M${x} ${y - s}C${f1(x + s * .12)} ${f1(y - s * .12)} ${f1(x + s * .12)} ${f1(y - s * .12)} ${x + s} ${y}C${f1(x + s * .12)} ${f1(y + s * .12)} ${f1(x + s * .12)} ${f1(y + s * .12)} ${x} ${y + s}C${f1(x - s * .12)} ${f1(y + s * .12)} ${f1(x - s * .12)} ${f1(y + s * .12)} ${x - s} ${y}C${f1(x - s * .12)} ${f1(y - s * .12)} ${f1(x - s * .12)} ${f1(y - s * .12)} ${x} ${y - s}Z`;
  function nightArt(D, A) {
    const W = 340, H = 156, items = D.items.slice(0, 18), placed = [], pts = {};
    for (const it of items) {
      const r = rng(hash(it.id)); let best = null, bd = -1;
      for (let k = 0; k < 16; k++) { const x = 134 + r() * 186, y = 16 + r() * 124; if (x > 278 && y < 60) continue; const d = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 999); if (d > bd) { bd = d; best = { x, y }; } if (d > 32) break; }
      const p = { ...(best || { x: 200, y: 80 }), it }; placed.push(p); pts[it.id] = { x: f1(p.x), y: f1(p.y) };
    }
    const lit = placed.filter(p => p.it.done).sort((a, b) => a.it.at - b.it.at), fresh = A && lit.length && lit[lit.length - 1].it.id === A.id;
    const bg = (() => { const r = rng(5); let s = ''; for (let i = 0; i < 52; i++) s += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(.3 + r() * .6)}" fill="#dfe6ff" fill-opacity="${f1(.08 + r() * .3)}"/>`; return s; })();
    const old = fresh ? lit.slice(0, -1) : lit;
    let lines = old.length > 1 ? `<polyline points="${old.map(p => `${f1(p.x)},${f1(p.y)}`).join(' ')}" fill="none" stroke="#dfe6ff" stroke-opacity=".4" stroke-width=".9" stroke-linejoin="round"/>` : '';
    if (fresh && lit.length > 1) { const a = lit[lit.length - 2], b = lit[lit.length - 1]; lines += `<line class="ph-draw" pathLength="1" x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="#dfe6ff" stroke-opacity=".55" stroke-width="1"/>`; }
    const stars = placed.map((p, i) => p.it.done
      ? `<g class="ph-star${A && A.id === p.it.id ? ' ph-new' : ''}" style="transform-origin:${f1(p.x)}px ${f1(p.y)}px;animation-delay:${(i * .37 % 3).toFixed(2)}s"><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="11" fill="url(#pn-glow)"/><path d="${SPARK(f1(p.x), f1(p.y), 7)}" fill="#f6f8ff"/></g>${A && A.id === p.it.id ? `<circle class="ph-burst" style="transform-origin:${f1(p.x)}px ${f1(p.y)}px" cx="${f1(p.x)}" cy="${f1(p.y)}" r="14" fill="none" stroke="#c9d6ff" stroke-width="1"/>` : ''}`
      : `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="1.7" fill="#dfe6ff" fill-opacity=".55"/><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="5" fill="none" stroke="#dfe6ff" stroke-opacity=".17" stroke-width=".7"/>`).join('');
    const taps = Object.entries(pts).map(([id, p]) => `<circle class="ph-tap" data-task="${esc(id)}" cx="${p.x}" cy="${p.y}" r="14" fill="transparent"/>`).join('');
    return { H, pts, land: { x: 230, y: 70 }, svg: `<defs><radialGradient id="pn-glow"><stop offset="0" stop-color="#a9bcff" stop-opacity=".6"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></radialGradient></defs>${bg}${lines}${stars}
      <text x="2" y="26" font-family="${SANS_UI}" font-size="12" fill="#7d8496" letter-spacing=".3">${dateLine(D)}</text>
      <text class="${A ? 'ph-pop' : ''}" x="0" y="98" font-family="${SANS_UI}" fill="#eef1fa"><tspan font-size="58" font-weight="200" letter-spacing="-2">${D.done}</tspan><tspan font-size="21" fill-opacity=".38" dx="5">/ ${D.total}</tspan></text>
      <text x="2" y="126" font-family="${SANS_UI}" font-size="12.5" fill="#aab2c6">${D.total ? (D.left ? `今天亮了 ${D.done} 颗星` : '今天的星座连好了') : '今晚还没有星星'}</text>${taps}` };
  }
  const ART = { dawn: dawnArt, day: dayArt, dusk: duskArt, night: nightArt };
  let uid = 0;
  const unique = (svg, u) => svg.replace(/(id="|url\(#)(p[dkn]-[a-z]+)/g, (m, p, id) => `${p}${id}-${u}`);
  const artSvg = (id, D, cls = 'ph-art', A = null) => { const a = ART[id](D, A); return { a, html: `<svg class="${cls}" viewBox="0 0 340 ${a.H}" width="340" height="${a.H}" aria-hidden="true">${unique(a.svg, ++uid)}</svg>` }; };

  /* ---------- Theme cards: the theme's own picture of today, then two rows with its own check ---------- */
  const CHECK = {
    dawn: (x, y, on) => `<circle cx="${x}" cy="${y}" r="9" fill="${on ? 'url(#pd-liq)' : '#1b1d240d'}" stroke="${on ? '#fff' : '#1b1d24'}" stroke-opacity="${on ? 1 : .35}" stroke-width="1.2"/><circle cx="${x - 3}" cy="${y - 3.5}" r="2.4" fill="#fff" opacity=".9"/>`,
    day: (x, y, on) => `<rect x="${x - 8.5}" y="${y - 8.5}" width="17" height="17" fill="none" stroke="#1d1a16" stroke-opacity=".6" stroke-width=".8"/>${on ? `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${CINNABAR}" stroke-width="1.4"/>` : ''}`,
    dusk: (x, y, on) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" transform="rotate(45 ${x} ${y})" fill="${on ? GOLD : 'none'}" stroke="${GOLD}" stroke-width="1"/>`,
    night: (x, y, on) => `<path d="${SPARK(x, y, 9)}" fill="${on ? '#f4f6ff' : 'none'}" stroke="#dfe6ff" stroke-opacity="${on ? 1 : .6}" stroke-width=".9"/>`
  };
  const MOCK_BG = {
    dawn: '<defs><radialGradient id="pd-b1" cx=".15" cy=".1" r=".8"><stop offset="0" stop-color="#c9c2ff"/><stop offset="1" stop-color="#c9c2ff" stop-opacity="0"/></radialGradient><radialGradient id="pd-b2" cx=".9" cy=".6" r=".7"><stop offset="0" stop-color="#bfeee2"/><stop offset="1" stop-color="#bfeee2" stop-opacity="0"/></radialGradient><radialGradient id="pd-b3" cx=".3" cy="1" r=".7"><stop offset="0" stop-color="#ffd9c7"/><stop offset="1" stop-color="#ffd9c7" stop-opacity="0"/></radialGradient></defs><rect width="380" height="270" fill="#eef0f4"/><rect width="380" height="270" fill="url(#pd-b1)"/><rect width="380" height="270" fill="url(#pd-b2)"/><rect width="380" height="270" fill="url(#pd-b3)"/>',
    day: '<rect width="380" height="270" fill="#f5f2ec"/>',
    dusk: '<defs><radialGradient id="pk-bg" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#3a2a16"/><stop offset="1" stop-color="#15110c"/></radialGradient></defs><rect width="380" height="270" fill="url(#pk-bg)"/>',
    night: '<rect width="380" height="270" fill="#07080d"/>'
  };
  const INK = { dawn: '#1b1d24', day: '#1d1a16', dusk: '#efe6d6', night: '#e8ecf7' }, ROWLINE = { dawn: '#1b1d2414', day: '#b43a2c40', dusk: '#c8a66a40', night: '#dfe6ff1f' };
  function mock(id) {
    if (id === 'auto') {
      const cols = [['#eef0f4', '#1b1d24'], ['#f5f2ec', '#1d1a16'], ['#15110c', GOLD], ['#07080d', '#dfe6ff']];
      return `<svg class="pro-thumb pro-mock-svg" viewBox="0 0 380 270" preserveAspectRatio="xMinYMin slice" aria-hidden="true">${cols.map(([b, c], i) => `<rect x="${i * 95}" width="95.5" height="270" fill="${b}"/><text x="${i * 95 + 47.5}" y="150" text-anchor="middle" font-family='${SONG}' font-size="44" font-weight="300" fill="${c}">${'晨昼暮夜'[i]}</text>`).join('')}</svg>`;
    }
    const a = ART[id](DEMO, null), u = ++uid, y0 = a.H + 34;
    const rows = ['读二十页书', '跑步三公里'].map((t, i) => { const y = y0 + i * 40; return `${CHECK[id](40, y, false)}<text x="62" y="${y + 5}" font-family='${id === 'day' ? SONG : id === 'dusk' ? SONG : "Geist,-apple-system,'PingFang SC',sans-serif"}' font-size="14" fill="${INK[id]}">${t}</text><rect x="62" y="${y + 19}" width="290" height=".7" fill="${ROWLINE[id]}"/>`; }).join('');
    const glass = id === 'dawn' ? `<rect x="20" y="16" width="340" height="${a.H}" rx="28" fill="#ffffff" fill-opacity=".45" stroke="#fff" stroke-opacity=".9"/>` : '';
    return `<svg class="pro-thumb pro-mock-svg" viewBox="0 0 380 270" preserveAspectRatio="xMinYMin slice" aria-hidden="true">${unique(MOCK_BG[id], u)}${glass}<g transform="translate(20 16)">${unique(a.svg, u)}</g>${unique(rows, u)}</svg>`;
  }

  /* ---------- Header: each theme draws today its own way; the countdowns sit under it ----------
     When a task is completed, its pieces fly into the picture (pro.js) and land: until then the header still shows it
     as not done; on landing (arrive) the picture changes with that one task animated. */
  let seen = null, seenTheme = '', geo = null, landing = null, lastHtml = '';
  const arriving = new Map();
  function head() {
    if (!current) return;
    const top = $('tasks-panel')?.querySelector('.today-top'); if (!top) return;
    let el = $('pro-head'); if (!el) { el = document.createElement('div'); el.id = 'pro-head'; top.before(el); lastHtml = ''; }
    const D = data(), doneIds = D.items.filter(i => i.done).map(i => i.id);
    if (seen && seenTheme === current && !reduce()) doneIds.forEach(id => { if (!seen.has(id) && !arriving.has(id)) arriving.set(id, setTimeout(() => arrive(id), 1800)); });
    for (const [id, t] of arriving) if (!doneIds.includes(id) || seenTheme !== current) { clearTimeout(t); arriving.delete(id); }
    seen = new Set(doneIds); seenTheme = current;
    const shown = arriving.size ? { ...D, done: D.done - arriving.size, left: D.left + arriving.size, items: D.items.map(i => arriving.has(i.id) ? { ...i, done: false } : i) } : D;
    const a = ART[current](shown, landing); geo = a;
    const label = `${D.d.getMonth() + 1}月${D.d.getDate()}日，完成 ${shown.done} / ${shown.total}`;
    const html = `<div class="ph-stage" role="img" aria-label="${label}"><svg class="ph-art" viewBox="0 0 340 ${a.H}" width="340" height="${a.H}" aria-hidden="true">${unique(a.svg, 'h')}</svg><span class="pro-head-jar"></span></div>
      ${D.cds.length ? `<div class="ph-cds">${D.cds.slice(0, 3).map(c => `<span><b>${current === 'day' ? (c.n ? cn(c.n) : '今') : c.n || '今天'}</b><small>${c.n ? (current === 'day' ? '日' : '天') : ''}</small>${esc(c.title)}</span>`).join('')}</div>` : ''}`;
    el.className = `pro-head pro-head-${current}`;
    if (html === lastHtml && !landing) return;
    const keepJar = $('pro-jar-button'); if (keepJar && el.contains(keepJar)) $('today-side')?.prepend(keepJar);
    el.innerHTML = html; lastHtml = landing ? '' : html;
    const jar = $('pro-jar-button'), slot = el.querySelector('.pro-head-jar'); if (jar && slot) slot.append(jar);
  }
  /* ---------- The lock screen: one small strip with the theme's picture of today, under 「今天的待办」 ---------- */
  function lockStripSvg(id, D) {
    const W = 340, pct = D.total ? D.done / D.total : 0;
    if (id === 'dawn') {
      const n = Math.min(D.total, 14); let ticks = '';
      for (let i = 1; i < n; i++) ticks += `<line x1="${f1(6 + i / n * 328)}" x2="${f1(6 + i / n * 328)}" y1="11" y2="${i <= D.done ? 33 : 16}" stroke="#fff" stroke-opacity="${i <= D.done ? .7 : .55}" stroke-width="1"/>`;
      return { H: 44, svg: `<defs><linearGradient id="pl-liq" x1="0" x2="1"><stop offset="0" stop-color="#a99fff"/><stop offset=".55" stop-color="#86dcc6"/><stop offset="1" stop-color="#ffb99b"/></linearGradient><clipPath id="pl-tube"><rect x="1" y="8" width="338" height="28" rx="14"/></clipPath></defs>
        <rect x="1" y="8" width="338" height="28" rx="14" fill="#ffffff" fill-opacity=".38" stroke="#fff" stroke-opacity=".9"/>
        <g clip-path="url(#pl-tube)"><rect x="1" y="8" width="${f1(pct * 338)}" height="28" fill="url(#pl-liq)" opacity=".92"/><rect x="1" y="9" width="338" height="6" fill="#fff" opacity=".35"/></g>${ticks}` };
    }
    if (id === 'day') {
      const n = D.total || 4, P = n === 6 ? phrase(6, '', 0) : phrase(n, dayKeyOf(D.d)), chars = Array.from(P.text), len = chars.length, cell = Math.min(40, (W - 12) / len);
      const written = D.total ? (D.total <= 14 ? D.done : D.left ? Math.floor(D.done / D.total * len) : len) : 0, w = cell * len + 12;
      let g = `<rect x="0" y="0" width="${f1(w)}" height="${f1(cell + 12)}" rx="3" fill="#f5f2ec" fill-opacity=".95"/>`;
      chars.forEach((ch, i) => { const x = 6 + i * cell, cx = x + cell / 2, cy = 6 + cell / 2, on = i < written;
        g += `<rect x="${f1(x)}" y="6" width="${f1(cell)}" height="${f1(cell)}" fill="none" stroke="${CINNABAR}" stroke-opacity=".5" stroke-width=".7"/><text x="${f1(cx)}" y="${f1(cy + cell * .22)}" text-anchor="middle" font-family='${SONG}' font-size="${f1(cell * .6)}" fill="${on ? '#1d1a16' : CINNABAR}" fill-opacity="${on ? .92 : .32}">${esc(ch)}</text>${on ? `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(cell * .42)}" fill="none" stroke="${CINNABAR}" stroke-width="1.3"/>` : ''}`; });
      return { H: cell + 12, svg: g };
    }
    if (id === 'dusk') {
      // the sun's path is a shallow arc across the strip; one dot per task along it
      const hz = 40, n = Math.min(D.total, 24); let ticks = '';
      for (let i = 0; i < n; i++) { const t = (i + .5) / n, x = 20 + t * 300, y = hz - Math.sin(t * Math.PI) * 30; ticks += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i < D.done ? 1.6 : 1}" fill="${GOLD}" fill-opacity="${i < D.done ? 1 : .45}"/>`; }
      const sx = 20 + pct * 300, sy = hz - Math.sin(pct * Math.PI) * 30;
      return { H: 46, svg: `<defs><radialGradient id="pl-sun" cx=".38" cy=".34"><stop offset="0" stop-color="#fbf1da"/><stop offset=".55" stop-color="#d9b97c"/><stop offset="1" stop-color="#9c7f47"/></radialGradient><radialGradient id="pl-glow"><stop offset="0" stop-color="#e2c48a" stop-opacity=".5"/><stop offset="1" stop-color="#c8a66a" stop-opacity="0"/></radialGradient></defs>
        <path d="M20 ${hz}Q170 ${hz - 60} 320 ${hz}" fill="none" stroke="${GOLD}" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="1.5 4"/>${ticks}
        <line x1="0" x2="${W}" y1="${hz}" y2="${hz}" stroke="${GOLD}" stroke-opacity=".7" stroke-width=".8"/>
        <circle cx="${f1(sx)}" cy="${f1(sy)}" r="20" fill="url(#pl-glow)"/><circle cx="${f1(sx)}" cy="${f1(sy)}" r="7" fill="url(#pl-sun)"/>` };
    }
    if (id === 'night') {
      const items = D.items.slice(0, 18), pts = items.map(it => { const r = rng(hash(it.id)); return { x: 10 + r() * 320, y: 6 + r() * 34, it }; });
      const lit = pts.filter(p => p.it.done).sort((a, b) => a.it.at - b.it.at);
      return { H: 46, svg: `<defs><radialGradient id="pl-glow"><stop offset="0" stop-color="#a9bcff" stop-opacity=".6"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></radialGradient></defs>
        ${lit.length > 1 ? `<polyline points="${lit.map(p => `${f1(p.x)},${f1(p.y)}`).join(' ')}" fill="none" stroke="#dfe6ff" stroke-opacity=".5" stroke-width=".8"/>` : ''}
        ${pts.map(p => p.it.done ? `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="9" fill="url(#pl-glow)"/><path d="${SPARK(f1(p.x), f1(p.y), 5.5)}" fill="#f6f8ff"/>` : `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="1.6" fill="#dfe6ff" fill-opacity=".7"/>`).join('')}` };
    }
    return null;
  }
  function lockStrip(id) {
    const activity = $('activity'), old = $('pro-lock-strip');
    if (!id || !ART[id] || !activity) { old?.remove(); return; }
    const a = lockStripSvg(id, data()); if (!a) { old?.remove(); return; }
    const el = old || document.createElement('div'); el.id = 'pro-lock-strip'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg viewBox="0 0 340 ${a.H}" width="340" height="${a.H}">${a.svg}</svg>`;
    if (!old) activity.querySelector('.activity-heading')?.after(el);
  }

  /** Tapping a character cell (昼) or a star (夜) shows which task it is: its row scrolls into view and glows. */
  document.addEventListener('click', e => {
    const tap = e.target.closest?.('#pro-head .ph-tap'); if (!tap) return;
    const id = tap.dataset.task, row = document.querySelector(`.task-row[data-task-id="${CSS.escape(id)}"]`) || document.querySelector(`.done-row[data-completed-id="${CSS.escape(id)}"]`);
    if (!row) return;
    if (row.classList.contains('done-row')) { const sec = $('completed-section'); if (sec) sec.open = true; }
    row.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
    row.classList.remove('pro-flash'); void row.offsetWidth; row.classList.add('pro-flash');
    setTimeout(() => row.classList.remove('pro-flash'), 1600);
  });
  /** The flying pieces reached the picture: show the task as done, animating just that one. */
  function arrive(id) {
    if (!arriving.has(id)) return;
    clearTimeout(arriving.get(id));
    const from = data().done - arriving.size;
    arriving.delete(id); landing = { id, from }; head(); landing = null;
  }
  /** Where on screen the task's pieces should land, or null when the header is not in view. */
  function target(id) {
    const svg = $('pro-head')?.querySelector('.ph-art'); if (!svg || !geo) return null;
    const b = svg.getBoundingClientRect(); if (!b.width || b.bottom < 30 || b.top > innerHeight - 60) return null;
    const k = b.width / 340, p = (geo.pts && geo.pts[id]) || geo.land;
    return { x: b.left + p.x * k, y: b.top + p.y * k };
  }

  /* ---------- The jar: one silhouette, four materials inside ---------- */
  function jarPath(ctx, x, y, w, h) {
    const neck = w * .44, nx = x + (w - neck) / 2, bodyTop = y + h * .2, r = w * .24;
    ctx.beginPath(); ctx.moveTo(nx, y + h * .06); ctx.lineTo(nx, y + h * .14);
    ctx.quadraticCurveTo(nx, bodyTop, x + r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(x, bodyTop + r * .4, x, bodyTop + r);
    ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h); ctx.lineTo(x + w - r, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, bodyTop + r); ctx.quadraticCurveTo(x + w, bodyTop + r * .4, x + w - r * .5, bodyTop + r * .15); ctx.quadraticCurveTo(nx + neck, bodyTop, nx + neck, y + h * .14);
    ctx.lineTo(nx + neck, y + h * .06); ctx.closePath();
  }
  function shardShape(mat, ctx, s, color, r, onDark) {
    const n = 3 + (r() < .4 ? 1 : 0), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r() * 1.3, rad = s * (.34 + r() * .3); pts.push([Math.cos(a) * rad, Math.sin(a) * rad * .82]); }
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
    if (mat === 'paper') { ctx.save(); ctx.shadowColor = 'rgba(70,50,25,.25)'; ctx.shadowBlur = s * .2; ctx.shadowOffsetY = s * .06; ctx.fillStyle = color; ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(29,26,22,.15)'; ctx.lineWidth = .6; ctx.stroke(); return; }
    if (mat === 'light') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(color, .1); ctx.fill(); ctx.shadowColor = color; ctx.shadowBlur = s * .4; ctx.strokeStyle = hexA(color, .9); ctx.lineWidth = Math.max(.7, s / 24); ctx.stroke(); ctx.restore(); return; }
    if (mat === 'gold') { const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#9c7f47'); g.addColorStop(.5, '#f4e8cc'); g.addColorStop(1, '#c8a66a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,.5)'; ctx.lineWidth = .6; ctx.stroke(); return; }
    ctx.fillStyle = hexA(color, onDark ? .6 : .55); ctx.fill(); ctx.strokeStyle = onDark ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(.6, s / 22); ctx.stroke();
  }
  function jar(kind, ctx, x, y, w, h, shards, { ms = 0, lid = true, onDark = true } = {}) {
    const mat = MAT[kind] || 'plain';
    ctx.save(); jarPath(ctx, x, y, w, h);
    let fill;
    if (mat === 'gold') { fill = ctx.createLinearGradient(x, 0, x + w, 0); fill.addColorStop(0, 'rgba(70,56,38,.5)'); fill.addColorStop(.5, 'rgba(25,20,14,.3)'); fill.addColorStop(1, 'rgba(70,56,38,.45)'); }
    else if (mat === 'light') { fill = ctx.createLinearGradient(x, 0, x + w, 0); fill.addColorStop(0, 'rgba(160,180,255,.10)'); fill.addColorStop(.5, 'rgba(160,180,255,.03)'); fill.addColorStop(1, 'rgba(160,180,255,.08)'); }
    else { fill = ctx.createLinearGradient(x, 0, x + w, 0); fill.addColorStop(0, onDark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.72)'); fill.addColorStop(.5, onDark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.32)'); fill.addColorStop(1, onDark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.64)'); }
    ctx.fillStyle = fill; ctx.fill(); ctx.clip();
    if ((mat === 'plain' || mat === 'gold') && onDark) ctx.globalCompositeOperation = 'lighter';
    for (const s of shards) { const r = rng(s.seed); ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = ms ? .82 + .18 * Math.sin(s.seed % 7 + ms / 500) : 1; shardShape(mat, ctx, s.s, s.color, r, onDark); ctx.restore(); }
    ctx.globalCompositeOperation = 'source-over';
    if (ms) { const sx = x - w + ((ms / 3000) % 1) * w * 3, g = ctx.createLinearGradient(sx, 0, sx + w * .5, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, mat === 'gold' ? 'rgba(232,210,160,.14)' : 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    jarPath(ctx, x, y, w, h); ctx.lineWidth = Math.max(.8, w / 90);
    ctx.strokeStyle = mat === 'gold' ? hexA(GOLD, .85) : mat === 'light' ? 'rgba(223,230,255,.6)' : mat === 'paper' ? 'rgba(29,26,22,.45)' : onDark ? 'rgba(235,245,255,.7)' : 'rgba(30,34,44,.35)'; ctx.stroke();
    const bodyTop = y + h * .2, r = w * .24; ctx.beginPath(); ctx.moveTo(x + w * .14, bodyTop + r * .9); ctx.lineTo(x + w * .14, y + h - r * 1.1);
    ctx.strokeStyle = mat === 'gold' ? 'rgba(232,210,160,.25)' : onDark ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1.2, w / 34); ctx.lineCap = 'round'; ctx.stroke();
    if (lid) { const neck = w * .44, nx = x + (w - neck) / 2, lh = h * .06; ctx.fillStyle = mat === 'gold' ? GOLD : mat === 'paper' ? '#1d1a16' : mat === 'light' ? 'rgba(223,230,255,.8)' : onDark ? 'rgba(235,245,255,.82)' : 'rgba(30,34,44,.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(nx - w * .04, y, neck + w * .08, lh, lh / 2.4); else ctx.rect(nx - w * .04, y, neck + w * .08, lh); ctx.fill(); }
  }

  window.SuiSuiSkins = { mount, unmount, head, arrive, lockStrip, phrase, phraseChars: Object.values(PHRASES).flat().join('').replace(/\|/g, ''), target, arriving: id => arriving.has(id), jar, mock, art: (id, D) => artSvg(id, D || DEMO).html, data };
})();
