// ─── EVENT WIRING + CONTROLS ─────────────────────────────────
import { $, setStatus } from '../utils.js';
import { appState } from '../state.js';
import { updateSliderLabels, stateFromSliders } from '../weather/interpret.js';
import { loadWeatherForZip } from '../weather/api.js';
import { play, stop, applyManual, resetToWeather, applyLiveFx, getFx } from '../audio/engine.js';
import { hitPad, togglePadMode, updatePadLabels } from '../audio/drums.js';
import { updateVisualizer } from '../ui/scene.js';
import { updateHvViz, stopHvAnim } from '../ui/canvas.js';

// Expose global functions required by inline HTML onclick attributes
window.loadWeatherForZip = loadWeatherForZip;
window.togglePadMode = togglePadMode;
window.hitPad = hitPad;

// ─── TRANSPORT ───────────────────────────────────────────────
$('loadWeatherBtn').addEventListener('click', () => loadWeatherForZip($('zipInput').value));
$('loadWeatherBtn2').addEventListener('click', () => loadWeatherForZip($('zipInput2').value));
$('playBtn').addEventListener('click', play);
$('playBtn2').addEventListener('click', play);
$('stopBtn').addEventListener('click', stop);
$('stopBtn2').addEventListener('click', stop);
$('applyManualBtn').addEventListener('click', applyManual);
$('resetToWeatherBtn').addEventListener('click', resetToWeather);
$('resetToWeatherBtn2').addEventListener('click', resetToWeather);

// ─── SHARE URL ───────────────────────────────────────────────
function buildShareURL() {
  const fxIds = ['fxReverb', 'fxDelay', 'fxFilter', 'fxDrive', 'fxMelody', 'fxHarmony', 'fxWah', 'fxChorus', 'fxFuzz', 'fxCrush', 'fxDrift', 'fxSwing', 'fxVol'];
  const fx = fxIds.map(id => { const e = $(id); return e ? Math.round(parseFloat(e.value) * 100) / 100 : null; }).filter(v => v !== null);
  const w = ['warmthSlider', 'windSlider', 'wetnessSlider', 'stormSlider', 'brightnessSlider']
    .map(id => { const e = $(id); return e ? Math.round(parseFloat(e.value) * 100) / 100 : 0.5; });
  const obj = { zip: $('zipInput').value, w, fx, skin: document.body.dataset.skin || 'default', manual: true };
  return location.origin + location.pathname + '#state=' + btoa(JSON.stringify(obj));
}

function loadShareURL() {
  if (!location.hash.startsWith('#state=')) return;
  try {
    const obj = JSON.parse(atob(location.hash.slice(7)));
    if (obj.skin) document.body.dataset.skin = obj.skin;
    if (obj.zip) {
      const zi = $('zipInput'), zi2 = $('zipInput2');
      if (zi) zi.value = obj.zip;
      try { if (zi2) zi2.value = obj.zip; } catch (e) {}
    }
    const fxIds = ['fxReverb', 'fxDelay', 'fxFilter', 'fxDrive', 'fxMelody', 'fxHarmony', 'fxWah', 'fxChorus', 'fxFuzz', 'fxCrush', 'fxDrift', 'fxSwing', 'fxVol'];
    if (obj.fx) {
      fxIds.forEach((id, i) => {
        if (obj.fx[i] == null) return;
        const e = $(id); if (e) e.value = String(obj.fx[i]);
        const ve = $(id + 'Val'); if (ve) ve.textContent = Number(obj.fx[i]).toFixed(2);
      });
      appState._pendingSharedFx = fxIds.map((id, i) => obj.fx[i] != null ? [id, obj.fx[i]] : null).filter(Boolean);
    }
    if (obj.manual) {
      if (obj.w) {
        ['warmthSlider', 'windSlider', 'wetnessSlider', 'stormSlider', 'brightnessSlider'].forEach((id, i) => {
          const e = $(id); if (e) e.value = String(obj.w[i]);
          const v = $(id + 'Value'); if (v) v.textContent = Number(obj.w[i]).toFixed(2);
        });
      }
      appState.usingManualState = true;
      const s = stateFromSliders();
      updateVisualizer(s);
    } else if (obj.zip) {
      setTimeout(() => loadWeatherForZip(obj.zip), 400);
    }
  } catch (e) {}
}

