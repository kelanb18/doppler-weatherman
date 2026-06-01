// ─── DRUM PAD + KEY PAD ──────────────────────────────────────
import { appState } from '../state.js';

let padMode = 'drum';
const DRUM_NAMES = ['Thump', 'Spark', 'Glass', 'Pulse', 'Whomp', 'Metal', 'Rasp', 'Crystal'];

function freqToNoteName(hz) {
  if (!hz || hz < 60) return '—';
  const A4 = 440, semi = Math.round(12 * Math.log2(hz / A4));
  const noteNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const oct = Math.floor((semi + 57) / 12) + 1;
  const ni = ((semi % 12) + 12) % 12;
  return noteNames[ni] + oct;
}

export function getKeyNotes() {
  const ctx = window._liveChordCtx;
  if (ctx) {
    const { mode, rootHz } = ctx;
    const ext = [...mode, ...mode.map(s => s + 12)];
    return ext.slice(0, 8).map(s => rootHz * Math.pow(2, s / 12));
  }
  const root = 220;
  return [0, 2, 4, 5, 7, 9, 11, 12].map(s => root * Math.pow(2, s / 12));
}

export function updatePadLabels() {
  if (padMode === 'drum') {
    DRUM_NAMES.forEach((n, i) => {
      const e = document.getElementById('pn' + i);
      if (e) e.textContent = n;
    });
  } else {
    const notes = getKeyNotes();
    notes.forEach((hz, i) => {
      const e = document.getElementById('pn' + i);
      if (e) e.textContent = freqToNoteName(hz) || '—';
    });
  }
}

export function togglePadMode() {
  padMode = padMode === 'drum' ? 'keys' : 'drum';
  const btn = document.getElementById('drumModeBtn');
  const lbl = document.getElementById('drumSectionLabel');
  const hint = document.getElementById('drumHint');
  if (btn) { btn.textContent = padMode === 'drum' ? '⌨ Keys' : '🥁 Drums'; btn.classList.toggle('active', padMode === 'keys'); }
  if (lbl) lbl.textContent = padMode === 'drum' ? 'Drum Pad' : 'Key Pad';
  if (hint) hint.textContent = padMode === 'drum' ? 'click or press 1–8' : 'plays scale notes · 1–8';
  updatePadLabels();
}

export function hitPad(idx, el) {
  if (padMode === 'keys') { playKeyNote(idx, el); } else { triggerDrum(idx, el); }
}

export function playKeyNote(idx, el) {
  const audioCtx = appState.liveNodes?.ctx;
  if (!audioCtx) return;
  audioCtx.resume();
  const now = audioCtx.currentTime + (audioCtx.outputLatency || audioCtx.baseLatency || 0) + 0.005;
  const notes = getKeyNotes();
  const freq = notes[idx] || 220;
  const out = appState.liveNodes.master;
  const bpm = appState.currentState?.tempo || 90;
  const qn = 60 / bpm;
  const dly = audioCtx.createDelay(4); dly.delayTime.value = qn;
  const dlyG = audioCtx.createGain(); dlyG.gain.value = 0.28;
  const dryG = audioCtx.createGain(); dryG.gain.value = 1.0;
  dly.connect(dlyG); dlyG.connect(out);
  const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.55, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  osc.connect(g); g.connect(dryG); dryG.connect(out); g.connect(dly);
  osc.start(now); osc.stop(now + 1.3);
  if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 120); }
  updatePadLabels();
}

