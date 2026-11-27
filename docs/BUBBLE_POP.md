# Qabarcıq partlat (Bubble Pop)

Owner request 2026-11-14. A 90-second relaxing tap game in Mini Oyunlar with a weekly leaderboard.

## Game
- Code: `src/components/games/qabarciq/` (`engine.ts` rules, `BubblePop.tsx` lobby/play/result, `bubble-pop.css`,
  `messages.ts` offline copy in all 23 app languages, written by Claude, not Gemini).
- 8×10 board, 6 pastel colours. Tap 2+ touching same-colour bubbles to pop; the rest fall and new ones drop in.
- Points: `n² × 5 × multiplier`; consecutive pops within 1.6 s build a combo, multiplier `1 + 0.5 × (combo − 1)`, max ×5.
- Boosters per round: magic wand ×2 (pops any bubble's group), rainbow ×1 (clears one colour).
- Pauses on app background and on hardware back. Sound toggle and local best are kept in localStorage.
- Hub card + "Reytinq" tab entry in `MiniGamesHub.tsx` (all-time board); the game itself shows the weekly board.
- Design reference: Nano Banana Pro mockups (lobby / play / result), rebuilt in CSS/SVG with no image assets.

## Server (`20261114140000_bubble_pop_weekly.sql`, CDC request `.cdc.json`)
- `submit_game_score_v1` accepts `qabarciq` (score ≤ 300 000, level 1) and also keeps the weekly best for every game.
- `game_weekly_scores` (CDC + writer guard, RLS on, no client grants), week = Monday 00:00 Asia/Baku.
- `game_weekly_leaderboard_v1(game, limit)` → top rows + caller's rank, `players`, `weekStart`, `weekEnds`.

## Deploy (2026-11-14)
- Gateway `sha256:85caee85…c580` (`gw-bubble-202611141314`), plan `/home/anacan-runner/bubble-web-plan.json`,
  rollback `/home/anacan-runner/rollback-bubble-web-plan.json` (back to `ded4d501…`).
