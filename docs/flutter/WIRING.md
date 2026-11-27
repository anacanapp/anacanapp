# Flutter app: interfaces still on their default

Every cross-feature seam that has a real implementation is wired in `app/lib/app/app_wiring.dart` (list:
`docs/flutter/APP_ROOT.md` §2). This page lists the ones whose implementation **does not exist yet**. Each keeps the
safe default its feature ships (no-op, empty slot, neutral value), so the app runs; the owner of the implementing
feature overrides it in `featureWiringOverrides()` when it lands.

Phases are those of `docs/FLUTTER_MIGRATION_PLAN.md` §9: 3 = home screens (leftovers), 4 = tools, 5 = social / AI,
6 = partner, 7 = commerce and content, 8 = games, 9 = native completion.

| Provider / slot | File (under `app/lib/`) | Default | Implemented by | Phase |
|---|---|---|---|---|
| `unreadMessagesCountProvider`, `unreadCommunityPostsCountProvider` | `shell/shell_inputs.dart` (set in `state/shell_bindings.dart`) | 0 | chat `useUnreadMessages`, community `useUnreadCommunityPosts` | 5 |
| `homeTotalUnreadProvider` | `features/home/home_inputs.dart` | 0 | chat (unread partner + DM count) | 5 |
| `homeNotificationCountProvider` | `features/home/home_inputs.dart` | 0 | bell is disabled in React; settings' notifications query when re-enabled | 3 |
| `ShellOverlayId.motherChat` / `userProfile` / `blogArticle` registrations | `shell/feature_registry.dart` | placeholder | chat, community, blog features | 5 / 7 |
| `ShellPlatform.logScreenView` | `shell/shell_inputs.dart` (`DefaultShellPlatform`) | no-op | analytics (Firebase, consent-gated) | 9 |
| `notificationTapQueueProvider.deliver` / `clearQueued` callers | `shell/links/notification_taps.dart` | nothing delivers | FCM + local-notification tap listeners at boot | 9 |
| `analyticsSinkProvider` | `native/purchases/purchases_providers.dart` | `NoopAnalyticsSink` | analytics | 9 |
| `storyEventLoggerProvider` | `features/stories/story_viewer.dart` | no-op | analytics | 9 |
| `notificationPermissionProvider`, `pushGrantedCallbackProvider` | `features/onboarding/onboarding_ports.dart` | unsupported / no-op | Firebase Messaging permission + device-token registration | 9 |
| `tourToolConfigsProvider(stage)` | `features/onboarding/onboarding_tour_host.dart` | null (tour waits) | Tools hub configs minus disabled tools | 4 |
| `tourBlockedProvider` (lock offer / lock setup / feedback sheet parts) | `features/onboarding/onboarding_tour_host.dart` | wired to the article overlay only | a shared "first-run sheet open" flag from security / support | 3 |
| Privacy consent writer (`PrivacyConsentSheet`, `setPrivacyConsent`, `applyPrivacyConsent`, Preferences copy of the key) | `core/data/privacy_consent.dart` is read-only | undecided unless migrated | consent feature (sheet + Firebase/Meta/TikTok consent) | 9 |
| `privacySlotsProvider` (ConsentSettings, ConsentControls) | `features/settings/privacy_screen.dart` | not shown | consent feature | 9 |
| `analyticsConsentNotifierProvider` | `features/settings/data/preferences.dart` | no-op | Customer.io consent event | 9 |
| `paywallExtensionsProvider` (EpointPayOption, QaygiCash option / earn line, SponsorEntry) | `features/premium/paywall_extensions.dart` | none | commerce / QayğıCash | 7 |
| `HomeSlots.bannerSlot`, `adInlineAnchor` | `features/home/home_slots.dart` | none | banners / ads (`BannerSlot`, `AdInlineAnchor`, Index `AdSurface home_banner`) | 9 |
| `HomeSlots.partnerCareCard`, `dailySummaryAutoSync` | `features/home/home_slots.dart` | none | partner | 6 |
| `HomeSlots.recoveryHome` | `features/home/home_slots.dart` | none | pregnancy-loss `RecoveryHome` | 4 |
| `HomeSlots.babyChatCard` | `features/home/home_slots.dart` | none | baby chat (AI) | 5 |
| `HomeSlots.booksHomeCard`, `aptekHomeCard`, `partnerHomeCard` | `features/home/home_slots.dart` | none | books, Aptek, partner shop | 7 |
| `homeWidgetBridgeProvider`, `homeWidgetsSyncProvider` | `features/home/home_slots.dart`, `features/settings/widget_settings_screen.dart` | no-op | AnacanWidgets native bridge (home-screen widgets) | 9 |
| `homeBlogPostsProvider` | `features/home/dashboard/recent_blog_posts.dart` | stand-in query | blog `useBlog` (country filter, editorial localisation) | 7 |
| `recapAudioFactoryProvider` | `features/recap/recap_audio.dart` | silent | `just_audio` playing `assets/recap/recap-2026.mp3` (package not in pubspec yet) | 9 |
| `recapVideoEncoderProvider` | `features/recap/recap_export.dart` | "not supported" (image share only, React's no-MediaRecorder branch) | native H.264 encoder (AVAssetWriter / MediaCodec + MediaMuxer) with the mp3 | 9 |
| `homeWaterGoalNotifierProvider` | `features/home/data/daily_logs.dart` | no-op | partner notification | 6 |
| `storyExporterProvider` | `features/stories/story_viewer.dart` | fails ("Alınmadı") | story image export / share | 5 |
| `cycleHealthWriterProvider` | `features/home_flow/flow_platform.dart` | no-op | HealthKit / Health Connect cycle bridge | 9 |
| `healthPluginBridgeProvider`, `healthCyclePluginProvider`, `healthVitalsPluginProvider` | `features/settings/data/health_service.dart` | unavailable | native Health plugins | 9 |
| `flowNotificationPlannerProvider`, `timerNotificationSchedulerProvider`, `reminderSchedulerProvider` | `features/home_flow/flow_platform.dart`, `features/baby/live_timer/live_timer.dart`, `features/settings/data/preferences.dart` | not native / no-op | central local-notification scheduler | 9 |
| `FlowHomeSlots.partnerHomeCard` | `features/home_flow/flow_platform.dart` | none | partner shop | 7 |
| `flowOpenAiChatProvider` | `features/home_flow/flow_platform.dart` | no-op | AI tab with a prompt | 5 |
| `partnerFlowSnapshotProvider` | `features/home_flow/flow_platform.dart` | null | partner `usePartnerData` | 6 |
| `liveTimerBridgeProvider` | `features/baby/live_timer/live_timer.dart` | no-op (web behaviour) | LiveActivity / timer FGS method channel | 9 |
| `liveTimerIosFailureToastProvider` | `features/baby/live_timer/live_timer.dart` | null | a root toast handle (only fires once the bridge exists) | 9 |
| `BabyCareServices.unlockAchievement` | `features/baby/hooks/baby_services.dart` | no-op | achievements | 4 |
| `MommySlot.illnessActive`, `illnessEntry`, `weaningHome`, `weaningFeedingLink`, `parentingHome` | `features/home_mommy/mommy_home_slots.dart` | none | illness, weaning, parenting tools | 4 |
| `MommySlot.booksCarousel`, `aptekHome`, `partnerHome` | `features/home_mommy/mommy_home_slots.dart` | none | books, Aptek, partner shop | 7 |
| `profileSlotsProvider` (`bannerSlot`, `qaygiCashCard`, `pregnancyCard`, `partnerLinkForm`, `promoDialog`) | `features/profile/profile_interfaces.dart` | not shown | banners (9), QayğıCash (7), ProfilePregnancyCard (4), partner link (6), PromoCodeDialog (7) | 4–9 |
| `qaygiCashRowProvider` | `features/profile/profile_interfaces.dart` | null | QayğıCash wallet | 7 |
| `partnerProfileDataProvider` | `features/profile/profile_interfaces.dart` | empty | partner data / stats / missions / surprises | 6 |
| `adPreferencesControllerProvider` | `features/settings/ad_preferences_screen.dart` | no-op | `useAdExperience` (UMP privacy options, rewarded) | 9 |
| `useAdSafetyBlock` in AppRatingPrompt | `features/support/app_rating.dart` | not consulted | ads | 9 |
| `screenshotGuardPlatformProvider` | `features/security/screen_capture_guard.dart` | no-op | ScreenshotGuard native plugin (FLAG_SECURE / secure surface, capture events) | 9 |
| `dashboardCaptureAllowedProvider` | `features/security/screen_capture_guard.dart` | false (protected everywhere) | shell: main dashboard visible and no dialog route open (needs a navigator observer); meaningful only with the platform above | 9 |
| Games UI (hub, 8 games) | `features/games/` (engines only) | not registered | games feature | 8 |
| Tools hub and tools (`registerTool`) | — | placeholder | tools feature | 4 |

Count by phase: 3 → 3, 4 → 7, 5 → 6, 6 → 5, 7 → 9, 8 → 1, 9 → 19 (rows spanning several phases counted under
each phase they name in the last column; the profile slots row once, as "4–9").

## Duplicated logic left in place

| What | Where | Why it stays |
|---|---|---|
| `MedicalDisclaimer` widget | `features/home/dashboard/medical_disclaimer.dart` and `features/legal/medical_disclaimer.dart` | the emergency-number source is one (`homeEmergencyNumberProvider` ← legal's `emergencyNumberProvider`); the two widgets render different variants (home: `anacan` / `inline`, legal: banner / compact / inline / anacan) with their own goldens — merging changes markup |
| `usePeriodDayLogs` query providers | `features/home_flow/data/flow_hooks.dart` (`periodDayLogsQuery`) and `features/home_mommy/period/mommy_period.dart` (`mommyPeriodDayLogsQuery`) | same key `['period-day-logs', uid, null, null]` and the same row type, so they share one cache entry; the data access is now one (`mommyPeriodSourceProvider` ← flow's repository) |
| Flow labels read `app_settings` directly | `features/home_flow/data/flow_repository.dart` `upcomingLabels()` | ported as React's FlowPeriodCalendar does it (table read, not `useAppSetting`) |
