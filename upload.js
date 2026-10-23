'use strict';

/* ============================================================
   UPLOAD A SONG  (both tabs)
   Reads a photo/screenshot, PDF, Word (.docx) or text file into the
   song box so it can be checked and transposed.
   - Text files, Word and text PDFs: text is taken out exactly.
   - Photos and scanned PDFs: free in-browser text recognition
     (tesseract.js). Needs internet the first time (~10 MB download).
   Libraries load from the CDN only when first needed.
   Uses from app.js (read-only): ANCHORED_CHORD_REGEX.
============================================================ */

const UPLOAD_LIBS = {
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js'
};

const TEXT_EXTENSIONS = ['txt', 'text', 'md', 'markdown', 'cho', 'chopro', 'chordpro',
  'crd', 'pro', 'chord', 'csv', 'tab', 'log'];

/* ------------------------------------------------------------
   Pure helpers (no DOM) — tested in Node
------------------------------------------------------------ */

// Characters the text reader often produces instead of "#" in some fonts
// (C# read as "Cit", A#m as "AiFm" or "AdFm", G# as "GF").
const SHARP_MISREAD_CHARS = 'iIlLfFtTkKdHh#4!1+*:';

function isChordWord(word) {
  return ANCHORED_CHORD_REGEX.test(word);
}

// If `word` is a chord with a misread sharp (Cit, AiFm, AdFm, GF), return
// the repaired chord (C#, A#m, A#m, G#). Otherwise return null. Only used
// on lines where every word is a chord, never on lyric lines.
function repairSharp(word) {
  const m = word.match(/^([A-G])(.+)$/);
  if (!m) return null;
  const rest = m[2];
  for (let n = 1; n <= 3 && n <= rest.length; n++) {
    const junk = rest.slice(0, n);
    if (![...junk].every(ch => SHARP_MISREAD_CHARS.includes(ch))) break;
    const fixed = m[1] + '#' + rest.slice(n);
    if (isChordWord(fixed)) return fixed;
  }
  return null;
}

// words: [{ text }] for one line. If every word is a chord (or a chord
// with a misread sharp), repair them in place and return the number of
// repairs. Returns -1 for a lyric/text line (left untouched).
function repairChordLine(words) {
  if (!words.length) return -1;
  const fixes = [];
  for (const w of words) {
    if (isChordWord(w.text)) { fixes.push(null); continue; }
    const t = w.text.replace(/^[(]+|[),.;:]+$/g, '');
    if (isChordWord(t)) { fixes.push(null); continue; }
    const r = repairSharp(t);
    if (!r) return -1;
    fixes.push(r);
  }
  let n = 0;
  words.forEach((w, i) => { if (fixes[i]) { w.fixedFrom = w.text; w.text = fixes[i]; n++; } });
  return n;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Rebuild monospaced text from positioned words, so chords stay above the
// right lyric words. lines: [{ y, words: [{ text, x0, x1 }] }] (any order).
// Returns { text, repaired: [{ from, to }] }.
function layoutLines(lines, opts) {
  opts = opts || {};
  const sorted = lines.filter(l => l.words.length).sort((a, b) => a.y - b.y);
  const widths = [];
  sorted.forEach(l => l.words.forEach(w => {
    const len = w.text.length;
    if (len >= 3) widths.push((w.x1 - w.x0) / len);
  }));
  const charW = median(widths) || 10;
  const minX = Math.min(...sorted.map(l => Math.min(...l.words.map(w => w.x0))));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].y - sorted[i - 1].y);
  const pitch = median(gaps);

  const repaired = [];
  const out = [];
  sorted.forEach((l, i) => {
    if (i > 0 && pitch && sorted[i].y - sorted[i - 1].y > pitch * 1.6) out.push('');
    const words = l.words.slice().sort((a, b) => a.x0 - b.x0);
    if (opts.repair !== false && repairChordLine(words) > 0) {
      words.forEach(w => { if (w.fixedFrom) repaired.push({ from: w.fixedFrom, to: w.text }); });
    }
    // First word: column from the left edge. Next words: spaces from the
    // gap to the previous word (one space for a normal word gap), so lyric
    // lines stay tidy and chords keep their place over the words.
    let line = '';
    let prev = null;
    words.forEach(w => {
      if (!prev) {
        line = ' '.repeat(Math.max(0, Math.round((w.x0 - minX) / charW)));
      } else {
        line += ' '.repeat(Math.max(1, Math.round((w.x0 - prev.x1) / charW)));
      }
      line += w.text;
      prev = w;
    });
    out.push(line.replace(/\s+$/, ''));
  });
  return { text: out.join('\n'), repaired };
}

