# Flutter app: interfaces still on their default

Every cross-feature seam that has a real implementation is wired in `app/lib/app/app_wiring.dart` (list:
`docs/flutter/APP_ROOT.md` §2). This page lists the ones whose implementation **does not exist yet**. Each keeps the
safe default its feature ships (no-op, empty slot, neutral value), so the app runs; the owner of the implementing
feature overrides it in `featureWiringOverrides()` when it lands.

Phases are those of `docs/FLUTTER_MIGRATION_PLAN.md` §9: 3 = home screens (leftovers), 4 = tools, 5 = social / AI,
6 = partner, 7 = commerce and content, 8 = games, 9 = native completion.

| Provider / slot | File (under `app/lib/`) | Default | Implemented by | Phase |
|---|---|---|---|---|
| `homeNotificationCountProvider` | `features/home/home_inputs.dart` | 0 | bell is disabled in React; settings' notifications query when re-enabled | 3 |
| `chatAudioRecorderProvider` | `features/chat/` | unsupported (voice recording off; playback via video_player) | `record` package + mic permissions | 9 |
| `toolsHubSlotsProvider` — all fields wired; one `ToolsHubSlots` in app_wiring.dart | `features/tools/hub/hub_inputs.dart` | — | — | done |
| `solidFoodRecipesSlotProvider` | `features/tools/solid_food/solid_food_guide.dart` | opens Recipes without preselection | recipes tool (baby_food category / recipe) | 4 |
| Image compression (`compressImageForUpload`) | `features/tools/baby_album/image_compress.dart` | uploads the picker output (1600 px, q 82) | JPEG/WebP encoder package | 9 |
| `healthVitalsBackgroundSyncProvider` | `features/tools/pregnancy_common/pregnancy_ports.dart` | no-op | Health | 9 |
| `pregnancyToolSlotsProvider` — all fields wired; one `PregnancyToolSlots` in app_wiring.dart | `features/tools/pregnancy_common/pregnancy_ports.dart` | — | — | done |
| `audioPlatformProvider` (microphone, recorder, level) | `features/tools/media_common/audio_recording.dart` | no microphone ("recording not supported" toast, React's no-API branch) | `record` + `RECORD_AUDIO` / mic permission; cry translator needs the WebM decision (PROGRESS.md) | 9 |
| `whiteNoiseAudioProvider` | `features/tools/whitenoise/white_noise_audio.dart` | silent engine | `just_audio` (+ background audio / lock-screen controls, `UIBackgroundModes audio`, Android media FGS) | 9 |
| `geolocationProvider` | `features/tools/media_common/media_ports.dart` | fails → weather shows Baku "location unavailable" | `geolocator` (coarse, 10 s) | 9 |
| `photoSaverProvider` | `features/tools/media_common/media_ports.dart` | save fails (React error toast) | `gal` (save to gallery) | 9 |
| `photoGalleryViewerProvider` | `features/tools/photoshoot/photo_gallery_viewer.dart` | stand-in viewer | `overlay.photo-gallery` port | 3 |
| `communityImageCodecProvider` | `features/community/data/community_media.dart` | uploads the picker-scaled original | JPEG/WebP encoder | 9 |
| `storyImageEncoderProvider` | `features/community_stories/export/story_export.dart` | PNG (React: JPEG q 0.93–0.94) | JPEG encoder package | 9 |
| `sosLocationProvider` | `features/partner/partner_ports.dart` | no location (alert sent without coordinates, React's no-location path) | `geolocator` | 9 |
| `partnerHomeSlotsProvider` — all fields wired; extend `kPartnerScreensHomeSlots` | `features/partner/screens/screens_wiring.dart` | — | — | done |
| `albumProofPickerProvider` | `features/album_order/` | photo library only (no PDF proof) | document picker package | 9 |
| `doctorReportPdfRendererProvider`, `pdfDeliveryPlatformProvider` | `features/health_screens/doctor_report/pdf_report.dart` | unsupported → "PDF yaradıla bilmədi" toast | `pdf` (+ Noto fonts) and `printing` or share_plus + path_provider | 9 |
| `localNotificationBackendProvider` (OS scheduling under the central scheduler; all feature notification seams now go through it) | `services/notifications/local_notification_backend.dart` | unavailable (web: nothing scheduled, vaccine switch hidden) | `flutter_local_notifications` + `timezone` | 9 native |
| `pushPlatformProvider` (FCM/APNs token, permission) | `services/push/push_platform.dart` | web, no push | `firebase_core` + `firebase_messaging` | 9 native |
| `notificationTapSourcesProvider` + `installNotificationTapListeners` in `main()` | `services/push/notification_tap_listeners.dart` | none | `firebase_messaging` + `flutter_local_notifications` | 9 native |
| `nativePermissionsProvider` (camera, microphone, location) | `services/native/permissions.dart` | web branch | `permission_handler`, `geolocator` | 9 native |
| `admobSdkProvider` (`AdmobSdk`: banners, interstitial, rewarded, UMP) | `services/ads/admob_adapter.dart` | null → real modes `unsupported`, demo `demo_only` (no ads, as React without the plugin) | `google_mobile_ads` | 9 native |
| `firebaseAnalyticsPlatformProvider`, `facebookEventsPluginProvider`, `tiktokEventsPluginProvider`, `customerIoPluginLoaderProvider`, `trackingTransparencyProvider` | `services/analytics/` | no-op / unavailable (internal `analytics_events` insert works) | `firebase_analytics`, `facebook_app_events`, TikTok + Customer.io plugin ports, `app_tracking_transparency` | 9 native |
| `screenshotGuardPlatformProvider` (channel `anacan/screenshot_guard`) | `features/security/screen_capture_guard.dart` | no-op | ScreenshotGuard plugin (FLAG_SECURE / secure layer) | 9 native |
| Individual tools (`registerTool`) | `features/tools/<tool>/` | shell placeholder | tool batches | 4 |
| `ShellPlatform.logScreenView` | `shell/shell_inputs.dart` (`DefaultShellPlatform`) | no-op | analytics (Firebase, consent-gated) | 9 |
| `storyEventLoggerProvider` | `features/stories/story_viewer.dart` | no-op | analytics | 9 |
| `tourBlockedProvider` (lock offer / lock setup / feedback sheet parts) | `features/onboarding/onboarding_tour_host.dart` | wired to the article overlay only | a shared "first-run sheet open" flag from security / support | 3 |
| Privacy consent writer (`PrivacyConsentSheet`, `setPrivacyConsent`, `applyPrivacyConsent`, Preferences copy of the key) | `core/data/privacy_consent.dart` is read-only | undecided unless migrated | consent feature (sheet + Firebase/Meta/TikTok consent) | 9 |
| `privacySlotsProvider` (ConsentSettings, ConsentControls) | `features/settings/privacy_screen.dart` | not shown | consent feature | 9 |
| `HomeSlots.bannerSlot`, `adInlineAnchor` | `features/home/home_slots.dart` | none | banners / ads (`BannerSlot`, `AdInlineAnchor`, Index `AdSurface home_banner`) | 9 |
| `homeWidgetBridgeProvider`, `homeWidgetsSyncProvider` | `features/home/home_slots.dart`, `features/settings/widget_settings_screen.dart` | no-op | AnacanWidgets native bridge (home-screen widgets) | 9 |
| `recapAudioFactoryProvider` | `features/recap/recap_audio.dart` | silent | `just_audio` playing `assets/recap/recap-2026.mp3` (package not in pubspec yet) | 9 |
| `recapVideoEncoderProvider` | `features/recap/recap_export.dart` | "not supported" (image share only, React's no-MediaRecorder branch) | native H.264 encoder (AVAssetWriter / MediaCodec + MediaMuxer) with the mp3 | 9 |
| `cycleHealthWriterProvider` | `features/home_flow/flow_platform.dart` | no-op | HealthKit / Health Connect cycle bridge | 9 |
| `healthPluginBridgeProvider`, `healthCyclePluginProvider`, `healthVitalsPluginProvider` | `features/settings/data/health_service.dart` | unavailable | native Health plugins | 9 |
| `liveTimerBridgeProvider` | `features/baby/live_timer/live_timer.dart` | no-op (web behaviour) | LiveActivity / timer FGS method channel | 9 |
| `liveTimerIosFailureToastProvider` | `features/baby/live_timer/live_timer.dart` | null | a root toast handle (only fires once the bridge exists) | 9 |
| `profileSlotsProvider` — all fields wired; one `ProfileSlots` in app_wiring.dart (add new fields there) | `features/profile/profile_interfaces.dart` | — | — | done |
| `useAdSafetyBlock` in AppRatingPrompt | `features/support/app_rating.dart` | not consulted | ads | 9 |
| `screenshotGuardPlatformProvider` | `features/security/screen_capture_guard.dart` | no-op | ScreenshotGuard native plugin (FLAG_SECURE / secure surface, capture events) | 9 |
| `gameTonePlayerFactoryProvider` | `features/games/ui_common/` | silent | audio package | 9 |

Count by phase: 3 → 3, 4 → 7, 5 → 6, 6 → 5, 7 → 9, 8 → 1, 9 → 19 (rows spanning several phases counted under
each phase they name in the last column; the profile slots row once, as "4–9").

## Duplicated logic left in place

| What | Where | Why it stays |
|---|---|---|
| `chat-media` helpers | `features/chat/data/chat_media.dart` and `features/ai_chat/chat_media.dart` (different APIs) | ported in parallel; to merge into the chat one |
| `MedicalDisclaimer` widget | `features/home/dashboard/medical_disclaimer.dart` and `features/legal/medical_disclaimer.dart` | the emergency-number source is one (`homeEmergencyNumberProvider` ← legal's `emergencyNumberProvider`); the two widgets render different variants (home: `anacan` / `inline`, legal: banner / compact / inline / anacan) with their own goldens — merging changes markup |
| `usePeriodDayLogs` query providers | `features/home_flow/data/flow_hooks.dart` (`periodDayLogsQuery`) and `features/home_mommy/period/mommy_period.dart` (`mommyPeriodDayLogsQuery`) | same key `['period-day-logs', uid, null, null]` and the same row type, so they share one cache entry; the data access is now one (`mommyPeriodSourceProvider` ← flow's repository) |
| Flow labels read `app_settings` directly | `features/home_flow/data/flow_repository.dart` `upcomingLabels()` | ported as React's FlowPeriodCalendar does it (table read, not `useAppSetting`) |
