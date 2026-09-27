# Doppler Weatherman

Single-file generative weather music synthesizer — `/home/user/doppler-weatherman/index.html`

## Live site
https://kelanb18.github.io/doppler-weatherman/

## Deployment
- Changes to `main` branch deploy automatically via GitHub Pages
- Push feature branch commits then push to main:
  ```
  git push -u origin claude/install-frontend-design-plugin-BFsLY
  git push origin claude/install-frontend-design-plugin-BFsLY:main
  ```

## Tech stack
- Vanilla HTML/CSS/JS, no build step
- Web Audio API for all synthesis
- Single file: `index.html`

## Key architecture
- `playWeatherSoundscape(state)` — main audio engine, sets up the full signal chain
- `computeGenreWeights(s)` — maps weather to 4 genres: ambient, lofi, electronic, industrial
- `buildPad(ch)` — voice-leading pad synthesis (glides voices on chord changes)
- `playMelodyNote()` — cell-based Q/A melody sequencer
- `BL[0-7]` — 8 Jamerson-style bass patterns selected by genre
- `startHvAnim()` — radar visualization with polar oscilloscope ring, step dots
- `liveSheetData` — shared state for chord names, root, mode (exposed as `window.liveSheetData`)

## JS syntax check
```
python3 -c "import re; f=open('index.html').read(); scripts=re.findall(r'<script[^>]*>(.*?)</script>',f,re.DOTALL); open('/tmp/jscheck.js','w').write('\n'.join(scripts))" && node --check /tmp/jscheck.js
```
