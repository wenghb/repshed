# RepShed 🎵

**Master any song, one loop at a time.**

Free online music practice tool — loop sections, slow down without pitch change, progressive speed training. Works with any instrument.

🔗 **Live:** [repshed.com](https://repshed.com)

## Features

- 🔁 **A-B Loop** — Select any section to repeat
- 🐌 **Speed Control** — 0.1× to 2× without pitch change
- 📊 **Waveform Visualization** — Scrollable viewport with minimap
- 🔔 **Count-in** — Beeps before loop restart
- 🎯 **Fine Adjust** — ±0.1s precision on loop boundaries
- ⌨️ **Keyboard Shortcuts** — Space, [, ], L, ←→, +/-
- 📱 **Touch Support** — iPad/mobile friendly
- 🔒 **Privacy** — All processing in-browser, no uploads

## Tech Stack

- Pure HTML/CSS/JS (no framework)
- Web Audio API for decoding & playback
- Canvas for waveform rendering
- Hosted on Cloudflare Pages

## Development

```bash
# Local preview — any static server works
npx serve .
# or
python3 -m http.server 8080
```

## Roadmap

- [ ] Progressive Speed Trainer (auto tempo increase)
- [ ] Pitch shift (transpose)
- [ ] Bookmarks / section markers
- [ ] Multiple saved loops
- [ ] localStorage persistence
- [ ] PWA offline support

## License

MIT
