// ─── SHARED MUTABLE STATE ────────────────────────────────────
export const appState = {
  currentState: null,
  currentWeather: null,
  liveNodes: null,
  currentAudio: null,
  usingManualState: false,
  pulseDot: null,
  lightningTimer: null,
  liveSheetData: {
    rootName: '—',
    modeName: '—',
    timeSig: '—',
    progression: [],
    chordIdx: 0,
    lastMelodyNote: '—',
  },
  _pendingSharedFx: null,
};
