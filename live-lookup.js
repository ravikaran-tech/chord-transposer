'use strict';

/* ============================================================
   LIVE CHORD LOOKUP — mid-song Band Key <-> Your Key translator
   ------------------------------------------------------------
   Purpose: someone on stage calls out a single chord in ONE of
   the two keys (the band's actual key, or your transposed key).
   This resolves what to play/say in the OTHER key, instantly,
   without touching the full-song transposer or key detection.

   Read-only reuse of helpers already defined elsewhere:
     - pcOf, spell, keyMeta, CHORD_FORMULAS, KEY_SPELLING  (app.js)
     - SHAPE_FAMILIES, gState.shapes                       (guitar.js)
   This file does not modify any function or state owned by
   app.js or guitar.js — it only reads from them.

   Must load AFTER app.js and guitar.js.
============================================================ */

// Curated, deduplicated quality list for the dropdown (avoids showing
// every alias in CHORD_FORMULAS, e.g. 'm' / 'min' / '-' all as "Minor").
// Every value here must be a valid key in CHORD_FORMULAS (app.js).
const LL_QUALITIES = [
  ['', 'Major'],
  ['m', 'Minor'],
  ['7', 'Dominant 7'],
  ['maj7', 'Major 7'],
  ['m7', 'Minor 7'],
  ['dim', 'Diminished'],
  ['dim7', 'Diminished 7'],
  ['m7b5', 'Half-diminished (m7\u266d5)'],
  ['aug', 'Augmented'],
  ['sus2', 'Sus2'],
  ['sus4', 'Sus4'],
  ['6', 'Major 6'],
  ['m6', 'Minor 6'],
  ['69', 'Major 6/9'],
  ['9', 'Dominant 9'],
  ['maj9', 'Major 9'],
  ['m9', 'Minor 9'],
  ['11', 'Dominant 11'],
  ['m11', 'Minor 11'],
  ['13', 'Dominant 13'],
  ['maj13', 'Major 13'],
  ['m13', 'Minor 13'],
  ['add9', 'Add 9'],
  ['add2', 'Add 2'],
  ['add11', 'Add 11'],
  ['madd9', 'Minor Add9'],
  ['mMaj7', 'Minor-Major 7'],
  ['7b9', '7\u266d9'],
  ['7#9', '7\u266f9'],
  ['7b5', '7\u266d5'],
  ['7#5', '7\u266f5'],
  ['7#11', '7\u266f11'],
  ['9#11', '9\u266f11'],
  ['13b9', '13\u266d9'],
  ['7sus4', '7sus4'],
  ['7sus2', '7sus2']
];

const LL_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const LL_STORAGE_KEY = 'liveLookup.v1';

const llState = {
  direction: 'band-to-you', // 'band-to-you' | 'you-to-band'
  root: 'F#',
  quality: '',
  bandName: '', // typed name of the band player; '' = use default wording
  yourName: ''  // typed name of the guitar player (you)
};

const LL_NAME_MAX = 20;

function llCleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, LL_NAME_MAX);
}

// All name-dependent wording lives here. With no names typed, every
// string matches the original wording exactly.
function llWords() {
  const band = llState.bandName;
  const you = llState.yourName;
  return {
    bandKeyLabel: band ? `${band}'s key` : 'Band key',
    yourKeyLabel: you ? `${you}'s key` : 'Your key',
    bandToYouBtn: `${band ? band + ' called it (band)' : 'Band called it'} → ${you ? you + ' plays' : 'I play'}`,
    youToBandBtn: `${you ? you + ' called it (you)' : 'I called it'} → ${band ? band + ' plays' : 'band plays'}`,
    rootLabelBand: band ? `Chord ${band} called` : 'Chord they called',
    rootLabelYou: you ? `Chord ${you} played` : 'Chord you played',
    bandTag: band ? ` (${band})` : '',
    youTag: you ? ` (${you})` : '',
    playPrefix: you ? `${you}, play` : 'Play',
    tellBand: band ? `Tell ${band}` : 'Tell the band'
  };
}

function llApplyNames() {
  const w = llWords();
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('llBandKeyLabel', w.bandKeyLabel);
  set('llYourKeyLabel', w.yourKeyLabel);
  set('llDirBandToYou', w.bandToYouBtn);
  set('llDirYouToBand', w.youToBandBtn);
  const clearBtn = document.getElementById('llClearNames');
  if (clearBtn) clearBtn.hidden = !(llState.bandName || llState.yourName);
}

/* ------------------------------------------------------------
   Setup
------------------------------------------------------------ */

function llPopulateRoot() {
  const sel = document.getElementById('llRoot');
  if (!sel) return;
  sel.innerHTML = LL_ROOTS.map(r => `<option value="${r}">${r}</option>`).join('');
}

