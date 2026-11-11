# Anacan reels (Remotion + anime.js + dotLottie)

Separate package (not part of the app build). Every video is a React composition; anime.js timelines are seeked to
Remotion's frame and dotLottie is frame-locked, so renders are deterministic.

```
cd marketing/reels && npm ci
cp node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm public/
npx remotion render src/index.ts PancakeAz out/anacan-pancake-az.mp4 --codec=h264 --crf=18
# in a cloud container: add --browser-executable=/opt/pw-browsers/chromium
```

- `src/PancakeReel.tsx`: "Şəkərsiz körpə pancake-i" (34.5 s, 1080x1920, no audio yet).
- `src/copy.ts`: on-screen text per language (add ru/kk/uz/tr for market versions).
- `src/lottie.ts`: hand-authored Lottie JSON (sparkles, steam, check); `src/art.tsx`: SVG illustrations.
- Voice-over: planned with ElevenLabs (`@remotion/elevenlabs` is installed); music is added in Instagram.
