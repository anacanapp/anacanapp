# App Store screenshots

Nine 1290×2796 (iPhone 6.7") store images in the app's own design: the phone screens use
`src/styles/anacan-design.css` and the app's real assets (fetus illustrations, companions).
All text comes from `copy/<lang>.json`; add a language by copying `az.json` and translating it.

```
CHROMIUM_PATH=/path/to/chrome node scripts/store-screenshots/render.mjs az [outDir]
```

`CHROMIUM_PATH` is only needed when the project's Playwright has no downloaded browser.
Output defaults to `scripts/store-screenshots/out/<lang>/` (ignored by Git).
Fonts (Inter) and icons (lucide) load from Google Fonts and unpkg at render time.
