'use strict';

/* ============================================================
   GUITAR TAB — capo finder + fretboard diagrams
   Reuses helpers from app.js (parseChord, pcOf, spell,
   KEY_SPELLING, extractChords, transposeText).
   Fingering data comes from window.GUITAR_CHORDS.
============================================================ */

// Map a pitch class to the chord-db root spelling.
const PC_TO_DBROOT = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map our chord-quality tokens to chord-db suffixes.
const SUFFIX_MAP = {
  '': 'major', 'maj': 'major', 'M': 'major',
  'm': 'minor', 'min': 'minor', '-': 'minor',
  'dim': 'dim', 'o': 'dim', 'dim7': 'dim7', 'o7': 'dim7',
  'sus2': 'sus2', 'sus4': 'sus4', 'sus': 'sus4', '7sus4': '7sus4', '7sus2': '7sus4',
  'aug': 'aug', '+': 'aug', '7#5': 'aug7', '7b5': '7b5',
  '6': '6', '69': '69',
  '7': '7', '9': '9', '7b9': '7b9', '7#9': '7#9', '11': '11',
  '9#11': '9#11', '13': '13', '13b9': '13', '7#11': '7',
  'maj7': 'maj7', 'maj9': 'maj9', 'maj13': 'maj13',
  'add9': 'add9', 'add2': 'add9', 'add11': 'major',
  'm6': 'm6', 'm7': 'm7', 'min7': 'm7', 'm7b5': 'm7b5', '\u00f8': 'm7b5', '\u00f87': 'm7b5',
  'm9': 'm9', 'm11': 'm11', 'mMaj7': 'mmaj7', 'mmaj7': 'mmaj7', 'madd9': 'add9'
};

// Comfortable open-chord shape families (major), in CAGED order.
const SHAPE_FAMILIES = [
  { name: 'C', pc: 0 },
  { name: 'A', pc: 9 },
  { name: 'G', pc: 7 },
  { name: 'E', pc: 4 },
  { name: 'D', pc: 2 }
];

const gState = {
  shapes: new Set([2, 7, 0]), // default D, G, C
  targetValue: 'B',
  playInPc: null
};

/* ------------------------------------------------------------
   Fingering lookup
------------------------------------------------------------ */

function guitarShape(rootPc, quality) {
  const db = window.GUITAR_CHORDS;
  if (!db) return null;
  const root = PC_TO_DBROOT[((rootPc % 12) + 12) % 12];
  const suffix = SUFFIX_MAP.hasOwnProperty(quality) ? SUFFIX_MAP[quality] : 'major';
  const byRoot = db[root];
  if (!byRoot) return null;
  const entry = byRoot[suffix] || byRoot['major'];
  return entry ? entry[0] : null;
}

/* ------------------------------------------------------------
   SVG fretboard diagram
------------------------------------------------------------ */

