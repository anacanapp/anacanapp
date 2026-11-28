// Ported from: src/App.tsx / src/pages/Index.tsx / src/components/Dashboard.tsx (the cross-feature hook calls the
//              ported features expose as overridable seams: useSubscription().isPremium, PremiumGate /
//              PremiumBlurGate / PremiumModal, useAppSetting, useChildren().selectedChild,
//              useEffectiveCycleLength, useDisabledTools, useAppointments, WaterWidget, UpcomingAppointments,
//              ChildSelector, BirthOnboardingModal, usePrivacyConsent, next-themes, the device time zone)
//
// Every cross-feature interface that has a real implementation today, in one list (docs/flutter/APP_ROOT.md §2).
// Interfaces whose implementation does not exist yet keep their feature default and are listed in
// docs/flutter/WIRING.md.
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:qr_flutter/qr_flutter.dart' show QrErrorCorrectLevel, QrImageView;

import '../core/data/app_settings.dart';
import '../core/data/privacy_consent.dart';
import '../core/device/time_zone.dart';
import '../core/i18n/language_controller.dart' show disabledToolsProvider;
import '../domain/cycle/period_flow.dart' show validatePeriodDates;
import '../features/baby/hooks/baby_services.dart';
import '../features/baby/hooks/use_children.dart' show childrenProvider;
import '../features/baby/live_timer/live_timer.dart' show liveTimerNativeHooksProvider;
import '../features/home/appointments/upcoming_appointments.dart';
import '../features/ai_chat/ai_chat_inputs.dart'
    show aiAnswerCardProvider, aiKickSessionsProvider, aiMotherMealsProvider, aiWeightEntriesProvider;
import '../features/tools/programme_tools.dart' show programmeAiAnswerCardBuilder, programmeMommySlots;
import '../features/tools/health_tools.dart' show healthToolsPrefetchFirstAid;
import '../features/tools/hub/hub_inputs.dart' show ToolsHubSlots, toolsHubSlotsProvider;
import '../features/tools/nutrition/meal_logs.dart' show mealLogsProvider;
import '../features/ai_chat/register.dart' show aiChatFlowOpener;
import '../features/baby_chat/register.dart' show babyChatCardSlot;
import '../features/album_order/register.dart' show albumOrderWiringOverrides, pregnancyAlbumOrderSlot;
import '../features/blog/register.dart' show blogHospitalBagArticles, blogWiringOverrides;
import '../features/books/register.dart' show booksCarouselSlot, booksHomeCardSlot;
import '../features/chat/data/unread.dart' show chatHomeTotalUnreadProvider;
import '../core/auth/auth_controller.dart' show authControllerProvider;
import '../core/i18n/tr.dart' show tr;
import '../features/commerce/partners/qr_code.dart' show qrCodeBuilderProvider;
import '../features/games/hub/data/game_scores.dart' show gameAuthLoadingProvider;
import '../features/banners/banners_seams.dart'
    show communityBanner, homeBannerSlot, profileBannerSlot, toolsHubBannerSlot;
import '../features/blog/ui/blog_ui.dart' show BlogAdSlots, blogAdSlotsProvider;
import '../features/community/community_slots.dart' show communityBannerProvider;
import '../features/community/data/community.dart' show communityPostCreatedTrackerProvider;
import '../features/community_stories/data/story_ads.dart' show storyAdBreaksProvider;
import '../features/games/ui_common/game_ads.dart' show gameAdsPlatformProvider;
import '../features/security/screen_capture_guard.dart' show dashboardCaptureAllowedProvider;
import '../features/settings/ad_preferences_screen.dart' show adPreferencesControllerProvider;
import '../features/settings/data/preferences.dart' show analyticsConsentNotifierProvider;
import '../features/tools/health_common/health_common.dart' show HealthAdSlots, healthAdSlotsProvider;
import '../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../services/ads/ad_seams.dart'
    show
        adExitSlot,
        adInlineAnchorSlot,
        adSurfaceSlot,
        babyNamesAdSlot,
        blogAdSurfaceSlot,
        experienceAdPreferencesController,
        experienceGameAdsPlatform,
        experienceStoryAdBreaks,
        healthAdSurfaceSlot,
        homeAdInlineAnchorSlot;
