'use strict';

/* ============================================================
   UI ENHANCE — purely decorative marker positioning.
   Reads values already rendered by app.js / guitar.js; never
   computes chord/transpose logic itself, so it can't drift
   from the tested engine.
============================================================ */

function parseSignedInt(text) {
  if (!text) return 0;
  const cleaned = text.replace(/\u2212/g, '-').trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function setDotPosition(dotEl, pct) {
  if (!dotEl) return;
  const clamped = Math.max(0, Math.min(100, pct));
  dotEl.style.left = clamped + '%';
}

function pulse(el) {
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function updatePianoDot() {
  const ledEl = document.getElementById('ledValue');
  const dot = document.getElementById('pianoScaleDot');
  if (!ledEl || !dot) return;
  const value = parseSignedInt(ledEl.textContent);
  // Domain matches app.js's shortest-path range: -5..+6
  const pct = ((value + 5) / 11) * 100;
  setDotPosition(dot, pct);
  pulse(document.getElementById('pianoDialBadge'));
}

function updateGuitarDot() {
  const capoEl = document.getElementById('capoLed');
  const dot = document.getElementById('guitarScaleDot');
  if (!capoEl || !dot) return;
  const value = parseSignedInt(capoEl.textContent);
  // Domain: capo fret 0..11
  const pct = (value / 11) * 100;
  setDotPosition(dot, pct);
  pulse(document.getElementById('guitarDialBadge'));
}

function bindDecorative() {
  const pianoTriggers = ['quickTransposeBtn', 'quickFromKey', 'quickToKey'];
  pianoTriggers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(id === 'quickTransposeBtn' ? 'click' : 'change', updatePianoDot);
  });

  const guitarTriggers = ['guitarTargetKey', 'guitarPlayIn'];
  guitarTriggers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateGuitarDot);
  });
  const shapeChips = document.getElementById('shapeChips');
  if (shapeChips) shapeChips.addEventListener('click', () => setTimeout(updateGuitarDot, 0));

  // Initial paint once the app's own init has run (scripts load in order,
  // so app.js/guitar.js have already set the starting values by now).
  updatePianoDot();
  updateGuitarDot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindDecorative);
} else {
  bindDecorative();
}
