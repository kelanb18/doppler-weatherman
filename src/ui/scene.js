// ─── WEATHER SCENE + VISUALIZER ──────────────────────────────
import { $, setBar } from '../utils.js';
import { appState } from '../state.js';
import { updateHvViz } from './canvas.js';

export function getSkyGradient(s, w) {
  if (document.body.getAttribute('data-skin') === 'brutal') {
    if (!s.isDaytime) return s.isStormy
      ? 'linear-gradient(180deg,#00100A,#001E12)'
      : 'linear-gradient(180deg,#05001E,#0E0038)';
    const _n = new Date(), _sr = w ? new Date(w.sunrise) : new Date(), _ss = w ? new Date(w.sunset) : new Date();
    const _p = Math.max(0, Math.min(1, (_n - _sr) / (_ss - _sr)));
    if (_p < 0.12) return 'linear-gradient(180deg,#1C0018,#360010)';
    if (_p < 0.25) return 'linear-gradient(180deg,#0A001E,#1A000E)';
    if (_p > 0.88) return 'linear-gradient(180deg,#180010,#2C001E)';
    if (_p > 0.78) return 'linear-gradient(180deg,#0E0008,#1E0016)';
    if (s.isStormy) return 'linear-gradient(180deg,#001608,#002C12)';
    if (s.isCloudy) return 'linear-gradient(180deg,#03000E,#09001C)';
    if (s.isRaining) return 'linear-gradient(180deg,#00040C,#00081C)';
    if (s.isSnowing) return 'linear-gradient(180deg,#04000E,#0A001A)';
    if (s.isFoggy) return 'linear-gradient(180deg,#0E0A00,#1C1600)';
    if (s.isSunny) return 'linear-gradient(180deg,#040018,#0C002E)';
    return 'linear-gradient(180deg,#04000E,#0C0022)';
  }
  if (!s.isDaytime) return s.isStormy
    ? 'linear-gradient(180deg,#0A0814,#1A1428)'
    : 'linear-gradient(180deg,#040812,#0E1830)';
  const now = new Date();
  const sunrise = w ? new Date(w.sunrise) : new Date();
  const sunset = w ? new Date(w.sunset) : new Date();
  const pos = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
  if (pos < 0.12) return 'linear-gradient(180deg,#1A1040,#FF6B35)';
  if (pos < 0.25) return 'linear-gradient(180deg,#2A4080,#F5A623)';
  if (pos > 0.88) return 'linear-gradient(180deg,#1A1040,#FF4500)';
  if (pos > 0.78) return 'linear-gradient(180deg,#2A3870,#E8760A)';
  if (s.isStormy) return 'linear-gradient(180deg,#1A2030,#354060)';
  if (s.isCloudy) return 'linear-gradient(180deg,#4A5868,#788898)';
  if (s.isRaining) return 'linear-gradient(180deg,#1E2830,#384858)';
  if (s.isSnowing) return 'linear-gradient(180deg,#2A3040,#505870)';
  if (s.isFoggy) return 'linear-gradient(180deg,#3A4450,#687480)';
  if (s.isSunny) return 'linear-gradient(180deg,#1A6CB5,#5BB0F0)';
  return 'linear-gradient(180deg,#2A5090,#4A90D0)';
}