import '../services/analytics/analytics_providers.dart'
    show ServiceAnalyticsSink, analyticsServiceProvider;
import '../services/analytics/customerio.dart' show customerIoProvider;
import '../services/analytics/customerio_session.dart' show customerIoConsentNotifier;
import '../native/platform/native_platform_wiring.dart' show nativePlatformWiringOverrides;
import '../services/analytics/sdk_wiring.dart' show adsAnalyticsSdkWiringOverrides;
import '../services/native/services_wiring.dart' show notificationServicesWiringOverrides;
import '../services/security/dashboard_capture.dart' show dashboardCaptureAllowed;
import '../services/ads/ad_widgets.dart' show AdBottomNavAnchor;
import '../services/ads/ads_providers.dart' show adPrivacyUnavailableProvider;
import 'app_toasts.dart';
import '../shell/shell_inputs.dart' show shellBottomNavWrapperProvider;
import '../features/commerce/register.dart'
    show
        commerceAptekBagCard,
        commerceAptekHomeCard,
        commerceAptekSearchResults,
        commerceFlowPartnerHomeCard,
        commerceMommySlots,
        commercePartnerHomeCard,
        commercePromoDialog,
        commerceQaygiCashProfileCard,
        commerceWiringOverrides;
import '../features/tools/pregnancy_common/pregnancy_ports.dart' show PregnancyToolSlots, pregnancyToolSlotsProvider;
import '../features/community/register.dart' show communityWiringOverrides;
import '../features/community_stories/register.dart' show communityStoriesWiringOverrides;
import '../features/groups/register.dart' show groupsWiringOverrides;
import '../features/health_screens/register.dart'
    show healthScreensWiringOverrides, illnessActiveSlot, illnessEntrySlot, pregnancyCardSlot, recoveryHomeSlot;
import '../features/home/dashboard/medical_disclaimer.dart' show homeEmergencyNumberProvider;
import '../features/home/dashboard/recap_home_card.dart' show recapHomeYearQuery;
import '../features/home/dashboard/water_widget.dart';
import '../features/home/data/appointments.dart' show appointmentsApiProvider;
import '../features/home/home_inputs.dart';
import '../features/home/home_slots.dart';
import '../features/home_flow/data/flow_hooks.dart' show effectiveCycleLengthProvider;
import '../features/home_flow/data/flow_repository.dart' show flowRepositoryProvider;
import '../features/home_flow/flow_platform.dart';
import '../features/home_mommy/mommy_home_slots.dart';
import '../features/home_mommy/period/mommy_period.dart';
import '../features/home_mommy/register_home_mommy.dart' show buildMommyTopBarAction;
import '../features/legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../features/onboarding/birth_onboarding_modal.dart' show showBirthOnboardingModal;
import '../features/onboarding/onboarding_ports.dart' show onboardingPendingProvider;
import '../features/onboarding/onboarding_tour_host.dart'
    show tourBlockedProvider, tourConsentDecidedProvider, tourRunningProvider, tourToolConfigsProvider;
import '../features/tools/baby_tracker/achievements.dart' show achievementsActionsProvider;
import '../features/tools/kick/kick_sessions.dart' show kickSessionsProvider;
import '../features/tools/weight/weight_entries.dart' show weightEntriesProvider;
import '../features/tools/tour_configs.dart' show toolsTourConfigsProvider;
import '../features/premium/ad_free_premium_offer.dart' show AdFreePremiumOffer;
import '../features/premium/premium_gates.dart' show PremiumBlurGate, PremiumGate;
import '../features/premium/premium_modal.dart' show showPremiumModal;
import '../features/partner/partner_wiring.dart' show dailySummaryAutoSyncSlot, partnerCareCardSlot, partnerWiringOverrides;
import '../features/partner/ui/partner_link_form.dart' show partnerLinkFormSlot;
import '../features/profile/profile_interfaces.dart';
import '../features/recap/use_recap.dart' show RecapHomeYearNotifier, recapProfileRowFromRecapProvider;
import '../features/security/app_lock.dart' show biometricAuthProvider;
import '../features/security/register.dart' show onboardingTourActiveProvider;
import '../features/security/screen_capture_guard.dart' show screenshotGuardPlatformProvider;
import '../features/settings/theme_mode_setting.dart' show ThemeModeSetting, themeModeSettingProvider;
import '../native/biometric/local_auth_biometric.dart';
import '../native/purchases/subscription.dart' show subscriptionProvider, subscriptionUsageProvider;
import '../shell/nav/shell_controller.dart' show shellProvider;
import '../state/first_run_sheets.dart' show firstRunSheetsProvider;
import '../state/shell_bindings.dart' show hasPendingOnboardingProvider;
import '../state/timer_store.dart' show timerNativeHooksProvider;
import 'theme_mode.dart';

