# Mini games — engines, data and saves (Flutter port)

Ported from: `src/components/games/**`, `src/hooks/useLocalGameProgress.ts`, `src/lib/game-score-sync.ts`.
The `engine/`, `data/` and `persistence/` folders hold **pure Dart only** (no Flutter imports): engines, generators,
solvers, scoring, fixed-step physics, offline copy lookups and save codecs. Widgets live in `<game>/ui/`, the hub in
`hub/ui/`, shared game UI in `ui_common/` (see "UI" below).

## How equality with the React app is proven

- `app/tool/games/gen_fixtures.mjs` bundles the **original TypeScript** (esbuild, `@` → `src/`) and dumps
  levels, solver results, scripted play-throughs and raw `localStorage` saves to
  `app/test/features/games/fixtures/*.json` (2.3 MB). Dart tests reproduce every value; saves are compared
  **byte-for-byte** after a read → write round trip. Re-run: `node app/tool/games/gen_fixtures.mjs [game…]`
  (entries in `app/tool/games/entries/*.ts`; widen the level lists there to dump more).
- `app/tool/games/export_assets.mjs` writes `app/assets/games/**` (lexicons/catalogs copied byte-for-byte,
  message catalogs evaluated from the TS modules) plus `manifest.json` (size + SHA-256, checked by a test).
- `Math.random()` games (Birləşdir, Sağlam Səbət) take an injected random source; fixtures replace
  `Math.random` with the same mulberry32 stream (`entries/setup.ts` ↔ `test/features/games/fixture_io.dart`).
- Saved state is kept as ordered JSON maps with typed `extension type` views (`common/engine/json_object.dart`),
  so `{...value, key}` updates keep JS property order and unknown fields survive like in the React app.
  `common/engine/js_json.dart` re-implements `JSON.stringify` (integer-like keys first, JS number printing).

JS-semantics helpers (`common/engine/`): `js.dart` (ToInt32/ToUint32, `Math.imul`, `>>>`, `Math.round`,
`Number(string)`, stable merge sort — Dart's `List.sort` is not stable, mulberry32 with an untruncated double
state like V8), `fdlibm.dart` (V8's `Math.sin/cos`; `dart:math` differed from V8 on 180 of 3 014 sampled
arguments, the port on 0), `wheel.dart` uses V8's `Math.hypot` algorithm.

## Games

