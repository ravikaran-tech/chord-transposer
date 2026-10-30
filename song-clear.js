'use strict';

/* ============================================================
   CLEAR SONG (Piano Song Transposer + Guitar Shapes with Capo)
   ------------------------------------------------------------
   Clear empties the pasted song AND the converted result (and the
   chord diagrams), so a new song can be pasted or uploaded.
   An "Undo" link brings the song back for 8 seconds.
   Re-uses the existing renderers' empty states:
     runTranspose()     (app.js)    — Piano
     renderGuitarSong() (guitar.js) — Guitar
   Must load AFTER app.js and guitar.js.
============================================================ */

const CLEAR_UNDO_MS = 8000;

const CLEAR_CFG = {
  piano:  { input: 'inputText',  render: () => runTranspose() },
  guitar: { input: 'guitarInput', render: () => renderGuitarSong() }
};

const clearState = { piano: null, guitar: null };

function clearSyncButton(inst) {
  const input = document.getElementById(CLEAR_CFG[inst].input);
  const btn = document.getElementById(inst + 'ClearBtn');
  if (input && btn) btn.disabled = !input.value.trim();
}

function clearHideNote(inst) {
  const st = clearState[inst];
  if (st && st.timer) clearTimeout(st.timer);
  clearState[inst] = null;
  const note = document.getElementById(inst + 'ClearNote');
  if (note) { note.hidden = true; note.innerHTML = ''; }
}

function clearSong(inst) {
  const cfg = CLEAR_CFG[inst];
  const input = document.getElementById(cfg.input);
  if (!input || !input.value.trim()) return;
  clearHideNote(inst);
  const saved = input.value;

  input.value = '';
  // Also reset the upload state for this screen.
  const status = document.getElementById(inst + 'UploadStatus');
  if (status) { status.hidden = true; status.textContent = ''; }
  const file = document.getElementById(inst + 'UploadInput');
  if (file) file.value = '';
  cfg.render();               // empty state: result + diagrams cleared
  clearSyncButton(inst);

  const note = document.getElementById(inst + 'ClearNote');
  if (note) {
    note.innerHTML = 'Song cleared. <button type="button" class="link-btn" data-undo-clear="' + inst + '">Undo</button>';
    note.hidden = false;
  }
  clearState[inst] = {
    text: saved,
    timer: setTimeout(() => clearHideNote(inst), CLEAR_UNDO_MS)
  };
  // No focus(): on a phone it would pop up the keyboard over the screen.
}

function undoClear(inst) {
  const st = clearState[inst];
  if (!st) return;
  const input = document.getElementById(CLEAR_CFG[inst].input);
  input.value = st.text;
  clearHideNote(inst);
  CLEAR_CFG[inst].render();
  clearSyncButton(inst);
}

function initSongClear() {
  Object.keys(CLEAR_CFG).forEach(inst => {
    const input = document.getElementById(CLEAR_CFG[inst].input);
    if (!input) return;
    // 'input' covers typing/paste; 'change' covers values set by Upload.
    ['input', 'change'].forEach(ev => input.addEventListener(ev, () => {
      clearSyncButton(inst);
      if (input.value.trim()) clearHideNote(inst); // new song: Undo no longer applies
    }));
    clearSyncButton(inst);
  });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-clear]');
    if (c && !c.disabled) { clearSong(c.dataset.clear); return; }
    const u = e.target.closest('[data-undo-clear]');
    if (u) undoClear(u.dataset.undoClear);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSongClear);
} else {
  initSongClear();
}