export function getTerrainSVG(key, color, waterColor) {
  const t = {
    coastal: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><rect x="0" y="50" width="800" height="30" fill="${color}"/><path d="M0,50 Q100,40 200,50 Q300,60 400,48 Q500,38 600,50 Q700,58 800,46 L800,80 L0,80 Z" fill="${waterColor}" opacity="0.6"/></svg>`,
    beach: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,60 Q200,50 400,55 Q600,60 800,50 L800,80 L0,80 Z" fill="${color}"/><path d="M0,65 Q200,57 400,62 Q600,68 800,58 L800,80 L0,80 Z" fill="${waterColor}" opacity="0.6"/></svg>`,
    mountains: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><polygon points="0,80 60,30 120,80" fill="${color}" opacity="0.7"/><polygon points="80,80 160,15 240,80" fill="${color}" opacity="0.85"/><polygon points="180,80 260,25 340,80" fill="${color}" opacity="0.75"/><polygon points="300,80 380,10 460,80" fill="${color}"/><polygon points="420,80 500,20 580,80" fill="${color}" opacity="0.9"/><polygon points="540,80 620,30 700,80" fill="${color}" opacity="0.8"/><polygon points="660,80 740,18 800,60 800,80" fill="${color}" opacity="0.85"/><polygon points="152,20 160,10 168,20" fill="white" opacity="0.5"/><polygon points="372,16 380,5 388,16" fill="white" opacity="0.45"/></svg>`,
    desert: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,65 Q100,60 200,63 Q300,66 400,62 Q500,58 600,64 Q700,68 800,62 L800,80 L0,80 Z" fill="${color}"/><rect x="80" y="48" width="5" height="20" fill="${color}" opacity="0.8"/><rect x="72" y="54" width="8" height="4" fill="${color}" opacity="0.8"/><rect x="500" y="55" width="120" height="12" fill="${color}" opacity="0.5"/></svg>`,
    hills: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,80 Q100,50 200,60 Q300,70 400,52 Q500,40 600,58 Q700,68 800,55 L800,80 Z" fill="${color}"/></svg>`,
    flat: `<svg viewBox="0 0 800 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><rect x="0" y="65" width="800" height="15" fill="${color}"/></svg>`,
  };
  return t[key] || t.flat;
}

const CITY_DATA = {
  'new york': { terrain: 'coastal' }, 'manhattan': { terrain: 'coastal' }, 'brooklyn': { terrain: 'coastal' },
  'los angeles': { terrain: 'coastal' }, 'beverly hills': { terrain: 'coastal' }, 'santa monica': { terrain: 'beach' },
  'long beach': { terrain: 'beach' }, 'hollywood': { terrain: 'hills' }, 'malibu': { terrain: 'beach' },
  'chicago': { terrain: 'flat' }, 'miami': { terrain: 'beach' }, 'fort lauderdale': { terrain: 'beach' },
  'san francisco': { terrain: 'coastal' }, 'oakland': { terrain: 'coastal' }, 'berkeley': { terrain: 'coastal' },
  'seattle': { terrain: 'mountains' }, 'bellevue': { terrain: 'mountains' },
  'denver': { terrain: 'mountains' }, 'boulder': { terrain: 'mountains' }, 'salt lake': { terrain: 'mountains' },
  'portland': { terrain: 'mountains' }, 'houston': { terrain: 'flat' }, 'dallas': { terrain: 'flat' },
  'austin': { terrain: 'hills' }, 'boston': { terrain: 'coastal' }, 'las vegas': { terrain: 'desert' },
  'phoenix': { terrain: 'desert' }, 'scottsdale': { terrain: 'desert' }, 'nashville': { terrain: 'hills' },
  'atlanta': { terrain: 'flat' }, 'new orleans': { terrain: 'coastal' }, 'san diego': { terrain: 'beach' },
  'honolulu': { terrain: 'beach' }, 'pittsburgh': { terrain: 'hills' },
};

export function getCityProfile(locationName, lat, lon) {
  if (locationName) {
    const l = locationName.toLowerCase();
    for (const k of Object.keys(CITY_DATA)) { if (l.includes(k)) return CITY_DATA[k]; }
  }
  if (lat && lon) {
    if (lat < 27 && lon > -82) return { terrain: 'beach' };
    if (lon < -104 && lon > -125 && lat > 35 && lat < 50) return { terrain: 'mountains' };
    if (lon < -104 && lat < 37) return { terrain: 'desert' };
    if ((lon > -80 && lon < -65) || (lon < -115 && lon > -125)) return { terrain: 'coastal' };
    if (lon > -100 && lon < -80 && lat > 36 && lat < 50) return { terrain: 'flat' };
  }
  return { terrain: 'flat' };
}

