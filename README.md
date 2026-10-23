# 🎹🎸 Chord Transposer

A stage-ready, offline-first chord transposer for piano and guitar. Paste a song
or a chord list, transpose it to any key, and see exactly what to play — piano
shapes with sound, or guitar shapes with a capo.

Installable as a PWA (Progressive Web App): works offline, no App Store needed.

---

## What it does

### 🎹 Piano tab

- **Quick Key Transpose** — pick "my key" and the band's key, and a round
  **Transpose** dial shows the amount instantly (e.g. `C# → E` reads `+3`),
  the same way a keyboard's transpose knob works. A scale track underneath
  (−5 to +6) marks where the value sits, and a line below shows the octave-
  equivalent alternative (`+3` is the same as `−9`).
- **Song & Chord Transposer** — paste a whole song (chords + lyrics) or a bare
  chord list like `C, F, G`, or **upload** it (see [Upload a song](#-upload-a-song-piano--guitar)).
  Auto-detects the original key, or set it manually.
  Semitone nudge buttons (`−1` / `+1`), Copy, and Export as PDF.
- **Lyrics are never changed** — only lines made entirely of chords are
  transposed (chords on their own line above the lyrics). A lyric word like
  "A" in "A great High Priest" or "Am" in "Am I wrong" stays as written.
  Chord lines may also have a label (`Intro:`, `Verse 1:`), bar lines `|`,
  dashes, repeat marks (`x2`, `(x2)`) and `N.C.`.
- **Long lines never wrap** — song lines keep their exact shape at the same
  text size, so every chord stays over its word; swipe sideways for long
  lines. (Export PDF still wraps very long lines so nothing is cut off on
  paper.)
- **Correct sharps/flats** — transposing to F gives you `Bb`, not `A#`; to D
  gives you `F#`, not `Gb`. Keys with two names are listed with both —
  **C#/Db, D#/Eb, F#/Gb, G#/Ab, A#/Bb** — and the result follows **your
  song's spelling**: a song written with sharps gets sharps (`G# C# D#` →
  `A# D# F`), a song written with flats gets flats (`Ab Db Eb` → `Bb Eb F`).
  A song with no sharps or flats uses the key's usual spelling.
- **Chord Reference** — every unique chord in the transposed result, shown as
  a small piano diagram. Tap any chord to enlarge it and **hear it played**
  (Web Audio, no sound files needed).
- **Full chord vocabulary** — major, minor, diminished (`dim`, `dim7`),
  augmented, sus2/sus4, 6/7/9/11/13, `maj7`, `m7`, `m7b5` (half-diminished),
  `mMaj7`, `add9`, altered dominants (`7b9`, `7#9`, `9#11`, `7#5`, etc.), and
  slash chords (`C/G`). Common other ways of writing them are understood too:
  `C5`, `C2`, `C4`, `Cadd4`, `C7sus`, `C9sus4`, `CM7`, `Cma7`, `CΔ7`,
  `Cmaj7#11`, `C6/9`, `C(add9)`, `C7(b9)`, `C7(#9)`, `C7alt`, `Cmi`, `Cmi7`,
  `C-7`, `Cm(add9)`, `Cm(maj7)`, `C°`, `C°7`.

### 🎸 Guitar tab

- **Capo finder** — tell it which chord shapes you're comfortable playing
  (any combination of C / A / G / E / D — the "CAGED" open shapes), and the
  band's actual key. It works out the lowest-fret capo position that lets you
  play in one of your known shapes.
  - Example: you play in **D, G, C**. The band's song is in **B**. The app
    tells you: capo **4**, play **G shapes** — and shows the other options
    too (D shapes → capo 9, C shapes → capo 11) so you can see why G wins.
- **Minor keys** — if the band's key is minor, the capo finder uses the
  relative major's shapes and labels them by their minor name (C shapes show
  as **Am**, G as **Em**, D as **Bm**, A as **F#m**, E as **C#m**). An Am song
  with C/G/D shapes → **Am shapes, no capo**.
- **Song's key box** — paste (or upload) the song in whatever key it's
  written in, and set **Song's key** (or leave **Auto-detect**). The app
  moves it to the band's key, then into your shapes. Example: chart in
  **G#**, band plays in **A#** → with G shapes: **capo 3**, finger
  `G C D` / `Em C G`.
- **Shape-aware song transposer** — converts every chord into the shapes
  you actually finger on the fretboard (accounting for the capo), not just
  a plain transposition.
  Chords are spelled to fit the shape key, so G shapes give `Bb` and `Eb`,
  never `A#` or `D#`.
- **Slash chords** — major and minor slash chords (`D/F#`, `Am/G`, `C/E`…)
  get a real slash-chord fingering with the bass note. For other slash
  chords, the plain chord is drawn with a "Bass X not shown" note.
- **Fretboard diagrams** — every chord gets a real fingering diagram (open
  strings, muted strings, fret dots, barres, and a fret-number label for
  shapes played up the neck). Tap to enlarge with finger numbers.
- Standard tuning (EADGBE) for now; other tunings planned.
- Fingering data derived from the open-source
  [`@tombatossals/chords-db`](https://github.com/tombatossals/chords-db)
  (MIT-licensed), bundled locally so diagrams work fully offline.

### 📄 Upload a song (Piano + Guitar)

Tap **Upload song** above the song box on either tab.

- **Accepts:** photos and screenshots (PNG, JPG…), PDF, Word (`.docx`),
  and text files (`.txt`, `.md`, ChordPro `.cho`/`.chordpro`/`.pro`,
  `.crd`, `.rtf`, `.html`, `.csv`).
- **Text, Word and text PDFs** are read exactly, keeping each chord over its
  word.
- **Photos, screenshots and scanned PDFs** are read with free text
  recognition that runs in your browser (no account, no cost; your file is
  not sent anywhere). It needs internet the first time (about 10 MB).
- **Misread sharps are repaired** — some fonts' `#` gets read as "it", "F"
  or "d" (`Cit`, `AiFm`). On lines made only of chords, the app turns those
  back into sharps (`C#`, `A#m`) and tells you how many it fixed.
- The text lands in the song box so you can **check and correct it**, then
  pick your key and transpose.
- Not supported: old Word `.doc` (save as `.docx` or PDF), `.odt`, `.pages`.

### 🎤 Live Chord Lookup (Piano + Guitar)

A small always-visible card above both tabs for the moment mid-song when
someone calls out a chord live — including an accidental that isn't in the
song's key, so the full transposer's key detection shouldn't be involved.

- **Type names (optional)** — enter who's in the band and who you are
  (e.g. **Hillary** and **Allen**). The whole card then uses the names:
  "Hillary's key" / "Allen's key", "Hillary called it (band) → Allen plays",
  results like `F# in D (Hillary) → F in C# (Allen)`, and guitar hints like
  "Allen, play: capo 3, D shape". Leave them blank for the plain wording.
  Names are saved with the keys; a **Clear names** link removes them.
- Set **Band Key** and **Your Key** once (Band Key defaults to `D`, Your Key
  to `C#`; both fully editable). Both are remembered between visits.
- Flip the direction depending on who's talking:
  - **Band called it → I play** — they shout a chord in their key, you get
    what to play in yours.
  - **I called it → band plays** — you played an accidental in your key,
    you get the plain chord name to tell the band in theirs.
- Pick the root and quality from dropdowns (no typing, fast to use on stage)
  and the answer appears instantly.
- On the Guitar tab, **Band → I play** also suggests a capo + shape using
  whichever open shapes you already selected in "Shapes I can play". For
  minor chords it prefers a shape with an open minor form (A, E or D →
  "open Am / Em / Dm shape").
- Independent of the full song transposer and its key-detection logic —
  a live accidental is never mistaken for the song's tonic.

**Example:** Band plays in **G**, your instrument reads **C#** (a `+6`
transpose). Mid-song someone calls an accidental **D#** — the card shows
**A**: press A, your transpose device turns it into the D# the band hears.

---

## Example

**Input (piano, chord list):**
```
C, F, G, Am
```

**Transpose to Db →**
```
Db, Gb, Ab, Bbm
```

**Chord Reference:**
```
Db   → Db, F, Ab
Gb   → Gb, Bb, Db
Ab   → Ab, C, Eb
Bbm  → Bb, Db, F
```

**Input (guitar, capo scenario):**

You're comfortable in D, G, C. The band plays this in B:
```
B  E  F#m  A
```

**App output:** `CAPO 4 · play in G` → finger `G  C  Dm  F` while the capo
does the rest of the transposing for you.

---

## Who this is for

- 🎹 Piano players who need an instant transpose readout mid-set
- 🎸 Guitarists who want to keep playing familiar open shapes when the band
  changes key, using a capo
- 🎼 Worship leaders / singers who need to move a song to a comfortable range
- 👩‍💻 Beginners learning how music theory maps to code

## What this app does NOT do

- It does not auto-compose music
- It does not guess chords by ear (no audio input / pitch detection)
- It does not require internet once installed (service worker caches the
  app) — except the first time you upload a photo, PDF or Word file, which
  downloads the free reader

---

## How it works (under the hood)

```
┌──────────────────┐
│   Song Text      │
│ (Lyrics + Chords) │
└─────────┬─────────┘
          ▼
┌──────────────────────┐
│ Chord Detection      │
│ • Finds chord-only    │
│   lines               │
│ • Ignores lyric lines │
└─────────┬─────────────┘
          ▼
┌───────────────────────┐
│ Transposition         │
│ • Detects / accepts   │
│   the original key    │
│ • Shifts every root   │
│   + bass note         │
│ • Spells with sharps  │
│   or flats to match   │
│   the target key      │
│ • Preserves quality   │
│   (m7b5, sus4, add9…) │
└─────────┬──────────────┘
          ▼
   ┌──────┴───────┐
   ▼              ▼
┌─────────┐  ┌──────────────────┐
│ Piano   │  │ Guitar            │
│ • Builds│  │ • Maps song key   │
│   full  │  │   → known shape   │
│   chord │  │   family + capo   │
│   tones │  │ • Re-transposes   │
│ • Piano │  │   chords into the │
│   key   │  │   shape you play  │
│   image │  │ • Fretboard       │
│ • Plays │  │   diagram (SVG)   │
│   sound │  │                   │
└─────────┘  └──────────────────┘
```

## Tech notes

- Pure HTML/CSS/JS — no build step, no framework.
- `app.js` — piano engine: note/chord math, key detection, transposition,
  piano rendering, Web Audio playback.
- `guitar.js` + `guitar-chords.js` — guitar engine: capo math, shape-family
  transposition, SVG fretboard diagrams, bundled fingering database.
- `live-lookup.js` — Live Chord Lookup widget: single-chord Band Key ↔ Your
  Key translator shared by both tabs. Reads note/chord helpers from `app.js`
  and shape/capo helpers from `guitar.js` read-only; does not modify either.
- `upload.js` — Upload a song: reads photos/scanned PDFs with
  [tesseract.js](https://github.com/naptha/tesseract.js), text PDFs with
  [pdf.js](https://mozilla.github.io/pdf.js/), Word with
  [mammoth.js](https://github.com/mwilliamson/mammoth.js) (all loaded from
  the jsDelivr CDN on first use), rebuilds the chord-over-lyric layout from
  word positions and repairs misread sharps on chord lines.
- `service-worker.js` — offline caching (network-first for the app shell, so
  new deploys are picked up automatically; cache-first for everything else).
- `manifest.json` — installable as a home-screen app on mobile.

## Known limitations

- Songs need chords on their own line above the lyrics. Chords written
  inside the lyrics (like `[A]mazing grace`) are not transposed.
- Reading photos can still make mistakes beyond `#` (e.g. a blurry chord or
  word). Always check the song box after uploading.
- Live Chord Lookup shows the dropdown's usual name for two-name keys
  (e.g. `Bb`), since there's no song to match.
- Export PDF wraps very long lines so nothing is cut off on paper.
- "Shapes I can play" offers the five major families (C/A/G/E/D). Minor
  keys are handled through their relative majors, but there are no
  separate Am/Em/Dm chips to pick yet.
- The capo pick is the lowest capo among your shapes — it doesn't yet look
  at which chords are in the song, so it can suggest a high capo (9–10).
- If a song (or a live-called accidental) has no good capo position in
  common with your other shapes, the tool still shows its best computed
  answer — it doesn't yet warn "this chord doesn't fit."
- A few chord types draw a close-but-not-exact guitar diagram: `madd9`,
  `m(add9)`, `m13`, `7sus2`, `add11`, `add4`, `13b9`, `7#11`, `maj7#11`,
  `9sus4`, and power chords (`C5`, drawn as a full major chord).
- Guitar diagrams show the first voicing only.
- Standard tuning (EADGBE) only.

## Roadmap / ideas

- Alternate voicings ("next shape" toggle) for both piano and guitar
- Other guitar tunings (drop D, DADGAD, etc.)
- Minor shape chips (Am/Em/Dm) for the capo finder
- Capo pick scored by how many chords are open/no-barre
- Remember "Shapes I can play" between visits
- Nashville number / Roman numeral display
- Auto-save the last song
- In-app warning when a chord has no good shared capo position

## Deployment

Works as a static site — host it for free on GitHub Pages, Netlify, or
similar. No server or backend required.
