'use strict';

/* ============================================================
   SONG SHEET PDF EXPORT
   ------------------------------------------------------------
   Builds a real PDF file of the transposed song that looks like a
   normal chord sheet (white Letter page, Helvetica, bold section
   labels), not a printout of the app.

   - Chords are placed over the same letter of the lyric below,
     measured in the real font, so they stay over the right word.
   - Long lines: the whole sheet shrinks a little (down to 9 pt);
     if a line still doesn't fit, the chord line and its lyric line
     wrap together at a word break, so chords never drift.
   - Phone: opens the Share sheet (Save to Files, Print, AirDrop…).
     Elsewhere: downloads the file.
   Uses isChordOnlyLine() from app.js. jsPDF loads on first use.
============================================================ */

const SONGPDF_LIB = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const SONGPDF = {
  pageW: 612, pageH: 792,      // US Letter, points
  margin: 72,                  // 1 inch, like a Pages/Word document
  size: 13, minSize: 9,        // font size (matches a typical Pages/Word sheet) and the smallest it may shrink to
  lead: 1.2                    // line height = size * lead
};

let songPdfLibPromise = null;
function songPdfLoadLib() {
  if (window.jspdf) return Promise.resolve();
  if (!songPdfLibPromise) {
    songPdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SONGPDF_LIB;
      s.onload = resolve;
      s.onerror = () => { songPdfLibPromise = null; reject(new Error('Couldn’t download the PDF maker. Check your internet and try again.')); };
      document.head.appendChild(s);
    });
  }
  return songPdfLibPromise;
}

// Standard PDF fonts only cover basic Latin; swap the few symbols that aren't.
function songPdfSafe(s) {
  return s.replace(/\t/g, '    ')
    .replace(/[−]/g, '-')
    .replace(/[→]/g, '->')
    .replace(/[^\x20-\x7E -ÿ–—‘’“”…•]/g, '?');
}

const SONGPDF_LABEL = /^\s*[A-Za-z][A-Za-z \-]*\d*\s*:/;   // "Prelude:", "Verse 2:"

// Split text into blocks: { chord, lyric } pairs, or single lines.
function songPdfBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(songPdfSafe);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const chordLine = line.trim() && isChordOnlyLine(line);
    const label = SONGPDF_LABEL.test(line);
    if (chordLine && !label && next !== undefined && next.trim() && !isChordOnlyLine(next)) {
      blocks.push({ type: 'pair', chord: line.replace(/\s+$/, ''), lyric: next.replace(/\s+$/, '') });
      i++;
    } else if (!line.trim()) {
      blocks.push({ type: 'blank' });
    } else {
      blocks.push({ type: 'line', text: line.replace(/\s+$/, ''), bold: label });
    }
  }
  return blocks;
}

// Chord words with their column in the chord line.
function songPdfChordCols(chordLine) {
  const out = [];
  chordLine.replace(/\S+/g, (w, col) => { out.push({ text: w, col }); return w; });
  return out;
}

// x offset (from the left margin) of each chord, over the lyric letter
// at the same column. Past the end of the lyric: continue with spaces.
function songPdfChordXs(doc, chords, lyric) {
  const space = doc.getTextWidth(' ');
  const lyricW = doc.getTextWidth(lyric);
  let prevEnd = -Infinity;
  return chords.map(c => {
    let x = c.col <= lyric.length
      ? doc.getTextWidth(lyric.slice(0, c.col))
      : lyricW + (c.col - lyric.length) * space;
    x = Math.max(x, prevEnd + space);       // never let two chords touch
    prevEnd = x + doc.getTextWidth(c.text);
    return x;
  });
}

function songPdfPairWidth(doc, b) {
  const chords = songPdfChordCols(b.chord);
  const xs = songPdfChordXs(doc, chords, b.lyric);
  const chordEnd = chords.length ? xs[xs.length - 1] + doc.getTextWidth(chords[chords.length - 1].text) : 0;
  return Math.max(chordEnd, doc.getTextWidth(b.lyric));
}

function songPdfWidest(doc, blocks, size) {
  let w = 0;
  blocks.forEach(b => {
    if (b.type === 'pair') { doc.setFont('helvetica', 'normal').setFontSize(size); w = Math.max(w, songPdfPairWidth(doc, b)); }
    if (b.type === 'line') { doc.setFont('helvetica', b.bold ? 'bold' : 'normal').setFontSize(size); w = Math.max(w, doc.getTextWidth(b.text)); }
  });
  return w;
}

// Wrap a pair that's too wide: cut the lyric at a space that fits, and
// cut the chord line at the same column, so each chord keeps its word.
function songPdfWrapPair(doc, b, maxW) {
  const parts = [];
  let chord = b.chord;
  let lyric = b.lyric;
  let guard = 0;
  while (songPdfPairWidth(doc, { chord, lyric }) > maxW && guard++ < 50) {
    let cut = -1;
    for (let i = 1; i < lyric.length; i++) {
      if (lyric[i] === ' ' && doc.getTextWidth(lyric.slice(0, i)) <= maxW) cut = i;
    }
    if (cut <= 0) break;                       // one huge word: leave it
    // Don't split a chord: move the cut left to a gap in the chord line.
    while (cut > 0 && chord[cut] && chord[cut] !== ' ' && chord[cut - 1] && chord[cut - 1] !== ' ') cut--;
    if (cut <= 0) break;
    parts.push({ chord: chord.slice(0, cut).replace(/\s+$/, ''), lyric: lyric.slice(0, cut).replace(/\s+$/, '') });
    const rest = lyric.slice(cut).match(/^\s*/)[0].length;   // drop leading spaces on the new line
    chord = chord.slice(cut + rest);
    lyric = lyric.slice(cut + rest);
  }
  parts.push({ chord, lyric });
  return parts;
}