function llPopulateQuality() {
  const sel = document.getElementById('llQuality');
  if (!sel) return;
  sel.innerHTML = LL_QUALITIES
    .map(([val, label]) => `<option value="${val}">${label}</option>`)
    .join('');
}

function llLoadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LL_STORAGE_KEY) || 'null');
    if (!saved) return null;
    if (saved.direction === 'band-to-you' || saved.direction === 'you-to-band') {
      llState.direction = saved.direction;
    }
    if (typeof saved.root === 'string' && LL_ROOTS.indexOf(saved.root) !== -1) {
      llState.root = saved.root;
    }
    if (typeof saved.quality === 'string' && CHORD_FORMULAS.hasOwnProperty(saved.quality)) {
      llState.quality = saved.quality;
    }
    llState.bandName = llCleanName(saved.bandName);
    llState.yourName = llCleanName(saved.yourName);
    return saved;
  } catch (e) {
    return null;
  }
}

function llSaveState(bandKeyValue, yourKeyValue) {
  try {
    localStorage.setItem(LL_STORAGE_KEY, JSON.stringify({
      bandKey: bandKeyValue,
      yourKey: yourKeyValue,
      direction: llState.direction,
      root: llState.root,
      quality: llState.quality,
      bandName: llState.bandName,
      yourName: llState.yourName
    }));
  } catch (e) {
    // Storage unavailable (private browsing, etc.) — non-fatal, just skip persistence.
  }
}

/* ------------------------------------------------------------
   Guitar-tab assist: best shape/capo for a resolved pitch class,
   using the user's own "shapes I can play" selection from the
   Guitar tab (read-only — never mutates gState).
------------------------------------------------------------ */

function llGuitarTabActive() {
  const panel = document.getElementById('tab-guitar');
  return !!(panel && panel.classList.contains('active'));
}

// Families whose open chord also has a common open MINOR form (Am, Em, Dm).
const LL_MINOR_SHAPE_PCS = new Set([9, 4, 2]);

function llBestShapeForPc(pc, isMinor) {
  if (typeof SHAPE_FAMILIES === 'undefined' || typeof gState === 'undefined' || !gState.shapes) {
    return null;
  }
  const mine = SHAPE_FAMILIES.filter(f => gState.shapes.has(f.pc));
  // For a minor chord, prefer the user's shapes that have an open minor
  // form, so e.g. Am is "open Am shape", not "capo 2, G shape" (= Gm).
  const minorCapable = isMinor ? mine.filter(f => LL_MINOR_SHAPE_PCS.has(f.pc)) : [];
  const pool = minorCapable.length ? minorCapable : mine;
  const options = pool
    .map(f => ({
      name: f.name,
      pc: f.pc,
      capo: ((pc - f.pc) % 12 + 12) % 12,
      minorShape: minorCapable.length > 0
    }))
    .sort((a, b) => a.capo - b.capo);
  return options.length ? options[0] : null;
}

/* ------------------------------------------------------------
   Core resolve + render
------------------------------------------------------------ */

function llRender() {
  const bandSel = document.getElementById('llBandKey');
  const yourSel = document.getElementById('llYourKey');
  const badge = document.getElementById('llBadge');
  const sub = document.getElementById('llSub');
  const guitarNote = document.getElementById('llGuitarNote');
  const rootLabel = document.getElementById('llRootLabel');
  if (!bandSel || !yourSel || !badge || !sub || !guitarNote) return;

  const bandMeta = keyMeta(bandSel.value);
  const yourMeta = keyMeta(yourSel.value);
  const inputPc = pcOf(llState.root);
  const quality = llState.quality;
  const formula = CHORD_FORMULAS[quality];
  const bandToYou = llState.direction === 'band-to-you';

  const words = llWords();
  llApplyNames();
  if (rootLabel) rootLabel.textContent = bandToYou ? words.rootLabelBand : words.rootLabelYou;

  let outputPc, outputFlats, fromLabel, toLabel;
  if (bandToYou) {
    outputPc = inputPc + (yourMeta.pc - bandMeta.pc);
    outputFlats = yourMeta.flats;
    fromLabel = bandMeta.name + words.bandTag;
    toLabel = yourMeta.name + words.youTag;
  } else {
    outputPc = inputPc + (bandMeta.pc - yourMeta.pc);
    outputFlats = bandMeta.flats;
    fromLabel = yourMeta.name + words.youTag;
    toLabel = bandMeta.name + words.bandTag;
  }

  const outputRoot = spell(outputPc, outputFlats);
  const outputChord = outputRoot + quality;

  badge.textContent = outputChord;
  sub.textContent = `${llState.root}${quality} in ${fromLabel} \u2192 ${outputChord} in ${toLabel}`;

  if (llGuitarTabActive()) {
    guitarNote.style.display = '';
    if (bandToYou) {
      const isMinor = !!(formula && formula.minor);
      const shape = llBestShapeForPc(outputPc, isMinor);
      if (shape) {
        const shapeName = shape.name + (shape.minorShape ? 'm' : '');
        let text = shape.capo === 0
          ? `${words.playPrefix}: open ${shapeName} shape`
          : `${words.playPrefix}: capo ${shape.capo}, ${shapeName} shape`;
        if (isMinor && !shape.minorShape) {
          text += ' \u2014 none of your shapes has an open minor form (pick A, E or D shapes for that), so this one is approximate.';
        }
        guitarNote.textContent = text;
      } else {
        guitarNote.textContent = '';
      }
    } else {
      guitarNote.textContent = `${words.tellBand}: ${outputChord} \u2014 plain chord name, not a capo position.`;
    }
  } else {
    guitarNote.style.display = 'none';
  }

  llSaveState(bandSel.value, yourSel.value);
}