export function startLightning(s) {
  if (appState.lightningTimer) { clearInterval(appState.lightningTimer); appState.lightningTimer = null; }
  if (!s.isStormy) return;
  const layer = $('lightningLayer');
  appState.lightningTimer = setInterval(() => {
    if (Math.random() > (0.3 + s.storm * 0.4)) return;
    const bolt = document.createElement('div'); bolt.className = 'lightning-bolt';
    const x = 10 + Math.random() * 80;
    bolt.style.cssText = `left:${x}%;top:10%;width:2px;height:${60 + Math.random() * 100}px;background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(180,160,255,0.4));box-shadow:0 0 8px rgba(255,255,255,0.8);clip-path:polygon(40% 0%,60% 0%,55% 45%,75% 45%,25% 100%,40% 55%,20% 55%);`;
    layer.appendChild(bolt);
    const sl = $('skyLayer'); sl.style.filter = 'brightness(2.5)';
    setTimeout(() => { sl.style.filter = ''; bolt.remove(); }, 200);
  }, 1800 + Math.random() * 2000);
}

export function updateInstrumentReadout(s) {
  const tempo = s.tempo;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('tempoValueBig', tempo);
  set('hudBpm', `${tempo} BPM`);
  set('tempoReadout', `${tempo} BPM`);
  const genreLabel = (s.genre || s.harmony).toUpperCase();
  set('harmonyValue', genreLabel);
  set('harmonyReadout', genreLabel);
  const hb = $('harmonyBadge');
  if (hb) { hb.textContent = genreLabel; hb.className = `hud-badge ${s.harmony} genre-${s.genre || 'electronic'}`; }
  const pulse = s.storm > 0.55 ? 'RESTLESS' : s.wind > 0.55 ? 'MOVING' : 'CALM';
  set('pulseValue', pulse); set('pulseReadout', pulse);
  set('modeValue', s.source === 'manual' ? 'MANUAL' : 'WEATHER');
  set('modeReadout', s.source === 'manual' ? 'MANUAL' : 'WEATHER');
  const esEl = $('engineStatus');
  if (esEl) {
    esEl.textContent = appState.currentAudio ? 'RUNNING' : 'IDLE';
    esEl.style.color = appState.currentAudio ? 'var(--green)' : '#4A4840';
  }
}

