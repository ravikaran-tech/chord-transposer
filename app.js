console.log('app.js loaded (v2 - robust chord parsing)');

/* ==========================================================
   1. NOTE UTILITIES
   Two spellings of the 12 chromatic pitches. Which spelling
   we output depends on the target key (e.g. transposing into
   Eb should print "Eb, Ab, Bb", not "D#, G#, A#").
========================================================== */

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Accepts any common spelling on input and maps it to the sharp array
// index space, which we use internally for all math.
const NOTE_ALIASES = {
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

function noteIndex(note) {
  if (!note) return -1;
  const key = note[0].toUpperCase() + note.slice(1);
  return key in NOTE_ALIASES ? NOTE_ALIASES[key] : -1;
}

function normalizeNote(note) {
  const idx = noteIndex(note);
  return idx === -1 ? note : NOTES_SHARP[idx];
}

// The target-key dropdown only offers sharp-spelled roots (C, C#, D, D#...),
// so output always uses sharp spelling to match exactly what was selected -
// picking "C#" must produce literal C# chords, not the enharmonic "Db".
// (spellNote() still supports flat output below, kept available in case a
// flat-spelled key selector is added to the UI later.)
const KEY_ACCIDENTAL_PREFERENCE = {};
const DEFAULT_ACCIDENTAL = 'sharp';

function spellNote(index, preference) {
  return preference === 'flat' ? NOTES_FLAT[index] : NOTES_SHARP[index];
}

/* ==========================================================
   2. CHORD TOKEN GRAMMAR
   A single source of truth for "what does a chord look like".
   Used for: line classification, key detection, transposition,
   and the chord-reference panel.
========================================================== */

// Longest-first so the regex engine prefers "maj7" over "maj", etc.
const CHORD_QUALITIES = [
  'maj13', 'maj11', 'maj9', 'maj7', 'maj',
  'mMaj7', 'mmaj7',
  'm11', 'm9', 'm7b5', 'm7', 'm6/9', 'm6', 'madd9',
  'min7', 'min',
  'dim7', 'dim',
  'aug7', 'aug', '+',
  'sus4', 'sus2', 'sus',
  'add9', 'add11', 'add13', 'add2', 'add4',
  '6/9', '6',
  '7sus4', '7sus2', '7#9', '7b9', '7#5', '7b5', '7',
  '9', '11', '13', '5',
  'm', // plain minor triad - must come after longer m-prefixed entries
  ''   // plain major triad
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const QUALITY_PATTERN = CHORD_QUALITIES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|');

// Group 1: root letter, Group 2: accidental, Group 3: quality,
// Group 4/5: optional slash-bass root + accidental.
const CHORD_TOKEN_REGEX = new RegExp(
  `^([A-G])(#|b)?(${QUALITY_PATTERN})(?:\\/([A-G])(#|b)?)?$`
);

function isValidChordToken(token) {
  if (!token) return false;
  return CHORD_TOKEN_REGEX.test(token.trim());
}

function parseChordToken(token) {
  const m = token.trim().match(CHORD_TOKEN_REGEX);
  if (!m) return null;
  return {
    root: m[1] + (m[2] || ''),
    quality: m[3] || '',
    bass: m[4] ? m[4] + (m[5] || '') : null
  };
}

function isMinorQuality(quality) {
  // "m", "m7", "min", "min7"... but not "maj"
  return /^(m|min)(?!aj)/.test(quality);
}

/* ==========================================================
   3. TRANSPOSITION
========================================================== */

function transposeChordToken(token, shift, spellPref) {
  const parsed = parseChordToken(token);
  if (!parsed) return token;

  const rootIdx = noteIndex(parsed.root);
  if (rootIdx === -1) return token;

  const newRootIdx = (rootIdx + shift + 12) % 12;
  let result = spellNote(newRootIdx, spellPref) + parsed.quality;

  if (parsed.bass) {
    const bassIdx = noteIndex(parsed.bass);
    if (bassIdx !== -1) {
      const newBassIdx = (bassIdx + shift + 12) % 12;
      result += '/' + spellNote(newBassIdx, spellPref);
    } else {
      result += '/' + parsed.bass;
    }
  }

  return result;
}

// Chord-only line (chords on their own line, positioned above lyrics).
// Preserves the visual column of each chord by adjusting the whitespace
// run that follows it, so the lyric line underneath stays aligned even
// when a chord's printed length changes (e.g. "G" -> "C#").
function transposeChordOnlyLine(line, shift, spellPref) {
  const tokens = line.match(/\s+|\S+/g) || [];

  for (let i = 0; i < tokens.length; i++) {
    if (/^\s+$/.test(tokens[i])) continue;

    const original = tokens[i];
    const newTok = transposeChordToken(original, shift, spellPref);
    const diff = newTok.length - original.length;
    tokens[i] = newTok;

    if (diff !== 0 && i + 1 < tokens.length && /^\s+$/.test(tokens[i + 1])) {
      const nextLen = Math.max(1, tokens[i + 1].length - diff);
      tokens[i + 1] = ' '.repeat(nextLen);
    }
  }

  return tokens.join('');
}

// Inline / ChordPro-style line: chords embedded as [G] within lyric text.
// Also safely handles pure section markers like "[Verse 1]" - their
// bracket contents simply won't match the chord grammar, so they pass
// through unchanged.
function transposeInlineLine(line, shift, spellPref) {
  return line.replace(/\[([^\]]+)\]/g, (whole, inner) => {
    const trimmedInner = inner.trim();
    if (isValidChordToken(trimmedInner)) {
      return '[' + transposeChordToken(trimmedInner, shift, spellPref) + ']';
    }
    return whole;
  });
}

function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'blank';
  if (trimmed.includes('[') && trimmed.includes(']')) return 'inline';

  const tokens = trimmed.split(/\s+/);
  if (tokens.length > 0 && tokens.every(isValidChordToken)) return 'chordOnly';

  return 'lyric';
}

