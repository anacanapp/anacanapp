# Recap feature (`registerRecapFeature`)

| React | Dart |
|---|---|
| components/recap/RecapScreen.tsx | recap_screen.dart (`RecapScreen`, `RecapFramePainter`) |
| hooks/useRecap.ts, RecapEntry.tsx `useRecapProfileRow` | use_recap.dart (`recapQuery`, `recapProvider`, `recapProfileRowFromRecapProvider`, `RecapHomeYearNotifier`) |
| lib/recap/render.ts | recap_render.dart (`renderRecapFrame`, `sceneIndexAt`, `summaryStillTime`) on recap_canvas.dart (Canvas 2D subset over dart:ui) |
| lib/recap/anim.ts | recap_anim.dart |
| lib/recap/export.ts | recap_export.dart (assets, grain, PNG, share, `RecapVideoEncoder` seam) |
| lib/recap/fonts.ts, font-loader.ts | recap_fonts.dart (families + `recapTextSample`; no FontFace step) |
| lib/recap/recap-i18n.ts | recap_i18n.dart (`rt`) |
| RecapScreen `<audio>` | recap_audio.dart (`RecapAudio` seam, silent default) |
| model / numbers / pace / persona / types / copy / window | already in `lib/domain/recap/` |

Registered: screen `recap`. Analytics: `recap_opened`, `recap_completed`, `recap_exported`, `recap_shared` via `analyticsSinkProvider`.
Query key: `['anacan-recap', backendUrl, uid, year]` (React). Label queries use own keys
`['recap-tool-labels', lang]` / `['recap-symptom-labels', lang]`; milestones reuse the baby feature's `['baby-milestones-db', lang]`.

Tests: `test/features/recap/` — `render_log.json.gz` holds the drawing calls of the TypeScript renderer for 89 frames
(regenerate with `npx tsx app/test/features/recap/fixtures/gen_render_log.ts` from the repo root).

## Needed outside this folder
- Assets: `assets/recap/recap-2026.mp3` (public/recap/recap-2026.mp3), `assets/images/recap/brand-mark-white.png`
  (public/brand-mark-white.png). The coral mark already ships as `assets/images/profile/brand-mark-coral.png`.
- Fonts (Flutter needs TTF/OTF, one file per weight, no unicode-range subsets): `Plus Jakarta Sans` 400/600/800
  (Google Fonts OFL, full TTF instead of the four woff2 subsets), `Switzer` 400/500/700 (convert
  public/recap/fonts/switzer-*.woff2; Fontshare licence), `Recap Noto Sans` 400/700 (public/fonts/NotoSans-*.ttf),
  `Recap Noto Naskh Arabic` 400/700 (public/fonts/NotoNaskhArabic-*.ttf). Until then text falls back per glyph to
  Noto Sans Arabic (bundled) and the platform font.
- `just_audio` for a real `RecapAudio`; a native encoder for `RecapVideoEncoder` (phase 9).
