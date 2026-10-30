'use strict';

/* ============================================================
   NAVIGATION + SHARED SETUP
   ------------------------------------------------------------
   - Bottom bar: the 3 main screens of the current instrument plus
     "More", which opens a sheet listing every screen.
   - One screen at a time (sections tagged data-screen in index.html).
   - Piano | Guitar switch stays; picking a screen of the other
     instrument switches it automatically.
   - Phone Back button: closes the More sheet, else goes to the
     previous screen (History API).
   - Shared setup bar: one Band key (synced to every band-key box)
     and one My capo (the only capo value; guitar.js + live-lookup.js
     read it).
   No chord/key math lives here; it only moves values and events.
   Must load AFTER guitar.js and live-lookup.js.
============================================================ */

const MENU_SCREENS = [
  { id: 'live',     label: 'Live Chord Lookup',   short: 'Live',   group: 'Anywhere', inst: 'both' },
  { id: 'quick',    label: 'Quick Key Transpose', short: 'Key',    group: 'Piano',    inst: 'piano' },
  { id: 'song',     label: 'Song Transposer',     short: 'Song',   group: 'Piano',    inst: 'piano' },
  { id: 'ref',      label: 'Chord Reference',     short: 'Chords', group: 'Piano',    inst: 'piano' },
  { id: 'finder',   label: 'Capo Finder',         short: 'Capo',   group: 'Guitar',   inst: 'guitar' },
  { id: 'shapes',   label: 'Shapes with Capo',    short: 'Shapes', group: 'Guitar',   inst: 'guitar' },
  { id: 'settings', label: 'Settings',            short: 'Settings', group: 'App',    inst: 'both' }
];
// Bottom bar per instrument (last slot is always "More").
const MENU_BAR = { piano: ['live', 'quick', 'song'], guitar: ['live', 'finder', 'shapes'] };
const MENU_DEFAULT = { piano: 'quick', guitar: 'finder' };
const MENU_SCREEN_KEY = 'screen.v1';
const MENU_SETUP_KEY = 'setup.v1';

const MENU_ICONS = {
  live:   '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  quick:  '<circle cx="12" cy="12" r="8"/><path d="M12 12l4-4"/>',
  song:   '<path d="M4 6h16M4 11h16M4 16h10"/>',
  ref:    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v9M12 5v9M16 5v9"/>',
  finder: '<path d="M6 3v18M18 3v18M6 8h12M6 13h12"/>',
  shapes: '<path d="M5 4v16M10 4v16M15 4v16M20 4v16M5 9h15"/><circle cx="10" cy="13" r="1.6"/><circle cx="15" cy="16" r="1.6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  more:   '<path d="M4 7h16M4 12h16M4 17h16"/>'
};

const menuState = { screen: 'live', lastByInst: { piano: 'quick', guitar: 'finder' }, lastFocus: null,
  toLinked: true,     // Song Transposer "To" follows the Band key until changed by hand
  settingTo: false };

function menuIcon(id) {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (MENU_ICONS[id] || '') + '</svg>';
}

function menuInstrument() {
  const active = document.querySelector('.tab-btn.active');
  return active && active.dataset.target === 'tab-guitar' ? 'guitar' : 'piano';
}

function menuDef(id) { return MENU_SCREENS.find(s => s.id === id); }

function menuStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* non-fatal */ }
}
function menuLoad(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}

/* ---------------- screens ---------------- */

// opts.history: 'push' | 'replace' | 'none' (default 'push')
function menuShowScreen(id, opts) {
  opts = opts || {};
  const def = menuDef(id) || menuDef('live');
  if (def.inst !== 'both' && def.inst !== menuInstrument()) {
    const btn = document.querySelector('.tab-btn[data-target="tab-' + def.inst + '"]');
    if (btn) btn.click();
  }
  const changed = def.id !== menuState.screen;
  menuState.screen = def.id;
  if (def.inst !== 'both') menuState.lastByInst[def.inst] = def.id;
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.classList.toggle('screen-hidden', el.dataset.screen !== def.id);
  });
  const title = document.getElementById('screenTitle');
  if (title) title.textContent = def.label;
  menuPaintNav();
  menuUpdateBar();
  menuStore(MENU_SCREEN_KEY, { screen: def.id, last: menuState.lastByInst });

  const mode = opts.history || 'push';
  if (mode === 'push' && changed) history.pushState({ screen: def.id }, '');
  else if (mode === 'replace') history.replaceState({ screen: def.id }, '');
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

