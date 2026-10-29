(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // Keep the original key so existing users keep their data; the record carries its own schema number.
  const STORE = 'suisui-locktodo-v1';
  const SCHEMA = 2;
  const ARCHIVE_LIMIT = 300;
  const groups = { work: '工作', life: '生活' };
  const repeats = { none: '仅一次', daily: '每天' };
  const palette = { green: ['#13765b', '#e9f3ee'], rose: ['#b14c6b', '#f9edf1'], blue: ['#226a9a', '#eaf2f8'] };
  const defaults = { accent: 'green', density: 'comfortable', wallpaper: 'lake', photo: '', motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, intensity: 2, cardMaterial: 'frosted', cardColor: '#112b24', cardTransparency: 15, cardText: 'auto', autoArchive: true, lockNotify: false, lockScreen: false, installDismissed: false, androidSetupSeen: false };
  const examples = () => [
    { id: 'seed-1', title: '把锁屏待办的想法做出来', group: 'work', pinned: true, done: false },
    { id: 'seed-2', title: '整理今天的拍摄素材', group: 'work', pinned: false, done: false },
    { id: 'seed-3', title: '给家里打个电话', group: 'life', pinned: false, done: false },
    { id: 'seed-4', title: '出门走走，至少二十分钟', group: 'life', pinned: false, done: false, repeat: 'daily' },
    { id: 'seed-5', title: '把下周的选题记下来', group: 'work', pinned: false, done: false },
    { id: 'seed-6', title: '读完床头的那一章', group: 'life', pinned: false, done: false }
  ].map(normalizeTask);
  let state = { schema: SCHEMA, tasks: examples(), archive: [], settings: { ...defaults }, day: dayKey() };
  let filter = 'all', editing = null, toastTimer, undoAction = null, busy = false, storageOK = true, persisted = false, pendingImport = null, installPrompt = null;

  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function newId() { return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
  // One validator for stored data, imported backups and native-app exports.
  function normalizeTask(t) {
    if (!t || typeof t.id !== 'string' || !t.id || typeof t.title !== 'string' || !t.title.trim()) return null;
    return { id: t.id.slice(0, 80), title: t.title.trim().slice(0, 120), group: groups[t.group] ? t.group : 'work', pinned: !!t.pinned, done: !!t.done, completedAt: Number.isFinite(t.completedAt) ? t.completedAt : 0, repeat: repeats[t.repeat] ? t.repeat : 'none', createdAt: Number.isFinite(t.createdAt) ? t.createdAt : 0 };
  }
  function normalizeArchived(t) {
    const task = normalizeTask(t);
    return task && { ...task, done: true, archivedAt: Number.isFinite(t.archivedAt) ? t.archivedAt : Date.now() };
  }
  function uniqueTasks(list, normalizer = normalizeTask) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).map(normalizer).filter(t => t && !ids.has(t.id) && ids.add(t.id));
  }
  function cleanSettings(raw) {
    const s = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
    if (!palette[s.accent]) s.accent = defaults.accent;
    if (!['compact', 'comfortable'].includes(s.density)) s.density = defaults.density;
    if (!['lake', 'mono', 'custom'].includes(s.wallpaper)) s.wallpaper = 'lake';
    if (typeof s.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(s.photo)) s.photo = '';
    if (s.wallpaper === 'custom' && !s.photo) s.wallpaper = 'lake';
    s.intensity = Math.min(3, Math.max(1, Number(s.intensity) || 2));
    if (!['frosted', 'glass', 'flat'].includes(s.cardMaterial)) s.cardMaterial = defaults.cardMaterial;
    if (typeof s.cardColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.cardColor)) s.cardColor = defaults.cardColor;
    if (!['auto', 'light', 'dark'].includes(s.cardText)) s.cardText = 'auto';
    s.cardTransparency = Math.min(90, Math.max(0, Number(s.cardTransparency) || 0));
    ['motion', 'autoArchive', 'lockNotify', 'lockScreen', 'installDismissed', 'androidSetupSeen'].forEach(k => { s[k] = !!s[k]; });
    return s;
  }
  function applySaved(saved) {
    if (!saved || !Array.isArray(saved.tasks)) return false;
    state.tasks = uniqueTasks(saved.tasks);
    state.archive = uniqueTasks(saved.archive, normalizeArchived).slice(-ARCHIVE_LIMIT);
    state.settings = cleanSettings(saved.settings);
    // Records from schema 1 have no day marker: treat them as today so nothing is archived on upgrade.
    state.day = typeof saved.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.day) ? saved.day : dayKey();
    return true;
  }
  // Android app shell (android/): the native side keeps a copy for the lock-screen card and may change it
  // (a "完成" tap on the lock screen). The wallpaper photo stays in localStorage only.
  const ANDROID = window.SuiSuiAndroid || null;
  let lastNativeRaw = '';
  function readNative() { try { return ANDROID ? ANDROID.load() || '' : ''; } catch { return ''; } }
  let hadSaved = false;
  try {
    const local = JSON.parse(localStorage.getItem(STORE) || 'null');
    const nativeRaw = readNative();
    const native = nativeRaw ? JSON.parse(nativeRaw) : null;
    if (native && Array.isArray(native.tasks)) {
      lastNativeRaw = nativeRaw;
      native.settings = { ...(native.settings || {}), photo: local?.settings?.photo || '' };
      hadSaved = applySaved(native);
    } else hadSaved = applySaved(local);
  } catch { storageOK = false; }
  // On Android the lock-screen card is the main feature, so it starts switched on.
  if (ANDROID && !hadSaved) { state.settings.lockNotify = true; state.settings.lockScreen = true; }
  let LOCK_MODE = false;
  try { LOCK_MODE = !!ANDROID && (ANDROID.isLockMode() || new URLSearchParams(location.search).get('mode') === 'lock'); } catch { LOCK_MODE = false; }

  function icon(name, attrs = '') { return `<i data-lucide="${name}" ${attrs}></i>`; }
  function icons(root = document) { window.lucide.createIcons({ root, attrs: { 'aria-hidden': 'true' } }); }
  function esc(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function storageCopy() { return storageOK ? (persisted ? '保存在本机 · 已开启长期保存' : '保存在本机') : '未能保存，请先导出备份'; }
  function save() {
    state.schema = SCHEMA;
    try { localStorage.setItem(STORE, JSON.stringify(state)); storageOK = true; }
    catch { storageOK = false; }
    if (ANDROID) {
      try { lastNativeRaw = JSON.stringify({ ...state, settings: { ...state.settings, photo: '' } }); ANDROID.save(lastNativeRaw); } catch { /* bridge unavailable */ }
    }
    $('storage-status').textContent = storageCopy();
    scheduleLockNotification();
  }
  // Called by the Android shell when the lock-screen card changed the data (or on resume).
  window.suisuiNativeChanged = () => {
    if (!ANDROID || busy) return;
    const raw = readNative();
    if (!raw || raw === lastNativeRaw) return;
    try {
      const native = JSON.parse(raw);
      native.settings = { ...(native.settings || {}), photo: state.settings.photo };
      if (!applySaved(native)) return;
      lastNativeRaw = raw;
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
      editing = null; render(); applySettings();
    } catch { /* ignore malformed */ }
  };
  function pending() { return state.tasks.filter(t => !t.done).sort((a, b) => Number(b.pinned) - Number(a.pinned)); }
  function setView(view) {
    if (!['tasks', 'preview', 'settings'].includes(view)) view = 'preview';
    document.body.dataset.view = view;
    document.querySelectorAll('.nav-button[data-view]').forEach(b => { b.classList.toggle('selected', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    const settings = view === 'settings';
    $('settings-panel').hidden = !settings;
    $('tasks-panel').hidden = settings;
    if (matchMedia('(max-width:760px)').matches) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function showToast(message, undo = null) {
    clearTimeout(toastTimer);
    undoAction = undo;
    $('toast-message').textContent = message;
    $('undo-button').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(hideToast, undo ? 8000 : 4500);
  }
  function hideToast() { $('toast').hidden = true; clearTimeout(toastTimer); undoAction = null; }
  function groupOptions(selected) { return Object.entries(groups).map(([v, l]) => `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`).join(''); }
  function repeatOptions(selected) { return Object.entries(repeats).map(([v, l]) => `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`).join(''); }
  function row(t) {
    if (editing === t.id) return `<form class="edit-form" data-edit-id="${esc(t.id)}"><label class="sr-only" for="edit-title">编辑待办</label><input id="edit-title" name="title" value="${esc(t.title)}" maxlength="120" required><div class="edit-controls"><select name="group" aria-label="分组">${groupOptions(t.group)}</select><select name="repeat" aria-label="重复">${repeatOptions(t.repeat)}</select><button type="button" class="text-button" data-action="delete" data-id="${esc(t.id)}">删除</button><button type="button" class="text-button" data-action="cancel-edit">取消</button><button class="primary-button">保存</button></div></form>`;
    return `<div class="task-row" data-task-id="${esc(t.id)}"><button class="check-task" data-action="complete" data-id="${esc(t.id)}" aria-label="完成：${esc(t.title)}"><span class="check-circle"></span></button><div class="task-body"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="dot ${t.group}-dot"></span>${groups[t.group]}${t.repeat === 'daily' ? `<span class="meta-flag">${icon('repeat')}每天</span>` : ''}${t.pinned ? `<span class="meta-flag">${icon('pin')}置顶</span>` : ''}</div></div><div class="task-actions"><button class="icon-button ${t.pinned ? 'pinned' : ''}" data-action="pin" data-id="${esc(t.id)}" aria-label="${t.pinned ? '取消置顶' : '置顶'}：${esc(t.title)}" title="${t.pinned ? '取消置顶' : '置顶'}">${icon('pin')}</button><button class="icon-button" data-action="edit" data-id="${esc(t.id)}" aria-label="编辑：${esc(t.title)}" title="编辑">${icon('pencil')}</button></div></div>`;
  }
  function render() {
    const todo = pending(), done = state.tasks.filter(t => t.done).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    const visible = todo.filter(t => filter === 'all' || t.group === filter);
    $('progress-copy').textContent = todo.length ? `还有 ${todo.length} 件事，完成了 ${done.length} 件。` : (done.length ? `今天的 ${done.length} 件事，都完成了。` : '给今天留下一件想做的事。');
    ['all', 'work', 'life'].forEach(g => { $(`count-${g}`).textContent = todo.filter(t => g === 'all' || t.group === g).length; });
    $('pending-count').textContent = String(visible.length);
    document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b.dataset.filter === filter); b.setAttribute('aria-pressed', String(b.dataset.filter === filter)); });
    $('task-list').innerHTML = visible.length ? visible.map(row).join('') : `<div class="empty-state">${icon(todo.length ? 'list-filter' : 'circle-check')}<span>${todo.length ? '这个分组暂时没有待办' : done.length ? '都完成了，给自己一点空白。' : '今天从一件小事开始。'}</span></div>`;
    $('done-count').textContent = String(done.length);
    $('clear-done').hidden = !done.length;
    $('completed-list').innerHTML = done.map(t => `<div class="done-row" data-completed-id="${esc(t.id)}">${icon('circle-check')}<s class="done-text completed-title">${esc(t.title)}</s>${t.repeat === 'daily' ? `<span class="done-flag" title="明天自动重新出现">${icon('repeat')}</span>` : ''}<button class="icon-button" data-action="restore" data-id="${esc(t.id)}" aria-label="恢复：${esc(t.title)}" title="恢复待办">${icon('rotate-ccw')}</button><button class="icon-button" data-action="delete" data-id="${esc(t.id)}" aria-label="删除：${esc(t.title)}" title="删除">${icon('trash-2')}</button></div>`).join('');
    renderArchive();
    renderPreview();
    icons();
    $('storage-status').textContent = storageCopy();
  }
  function renderArchive() {
    const items = [...state.archive].sort((a, b) => b.archivedAt - a.archivedAt);
    $('archive-section').hidden = !items.length;
    $('archive-count').textContent = String(items.length);
    const fmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
    $('archive-list').innerHTML = items.slice(0, 60).map(t => `<div class="done-row archive-row" data-archived-id="${esc(t.id)}">${icon('archive')}<s class="done-text">${esc(t.title)}</s><span class="archive-date">${fmt.format(t.completedAt || t.archivedAt)}</span><button class="icon-button" data-action="unarchive" data-id="${esc(t.id)}" aria-label="放回待办：${esc(t.title)}" title="放回待办">${icon('rotate-ccw')}</button></div>`).join('') + (items.length > 60 ? `<p class="archive-more">只显示最近 60 条，导出备份可查看全部 ${items.length} 条。</p>` : '');
  }
  function renderPreview() {
    const todo = pending(), done = state.tasks.filter(t => t.done).length;
    const list = $('activity-list'), scrollTop = list.scrollTop;
    const previewTasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.done ? (a.completedAt || 0) - (b.completedAt || 0) : Number(b.pinned) - Number(a.pinned)));
    const max = state.settings.density === 'compact' ? 4 : 3;
    $('activity').classList.toggle('compact', max === 4);
    $('activity-count').textContent = `${done}/${state.tasks.length}`;
    list.innerHTML = previewTasks.length ? previewTasks.map(t => `<button class="lock-task${t.done ? ' is-done' : ''}" data-action="${t.done ? 'restore' : 'complete'}" data-id="${esc(t.id)}" aria-label="${t.done ? '恢复' : '完成'}：${esc(t.title)}" aria-pressed="${t.done}"><span class="check-circle">${t.done ? icon('check') : ''}</span><span class="lock-task-label">${t.done ? `<s class="completed-title">${esc(t.title)}</s>` : esc(t.title)}</span></button>`).join('') : `<div class="lock-empty">${icon('circle-check')}<span>今天，留一点空白。</span></div>`;
    list.scrollTop = scrollTop;
    $('remaining-label').textContent = todo.length ? `剩余 ${todo.length} 项 · 已完成 ${done} 项` : (done ? `全部完成 · ${done} 项` : '暂无待办');
    $('preview-footer-copy').textContent = `碎碎清单 · ${todo.length} 项待完成`;
    document.querySelectorAll('[data-action="complete"]').forEach(b => { b.disabled = busy; });
    renderMiniPreview(previewTasks, max);
  }
  // Read-only copy of the card at the top of Settings, so appearance changes are visible while adjusting them.
  function renderMiniPreview(previewTasks, rows) {
    $('mini-card').classList.toggle('compact', rows === 4);
    $('mini-count').textContent = $('activity-count').textContent;
    $('mini-remaining').textContent = $('remaining-label').textContent;
    $('mini-list').innerHTML = previewTasks.length ? previewTasks.slice(0, rows).map(t => `<div class="mini-row${t.done ? ' is-done' : ''}"><span class="check-circle">${t.done ? icon('check') : ''}</span><span class="mini-row-label">${t.done ? `<s class="completed-title">${esc(t.title)}</s>` : esc(t.title)}</span></div>`).join('') : `<div class="lock-empty">${icon('circle-check')}<span>今天，留一点空白。</span></div>`;
  }
  function applySettings() {
    const s = state.settings, colors = palette[s.accent];
    document.documentElement.style.setProperty('--accent', colors[0]);
    document.documentElement.style.setProperty('--accent-soft', colors[1]);
    ['wallpaper', 'mini-wallpaper'].forEach(id => {
      const img = $(id), src = s.wallpaper === 'custom' && s.photo ? s.photo : 'assets/lake.jpg';
      if (img.getAttribute('src') !== src) img.src = src;
      img.classList.toggle('monochrome', s.wallpaper === 'mono');
    });
    document.querySelectorAll('[name="accent"]').forEach(i => { i.checked = i.value === s.accent; });
    document.querySelectorAll('[data-density]').forEach(b => { b.classList.toggle('active', b.dataset.density === s.density); b.setAttribute('aria-pressed', String(b.dataset.density === s.density)); });
    document.querySelectorAll('[data-wallpaper]').forEach(b => { b.classList.toggle('active', b.dataset.wallpaper === s.wallpaper); b.setAttribute('aria-pressed', String(b.dataset.wallpaper === s.wallpaper)); });
    $('motion-toggle').checked = !!s.motion;
    $('intensity').value = s.intensity;
    $('intensity-value').textContent = ['轻柔', '适中', '强烈'][s.intensity - 1];
    $('intensity').disabled = !s.motion;
    $('archive-toggle').checked = !!s.autoArchive;
    renderNotifySetting();
    applyCardAppearance();
    renderPreview();
    icons();
  }
  function applyCardAppearance() {
    const s = state.settings;
    const rgb = [1, 3, 5].map(i => parseInt(s.cardColor.slice(i, i + 2), 16));
    const opacity = 1 - s.cardTransparency / 100;
    // Color-based automatic contrast; the explicit text option covers unusual wallpapers.
    const luminance = values => values.reduce((sum, v, i) => sum + (v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i], 0);
    const lum = luminance(rgb);
    const contrast = ink => (Math.max(ink, lum) + .05) / (Math.min(ink, lum) + .05);
    const light = s.cardText === 'light' || (s.cardText === 'auto' && contrast(luminance([244, 251, 247])) >= contrast(luminance([24, 43, 34])));
    for (const card of [$('activity'), $('mini-card')]) {
      card.style.setProperty('--card-bg', `rgba(${rgb.join(',')},${opacity})`);
      card.style.setProperty('--card-blur', ({ frosted: '24px', glass: '7px', flat: '0px' })[s.cardMaterial]);
      card.style.setProperty('--card-saturate', ({ frosted: '.85', glass: '1.4', flat: '1' })[s.cardMaterial]);
      card.style.setProperty('--card-ink', light ? '#f4fbf7' : '#182b22');
      card.style.setProperty('--card-muted', light ? '#e0eae4' : '#30483b');
      card.style.setProperty('--card-rule', light ? '#d4eddf40' : '#183b2b30');
      card.style.setProperty('--card-check', light ? '#c6eed2' : '#275d42');
    }
    $('card-color').value = s.cardColor;
    $('card-color-value').textContent = s.cardColor.toUpperCase();
    $('card-transparency').value = s.cardTransparency;
    $('card-transparency-value').textContent = `${s.cardTransparency}%`;
    $('card-text').value = s.cardText;
    document.querySelectorAll('[data-material]').forEach(b => { b.classList.toggle('active', b.dataset.material === s.cardMaterial); b.setAttribute('aria-pressed', String(b.dataset.material === s.cardMaterial)); });
    document.querySelectorAll('[data-card-color]').forEach(b => { b.classList.toggle('active', b.dataset.cardColor.toLowerCase() === s.cardColor.toLowerCase()); b.setAttribute('aria-pressed', String(b.dataset.cardColor.toLowerCase() === s.cardColor.toLowerCase())); });
  }

  /* ---------- A new day: reset daily routines, archive yesterday's finished items ---------- */
  function rollover({ announce = true } = {}) {
    const today = dayKey();
    if (state.day === today || busy) return false;
    const cutoff = startOfToday();
    let reset = 0, archived = 0;
    const keep = [];
    for (const t of state.tasks) {
      if (t.done && t.repeat === 'daily') { t.done = false; t.completedAt = 0; reset++; keep.push(t); }
      else if (t.done && state.settings.autoArchive && (t.completedAt || 0) < cutoff) { state.archive.push({ ...t, archivedAt: Date.now() }); archived++; }
      else keep.push(t);
    }
    state.tasks = keep;
    state.archive = state.archive.slice(-ARCHIVE_LIMIT);
    state.day = today;
    save();
    if (announce && (reset || archived)) {
      render();
      showToast(`新的一天：${[archived && `${archived} 件已完成移入历史`, reset && `${reset} 件每日事项已重置`].filter(Boolean).join('，')}`);
    }
    return true;
  }
  function moveDoneToArchive() {
    const done = state.tasks.filter(t => t.done && t.repeat !== 'daily');
    if (!done.length) { showToast('每日事项会在明天自动重置，不需要清理'); return; }
    const before = { tasks: structuredClone(state.tasks), archive: structuredClone(state.archive) };
    const now = Date.now();
    state.archive.push(...done.map(t => ({ ...t, archivedAt: now })));
    state.archive = state.archive.slice(-ARCHIVE_LIMIT);
    state.tasks = state.tasks.filter(t => !done.includes(t));
    save(); render();
    showToast(`已把 ${done.length} 件移入历史`, () => { state.tasks = before.tasks; state.archive = before.archive; save(); render(); });
  }

  /* ---------- Lock-screen notification (web): the closest a home-screen web app gets to the lock screen ---------- */
  // Set by the embedded preview build (Claude artifact), where installing, notifications and downloads are unavailable.
  const PREVIEW = !!window.SUISUI_PREVIEW;
  const notifySupported = () => !PREVIEW && !ANDROID && 'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let notifyTimer = null, lastNotified = '';
  try { lastNotified = sessionStorage.getItem('suisui-last-notified') || ''; } catch { /* private mode */ }
  function notificationContent() {
    const todo = pending();
    if (!todo.length) return null;
    const lines = todo.slice(0, 6).map(t => `○ ${t.title}`);
    if (todo.length > 6) lines.push(`…还有 ${todo.length - 6} 件`);
    return { title: `今天还有 ${todo.length} 件待办`, body: lines.join('\n') };
  }
  async function updateLockNotification(force = false) {
    clearTimeout(notifyTimer);
    const pendingCount = pending().length;
    try { if ('setAppBadge' in navigator && state.settings.lockNotify) pendingCount ? await navigator.setAppBadge(pendingCount) : await navigator.clearAppBadge(); } catch { /* badge is optional */ }
    if (!state.settings.lockNotify || !notifySupported() || Notification.permission !== 'granted') return;
    const content = notificationContent();
    const signature = content ? `${content.title}|${content.body}` : '';
    if (!force && signature === lastNotified) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!content) (await registration.getNotifications({ tag: 'suisui-today' })).forEach(n => n.close());
      else await registration.showNotification(content.title, { body: content.body, tag: 'suisui-today', renotify: false, silent: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './?view=preview' } });
      lastNotified = signature;
      try { sessionStorage.setItem('suisui-last-notified', signature); } catch { /* ignore */ }
    } catch { /* notification refresh is best effort */ }
  }
  function scheduleLockNotification() {
    if (!state.settings.lockNotify) return;
    clearTimeout(notifyTimer);
    // Update while the app is hidden; when visible, wait so the banner does not compete with the user.
    notifyTimer = setTimeout(() => { if (document.visibilityState === 'hidden') updateLockNotification(); }, 400);
  }
  function renderNotifySetting() {
    const toggle = $('notify-toggle'), status = $('notify-status'), test = $('notify-test');
    toggle.checked = !!state.settings.lockNotify;
    let copy;
    if (ANDROID) {
      let allowed = false;
      try { allowed = ANDROID.notificationsAllowed(); } catch { /* ignore */ }
      toggle.disabled = false;
      test.hidden = !(state.settings.lockNotify && !allowed);
      test.lastChild.textContent = '打开通知权限';
      renderAndroidLock();
      status.textContent = !state.settings.lockNotify ? '开启后，锁屏上会常驻“今天的待办”卡片，每件都有“完成”按钮，亮屏直接点。'
        : allowed ? '已开启：锁屏上常驻今天的待办，点“✓”即可完成。若锁屏看不到，请在系统设置里允许碎碎清单在锁屏显示通知。'
        : '还没有通知权限，锁屏卡片无法显示。点下方按钮去开启。';
      return;
    }
    if (!notifySupported()) {
      toggle.disabled = true;
      copy = PREVIEW ? '这是预览页。用 iPhone Safari 打开正式网站并添加到主屏幕后可开启。' : isIOS() && !isStandalone() ? '需要先“添加到主屏幕”，再从桌面图标打开（iOS 16.4 及以上）。' : '当前浏览器不支持网页通知。';
    } else {
      toggle.disabled = false;
      const p = Notification.permission;
      if (p === 'denied') copy = '通知权限已被拒绝。请到系统设置 > 通知 > 碎碎清单 中打开。';
      else if (state.settings.lockNotify && p === 'granted') copy = '已开启。每次离开碎碎清单，锁屏通知会更新为最新的未完成事项；全部完成后自动移除。';
      else copy = '开启后，离开应用时把未完成事项放到锁屏通知里。点通知回到清单（通知里不能直接勾选）。';
    }
    status.textContent = copy;
    test.hidden = !(state.settings.lockNotify && notifySupported() && Notification.permission === 'granted');
  }
  function androidPermissions() {
    try { return JSON.parse(ANDROID.permissions()); } catch { return { notifications: false, overlay: false, lockScreenRunning: false, brand: '' }; }
  }
  function renderAndroidLock() {
    if (!ANDROID) return;
    const p = androidPermissions();
    $('android-lock-settings').hidden = false;
    $('lockscreen-toggle').checked = !!state.settings.lockScreen;
    $('lockscreen-status').textContent = !state.settings.lockScreen ? '开启后，熄屏再亮屏会先显示碎碎清单的锁屏：壁纸、时钟和待办，点圆圈完成，上滑进入手机。'
      : p.overlay && p.notifications ? '已开启。熄屏后再亮屏试试；若没出现，点“检查锁屏权限”，按品牌打开“锁屏显示”和“后台弹出界面”。'
      : '还差权限：点“检查锁屏权限”，按提示打开。';
    const steps = { notify: p.notifications, overlay: p.overlay };
    Object.entries(steps).forEach(([key, ok]) => {
      const li = $(`setup-${key}`);
      li.classList.toggle('done', !!ok);
      li.querySelector('button').textContent = ok ? '已开启' : '去开启';
      li.querySelector('button').disabled = !!ok;
    });
  }
  function openAndroidSetup() { renderAndroidLock(); $('android-setup').showModal(); icons($('android-setup')); }
  async function enableLockNotify(on) {
    if (ANDROID) {
      state.settings.lockNotify = on; save(); renderNotifySetting();
      if (on) { try { ANDROID.requestNotificationPermission(); } catch { /* ignore */ } }
      showToast(on ? '已开启锁屏待办卡片' : '已关闭锁屏待办卡片');
      return;
    }
    if (!on) {
      state.settings.lockNotify = false; save();
      try { (await (await navigator.serviceWorker.ready).getNotifications({ tag: 'suisui-today' })).forEach(n => n.close()); await navigator.clearAppBadge?.(); } catch { /* ignore */ }
      renderNotifySetting(); return;
    }
    if (!notifySupported()) { renderNotifySetting(); return; }
    let permission = Notification.permission;
    if (permission === 'default') { try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; } }
    state.settings.lockNotify = permission === 'granted';
    save(); renderNotifySetting();
    if (state.settings.lockNotify) { lastNotified = ''; showToast('已开启锁屏通知，离开应用后生效'); }
    else showToast('没有获得通知权限');
  }

  /* ---------- Backup: export and import (also accepts the native app's export) ---------- */
  function backupPayload() {
    const { photo, ...settings } = state.settings;
    return { app: 'suisui', version: SCHEMA, exportedAt: new Date().toISOString(), tasks: state.tasks, archive: state.archive, settings };
  }
  async function exportBackup() {
    if (PREVIEW) { showToast('预览页不能下载文件，请在正式网站导出'); return; }
    if (ANDROID) { try { ANDROID.exportBackup(JSON.stringify(backupPayload(), null, 2), `suisui-backup-${dayKey()}.json`); } catch { showToast('导出失败，请重试'); } return; }
    const name = `suisui-backup-${dayKey()}.json`;
    const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (isIOS() && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '碎碎清单备份' }); showToast('已生成备份，可存到“文件”'); return; }
    } catch (error) { if (error?.name === 'AbortError') return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('已导出待办备份');
  }
  function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('这个文件不是有效的 JSON 备份。'); }
    const list = Array.isArray(data) ? data : data?.tasks;
    if (!Array.isArray(list)) throw new Error('没有在文件里找到待办列表。');
    const tasks = uniqueTasks(list);
    const archive = uniqueTasks(data?.archive, normalizeArchived);
    if (!tasks.length && !archive.length) throw new Error('文件里没有可导入的待办。');
    return { tasks, archive, settings: data?.settings && typeof data.settings === 'object' ? data.settings : null };
  }
  function openImport(file) {
    $('import-error').textContent = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('备份文件过大（超过 2MB）'); return; }
    file.text().then(text => {
      pendingImport = parseBackup(text);
      const ids = new Set(state.tasks.map(t => t.id));
      const fresh = pendingImport.tasks.filter(t => !ids.has(t.id)).length;
      $('import-summary').textContent = `备份里有 ${pendingImport.tasks.length} 件待办${pendingImport.archive.length ? `、${pendingImport.archive.length} 条历史` : ''}。合并会加入其中 ${fresh} 件新的事项；替换会用备份覆盖当前清单。`;
      $('import-settings-row').hidden = !pendingImport.settings;
      $('import-settings').checked = false;
      $('import-dialog').showModal();
    }).catch(error => showToast(error.message || '未能读取这个文件'));
  }
  function applyImport(mode) {
    if (!pendingImport) return;
    const before = structuredClone(state);
    if (mode === 'replace') {
      state.tasks = pendingImport.tasks;
      state.archive = pendingImport.archive.slice(-ARCHIVE_LIMIT);
    } else {
      const ids = new Set(state.tasks.map(t => t.id));
      state.tasks.push(...pendingImport.tasks.filter(t => !ids.has(t.id)));
      const archived = new Set(state.archive.map(t => t.id));
      state.archive = [...state.archive, ...pendingImport.archive.filter(t => !archived.has(t.id) && !ids.has(t.id))].slice(-ARCHIVE_LIMIT);
    }
    if ($('import-settings').checked && pendingImport.settings) state.settings = cleanSettings({ ...pendingImport.settings, photo: state.settings.photo, wallpaper: pendingImport.settings.wallpaper === 'custom' ? state.settings.wallpaper : pendingImport.settings.wallpaper });
    pendingImport = null; filter = 'all'; editing = null;
    $('import-dialog').close();
    save(); render(); applySettings();
    showToast(mode === 'replace' ? '已用备份替换清单' : '已合并备份', () => { state = before; save(); render(); applySettings(); });
  }

  /* ---------- Install guidance: the web app only becomes durable and notifiable from the Home Screen ---------- */
  function renderInstallBanner() {
    const show = !PREVIEW && !ANDROID && !state.settings.installDismissed && !isStandalone() && (isIOS() || !!installPrompt);
    $('install-banner').hidden = !show;
    $('install-native').hidden = !installPrompt;
    $('install-howto').hidden = !!installPrompt;
  }

  async function shatter(source) {
    if (!state.settings.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = source.getBoundingClientRect(), isLock = source.classList.contains('lock-task');
    const textNode = source.querySelector(isLock ? 'span:last-child' : '.task-title');
    const textRect = textNode.getBoundingClientRect(), style = getComputedStyle(textNode);
    const layer = $('fragments'), pieces = [], cols = 10, rows = 3;
    const strength = [.7, 1, 1.5][state.settings.intensity - 1];
    const cw = rect.width / cols, ch = rect.height / rows;
    // Each triangle carries the corresponding text slice, so the task itself breaks apart.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        for (let tri = 0; tri < 2; tri++) {
          const p = document.createElement('div');
          p.className = 'shard';
          Object.assign(p.style, { left: `${rect.left + x * cw}px`, top: `${rect.top + y * ch}px`, width: `${cw + .5}px`, height: `${ch + .5}px`, clipPath: tri ? 'polygon(100% 0,100% 100%,0 100%)' : 'polygon(0 0,100% 0,0 100%)' });
          const fill = document.createElement('div');
          fill.className = 'shard-surface';
          fill.style.background = isLock ? 'rgba(159,225,180,.38)' : 'rgba(19,118,91,.18)';
          const text = document.createElement('span');
          text.className = 'shard-text';
          text.textContent = textNode.textContent;
          Object.assign(text.style, { left: `${textRect.left - rect.left - x * cw}px`, top: `${textRect.top - rect.top - y * ch}px`, width: `${textRect.width}px`, font: style.font, lineHeight: style.lineHeight, color: style.color, whiteSpace: isLock ? 'nowrap' : 'normal', overflowWrap: 'anywhere' });
          p.append(fill, text); layer.append(p); pieces.push(p);
          const dx = (x / (cols - 1) - .5) * (130 + Math.random() * 95) * strength;
          const dy = ((y - 1) * 44 - 35 - Math.random() * 45) * strength;
          window.anime.animate(p, { x: [0, dx], y: [0, dy], rotate: [0, (Math.random() - .5) * 140], scale: [1, .3], duration: 780 + Math.random() * 180, delay: Math.abs(x - 4.5) * 11, ease: 'outExpo' });
          window.anime.animate(p, { opacity: [1, 0], delay: 140, duration: 700, ease: 'inQuad', onComplete: () => p.remove() });
        }
      }
    }
    source.style.visibility = 'hidden';
    await new Promise(resolve => setTimeout(resolve, 520));
  }
  async function complete(id, button) {
    if (busy) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.done) return;
    const positions = new Map();
    const positionKey = el => `${el.classList.contains('lock-task') ? 'preview' : 'editor'}:${el.dataset.taskId || el.dataset.id}`;
    document.querySelectorAll('.task-row, .lock-task').forEach(el => positions.set(positionKey(el), el.getBoundingClientRect().top));
    busy = true;
    document.querySelectorAll('[data-action="complete"]').forEach(b => { b.disabled = true; });
    const source = button.classList.contains('lock-task') ? button : button.closest('.task-row');
    let animationError = false;
    try { await shatter(source); } catch { animationError = true; }
    task.done = true;
    task.completedAt = Math.max(Date.now(), ...state.tasks.map(t => (t.completedAt || 0) + 1));
    busy = false; editing = null; save(); render();
    $('completed-section').open = true;
    if (state.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.task-row, .lock-task').forEach(el => {
        const oldTop = positions.get(positionKey(el));
        if (oldTop !== undefined) {
          const dy = oldTop - el.getBoundingClientRect().top;
          if (Math.abs(dy) > 1) window.anime.animate(el, { y: [dy, 0], duration: 370, ease: 'outExpo' });
        }
      });
      document.querySelectorAll('.done-row, .lock-task.is-done').forEach(el => {
        if ((el.dataset.completedId || el.dataset.id) !== id) return;
        el.classList.add('completion-arrival');
        const target = el.classList.contains('lock-task') ? el : el.querySelector('.done-text');
        window.anime.animate(el, { '--strike-progress': [0, 1], duration: 420, ease: 'outCubic', onComplete: () => { el.classList.remove('completion-arrival'); el.style.removeProperty('--strike-progress'); } });
        window.anime.animate(target, { opacity: [1, .5], duration: 460, ease: 'outQuad' });
      });
    }
    $('completion-note').textContent = pending().length ? '又完成一件。' : '今天的事，圆满完成。';
    setTimeout(() => { $('completion-note').textContent = ''; }, 2400);
    showToast('已完成一项待办', () => { task.done = false; save(); render(); });
    const next = button.classList.contains('lock-task') ? $('activity-list').querySelector('[data-action="complete"]') || $('activity-list').querySelector('button') : $('task-list').querySelector('[data-action="complete"]');
    if (next) next.focus({ preventScroll: true });
    if (animationError) console.warn('Animation unavailable; task completed without animation.');
    requestPersistence();
  }
  async function requestPersistence() {
    try {
      if (!navigator.storage?.persist) return;
      persisted = await navigator.storage.persisted() || await navigator.storage.persist();
      $('storage-status').textContent = storageCopy();
    } catch { /* optional */ }
  }

  document.addEventListener('click', (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    if (busy && (b.dataset.action || b.dataset.filter || b.dataset.density || b.dataset.wallpaper || b.id === 'reset-button')) return;
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.filter) { filter = b.dataset.filter; editing = null; render(); }
    if (b.dataset.density) { state.settings.density = b.dataset.density; save(); applySettings(); }
    if (b.dataset.wallpaper) { state.settings.wallpaper = b.dataset.wallpaper; save(); applySettings(); }
    if (b.dataset.material) { state.settings.cardMaterial = b.dataset.material; save(); applyCardAppearance(); }
    if (b.dataset.cardColor) { state.settings.cardColor = b.dataset.cardColor; save(); applyCardAppearance(); }
    const id = b.dataset.id, task = state.tasks.find(t => t.id === id);
    switch (b.dataset.action) {
      case 'complete': complete(id, b); break;
      case 'pin': if (task) { task.pinned = !task.pinned; save(); render(); } break;
      case 'edit': editing = id; render(); $('edit-title')?.focus(); break;
      case 'cancel-edit': editing = null; render(); break;
      case 'restore': if (task) { task.done = false; save(); render(); const restored = [...$('activity-list').querySelectorAll('button')].find(el => el.dataset.id === id); if (b.classList.contains('lock-task')) restored?.focus({ preventScroll: true }); showToast('已恢复到待完成'); } break;
      case 'delete': if (task) { const index = state.tasks.indexOf(task); state.tasks.splice(index, 1); editing = null; save(); render(); showToast('已删除待办', () => { state.tasks.splice(index, 0, task); save(); render(); }); } break;
      case 'unarchive': {
        const index = state.archive.findIndex(t => t.id === id);
        if (index < 0) break;
        const [item] = state.archive.splice(index, 1);
        const { archivedAt, ...restored } = item;
        if (state.tasks.some(t => t.id === restored.id)) restored.id = newId();
        state.tasks.push({ ...restored, done: false, completedAt: 0 });
        save(); render(); showToast('已放回待完成');
        break;
      }
    }
  });
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    const title = $('task-input').value.trim();
    if (!title) { $('form-error').textContent = '请先写下待办内容。'; return; }
    state.tasks.push({ id: newId(), title: title.slice(0, 120), group: $('task-group').value, pinned: false, done: false, completedAt: 0, repeat: $('task-repeat').value === 'daily' ? 'daily' : 'none', createdAt: Date.now() });
    filter = 'all'; $('task-input').value = ''; $('form-error').textContent = '';
    save(); render(); $('task-input').focus(); showToast('待办已添加');
    requestPersistence();
  });
  $('task-list').addEventListener('submit', event => {
    if (!event.target.matches('.edit-form')) return;
    event.preventDefault();
    const task = state.tasks.find(t => t.id === event.target.dataset.editId);
    const data = new FormData(event.target), title = String(data.get('title')).trim();
    if (!task || !title) return;
    task.title = title.slice(0, 120); task.group = groups[data.get('group')] ? data.get('group') : 'work'; task.repeat = data.get('repeat') === 'daily' ? 'daily' : 'none'; editing = null;
    save(); render(); showToast('已保存修改');
  });
  $('undo-button').addEventListener('click', () => { const action = undoAction; hideToast(); action?.(); });
  $('close-toast').addEventListener('click', hideToast);
  ['add-top', 'see-all', 'preview-list-button'].forEach(id => $(id).addEventListener('click', () => { setView('tasks'); if (id === 'add-top') $('task-input').focus(); }));
  const openAbout = () => $('about-dialog').showModal();
  $('about-button').addEventListener('click', openAbout);
  $('header-about').addEventListener('click', openAbout);
  $('close-about').addEventListener('click', () => $('about-dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog && (event.offsetX < 0 || event.offsetY < 0 || event.offsetX > dialog.offsetWidth || event.offsetY > dialog.offsetHeight)) dialog.close(); }));
  document.querySelectorAll('[name="accent"]').forEach(input => input.addEventListener('change', () => { state.settings.accent = input.value; save(); applySettings(); }));
  $('motion-toggle').addEventListener('change', () => { state.settings.motion = $('motion-toggle').checked; save(); applySettings(); });
  $('intensity').addEventListener('input', () => { state.settings.intensity = Number($('intensity').value); save(); applySettings(); });
  $('card-color').addEventListener('input', () => { state.settings.cardColor = $('card-color').value; applyCardAppearance(); save(); });
  $('card-transparency').addEventListener('input', () => { state.settings.cardTransparency = Number($('card-transparency').value); applyCardAppearance(); save(); });
  $('card-text').addEventListener('change', () => { state.settings.cardText = $('card-text').value; applyCardAppearance(); save(); });
  $('archive-toggle').addEventListener('change', () => { state.settings.autoArchive = $('archive-toggle').checked; save(); });
  $('notify-toggle').addEventListener('change', () => enableLockNotify($('notify-toggle').checked));
  if (ANDROID) {
    $('lockscreen-toggle').addEventListener('change', () => {
      state.settings.lockScreen = $('lockscreen-toggle').checked; save(); renderAndroidLock();
      if (state.settings.lockScreen) { const p = androidPermissions(); if (!p.overlay || !p.notifications) openAndroidSetup(); else showToast('已开启锁屏显示，熄屏后再亮屏看看'); }
      else showToast('已关闭锁屏显示');
    });
    $('open-android-setup').addEventListener('click', openAndroidSetup);
    $('close-android-setup').addEventListener('click', () => $('android-setup').close());
    $('finish-android-setup').addEventListener('click', () => { state.settings.androidSetupSeen = true; save(); $('android-setup').close(); showToast('设置好了，熄屏后再亮屏看看'); });
    $('android-setup').addEventListener('click', event => {
      const step = event.target.closest('[data-setup]')?.dataset.setup;
      try {
        if (step === 'notify') ANDROID.requestNotificationPermission();
        if (step === 'overlay') ANDROID.openOverlaySettings();
        if (step === 'brand') ANDROID.openAppPermissions();
      } catch { /* ignore */ }
    });
    window.suisuiAndroidResume = () => { renderNotifySetting(); save(); };
  }
  window.suisuiAndroidPermission = granted => { renderNotifySetting(); if (!granted && state.settings.lockNotify) showToast('没有通知权限，锁屏卡片无法显示'); };
  window.suisuiExportDone = ok => showToast(ok ? '已导出待办备份' : '没有导出');
  $('notify-test').addEventListener('click', () => {
    if (ANDROID) { try { ANDROID.openNotificationSettings(); } catch { /* ignore */ } return; } updateLockNotification(true); showToast(pending().length ? '已刷新锁屏通知，锁屏即可看到' : '全部完成，没有需要提醒的事项'); });
  $('reset-settings').addEventListener('click', () => {
    const { autoArchive, lockNotify, installDismissed } = state.settings;
    state.settings = { ...defaults, autoArchive, lockNotify, installDismissed }; save(); applySettings(); showToast('已恢复默认外观');
  });
  $('wallpaper-file').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    $('wallpaper-error').textContent = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { $('wallpaper-error').textContent = '请选择 3MB 以内的 JPG、PNG 或 WebP 图片。'; return; }
    const reader = new FileReader();
    reader.onload = () => { state.settings.photo = reader.result; state.settings.wallpaper = 'custom'; save(); applySettings(); if (!storageOK) $('wallpaper-error').textContent = '图片太大，本机存储放不下，请换一张小一些的照片。'; };
    reader.onerror = () => { $('wallpaper-error').textContent = '未能读取这张图片，请重新选择。'; };
    reader.readAsDataURL(file);
    event.target.value = '';
  });
  $('reset-button').addEventListener('click', () => {
    const previous = structuredClone(state.tasks);
    state.tasks = examples(); editing = null; filter = 'all'; save(); render();
    showToast('已恢复示例清单', () => { state.tasks = previous; save(); render(); });
  });
  $('clear-done').addEventListener('click', moveDoneToArchive);
  $('export-button').addEventListener('click', exportBackup);
  $('settings-export').addEventListener('click', exportBackup);
  ['import-button', 'settings-import'].forEach(id => $(id).addEventListener('click', () => $('import-file').click()));
  $('import-file').addEventListener('change', event => { openImport(event.target.files[0]); event.target.value = ''; });
  $('import-merge').addEventListener('click', () => applyImport('merge'));
  $('import-replace').addEventListener('click', () => applyImport('replace'));
  $('import-cancel').addEventListener('click', () => { pendingImport = null; $('import-dialog').close(); });
  $('install-howto').addEventListener('click', () => $('install-dialog').showModal());
  $('install-native').addEventListener('click', async () => { const prompt = installPrompt; installPrompt = null; renderInstallBanner(); try { await prompt?.prompt(); } catch { /* dismissed */ } });
  $('install-later').addEventListener('click', () => { state.settings.installDismissed = true; save(); renderInstallBanner(); });
  $('close-install').addEventListener('click', () => $('install-dialog').close());
  $('settings-install').addEventListener('click', () => $('install-dialog').showModal());
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; renderInstallBanner(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; renderInstallBanner(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') updateLockNotification();
    else { clock(); renderNotifySetting(); }
  });
  window.addEventListener('pagehide', () => updateLockNotification());
  function clock() {
    const date = new Date();
    $('header-date').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date);
    $('lock-date').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date);
    $('lock-time').textContent = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (rollover()) render();
  }
  // Lock mode (Android LockActivity): only the designed lock screen, over the system lock screen.
  if (LOCK_MODE) {
    document.body.classList.add('lock-mode');
    $('lock-exit').hidden = false;
    const leave = openApp => { try { ANDROID.unlock(openApp); } catch { /* ignore */ } };
    $('lock-exit').addEventListener('click', () => leave(false));
    ['see-all', 'preview-list-button'].forEach(id => $(id).addEventListener('click', event => { event.stopImmediatePropagation(); leave(true); }, true));
    let startY = null;
    $('lockscreen').addEventListener('touchstart', event => { startY = event.target.closest('#activity') ? null : event.touches[0].clientY; }, { passive: true });
    $('lockscreen').addEventListener('touchend', event => { if (startY !== null && startY - event.changedTouches[0].clientY > 90) leave(false); startY = null; });
    window.suisuiLockShown = () => { $('activity-list').scrollTop = 0; clock(); };
  }
  const initialView = LOCK_MODE ? 'preview' : new URLSearchParams(location.search).get('view');
  rollover({ announce: false });
  setView(initialView || 'preview'); render(); applySettings(); clock(); save(); renderInstallBanner();
  if (ANDROID && !LOCK_MODE && state.settings.lockScreen && !state.settings.androidSetupSeen) setTimeout(openAndroidSetup, 600);
  if (isStandalone()) requestPersistence();
  else navigator.storage?.persisted?.().then(value => { persisted = value; $('storage-status').textContent = storageCopy(); }).catch(() => {});
  setInterval(clock, 30000);
  // Test and support hook: lets automated checks and support staff inspect the state without touching storage.
  window.suisui = { dayKey, rollover: () => rollover(), notificationContent, version: SCHEMA };
})();
