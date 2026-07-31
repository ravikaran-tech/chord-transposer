'use strict';

/* ============================================================
   NOTE / PITCH-CLASS UTILITIES
============================================================ */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// For parsing input, accept any spelling and map to a pitch class 0-11.
const NAME_TO_PC = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

function pcOf(name) {
  return NAME_TO_PC.hasOwnProperty(name) ? NAME_TO_PC[name] : -1;
}

// Spell a pitch class using sharps or flats based on the target key.
function spell(pc, useFlats) {
  const idx = ((pc % 12) + 12) % 12;
  return useFlats ? FLAT_NAMES[idx] : SHARP_NAMES[idx];
}

/* ============================================================
   KEY TABLES (conventional spelling + accidental preference)
============================================================ */

const MAJOR_KEYS = [
  { name: 'C',  pc: 0,  flats: false },
  { name: 'Db', pc: 1,  flats: true  },
  { name: 'D',  pc: 2,  flats: false },
  { name: 'Eb', pc: 3,  flats: true  },
  { name: 'E',  pc: 4,  flats: false },
  { name: 'F',  pc: 5,  flats: true  },
  { name: 'F#', pc: 6,  flats: false },
  { name: 'G',  pc: 7,  flats: false },
  { name: 'Ab', pc: 8,  flats: true  },
  { name: 'A',  pc: 9,  flats: false },
  { name: 'Bb', pc: 10, flats: true  },
  { name: 'B',  pc: 11, flats: false }
];

const MINOR_KEYS = [
  { name: 'Cm',  pc: 0,  flats: true  },
  { name: 'C#m', pc: 1,  flats: false },
  { name: 'Dm',  pc: 2,  flats: true  },
  { name: 'Ebm', pc: 3,  flats: true  },
  { name: 'Em',  pc: 4,  flats: false },
  { name: 'Fm',  pc: 5,  flats: true  },
  { name: 'F#m', pc: 6,  flats: false },
  { name: 'Gm',  pc: 7,  flats: true  },
  { name: 'G#m', pc: 8,  flats: false },
  { name: 'Am',  pc: 9,  flats: false },
  { name: 'Bbm', pc: 10, flats: true  },
  { name: 'Bm',  pc: 11, flats: false }
];

const MAJOR_BY_PC = {};
MAJOR_KEYS.forEach(k => { MAJOR_BY_PC[k.pc] = k; });
const MINOR_BY_PC = {};
MINOR_KEYS.forEach(k => { MINOR_BY_PC[k.pc] = k; });

// Explicit spelling per selectable key, so both enharmonics (C# and Db,
// F# and Gb, etc.) are honored with the right accidentals. C# major reads
// in sharps; Db major reads in flats — same keys on the keyboard.
const KEY_SPELLING = {
  'C':  { pc: 0,  flats: false }, 'C#': { pc: 1,  flats: false }, 'Db': { pc: 1,  flats: true  },
  'D':  { pc: 2,  flats: false }, 'D#': { pc: 3,  flats: false }, 'Eb': { pc: 3,  flats: true  },
  'E':  { pc: 4,  flats: false }, 'F':  { pc: 5,  flats: true  }, 'F#': { pc: 6,  flats: false },
  'Gb': { pc: 6,  flats: true  }, 'G':  { pc: 7,  flats: false }, 'G#': { pc: 8,  flats: false },
  'Ab': { pc: 8,  flats: true  }, 'A':  { pc: 9,  flats: false }, 'A#': { pc: 10, flats: false },
  'Bb': { pc: 10, flats: true  }, 'B':  { pc: 11, flats: false },

  'Cm':  { pc: 0,  flats: true  }, 'C#m': { pc: 1,  flats: false }, 'Dm':  { pc: 2,  flats: true  },
  'D#m': { pc: 3,  flats: false }, 'Ebm': { pc: 3,  flats: true  }, 'Em':  { pc: 4,  flats: false },
  'Fm':  { pc: 5,  flats: true  }, 'F#m': { pc: 6,  flats: false }, 'Gm':  { pc: 7,  flats: true  },
  'G#m': { pc: 8,  flats: false }, 'Am':  { pc: 9,  flats: false }, 'A#m': { pc: 10, flats: false },
  'Bbm': { pc: 10, flats: true  }, 'Bm':  { pc: 11, flats: false }
};

