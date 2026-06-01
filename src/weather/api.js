// ─── WEATHER API ─────────────────────────────────────────────
import { $, setStatus, formatTime } from '../utils.js';
import { appState } from '../state.js';
import { interpretWeather, syncSlidersToState } from './interpret.js';
import { updateVisualizer } from '../ui/scene.js';

export async function loadWeatherForZip(zip) {
  zip = zip || $('zipInput').value.trim();
  if (!zip) { setStatus('Enter a ZIP code.'); return; }

  // Import stop lazily to avoid circular — controls calls stop() directly
  const { stop } = await import('../audio/engine.js');
  stop();
  setStatus('Resolving location...');

  try {
    const zr = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!zr.ok) throw new Error('ZIP not found.');
    const zd = await zr.json(), pl = zd.places[0];
    const lat = parseFloat(pl.latitude), lon = parseFloat(pl.longitude);
    const placeName = `${pl['place name']}, ${pl['state abbreviation']}`;
    setStatus('Fetching weather...');
    const wr = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation,weather_code` +
      `&daily=sunrise,sunset&timezone=auto`
    );
    if (!wr.ok) throw new Error('Weather fetch failed.');
    const wd = await wr.json();
    appState.currentWeather = {
      zip, location: placeName, lat, lon,
      temp: wd.current.temperature_2m,
      wind: wd.current.wind_speed_10m,
      humidity: wd.current.relative_humidity_2m,
      precipitation: wd.current.precipitation,
      weatherCode: wd.current.weather_code,
      sunrise: wd.daily.sunrise[0],
      sunset: wd.daily.sunset[0],
    };
    appState.usingManualState = false;
    appState.currentState = interpretWeather(appState.currentWeather);
    updateWeatherDisplay(appState.currentWeather, appState.currentState);
    syncSlidersToState(appState.currentState);
    updateVisualizer(appState.currentState);
    setStatus(`${placeName} — ready. Press ▶ Play`);
    // sync both zip inputs
    const zi = $('zipInput'), zi2 = $('zipInput2');
    if (zi) zi.value = zip;
    if (zi2) zi2.value = zip;
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
}

export function updateWeatherDisplay(w, s) {
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('locationValue', w.location);
  set('conditionValue', s.label);
  set('tempValue', `${Math.round(w.temp * 9 / 5 + 32)}°F`);
  set('tempMoodValue', s.harmony === 'major' ? 'warm/bright' : s.harmony === 'minor' ? 'cool/dark' : 'neutral');
  set('windValue', `${Math.round(w.wind * 0.621371)} mph`);
  set('humidityValue', `${w.humidity}%`);
  set('precipValue', `${w.precipitation} mm`);
  set('sunriseValue', formatTime(w.sunrise));
  set('sunsetValue', formatTime(w.sunset));
  set('hudCoords', `${w.lat.toFixed(3)}, ${w.lon.toFixed(3)}`);
}