// Plain lines that are too wide: wrap at spaces.
function songPdfWrapLine(doc, text, maxW) {
  const out = [];
  let rest = text;
  let guard = 0;
  while (doc.getTextWidth(rest) > maxW && guard++ < 50) {
    let cut = -1;
    for (let i = 1; i < rest.length; i++) if (rest[i] === ' ' && doc.getTextWidth(rest.slice(0, i)) <= maxW) cut = i;
    if (cut <= 0) break;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
  }
  out.push(rest);
  return out;
}

async function buildSongPdf(text) {
  await songPdfLoadLib();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const S = SONGPDF;
  const maxW = S.pageW - 2 * S.margin;
  const blocks = songPdfBlocks(text);

  // Shrink the whole sheet (same size everywhere) until the widest line fits.
  let size = S.size;
  while (size > S.minSize && songPdfWidest(doc, blocks, size) > maxW) size -= 0.5;
  const lh = size * S.lead;

  let y = S.margin + size;                    // first baseline
  const bottom = S.pageH - S.margin;
  const room = n => {                          // keep n lines together on one page
    if (y + (n - 1) * lh > bottom) { doc.addPage(); y = S.margin + size; }
  };

  blocks.forEach(b => {
    if (b.type === 'blank') {
      if (y > S.margin + size) y += lh;        // no blank line at the top of a page
      return;
    }
    if (b.type === 'line') {
      doc.setFont('helvetica', b.bold ? 'bold' : 'normal').setFontSize(size);
      songPdfWrapLine(doc, b.text, maxW).forEach(t => { room(1); doc.text(t, S.margin, y); y += lh; });
      return;
    }
    doc.setFont('helvetica', 'normal').setFontSize(size);
    songPdfWrapPair(doc, b, maxW).forEach(p => {
      room(2);
      const chords = songPdfChordCols(p.chord);
      songPdfChordXs(doc, chords, p.lyric).forEach((x, i) => doc.text(chords[i].text, S.margin + x, y));
      y += lh;
      doc.text(p.lyric, S.margin, y);
      y += lh;
    });
  });
  return doc;
}

function songPdfFileName(text, keyName) {
  const first = (text.split('\n').find(l => l.trim()) || 'Song').trim();
  const m = first.match(TITLE_KEY_REGEX);              // "Song - Bbm": use the title's own key
  const key = keyBoth(m ? m[3] + m[4] + m[5] : keyName);   // "Bbm (A#m)"
  const title = (m ? m[1] : first).replace(/[\\/:*?"<>|]+/g, '').slice(0, 60).trim() || 'Song';
  return `${title} - ${key}.pdf`.replace(/\s+/g, ' ');
}

// Share sheet on phones (Save to Files, Print…), download elsewhere.
async function saveOrShareSongPdf(doc, fileName) {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName.replace(/\.pdf$/, '') });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // Share failed for another reason: fall back to a download.
    }
  }
  doc.save(fileName);
  return 'saved';
}

async function exportSongPdf(opts) {
  const out = document.getElementById(opts.output);
  const btn = document.getElementById(opts.button);
  const text = out ? out.textContent : '';
  if (!text.trim()) {
    if (opts.onMessage) opts.onMessage('Transpose a song first, then export.', 'error');
    return;
  }
  if (btn) { btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = 'Making PDF…'; }
  try {
    const doc = await buildSongPdf(text);
    const res = await saveOrShareSongPdf(doc, songPdfFileName(text, opts.keyName()));
    if (opts.onMessage) opts.onMessage(res === 'cancelled' ? '' : 'PDF ready.', 'ok');
  } catch (e) {
    if (opts.onMessage) opts.onMessage(e.message || 'Couldn’t make the PDF.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  }
}

function initSongPdf() {
  const btn = document.getElementById('exportBtn');
  if (!btn) return;
  const note = document.getElementById('exportNote');
  btn.addEventListener('click', () => exportSongPdf({
    output: 'outputText',
    button: 'exportBtn',
    // The key as the result spells it (Bb or A#, following the song).
    keyName: () => keyForSong(keyMeta(document.getElementById('toKey').value),
      songAccidentalStyle(document.getElementById('inputText').value)).name,   // keyBoth() adds the other name
    onMessage: (msg, kind) => {
      if (!note) return;
      note.textContent = msg;
      note.className = 'alt-line export-note' + (kind ? ' ' + kind : '');
      note.hidden = !msg;
    }
  }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSongPdf);
} else {
  initSongPdf();
}