/// `useSubscription().isPremium` (the premium entitlement: `get_premium_access_v1` + grant cache + realtime).
final appIsPremiumProvider = Provider<bool>((ref) => ref.watch(subscriptionProvider.select((s) => s.isPremium)));

/// Overrides that connect the ported features to each other.
List<Override> featureWiringOverrides() => [
      // ── onboarding ────────────────────────────────────────────────────────────────────────────────────────
      hasPendingOnboardingProvider.overrideWith((ref) => ref.watch(onboardingPendingProvider)),
      // usePrivacyConsent().decidedAt !== null
      tourConsentDecidedProvider.overrideWith((ref) => ref.watch(privacyConsentProvider.select((c) => c.decided))),
      // Index: lockOffer || lockSetup || autoFeedback || articleSlug (state/first_run_sheets.dart).
      // useToolConfigs(stage) minus useDisabledTools (Tools hub configs).
      tourToolConfigsProvider.overrideWith((ref, stage) => ref.watch(toolsTourConfigsProvider(stage))),
      tourBlockedProvider.overrideWith((ref) =>
          ref.watch(firstRunSheetsProvider.select((s) => s.isNotEmpty)) || ref.watch(shellProvider.select((s) => s.blogOverlay != null))),
      // OnboardingTourHost onRunningChange → Index `tourActive` (first-run lock offer waits for the tour).
      onboardingTourActiveProvider.overrideWith((ref) => ref.watch(tourRunningProvider)),

      // ── premium / purchases ───────────────────────────────────────────────────────────────────────────────
      homeIsPremiumProvider.overrideWith((ref) => ref.watch(appIsPremiumProvider)),
      flowIsPremiumProvider.overrideWith((ref) => ref.watch(appIsPremiumProvider)),
      subscriptionIsPremiumProvider.overrideWith((ref) => ref.watch(appIsPremiumProvider)),
      flowPremiumGateProvider.overrideWithValue(_flowPremiumGate),
      premiumPromptProvider.overrideWithValue(const _PremiumModalPrompt()),
      babyCareServicesProvider.overrideWith((ref) => _BabyCareServices(ref)),

      // ── app settings (one `useAppSetting` source: core/data/app_settings.dart) ────────────────────────────
      homeAppSettingProvider.overrideWith((ref, key) => ref.watch(appSettingProvider(key))),
      profileLayoutSettingProvider.overrideWith((ref) {
        final v = ref.watch(appSettingProvider('profile_layout'));
        return v is String ? v : null;
      }),

      // ── theme: next-themes has one state (LocalStore `theme`) ─────────────────────────────────────────────
      themeModeSettingProvider.overrideWith(_RootThemeModeSetting.new),

      // ── security ──────────────────────────────────────────────────────────────────────────────────────────
      biometricAuthProvider.overrideWith((ref) => LocalAuthBiometricAuth(
            onPromptStart: () => ref.read(screenshotGuardPlatformProvider).setCurtainSuspended(true),
            onPromptEnd: () => ref.read(screenshotGuardPlatformProvider).setCurtainSuspended(false),
          )),

      // ── community: chat text / photo viewer / restriction note ─────────────────────────────────────────────
      // ── partner: data feeds and notifications for the woman's features ──────────────────────────────────────
      ...partnerWiringOverrides(),
      // Profile slots (one ProfileSlots; commerce / health screens add theirs here).
      profileSlotsProvider.overrideWithValue(const ProfileSlots(
        partnerLinkForm: partnerLinkFormSlot,
        qaygiCashCard: commerceQaygiCashProfileCard,
        promoDialog: commercePromoDialog,
        pregnancyCard: pregnancyCardSlot,
        bannerSlot: profileBannerSlot,
      )),
      ...healthScreensWiringOverrides(),

      // ── blog / album order / pregnancy tool slots (one PregnancyToolSlots; Aptek and ads add their fields) ────────
      ...blogWiringOverrides(),
      ...albumOrderWiringOverrides(),
      pregnancyToolSlotsProvider.overrideWithValue(
          const PregnancyToolSlots(
        hospitalBagArticles: blogHospitalBagArticles,
        albumOrderScreen: pregnancyAlbumOrderSlot,
        aptekBagCard: commerceAptekBagCard,
        babyNamesAd: babyNamesAdSlot,
      )),
      // ── commerce: paywall extensions, QayğıCash row, books wallet, partner QR ─────────────────────────────────
      ...commerceWiringOverrides(),
      qrCodeBuilderProvider.overrideWithValue(
          (context, value, size) => QrImageView(data: value, size: size, padding: EdgeInsets.zero, errorCorrectionLevel: QrErrorCorrectLevel.M)),

      ...communityWiringOverrides(),
      ...communityStoriesWiringOverrides(),
      ...groupsWiringOverrides(),

      // ── recap: one `useRecap` for the home card and the profile row ─────────────────────────────────────
      recapProfileRowProvider.overrideWith((ref) => ref.watch(recapProfileRowFromRecapProvider)),
      recapHomeYearQuery.overrideWith(RecapHomeYearNotifier.new),

      // ── home (shared dashboard) ───────────────────────────────────────────────────────────────────────────
      homeTotalUnreadProvider.overrideWith((ref) => ref.watch(chatHomeTotalUnreadProvider)),
      homeSelectedChildProvider.overrideWith((ref) => ref.watch(childrenProvider.select((v) => v.selectedChild))?.toRow()),
      homeEffectiveCycleLengthProvider.overrideWith((ref) => ref.watch(effectiveCycleLengthProvider)),
      homeToolDisabledProvider.overrideWith((ref, toolId) => ref.watch(disabledToolsProvider).contains(toolId)),
      homeEmergencyNumberProvider.overrideWith((ref) => ref.watch(emergencyNumberProvider)),
      homeSlotsProvider.overrideWithValue(HomeSlots(
        adFreeOffer: (context, position) => AdFreePremiumOffer(position: position),
        childSelectorCompact: buildMommyTopBarAction,
        babyChatCard: babyChatCardSlot,
        booksHomeCard: booksHomeCardSlot,
        recoveryHome: recoveryHomeSlot,
        bannerSlot: homeBannerSlot,
        adInlineAnchor: homeAdInlineAnchorSlot,
        aptekHomeCard: commerceAptekHomeCard,
        partnerHomeCard: commercePartnerHomeCard,
        partnerCareCard: partnerCareCardSlot,
        dailySummaryAutoSync: dailySummaryAutoSyncSlot,
        showBirthOnboarding: (context) async {
          var done = false;
          await showBirthOnboardingModal(context, onComplete: () => done = true);
          return done;
        },
      )),

      // ── flow home ─────────────────────────────────────────────────────────────────────────────────────────
      flowHomeSlotsProvider.overrideWithValue(FlowHomeSlots(
        waterWidget: (context) => const WaterWidget(variant: WaterWidgetVariant.anacan),
        upcomingAppointments: (context) => const UpcomingAppointments(),
        partnerHomeCard: commerceFlowPartnerHomeCard,
      )),
      // AI request context: useWeightEntries().entries (newest first), useKickSessions().todaySessions.
      aiWeightEntriesProvider.overrideWith((ref) => [
            for (final e in ref.watch(weightEntriesProvider).entries) {'weight': e.weight, 'entry_date': e.entryDate},
          ]),
      // Central local-notification scheduler + push sender behind every feature's notification seam.
      ...notificationServicesWiringOverrides(),
      // Native channels (screenshot guard, live timer, home widgets, Health, Meta) and the ad/analytics SDKs; both
      // switch to the real platform only on Android/iOS hosts.
      ...nativePlatformWiringOverrides(),
      ...adsAnalyticsSdkWiringOverrides(),
      // ── analytics, ads, banners, capture guard (phase 9 Dart side; SDKs behind interfaces) ─────────────────────
      analyticsSinkProvider.overrideWith((ref) => ServiceAnalyticsSink(ref.watch(analyticsServiceProvider))),
      shellBottomNavWrapperProvider.overrideWithValue((nav) => AdBottomNavAnchor(child: nav)),
      adPrivacyUnavailableProvider.overrideWith((ref) {
        final toasts = ref.watch(appToastControllerProvider);
        return () => toasts.error(
            tr('adexp_privacy_unavailable', 'Reklam məxfilik seçimləri hazırda açılmır. Yenidən cəhd edin.'));
      }),
      analyticsConsentNotifierProvider.overrideWith(customerIoConsentNotifier),
      communityPostCreatedTrackerProvider
          .overrideWith((ref) => (a, b, id) => ref.read(customerIoProvider).postCreated(a, b, id)),
      dashboardCaptureAllowedProvider.overrideWith(dashboardCaptureAllowed),
      communityBannerProvider.overrideWithValue(communityBanner),
      gameAdsPlatformProvider.overrideWith(experienceGameAdsPlatform),
      storyAdBreaksProvider.overrideWith(experienceStoryAdBreaks),
      adPreferencesControllerProvider.overrideWith(experienceAdPreferencesController),
      blogAdSlotsProvider.overrideWithValue(
          const BlogAdSlots(surface: blogAdSurfaceSlot, inlineAnchor: adInlineAnchorSlot, exit: adExitSlot)),
      healthAdSlotsProvider.overrideWithValue(
          const HealthAdSlots(adSurface: healthAdSurfaceSlot, adInlineAnchor: adInlineAnchorSlot, adExit: adExitSlot)),
      // Games: leaderboard waits for auth like React's `useAuth().loading`.
      gameAuthLoadingProvider.overrideWith((ref) => ref.watch(authControllerProvider.select((s) => s.loading))),
      // Weaning / Tərbiyə cards under matching AI answers.
      aiAnswerCardProvider.overrideWithValue(programmeAiAnswerCardBuilder),
      aiMotherMealsProvider.overrideWith((ref) => ref.watch(mealLogsProvider).todayLogs),
      // Tools hub: first aid must work offline (usePrefetchFirstAid).
      toolsHubSlotsProvider.overrideWithValue(
          const ToolsHubSlots(
        prefetchFirstAid: healthToolsPrefetchFirstAid,
        aptekSearchResults: commerceAptekSearchResults,
        bannerSlot: toolsHubBannerSlot,
        adSurface: adSurfaceSlot,
        adInlineAnchor: adInlineAnchorSlot,
      )),
      aiKickSessionsProvider.overrideWith((ref) => [for (final s in ref.watch(kickSessionsProvider).todaySessions) s.toRow()]),
      // Period-delay banner → AI tab with the prompt in the input.
      flowOpenAiChatProvider.overrideWith(aiChatFlowOpener),
      flowAddAppointmentProvider.overrideWith((ref) => (row) async {
            await ref.read(appointmentsApiProvider).add(row);
          }),
      flowHapticsProvider.overrideWithValue(FlowHaptics(light: HapticFeedback.lightImpact, medium: HapticFeedback.mediumImpact)),
      flowTimeZoneProvider.overrideWith((ref) => ref.watch(ianaTimeZoneProvider) ?? 'UTC'),

      // ── mommy home ────────────────────────────────────────────────────────────────────────────────────────
      mommyHomeSlotsProvider.overrideWithValue(MommyHomeSlots(
        slots: {
          MommySlot.upcomingAppointments: (context, _) => const UpcomingAppointments(),
          MommySlot.waterWidget: (context, _) => const WaterWidget(variant: WaterWidgetVariant.anacan),
          MommySlot.booksCarousel: booksCarouselSlot,
          ...commerceMommySlots,
          ...programmeMommySlots(),
          MommySlot.illnessActive: illnessActiveSlot,
          MommySlot.illnessEntry: illnessEntrySlot,
        },
        premiumGate: (context, a) => PremiumBlurGate(feature: a.feature, title: a.title, subtitle: a.subtitle, blur: a.blur ?? 'md', child: a.child),
        showPremiumModal: (context, feature) => showPremiumModal(context, feature: feature),
      )),
      mommyTimeZoneProvider.overrideWith((ref) => ref.watch(ianaTimeZoneProvider) ?? 'UTC'),
      // usePeriodDayLogs / useRecordPeriodDays have one port (home_flow); the mommy banner reads through it.
      mommyPeriodSourceProvider.overrideWith((ref) => _FlowMommyPeriodSource(ref)),
      timerNativeHooksProvider.overrideWith((ref) => ref.watch(liveTimerNativeHooksProvider)),
    ];