export function triggerDrum(idx, el) {
  const audioCtx = appState.liveNodes?.ctx;
  if (!audioCtx) return;
  audioCtx.resume();
  const now = audioCtx.currentTime + (audioCtx.outputLatency || audioCtx.baseLatency || 0) + 0.004;
  const out = appState.liveNodes.master;
  const bpm = appState.currentState?.tempo || 90;
  const qn = 60 / bpm;
  const ref = window._beatRef;
  let dlyTime = qn;
  if (ref && ref.sixSec > 0) {
    const elapsed = audioCtx.currentTime - ref.audioTime;
    const phase = elapsed % ref.sixSec;
    const toNextSix = ref.sixSec - phase;
    const sixPerQn = Math.round(qn / ref.sixSec);
    dlyTime = toNextSix + (sixPerQn - 1) * ref.sixSec;
    if (dlyTime < qn * 0.5) dlyTime += ref.sixSec;
  }
  const dly = audioCtx.createDelay(4); dly.delayTime.value = dlyTime;
  const dlyG = audioCtx.createGain(); dlyG.gain.value = 0.30;
  dly.connect(dlyG); dlyG.connect(out);
  function withDelay(node) { node.connect(dly); node.connect(out); }
  function noise(dur) {
    const len = Math.ceil(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf; return src;
  }
  const liveCtx = window._liveChordCtx;
  const root = liveCtx?.rootHz || 220;
  const modeIntervals = liveCtx?.mode || [0, 2, 4, 5, 7, 9, 11];
  const scHz = modeIntervals.map(s => root * Math.pow(2, s / 12));
  switch (idx) {
    case 0: {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120; f.Q.value = 8;
      const hi = Math.max(root / 2, 55), lo = Math.max(root / 6, 22);
      o.type = 'sine'; o.frequency.setValueAtTime(hi, now); o.frequency.exponentialRampToValueAtTime(lo, now + 0.18);
      g.gain.setValueAtTime(0.9, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      o.connect(f); f.connect(g); withDelay(g); o.start(now); o.stop(now + 0.6); break;
    }
    case 1: {
      const mod = audioCtx.createOscillator(), car = audioCtx.createOscillator();
      const modG = audioCtx.createGain(), g = audioCtx.createGain();
      const carHi = root * 8, carLo = root;
      mod.frequency.setValueAtTime(carHi, now); mod.frequency.exponentialRampToValueAtTime(carLo / 4, now + 0.18);
      modG.gain.setValueAtTime(carHi * 1.5, now); modG.gain.exponentialRampToValueAtTime(20, now + 0.18);
      car.frequency.setValueAtTime(carHi, now); car.frequency.exponentialRampToValueAtTime(carLo, now + 0.18);
      mod.connect(modG); modG.connect(car.frequency);
      g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      car.connect(g); withDelay(g); mod.start(now); car.start(now); mod.stop(now + 0.2); car.stop(now + 0.2); break;
    }
    case 2: {
      const degrees = [0, Math.min(2, scHz.length - 1), Math.min(4, scHz.length - 1)];
      degrees.forEach((d, i) => {
        const fr = scHz[d] * 4;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = fr * (1 + i * 0.001);
        g.gain.setValueAtTime(0.0001, now + i * 0.008);
        g.gain.exponentialRampToValueAtTime(0.22 - i * 0.05, now + i * 0.008 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
        o.connect(g); withDelay(g); o.start(now); o.stop(now + 1.5);
      }); break;
    }
    case 3: {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const fifth = scHz[Math.min(4, scHz.length - 1)] * 2;
      const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fifth; f.Q.value = 12;
      o.type = 'triangle';
      o.frequency.setValueAtTime(fifth, now); o.frequency.exponentialRampToValueAtTime(scHz[0], now + 0.06);
      g.gain.setValueAtTime(0.7, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      o.connect(f); f.connect(g); withDelay(g); o.start(now); o.stop(now + 0.25);
      const nbSrc = noise(0.015), ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.4, now); ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      nbSrc.connect(ng); ng.connect(out); nbSrc.start(now); nbSrc.stop(now + 0.015); break;
    }
    case 4: {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain();
      const subRoot = root / 2;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(subRoot * 1.5, now);
      o.frequency.exponentialRampToValueAtTime(subRoot / 2, now + 0.35);
      lfo.frequency.value = 6; lfoG.gain.value = subRoot * 0.25;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass';
      filt.frequency.setValueAtTime(subRoot * 8, now);
      filt.frequency.exponentialRampToValueAtTime(subRoot, now + 0.35);
      g.gain.setValueAtTime(0.75, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      o.connect(filt); filt.connect(g); withDelay(g);
      lfo.start(now); o.start(now); lfo.stop(now + 0.4); o.stop(now + 0.4); break;
    }
    case 5: {
      [[scHz[0] * 2, 0], [scHz[Math.min(2, scHz.length - 1)] * 2, 14], [scHz[Math.min(4, scHz.length - 1)] * 2, 8]].forEach(([fr, det]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'square'; o.frequency.value = fr; o.detune.value = det;
        g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
        o.connect(g); withDelay(g); o.start(now); o.stop(now + 0.8);
      }); break;
    }
    case 6: {
      const nbSrc = noise(0.28);
      const f1 = audioCtx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = root * 1.3; f1.Q.value = 3;
      const f2 = audioCtx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = root * 4; f2.gain.value = 12;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      nbSrc.connect(f1); f1.connect(f2); f2.connect(g); withDelay(g); nbSrc.start(now); nbSrc.stop(now + 0.3); break;
    }
    case 7: {
      [[scHz[0] * 4, 3.5], [scHz[Math.min(4, scHz.length - 1)] * 4, 7], [scHz[0] * 8, 14]].forEach(([cfr, ratio]) => {
        const mod = audioCtx.createOscillator(), car = audioCtx.createOscillator();
        const mG = audioCtx.createGain(), g = audioCtx.createGain();
        mod.frequency.value = cfr; mG.gain.value = cfr * ratio;
        car.frequency.value = cfr;
        mod.connect(mG); mG.connect(car.frequency);
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        car.connect(g); withDelay(g);
        mod.start(now); car.start(now); mod.stop(now + 1.9); car.stop(now + 1.9);
      }); break;
    }
  }
  if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90); }
}
