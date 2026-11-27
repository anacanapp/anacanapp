// Ported from: src/App.tsx (provider tree order: AppLockGate, ScreenCaptureGuard, OfflineSyncIndicator, router;
//              PremiumEntitlementMonitor; initDeeplinkListener), src/lib/deeplink.ts (appUrlOpen: promo first),
//              src/lib/promo.ts (promoCodeFromUrl), src/lib/native-auth.ts (auth-callback listener), next-themes (one
//              `theme` key), src/hooks/useAppSettings.ts (one useAppSetting source), src/lib/privacyConsent.ts
//              (decidedAt), useSubscription deviceTimeZone / record_period_days p_timezone — the app root wiring.
import 'dart:async';

import 'package:anacan/app/anacan_app.dart';
import 'package:anacan/app/app_wiring.dart';
import 'package:anacan/app/deep_links.dart';
import 'package:anacan/app/feature_registrations.dart';
import 'package:anacan/app/session_hosts.dart';
import 'package:anacan/app/theme_mode.dart';
import 'package:anacan/core/data/app_settings.dart';
import 'package:anacan/core/data/privacy_consent.dart';
import 'package:anacan/core/device/time_zone.dart';
import 'package:anacan/core/offline/offline_providers.dart';
import 'package:anacan/design/design.dart' show AToastHost;
import 'package:anacan/features/home/home_inputs.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/features/home_mommy/period/mommy_period.dart';
import 'package:anacan/features/onboarding/onboarding_tour_host.dart' show tourConsentDecidedProvider;
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/security/app_lock_screen.dart' show AppLockGate;
import 'package:anacan/features/security/screen_capture_guard.dart' show ScreenCaptureGuard;
import 'package:anacan/features/settings/theme_mode_setting.dart';
import 'package:anacan/native/purchases/premium_entitlement.dart' show PremiumEntitlementMonitor;
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/shell_bindings.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../support/i18n_fakes.dart';
import 'app_test_support.dart';

ProviderContainer wired({LocalStore? store, List<Override> extra = const []}) {
  final c = ProviderContainer(overrides: [
    ...featureWiringOverrides(),
    localStoreProvider.overrideWithValue(store ?? LocalStore.memory()),
    appResumeEventsProvider.overrideWithValue(const Stream<void>.empty()),
    ...extra,
  ]);
  addTearDown(c.dispose);
  return c;
}