| Game | React sources → Dart | Determinism (fixtures) | Saves handled |
|---|---|---|---|
| **Söz bağı / Word Garden** | `word-garden/{generator,lexicon,model,state,storage,library,wheel,messages}.ts`, `GardenGame.tsx` (resume/clock/revive) → `word_garden/engine/{generator,lexicon,model,state,library,wheel}.dart`, `persistence/storage.dart`, `data/messages.dart` | 371/371 levels (v3 seeded: 143 incl. levels 1–50, 221, 10⁶, 2³¹−1 for 3 seeds × 2 modes; v2: 114; v1 legacy: 114), 4 play-throughs, 16 storage cases incl. v1/v2→v3 adoption | `anacan_word_garden_v1:<lang>:<rev>:<mode>` (seed, 180-level window, adoption), `anacan_word_garden_preferences_v1` |
| **İki dost / Two Friends** | `iki-dost/{engine,model,levels,state,hints,friends.worker}.ts` → `iki_dost/engine/{engine,state}.dart`, `persistence/storage.dart`, `data/messages.dart` | 40/40 levels: BFS solve (+ from mid-state, random-walk state, exhausted budget), 1 200 random-walk moves, 14 storage cases | `anacan_two_friends_v1:friends-202610-v1`, `anacan_two_friends_preferences_v1` |
| **Yolunu aç / Clear the Way** | `parking/{engine,model,levels,state,hints,parking.worker}.ts` → `parking/engine/engine.dart` | 40/40 levels: BFS solve ×4 states, 1 000 walk steps with legal-move lists, 10 round validations | via casual profile |
| **Tumurcuğun uçuşu / Leaf Flight** | `leaf-flight/{engine,model}.ts`, `LeafFlight.tsx` (`validSavedRound`) → `leaf_flight/engine/engine.dart` | 30/30 levels, 57 020 autopilot steps (sampled every 97), 2 108 erratic-frame accumulator frames, 3 014 sin/cos values | via casual profile |
| **Casual profile** (Flight + Parking) | `casual/{storage,messages}.ts` → `casual/persistence/storage.dart`, `casual/data/messages.dart` | 12 storage cases, 25 copy lookups | `anacan_casual_v1:<game>:<rev>` (≤ 28 000 chars) |
| **Rəng çeşidləmə / Color Sort** | `color-sort/{engine,generator,difficulty,levels,session,workerClient,color-sort.worker,useColorSortLibrary,messages,useColorSortText}.ts` → `color_sort/engine/{engine,difficulty,generator,levels,session}.dart`, `persistence/storage.dart`, `data/messages.dart` | 30 bundled + 10 generated (31…300) + 14 fallback levels, A* results for every bundled level, 7 scripted sessions, cache-eviction trace (26 writes) | `anacan_colorsort_round_v1`, `_level_count_v1`, `_markers_v1`, `_level_v1_<n>`, `_level_index_v1` |
| **Qabarcıq / Bubble Pop** | `qabarciq/{engine,messages}.ts`, `BubblePop.tsx` (tap/pop/combo/boosters, storage) → `qabarciq/engine/engine.dart`, `persistence/storage.dart`, `data/messages.dart` | 6 xorshift streams, 5 scripted 120-tap rounds (600 taps), scoring tables | `anacan:qabarciq:best:v1`, `anacan:qabarciq:sound:v1` |
| **Birləşdir (match-3)** | `birlesdir/{matchEngine,levelConfig,tileDefs}.ts`, `BirlesdirGame.tsx` (`computeScore`, swap/cascade/reshuffle, move bonus) → `birlesdir/engine/{match_engine,level_config}.dart` | 5 seeded games (130 turns: every cascade board, special event, reshuffle, score), 42 configs | `anacan_minigame_progress_birlesdir` (hub) |
| **Sağlam Səbət** | `saglam-sebet/levelConfig.ts`, `SaglamSebetGame.tsx` (spawn/tick/catch/evaluate) → `saglam_sebet/engine/engine.dart` | 63/63 configs (`+toFixed(3)`), stars, sections; loop covered by unit tests only | `anacan_minigame_progress_saglam-sebet` (hub) |
| **Hub** | `hooks/useLocalGameProgress.ts`, `lib/game-score-sync.ts` → `hub/persistence/local_game_progress.dart`, `hub/engine/score_submission.dart` | unit tests (byte-exact save) | `anacan_minigame_progress_<gameId>` |

Vitest suites ported case-by-case (same names): `word-garden/{generator,state}.test.ts`, `iki-dost/{engine,state,messages}.test.ts`,
`parking/engine.test.ts`, `casual/storage.test.ts`, `leaf-flight/engine.test.ts`, `color-sort/{engine,messages}.test.ts`,
`birlesdir/matchEngine.test.ts`, `qabarciq/engine.test.ts`. Not ported (UI suites): `*.test.tsx` (MiniGamesHub, WordGarden,
TwoFriends, ClearTheWay, LeafFlight, ColorSortGame, GameRewardIntegration). One assertion of
`generator.test.ts` reads `scripts/word-garden/az-editorial-v3.json` (not shipped); lexicon bytes are pinned by the manifest instead.

Worker entry points for `Isolate.run`: `generateGardenLevelJob` (lexicon text + request), `colorSortWorkerJob`
(`timeBudget: false` for deterministic results; the React worker uses a 2.2 s wall-clock budget),
`friendsHintJob`, `parkingHintJob`.

## Assets (declare in pubspec)

