'use strict';

/* ============================================================
   MENU + SCREENS + SHARED SETUP
   ------------------------------------------------------------
   - Hamburger drawer: one screen at a time (sections tagged with
     data-screen in index.html).
   - Piano | Guitar switch stays; picking a Guitar-only screen
     switches the instrument automatically.
   - Shared setup bar: one Band key (kept in sync with the band-key
     boxes in Live Lookup, Quick Key and Capo Finder) and one My capo
     (kept in sync with the Live Lookup capo box).
   No chord/key math lives here; it only moves values and events.
   Must load AFTER live-lookup.js.
============================================================ */

const MENU_SCREENS = [
  { id: 'live',     label: 'Live Chord Lookup',   group: 'Anywhere', inst: 'both' },
  { id: 'quick',    label: 'Quick Key Transpose', group: 'Piano',    inst: 'piano' },
  { id: 'song',     label: 'Song Transposer',     group: 'Piano',    inst: 'piano' },
  { id: 'ref',      label: 'Chord Reference',     group: 'Piano',    inst: 'piano' },
  { id: 'finder',   label: 'Capo Finder',         group: 'Guitar',   inst: 'guitar' },
  { id: 'shapes',   label: 'Shapes with Capo',    group: 'Guitar',   inst: 'guitar' },
  { id: 'settings', label: 'Settings',            group: 'App',      inst: 'both' }
];
const MENU_DEFAULT = { piano: 'quick', guitar: 'finder' };
const MENU_SCREEN_KEY = 'screen.v1';
const MENU_SETUP_KEY = 'setup.v1';

const menuState = { screen: 'live', lastByInst: { piano: 'quick', guitar: 'finder' } };

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

function menuShowScreen(id, opts) {
  const def = menuDef(id) || menuDef('live');
  // Switch instrument first if this screen belongs to the other one.
  if (def.inst !== 'both' && def.inst !== menuInstrument()) {
    const btn = document.querySelector('.tab-btn[data-target="tab-' + def.inst + '"]');
    if (btn) btn.click();
  }
  menuState.screen = def.id;
  if (def.inst !== 'both') menuState.lastByInst[def.inst] = def.id;
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.classList.toggle('screen-hidden', el.dataset.screen !== def.id);
  });
  const title = document.getElementById('screenTitle');
  if (title) title.textContent = def.label;
  menuPaintList();
  menuUpdateBar();
  menuStore(MENU_SCREEN_KEY, { screen: def.id, last: menuState.lastByInst });
  if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
}

function menuPaintList() {
  const list = document.getElementById('menuList');
  if (!list) return;
  let html = '';
  let group = '';
  MENU_SCREENS.forEach(s => {
    if (s.group !== group) {
      group = s.group;
      html += '<p class="menu-group">' + group + '</p>';
    }
    html += '<button type="button" class="menu-item' + (s.id === menuState.screen ? ' active' : '') +
      '" data-screen-id="' + s.id + '">' + s.label + '</button>';
  });
  list.innerHTML = html;
}

/* ---------------- drawer open / close ---------------- */

function menuOpen() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  const btn = document.getElementById('menuBtn');
  if (!drawer) return;
  drawer.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => { drawer.classList.add('open'); overlay.classList.add('open'); });
  btn.setAttribute('aria-expanded', 'true');
  const close = document.getElementById('menuCloseBtn');
  if (close) close.focus();
}

function menuClose() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  const btn = document.getElementById('menuBtn');
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  setTimeout(() => { drawer.hidden = true; overlay.hidden = true; }, 200);
  btn.focus();
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
  menuSaveSetup();
}

function menuSetCapo(value, sourceId) {
  const bar = document.getElementById('barCapo');
  const ll = document.getElementById('llCapo');
  if (bar && sourceId !== 'barCapo') bar.value = value;
  if (ll && sourceId !== 'llCapo' && ll.value !== value) {
    ll.value = value;
    ll.dispatchEvent(new Event('change'));
  }
  menuSaveSetup();
}

function menuSaveSetup() {
  const bar = document.getElementById('barBandKey');
  const cap = document.getElementById('barCapo');
  menuStore(MENU_SETUP_KEY, { bandKey: bar ? bar.value : null, capo: cap ? cap.value : '0' });
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
    cap.value = startCapo;
    menuSetCapo(startCapo, 'barCapo');
    cap.addEventListener('change', () => menuSetCapo(cap.value, 'barCapo'));
  }
  if (llCapo) llCapo.addEventListener('change', () => { if (cap && cap.value !== llCapo.value) menuSetCapo(llCapo.value, 'llCapo'); });
}

/* ---------------- init ---------------- */

function initMenu() {
  const btn = document.getElementById('menuBtn');
  if (!btn) return;
  btn.addEventListener('click', menuOpen);
  document.getElementById('menuCloseBtn').addEventListener('click', menuClose);
  document.getElementById('menuOverlay').addEventListener('click', menuClose);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menuClose(); });
  document.getElementById('menuList').addEventListener('click', e => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    menuShowScreen(item.dataset.screenId);
    menuClose();
  });

  const reset = document.getElementById('resetSavedBtn');
  if (reset) reset.addEventListener('click', () => {
    ['liveLookup.v1', MENU_SETUP_KEY, MENU_SCREEN_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    location.reload();
  });

  // Piano | Guitar switch: land on that instrument's last screen.
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => setTimeout(() => {
      const inst = menuInstrument();
      const def = menuDef(menuState.screen);
      if (def.inst === 'both' || def.inst === inst) { menuUpdateBar(); return; }
      menuShowScreen(menuState.lastByInst[inst] || MENU_DEFAULT[inst], { keepScroll: true });
    }, 0));
  });

  menuInitSetup();

  const saved = menuLoad(MENU_SCREEN_KEY);
  if (saved && saved.last) menuState.lastByInst = Object.assign(menuState.lastByInst, saved.last);
  const startId = saved && menuDef(saved.screen) ? saved.screen : 'live';
  menuShowScreen(startId, { keepScroll: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenu);
} else {
  initMenu();
}