/// `<PremiumGate title description emoji feature>` for the flow home.
Widget _flowPremiumGate(BuildContext context,
        {required String title, required String description, required String emoji, required String feature, required Widget child}) =>
    PremiumGate(title: title, description: description, emoji: emoji, feature: feature, child: child);

/// `<PremiumModal isOpen feature />` for the profile.
class _PremiumModalPrompt implements PremiumPrompt {
  const _PremiumModalPrompt();
  @override
  Future<void> show(BuildContext context, {String? feature}) => showPremiumModal(context, feature: feature);
}

/// Baby care: Flutter haptics (lib/native.ts hapticFeedback), `useSubscription().peekRemainingDaily`,
/// `useAchievements().unlockAchievement` (tools/baby_tracker/achievements.dart).
class _BabyCareServices extends DefaultBabyCareServices {
  _BabyCareServices(this._ref);
  final Ref _ref;

  @override
  Future<({num remaining, num limit})> peekRemainingDaily(String feature) async {
    final peek = await _ref.read(subscriptionUsageProvider).peekRemainingDaily(feature);
    return (remaining: peek.remaining, limit: peek.limit);
  }

  @override
  Future<void> unlockAchievement(String key, String stage) async {
    await _ref.read(achievementsActionsProvider).unlockAchievement(key, stage);
  }
}