// Resolve a dropdown value like "C#" / "Eb" / "F#m" / "Am" into key metadata.
function keyMeta(value) {
  const minor = value.endsWith('m');
  const spelling = KEY_SPELLING[value];
  if (spelling) return { name: value, pc: spelling.pc, flats: spelling.flats, minor };
  // Fallback for any unexpected value.
  const root = minor ? value.slice(0, -1) : value;
  const pc = pcOf(root);
  if (pc === -1) return { name: value, pc: 0, flats: false, minor };
  const base = minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc];
  return { name: base.name, pc: base.pc, flats: base.flats, minor };
}

function keyNameFromPc(pc, minor) {
  const base = minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc];
  return base ? base.name : spell(pc, false) + (minor ? 'm' : '');
}

/* ============================================================
   CHORD QUALITY / FORMULA TABLE
   Intervals are semitones from the root.
============================================================ */

const CHORD_FORMULAS = {
  '':      { intervals: [0, 4, 7],             minor: false, label: 'Major' },
  'maj':   { intervals: [0, 4, 7],             minor: false, label: 'Major' },
  'M':     { intervals: [0, 4, 7],             minor: false, label: 'Major' },
  '6':     { intervals: [0, 4, 7, 9],          minor: false, label: 'Major 6' },
  '69':    { intervals: [0, 4, 7, 9, 14],      minor: false, label: 'Major 6/9' },
  'maj7':  { intervals: [0, 4, 7, 11],         minor: false, label: 'Major 7' },
  'maj9':  { intervals: [0, 4, 7, 11, 14],     minor: false, label: 'Major 9' },
  'maj13': { intervals: [0, 4, 7, 11, 14, 21], minor: false, label: 'Major 13' },
  'add9':  { intervals: [0, 4, 7, 14],         minor: false, label: 'Add 9' },
  'add2':  { intervals: [0, 2, 4, 7],          minor: false, label: 'Add 2' },
  'add11': { intervals: [0, 4, 7, 17],         minor: false, label: 'Add 11' },

  'sus2':   { intervals: [0, 2, 7],     minor: false, label: 'Sus2' },
  'sus4':   { intervals: [0, 5, 7],     minor: false, label: 'Sus4' },
  'sus':    { intervals: [0, 5, 7],     minor: false, label: 'Sus4' },
  '7sus4':  { intervals: [0, 5, 7, 10], minor: false, label: '7sus4' },
  '7sus2':  { intervals: [0, 2, 7, 10], minor: false, label: '7sus2' },

  'aug': { intervals: [0, 4, 8],     minor: false, label: 'Augmented' },
  '+':   { intervals: [0, 4, 8],     minor: false, label: 'Augmented' },
  '7#5': { intervals: [0, 4, 8, 10], minor: false, label: '7#5' },
  '7b5': { intervals: [0, 4, 6, 10], minor: false, label: '7b5' },

  '7':     { intervals: [0, 4, 7, 10],         minor: false, label: 'Dominant 7' },
  '7#9':   { intervals: [0, 4, 7, 10, 15],     minor: false, label: '7#9' },
  '7b9':   { intervals: [0, 4, 7, 10, 13],     minor: false, label: '7b9' },
  '7#11':  { intervals: [0, 4, 7, 10, 18],     minor: false, label: '7#11' },
  '9':     { intervals: [0, 4, 7, 10, 14],     minor: false, label: 'Dominant 9' },
  '9#11':  { intervals: [0, 4, 7, 10, 14, 18], minor: false, label: '9#11' },
  '13b9':  { intervals: [0, 4, 7, 10, 13, 21], minor: false, label: '13b9' },
  '11':    { intervals: [0, 4, 7, 10, 14, 17], minor: false, label: 'Dominant 11' },
  '13':    { intervals: [0, 4, 7, 10, 14, 21], minor: false, label: 'Dominant 13' },

  'm':     { intervals: [0, 3, 7],             minor: true, label: 'Minor' },
  'min':   { intervals: [0, 3, 7],             minor: true, label: 'Minor' },
  '-':     { intervals: [0, 3, 7],             minor: true, label: 'Minor' },
  'm6':    { intervals: [0, 3, 7, 9],          minor: true, label: 'Minor 6' },
  'm7':    { intervals: [0, 3, 7, 10],         minor: true, label: 'Minor 7' },
  'min7':  { intervals: [0, 3, 7, 10],         minor: true, label: 'Minor 7' },
  'm7b5':  { intervals: [0, 3, 6, 10],         minor: true, label: 'Half-diminished (m7\u266d5)' },
  'm9':    { intervals: [0, 3, 7, 10, 14],     minor: true, label: 'Minor 9' },
  'm11':   { intervals: [0, 3, 7, 10, 14, 17], minor: true, label: 'Minor 11' },
  'm13':   { intervals: [0, 3, 7, 10, 14, 21], minor: true, label: 'Minor 13' },
  'mMaj7': { intervals: [0, 3, 7, 11],         minor: true, label: 'Minor-Major 7' },
  'mmaj7': { intervals: [0, 3, 7, 11],         minor: true, label: 'Minor-Major 7' },
  'madd9': { intervals: [0, 3, 7, 14],         minor: true, label: 'Minor Add9' },

  'dim':  { intervals: [0, 3, 6],     minor: true, label: 'Diminished' },
  'dim7': { intervals: [0, 3, 6, 9],  minor: true, label: 'Diminished 7' },
  'o':    { intervals: [0, 3, 6],     minor: true, label: 'Diminished' },
  'o7':   { intervals: [0, 3, 6, 9],  minor: true, label: 'Diminished 7' },
  '\u00f8':  { intervals: [0, 3, 6, 10], minor: true, label: 'Half-diminished' },
  '\u00f87': { intervals: [0, 3, 6, 10], minor: true, label: 'Half-diminished' }
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const QUALITY_KEYS = Object.keys(CHORD_FORMULAS).sort((a, b) => b.length - a.length);
const QUALITY_ALT = QUALITY_KEYS.map(escapeRegExp).join('|');

const ANCHORED_CHORD_REGEX = new RegExp(
  `^([A-G](?:#|b)?)(${QUALITY_ALT})(?:\\/([A-G](?:#|b)?))?$`
);

const CHORD_TOKEN_REGEX = new RegExp(
  `\\b([A-G](?:#|b)?)(${QUALITY_ALT})(?:\\/([A-G](?:#|b)?))?\\b`,
  'g'
);

function parseChord(token) {
  const m = token.match(ANCHORED_CHORD_REGEX);
  if (!m) return null;
  return {
    rootPc: pcOf(m[1]),
    quality: m[2],
    bassPc: m[3] ? pcOf(m[3]) : null,
    formula: CHORD_FORMULAS[m[2]]
  };
}

/* ============================================================
   KEY DETECTION
============================================================ */

function isChordOnlyLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('[')) return false;
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(tok => ANCHORED_CHORD_REGEX.test(tok));
}