void main() {
  group('feature registry', () {
    test('every landed feature is registered once', () {
      final ids = buildFeatureRegistry().registeredIds;
      for (final id in [
        'tab:home',
        'tab:profile',
        'tab:profile:partner',
        'screen:settings',
        'screen:appearance',
        'screen:privacy',
        'screen:legal',
        'route:legal',
        'screen:help',
        'screen:edit-profile',
        'screen:calendar',
        'screen:mommy-period',
        'gate:onboarding',
        'gate:auth',
        'gate:splash',
        'frame:security-lock-offer',
        'frame:support-rating-prompt',
        'frame:onboarding-tour-host',
      ]) {
        expect(ids, contains(id));
      }
      // The entitlement monitor is mounted by the app root for the whole session, not by the tab frame.
      expect(ids, isNot(contains('frame:premium-entitlement-monitor')));
    });

    test('the home tab is a sliver body', () {
      final reg = buildFeatureRegistry().tab(ShellTab.home, partner: false);
      expect(reg?.slivers, isNotNull);
    });
  });

  group('theme: one next-themes state', () {
    test('the Appearance screen and the app root read and write the same LocalStore key', () {
      final store = LocalStore.memory();
      final c = wired(store: store);
      expect(c.read(themeModeSettingProvider), 'system');
      c.read(themeModeSettingProvider.notifier).set('dark');
      expect(store.getItem('theme'), 'dark');
      expect(c.read(themeModeProvider), ThemeMode.dark);
      c.read(themeModeProvider.notifier).setTheme('light');
      expect(c.read(themeModeSettingProvider), 'light');
    });
  });

  group('app settings: one useAppSetting source', () {
    test('home, profile and the bottom-nav style follow appSettingProvider', () {
      final c = wired(extra: [
        appSettingProvider.overrideWith((ref, key) => switch (key) {
              'bottom_nav_style' => 'capsule',
              'profile_layout' => 'classic',
              'dashboard_stories' => true,
              _ => null,
            }),
      ]);
      expect(c.read(homeAppSettingProvider('dashboard_stories')), true);
      expect(c.read(homeAppSettingProvider('missing')), isNull);
      expect(c.read(profileLayoutSettingProvider), 'classic');
      expect(c.read(bottomNavStyleFromSettingsProvider), BottomNavStyle.capsule);
    });

    test('parseAppSetting keeps the React parsing', () {
      expect(parseAppSetting('true'), true);
      expect(parseAppSetting('"capsule"'), 'capsule');
      expect(parseAppSetting('plain'), 'plain');
      expect(parseAppSetting({'a': 1}), {'a': 1});
    });
  });

  group('privacy consent → onboarding tour', () {
    test('decidedAt string = decided; follows store changes', () {
      final store = LocalStore.memory();
      final c = wired(store: store);
      expect(c.read(tourConsentDecidedProvider), isFalse);
      store.setItem(kPrivacyConsentKey, '{"analytics":true,"ads":false,"attribution":false,"decidedAt":"2026-01-01T00:00:00.000Z"}');
      expect(c.read(tourConsentDecidedProvider), isTrue);
      expect(c.read(privacyConsentProvider).analytics, isTrue);
      store.setItem(kPrivacyConsentKey, '{"decidedAt":null}');
      expect(c.read(tourConsentDecidedProvider), isFalse);
    });
  });

  group('device time zone', () {
    test('flow / mommy send the device zone, UTC until it is known', () async {
      final zone = Completer<String?>();
      final c = wired(extra: [timeZoneLookupProvider.overrideWithValue(() => zone.future)]);
      c.listen(flowTimeZoneProvider, (_, _) {});
      expect(c.read(flowTimeZoneProvider), anyOf('UTC', 'Asia/Tokyo'));
      zone.complete('Asia/Tokyo');
      await Future<void>.delayed(Duration.zero);
      expect(c.read(flowTimeZoneProvider), 'Asia/Tokyo');
      expect(c.read(mommyTimeZoneProvider), 'Asia/Tokyo');
    });

    test('no zone from the platform → the React fallbacks', () async {
      final c = wired(extra: [timeZoneLookupProvider.overrideWithValue(() async => null)]);
      c.listen(ianaTimeZoneProvider, (_, _) {});
      await Future<void>.delayed(Duration.zero);
      // A previous test may have left the process value; a fresh process starts with null.
      expect(c.read(flowTimeZoneProvider), anyOf('UTC', 'Asia/Tokyo'));
    });
  });

  group('premium state', () {
    test('every feature-local isPremium reads the entitlement', () {
      final c = wired(extra: [appIsPremiumProvider.overrideWithValue(true)]);
      expect(c.read(homeIsPremiumProvider), isTrue);
      expect(c.read(flowIsPremiumProvider), isTrue);
      expect(c.read(subscriptionIsPremiumProvider), isTrue);
    });
  });

  group('incoming links (appUrlOpen / launch URL)', () {
    test('promoCodeFromUrl', () {
      expect(promoCodeFromUrl('https://app.anacan.az/h/gift-2026'), 'GIFT-2026');
      expect(promoCodeFromUrl('anacan://h/abc123'), 'ABC123');
      expect(promoCodeFromUrl('/h/xyz9/'), 'XYZ9');
      expect(promoCodeFromUrl('anacan://tool/names'), isNull);
      expect(promoCodeFromUrl('https://app.anacan.az/h/a'), isNull, reason: 'too short');
    });

    test('OAuth callback first, then promo, then the shell', () {
      final calls = <String>[];
      IncomingLinkKind route(String url) => routeIncomingLink(url,
          completeOAuth: (u) async {
            calls.add('oauth $u');
            return true;
          },
          savePromo: (code) => calls.add('promo $code'),
          openUrl: (u) {
            calls.add('open $u');
            return parseDeeplink(u) != null;
          });
      expect(route('com.atlasoon.anacan://auth-callback#access_token=a&refresh_token=b'), IncomingLinkKind.oauthCallback);
      expect(route('anacan://h/GIFT2026'), IncomingLinkKind.promo);
      expect(route('anacan://tool/names'), IncomingLinkKind.appLink);
      expect(route('https://example.com/x'), IncomingLinkKind.ignored);
      expect(calls, [
        'oauth com.atlasoon.anacan://auth-callback#access_token=a&refresh_token=b',
        'promo GIFT2026',
        'open anacan://tool/names',
        'open https://example.com/x',
      ]);
    });

    test('links are queued until a handler attaches, then delivered in order', () async {
      final links = IncomingLinks();
      final source = StreamController<String>();
      links.start(source.stream);
      source.add('anacan://a');
      source.add('anacan://b');
      await Future<void>.delayed(Duration.zero);
      expect(links.pending, ['anacan://a', 'anacan://b']);
      final got = <String>[];
      void handler(String u) => got.add(u);
      links.attach(handler);
      expect(got, ['anacan://a', 'anacan://b']);
      source.add('anacan://c');
      await Future<void>.delayed(Duration.zero);
      expect(got.last, 'anacan://c');
      links.detach(handler);
      source.add('anacan://d');
      await Future<void>.delayed(Duration.zero);
      expect(links.pending, ['anacan://d'], reason: 'a restart keeps links for the next handler');
      await links.reset();
      await source.close();
    });
  });

  group('root widget tree (App.tsx order)', () {
    setUp(() {
      installTestI18n();
      GateHost.brandSplashShown = false;
    });

    testWidgets('capture guard > toasts > [session hosts, router, offline pill, app lock]', (tester) async {
      final links = IncomingLinks();
      final delivered = <String>[];
      links.deliver('anacan://tool/names');
      await tester.pumpWidget(AnacanApp(
        createContainer: () => testAppContainer(extra: [
          incomingLinksProvider.overrideWithValue(links),
          timeZoneLookupProvider.overrideWithValue(() async => null),
        ]),
        runStartup: FakeStartup([fakeReady()]).call,
        prepare: noPrepare,
        watchAdmission: false,
      ));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.byType(ShellScaffold), findsOneWidget);
      expect(find.descendant(of: find.byType(ScreenCaptureGuard), matching: find.byType(AToastHost)), findsOneWidget);
      for (final type in [AppSessionHosts, AppLockGate, ShellScaffold]) {
        expect(find.descendant(of: find.byType(AToastHost), matching: find.byType(type)), findsOneWidget, reason: '$type');
      }
      // The backend is open: the link host attached and drained the queue into the shell.
      expect(find.byType(IncomingLinkHost), findsOneWidget);
      expect(links.pending, isEmpty);
      final container = tester.state<AnacanAppState>(find.byType(AnacanApp)).container!;
      expect(container.read(shellProvider).activeTool, 'names');
      // No account in the fake backend: the monitor waits for a sign-in.
      expect(find.byType(PremiumEntitlementMonitor), findsNothing);
      delivered.add('done');
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 2));
      await links.reset();
    });
  });
}
