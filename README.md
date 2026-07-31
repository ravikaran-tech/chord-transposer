# 🎹🎸 Chord Transposer

A stage-ready, offline-first chord transposer for piano and guitar. Paste a song
or a chord list, transpose it to any key, and see exactly what to play — piano
shapes with sound, or guitar shapes with a capo.

Installable as a PWA (Progressive Web App): works offline, no App Store needed.

---

## What it does

### 🎹 Piano tab

- **Quick Key Transpose** — pick "my key" and the band's key, and a big amber
  LED readout shows the transpose amount instantly (e.g. `C# → E` reads `+3`),
  the same way a keyboard's transpose knob works. It also shows the octave-
  equivalent alternative (`+3` is the same as `−9`).
- **Song & Chord Transposer** — paste a whole song (chords + lyrics) or a bare
  chord list like `C, F, G`. Auto-detects the original key, or set it manually.
  Semitone nudge buttons (`−1` / `+1`), Copy, and Export as PDF.
- **Correct sharps/flats** — transposing to F gives you `Bb`, not `A#`; to C#
  gives you sharps, not flats. Spelling follows the target key's convention,
  not a single fixed sharps table.
- **Chord Reference** — every unique chord in the transposed result, shown as
  a small piano diagram. Tap any chord to enlarge it and **hear it played**
  (Web Audio, no sound files needed).
- **Full chord vocabulary** — major, minor, diminished (`dim`, `dim7`),
  augmented, sus2/sus4, 6/7/9/11/13, `maj7`, `m7`, `m7b5` (half-diminished),
  `mMaj7`, `add9`, altered dominants (`7b9`, `7#9`, `9#11`, `7#5`, etc.), and
  slash chords (`C/G`).

### 🎸 Guitar tab

- **Capo finder** — tell it which chord shapes you're comfortable playing
  (any combination of C / A / G / E / D — the "CAGED" open shapes), and the
  band's actual key. It works out the lowest-fret capo position that lets you
  play in one of your known shapes.
  - Example: you play in **D, G, C**. The band's song is in **B**. The app
    tells you: capo **4**, play **G shapes** — and shows the other options
    too (D shapes → capo 9, C shapes → capo 11) so you can see why G wins.
- **Shape-aware song transposer** — paste the song in the band's real key,
  and it converts every chord into the shapes you actually finger on the
  fretboard (accounting for the capo), not just a plain transposition.
- **Fretboard diagrams** — every chord gets a real fingering diagram (open
  strings, muted strings, fret dots, barres, and a fret-number label for
  shapes played up the neck). Tap to enlarge with finger numbers.
- Standard tuning (EADGBE) for now; other tunings planned.
- Fingering data derived from the open-source
  [`@tombatossals/chords-db`](https://github.com/tombatossals/chords-db)
  (MIT-licensed), bundled locally so diagrams work fully offline.

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
- It does not require internet once installed (service worker caches the app)

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
- `service-worker.js` — offline caching (network-first for the app shell, so
  new deploys are picked up automatically; cache-first for everything else).
- `manifest.json` — installable as a home-screen app on mobile.

## Roadmap / ideas

- Alternate voicings ("next shape" toggle) for both piano and guitar
- Other guitar tunings (drop D, DADGAD, etc.)
- Minor-key shape families for the capo finder
- Nashville number / Roman numeral display
- Auto-save the last song

## Deployment

Works as a static site — host it for free on GitHub Pages, Netlify, or
similar. No server or backend required.