```
- assets/games/word_garden/   # az.json 394 855 B, az-v2.json 344 360 B, az-v1.json 341 552 B, messages.json 6.8 KB
- assets/games/iki_dost/      # catalog.json 16 KB, messages.json 65 KB
- assets/games/parking/       # catalog.json 30 KB
- assets/games/casual/        # messages.json 28 KB
- assets/games/color_sort/    # catalog.json 6.6 KB, messages.json 44 KB
- assets/games/qabarciq/      # messages.json 37 KB
- assets/games/birlesdir/     # tiles.json (reference copy, Dart constants are checked against it)
- assets/games/saglam_sebet/  # items.json (reference copy, Dart constants are checked against it)
```
`assets/games/manifest.json` is for tests only (no need to bundle). Total ≈ 1.4 MB.

## UI

### Hub and registration (`register.dart`, `hub/`)

- `registerGamesFeature(FeatureRegistry r, {games})` registers the `mini-games` tool (`ToolId.miniGames` →
  `MiniGamesHub`) and fills the shared game registry: Söz bağı, İki dost, Tumurcuğun uçuşu, Yolunu aç here, the other
  folders through `games: [...]` (e.g. `registerGamesBatchB`). The dev-only `/mini-games` outer route is **not**
  registered (SHELL.md §10).
- `hub/ui/mini_games_hub.dart` (`MiniGamesHub.tsx`): Games / Leaderboard tabs, the fixed card list (8 cards in az,
  7 elsewhere — Söz bağı only with an az library), own-screen games full screen, level games hub → levels → game with
  `localGameProgressProvider` + score submission + analytics. Unregistered game → `GameNotAvailable`.
- `hub/ui/leaderboard.dart` (`Leaderboard.tsx`), `hub/data/game_scores.dart` (`useGameScores.ts`:
  `gameLeaderboardQuery`, `myGameScoreQuery`, `gameScoreSubmitterProvider`; backend seam `gameScoresBackendProvider`,
  `gameAuthLoadingProvider` default false), `hub/data/game_score_sync.dart` (`game-score-sync.ts` +
  `game-score-messages.ts`).

### Shared game UI (`ui_common/`) — stable API for every game folder

| File | React | API |
|---|---|---|
| `game_registry.dart` | MiniGamesHub view switch | `GameRegistry`, `registerGame(entry)`, `sharedGameRegistry`, `gameRegistryProvider`, `MiniGameIds`, `ScreenGameEntry(id, builder(ctx, GameScreenArgs{onBack}))`, `LevelGameEntry(id, levels(ctx, GameLevelsArgs), game(ctx, GamePlayArgs), levelCount(ref), nextLevel?)`, `GameLevelResult` |
| `game_env.dart` | localStorage, native haptics, analytics, audio.ts | `gameStoreProvider` (`LocalStoreGameStore` over the app `LocalStore`, same keys as the WebView), `gameLanguageProvider`, `gameNumber(lang, n)`, `gameHapticsProvider`, `gameAnalyticsProvider`, `gameTonePlayerFactoryProvider` (silent default), `gameClockProvider` (`performance.now`), `gameAssetTextLoaderProvider` |
| `game_data.dart` | bundled copy / catalogs | `gameDataProvider` → `GameData{garden, friends, casual, bubble, colorSort, friendsCatalog, parkingCatalog}` |
| `local_game_progress.dart` | `useLocalGameProgress.ts` | `localGameProgressProvider(gameId)` (`.notifier.recordLevelResult`, `isLevelUnlocked`) |
| `game_ads.dart` | `useGameAds.ts` | `GameAdsController(gameId, platform, phase, restore)` (`update`, `transition`, `revive`, `resetRound`, `canOffer`, `benefits`, …), `gameAdsPlatformProvider` (default `NoGameAdsPlatform` = React without an ads configuration) |
| `game_revive_action.dart` | `GameReviveAction.tsx` | `GameReviveAction(ads, game: 'basket' or 'match', labels?, canOffer?)` |
| `level_select_grid.dart` | `GameLevelSelectGrid.tsx` | `GameLevelSelectGrid(...)`, `LevelSection` |
| `tier_labels.dart` | `tierLabels.ts` | `trTierName` |
| `casual_ui.dart` | `casual/{GameLobby,GameDialog,useCasualText,art}` + casual.css | `CasualText`, `CasualPalette`, `CasualScreen`, `CasualHeader`, `CasualButton`, `GameLobby`, `GameDialog`, … |
| `game_widgets.dart` | portals, pushBackHandler, window key / visibility listeners | `GamePortal` (full screen over the nav), `GameBackHandler`, `GameKeyboardListener` (newest first, handled keys stop), `GameLifecycleListener`, `GameStar`, `GameButton` |