// Returns { pc, minor } for the detected key, or null.
function detectKey(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (!isChordOnlyLine(line)) continue;
    const firstToken = line.trim().split(/[\s,]+/)[0];
    const parsed = parseChord(firstToken);
    if (parsed) return { pc: parsed.rootPc, minor: parsed.formula.minor };
  }
  CHORD_TOKEN_REGEX.lastIndex = 0;
  const anyMatch = CHORD_TOKEN_REGEX.exec(text);
  if (anyMatch) {
    const parsed = parseChord(anyMatch[0]);
    if (parsed) return { pc: parsed.rootPc, minor: parsed.formula.minor };
  }
  return null;
}

/* ============================================================
   TRANSPOSITION
============================================================ */

function transposeText(input, shift, useFlats) {
  return input.replace(CHORD_TOKEN_REGEX, (match, root, quality, bass) => {
    const newRoot = spell(pcOf(root) + shift, useFlats);
    const newBass = bass ? '/' + spell(pcOf(bass) + shift, useFlats) : '';
    return newRoot + quality + newBass;
  });
}

function extractChords(text) {
  const lines = text.split('\n');
  const chords = [];
  const seen = new Set();
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[')) return;
    const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 0) return;
    if (!tokens.every(tok => ANCHORED_CHORD_REGEX.test(tok))) return;
    tokens.forEach(tok => {
      if (!seen.has(tok)) { seen.add(tok); chords.push(tok); }
    });
  });
  return chords;
}