// Very small RTF-to-text converter (enough for chord sheets).
function rtfToText(rtf) {
  let s = rtf.replace(/\r\n?/g, '\n');
  s = s.replace(/\{\\\*[^{}]*\}/g, '');                       // ignorable groups
  s = s.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, '');
  s = s.replace(/\\par[d]?\b ?|\\line\b ?/g, '\n');
  s = s.replace(/\\tab\b ?/g, '    ');
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode((+n + 65536) % 65536));
  s = s.replace(/\\([{}\\])/g, '$1');
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '');
  s = s.replace(/^ /, '');                // space after the opening control words
  s = s.replace(/[{}]/g, '');
  return s.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '');
}

function cleanText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[   ]/g, ' ')
    .replace(/[♯]/g, '#')            // ♯ -> #
    .replace(/[♭]/g, 'b')            // ♭ -> b
    .replace(/[ ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}

function fileKind(file) {
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const type = file.type || '';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif'].includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || type.includes('wordprocessingml')) return 'docx';
  if (ext === 'rtf' || type.includes('rtf')) return 'rtf';
  if (ext === 'html' || ext === 'htm' || type === 'text/html') return 'html';
  if (ext === 'doc') return 'doc-old';
  if (type.startsWith('text/') || TEXT_EXTENSIONS.includes(ext)) return 'text';
  return 'unknown';
}

/* ------------------------------------------------------------
   Library loading
------------------------------------------------------------ */

const uploadLibPromises = {};
function loadScript(url) {
  if (!uploadLibPromises[url]) {
    uploadLibPromises[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => { delete uploadLibPromises[url]; reject(new Error('Couldn’t download the reader. Check your internet and try again.')); };
      document.head.appendChild(s);
    });
  }
  return uploadLibPromises[url];
}

let ocrWorkerPromise = null;
function getOcrWorker(onProgress) {
  uploadProgressHandler = onProgress;
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = loadScript(UPLOAD_LIBS.tesseract).then(() =>
      window.Tesseract.createWorker('eng', 1, {
        logger: m => { if (uploadProgressHandler) uploadProgressHandler(m); }
      })
    ).then(async w => {
      await w.setParameters({ preserve_interword_spaces: '1' });
      return w;
    }).catch(err => { ocrWorkerPromise = null; throw err; });
  }
  return ocrWorkerPromise;
}
let uploadProgressHandler = null;

/* ------------------------------------------------------------
   Readers — each returns { text, repaired: [], source }
------------------------------------------------------------ */

function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Small screenshots read better when enlarged.
      const scale = img.naturalWidth < 1200 ? 2 : 1;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth * scale;
      c.height = img.naturalHeight * scale;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image format can’t be opened here. Try a PNG or JPG screenshot.'));
    };
    img.src = url;
  });
}

async function ocrCanvas(canvas, onProgress) {
  const worker = await getOcrWorker(onProgress);
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const lines = [];
  (data.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    lines.push({
      y: l.bbox.y0,
      words: l.words.map(w => ({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 }))
    });
  })));
  return layoutLines(lines);
}

async function readImage(file, onProgress) {
  const canvas = await loadImageToCanvas(file);
  const r = await ocrCanvas(canvas, onProgress);
  return { text: r.text, repaired: r.repaired, source: 'photo' };
}

async function readPdf(file, onProgress) {
  await loadScript(UPLOAD_LIBS.pdfjs);
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = UPLOAD_LIBS.pdfWorker;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  let textChars = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = new Map();
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      textChars += it.str.trim().length;
      const y = Math.round(-it.transform[5] / 2) * 2;      // top-down, 2pt buckets
      const x0 = it.transform[4];
      if (!byY.has(y)) byY.set(y, []);
      // Keep internal spacing of an item by splitting it into words.
      const cw = it.str.length ? it.width / it.str.length : 0;
      it.str.replace(/\S+/g, (w, idx) => {
        byY.get(y).push({ text: w, x0: x0 + idx * cw, x1: x0 + (idx + w.length) * cw });
        return w;
      });
    });
    pages.push({ page, lines: [...byY.entries()].map(([y, words]) => ({ y, words })) });
  }

  // Text PDF: lay out each page's words. Scanned PDF: read the page images.
  if (textChars > 20) {
    const parts = pages.map(pg => layoutLines(pg.lines, { repair: false }).text);
    return { text: parts.join('\n\n'), repaired: [], source: 'PDF' };
  }
  const texts = [];
  let repaired = [];
  for (let i = 0; i < pages.length; i++) {
    if (onProgress) onProgress({ status: `reading page ${i + 1} of ${pages.length}`, progress: 0 });
    const viewport = pages[i].page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = viewport.width; c.height = viewport.height;
    await pages[i].page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
    const r = await ocrCanvas(c, onProgress);
    texts.push(r.text);
    repaired = repaired.concat(r.repaired);
  }
  return { text: texts.join('\n\n'), repaired, source: 'scanned PDF' };
}

