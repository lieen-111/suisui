(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  // Keep the original key so existing users keep their data; the record carries its own schema number.
  const STORE = 'suisui-locktodo-v1';
  // The wallpaper photo lives under its own key: a large photo must never stop the to-dos and settings from saving.
  const PHOTO_KEY = 'suisui-wallpaper-photo';
  const SCHEMA = 2;
  const ARCHIVE_LIMIT = 300;
  const DEFAULT_GROUPS = [{ id: 'work', name: '工作', color: '#13765b' }, { id: 'life', name: '生活', color: '#b14c6b' }];
  const GROUP_COLORS = ['#13765b', '#b14c6b', '#226a9a', '#b7791f', '#6b5ca5', '#4a5a55'];
  const repeats = { none: '不重复', daily: '每天', weekdays: '工作日', weekly: '每周' };
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  // [fill, soft background, text on dark, soft background on dark]
  const palette = { green: ['#13765b', '#e9f3ee', '#5cc59c', '#1a362c'], rose: ['#b14c6b', '#f9edf1', '#e78ea9', '#3a2430'], blue: ['#226a9a', '#eaf2f8', '#78b6e2', '#1b3142'] };
  const darkScheme = matchMedia('(prefers-color-scheme: dark)');
  // One-tap looks; the detailed controls stay under “更多外观设置”.
  const THEMES = {
    pine: { name: '松林', cardColor: '#112b24', cardMaterial: 'frosted', cardTransparency: 15, cardText: 'auto', accent: 'green' },
    graphite: { name: '石墨', cardColor: '#202326', cardMaterial: 'frosted', cardTransparency: 22, cardText: 'auto', accent: 'blue' },
    mist: { name: '雾白', cardColor: '#f5f7f3', cardMaterial: 'glass', cardTransparency: 28, cardText: 'auto', accent: 'green' },
    lake: { name: '湖蓝', cardColor: '#294c64', cardMaterial: 'frosted', cardTransparency: 18, cardText: 'auto', accent: 'blue' },
    plum: { name: '梅紫', cardColor: '#563746', cardMaterial: 'frosted', cardTransparency: 18, cardText: 'auto', accent: 'rose' }
  };
  // Built-in wallpaper library (scripts/make-wallpapers.py makes the generated ones). "system" = the phone's own wallpaper (Android app).
  const WALLPAPERS = [
    { id: 'lake', name: '湖畔', src: 'assets/lake.jpg', thumb: 'assets/lake.jpg', pos: '52% 82%' },
    { id: 'mono', name: '黑白', src: 'assets/lake.jpg', thumb: 'assets/lake.jpg', pos: '52% 82%', mono: true },
    ...[['mist', '晨雾'], ['dusk', '暮山'], ['forest', '深林'], ['sea', '海面'], ['night', '月夜'], ['aurora', '极光'], ['dunes', '沙丘'], ['pine', '松绿']]
      .map(([id, name]) => ({ id, name, src: `assets/wallpapers/${id}.jpg`, thumb: `assets/wallpapers/${id}-thumb.jpg`, pos: '50% 60%' }))
  ];
  const wallpaperOf = id => WALLPAPERS.find(w => w.id === id) || WALLPAPERS[0];
  const FONTS = { system: '默认', song: '宋体', kai: '楷体', round: '圆体' };
  const TEXT_SIZES = [['小', .9], ['标准', 1], ['大', 1.12], ['特大', 1.26]];
  const defaults = { font: 'system', textSize: 1, tipsSeen: false, wallpaperPicked: false, accent: 'green', density: 'comfortable', wallpaper: 'lake', photo: '', motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, intensity: 2, cardMaterial: 'frosted', cardColor: '#112b24', cardTransparency: 15, cardText: 'auto', autoArchive: true, lockNotify: false, lockScreen: false, lockPrivacy: false, installDismissed: false, androidSetupSeen: false };
  const examples = () => [
    { id: 'seed-1', title: '把锁屏待办的想法做出来', group: 'work', pinned: true },
    { id: 'seed-2', title: '整理今天的拍摄素材', group: 'work' },
    { id: 'seed-3', title: '给家里打个电话', group: 'life' },
    { id: 'seed-4', title: '出门走走，至少二十分钟', group: 'life', repeat: 'daily' },
    { id: 'seed-5', title: '把下周的选题记下来', group: 'work' },
    { id: 'seed-6', title: '读完床头的那一章', group: 'life' }
  ].map(normalizeTask);
  // First use starts empty. The sample list exists only for automated checks and demos (window.SUISUI_DEMO).
  const DEMO = !!window.SUISUI_DEMO;
  const LOG_LIMIT = 3000;
  let state = { schema: SCHEMA, rev: 0, tasks: DEMO ? examples() : [], archive: [], groups: structuredClone(DEFAULT_GROUPS), settings: { ...defaults }, day: dayKey(), log: [], timer: null };
  let filter = 'all', editing = null, settingsPage = 'index', toastTimer, undoAction = null, storageOK = true, persisted = false, pendingImport = null, installPrompt = null;
  // Tasks whose shatter animation is still playing. Other tasks stay tappable meanwhile.
  const completing = new Set();
  const isBusy = () => completing.size > 0;

  /* ---------- Dates ---------- */
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function addDays(key, n) { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); }
  function weekday(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function newId(prefix = 't') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
  function isDayKey(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
  function dateLabel(key) {
    const today = dayKey();
    if (key === today) return '今天';
    if (key === addDays(today, 1)) return '明天';
    const [, m, d] = key.split('-').map(Number);
    return `${m}月${d}日 ${WEEK[weekday(key)]}`;
  }
  /** Is this task on today's list? Undated one-off tasks always are; overdue ones too. */
  function dueToday(t, today = dayKey()) {
    const w = weekday(today);
    if (t.repeat === 'daily') return true;
    if (t.repeat === 'weekdays') return w >= 1 && w <= 5;
    if (t.repeat === 'weekly') return w === (Number.isInteger(t.repeatDay) ? t.repeatDay : w);
    return !t.date || t.date <= today;
  }
  /** Next day the task appears, for sorting “以后”. */
  function nextDue(t, today = dayKey()) {
    if (t.repeat === 'none') return t.date || today;
    for (let i = 1; i <= 7; i++) { const k = addDays(today, i); if (dueToday(t, k)) return k; }
    return addDays(today, 7);
  }
  function repeatLabel(t) { return t.repeat === 'weekly' ? `每${WEEK[Number.isInteger(t.repeatDay) ? t.repeatDay : 1].slice(1)}` : repeats[t.repeat]; }

  /* ---------- Validation: one path for stored data, imports and native apps ---------- */
  function normalizeTask(t) {
    if (!t || typeof t.id !== 'string' || !t.id || typeof t.title !== 'string' || !t.title.trim()) return null;
    const repeat = repeats[t.repeat] ? t.repeat : 'none';
    return {
      id: t.id.slice(0, 80), title: t.title.trim().slice(0, 120),
      group: typeof t.group === 'string' && t.group ? t.group.slice(0, 40) : 'work',
      pinned: !!t.pinned, done: !!t.done, completedAt: Number.isFinite(t.completedAt) ? t.completedAt : 0,
      repeat, repeatDay: repeat === 'weekly' && Number.isInteger(t.repeatDay) && t.repeatDay >= 0 && t.repeatDay <= 6 ? t.repeatDay : (repeat === 'weekly' ? weekday(dayKey()) : null),
      date: repeat === 'none' && isDayKey(t.date) ? t.date : '',
      // Optional time box in minutes: tasks with one get a start button and a countdown.
      duration: Number.isInteger(t.duration) && t.duration > 0 && t.duration <= 600 ? t.duration : 0,
      focusMs: Number.isFinite(t.focusMs) && t.focusMs > 0 ? Math.min(t.focusMs, 864e5) : 0,
      // Reminder time on the day the task is due (HH:MM), a note, and a small checklist.
      time: typeof t.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ? t.time : '',
      note: typeof t.note === 'string' ? t.note.slice(0, 2000) : '',
      subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).filter(s => s && typeof s.title === 'string' && s.title.trim()).slice(0, 30)
        .map((s, i) => ({ id: typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : `s${i}`, title: s.title.trim().slice(0, 120), done: !!s.done })),
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : 0
    };
  }
  /** Completion log: one line per finish, kept after repeating tasks reset, for the weekly/monthly review. */
  function normalizeLog(list) {
    return (Array.isArray(list) ? list : []).filter(e => e && typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(e.at) && e.at > 0)
      .map(e => ({ id: e.id.slice(0, 80), title: e.title.slice(0, 120), group: typeof e.group === 'string' ? e.group.slice(0, 40) : 'work', at: e.at, min: Number.isFinite(e.min) && e.min > 0 ? Math.round(e.min) : 0 }))
      .sort((a, b) => a.at - b.at).slice(-LOG_LIMIT);
  }
  function backfillLog(tasks, archive) {
    return normalizeLog([...tasks, ...archive].filter(t => t.done && t.completedAt > 1e12).map(t => ({ id: t.id, title: t.title, group: t.group, at: t.completedAt, min: 0 })));
  }
  function normalizeTimer(t, tasks) {
    if (!t || typeof t.id !== 'string' || !tasks.some(x => x.id === t.id && !x.done)) return null;
    const total = Number(t.total) || 0, endsAt = Number(t.endsAt) || 0, left = Number(t.left) || 0;
    if (total <= 0 || (!endsAt && left <= 0)) return null;
    return { id: t.id, total, endsAt, left: endsAt ? 0 : Math.min(left, total) };
  }
  function normalizeArchived(t) {
    const task = normalizeTask(t);
    return task && { ...task, done: true, archivedAt: Number.isFinite(t.archivedAt) ? t.archivedAt : Date.now() };
  }
  function uniqueTasks(list, normalizer = normalizeTask) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).map(normalizer).filter(t => t && !ids.has(t.id) && ids.add(t.id));
  }
  function normalizeGroups(list) {
    const ids = new Set();
    const out = (Array.isArray(list) ? list : []).filter(g => g && typeof g.id === 'string' && g.id && typeof g.name === 'string' && g.name.trim() && !ids.has(g.id) && ids.add(g.id))
      .slice(0, 12).map(g => ({ id: g.id.slice(0, 40), name: g.name.trim().slice(0, 12), color: /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : GROUP_COLORS[ids.size % GROUP_COLORS.length] }));
    return out.length ? out : structuredClone(DEFAULT_GROUPS);
  }
  function groupOf(id) { return state.groups.find(g => g.id === id) || state.groups[0]; }
  function cleanSettings(raw) {
    const s = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
    if (!palette[s.accent]) s.accent = defaults.accent;
    if (!['compact', 'comfortable'].includes(s.density)) s.density = defaults.density;
    if (!['system', 'custom'].includes(s.wallpaper) && !WALLPAPERS.some(w => w.id === s.wallpaper)) s.wallpaper = 'lake';
    if (typeof s.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(s.photo)) s.photo = '';
    if (s.wallpaper === 'custom' && !s.photo) s.wallpaper = 'lake';
    s.intensity = Math.min(3, Math.max(1, Number(s.intensity) || 2));
    if (!FONTS[s.font]) s.font = 'system';
    s.textSize = Number.isInteger(s.textSize) && s.textSize >= 0 && s.textSize <= 3 ? s.textSize : 1;
    if (!['frosted', 'glass', 'flat'].includes(s.cardMaterial)) s.cardMaterial = defaults.cardMaterial;
    if (typeof s.cardColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.cardColor)) s.cardColor = defaults.cardColor;
    if (!['auto', 'light', 'dark'].includes(s.cardText)) s.cardText = 'auto';
    s.cardTransparency = Math.min(90, Math.max(0, Number(s.cardTransparency) || 0));
    ['motion', 'autoArchive', 'lockNotify', 'lockScreen', 'lockPrivacy', 'installDismissed', 'androidSetupSeen', 'tipsSeen', 'wallpaperPicked'].forEach(k => { s[k] = !!s[k]; });
    return s;
  }
  function applySaved(saved) {
    if (!saved || !Array.isArray(saved.tasks)) return false;
    state.groups = normalizeGroups(saved.groups);
    state.tasks = uniqueTasks(saved.tasks);
    state.archive = uniqueTasks(saved.archive, normalizeArchived).slice(-ARCHIVE_LIMIT);
    state.settings = cleanSettings(saved.settings);
    // Records from schema 1 have no day marker: treat them as today so nothing is archived on upgrade.
    state.day = isDayKey(saved.day) ? saved.day : dayKey();
    // Every save bumps rev; the Android side refuses a save older than what it has (a stale page in the background).
    state.rev = Number.isFinite(saved.rev) ? saved.rev : 0;
    state.log = Array.isArray(saved.log) ? normalizeLog(saved.log) : backfillLog(state.tasks, state.archive);
    state.timer = normalizeTimer(saved.timer, state.tasks);
    return true;
  }

  // Android app shell (android/): the native side keeps a copy for the lock-screen card and may change it
  // (a "完成" tap on the lock screen). The wallpaper photo stays in localStorage only.
  const ANDROID = window.SuiSuiAndroid || null;
  let lastNativeRaw = '';
  function readNative() { try { return ANDROID ? ANDROID.load() || '' : ''; } catch { return ''; } }
  let hadSaved = false;
  let savedPhoto = null, photoOK = true, lastContent = null;
  const contentOf = () => JSON.stringify({ ...state, rev: 0, settings: { ...state.settings, photo: '' } });
  try {
    const local = JSON.parse(localStorage.getItem(STORE) || 'null');
    let photo = '';
    try { photo = localStorage.getItem(PHOTO_KEY) || local?.settings?.photo || ''; } catch { /* ignore */ }
    const nativeRaw = readNative();
    const native = nativeRaw ? JSON.parse(nativeRaw) : null;
    let bootRecord = null;
    if (native && Array.isArray(native.tasks)) {
      bootRecord = native;
      lastNativeRaw = nativeRaw;
      native.settings = { ...(native.settings || {}), photo };
      hadSaved = applySaved(native);
    } else {
      if (local) local.settings = { ...(local.settings || {}), photo };
      hadSaved = applySaved(local);
      bootRecord = local;
    }
    // What is stored now; the first save only writes (and bumps rev) if loading changed anything (upgrades, new defaults).
    lastContent = hadSaved ? JSON.stringify({ ...bootRecord, rev: 0, settings: { ...bootRecord.settings, photo: '' } }) : null;
    savedPhoto = state.settings.photo;
  } catch { storageOK = false; }
  // On Android the lock screen is the main feature, so it starts switched on.
  if (ANDROID && !hadSaved) { state.settings.lockNotify = true; state.settings.lockScreen = true; }
  // Android 1.1+: the window shows the phone's own wallpaper behind the page, so previews use the real wallpaper.
  let SYSTEM_WALLPAPER = false;
  try { SYSTEM_WALLPAPER = !!ANDROID && !!ANDROID.hasSystemWallpaper(); } catch { SYSTEM_WALLPAPER = false; }
  // Until the user picks one from the library, the Android app uses the phone's own wallpaper.
  if (SYSTEM_WALLPAPER && !state.settings.wallpaperPicked) state.settings.wallpaper = 'system';
  const useSystemWallpaper = () => SYSTEM_WALLPAPER && state.settings.wallpaper === 'system';
  let LOCK_MODE = false;
  try { LOCK_MODE = !!ANDROID && (ANDROID.isLockMode() || new URLSearchParams(location.search).get('mode') === 'lock'); } catch { LOCK_MODE = false; }

  function icon(name, attrs = '') { return `<i data-lucide="${name}" ${attrs}></i>`; }
  function icons(root = document) { window.lucide.createIcons({ root, attrs: { 'aria-hidden': 'true' } }); }
  function esc(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function storageCopy() { return storageOK ? (persisted ? '保存在本机 · 已开启长期保存' : '保存在本机') : '未能保存，请先导出备份'; }
  function save() {
    state.schema = SCHEMA;
    const content = contentOf();
    if (content === lastContent && savedPhoto === state.settings.photo) { $('storage-status').textContent = storageCopy(); scheduleLockNotification(); return; }
    // Bump the revision only for real changes, so an untouched page never claims to be newer.
    if (content !== lastContent) state.rev = (state.rev || 0) + 1;
    const record = JSON.stringify({ ...state, settings: { ...state.settings, photo: '' } });
    if (ANDROID) {
      let accepted = true;
      try { accepted = ANDROID.save(record) !== false; } catch { /* bridge unavailable */ }
      if (!accepted) {
        // Another screen (lock view, lock-screen card) saved newer data: take it instead of overwriting it.
        syncFromNative(true);
        return;
      }
      lastNativeRaw = record;
    }
    lastContent = content;
    try { localStorage.setItem(STORE, record); storageOK = true; }
    catch { storageOK = false; }
    if (savedPhoto !== state.settings.photo) {
      try { state.settings.photo ? localStorage.setItem(PHOTO_KEY, state.settings.photo) : localStorage.removeItem(PHOTO_KEY); photoOK = true; savedPhoto = state.settings.photo; }
      catch { photoOK = false; }
    }
    $('storage-status').textContent = storageCopy();
    scheduleLockNotification();
  }
  // Called by the Android shell when the lock-screen card changed the data (or on resume).
  // Take the stored native copy if it changed since this page last read or wrote it.
  function syncFromNative(force = false) {
    if (!ANDROID || (isBusy() && !force)) return false;
    const raw = readNative();
    if (!raw || (raw === lastNativeRaw && !force)) return false;
    try {
      const native = JSON.parse(raw);
      native.settings = { ...(native.settings || {}), photo: state.settings.photo };
      if (!applySaved(native)) return false;
      lastNativeRaw = raw;
      lastContent = contentOf();
      try { localStorage.setItem(STORE, raw); } catch { /* ignore */ }
      if (typeof render === 'function' && document.readyState !== 'loading') { closeEdit(); render(); applySettings(); }
      return true;
    } catch { return false; }
  }
  window.suisuiNativeChanged = () => { syncFromNative(); };

  /* ---------- Lists ---------- */
  function pending() { return state.tasks.filter(t => !t.done && dueToday(t)).sort((a, b) => Number(b.pinned) - Number(a.pinned)); }
  function later() { const today = dayKey(); return state.tasks.filter(t => !t.done && !dueToday(t, today)).sort((a, b) => nextDue(a, today).localeCompare(nextDue(b, today))); }
  function doneList() { return state.tasks.filter(t => t.done).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0)); }
  /** Lock card order: today's pending (pinned first), then finished items in completion order. */
  function cardTasks() { return [...pending(), ...doneList()]; }

  const isPhone = () => matchMedia('(max-width:760px)').matches;
  // Small entrance motion for views and settings pages (skipped with reduced motion).
  function enter(el, cls) {
    if (!el || !state.settings.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.remove('view-enter', 'page-enter', 'page-back'); void el.offsetWidth; el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }
  // Large title collapses into the top bar once it scrolls away (phones).
  window.addEventListener('scroll', () => { document.body.classList.toggle('scrolled', window.scrollY > 72); }, { passive: true });
  function setView(view) {
    if (!['tasks', 'settings', 'review'].includes(view)) view = 'tasks';
    closeAdd(); closeSearch();
    document.body.dataset.view = view;
    document.querySelectorAll('.nav-button[data-view]').forEach(b => { b.classList.toggle('selected', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    const settings = view === 'settings';
    const changed = document.body.dataset.shown !== view;
    document.body.dataset.shown = view;
    $('settings-panel').hidden = !settings;
    $('review-panel').hidden = view !== 'review';
    $('tasks-panel').hidden = view !== 'tasks';
    if (changed) enter({ tasks: $('tasks-panel'), settings: $('settings-panel'), review: $('review-panel') }[view], 'view-enter');
    if (view === 'review') renderReview();
    if (settings) openSettingsPage('index');
    else updateWallpaperHole();
    if (isPhone()) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  /* Settings: an index of four pages instead of one long scroll. */
  const SETTINGS_TITLES = { index: '设置', look: '外观', lock: '锁屏与隐私', list: '分组与每日整理', data: '数据与备份' };
  function openSettingsPage(page) {
    if (!SETTINGS_TITLES[page]) page = 'index';
    const deeper = page !== 'index' && settingsPage === 'index', back = page === 'index' && settingsPage !== 'index';
    settingsPage = page;
    document.body.dataset.settingsPage = page;
    $('settings-index').hidden = page !== 'index';
    document.querySelectorAll('.settings-page').forEach(p => { p.hidden = p.dataset.page !== page; });
    $('settings-title').textContent = SETTINGS_TITLES[page];
    $('settings-back').hidden = page === 'index';
    $('settings-scroll').scrollTop = 0;
    if (deeper) enter(document.querySelector(`.settings-page[data-page="${page}"]`), 'page-enter');
    if (back) enter($('settings-index'), 'page-back');
    if (page === 'index') renderSettingsSummary();
    if (page === 'lock') renderNotifySetting();
    updateWallpaperHole();
    icons($('settings-panel'));
  }
  // Android: leave a transparent hole where the settings preview is, so the real wallpaper shows in it.
  function updateWallpaperHole() {
    const on = useSystemWallpaper() && !LOCK_MODE && document.body.dataset.view === 'settings' && ['look', 'lock'].includes(settingsPage);
    document.documentElement.classList.toggle('wallpaper-hole', on);
  }
  function themeName() {
    const s = state.settings;
    const hit = Object.values(THEMES).find(t => ['cardColor', 'cardMaterial', 'cardTransparency', 'cardText', 'accent'].every(k => String(t[k]).toLowerCase() === String(s[k]).toLowerCase()));
    return hit ? hit.name : '自定义';
  }
  function renderSettingsSummary() {
    const s = state.settings;
    // Bento cards: each one shows its current state, not just a label.
    $('tile-look-title').textContent = `${themeName()}`;
    $('sum-look').textContent = `${FONTS[s.font]} · ${TEXT_SIZES[s.textSize][0]}字号 · 锁屏 ${s.density === 'compact' ? 4 : 3} 条`;
    const photo = s.wallpaper === 'custom' && s.photo ? s.photo : s.wallpaper === 'system' ? '' : wallpaperOf(s.wallpaper).thumb;
    const img = $('tile-look-photo');
    if (photo) { if (img.getAttribute('src') !== photo) img.src = photo; img.hidden = false; img.classList.toggle('monochrome', s.wallpaper === 'mono'); } else img.hidden = true;
    $('tile-look-card').style.background = $('mini-card').style.getPropertyValue('--card-bg') || s.cardColor;
    const on = ANDROID ? (s.lockScreen || s.lockNotify) : s.lockNotify;
    $('tile-lock-state').textContent = on ? '已开启' : '未开启';
    $('settings-index').querySelector('.tile-lock').classList.toggle('on', on);
    $('sum-lock').textContent = s.lockPrivacy ? '隐藏内容 · 只显示件数' : ANDROID ? (s.lockScreen ? '亮屏直接显示' : '锁屏卡片') : '锁屏通知';
    $('tile-list-count').textContent = String(state.groups.length);
    $('tile-list-dots').innerHTML = state.groups.map(g => `<span style="background:${g.color}" title="${esc(g.name)}"></span>`).join('');
    $('sum-list').textContent = s.autoArchive ? '每天自动整理' : '不自动整理';
  }

  /* ---------- Add sheet (phones) / inline form (wider screens) ---------- */
  let addGroupId = '';
  function renderAddChips() {
    if (!state.groups.some(g => g.id === addGroupId)) addGroupId = state.groups[0].id;
    $('task-group').value = addGroupId;
    $('add-group-chips').innerHTML = icon('folder') + state.groups.map(g => `<button type="button" class="chip${g.id === addGroupId ? ' active' : ''}" data-add-group="${esc(g.id)}" aria-pressed="${g.id === addGroupId}"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</button>`).join('');
    const when = $('task-when').value, repeat = $('task-repeat').value;
    const dateless = repeat === 'daily' || repeat === 'weekdays';
    document.querySelectorAll('[data-add-when]').forEach(b => { const on = b.dataset.addWhen === when; b.classList.toggle('active', on && !dateless); b.setAttribute('aria-pressed', String(on)); b.disabled = dateless; });
    document.querySelectorAll('[data-add-repeat]').forEach(b => { const on = b.dataset.addRepeat === repeat; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('task-date').hidden = when !== 'pick' || dateless;
    durationChips('add', Number($('task-duration').value) || 0, $('task-duration-custom'));
    const time = $('task-time').value, presetTime = ['', '09:00', '12:00', '18:00', '21:00'].includes(time);
    const customTime = addManual.customTime || !presetTime;
    document.querySelectorAll('[data-add-time]').forEach(b => { const on = b.dataset.addTime === 'custom' ? customTime : !customTime && b.dataset.addTime === time; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('task-time-custom').hidden = !customTime;
    if (customTime && time && document.activeElement !== $('task-time-custom')) $('task-time-custom').value = time;
  }
  // Duration chips (add and edit): preset minutes, or "自定" with a number field.
  let customDuration = { add: false, edit: false };
  function durationChips(which, minutes, input) {
    const preset = minutes === 0 || DURATIONS.includes(minutes);
    const custom = customDuration[which] || !preset;
    document.querySelectorAll(`[data-${which}-duration]`).forEach(b => {
      const v = b.dataset[`${which}Duration`], on = v === 'custom' ? custom : !custom && Number(v) === minutes;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
    input.hidden = !custom;
    if (custom && minutes && document.activeElement !== input) input.value = String(minutes);
  }
  function readCustom(input) { const n = Math.round(Number(input.value)); return Number.isFinite(n) && n >= 1 && n <= 600 ? n : 0; }
  function openAdd() {
    if (document.body.dataset.view !== 'tasks') setView('tasks');
    if (filter !== 'all' && state.groups.some(g => g.id === filter)) addGroupId = filter;
    renderAddChips();
    if (isPhone()) { document.body.classList.add('adding'); $('add-backdrop').hidden = false; }
    else $('add-form').scrollIntoView({ block: 'nearest' });
    $('task-input').focus();
  }
  function closeAdd() {
    if (!document.body.classList.contains('adding')) return false;
    document.body.classList.remove('adding'); $('add-backdrop').hidden = true; $('form-error').textContent = '';
    if (document.activeElement === $('task-input')) $('task-input').blur();
    return true;
  }
  // iOS keeps the layout viewport under the keyboard; lift the sheet by the covered height.
  if (window.visualViewport) {
    const lift = () => { const covered = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop); document.documentElement.style.setProperty('--kb', `${Math.round(covered)}px`); };
    visualViewport.addEventListener('resize', lift); visualViewport.addEventListener('scroll', lift);
  }

  /* ---------- Edit sheet ---------- */
  function editChips(task, group, repeat) {
    $('edit-group-chips').innerHTML = state.groups.map(g => `<button type="button" class="chip${g.id === group ? ' active' : ''}" data-edit-group="${esc(g.id)}" aria-pressed="${g.id === group}"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}</button>`).join('');
    document.querySelectorAll('[data-edit-repeat]').forEach(b => { const on = b.dataset.editRepeat === repeat; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    const form = $('edit-form'), dateless = repeat === 'daily' || repeat === 'weekdays', date = $('edit-date').value, today = dayKey();
    form.elements.group.value = group; form.elements.repeat.value = repeat;
    $('edit-date').disabled = dateless;
    document.querySelectorAll('[data-edit-when]').forEach(b => { b.disabled = dateless; const on = !dateless && (b.dataset.editWhen === 'today' ? (!date || date === today) : date === addDays(today, 1)); b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('edit-date-field').querySelector('span').textContent = repeat === 'weekly' ? '从哪天' : '日期';
  }
  function openEdit(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    editing = id;
    const form = $('edit-form');
    form.dataset.editId = id;
    $('edit-title').value = task.title;
    $('edit-date').value = task.date || '';
    $('edit-pinned').checked = task.pinned;
    $('edit-delete').dataset.id = id;
    form.elements.duration.value = String(task.duration || 0);
    $('edit-time').value = task.time || '';
    $('edit-note').value = task.note || '';
    renderSubtasks(task);
    customDuration.edit = false; $('edit-duration-custom').value = '';
    durationChips('edit', task.duration || 0, $('edit-duration-custom'));
    editChips(task, groupOf(task.group).id, task.repeat);
    if (!$('edit-sheet').open) $('edit-sheet').showModal();
    icons($('edit-sheet'));
    if (!isPhone()) $('edit-title').focus();
  }
  // Subtasks change immediately (ticking one should never need a 保存).
  function renderSubtasks(task) {
    $('edit-subtasks').innerHTML = (task.subtasks || []).map(s => `<div class="subtask${s.done ? ' is-done' : ''}" data-sub="${esc(s.id)}"><button type="button" class="sub-check" data-sub-toggle="${esc(s.id)}" aria-label="${s.done ? '取消完成' : '完成'}：${esc(s.title)}"><span class="check-circle">${s.done ? icon('check') : ''}</span></button><span class="sub-title">${esc(s.title)}</span><button type="button" class="icon-button" data-sub-delete="${esc(s.id)}" aria-label="删除子任务：${esc(s.title)}">${icon('x')}</button></div>`).join('');
    icons($('edit-subtasks'));
  }
  function editingTask() { return state.tasks.find(t => t.id === $('edit-form').dataset.editId); }
  function closeEdit() {
    editing = null;
    if ($('edit-sheet').open) { $('edit-sheet').close(); return true; }
    return false;
  }
  // Android back button: close what is open before leaving the app.
  window.suisuiBack = () => {
    for (const d of document.querySelectorAll('dialog[open]')) { d.close(); return true; }
    if (closeAdd()) return true;
    if (closeSearch()) return true;
    if (document.body.dataset.view === 'settings') { settingsPage !== 'index' ? openSettingsPage('index') : setView('tasks'); return true; }
    if (document.body.dataset.view === 'review') { setView('tasks'); return true; }
    return false;
  };
  function showToast(message, undo = null, label = '撤销', ms = 0) {
    clearTimeout(toastTimer);
    undoAction = undo;
    $('toast-message').textContent = message;
    $('undo-button').textContent = label;
    $('undo-button').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(hideToast, ms || (undo ? 8000 : 4500));
  }
  function hideToast() { $('toast').hidden = true; clearTimeout(toastTimer); undoAction = null; }
  function metaFlags(t) {
    const g = groupOf(t.group), today = dayKey();
    let flags = `<span class="dot" style="background:${g.color}"></span>${esc(g.name)}`;
    if (t.repeat !== 'none') flags += `<span class="meta-flag">${icon('repeat')}${repeatLabel(t)}</span>`;
    if (t.repeat === 'none' && t.date && t.date !== today) flags += `<span class="meta-flag${t.date < today ? ' overdue' : ''}">${icon('calendar')}${t.date < today ? '已过期 · ' : ''}${dateLabel(t.date)}</span>`;
    if (t.time) flags += `<span class="meta-flag meta-time">${icon('alarm-clock')}${t.time}</span>`;
    if (t.subtasks?.length) flags += `<span class="meta-flag">${icon('list-checks')}${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>`;
    if (t.note) flags += `<span class="meta-flag" title="有备注">${icon('sticky-note')}</span>`;
    if (t.pinned) flags += `<span class="meta-flag">${icon('pin')}置顶</span>`;
    return flags;
  }
  // Tap the circle to finish; tap the text to edit (group, date, repeat, pin, delete in one sheet).
  function row(t) {
    return `<div class="task-row${completing.has(t.id) ? ' is-completing' : ''}${t.pinned ? ' is-pinned' : ''}" data-task-id="${esc(t.id)}"><button class="check-task" data-action="complete" data-id="${esc(t.id)}" aria-label="完成：${esc(t.title)}"><span class="check-circle"></span></button><button class="task-body" data-action="edit" data-id="${esc(t.id)}" aria-label="编辑：${esc(t.title)}"><span class="task-title">${esc(t.title)}</span><span class="task-meta">${metaFlags(t)}</span></button>${timerPill(t)}${state.timer?.id === t.id ? `<button class="timer-stop" data-action="timer-stop" data-id="${esc(t.id)}" aria-label="结束计时">${icon('square')}</button>` : ''}</div>`;
  }
  // First use: no sample tasks, a calm invitation instead (the dots echo the logo).
  const FIRST_RUN = `<div class="first-run"><svg class="first-art" viewBox="0 0 120 120" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => { const a = (-80 + i * 24.3) * Math.PI / 180, t = i / 13; return `<circle cx="${(60 + 44 * Math.cos(a)).toFixed(1)}" cy="${(60 + 44 * Math.sin(a)).toFixed(1)}" r="${(2 + t * 4).toFixed(1)}" opacity="${(.3 + t * .7).toFixed(2)}"/>`; }).join('')}<path d="M44 61l11 11 22-23" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg><h2>从第一件小事开始</h2><p>点下面的 + 写下今天想做的事。<br>需要专注的事可以设个时长，点开始就倒计时。</p><button class="primary-button" data-action="first-add">${icon('plus')}添加第一件</button></div>`;
  function renderFilters(todo) {
    if (filter !== 'all' && !state.groups.some(g => g.id === filter)) filter = 'all';
    const count = id => todo.filter(t => id === 'all' || groupOf(t.group).id === id).length;
    $('filter-tabs').innerHTML = `<button data-filter="all">全部 <span id="count-all">${count('all')}</span></button>` +
      state.groups.map(g => `<button data-filter="${esc(g.id)}"><span class="dot" style="background:${g.color}"></span>${esc(g.name)} <span id="count-${esc(g.id)}">${count(g.id)}</span></button>`).join('');
    document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b.dataset.filter === filter); b.setAttribute('aria-pressed', String(b.dataset.filter === filter)); });
  }
  function render() {
    const todo = pending(), done = doneList(), upcoming = later();
    const inFilter = t => filter === 'all' || groupOf(t.group).id === filter;
    const visible = todo.filter(inFilter);
    const fmt = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    $('progress-copy').textContent = `${fmt.format(new Date())} · ${todo.length ? `还有 ${todo.length} 件，完成 ${done.length} 件` : (done.length ? `${done.length} 件都完成了` : '给今天留一件想做的事')}`;
    const total = todo.length + done.length;
    $('progress-number').textContent = total ? `${done.length}/${total}` : '0';
    $('header-title').textContent = total ? `今天 · ${done.length}/${total}` : '今天';
    $('progress-arc').style.strokeDasharray = `${total ? (done.length / total) * 97.4 : 0} 97.4`;
    renderFilters(todo);
    renderAddChips();
    $('gesture-tips').hidden = !!state.settings.tipsSeen || !todo.length;
    if (editing && !state.tasks.some(t => t.id === editing)) closeEdit();
    $('pending-count').textContent = String(visible.length);
    const firstRun = !state.tasks.length && !state.log.length;
    document.querySelector('.list-heading').hidden = firstRun;
    $('filter-tabs').hidden = firstRun;
    $('completed-section').hidden = !done.length;
    $('task-list').innerHTML = visible.length ? visible.map(row).join('') : firstRun ? FIRST_RUN : `<div class="empty-state">${icon(todo.length ? 'list-filter' : 'circle-check')}<span>${todo.length ? '这个分组今天没有待办' : done.length ? '都完成了，给自己一点空白。' : '今天从一件小事开始。'}</span></div>`;
    const laterVisible = upcoming.filter(inFilter);
    $('later-section').hidden = !laterVisible.length;
    $('later-count').textContent = String(laterVisible.length);
    $('later-list').innerHTML = laterVisible.map(row).join('');
    $('done-count').textContent = String(done.length);
    $('clear-done').hidden = !done.some(t => t.repeat === 'none');
    $('completed-list').innerHTML = done.map(t => `<div class="done-row" data-completed-id="${esc(t.id)}">${icon('circle-check')}<s class="done-text completed-title">${esc(t.title)}</s>${t.repeat !== 'none' ? `<span class="done-flag" title="下次该做时自动重新出现">${icon('repeat')}</span>` : ''}<button class="icon-button" data-action="restore" data-id="${esc(t.id)}" aria-label="恢复：${esc(t.title)}" title="恢复待办">${icon('rotate-ccw')}</button><button class="icon-button" data-action="delete" data-id="${esc(t.id)}" aria-label="删除：${esc(t.title)}" title="删除">${icon('trash-2')}</button></div>`).join('');
    renderArchive();
    renderGroupSettings();
    renderPreview();
    if (settingsPage === 'index') renderSettingsSummary();
    if (document.body.dataset.view === 'review') renderReview();
    if (document.body.classList.contains('searching')) renderSearch();
    renderFocusBar();
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
  function renderGroupSettings() {
    const list = $('group-list');
    if (list.contains(document.activeElement)) return; // don't rebuild while the user is typing a name
    list.innerHTML = state.groups.map(g => `<div class="group-row" data-group-id="${esc(g.id)}"><span class="dot" style="background:${g.color}"></span><label class="sr-only" for="group-name-${esc(g.id)}">分组名称</label><input class="group-name" id="group-name-${esc(g.id)}" value="${esc(g.name)}" maxlength="12" data-group-id="${esc(g.id)}"><div class="group-colors" role="group" aria-label="${esc(g.name)}的颜色">${GROUP_COLORS.map(c => `<button class="group-color${c === g.color ? ' active' : ''}" style="--c:${c}" data-group-color="${c}" data-group-id="${esc(g.id)}" aria-label="颜色 ${c}" aria-pressed="${c === g.color}"></button>`).join('')}</div><button class="icon-button" data-group-delete="${esc(g.id)}" aria-label="删除分组：${esc(g.name)}" title="删除分组">${icon('trash-2')}</button></div>`).join('');
    $('add-group').disabled = state.groups.length >= 12;
  }
  // A lock-card row with a duration gets its own start button next to it (buttons cannot nest).
  function lockRow(t, button) { const pill = timerPill(t, 'lock-timer'); return pill ? `<div class="lock-row">${button}${pill}</div>` : button; }
  function renderPreview() {
    const todo = pending(), done = doneList().length;
    const list = $('activity-list'), scrollTop = list.scrollTop;
    const items = cardTasks();
    const max = state.settings.density === 'compact' ? 4 : 3;
    const total = todo.length + done;
    $('activity').classList.toggle('compact', max === 4);
    $('activity-count').textContent = `${done}/${total}`;
    const hide = LOCK_MODE && state.settings.lockPrivacy;
    $('activity').classList.toggle('is-private', hide);
    list.innerHTML = hide
      ? `<div class="lock-private">${icon('lock-keyhole')}<span>${todo.length ? `今天还有 ${todo.length} 件待办` : '今天的事都完成了'}</span><button class="lock-reveal" id="lock-reveal">解锁查看</button></div>`
      : items.length ? items.map(t => lockRow(t, `<button class="lock-task${t.done ? ' is-done' : ''}${completing.has(t.id) ? ' is-completing' : ''}" data-action="${t.done ? 'restore' : 'complete'}" data-id="${esc(t.id)}" aria-label="${t.done ? '恢复' : '完成'}：${esc(t.title)}" aria-pressed="${t.done}"><span class="check-circle">${t.done ? icon('check') : ''}</span><span class="lock-task-label">${t.done ? `<s class="completed-title">${esc(t.title)}</s>` : esc(t.title)}</span></button>`)).join('') : `<div class="lock-empty">${icon('circle-check')}<span>今天，留一点空白。</span></div>`;
    list.scrollTop = scrollTop;
    $('remaining-label').textContent = todo.length ? `剩余 ${todo.length} 项 · 已完成 ${done} 项` : (done ? `全部完成 · ${done} 项` : '暂无待办');
    $('preview-footer-copy').textContent = `碎碎清单 · ${todo.length} 项待完成`;
    document.querySelectorAll('[data-action="complete"]').forEach(b => { b.disabled = completing.has(b.dataset.id); });
    renderMiniPreview(items, max, todo.length);
  }
  // Read-only copy of the card at the top of Settings, so appearance and privacy changes are visible while adjusting them.
  function renderMiniPreview(items, rows, open) {
    $('mini-card').classList.toggle('compact', rows === 4);
    $('mini-count').textContent = $('activity-count').textContent;
    $('mini-remaining').textContent = $('remaining-label').textContent;
    $('mini-list').innerHTML = state.settings.lockPrivacy
      ? `<div class="lock-private">${icon('lock-keyhole')}<span>${open ? `今天还有 ${open} 件待办` : '今天的事都完成了'}</span><span class="lock-reveal">解锁查看</span></div>`
      : items.length ? items.slice(0, rows).map(t => `<div class="mini-row${t.done ? ' is-done' : ''}"><span class="check-circle">${t.done ? icon('check') : ''}</span><span class="mini-row-label">${t.done ? `<s class="completed-title">${esc(t.title)}</s>` : esc(t.title)}</span>${t.duration && !t.done ? `<span class="mini-timer">${icon('play')}${t.duration}分</span>` : ''}</div>`).join('') : `<div class="lock-empty">${icon('circle-check')}<span>今天，留一点空白。</span></div>`;
  }
  function applySettings() {
    const s = state.settings, colors = palette[s.accent], dark = darkScheme.matches, root = document.documentElement.style;
    root.setProperty('--accent', dark ? colors[2] : colors[0]);
    root.setProperty('--accent-fill', colors[0]);
    root.setProperty('--accent-soft', dark ? colors[3] : colors[1]);
    const paper = s.wallpaper === 'custom' && s.photo ? { src: s.photo, pos: '50% 50%' } : wallpaperOf(s.wallpaper);
    ['wallpaper', 'mini-wallpaper'].forEach(id => {
      const img = $(id);
      if (img.getAttribute('src') !== paper.src) img.src = paper.src;
      img.style.objectPosition = paper.pos;
      img.classList.toggle('monochrome', !!paper.mono);
    });
    root.setProperty('--app-font', `var(--font-${s.font})`);
    root.setProperty('--ts', String(TEXT_SIZES[s.textSize][1]));
    document.querySelectorAll('[data-font]').forEach(b => { b.classList.toggle('active', b.dataset.font === s.font); b.setAttribute('aria-pressed', String(b.dataset.font === s.font)); });
    $('text-size').value = s.textSize;
    $('text-size').style.setProperty('--fill', `${s.textSize / 3 * 100}%`);
    $('text-size-value').textContent = TEXT_SIZES[s.textSize][0];
    document.documentElement.classList.toggle('system-wallpaper', useSystemWallpaper());
    updateWallpaperHole();
    $('mini-tag-label').textContent = useSystemWallpaper() ? '实时预览 · 手机壁纸' : '实时预览';
    renderWallpaperLibrary();
    document.querySelectorAll('[name="accent"]').forEach(i => { i.checked = i.value === s.accent; });
    document.querySelectorAll('[data-density]').forEach(b => { b.classList.toggle('active', b.dataset.density === s.density); b.setAttribute('aria-pressed', String(b.dataset.density === s.density)); });

    document.querySelectorAll('[data-theme-preset]').forEach(b => {
      const t = THEMES[b.dataset.themePreset];
      const on = ['cardColor', 'cardMaterial', 'cardTransparency', 'cardText', 'accent'].every(k => String(t[k]).toLowerCase() === String(s[k]).toLowerCase());
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
    $('motion-toggle').checked = !!s.motion;
    $('intensity').value = s.intensity;
    $('intensity-value').textContent = ['轻柔', '适中', '强烈'][s.intensity - 1];
    $('intensity').disabled = !s.motion;
    $('archive-toggle').checked = !!s.autoArchive;
    $('privacy-toggle').checked = !!s.lockPrivacy;
    renderNotifySetting();
    applyCardAppearance();
    renderPreview();
    if (settingsPage === 'index') renderSettingsSummary();
    icons();
  }
  function renderWallpaperLibrary() {
    const s = state.settings, list = $('wallpaper-library');
    const tile = (id, name, inner, extra = '') => `<button class="wallpaper-choice${extra}${s.wallpaper === id ? ' active' : ''}" data-wallpaper="${id}" aria-pressed="${s.wallpaper === id}" aria-label="${name}壁纸">${inner}<span>${name}</span></button>`;
    list.innerHTML = (SYSTEM_WALLPAPER ? tile('system', '手机壁纸', `<i data-lucide="smartphone"></i>`, ' system') : '') +
      (s.photo ? tile('custom', '我的照片', `<img src="${esc(s.photo)}" alt="" loading="lazy">`) : '') +
      WALLPAPERS.map(w => tile(w.id, w.name, `<img src="${w.thumb}" alt="" loading="lazy" style="object-position:${w.pos}">`, w.mono ? ' mono' : '')).join('');
    $('wallpaper-legend').textContent = SYSTEM_WALLPAPER ? '锁屏壁纸' : '预览壁纸';
    $('wallpaper-note').textContent = SYSTEM_WALLPAPER ? '默认用你手机自己的壁纸；也可以给碎碎清单的锁屏单独换一张。' : '网页读不到手机壁纸，这里只影响预览。可以选一张和你锁屏一样的照片来对照。';
  }
  function applyCardAppearance() {
    const s = state.settings;
    const rgb = [1, 3, 5].map(i => parseInt(s.cardColor.slice(i, i + 2), 16));
    // Materials differ in more than blur: glass lets more through and adds a sheen and a light rim,
    // frosted blurs heavily, flat is a solid colour (transparency still applies, scaled per material).
    const MATERIAL = { frosted: { blur: '26px', sat: '1.25', see: .8 }, glass: { blur: '4px', sat: '1.8', see: .55 }, flat: { blur: '0px', sat: '1', see: 1 } };
    // Color-based automatic contrast; the explicit text option covers unusual wallpapers.
    const luminance = values => values.reduce((sum, v, i) => sum + (v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i], 0);
    const lum = luminance(rgb);
    const contrast = ink => (Math.max(ink, lum) + .05) / (Math.min(ink, lum) + .05);
    const light = s.cardText === 'light' || (s.cardText === 'auto' && contrast(luminance([244, 251, 247])) >= contrast(luminance([24, 43, 34])));
    for (const card of [$('activity'), $('mini-card'), ...document.querySelectorAll('.mat-card')]) {
      const m = MATERIAL[card.dataset.mat || s.cardMaterial];
      card.dataset.surface = card.dataset.mat || s.cardMaterial;
      card.style.setProperty('--card-bg', `rgba(${rgb.join(',')},${((1 - s.cardTransparency / 100) * m.see).toFixed(3)})`);
      card.style.setProperty('--card-blur', m.blur);
      card.style.setProperty('--card-saturate', m.sat);
      card.style.setProperty('--card-ink', light ? '#f4fbf7' : '#182b22');
      card.style.setProperty('--card-muted', light ? '#e0eae4' : '#30483b');
      card.style.setProperty('--card-rule', light ? '#d4eddf40' : '#183b2b30');
      card.style.setProperty('--card-check', light ? '#c6eed2' : '#275d42');
    }
    $('card-color').value = s.cardColor;
    $('card-color-value').textContent = s.cardColor.toUpperCase();
    $('card-transparency').value = s.cardTransparency;
    $('card-transparency').style.setProperty('--fill', `${s.cardTransparency / 90 * 100}%`);
    $('intensity').style.setProperty('--fill', `${(s.intensity - 1) / 2 * 100}%`);
    $('card-transparency-value').textContent = `${s.cardTransparency}%`;
    $('card-text').value = s.cardText;
    document.querySelectorAll('[data-card-text]').forEach(b => { b.classList.toggle('active', b.dataset.cardText === s.cardText); b.setAttribute('aria-pressed', String(b.dataset.cardText === s.cardText)); });
    const paper = s.wallpaper === 'custom' && s.photo ? s.photo : s.wallpaper === 'system' ? '' : wallpaperOf(s.wallpaper).thumb;
    document.querySelectorAll('.mat-photo').forEach(img => { if (paper) { if (img.getAttribute('src') !== paper) img.src = paper; img.hidden = false; } else img.hidden = true; img.classList.toggle('monochrome', s.wallpaper === 'mono'); });
    document.querySelectorAll('[data-material]').forEach(b => { b.classList.toggle('active', b.dataset.material === s.cardMaterial); b.setAttribute('aria-pressed', String(b.dataset.material === s.cardMaterial)); });
    document.querySelectorAll('[data-card-color]').forEach(b => { b.classList.toggle('active', b.dataset.cardColor.toLowerCase() === s.cardColor.toLowerCase()); b.setAttribute('aria-pressed', String(b.dataset.cardColor.toLowerCase() === s.cardColor.toLowerCase())); });
  }

  /* ---------- A new day: reset repeating tasks, archive yesterday's finished items ---------- */
  function rollover({ announce = true } = {}) {
    // A page left open in the background (e.g. the lock view overnight) must not roll over its old copy.
    if (ANDROID && booted) syncFromNative();
    const today = dayKey();
    if (state.day === today || isBusy()) return false;
    const cutoff = startOfToday();
    let reset = 0, archived = 0;
    const keep = [];
    for (const t of state.tasks) {
      if (t.done && t.repeat !== 'none') { t.done = false; t.completedAt = 0; reset++; keep.push(t); }
      else if (t.done && state.settings.autoArchive && (t.completedAt || 0) < cutoff) { state.archive.push({ ...t, archivedAt: Date.now() }); archived++; }
      else keep.push(t);
    }
    state.tasks = keep;
    state.archive = state.archive.slice(-ARCHIVE_LIMIT);
    state.day = today;
    save();
    if (announce && (reset || archived)) {
      render();
      showToast(`新的一天：${[archived && `${archived} 件已完成移入历史`, reset && `${reset} 件重复事项已重置`].filter(Boolean).join('，')}`);
    }
    return true;
  }
  function moveDoneToArchive() {
    const done = state.tasks.filter(t => t.done && t.repeat === 'none');
    if (!done.length) { showToast('重复的事项会在下次该做时自动重置，不需要清理'); return; }
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
    if (state.settings.lockPrivacy) return { title: `今天还有 ${todo.length} 件待办`, body: '打开碎碎清单查看' };
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
      else await registration.showNotification(content.title, { body: content.body, tag: 'suisui-today', renotify: false, silent: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' } });
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
    const steps = { notify: p.notifications, overlay: p.overlay, battery: p.battery, fullscreen: p.fullScreen };
    $('setup-fullscreen').hidden = !p.needsFullScreenSetting;
    const stats = $('lock-stats');
    stats.hidden = !(state.settings.lockScreen && p.screenOffs > 0);
    if (!stats.hidden) {
      const missed = p.screenOffs - p.shown;
      stats.textContent = `最近 ${p.screenOffs} 次熄屏，碎碎清单锁屏出现了 ${p.shown} 次。` + (missed > 0 ? (p.battery === false ? '有漏掉的：请在“检查锁屏权限”里打开“不限制电池”。' : '有漏掉的：请在“检查锁屏权限”里按品牌打开“后台弹出界面”和“锁屏显示”。') : '');
    }
    Object.entries(steps).forEach(([key, ok]) => {
      const li = $(`setup-${key}`);
      if (!li || ok === undefined) return;
      li.classList.toggle('done', !!ok);
      li.querySelector('button').textContent = ok ? '已开启' : '去开启';
      li.querySelector('button').disabled = !!ok;
    });
  }
  function openAndroidSetup() { renderAndroidLock(); $('android-setup').showModal(); icons($('android-setup')); $('finish-android-setup').focus(); }
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

  /* ---------- Backup: export and import (also accepts the native apps' exports) ---------- */
  function backupPayload() {
    const { photo, ...settings } = state.settings;
    return { app: 'suisui', version: SCHEMA, exportedAt: new Date().toISOString(), tasks: state.tasks, archive: state.archive, groups: state.groups, log: state.log, settings };
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
    const log = Array.isArray(data?.log) ? normalizeLog(data.log) : backfillLog(tasks, archive);
    return { tasks, archive, log, groups: Array.isArray(data?.groups) ? normalizeGroups(data.groups) : null, settings: data?.settings && typeof data.settings === 'object' ? data.settings : null };
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
  function mergeGroups(incoming) {
    if (!incoming) return;
    const known = new Set(state.groups.map(g => g.id));
    state.groups = [...state.groups, ...incoming.filter(g => !known.has(g.id))].slice(0, 12);
  }
  function applyImport(mode) {
    if (!pendingImport) return;
    const before = structuredClone(state);
    if (mode === 'replace') {
      state.tasks = pendingImport.tasks;
      state.archive = pendingImport.archive.slice(-ARCHIVE_LIMIT);
      if (pendingImport.groups) state.groups = pendingImport.groups;
      state.log = pendingImport.log;
      if (state.timer && !state.tasks.some(t => t.id === state.timer.id)) { state.timer = null; syncNativeTimer(); }
    } else {
      const ids = new Set(state.tasks.map(t => t.id));
      state.tasks.push(...pendingImport.tasks.filter(t => !ids.has(t.id)));
      const archived = new Set(state.archive.map(t => t.id));
      state.archive = [...state.archive, ...pendingImport.archive.filter(t => !archived.has(t.id) && !ids.has(t.id))].slice(-ARCHIVE_LIMIT);
      mergeGroups(pendingImport.groups);
      const seen = new Set(state.log.map(e => `${e.id}@${e.at}`));
      state.log = normalizeLog([...state.log, ...pendingImport.log.filter(e => !seen.has(`${e.id}@${e.at}`))]);
    }
    if ($('import-settings').checked && pendingImport.settings) state.settings = cleanSettings({ ...pendingImport.settings, photo: state.settings.photo, wallpaper: pendingImport.settings.wallpaper === 'custom' ? state.settings.wallpaper : pendingImport.settings.wallpaper });
    pendingImport = null; filter = 'all'; closeEdit();
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
    const layer = $('fragments'), pieces = [], cols = (navigator.hardwareConcurrency || 8) <= 4 ? 7 : 10, rows = 3;
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
          window.anime.animate(p, { x: [0, dx], y: [0, dy], rotate: [0, (Math.random() - .5) * 140], scale: [1, .3], duration: 780 + Math.random() * 180, delay: Math.abs(x - (cols - 1) / 2) * 11, ease: 'outExpo' });
          window.anime.animate(p, { opacity: [1, 0], delay: 140, duration: 700, ease: 'inQuad', onComplete: () => p.remove() });
        }
      }
    }
    source.style.visibility = 'hidden';
    await new Promise(resolve => setTimeout(resolve, 520));
  }
  /** Finish a task: completion time, focus time from its timer, one line in the review log. */
  function markDone(task) {
    if (state.timer?.id === task.id) settleTimer(false);
    task.done = true;
    task.completedAt = Math.max(Date.now(), ...state.tasks.map(t => (t.completedAt || 0) + 1));
    state.log.push({ id: task.id, title: task.title, group: task.group, at: task.completedAt, min: Math.round((task.focusMs || 0) / 60000) });
    if (state.log.length > LOG_LIMIT) state.log = state.log.slice(-LOG_LIMIT);
    task.focusMs = 0;
  }
  function unmarkDone(task) {
    const i = state.log.findLastIndex(e => e.id === task.id && e.at === task.completedAt);
    if (i >= 0) { task.focusMs = state.log[i].min * 60000; state.log.splice(i, 1); }
    task.done = false;
  }
  async function complete(id, button) {
    if (completing.has(id)) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.done) return;
    const positions = new Map();
    const positionKey = el => `${el.classList.contains('lock-task') ? 'preview' : 'editor'}:${el.dataset.taskId || el.dataset.id}`;
    const source = button.classList.contains('lock-task') ? button : button.closest('.task-row');
    completing.add(id);
    button.disabled = true;
    haptic('done');
    let animationError = false;
    try { await shatter(source); } catch { animationError = true; }
    document.querySelectorAll('.task-row, .lock-task').forEach(el => positions.set(positionKey(el), el.getBoundingClientRect().top));
    completing.delete(id);
    if (!state.tasks.includes(task) || task.done) { render(); return; }
    markDone(task);
    if (editing === id) closeEdit();
    save(); render();
    $('completed-section').open = true;
    if (state.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.task-row, .lock-task').forEach(el => {
        const oldTop = positions.get(positionKey(el));
        if (oldTop !== undefined && !completing.has(el.dataset.taskId || el.dataset.id)) {
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
    showToast('已完成一项待办', () => { unmarkDone(task); save(); render(); });
    if (!isBusy()) {
      const next = button.classList.contains('lock-task') ? $('activity-list').querySelector('[data-action="complete"]') || $('activity-list').querySelector('button') : $('task-list').querySelector('[data-action="complete"]');
      if (next) next.focus({ preventScroll: true });
    }
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

  /* ---------- Groups ---------- */
  function addGroup() {
    if (state.groups.length >= 12) return;
    const used = new Set(state.groups.map(g => g.color));
    const group = { id: newId('g'), name: `分组 ${state.groups.length + 1}`, color: GROUP_COLORS.find(c => !used.has(c)) || GROUP_COLORS[state.groups.length % GROUP_COLORS.length] };
    state.groups.push(group); save(); render();
    const input = document.querySelector(`.group-name[data-group-id="${group.id}"]`);
    input?.focus(); input?.select();
  }
  function deleteGroup(id) {
    if (state.groups.length <= 1) { showToast('至少保留一个分组'); return; }
    const before = structuredClone({ groups: state.groups, tasks: state.tasks, archive: state.archive });
    const group = state.groups.find(g => g.id === id);
    state.groups = state.groups.filter(g => g.id !== id);
    const fallback = state.groups[0];
    let moved = 0;
    for (const t of [...state.tasks, ...state.archive]) if (t.group === id) { t.group = fallback.id; moved++; }
    if (filter === id) filter = 'all';
    save(); render();
    showToast(`已删除“${group?.name || '分组'}”${moved ? `，${moved} 件移到“${fallback.name}”` : ''}`, () => { Object.assign(state, before); save(); render(); });
  }

  /* ---------- Review: what got done this week / month, as a table and as a designed image ---------- */
  const review = { period: 'week', offset: 0, group: 'all' };
  const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
  function reviewRange() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let start, end;
    if (review.period === 'week') {
      start = new Date(today); start.setDate(today.getDate() - (today.getDay() + 6) % 7 + review.offset * 7);
      end = new Date(start); end.setDate(start.getDate() + 7);
    } else {
      start = new Date(today.getFullYear(), today.getMonth() + review.offset, 1);
      end = new Date(today.getFullYear(), today.getMonth() + review.offset + 1, 1);
    }
    const days = [];
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return { start, end, days };
  }
  function reviewData() {
    const { start, end, days } = reviewRange();
    const inRange = state.log.filter(e => e.at >= start.getTime() && e.at < end.getTime());
    const entries = inRange.filter(e => review.group === 'all' || groupOf(e.group).id === review.group);
    const perDay = days.map(d => { const k = dayKey(d); return { date: d, key: k, items: entries.filter(e => dayKey(new Date(e.at)) === k) }; });
    const minutes = entries.reduce((sum, e) => sum + (e.min || 0), 0);
    const mix = state.groups.map(g => ({ group: g, count: inRange.filter(e => groupOf(e.group).id === g.id).length })).filter(m => m.count);
    const md = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });
    const last = new Date(end); last.setDate(last.getDate() - 1);
    const title = review.period === 'week' ? `${md.format(start)} – ${md.format(last)}` : `${start.getFullYear()}年${start.getMonth() + 1}月`;
    const relative = review.period === 'week' ? ['本周', '上周'][-review.offset] || `${-review.offset} 周前` : ['本月', '上个月'][-review.offset] || `${-review.offset} 个月前`;
    const elapsed = Math.max(1, Math.min(days.length, Math.ceil((Math.min(Date.now(), end.getTime()) - start.getTime()) / 864e5)));
    return { start, end, last, days, perDay, entries, minutes, mix, title, relative, activeDays: perDay.filter(d => d.items.length).length, elapsed, groupName: review.group === 'all' ? '全部' : groupOf(review.group).name };
  }
  const focusText = min => min >= 60 ? { value: (min / 60).toFixed(min % 60 ? 1 : 0), unit: '小时专注' } : { value: String(min), unit: '分钟专注' };
  function renderReview() {
    const d = reviewData();
    document.querySelectorAll('[data-period]').forEach(b => { b.classList.toggle('active', b.dataset.period === review.period); b.setAttribute('aria-pressed', String(b.dataset.period === review.period)); });
    $('review-range').textContent = d.title;
    $('review-range-sub').textContent = d.relative;
    $('review-next').disabled = review.offset >= 0;
    if (review.group !== 'all' && !state.groups.some(g => g.id === review.group)) review.group = 'all';
    $('review-groups').innerHTML = [{ id: 'all', name: '全部' }, ...state.groups].map(g => `<button type="button" class="chip${review.group === g.id ? ' active' : ''}" data-review-group="${esc(g.id)}" aria-pressed="${review.group === g.id}">${g.color ? `<span class="dot" style="background:${g.color}"></span>` : ''}${esc(g.name)}</button>`).join('');
    $('rs-count').textContent = String(d.entries.length);
    const f = focusText(d.minutes);
    $('rs-focus').textContent = f.value; $('rs-focus-unit').textContent = f.unit;
    $('rs-days').textContent = `${d.activeDays}`; $('rs-days-unit').textContent = `/ ${d.elapsed} 天有完成`;
    const max = Math.max(1, ...d.perDay.map(x => x.items.length));
    const month = review.period === 'month';
    $('review-chart').classList.toggle('is-month', month);
    $('review-chart').innerHTML = d.perDay.map(x => { const n = x.items.length, day = x.date.getDate(); const label = month ? ([1, 5, 10, 15, 20, 25, 30].includes(day) ? day : '') : WEEK_SHORT[x.date.getDay()]; return `<div class="bar${n === max && n ? ' is-top' : ''}${x.key === dayKey() ? ' is-today' : ''}" title="${x.date.getMonth() + 1}月${day}日 · ${n} 件"><span class="bar-val">${n || ''}</span><i style="--h:${n / max}"></i><span class="bar-label">${label}</span></div>`; }).join('');
    const mixTotal = d.mix.reduce((s, m) => s + m.count, 0);
    $('review-mix-card').hidden = !mixTotal;
    $('review-mix').innerHTML = d.mix.map(m => `<i style="flex:${m.count};background:${m.group.color}"></i>`).join('');
    $('review-legend').innerHTML = d.mix.map(m => `<span><span class="dot" style="background:${m.group.color}"></span>${esc(m.group.name)} ${m.count} · ${Math.round(m.count / mixTotal * 100)}%</span>`).join('');
    const wd = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const daysWith = [...d.perDay].reverse().filter(x => x.items.length);
    $('review-table').innerHTML = daysWith.length ? daysWith.map(x => `<div class="rt-day"><div class="rt-date"><span>${wd.format(x.date)}</span><span>${x.items.length} 件</span></div>${x.items.map(e => `<div class="rt-row"><span class="dot" style="background:${groupOf(e.group).color}"></span><span class="rt-title">${esc(e.title)}</span><span class="rt-min">${e.min ? durationText(e.min) : ''}</span></div>`).join('')}</div>`).join('')
      : `<div class="review-empty">${icon('calendar-check')}<span>${review.offset === 0 ? '这段时间还没有完成的事，完成后会出现在这里。' : '这段时间没有完成记录。'}</span></div>`;
    $('review-export').disabled = !d.entries.length;
    icons($('review-panel'));
  }

  /* Poster: a 1080px-wide image drawn on a canvas, so it looks the same on every phone. */
  function loadImage(src) { return new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; }); }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function fitText(ctx, text, width) { if (ctx.measureText(text).width <= width) return text; let t = text; while (t.length && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1); return `${t}…`; }
  async function drawPoster(d) {
    const W = 1080, P = 72, F = '-apple-system, "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
    const font = (w, s) => `${w} ${s}px ${F}`;
    const accent = palette[state.settings.accent][0];
    const daysWith = [...d.perDay].reverse().filter(x => x.items.length);
    const MAX_ROWS = 36;
    let rows = 0; const blocks = [];
    for (const x of daysWith) { if (rows >= MAX_ROWS) break; const items = x.items.slice(0, MAX_ROWS - rows); rows += items.length; blocks.push({ ...x, items }); }
    const hidden = d.entries.length - rows;
    const tableH = blocks.reduce((h, b) => h + 70 + b.items.length * 66, 0) + (hidden > 0 ? 64 : 0) + 120;
    const H = 640 + 420 + (d.mix.length ? 230 : 0) + tableH + 200;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // paper
    ctx.fillStyle = '#f4f2ec'; ctx.fillRect(0, 0, W, H);
    // hero
    const g = ctx.createLinearGradient(0, 0, W, 640); g.addColorStop(0, '#1d7058'); g.addColorStop(.6, '#0f4d3c'); g.addColorStop(1, '#082a20');
    ctx.fillStyle = g; roundRect(ctx, 0, 0, W, 640, [0, 0, 56, 56]); ctx.fill();
    // fragments ring (the 碎点 mark), large and faint on the right
    for (let i = 0; i < 18; i++) { const a = (-80 + i * 19) * Math.PI / 180, t = i / 17; ctx.globalAlpha = .08 + t * .22; ctx.fillStyle = '#bff0d8'; ctx.beginPath(); ctx.arc(860 + 210 * Math.cos(a), 250 + 210 * Math.sin(a), 6 + t * 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const logo = await loadImage('icons/icon-192.png');
    if (logo) { ctx.save(); roundRect(ctx, P, 74, 72, 72, 18); ctx.clip(); ctx.drawImage(logo, P, 74, 72, 72); ctx.restore(); }
    ctx.fillStyle = '#ffffffcc'; ctx.font = font(600, 28); ctx.fillText('碎碎清单', P + 92, 122);
    ctx.fillStyle = '#9fe1c4'; ctx.font = font(700, 24); ctx.fillText((review.period === 'week' ? 'WEEKLY  REVIEW' : 'MONTHLY  REVIEW').split('').join(String.fromCharCode(8202)), P, 232);
    ctx.fillStyle = '#fff'; ctx.font = font(800, 92); ctx.fillText(review.period === 'week' ? '本周回顾' : '本月回顾', P, 336);
    ctx.fillStyle = '#ffffffb3'; ctx.font = font(500, 34); ctx.fillText(`${d.title}${d.groupName !== '全部' ? ` · ${d.groupName}` : ''}`, P, 396);
    const f = focusText(d.minutes);
    [[String(d.entries.length), '件完成'], [f.value, f.unit], [`${d.activeDays}/${d.elapsed}`, '天有完成']].forEach(([v, u], i) => {
      const x = P + i * 330;
      ctx.fillStyle = '#fff'; ctx.font = font(800, 84); ctx.fillText(v, x, 540);
      ctx.fillStyle = '#ffffffa6'; ctx.font = font(500, 28); ctx.fillText(u, x, 588);
    });
    // chart card
    let y = 680;
    const card = (h) => { ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#0b2a2014'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; roundRect(ctx, 40, y, W - 80, h, 40); ctx.fill(); ctx.shadowColor = 'transparent'; };
    card(380);
    ctx.fillStyle = '#1c1c1e'; ctx.font = font(700, 34); ctx.fillText('每天完成', P + 8, y + 70);
    const max = Math.max(1, ...d.perDay.map(x => x.items.length));
    const n = d.perDay.length, cx0 = P + 8, cw = W - 2 * (P + 8), slot = cw / n, bw = Math.min(64, slot * .62), base = y + 300;
    d.perDay.forEach((x, i) => {
      const c = x.items.length, h = c ? Math.max(10, (c / max) * 170) : 6, bx = cx0 + i * slot + (slot - bw) / 2;
      ctx.fillStyle = c === max && c ? accent : (c ? '#bfe2d2' : '#e8ebe8'); roundRect(ctx, bx, base - h, bw, h, Math.min(16, bw / 2)); ctx.fill();
      if (c && (n <= 7 || c === max)) { ctx.fillStyle = '#3a4a42'; ctx.font = font(700, n <= 7 ? 28 : 22); ctx.textAlign = 'center'; ctx.fillText(String(c), bx + bw / 2, base - h - 14); ctx.textAlign = 'left'; }
      const day = x.date.getDate(); const lab = n <= 7 ? `周${WEEK_SHORT[x.date.getDay()]}` : ([1, 5, 10, 15, 20, 25, 30].includes(day) ? String(day) : '');
      if (lab) { ctx.fillStyle = '#8a958f'; ctx.font = font(500, 24); ctx.textAlign = 'center'; ctx.fillText(lab, bx + bw / 2, base + 44); ctx.textAlign = 'left'; }
    });
    y += 420;
    // mix card
    if (d.mix.length) {
      card(190);
      ctx.fillStyle = '#1c1c1e'; ctx.font = font(700, 34); ctx.fillText('分组占比', P + 8, y + 70);
      const total = d.mix.reduce((s, m) => s + m.count, 0); let bx = P + 8; const bwid = W - 2 * (P + 8);
      ctx.save(); roundRect(ctx, bx, y + 96, bwid, 22, 11); ctx.clip();
      d.mix.forEach(m => { const w = bwid * m.count / total; ctx.fillStyle = m.group.color; ctx.fillRect(bx, y + 96, w + 1, 22); bx += w; });
      ctx.restore();
      let lx = P + 8; ctx.font = font(500, 26);
      d.mix.forEach(m => { const label = `${m.group.name} ${m.count} · ${Math.round(m.count / total * 100)}%`; ctx.fillStyle = m.group.color; ctx.beginPath(); ctx.arc(lx + 8, y + 155, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4a5550'; ctx.fillText(label, lx + 24, y + 164); lx += ctx.measureText(label).width + 64; });
      y += 230;
    }
    // table card
    card(tableH);
    ctx.fillStyle = '#1c1c1e'; ctx.font = font(700, 34); ctx.fillText('做了什么', P + 8, y + 70);
    let ty = y + 120;
    const wd = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' });
    if (!blocks.length) { ctx.fillStyle = '#8a958f'; ctx.font = font(500, 28); ctx.fillText('这段时间还没有完成记录', P + 8, ty + 20); }
    blocks.forEach(b => {
      ctx.fillStyle = '#8a958f'; ctx.font = font(600, 24); ctx.fillText(wd.format(b.date), P + 8, ty + 28);
      ctx.textAlign = 'right'; ctx.fillText(`${b.items.length} 件`, W - P - 8, ty + 28); ctx.textAlign = 'left';
      ty += 54;
      b.items.forEach((e, i) => {
        if (i) { ctx.fillStyle = '#eceeed'; ctx.fillRect(P + 40, ty - 4, W - 2 * P - 48, 2); }
        ctx.fillStyle = groupOf(e.group).color; ctx.beginPath(); ctx.arc(P + 16, ty + 28, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f2a25'; ctx.font = font(500, 32);
        const minText = e.min ? durationText(e.min) : '';
        ctx.fillText(fitText(ctx, e.title, W - 2 * P - 80 - (minText ? 150 : 0)), P + 44, ty + 40);
        if (minText) { ctx.fillStyle = accent; ctx.font = font(600, 26); ctx.textAlign = 'right'; ctx.fillText(minText, W - P - 8, ty + 38); ctx.textAlign = 'left'; }
        ty += 66;
      });
      ty += 16;
    });
    if (hidden > 0) { ctx.fillStyle = '#8a958f'; ctx.font = font(500, 26); ctx.fillText(`… 还有 ${hidden} 件`, P + 44, ty + 24); }
    // footer
    const fy = H - 96;
    ctx.fillStyle = '#9aa39e'; ctx.font = font(500, 24);
    ctx.fillText('碎碎清单 · 小事一件一件做完', P, fy);
    ctx.textAlign = 'right'; ctx.fillText(`生成于 ${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date())}`, W - P, fy); ctx.textAlign = 'left';
    return canvas;
  }
  let posterBlob = null, posterName = '';
  async function exportPoster() {
    const d = reviewData();
    const canvas = await drawPoster(d);
    posterName = `碎碎清单-${review.period === 'week' ? '周' : '月'}回顾-${dayKey(d.start)}.png`;
    const url = canvas.toDataURL('image/png');
    posterBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    $('poster-image').src = url;
    $('poster-note').textContent = PREVIEW ? '预览页不能直接保存：在手机上长按图片即可保存到相册。' : isIOS() ? '点“保存图片”后选“存储图像”，或长按图片保存到相册。' : '';
    $('poster-save').hidden = PREVIEW;
    $('poster-dialog').showModal(); icons($('poster-dialog'));
  }
  async function savePoster() {
    if (!posterBlob) return;
    if (ANDROID?.saveImage) {
      const url = $('poster-image').src;
      try { ANDROID.saveImage(url.slice(url.indexOf(',') + 1), posterName); } catch { showToast('保存失败，请长按图片保存'); }
      return;
    }
    const file = new File([posterBlob], posterName, { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '碎碎清单回顾' }); return; } } catch (error) { if (error?.name === 'AbortError') return; }
    const url = URL.createObjectURL(posterBlob), a = document.createElement('a');
    a.href = url; a.download = posterName; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('图片已保存');
  }
  window.suisuiImageSaved = ok => showToast(ok ? '已保存到相册（图片 / 碎碎清单）' : '没有保存');

  /* ---------- Quick add: understands 明天 / 周五 / 11月5日 / 每天 / 工作日 / 每周三 / 30分钟 / 1小时 / #分组 ---------- */
  const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function cnNumber(s) {
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === '半') return .5;
    if (!/^[零一二两三四五六七八九十]+$/.test(s)) return NaN;
    if (s.includes('十')) { const [a, b] = s.split('十'); return (a ? CN_NUM[a] : 1) * 10 + (b ? CN_NUM[b] : 0); }
    return [...s].reduce((n, c) => n * 10 + CN_NUM[c], 0);
  }
  const DAY_CN = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  function parseQuick(text) {
    let rest = ` ${text} `;
    const found = {}, hits = [];
    const take = (re, fn) => { const m = rest.match(re); if (!m) return; if (fn(m) !== false) { rest = rest.replace(m[0], ' '); hits.push(m[0].trim()); } };
    const today = dayKey();
    // Clock time: 下午3点 / 3点半 / 晚上8点15 / 15:30 / 9：00
    take(/(明早|明晚|明天早上|明天晚上|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|凌晨)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:[:：](\d{2})|点(?:钟)?\s*(半|一刻|三刻|(\d{1,2}|[一二三四五六七八九十]+)\s*分?(?!钟))?)/, m => {
      let h = cnNumber(m[2]); if (!(h >= 0 && h <= 24)) return false;
      if (!m[1] && !m[3] && !/点/.test(m[0])) return false;
      let min = m[3] ? Number(m[3]) : m[4] === '半' ? 30 : m[4] === '一刻' ? 15 : m[4] === '三刻' ? 45 : m[5] ? cnNumber(m[5]) : 0;
      if (!(min >= 0 && min < 60)) return false;
      if (/下午|傍晚|晚上|今晚|明晚/.test(m[1] || '') && h < 12) h += 12;
      if (m[1] === '中午' && h < 11) h += 12;
      if (h === 24) h = 0;
      found.time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      if (m[1] === '今晚') found.date = today;
      if (/^明/.test(m[1] || '')) found.date = addDays(today, 1);
    });
    take(/(\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:个)?\s*(小时|钟头|h)(?:半)?/i, m => { const n = cnNumber(m[1]); if (!(n > 0)) return false; found.duration = Math.round(n * 60 + (m[0].endsWith('半') ? 30 : 0)); });
    if (!found.duration) take(/半小时/, () => { found.duration = 30; });
    if (!found.duration) take(/(\d+|[一二两三四五六七八九十]+)\s*(分钟|分|min|m)(?![a-z])/i, m => { const n = cnNumber(m[1]); if (!(n > 0) || n > 600) return false; found.duration = Math.round(n); });
    take(/每(?:个)?工作日|工作日/, () => { found.repeat = 'weekdays'; });
    if (!found.repeat) take(/每天|每日|天天/, () => { found.repeat = 'daily'; });
    if (!found.repeat) take(/每(?:周|星期|礼拜)([一二三四五六日天])/, m => { found.repeat = 'weekly'; found.repeatDay = DAY_CN[m[1]]; });
    if (!found.repeat) {
      take(/大后天/, () => { found.date = addDays(today, 3); });
      if (!found.date) take(/后天/, () => { found.date = addDays(today, 2); });
      if (!found.date) take(/明天|明日/, () => { found.date = addDays(today, 1); });
      if (!found.date) take(/今天|今日/, () => { found.date = today; });
      else take(/今天|今日/, () => {});
      if (!found.date) take(/(下)?(?:周|星期|礼拜)([一二三四五六日天])/, m => {
        const target = DAY_CN[m[2]], now = weekday(today), mondayOffset = (now + 6) % 7;
        let diff = ((target + 6) % 7) - mondayOffset; // days from today within this Mon–Sun week
        if (m[1]) diff += 7; else if (diff < 0) diff += 7;
        found.date = addDays(today, diff);
      });
      if (!found.date) take(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?|(\d{1,2})\/(\d{1,2})(?!\d)/, m => {
        const mo = Number(m[1] || m[3]), d = Number(m[2] || m[4]); if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
        const y = new Date().getFullYear(); let key = dayKey(new Date(y, mo - 1, d)); if (key < today) key = dayKey(new Date(y + 1, mo - 1, d));
        found.date = key;
      });
    }
    take(/[#＃](\S+)/, m => { const g = state.groups.find(x => x.name === m[1] || x.name.toLowerCase() === m[1].toLowerCase()); if (!g) return false; found.group = g.id; });
    const title = rest.replace(/\s+/g, ' ').trim().replace(/^[，,、\s]+|[，,、\s]+$/g, '');
    return { ...found, title, hits };
  }
  // Keeps what the user tapped in the chips, so typing only overrides what the text actually says.
  const addManual = { when: 'today', date: '', repeat: 'none', duration: 0, custom: false, time: '', customTime: false };
  let quickOff = false;
  function applyQuickParse() {
    const raw = $('task-input').value;
    const p = quickOff ? { title: raw.trim(), hits: [] } : parseQuick(raw);
    const date = p.date ?? null;
    if (date === null) { $('task-when').value = addManual.when; $('task-date').value = addManual.date; }
    else if (date === dayKey()) { $('task-when').value = 'today'; }
    else if (date === addDays(dayKey(), 1)) { $('task-when').value = 'tomorrow'; }
    else { $('task-when').value = 'pick'; $('task-date').value = date; }
    $('task-repeat').value = p.repeat || addManual.repeat;
    const duration = p.duration ?? addManual.duration;
    $('task-duration').value = String(duration);
    customDuration.add = p.duration ? !DURATIONS.includes(p.duration) : addManual.custom;
    if (customDuration.add) $('task-duration-custom').value = String(duration || '');
    if (p.group) addGroupId = p.group;
    $('task-time').value = p.time || addManual.time;
    quickRepeatDay = p.repeat === 'weekly' ? p.repeatDay : null;
    const bits = [];
    if (p.repeat) bits.push(p.repeat === 'weekly' ? `每周${WEEK[p.repeatDay].slice(1)}` : repeats[p.repeat]);
    if (p.date) bits.push(dateLabel(p.date));
    if (p.time) bits.push(`${p.time} 提醒`);
    if (p.duration) bits.push(durationText(p.duration));
    if (p.group) bits.push(groupOf(p.group).name);
    $('parse-hint').hidden = !bits.length;
    $('parse-hint').innerHTML = bits.length ? `${icon('sparkles')}<span>已识别：${bits.map(esc).join(' · ')}</span><button type="button" class="parse-off" id="parse-off">保留原文</button>` : '';
    renderAddChips(); icons($('add-form'));
    return p;
  }
  let quickRepeatDay = null;

  /* ---------- Reminders: tasks with a time ring on the day they are due ---------- */
  // Android schedules real alarms natively (works with the app closed); here the open app shows them too.
  const fired = new Set();
  function reminderAt(t, key = dayKey()) { if (!t.time) return 0; const [y, m, d] = key.split('-').map(Number), [hh, mm] = t.time.split(':').map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); }
  function checkReminders() {
    const now = Date.now();
    for (const t of pending()) {
      const at = reminderAt(t); const key = `${t.id}@${at}`;
      if (!at || now < at || now - at > 120000 || fired.has(key)) continue;
      fired.add(key);
      haptic('done');
      try { navigator.vibrate?.([80, 60, 80]); } catch { /* optional */ }
      showToast(`⏰ ${t.time} ${t.title}`, () => {
        const button = document.querySelector(`.task-row[data-task-id="${CSS.escape(t.id)}"] .check-task`);
        if (button) complete(t.id, button); else if (!t.done) { markDone(t); save(); render(); }
      }, '完成', 60000);
      if (!ANDROID && document.visibilityState === 'hidden' && notifySupported() && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(r => r.showNotification(`⏰ ${t.time} ${t.title}`, { tag: `remind-${t.id}`, icon: 'icons/icon-192.png', data: { url: './' } })).catch(() => {});
      }
    }
  }
  setInterval(checkReminders, 15000);

  /* ---------- Search: tasks, notes, subtasks and history ---------- */
  function openSearch() {
    if (document.body.dataset.view !== 'tasks') setView('tasks');
    document.body.classList.add('searching');
    $('search-bar').hidden = false; $('search-input').value = ''; renderSearch();
    $('search-input').focus();
  }
  function closeSearch() {
    if (!document.body.classList.contains('searching')) return false;
    document.body.classList.remove('searching'); $('search-bar').hidden = true; $('search-results').hidden = true; $('search-input').blur();
    return true;
  }
  function renderSearch() {
    const q = $('search-input').value.trim().toLowerCase();
    const box = $('search-results');
    box.hidden = false;
    if (!q) { box.innerHTML = `<p class="search-tip">${icon('sparkles')}可以搜标题、备注、子任务，也能搜到历史里完成过的事。</p>`; icons(box); return; }
    const hit = t => [t.title, t.note, ...(t.subtasks || []).map(s => s.title)].some(v => v && v.toLowerCase().includes(q));
    const open = state.tasks.filter(t => !t.done && hit(t)), done = state.tasks.filter(t => t.done && hit(t)), old = state.archive.filter(hit).slice(-30).reverse();
    const doneRow = (t, label) => `<div class="done-row">${icon('circle-check')}<s class="done-text">${esc(t.title)}</s><span class="archive-date">${label}</span></div>`;
    const fmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
    box.innerHTML = (open.length ? `<div class="list-heading"><span>待完成</span><span>${open.length}</span></div><div class="task-list">${open.map(row).join('')}</div>` : '')
      + (done.length ? `<div class="list-heading"><span>今天已完成</span><span>${done.length}</span></div>${done.map(t => doneRow(t, '今天')).join('')}` : '')
      + (old.length ? `<div class="list-heading"><span>历史</span><span>${old.length}</span></div>${old.map(t => doneRow(t, fmt.format(t.completedAt || t.archivedAt))).join('')}` : '')
      || `<div class="empty-state">${icon('search-x')}<span>没有找到“${esc($('search-input').value.trim())}”</span></div>`;
    icons(box);
  }

  /* ---------- Timer: tasks with a duration get a start button and a countdown ---------- */
  // One timer at a time. state.timer = { id, total, endsAt (running) | left (paused) }; it survives reloads,
  // and the Android app shows it as a countdown notification with an alarm when it ends.
  const DURATIONS = [15, 25, 30, 45, 60];
  const timerLeft = t => t ? (t.endsAt ? Math.max(0, t.endsAt - Date.now()) : t.left) : 0;
  const clockText = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const durationText = min => min >= 60 && min % 60 === 0 ? `${min / 60}小时` : `${min}分钟`;
  function syncNativeTimer() {
    if (!ANDROID?.setTimer) return;
    const t = state.timer, task = t && state.tasks.find(x => x.id === t.id);
    try { ANDROID.setTimer(t && task ? JSON.stringify({ title: task.title, endsAt: t.endsAt, left: t.left, total: t.total }) : ''); } catch { /* optional */ }
  }
  /** Stop the current timer and credit the time spent to its task (all of it when it ran out). */
  function settleTimer(finished) {
    const t = state.timer;
    if (!t) return;
    const task = state.tasks.find(x => x.id === t.id);
    if (task) task.focusMs = (task.focusMs || 0) + (finished ? t.total : Math.max(0, t.total - timerLeft(t)));
    state.timer = null;
    syncNativeTimer();
  }
  function startTimer(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.done || !task.duration) return;
    const t = state.timer;
    if (t && t.id === id) { // pause / resume
      if (t.endsAt) { t.left = timerLeft(t); t.endsAt = 0; showToast('已暂停计时'); }
      else { t.endsAt = Date.now() + t.left; t.left = 0; }
    } else {
      if (t) settleTimer(false);
      state.timer = { id, total: task.duration * 60000, endsAt: Date.now() + task.duration * 60000, left: 0 };
      showToast(`开始计时：${task.title} · ${durationText(task.duration)}`);
    }
    haptic();
    syncNativeTimer(); save(); render(); tickTimer();
  }
  function stopTimer() {
    if (!state.timer) return;
    settleTimer(false); save(); render(); showToast('已结束计时');
  }
  function finishTimer() {
    const t = state.timer, task = t && state.tasks.find(x => x.id === t.id);
    settleTimer(true); save(); render();
    if (!task) return;
    haptic('done');
    try { navigator.vibrate?.([120, 80, 120]); } catch { /* optional */ }
    showToast(`时间到：${task.title}`, () => {
      const button = document.querySelector(`.task-row[data-task-id="${CSS.escape(task.id)}"] .check-task`) || document.querySelector(`.lock-task[data-id="${CSS.escape(task.id)}"]`);
      if (button) complete(task.id, button); else if (!task.done) { markDone(task); save(); render(); }
    }, '标记完成', 15000);
  }
  // Live update of every countdown on screen, once a second while a timer runs.
  function tickTimer() {
    const t = state.timer;
    if (!t) return;
    const left = timerLeft(t);
    if (t.endsAt && left <= 0) { finishTimer(); return; }
    document.querySelectorAll('[data-timer-text]').forEach(el => { el.textContent = clockText(left); });
    document.querySelectorAll('[data-timer-progress]').forEach(el => { el.style.setProperty('--p', String(1 - left / t.total)); });
  }
  setInterval(tickTimer, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tickTimer(); });
  // Always-visible focus bar while a timer runs: above the tab bar in the app, under the clock on the lock view.
  function renderFocusBar() {
    const t = state.timer, task = t && state.tasks.find(x => x.id === t.id);
    const bar = $('focus-bar');
    bar.hidden = !task;
    document.body.classList.toggle('has-focus', !!task);
    if (!task) return;
    $('focus-title').textContent = task.title;
    $('focus-state').textContent = t.endsAt ? '专注中' : '已暂停';
    bar.classList.toggle('is-paused', !t.endsAt);
    $('focus-toggle').innerHTML = icon(t.endsAt ? 'pause' : 'play');
    $('focus-toggle').setAttribute('aria-label', t.endsAt ? '暂停计时' : '继续计时');
    icons(bar);
    tickTimer();
  }
  function timerPill(t, cls = 'timer-pill') {
    if (!t.duration || t.done) return '';
    const run = state.timer?.id === t.id ? state.timer : null;
    if (!run) return `<button class="${cls}" data-action="timer" data-id="${esc(t.id)}" aria-label="开始计时 ${durationText(t.duration)}：${esc(t.title)}">${icon('play')}<span>${t.duration >= 60 && t.duration % 60 === 0 ? `${t.duration / 60}小时` : `${t.duration}分`}</span></button>`;
    const left = timerLeft(run);
    return `<button class="${cls} is-on${run.endsAt ? ' is-running' : ' is-paused'}" data-action="timer" data-id="${esc(t.id)}" data-timer-progress style="--p:${1 - left / run.total}" aria-label="${run.endsAt ? '暂停' : '继续'}计时：${esc(t.title)}">${icon(run.endsAt ? 'pause' : 'play')}<span data-timer-text>${clockText(left)}</span></button>`;
  }

  /* ---------- Feel: haptics, swipe rows ---------- */
  // A short tick when a gesture arms and when a task is done. Android app: native haptics; Android Chrome: vibrate.
  function haptic(kind = 'tick') {
    try { if (ANDROID?.haptic) ANDROID.haptic(kind); else navigator.vibrate?.(kind === 'done' ? 14 : 6); } catch { /* optional */ }
  }
  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const index = state.tasks.indexOf(task);
    if (state.timer?.id === id) { state.timer = null; syncNativeTimer(); }
    state.tasks.splice(index, 1); closeEdit(); save(); render();
    showToast('已删除待办', () => { state.tasks.splice(Math.min(index, state.tasks.length), 0, task); save(); render(); });
  }
  // Swipe a row right to finish it, left to delete it (undo in the toast). Vertical scrolling is untouched.
  const SWIPE_ARM = 84;
  let swipe = null, swallowClick = false;
  function endSwipe(commit) {
    if (!swipe) return;
    const { row, dx, armed } = swipe;
    swipe = null;
    row.classList.remove('swiping');
    if (commit && armed) {
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 350);
      row.style.removeProperty('--dx'); delete row.dataset.swipe; row.classList.remove('armed');
      const id = row.dataset.taskId;
      if (dx > 0) complete(id, row.querySelector('.check-task'));
      else { haptic('done'); deleteTask(id); }
      return;
    }
    if (Math.abs(dx) > 6) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 350); }
    row.classList.add('settling'); row.style.setProperty('--dx', '0px');
    setTimeout(() => { row.classList.remove('settling', 'armed'); delete row.dataset.swipe; row.style.removeProperty('--dx'); }, 220);
  }
  // Long press (or right click) on a task: quick actions without opening the editor.
  let pressTimer = null;
  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
  function openQuickMenu(id) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    haptic();
    const today = dayKey(), running = state.timer?.id === id;
    const actions = [
      t.duration && !t.done ? ['timer', running ? (state.timer.endsAt ? 'pause' : 'play') : 'play', running ? (state.timer.endsAt ? '暂停计时' : '继续计时') : `开始计时 · ${durationText(t.duration)}`] : null,
      ['pin', 'pin', t.pinned ? '取消置顶' : '置顶'],
      t.repeat === 'none' && t.date !== addDays(today, 1) ? ['tomorrow', 'sunrise', '明天再做'] : null,
      t.repeat === 'none' && t.date && t.date > today ? ['today', 'sun', '改到今天'] : null,
      ['edit', 'pencil', '编辑'],
      ['delete', 'trash-2', '删除', 'danger']
    ].filter(Boolean);
    $('quick-title').textContent = t.title;
    $('quick-actions').innerHTML = actions.map(([key, ic, label, cls]) => `<button class="quick-action${cls ? ` ${cls}` : ''}" data-quick="${key}" data-id="${esc(id)}">${icon(ic)}<span>${label}</span></button>`).join('');
    $('quick-menu').showModal(); icons($('quick-menu'));
  }
  $('quick-actions').addEventListener('click', event => {
    const b = event.target.closest('[data-quick]');
    if (!b) return;
    const id = b.dataset.id, t = state.tasks.find(x => x.id === id);
    $('quick-menu').close();
    if (!t) return;
    const before = { date: t.date, pinned: t.pinned };
    switch (b.dataset.quick) {
      case 'timer': startTimer(id); break;
      case 'pin': t.pinned = !t.pinned; save(); render(); showToast(t.pinned ? '已置顶' : '已取消置顶'); break;
      case 'tomorrow': t.date = addDays(dayKey(), 1); save(); render(); showToast('已移到明天', () => { t.date = before.date; save(); render(); }); break;
      case 'today': t.date = ''; save(); render(); showToast('已改到今天', () => { t.date = before.date; save(); render(); }); break;
      case 'edit': openEdit(id); break;
      case 'delete': deleteTask(id); break;
    }
  });
  document.addEventListener('contextmenu', event => {
    const row = event.target.closest('#task-list .task-row, #later-list .task-row');
    if (!row || LOCK_MODE) return;
    event.preventDefault(); cancelPress(); openQuickMenu(row.dataset.taskId);
  });
  // Long press lifts a row in today's list: drag to reorder (drag to the top to pin), or let go to get the menu.
  let drag = null;
  function liftRow(row, y, pointer) {
    swipe = null; swallowClick = true;
    haptic();
    const rows = [...$('task-list').querySelectorAll('.task-row')];
    drag = { row, id: row.dataset.taskId, y, pointer, dy: 0, moved: false, rows, from: rows.indexOf(row), to: rows.indexOf(row), h: row.offsetHeight };
    row.classList.add('lifted');
  }
  function moveDrag(y) {
    const d = drag; d.dy = y - d.y;
    if (Math.abs(d.dy) > 6) d.moved = true;
    d.row.style.transform = `translateY(${d.dy}px) scale(1.02)`;
    const center = d.row.offsetTop + d.h / 2 + d.dy;
    let to = 0;
    d.rows.forEach((r, i) => { if (r !== d.row && r.offsetTop + r.offsetHeight / 2 < center) to++; });
    if (to !== d.to) { d.to = to; haptic(); }
    d.rows.forEach((r, i) => {
      if (r === d.row) return;
      const shift = d.from < d.to ? (i > d.from && i <= d.to ? -d.h : 0) : (i >= d.to && i < d.from ? d.h : 0);
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }
  function endDrag(cancelled) {
    const d = drag; drag = null;
    if (!d) return;
    setTimeout(() => { swallowClick = false; }, 400);
    d.rows.forEach(r => { r.style.transform = ''; r.classList.remove('lifted'); });
    if (cancelled) return;
    if (!d.moved) { openQuickMenu(d.id); return; }
    if (d.to === d.from) return;
    const ids = d.rows.map(r => r.dataset.taskId);
    ids.splice(d.to, 0, ids.splice(d.from, 1)[0]);
    const task = state.tasks.find(t => t.id === d.id);
    // Dropped among the pinned rows → pinned; dragged below them → unpinned.
    const pinnedOthers = ids.filter(id => id !== d.id && state.tasks.find(t => t.id === id)?.pinned).length;
    if (task && pinnedOthers) task.pinned = d.to < pinnedOthers;
    // Put the visible tasks back into the slots they occupy in the full list, in the new order.
    const slots = state.tasks.map((t, i) => ids.includes(t.id) ? i : -1).filter(i => i >= 0);
    const moved = ids.map(id => state.tasks.find(t => t.id === id));
    slots.forEach((slot, k) => { state.tasks[slot] = moved[k]; });
    save(); render(); showToast('已调整顺序');
  }
  document.addEventListener('touchmove', event => { if (drag) event.preventDefault(); }, { passive: false });
  document.addEventListener('pointerdown', event => {
    const row = event.target.closest('#task-list .task-row, #later-list .task-row');
    if (!row || event.button !== 0 || completing.has(row.dataset.taskId) || LOCK_MODE) return;
    swipe = { row, x: event.clientX, y: event.clientY, dx: 0, horizontal: null, armed: false, pointer: event.pointerId };
    cancelPress();
    const y = event.clientY, pointer = event.pointerId, today = !!row.closest('#task-list');
    pressTimer = setTimeout(() => {
      pressTimer = null;
      if (!swipe || swipe.horizontal) return;
      if (today) liftRow(row, y, pointer);
      else { swipe = null; swallowClick = true; setTimeout(() => { swallowClick = false; }, 600); openQuickMenu(row.dataset.taskId); }
    }, 450);
  });
  document.addEventListener('pointermove', event => { if (drag && event.pointerId === drag.pointer) moveDrag(event.clientY); });
  document.addEventListener('pointerup', event => { cancelPress(); if (drag && event.pointerId === drag.pointer) endDrag(false); });
  document.addEventListener('pointercancel', () => { cancelPress(); if (drag) endDrag(true); });
  document.addEventListener('pointermove', event => {
    if (!swipe || event.pointerId !== swipe.pointer) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelPress();
    if (swipe.horizontal === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      swipe.horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (!swipe.horizontal) { swipe = null; return; }
      swipe.row.classList.add('swiping');
      try { swipe.row.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    const limit = swipe.row.clientWidth * .6;
    swipe.dx = Math.max(-limit, Math.min(limit, dx));
    swipe.row.dataset.swipe = swipe.dx > 0 ? 'done' : 'delete';
    swipe.row.style.setProperty('--dx', `${swipe.dx}px`);
    const armed = Math.abs(swipe.dx) >= SWIPE_ARM;
    if (armed !== swipe.armed) { swipe.armed = armed; swipe.row.classList.toggle('armed', armed); if (armed) haptic(); }
  });
  document.addEventListener('pointerup', event => { if (swipe && event.pointerId === swipe.pointer) endSwipe(swipe.horizontal === true); });
  document.addEventListener('pointercancel', () => endSwipe(false));
  document.addEventListener('click', event => { if (swallowClick && event.target.closest('.task-row')) { event.stopPropagation(); event.preventDefault(); } }, true);

  /* ---------- Events ---------- */
  document.addEventListener('click', (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.settingsPage) openSettingsPage(b.dataset.settingsPage);
    if (b.dataset.period) { review.period = b.dataset.period; review.offset = 0; renderReview(); }
    if (b.dataset.shift) { review.offset = Math.min(0, review.offset + Number(b.dataset.shift)); renderReview(); }
    if (b.dataset.reviewGroup) { review.group = b.dataset.reviewGroup; renderReview(); }
    if (b.dataset.addGroup) { addGroupId = b.dataset.addGroup; renderAddChips(); icons($('add-form')); }
    if (b.dataset.addWhen) {
      $('task-when').value = addManual.when = b.dataset.addWhen; renderAddChips(); icons($('add-form'));
      if (b.dataset.addWhen === 'pick') { const d = $('task-date'); d.min = dayKey(); if (!d.value) d.value = addDays(dayKey(), 2); try { d.showPicker(); } catch { d.focus(); } }
    }
    if (b.dataset.addRepeat) { $('task-repeat').value = addManual.repeat = b.dataset.addRepeat; renderAddChips(); icons($('add-form')); }
    if (b.dataset.addTime !== undefined) {
      addManual.customTime = b.dataset.addTime === 'custom';
      $('task-time').value = addManual.time = addManual.customTime ? ($('task-time-custom').value || '') : b.dataset.addTime;
      renderAddChips();
      if (addManual.customTime) { try { $('task-time-custom').showPicker(); } catch { $('task-time-custom').focus(); } }
    }
    if (b.dataset.editTime !== undefined) { $('edit-time').value = ''; }
    if (b.dataset.addDuration) {
      customDuration.add = b.dataset.addDuration === 'custom';
      $('task-duration').value = customDuration.add ? String(readCustom($('task-duration-custom')) || 0) : b.dataset.addDuration;
      addManual.duration = Number($('task-duration').value) || 0; addManual.custom = customDuration.add;
      renderAddChips();
      if (customDuration.add) $('task-duration-custom').focus();
    }
    if (b.dataset.editDuration) {
      const form = $('edit-form');
      customDuration.edit = b.dataset.editDuration === 'custom';
      form.elements.duration.value = customDuration.edit ? String(readCustom($('edit-duration-custom')) || 0) : b.dataset.editDuration;
      durationChips('edit', Number(form.elements.duration.value) || 0, $('edit-duration-custom'));
      if (customDuration.edit) $('edit-duration-custom').focus();
    }
    if (b.dataset.editGroup || b.dataset.editRepeat || b.dataset.editWhen) {
      const form = $('edit-form'), task = state.tasks.find(t => t.id === form.dataset.editId);
      if (b.dataset.editWhen) $('edit-date').value = b.dataset.editWhen === 'tomorrow' ? addDays(dayKey(), 1) : '';
      editChips(task, b.dataset.editGroup || form.elements.group.value, b.dataset.editRepeat || form.elements.repeat.value);
    }
    if (b.dataset.filter) { filter = b.dataset.filter; editing = null; render(); }
    if (b.dataset.font) { state.settings.font = b.dataset.font; save(); applySettings(); }
    if (b.dataset.font) { state.settings.font = b.dataset.font; save(); applySettings(); }
    if (b.dataset.density) { state.settings.density = b.dataset.density; save(); applySettings(); }
    if (b.dataset.wallpaper) { state.settings.wallpaper = b.dataset.wallpaper; state.settings.wallpaperPicked = true; save(); applySettings(); icons($('wallpaper-library')); }
    if (b.dataset.material) { state.settings.cardMaterial = b.dataset.material; save(); applyCardAppearance(); applySettings(); }
    if (b.dataset.cardText) { state.settings.cardText = b.dataset.cardText; save(); applyCardAppearance(); }
    if (b.dataset.cardColor) { state.settings.cardColor = b.dataset.cardColor; save(); applySettings(); }
    if (b.dataset.themePreset) {
      const { name, ...values } = THEMES[b.dataset.themePreset];
      Object.assign(state.settings, values); save(); applySettings(); showToast(`已换成“${name}”主题`);
    }
    if (b.dataset.groupColor) { const g = state.groups.find(x => x.id === b.dataset.groupId); if (g) { g.color = b.dataset.groupColor; save(); render(); } }
    if (b.dataset.groupDelete) deleteGroup(b.dataset.groupDelete);
    const id = b.dataset.id, task = state.tasks.find(t => t.id === id);
    switch (b.dataset.action) {
      case 'complete': complete(id, b); break;
      case 'pin': if (task) { task.pinned = !task.pinned; save(); render(); } break;
      case 'edit': openEdit(id); break;
      case 'timer': startTimer(id); break;
      case 'first-add': openAdd(); break;
      case 'timer-stop': stopTimer(); break;
      case 'cancel-edit': closeEdit(); break;
      case 'restore': if (task) { unmarkDone(task); save(); render(); const restored = [...$('activity-list').querySelectorAll('button')].find(el => el.dataset.id === id); if (b.classList.contains('lock-task')) restored?.focus({ preventScroll: true }); showToast('已恢复到待完成'); } break;
      case 'delete': deleteTask(id); break;
      case 'unarchive': {
        const index = state.archive.findIndex(t => t.id === id);
        if (index < 0) break;
        const [item] = state.archive.splice(index, 1);
        const { archivedAt, ...restored } = item;
        if (state.tasks.some(t => t.id === restored.id)) restored.id = newId();
        state.tasks.push({ ...restored, done: false, completedAt: 0, date: '' });
        save(); render(); showToast('已放回今天');
        break;
      }
    }
  });
  function chosenDate() {
    const when = $('task-when').value;
    if (when === 'tomorrow') return addDays(dayKey(), 1);
    if (when === 'pick') return isDayKey($('task-date').value) ? $('task-date').value : null;
    return '';
  }
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    const parsed = applyQuickParse();
    const title = (parsed.title || $('task-input').value).trim();
    if (!title) { $('form-error').textContent = '请先写下待办内容。'; return; }
    const date = chosenDate();
    if (date === null) { $('form-error').textContent = '请选择一个日期。'; return; }
    const repeat = repeats[$('task-repeat').value] ? $('task-repeat').value : 'none';
    const task = normalizeTask({ id: newId(), title, group: addGroupId, duration: Number($('task-duration').value) || 0, time: $('task-time').value, repeat, repeatDay: quickRepeatDay ?? weekday(date || dayKey()), date: repeat === 'none' ? date : '', createdAt: Date.now() });
    state.tasks.push(task);
    if (filter !== 'all' && filter !== task.group) filter = 'all';
    $('task-input').value = ''; $('form-error').textContent = '';
    // Back to the defaults for the next one; the group stays (people add several to one group).
    $('task-when').value = 'today'; $('task-repeat').value = 'none'; $('task-date').value = '';
    $('task-duration').value = '0'; $('task-duration-custom').value = ''; customDuration.add = false;
    Object.assign(addManual, { when: 'today', date: '', repeat: 'none', duration: 0, custom: false, time: '', customTime: false }); quickRepeatDay = null; quickOff = false;
    $('task-time').value = ''; $('task-time-custom').value = '';
    $('parse-hint').hidden = true;
    save(); render(); $('task-input').focus();
    const added = document.querySelector(`.task-row[data-task-id="${CSS.escape(task.id)}"]`);
    if (added && state.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) window.anime.animate(added, { opacity: [0, 1], y: [-10, 0], duration: 360, ease: 'outCubic' });
    showToast(dueToday(task) ? '待办已添加' : `已添加到“以后”：${repeat === 'none' ? dateLabel(task.date) : repeatLabel(task)}`);
    requestPersistence();
  });
  function onEditSubmit(event) {
    event.preventDefault();
    const task = state.tasks.find(t => t.id === event.target.dataset.editId);
    const data = new FormData(event.target), title = String(data.get('title')).trim();
    if (!task || !title) return;
    const repeat = repeats[data.get('repeat')] ? data.get('repeat') : 'none';
    const date = isDayKey(data.get('date')) ? data.get('date') : '';
    task.title = title.slice(0, 120);
    task.pinned = data.get('pinned') === 'on';
    task.time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(data.get('time'))) ? String(data.get('time')) : '';
    task.note = String(data.get('note') || '').slice(0, 2000);
    const duration = Math.round(Number(data.get('duration')) || 0);
    task.duration = duration > 0 && duration <= 600 ? duration : 0;
    if (state.timer?.id === task.id && !task.duration) { settleTimer(false); }
    task.group = groupOf(data.get('group')).id;
    if (repeat === 'weekly' && task.repeat !== 'weekly') task.repeatDay = weekday(date || dayKey());
    task.repeat = repeat;
    task.date = repeat === 'none' ? date : '';
    if (repeat !== 'weekly') task.repeatDay = null;
    closeEdit();
    save(); render(); showToast(dueToday(task) ? '已保存修改' : `已保存，${task.repeat === 'none' ? dateLabel(task.date) : repeatLabel(task)}出现`);
  }
  $('edit-form').addEventListener('submit', onEditSubmit);
  $('edit-subtasks').addEventListener('click', event => {
    const task = editingTask(); if (!task) return;
    const toggle = event.target.closest('[data-sub-toggle]'), del = event.target.closest('[data-sub-delete]');
    if (toggle) { const s = task.subtasks.find(x => x.id === toggle.dataset.subToggle); if (s) { s.done = !s.done; haptic(); } }
    else if (del) task.subtasks = task.subtasks.filter(x => x.id !== del.dataset.subDelete);
    else return;
    renderSubtasks(task); save(); render();
  });
  $('subtask-input').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const task = editingTask(), title = $('subtask-input').value.trim();
    if (!task || !title || task.subtasks.length >= 30) return;
    task.subtasks.push({ id: newId('s'), title: title.slice(0, 120), done: false });
    $('subtask-input').value = '';
    renderSubtasks(task); save(); render();
  });
  $('edit-note').addEventListener('input', () => { const task = editingTask(); if (task) { task.note = $('edit-note').value.slice(0, 2000); clearTimeout(window.__noteTimer); window.__noteTimer = setTimeout(() => { save(); render(); }, 500); } });
  $('task-duration-custom').addEventListener('input', () => { $('task-duration').value = String(readCustom($('task-duration-custom'))); addManual.duration = Number($('task-duration').value) || 0; });
  $('task-date').addEventListener('change', () => { addManual.date = $('task-date').value; });
  $('task-time-custom').addEventListener('change', () => { $('task-time').value = addManual.time = $('task-time-custom').value; });
  $('task-input').addEventListener('input', () => { if (!$('task-input').value.trim()) quickOff = false; applyQuickParse(); });
  $('parse-hint').addEventListener('click', event => { if (event.target.closest('#parse-off')) { quickOff = true; applyQuickParse(); $('task-input').focus(); } });
  $('edit-duration-custom').addEventListener('input', () => { $('edit-form').elements.duration.value = String(readCustom($('edit-duration-custom'))); });
  $('edit-sheet').addEventListener('close', () => { editing = null; });
  $('edit-date').addEventListener('change', () => { const f = $('edit-form'); editChips(null, f.elements.group.value, f.elements.repeat.value); });
  $('group-list').addEventListener('change', event => {
    const input = event.target.closest('.group-name');
    if (!input) return;
    const g = state.groups.find(x => x.id === input.dataset.groupId);
    const name = input.value.trim().slice(0, 12);
    if (!g) return;
    if (!name) { input.value = g.name; return; }
    g.name = name; input.blur(); save(); render();
  });
  $('group-list').addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches('.group-name')) event.target.blur(); });
  $('group-list').addEventListener('focusout', event => { if (event.target.matches('.group-name')) setTimeout(renderGroupSettings, 0); });
  $('add-group').addEventListener('click', addGroup);
  $('undo-button').addEventListener('click', () => { const action = undoAction; hideToast(); action?.(); });
  $('close-toast').addEventListener('click', hideToast);
  ['see-all', 'preview-list-button'].forEach(id => $(id).addEventListener('click', () => setView('tasks')));
  $('fab-add').addEventListener('click', openAdd);
  $('focus-toggle').addEventListener('click', () => state.timer && startTimer(state.timer.id));
  $('focus-stop').addEventListener('click', stopTimer);
  $('focus-done').addEventListener('click', () => {
    const id = state.timer?.id, task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const button = document.querySelector(`.task-row[data-task-id="${CSS.escape(id)}"] .check-task`) || document.querySelector(`.lock-task[data-id="${CSS.escape(id)}"]`);
    if (button) complete(id, button); else { markDone(task); save(); render(); showToast('已完成一项待办', () => { unmarkDone(task); save(); render(); }); }
  });
  $('open-review').addEventListener('click', () => setView('review'));
  $('open-search').addEventListener('click', openSearch);
  $('search-cancel').addEventListener('click', closeSearch);
  $('search-input').addEventListener('input', renderSearch);
  $('review-back').addEventListener('click', () => setView('tasks'));
  $('review-export').addEventListener('click', exportPoster);
  $('poster-save').addEventListener('click', savePoster);
  $('close-poster').addEventListener('click', () => $('poster-dialog').close());
  $('tips-close').addEventListener('click', () => { state.settings.tipsSeen = true; save(); render(); });
  darkScheme.addEventListener?.('change', applySettings);
  $('add-backdrop').addEventListener('click', closeAdd);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAdd(); });
  // Swipe the sheet down to close it.
  let sheetStart = null;
  $('add-form').addEventListener('touchstart', event => { sheetStart = event.target.closest('.sheet-grip, .add-input-line') ? event.touches[0].clientY : null; }, { passive: true });
  $('add-form').addEventListener('touchend', event => { if (sheetStart !== null && event.changedTouches[0].clientY - sheetStart > 60) closeAdd(); sheetStart = null; });
  $('settings-back').addEventListener('click', () => openSettingsPage('index'));
  const openAbout = () => $('about-dialog').showModal();
  $('about-button').addEventListener('click', openAbout);
  $('about-row').addEventListener('click', openAbout);
  $('close-about').addEventListener('click', () => $('about-dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog && (event.offsetX < 0 || event.offsetY < 0 || event.offsetX > dialog.offsetWidth || event.offsetY > dialog.offsetHeight)) dialog.close(); }));
  document.querySelectorAll('[name="accent"]').forEach(input => input.addEventListener('change', () => { state.settings.accent = input.value; save(); applySettings(); }));
  $('text-size').addEventListener('input', () => { state.settings.textSize = Number($('text-size').value); save(); applySettings(); });
  $('motion-toggle').addEventListener('change', () => { state.settings.motion = $('motion-toggle').checked; save(); applySettings(); });
  $('intensity').addEventListener('input', () => { state.settings.intensity = Number($('intensity').value); save(); applySettings(); });
  $('card-color').addEventListener('input', () => { state.settings.cardColor = $('card-color').value; applyCardAppearance(); save(); });
  $('card-transparency').addEventListener('input', () => { state.settings.cardTransparency = Number($('card-transparency').value); applyCardAppearance(); save(); });

  $('archive-toggle').addEventListener('change', () => { state.settings.autoArchive = $('archive-toggle').checked; save(); });
  $('privacy-toggle').addEventListener('change', () => { state.settings.lockPrivacy = $('privacy-toggle').checked; lastNotified = ''; save(); renderPreview(); icons(); showToast(state.settings.lockPrivacy ? '锁屏上只显示数量，解锁后才能看到内容' : '锁屏上会显示待办内容'); });
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
        if (step === 'battery') ANDROID.requestBatteryExemption();
        if (step === 'fullscreen') ANDROID.openFullScreenSettings();
      } catch { /* ignore */ }
    });
    window.suisuiAndroidResume = () => { renderNotifySetting(); save(); };
  }
  window.suisuiAndroidPermission = granted => { renderNotifySetting(); if (!granted && state.settings.lockNotify) showToast('没有通知权限，锁屏卡片无法显示'); };
  window.suisuiExportDone = ok => showToast(ok ? '已导出待办备份' : '没有导出');
  $('notify-test').addEventListener('click', () => {
    if (ANDROID) { try { ANDROID.openNotificationSettings(); } catch { /* ignore */ } return; }
    updateLockNotification(true); showToast(pending().length ? '已刷新锁屏通知，锁屏即可看到' : '全部完成，没有需要提醒的事项');
  });
  $('reset-settings').addEventListener('click', () => {
    const { autoArchive, lockNotify, lockScreen, lockPrivacy, installDismissed, androidSetupSeen, tipsSeen } = state.settings;
    state.settings = { ...defaults, autoArchive, lockNotify, lockScreen, lockPrivacy, installDismissed, androidSetupSeen, tipsSeen }; save(); applySettings(); showToast('已恢复默认外观');
  });
  $('wallpaper-file').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    $('wallpaper-error').textContent = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { $('wallpaper-error').textContent = '请选择 3MB 以内的 JPG、PNG 或 WebP 图片。'; return; }
    const reader = new FileReader();
    reader.onload = () => { state.settings.photo = reader.result; state.settings.wallpaper = 'custom'; state.settings.wallpaperPicked = true; save(); applySettings(); if (!photoOK) $('wallpaper-error').textContent = '图片太大，本机存储放不下，请换一张小一些的照片。'; };
    reader.onerror = () => { $('wallpaper-error').textContent = '未能读取这张图片，请重新选择。'; };
    reader.readAsDataURL(file);
    event.target.value = '';
  });
  $('reset-button').hidden = !DEMO; // sample list only in demo/test builds
  $('reset-button').addEventListener('click', () => {
    const previous = structuredClone({ tasks: state.tasks, groups: state.groups });
    state.tasks = examples(); state.groups = structuredClone(DEFAULT_GROUPS); closeEdit(); filter = 'all'; save(); render();
    showToast('已恢复示例清单', () => { state.tasks = previous.tasks; state.groups = previous.groups; save(); render(); });
  });
  $('clear-done').addEventListener('click', moveDoneToArchive);
  $('export-button').addEventListener('click', exportBackup);
  $('import-button').addEventListener('click', () => $('import-file').click());
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
    $('activity-list').addEventListener('click', event => { if (event.target.closest('#lock-reveal')) leave(true); });
    let startY = null;
    $('lockscreen').addEventListener('touchstart', event => { startY = event.target.closest('#activity') ? null : event.touches[0].clientY; }, { passive: true });
    $('lockscreen').addEventListener('touchend', event => { if (startY !== null && startY - event.changedTouches[0].clientY > 90) leave(false); startY = null; });
    window.suisuiLockShown = () => { $('activity-list').scrollTop = 0; clock(); };
  }
  let booted = false;
  rollover({ announce: false });
  booted = true;
  const params = new URLSearchParams(location.search);
  setView(LOCK_MODE ? 'tasks' : params.get('view')); if (params.get('page')) openSettingsPage(params.get('page')); render(); applySettings(); clock(); save(); renderInstallBanner();
  if (ANDROID && !LOCK_MODE && state.settings.lockScreen && !state.settings.androidSetupSeen) setTimeout(openAndroidSetup, 600);
  if (isStandalone()) requestPersistence();
  else navigator.storage?.persisted?.().then(value => { persisted = value; $('storage-status').textContent = storageCopy(); }).catch(() => {});
  setInterval(clock, 30000);
  // Test and support hook: lets automated checks and support staff inspect the state without touching storage.
  window.suisui = { dayKey, rollover: () => rollover(), notificationContent, dueToday, version: SCHEMA };
})();
