# Store screenshots v2 (2026-11-16)

Conversion-focused set: one continuous coral panorama sliced into 9 slides, big Plus Jakarta Sans 800 headlines with a
butter-yellow highlight word, real app screens (`../shots/<lang>/`, from `../real-app/capture.sh`) in a phone frame,
white stat chips whose numbers match the screen shown, and Nano Banana Pro art in `art/` (mother and newborn, Baku
skyline, clay objects cut out from a flat coral background).

    node scripts/store-screenshots/v2/render.mjs az                  # 9 × 1290×2796 → v2/out/az/
    FORMAT=android node scripts/store-screenshots/v2/render.mjs az   # 9 × 1080×1920 → v2/out-android/az/

Order follows the store rule that most visitors only see the first 2-3 images: value promise, then the two most
searched features (pregnancy week, AI), then the rest; slide 1 and 9 carry the "Pulsuz yüklə" call to action.
Texts: `copy/<lang>.json` (keep chip numbers equal to what the screen shows; no ratings or user counts we cannot prove).
Fonts: Plus Jakarta Sans (OFL) TTFs in `fonts/`.
