// ─── AUDIO ENGINE ────────────────────────────────────────────
import { $, clamp, setStatus } from '../utils.js';
import { appState } from '../state.js';
import { stateFromSliders, interpretWeather, computeTimeSignature, syncSlidersToState } from '../weather/interpret.js';
import { updateVisualizer, updateInstrumentReadout } from '../ui/scene.js';
import { updateLiveSheet } from '../ui/livesheet.js';

// ─── FX PARAMS ───────────────────────────────────────────────
export function getFx() {
  return {
    reverb: parseFloat($('fxReverb')?.value ?? 0.35),
    delay: parseFloat($('fxDelay')?.value ?? 0.25),
    filter: parseFloat($('fxFilter')?.value ?? 0.55),
    drive: parseFloat($('fxDrive')?.value ?? 0.18),
    melody: parseFloat($('fxMelody')?.value ?? 0.85),
    harmony: parseFloat($('fxHarmony')?.value ?? 0.5),
    swing: parseFloat($('fxSwing')?.value ?? 0.3),
    crush: parseFloat($('fxCrush')?.value ?? 0),
    drift: parseFloat($('fxDrift')?.value ?? 0.35),
    wah: parseFloat($('fxWah')?.value ?? 0),
    chorus: parseFloat($('fxChorus')?.value ?? 0.15),
    fuzz: parseFloat($('fxFuzz')?.value ?? 0),
    vol: parseFloat($('volKnob')?.value ?? 0.75),
  };
}

export function applyLiveFx() {
  const { liveNodes } = appState;
  if (!liveNodes) return;
  const fx = getFx();
  const {
    ctx, gf, rvSend, dlySend, master, melodyBus, harmonicBus,
    tapeSat, dustyLP, wowLFOG, flutterLFOG, dlyFB, crushNode,
    wahWet, wahDry, wahLFOG, fuzzNode, fuzzWet, fuzzDry, choWet, choLFOG,
  } = liveNodes;
  const now = ctx.currentTime;
  // Filter
  const hz = 80 * Math.pow(250, fx.filter);
  liveNodes.filterBase = hz;
  gf.frequency.setTargetAtTime(hz, now, 0.08);
  // Reverb
  rvSend.gain.setTargetAtTime(fx.reverb * 0.88, now, 0.09);
  // Echo
  dlySend.gain.setTargetAtTime(fx.delay * 0.55, now, 0.09);
  if (dlyFB) dlyFB.gain.setTargetAtTime(Math.min(0.82, 0.12 + fx.delay * 0.72), now, 0.09);
  // Drive
  if (tapeSat) {
    const drv = 0.4 + fx.drive * 13;
    const sc = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2 / 255) - 1;
      sc[i] = Math.tanh(x * drv) / Math.tanh(drv);
    }
    tapeSat.curve = sc;
  }
  if (dustyLP) dustyLP.frequency.setTargetAtTime(Math.max(3200, 9000 - fx.drive * 5800), now, 0.12);
  // Crush
  if (crushNode) {
    if (fx.crush > 0.02) {
      const bits = Math.max(2, Math.round(8 - fx.crush * 6));
      const steps = Math.pow(2, bits);
      const cc = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i * 2 / 255) - 1; cc[i] = Math.round(x * steps) / steps; }
      crushNode.curve = cc;
    } else {
      const cc = new Float32Array(256);
      for (let i = 0; i < 256; i++) cc[i] = (i * 2 / 255) - 1;
      crushNode.curve = cc;
    }
  }
  // Drift
  if (wowLFOG) wowLFOG.gain.setTargetAtTime(fx.drift * 0.009, now, 0.15);
  if (flutterLFOG) flutterLFOG.gain.setTargetAtTime(fx.drift * 0.003, now, 0.15);
  // Volume
  master.gain.setTargetAtTime(fx.vol * 0.75, now, 0.05);
  // Melody bus
  if (melodyBus) melodyBus.gain.setTargetAtTime(fx.melody * 1.1, now, 0.07);
  // Harmony bus
  if (harmonicBus) harmonicBus.gain.setTargetAtTime(fx.harmony * 0.72, now, 0.07);
  // Wah
  if (wahWet) wahWet.gain.setTargetAtTime(fx.wah, now, 0.1);
  if (wahDry) wahDry.gain.setTargetAtTime(Math.max(0, 1 - fx.wah * 0.65), now, 0.1);
  if (wahLFOG) wahLFOG.gain.setTargetAtTime(fx.wah * 780, now, 0.12);
  // Chorus
  if (choWet) choWet.gain.setTargetAtTime(fx.chorus * 0.48, now, 0.1);
  if (choLFOG) choLFOG.gain.setTargetAtTime(fx.chorus * 0.005, now, 0.1);
  // Fuzz
  if (fuzzWet) fuzzWet.gain.setTargetAtTime(fx.fuzz, now, 0.1);
  if (fuzzDry) fuzzDry.gain.setTargetAtTime(Math.max(0, 1 - fx.fuzz * 0.72), now, 0.1);
  if (fuzzNode && fx.fuzz > 0.02) {
    const fc = new Float32Array(256);
    const thr = Math.max(0.04, 0.35 - fx.fuzz * 0.28);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2 / 255) - 1;
      fc[i] = x > thr ? thr + (x - thr) * 0.05 : x < -thr - 0.08 ? (-thr - 0.08) + (x + thr + 0.08) * 0.04 : x;
    }
    fuzzNode.curve = fc;
  }
}

function pulseVisual() {
  const pd = appState.pulseDot;
  if (!pd) return;
  pd.classList.add('active');
  setTimeout(() => pd.classList.remove('active'), 90);
}

function freqToNoteName(hz) {
  if (!hz || hz < 60) return '—';
  const A4 = 440, semi = Math.round(12 * Math.log2(hz / A4));
  const noteNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const oct = Math.floor((semi + 57) / 12) + 1;
  const ni = ((semi % 12) + 12) % 12;
  return noteNames[ni] + oct;
}

