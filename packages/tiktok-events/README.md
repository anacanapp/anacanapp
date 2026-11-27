# Anacan TikTok Events bridge

Local Capacitor 8 plugin around the official TikTok Business SDK: iOS `tiktok-business-ios-sdk` 1.7.2 (Swift
Package Manager, `Package.swift`) and Android `com.github.tiktok:tiktok-business-android-sdk` 1.7.1 (JitPack,
`android/build.gradle`, ProGuard keep rules in `android/proguard-rules.pro`).

JS API (`TikTokEvents`): `start`, `setEnabled`, `track`, `identify`, `logout`. The app owns consent, ATT and event
selection in `src/lib/tiktok-events.ts`. Credentials are read natively from the shipped plugin config
(`plugins.TikTokEvents.{ios,android}*`), never from bridge arguments. Full description: `docs/TIKTOK_EVENTS.md`.
