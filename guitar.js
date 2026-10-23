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
  'm9': 'm9', 'm11': 'm11', 'mMaj7': 'mmaj7', 'mmaj7': 'mmaj7', 'madd9': 'add9',
  // Other spellings of the same chords (closest shape in the chord db).
  '5': 'major', '2': 'add9', '4': 'sus4', 'add4': 'major', '7sus': '7sus4', '9sus4': '7sus4',
  'M7': 'maj7', 'ma7': 'maj7', '\u0394': 'maj7', '\u03947': 'maj7', 'maj7#11': 'maj7',
  '6/9': '69', '(add9)': 'add9', '7(b9)': '7b9', '7(#9)': '7#9', '7alt': 'alt',
  'mi': 'minor', 'mi7': 'm7', '-7': 'm7', 'm(add9)': 'madd9', 'm(maj7)': 'mmaj7',
  '\u00b0': 'dim', '\u00b07': 'dim7'
};

// Comfortable open-chord shape families (major), in CAGED order.
const SHAPE_FAMILIES = [
  { name: 'C', pc: 0 },
  { name: 'A', pc: 9 },
  { name: 'G', pc: 7 },
  { name: 'E', pc: 4 },
  { name: 'D', pc: 2 }
];

// Relative minor of each family, used when the band is in a minor key
// (an Am song uses the same open shapes as C, an Em song the same as G).
const FAMILY_MINOR_NAME = { 0: 'Am', 9: 'F#m', 7: 'Em', 4: 'C#m', 2: 'Bm' };

function familyLabel(fam, minorTarget) {
  return minorTarget ? FAMILY_MINOR_NAME[fam.pc] : fam.name;
}

/* ------------------------------------------------------------
   Spelling in the shape key
   Every family key here (C A G E D) has a natural-letter tonic, so we
   spell by scale degree: diatonic notes as in the key signature, #4
   as a sharp, and b2/b3/b6/b7 as flats. In G that gives Bb, Eb, F and
   C# (never A#, D#, E#), which is how guitarists read these chords.
------------------------------------------------------------ */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Semitones above the tonic -> letter steps above the tonic letter.
const DEGREE_LETTER_STEP = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

function spellInKey(pc, tonicName) {
  const tonicLetter = tonicName.charAt(0);
  const tonicPc = pcOf(tonicName);
  const rel = (((pc - tonicPc) % 12) + 12) % 12;
  const letter = LETTERS[(LETTERS.indexOf(tonicLetter) + DEGREE_LETTER_STEP[rel]) % 7];
  let acc = (((pc - LETTER_PC[letter]) % 12) + 12) % 12;
  if (acc > 6) acc -= 12;
  if (acc === 0) return letter;
  if (acc === 1) return letter + '#';
  if (acc === -1) return letter + 'b';
  return spell(pc, false); // safety net; not reached for C/A/G/E/D tonics
}

// Like transposeText (app.js), but spells results in the shape key.
function transposeToShapeKey(input, shift, tonicName) {
  return mapChordLines(input, (match, root, quality, bass) => {
    const newRoot = spellInKey(pcOf(root) + shift, tonicName);
    const newBass = bass ? '/' + spellInKey(pcOf(bass) + shift, tonicName) : '';
    return newRoot + quality + newBass;
  });
}

const gState = {
  shapes: new Set([2, 7, 0]), // default D, G, C
  targetValue: 'B',
  songKeyValue: 'auto', // key the pasted song is written in
  playInPc: null
};

/* ------------------------------------------------------------
   Fingering lookup
------------------------------------------------------------ */