function transposeText(input, shift, spellPref) {
  return input
    .split(/\r\n|\r|\n/)
    .map(line => {
      switch (classifyLine(line)) {
        case 'inline':
          return transposeInlineLine(line, shift, spellPref);
        case 'chordOnly':
          return transposeChordOnlyLine(line, shift, spellPref);
        default:
          return line; // blank or lyric line: never touched
      }
    })
    .join('\n');
}

/* ==========================================================
   4. KEY DETECTION
========================================================== */

function chordTokenToKeyLabel(token) {
  const parsed = parseChordToken(token);
  if (!parsed) return null;
  const root = normalizeNote(parsed.root);
  return root + (isMinorQuality(parsed.quality) ? 'm' : '');
}

function detectKey(text) {
  // 1. Explicit declaration, e.g. "Key: G" or "Key = Ebm"
  const explicit = text.match(/^\s*key\s*[:=]\s*([A-G](?:#|b)?m?)\b/im);
  if (explicit) {
    const label = chordTokenToKeyLabel(explicit[1]) || explicit[1];
    return label;
  }

  const lines = text.split(/\r\n|\r|\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes('[') && trimmed.includes(']')) {
      const brackets = [...trimmed.matchAll(/\[([^\]]+)\]/g)];
      for (const b of brackets) {
        const inner = b[1].trim();
        if (isValidChordToken(inner)) {
          return chordTokenToKeyLabel(inner);
        }
      }
      continue; // bracket(s) present but none were chords -> section header
    }

    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 0 && tokens.every(isValidChordToken)) {
      return chordTokenToKeyLabel(tokens[0]);
    }
  }

  return 'C';
}

/* ==========================================================
   5. MAIN TRANSPOSE ACTION
========================================================== */

function transpose() {
  const inputEl = document.getElementById('inputText');
  const outputEl = document.getElementById('outputText');
  const detectedKeyEl = document.getElementById('detectedKeyInfo');
  const toKeyValue = document.getElementById('toKey').value;

  const input = inputEl.value;
  if (!input.trim()) {
    alert('Paste a song first');
    return;
  }

  const fromKeyLabel = detectKey(input);
  const fromKeyRoot = normalizeNote(fromKeyLabel.replace('m', ''));
  const toKeyRoot = normalizeNote(toKeyValue.replace('m', ''));

  const shift = (noteIndex(toKeyRoot) - noteIndex(fromKeyRoot) + 12) % 12;
  const spellPref = KEY_ACCIDENTAL_PREFERENCE[toKeyValue] || DEFAULT_ACCIDENTAL;

  const result = transposeText(input, shift, spellPref);

  outputEl.textContent = result;

  if (detectedKeyEl) {
    detectedKeyEl.textContent = `Detected original key: ${fromKeyLabel}  →  Transposing to ${toKeyValue}`;
  }

  const chords = extractChords(result);
  renderChordNotes(chords);
}