function llSetDirection(dir) {
  llState.direction = dir;
  const bandToYouBtn = document.getElementById('llDirBandToYou');
  const youToBandBtn = document.getElementById('llDirYouToBand');
  if (bandToYouBtn) bandToYouBtn.classList.toggle('active', dir === 'band-to-you');
  if (youToBandBtn) youToBandBtn.classList.toggle('active', dir === 'you-to-band');
  llRender();
}

/* ------------------------------------------------------------
   Init
------------------------------------------------------------ */

function initLiveLookup() {
  const bandSel = document.getElementById('llBandKey');
  const yourSel = document.getElementById('llYourKey');
  const rootSel = document.getElementById('llRoot');
  const qualSel = document.getElementById('llQuality');
  const bandToYouBtn = document.getElementById('llDirBandToYou');
  const youToBandBtn = document.getElementById('llDirYouToBand');
  if (!bandSel || !yourSel || !rootSel || !qualSel) return; // widget not on this page

  llPopulateRoot();
  llPopulateQuality();
  const saved = llLoadSavedState();

  // data-keys population (inline script earlier in index.html) already ran,
  // so the selects have options — restore saved values on top if present.
  if (saved && saved.bandKey && KEY_SPELLING.hasOwnProperty(saved.bandKey)) {
    bandSel.value = saved.bandKey;
  }
  if (saved && saved.yourKey && KEY_SPELLING.hasOwnProperty(saved.yourKey)) {
    yourSel.value = saved.yourKey;
  }
  rootSel.value = llState.root;
  qualSel.value = llState.quality;
  if (bandToYouBtn) bandToYouBtn.classList.toggle('active', llState.direction === 'band-to-you');
  if (youToBandBtn) youToBandBtn.classList.toggle('active', llState.direction === 'you-to-band');

  // Name boxes: typed names replace "band" / "I" wording everywhere in
  // this card, and are saved with the keys so they come back next time.
  const bandNameEl = document.getElementById('llBandName');
  const yourNameEl = document.getElementById('llYourName');
  const clearNamesBtn = document.getElementById('llClearNames');
  if (bandNameEl) {
    bandNameEl.value = llState.bandName;
    bandNameEl.addEventListener('input', () => { llState.bandName = llCleanName(bandNameEl.value); llRender(); });
  }
  if (yourNameEl) {
    yourNameEl.value = llState.yourName;
    yourNameEl.addEventListener('input', () => { llState.yourName = llCleanName(yourNameEl.value); llRender(); });
  }
  if (clearNamesBtn) {
    clearNamesBtn.addEventListener('click', () => {
      llState.bandName = '';
      llState.yourName = '';
      if (bandNameEl) bandNameEl.value = '';
      if (yourNameEl) yourNameEl.value = '';
      llRender();
    });
  }

  bandSel.addEventListener('change', llRender);
  yourSel.addEventListener('change', llRender);
  rootSel.addEventListener('change', () => { llState.root = rootSel.value; llRender(); });
  qualSel.addEventListener('change', () => { llState.quality = qualSel.value; llRender(); });
  if (bandToYouBtn) bandToYouBtn.addEventListener('click', () => llSetDirection('band-to-you'));
  if (youToBandBtn) youToBandBtn.addEventListener('click', () => llSetDirection('you-to-band'));

  // The widget sits above both tab panels, so its guitar-only line needs
  // to refresh whenever the visible tab changes.
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(llRender, 0));
  });

  llRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveLookup);
} else {
  initLiveLookup();
}