/// The Appearance screen's `useTheme()` on the app root's [themeModeProvider] (one state, one LocalStore key).
class _RootThemeModeSetting extends ThemeModeSetting {
  @override
  String build() {
    ref.watch(themeModeProvider);
    return ref.read(themeModeProvider.notifier).theme;
  }

  @override
  void set(String theme) {
    ref.read(themeModeProvider.notifier).setTheme(theme);
    state = theme;
  }
}

/// The mommy period banner's data through the flow feature's repository (same table, same RPC and parameters;
/// the banner keeps its own query key `['period-day-logs', uid, null, null]`, shared with the flow calendar).
class _FlowMommyPeriodSource implements MommyPeriodSource {
  _FlowMommyPeriodSource(this._ref);
  final Ref _ref;

  @override
  Future<List<Map<String, dynamic>>> loadPeriodDayLogs(String userId) async =>
      [for (final r in await _ref.read(flowRepositoryProvider).periodDayLogs(userId)) Map<String, dynamic>.from(r)];

  @override
  Future<void> record(String userId, MommyPeriodWrite input) async {
    if (userId.isEmpty) throw StateError('NOT_AUTHENTICATED');
    final dates = validatePeriodDates(input.dates);
    final data = await _ref.read(flowRepositoryProvider).recordPeriodDays({
      'p_expected_user_id': userId,
      'p_dates': dates,
      'p_flow': input.flow,
      'p_complete': input.complete ?? false,
      'p_preserve_existing': input.preserveExisting ?? false,
      'p_daily_log': null,
      'p_timezone': _ref.read(mommyTimeZoneProvider),
    });
    if (data is! Map || data['ok'] != true || data['userId'] != userId) throw StateError('PERIOD_WRITE_FAILED');
  }
}
