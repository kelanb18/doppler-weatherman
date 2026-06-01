// ─── WEATHER INTERPRETATION ──────────────────────────────────
import { $, clamp } from '../utils.js';

export function weatherCodeToLabel(code) {
  const m = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm+hail', 99: 'Severe thunderstorm',
  };
  return m[code] || 'Unknown';
}

export function computeTempo(s) {
  const base = Math.round(62 + (s.wind * 0.42 + s.wetness * 0.22 + s.storm * 0.36) * 64);
  if (!s.genreWeights) return base;
  const gw = s.genreWeights;
  const offset = gw.industrial * 16 + gw.ambient * (-22) + gw.classical * (-12) +
    gw.tropical * 14 + gw.jazz * (-3) + gw.lofi * (-9);
  return Math.round(clamp(base + offset, 50, 152));
}

export function computeHarmony(s) {
  if (s.storm > 0.55 || (s.warmth < 0.25 && s.brightness < 0.3)) return 'minor';
  if (s.storm > 0.45 || s.warmth < 0.28) return 'minor';
  if (s.warmth >= 0.38 && s.brightness >= 0.5) return 'major';
  if (s.warmth >= 0.5 && s.storm < 0.3) return 'major';
  if (s.wetness > 0.5 && s.warmth < 0.5) return 'minor';
  return 'major';
}

export function computeGenreWeights(s) {
  const night = s.isDaytime ? 0.08 : 0.82;
  const w = {
    industrial: Math.pow(clamp(s.storm, 0, 1), 1.0) * 0.92 + Math.max(0, 0.4 - s.warmth) * 0.08,
    ambient: Math.pow(clamp(1 - s.brightness, 0, 1), 2.2) * 0.38 +
      clamp(s.wetness * (1 - s.storm) * 0.6, 0, 1) * 0.22 + clamp(0.55 - s.wind, 0, 1) * 0.10,
    classical: clamp(s.wetness - 0.05, 0, 1) * clamp(0.55 - s.warmth, 0, 1) * 2.4 *
      clamp(1 - s.storm * 2.2, 0, 1),
    tropical: s.warmth * s.brightness * clamp(s.wetness * 1.8 + 0.08, 0, 1) *
      clamp(s.wind * 1.0 + 0.3, 0, 1),
    jazz: night * clamp(1 - s.storm * 2, 0, 1) * (0.30 + s.warmth * 0.70),
    lofi: clamp(s.wetness * 0.9, 0, 1) * clamp(1 - s.storm * 1.5, 0, 1) *
      clamp(1 - s.brightness * 1.1, 0, 1) * 1.2,
    electronic: 0.22 + clamp((s.warmth - 0.5) * 0.4 * (1 - Math.min(s.wetness * 2, 1)), 0, 0.3),
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  Object.keys(w).forEach(k => w[k] = Math.max(0, w[k]) / total);
  return w;
}

export function computeGenre(s) {
  if (!s.genreWeights) return 'electronic';
  return Object.entries(s.genreWeights).sort((a, b) => b[1] - a[1])[0][0];
}

export function computeTimeSignature(s) {
  if (s.isStormy || s.storm > 0.65) return {
    steps: 20, name: '5/4',
    kickOn: [0, 12, 14], snareOn: [8, 16], ghostOn: [2, 5, 10, 18],
    hatOn: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], openHatOn: [6, 14], accentHat: [0, 8, 12],
  };
  if (s.isSnowing) return {
    steps: 12, name: '6/8',
    kickOn: [0, 6], snareOn: [4, 10], ghostOn: [2, 8],
    hatOn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], openHatOn: [3, 9], accentHat: [0, 6],
  };
  if (s.isRaining && s.wetness > 0.6) return {
    steps: 14, name: '7/8',
    kickOn: [0, 8, 11], snareOn: [4, 11], ghostOn: [2, 6, 13],
    hatOn: [0, 2, 4, 6, 8, 10, 12], openHatOn: [4, 12], accentHat: [0, 8],
  };
  if (s.isFoggy || (!s.isDaytime && s.brightness < 0.2)) return {
    steps: 12, name: '3/4',
    kickOn: [0, 9], snareOn: [4, 8], ghostOn: [2, 6, 10],
    hatOn: [0, 2, 4, 6, 8, 10], openHatOn: [4, 10], accentHat: [0],
  };
  if (s.isSunny && s.warmth > 0.65) return {
    steps: 16, name: '4/4',
    kickOn: [0, 8, 10], snareOn: [4, 12], ghostOn: [2, 6, 14],
    hatOn: [0, 2, 4, 6, 8, 10, 12, 14], openHatOn: [6, 14], accentHat: [0, 4, 8, 12],
  };
  if (s.wind > 0.65) return {
    steps: 20, name: '5/4',
    kickOn: [0, 10, 13], snareOn: [5, 15], ghostOn: [3, 7, 13, 17],
    hatOn: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], openHatOn: [4, 14], accentHat: [0, 10],
  };
  return {
    steps: 16, name: '4/4',
    kickOn: [0, 8, 11], snareOn: [4, 12], ghostOn: [2, 6, 14],
    hatOn: [0, 2, 4, 6, 8, 10, 12, 14], openHatOn: [6, 14], accentHat: [0, 4, 8, 12],
  };
}