// ─── WEATHER FX DEFAULTS ────────────────────────────────────
function setWeatherFxDefaults(s) {
  if (appState.usingManualState) return;
  if (appState._pendingSharedFx) {
    const fx = appState._pendingSharedFx;
    appState._pendingSharedFx = null;
    fx.forEach(([id, v]) => {
      const e = $(id); if (e) e.value = String(v);
      const ve = $(id + 'Val'); if (ve) ve.textContent = Number(v).toFixed(2);
    });
    return;
  }
  const defs = s.isStormy
    ? { fxReverb: 0.72, fxDelay: 0.58, fxFilter: 0.22, fxDrive: 0.48, fxCrush: 0.32, fxDrift: 0.68, fxWah: 0, fxChorus: 0.2, fxFuzz: 0.28 }
    : s.isSnowing
    ? { fxReverb: 0.58, fxDelay: 0.15, fxFilter: 0.78, fxDrive: 0.05, fxCrush: 0, fxDrift: 0.15, fxWah: 0, fxChorus: 0.55, fxFuzz: 0 }
    : s.isRaining
    ? { fxReverb: 0.48, fxDelay: 0.32, fxFilter: 0.50, fxDrive: 0.15, fxCrush: 0, fxDrift: 0.38, fxWah: 0.08, fxChorus: 0.22, fxFuzz: 0 }
    : s.isFoggy
    ? { fxReverb: 0.65, fxDelay: 0.48, fxFilter: 0.32, fxDrive: 0.08, fxCrush: 0, fxDrift: 0.28, fxWah: 0, fxChorus: 0.38, fxFuzz: 0 }
    : (s.isSunny && s.warmth > 0.6)
    ? { fxReverb: 0.18, fxDelay: 0.22, fxFilter: 0.72, fxDrive: 0.10, fxCrush: 0, fxDrift: 0.20, fxWah: 0.28, fxChorus: 0.15, fxFuzz: 0 }
    : !s.isDaytime
    ? { fxReverb: 0.55, fxDelay: 0.40, fxFilter: 0.42, fxDrive: 0.12, fxCrush: 0, fxDrift: 0.32, fxWah: 0, fxChorus: 0.28, fxFuzz: 0 }
    : s.wind > 0.65
    ? { fxReverb: 0.38, fxDelay: 0.35, fxFilter: 0.58, fxDrive: 0.22, fxCrush: 0, fxDrift: 0.58, fxWah: 0.18, fxChorus: 0.12, fxFuzz: 0 }
    : { fxReverb: 0.35, fxDelay: 0.25, fxFilter: 0.55, fxDrive: 0.18, fxCrush: 0, fxDrift: 0.35, fxWah: 0, fxChorus: 0.15, fxFuzz: 0 };
  Object.entries(defs).forEach(([id, v]) => {
    const el = $(id), valEl = $(id + 'Val');
    if (el) el.value = String(v);
    if (valEl) valEl.textContent = v.toFixed(2);
  });
}

// ─── VOICE PARAMS ───────────────────────────────────────────
function getWeatherVoiceParams(s) {
  if (s.isStormy) return {
    padTypes: ['sawtooth', 'sawtooth', 'square'], padGains: [0.045, 0.030, 0.022],
    padDetune: [-8, 8, -5], padAttk: 1.2, padVol: 0.068,
    melType: 'square', melAtk: 0.003, melDecMin: 0.15, melDecRng: 0.25, melPeak: 0.14, melFilter: 3500,
    cpType: 'sawtooth', cpAtt: 0.03, cpDecMin: 1.2, cpDecRng: 1.0, cpPeak: 0.055, cpReg: 'sub',
    ghostProb: 0.72, crackleMin: 100, crackleRng: 700,
  };
  if (s.isSnowing) return {
    padTypes: ['triangle', 'triangle', 'sine'], padGains: [0.028, 0.018, 0.012],
    padDetune: [0, -1, 1], padAttk: 3.8, padVol: 0.040,
    melType: 'triangle', melAtk: 0.04, melDecMin: 1.0, melDecRng: 0.8, melPeak: 0.08, melFilter: 4000,
    cpType: 'triangle', cpAtt: 0.08, cpDecMin: 2.2, cpDecRng: 1.5, cpPeak: 0.032, cpReg: 'mid',
    ghostProb: 0.22, crackleMin: 500, crackleRng: 3500,
  };
  if (s.isFoggy) return {
    padTypes: ['sine', 'sine', 'triangle'], padGains: [0.032, 0.020, 0.014],
    padDetune: [0, 0, 0], padAttk: 4.5, padVol: 0.045,
    melType: 'sine', melAtk: 0.07, melDecMin: 1.2, melDecRng: 1.0, melPeak: 0.07, melFilter: 2800,
    cpType: 'sine', cpAtt: 0.09, cpDecMin: 2.5, cpDecRng: 1.8, cpPeak: 0.030, cpReg: 'mid',
    ghostProb: 0.28, crackleMin: 400, crackleRng: 2800,
  };
  if (s.isRaining) return {
    padTypes: ['triangle', 'triangle', 'triangle'], padGains: [0.034, 0.022, 0.016],
    padDetune: [-2, 2, 0], padAttk: 2.0, padVol: 0.048,
    melType: 'triangle', melAtk: 0.018, melDecMin: 0.7, melDecRng: 0.5, melPeak: 0.10, melFilter: 4500,
    cpType: 'triangle', cpAtt: 0.05, cpDecMin: 1.8, cpDecRng: 1.4, cpPeak: 0.038, cpReg: 'mid',
    ghostProb: 0.65, crackleMin: 180, crackleRng: 1400,
  };
  if (s.isSunny && s.warmth > 0.5) return {
    padTypes: ['triangle', 'sine', 'triangle'], padGains: [0.036, 0.026, 0.020],
    padDetune: [-4, 0, 4], padAttk: 1.8, padVol: 0.055,
    melType: 'triangle', melAtk: 0.005, melDecMin: 0.35, melDecRng: 0.45, melPeak: 0.13, melFilter: 7500,
    cpType: 'sine', cpAtt: 0.04, cpDecMin: 1.4, cpDecRng: 1.2, cpPeak: 0.046, cpReg: 'high',
    ghostProb: 0.45, crackleMin: 250, crackleRng: 2200,
  };
  if (!s.isDaytime) return {
    padTypes: ['sine', 'triangle', 'sine'], padGains: [0.032, 0.020, 0.014],
    padDetune: [0, -2, 2], padAttk: 3.0, padVol: 0.050,
    melType: 'sine', melAtk: 0.015, melDecMin: 0.8, melDecRng: 0.7, melPeak: 0.09, melFilter: 4000,
    cpType: 'sine', cpAtt: 0.06, cpDecMin: 2.0, cpDecRng: 1.5, cpPeak: 0.036, cpReg: 'mid',
    ghostProb: 0.40, crackleMin: 220, crackleRng: 1800,
  };
  return {
    padTypes: ['sine', 'triangle', 'triangle'], padGains: [0.038, 0.024, 0.018],
    padDetune: [0, -3, 3], padAttk: 2.5, padVol: 0.055,
    melType: 'sine', melAtk: 0.006, melDecMin: 0.4, melDecRng: 0.8, melPeak: 0.10, melFilter: 5000,
    cpType: 'sine', cpAtt: 0.05, cpDecMin: 1.8, cpDecRng: 2.0, cpPeak: 0.042, cpReg: 'mid',
    ghostProb: 0.58, crackleMin: 180, crackleRng: 1800,
  };
}

// ─── LIVE SHEET ROOT/MODE DATA ────────────────────────────────
const LS_ROOT_NAMES = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab'];
const LS_ROOTS = [110, 116.54, 123.47, 130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185, 196, 207.65];