// Bass-note names as the chord db spells its slash-chord suffixes.
const PC_TO_DBBASS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// Returns { shape, bassMissing } or null. For slash chords (D/F#, Am/G)
// it uses the db's real slash voicing when there is one; otherwise it
// falls back to the plain chord and flags that the bass isn't shown.
function guitarShape(rootPc, quality, bassPc) {
  const db = window.GUITAR_CHORDS;
  if (!db) return null;
  const root = PC_TO_DBROOT[((rootPc % 12) + 12) % 12];
  const suffix = SUFFIX_MAP.hasOwnProperty(quality) ? SUFFIX_MAP[quality] : 'major';
  const byRoot = db[root];
  if (!byRoot) return null;

  const hasBass = bassPc !== null && bassPc !== undefined && bassPc !== -1 &&
    ((bassPc % 12) + 12) % 12 !== ((rootPc % 12) + 12) % 12;
  if (hasBass && (suffix === 'major' || suffix === 'minor')) {
    const slashKey = (suffix === 'minor' ? 'm/' : '/') + PC_TO_DBBASS[((bassPc % 12) + 12) % 12];
    if (byRoot[slashKey]) return { shape: byRoot[slashKey][0], bassMissing: false };
  }

  const entry = byRoot[suffix] || byRoot['major'];
  return entry ? { shape: entry[0], bassMissing: hasBass } : null;
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

function targetIsMinor() {
  return keyMeta(gState.targetValue).minor;
}

// The key whose open shapes the song uses: a minor band key is played
// with its relative major's shapes (Am -> C shapes, Em -> G shapes).
function targetPc() {
  const meta = keyMeta(gState.targetValue);
  return meta.minor ? (meta.pc + 3) % 12 : meta.pc;
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
  const minor = targetIsMinor();
  sel.innerHTML = shapes
    .map((s, i) => `<option value="${s.pc}">${familyLabel(s, minor)} shapes \u00b7 capo ${s.capo}${i === 0 ? ' \u2014 recommended' : ''}</option>`)
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

  const minor = targetIsMinor();
  const chosenName = familyLabel(chosen, minor);

  led.textContent = chosen.capo === 0 ? '\u2014' : String(chosen.capo);
  led.classList.remove('flash'); void led.offsetWidth; led.classList.add('flash');
  foot.textContent = chosen.capo === 0
    ? `play in ${chosenName} \u00b7 no capo`
    : `play in ${chosenName}`;

  const target = keyDualLabel(gState.targetValue);
  const list = shapes.map(s =>
    `${familyLabel(s, minor)}\u2009\u2192\u2009${s.capo === 0 ? 'open' : 'capo ' + s.capo}`
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

  const songStyle = songAccidentalStyle(input);
  const target = keyForSong(keyMeta(gState.targetValue), songStyle);
  // Name shown for the band's key: the song's spelling, or both names
  // (A#/Bb) when the song doesn't tell us.
  const targetName = songStyle ? target.name : keyDualLabel(gState.targetValue);
  const family = SHAPE_FAMILIES.find(f => f.pc === gState.playInPc);
  const shapeMeta = { name: familyLabel(family, target.minor) };
  const capo = capoForShape(gState.playInPc);

  if (!input.trim()) {
    outEl.textContent = '';
    infoEl.innerHTML = capo === 0
      ? `Play open in <strong>${shapeMeta.name}</strong> \u2014 no capo needed.`
      : `Capo <strong>${capo}</strong>, then finger <strong>${shapeMeta.name}</strong> shapes to sound in ${targetName}.`;
    diagEl.innerHTML = '<p class="empty-hint">Paste the song to see the shapes you finger.</p>';
    return;
  }

  // Step 1: the song's own key (picked, or auto-detected from chord lines).
  // If it can't be found, treat the song as already in the band's key.
  let songPc, songMinor, songLabel, songNote = '';
  if (gState.songKeyValue === 'auto') {
    const detected = detectKey(input);
    if (detected) {
      songPc = detected.pc; songMinor = detected.minor;
      songLabel = detectedKeyName(input, detected);   // spelled as the song writes it
      songNote = ' (auto-detected)';
    } else {
      songPc = target.pc; songMinor = target.minor;
      songLabel = targetName;
      songNote = ' (couldn\u2019t detect \u2014 treated as the band\u2019s key; pick it above)';
    }
  } else {
    const sm = keyForSong(keyMeta(gState.songKeyValue), songStyle);
    songPc = sm.pc; songMinor = sm.minor; songLabel = sm.name;
  }
  // Compare keys through their relative majors, so a song detected as Fm
  // (relative minor of Ab/G#) still lines up with a band key of A#.
  const songMajorPc = songMinor ? (songPc + 3) % 12 : songPc;
  const toBand = ((targetPc() - songMajorPc) % 12 + 12) % 12;

  // Step 2: band's key -> the shapes you finger (down by the capo amount).
  const toShapes = ((gState.playInPc - targetPc()) % 12 + 12) % 12;
  const shapeText = transposeToShapeKey(input, (toBand + toShapes) % 12, family.name);
  outEl.textContent = shapeText;

  const moveShort = toBand > 6 ? toBand - 12 : toBand;
  const moveTxt = moveShort === 0 ? 'same key'
    : (moveShort > 0 ? '+' : '\u2212') + Math.abs(moveShort);
  const songLine = `Song <strong>${songLabel}</strong>${songNote} \u2192 band <strong>${targetName}</strong> (${moveTxt})<br>`;
  infoEl.innerHTML = songLine + (capo === 0
    ? `No capo \u00b7 finger these <strong>${shapeMeta.name}</strong> shapes (sounds in ${targetName}).`
    : `Capo <strong>${capo}</strong> \u00b7 finger these <strong>${shapeMeta.name}</strong> shapes (sounds in ${targetName}).`);

  const chords = extractChords(shapeText);
  diagEl.innerHTML = '';
  if (chords.length === 0) {
    diagEl.innerHTML = '<p class="empty-hint">No chord-only lines found. Put chords on their own line, e.g. <code>G C D Em</code>.</p>';
    return;
  }

  chords.forEach(token => {
    const parsed = parseChord(token);
    if (!parsed) return;
    const found = guitarShape(parsed.rootPc, parsed.quality, parsed.bassPc);
    const shape = found ? found.shape : null;

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
      if (found.bassMissing) {
        const note = document.createElement('div');
        note.className = 'chord-sub';
        note.textContent = `Bass ${token.split('/')[1]} not shown`;
        block.appendChild(note);
      }
      block.addEventListener('click', () => openGuitarModal(token, shape, found.bassMissing));
      block.addEventListener('keypress', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGuitarModal(token, shape, found.bassMissing); }
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

function openGuitarModal(token, shape, bassMissing) {
  document.getElementById('modalTitle').textContent = token;
  const sub = document.getElementById('modalSub');
  const fretText = shape.baseFret > 1 ? ` \u00b7 from fret ${shape.baseFret}` : '';
  const bassText = bassMissing ? ` \u00b7 bass ${token.split('/')[1]} not shown` : '';
  sub.textContent = 'Guitar \u00b7 standard tuning' + fretText + bassText;

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
  const songKeySel = document.getElementById('guitarSongKey');
  if (songKeySel) {
    gState.songKeyValue = songKeySel.value || 'auto';
    songKeySel.addEventListener('change', () => {
      gState.songKeyValue = songKeySel.value;
      renderGuitarSong();
    });
  }

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
