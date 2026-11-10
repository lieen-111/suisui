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
  const SONG = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SERIF = '"Didot","Bodoni 72","Playfair Display","Noto Serif","Times New Roman",serif';
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
    const items = [...todo.map(t => ({ id: t.id, title: t.title, done: false })), ...done.map(t => ({ id: t.id, title: t.title, done: true, at: t.completedAt || 0 }))];
    return { left: todo.length, done: done.length, total: todo.length + done.length, d, lunar, cds, items };
  }
  const DEMO = (() => {
    const titles = ['把想法做出来', '整理拍摄素材', '给家里打电话', '读二十页书', '跑步三公里', '回复客户'];
    return { left: 4, done: 2, total: 6, d: new Date(2026, 10, 10, 9), lunar: '九月廿一', cds: [], items: titles.map((t, i) => ({ id: `demo${i}`, title: t, done: i < 2, at: i })) };
  })();
  const first = s => esc(Array.from(String(s).trim())[0] || '·');
  const f1 = v => Math.round(v * 10) / 10;

  /* 晨 · 玻璃 — a measuring glass: it fills with light as the day's things get done */
  function dawnArt(D, H = 150) {
    const W = 340, pct = D.total ? D.done / D.total : 0, level = H - Math.max(10, pct * (H - 26)), n = Math.min(D.total, 14);
    const wave = (y, amp, ph) => { let p = `M0 ${y}`; for (let x = 0; x <= W * 2; x += 20) p += ` L${x} ${f1(y + Math.sin(x / 340 * Math.PI * 2 * 2 + ph) * amp)}`; return `${p} L${W * 2} ${H} L0 ${H} Z`; };
    let ticks = '';
    for (let i = 1; i <= n; i++) { const y = f1(H - 13 - i / n * (H - 26)); ticks += `<line x1="14" x2="${i <= D.done ? 26 : 21}" y1="${y}" y2="${y}" stroke="#1b1d24" stroke-opacity="${i <= D.done ? .55 : .2}" stroke-width="1"/>`; }
    return { H, svg: `<defs><linearGradient id="pd-liq" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#ada4ff"/><stop offset=".55" stop-color="#8fe0cb"/><stop offset="1" stop-color="#ffbfa3"/></linearGradient><clipPath id="pd-clip"><rect width="${W}" height="${H}" rx="28"/></clipPath></defs>
      <g clip-path="url(#pd-clip)"><g class="ph-wave ph-wave-b"><path d="${wave(level - 3, 4, 1.4)}" fill="url(#pd-liq)" opacity=".45"/></g><g class="ph-wave"><path d="${wave(level, 5, 0)}" fill="url(#pd-liq)" opacity=".85"/></g>
      <rect x="0" y="${f1(level)}" width="${W}" height="1.2" fill="#fff" opacity=".7"/></g>${ticks}
      <text x="40" y="66" font-family="Geist,-apple-system,sans-serif" fill="#1b1d24"><tspan font-size="54" font-weight="200" letter-spacing="-2">${D.done}</tspan><tspan font-size="22" fill-opacity=".4" dx="4">/${D.total}</tspan></text>
      <text x="42" y="90" font-family="Geist,-apple-system,'PingFang SC',sans-serif" font-size="12.5" fill="#6b7080" letter-spacing=".4">${D.d.getMonth() + 1}月${D.d.getDate()}日 · 星期${WEEK[D.d.getDay()]}${D.lunar ? ` · ${esc(D.lunar)}` : ''}</text>
      <text x="42" y="${H - 18}" font-family="Geist,-apple-system,'PingFang SC',sans-serif" font-size="12.5" fill="#1b1d24" fill-opacity=".72">${D.total ? (D.left ? `杯子满了 ${Math.round(pct * 100)}%，还差 ${D.left} 件` : '满了。今天的都做完了') : '今天还是一只空杯子'}</text>` };
  }

  /* 昼 · 纸 — manuscript paper: each task is one character in a grid, a red circle when it is done */
  function dayArt(D) {
    const per = 7, cell = 31, items = D.items.slice(0, 14), n = Math.max(items.length, 4), rows = Math.ceil(n / per), gridH = rows * cell, H = Math.max(gridH + 46, 128);
    let g = '';
    for (let i = 0; i < n; i++) {
      const x = (i % per) * cell + 1, y = Math.floor(i / per) * cell + 6, cx = x + cell / 2, cy = y + cell / 2, it = items[i];
      g += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="${CINNABAR}" stroke-opacity=".45" stroke-width=".7"/>
        <path d="M${x} ${cy}H${x + cell}M${cx} ${y}V${y + cell}" stroke="${CINNABAR}" stroke-opacity=".16" stroke-width=".6" stroke-dasharray="2 2"/>`;
      if (it) {
        g += `<text x="${cx}" y="${cy + 6.5}" text-anchor="middle" font-family='${SONG}' font-size="18" fill="#1d1a16" fill-opacity="${it.done ? .9 : .78}">${first(it.title)}</text>`;
        if (it.done) { const r = rng(hash(it.id)), rot = f1((r() - .5) * 40); g += `<path class="ph-circle" transform="rotate(${rot} ${cx} ${cy})" d="M${cx - 12} ${cy - 1}C${cx - 12} ${cy - 11} ${cx + 11} ${cy - 13} ${cx + 12.5} ${cy - 1}C${cx + 13.5} ${cy + 10} ${cx - 5} ${cy + 14} ${cx - 11} ${cy + 5}C${cx - 13} ${cy + 1} ${cx - 10} ${cy - 6} ${cx - 5} ${cy - 10}" fill="none" stroke="${CINNABAR}" stroke-width="1.5" stroke-linecap="round" pathLength="1"/>`; }
      }
    }
    const date = `${cn(D.d.getMonth() + 1)}月${cn(D.d.getDate())}日`;
    let v = ''; Array.from(date).forEach((ch, i) => { v += `<text x="322" y="${24 + i * 21}" text-anchor="middle" font-family='${SONG}' font-size="18" fill="#1d1a16">${ch}</text>`; });
    Array.from(`星期${WEEK[D.d.getDay()]}`).forEach((ch, i) => { v += `<text x="298" y="${22 + i * 16}" text-anchor="middle" font-family='${SONG}' font-size="12" fill="#8a8279">${ch}</text>`; });
    if (D.lunar) Array.from(D.lunar).slice(0, 5).forEach((ch, i) => { v += `<text x="280" y="${22 + i * 16}" text-anchor="middle" font-family='${SONG}' font-size="12" fill="#8a8279" fill-opacity=".7">${esc(ch)}</text>`; });
    const foot = D.total ? `<tspan fill="#8a8279">圈了 </tspan><tspan fill="${CINNABAR}">${cn(D.done)}</tspan><tspan fill="#8a8279"> / ${cn(D.total)}</tspan>${D.left ? '' : '<tspan fill="#8a8279">　今日毕</tspan>'}` : '<tspan fill="#8a8279">今天的稿纸还空着</tspan>';
    return { H, svg: `${g}${v}<text x="2" y="${gridH + 32}" font-family='${SONG}' font-size="13.5" letter-spacing="1.5">${foot}</text>` };
  }

  /* 暮 · 金 — sunset: the sun crosses the sky as tasks get done and sets when the day's list is clear */
  function duskArt(D) {
    const W = 340, H = 176, hz = 146, cx = 170, R = 112, n = Math.min(D.total, 24), pct = D.total ? D.done / D.total : 0;
    const sa = Math.PI - pct * Math.PI, sx = f1(cx + Math.cos(sa) * R), sy = f1(hz - Math.sin(sa) * R);
    let ticks = '';
    for (let i = 0; i < n; i++) { const a = Math.PI - (i + .5) / n * Math.PI, on = i < D.done, r0 = R + 6, r1 = r0 + (on ? 13 : 5); ticks += `<line x1="${f1(cx + Math.cos(a) * r0)}" y1="${f1(hz - Math.sin(a) * r0)}" x2="${f1(cx + Math.cos(a) * r1)}" y2="${f1(hz - Math.sin(a) * r1)}" stroke="${GOLD}" stroke-opacity="${on ? 1 : .35}" stroke-width="${on ? 1.3 : .8}"/>`; }
    return { H, svg: `<defs><radialGradient id="pk-sun"><stop offset="0" stop-color="#f4e8cc"/><stop offset=".6" stop-color="#c8a66a"/><stop offset="1" stop-color="#9c7f47"/></radialGradient><radialGradient id="pk-glow"><stop offset="0" stop-color="#c8a66a" stop-opacity=".35"/><stop offset="1" stop-color="#c8a66a" stop-opacity="0"/></radialGradient><clipPath id="pk-sky"><rect width="${W}" height="${hz}"/></clipPath></defs>
      <path d="M${cx - R} ${hz}A${R} ${R} 0 0 1 ${cx + R} ${hz}" fill="none" stroke="${GOLD}" stroke-opacity=".25" stroke-width=".7" stroke-dasharray="1 4"/>${pct ? `<path d="M${cx - R} ${hz}A${R} ${R} 0 0 1 ${sx} ${sy}" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round"/>` : ''}${ticks}
      <g clip-path="url(#pk-sky)"><circle cx="${sx}" cy="${sy}" r="34" fill="url(#pk-glow)"/><circle cx="${sx}" cy="${sy}" r="9" fill="url(#pk-sun)"/></g>
      <line x1="0" x2="${W}" y1="${hz}" y2="${hz}" stroke="${GOLD}" stroke-opacity=".6" stroke-width=".7"/>
      <text x="${cx}" y="${hz - 30}" text-anchor="middle" font-family='${SERIF}' fill="${GOLD}"><tspan font-size="50" letter-spacing="-1">${two(D.done)}</tspan></text>
      <text x="${cx}" y="${hz - 10}" text-anchor="middle" font-family='${SERIF}' font-size="12" fill="#8c8170" letter-spacing="3">${D.total ? (D.left ? `OF ${two(D.total)}` : '日落 · 收工') : '— —'}</text>
      <text x="${cx}" y="${hz + 22}" text-anchor="middle" font-family='${SONG}' font-size="11.5" fill="#b3a68e" letter-spacing="2.5">${D.d.getMonth() + 1}月${D.d.getDate()}日　星期${WEEK[D.d.getDay()]}${D.lunar ? `　${esc(D.lunar)}` : ''}</text>` };
  }

  /* 夜 · 光 — a constellation: every task is a star; done ones light up and join into today's shape */
  const SPARK = (x, y, s) => `M${x} ${y - s}C${f1(x + s * .12)} ${f1(y - s * .12)} ${f1(x + s * .12)} ${f1(y - s * .12)} ${x + s} ${y}C${f1(x + s * .12)} ${f1(y + s * .12)} ${f1(x + s * .12)} ${f1(y + s * .12)} ${x} ${y + s}C${f1(x - s * .12)} ${f1(y + s * .12)} ${f1(x - s * .12)} ${f1(y + s * .12)} ${x - s} ${y}C${f1(x - s * .12)} ${f1(y - s * .12)} ${f1(x - s * .12)} ${f1(y - s * .12)} ${x} ${y - s}Z`;
  function nightArt(D) {
    const W = 340, H = 152, items = D.items.slice(0, 16), placed = [];
    for (const it of items) {
      const r = rng(hash(it.id)); let best = null, bd = -1;
      for (let k = 0; k < 14; k++) { const x = 136 + r() * 180, y = 16 + r() * 120; if (x > 280 && y < 56) continue; const d = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 999); if (d > bd) { bd = d; best = { x, y }; } if (d > 30) break; }
      placed.push({ ...(best || { x: 200, y: 80 }), it });
    }
    const lit = placed.filter(p => p.it.done).sort((a, b) => a.it.at - b.it.at);
    const bg = (() => { const r = rng(5); let s = ''; for (let i = 0; i < 46; i++) s += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(.3 + r() * .6)}" fill="#dfe6ff" fill-opacity="${f1(.1 + r() * .3)}"/>`; return s; })();
    const lines = lit.length > 1 ? `<polyline points="${lit.map(p => `${f1(p.x)},${f1(p.y)}`).join(' ')}" fill="none" stroke="#dfe6ff" stroke-opacity=".38" stroke-width=".8"/>` : '';
    const stars = placed.map((p, i) => p.it.done
      ? `<g class="ph-star" style="animation-delay:${(i * .37 % 3).toFixed(2)}s"><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="9" fill="url(#pn-glow)"/><path d="${SPARK(f1(p.x), f1(p.y), 6.5)}" fill="#f4f6ff"/></g>`
      : `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="1.6" fill="#dfe6ff" fill-opacity=".5"/><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="4.5" fill="none" stroke="#dfe6ff" stroke-opacity=".16" stroke-width=".7"/>`).join('');
    return { H, svg: `<defs><radialGradient id="pn-glow"><stop offset="0" stop-color="#9fb4ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></radialGradient></defs>${bg}${lines}${stars}
      <text x="4" y="26" font-family="Geist,-apple-system,'PingFang SC',sans-serif" font-size="12" fill="#7d8496" letter-spacing=".4">${D.d.getMonth() + 1}月${D.d.getDate()}日 · 星期${WEEK[D.d.getDay()]}</text>
      <text x="2" y="96" font-family="Geist,-apple-system,sans-serif" fill="#e8ecf7"><tspan font-size="52" font-weight="200" letter-spacing="-2">${D.done}</tspan><tspan font-size="20" fill-opacity=".4" dx="3">/${D.total}</tspan></text>
      <text x="4" y="122" font-family="Geist,-apple-system,'PingFang SC',sans-serif" font-size="12.5" fill="#aab2c6">${D.total ? (D.left ? `今天亮了 ${D.done} 颗星` : '今天的星座连好了') : '今晚还没有星星'}</text>` };
  }
  const ART = { dawn: dawnArt, day: dayArt, dusk: duskArt, night: nightArt };
  let uid = 0;
  const unique = (svg, u) => svg.replace(/(id="|url\(#)(p[dkn]-[a-z]+)/g, (m, p, id) => `${p}${id}-${u}`);
  const artSvg = (id, D, cls = 'ph-art') => { const a = ART[id](D); return `<svg class="${cls}" viewBox="0 0 340 ${a.H}" width="340" height="${a.H}" aria-hidden="true">${unique(a.svg, ++uid)}</svg>`; };

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
    const a = ART[id](DEMO), u = ++uid, y0 = a.H + 34;
    const rows = ['读二十页书', '跑步三公里'].map((t, i) => { const y = y0 + i * 40; return `${CHECK[id](40, y, false)}<text x="62" y="${y + 5}" font-family='${id === 'day' ? SONG : id === 'dusk' ? SONG : "Geist,-apple-system,'PingFang SC',sans-serif"}' font-size="14" fill="${INK[id]}">${t}</text><rect x="62" y="${y + 19}" width="290" height=".7" fill="${ROWLINE[id]}"/>`; }).join('');
    const glass = id === 'dawn' ? `<rect x="20" y="16" width="340" height="${a.H}" rx="28" fill="#ffffff" fill-opacity=".45" stroke="#fff" stroke-opacity=".9"/>` : '';
    return `<svg class="pro-thumb pro-mock-svg" viewBox="0 0 380 270" preserveAspectRatio="xMinYMin slice" aria-hidden="true">${unique(MOCK_BG[id], u)}${glass}<g transform="translate(20 16)">${unique(a.svg, u)}</g>${unique(rows, u)}</svg>`;
  }

  /* ---------- Header: each theme draws today its own way; the countdowns sit under it ---------- */
  function head() {
    if (!current) return;
    const top = $('tasks-panel')?.querySelector('.today-top'); if (!top) return;
    let el = $('pro-head'); if (!el) { el = document.createElement('div'); el.id = 'pro-head'; top.before(el); }
    const keepJar = $('pro-jar-button'); if (keepJar && el.contains(keepJar)) $('today-side')?.prepend(keepJar);
    const D = data(), label = `${D.d.getMonth() + 1}月${D.d.getDate()}日，完成 ${D.done} / ${D.total}`;
    el.className = `pro-head pro-head-${current}`;
    el.innerHTML = `<div class="ph-stage" role="img" aria-label="${label}">${artSvg(current, D)}<span class="pro-head-jar"></span></div>
      ${D.cds.length ? `<div class="ph-cds">${D.cds.slice(0, 3).map(c => `<span><b>${current === 'day' ? (c.n ? cn(c.n) : '今') : c.n || '今天'}</b><small>${c.n ? (current === 'day' ? '日' : '天') : ''}</small>${esc(c.title)}</span>`).join('')}</div>` : ''}`;
    const jar = $('pro-jar-button'), slot = el.querySelector('.pro-head-jar'); if (jar && slot) slot.append(jar);
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

  window.SuiSuiSkins = { mount, unmount, head, jar, mock, art: (id, D) => artSvg(id, D || DEMO), data };
})();