async function readDocx(file) {
  await loadScript(UPLOAD_LIBS.mammoth);
  const res = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  // Word paragraphs come back separated by a blank line; one line each is
  // what a chord sheet needs.
  const text = res.value.replace(/\r\n?/g, '\n').replace(/\n\n/g, '\n');
  return { text, repaired: [], source: 'Word file' };
}

async function readAnyFile(file, onProgress) {
  const kind = fileKind(file);
  let r;
  if (kind === 'image') r = await readImage(file, onProgress);
  else if (kind === 'pdf') r = await readPdf(file, onProgress);
  else if (kind === 'docx') r = await readDocx(file);
  else if (kind === 'rtf') r = { text: rtfToText(await file.text()), repaired: [], source: 'RTF file' };
  else if (kind === 'html') {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    r = { text: doc.body ? doc.body.innerText || doc.body.textContent : '', repaired: [], source: 'web page' };
  } else if (kind === 'doc-old') {
    throw new Error('Old Word (.doc) files can’t be read. In Word, save it as .docx or PDF and upload that.');
  } else {
    const text = await file.text();
    if (/\u0000/.test(text.slice(0, 2000))) {
      throw new Error('This file type can’t be read. Use a photo, screenshot, PDF, Word (.docx) or text file.');
    }
    r = { text, repaired: [], source: 'text file' };
  }
  r.text = cleanText(r.text || '');
  return r;
}

/* ------------------------------------------------------------
   UI wiring
------------------------------------------------------------ */

function escapeHtmlUpload(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function initUploadFor(cfg) {
  const btn = document.getElementById(cfg.button);
  const input = document.getElementById(cfg.input);
  const status = document.getElementById(cfg.status);
  const box = document.getElementById(cfg.textarea);
  if (!btn || !input || !status || !box) return;

  const setStatus = (html, kind) => {
    status.innerHTML = html;
    status.className = 'upload-status' + (kind ? ' ' + kind : '');
    status.hidden = !html;
  };

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    btn.disabled = true;
    setStatus(`Reading <strong>${escapeHtmlUpload(file.name)}</strong>…`, 'busy');
    const onProgress = m => {
      if (!m || !m.status) return;
      const pct = m.progress ? ' ' + Math.round(m.progress * 100) + '%' : '';
      const what = /recogniz/.test(m.status) ? 'Reading text' :
        /load|initializ/.test(m.status) ? 'Getting the reader ready (first time only)' : m.status;
      setStatus(`${what}${pct}…`, 'busy');
    };
    try {
      const r = await readAnyFile(file, onProgress);
      if (!r.text.trim()) {
        setStatus('No text found in this file. Try a clearer photo or a different file.', 'error');
        return;
      }
      box.value = r.text;
      let msg = `Read from ${r.source}. `;
      if (r.repaired.length) {
        const eg = r.repaired.slice(0, 3).map(x => `${escapeHtmlUpload(x.from)} → ${escapeHtmlUpload(x.to)}`).join(', ');
        msg += `<strong>Fixed ${r.repaired.length} chord${r.repaired.length > 1 ? 's' : ''}</strong> that looked misread (${eg}). `;
      }
      msg += (r.source === 'photo' || r.source === 'scanned PDF')
        ? 'Please check the chords and words below, then transpose.'
        : 'Check it below, then transpose.';
      setStatus(msg, 'ok');
      if (typeof cfg.after === 'function') cfg.after();
    } catch (err) {
      setStatus(escapeHtmlUpload(err && err.message ? err.message : 'Couldn’t read this file.'), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function initUpload() {
  initUploadFor({
    button: 'pianoUploadBtn', input: 'pianoUploadInput', status: 'pianoUploadStatus',
    textarea: 'inputText',
    after: () => { if (typeof runTranspose === 'function') runTranspose(); }
  });
  initUploadFor({
    button: 'guitarUploadBtn', input: 'guitarUploadInput', status: 'guitarUploadStatus',
    textarea: 'guitarInput',
    after: () => { if (typeof renderGuitarSong === 'function') renderGuitarSong(); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpload);
} else {
  initUpload();
}
