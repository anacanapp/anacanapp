# Mommy Simulator

- This is an independent game. Keep application code, native projects and build
  artifacts inside this directory. Parent Anacan continuity rules still apply.
- Game identity is `com.atlasoon.mommysimulator`; Apple team is `8B6976J8H7`.
  The parent Anacan identity, finalized packages and database authority are separate.
- Google content comes from `https://gcp.anacan.az` in project
  `ninth-park-492111-m4`, using public, active catalogue rows only.
- `scripts/sync-content.mjs` reads the existing parent public configuration.
  Never copy privileged credentials, private users, sessions or migration helpers.
- Progress is versioned, validated and local to this game. New remote data
  relations require the parent's CDC/writer contract before deployment.
- Verify the simulation with `npm test`, `npm run build`, and the mobile
  Playwright acceptance scenarios. Native physical-device acceptance is recorded
  in `docs/TESTING.md` only after actual installation and launch.
