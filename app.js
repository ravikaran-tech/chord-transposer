console.log('app.js loaded');

/* ======================
   BASIC NOTE UTILITIES
====================== */

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const FLAT_TO_SHARP = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#'
};

function normalizeNote(note) {
  return FLAT_TO_SHARP[note] || note;
}

function noteIndex(note) {
  return NOTES.indexOf(normalizeNote(note));
}

/* ======================
   TRANSPOSITION
====================== */

function detectKey(text) {
  const m = text.match(/\b[A-G](?:#|b)?m?\b/);
  return m ? normalizeNote(m[0].replace('m','')) : 'C';
}

function transposeChord(chord, shift) {
  const m = chord.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m) return chord;

  const root = normalizeNote(m[1]);
  const suffix = m[2] || '';
  const idx = noteIndex(root);

  if (idx === -1) return chord;

  return NOTES[(idx + shift + 12) % 12] + suffix;
}

function transpose() {
  console.log('Transpose clicked');

  const inputEl = document.getElementById('inputText');
  const outputEl = document.getElementById('outputText');
  const toKeyValue = document.getElementById('toKey').value;

  const input = inputEl.value;
  if (!input.trim()) {
    alert('Paste a song first');
    return;
  }

  const toKey = toKeyValue.replace('m','');
  const fromKey = detectKey(input);
  const shift = (noteIndex(toKey) - noteIndex(fromKey) + 12) % 12;

  const chordRegex =
    /\b[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g;

  const result = input.replace(chordRegex, c =>
    transposeChord(c, shift)
  );

  outputEl.textContent = result;

  const chords = extractChords(result);
  renderChordNotes(chords);
}

/* ======================
   CHORD EXTRACTION
   (CHORD LINES ONLY)
====================== */

function extractChords(text) {
  const lines = text.split('\n');
  const chords = new Set();

  lines.forEach(line => {
    const trimmed = line.trim();

    // Ignore empty lines and section headers
    if (!trimmed || trimmed.startsWith('[')) return;

    // Split by whitespace
    const tokens = trimmed.split(/\s+/);

    // Every token must be a valid chord
    const allChords = tokens.every(tok =>
      /^[A-G](?:#|b)?m?$/.test(tok)
    );

    if (!allChords) return;

    tokens.forEach(tok => chords.add(tok));
  });

  return [...chords];
}



/* ======================
   TRIAD BUILDER
====================== */

function buildTriad(chord) {
  const match = chord.match(/^([A-G](?:#|b)?)(m?)/);
  if (!match) return null;

  const root = normalizeNote(match[1]);
  const isMinor = match[2] === 'm';

  const rootIndex = noteIndex(root);
  if (rootIndex === -1) return null;

  const thirdInterval = isMinor ? 3 : 4;
  const fifthInterval = 7;

  const third = NOTES[(rootIndex + thirdInterval) % 12];
  const fifth = NOTES[(rootIndex + fifthInterval) % 12];

  return [root, third, fifth];
}

/* ======================
   PIANO RENDERING
====================== */

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

  // Create white keys first
  PIANO_LAYOUT.forEach(key => {
    if (key.type !== 'white') return;

    const el = document.createElement('div');
    el.className = 'white-key';

    if (activeNotes.includes(key.note)) {
      el.classList.add('active');
    }

    el.dataset.note = key.note;
    piano.appendChild(el);
  });

  // Overlay black keys
  PIANO_LAYOUT.forEach((key, i) => {
    if (key.type !== 'black') return;

    const el = document.createElement('div');
    el.className = 'black-key';

    if (activeNotes.includes(key.note)) {
      el.classList.add('active');
    }

    // Position black keys correctly
    const positionMap = {
      'C#': 0.7,
      'D#': 1.7,
      'F#': 3.7,
      'G#': 4.7,
      'A#': 5.7
    };

    el.style.left = `${positionMap[key.note] * 60}px`;
    piano.appendChild(el);
  });

  return piano;
}


/* ======================
   CHORD REFERENCE UI
====================== */

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