export function interpretWeather(w) {
  const now = new Date(), sunrise = new Date(w.sunrise), sunset = new Date(w.sunset);
  const isDaytime = now >= sunrise && now <= sunset, code = w.weatherCode;
  const isRainCode = [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
  const isSnowCode = [71, 73, 75, 77, 85, 86].includes(code);
  const isStormCode = [95, 96, 99].includes(code);
  const isFogCode = [45, 48].includes(code);
  const isCloudyCode = [2, 3].includes(code);
  const isSunnyCode = [0, 1].includes(code);
  const isRaining = w.precipitation > 0.05 && isRainCode;
  const isSnowing = w.precipitation > 0.05 && isSnowCode;
  const isStormy = isStormCode || (w.wind >= 28 && w.precipitation > 0.4);
  const warmth = clamp((w.temp + 5) / 35, 0, 1);
  const wind = clamp(w.wind / 40, 0, 1);
  const wetness = clamp((w.humidity / 100) * 0.45 + w.precipitation * 0.55, 0, 1);
  const storm = clamp((isStormy ? 0.7 : 0) + w.wind / 70 + w.precipitation / 8, 0, 1);
  let brightness = isDaytime ? 0.75 : 0.22;
  if (isSunnyCode) brightness += 0.18;
  if (isCloudyCode) brightness -= 0.12;
  if (isFogCode) brightness -= 0.18;
  if (isRaining || isSnowing) brightness -= 0.08;
  if (isStormy) brightness -= 0.18;
  brightness = clamp(brightness, 0.08, 1);
  const s = { warmth, wind, wetness, storm, brightness };
  const base = {
    ...s, isDaytime, isRaining, isSnowing, isStormy, isFoggy: isFogCode,
    isSunny: isSunnyCode, isCloudy: isCloudyCode, label: weatherCodeToLabel(code), source: 'weather',
  };
  base.genreWeights = computeGenreWeights(base);
  base.genre = computeGenre(base);
  base.tempo = computeTempo(base);
  base.harmony = computeHarmony(base);
  return base;
}

export function stateFromSliders() {
  const s = {
    warmth: parseFloat($('warmthSlider').value),
    wind: parseFloat($('windSlider').value),
    wetness: parseFloat($('wetnessSlider').value),
    storm: parseFloat($('stormSlider').value),
    brightness: parseFloat($('brightnessSlider').value),
  };
  s.tempo = computeTempo(s);
  s.harmony = computeHarmony(s);
  s.isDaytime = s.brightness >= 0.5;
  s.isRaining = s.wetness >= 0.48 && s.storm < 0.75;
  s.isSnowing = s.wetness >= 0.45 && s.warmth < 0.28 && s.storm < 0.55;
  s.isStormy = s.storm >= 0.55;
  s.isFoggy = s.brightness < 0.32 && s.wetness > 0.45 && !s.isStormy;
  s.isSunny = s.brightness > 0.7 && s.warmth > 0.58 && s.wetness < 0.45;
  s.isCloudy = !s.isSunny && !s.isStormy && s.brightness < 0.65;
  if (s.isStormy) s.label = 'Manual storm';
  else if (s.isSnowing) s.label = 'Manual snow';
  else if (s.isRaining) s.label = 'Manual rain';
  else if (s.isSunny) s.label = 'Manual sun';
  else if (s.isFoggy) s.label = 'Manual fog';
  else s.label = 'Manual atmosphere';
  s.source = 'manual';
  s.genreWeights = computeGenreWeights(s);
  s.genre = computeGenre(s);
  return s;
}

export function updateSliderLabels() {
  ['warmth', 'wind', 'wetness', 'storm', 'brightness'].forEach(k => {
    const el = $(`${k}Slider`);
    if (el) $(`${k}SliderValue`).textContent = parseFloat(el.value).toFixed(2);
  });
}

export function syncSlidersToState(s) {
  $('warmthSlider').value = s.warmth.toFixed(2);
  $('windSlider').value = s.wind.toFixed(2);
  $('wetnessSlider').value = s.wetness.toFixed(2);
  $('stormSlider').value = s.storm.toFixed(2);
  $('brightnessSlider').value = s.brightness.toFixed(2);
  updateSliderLabels();
}
