# METRO Simulator

- Independent Godot game inside this workspace. Keep its source and outputs here.
- Game identity: `com.atlasoon.metrosimulator`. Its saves, engine exports and assets
  are separate from Mommy Simulator and Anacan.
- Station names/order come from the public Baku Metro line descriptions. The
  campaign is a fictional game itinerary, not a live transport timetable.
- Use versioned, validated local progress. No remote account/database dependency.
- Verify with `npm run metro:test`, `npm run metro:build` and
  `npm run metro:test:e2e` from the enclosing `mommy-simulator/` directory.
- Record physical-device acceptance only after actual installation and launch.