/* ==========================================================
   6. CHORD EXTRACTION (for the reference panel)
========================================================== */

function extractChords(text) {
  const chords = new Set();

  text.split(/\r\n|\r|\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.includes('[') && trimmed.includes(']')) {
      [...trimmed.matchAll(/\[([^\]]+)\]/g)].forEach(b => {
        const inner = b[1].trim();
        if (isValidChordToken(inner)) chords.add(inner);
      });
      return;
    }

    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 0 && tokens.every(isValidChordToken)) {
      tokens.forEach(t => chords.add(t));
    }
  });

  return [...chords];
}

/* ==========================================================
   7. TRIAD BUILDER (drives the piano reference diagram)
========================================================== */

function buildTriad(chord) {
  const parsed = parseChordToken(chord);
  if (!parsed) return null;

  const root = normalizeNote(parsed.root);
  const rootIndex = noteIndex(root);
  if (rootIndex === -1) return null;

  const quality = parsed.quality;
  let thirdInterval = 4; // major third by default
  let fifthInterval = 7; // perfect fifth by default

  if (/^dim/.test(quality)) {
    thirdInterval = 3; fifthInterval = 6;
  } else if (/^aug/.test(quality) || quality === '+') {
    thirdInterval = 4; fifthInterval = 8;
  } else if (/^sus2/.test(quality)) {
    thirdInterval = 2; fifthInterval = 7;
  } else if (/^sus4/.test(quality) || quality === 'sus') {
    thirdInterval = 5; fifthInterval = 7;
  } else if (isMinorQuality(quality)) {
    thirdInterval = 3; fifthInterval = 7;
  }

  const third = NOTES_SHARP[(rootIndex + thirdInterval) % 12];
  const fifth = NOTES_SHARP[(rootIndex + fifthInterval) % 12];

  return [root, third, fifth];
}

/* ==========================================================
   8. PIANO RENDERING
========================================================== */

const PIANO_LAYOUT = [
  { note: 'C',  type: 'white' },
  { note: 'C#', type: 'black' },
  { note: 'D',  type: 'white' },
  { note: 'D#', type: 'black' },
  { note: 'E',  type: 'white' },
  { note: 'F',  type: 'white' },
  { note: 'F#', type: 'black' },
  { note: 'G',  type: 'white' },
  { note: 'G#', type: 'black' },
  { note: 'A',  type: 'white' },
  { note: 'A#', type: 'black' },
  { note: 'B',  type: 'white' }
];

function renderPiano(activeNotes) {
  const piano = document.createElement('div');
  piano.className = 'piano';

  PIANO_LAYOUT.forEach(key => {
    if (key.type !== 'white') return;
    const el = document.createElement('div');
    el.className = 'white-key';
    if (activeNotes.includes(key.note)) el.classList.add('active');
    el.dataset.note = key.note;
    piano.appendChild(el);
  });

  const positionMap = { 'C#': 0.7, 'D#': 1.7, 'F#': 3.7, 'G#': 4.7, 'A#': 5.7 };

  PIANO_LAYOUT.forEach(key => {
    if (key.type !== 'black') return;
    const el = document.createElement('div');
    el.className = 'black-key';
    if (activeNotes.includes(key.note)) el.classList.add('active');
    el.style.left = `${positionMap[key.note] * 60}px`;
    piano.appendChild(el);
  });

  return piano;
}

/* ==========================================================
   9. CHORD REFERENCE UI
========================================================== */

function renderChordNotes(chords) {
  const container = document.getElementById('pianoChords');
  container.innerHTML = '';

  chords.forEach(chord => {
    const notes = buildTriad(chord);
    if (!notes) return;

    const block = document.createElement('div');
    block.style.marginBottom = '16px';

    const title = document.createElement('strong');
    title.textContent = `${chord} → ${notes.join(', ')}`;
    block.appendChild(title);

    block.appendChild(renderPiano(notes));
    container.appendChild(block);
  });
}

function exportPDF() {
  window.print();
}
