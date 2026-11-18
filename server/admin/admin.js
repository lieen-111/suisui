/* 碎碎清单 · 管理后台 — talks to /admin/api with a session cookie. Everything shown is escaped. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const yuan = fen => `¥${(fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: fen % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const when = t => { if (!t) return '—'; const d = new Date(t), today = new Date(); const same = d.toDateString() === today.toDateString();
    return same ? d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? '刚刚' : s < 3600 ? `${Math.floor(s / 60)} 分钟前` : s < 86400 ? `${Math.floor(s / 3600)} 小时前` : `${Math.floor(s / 86400)} 天前`; };

  async function api(path, opts = {}) {
    const r = await fetch('api' + path, { credentials: 'same-origin', ...opts, headers: { 'x-suisui-admin': '1', ...(opts.body && !(opts.body instanceof Blob) ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
    const j = r.headers.get('content-type')?.includes('json') ? await r.json() : {};
    if (r.status === 401 && j.error === 'signin') { boot().catch(offline); throw new Error('signin'); }
    if (!r.ok) throw Object.assign(new Error(j.message || j.error || '出错了'), { data: j });
    return j;
  }
  const post = (path, body) => api(path, { method: 'POST', body: body instanceof Blob ? body : JSON.stringify(body || {}), headers: body instanceof Blob ? { 'content-type': body.type } : {} });
  let toastTimer;
  function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
  function confirmBox(text, yes = '确定', danger = true) {
    return new Promise(res => { const d = $('confirm'); $('confirm-text').textContent = text; $('confirm-yes').textContent = yes; $('confirm-yes').className = `btn ${danger ? 'danger' : 'primary'}`;
      d.onclose = () => res(d.returnValue === 'yes'); d.showModal(); });
  }
  const copy = async (text, what = '已复制') => { try { await navigator.clipboard.writeText(text); toast(what); } catch { toast('复制失败，请手动选择'); } };

  /* ---------- gate ---------- */
  async function boot() {
    let s;
    for (let i = 0; ; i++) {
      try { const r = await fetch('api/state', { cache: 'no-store', credentials: 'same-origin' }); s = await r.json(); break; }
      catch (err) { if (i >= 4) throw err; await new Promise(res => setTimeout(res, 800)); }
    }
    if (s.signedIn) return enter();
    showGate(s.setup, s.token);
  }
  function showGate(setup = false, token = '') {
    $('shell').hidden = true; $('gate').hidden = false;
    $('setup-form').hidden = !setup; $('login-form').hidden = setup;
    const tokenInput = $('setup-form').querySelector('[name=token]');
    if (setup && token) { tokenInput.value = token; tokenInput.closest('label').hidden = true; $('setup-lead').textContent = '第一次使用，设一个管理密码（至少 10 位）。以后用它登录，请记下来。'; }
    (setup ? $('setup-form').querySelector(token ? '[name=password]' : 'input') : $('login-form').querySelector('input')).focus();
  }
  function offline() {
    $('shell').hidden = true; $('gate').hidden = false; $('setup-form').hidden = true; $('login-form').hidden = true;
    $('gate-error').textContent = '连不上后台。请确认电脑上的黑色窗口还开着，然后刷新这个页面。';
  }
  $('setup-form').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target);
    try { await post('/setup', { token: f.get('token').trim(), password: f.get('password') }); enter(); } catch (err) { $('gate-error').textContent = err.message; } });
  $('login-form').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target);
    try { await post('/login', { password: f.get('password') }); $('gate-error').textContent = ''; e.target.reset(); enter(); }
    catch (err) { if (err.data?.error === 'setup') { $('gate-error').textContent = ''; return boot().catch(offline); } $('gate-error').textContent = err.message === 'Failed to fetch' ? '连不上后台，请确认电脑上的黑色窗口还开着' : err.message; } });
  $('logout').addEventListener('click', async () => { await post('/logout'); showGate(false); });

  /* ---------- pages ---------- */
  const PAGES = ['overview', 'orders', 'codes', 'devices', 'settings'];
  function enter() { $('gate').hidden = true; $('shell').hidden = false; route(); pollPending(); }
  function route() {
    const page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== page; });
    document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    ({ overview: loadOverview, orders: loadOrders, codes: loadCodes, devices: loadDevices, settings: loadSettings })[page]().catch(err => err.message !== 'signin' && toast(err.message));
  }
  window.addEventListener('hashchange', route);
  const seg = (el, attr, fn) => el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset[attr]); });
  const pressed = (el, attr) => el.querySelector('[aria-pressed=true]')?.dataset[attr] ?? '';
  let pendingTimer;
  async function pollPending() {
    clearTimeout(pendingTimer);
    try { const s = await api('/stats?days=7'); const n = s.orders.pending; $('pending-dot').hidden = !n; $('pending-dot').textContent = n; document.title = n ? `(${n}) 碎碎清单 · 管理后台` : '碎碎清单 · 管理后台'; } catch {}
    pendingTimer = setTimeout(pollPending, 30000);
  }

  /* ---------- 概览 ---------- */
  let days = 30;
  seg($('range'), 'days', d => { days = Number(d); loadOverview(); });
  const ACTIONS = { 'order.new': '新的扫码订单', 'order.confirm': '确认收款', 'order.reject': '驳回订单', 'order.refund': '退款', 'afdian.paid': '爱发电收款', 'afdian.claim': '爱发电订单解锁', redeem: '兑换码解锁', 'redeem.fail': '兑换失败', 'codes.create': '生成兑换码', 'code.disable': '停用兑换码', 'code.enable': '启用兑换码', 'code.reset': '清空兑换码的设备', 'unlock.revoke': '撤销设备', settings: '修改设置', 'qr.upload': '上传收款码', 'qr.remove': '移除收款码', 'admin.login': '登录', 'admin.login.fail': '登录失败', 'admin.setup': '设定管理密码', 'admin.password': '修改密码', 'backup.download': '下载备份', 'afdian.webhook': '爱发电通知' };
  const describe = (action, detail) => { let d = detail; try { const j = JSON.parse(detail); d = j.order || j.code || j.batch && `${j.batch} · ${j.count} 个` || j.trade || Object.values(j).join(' · '); } catch {} return `${ACTIONS[action] || action}${d ? ` <span class="muted">${esc(d)}</span>` : ''}`; };
  async function loadOverview() {
    const s = await api(`/stats?days=${days}`);
    const r = s.revenue;
    $('kpis').innerHTML = `
      <div class="kpi lead"><span>今天收入</span><b>${yuan(r.today)}</b><small>近 7 天 ${yuan(r.d7)}</small></div>
      <div class="kpi"><span>近 30 天</span><b>${yuan(r.d30)}</b><small>累计 ${yuan(r.all)}</small></div>
      <div class="kpi"><span>已付款订单</span><b>${s.orders.paid}</b><small>${s.orders.refunded ? `退款 ${s.orders.refunded}` : '没有退款'}</small></div>
      <a class="kpi${s.orders.pending ? ' alert' : ''}" href="#orders"><span>待确认</span><b>${s.orders.pending}</b><small>${s.devices} 台设备已解锁</small></a>`;
    const sum = s.daily.reduce((a, d) => a + d.revenue, 0);
    $('chart-sum').textContent = `${days} 天共 ${yuan(sum)} · ${s.daily.reduce((a, d) => a + d.orders, 0)} 单`;
    drawChart(s.daily);
    const c = s.codes, used = c.total ? Math.round(c.used / c.total * 100) : 0;
    $('code-stats').innerHTML = c.total ? `<div class="stat-rows"><div><span>已生成</span><b>${c.total}</b></div><div class="meter" aria-hidden="true"><i style="width:${used}%"></i></div>
      <div><span>已使用</span><b>${c.used}（${used}%）</b></div><div><span>未使用</span><b>${c.total - c.used - c.disabled}</b></div><div><span>已停用</span><b>${c.disabled}</b></div></div>`
      : `<p class="empty">还没有生成兑换码。<br><a href="#codes">去生成</a></p>`;
    const total = Object.values(s.channels).reduce((a, v) => a + v, 0);
    if (total) $('code-stats').insertAdjacentHTML('beforeend', `<div class="card-head sub"><h2>收入来源</h2></div><div class="stat-rows">${Object.entries(s.channels).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${{ qr: '扫码付款', afdian: '爱发电' }[k] || esc(k)}</span><b>${yuan(v)}（${Math.round(v / total * 100)}%）</b></div>`).join('')}</div>`);
    const feed = s.recent.filter(x => !/^admin\.login|^backup/.test(x.action)).slice(0, 8);
    $('feed').innerHTML = feed.length ? feed.map(x => `<li><time>${ago(x.at)}</time><span>${describe(x.action, x.detail)}</span></li>`).join('') : '<li class="empty">还没有动静</li>';
  }
  function drawChart(daily) {
    const el = $('chart'), W = el.clientWidth || 600, H = 220, padL = 44, padB = 24, top = 8;
    const max = Math.max(100, ...daily.map(d => d.revenue)), step = niceStep(max / 100);
    const ceil = Math.ceil(max / 100 / step) * step * 100, bw = (W - padL) / daily.length;
    const y = v => top + (H - padB - top) * (1 - v / ceil);
    let g = '';
    for (let v = 0; v <= ceil; v += step * 100) g += `<line class="grid" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${v / 100}</text>`;
    const every = Math.ceil(daily.length / (W < 500 ? 4 : 8)), label = i => daily.length <= 10 && W >= 500 || (i % every === 0 && daily.length - 1 - i >= every / 2) || i === daily.length - 1;
    const bars = daily.map((d, i) => { const x = padL + i * bw + bw * .18, w = Math.max(2, bw * .64), hgt = Math.max(d.revenue ? 2 : 1.5, H - padB - y(d.revenue));
      return `<g class="col" data-i="${i}"><rect x="${padL + i * bw}" y="${top}" width="${bw}" height="${H - padB - top}" fill="transparent"/><rect class="bar${d.revenue ? '' : ' zero'}" x="${x}" y="${H - padB - hgt}" width="${w}" height="${hgt}" rx="${Math.min(4, w / 2)}"/>${label(i) ? `<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.date.slice(5).replace('-', '/')}</text>` : ''}</g>`; }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}${bars}</svg><div class="chart-tip" hidden></div>`;
    const tip = el.querySelector('.chart-tip');
    el.querySelectorAll('.col').forEach(c => { const d = daily[c.dataset.i];
      c.addEventListener('pointerenter', () => { const r = c.querySelector('.bar').getBBox(); tip.hidden = false; tip.innerHTML = `${d.date.slice(5).replace('-', '月')}日<br><b>${yuan(d.revenue)}</b> · ${d.orders} 单 · 解锁 ${d.unlocks}`; tip.style.left = `${(r.x + r.width / 2) / W * el.clientWidth}px`; tip.style.top = `${r.y - 8}px`; });
      c.addEventListener('pointerleave', () => { tip.hidden = true; }); });
  }
  const niceStep = v => { const p = 10 ** Math.floor(Math.log10(Math.max(v, 1))); return [1, 2, 5, 10].map(m => m * p).find(s => v / s <= 5) || 10 * p; };
  let resizeT; window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!document.querySelector('[data-page=overview]').hidden) loadOverview(); }, 200); });

  /* ---------- 订单 ---------- */
  const CH = { qr: '扫码', afdian: '爱发电' }, ST = { pending: ['待确认', 'warn'], paid: ['已付款', 'ok'], rejected: ['已驳回', ''], refunded: ['已退款', 'bad'] };
  seg($('order-filter'), 'status', () => loadOrders());
  let qT; $('order-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(loadOrders, 250); });
  async function loadOrders() {
    const st = pressed($('order-filter'), 'status'), list = await api(`/orders?status=${encodeURIComponent(st)}&q=${encodeURIComponent($('order-q').value)}`);
    $('orders').innerHTML = list.length ? `<table><thead><tr><th>订单号</th><th>方式</th><th>金额</th><th>状态</th><th>付款备注</th><th>兑换码</th><th>下单</th><th></th></tr></thead><tbody>${list.map(o => `<tr>
      <td class="mono" data-label="订单号"><span><span class="copy" data-copy="${esc(o.id)}">${esc(o.id)}</span>${o.ext_no ? `<br><small class="muted">${esc(o.ext_no)}</small>` : ''}</span></td>
      <td data-label="方式">${CH[o.channel] || esc(o.channel)}${o.platform ? ` · ${o.platform === 'android' ? '安卓' : o.platform === 'web' ? '网页' : esc(o.platform)}` : ''}</td>
      <td class="num" data-label="金额">${yuan(o.amount)}</td>
      <td data-label="状态"><span class="pill ${ST[o.status]?.[1] || ''}">${ST[o.status]?.[0] || esc(o.status)}</span></td>
      <td class="note" data-label="付款备注">${esc(o.payer_note) || '—'}</td>
      <td class="mono" data-label="兑换码">${o.code ? `<span class="copy" data-copy="${esc(o.code)}">${esc(o.code)}</span>` : '—'}</td>
      <td data-label="下单">${when(o.created_at)}</td>
      <td class="actions">${o.status === 'pending' ? `<button class="btn small ok" data-act="confirm" data-id="${esc(o.id)}">确认收款</button><button class="btn small ghost" data-act="reject" data-id="${esc(o.id)}">驳回</button>` : o.status === 'paid' ? `<button class="btn small ghost" data-act="refund" data-id="${esc(o.id)}">退款</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : `<p class="empty">${st === 'pending' ? '没有待确认的订单 🎉' : '没有订单'}</p>`;
  }
  $('orders').addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    const text = { confirm: `确认已收到订单 ${id} 的款？确认后买家的手机会自动解锁 Pro。`, reject: `驳回订单 ${id}？买家会看到"没有核对到付款"。`, refund: `把订单 ${id} 标记为已退款？它的兑换码会停用，已解锁的设备下次联网时退回免费版。退款本身请在微信 / 支付宝 / 爱发电里操作。` }[act];
    if (!(await confirmBox(text, { confirm: '确认收款', reject: '驳回', refund: '标记退款' }[act], act !== 'confirm'))) return;
    try { await post(`/orders/${id}/${act}`); toast({ confirm: '已确认，买家那边会自动解锁', reject: '已驳回', refund: '已标记退款' }[act]); loadOrders(); pollPending(); } catch (err) { toast(err.message); }
  });

  /* ---------- 兑换码 ---------- */
  const CS = { unused: ['未使用', ''], used: ['已使用', 'ok'], full: ['已用满', 'ok'], disabled: ['已停用', 'bad'], expired: ['已过期', 'warn'] };
  seg($('code-filter'), 'state', () => loadCodes());
  $('code-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(loadCodes, 250); });
  $('batch-pick').addEventListener('change', loadCodes);
  async function loadCodes() {
    const st = pressed($('code-filter'), 'state'), batch = $('batch-pick').value;
    const { list, batches } = await api(`/codes?status=${encodeURIComponent(st)}&batch=${encodeURIComponent(batch)}&q=${encodeURIComponent($('code-q').value)}`);
    $('batch-pick').innerHTML = `<option value="">全部批次</option>${batches.map(b => `<option value="${esc(b.batch)}"${b.batch === batch ? ' selected' : ''}>${esc(b.batch === 'order' ? '订单自带' : b.batch)}（${b.n}）</option>`).join('')}`;
    $('export-csv').href = `api/codes.csv${batch ? `?batch=${encodeURIComponent(batch)}` : ''}`;
    $('codes').innerHTML = list.length ? `<table><thead><tr><th>兑换码</th><th>批次</th><th>设备</th><th>状态</th><th>备注</th><th>创建</th><th></th></tr></thead><tbody>${list.map(c => `<tr>
      <td class="mono" data-label="兑换码"><span class="copy" data-copy="${esc(c.display)}">${esc(c.display)}</span></td>
      <td data-label="批次">${esc(c.batch === 'order' ? '订单自带' : c.batch)}</td>
      <td class="num" data-label="设备">${c.used} / ${c.max_devices}</td>
      <td data-label="状态"><span><span class="pill ${CS[c.state]?.[1] || ''}">${CS[c.state]?.[0] || c.state}</span>${c.expires_at && c.state !== 'expired' ? `<br><small class="muted">到 ${new Date(c.expires_at).toLocaleDateString('zh-CN')}</small>` : ''}</span></td>
      <td class="note" data-label="备注">${esc(c.note) || '—'}</td>
      <td data-label="创建">${when(c.created_at)}</td>
      <td class="actions">${c.used ? `<button class="btn small ghost" data-code="${esc(c.code)}" data-act="reset">清空设备</button>` : ''}${c.disabled ? `<button class="btn small" data-code="${esc(c.code)}" data-act="enable">启用</button>` : `<button class="btn small ghost" data-code="${esc(c.code)}" data-act="disable">停用</button>`}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">没有符合条件的兑换码</p>';
  }
  $('codes').addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act !== 'enable' && !(await confirmBox(act === 'reset' ? '清空这个码已绑定的设备？买家换了手机时用。原来的设备下次联网时会退回免费版。' : '停用这个兑换码？已经用它解锁的设备下次联网时仍保留 Pro；要收回请到「设备」里撤销。', act === 'reset' ? '清空' : '停用'))) return;
    try { await post(`/codes/${b.dataset.code}/${act}`); toast('已更新'); loadCodes(); } catch (err) { toast(err.message); }
  });
  $('make-codes').addEventListener('submit', async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await post('/codes', { ...f, count: Number(f.count), maxDevices: Number(f.maxDevices), expiresDays: Number(f.expiresDays) });
      $('made').hidden = false;
      $('made').innerHTML = `<div class="made-head"><b>「${esc(r.batch)}」生成了 ${r.codes.length} 个</b><span><button type="button" class="btn small" id="copy-made">全部复制</button> <a class="btn small" href="api/codes.csv?batch=${encodeURIComponent(r.batch)}" download>导出这批</a></span></div><pre>${r.codes.map(esc).join('\n')}</pre>`;
      $('copy-made').addEventListener('click', () => copy(r.codes.join('\n'), `已复制 ${r.codes.length} 个兑换码`));
      loadCodes();
    } catch (err) { toast(err.message); }
  });

  /* ---------- 设备 ---------- */
  $('dev-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(loadDevices, 250); });
  async function loadDevices() {
    const list = await api(`/activations?q=${encodeURIComponent($('dev-q').value)}`);
    $('devices').innerHTML = list.length ? `<table><thead><tr><th>设备</th><th>平台</th><th>来源</th><th>解锁时间</th><th>最近联网</th><th>状态</th><th></th></tr></thead><tbody>${list.map(a => `<tr>
      <td class="mono" data-label="设备">${esc(a.device.slice(0, 10))}…</td>
      <td data-label="平台"><span>${a.platform === 'android' ? '安卓' : a.platform === 'web' ? '网页' : esc(a.platform || '—')}${a.app_version ? ` <small class="muted">${esc(a.app_version)}</small>` : ''}</span></td>
      <td class="mono" data-label="来源">${a.order_id ? `订单 ${esc(a.order_id)}` : esc(a.code)}</td>
      <td data-label="解锁时间">${when(a.created_at)}</td>
      <td data-label="最近联网">${a.last_seen ? ago(a.last_seen) : '—'}</td>
      <td data-label="状态">${a.revoked_at ? '<span class="pill bad">已撤销</span>' : '<span class="pill ok">有效</span>'}</td>
      <td class="actions">${a.revoked_at ? '' : `<button class="btn small ghost" data-revoke="${esc(a.id)}">撤销</button>`}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">还没有设备解锁</p>';
  }
  $('devices').addEventListener('click', async e => {
    const b = e.target.closest('[data-revoke]'); if (!b) return;
    if (!(await confirmBox('撤销这台设备的 Pro？它下次联网时会退回免费版，空出的名额可以再用。', '撤销'))) return;
    try { await post(`/activations/${b.dataset.revoke}/revoke`); toast('已撤销'); loadDevices(); } catch (err) { toast(err.message); }
  });

  /* ---------- 设置 ---------- */
  async function loadSettings() {
    const [s, cfg, log] = await Promise.all([api('/settings'), api('/app-config'), api('/audit')]);
    const f = $('shop-form');
    for (const [k, v] of Object.entries(s)) { const el = f.elements[k]; if (!el) continue;
      if (el instanceof RadioNodeList) { [...el].forEach(r => { r.checked = r.value === v; }); continue; }
      el.value = ['price', 'listPrice'].includes(k) ? (v / 100).toFixed(2).replace(/\.00$/, '') : v; }
    $('qr-img').src = s.hasQr ? `../api/qr?t=${Date.now()}` : ''; $('qr-empty').hidden = !!s.hasQr; $('qr-remove').hidden = !s.hasQr;
    $('webhook-url').textContent = cfg.webhook;
    $('app-config').textContent = `/* 碎碎清单 Pro：正式版设置（由管理后台生成） */\nwindow.SUISUI_PRO_CONFIG = window.SUISUI_PRO_CONFIG || {\n  freeForTesters: false,\n  server: ${JSON.stringify(cfg.server)},\n  publicKey: ${JSON.stringify(cfg.publicKey)}\n};\n`;
    $('audit').innerHTML = log.slice(0, 60).map(x => `<li><time>${when(x.at)}</time><span>${describe(x.action, x.detail)}</span></li>`).join('') || '<li class="empty">没有记录</li>';
  }
  $('shop-form').addEventListener('submit', async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const body = { ...f, price: Math.round(Number(f.price) * 100), listPrice: Math.round(Number(f.listPrice || 0) * 100), maxDevices: Number(f.maxDevices) };
    try { await api('/settings', { method: 'PUT', body: JSON.stringify(body) }); $('shop-saved').textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); toast('设置已保存'); } catch (err) { toast(err.message); }
  });
  $('qr-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('图片太大，请小于 2MB');
    try { await post('/qr', file); toast('收款码已上传'); loadSettings(); } catch (err) { toast(err.message); } e.target.value = '';
  });
  $('qr-remove').addEventListener('click', async () => { if (!(await confirmBox('移除收款码？App 的扫码付款页会显示"暂时不能扫码付款"。', '移除'))) return; await api('/qr', { method: 'DELETE' }); loadSettings(); });
  $('afdian-test').addEventListener('click', async () => { $('afdian-result').textContent = '正在连接…'; try { const r = await post('/afdian/test'); $('afdian-result').textContent = r.ok ? '✓ 连接成功' : `没连上：${r.detail}`; } catch (err) { $('afdian-result').textContent = err.message; } });
  $('copy-config').addEventListener('click', () => copy($('app-config').textContent, '已复制，粘贴到 app/pro-config.js'));
  $('pw-form').addEventListener('submit', async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { await post('/password', f); e.target.reset(); $('pw-saved').textContent = '已修改'; toast('密码已修改，其他地方的登录已退出'); } catch (err) { toast(err.message); } });

  boot().catch(offline);
})();
