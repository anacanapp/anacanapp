# startup.io

- Independent offline game; source, native projects and artifacts stay here.
- Bundle/application ID: `com.atlasoon.startupio`; Apple team: `8B6976J8H7`.
- Anacan and other games' source, identities, finalized builds and backend remain separate.
- Campaign progress is versioned, validated and local; no remote database is required.
- Current mode is Unlimited: no stage selection, map boundary, timer or growth cap.
  Preserve schema-v3 checkpoints, credit-ledger idempotency and older wallet/cosmetic migration.
  EndlessWorld keeps a bounded local chunk cache and a BigInt travel origin.
- Rendering/lobby preview use Phaser3.90 with isometric2.5D projection and DPR2 textures;
  screen steering must pass through isometric screenInputToWorld before simulation.
  Arena activity is local bot join/acquisition data; do not claim real-user multiplayer.
- Competitors/funds use original fictional identities; do not restore real-company
  marks. Roster positions 1–48 remain durable save IDs. Preserve takeover windup,
  escape/cooldown controls and wallet/checkpoint migration in polish work.
- Verify changes with `npm test`, `npm run build` and `npm run test:e2e`.
- Final1.5.0/build6 uses fullscreenAndroid cutout-safeCSS and nativeApppause;
 66mechanics/30browser/3iOSnative andAndroidAPI35native/15screenshots pass.
 Handoff:`docs/STORE_RELEASE_1.5.0.md`. FinalAppStoreexport is user-accepted
 signing-blocked (Xcode account/distribution identity unavailable); historical
 earlier1.5IPA/installproof must not count for finalsource. Use`--export-only`
 after signing restoration. FinaliPhoneinstall/physicalgameplay remain pending.
 macOS Androidacceptance uses scopedStartupIO35 hostVulkan/GuestANGLE;
 shell snapshothelper is tooling-only, excluded from the shipped app.
- Record simulator and physical-device acceptance separately in `docs/TESTING.md`.
- Never include signing material, profiles, private inputs or build caches in a handoff.