function showShareToast() {
  const t = $('shareToast'); if (!t) return;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

$('shareBtn').addEventListener('click', () => {
  const url = buildShareURL();
  history.replaceState(null, '', url);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(showShareToast).catch(showShareToast);
  } else {
    const inp = document.createElement('input'); inp.value = url;
    document.body.appendChild(inp); inp.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(inp); showShareToast();
  }
});

loadShareURL();

// ─── ATMOSPHERE SLIDERS ──────────────────────────────────────
['warmth', 'wind', 'wetness', 'storm', 'brightness'].forEach(k => {
  const sl = $(`${k}Slider`);
  if (!sl) return;
  sl.addEventListener('input', updateSliderLabels);
  sl.addEventListener('input', () => {
    if (appState.currentAudio) {
      clearTimeout(sl._d);
      sl._d = setTimeout(() => { appState.usingManualState = true; applyManual(); }, 300);
    }
  });
});

// ─── FX SLIDERS ──────────────────────────────────────────────
['fxReverb', 'fxDelay', 'fxFilter', 'fxDrive', 'fxMelody', 'fxHarmony', 'fxSwing', 'fxCrush', 'fxDrift', 'fxWah', 'fxChorus', 'fxFuzz'].forEach(id => {
  const el = $(id), valEl = $(id + 'Val');
  if (el && valEl) el.addEventListener('input', () => { valEl.textContent = parseFloat(el.value).toFixed(2); applyLiveFx(); });
});

// ─── VOLUME KNOB ─────────────────────────────────────────────
const volKnob = $('volKnob');
const volMarker = $('volMarker');
function updateVolKnob() {
  if (!volKnob || !volMarker) return;
  const deg = -135 + parseFloat(volKnob.value) * 270;
  volMarker.style.transform = `translateX(-50%) rotate(${deg}deg)`;
  const volLabel = $('volLabel'); if (volLabel) volLabel.textContent = Math.round(parseFloat(volKnob.value) * 100);
}
if (volKnob) { volKnob.addEventListener('input', () => { updateVolKnob(); applyLiveFx(); }); updateVolKnob(); }

// ─── SYNC ZIP INPUTS ─────────────────────────────────────────
const zi1 = $('zipInput'), zi2 = $('zipInput2');
if (zi1 && zi2) {
  zi1.addEventListener('input', () => zi2.value = zi1.value);
  zi2.addEventListener('input', () => zi1.value = zi2.value);
}

// ─── KEYBOARD DRUM PADS ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  const idx = parseInt(e.key) - 1;
  if (isNaN(idx) || idx < 0 || idx > 7) return;
  e.preventDefault();
  const pad = document.querySelector(`.drum-pad[data-pad="${idx}"]`);
  hitPad(idx, pad);
});

// ─── ONBOARDING ──────────────────────────────────────────────
(function () {
  const overlay = $('obOverlay');
  const closeBtn = $('obClose');
  if (!overlay) return;
  function dismiss() {
    overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }
  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  overlay.style.transition = 'opacity 0.3s';
})();

// ─── SKIN SWITCHER ───────────────────────────────────────────
export function setSkin(skin) {
  document.body.setAttribute('data-skin', skin);
  document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
  const active = $('skinBtnDefault');
  if (active) active.classList.add('active');
  if (skin === 'brutal') {
    if (appState.currentState) updateHvViz(appState.currentState);
  } else {
    stopHvAnim();
    const el = document.getElementById('hvViz');
    if (el) el.innerHTML = '';
  }
}
window.setSkin = setSkin;

// ─── FX SCROLL SAFEGUARD ─────────────────────────────────────
document.querySelectorAll('.fx-grid input[type="range"]').forEach(el => {
  el.addEventListener('wheel', e => { e.preventDefault(); }, { passive: false });
});

// ─── INIT ────────────────────────────────────────────────────
document.body.setAttribute('data-skin', 'brutal');
const _hb = document.getElementById('skinBtnDefault');
if (_hb) { document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active')); _hb.classList.add('active'); }
updateSliderLabels();

// Store pulseDot reference in state
appState.pulseDot = $('pulseDot');

loadWeatherForZip('10033');
