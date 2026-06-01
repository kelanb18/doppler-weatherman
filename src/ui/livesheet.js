// ─── LIVE SHEET ──────────────────────────────────────────────
import { $ } from '../utils.js';
import { appState } from '../state.js';

export const LS_ROOT_NAMES = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'];
export const LS_ROOTS = [110, 116.54, 123.47, 130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185, 196, 207.65];
export const LS_MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  suspended: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  whole_tone: [0, 2, 4, 6, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic_minor: [0, 3, 5, 7, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
};
export const LS_QUALITIES = {
  major: ['', 'm', 'm', '', '', 'm', '°'], minor: ['m', '°', '', 'm', 'm', '', ''],
  suspended: ['sus', 'sus', 'sus', 'sus', 'sus', 'sus', 'sus'],
  phrygian: ['m', '', 'm', 'm', '°', '', 'm'],
  whole_tone: ['aug', 'aug', 'aug', 'aug', 'aug', 'aug'],
  dorian: ['m', 'm', '', 'm', '°', '', 'm'],
  lydian: ['', '', 'm°', '', 'm', 'm', ''],
  pentatonic_minor: ['m', 'm', 'm', 'm', 'm'],
  pentatonic_major: ['', 'm', 'm', '', 'm'],
};

export function chordNameForDeg(mode, deg, rootHz) {
  const ri = LS_ROOTS.findIndex(r => Math.abs(r - rootHz) < 1.5);
  const md = LS_MODES[mode] || LS_MODES.major;
  const semi = md[((deg % md.length) + md.length) % md.length];
  const ni = ((ri + semi) % 12 + 12) % 12;
  const qs = LS_QUALITIES[mode] || LS_QUALITIES.major;
  const q = qs[((deg % qs.length) + qs.length) % qs.length];
  return LS_ROOT_NAMES[ni] + q;
}

export function updateLiveSheet() {
  const d = appState.liveSheetData;
  const keyEl = $('lsKey'), modeEl = $('lsMode'), tsEl = $('lsTimeSig');
  const melEl = $('lsMelody'), progEl = $('lsProg');
  if (keyEl) keyEl.textContent = d.rootName;
  if (modeEl) modeEl.textContent = d.modeName.toUpperCase();
  if (tsEl) tsEl.textContent = d.timeSig;
  if (melEl) melEl.textContent = d.lastMelodyNote;
  if (progEl && d.progression.length) {
    progEl.innerHTML = d.progression.map((ch, i) => {
      const cls = i === d.chordIdx ? 'active' : i === (d.chordIdx + 1) % d.progression.length ? 'next' : '';
      return `<button class="ls-chord${cls ? ' ' + cls : ''}" onclick="window._toggleChordPicker(this,${i})">${ch}<span class="ls-caret">▾</span></button>${i < d.progression.length - 1 ? '<span class="ls-arrow"> → </span>' : ''}`;
    }).join('');
  }
}

export function showChordPicker(btn, idx) {
  const existing = document.querySelector('.chord-picker');
  if (existing) { const wasThis = existing.dataset.idx === String(idx); existing.remove(); if (wasThis) return; }
  const ctx = window._liveChordCtx; if (!ctx) return;
  const avail = appState.liveSheetData.availableChords || [];
  const picker = document.createElement('div');
  picker.className = 'chord-picker'; picker.dataset.idx = idx;
  picker.innerHTML = avail.map(c =>
    `<button class="chord-option${c.name === appState.liveSheetData.progression[idx] ? ' selected' : ''}" onclick="window._selectChord(${idx},${c.deg},'${c.name}')">${c.name}</button>`
  ).join('');
  const r = btn.getBoundingClientRect();
  picker.style.cssText = `position:fixed;top:${r.bottom + 4}px;left:${Math.max(4, r.left)}px;`;
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!picker.contains(e.target) && e.target !== btn) { picker.remove(); document.removeEventListener('click', close); }
  }), 10);
}

export function hideChordPicker() {
  document.querySelector('.chord-picker')?.remove();
}

export function selectChord(idx, deg, name) {
  const ctx = window._liveChordCtx; if (!ctx) return;
  ctx.progression[idx] = ctx.buildChord(deg);
  ctx.progDeg[idx] = deg;
  appState.liveSheetData.progression[idx] = name;
  hideChordPicker();
  updateLiveSheet();
}

// Expose to window for inline onclick handlers in updateLiveSheet HTML
window._toggleChordPicker = showChordPicker;
window._selectChord = selectChord;
