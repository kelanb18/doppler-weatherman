// ─── HV SPECTRUM ANALYZER CANVAS ─────────────────────────────
import { appState } from '../state.js';

let hvAnimFrame = null;
let hvState = null;

export function updateHvViz(s) {
  hvState = s;
  const el = document.getElementById('hvViz');
  if (!el) return;
  if (!el.querySelector('canvas')) {
    el.innerHTML = '<canvas id="hvCanvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>';
    startHvAnim();
  }
}

export function startHvAnim() {
  if (hvAnimFrame) cancelAnimationFrame(hvAnimFrame);
  const canvas = document.getElementById('hvCanvas');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  let W, H;
  let peaks = [];
  let peakTimers = [];

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.round(r.width * devicePixelRatio);
    canvas.height = Math.round(r.height * devicePixelRatio);
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = r.width; H = r.height;
    peaks = []; peakTimers = [];
  }
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);

  const NUM_BARS = 28;
  const SR = 44100;
  const FFT = 512;
  const BIN_HZ = SR / FFT;
  const MIN_HZ = 60, MAX_HZ = 8000;

  function getBarBins() {
    const bands = [];
    for (let i = 0; i < NUM_BARS; i++) {
      const loHz = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, i / NUM_BARS);
      const hiHz = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, (i + 1) / NUM_BARS);
      const lo = Math.max(0, Math.round(loHz / BIN_HZ));
      const hi = Math.min(FFT / 2 - 1, Math.round(hiHz / BIN_HZ));
      bands.push({ lo, hi: Math.max(lo, hi) });
    }
    return bands;
  }
  const BANDS = getBarBins();

  function draw() {
    const _skin = document.body.getAttribute('data-skin');
    if (_skin !== 'brutal') { hvAnimFrame = requestAnimationFrame(draw); return; }
    const s = hvState;
    const clk = window._hvClock;
    const analyser = appState.liveNodes ? appState.liveNodes.analyser : null;

    c.clearRect(0, 0, W, H);
    if (!s) { hvAnimFrame = requestAnimationFrame(draw); return; }

    const bpm = clk ? clk.bpm : (s.tempo || 70);
    const sixMs = clk ? clk.sixMs : (60000 / bpm / 4);
    const beatMs = sixMs * 4;
    const elapsed = clk ? performance.now() - clk.lastBeatTime : 0;
    const beatPhase = Math.min(1, elapsed / beatMs);

    let freqDataDB = null;
    if (analyser) {
      freqDataDB = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqDataDB);
    }

    if (_skin === 'brutal') {
      c.clearRect(0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,0.90)'; c.fillRect(0, 0, W, H);
      let vizLo, vizHi, vizHot, vizFlash;
      if (s.isStormy) {
        vizLo = '#2D0010'; vizHi = '#FF1744'; vizHot = '#FF6E8A'; vizFlash = 'rgba(255,23,68,';
      } else if (s.isRaining) {
        vizLo = '#001A3D'; vizHi = '#2979FF'; vizHot = '#82B1FF'; vizFlash = 'rgba(41,121,255,';
      } else if (s.isSnowing) {
        vizLo = '#0D0D2B'; vizHi = '#B8C4FF'; vizHot = '#EEF0FF'; vizFlash = 'rgba(184,196,255,';
      } else if (s.isFoggy) {
        vizLo = '#0A1520'; vizHi = '#00BCD4'; vizHot = '#80DEEA'; vizFlash = 'rgba(0,188,212,';
      } else if (s.isSunny && s.isDaytime) {
        vizLo = '#002211'; vizHi = '#00E676'; vizHot = '#69FFAC'; vizFlash = 'rgba(0,230,118,';
      } else if (!s.isDaytime) {
        vizLo = '#0D0020'; vizHi = '#7C4DFF'; vizHot = '#B388FF'; vizFlash = 'rgba(124,77,255,';
      } else {
        vizLo = '#0A2030'; vizHi = '#00ACC1'; vizHot = '#4DD0E1'; vizFlash = 'rgba(0,172,193,';
      }
      if (beatPhase < 0.06) {
        c.fillStyle = `${vizFlash}${(0.06 - beatPhase) / 0.06 * 0.18})`;
        c.fillRect(0, 0, W, H);
      }
      const BP_L = 12, BP_R = 12, BP_TOP = 38, BP_BOT = 34;
      const bAW = W - BP_L - BP_R, bAH = H - BP_TOP - BP_BOT;
      const bW2 = Math.floor(bAW / NUM_BARS), gap2 = Math.max(2, Math.round(bW2 * 0.22)), bw2 = bW2 - gap2;
      for (let i = 0; i < NUM_BARS; i++) {
        const band = BANDS[i]; let val = 0;
        if (freqDataDB) {
          let sum = 0, cnt = 0;
          for (let b = band.lo; b <= band.hi; b++) {
            const db = freqDataDB[b];
            if (isFinite(db) && db > -Infinity) { sum += db; cnt++; }
          }
          if (cnt > 0) { val = Math.max(0, (sum / cnt - (-80)) / ((-10) - (-80))); }
        }
        const bH2 = Math.max(2, val * bAH);
        const bx = BP_L + i * bW2, by = BP_TOP + bAH - bH2;
        const barGrad = c.createLinearGradient(0, by, 0, by + bH2);
        barGrad.addColorStop(0, val > 0.65 ? vizHot : vizHi);
        barGrad.addColorStop(1, vizLo);
        c.fillStyle = barGrad;
        c.fillRect(bx, by, bw2, bH2);
        if (!peaks[i] || val > peaks[i]) { peaks[i] = val; peakTimers[i] = 55; }
        else { peakTimers[i] = (peakTimers[i] || 0) - 1; if (peakTimers[i] <= 0) peaks[i] = Math.max(0, peaks[i] - 0.009); }
        if (peaks[i] > 0.02) { c.fillStyle = vizHot; c.fillRect(bx, BP_TOP + bAH - peaks[i] * bAH - 2, bw2, 2); }
      }
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(BP_L, BP_TOP + bAH + 2); c.lineTo(W - BP_R, BP_TOP + bAH + 2); c.stroke();
      c.font = "700 8px 'Space Grotesk',sans-serif";
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.textAlign = 'center'; c.textBaseline = 'top';
      [{ hz: 100, t: '100' }, { hz: 250, t: '250' }, { hz: 500, t: '500' }, { hz: 1000, t: '1k' }, { hz: 2000, t: '2k' }, { hz: 4000, t: '4k' }].forEach(lb => {
        const fx = BP_L + (Math.log(lb.hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * bAW;
        c.fillText(lb.t, fx, BP_TOP + bAH + 7);
      });
      const bpmFS = Math.round(H * 0.13);
      c.font = `700 ${bpmFS}px 'Space Grotesk',sans-serif`;
      const bpmStr = String(bpm);
      const bpmW = c.measureText(bpmStr).width;
      c.textAlign = 'left'; c.textBaseline = 'bottom';
      c.fillStyle = '#FFFFFF'; c.fillText(bpmStr, BP_L, BP_TOP - 4);
      c.font = "600 8px 'Space Grotesk',sans-serif";
      c.fillStyle = 'rgba(255,255,255,0.38)';
      c.fillText('BPM', BP_L + bpmW + 5, BP_TOP - 7);
      c.font = "700 9px 'Space Grotesk',sans-serif";
      c.fillStyle = vizHi; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText((s.genre || s.harmony || '').toUpperCase(), W - BP_R, BP_TOP - 4);
      hvAnimFrame = requestAnimationFrame(draw); return;
    }

    // DEFAULT SKIN FALLBACK
    const wallT = performance.now() / 1000;
    const wind = s.wind || 0, storm = s.storm || 0, wet = s.wetness || 0;
    const bright = s.brightness || 0;

    let skyTop, skyBot;
    if (!s.isDaytime) { skyTop = '#06070A'; skyBot = '#0C0E14'; }
    else if (s.isStormy) { skyTop = '#0C0C10'; skyBot = '#141418'; }
    else if (s.isRaining) { skyTop = '#080C14'; skyBot = '#0E1420'; }
    else if (s.isFoggy) { skyTop = '#0C0C0C'; skyBot = '#141414'; }
    else if (s.isSunny && s.isDaytime) { skyTop = '#100C06'; skyBot = '#1A1208'; }
    else { skyTop = '#0A0C0E'; skyBot = '#121416'; }
    const skyGrad = c.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, skyTop); skyGrad.addColorStop(1, skyBot);
    c.fillStyle = skyGrad; c.fillRect(0, 0, W, H);

    if (!s.isStormy && !s.isRaining) {
      const cloudCount = s.isSunny ? 2 : s.isCloudy ? 6 : 4;
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < cloudCount; i++) {
        const cx = ((i / cloudCount) * W + (wallT * 18 * (0.4 + wind * 0.3) + i * 197)) % W;
        const cy = H * 0.08 + i * H * 0.06;
        const cw = 60 + i * 35;
        c.beginPath(); c.ellipse(cx, cy, cw, 18, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(cx + cw * 0.3, cy - 10, cw * 0.55, 14, 0, 0, Math.PI * 2); c.fill();
      }
    }
    if (s.isStormy) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i / 5) * W + (wallT * 8 + i * 211)) % W;
        const cy = H * 0.06 + i * H * 0.05;
        c.beginPath(); c.ellipse(cx, cy, 90 + i * 20, 26, 0, 0, Math.PI * 2); c.fill();
      }
    }
    if (s.isSunny && s.isDaytime) {
      c.save();
      const sx = W * 0.82, sy = H * 0.18, sr = 22 + bright * 8;
      const sunGlow = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
      sunGlow.addColorStop(0, 'rgba(255,230,100,0.35)');
      sunGlow.addColorStop(1, 'rgba(255,200,50,0)');
      c.fillStyle = sunGlow; c.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
      c.fillStyle = 'rgba(255,220,80,0.9)';
      c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    if (!s.isDaytime && !s.isStormy) {
      c.fillStyle = 'rgba(220,230,255,0.7)';
      c.beginPath(); c.arc(W * 0.8, H * 0.15, 14, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 40; i++) {
        const sx2 = ((i * 137.5) % 1) * W;
        const sy2 = ((i * 97.3) % 1) * (H * 0.55);
        const twinkle = 0.4 + 0.6 * Math.sin(wallT * 1.2 + i * 2.1);
        c.fillStyle = `rgba(255,255,255,${twinkle * 0.7})`;
        c.beginPath(); c.arc(sx2, sy2, 0.8, 0, Math.PI * 2); c.fill();
      }
    }
    if (s.isRaining) {
      c.strokeStyle = 'rgba(180,210,240,0.6)'; c.lineWidth = 1;
      const n = Math.round(wet * 80 + 30);
      for (let i = 0; i < n; i++) {
        const rx = ((i / n) * W * 1.3 + wallT * 110 * (1 + wind * 0.5)) % W;
        const ry = (wallT * 200 + i * (H / n)) % H;
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - 3, ry + 12); c.stroke();
      }
    }
    if (s.isSnowing) {
      for (let i = 0; i < 50; i++) {
        const sx = ((i / 50) * W + Math.sin(wallT * 0.4 + i * 1.3) * 20) % (W + 10) - 5;
        const sy = (wallT * 18 + i * (H / 50)) % H;
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.beginPath(); c.arc(sx, sy, 1.5, 0, Math.PI * 2); c.fill();
      }
    }
    if (wind > 0.3) {
      c.strokeStyle = `rgba(255,255,255,${wind * 0.18})`; c.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const ly = H * 0.05 + i * (H * 0.1);
        const lw = 30 + i * 18;
        const lx = ((wallT * 90 * (0.5 + wind) + i * 173) % (W + lw)) - lw;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + lw, ly); c.stroke();
      }
    }
    if (storm > 0.5 && Math.random() < storm * 0.006) {
      c.strokeStyle = 'rgba(255,255,220,0.9)'; c.lineWidth = 1.5;
      const lx = W * 0.2 + Math.random() * W * 0.6;
      c.beginPath(); c.moveTo(lx, 0);
      c.lineTo(lx + 10, H * 0.3); c.lineTo(lx - 5, H * 0.5); c.lineTo(lx + 8, H * 0.7);
      c.stroke();
      c.fillStyle = 'rgba(255,255,200,0.15)'; c.fillRect(0, 0, W, H);
    }

    const PAD_L = 14, PAD_R = 14, PAD_TOP = 32, PAD_BOT = 40;
    const barAreaW = W - PAD_L - PAD_R;
    const barAreaH = H - PAD_TOP - PAD_BOT;
    const barW = Math.floor(barAreaW / NUM_BARS);
    const gap = Math.max(1, Math.round(barW * 0.18));
    const bw = barW - gap;

    for (let i = 0; i < NUM_BARS; i++) {
      const band = BANDS[i];
      let val = 0;
      if (freqDataDB) {
        let sum = 0, count = 0;
        for (let b = band.lo; b <= band.hi; b++) {
          const db = freqDataDB[b];
          if (isFinite(db) && db > -Infinity) { sum += db; count++; }
        }
        if (count > 0) {
          const avgDb = sum / count;
          const mapped = Math.max(0, (avgDb - (-80)) / ((-10) - (-80)));
          const centerHz = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, (i + 0.5) / NUM_BARS);
          let aWeight = 1.0;
          if (centerHz < 200) aWeight = 0.35 + centerHz / 200 * 0.3;
          else if (centerHz < 500) aWeight = 0.65 + ((centerHz - 200) / 300) * 0.2;
          else if (centerHz < 2000) aWeight = 0.85 + ((centerHz - 500) / 1500) * 0.15;
          else if (centerHz < 4000) aWeight = 1.0;
          else if (centerHz < 8000) aWeight = 0.95;
          else aWeight = 0.75;
          val = Math.min(1, mapped * aWeight);
        }
      }
      const barH = Math.max(1, val * barAreaH);
      const x = PAD_L + i * barW;
      const y = PAD_TOP + barAreaH - barH;
      const alpha = 0.55 + val * 0.4;
      c.fillStyle = `rgba(0,144,158,${alpha})`;
      c.fillRect(x, y, bw, barH);
      if (!peaks[i] || val > peaks[i]) { peaks[i] = val; peakTimers[i] = 60; }
      else { peakTimers[i] = (peakTimers[i] || 0) - 1; if (peakTimers[i] <= 0) peaks[i] = Math.max(0, peaks[i] - 0.008); }
      const peakY = PAD_TOP + barAreaH - peaks[i] * barAreaH;
      if (peaks[i] > 0.01) { c.fillStyle = 'rgba(232,70,10,0.9)'; c.fillRect(x, peakY - 1, bw, 1); }
    }

    c.strokeStyle = 'rgba(0,144,158,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(PAD_L, PAD_TOP + barAreaH + 1); c.lineTo(W - PAD_R, PAD_TOP + barAreaH + 1); c.stroke();
    c.font = "500 8px 'Inter',sans-serif";
    c.fillStyle = 'rgba(0,144,158,0.5)'; c.textAlign = 'center'; c.textBaseline = 'top';
    [{ hz: 100, txt: '100' }, { hz: 250, txt: '250' }, { hz: 500, txt: '500' }, { hz: 1000, txt: '1k' }, { hz: 2000, txt: '2k' }, { hz: 4000, txt: '4k' }].forEach(lb => {
      const frac = Math.log(lb.hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ);
      const lx = PAD_L + frac * barAreaW;
      c.fillText(lb.txt, lx, PAD_TOP + barAreaH + 6);
    });
    c.font = `300 ${Math.round(H * 0.11)}px 'Inter',sans-serif`;
    c.fillStyle = 'rgba(0,144,158,0.85)'; c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText(bpm, PAD_L, PAD_TOP - 6);
    c.font = "500 8px 'Inter',sans-serif";
    c.fillStyle = 'rgba(0,144,158,0.45)';
    c.fillText('BPM', PAD_L + c.measureText(String(bpm)).width + 4, PAD_TOP - 10);
    c.font = "500 8px 'Inter',sans-serif";
    c.fillStyle = 'rgba(232,70,10,0.65)'; c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText((s.harmony || '').toUpperCase(), W - PAD_R, PAD_TOP - 6);
    if (beatPhase < 0.08) {
      c.fillStyle = `rgba(0,144,158,${(0.08 - beatPhase) / 0.08 * 0.08})`;
      c.fillRect(0, 0, W, H);
    }

    hvAnimFrame = requestAnimationFrame(draw);
  }
  draw();
}

export function stopHvAnim() {
  if (hvAnimFrame) { cancelAnimationFrame(hvAnimFrame); hvAnimFrame = null; }
  window._hvClock = null;
}
