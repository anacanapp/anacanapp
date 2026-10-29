# App Store screenshots

Nine 1290×2796 (iPhone 6.7") store images. The phone screens are **real app screens**: the app runs
from the local dev server and is driven by Playwright; user rows (profile, logs, appointments,
community posts, the AI answer) are fixtures, public content (tips, articles, tool list) is read from
the live API with the public anon key. No real user data is shown and nothing is written.

1. Dev server in native mode (needs `.env.google`):
   `VITE_NATIVE_BUILD=true npx vite --mode google --port 5181 --strictPort --host 127.0.0.1`
2. Capture the nine screens (390×863, @3x) into `shots/az/`:
   `CHROMIUM_PATH=/path/to/chrome scripts/store-screenshots/real-app/capture.sh`
3. Compose the slides into `out/az/`:
   `SHOTS_DIR=scripts/store-screenshots/shots/az CHROMIUM_PATH=/path/to/chrome node scripts/store-screenshots/render.mjs az`

Slide texts and feature chips: `copy/<lang>.json`. Scenario data and demo texts:
`real-app/build_fixtures.py`. Screen choice and scroll positions: `real-app/capture.sh`.
For another language set the user store language in the fixtures and translate the demo texts.
`CHROMIUM_PATH` is only needed when the project's Playwright has no downloaded browser.
`shots/`, `out/` and `real-app/scenarios/` are generated and ignored by Git.