function menuPaintNav() {
  const list = document.getElementById('menuList');
  if (list) {
    let html = '';
    let group = '';
    MENU_SCREENS.forEach(s => {
      if (s.group !== group) {
        group = s.group;
        html += '<p class="menu-group">' + group + '</p>';
      }
      const on = s.id === menuState.screen;
      html += '<button type="button" class="menu-item' + (on ? ' active' : '') + '" data-screen-id="' + s.id + '"' +
        (on ? ' aria-current="page"' : '') + '>' + menuIcon(s.id) + '<span>' + s.label + '</span></button>';
    });
    list.innerHTML = html;
  }
  const bar = document.getElementById('bottomNav');
  if (bar) {
    const ids = MENU_BAR[menuInstrument()];
    const inBar = ids.indexOf(menuState.screen) !== -1;
    let html = ids.map(id => {
      const s = menuDef(id);
      const on = id === menuState.screen;
      return '<button type="button" class="bn-item' + (on ? ' active' : '') + '" data-screen-id="' + id + '"' +
        (on ? ' aria-current="page"' : '') + '>' + menuIcon(id) + '<span>' + s.short + '</span></button>';
    }).join('');
    html += '<button type="button" id="moreBtn" class="bn-item' + (inBar ? '' : ' active') + '" aria-haspopup="dialog" ' +
      'aria-expanded="false" aria-controls="menuDrawer">' + menuIcon('more') + '<span>More</span></button>';
    bar.innerHTML = html;
  }
}

/* ---------------- More sheet ---------------- */

function menuIsOpen() {
  const d = document.getElementById('menuDrawer');
  return !!(d && !d.hidden);
}

function menuOpen() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  if (!drawer || menuIsOpen()) return;
  menuState.lastFocus = document.activeElement;
  drawer.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => { drawer.classList.add('open'); overlay.classList.add('open'); });
  const more = document.getElementById('moreBtn');
  if (more) more.setAttribute('aria-expanded', 'true');
  history.pushState({ screen: menuState.screen, sheet: true }, '');
  const current = drawer.querySelector('.menu-item.active') || document.getElementById('menuCloseBtn');
  if (current) current.focus();
}

// Visual close only. Callers handle history.
function menuCloseNow() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  if (!drawer || !menuIsOpen()) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  setTimeout(() => { drawer.hidden = true; overlay.hidden = true; }, 200);
  const more = document.getElementById('moreBtn');
  if (more) more.setAttribute('aria-expanded', 'false');
  const back = menuState.lastFocus && document.contains(menuState.lastFocus) ? menuState.lastFocus : document.getElementById('moreBtn');
  if (back) back.focus();
}

// X button, overlay, Esc: undo the sheet's history entry (popstate closes it).
function menuDismiss() {
  if (!menuIsOpen()) return;
  if (history.state && history.state.sheet) history.back();
  else menuCloseNow();
}

// Keep Tab focus inside the open sheet.
function menuTrapFocus(e) {
  if (e.key !== 'Tab' || !menuIsOpen()) return;
  const drawer = document.getElementById('menuDrawer');
  const items = [...drawer.querySelectorAll('button:not([disabled])')];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!drawer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
}

/* ---------------- shared setup bar ---------------- */

const MENU_BAND_IDS = ['llBandKey', 'guitarTargetKey', 'quickToKey'];

function menuSetBandKey(value, sourceId) {
  const bar = document.getElementById('barBandKey');
  if (bar && sourceId !== 'barBandKey') bar.value = value;
  MENU_BAND_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || id === sourceId || el.value === value) return;
    el.value = value;
    el.dispatchEvent(new Event('change'));
  });
  if (menuState.toLinked) menuMatchTo();
  menuPaintToNote();
  menuSaveSetup();
}

/* Song Transposer "To" key: follows the Band key by default; a hand
   change (dropdown or -1/+1) makes it the song's own key until the
   player taps "Match band key". */
function menuMatchTo() {
  const bar = document.getElementById('barBandKey');
  const to = document.getElementById('toKey');
  if (!bar || !to || to.value === bar.value) return;
  menuState.settingTo = true;
  to.value = bar.value;
  to.dispatchEvent(new Event('change'));
  menuState.settingTo = false;
}

function menuUnlinkTo() {
  if (menuState.settingTo || !menuState.toLinked) return;
  menuState.toLinked = false;
  menuPaintToNote();
  menuSaveSetup();
}

function menuPaintToNote() {
  const note = document.getElementById('toLinkNote');
  const bar = document.getElementById('barBandKey');
  if (!note || !bar) return;
  const band = bar.options[bar.selectedIndex] ? bar.options[bar.selectedIndex].text : bar.value;
  note.innerHTML = menuState.toLinked
    ? 'To follows the band key (' + band + ').'
    : 'To is your own key for this song. <button type="button" class="link-btn" id="toMatchBtn">Match band key (' + band + ')</button>';
}

function menuSetCapo(value) {
  const v = String(parseInt(value, 10) || 0);
  const bar = document.getElementById('barCapo');
  const ll = document.getElementById('llCapo');
  if (bar && bar.value !== v) bar.value = v;
  if (ll && ll.value !== v) {
    ll.value = v;
    ll.dispatchEvent(new Event('change'));
  }
  if (typeof guitarSetMyCapo === 'function') guitarSetMyCapo(v);
  menuSaveSetup();
}

function menuSaveSetup() {
  const bar = document.getElementById('barBandKey');
  const cap = document.getElementById('barCapo');
  menuStore(MENU_SETUP_KEY, { bandKey: bar ? bar.value : null, capo: cap ? cap.value : '0', toLinked: menuState.toLinked });
}