function buildChordTones(chordToken, useFlats) {
  const parsed = parseChord(chordToken);
  if (!parsed || parsed.rootPc === -1) return null;

  const notePcs = [];
  const seenPc = new Set();
  parsed.formula.intervals.forEach(interval => {
    const pc = (parsed.rootPc + interval) % 12;
    if (!seenPc.has(pc)) { seenPc.add(pc); notePcs.push(pc); }
  });
  if (parsed.bassPc !== null && !seenPc.has(parsed.bassPc)) {
    notePcs.unshift(parsed.bassPc);
    seenPc.add(parsed.bassPc);
  }

  return {
    label: chordToken,
    qualityLabel: parsed.formula.label,
    notePcs,
    noteNames: notePcs.map(pc => spell(pc, useFlats))
  };
}

/* ============================================================
   STATE
============================================================ */

const state = {
  quickShift: null,
  toValue: 'D',
  fromValue: 'auto',
  lastFlats: false
};

/* ============================================================
   QUICK KEY TRANSPOSE  (hero LED readout)
============================================================ */

function quickTranspose() {
  const from = keyMeta(document.getElementById('quickFromKey').value);
  const to = keyMeta(document.getElementById('quickToKey').value);

  const rawUp = (to.pc - from.pc + 12) % 12;
  const shortShift = rawUp > 6 ? rawUp - 12 : rawUp;
  state.quickShift = shortShift;

  const ledEl = document.getElementById('ledValue');
  const altEl = document.getElementById('quickResultAlt');

  const sign = shortShift > 0 ? '+' : (shortShift < 0 ? '\u2212' : '');
  ledEl.textContent = sign + Math.abs(shortShift);
  ledEl.classList.remove('flash');
  void ledEl.offsetWidth;
  ledEl.classList.add('flash');

  const other = shortShift > 0 ? shortShift - 12 : shortShift + 12;
  const otherSign = other > 0 ? '+' : (other < 0 ? '\u2212' : '');
  const semis = Math.abs(shortShift) === 1 ? 'semitone' : 'semitones';
  altEl.textContent =
    `${from.name} \u2192 ${to.name} is ${Math.abs(shortShift)} ${semis} ` +
    `${shortShift >= 0 ? 'up' : 'down'}  ·  or ${otherSign}${Math.abs(other)} the other way`;
}

/* ============================================================
   SONG / CHORD TRANSPOSE
============================================================ */

