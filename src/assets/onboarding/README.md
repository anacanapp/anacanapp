# Onboarding companions

Ritm (cycle), Tumurcuq (pregnancy) and Qucaq (mother) are supplied by the user in
the Open Design `anacan-onboarding-funnel.html` project. These are optimized,
transparent WebP derivatives of the supplied cutouts and per-screen poses.

Regenerate with `node scripts/prepare-onboarding-assets.mjs "<design project>"`.
`manifest.json` records original and derivative hashes. Original design files
are never modified. The application bundles these images for offline/native use.