function chordNameForDeg(mode, scaleName, deg, rootHz) {
  const LS_MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
    suspended: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    whole_tone: [0, 2, 4, 6, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic_minor: [0, 3, 5, 7, 10],
    pentatonic_major: [0, 2, 4, 7, 9],
  };
  const LS_QUALITIES = {
    major: ['', 'm', 'm', '', '', 'm', '°'], minor: ['m', '°', '', 'm', 'm', '', ''],
    suspended: ['sus', 'sus', 'sus', 'sus', 'sus', 'sus', 'sus'],
    phrygian: ['m', '', 'm', 'm', '°', '', 'm'],
    whole_tone: ['aug', 'aug', 'aug', 'aug', 'aug', 'aug'],
    dorian: ['m', 'm', '', 'm', '°', '', 'm'],
    lydian: ['', '', 'm°', '', 'm', 'm', ''],
    pentatonic_minor: ['m', 'm', 'm', 'm', 'm'],
    pentatonic_major: ['', 'm', 'm', '', 'm'],
  };
  const ri = LS_ROOTS.findIndex(r => Math.abs(r - rootHz) < 1.5);
  const md = LS_MODES[scaleName] || LS_MODES.major;
  const semi = md[((deg % md.length) + md.length) % md.length];
  const ni = ((ri + semi) % 12 + 12) % 12;
  const qs = LS_QUALITIES[scaleName] || LS_QUALITIES.major;
  const q = qs[((deg % qs.length) + qs.length) % qs.length];
  return LS_ROOT_NAMES[ni] + q;
}

// ─── MAIN AUDIO ENGINE ───────────────────────────────────────
export function stop() {
  if (appState.lightningTimer) { clearInterval(appState.lightningTimer); appState.lightningTimer = null; }
  if (appState.currentAudio) {
    try { appState.currentAudio.stopAll(); } catch (e) {}
    appState.currentAudio = null;
  }
  appState.liveNodes = null;
  const pd = appState.pulseDot;
  if (pd) pd.classList.remove('active');
  const es = $('engineStatus');
  if (es) { es.textContent = 'IDLE'; es.style.color = '#4A4840'; }
}

export function play() {
  const s = appState.usingManualState
    ? stateFromSliders()
    : (appState.currentWeather ? interpretWeather(appState.currentWeather) : null);
  if (!s) { setStatus('Load weather first.'); return; }
  appState.currentState = s;
  stop();
  updateVisualizer(s);
  playWeatherSoundscape(s);
  setStatus(appState.usingManualState ? 'Playing manual atmosphere.' : 'Playing live weather soundtrack.');
}

export function applyManual() {
  appState.usingManualState = true;
  appState.currentState = stateFromSliders();
  updateVisualizer(appState.currentState);
  if (appState.currentAudio) play();
}

export function resetToWeather() {
  if (!appState.currentWeather) { setStatus('Load weather first.'); return; }
  appState.usingManualState = false;
  appState.currentState = interpretWeather(appState.currentWeather);
  syncSlidersToState(appState.currentState);
  updateVisualizer(appState.currentState);
  if (appState.currentAudio) play();
}