function menuUpdateBar() {
  const item = document.getElementById('barCapoItem');
  if (item) item.hidden = menuInstrument() !== 'guitar';
}

function menuInitSetup() {
  const bar = document.getElementById('barBandKey');
  const cap = document.getElementById('barCapo');
  if (cap) {
    cap.innerHTML = Array.from({ length: 12 }, (_, i) =>
      '<option value="' + i + '">' + (i === 0 ? 'No capo' : 'Capo ' + i) + '</option>').join('');
  }
  const saved = menuLoad(MENU_SETUP_KEY);
  if (saved && saved.toLinked === false) menuState.toLinked = false;
  const toSel = document.getElementById('toKey');
  if (toSel) toSel.addEventListener('change', menuUnlinkTo);
  ['stepDownBtn', 'stepUpBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', menuUnlinkTo);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#toMatchBtn')) return;
    menuState.toLinked = true;
    menuMatchTo();
    menuPaintToNote();
    menuSaveSetup();
  });
  const ll = document.getElementById('llBandKey');
  const llCapo = document.getElementById('llCapo');
  if (bar) {
    const start = saved && saved.bandKey && bar.querySelector('option[value="' + saved.bandKey + '"]')
      ? saved.bandKey : (ll ? ll.value : bar.value);
    bar.value = start;
    menuSetBandKey(start, 'barBandKey');
    bar.addEventListener('change', () => menuSetBandKey(bar.value, 'barBandKey'));
  }
  MENU_BAND_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { if (bar && bar.value !== el.value) menuSetBandKey(el.value, id); });
  });
  if (cap) {
    const startCapo = saved && saved.capo != null ? String(saved.capo) : (llCapo ? llCapo.value : '0');
    menuSetCapo(startCapo);
    cap.addEventListener('change', () => menuSetCapo(cap.value));
  }
  // "Use capo N" (Capo Finder button and the hint on Shapes with Capo).
  document.addEventListener('click', e => {
    const reset = e.target.closest('[data-reset-capo]');
    if (reset && !reset.disabled) {
      if (typeof guitarResetSuggestion === 'function') guitarResetSuggestion();
      menuSetCapo('0');
      return;
    }
    const use = e.target.closest('[data-use-capo]');
    if (!use || use.disabled) return;
    menuSetCapo(use.dataset.useCapo);
  });
}

/* ---------------- init ---------------- */

function initMenu() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;

  nav.addEventListener('click', e => {
    if (e.target.closest('#moreBtn')) { menuOpen(); return; }
    const item = e.target.closest('.bn-item');
    if (item) menuShowScreen(item.dataset.screenId);
  });
  document.getElementById('menuCloseBtn').addEventListener('click', menuDismiss);
  document.getElementById('menuOverlay').addEventListener('click', menuDismiss);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') menuDismiss();
    menuTrapFocus(e);
  });
  document.getElementById('menuList').addEventListener('click', e => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    // Replace the sheet's history entry with the new screen, so Back
    // goes to the screen before the sheet was opened.
    menuCloseNow();
    menuShowScreen(item.dataset.screenId, { history: 'replace' });
  });

  window.addEventListener('popstate', e => {
    // Show the screen first (it redraws the bottom bar), then close the
    // sheet so focus returns to the new More button.
    const wasOpen = menuIsOpen();
    const st = e.state;
    if (st && st.screen) menuShowScreen(st.screen, { history: 'none', keepScroll: wasOpen });
    if (wasOpen) menuCloseNow();
  });

  const reset = document.getElementById('resetSavedBtn');
  // Two taps: the first asks, the second clears (no browser pop-up).
  if (reset) reset.addEventListener('click', () => {
    const note = document.getElementById('resetSavedNote');
    if (reset.dataset.armed !== '1') {
      reset.dataset.armed = '1';
      reset.textContent = 'Tap again to clear names, keys and capo';
      reset.classList.add('btn-danger');
      if (note) note.textContent = 'Your theme choice is kept.';
      setTimeout(() => {
        reset.dataset.armed = '';
        reset.textContent = 'Clear saved data';
        reset.classList.remove('btn-danger');
        if (note) note.textContent = '';
      }, 5000);
      return;
    }
    ['liveLookup.v1', MENU_SETUP_KEY, MENU_SCREEN_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    location.reload();
  });

  // Piano | Guitar switch: land on that instrument's last screen.
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => setTimeout(() => {
      const inst = menuInstrument();
      const def = menuDef(menuState.screen);
      if (def.inst === 'both' || def.inst === inst) { menuPaintNav(); menuUpdateBar(); return; }
      menuShowScreen(menuState.lastByInst[inst] || MENU_DEFAULT[inst], { keepScroll: true });
    }, 0));
  });

  menuInitSetup();

  const saved = menuLoad(MENU_SCREEN_KEY);
  if (saved && saved.last) menuState.lastByInst = Object.assign(menuState.lastByInst, saved.last);
  const startId = saved && menuDef(saved.screen) ? saved.screen : 'live';
  menuShowScreen(startId, { keepScroll: true, history: 'replace' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenu);
} else {
  initMenu();
}
