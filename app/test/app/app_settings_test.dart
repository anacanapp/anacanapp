// Ported from: src/lib/device-tier.ts, src/App.tsx (LITE_DEVICE / a-noblur), node_modules/next-themes (theme key
//              values), src/components/ThemeStatusBarSync.tsx, the WebView text-zoom decision
//              (docs/flutter/APP_ROOT.md §4), src/lib/startup-i18n.ts (storedStartupLanguage)
import 'package:anacan/app/app_overrides.dart';
import 'package:anacan/app/device_tier.dart';
import 'package:anacan/app/feature_registrations.dart';
import 'package:anacan/app/startup_language.dart';
import 'package:anacan/app/system_chrome.dart';
import 'package:anacan/app/theme_mode.dart';
import 'package:anacan/core/i18n/language_preferences.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/design/device_tier.dart';
import 'package:anacan/features/startup/startup.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../support/i18n_fakes.dart';
import 'app_test_support.dart';

void main() {
  group('device tier', () {
    test('Chromium deviceMemory approximation', () {
      expect(approximateDeviceMemoryGb(1900), 2);
      expect(approximateDeviceMemoryGb(3000), 2);
      expect(approximateDeviceMemoryGb(3072), 4);
      expect(approximateDeviceMemoryGb(3700), 4);
      expect(approximateDeviceMemoryGb(5600), 4);
      expect(approximateDeviceMemoryGb(7500), 8);
      expect(approximateDeviceMemoryGb(16000), 8);
      expect(approximateDeviceMemoryGb(200), 0.25);
      expect(approximateDeviceMemoryGb(0), 0);
    });

    test('Android is always lite + noBlur; iOS by cores / memory', () {
      const strong = DeviceHardware(cores: 6);
      const weak = DeviceHardware(cores: 4);
      expect(DeviceTier.resolve(android: true, hardware: strong), const DeviceTier(lite: true, noBlur: true));
      expect(DeviceTier.resolve(android: false, hardware: strong), const DeviceTier(lite: false, noBlur: false));
      expect(DeviceTier.resolve(android: false, hardware: weak), const DeviceTier(lite: true, noBlur: false));
      expect(DeviceTier.resolve(android: false, hardware: const DeviceHardware()), const DeviceTier(lite: false, noBlur: false));
    });

    test('probe result feeds liteModeProvider (html.a-lite)', () async {
      final c = ProviderContainer(overrides: appRootOverrides(includeShellState: false));
      addTearDown(c.dispose);
      await c.read(deviceTierProvider.notifier).probe(FakeHardwareProbe(const DeviceHardware(cores: 2)), android: false);
      expect(c.read(liteModeProvider), isTrue);
      await c.read(deviceTierProvider.notifier).probe(FakeHardwareProbe(const DeviceHardware(cores: 8, memoryGb: 8)), android: false);
      expect(c.read(liteModeProvider), isFalse);
    });

    test('a failing probe counts as unknown hardware', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(deviceTierProvider.notifier).probe(_ThrowingProbe(), android: false);
      expect(c.read(deviceTierProvider), const DeviceTier(lite: false, noBlur: false));
    });
  });

  group('theme mode (next-themes)', () {
    test('stored values', () {
      expect(themeModeFor(null), ThemeMode.system);
      expect(themeModeFor(''), ThemeMode.system);
      expect(themeModeFor('system'), ThemeMode.system);
      expect(themeModeFor('dark'), ThemeMode.dark);
      expect(themeModeFor('light'), ThemeMode.light);
      // An unknown class matches no CSS → the light palette.
      expect(themeModeFor('sepia'), ThemeMode.light);
    });

    test('reads, writes and follows the `theme` key', () {
      final store = LocalStore.memory({'theme': 'dark'});
      final c = ProviderContainer(overrides: [localStoreProvider.overrideWithValue(store)]);
      addTearDown(c.dispose);
      expect(c.read(themeModeProvider), ThemeMode.dark);
      expect(c.read(themeModeProvider.notifier).theme, 'dark');
      c.read(themeModeProvider.notifier).setTheme('system');
      expect(store.getItem('theme'), 'system');
      expect(c.read(themeModeProvider), ThemeMode.system);
      // storage event from another writer (e.g. the migration import)
      store.setItem('theme', 'light');
      expect(c.read(themeModeProvider), ThemeMode.light);
      store.removeItem('theme');
      expect(c.read(themeModeProvider), ThemeMode.system);
      expect(c.read(themeModeProvider.notifier).theme, 'system');
    });

    test('a fresh container keeps the persisted choice', () {
      final store = LocalStore.memory();
      final a = ProviderContainer(overrides: [localStoreProvider.overrideWithValue(store)]);
      a.read(themeModeProvider.notifier).setTheme('dark');
      a.dispose();
      final b = ProviderContainer(overrides: [localStoreProvider.overrideWithValue(store)]);
      addTearDown(b.dispose);
      expect(b.read(themeModeProvider), ThemeMode.dark);
    });
  });

  group('status bar (ThemeStatusBarSync)', () {
    test('dark theme → light icons, light theme → dark icons, transparent bars', () {
      final dark = statusBarStyleFor(dark: true);
      expect(dark.statusBarIconBrightness, Brightness.light);
      expect(dark.statusBarBrightness, Brightness.dark);
      final light = statusBarStyleFor(dark: false);
      expect(light.statusBarIconBrightness, Brightness.dark);
      expect(light.statusBarBrightness, Brightness.light);
      expect(light.statusBarColor, const Color(0x00000000));
    });
  });

  group('text scale (WebView text zoom)', () {
    test('iOS ignores the system size, Android scales linearly by the font scale', () {
      expect(webViewTextScaler(TargetPlatform.iOS, systemFontScale: 1.3, fallback: TextScaler.noScaling), TextScaler.noScaling);
      expect(webViewTextScaler(TargetPlatform.android, systemFontScale: 1.3, fallback: TextScaler.noScaling), const TextScaler.linear(1.3));
      expect(webViewTextScaler(TargetPlatform.android, systemFontScale: 1.3, fallback: TextScaler.noScaling).scale(20), closeTo(26, 1e-9));
    });

    testWidgets('WebViewTextScale overrides MediaQuery (bold text off)', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.5;
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(boldText: true);
      addTearDown(tester.platformDispatcher.clearAllTestValues);
      TextScaler? ios;
      TextScaler? android;
      bool? bold;
      await tester.pumpWidget(MediaQuery.fromView(
        view: tester.view,
        child: Column(children: [
          WebViewTextScale(platform: TargetPlatform.iOS, child: Builder(builder: (c) {
            ios = MediaQuery.textScalerOf(c);
            return const SizedBox();
          })),
          WebViewTextScale(platform: TargetPlatform.android, child: Builder(builder: (c) {
            android = MediaQuery.textScalerOf(c);
            bold = MediaQuery.boldTextOf(c);
            return const SizedBox();
          })),
        ]),
      ));
      expect(ios, TextScaler.noScaling);
      expect(android, const TextScaler.linear(1.5));
      expect(bold, isFalse);
    });
  });

  group('feature registrations', () {
    test('startup registers its gates and the update sheet overlay', () {
      final ids = buildFeatureRegistry().registeredIds;
      expect(ids, containsAll(['gate:splash', 'gate:startup', 'gate:forceUpdate', 'frame:$kAppUpdateSheetOverlayId']));
    });
  });

  group('storedStartupLanguage', () {
    test('zustand snapshot, then `language`, else az', () {
      installTestI18n();
      expect(storedStartupLanguage(store: LocalStore.memory({'anacan-user-store': '{"state":{"language":"uk"},"version":0}'})), 'uk');
      expect(storedStartupLanguage(store: LocalStore.memory({'language': 'tk'})), 'tk');
      expect(storedStartupLanguage(store: LocalStore.memory()), 'az');
    });

    test('a Preferences choice the runtime already restored wins', () {
      final runtime = installTestI18n()..setLanguageInMemory('de');
      expect(storedStartupLanguage(store: LocalStore.memory({'language': 'ru'}), runtime: runtime), 'de');
    });

    test('LegacyLanguagePreferenceStore reads/writes Capacitor Preferences keys', () async {
      final prefs = InMemoryLegacyPreferences();
      final store = LegacyLanguagePreferenceStore(prefs);
      await store.write(kAppLanguagePreferenceKey, 'ru');
      expect(await prefs.get('anacan_app_language'), 'ru');
      expect(await store.read(kAppLanguagePreferenceKey), 'ru');
    });
  });
}

class _ThrowingProbe implements DeviceHardwareProbe {
  @override
  Future<DeviceHardware> probe() async => throw StateError('no plugin');
}