function svgForShape(shape, opts) {
  const large = opts && opts.large;
  const NS = 6, NF = 5;
  const strSp = large ? 24 : 15;
  const fretSp = large ? 28 : 18;
  const dotR = large ? 8 : 5;
  const padTop = large ? 24 : 18;
  const padLeft = large ? 22 : 16;
  const padRight = large ? 12 : 9;
  const padBottom = large ? 10 : 8;

  const gridW = (NS - 1) * strSp;
  const W = padLeft + gridW + padRight;
  const H = padTop + NF * fretSp + padBottom;

  const stroke = 'var(--line-strong)';
  const dotColor = 'var(--primary)';
  const openColor = 'var(--ink-faint)';
  const nutColor = 'var(--ink)';
  const textColor = 'var(--primary-ink)';

  const xOf = i => padLeft + i * strSp;
  const yOf = row => padTop + (row - 0.5) * fretSp;

  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" class="fret-svg">`;

  // Fret lines
  for (let j = 0; j <= NF; j++) {
    const y = padTop + j * fretSp;
    const thick = (j === 0 && shape.baseFret === 1) ? (large ? 4 : 3) : 1;
    const col = (j === 0 && shape.baseFret === 1) ? nutColor : stroke;
    s += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + gridW}" y2="${y}" stroke="${col}" stroke-width="${thick}" stroke-linecap="round"/>`;
  }
  // Strings
  for (let i = 0; i < NS; i++) {
    const x = xOf(i);
    s += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + NF * fretSp}" stroke="${stroke}" stroke-width="1"/>`;
  }

  // Base-fret label when not starting at the nut
  if (shape.baseFret > 1) {
    s += `<text x="${padLeft - 5}" y="${yOf(1) + 3}" text-anchor="end" font-size="${large ? 12 : 9}" fill="${openColor}" font-family="monospace">${shape.baseFret}fr</text>`;
  }

  // Barres (relative fret rows)
  (shape.barres || []).forEach(b => {
    let lo = -1, hi = -1;
    for (let i = 0; i < NS; i++) {
      if (shape.frets[i] === b) { if (lo === -1) lo = i; hi = i; }
    }
    if (lo === -1) { lo = 0; hi = NS - 1; }
    const y = yOf(b);
    s += `<rect x="${xOf(lo) - dotR}" y="${y - dotR}" width="${xOf(hi) - xOf(lo) + dotR * 2}" height="${dotR * 2}" rx="${dotR}" fill="${dotColor}"/>`;
  });

  // Markers + dots
  for (let i = 0; i < NS; i++) {
    const v = shape.frets[i];
    const x = xOf(i);
    if (v === -1) {
      s += `<text x="${x}" y="${padTop - 6}" text-anchor="middle" font-size="${large ? 12 : 9}" fill="${openColor}" font-family="monospace">\u00d7</text>`;
    } else if (v === 0) {
      s += `<circle cx="${x}" cy="${padTop - 9}" r="${large ? 5 : 3.5}" fill="none" stroke="${openColor}" stroke-width="1.3"/>`;
    } else {
      const y = yOf(v);
      s += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${dotColor}"/>`;
      if (large && shape.fingers && shape.fingers[i] > 0) {
        s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="${textColor}" font-family="monospace" font-weight="600">${shape.fingers[i]}</text>`;
      }
    }
  }

  s += '</svg>';
  return s;
}

/* ------------------------------------------------------------
   Capo finder
------------------------------------------------------------ */

function targetPc() {
  return keyMeta(gState.targetValue).pc;
}

function capoForShape(shapePc) {
  return ((targetPc() - shapePc) % 12 + 12) % 12;
}

function refreshShapeChips() {
  const wrap = document.getElementById('shapeChips');
  wrap.innerHTML = '';
  SHAPE_FAMILIES.forEach(fam => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (gState.shapes.has(fam.pc) ? ' active' : '');
    btn.textContent = fam.name;
    btn.addEventListener('click', () => {
      if (gState.shapes.has(fam.pc)) {
        if (gState.shapes.size > 1) gState.shapes.delete(fam.pc);
      } else {
        gState.shapes.add(fam.pc);
      }
      syncPlayIn(true);
      refreshShapeChips();
      updateCapo();
    });
    wrap.appendChild(btn);
  });
}

function selectedShapesSorted() {
  return SHAPE_FAMILIES
    .filter(f => gState.shapes.has(f.pc))
    .map(f => ({ name: f.name, pc: f.pc, capo: capoForShape(f.pc) }))
    .sort((a, b) => a.capo - b.capo);
}

function syncPlayIn(resetToBest) {
  const sel = document.getElementById('guitarPlayIn');
  const shapes = selectedShapesSorted();
  sel.innerHTML = shapes
    .map((s, i) => `<option value="${s.pc}">${s.name} shapes \u00b7 capo ${s.capo}${i === 0 ? ' \u2014 recommended' : ''}</option>`)
    .join('');
  if (resetToBest || gState.playInPc === null || !gState.shapes.has(gState.playInPc)) {
    gState.playInPc = shapes[0].pc;
  }
  sel.value = String(gState.playInPc);
}

function updateCapo() {
  const shapes = selectedShapesSorted();
  const chosen = shapes.find(s => s.pc === gState.playInPc) || shapes[0];
  gState.playInPc = chosen.pc;

  const led = document.getElementById('capoLed');
  const foot = document.getElementById('capoShape');
  const alt = document.getElementById('capoAlt');

  led.textContent = chosen.capo === 0 ? '\u2014' : String(chosen.capo);
  led.classList.remove('flash'); void led.offsetWidth; led.classList.add('flash');
  foot.textContent = chosen.capo === 0
    ? `play in ${chosen.name} \u00b7 no capo`
    : `play in ${chosen.name}`;

  const target = keyMeta(gState.targetValue).name;
  const list = shapes.map(s =>
    `${s.name}\u2009\u2192\u2009${s.capo === 0 ? 'open' : 'capo ' + s.capo}`
  ).join('   ');
  alt.textContent = `to sound in ${target}:   ${list}`;

  renderGuitarSong();
}

/* ------------------------------------------------------------
   Song shapes + diagrams
------------------------------------------------------------ */

function renderGuitarSong() {
  const input = document.getElementById('guitarInput').value;
  const outEl = document.getElementById('guitarOutput');
  const infoEl = document.getElementById('guitarInfo');
  const diagEl = document.getElementById('guitarDiagrams');

  const target = keyMeta(gState.targetValue);
  const shapeMeta = keyMeta(SHAPE_FAMILIES.find(f => f.pc === gState.playInPc).name);
  const capo = capoForShape(gState.playInPc);

  if (!input.trim()) {
    outEl.textContent = '';
    infoEl.innerHTML = capo === 0
      ? `Play open in <strong>${shapeMeta.name}</strong> \u2014 no capo needed.`
      : `Capo <strong>${capo}</strong>, then finger <strong>${shapeMeta.name}</strong> shapes to sound in ${target.name}.`;
    diagEl.innerHTML = '<p class="empty-hint">Paste the song (in the band\u2019s key) to see the shapes you finger.</p>';
    return;
  }

  // Shape chords = song chords transposed down by the capo amount.
  const shift = ((gState.playInPc - target.pc) % 12 + 12) % 12;
  const shapeText = transposeText(input, shift, shapeMeta.flats);
  outEl.textContent = shapeText;

  infoEl.innerHTML = capo === 0
    ? `No capo \u00b7 finger these <strong>${shapeMeta.name}</strong> shapes (sounds in ${target.name}).`
    : `Capo <strong>${capo}</strong> \u00b7 finger these <strong>${shapeMeta.name}</strong> shapes (sounds in ${target.name}).`;

  const chords = extractChords(shapeText);
  diagEl.innerHTML = '';
  if (chords.length === 0) {
    diagEl.innerHTML = '<p class="empty-hint">No chord-only lines found. Put chords on their own line, e.g. <code>G C D Em</code>.</p>';
    return;
  }

  chords.forEach(token => {
    const parsed = parseChord(token);
    if (!parsed) return;
    const shape = guitarShape(parsed.rootPc, parsed.quality);

    const block = document.createElement('div');
    block.className = 'chord-block guitar-block';

    const head = document.createElement('div');
    head.className = 'chord-head';
    const name = document.createElement('span');
    name.className = 'chord-name';
    name.textContent = token;
    head.appendChild(name);
    block.appendChild(head);

    if (shape) {
      block.tabIndex = 0;
      const wrap = document.createElement('div');
      wrap.className = 'fret-wrap';
      wrap.innerHTML = svgForShape(shape);
      block.appendChild(wrap);
      block.addEventListener('click', () => openGuitarModal(token, shape));
      block.addEventListener('keypress', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGuitarModal(token, shape); }
      });
    } else {
      const none = document.createElement('div');
      none.className = 'chord-sub';
      none.textContent = 'No diagram for this voicing yet.';
      block.appendChild(none);
    }

    diagEl.appendChild(block);
  });
}

/* ------------------------------------------------------------
   Guitar modal (reuses the shared modal shell)
------------------------------------------------------------ */

function openGuitarModal(token, shape) {
  document.getElementById('modalTitle').textContent = token;
  const sub = document.getElementById('modalSub');
  const fretText = shape.baseFret > 1 ? ` \u00b7 from fret ${shape.baseFret}` : '';
  sub.textContent = 'Guitar \u00b7 standard tuning' + fretText;

  const wrap = document.getElementById('modalPianoContainer');
  wrap.innerHTML = svgForShape(shape, { large: true });

  const playBtn = document.getElementById('modalPlayBtn');
  playBtn.style.display = 'none';

  document.getElementById('chordModal').classList.add('open');
}

/* ------------------------------------------------------------
   Tabs
------------------------------------------------------------ */

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');
      // Restore the play button visibility when leaving guitar.
      const playBtn = document.getElementById('modalPlayBtn');
      if (playBtn) playBtn.style.display = '';
    });
  });
}

/* ------------------------------------------------------------
   Init
------------------------------------------------------------ */

function initGuitar() {
  const targetSel = document.getElementById('guitarTargetKey');
  const playInSel = document.getElementById('guitarPlayIn');

  gState.targetValue = targetSel.value;

  targetSel.addEventListener('change', () => {
    gState.targetValue = targetSel.value;
    syncPlayIn(true);
    updateCapo();
  });
  playInSel.addEventListener('change', () => {
    gState.playInPc = parseInt(playInSel.value, 10);
    updateCapo();
  });
  document.getElementById('guitarTransposeBtn').addEventListener('click', renderGuitarSong);

  refreshShapeChips();
  syncPlayIn(true);
  updateCapo();
  initTabs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuitar);
} else {
  initGuitar();
}