export function playWeatherSoundscape(state) {
  setWeatherFxDefaults(state);
  const fx = getFx();
  const vp = getWeatherVoiceParams(state);
  const timeSig = computeTimeSignature(state);
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // MASTER CHAIN
  const master = ctx.createGain(); master.gain.value = fx.vol * 0.75;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 3; limiter.ratio.value = 12;
  limiter.attack.value = 0.001; limiter.release.value = 0.1;
  master.connect(limiter); limiter.connect(ctx.destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.75;
  analyser.minDecibels = -80; analyser.maxDecibels = -10;
  limiter.connect(analyser); analyser.connect(ctx.destination);
  limiter.disconnect(ctx.destination);

  // GLOBAL FILTER
  const gf = ctx.createBiquadFilter(); gf.type = 'lowpass';
  gf.frequency.value = 80 * Math.pow(250, fx.filter);
  gf.Q.value = 0.8;

  // TAPE CHAIN
  const dustyLP = ctx.createBiquadFilter(); dustyLP.type = 'lowpass';
  dustyLP.frequency.value = 8500; dustyLP.Q.value = 0.5;
  const tapeSat = ctx.createWaveShaper();
  {
    const sc = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i * 2 / 255) - 1; sc[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
    tapeSat.curve = sc; tapeSat.oversample = '2x';
  }
  const warbleDelay = ctx.createDelay(0.05); warbleDelay.delayTime.value = 0.003;
  const wowLFO = ctx.createOscillator(); const wowLFOG = ctx.createGain();
  wowLFO.type = 'sine'; wowLFO.frequency.value = 0.35 + Math.random() * 0.15;
  wowLFOG.gain.value = 0.0015;
  wowLFO.connect(wowLFOG); wowLFOG.connect(warbleDelay.delayTime); wowLFO.start();
  const flutterLFO = ctx.createOscillator(); const flutterLFOG = ctx.createGain();
  flutterLFO.type = 'sine'; flutterLFO.frequency.value = 1.1 + Math.random() * 0.3;
  flutterLFOG.gain.value = 0.0004;
  flutterLFO.connect(flutterLFOG); flutterLFOG.connect(warbleDelay.delayTime); flutterLFO.start();

  // Bitcrusher (bypass by default)
  const crushNode = ctx.createWaveShaper();
  { const cc = new Float32Array(256); for (let i = 0; i < 256; i++) cc[i] = (i * 2 / 255) - 1; crushNode.curve = cc; }

  // WAH INSERT
  const wahFilter = ctx.createBiquadFilter(); wahFilter.type = 'bandpass';
  wahFilter.frequency.value = 500; wahFilter.Q.value = 5;
  const wahLFO = ctx.createOscillator(); const wahLFOG = ctx.createGain();
  wahLFO.type = 'sine'; wahLFO.frequency.value = state.tempo / 60 * 0.25;
  wahLFOG.gain.value = fx.wah * 780;
  wahLFO.connect(wahLFOG); wahLFOG.connect(wahFilter.frequency); wahLFO.start();
  const wahWet = ctx.createGain(); wahWet.gain.value = fx.wah;
  const wahDry = ctx.createGain(); wahDry.gain.value = Math.max(0, 1 - fx.wah * 0.65);
  gf.connect(wahDry); wahDry.connect(crushNode);
  gf.connect(wahFilter); wahFilter.connect(wahWet); wahWet.connect(crushNode);
  crushNode.connect(dustyLP); dustyLP.connect(tapeSat);

  // FUZZ INSERT
  const fuzzNode = ctx.createWaveShaper();
  {
    const fc = new Float32Array(256); const thr = 0.35;
    for (let i = 0; i < 256; i++) {
      const x = (i * 2 / 255) - 1;
      fc[i] = x > thr ? thr + (x - thr) * 0.05 : x < -(thr + 0.08) ? (-(thr + 0.08)) + (x + (thr + 0.08)) * 0.04 : x;
    }
    fuzzNode.curve = fc; fuzzNode.oversample = '2x';
  }
  const fuzzWet = ctx.createGain(); fuzzWet.gain.value = fx.fuzz;
  const fuzzDry = ctx.createGain(); fuzzDry.gain.value = Math.max(0, 1 - fx.fuzz * 0.72);
  tapeSat.connect(fuzzDry); fuzzDry.connect(warbleDelay);
  tapeSat.connect(fuzzNode); fuzzNode.connect(fuzzWet); fuzzWet.connect(warbleDelay);
  warbleDelay.connect(master);

  // REVERB NETWORK
  const rvSend = ctx.createGain(); rvSend.gain.value = fx.reverb * 0.28;
  const rvReturn = ctx.createGain(); rvReturn.gain.value = 0.4;
  const rv1 = ctx.createDelay(2); rv1.delayTime.value = 0.083;
  const rv2 = ctx.createDelay(2); rv2.delayTime.value = 0.127;
  const rv3 = ctx.createDelay(2); rv3.delayTime.value = 0.211;
  const rvFB = ctx.createGain(); rvFB.gain.value = 0.22 + fx.reverb * 0.12;
  const rvF = ctx.createBiquadFilter(); rvF.type = 'lowpass'; rvF.frequency.value = 2400;
  rvSend.connect(rv1); rvSend.connect(rv2); rvSend.connect(rv3);
  rv1.connect(rvF); rv2.connect(rvF); rv3.connect(rvF);
  rvF.connect(rvFB); rvFB.connect(rv1); rvFB.connect(rv2);
  rvF.connect(rvReturn); rvReturn.connect(gf);

  // DELAY
  function getDelayTime(tempo, s) {
    const b = 60 / tempo;
    if (s.isStormy) return b * 0.75;
    if (s.isRaining) return b * 0.5;
    if (s.isFoggy) return b * 2;
    if (!s.isDaytime) return b * 1.5;
    if (s.isSunny) return b * 0.375;
    return b;
  }
  function getDelayFB(s, fxv) {
    return Math.min(0.45, (s.isStormy ? 0.28 : s.isFoggy ? 0.42 : s.isRaining ? 0.35 : 0.3) + fxv * 0.15);
  }
  const dlySend = ctx.createGain(); dlySend.gain.value = fx.delay * 0.18;
  const dlyNode = ctx.createDelay(3.0); dlyNode.delayTime.value = getDelayTime(state.tempo, state);
  const dlyFB = ctx.createGain(); dlyFB.gain.value = getDelayFB(state, fx.delay);
  const dlyF = ctx.createBiquadFilter(); dlyF.type = 'lowpass'; dlyF.frequency.value = 2000;
  const dlyReturn = ctx.createGain(); dlyReturn.gain.value = 0.32;
  dlySend.connect(dlyNode); dlyNode.connect(dlyF); dlyF.connect(dlyFB);
  dlyFB.connect(dlyNode); dlyF.connect(dlyReturn); dlyReturn.connect(gf);

  // BITCRUSHER
  const bcAmt = state.isStormy ? 0.55 : state.isRaining ? 0.3 : 0.0;
  const bcInput = ctx.createGain(); bcInput.gain.value = 1;
  if (bcAmt > 0.05) {
    const bcDepth = state.isStormy ? 4 : 6;
    const bcSteps = Math.pow(2, bcDepth);
    const bcCurve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i * 2 / 255) - 1; bcCurve[i] = Math.round(x * bcSteps) / bcSteps; }
    const bcShaper = ctx.createWaveShaper(); bcShaper.curve = bcCurve; bcShaper.oversample = 'none';
    const bcWet = ctx.createGain(); bcWet.gain.value = bcAmt;
    const bcDry = ctx.createGain(); bcDry.gain.value = 1 - bcAmt * 0.5;
    bcInput.connect(bcShaper); bcShaper.connect(bcWet); bcWet.connect(gf);
    bcInput.connect(bcDry); bcDry.connect(gf);
  } else { bcInput.connect(gf); }

  // Store live nodes
  appState.liveNodes = {
    ctx, gf, rvSend, dlySend, master, melodyBus: null, harmonicBus: null,
    analyser, dlyFB, dlyNode, bcInput, getDelayFB, dustyLP, tapeSat,
    warbleDelay, wowLFO, flutterLFO, wowLFOG, flutterLFOG, crushNode,
    filterBase: gf.frequency.value, wahFilter, wahLFO, wahLFOG, wahWet, wahDry,
    fuzzNode, fuzzWet, fuzzDry,
  };
  const liveNodes = appState.liveNodes;

  function wire(n) { n.connect(gf); n.connect(rvSend); n.connect(dlySend); }

  // PINK NOISE BUFFER
  const nbs = ctx.sampleRate * 3;
  const nb = ctx.createBuffer(1, nbs, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < nbs; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    nd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) / 10; b6 = w * 0.115926;
  }

  // LOCATION FINGERPRINT
  const lat = appState.currentWeather?.lat ?? 40.7;
  const lon = appState.currentWeather?.lon ?? -74.0;
  const s1 = Math.abs(Math.sin(lat * 127.1 + lon * 311.7));
  const s2 = Math.abs(Math.sin(lat * 269.5 + lon * 183.3));
  const s3 = Math.abs(Math.sin(lat * 43.7 + lon * 499.1));
  const s4 = Math.abs(Math.sin(lat * 157.3 + lon * 67.9));

  // GENRE BLEND
  const gw = state.genreWeights || { electronic: 1 };
  const genreDrumDensity = clamp(
    gw.industrial * 0.88 + gw.ambient * 0.05 + gw.classical * 0.22 +
    gw.tropical * 0.68 + gw.jazz * 0.55 + gw.lofi * 0.62 + gw.electronic * 0.58,
    0.05, 0.94
  );
  const genreArpWeight = clamp(
    gw.tropical * 0.92 + gw.jazz * 0.38 + gw.lofi * 0.20 + gw.classical * 0.08 +
    gw.electronic * (state.isSunny ? 0.78 : state.brightness * 0.5) + gw.ambient * 0.04,
    0, 1
  );
  const genreBaseSwing = gw.jazz * 0.40 + gw.lofi * 0.26 + gw.tropical * 0.14 + gw.electronic * 0.10;
  const genreDrumsActive = (gw.ambient || 0) < 0.62;

  // MODE & ROOT
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
    suspended: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    whole_tone: [0, 2, 4, 6, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], pentatonic_minor: [0, 3, 5, 7, 10],
    pentatonic_major: [0, 2, 4, 7, 9],
  };
  const GENRE_SCALE = {
    industrial: 'phrygian', ambient: 'minor', classical: 'major', tropical: 'lydian',
    jazz: 'dorian', lofi: 'pentatonic_minor', electronic: 'pentatonic_major',
  };
  const scaleName = GENRE_SCALE[state.genre] || state.harmony;
  const mode = MODES[scaleName] || MODES.major;
  const ROOTS = [110, 116.54, 123.47, 130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185, 196, 207.65];
  const rootHz = ROOTS[Math.floor(s1 * ROOTS.length)];

  // Init live sheet
  const _ri = LS_ROOTS.findIndex(r => Math.abs(r - rootHz) < 1.5);
  appState.liveSheetData.rootName = LS_ROOT_NAMES[_ri >= 0 ? _ri : 0];
  appState.liveSheetData.modeName = scaleName;
  appState.liveSheetData.timeSig = timeSig.name;

  function mHz(deg, oct = 1) {
    const semi = mode[((deg % mode.length) + mode.length) % mode.length];
    return rootHz * oct * Math.pow(2, semi / 12);
  }

  // CHORD SYSTEM
  function buildChord(rd) {
    return [mHz(rd, 1), mHz(rd, 2), mHz(rd + 2, 2), mHz(rd + 4, 2), mHz(rd + 6, 2)];
  }
  function chordTones(ch) { return [ch[1], ch[2], ch[3], ch[4], ch[1] * 2, ch[2] * 2]; }

  const PROG_DEGS = {
    major: [[0, 2, 4, 3], [3, 1, 4, 2], [0, 4, 3, 2]],
    minor: [[0, 3, 4, 1], [0, 4, 3, 2], [1, 0, 4, 3]],
    suspended: [[0, 3, 1, 4], [0, 4, 2, 3], [1, 0, 4, 2]],
    phrygian: [[0, 1, 3, 2], [1, 0, 3, 4], [0, 3, 1, 2]],
    whole_tone: [[0, 2, 4, 2], [0, 4, 2, 3], [2, 0, 4, 1]],
    dorian: [[0, 2, 4, 3], [0, 4, 1, 3], [2, 0, 3, 4]],
    lydian: [[0, 2, 4, 3], [3, 0, 2, 4], [0, 4, 2, 3]],
    pentatonic_minor: [[0, 2, 3, 1], [1, 3, 0, 2], [0, 3, 2, 1]],
  };
  const progSet = PROG_DEGS[scaleName] || PROG_DEGS[state.harmony] || PROG_DEGS.major;
  const progDeg = progSet[Math.floor(s2 * progSet.length)];
  const progression = progDeg.map(d => buildChord(d));
  let chordIdx = 0;
  let chord = progression[0];

  // Populate live sheet with chord names
  appState.liveSheetData.progression = progDeg.map(d => chordNameForDeg(mode, scaleName, d, rootHz));
  appState.liveSheetData.chordIdx = 0;
  appState.liveSheetData.availableChords = Array.from(
    { length: mode.length },
    (_, i) => ({ deg: i, name: chordNameForDeg(mode, scaleName, i, rootHz) })
  );
  window._liveChordCtx = { progression, buildChord, mode, scaleName, rootHz, progDeg: progDeg.slice() };
  updateLiveSheet();

  function buildMotif(ch) {
    const t = chordTones(ch);
    return [
      t[Math.floor(s1 * t.length)], t[Math.floor(s2 * t.length)],
      t[Math.floor(s3 * t.length)], t[Math.floor(s4 * t.length)],
    ];
  }
  let motif = buildMotif(chord);

  // DYNAMICS
  const PHASES = ['bloom', 'full', 'breathe', 'sparse', 'bloom'];
  let phase = 'bloom'; let phaseIdx = 0;
  const pDurs = [20, 32, 16, 22, 18];
  let phaseTimer = null;
  function nextPhase() {
    phaseIdx = (phaseIdx + 1) % PHASES.length; phase = PHASES[phaseIdx];
    phaseTimer = setTimeout(nextPhase, pDurs[phaseIdx] * 1000 + (Math.random() - .5) * 5000);
  }
  phaseTimer = setTimeout(nextPhase, pDurs[0] * 1000);
  function pGain() { return { bloom: 0.65, full: 1, breathe: 0.45, sparse: 0.3 }[phase] || 0.6; }

  // PAD
  const padBus = ctx.createGain(); padBus.gain.value = 0; wire(padBus);
  const padHPF = ctx.createBiquadFilter(); padHPF.type = 'highpass'; padHPF.frequency.value = 220;
  // CHORUS
  const choDelay1 = ctx.createDelay(0.1); choDelay1.delayTime.value = 0.012;
  const choDelay2 = ctx.createDelay(0.1); choDelay2.delayTime.value = 0.018;
  const choLFO = ctx.createOscillator(); const choLFOG = ctx.createGain();
  choLFO.type = 'sine'; choLFO.frequency.value = 0.38 + state.wind * 0.12;
  choLFOG.gain.value = fx.chorus * 0.005;
  choLFO.connect(choLFOG);
  choLFOG.connect(choDelay1.delayTime); choLFOG.connect(choDelay2.delayTime);
  choLFO.start();
  const choWet = ctx.createGain(); choWet.gain.value = fx.chorus * 0.48;
  padHPF.connect(choDelay1); padHPF.connect(choDelay2);
  choDelay1.connect(choWet); choDelay2.connect(choWet); choWet.connect(padBus);
  padHPF.connect(padBus);
  liveNodes.choDelay1 = choDelay1; liveNodes.choDelay2 = choDelay2;
  liveNodes.choLFO = choLFO; liveNodes.choLFOG = choLFOG; liveNodes.choWet = choWet;
  const padF = ctx.createBiquadFilter(); padF.type = 'lowpass';
  padF.frequency.value = 700 + state.brightness * 1800; padF.Q.value = 0.9; padF.connect(padHPF);
  const fLFO = ctx.createOscillator(); const fLFOG = ctx.createGain();
  fLFO.type = 'sine'; fLFO.frequency.value = 0.015 + state.wind * 0.03;
  fLFOG.gain.value = 200 + state.brightness * 300;
  fLFO.connect(fLFOG); fLFOG.connect(padF.frequency); fLFO.start();
  const bLFO = ctx.createOscillator(); const bLFOG = ctx.createGain();
  bLFO.type = 'sine'; bLFO.frequency.value = 0.04 + state.wind * 0.05;
  bLFOG.gain.value = 0.010 + state.storm * 0.008;
  bLFO.connect(bLFOG); bLFOG.connect(padBus.gain); bLFO.start();
  const padVoices = [];
  function buildPad(ch) {
    padVoices.forEach(v => { try { v.stop(ctx.currentTime + 2); } catch (e) {} });
    padVoices.length = 0;
    [ch[1], ch[2], ch[3]].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = vp.padTypes[i];
      osc.frequency.value = freq;
      osc.detune.value = vp.padDetune[i];
      g.gain.value = vp.padGains[i];
      osc.connect(g); g.connect(padF); osc.start(); padVoices.push(osc);
    });
  }
  buildPad(chord);
  padBus.gain.setValueAtTime(0, ctx.currentTime);
  padBus.gain.linearRampToValueAtTime(vp.padVol, ctx.currentTime + vp.padAttk);

  // WIND
  const wSrc = ctx.createBufferSource(); wSrc.buffer = nb; wSrc.loop = true;
  const wBP = ctx.createBiquadFilter(); wBP.type = 'bandpass';
  wBP.frequency.value = 280 + state.wind * 800; wBP.Q.value = 0.6;
  const wHP = ctx.createBiquadFilter(); wHP.type = 'highpass'; wHP.frequency.value = 120;
  const wGain = ctx.createGain(); wGain.gain.value = clamp(0.005 + state.wind * 0.055, 0, 0.08);
  wSrc.connect(wBP); wBP.connect(wHP); wHP.connect(wGain); wGain.connect(gf); wSrc.start();
  const wLFO = ctx.createOscillator(); const wLFOG = ctx.createGain();
  wLFO.type = 'sine'; wLFO.frequency.value = 0.04 + state.wind * 0.14;
  wLFOG.gain.value = 80 + state.wind * 160;
  wLFO.connect(wLFOG); wLFOG.connect(wBP.frequency); wLFO.start();

  // EARTH RUMBLE
  const eSrc = ctx.createBufferSource(); eSrc.buffer = nb; eSrc.loop = true;
  const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass'; eLP.frequency.value = 80;
  const eGain = ctx.createGain(); eGain.gain.value = 0.01 + state.storm * 0.02;
  eSrc.connect(eLP); eLP.connect(eGain); eGain.connect(gf); eSrc.start();

  // MELODY BUS
  const melodyBus = ctx.createGain(); melodyBus.gain.value = fx.melody * 0.8;
  melodyBus.connect(gf); melodyBus.connect(rvSend);
  liveNodes.melodyBus = melodyBus;

  // COUNTERPOINT BUS
  const harmonicBus = ctx.createGain(); harmonicBus.gain.value = (fx.harmony ?? 0.5) * 0.72;
  harmonicBus.connect(gf); harmonicBus.connect(rvSend);
  liveNodes.harmonicBus = harmonicBus;

  // Melody phrase state
  let phrasePos = 0, phraseResting = false, phraseRestBeats = 0;
  let phraseLen = 4 + Math.floor(Math.random() * 4);
  let phraseNotes = [];
  let lastFreq = motif[0];

  // Counterpoint state
  let cpFreq = state.isStormy ? chord[0] * 0.5 : state.isSunny ? chord[2] / 2 : chord[0] * 1.5;
  let cpPhrasePos = 0, cpRestBeats = 0;

  function cpPool() {
    if (vp.cpReg === 'sub') return [chord[0] * 0.5, chord[0], chord[2] / 2, chord[3] / 2];
    if (vp.cpReg === 'high') return [chord[2] / 2, chord[3] / 2, chord[2], chord[3]];
    return [chord[0], chord[2] / 2, chord[3] / 2, chord[4] / 2];
  }

  function playCounterpoint() {
    if (cpRestBeats > 0) { cpRestBeats--; return; }
    const pool = cpPool();
    const midRef = (pool[0] + pool[pool.length - 1]) / 2;
    const scored = pool.map(f => {
      let s = 0;
      if (cpFreq > midRef && f < cpFreq) s += 3;
      else if (cpFreq <= midRef && f >= cpFreq) s += 3;
      let ratio = lastFreq / f;
      while (ratio >= 2) ratio /= 2;
      while (ratio < 1) ratio *= 2;
      if (ratio >= 1.18 && ratio <= 1.27) s += 4;
      if (ratio >= 1.48 && ratio <= 1.51) s += 4;
      if (ratio >= 1.58 && ratio <= 1.70) s += 3;
      if (ratio >= 1.06 && ratio <= 1.13) s -= 4;
      if (ratio >= 1.40 && ratio <= 1.43) s -= 3;
      const jump = Math.abs(Math.log2(f / cpFreq)) * 12;
      if (jump > 7) s -= 2;
      return { f, s };
    });
    scored.sort((a, b) => b.s - a.s);
    const chosen = Math.random() < 0.78 ? scored[0].f : scored[Math.min(1, scored.length - 1)].f;
    if (!chosen || chosen < 55 || chosen > 420) return;
    cpFreq = chosen;
    updateLiveSheet();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = vp.cpType;
    osc.frequency.value = cpFreq;
    osc.detune.value = (Math.random() - 0.5) * 6;
    const att = vp.cpAtt + Math.random() * 0.05;
    const dec = vp.cpDecMin + Math.random() * vp.cpDecRng;
    const peak = (vp.cpPeak + state.brightness * 0.012) * pGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + att);
    g.gain.exponentialRampToValueAtTime(0.0001, now + att + dec);
    osc.connect(g); g.connect(harmonicBus);
    osc.start(now); osc.stop(now + att + dec + 0.1);
    cpPhrasePos++;
    if (cpPhrasePos >= 4) { cpPhrasePos = 0; cpRestBeats = 1 + Math.floor(Math.random() * 3); }
  }

  function nextMelodyFreq() {
    const tones = chordTones(chord);
    const pool = [...new Set([...tones, motif[Math.floor(Math.random() * motif.length)]])];
    const progress = phraseLen > 1 ? phrasePos / (phraseLen - 1) : 0.5;
    const wantUp = progress < 0.5;
    const scored = pool.map(f => {
      let sc = 0;
      const semis = Math.abs(Math.log2(f / lastFreq)) * 12;
      if (semis <= 2) sc += 5; else if (semis <= 4) sc += 3; else if (semis <= 7) sc += 1; else sc -= 3;
      if (semis < 0.5) sc -= 6;
      if (wantUp && f > lastFreq) sc += 3; else if (!wantUp && f < lastFreq) sc += 3;
      if (tones.includes(f)) sc += 1;
      if (phrasePos >= phraseLen - 2) {
        const ri = Math.abs(Math.log2(f / chord[1])) * 12 % 12;
        if (ri < 1.5 || Math.abs(ri - 7) < 1.5) sc += 4;
      }
      return { f, sc };
    });
    scored.sort((a, b) => b.sc - a.sc);
    const pick = scored[Math.random() < 0.72 ? 0 : Math.floor(Math.random() * Math.min(3, scored.length))];
    lastFreq = pick.f;
    phraseNotes.push(pick.f);
    return pick.f;
  }

  function playMelodyNote() {
    if (phraseResting) {
      phraseRestBeats--;
      if (phraseRestBeats <= 0) {
        phraseResting = false;
        phraseLen = 3 + Math.floor(Math.random() * 5);
        phraseNotes = [];
      }
      return;
    }
    if (phase === 'sparse' && Math.random() < 0.35) return;
    const freq = nextMelodyFreq();
    if (!freq || freq < 80 || freq > 6000) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    osc.type = vp.melType; osc.frequency.value = freq;
    filt.type = 'lowpass'; filt.frequency.value = vp.melFilter + state.brightness * 1500;
    const atk = vp.melAtk + Math.random() * 0.012;
    const progress = phraseLen > 1 ? phrasePos / (phraseLen - 1) : 0.5;
    const lenMult = (progress > 0.2 && progress < 0.8) ? 1.35 + Math.random() * 0.4 : 1.0;
    const dec = (vp.melDecMin + Math.random() * vp.melDecRng) * lenMult;
    const peak = (vp.melPeak + state.brightness * 0.03) * pGain();
    if (dec > 0.7 && Math.random() < 0.55) {
      const vibOsc = ctx.createOscillator(); const vibG = ctx.createGain();
      vibOsc.frequency.value = 4.8 + Math.random() * 2;
      vibG.gain.value = 5 + Math.random() * 9;
      vibOsc.connect(vibG); vibG.connect(osc.detune);
      vibOsc.start(now + atk * 1.5); vibOsc.stop(now + atk + dec);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, now + atk + dec);
    osc.connect(filt); filt.connect(g); g.connect(melodyBus);
    osc.start(now); osc.stop(now + atk + dec + 0.05);
    appState.liveSheetData.lastMelodyNote = freqToNoteName(freq);
    updateLiveSheet();
    phrasePos++;
    if (phrasePos >= phraseLen) {
      phrasePos = 0; phraseResting = true;
      phraseRestBeats = 2 + Math.floor(Math.random() * 4);
      phraseNotes = [];
      phraseLen = 3 + Math.floor(Math.random() * 5);
    }
  }

  function playVibe() {
    const tones = chordTones(chord);
    const freq = tones[Math.floor(Math.random() * 4)];
    if (!freq) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + Math.random() * 0.4);
    osc.connect(g); g.connect(melodyBus); osc.start(now); osc.stop(now + 1.1);
  }

  function playKick(vel = 1) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.38);
    const vol = (phase === 'sparse' ? 0.12 : 0.20 + state.storm * 0.06) * vel;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(g); g.connect(gf); osc.start(now); osc.stop(now + 0.5);
    const n = Math.floor(ctx.sampleRate * 0.006);
    const clkBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const clkD = clkBuf.getChannelData(0);
    for (let i = 0; i < n; i++) clkD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const clk = ctx.createBufferSource(); clk.buffer = clkBuf;
    const clkHP = ctx.createBiquadFilter(); clkHP.type = 'highpass'; clkHP.frequency.value = 5000;
    const clkG = ctx.createGain();
    clkG.gain.setValueAtTime(0.16 * vel, now);
    clkG.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);
    clk.connect(clkHP); clkHP.connect(clkG); clkG.connect(gf); clk.start(now);
  }

  function playSubBass() {
    if (state.harmony === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = chord[0] * 0.25;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.055, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(g); g.connect(gf); osc.start(now); osc.stop(now + 0.35);
  }

  function playHat(vol = 0.008, open = false) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = nb;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass';
    hpf.frequency.value = open ? 2800 : 6200 - state.wetness * 1400;
    const g = ctx.createGain();
    if (open) {
      g.gain.setValueAtTime(vol * pGain() * 1.8, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    } else {
      g.gain.value = vol * pGain();
    }
    src.connect(hpf); hpf.connect(g); g.connect(gf);
    src.start(now); src.stop(now + (open ? 0.28 : 0.042));
  }

  function playSnare(vel = 1) {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = nb;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 1200;
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 2800; bpf.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.06 * vel * pGain(), now + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    src.connect(hpf); hpf.connect(bpf); bpf.connect(ng); ng.connect(gf); ng.connect(rvSend);
    src.start(now); src.stop(now + 0.18);
    const ton = ctx.createOscillator(); const tg = ctx.createGain();
    ton.type = 'sine'; ton.frequency.value = 200;
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.exponentialRampToValueAtTime(0.04 * vel, now + 0.002);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    ton.connect(tg); tg.connect(gf); ton.start(now); ton.stop(now + 0.1);
  }

  function playShimmer() {
    if (phase === 'sparse') return;
    const tones = chordTones(chord); const freq = Math.random() < 0.6 ? tones[2] * 2 : tones[0] * 4;
    if (!freq) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.012 + state.brightness * 0.007, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g); g.connect(gf); g.connect(rvSend); osc.start(now); osc.stop(now + 0.65);
  }

  function playRainDrop() {
    if (!state.isRaining) return;
    const tones = chordTones(chord); const freq = tones[Math.floor(Math.random() * 3)] * 4;
    if (!freq) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2200;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.015 + state.wetness * 0.015, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(flt); flt.connect(g); g.connect(gf); g.connect(rvSend);
    osc.start(now); osc.stop(now + 0.22);
  }

  function playSnowCrystal() {
    if (!state.isSnowing) return;
    const tones = chordTones(chord); const freq = tones[Math.floor(Math.random() * 3)] * 4;
    if (!freq) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq * (0.98 + Math.random() * 0.04);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.008 + Math.random() * 0.005, now + 0.06 + Math.random() * 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9 + Math.random() * 0.7);
    osc.connect(g); g.connect(gf); g.connect(rvSend); osc.start(now); osc.stop(now + 1.8);
  }

  function playThunder() {
    if (!state.isStormy) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = nb;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05 + state.storm * 0.04, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    src.connect(flt); flt.connect(g); g.connect(gf); g.connect(rvSend);
    src.start(now); src.stop(now + 2.5);
  }

  function playRadarPing() {
    const tones = chordTones(chord); const freq = tones[2] * 2; if (!freq) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.35);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.012, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(g); g.connect(gf); g.connect(rvSend); osc.start(now); osc.stop(now + 0.5);
  }

  // ARPEGGIATOR
  const ARP_PATTERNS = {
    major: [0, 2, 1, 3, 2, 4, 1, 3],
    minor: [0, 1, 3, 1, 0, 2, 3, 2],
    suspended: [0, 3, 1, 2, 3, 0, 2, 1],
  };
  function playArpNote(freq) {
    if (!freq || freq < 100 || freq > 3000) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass';
    flt.frequency.value = freq * 1.8; flt.Q.value = 2;
    osc.type = 'triangle'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(flt); flt.connect(g); g.connect(melodyBus);
    osc.start(now); osc.stop(now + 0.4);
  }

  // FILTER SWELL
  let swellTimer = null;
  function startFilterSwell() {
    const swellDepth = state.isStormy ? 0.08 : state.isFoggy ? 0.06 : 0.04;
    const rate = state.isStormy ? 0.8 : state.isFoggy ? 0.05 : state.isSunny ? 0.15 : 0.1;
    let ph = 0;
    swellTimer = setInterval(() => {
      ph += rate * 0.05;
      const baseF = appState.liveNodes?.filterBase ?? 2000;
      gf.frequency.setTargetAtTime(Math.max(80, baseF * (1 + Math.sin(ph) * swellDepth)), ctx.currentTime, 0.35);
    }, 50);
  }
  startFilterSwell();

  // EFFECT SWELL
  let swellStep = 0;
  function tickEffectSwell() {
    const swellPeriod = STEPS * 4;
    swellStep = (swellStep + 1) % swellPeriod;
    const curve = Math.sin((swellStep / swellPeriod) * Math.PI);
    const rvBase = fx.reverb * 0.28;
    rvSend.gain.setTargetAtTime(
      rvBase + ((state.isStormy ? 0.55 : state.isFoggy ? 0.5 : 0.38) - rvBase) * curve * 0.5,
      ctx.currentTime, 0.5
    );
    const fbBase = getDelayFB(state, fx.delay);
    dlyFB.gain.setTargetAtTime(Math.min(0.45, fbBase + 0.1 * curve), ctx.currentTime, 0.5);
  }

  // SEQUENCER
  const beatMs = 60000 / state.tempo;
  const sixMs = beatMs / 4;
  const STEPS = timeSig.steps;
  const CHORD_CYCLE = STEPS * 2;
  const MELODY_CYCLE = 4;
  const RADAR_CYCLE = STEPS + 13;
  const HERMETO_CYCLE = Math.max(1, Math.round(STEPS / 3));

  const hudCondEl = $('hudCondition');
  if (hudCondEl) hudCondEl.textContent = `${state.label.toUpperCase()} • ${timeSig.name}`;

  let step = 0;
  const timers = [];

  const seqTimer = setInterval(() => {
    const cs = step % STEPS;
    window._beatRef = { audioTime: ctx.currentTime, sixSec: sixMs / 1000, bpm: state.tempo };

    const swingMs = (getFx().swing + genreBaseSwing * 0.5) * (60000 / state.tempo / 4) * 0.32;

    if (genreDrumsActive) {
      if (timeSig.kickOn.includes(cs)) {
        const kickVel = cs === 0 ? 1.0 : 0.68 + Math.random() * 0.28;
        const dOff = cs === 0 ? 0 : swingMs * 0.55 + Math.random() * 9;
        setTimeout(() => { playKick(kickVel); pulseVisual(); }, dOff);
        if (cs === 0) { setTimeout(() => playSubBass(), dOff + 2); }
      }
      if (timeSig.snareOn && timeSig.snareOn.includes(cs)) {
        const sVel = 0.80 + Math.random() * 0.20;
        setTimeout(() => playSnare(sVel), swingMs * 0.45 + Math.random() * 8);
      }
      if (timeSig.ghostOn && timeSig.ghostOn.includes(cs) && Math.random() < genreDrumDensity) {
        const gVel = 0.06 + Math.random() * 0.14;
        setTimeout(() => playSnare(gVel), Math.random() * 14);
      }
      if (timeSig.hatOn.includes(cs)) {
        const isOpen = timeSig.openHatOn && timeSig.openHatOn.includes(cs);
        const isAccent = timeSig.accentHat && timeSig.accentHat.includes(cs);
        const isUp = cs % 4 !== 0;
        const hVol = isAccent ? 0.019 : isOpen ? 0.014 : isUp ? 0.007 : 0.011;
        const hOff = isUp ? (swingMs * 0.85 + Math.random() * 6) : Math.random() * 4;
        setTimeout(() => playHat(hVol, isOpen), hOff);
      }
    }

    if (phase !== 'sparse' && timeSig.hatOn && timeSig.hatOn.includes(cs) && cs % 4 !== 0) {
      if (Math.random() < genreArpWeight) {
        const arpPat = ARP_PATTERNS[state.harmony] || ARP_PATTERNS.major;
        const tones = chordTones(chord);
        const freq = tones[arpPat[cs % arpPat.length] % tones.length];
        if (freq) setTimeout(() => playArpNote(freq), swingMs * 0.3);
      }
    }

    tickEffectSwell();

    if (bcAmt > 0.05 && timeSig.kickOn.includes(cs) && cs !== 0) {
      setTimeout(() => {
        const now = ctx.currentTime;
        const src2 = ctx.createBufferSource(); src2.buffer = nb;
        const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 2500;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.002);
        g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        src2.connect(hp2); hp2.connect(g2); g2.connect(bcInput);
        src2.start(now); src2.stop(now + 0.12);
      }, swingMs);
    }

    if (cs === Math.floor(STEPS / 2) && state.brightness > 0.25) playShimmer();
    if (state.isRaining && cs % Math.max(2, Math.floor(STEPS / 6)) === 1 && Math.random() < 0.5 + state.wetness * 0.3) playRainDrop();
    if (state.isSnowing && cs % Math.max(3, Math.floor(STEPS / 4)) === 2 && Math.random() < 0.4 + state.brightness * 0.2) playSnowCrystal();
    if (state.isStormy && cs === STEPS - 1 && Math.random() < 0.12 + state.storm * 0.22) playThunder();

    if (step % MELODY_CYCLE === 0) playMelodyNote();
    if (step % (MELODY_CYCLE * 2) === 0) playCounterpoint();

    if (step % (STEPS * 2) === Math.floor(STEPS * 1.5) && phase !== 'sparse') playVibe();
    if (step % HERMETO_CYCLE === 0 && phase === 'full') playVibe();
    if (step % RADAR_CYCLE === 0 && state.wind > 0.2) playRadarPing();

    if (step > 0 && step % CHORD_CYCLE === 0) {
      chordIdx = (chordIdx + 1) % progression.length;
      chord = progression[chordIdx];
      motif = buildMotif(chord);
      cpFreq = chord[0] * 1.5;
      appState.liveSheetData.chordIdx = chordIdx;
      updateLiveSheet();
      padVoices.forEach(v => { try { v.stop(ctx.currentTime + 2.5); } catch (e) {} });
      setTimeout(() => buildPad(chord), 600);
      if (phase !== 'sparse') {
        chordTones(chord).slice(0, 3).forEach((freq, i) => {
          const n3 = ctx.currentTime;
          const o = ctx.createOscillator(); const g3 = ctx.createGain();
          o.type = 'sine'; o.frequency.value = freq;
          g3.gain.setValueAtTime(0.0001, n3);
          g3.gain.exponentialRampToValueAtTime(0.014 * (1 - i * 0.25), n3 + 0.015);
          g3.gain.exponentialRampToValueAtTime(0.0001, n3 + 1.5);
          o.connect(g3); g3.connect(gf); g3.connect(rvSend); o.start(n3); o.stop(n3 + 1.7);
        });
      }
    }

    padBus.gain.linearRampToValueAtTime(vp.padVol * pGain(), ctx.currentTime + 1.5);
    step++;
  }, sixMs);
  timers.push(seqTimer);

  // VINYL CRACKLE
  let crackleTimer = null;
  function schedCrackle() {
    if (!ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.004 + Math.random() * 0.018;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass';
    hpf.frequency.value = 3500 + Math.random() * 3500;
    const cg = ctx.createGain(); cg.gain.value = 0.006 + Math.random() * 0.022;
    src.connect(hpf); hpf.connect(cg); cg.connect(master);
    src.start(now); src.stop(now + dur + 0.01);
    crackleTimer = setTimeout(schedCrackle, vp.crackleMin + Math.random() * vp.crackleRng);
  }
  crackleTimer = setTimeout(schedCrackle, vp.crackleMin + Math.random() * (vp.crackleRng * 0.4));

  // Update engine status
  const esEl = $('engineStatus');
  if (esEl) { esEl.textContent = 'RUNNING'; esEl.style.color = 'var(--green)'; }

  appState.currentAudio = {
    stopAll: () => {
      timers.forEach(clearInterval);
      clearTimeout(phaseTimer);
      if (swellTimer) clearInterval(swellTimer);
      if (crackleTimer) clearTimeout(crackleTimer);
      appState.liveNodes = null;
      [wSrc, eSrc].forEach(s => { try { s.stop(); } catch (e) {} });
      [fLFO, bLFO, wLFO, wowLFO, flutterLFO, wahLFO, choLFO].forEach(l => { try { l.stop(); } catch (e) {} });
      padVoices.forEach(v => { try { v.stop(); } catch (e) {} });
      padBus.gain.setValueAtTime(0, ctx.currentTime);
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 300);
    },
  };
}
