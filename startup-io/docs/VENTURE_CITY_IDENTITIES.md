# Venture City — original identity system

48 fictional competitors and four fictional venture funds share a calm, legible
city-arena identity. The game’s own mint rocket remains the player’s starting mark.

- **Personality:** inventive, clear, playful and composed.
- **Typography:** Space Grotesk for names/values, Manrope for explanations.
- **Palette:** slate/navy surfaces; mint for the player; muted cyan, lavender,
  rose and amber for competitors. Acquisition eligibility uses additional
  mint/rose rings and symbols rather than changing a company's identity color.
- **Marks:** original monochrome geometric paths on a 24×24 grid, with generous
  negative space. Every rival has a distinct silhouette. The same path renders
  in React, Phaser and the leaderboard. Do not recreate or imitate a real logo.
- **Names:** invented Venture City names; no real-company sponsorship is implied.
  Fictional naming reduces the earlier known-brand exposure; it is not a registry
  clearance or a promise that no similar name exists anywhere.
- **Continuity:** roster positions 1–48 are existing bot IDs. Saves restore the
  same actor positions/valuations while taking their display identity from the
  current roster. Wallets, cosmetics and checkpoint credit ledgers are retained.

Authority: `src/game/fictional-brands.ts` and `src/game/market.ts`.
`npm run assets:brands` verifies uniqueness and produces the original mark sheet
under `artifacts/brand-identity/`. Third-party company SVG inputs are retired.