function runTranspose() {
  const inputEl = document.getElementById('inputText');
  const outputEl = document.getElementById('outputText');
  const detectedInfoEl = document.getElementById('detectedInfo');
  const input = inputEl.value;

  if (!input.trim()) {
    outputEl.textContent = '';
    detectedInfoEl.textContent = 'Paste a song or chord list above, then transpose.';
    renderChordNotes([], false);
    return;
  }

  const to = keyMeta(state.toValue);

  let fromPc, fromLabel, autoNote = '';
  if (state.fromValue === 'auto') {
    const detected = detectKey(input);
    if (detected) {
      fromPc = detected.pc;
      fromLabel = keyNameFromPc(detected.pc, detected.minor);
      autoNote = ' (auto-detected)';
    } else {
      fromPc = 0;
      fromLabel = 'C';
      autoNote = ' (couldn\u2019t detect \u2014 assumed C)';
    }
  } else {
    const from = keyMeta(state.fromValue);
    fromPc = from.pc;
    fromLabel = from.name;
  }

  const shift = (to.pc - fromPc + 12) % 12;
  state.lastFlats = to.flats;

  const result = transposeText(input, shift, to.flats);
  outputEl.textContent = result;

  const shortShift = shift > 6 ? shift - 12 : shift;
  const sign = shortShift > 0 ? '+' : (shortShift < 0 ? '\u2212' : '');
  detectedInfoEl.innerHTML =
    `<strong>${fromLabel}</strong>${autoNote} \u2192 <strong>${to.name}</strong>` +
    `  ·  ${sign}${Math.abs(shortShift)} semitones`;

  renderChordNotes(extractChords(result), to.flats);
}

// Nudge the target key by a semitone and re-transpose.
function stepSemitone(delta) {
  const to = keyMeta(state.toValue);
  const newPc = ((to.pc + delta) % 12 + 12) % 12;
  const newName = keyNameFromPc(newPc, to.minor);
  state.toValue = newName;
  document.getElementById('toKey').value = newName;
  runTranspose();
}

async function copyOutput() {
  const text = document.getElementById('outputText').textContent;
  const btn = document.getElementById('copyBtn');
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }
  const original = btn.textContent;
  btn.textContent = 'Copied';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1400);
}

/* ============================================================
   PIANO RENDERING
============================================================ */

const PIANO_LAYOUT = [
  { pc: 0, type: 'white' }, { pc: 1, type: 'black' },
  { pc: 2, type: 'white' }, { pc: 3, type: 'black' },
  { pc: 4, type: 'white' }, { pc: 5, type: 'white' },
  { pc: 6, type: 'black' }, { pc: 7, type: 'white' },
  { pc: 8, type: 'black' }, { pc: 9, type: 'white' },
  { pc: 10, type: 'black' }, { pc: 11, type: 'white' }
];

const BLACK_KEY_POSITION = { 1: 0.68, 3: 1.72, 6: 3.68, 8: 4.72, 10: 5.72 };

function renderPiano(activePcs, opts) {
  const options = opts || {};
  const whiteW = options.large ? 40 : 25;
  const whiteH = options.large ? 168 : 78;
  const blackW = options.large ? 24 : 15;
  const blackH = options.large ? 104 : 48;

  const piano = document.createElement('div');
  piano.className = 'piano';
  piano.style.height = whiteH + 'px';
  piano.style.width = (whiteW * 7) + 'px';

  PIANO_LAYOUT.forEach(key => {
    if (key.type !== 'white') return;
    const el = document.createElement('div');
    el.className = 'white-key';
    el.style.width = whiteW + 'px';
    el.style.height = whiteH + 'px';
    if (activePcs.includes(key.pc)) el.classList.add('active');
    piano.appendChild(el);
  });

  PIANO_LAYOUT.forEach(key => {
    if (key.type !== 'black') return;
    const el = document.createElement('div');
    el.className = 'black-key';
    el.style.width = blackW + 'px';
    el.style.height = blackH + 'px';
    if (activePcs.includes(key.pc)) el.classList.add('active');
    el.style.left = `${BLACK_KEY_POSITION[key.pc] * whiteW}px`;
    piano.appendChild(el);
  });

  return piano;
}

/* ============================================================
   AUDIO PLAYBACK
============================================================ */

let audioCtx = null;

