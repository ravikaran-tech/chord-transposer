/* =========================================================
   WAIT FOR DOM (CRITICAL FIX FOR PDF UPLOAD)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

/* =========================================================
   DOM REFERENCES
========================================================= */
const homeScreen = document.getElementById("homeScreen");
const transposeScreen = document.getElementById("transposeScreen");

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const toKeySelect = document.getElementById("toKey");

const pdfInput = document.getElementById("pdfInput");
const pdfViewer = document.getElementById("pdfViewer");

const pianoChords = document.getElementById("pianoChords");
const toggleChords = document.getElementById("toggleChords");
const chordSection = document.getElementById("chordSection");


/* =========================================================
   UI MODE SWITCH
========================================================= */
function toggleInputMode(isPDF) {
  inputText.style.display = isPDF ? "none" : "block";
}


/* =========================================================
   SESSION RESET
========================================================= */
function resetSession() {
  inputText.value = "";
  outputText.textContent = "";
  pdfViewer.innerHTML = "";
  pianoChords.innerHTML = "";
  importedPDF = null;

  toggleInputMode(false);

  if (toggleChords) toggleChords.checked = false;
  if (chordSection) chordSection.style.display = "none";
}


/* =========================================================
   THEME SYSTEM
========================================================= */
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme");

  const theme = saved
    ? saved
    : window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  root.setAttribute("data-theme", theme);
  updateThemeIcon(theme);
})();

window.toggleTheme = function () {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeIcon(next);
};

function updateThemeIcon(theme) {
  const btn = document.querySelector(".theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}


/* =========================================================
   NAVIGATION
========================================================= */
window.openTranspose = function () {
  homeScreen.classList.remove("active");
  transposeScreen.classList.add("active");
};

window.goHome = function () {
  transposeScreen.classList.remove("active");
  homeScreen.classList.add("active");
  resetSession();
};


/* =========================================================
   MUSIC THEORY
========================================================= */
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const ENHARMONIC = { Db:"C#", Eb:"D#", Gb:"F#", Ab:"G#", Bb:"A#" };

const CHORD_REGEX =
/\b([A-G](?:#|b)?)(maj7|m7|m|sus4|sus2|dim|aug|add9|7)?\b/g;

function normalize(note) { return ENHARMONIC[note] || note; }
function noteIndex(note) { return NOTES.indexOf(normalize(note)); }


/* =========================================================
   KEY DETECTION
========================================================= */
function detectKey(text) {
  const matches = text.match(CHORD_REGEX);
  if (!matches) return "C";

  const count = {};
  matches.forEach(c => {
    const root = normalize(c.replace(/[^A-G#b]/g,""));
    count[root] = (count[root] || 0) + 1;
  });

  return Object.keys(count).sort((a,b)=>count[b]-count[a])[0] || "C";
}


/* =========================================================
   CHORD TRANSPOSE
========================================================= */
function transposeChord(chord, shift) {
  const m = chord.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m) return chord;

  const idx = noteIndex(normalize(m[1]));
  if (idx === -1) return chord;

  return NOTES[(idx + shift + 12) % 12] + m[2];
}


/* =========================================================
   CHORD DISPLAY
========================================================= */
function extractChords(text) {
  const matches = text.match(CHORD_REGEX);
  return matches ? [...new Set(matches)] : [];
}

function buildTriad(chord) {
  const m = chord.match(/^([A-G](?:#|b)?)(m?)/);
  if (!m) return null;

  const i = noteIndex(normalize(m[1]));
  const minor = m[2] === "m";

  return [
    NOTES[i],
    NOTES[(i + (minor ? 3 : 4)) % 12],
    NOTES[(i + 7) % 12]
  ];
}

function renderChordNotes(chords) {
  pianoChords.innerHTML = "";
  chords.forEach(ch => {
    const triad = buildTriad(ch);
    if (!triad) return;

    const div = document.createElement("div");
    div.textContent = `${ch} → ${triad.join(", ")}`;
    pianoChords.appendChild(div);
  });
}

window.toggleChordView = function () {
  chordSection.style.display = toggleChords.checked ? "block" : "none";
};


/* =========================================================
   TEXT TRANSPOSE
========================================================= */
function transposeText() {
  const input = inputText.value.trim();
  if (!input) return alert("Paste a song first");

  const toKey = normalize(toKeySelect.value.replace("m",""));
  const fromKey = detectKey(input);
  const shift = (noteIndex(toKey) - noteIndex(fromKey) + 12) % 12;

  const result = input.replace(CHORD_REGEX, c => transposeChord(c, shift));

  outputText.textContent = result;
  renderChordNotes(extractChords(result));
}


/* =========================================================
   PDF STATE
========================================================= */
let importedPDF = null;


/* =========================================================
   PDF UPLOAD (NOW WORKS)
========================================================= */
pdfInput.addEventListener("change", async (e) => {

  resetSession();

  const file = e.target.files[0];
  if (!file) return;

  toggleInputMode(true);

  const buffer = await file.arrayBuffer();
  importedPDF = await pdfjsLib.getDocument({ data: buffer }).promise;

  await renderPDFPreview();
});


/* =========================================================
   RENDER PDF
========================================================= */
async function renderPDFPreview() {
  pdfViewer.innerHTML = "";

  for (let p = 1; p <= importedPDF.numPages; p++) {
    const page = await importedPDF.getPage(p);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    pdfViewer.appendChild(canvas);
  }
}


/* =========================================================
   PDF TRANSPOSE
========================================================= */
async function transposePDF() {

  const toKey = normalize(toKeySelect.value.replace("m",""));

  let fullText = "";
  for (let p = 1; p <= importedPDF.numPages; p++) {
    const page = await importedPDF.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map(i => i.str).join(" ");
  }

  const fromKey = detectKey(fullText);
  const shift = (noteIndex(toKey) - noteIndex(fromKey) + 12) % 12;

  renderChordNotes(extractChords(fullText.replace(CHORD_REGEX, c => transposeChord(c, shift))));

  const canvases = pdfViewer.querySelectorAll("canvas");

  for (let i = 0; i < canvases.length; i++) {
    const page = await importedPDF.getPage(i + 1);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.5 });
    const ctx = canvases[i].getContext("2d");

    content.items.forEach(item => {
      if (CHORD_REGEX.test(item.str)) {
        const x = item.transform[4] * viewport.scale;
        const y = canvases[i].height - item.transform[5] * viewport.scale;

        ctx.fillStyle = "white";
        ctx.fillRect(x - 2, y - 12, 50, 14);

        ctx.fillStyle = "black";
        ctx.font = "12px Helvetica";
        ctx.fillText(transposeChord(item.str, shift), x, y);
      }
    });
  }
}


/* =========================================================
   MAIN TRANSPOSE
========================================================= */
window.transpose = function () {
  if (importedPDF) transposePDF();
  else transposeText();
};


/* =========================================================
   EXPORT PDF
========================================================= */
window.exportPDF = async function () {

  if (!importedPDF && !outputText.textContent.trim())
    return alert("Nothing to export.");

  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  if (importedPDF) {
    const canvases = pdfViewer.querySelectorAll("canvas");

    for (const canvas of canvases) {
      const imgBytes = await fetch(canvas.toDataURL("image/png")).then(r => r.arrayBuffer());
      const img = await pdfDoc.embedPng(imgBytes);

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
  } else {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(outputText.textContent, { x: 50, y: 800, size: 12 });
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "transposed-song.pdf";
  a.click();

  URL.revokeObjectURL(url);
};

}); // END DOMContentLoaded