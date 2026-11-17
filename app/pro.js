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
  // 39.9 to keep, 28 for the first month after launch
  const PRICE = '¥28', LIST_PRICE = '¥39.9', PRICE_NOTE = '首发价', TRIAL_DAYS = 3;

  /* ---------- Themes: each one is a whole world (colours, type, shard material, completion effect, sound) ---------- */
  const SANS = 'Geist,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', SONG = '"Noto Serif SC","Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
  const SERIF = '"Bodoni Moda","Didot","Bodoni 72","Playfair Display","Noto Serif","Times New Roman",serif';
  /* Six Pro themes. Each draws today in its own way — 晨 a measuring glass, 昼 a copybook line, 夜 a constellation,
     晕 colour drops blooming in water, 乐 a music-box strip, 印 a risograph print — with its own check, screens and weekly
     picture. Shared: things break into pieces when done, in the theme's material, and the pieces go into the jar.
     (暮 · 金 was removed in v8; a saved 'dusk' shows 夜.) */
  const THEMES = {
    dawn: { name: '晨', full: '琉璃', en: 'Prism', line: '一只玻璃杯，做完一件，倒进一层颜色', base: 'glass', material: 'glass', effect: 'shards', sound: 'glass', accent: '#1b1d24', soft: '#1b1d240f', on: '#ffffff',
      shards: ['#9d97ff', '#7fdcc6', '#ffb79c', '#93b8ff'], bg: '#eef0f4', ink: '#1b1d24', muted: '#5c6170', mode: 'multiply', font: SANS, display: SANS },
    day: { name: '昼', full: '素笺', en: 'Washi', line: '稿纸一格写一字，做完盖一枚红印', base: 'paper', material: 'paper', effect: 'shards', sound: 'paper', accent: '#1d1a16', soft: '#1d1a160f', on: '#f5f2ec',
      shards: ['#fbf8f1', '#e9e2d4', '#d9d0bf', '#1d1a16', '#b43a2c'], bg: '#f5f2ec', ink: '#1d1a16', muted: '#6b645b', mode: 'source-over', font: SONG, display: SONG },
    night: { name: '夜', full: '星河', en: 'Nocturne', line: '每件事是一颗星，做完连成今天的星座', base: 'night', material: 'light', effect: 'shards', sound: 'night', accent: '#dfe6ff', soft: '#dfe6ff1a', on: '#07080d',
      shards: ['#dfe6ff', '#9fb4ff', '#ffffff', '#ffd9a0'], bg: '#07080d', ink: '#e8ecf7', muted: '#959cb0', mode: 'screen', font: SANS, display: SANS },
    bloom: { name: '晕', full: '洇色', en: 'Aquarelle', line: '每做完一件，滴一滴颜色，开成一朵花', base: 'paper', material: 'bloom', effect: 'shards', sound: 'drip', chip: '#fbfbfa', accent: '#2b2b2e', soft: '#2b2b2e12', on: '#f4f5f4',
      shards: ['#3b5a87', '#b8475a', '#d9a43a', '#3f8aa6', '#2b2b2e'], bg: '#f2f3f2', ink: '#2b2b2e', muted: '#636569', mode: 'multiply', font: SANS, display: SONG },
    room: { name: '屋', full: '小筑', en: 'Haven', line: '每做完一件，小屋里添一件家具', base: 'paper', material: 'room', effect: 'shards', sound: 'wood', chip: '#efe7c9', accent: '#2c3a20', soft: '#2c3a2012', on: '#efe7c9',
      shards: ['#f1d55a', '#79a84f', '#c99a52', '#d9673a', '#efe7c9'], bg: '#e6eed2', ink: '#2c3a20', muted: '#57653f', mode: 'source-over', font: SANS, display: SANS },
    fluff: { name: '毛', full: '绒绒', en: 'Velvet', line: '每做完一件多长一层绒毛，全做完它睁眼', base: 'paper', material: 'fluff', effect: 'shards', sound: 'soft', chip: '#f8f7f4', accent: '#141416', soft: '#14141610', on: '#f8f7f4',
      shards: ['#141416', '#3a3a3e', '#6b6b70', '#f8f7f4'], bg: '#f8f7f4', ink: '#141416', muted: '#626266', mode: 'source-over', font: SANS, display: SONG },
    tape: { name: '乐', full: '乐 · 纸带', line: '每做完一件打一个音孔，做完弹给你听', base: 'night', material: 'tape', effect: 'shards', sound: 'punch', chip: '#f3ecdc', accent: '#f3ecdc', soft: '#f3ecdc1a', on: '#12302a',
      shards: ['#f3ecdc', '#e6dcc4', '#cdbf9f', '#ffffff'], bg: '#12302a', ink: '#f3ecdc', muted: '#9fb5ad', mode: 'source-over', font: SANS, display: SANS },
    riso: { name: '印', full: '套色', en: 'Overprint', line: '每做完一件，印上一幅双色小画', base: 'paper', material: 'riso', effect: 'shards', sound: 'press', chip: '#fbfaf6', accent: '#2f5fb3', soft: '#2f5fb314', on: '#f6f4ef',
      shards: ['#ff4fa3', '#2f5fb3', '#8a4fb0', '#f6f4ef'], bg: '#f6f4ef', ink: '#1f2a44', muted: '#5d6377', mode: 'multiply', font: SANS, display: SANS }
  };
  const ORDER = ['dawn', 'day', 'night', 'bloom', 'riso', 'room', 'fluff'];
  /** 跟随时间: 5–10 晨, 10–18 昼, 18–5 夜. */
  const byTime = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 10 ? 'dawn' : h >= 10 && h < 18 ? 'day' : 'night'; };
  const BRAND = { shards: ['#d9d6ff', '#c9f0e6', '#ffe0d2', '#f5f5f7'] };
  const PLAIN = { material: 'plain', shards: ['#9fd8ff', '#ffffff', '#a7b4ff', '#7ee0c8'], bg: '#0c0e14', ink: '#f1f3f7', muted: '#8b93a3', accent: '#9fd8ff', mode: 'screen', font: SANS, display: SANS };
  const EFFECTS = { auto: '跟随主题', shards: '碎裂', stardust: '流光', ink: '墨染', plane: '纸飞机', dots: '点阵', gold: '金箔' };
  const EFFECT_LINE = { shards: '按主题的材质碎开', stardust: '化成一缕光', ink: '墨晕开，落一点红', plane: '折成纸飞机飞走', dots: '散成一粒粒点', gold: '金箔慢慢飘落' };

  /* ---------- Entitlement (simulated purchase in this build) ---------- */
  const info = () => { const p = S().pro; return p && typeof p === 'object' ? p : (S().pro = { owned: false, trialEnds: 0, trialUsed: false }); };
  /** Test builds (app/pro-config.js): all of Pro is free; payment pages stay visible and only simulate. */
  // Showcase frames (the Pro page shows the real app in a theme): ?showcase=<theme>&view=home|lock|fx
  const SHOW = (() => { try { return new URLSearchParams(location.search).get('showcase') || ''; } catch { return ''; } })();
  const SHOW_VIEW = (() => { try { return new URLSearchParams(location.search).get('view') || 'home'; } catch { return 'home'; } })();
  const FREE = !!(window.SUISUI_PRO_CONFIG || {}).freeForTesters || !!SHOW;
  /* A release build talks to the 碎碎清单 Pro server (server/, set in app/pro-config.js); test builds simulate payment. */
  const CFG = window.SUISUI_PRO_CONFIG || {};
  const LIVE = !FREE && !!CFG.server && !!CFG.publicKey;
  const SERVER = String(CFG.server || '').replace(/\/$/, '');
  // with a server, owning Pro means holding a licence it signed (checked again on every start)
  const isPro = () => FREE || (!!info().owned && (!LIVE || !!info().licence)) || (info().trialEnds || 0) > Date.now();
  const trialLeft = () => Math.max(0, Math.ceil(((info().trialEnds || 0) - Date.now()) / 864e5));
  const status = () => info().owned ? '已开通' : FREE ? '' : isPro() ? `试用中 · 剩 ${trialLeft()} 天` : '';
  let tryOn = '';
  const savedTheme = () => ['dusk', 'tape'].includes(S().proTheme) ? 'night' : S().proTheme;
  const activeTheme = () => tryOn || (!isPro() ? '' : savedTheme() === 'auto' ? byTime() : THEMES[savedTheme()] ? savedTheme() : '');
  const look = () => THEMES[activeTheme()] || PLAIN;
  /** What finishing a task does in each theme, and how it sounds (Pro page theme cards). */
  const FX_LINE = { dawn: '碎成玻璃，落进量杯', day: '碎成纸屑，写下一个字', night: '化成光点，连成星座', bloom: '化成一滴颜色', riso: '印成一张小画', room: '变成一件家具', fluff: '多长一层毛' };
  /** The Pro theme in use, for summaries elsewhere ('' when none). */
  const themeLabel = () => { const id = activeTheme(); if (!id) return ''; return !tryOn && savedTheme() === 'auto' ? `随光 · ${THEMES[id].full}` : THEMES[id].full; };
  function persist() { API.save(); }
  function buy() { info().owned = true; if (!info().via) info().via = payPlatform() === 'ios' ? 'appstore' : 'code'; persist(); endTry(false); applyTheme(); refreshAll(); }
  function startTrial() { const p = info(); if (p.trialUsed) return; p.trialUsed = true; p.trialEnds = Date.now() + TRIAL_DAYS * 864e5; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast(`已开始 ${TRIAL_DAYS} 天免费试用，Pro 全部可用`); }
  function restore() { API.showToast(info().owned ? '已恢复购买' : '没有找到购买记录'); }
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
  /* ---------- Live purchase (Android and web, release builds) ----------
     The server signs a licence (ECDSA P-256) for this device; the app checks the signature with the public key in
     pro-config.js, so Pro keeps working offline. Three ways in, as set in the admin page:
       扫码付款 — the app opens an order; the buyer pays your QR code with the order number in the note; you confirm
                  it in the admin page; the app (polling while the sheet is open, and on every start) gets the licence.
       爱发电   — the buyer pays on afdian and pastes the order number; the server checks it with afdian.
       兑换码   — any code you made; one code works on up to N devices (set in the admin page). */
  const deviceId = () => { try { let d = localStorage.getItem('suisui-device'); if (!d) { d = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, ''); localStorage.setItem('suisui-device', d); } return d; } catch { return 'nostore'; } };
  /* Test builds have no server: the same checkout runs against this stand-in, so it can be tried without paying. */
  let simMode = 'qr', simPaidAt = 0, simOrder = '';
  const randAbc = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => CODE_ABC[x & 31]).join('');
  const simCode = () => `SUISUI-${randAbc(4)}-${randAbc(4)}-${randAbc(4)}`;
  function simCall(path, body = {}) {
    const wait = ms => new Promise(r => setTimeout(r, ms)), no = (code, message) => Promise.reject(Object.assign(new Error(message), { code }));
    if (path === '/api/config') return wait(250).then(() => ({ price: 2800, listPrice: 3990, priceNote: '首发价', maxDevices: 3, contact: '', pay: { mode: simMode, qrLabel: '支付宝扫码付款', instructions: '我们核对到账后为你开通，通常需要几分钟。', hasQr: true, afdianUrl: 'https://afdian.com/' } }));
    if (path === '/api/orders') return wait(400).then(() => ({ id: simOrder ||= 'S' + randAbc(6), amount: 2800, status: 'pending' }));
    if (/^\/api\/orders\/.+\/status$/.test(path)) return wait(300).then(() => (simPaidAt && Date.now() - simPaidAt > 4000 ? { status: 'paid', licence: 'preview', code: simCode() } : { status: 'pending' }));
    if (path === '/api/redeem') return wait(700).then(() => (codeOk(body.code) ? { licence: 'preview', code: `SUISUI-${normCode(body.code).match(/.{4}/g).join('-')}` } : no('bad', '兑换码不存在。请检查是否输入有误。')));
    if (path === '/api/afdian/claim') return wait(900).then(() => (String(body.tradeNo).length >= 18 ? { licence: 'preview', code: simCode() } : no('not-found', '没有找到这个订单号。请确认已付款，并复制完整的订单号。')));
    if (path === '/api/check') return Promise.resolve({ ok: true });
    return no('http', '服务器暂时不可用，请稍后再试。');
  }
  async function shopCall(path, body) {
    if (!LIVE) return simCall(path, body);
    let r;
    try { r = await fetch(SERVER + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: deviceId(), platform: API.platform, version: document.querySelector('meta[name=app-version]')?.content || '', ...body }) } : {}); }
    catch { throw Object.assign(new Error('连不上服务器。检查网络后再试一次。'), { code: 'offline' }); }
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.message || '服务器暂时不可用，请稍后再试。'), { code: j.error || 'http' });
    return j;
  }
  let pubKey = null;
  const unb64 = v => Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(v.length / 4) * 4, '=')), c => c.charCodeAt(0));
  /** The licence's contents when the signature is ours and it belongs to this device; otherwise null. */
  async function readLicence(lic) {
    try {
      const [body, sig] = String(lic || '').split('.'); if (!body || !sig) return null;
      pubKey ||= await crypto.subtle.importKey('jwk', { ...CFG.publicKey, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64(sig), new TextEncoder().encode(body)))) return null;
      const p = JSON.parse(new TextDecoder().decode(unb64(body)));
      return p.dev === deviceId() ? p : null;
    } catch { return null; }
  }
  async function takeLicence(res, via) {
    if (!LIVE) { const i = info(); Object.assign(i, { owned: true, via, code: res.code || '' }); delete i.order; buy(); return; }
    const p = await readLicence(res.licence);
    if (!p) throw Object.assign(new Error('开通凭证没有通过校验。请联系我们处理。'), { code: 'licence' });
    const i = info(); Object.assign(i, { owned: true, via, licence: res.licence, lid: p.lid, code: res.code || i.code || '', checkedAt: Date.now() }); delete i.order;
    buy();
  }
  let shop = null, shopAt = 0;
  async function loadShop() { if (!shop || Date.now() - shopAt > 3e5) { shop = await shopCall('/api/config'); shopAt = Date.now(); } return shop; }
  const yuan = fen => `¥${(fen / 100).toFixed(fen % 100 ? 2 : 0)}`;
  const priceText = () => (LIVE && shop ? yuan(shop.price) : PRICE);
  const listText = () => (LIVE && shop ? (shop.listPrice > shop.price ? yuan(shop.listPrice) : '') : LIST_PRICE);
  /** Ask whether the open QR order was confirmed; returns its status. */
  async function pollOrder() {
    const o = info().order; if (!o) return '';
    try {
      const r = await shopCall(`/api/orders/${o.id}/status`, {});
      if (r.status === 'paid' && r.licence) { await takeLicence(r, 'order'); return 'paid'; }
      if (r.status === 'rejected') { o.status = 'rejected'; persist(); }
      return r.status;
    } catch (e) { if (e.code === 'not-found') { delete info().order; persist(); } return 'error'; }
  }
  /** On start: check the licence; finish an order confirmed while the app was closed; now and then ask about refunds. */
  async function liveBoot() {
    if (!LIVE) return;
    const i = info();
    if (i.owned && i.licence && !(await readLicence(i.licence))) { Object.assign(i, { owned: false }); delete i.licence; persist(); endTry(false); applyTheme(); refreshAll(); }
    if (i.order && !i.owned) { const st = await pollOrder(); if (st === 'paid') API.showToast('付款已确认，Pro 已开通。谢谢支持！'); }
    if (i.owned && i.lid && Date.now() - (i.checkedAt || 0) > 3 * 864e5) {
      try { const r = await shopCall('/api/check', { lid: i.lid }); i.checkedAt = Date.now();
        if (r.ok === false) { i.owned = false; delete i.licence; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast('这台设备的 Pro 已被撤销（订单退款或设备解绑）'); } else persist();
      } catch {}
    }
  }
  /* ---------- Checkout ----------
     One sheet, by platform.
     iPhone: what you get → 「用 App Store 购买」 → Apple's own sheet (simulated here) → 已解锁 / 已取消 / 失败 / 等家长同意;
       「恢复购买」 finds an earlier purchase on the same Apple account.
     Android and the web: ① 打开付款页 ② the payment page shows a code ③ paste it here → 验证 → 已解锁, or a clear reason.
     In this preview nothing is charged; the 「模拟结果」 row picks what the store or the code server answers. */
  let payStep = 'start', payNote = '', payOutcome = 'ok';
  const OUTCOMES = { ios: [['ok', '成功'], ['cancel', '取消'], ['fail', '失败'], ['ask', '家长同意']], code: [['ok', '成功'], ['used', '已被用过'], ['offline', '没网']] };
  const INCLUDES = [['palette', '7 套主题', '每套一种看今天的方式，所有界面都换'], ['lock-keyhole', '锁屏也换', '安卓锁屏卡片跟着主题'], ['sparkles', '完成动效', '碎片飞进画面，每套各有一种'], ['archive', '碎片罐与每周画', '一周做完的事，存成一幅画'], ['calendar-clock', '倒数日', '考试、生日，写在头部']];
  function openPay(step = 'start') {
    let el = $('pro-pay');
    if (!el) { el = document.createElement('div'); el.id = 'pro-pay'; el.className = 'pro-pay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'pro-pay-title'); document.body.append(el);
      el.addEventListener('click', e => { if (e.target === el && payStep !== 'working') closePay(); });
      // drag the top of the card down to close it
      let y0 = null;
      el.addEventListener('pointerdown', e => { const card = el.querySelector('.pro-pay-card'); if (!card || payStep === 'working' || !e.target.closest('.pro-pay-grab, .pro-pay-head')) return; y0 = e.clientY; card.style.transition = 'none'; });
      el.addEventListener('pointermove', e => { if (y0 == null) return; const d = Math.max(0, e.clientY - y0); el.querySelector('.pro-pay-card').style.transform = `translateY(${d}px)`; });
      const end = e => { if (y0 == null) return; const card = el.querySelector('.pro-pay-card'), d = e.clientY - y0; y0 = null; card.style.transition = ''; card.style.transform = ''; if (d > 70) closePay(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
    payStep = LIVE && step === 'start' && info().order && !info().owned ? 'waiting' : step; payNote = ''; el.hidden = false; renderPay(); document.body.classList.add('pro-paying');
    requestAnimationFrame(() => el.querySelector('.pro-pay-card')?.focus());
  }
  function closePay() { const el = $('pro-pay'); if (el) el.hidden = true; document.body.classList.remove('pro-paying'); clearTimeout(pollTimer); }
  let pollTimer = 0;
  const ios = () => payPlatform() === 'ios';
  function renderPay() {
    const el = $('pro-pay'); if (!el) return;
    if (!ios()) return renderLive(el); // Android and web: the real checkout (simulated in test builds); iPhone: App Store
    const kind = ios() ? 'ios' : 'code', working = payStep === 'working';
    const head = `<span class="pro-pay-grab" aria-hidden="true"></span><header class="pro-pay-head"><h2 id="pro-pay-title">${payStep === 'done' ? 'Pro 已解锁' : '碎碎清单 Pro'}</h2>${working ? '' : '<button type="button" class="pro-pay-x" id="pro-pay-close" aria-label="关闭">' + icon('x') + '</button>'}</header>`;
    let body = '';
    if (payStep === 'done') {
      body = `<div class="pro-pay-done"><p><span class="pro-pay-badge">${icon('badge-check')}</span>谢谢支持，全部功能已经可以用了。挑一个主题试试：</p>
        <div class="pro-pay-themes">${ORDER.map(id => `<button type="button" data-pay-theme="${id}" aria-label="用「${THEMES[id].full}」">${themeMock(id)}<small>${THEMES[id].full}</small></button>`).join('')}</div>
        <button type="button" class="pro-pay-link" id="pro-pay-finish">以后再说</button></div>`;
    } else if (working) {
      body = `<div class="pro-pay-working" role="status"><span class="pro-spin" aria-hidden="true"></span><p>${ios() ? (payNote === 'restore' ? '正在查找这个 Apple 账户的购买记录…' : '正在连接 App Store…') : '正在验证兑换码…'}</p></div>`;
    } else {
      const price = `<div class="pro-pay-sum"><span class="pro-pay-amt"><b>${PRICE}</b><s>${LIST_PRICE}</s></span><span class="pro-pay-what">一次买断，永久使用<small>${PRICE_NOTE}</small></span></div>`;
      const note = payNote ? `<p class="pro-pay-note${/^(fail|used|offline|bad|none)/.test(payNote) ? ' is-error' : ''}" role="alert">${{ cancel: '已取消，没有扣款。', fail: '没能完成付款：连不上 App Store。检查网络后再试一次。', ask: '已经发给家长了。家长同意后，Pro 会自动解锁。', none: '这个 Apple 账户没有买过 Pro。换手机前用的是别的 Apple 账户吗？', used: '这个兑换码已经在 3 台设备上用过了。需要帮助，就在“关于”里给我们留言。', offline: '验证兑换码要联网。连上网再试一次。', bad: '兑换码不对：应该是 SUISUI 开头，后面 12 位字母和数字。', sent: '本地预览没有真的付款页。付完款，付款页会显示一串兑换码，像这样：' }[payNote] || ''}${payNote === 'sent' ? ` <button type="button" class="pro-pay-code" id="pro-pay-fill">${demoCode}</button>` : ''}</p>` : '';
      body = ios()
        ? `${price}${note}<button type="button" class="pro-pay-main" id="pro-pay-go">用 App Store 购买 ${PRICE}</button>
           <p class="pro-pay-fine">付款由 Apple 处理 · <button type="button" class="pro-pay-link" id="pro-pay-restore">恢复购买</button></p>`
        : `${price}<ol class="pro-pay-steps"><li>付款</li><li>拿到兑换码</li><li>粘贴兑换</li></ol>
           <button type="button" class="pro-pay-main" id="pro-pay-go">打开付款页 · ${PRICE}</button>
           <form class="pro-pay-redeem" id="pro-pay-redeem"><input id="pro-pay-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="已有兑换码？SUISUI-…" aria-label="兑换码"><button type="button" class="pro-pay-paste" id="pro-pay-paste">粘贴</button><button type="submit">兑换</button></form>${note}
           <p class="pro-pay-fine">支付宝、微信都能付 · 一个码最多用在 3 台设备上</p>`;
    }
    const sim = '';
    el.innerHTML = `<div class="pro-pay-card" tabindex="-1">${head}${body}${sim}</div>`;
    API.icons(el);
    $('pro-pay-close')?.addEventListener('click', closePay);
    el.querySelectorAll('[data-pay-outcome]').forEach(b => b.addEventListener('click', () => { payOutcome = b.dataset.payOutcome; renderPay(); }));
    $('pro-pay-go')?.addEventListener('click', () => {
      if (!ios()) { payNote = 'sent'; renderPay(); $('pro-pay-code')?.focus(); return; }
      payStep = 'working'; payNote = ''; renderPay();
      setTimeout(() => { if (payOutcome === 'ok') { buy(); payStep = 'done'; } else { payStep = 'start'; payNote = payOutcome; } renderPay(); }, 1100);
    });
    $('pro-pay-restore')?.addEventListener('click', () => {
      payStep = 'working'; payNote = 'restore'; renderPay();
      setTimeout(() => { if (info().owned || payOutcome === 'ok') { info().via = 'appstore'; buy(); payStep = 'done'; } else { payStep = 'start'; payNote = 'none'; } renderPay(); }, 900);
    });
    $('pro-pay-fill')?.addEventListener('click', () => { $('pro-pay-code').value = demoCode; $('pro-pay-code').focus(); });
    $('pro-pay-paste')?.addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) $('pro-pay-code').value = t.trim(); } catch { API.showToast('没能读取剪贴板，请长按输入框粘贴'); } });
    $('pro-pay-code')?.addEventListener('input', e => { const b = normCode(e.target.value).slice(0, 12); e.target.value = b ? `SUISUI-${b.match(/.{1,4}/g).join('-')}` : ''; });
    $('pro-pay-redeem')?.addEventListener('submit', e => {
      e.preventDefault(); const v = $('pro-pay-code').value;
      if (!codeOk(v)) { payNote = 'bad'; renderPay(); if ($('pro-pay-code')) $('pro-pay-code').value = v; return; }
      payStep = 'working'; payNote = ''; renderPay();
      setTimeout(() => { if (payOutcome === 'ok') { redeem(v); payStep = 'done'; } else { payStep = 'start'; payNote = payOutcome; } renderPay(); const input = $('pro-pay-code'); if (payNote && input) input.value = v; }, 900);
    });
    el.querySelectorAll('[data-pay-theme]').forEach(b => b.addEventListener('click', () => { S().proTheme = b.dataset.payTheme; persist(); applyTheme(); refreshAll(); closePay(); closeSheet(); API.showToast(`已换上「${THEMES[b.dataset.payTheme].full}」`); }));
    $('pro-pay-finish')?.addEventListener('click', () => { closePay(); $('pro-sheet')?.querySelector('[data-pro-section=themes]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  }

  /** The real checkout (release builds, Android and web). Steps: start → qr → waiting, or start → afdian, then done. */
  function renderLive(el) {
    const st = payStep, cfg = shop, o = info().order;
    const titles = { start: '开通 Pro', qr: '扫码付款', waiting: '等待确认', afdian: '填写爱发电订单号', working: '开通 Pro', done: 'Pro 已开通' };
    const head = `<span class="pro-pay-grab" aria-hidden="true"></span><header class="pro-pay-head"><h2 id="pro-pay-title">${titles[st] || '开通 Pro'}</h2>${st === 'working' ? '' : '<button type="button" class="pro-pay-x" id="pro-pay-close" aria-label="关闭">' + icon('x') + '</button>'}</header>`;
    const note = payNote ? `<p class="pro-pay-note${payNoteBad ? ' is-error' : ''}" role="alert">${esc(payNote)}</p>` : '';
    const contact = cfg?.contact ? `<p class="pro-pay-fine">遇到问题请联系：${esc(cfg.contact)}</p>` : '';
    const redeemForm = `<div class="pro-pay-or"><span>使用兑换码</span></div>
      <form class="pro-pay-redeem" id="pro-pay-redeem"><input id="pro-pay-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SUISUI-XXXX-XXXX-XXXX" aria-label="兑换码"><button type="button" class="pro-pay-paste" id="pro-pay-paste">粘贴</button><button type="submit">兑换</button></form>`;
    let body = '';
    if (st === 'done') {
      const i = info();
      body = `<div class="pro-pay-done"><p><span class="pro-pay-badge">${icon('badge-check')}</span>感谢支持。Pro 的全部功能已在这台设备上开通。</p>
        ${i.code ? `<div class="pro-pay-code-box"><small>你的兑换码 · 可在其他设备上开通（共 ${cfg?.maxDevices || 3} 台）</small><b>${esc(i.code)}</b><button type="button" class="pro-pay-link" id="pro-pay-copy-code">复制</button></div>` : ''}
        <p class="pro-pay-fine">挑一套主题开始用：</p>
        <div class="pro-pay-themes">${ORDER.map(id => `<button type="button" data-pay-theme="${id}" aria-label="使用「${THEMES[id].full}」">${themeMock(id)}<small>${THEMES[id].full}</small></button>`).join('')}</div>
        <button type="button" class="pro-pay-link" id="pro-pay-finish">稍后再选</button></div>`;
    } else if (st === 'working') {
      body = `<div class="pro-pay-working" role="status"><span class="pro-spin" aria-hidden="true"></span><p>${esc(payWorking || '正在开通…')}</p></div>`;
    } else if (!cfg) {
      body = payNote ? `${note}<button type="button" class="pro-pay-main" id="pro-pay-retry">重新加载</button>${redeemForm}` : `<div class="pro-pay-working" role="status"><span class="pro-spin" aria-hidden="true"></span><p>正在读取价格…</p></div>`;
    } else if (st === 'qr' && o) {
      body = `<figure class="pro-qr">${cfg.pay.hasQr ? `<img id="pro-qr-img" src="${LIVE ? `${SERVER}/api/qr` : simQr()}" alt="付款二维码" crossorigin="anonymous">` : '<span>暂时不能扫码付款</span>'}<figcaption>${esc(cfg.pay.qrLabel || '微信或支付宝扫码')}</figcaption></figure>
        ${cfg.pay.hasQr ? '<button type="button" class="pro-pay-second" id="pro-qr-save">保存二维码到相册</button>' : ''}
        <ol class="pro-pay-howto">
          <li><span>${esc(/支付宝/.test(cfg.pay.qrLabel || '') && !/微信/.test(cfg.pay.qrLabel || '') ? '打开支付宝「扫一扫」，从相册选取这张二维码。' : /微信/.test(cfg.pay.qrLabel || '') && !/支付宝/.test(cfg.pay.qrLabel || '') ? '打开微信「扫一扫」，从相册选取这张二维码。' : '打开微信或支付宝「扫一扫」，从相册选取这张二维码。')}</span></li>
          <li><span>付款 <b>${yuan(o.amount || cfg.price)}</b>，并在付款备注中填写订单号：<span class="pro-order-id"><b>${esc(o.id)}</b><button type="button" id="pro-order-copy">复制</button></span></span></li>
          <li><span>付款完成后，点击下方「我已付款」。</span></li>
        </ol>${note}
        <button type="button" class="pro-pay-main" id="pro-paid">我已付款</button>
        <p class="pro-pay-fine">${esc(cfg.pay.instructions || '我们核对到账后为你开通，通常需要几分钟。')}</p>${contact}`;
    } else if (st === 'waiting' && o) {
      const rejected = o.status === 'rejected';
      body = `<div class="pro-pay-wait"><span class="${rejected ? 'pro-pay-badge is-bad' : 'pro-spin'}" aria-hidden="true">${rejected ? icon('x') : ''}</span>
        <p><b>${rejected ? '没有核对到这笔付款' : '正在等待确认'}</b>订单 ${esc(o.id)} · ${yuan(o.amount || cfg.price)}</p></div>
        <p class="pro-pay-fine">${rejected ? `如果你已经付款，请联系我们并提供订单号${cfg.contact ? `：${esc(cfg.contact)}` : '。'}` : '我们核对到账后会立即为你开通，通常需要几分钟。可以先关闭此页面，开通后自动生效。'}</p>${note}
        <div class="pro-pay-row"><button type="button" class="pro-pay-second" id="pro-refresh">刷新状态</button><button type="button" class="pro-pay-second" id="pro-show-qr">查看付款码</button></div>${contact}`;
    } else if (st === 'afdian') {
      body = `<p class="pro-pay-lead">在爱发电完成付款后，打开订单详情，复制「订单号」粘贴到这里。</p>
        <form class="pro-pay-redeem is-trade" id="pro-afdian-form"><input id="pro-afdian-no" inputmode="numeric" autocomplete="off" placeholder="爱发电订单号" aria-label="爱发电订单号"><button type="button" class="pro-pay-paste" id="pro-afdian-paste">粘贴</button><button type="submit">验证</button></form>${note}
        ${cfg.pay.afdianUrl ? `<a class="pro-pay-link" href="${esc(cfg.pay.afdianUrl)}" target="_blank" rel="noopener">还没付款？前往爱发电</a>` : ''}${contact}`;
    } else {
      const mode = cfg.pay.mode, price = `<div class="pro-pay-sum"><span class="pro-pay-amt"><b>${yuan(cfg.price)}</b>${cfg.listPrice > cfg.price ? `<s>${yuan(cfg.listPrice)}</s>` : ''}</span><span class="pro-pay-what">一次购买，永久使用<small>${esc(cfg.priceNote || '')}</small></span></div>`;
      const main = mode === 'qr' ? `<button type="button" class="pro-pay-main" id="pro-start-qr">扫码付款 · ${yuan(cfg.price)}</button>`
        : mode === 'afdian' && cfg.pay.afdianUrl ? `<a class="pro-pay-main" id="pro-go-afdian" href="${esc(cfg.pay.afdianUrl)}" target="_blank" rel="noopener">前往爱发电付款 · ${yuan(cfg.price)}</a><button type="button" class="pro-pay-link" id="pro-afdian-have">已在爱发电付款？填写订单号</button>` : '';
      body = `${price}${main}${redeemForm}${note}
        <p class="pro-pay-fine">${mode === 'qr' ? '扫码付款经人工核对后开通，通常需要几分钟' : mode === 'afdian' ? '爱发电付款后填写订单号，立即开通' : '兑换码由官方渠道发放'} · 每个兑换码可用于 ${cfg.maxDevices} 台设备</p>${contact}`;
    }
    const sim = ''; // the checkout looks the same in every build: no preview controls
    el.innerHTML = `<div class="pro-pay-card" tabindex="-1">${head}${body}${sim}</div>`;
    API.icons(el);
    el.querySelectorAll('[data-sim-mode]').forEach(b => b.addEventListener('click', () => { simMode = b.dataset.simMode; shop = null; payStep = 'start'; payNote = ''; renderLive(el); }));
    const bad = (e, keep) => { payNote = e.message; payNoteBad = true; payStep = keep; renderLive(el); };
    $('pro-pay-close')?.addEventListener('click', closePay);
    $('pro-pay-retry')?.addEventListener('click', () => { payNote = ''; shop = null; renderLive(el); loadShop().then(() => renderLive(el), e => bad(e, 'start')); });
    $('pro-start-qr')?.addEventListener('click', async () => {
      payStep = 'working'; payWorking = '正在生成订单…'; payNote = ''; renderLive(el);
      try { const r = await shopCall('/api/orders', {}); info().order = { id: r.id, amount: r.amount, at: Date.now() }; persist(); payStep = 'qr'; renderLive(el); } catch (e) { bad(e, 'start'); }
    });
    $('pro-order-copy')?.addEventListener('click', () => copyText(o.id, '订单号已复制，付款时粘贴到备注里'));
    $('pro-qr-save')?.addEventListener('click', () => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); API.saveImage(c, '碎碎清单-付款码.png'); };
      img.onerror = () => API.showToast('二维码没能保存，可以截屏后再扫');
      img.src = LIVE ? `${SERVER}/api/qr` : simQr();
    });
    const check = async manual => {
      if (manual) { payStep = 'working'; payWorking = '正在查询…'; renderLive(el); }
      const r = await pollOrder();
      if (r === 'paid') { payStep = 'done'; payNote = ''; renderLive(el); return; }
      payStep = 'waiting'; if (manual) { payNote = r === 'error' ? '暂时查询不到，稍后再试。' : r === 'pending' ? '还在等待确认，确认后会自动开通。' : ''; payNoteBad = r === 'error'; }
      if (!info().order) { payStep = 'start'; payNote = '订单已失效，请重新下单。'; payNoteBad = true; }
      renderLive(el);
    };
    $('pro-paid')?.addEventListener('click', () => { if (!LIVE) simPaidAt = Date.now(); payStep = 'waiting'; payNote = ''; renderLive(el); });
    $('pro-refresh')?.addEventListener('click', () => check(true));
    $('pro-show-qr')?.addEventListener('click', () => { payStep = 'qr'; payNote = ''; renderLive(el); });
    $('pro-afdian-have')?.addEventListener('click', () => { payStep = 'afdian'; payNote = ''; renderLive(el); });
    $('pro-go-afdian')?.addEventListener('click', () => setTimeout(() => { payStep = 'afdian'; payNote = ''; renderLive(el); }, 400));
    $('pro-afdian-paste')?.addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) $('pro-afdian-no').value = t.replace(/\D/g, ''); } catch { API.showToast('没能读取剪贴板，请长按输入框粘贴'); } });
    $('pro-afdian-form')?.addEventListener('submit', async e => {
      e.preventDefault(); const no = $('pro-afdian-no').value.replace(/\D/g, '');
      if (no.length < 12) { payNote = '订单号是一长串数字，在爱发电的订单详情里可以找到。'; payNoteBad = true; return renderLive(el); }
      payStep = 'working'; payWorking = '正在向爱发电核对订单…'; payNote = ''; renderLive(el);
      try { await takeLicence(await shopCall('/api/afdian/claim', { tradeNo: no }), 'afdian'); payStep = 'done'; renderLive(el); } catch (err) { bad(err, 'afdian'); if ($('pro-afdian-no')) $('pro-afdian-no').value = no; }
    });
    $('pro-pay-paste')?.addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) { $('pro-pay-code').value = t.trim(); $('pro-pay-code').dispatchEvent(new Event('input')); } } catch { API.showToast('没能读取剪贴板，请长按输入框粘贴'); } });
    $('pro-pay-code')?.addEventListener('input', e => { const v = normCode(e.target.value).slice(0, 12); e.target.value = v ? `SUISUI-${v.match(/.{1,4}/g).join('-')}` : ''; });
    $('pro-pay-redeem')?.addEventListener('submit', async e => {
      e.preventDefault(); const v = $('pro-pay-code').value;
      if (normCode(v).length !== 12) { payNote = '兑换码是 12 位字母和数字，形如 SUISUI-XXXX-XXXX-XXXX。'; payNoteBad = true; renderLive(el); $('pro-pay-code').value = v; return; }
      const back = payStep; payStep = 'working'; payWorking = '正在验证兑换码…'; payNote = ''; renderLive(el);
      try { await takeLicence(await shopCall('/api/redeem', { code: v }), 'code'); payStep = 'done'; renderLive(el); } catch (err) { bad(err, back === 'working' ? 'start' : back); if ($('pro-pay-code')) $('pro-pay-code').value = v; }
    });
    $('pro-pay-copy-code')?.addEventListener('click', () => copyText(info().code, '兑换码已复制，请妥善保存'));
    el.querySelectorAll('[data-pay-theme]').forEach(b => b.addEventListener('click', () => { S().proTheme = b.dataset.payTheme; persist(); applyTheme(); refreshAll(); closePay(); closeSheet(); API.showToast(`已换上「${THEMES[b.dataset.payTheme].full}」`); }));
    $('pro-pay-finish')?.addEventListener('click', () => { closePay(); $('pro-sheet')?.querySelector('[data-pro-section=themes]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    // while waiting, ask every 5 seconds; first load the shop
    clearTimeout(pollTimer);
    if (st === 'waiting' && o && o.status !== 'rejected') pollTimer = setTimeout(() => { if (!$('pro-pay').hidden && payStep === 'waiting') check(false); }, 5000);
    if (!cfg && !payNote) loadShop().then(() => renderLive(el), e => bad(e, 'start'));
  }
  let payNoteBad = false, payWorking = '';
  /** The collection QR in builds without a server: your own 支付宝 code (app/assets/pay-qr.jpg). Release builds show the
     one uploaded in the admin page instead. simQrDemo() below is the old unscannable stand-in, kept for reference. */
  function simQr() { return 'assets/pay-qr.jpg'; }
  let simQrUrl = '';
  function simQrDemo() {
    if (simQrUrl) return simQrUrl;
    const n = 29, c = document.createElement('canvas'), k = 10; c.width = c.height = (n + 4) * k; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#111';
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (r() > .52) g.fillRect((x + 2) * k, (y + 2) * k, k, k);
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) { g.fillStyle = '#fff'; g.fillRect((x + 2) * k, (y + 2) * k, 7 * k, 7 * k); g.fillStyle = '#111'; g.fillRect((x + 2) * k, (y + 2) * k, 7 * k, 7 * k); g.fillStyle = '#fff'; g.fillRect((x + 3) * k, (y + 3) * k, 5 * k, 5 * k); g.fillStyle = '#111'; g.fillRect((x + 4) * k, (y + 4) * k, 3 * k, 3 * k); }
    g.fillStyle = '#fff'; g.fillRect(c.width / 2 - 46, c.height / 2 - 22, 92, 44); g.fillStyle = '#111'; g.font = '600 26px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('示例', c.width / 2, c.height / 2 + 1);
    return (simQrUrl = c.toDataURL('image/png'));
  }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  async function copyText(t, done) { try { await navigator.clipboard.writeText(t); API.showToast(done); } catch { API.showToast('没能复制，请长按选择'); } }

  function resetLocal() { S().pro = { owned: false, trialEnds: 0, trialUsed: false }; persist(); endTry(false); applyTheme(); refreshAll(); API.showToast('已重置为未购买'); }

  /* ---------- Small helpers ---------- */
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t;
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const weekStart = (d = new Date()) => { const x = startOfDay(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
  const isoWeek = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y0) / 864e5 + 1) / 7); };
  const logBetween = (a, b) => (API.state.log || []).filter(e => e.at >= a && e.at < b);
  const todayLog = () => logBetween(startOfDay().getTime(), startOfDay().getTime() + 864e5);
  const icon = (name, cls = '') => `<i data-lucide="${name}" ${cls ? `class="${cls}"` : ''}></i>`;
  const groupColor = id => API.groupOf(id)?.color || '#9aa0a6';
  function hex(c, a) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function shardColor(e, i, L = look()) { return L === PLAIN ? groupColor(e.group) : L.shards[(hash(`${e.id}${e.at}`) + i) % L.shards.length]; }
  const SHOT = () => (S().lang === 'en' ? '-en' : ''); // theme pictures are screenshots, one set per language
  function canvasFor(el, w, h, max = 2) { const dpr = Math.min(max, devicePixelRatio || 1); el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); el.style.width = `${w}px`; el.style.height = `${h}px`; const c = el.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return c; }

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
    drip: c => { tone(c, { f: 380, f2: 1150, d: .12, g: .11 }); tone(c, { f: 900, f2: 1500, t: .07, d: .16, g: .035 }); },
    punch: c => { hiss(c, { d: .02, g: .2, hp: 1800, lp: 7000 }); tone(c, { f: 180, f2: 110, d: .06, g: .06, type: 'triangle' }); },
    press: c => { tone(c, { f: 130, f2: 70, d: .14, g: .14, type: 'triangle' }); hiss(c, { t: .01, d: .06, g: .1, hp: 600, lp: 3000 }); hiss(c, { t: .1, d: .08, g: .05, hp: 2000 }); },
    chime: c => { tone(c, { f: 660, d: 1.3, g: .075 }); tone(c, { f: 990, t: .02, d: 1.1, g: .045 }); tone(c, { f: 1485, t: .04, d: .8, g: .02 }); }
  };
  // No sound on finishing a task, in any theme (the user asked for quiet effects); the tones stay unused.
  const soundOn = () => false;
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
  function overlay(duration, draw, resolveAt = 280) {
    return new Promise(resolve => {
      const c = document.createElement('canvas'); c.className = 'pro-fx';
      const ctx = canvasFor(c, innerWidth, innerHeight, 1.5); document.body.append(c); // full-screen and redrawn every frame: 1.5x keeps the upload light on phones
      const t0 = performance.now();
      const tick = now => { const ms = now - t0; ctx.clearRect(0, 0, innerWidth, innerHeight); draw(ctx, ms); if (ms < duration) requestAnimationFrame(tick); else c.remove(); };
      requestAnimationFrame(tick); setTimeout(resolve, resolveAt);
    });
  }
  const LIGHT = ['dawn', 'day', 'bloom', 'riso', 'room', 'fluff'];
  const dark = () => !LIGHT.includes(activeTheme());
  const FX = {
    /** 碎裂, in the theme's material: glass flies apart, paper scraps flutter down, gold leaf falls, light drifts up. */
    shards(src, s) {
      const L = look(), mat = { bloom: 'paper', tape: 'paper', riso: 'paper', room: 'paper', fluff: 'paper' }[L.material] || L.material || 'glass', cols = Math.max(4, Math.round(s.w / 24)), rows = 2, cw = s.w / cols, ch = s.h / rows, pieces = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (let t = 0; t < 2; t++) {
        const x0 = s.left + x * cw, y0 = s.top + y * ch, pts = t ? [[x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]] : [[x0, y0], [x0 + cw, y0], [x0, y0 + ch]];
        const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3, r = rng(x * 31 + y * 7 + t * 3 + 1), spread = x / Math.max(1, cols - 1) - .5;
        const v = mat === 'paper' ? { vx: spread * 70 + (r() - .5) * 40, vy: -24 - r() * 30, g: 300, spin: (r() - .5) * 3.4, sway: 12 + r() * 16 }
          : mat === 'gold' ? { vx: spread * 44 + (r() - .5) * 30, vy: -14 - r() * 20, g: 190, spin: (r() - .5) * 2.6, sway: 9 + r() * 12 }
          : mat === 'light' ? { vx: spread * 60 + (r() - .5) * 30, vy: -40 - r() * 60, g: -8, spin: (r() - .5) * 2, sway: 0 }
          : { vx: spread * (150 + r() * 90), vy: (y - .5) * 50 - 40 - r() * 50, g: 130, spin: (r() - .5) * 5, sway: 0 };
        pieces.push({ pts, cx, cy, ...v, d: Math.abs(spread) * 60 + r() * 40, c: L.shards[(x + y + t) % L.shards.length] });
      }
      const dur = mat === 'paper' || mat === 'gold' ? 820 : 680; // 精致利落: short and quiet
      return overlay(dur, (ctx, ms) => {
        for (const p of pieces) {
          const tt = Math.max(0, (ms - p.d) / 1000), life = clamp((ms - p.d) / (dur - p.d)), a = 1 - life * life;
          if (a <= 0) continue;
          const dx = p.vx * tt + Math.sin(tt * 6 + p.cx) * p.sway * tt, dy = p.vy * tt + .5 * p.g * tt * tt;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(p.cx + dx, p.cy + dy); ctx.rotate(p.spin * tt); ctx.translate(-p.cx, -p.cy);
          ctx.beginPath(); ctx.moveTo(...p.pts[0]); ctx.lineTo(...p.pts[1]); ctx.lineTo(...p.pts[2]); ctx.closePath();
          if (mat === 'paper') { ctx.shadowColor = 'rgba(60,40,20,.2)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = L.chip || '#fbf8f1'; ctx.fill(); ctx.shadowColor = 'transparent'; }
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
      const L = look(), parts = s.pts.slice(0, 450).map((p, i) => { const r = rng(i * 977 + 13); return { ...p, vx: (r() - .35) * 46, vy: -(28 + r() * 90), size: 1 + r() * 1.8, c: L.shards[i % L.shards.length], ph: r() * 6, d: (p.x - s.left) / s.w * 260 }; });
      return overlay(820, (ctx, ms) => {
        const sweep = s.left + (ms / 200) * s.w;
        ctx.save(); ctx.beginPath(); ctx.rect(sweep, s.top, s.w + 40, s.h); ctx.clip(); ctx.drawImage(s.image, s.left, s.top); ctx.restore();
        ctx.globalCompositeOperation = dark() ? 'lighter' : 'source-over';
        for (const p of parts) {
          const t = clamp((ms - p.d) / 600); if (t <= 0) continue;
          const e = easeOut(t), a = (1 - t) * (.6 + .4 * Math.sin(p.ph + ms / 60));
          ctx.fillStyle = hex(p.c, clamp(a)); ctx.beginPath(); ctx.arc(p.x + p.vx * e, p.y + p.vy * e, p.size * (1 + .6 * (1 - t)), 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      });
    },
    dots(src, s) {
      const parts = s.pts.map((p, i) => { const r = rng(i * 31 + 7); return { ...p, d: (p.x - s.left) / s.w * 200 + r() * 80, vy: -(8 + r() * 26), vx: (r() - .5) * 16, red: false }; });
      return overlay(720, (ctx, ms) => {
        for (const p of parts) {
          const t = clamp((ms - p.d) / 400), sc = t <= 0 ? 1 : 1 - easeOut(t);
          if (sc <= .02) continue; ctx.fillStyle = p.red ? '#d71921' : s.color;
          ctx.beginPath(); ctx.arc(p.x + p.vx * easeOut(t), p.y + p.vy * easeOut(t), 1.7 * sc + (t > 0 ? .4 : 0), 0, 7); ctx.fill();
        }
      });
    },
    gold(src, s) {
      const parts = s.pts.filter((_, i) => i % 3 === 0).map((p, i) => { const r = rng(i * 13 + 5); return { ...p, d: r() * 260, sway: 8 + r() * 18, ph: r() * 6, sz: 2 + r() * 3.5, spin: (r() - .5) * 8, fall: 60 + r() * 90, c: ['#c8a66a', '#e8d3a4', '#f4e8cc', '#9c7f47'][i % 4] }; });
      return overlay(950, (ctx, ms) => {
        ctx.globalAlpha = clamp(1 - ms / 260); ctx.drawImage(s.image, s.left, s.top); ctx.globalAlpha = 1;
        for (const p of parts) {
          const t = clamp((ms - p.d) / 740); if (t <= 0 || t >= 1) continue;
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
      return overlay(880, (ctx, ms) => {
        const fade = clamp(1 - (ms - 520) / 360);
        ctx.globalAlpha = clamp(1 - (ms - 80) / 320) ; ctx.drawImage(s.image, s.left, s.top); ctx.globalAlpha = 1;
        ctx.filter = 'blur(2.5px)';
        for (const b of [...blots, ...dots]) {
          const t = clamp((ms - b.d) / 380); if (t <= 0) continue;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.R * easeOut(t) + .1);
          g.addColorStop(0, `rgba(29,26,22,${.62 * fade})`); g.addColorStop(.7, `rgba(29,26,22,${.38 * fade})`); g.addColorStop(1, 'rgba(29,26,22,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.R * easeOut(t) + .1, 0, 7); ctx.fill();
        }
        ctx.filter = 'none';
        const st = clamp((ms - 200) / 180); if (st > 0) {
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
      return overlay(950, (ctx, ms) => {
        ctx.fillStyle = s.color;
        for (const p of parts) { const t = easeIn(clamp((ms - p.d) / 220)); if (t >= 1) continue; ctx.globalAlpha = 1 - t * .6; ctx.fillRect(p.x + (P.x - p.x) * t, p.y + (P.y - p.y) * t, 1.6, 1.6); }
        ctx.globalAlpha = 1;
        const ft = clamp((ms - 220) / 700); if (ft <= 0) return;
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

  /** 外观 → 完成动效: play an effect on the sample row so the choice is seen, not guessed. */
  let previewing = false;
  async function previewEffect(pick) {
    const row = $('fx-sample'), text = $('fx-sample-text'); if (!row || !text || previewing) return;
    const id = pick === 'auto' ? (THEMES[activeTheme()]?.effect || 'shards') : pick;
    const still = reduce() || !S().motion;
    previewing = true; row.classList.remove('is-done', 'is-back'); void row.offsetWidth; row.classList.add('is-done');
    if (!still && FX[id]) {
      try { const smp = sampleText(text, id === 'dots' ? 4 : id === 'stardust' ? 2 : id === 'shards' ? 6 : 3); text.style.visibility = 'hidden'; await FX[id](row, smp); } catch { /* preview only */ }
      await new Promise(r => setTimeout(r, 420));
    } else await new Promise(r => setTimeout(r, 700));
    text.style.visibility = ''; row.classList.remove('is-done'); row.classList.add('is-back'); previewing = false;
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
      晕 colour drops by hour and day, 乐 seven music-box strips, 印 a two-colour poster, 夜 a star map with one constellation per day. */
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
        const x = W - Pd - (d + 1) * cell, list = byDay[d], words = list.length ? Array.from(window.SuiSuiSkins.phrase(Math.min(list.length, rows), `${start.getTime()}`, d).text) : [];
        if (list.length) { ctx.fillStyle = L.muted; ctx.font = `400 ${sc(22)}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText(`${CN(list.length)}件`, x + cell / 2, gy + rows * cell + sc(42)); }
        ctx.fillStyle = red; ctx.font = `400 ${sc(26)}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText(`周${'一二三四五六日'[d]}`, x + cell / 2, gy - sc(22));
        for (let r = 0; r < rows; r++) {
          const y = gy + r * cell, cx = x + cell / 2, cy = y + cell / 2;
          ctx.strokeStyle = hex(red, .45); ctx.lineWidth = sc(1.3); ctx.strokeRect(x, y, cell, cell);
          ctx.save(); ctx.setLineDash([sc(4), sc(5)]); ctx.strokeStyle = hex(red, .15); ctx.lineWidth = sc(1); ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + cell, cy); ctx.moveTo(cx, y); ctx.lineTo(cx, y + cell); ctx.stroke(); ctx.restore();
          const e = list[r]; if (!e || !words[r]) continue;
          ctx.fillStyle = '#1d1a16'; ctx.font = `400 ${sc(58)}px ${SONG}`; ctx.fillText(words[r], cx, cy + sc(20));
          if ((e.min || 0) >= 20) { const q = rng(hash(`${e.id}${e.at}`)); ctx.save(); ctx.translate(cx, cy); ctx.rotate((q() - .5) * .8); ctx.strokeStyle = red; ctx.lineWidth = sc(3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(0, 0, sc(38), sc(35), 0, .25, Math.PI * 2 - .05); ctx.stroke(); ctx.restore(); }
        }
      }
      ctx.textAlign = 'center';
      Array.from(`第${CN(isoWeek(start))}周`).forEach((ch, i) => { ctx.fillStyle = '#1d1a16'; ctx.font = `400 ${sc(64)}px ${SONG}`; ctx.fillText(ch, Pd + sc(44), gy + sc(60) + i * sc(80)); });
      Array.from(`${CN(start.getMonth() + 1)}月${CN(start.getDate())}日起`).forEach((ch, i) => { ctx.fillStyle = L.muted; ctx.font = `400 ${sc(24)}px ${SONG}`; ctx.fillText(ch, Pd + sc(130), gy + sc(40) + i * sc(34)); });
      // seal
      const sx = Pd + sc(4), sy = gy + rows * cell - sc(150), s = sc(140);
      ctx.save(); ctx.translate(sx + s / 2, sy + s / 2); ctx.rotate(-.05); ctx.fillStyle = red; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = '#f5f2ec'; ctx.font = `600 ${sc(50)}px ${SONG}`; [['碎', -1, -1], ['碎', -1, 1], ['清', 1, -1], ['单', 1, 1]].forEach(([c, cxk, cyk]) => ctx.fillText(c, -cxk * s * .23, cyk * s * .23 + sc(17)));
      { const r = rng(11); ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 180; i++) { ctx.fillStyle = `rgba(0,0,0,${.3 + r() * .5})`; ctx.fillRect((r() - .5) * s, (r() - .5) * s, sc(1 + r() * 3), sc(1 + r() * 2)); } }
      ctx.restore(); ctx.textAlign = 'left';
      ctx.fillStyle = '#1d1a16'; ctx.font = `400 ${sc(40)}px ${SONG}`; ctx.fillText(entries.length ? `${CN(entries.length)}件事${st.focusText ? `，${st.focusText}` : ''}` : '这一页还空着', Pd, H - Pd - sc(70));
      ctx.fillStyle = L.muted; ctx.font = `400 ${sc(26)}px ${SONG}`; ctx.fillText(entries.length ? `周${st.busiest}写得最多。做完几件，写几个字；朱圈是专注过的` : '完成一件事，就写下第一个字', Pd, H - Pd - sc(24));
      return canvas;
    }

    const SK = window.SuiSuiSkins;
    if (mat === 'bloom') { /* ---- 晕: the week as one wash, a band of water per day, each drop a colour ---- */
      const g0 = ctx.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#f6f7f6'); g0.addColorStop(1, '#ebedec'); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
      { const r = rng(51); for (let i = 0; i < W * H / 50; i++) { ctx.fillStyle = `rgba(40,50,60,${.04 * r()})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5); } }
      caption(`400 ${sc(80)}px ${SONG}`, `第 ${isoWeek(start)} 周`, range, '#2b2b2e', '#636569');
      const top = sc(270), band = sc(108), bx = Pd, bw = W - 2 * Pd;
      ctx.globalCompositeOperation = 'multiply';
      byDay.forEach((list, d) => list.forEach(e => {
        // across: the hour it was done; down: its day; size: how long it was focused on
        const when = new Date(e.at), hr = when.getHours() + when.getMinutes() / 60, r = rng(hash(`${e.id}w`)), c = SK.PIGMENTS[hash(`drop:${e.id}${e.at}`) % SK.PIGMENTS.length][1];
        const R = sc(58 + Math.min(e.min || 0, 90) * .7) * (.85 + r() * .3), x = bx + R * .6 + clamp((hr - 6) / 17) * (bw - sc(90) - R * 1.2), y = top + d * band + band / 2 + (r() - .5) * band * .5;
        for (let k = 0; k < 4; k++) {
          const RR = R * (.86 + r() * .22), xx = x + (r() - .5) * R * .2, yy = y + (r() - .5) * R * .2, g = ctx.createRadialGradient(xx, yy, 0, xx, yy, RR);
          g.addColorStop(0, hex(c, .06)); g.addColorStop(.72, hex(c, .07)); g.addColorStop(.94, hex(c, .1)); g.addColorStop(1, hex(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, RR, 0, 7); ctx.fill();
        }
      }));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#636569'; ctx.font = `400 ${sc(22)}px ${SONG}`; '一二三四五六日'.split('').forEach((t, d) => ctx.fillText(`周${t}`, W - Pd - sc(56), top + d * band + band / 2 + sc(8)));
      ctx.fillStyle = '#2b2b2e'; ctx.font = `400 ${sc(40)}px ${SONG}`; ctx.fillText(entries.length ? `${CN(entries.length)}滴颜色` : '一盆清水', Pd, H - Pd - sc(70));
      ctx.fillStyle = '#636569'; ctx.font = `400 ${sc(26)}px ${SONG}`; ctx.fillText(entries.length ? [st.focusText, `周${st.busiest}最浓。专注越久，晕得越大`].filter(Boolean).join('，') : '做完一件事，就滴下第一滴', Pd, H - Pd - sc(24));
      return canvas;
    }
    if (mat === 'tape') { /* ---- 乐: seven strips, one a day; each hole a note at the hour it was done ---- */
      ctx.fillStyle = '#12302a'; ctx.fillRect(0, 0, W, H);
      { const r = rng(21); for (let i = 0; i < W * H / 60; i++) { ctx.fillStyle = `rgba(200,230,215,${.06 * r()})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5); } }
      caption(`300 ${sc(76)}px ${SANS}`, `第 ${isoWeek(start)} 周`, range, '#f3ecdc', '#9fb5ad');
      const top = sc(280), sh = sc(96), gap = sc(18), lx = Pd + sc(70), rx = W - Pd;
      byDay.forEach((list, d) => {
        const y = top + d * (sh + gap);
        ctx.fillStyle = '#9fb5ad'; ctx.font = `400 ${sc(24)}px ${SANS}`; ctx.fillText(`周${'一二三四五六日'[d]}`, Pd, y + sh / 2 + sc(9));
        const pg = ctx.createLinearGradient(0, y, 0, y + sh); pg.addColorStop(0, '#f6f0e2'); pg.addColorStop(1, '#ebe2cc'); ctx.fillStyle = pg; ctx.fillRect(lx, y, rx - lx, sh);
        for (let r = 0; r < 7; r++) { ctx.fillStyle = `rgba(18,48,42,${r % 2 ? .07 : .13})`; ctx.fillRect(lx, y + sc(10) + r * sc(15), rx - lx, sc(1)); }
        for (let x = lx + sc(8); x < rx; x += sc(16)) { ctx.fillStyle = 'rgba(18,48,42,.5)'; ctx.beginPath(); ctx.arc(x, y + sc(4), sc(1.6), 0, 7); ctx.arc(x, y + sh - sc(4), sc(1.6), 0, 7); ctx.fill(); }
        list.forEach(e => { const when = new Date(e.at), hr = when.getHours() + when.getMinutes() / 60, x = lx + sc(20) + (rx - lx - sc(40)) * clamp((hr - 6) / 18, 0, 1), yy = y + sc(10) + SK.pitchOf(`${e.id}`) * sc(15);
          ctx.fillStyle = '#12302a'; ctx.beginPath(); ctx.arc(x, yy, sc(6.5), 0, 7); ctx.fill(); });
      });
      footer(`500 ${sc(44)}px ${SANS}`, '#f3ecdc', '#9fb5ad');
      return canvas;
    }
    if (mat === 'riso') { /* ---- 印: a two-colour poster, each day a column of little prints ---- */
      ctx.fillStyle = '#f6f4ef'; ctx.fillRect(0, 0, W, H);
      const dots = document.createElement('canvas'); dots.width = dots.height = Math.max(4, Math.round(sc(9))); { const d = dots.getContext('2d'); d.fillStyle = '#ff4fa3'; d.beginPath(); d.arc(dots.width / 2, dots.height / 2, dots.width * .36, 0, 7); d.fill(); }
      const pink = ctx.createPattern(dots, 'repeat');
      ctx.globalCompositeOperation = 'multiply';
      ctx.font = `800 ${sc(300)}px ${SANS}`; ctx.fillStyle = '#2f5fb3'; ctx.fillText(String(isoWeek(start)), Pd - sc(10), sc(345));
      ctx.fillStyle = pink; ctx.fillText(String(isoWeek(start)), Pd + sc(4), sc(335));
      const colW = (W - 2 * Pd) / 7, s0 = Math.min(sc(96), colW * .92);
      byDay.forEach((list, d) => list.slice(0, 6).forEach((e, i) => {
        const m = SK.MOTIFS[SK.motifOf({ id: e.id, title: e.title })], r = rng(hash(`${e.id}${e.at}`)), x = Pd + d * colW + (colW - s0) / 2 + (r() - .5) * sc(10), y = sc(400) + i * (s0 + sc(12)), k = s0 / 40, line = !m.p || /M20 4v6|M4 10l16|M8 32L26/.test(m.p);
        ctx.save(); ctx.translate(x + s0 / 2, y + s0 / 2); ctx.rotate((r() - .5) * .3); ctx.translate(-s0 / 2, -s0 / 2); ctx.scale(k, k);
        ctx.save(); ctx.translate(1.8, -1.3); if (line) { ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke(new Path2D(m.p)); } else { ctx.fillStyle = pink; ctx.fill(new Path2D(m.p)); ctx.fillStyle = 'rgba(255,79,163,.35)'; ctx.fill(new Path2D(m.p)); } ctx.restore();
        if (/M20 4v6/.test(m.b)) { ctx.strokeStyle = '#2f5fb3'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(new Path2D(m.b)); } else { ctx.fillStyle = 'rgba(47,95,179,.92)'; ctx.fill(new Path2D(m.b)); }
        ctx.restore();
      }));
      ctx.globalCompositeOperation = 'source-over';
      { const r = rng(5); for (let i = 0; i < W * H / 70; i++) { ctx.fillStyle = 'rgba(246,244,239,.9)'; ctx.fillRect(r() * W, r() * H, sc(1 + r() * 1.5), sc(1 + r())); } }
      ctx.font = `400 ${sc(22)}px ${SANS}`; ctx.fillStyle = '#5d6377'; ctx.textAlign = 'center'; '一二三四五六日'.split('').forEach((t, d) => ctx.fillText(`周${t}`, Pd + d * colW + colW / 2, sc(388))); ctx.textAlign = 'left';
      ctx.fillStyle = '#2f5fb3'; ctx.font = `600 ${sc(24)}px ${SANS}`; ctx.fillText(range, Pd, sc(70));
      footer(`800 ${sc(44)}px ${SANS}`, '#2f5fb3', '#5d6377');
      return canvas;
    }

    if (mat === 'room') { /* ---- 屋: seven little rooms, one a day, furnished by what got done ---- */
      ctx.fillStyle = '#e6eed2'; ctx.fillRect(0, 0, W, H);
      { const r = rng(9); for (let i = 0; i < W * H / 900; i++) { ctx.fillStyle = `rgba(44,58,32,${.02 + r() * .04})`; ctx.fillRect(r() * W, r() * H, sc(1.2), sc(1.2)); } }
      caption(`700 ${sc(72)}px ${SANS}`, `第 ${isoWeek(start)} 周的七间房`, range, '#2c3a20', '#5d6b4c');
      const cw = (W - 2 * Pd) / 4, rw = cw * 1.3, rh = rw * 224 / 200;
      byDay.forEach((list, d) => {
        const row = d < 4 ? 0 : 1, col = row ? d - 4 + .5 : d, x = Pd + col * cw + (cw - rw) / 2, y = sc(240) + row * (rh + sc(96));
        const n = Math.min(list.length, 14), img = SK.roomImg({ done: n, total: Math.max(n, 1), lit: n > 0 });
        if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, rw, rh);
        ctx.textAlign = 'center'; ctx.fillStyle = '#5d6b4c'; ctx.font = `400 ${sc(24)}px ${SANS}`; ctx.fillText(`周${'一二三四五六日'[d]}`, x + rw / 2, y + rh + sc(14));
        ctx.fillStyle = '#2c3a20'; ctx.font = `700 ${sc(30)}px ${SANS}`; ctx.fillText(list.length ? `${list.length} 件` : '空着', x + rw / 2, y + rh + sc(52)); ctx.textAlign = 'left';
      });
      footer(`700 ${sc(44)}px ${SANS}`, '#2c3a20', '#5d6b4c');
      return canvas;
    }
    if (mat === 'fluff') { /* ---- 毛: seven cats, one a day; the more done, the fluffier; a full day opens its eyes ---- */
      ctx.fillStyle = '#f8f7f4'; ctx.fillRect(0, 0, W, H);
      caption(`400 ${sc(76)}px ${SONG}`, `第 ${isoWeek(start)} 周`, range, '#141416', '#626266');
      const most = Math.max(4, ...byDay.map(l => l.length)), cw = (W - 2 * Pd) / 4, s = cw * 1.2 / 180;
      byDay.forEach((list, d) => {
        const row = d < 4 ? 0 : 1, col = row ? d - 4 + .5 : d, x = Pd + col * cw + (cw - 180 * s) / 2, y = sc(260) + row * (172 * s + sc(150));
        const p = list.length / most, c = SK.furCanvas(Math.min(1, p), list.length >= most);
        ctx.drawImage(c, x, y, 180 * s, 172 * s);
        ctx.textAlign = 'center'; ctx.fillStyle = '#626266'; ctx.font = `400 ${sc(24)}px ${SONG}`; ctx.fillText(`周${'一二三四五六日'[d]}`, x + 90 * s, y + 172 * s + sc(30));
        ctx.fillStyle = '#141416'; ctx.font = `400 ${sc(34)}px ${SONG}`; ctx.fillText(list.length ? `${list.length} 层` : '一个圈', x + 90 * s, y + 172 * s + sc(74)); ctx.textAlign = 'left';
      });
      footer(`400 ${sc(48)}px ${SONG}`, '#141416', '#626266');
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

  /** The weekly picture is drawn on a canvas, which does not wait for web fonts: load the theme's fonts for the
      characters it will draw, and tell the caller whether it should draw again. */
  const fontsDone = new Set();
  function artFonts(L, entries) {
    const mat = L.material, faces = mat === 'paper' ? ['400 40px "Noto Serif SC"'] : mat === 'bloom' ? ['400 40px "Noto Serif SC"'] : [];
    const text = `${window.SuiSuiSkins?.phraseChars || ''}第周件事层圈间房空着一二三四五六七八九十日月起至专注小时分钟写得最多朱圈是过的这页还空着完成就下个字碎清单IVX0123456789`;
    if (mat === 'room') { const SK = window.SuiSuiSkins, imgs = Array.from({ length: 15 }, (_, n) => SK.roomImg({ done: n, total: Math.max(n, 1), lit: n > 0 })), waiting = imgs.some(i => !i.complete || !i.naturalWidth); return waiting ? SK.roomReady(imgs).then(() => true) : Promise.resolve(false); }
    if (mat === 'fluff') faces.push('400 40px "Noto Serif SC"');
    const key = faces.join() + text; if (!faces.length || !document.fonts?.load || fontsDone.has(key)) return Promise.resolve(false);
    return Promise.all(faces.map(f => document.fonts.load(f, text))).then(() => { fontsDone.add(key); return true; }, () => false);
  }

  /* ---------- Demo data for previews (free users see what Pro makes) ---------- */
  function demoEntries(start = weekStart(), n = 26) {
    const r = rng(42), groups = API.state.groups.map(g => g.id);
    return Array.from({ length: n }, (_, i) => { const d = Math.floor(r() * 7), h = 8 + Math.floor(r() * 14); return { id: `demo-${i}`, at: start.getTime() + d * 864e5 + h * 36e5 + Math.floor(r() * 60) * 6e4, group: groups[i % groups.length], min: r() < .5 ? Math.round(r() * 90) : 0 }; });
  }

  /* ---------- Applying a theme to the app ---------- */
  /** The theme's own lock-screen wallpaper (scripts/make-pro-wallpapers.py) while a theme is on, unless 主题壁纸 is
      off. app.js asks for it wherever it shows the wallpaper (lock view, previews, the glass background). */
  const wallpaper = () => { const id = activeTheme(); return id && S().proWall !== false ? { src: `assets/wallpapers/pro-${id}.jpg`, thumb: `assets/wallpapers/pro-${id}-thumb.jpg`, pos: '50% 50%' } : null; };
  let wallShown = null;
  function syncWall() {
    const w = wallpaper(), html = document.documentElement;
    if (w) html.dataset.proWall = activeTheme(); else delete html.dataset.proWall;
    const key = w ? w.src : '';
    // app.js may have drawn the wallpaper before Pro loaded, so the first call redraws too when a theme wallpaper is due
    if (key !== (wallShown ?? '')) { wallShown = key; API.applySettings(); } else wallShown = key;
  }
  /** Save the theme's wallpaper as an image, to set as the phone's own lock screen. */
  function saveWallpaper(id = activeTheme() || ORDER[0]) {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); API.saveImage(c, `碎碎清单-${THEMES[id].full.replace(' · ', '')}-壁纸.jpg`); };
    img.onerror = () => API.showToast('壁纸没能读取，请再试一次');
    img.src = `assets/wallpapers/pro-${id}.jpg`;
  }
  function applyTheme() {
    const html = document.documentElement, id = activeTheme(), t = THEMES[id];
    if (API.lockMode) {
      // the lock screen follows the theme unless turned off in Pro settings
      const lock = t && S().proLock !== false ? id : '';
      if (lock) html.dataset.proLock = lock; else delete html.dataset.proLock;
      window.SuiSuiSkins.lockStrip(lock);
      syncWall();
      return;
    }
    if (!t) {
      delete html.dataset.proPreview;
      if (html.dataset.proTheme) { delete html.dataset.proTheme; window.SuiSuiSkins.unmount(); API.applySettings(); }
      syncWall();
      return;
    }
    html.dataset.proTheme = id; html.dataset.style = t.base; html.dataset.palette = 'pro';
    if (S().proLock !== false) html.dataset.proPreview = id; else delete html.dataset.proPreview;
    const r = html.style;
    r.setProperty('--accent', t.accent); r.setProperty('--accent-fill', t.accent); r.setProperty('--accent-soft', t.soft); r.setProperty('--on-accent', t.on);
    r.setProperty('--pro-font', t.font);
    if (id === 'day') r.setProperty('--app-font', t.font);
    window.SuiSuiSkins.mount(id);
    syncWall();
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
      b.innerHTML = `<canvas id="pro-banner-jar" aria-hidden="true"></canvas><span class="pro-banner-text"><b>碎碎清单 Pro</b><small>主题、碎片罐、完成动效</small></span><span class="pro-banner-state" id="pro-banner-state"></span>`;
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
    // a Pro theme replaces the free style, so the free style cards show nothing selected while one is on
    if (activeTheme()) document.querySelectorAll('[data-ui-style]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const f = $('pro-look'), rail = $('theme-rail'); if (!f || !rail) return;
    const pro = isPro(), cur = tryOn || (pro ? savedTheme() || '' : '');
    // One gallery: the three free looks, then 随光 and the Pro themes, each pictured by its real home screen
    rail.querySelectorAll('[data-pro-theme-pick]').forEach(b => b.remove());
    rail.insertAdjacentHTML('beforeend', ['auto', ...ORDER].map(id => {
      const on = cur === id, name = id === 'auto' ? '随光' : THEMES[id].full;
      return `<button type="button" class="theme-card pro-theme-chip${on ? ' active' : ''}" data-pro-theme-pick="${id}" aria-pressed="${on}"><span class="theme-shot"><img src="assets/themes/${id}${SHOT()}.jpg" alt="" decoding="async"></span><strong>${name}</strong><small>${on ? '使用中' : 'Pro'}</small>${pro ? '' : `<span class="pro-lock-badge">${icon('lock')}</span>`}</button>`;
    }).join(''));
    rail.querySelectorAll('[data-pro-theme-pick]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.proThemePick;
      if (isPro() && S().proTheme === id) return; // the gallery picks; it never switches a theme off
      setTheme(id);
    }));
    rail.querySelectorAll('[data-ui-style] img').forEach(i => { const want = `assets/themes/ui-${i.closest('[data-ui-style]').dataset.uiStyle}${SHOT()}.jpg`; if (!i.src.endsWith(want)) i.src = want; });
    rail.querySelectorAll('[data-ui-style]').forEach(b => { b.querySelector('small').textContent = !cur && b.classList.contains('active') ? '使用中' : '免费'; });
    const ABOUT = { glass: '手机壁纸铺在底下，半透明的玻璃质感', paper: '米白纸面，大号日期，像一本手账', night: '纯黑底，荧光色点缀，夜里看不刺眼' };
    const about = $('theme-about');
    if (about) {
      const free = S().uiStyle;
      about.innerHTML = cur === 'auto' ? `<b>随光</b>早上琉璃，白天素笺，晚上星河，跟着时间换`
        : cur ? `<b>${THEMES[cur].full}</b>${THEMES[cur].line}` : `<b>${({ glass: '玻璃', paper: '纸墨', night: '夜光' })[free] || ''}</b>${ABOUT[free] || ''}`;
    }
    // keep the chosen theme in view: when the gallery first appears, and when the choice changes
    const place = smooth => { const sel = rail.querySelector('.theme-card.active'), r = rail.getBoundingClientRect(); if (!sel || !r.width) return false;
      const c = sel.getBoundingClientRect(); if (c.left < r.left + 30 || c.right > r.right - 30) rail.scrollBy({ left: c.left - r.left - 36, behavior: smooth ? 'smooth' : 'auto' }); return true; };
    if (rail.dataset.placed !== (cur || 'free')) { if (place(true)) rail.dataset.placed = cur || 'free'; }
    if (!rail._watch && window.ResizeObserver) { rail._watch = new ResizeObserver(() => { const k = rail.querySelector('.theme-card.active')?.dataset.proThemePick || 'free'; if (rail.dataset.placed !== k && place(false)) rail.dataset.placed = k; }); rail._watch.observe(rail); }
    // the theme's wallpaper: use it on the lock screen, or save it to set as the phone's own wallpaper
    const wid = activeTheme();
    f.innerHTML = ''; f.hidden = !(pro && wid);
    if (pro && wid) {
      f.insertAdjacentHTML('beforeend', `<div class="pro-wall-row"><img src="assets/wallpapers/pro-${wid}-thumb.jpg" alt="" aria-hidden="true"><span><b>「${THEMES[wid].full}」专属壁纸</b><small>锁屏和预览都用它；存到相册，也能设成手机壁纸</small></span>
        <label class="pro-wall-switch"><input type="checkbox" class="switch" id="pro-wall-inline" ${S().proWall !== false ? 'checked' : ''} aria-label="锁屏用主题壁纸"></label><button type="button" class="secondary-button" id="pro-wall-save">保存到相册</button></div>`);
      $('pro-wall-inline').addEventListener('change', e => { S().proWall = e.target.checked; persist(); applyTheme(); });
      $('pro-wall-save').addEventListener('click', () => saveWallpaper(wid));
    }
    const e = $('pro-effects-inline');
    if (e) {
      const curE = S().proEffect || 'auto';
      e.innerHTML = `<div class="ag-row"><h3 class="ag-title">完成动效${pro ? '' : '<span class="pro-pill">Pro</span>'}</h3><span class="fx-hint">点一个，下面先演示一遍</span></div>
        <div class="fx-stage" id="fx-stage" aria-live="polite"><div class="fx-sample" id="fx-sample"><span class="fx-sample-check" aria-hidden="true"></span><span class="fx-sample-text" id="fx-sample-text">写完周报</span></div><button type="button" class="fx-replay" id="fx-replay">${icon('play')}<span>再看一次</span></button></div>
        <div class="pro-effect-row">${Object.keys(EFFECTS).map(id => `<button type="button" class="chip${pro && curE === id ? ' active' : ''}" data-pro-effect-pick="${id}">${EFFECTS[id]}${pro ? '' : icon('lock', 'pro-chip-lock')}</button>`).join('')}</div>`;
      e.querySelectorAll('[data-pro-effect-pick]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.proEffectPick;
        if (!isPro()) { previewEffect(id); return; } // free: see it first; choosing still needs Pro
        S().proEffect = id; persist(); renderLookInline(); previewEffect(id);
      }));
      $('fx-replay').addEventListener('click', () => previewEffect(isPro() ? (S().proEffect || 'auto') : 'auto'));
    }
    API.icons(f); if (e) API.icons(e);
  }

  /* ---------- The Pro page ---------- */
  function openSheet(section = '') {
    if (LIVE && !shop) loadShop().then(() => { if (!$('pro-sheet').hidden) { const top = $('pro-sheet').scrollTop; renderSheet(); $('pro-sheet').scrollTop = top; startHero(); } }).catch(() => {});
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
        <p>七套完整主题、七种完成动效与每周碎片画。<br>一次购买，永久使用；此后上线的新主题同样包含在内。</p>
        ${pro && status() ? `<span class="pro-state">${status()}</span>` : ''}
      </header>

      <section class="pro-part" data-pro-section="themes">
        <h2>七套主题</h2>
        <p class="pro-lead">每套主题同时改变 App 界面、锁屏卡片与完成动效，当天全部完成时生成专属画面。左右滑动查看，点击「查看界面」预览。</p>
        <div class="pro-themes pro-showcase" id="pro-showcase">${['auto', ...ORDER].map(id => { const t = THEMES[id], on = (pro ? savedTheme() : tryOn) === id;
          if (id === 'auto') return `<article class="pro-theme pro-tcard is-auto${on ? ' active' : ''}" data-theme-card="auto"><div class="pro-tcard-shots"><figure class="pro-tcard-shot"><img src="assets/themes/auto-wide${SHOT()}.jpg" alt="" decoding="async"></figure></div><div class="pro-tcard-body"><h3>随光</h3><p>早上 5 点用琉璃，10 点用素笺，晚上 6 点用星河。</p><small>现在是${THEMES[byTime()].full}</small></div><div class="pro-tcard-actions"><button type="button" data-pro-theme="auto">${pro ? (on ? '使用中' : '使用') : '试穿'}</button></div></article>`;
          return `<article class="pro-theme pro-tcard${on ? ' active' : ''}" data-theme-card="${id}">
            <div class="pro-tcard-shots" data-pro-stage="${id}" role="button" tabindex="0" aria-label="查看${t.full}的界面"><figure class="pro-tcard-shot"><img src="assets/themes/${id}${SHOT()}.jpg" alt="" decoding="async"><figcaption>界面</figcaption></figure><figure><canvas class="pro-tcard-fin" data-fin="${id}" aria-label="${t.full}：全部做完的画面"></canvas><figcaption>全部做完</figcaption></figure></div>
            <div class="pro-tcard-body"><h3>${t.full}</h3><p>${t.line}</p>
              <div class="pro-tcard-fx"><span class="pro-tcard-fx-check" aria-hidden="true"></span><span class="pro-tcard-fx-text" data-fx-text="${id}">完成时：${FX_LINE[id] || EFFECTS[t.effect]}</span></div></div>
            <div class="pro-tcard-actions"><button type="button" class="pro-tcard-play" data-pro-stage="${id}">${icon('play')}查看界面</button><button type="button" data-pro-theme="${id}">${pro ? (on ? '使用中' : '使用') : '试穿'}</button></div></article>`; }).join('')}</div>
      </section>

      <section class="pro-part" data-pro-section="effects">
        <h2>完成动效</h2>
        <p class="pro-lead">完成一件事时的反馈。点击圆圈即可预览；选择「跟随主题」时，由当前主题决定。</p>
        <div class="pro-demo-row"><button type="button" class="pro-demo-check" id="pro-demo-check" aria-label="试一下完成动效"><span class="check-circle"></span></button><span class="pro-demo-title" id="pro-demo-title">把锁屏待办的想法做出来</span></div>
        <div class="pro-effect-grid">${Object.keys(EFFECTS).filter(id => id !== 'auto').map(id => `<button type="button" class="pro-effect${(pro ? curE === id : id === (demoPick || 'shards')) ? ' active' : ''}" data-pro-effect="${id}"><b>${EFFECTS[id]}</b><small>${EFFECT_LINE[id]}</small></button>`).join('')}
        ${pro ? `<button type="button" class="pro-effect${curE === 'auto' ? ' active' : ''}" data-pro-effect="auto"><b>跟随主题</b><small>每个主题用自己的动效</small></button>` : ''}</div>
      </section>

      <section class="pro-part" data-pro-section="jar">
        <h2>碎片罐与每周碎片画</h2>
        <p class="pro-lead">每天完成的事项收进碎片罐；每周结束时，按完成时间与分组生成一幅画，可保存为图片。</p>
        <div class="pro-jar-demo"><canvas id="pro-demo-jar" aria-hidden="true"></canvas><img id="pro-demo-art" alt="每周碎片画示例"></div>
        <p class="pro-fine">${pro ? '在「今天」页点击碎片罐即可查看。' : '图示为演示数据。'}</p>
      </section>

      <section class="pro-part">
        <h2>同样包含</h2>
        <ul class="pro-more">
          <li>${icon('calendar-clock')}<span><b>倒数日</b>考试、生日、出发等重要日子，显示在清单与锁屏上</span></li>
          <li>${icon('party-popper')}<span><b>清空时刻</b>当天事项全部完成时，播放专属庆祝动画</span></li>
          <li>${icon('gift')}<span><b>后续新主题</b>此后上线的主题，无需再次付费</span></li>
        </ul>
      </section>

      ${pro ? `<section class="pro-part" data-pro-section="settings">
        <h2>Pro 设置</h2>
        <label class="pro-switch"><span><b>锁屏也用主题</b><small>安卓锁屏上的卡片跟着换</small></span><input type="checkbox" class="switch" id="pro-lock" ${S().proLock !== false ? 'checked' : ''}></label>
        <label class="pro-switch"><span><b>锁屏用主题壁纸</b><small>每套主题有自己的壁纸，换主题时一起换</small></span><input type="checkbox" class="switch" id="pro-wall" ${S().proWall !== false ? 'checked' : ''}></label>
        <h3 class="pro-sub">倒数日</h3>
        <div class="pro-cd-list" id="pro-cd-list"></div>
        <form class="pro-cd-add" id="pro-cd-add"><input id="pro-cd-title" maxlength="12" placeholder="比如：考试" aria-label="倒数日名称" required><input type="date" id="pro-cd-date" aria-label="日期" required><button type="submit" class="primary-button">添加</button></form>
      </section>` : ''}

      <footer class="pro-buy" data-pay="${payPlatform()}">
        ${owned ? `<p class="pro-owned">${icon('badge-check')}Pro 已开通，感谢支持。${info().code ? `<small>兑换码 ${esc(info().code)} · 可在其他设备上开通</small>` : info().via === 'appstore' ? '<small>通过 App Store 购买</small>' : info().via ? '<small>兑换码开通</small>' : ''}</p>`
          : `<div class="pro-price"><b>${priceText()}</b>${listText() ? `<s>${listText()}</s>` : ''}<span>${LIVE && shop ? esc(shop.priceNote || '') + (shop.priceNote ? ' · ' : '') : PRICE_NOTE + ' · '}一次购买 · 永久使用 · 无订阅</span></div>
             <div class="pro-actions">${info().trialUsed || FREE ? '' : `<button type="button" class="pro-trial" id="pro-trial">免费试用 ${TRIAL_DAYS} 天</button>`}<button type="button" class="pro-cta" id="pro-buy">${payPlatform() === 'ios' ? `购买 · ${PRICE}` : `开通 Pro · ${priceText()}`}</button></div>`}
        <p class="pro-legal">${owned ? '<span></span>' : payPlatform() === 'ios' ? '<button type="button" id="pro-restore">恢复购买</button>' : '<button type="button" id="pro-have-code">已有兑换码</button>'}<a href="terms.html" target="_blank" rel="noopener">购买须知</a><a href="privacy.html" target="_blank" rel="noopener">隐私政策</a></p>
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
    s.querySelectorAll('[data-pro-stage]').forEach(b => b.addEventListener('click', () => openStage(b.dataset.proStage)));
    drawFinaleThumbs(s);
    $('pro-buy')?.addEventListener('click', () => openPay());
    $('pro-have-code')?.addEventListener('click', () => { openPay(); $('pro-pay-code')?.focus(); });
    s.querySelectorAll('[data-pay-preview]').forEach(b => b.addEventListener('click', () => { payPreview = b.dataset.payPreview; renderSheet(); s.querySelector('.pro-buy')?.scrollIntoView({ block: 'end' }); }));
    $('pro-trial')?.addEventListener('click', startTrial);
    $('pro-restore')?.addEventListener('click', () => { openPay(); $('pro-pay-restore')?.click(); });
    $('pro-reset')?.addEventListener('click', resetLocal);
    $('pro-lock')?.addEventListener('change', e => { S().proLock = e.target.checked; persist(); applyTheme(); });
    $('pro-wall')?.addEventListener('change', e => { S().proWall = e.target.checked; persist(); applyTheme(); });
    $('pro-cd-add')?.addEventListener('submit', addCountdown);
    renderCountdownList();
    // Demo jar + art
    const dj = $('pro-demo-jar'); if (dj) { const ctx = canvasFor(dj, 132, 168); drawJarWith(BRAND, ctx, 8, 6, 116, 156, demoEntries(startOfDay(), 9), 0); }
    const entries = pro && logBetween(weekStart().getTime(), Date.now() + 1).length ? logBetween(weekStart().getTime(), weekStart().getTime() + 7 * 864e5) : demoEntries();
    $('pro-demo-art').src = drawArt(entries, weekStart(), look(), 540).toDataURL('image/png');
    artFonts(look(), entries).then(fresh => { if (fresh && $('pro-demo-art')) $('pro-demo-art').src = drawArt(entries, weekStart(), look(), 540).toDataURL('image/png'); });
  }
  /** Pro sheet showcase: each theme card shows its end-of-day picture (the finished frame) and can play its effect. */
  const FIN_BG = { dawn: '#eef0f6', day: '#f5f2ec', night: '#07080d', bloom: '#f4f5f4', riso: '#f3f1ea', room: '#e7efd6', fluff: '#f8f7f4' };
  function drawFinaleThumbs(root) {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `showcase-${i}`, title: ['写周报', '买菜', '跑步', '回邮件', '整理照片'][i], group: i % 2 ? 'life' : 'work', at: Date.now() - i * 3600e3 }));
    root.querySelectorAll('canvas[data-fin]').forEach(c => {
      const id = c.dataset.fin, draw = FINALES[id]; if (!draw) return;
      const W = 360, H = 420, k = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || 120, h = c.clientHeight || 140;
      c.width = w * k; c.height = h * k; const ctx = c.getContext('2d');
      ctx.fillStyle = FIN_BG[id] || '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      const sc = Math.min(c.width / W, c.height / H); ctx.save(); ctx.translate((c.width - W * sc) / 2, (c.height - H * sc) / 2); ctx.scale(sc, sc);
      try { draw.call(FINALES, ctx, W, H, 9000, items); } catch { /* thumbnail only */ }
      ctx.restore();
    });
    // the room is drawn from images: draw it again once they are decoded
    const SK = window.SuiSuiSkins, room = root.querySelector('canvas[data-fin=room]');
    if (room && SK && !room._waited) { room._waited = true; SK.roomReady([SK.roomImg({ only: 'shell' }), SK.roomImg({ only: 'lamp', done: 1, total: 1, lit: true }), ...SK.ROOM_ORDER.map(k => SK.roomImg({ only: k, done: 1, total: 2 }))]).then(() => { if (room.isConnected) drawFinaleThumbs(root); }); }
  }
  function tryCardEffect(id) {
    const text = document.querySelector(`[data-fx-text="${id}"]`), row = text?.parentElement; if (!text || text.dataset.busy) return;
    const fx = THEMES[id]?.effect || 'shards'; text.dataset.busy = '1'; row.classList.add('done');
    if (reduce() || !FX[fx]) { setTimeout(() => { row.classList.remove('done'); delete text.dataset.busy; }, 700); return; }
    let run; try { run = FX[fx](text, sampleText(text, fx === 'dots' ? 4 : fx === 'stardust' ? 2 : fx === 'shards' ? 6 : 3)); } catch { run = null; }
    text.style.visibility = 'hidden';
    Promise.resolve(run).then(() => setTimeout(() => { text.style.visibility = ''; row.classList.remove('done'); delete text.dataset.busy; text.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }, 500));
  }
  /* ---------- Theme showcase: the real app in that theme — home, lock screen, finishing, and the day's picture ---------- */
  const STAGE_PAGES = [['home', '主页'], ['lock', '锁屏'], ['fx', '完成的那一下'], ['finale', '全部做完']];
  let stageRaf = 0;
  function openStage(id) {
    const t = THEMES[id]; if (!t) return;
    let el = $('pro-stage');
    if (!el) { el = document.createElement('div'); el.id = 'pro-stage'; el.className = 'pro-stage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.append(el); }
    const on = (isPro() ? savedTheme() : tryOn) === id;
    el.innerHTML = `<header class="pro-stage-top"><button type="button" class="pro-stage-close" id="pro-stage-close" aria-label="返回">${icon('chevron-left')}</button>
        <div class="pro-stage-name"><b>${t.full}</b><span>${t.en || ''}</span></div><span class="pro-stage-spacer"></span></header>
      <p class="pro-stage-line">${t.line}</p>
      <div class="pro-stage-tabs" role="tablist">${STAGE_PAGES.map(([k, n], i) => `<button type="button" role="tab" data-stage-go="${i}" aria-selected="${i === 0}">${n}</button>`).join('')}</div>
      <div class="pro-stage-pager" id="pro-stage-pager">${STAGE_PAGES.map(([k, n]) => `<figure class="pro-stage-frame" data-frame="${k}"><div class="pro-stage-phone">${k === 'finale' ? `<canvas class="pro-stage-fin" aria-label="${t.full}：全部做完"></canvas>` : `<iframe title="${t.full} · ${n}" data-src="index.html?showcase=${id}&view=${k}" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`}</div><figcaption>${n}</figcaption></figure>`).join('')}</div>
      <footer class="pro-stage-foot"><button type="button" class="pro-stage-use${on ? ' is-on' : ''}" data-pro-theme="${id}">${on ? '正在使用' : isPro() ? `使用「${t.full}」` : '试穿这套'}</button></footer>`;
    API.icons(el);
    el.hidden = false; document.body.classList.add('pro-stage-open');
    const pager = $('pro-stage-pager'), frames = [...pager.querySelectorAll('.pro-stage-frame')];
    const load = i => { const f = frames[i]?.querySelector('iframe[data-src]'); if (f && !f.src) f.src = f.dataset.src; };
    const fit = () => frames.forEach(fr => { const ph = fr.querySelector('.pro-stage-phone'), ifr = ph.querySelector('iframe'); if (ifr) ifr.style.transform = `scale(${ph.clientWidth / 390})`; });
    const go = i => { pager.scrollTo({ left: frames[i].offsetLeft - (pager.clientWidth - frames[i].clientWidth) / 2, behavior: reduce() ? 'auto' : 'smooth' }); };
    const current = () => { const mid = pager.scrollLeft + pager.clientWidth / 2; let best = 0, d = 1e9; frames.forEach((f, i) => { const c = f.offsetLeft + f.clientWidth / 2, dd = Math.abs(c - mid); if (dd < d) { d = dd; best = i; } }); return best; };
    const mark = () => { const i = current(); el.querySelectorAll('[data-stage-go]').forEach((b, k) => b.setAttribute('aria-selected', String(k === i))); load(i); load(i + 1); };
    pager.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
    el.querySelectorAll('[data-stage-go]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.stageGo; load(i); go(i); }));
    $('pro-stage-close').addEventListener('click', closeStage);
    el.querySelector('.pro-stage-use').addEventListener('click', e => { setTheme(id); closeStage(); });
    requestAnimationFrame(() => { fit(); load(0); load(1); mark(); });
    window.addEventListener('resize', fit);
    // the day's picture plays in a loop
    const c = el.querySelector('.pro-stage-fin'), draw = FINALES[id];
    cancelAnimationFrame(stageRaf);
    if (c && draw) {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: `stage-${i}`, title: ['写周报', '买菜', '跑步', '回邮件', '整理照片'][i], group: i % 2 ? 'life' : 'work', at: Date.now() - i * 3600e3 }));
      const k = Math.min(devicePixelRatio || 1, 2), start = performance.now();
      const frame = now => {
        if (el.hidden) return;
        const w = c.clientWidth, h = c.clientHeight; if (c.width !== Math.round(w * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); }
        const ctx = c.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = FIN_BG[id] || '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        const W = 390, H = 560, sc = Math.min(c.width / W, c.height / H), ms = reduce() ? 9000 : ((now - start) * CEL_SPEED) % 7000;
        ctx.save(); ctx.translate((c.width - W * sc) / 2, (c.height - H * sc) / 2); ctx.scale(sc, sc); try { draw.call(FINALES, ctx, W, H, Math.min(ms, 5200), items); } catch { /* preview */ } ctx.restore();
        stageRaf = requestAnimationFrame(frame);
      };
      stageRaf = requestAnimationFrame(frame);
    }
  }
  function closeStage() { const el = $('pro-stage'); if (!el || el.hidden) return; el.hidden = true; document.body.classList.remove('pro-stage-open'); cancelAnimationFrame(stageRaf); el.querySelectorAll('iframe').forEach(f => f.removeAttribute('src')); }
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
    let art = drawArt(week, ws, look(), 1080);
    $('pro-art-img').src = art.toDataURL('image/png');
    artFonts(look(), week).then(fresh => { if (fresh && $('pro-art-img')) { art = drawArt(week, ws, look(), 1080); $('pro-art-img').src = art.toDataURL('image/png'); } });
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

  /** The task's pieces fly from its row into the theme's picture of today, and land at `to`.
      晨: droplets fall into the glass. 昼: a drop of red ink arcs to the character's cell. 晕: a drop of ink falls into the water. 乐: a paper dot to its column. 印: pink and blue ink dots. 夜: a spark with a tail flies up to its star. Resolves when they land. */
  function flyToHead(rect, to, theme) {
    const from = { x: rect.left + Math.min(rect.width * .3, 120), y: rect.top + rect.height / 2 }, dur = theme === 'night' ? 520 : 480; // 精致利落: a quick, low arc
    const lift = Math.min(110, Math.max(50, Math.abs(from.y - to.y) * .28));
    const path = (t, dx = 0, lag = 0) => { const e = easeInOut(clamp(t)), x = from.x + dx * (1 - e) + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(clamp(t) * Math.PI) * (lift + lag); return { x, y }; };
    let draw;
    if (theme === 'dawn') {
      const drops = Array.from({ length: 5 }, (_, i) => { const r = rng(i * 7 + 3); return { d: i * 26, dx: (r() - .5) * 90, s: 2.6 + r() * 2.8, lag: r() * 30, c: ['#a99fff', '#86dcc6', '#ffb99b'][i % 3] }; });
      draw = (ctx, ms) => drops.forEach(b => {
        const t = (ms - b.d) / dur; if (t <= 0 || t >= 1) return; const p = path(t, b.dx, b.lag);
        const g = ctx.createRadialGradient(p.x - b.s * .35, p.y - b.s * .4, 0, p.x, p.y, b.s); g.addColorStop(0, '#fff'); g.addColorStop(.45, b.c); g.addColorStop(1, hex(b.c, .55));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, b.s, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .8; ctx.stroke();
      });
    } else if (theme === 'day') {
      draw = (ctx, ms) => { for (let k = 14; k >= 0; k--) { const t = (ms - k * 9) / dur; if (t <= 0 || t >= 1) continue; const p = path(t); ctx.globalAlpha = (1 - k / 15) * .9; ctx.fillStyle = '#b43a2c'; ctx.beginPath(); ctx.arc(p.x, p.y, 4.2 * (1 - k / 18), 0, 7); ctx.fill(); } ctx.globalAlpha = 1; };
    } else if (theme === 'bloom') {
      const col = window.SuiSuiSkins?.PIGMENTS?.[0]?.[1] || '#3b5a87';
      draw = (ctx, ms) => { const t = ms / dur; if (t >= 1) return; const p = path(t), q = path(Math.max(0, t - .04)), a = Math.atan2(p.y - q.y, p.x - q.x) - Math.PI / 2, s = 5;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = 'rgba(43,43,46,.85)'; ctx.beginPath(); ctx.moveTo(0, -s * 1.9); ctx.bezierCurveTo(s * .9, -s * .5, s, s * .6, 0, s); ctx.bezierCurveTo(-s, s * .6, -s * .9, -s * .5, 0, -s * 1.9); ctx.fill(); ctx.restore(); void col; };
    } else if (theme === 'tape') {
      draw = (ctx, ms) => { for (let k = 10; k >= 0; k--) { const t = (ms - k * 10) / dur; if (t <= 0 || t >= 1) continue; const p = path(t); ctx.fillStyle = `rgba(243,236,220,${(1 - k / 11) * .9})`; ctx.beginPath(); ctx.arc(p.x, p.y, 4.6 * (1 - k / 14), 0, 7); ctx.fill(); } };
    } else if (theme === 'riso') {
      const dots = Array.from({ length: 8 }, (_, i) => { const r = rng(i * 17 + 3); return { d: i * 18, dx: (r() - .5) * 110, s: 2.4 + r() * 3, lag: r() * 40, c: i % 2 ? 'rgba(255,79,163,.85)' : 'rgba(47,95,179,.85)' }; });
      draw = (ctx, ms) => { ctx.globalCompositeOperation = 'multiply'; dots.forEach(b => { const t = (ms - b.d) / dur; if (t <= 0 || t >= 1) return; const p = path(t, b.dx, b.lag); ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(p.x, p.y, b.s, 0, 7); ctx.fill(); }); ctx.globalCompositeOperation = 'source-over'; };
    } else if (theme === 'room') { // a little box tumbles into the room
      draw = (ctx, ms) => { const t = ms / dur; if (t >= 1) return; const p = path(t), a = t * Math.PI * 1.5, s = 7;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a * .3); ctx.lineJoin = 'round'; ctx.lineWidth = 1.1; ctx.strokeStyle = '#2c3a20';
        [[[0, -s], [s * .87, -s / 2], [0, 0], [-s * .87, -s / 2], '#f1d55a'], [[-s * .87, -s / 2], [0, 0], [0, s], [-s * .87, s / 2], '#c99a52'], [[0, 0], [s * .87, -s / 2], [s * .87, s / 2], [0, s], '#a87a3a']].forEach(f => { ctx.beginPath(); f.slice(0, 4).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = f[4]; ctx.fill(); ctx.stroke(); });
        ctx.restore(); };
    } else if (theme === 'fluff') { // a few loose hairs drift over
      const hairs = Array.from({ length: 7 }, (_, i) => { const r = rng(i * 13 + 5); return { d: i * 15, dx: (r() - .5) * 70, lag: r() * 30, a: r() * 6, l: 6 + r() * 7 }; });
      draw = (ctx, ms) => hairs.forEach(h => { const t = (ms - h.d) / dur; if (t <= 0 || t >= 1) return; const p = path(t, h.dx, h.lag), a = h.a + t * 4;
        ctx.strokeStyle = 'rgba(20,20,22,.85)'; ctx.lineWidth = .9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + Math.cos(a + .6) * h.l * .6, p.y + Math.sin(a + .6) * h.l * .6, p.x + Math.cos(a) * h.l, p.y + Math.sin(a) * h.l); ctx.stroke(); });
    } else {
      draw = (ctx, ms) => {
        const t = ms / dur; if (t >= 1) return;
        for (let k = 22; k >= 1; k--) { const q = path(t - k * .012); if (t - k * .012 <= 0) continue; ctx.fillStyle = `rgba(201,214,255,${(1 - k / 23) * .5})`; ctx.beginPath(); ctx.arc(q.x, q.y, 2.6 * (1 - k / 26), 0, 7); ctx.fill(); }
        const p = path(t); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(201,214,255,.8)'); g.addColorStop(1, 'rgba(159,180,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7); ctx.fill();
      };
    }
    const span = theme === 'dawn' ? dur + 5 * 26 : theme === 'riso' ? dur + 8 * 18 : theme === 'fluff' ? dur + 7 * 15 : dur + 100;
    const landAt = ['dawn', 'riso', 'fluff'].includes(theme) ? dur + 40 : dur;
    setTimeout(() => land(to, theme), landAt - 30);
    return overlay(span, draw, landAt);
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
  /* ---------- 清空时刻: each theme ends the day its own way (canvas, about 3.5 s, then holds still) ---------- */
  const easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const CEL_SPEED = 1.7;
  /** Where the piece lands in the header picture: one thin ring in the theme's ink opens and fades (about 0.4 s). */
  const LAND_INK = { dawn: '#86dcc6', day: '#b43a2c', night: '#c9d6ff', bloom: '#3b5a87', riso: '#ff4fa3', room: '#2c3a20', fluff: '#141416' };
  function land(to, theme) {
    if (!to || reduce()) return;
    const d = document.createElement('div'); d.className = 'pro-land';
    Object.assign(d.style, { left: `${to.x}px`, top: `${to.y}px`, '--land': LAND_INK[theme] || '#ffffff' });
    document.body.append(d); setTimeout(() => d.remove(), 520);
  }
  const FINALES = {
    dawn(ctx, W, H, ms, items = []) { // a layered drink: every thing done is one band of colour, poured in the order it was done
      const n = Math.max(1, Math.min(8, items.length || 5)), PAL = ['#b9b1ff', '#94e0cc', '#ffc4a8', '#a9d4ff', '#f6b6d0', '#d6f0a8', '#c9b8ff', '#9fe6e0'];
      const gw = 132, gh = 214, cx = W / 2, y = H / 2 - gh / 2 - 22, top = gw / 2, bot = gw / 2 - 12, foot = 16;
      const edge = t => top + (bot - top) * t; // half width at depth t (0 top .. 1 bottom of the liquid space)
      const inner = h => { ctx.beginPath(); ctx.moveTo(cx - top + 5, y); ctx.lineTo(cx - bot + 5, y + h); ctx.lineTo(cx + bot - 5, y + h); ctx.lineTo(cx + top - 5, y); ctx.closePath(); };
      const per = 1500 / n, space = gh - foot - 14, band = space / n;
      // soft shadow and a caustic of the colours on the table
      const sh = ctx.createRadialGradient(cx, y + gh + 6, 4, cx, y + gh + 6, gw * .75); sh.addColorStop(0, 'rgba(60,56,90,.16)'); sh.addColorStop(1, 'rgba(60,56,90,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cx, y + gh + 6, gw * .75, 14, 0, 0, 7); ctx.fill();
      const fillT = clamp(ms / (per * n + 300));
      if (fillT > .2) { const ca = ctx.createRadialGradient(cx + 18, y + gh + 8, 2, cx + 18, y + gh + 8, 70); ca.addColorStop(0, `rgba(255,196,168,${.35 * fillT})`); ca.addColorStop(.5, `rgba(148,224,204,${.18 * fillT})`); ca.addColorStop(1, 'rgba(185,177,255,0)'); ctx.fillStyle = ca; ctx.beginPath(); ctx.ellipse(cx + 18, y + gh + 8, 70, 12, 0, 0, 7); ctx.fill(); }
      // liquid bands, bottom up, each poured in turn with a little wave that settles
      ctx.save(); inner(gh - foot); ctx.clip();
      let level = y + gh - foot;
      for (let k = 0; k < n; k++) { const t = easeOut(clamp((ms - k * per) / (per * 1.3))); if (t <= 0) break;
        const h = band * t, yTop = level - h, wave = (1 - t) * 5, c = PAL[k % PAL.length], c2 = PAL[(k + 1) % PAL.length];
        const g = ctx.createLinearGradient(0, level, 0, yTop - 6); g.addColorStop(0, c); g.addColorStop(1, hex(c2, .92));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - top - 4, level + 1); for (let x = -top - 4; x <= top + 4; x += 4) ctx.lineTo(cx + x, yTop + Math.sin(x / 13 + ms / 170 + k) * wave); ctx.lineTo(cx + top + 4, level + 1); ctx.fill();
        level = yTop; }
      // meniscus + inner glow
      if (level < y + gh - foot - 1) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(cx, level + 1, edge((level - y) / (gh - foot)) - 6, 2.2, 0, 0, 7); ctx.fill(); }
      const gl = ctx.createLinearGradient(cx - top, 0, cx + top, 0); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(.25, 'rgba(255,255,255,0)'); gl.addColorStop(.8, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.18)'); ctx.fillStyle = gl; ctx.fillRect(cx - top, y, gw, gh);
      // a few slow bubbles
      for (let b = 0; b < 7; b++) { const r = rng(b + 11), by = y + gh - foot - ((ms / 22 * (.6 + r()) + r() * gh) % (gh - foot)); if (by < level + 4) continue; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(cx - bot + 14 + r() * (bot * 2 - 28), by, .9 + r() * 1.4, 0, 7); ctx.fill(); }
      ctx.restore();
      // the glass: thick base, two hairlines, long highlights
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(cx - bot - 1, y + gh - foot); ctx.lineTo(cx + bot + 1, y + gh - foot); ctx.lineTo(cx + bot + 1, y + gh - 4); ctx.quadraticCurveTo(cx + bot + 1, y + gh, cx + bot - 4, y + gh); ctx.lineTo(cx - bot + 4, y + gh); ctx.quadraticCurveTo(cx - bot - 1, y + gh, cx - bot - 1, y + gh - 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - top, y); ctx.lineTo(cx - bot - 1, y + gh - 4); ctx.quadraticCurveTo(cx - bot - 1, y + gh, cx - bot + 4, y + gh); ctx.lineTo(cx + bot - 4, y + gh); ctx.quadraticCurveTo(cx + bot + 1, y + gh, cx + bot + 1, y + gh - 4); ctx.lineTo(cx + top, y);
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(40,40,70,.2)'; ctx.lineWidth = .8; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,40,70,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, y, top, 3.2, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(cx, y, top, 3.2, 0, Math.PI, 0); ctx.stroke();
      const hl = ctx.createLinearGradient(0, y + 12, 0, y + gh - 30); hl.addColorStop(0, 'rgba(255,255,255,.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.beginPath(); ctx.moveTo(cx - top + 12, y + 12); ctx.lineTo(cx - top + 17, y + 12); ctx.lineTo(cx - bot + 14, y + gh - 34); ctx.lineTo(cx - bot + 11, y + gh - 34); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(cx + top - 16, y + 18, 2, 40);
      // tick marks, one per thing
      ctx.strokeStyle = 'rgba(40,40,70,.25)'; ctx.lineWidth = 1; for (let k = 1; k <= n; k++) { const yy = y + gh - foot - band * k, hw = edge((yy - y) / (gh - foot)); ctx.beginPath(); ctx.moveTo(cx + hw - 12, yy); ctx.lineTo(cx + hw - 4, yy); ctx.stroke(); }
    },
    day(ctx, W, H, ms, items) { // the line is written out, then the seal comes down
      const P = window.SuiSuiSkins.phrase(items.length === 6 ? 6 : Math.max(1, items.length), items.length === 6 ? '' : API.dayKey()), chars = Array.from(P.text), n = chars.length;
      const cell = Math.min(44, (W - 60) / Math.min(7, n)), per = Math.min(7, n), rows = Math.ceil(n / per), x0 = W / 2 - per * cell / 2, y0 = 70;
      chars.forEach((ch, i) => { const cx = x0 + (i % per) * cell, cy = y0 + Math.floor(i / per) * cell, t = clamp((ms - i * 140) / 300);
        ctx.strokeStyle = 'rgba(180,58,44,.45)'; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, cell, cell);
        ctx.globalAlpha = .3 + .7 * t; ctx.fillStyle = t < 1 ? '#b43a2c' : '#1d1a16'; ctx.font = `400 ${cell * .62}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText(ch, cx + cell / 2, cy + cell * .72); ctx.globalAlpha = 1; });
      const t = clamp((ms - n * 140 - 300) / 420), s = 96, sx = W / 2 + per * cell / 2 - s * .4, sy = y0 + rows * cell + 30;
      if (t > 0) { const k = 1.7 - .7 * easeIn(t); ctx.save(); ctx.translate(sx, sy + s / 2); ctx.rotate(-.08); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = '#b43a2c'; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 8); ctx.fill(); ctx.strokeStyle = '#f5f2ec'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-s / 2 + 8, -s / 2 + 8, s - 16, s - 16, 4); ctx.stroke();
        ctx.fillStyle = '#f5f2ec'; ctx.font = `700 ${s * .52}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText('毕', 0, s * .18);
        ctx.globalCompositeOperation = 'destination-out'; const r = rng(3); for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(0,0,0,${.4 + r() * .5})`; ctx.fillRect((r() - .5) * s, (r() - .5) * s, 1 + r() * 3, 1 + r() * 2); } ctx.restore(); }
      ctx.textAlign = 'left';
    },
    night(ctx, W, H, ms, items) { // the stars light up in the order things were done and join into one constellation, named for today
      const n = Math.max(2, items.length), cx = W / 2, cy = H * .42, R = Math.min(W * .34, H * .3);
      // place on a soft ring so the lines never cross: angle by order, radius by the id
      const pts = items.map((e, i) => { const r = rng(hash(`cel:${e.id}`)), a = -Math.PI * .85 + (i / Math.max(1, n - 1)) * Math.PI * 1.55 + (r() - .5) * .35, rr = R * (.62 + r() * .42); return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * .78, m: .75 + r() * .5 }; });
      // nebula and dust, very faint
      const neb = (x, y, r, c) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
      const fade = clamp(ms / 1200); ctx.globalAlpha = fade; neb(cx - R * .5, cy - R * .2, R * 1.3, 'rgba(96,110,220,.16)'); neb(cx + R * .6, cy + R * .3, R, 'rgba(170,110,220,.10)'); ctx.globalAlpha = 1;
      const bg = rng(9); for (let i = 0; i < 110; i++) { const x = bg() * W, y = bg() * H, a = .08 + bg() * .35, tw = .6 + .4 * Math.sin(ms / 500 + i); ctx.fillStyle = `rgba(223,230,255,${a * tw})`; ctx.beginPath(); ctx.arc(x, y, .35 + bg() * .75, 0, 7); ctx.fill(); }
      const per = 2000 / Math.max(1, pts.length);
      // lines: thin, brighter in the middle
      pts.forEach((p, i) => { if (!i) return; const t = easeOut(clamp((ms - i * per) / per)); if (t <= 0) return; const a = pts[i - 1], ex = a.x + (p.x - a.x) * t, ey = a.y + (p.y - a.y) * t;
        const g = ctx.createLinearGradient(a.x, a.y, ex, ey); g.addColorStop(0, 'rgba(201,214,255,.15)'); g.addColorStop(.5, 'rgba(223,230,255,.6)'); g.addColorStop(1, 'rgba(201,214,255,.2)');
        ctx.strokeStyle = g; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke(); });
      const pulse = ms > 2300 ? .5 + .5 * Math.sin((ms - 2300) / 380) : 0;
      pts.forEach((p, i) => { const t = clamp((ms - i * per) / 320); if (t <= 0) return; const s = 5.5 * p.m * easeOutBack(t) * (1 + pulse * .12);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 4.2); g.addColorStop(0, 'rgba(214,224,255,.55)'); g.addColorStop(.35, 'rgba(160,180,255,.18)'); g.addColorStop(1, 'rgba(159,180,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s * 4.2, 0, 7); ctx.fill();
        // diffraction spikes
        ctx.strokeStyle = 'rgba(235,240,255,.55)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(p.x - s * 3.2, p.y); ctx.lineTo(p.x + s * 3.2, p.y); ctx.moveTo(p.x, p.y - s * 3.2); ctx.lineTo(p.x, p.y + s * 3.2); ctx.stroke();
        ctx.fillStyle = '#f8faff'; ctx.beginPath(); ctx.arc(p.x, p.y, s * .42, 0, 7); ctx.fill(); });
      // the constellation's name, small and spaced, under its lowest star
      const nt = clamp((ms - 2100) / 600); if (nt > 0) { const low = pts.reduce((m, p) => p.y > m.y ? p : m, pts[0]), d = new Date(); ctx.globalAlpha = nt * .8; ctx.fillStyle = '#c9d6ff'; ctx.font = `500 11px ${SANS}`; ctx.textAlign = 'center';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px'; ctx.fillText(`碎碎座 · ${d.getMonth() + 1}.${d.getDate()}`, cx, Math.min(H - 14, low.y + 34)); if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
      const st = clamp((ms - 2500) / 800); if (st > 0 && st < 1) { const sx = W * (1.05 - st * 1.2), sy = 26 + st * 90, gr = ctx.createLinearGradient(sx, sy, sx + 80, sy - 34); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 80, sy - 34); ctx.stroke(); }
    },
    bloom(ctx, W, H, ms, items) { // every colour is one petal; together they open into a flower, then the seal
      const n = Math.max(3, items.length), cx = W / 2, cy = H * .44, L = Math.min(92, H * .22), PAL = ['#e48ea0', '#f0b47c', '#86b4dc', '#9cc39a', '#b29ad6', '#f1cf6e', '#e7a2c4', '#7fc2c0'];
      const wet = (c, a) => hex(c, a);
      // stem and one leaf first, in grey-green ink
      const stT = easeOut(clamp(ms / 700)); ctx.strokeStyle = 'rgba(94,120,92,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.quadraticCurveTo(cx + 10, cy + 70, cx - 4, cy + 12 + (H * .5) * stT); ctx.stroke();
      if (stT > .6) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(140,178,128,.35)'; ctx.beginPath(); ctx.ellipse(cx + 22, cy + 96, 24 * stT, 8 * stT, -.5, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalCompositeOperation = 'multiply';
      for (let i = 0; i < n; i++) { const t = easeOut(clamp((ms - 250 - i * 180) / 1100)); if (t <= 0) continue;
        const a = -Math.PI / 2 + i * (Math.PI * 2 / n), c = PAL[i % PAL.length], len = L * (.35 + .65 * t), wd = len * .46, px = cx + Math.cos(a) * len * .55, py = cy + Math.sin(a) * len * .55;
        ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        for (let k = 0; k < 3; k++) { const g = ctx.createRadialGradient(-len * .1, 0, 0, 0, 0, len * .62); g.addColorStop(0, wet(c, .12)); g.addColorStop(.72, wet(c, .2)); g.addColorStop(.94, wet(c, .42)); g.addColorStop(1, wet(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse((k - 1) * 1.5, (k - 1) * 1.2, len * .58, wd * (.9 + k * .05), 0, 0, 7); ctx.fill(); }
        // a vein of darker pigment where the water dried
        ctx.strokeStyle = wet(c, .28); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-len * .45, 0); ctx.quadraticCurveTo(0, wd * .1, len * .4, 0); ctx.stroke();
        ctx.restore(); }
      // the heart
      const ht = clamp((ms - 250 - n * 180) / 500); if (ht > 0) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14); g.addColorStop(0, `rgba(196,140,52,${.75 * ht})`); g.addColorStop(1, 'rgba(196,140,52,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
        const r = rng(5); ctx.fillStyle = `rgba(120,80,30,${.55 * ht})`; for (let k = 0; k < 9; k++) { const a = r() * 7, d = 3 + r() * 7; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, .9, 0, 7); ctx.fill(); } }
      ctx.globalCompositeOperation = 'source-over';
      // seal and date, like a signed painting
      const t = clamp((ms - n * 180 - 1300) / 400); if (t > 0) { const s = 30, sx = cx + L + 14, sy = cy + L + 46; ctx.save(); ctx.globalAlpha = t; ctx.translate(sx, sy); ctx.rotate(-.04);
        ctx.fillStyle = '#b8475a'; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 3); ctx.fill(); ctx.fillStyle = '#f7f8f7'; ctx.font = `700 ${s * .36}px ${SONG}`; ctx.textAlign = 'center'; ctx.fillText('碎', 0, -1); ctx.fillText('碎', 0, s * .36);
        const d = new Date(); ctx.fillStyle = 'rgba(43,43,46,.55)'; ctx.font = `400 11px ${SONG}`; ctx.textAlign = 'right'; ctx.fillText(`${d.getMonth() + 1}月${d.getDate()}日`, -s / 2 - 8, 4); ctx.restore(); ctx.textAlign = 'left'; }
    },
    tape(ctx, W, H, ms, items) { // the strip runs past the playhead; every hole sends a note up
      const SK = window.SuiSuiSkins, sh = 120, sy = H - sh - 50, gap = 64, scroll = ms * .09, px = W * .35;
      ctx.fillStyle = '#f3ecdc'; ctx.fillRect(0, sy, W, sh);
      for (let r = 0; r < 7; r++) { ctx.fillStyle = `rgba(18,48,42,${r % 2 ? .07 : .13})`; ctx.fillRect(0, sy + 18 + r * 14, W, 1); }
      for (let x = (-scroll % 14 + 14) % 14; x < W; x += 14) { ctx.fillStyle = 'rgba(18,48,42,.5)'; ctx.beginPath(); ctx.arc(x, sy + 6, 1.5, 0, 7); ctx.arc(x, sy + sh - 6, 1.5, 0, 7); ctx.fill(); }
      items.forEach((e, i) => { const x = px + 40 + i * gap - scroll, p = SK.pitchOf(e.id), y = sy + 18 + p * 14 * 1.0; if (x < -10 || x > W + 10) return; ctx.fillStyle = '#0b1f1b'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
        const passed = (px - x) / 260; if (passed > 0 && passed < 1) { ctx.globalAlpha = 1 - passed; ctx.fillStyle = '#f3ecdc'; ctx.beginPath(); ctx.ellipse(x - 4, sy - 20 - passed * 120, 5, 4, -.4, 0, 7); ctx.fill(); ctx.fillRect(x, sy - 46 - passed * 120, 1.6, 26); ctx.globalAlpha = 1; } });
      ctx.fillStyle = '#e2725b'; ctx.fillRect(px - 1, sy - 6, 2, sh + 12);
    },
    riso(ctx, W, H, ms, items) { // the poster slides out of the press: the blue pass, then the pink settles into register
      const SK = window.SuiSuiSkins, pw = Math.min(250, W - 70), ph = Math.min(H - 40, pw * 1.32), x0 = W / 2 - pw / 2, out = easeOut(clamp(ms / 1000)), y0 = 18 - (1 - out) * (ph * .4);
      const BLUE = '#2f5fb3', PINK = '#ff4fa3', reg = 5 * (1 - easeOut(clamp((ms - 1100) / 900))), d = new Date();
      ctx.globalAlpha = out;
      ctx.fillStyle = '#fbfaf6'; ctx.shadowColor = 'rgba(31,42,68,.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; ctx.fillRect(x0, y0, pw, ph); ctx.shadowColor = 'transparent';
      // paper grain
      const gr = rng(4); ctx.fillStyle = 'rgba(31,42,68,.05)'; for (let k = 0; k < 160; k++) ctx.fillRect(x0 + gr() * pw, y0 + gr() * ph, 1, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip(); ctx.globalCompositeOperation = 'multiply';
      // pink halftone sun in the corner
      if (ms > 700) { const a = clamp((ms - 700) / 500) * .9; for (let yy = 0; yy < 90; yy += 7) for (let xx = 0; xx < 90; xx += 7) { const dd = Math.hypot(xx - 70, yy - 18); if (dd > 64) continue; ctx.fillStyle = hex(PINK, a * .85); ctx.beginPath(); ctx.arc(x0 + pw - 90 + xx + reg, y0 + yy - reg * .6, 2.6 * (1 - dd / 70), 0, 7); ctx.fill(); } }
      // big title in two passes
      ctx.font = `900 46px ${SANS}`; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = hex(BLUE, .95); ctx.fillText('TODAY', x0 + 18, y0 + 62);
      if (ms > 900) { ctx.fillStyle = hex(PINK, .8 * clamp((ms - 900) / 400)); ctx.fillText('TODAY', x0 + 18 + 2.5 + reg, y0 + 62 - 1.5 - reg * .6); }
      ctx.font = `700 11px ${SANS}`; ctx.fillStyle = BLUE; ctx.fillText(`${items.length} THINGS DONE · 今日已印好`, x0 + 20, y0 + 82);
      // the motifs in a tidy grid
      const list = items.slice(0, 9), cols = list.length <= 4 ? 2 : 3, rows = Math.ceil(list.length / cols), gap = 10, gx = x0 + 18, gw = pw - 36, cell = Math.min((gw - gap * (cols - 1)) / cols, (ph - 140 - gap * (rows - 1)) / rows), gy = y0 + 100 + ((ph - 140) - rows * cell - (rows - 1) * gap) / 2, gxo = gx + (gw - (cols * cell + (cols - 1) * gap)) / 2;
      list.forEach((e, i) => { const m = SK.MOTIFS[SK.motifOf(e)], x = gxo + (i % cols) * (cell + gap), y = gy + Math.floor(i / cols) * (cell + gap), k = (cell - 16) / 40, line = /M20 4v6|M4 10l16|M8 32L26/.test(m.p), it = clamp((ms - 300 - i * 90) / 300); if (it <= 0) return;
        ctx.fillStyle = hex(BLUE, .07); ctx.fillRect(x, y, cell, cell);
        ctx.save(); ctx.globalAlpha = out * it; ctx.translate(x + 8, y + 8); ctx.scale(k, k);
        if (/M20 4v6/.test(m.b)) { ctx.strokeStyle = BLUE; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(new Path2D(m.b)); } else { ctx.fillStyle = hex(BLUE, .92); ctx.fill(new Path2D(m.b)); }
        if (ms > 900) { ctx.globalAlpha = out * it * clamp((ms - 900) / 400); ctx.translate(1.6 + reg / k * .4, -1.2 - reg / k * .25); if (line) { ctx.strokeStyle = PINK; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke(new Path2D(m.p)); } else { ctx.fillStyle = hex(PINK, .85); ctx.fill(new Path2D(m.p)); } }
        ctx.restore(); });
      ctx.restore();
      // footer rule, date, edition
      ctx.fillStyle = BLUE; ctx.fillRect(x0 + 18, y0 + ph - 34, pw - 36, 1.5);
      ctx.font = `800 12px ${SANS}`; ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, x0 + 18, y0 + ph - 16);
      ctx.textAlign = 'right'; ctx.fillStyle = PINK; ctx.fillText(`No.${String(items.length).padStart(2, '0')}`, x0 + pw - 18, y0 + ph - 16); ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  };

  Object.assign(FINALES, {
    room(ctx, W, H, ms, items) { // the empty room, then each thing drops in, then the lamp comes on
      const SK = window.SuiSuiSkins, n = Math.min(items.length, SK.ROOM_ORDER.length), s = Math.min(1.5, (H - 30) / 224), w = 200 * s, h = 224 * s, x = (W - w) / 2, y = (H - h) / 2 - 6;
      const shell = SK.roomImg({ only: 'shell' }); if (!shell.complete) return;
      const keys = SK.ROOM_ORDER.slice(0, n); if (!keys.includes('lamp')) keys.push('lamp');
      const gap = Math.min(220, 2200 / keys.length), at = k => 500 + keys.indexOf(k) * gap, lightAt = 500 + keys.length * gap + 300;
      const t0 = easeOut(clamp(ms / 500)); ctx.globalAlpha = t0; ctx.drawImage(shell, x, y + (1 - t0) * 20, w, h); ctx.globalAlpha = 1;
      ['rug', 'window', 'picture', 'clock', 'shelf', 'desk', 'mug', 'lamp', 'chair', 'bed', 'cushion', 'books', 'plant', 'shoes'].forEach(k => { if (!keys.includes(k)) return;
        const img = SK.roomImg({ only: k, done: 1, total: 2 }); if (!img.complete) return;
        const t = clamp((ms - at(k)) / 420); if (t <= 0) return; ctx.globalAlpha = clamp(t * 3); ctx.drawImage(img, x, y - (1 - easeOutBack(t)) * 26, w, h); ctx.globalAlpha = 1; });
      const on = clamp((ms - lightAt) / 500);
      if (on > 0) { const lit = SK.roomImg({ only: 'lamp', done: 1, total: 1, lit: true }); if (lit.complete) { ctx.globalAlpha = on; ctx.drawImage(lit, x, y, w, h); ctx.globalAlpha = 1; }
        const lx = x + 153 * s, ly = y + 98 * s, g = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * .7); g.addColorStop(0, `rgba(255,226,140,${.4 * on})`); g.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    },
    fluff(ctx, W, H, ms, items) { // the cat is drawn stroke by stroke, then blinks awake
      const SK = window.SuiSuiSkins, s = Math.min(1.7, (H - 40) / 172), w = 180 * s, x = (W - w) / 2, y = 8;
      const total = SK.furTotal(), p = easeInOut(clamp((ms - 200) / 2600)), n = Math.round(total * p);
      if (!this._fur || this._fur.W !== W) { const c = document.createElement('canvas'), k = s * Math.min(devicePixelRatio || 1, 2); c.width = 180 * k; c.height = 172 * k; const cx = c.getContext('2d'); cx.scale(k, k); this._fur = { c, cx, n: 0, W }; }
      const F = this._fur; if (n < F.n) { F.cx.clearRect(0, 0, 180, 172); F.n = 0; }
      if (n > F.n) { SK.furStrokes(F.cx, F.n, n); F.n = n; }
      // a soft shadow under the cat, so it sits on something
      const shy = y + 160 * s, sh = ctx.createRadialGradient(W / 2, shy, 2, W / 2, shy, w * .42); sh.addColorStop(0, `rgba(20,20,22,${.16 * p})`); sh.addColorStop(1, 'rgba(20,20,22,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(W / 2, shy, w * .42, 10 * s, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); SK.furOutlineDraw(ctx, .42 * (1 - p)); ctx.restore();
      ctx.drawImage(F.c, x, y, w, 172 * s);
      const t = ms - 3000, open = t <= 0 ? 0 : t < 260 ? t / 260 : t < 900 ? 1 : t < 1000 ? 1 - (t - 900) / 100 : t < 1120 ? (t - 1000) / 120 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); SK.furFace(ctx, p, open); ctx.restore();
    }
  });

  function celebrate() {
    if (!isPro() || API.lockMode) return;
    const key = API.dayKey(); if (S().proCelebrated === key) return;
    S().proCelebrated = key; persist();
    const box = $('pro-celebrate'), today = todayLog(), focus = today.reduce((n, e) => n + (e.min || 0), 0), L = look();
    box.style.setProperty('--cel-bg', L.bg); box.style.setProperty('--cel-ink', L.ink); box.style.setProperty('--cel-muted', L.muted);
    const th = activeTheme(), focusText = focus ? `，专注 ${focus} 分钟` : '';
    const words = { dawn: ['杯子满了。', `今天 ${today.length} 件${focusText}，一滴不剩。`, '收好了'], day: ['今日事，今日毕。', `${today.length} 件${focusText}，这一页写完了。`, '收笔'], night: ['今天的星座，连好了。', `${today.length} 颗星${focusText}，晚安。`, '晚安'],
      bloom: ['晕好了。', `${today.length} 滴颜色${focusText}，今天这幅画干了。`, '落款'], tape: ['曲子打好了。', `${today.length} 个音${focusText}，八音盒弹给你听。`, '好听'], riso: ['印完了。', `${today.length} 张小画${focusText}，今天这张海报印好了。`, '收藏'],
      room: ['房间布置好了。', `${today.length} 件家具${focusText}，开灯，住进来吧。`, '开灯'], fluff: ['它醒了。', `${today.length} 层毛${focusText}，今天画完了。`, '摸摸它'] }[th] || ['今天的事，全部完成。', `${today.length} 件${focusText}，都收进碎片罐了。`, '收好了'];
    box.className = `pro-celebrate${th ? ` pro-cel-${th}` : ''}`;
    box.innerHTML = `<canvas id="pro-cel-canvas" aria-hidden="true"></canvas><div class="pro-cel-text"><h2>${words[0]}</h2><p>${words[1]}</p><button type="button" id="pro-cel-close">${words[2]}</button></div>`;
    box.hidden = false;
    $('pro-cel-close').addEventListener('click', closeCelebrate);
    box.addEventListener('click', e => { if (e.target === box) closeCelebrate(); });
    playSound(themeSound()); setTimeout(() => playSound(themeSound()), 260);
    const c = $('pro-cel-canvas'), W = Math.min(innerWidth, 520), H = 360, ctx = canvasFor(c, W, H), t0 = performance.now(), still = reduce();
    const finale = FINALES[th];
    // the room is drawn from pictures: wait until they are decoded, or a still (reduced-motion) frame would be empty
    const ready = th === 'room' ? (SK => SK.roomReady([SK.roomImg({ only: 'shell' }), SK.roomImg({ only: 'lamp', done: 1, total: 1, lit: true }), ...SK.ROOM_ORDER.map(k => SK.roomImg({ only: k, done: 1, total: 2 }))]))(window.SuiSuiSkins) : Promise.resolve();
    if (th === 'fluff') FINALES.fluff._fur = null;
    if (finale) {
      if (th === 'tape') window.SuiSuiSkins.playTune?.(today.map(e => e.id));
      let start = t0;
      // 1.18: the same picture, played about 1.7× faster (done in ~2 s instead of ~3.5 s), so the moment lands and gets out of the way
      const frame = now => { const ms = still ? 9000 : (now - start) * CEL_SPEED; ctx.clearRect(0, 0, W, H); finale(ctx, W, H, ms, today); if (!box.hidden && !still && ms < 5200) requestAnimationFrame(frame); };
      ready.then(() => { start = performance.now(); requestAnimationFrame(frame); });
      return;
    }
    const rain = Array.from({ length: 24 }, (_, i) => { const r = rng(i * 7 + 1); return { x: W / 2 + (r() - .5) * 120, d: r() * 520, rot: r() * 6, c: L.shards[i % L.shards.length] }; });
    const frame = now => {
      const ms = now - t0; ctx.clearRect(0, 0, W, H);
      drawJar(ctx, W / 2 - 80, 110, 160, 230, today, { per: 6, sz: 20, ms: still ? 0 : ms });
      if (!still) for (const r of rain) { const t = clamp((ms - r.d) / 620); if (t <= 0 || t >= 1) continue; const y = -20 + easeIn(t) * 270; ctx.save(); ctx.translate(r.x, y); ctx.rotate(r.rot + t * 6); ctx.globalAlpha = 1 - t * .2; ctx.fillStyle = r.c; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (!box.hidden && !still && ms < 2600) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function closeCelebrate() { $('pro-celebrate').hidden = true; }
  function celebrateUnlock() { API.showToast('Pro 已解锁，去“外观”或“今天”页的罐子看看'); }

  /* ---------- Wiring ---------- */
  function refreshAll() {
    if (API.lockMode) { renderCountdowns(); return; } // the lock view has no settings, banner or Pro sheet to fill
    renderLookInline(); renderCountdowns(); drawMiniJar(false);
    const st = $('pro-banner-state'); if (st) st.textContent = isPro() ? (info().owned || FREE ? '已开通' : `试用 ${trialLeft()} 天`) : PRICE;
    const sub = document.querySelector('#pro-banner .pro-banner-text small'); if (sub) sub.textContent = isPro() && themeLabel() ? `正在用「${themeLabel()}」` : isPro() ? '主题、碎片罐、动效都已打开' : '主题、碎片罐、完成动效';
    const bj = $('pro-banner-jar'); if (bj) { const ctx = canvasFor(bj, 24, 30); drawJarWith(BRAND, ctx, 2, 1, 20, 28, demoEntries(startOfDay(), 6), 0); }
    if (!$('pro-sheet').hidden) { const top = $('pro-sheet').scrollTop; renderSheet(); $('pro-sheet').scrollTop = top; startHero(); }
  }
  window.SuiSuiPro = { simOutcome: v => { payOutcome = v; }, effect, isPro, themeLabel, freeForTesters: FREE, redeem, demoCode, payPlatform, openPay, closePay, wallpaper, saveWallpaper, open: openSheet, openJar, drawArt, THEMES, EFFECTS, buy, startTrial, reset: resetLocal, tryTheme: startTry, endTry };
  // Back (Android back button, iPhone edge swipe): close the Pro layers first, top-most first
  const baseBack = window.suisuiBack;
  window.suisuiBack = () => {
    const open = id => $(id) && !$(id).hidden;
    if (open('pro-stage')) { closeStage(); return true; }
    if (open('pro-pay')) { if (payStep !== 'working') closePay(); return true; }
    if (open('pro-celebrate')) { closeCelebrate(); return true; }
    if (open('pro-jar-sheet')) { closeJar(); return true; }
    if (open('pro-sheet')) { closeSheet(); return true; }
    return baseBack ? baseBack() : false;
  };
  // listen first: refreshAll() can make app.js re-apply its settings, and the theme has to win again afterwards
  window.addEventListener('suisui:settings', () => { applyTheme(); renderLookInline(); });
  if (SHOW && THEMES[SHOW]) Object.assign(S(), { proTheme: SHOW, proLock: true, proWall: true, proEffect: 'auto' });
  mount();
  applyTheme(); refreshAll();
  // release builds: check the licence, finish an order confirmed while the app was closed
  if (LIVE && !API.lockMode) { liveBoot(); document.addEventListener('visibilitychange', () => { if (!document.hidden && info().order && !info().owned) pollOrder().then(st => { if (st === 'paid') API.showToast('付款已确认，Pro 已开通。谢谢支持！'); }); }); }
  // In the effect frame, the first thing gets done and comes back, over and over, so the theme's finishing can be watched
  if (SHOW && SHOW_VIEW === 'fx') {
    const cycle = () => {
      const row = document.querySelector('#task-list .task-row:not(.is-done) .check-task');
      if (row) row.click();
      setTimeout(() => document.querySelector('#completed-list [data-action=restore]')?.click(), 1900);
    };
    setTimeout(cycle, 700); setInterval(cycle, 3400);
  }
  window.addEventListener('suisui:render', () => { if (API.lockMode) { window.SuiSuiSkins.lockStrip(document.documentElement.dataset.proLock || ''); return; } window.SuiSuiSkins.head(); renderCountdowns(); drawMiniJar(false); });
  window.addEventListener('suisui:completing', () => { if (isPro() || tryOn) playSound(themeSound()); });
  window.addEventListener('suisui:done', e => {
    const { id, rect, allDone } = e.detail || {}, skin = window.SuiSuiSkins, theme = activeTheme();
    if (theme && skin?.arriving?.(id)) {
      const to = rect && !reduce() ? skin.target(id) : null;
      if (to) flyToHead(rect, to, theme).then(() => { skin.arrive(id); drawMiniJar(true); });
      else { skin.arrive(id); drawMiniJar(true); }
    } else if (rect) flyToJar(rect); else drawMiniJar(true);
    if (allDone) setTimeout(celebrate, 760);
  });
  // A trial that ends while the app is open: the free look comes back.
  setInterval(() => { const was = document.documentElement.dataset.proTheme || ''; if (was !== activeTheme()) { applyTheme(); API.render(); refreshAll(); } }, 60000);
})();