function playChord(notePcs) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);

    let prevMidi = 59; // ascend from just below C4
    notePcs.forEach(pc => {
      let midi = 60 + (pc % 12);
      while (midi <= prevMidi) midi += 12;
      prevMidi = midi;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 1.6);
    });
  } catch (e) {
    console.warn('Audio unavailable', e);
  }
}

/* ============================================================
   CHORD REFERENCE UI
============================================================ */

function renderChordNotes(chords, useFlats) {
  const container = document.getElementById('pianoChords');
  container.innerHTML = '';

  if (!chords || chords.length === 0) {
    container.innerHTML =
      '<p class="empty-hint">Transpose a song or chord list to see its shapes on the keyboard.</p>';
    return;
  }

  chords.forEach(chordToken => {
    const data = buildChordTones(chordToken, useFlats);
    if (!data) return;

    const block = document.createElement('div');
    block.className = 'chord-block';
    block.tabIndex = 0;

    const head = document.createElement('div');
    head.className = 'chord-head';

    const title = document.createElement('span');
    title.className = 'chord-name';
    title.textContent = data.label;
    head.appendChild(title);

    const play = document.createElement('button');
    play.className = 'play-btn';
    play.setAttribute('aria-label', 'Play ' + data.label);
    play.textContent = '\u25B6';
    play.addEventListener('click', e => {
      e.stopPropagation();
      playChord(data.notePcs);
    });
    head.appendChild(play);
    block.appendChild(head);

    const sub = document.createElement('div');
    sub.className = 'chord-sub';
    sub.textContent = `${data.qualityLabel} · ${data.noteNames.join(' ')}`;
    block.appendChild(sub);

    block.appendChild(renderPiano(data.notePcs));

    block.addEventListener('click', () => openChordModal(data));
    block.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChordModal(data); }
    });

    container.appendChild(block);
  });
}

/* ============================================================
   MODAL
============================================================ */

function openChordModal(data) {
  document.getElementById('modalTitle').textContent = data.label;
  document.getElementById('modalSub').textContent =
    `${data.qualityLabel} · ${data.noteNames.join('  ')}`;

  const pianoWrap = document.getElementById('modalPianoContainer');
  pianoWrap.innerHTML = '';
  pianoWrap.appendChild(renderPiano(data.notePcs, { large: true }));

  const playBtn = document.getElementById('modalPlayBtn');
  playBtn.style.display = '';
  playBtn.onclick = () => playChord(data.notePcs);

  document.getElementById('chordModal').classList.add('open');
}

function closeChordModal() {
  document.getElementById('chordModal').classList.remove('open');
}

/* ============================================================
   INIT
============================================================ */

function initEventListeners() {
  document.getElementById('quickTransposeBtn').addEventListener('click', quickTranspose);
  document.getElementById('quickFromKey').addEventListener('change', quickTranspose);
  document.getElementById('quickToKey').addEventListener('change', quickTranspose);

  const toKey = document.getElementById('toKey');
  const fromKey = document.getElementById('fromKey');
  toKey.addEventListener('change', () => { state.toValue = toKey.value; runTranspose(); });
  fromKey.addEventListener('change', () => { state.fromValue = fromKey.value; runTranspose(); });

  document.getElementById('transposeBtn').addEventListener('click', runTranspose);
  document.getElementById('stepDownBtn').addEventListener('click', () => stepSemitone(-1));
  document.getElementById('stepUpBtn').addEventListener('click', () => stepSemitone(1));
  document.getElementById('copyBtn').addEventListener('click', copyOutput);
  document.getElementById('exportBtn').addEventListener('click', () => window.print());

  document.getElementById('modalCloseBtn').addEventListener('click', closeChordModal);
  document.getElementById('chordModal').addEventListener('click', e => {
    if (e.target.id === 'chordModal') closeChordModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeChordModal();
  });

  // Seed defaults.
  state.toValue = toKey.value;
  state.fromValue = fromKey.value;
  quickTranspose();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEventListeners);
} else {
  initEventListeners();
}