export function updateVisualizer(s) {
  const skyLayer = $('skyLayer'), starLayer = $('starLayer'), fogLayer = $('fogLayer');
  const cloudLayer = $('cloudLayer'), windLayer = $('windLayer'), precipLayer = $('precipLayer');
  const terrainLayer = $('terrainLayer');
  cloudLayer.innerHTML = ''; windLayer.innerHTML = ''; precipLayer.innerHTML = '';
  starLayer.innerHTML = ''; fogLayer.innerHTML = '';

  skyLayer.style.background = getSkyGradient(s, appState.currentWeather);

  // Stars at night
  if (!s.isDaytime && !s.isStormy) {
    const n = s.isCloudy ? 15 : 55;
    for (let i = 0; i < n; i++) {
      const st = document.createElement('div'); st.className = 'star';
      const sz = 0.5 + Math.random() * 2;
      st.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;top:${Math.random() * 65}%;animation-duration:${2 + Math.random() * 4}s;animation-delay:${-Math.random() * 4}s;`;
      starLayer.appendChild(st);
    }
  }

  // Sun/moon glow
  const sg = $('skyGlow');
  if (document.body.getAttribute('data-skin') === 'brutal') {
    sg.style.background = s.isDaytime && s.isSunny
      ? 'radial-gradient(circle,rgba(255,220,0,0.95),rgba(255,120,0,0.3),transparent 70%)'
      : s.isDaytime
      ? 'radial-gradient(circle,rgba(180,140,255,0.5),rgba(80,40,200,0.15),transparent 70%)'
      : 'radial-gradient(circle,rgba(210,180,255,0.65),rgba(120,80,220,0.25),transparent 70%)';
  } else {
    sg.style.background = s.isDaytime && s.isSunny
      ? 'radial-gradient(circle,rgba(255,230,100,1),rgba(255,180,40,0.4),transparent 70%)'
      : s.isDaytime
      ? 'radial-gradient(circle,rgba(220,230,255,0.5),rgba(180,200,240,0.15),transparent 70%)'
      : 'radial-gradient(circle,rgba(230,240,255,0.4),rgba(180,200,255,0.15),transparent 70%)';
  }
  sg.style.width = sg.style.height = `${100 + s.brightness * 120}px`;
  sg.style.top = s.isDaytime ? '30px' : '20px';
  sg.style.opacity = Math.max(0.2, s.brightness);

  // Clouds
  const cc = s.isStormy ? 8 : s.isCloudy || s.isRaining || s.isSnowing ? 6 : s.isSunny ? 1 : 3;
  for (let i = 0; i < cc; i++) {
    const c = document.createElement('div'); c.className = 'cloud';
    c.style.cssText = `width:${80 + Math.random() * 160}px;height:${18 + Math.random() * 36}px;top:${15 + Math.random() * 100}px;left:${-160 - Math.random() * 100}px;animation-duration:${14 + Math.random() * 22}s;animation-delay:${-Math.random() * 16}s;opacity:${s.isStormy ? '0.22' : s.isFoggy ? '0.35' : '0.10'};`;
    cloudLayer.appendChild(c);
  }

  // Wind lines
  for (let i = 0; i < Math.max(1, Math.round(s.wind * 16)); i++) {
    const l = document.createElement('div'); l.className = 'wind-line';
    l.style.cssText = `width:${28 + Math.random() * 130}px;top:${30 + Math.random() * 220}px;animation-duration:${2.2 - s.wind * 1.2 + Math.random() * 1}s;animation-delay:${-Math.random() * 3}s;opacity:${0.1 + s.wind * 0.4};`;
    windLayer.appendChild(l);
  }

  // Precip
  if (s.isRaining) {
    const n = Math.round(20 + s.wetness * 40 + s.wind * 15 + s.storm * 10);
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div'); d.className = 'drop';
      const heavy = s.storm > 0.5;
      d.style.cssText = `height:${heavy ? 14 + Math.random() * 10 : 6 + Math.random() * 10}px;width:${heavy ? '2px' : '1px'};left:${Math.random() * 110 - 5}%;top:${-40 - Math.random() * 280}px;animation-duration:${heavy ? 0.4 + Math.random() * 0.3 : 0.7 + Math.random() * 0.7}s;animation-delay:${-Math.random() * 2}s;`;
      precipLayer.appendChild(d);
    }
  } else if (s.isSnowing) {
    for (let i = 0; i < Math.round(20 + s.wetness * 20); i++) {
      const f = document.createElement('div'); f.className = 'snow';
      f.style.cssText = `width:${2 + Math.random() * 4}px;height:${2 + Math.random() * 4}px;left:${Math.random() * 100}%;top:${-30 - Math.random() * 280}px;animation-duration:${3 + Math.random() * 5}s;animation-delay:${-Math.random() * 6}s;`;
      precipLayer.appendChild(f);
    }
  }

  // Fog
  if (s.isFoggy || (s.wetness > 0.6 && !s.isDaytime)) {
    for (let i = 0; i < 6; i++) {
      const fb = document.createElement('div'); fb.className = 'fog-bank';
      fb.style.cssText = `width:${300 + Math.random() * 400}px;height:${80 + Math.random() * 100}px;bottom:${20 + Math.random() * 120}px;left:${Math.random() * 80}%;animation-duration:${40 + Math.random() * 40}s;animation-delay:${-Math.random() * 30}s;`;
      fogLayer.appendChild(fb);
    }
  }

  // Terrain
  const profile = getCityProfile(appState.currentWeather?.location, appState.currentWeather?.lat, appState.currentWeather?.lon);
  const isNight = !s.isDaytime;
  const _isBrutal = document.body.getAttribute('data-skin') === 'brutal';
  const tc = _isBrutal ? (isNight ? '#0C001A' : '#001410') : isNight ? '#080A0C' : '#141820';
  const wc = _isBrutal ? (isNight ? '#06001E' : '#001828') : isNight ? '#0A1428' : '#1A3050';
  terrainLayer.innerHTML = getTerrainSVG(profile.terrain, tc, wc);

  startLightning(s);

  setBar('warmthBar', s.warmth, 'var(--orange)');
  setBar('windBar', s.wind, 'var(--teal)');
  setBar('wetnessBar', s.wetness, '#5B8FD6');
  setBar('stormBar', s.storm, 'var(--purple)');
  setBar('brightnessBar', s.brightness, 'var(--yellow)');

  updateInstrumentReadout(s);
  if (document.body.getAttribute('data-skin') === 'brutal') updateHvViz(s);
}
