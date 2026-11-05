/* 碎碎清单 motion layer (1.15).
   - Every tappable thing presses in and springs back (CSS `scale`, so it stacks with any transform the element already has).
   - The icon inside a tapped control plays a small animation that fits the icon: the gear turns, + turns into ×,
     the bell rings, the bin shakes, arrows nudge, checks pop, repeat spins...
   - Chips, swatches and switches pop when they become selected.
   Off when the in-app 动效 setting is off (html[data-motion=off]) or the system asks for reduced motion. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const on = () => document.documentElement.dataset.motion !== 'off' && !reduce.matches;
  const TAPPABLE = 'button, a[href], [role=button], label.chip, label.switch, label.swatch, .swatch, summary, .lock-task, .lock-sub';
  const spring = 'cubic-bezier(.34,1.56,.64,1)';
  const out = 'cubic-bezier(.2,.8,.2,1)';

  /* ---------- press ---------- */
  let pressed = null, startX = 0, startY = 0;
  const release = () => { if (pressed) { pressed.classList.remove('is-pressed'); pressed = null; } };
  document.addEventListener('pointerdown', e => {
    if (!on() || e.button > 0) return;
    const el = e.target.closest(TAPPABLE);
    if (!el || el.disabled || el.closest('[data-no-press]')) return;
    const w = el.getBoundingClientRect().width;
    // Big surfaces barely move, small buttons move more: the same felt depth for every size.
    el.style.setProperty('--press', w > 280 ? '.985' : w > 140 ? '.965' : w > 60 ? '.94' : '.88');
    pressed = el; startX = e.clientX; startY = e.clientY;
    el.classList.add('is-pressed');
  }, { passive: true, capture: true });
  // A swipe or a scroll is not a tap: let go as soon as the finger travels.
  document.addEventListener('pointermove', e => { if (pressed && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) release(); }, { passive: true, capture: true });
  ['pointerup', 'pointercancel', 'dragstart', 'scroll'].forEach(t => document.addEventListener(t, release, { passive: true, capture: true }));

  /* ---------- icon animations ---------- */
  const k = (frames, duration = 520, easing = out, origin) => ({ frames, duration, easing, origin });
  const pop = k([{ scale: 1 }, { scale: .72 }, { scale: 1.18 }, { scale: 1 }], 480);
  const nudge = d => k([{ translate: '0 0' }, { translate: d }, { translate: '0 0' }], 420, spring);
  const ICONS = {
    settings: k([{ rotate: '0deg' }, { rotate: '120deg' }], 620, spring),
    'settings-2': k([{ rotate: '0deg' }, { rotate: '120deg' }], 620, spring),
    search: k([{ rotate: '0deg', scale: 1 }, { rotate: '-16deg', scale: 1.15 }, { rotate: '0deg', scale: 1 }], 480),
    plus: k([{ rotate: '0deg' }, { rotate: '90deg' }], 460, spring),
    x: k([{ rotate: '0deg' }, { rotate: '-90deg' }], 420, spring),
    check: pop, 'check-check': pop, 'circle-check': pop, 'square-check': pop, 'check-circle-2': pop,
    trash: k([{ rotate: '0deg' }, { rotate: '-14deg' }, { rotate: '12deg' }, { rotate: '-7deg' }, { rotate: '0deg' }], 480, out, '50% 15%'),
    'trash-2': k([{ rotate: '0deg' }, { rotate: '-14deg' }, { rotate: '12deg' }, { rotate: '-7deg' }, { rotate: '0deg' }], 480, out, '50% 15%'),
    bell: k([{ rotate: '0deg' }, { rotate: '18deg' }, { rotate: '-14deg' }, { rotate: '9deg' }, { rotate: '-4deg' }, { rotate: '0deg' }], 640, out, '50% 8%'),
    'bell-ring': k([{ rotate: '0deg' }, { rotate: '18deg' }, { rotate: '-14deg' }, { rotate: '9deg' }, { rotate: '0deg' }], 600, out, '50% 8%'),
    'alarm-clock': k([{ rotate: '0deg' }, { rotate: '12deg' }, { rotate: '-12deg' }, { rotate: '8deg' }, { rotate: '0deg' }], 520),
    repeat: k([{ rotate: '0deg' }, { rotate: '180deg' }], 560, spring),
    'repeat-2': k([{ rotate: '0deg' }, { rotate: '180deg' }], 560, spring),
    'rotate-ccw': k([{ rotate: '0deg' }, { rotate: '-360deg' }], 640, out),
    'undo-2': k([{ rotate: '0deg' }, { rotate: '-40deg' }, { rotate: '0deg' }], 460, spring),
    'chevron-right': nudge('4px 0'), 'arrow-right': nudge('4px 0'), 'arrow-up-right': nudge('3px -3px'),
    'chevron-left': nudge('-4px 0'), 'arrow-left': nudge('-4px 0'), 'chevron-down': nudge('0 3px'), 'chevron-up': nudge('0 -3px'),
    palette: k([{ rotate: '0deg', scale: 1 }, { rotate: '-22deg', scale: 1.12 }, { rotate: '10deg' }, { rotate: '0deg', scale: 1 }], 620),
    sparkles: k([{ scale: 1, rotate: '0deg' }, { scale: 1.25, rotate: '15deg' }, { scale: 1, rotate: '0deg' }], 520, spring),
    'lock-keyhole': k([{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 1px' }, { translate: '0 0' }], 460),
    lock: k([{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 1px' }, { translate: '0 0' }], 460),
    layers: k([{ translate: '0 0', scale: 1 }, { translate: '0 -3px', scale: 1.08 }, { translate: '0 0', scale: 1 }], 480, spring),
    folders: k([{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 0' }], 420, spring),
    languages: k([{ rotate: '0deg' }, { rotate: '-12deg' }, { rotate: '8deg' }, { rotate: '0deg' }], 520),
    'shield-check': k([{ scale: 1 }, { scale: .85 }, { scale: 1.12 }, { scale: 1 }], 520),
    info: pop, 'circle-help': pop,
    pin: k([{ translate: '0 0', rotate: '0deg' }, { translate: '0 -4px', rotate: '-14deg' }, { translate: '0 0', rotate: '0deg' }], 500, spring),
    'pin-off': pop,
    play: k([{ scale: 1 }, { scale: .7 }, { scale: 1.2 }, { scale: 1 }], 420), pause: pop, square: pop,
    sun: k([{ rotate: '0deg' }, { rotate: '90deg' }], 600, spring), moon: k([{ rotate: '0deg' }, { rotate: '-28deg' }, { rotate: '0deg' }], 560),
    calendar: pop, 'calendar-days': pop, clock: k([{ rotate: '0deg' }, { rotate: '360deg' }], 700, out), timer: pop, hourglass: k([{ rotate: '0deg' }, { rotate: '180deg' }], 600, spring),
    download: nudge('0 3px'), upload: nudge('0 -3px'), share: nudge('0 -3px'), 'share-2': pop, 'file-down': nudge('0 3px'), 'image-down': nudge('0 3px'),
    image: pop, 'image-plus': pop, type: pop, 'grip-vertical': pop, 'notebook-pen': pop, pencil: k([{ rotate: '0deg' }, { rotate: '-18deg' }, { rotate: '0deg' }], 420, spring),
    'list-checks': pop, 'chart-no-axes-column': k([{ scale: '1 1' }, { scale: '1 .6' }, { scale: '1 1.08' }, { scale: '1 1' }], 520, out, '50% 90%'),
    history: k([{ rotate: '0deg' }, { rotate: '-360deg' }], 700, out), archive: nudge('0 2px'), 'eye-off': pop, eye: pop, 'heart': pop, star: k([{ scale: 1, rotate: '0deg' }, { scale: 1.3, rotate: '72deg' }, { scale: 1, rotate: '72deg' }], 560, spring)
  };
  const iconName = svg => [...svg.classList].map(c => c.startsWith('lucide-') ? c.slice(7) : '').find(n => n && n !== 'icon') || '';
  function animateIcon(svg) {
    if (!svg?.animate) return;
    const a = ICONS[iconName(svg)] || pop;
    svg.style.transformOrigin = a.origin || '50% 50%';
    svg.getAnimations().forEach(x => x.cancel());
    svg.animate(a.frames, { duration: a.duration, easing: a.easing });
  }
  document.addEventListener('click', e => {
    if (!on()) return;
    const el = e.target.closest(TAPPABLE);
    if (!el) return;
    // Rows with a big leading circle animate the circle instead of an icon (done in "selection" below).
    if (el.matches('.task-row *, .lock-task, .lock-sub')) return;
    const find = () => el.querySelector(':scope > svg.lucide, :scope > .row-ico > svg, :scope > span > svg.lucide, :scope svg.lucide');
    const svg = find();
    if (!svg) return;
    animateIcon(svg);
    // The app sometimes redraws icons right after a tap; follow the new one so the motion is not lost.
    requestAnimationFrame(() => { const now = find(); if (now && now !== svg && el.isConnected && el.offsetParent) animateIcon(now); });
  }, true);

  /* ---------- selection pops ---------- */
  document.addEventListener('change', e => {
    if (!on()) return;
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !['radio', 'checkbox'].includes(input.type)) return;
    const box = input.closest('label') || input.parentElement;
    box?.animate?.([{ scale: 1 }, { scale: .94 }, { scale: 1.03 }, { scale: 1 }], { duration: 380, easing: out });
  }, true);
  // Buttons that mark a choice with .active / aria-pressed pop when they turn on.
  new MutationObserver(list => {
    if (!on()) return;
    for (const m of list) {
      const el = m.target;
      if (!(el instanceof HTMLElement) || el.closest('.task-row, .lock-group, #activity-list')) continue;
      const nowOn = m.attributeName === 'aria-pressed' ? el.getAttribute('aria-pressed') === 'true' : el.classList.contains('active');
      const wasOn = m.attributeName === 'aria-pressed' ? m.oldValue === 'true' : /(^|\s)active(\s|$)/.test(m.oldValue || '');
      if (nowOn && !wasOn && el.offsetParent) el.animate([{ scale: .92 }, { scale: 1.05 }, { scale: 1 }], { duration: 360, easing: out });
    }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-pressed', 'class'] });

  /* ---------- lock screen: the circle you tick pops, the card breathes ---------- */
  document.addEventListener('click', e => {
    if (!on()) return;
    const row = e.target.closest('.lock-task, .lock-sub');
    if (!row) return;
    const id = row.dataset.subId || row.dataset.id || '', sel = row.classList.contains('lock-sub') ? '.lock-sub' : '.lock-task';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const now = [...document.querySelectorAll(sel)].find(r => (r.dataset.subId || r.dataset.id || '') === id) || row;
      now.querySelector('.check-circle')?.animate([{ scale: .55 }, { scale: 1.22 }, { scale: 1 }], { duration: 460, easing: out });
      now.closest('.lock-group')?.animate([{ scale: 1 }, { scale: .985 }, { scale: 1 }], { duration: 380, easing: out });
    }));
  }, true);

  window.SuiSuiMotion = { animateIcon, ICONS };
})();