### Games of this batch

- **Söz bağı** (`word_garden/ui/`): lobby (`WordGarden`/`GardenJourney`), `GardenGame` (clock 250 ms timed / 1 s calm
  from `gameClockProvider`, flush on pause/settings/background/exit), `CrosswordBoard`, `LetterWheel` (drag with
  `crossedLetters`, taps, keyboard), `GardenDialog` + settings/help, SVG scenery with the theme palette, generation via
  `gardenLevelLoaderProvider` (`Isolate.run(generateGardenLevelJob)`, 15 s). Az only; other languages see the
  "library pending" page.
- **İki dost** (`iki_dost/ui/`): `TwoFriends`, `FriendsBoard` (swipe ≥ 22 px, LTR boards), dialogs; hints via
  `friendsHintRunnerProvider` (`Isolate.run(friendsHintJob)`, 5 s).
- **Tumurcuğun uçuşu** (`leaf_flight/ui/`): `LeafFlight` (Ticker → `advanceFlight`, 2 s autosave), `FlightPainter`.
- **Yolunu aç** (`parking/ui/`): `ClearTheWay`, `ParkingBoard` (axis-clamped drag); hints via
  `parkingHintRunnerProvider` (`Isolate.run(parkingHintJob)`, 10 s).

Not reproduced: React `ErrorBoundary` crash fallbacks; landscape / very-short-screen CSS variants (only the
`max-height: 610px` tweaks used by the boards); CSS keyframe animations except the cell bloom / spinning flower.

### Other games (remaining notes)

- **Color Sort:** SVG tubes (`ColorTube.tsx`) with pour animation, colour markers, hidden layers, +10 levels pack,
  worker generation with fallback + cache, rewarded extra moves (`bonusMoves`, max 60), leaderboard score submit.
- **Bubble Pop:** CSS bubbles with fall/ghost/burst animations, 90 s clock (100 ms tick → `BubbleRound.tick`),
  WebAudio pop sound, weekly leaderboard RPC `game_weekly_leaderboard_v1` + profile cards, share sheet,
  `submit_game_score_v1` (score ≤ 300 000, level 1).
- **Birləşdir / Sağlam Səbət:** framer-motion tiles / falling items, cascade timings (140/160/360/450 ms),
  bonus banners, countdown, revive (`useGameAds` lives/moves/seconds), `submit_game_score_v1`, `Leaderboard.tsx`.

## Risks / notes

- `GameStore` is synchronous like `localStorage`; the UI must back it with a preloaded key/value snapshot
  (see `common/persistence/game_store.dart`). Quota eviction (`writeStorageItem`) is not reproduced here.
- Engines assume the Dart VM (64-bit ints); dart2js/web would break the 32-bit helpers.
- `normalizeGardenWord` implements NFC only for decomposed Latin letters (ç ş ğ ö ü İ …) and Turkic I/İ
  casing instead of ICU; enough for the az alphabet, not a general Unicode implementation.
- Non-deterministic originals: Bubble Pop seeds with `Date.now()`, Birləşdir/Sağlam Səbət use `Math.random()`,
  the Word Garden player seed uses `crypto.getRandomValues`, Color Sort generation has a 2.2 s time budget;
  all are injectable here and fixed in fixtures.
- Message catalogs: Word Garden throws for a language without copy (as in TS); Color Sort uses the exact code or `az`
  and an optional admin translation overlay callback; others normalise with `normalizeAppLanguage`.
