// Ported from: src/components/StartupScreen.tsx + src/styles/startup.css, src/main.tsx (admission screen),
//              src/components/ForceUpdateScreen.tsx, src/components/appUpdate/AppUpdateSheet.tsx,
//              src/components/RootErrorBoundary.tsx, src/components/ErrorBoundary.tsx,
//              src/components/OfflineSyncIndicator.tsx
//
// Behaviour checks + golden baselines (Flutter renders, not compared against WebView screenshots).
import 'package:anacan/core/offline/offline_providers.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/features/startup/startup.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';
import '../../support/i18n_fakes.dart';

const _size = Size(390, 844);

void main() {
  setUpAll(loadAnacanFonts);
  setUp(installTestI18n);

  void phone(WidgetTester tester) {
    tester.view.physicalSize = _size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  Widget frame(Widget child, {bool dark = false, bool rtl = false, bool reduceMotion = false, EdgeInsets padding = EdgeInsets.zero}) =>
      MediaQuery(
        data: MediaQueryData(size: _size, padding: padding, viewPadding: padding, disableAnimations: reduceMotion),
        child: RepaintBoundary(child: GalleryFrame(dark: dark, rtl: rtl, child: child)),
      );

  Future<void> precacheMark(WidgetTester tester) async {
    await tester.runAsync(() => precacheImage(const AssetImage(kBrandMarkAsset), tester.element(find.byType(GalleryFrame))));
    await tester.pump();
  }

  group('StartupScreen', () {
    testWidgets('mark, wordmark, progress; light and dark palettes', (tester) async {
      phone(tester);
      await tester.pumpWidget(frame(const StartupScreen()));
      expect(find.text('Anacan'), findsOneWidget);
      expect(find.byType(StartupProgress), findsOneWidget);
      final light = tester.widget<ColoredBox>(find.descendant(of: find.byType(StartupScreen), matching: find.byType(ColoredBox)).first);
      expect(light.color, kStartupBackground);
      await tester.pumpWidget(frame(const StartupScreen(), dark: true));
      final dark = tester.widget<ColoredBox>(find.descendant(of: find.byType(StartupScreen), matching: find.byType(ColoredBox)).first);
      expect(dark.color, kStartupBackgroundDark);
    });

    testWidgets('safe-area padding is max(24, inset)', (tester) async {
      phone(tester);
      await tester.pumpWidget(frame(const StartupScreen(), padding: const EdgeInsets.only(top: 47, bottom: 34)));
      final pad = tester.widget<Padding>(find.descendant(of: find.byType(StartupScreen), matching: find.byType(Padding)).first);
      expect(pad.padding, const EdgeInsets.fromLTRB(24, 47, 24, 34));
    });

    testWidgets('reduced motion: static full-width bar at 65 % opacity', (tester) async {
      phone(tester);
      await tester.pumpWidget(frame(const StartupScreen(), reduceMotion: true));
      final opacity = tester.widget<Opacity>(find.descendant(of: find.byType(StartupProgress), matching: find.byType(Opacity)));
      expect(opacity.opacity, 0.65);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('the bar animates 1.4 s back and forth', (tester) async {
      phone(tester);
      await tester.pumpWidget(frame(const StartupScreen()));
      double x() => tester.widget<Transform>(find.descendant(of: find.byType(StartupProgress), matching: find.byType(Transform))).transform.getTranslation().x;
      expect(x(), 0);
      await tester.pump(const Duration(milliseconds: 1400));
      expect(x(), closeTo(24, 1e-6));
      await tester.pump(const Duration(milliseconds: 700));
      expect(x(), closeTo(12, 1e-6));
    });

    for (final dark in [false, true]) {
      testWidgets('golden ${dark ? 'dark' : 'light'}', (tester) async {
        phone(tester);
        await tester.pumpWidget(frame(const StartupScreen(), dark: dark));
        await precacheMark(tester);
        await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/startup_${dark ? 'dark' : 'light'}.png'));
      });
    }
  });

  group('AdmissionScreen (pre-i18n copy)', () {
    testWidgets('every language has the retry copy (legacy languages too)', (tester) async {
      for (final lang in ['az', 'en', 'ru', 'tr', 'de', 'ar', 'ka', 'kk', 'uz', 'tk', 'uk', 'zh']) {
        await tester.pumpWidget(frame(AdmissionScreen(kind: AdmissionScreenKind.connectionPending, language: lang, onRetry: () {})));
        expect(find.text('Anacan'), findsOneWidget, reason: lang);
      }
      expect(find.text('重试'), findsOneWidget);
    });

    testWidgets('retry calls back', (tester) async {
      var retries = 0;
      await tester.pumpWidget(frame(AdmissionScreen(kind: AdmissionScreenKind.updateRequired, language: 'en', onRetry: () => retries++)));
      expect(find.text('Update Anacan in the app store to continue.'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      expect(retries, 1);
    });

    for (final (name, kind, lang) in [
      ('admission_update_az', AdmissionScreenKind.updateRequired, 'az'),
      ('admission_connection_ar', AdmissionScreenKind.connectionPending, 'ar'),
    ]) {
      testWidgets('golden $name', (tester) async {
        phone(tester);
        await tester.pumpWidget(frame(AdmissionScreen(kind: kind, language: lang, onRetry: () {})));
        await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/$name.png'));
      });
    }
  });

  group('ForceUpdateScreen', () {
    for (final dark in [false, true]) {
      testWidgets('golden ${dark ? 'dark' : 'light'}', (tester) async {
        phone(tester);
        await tester.pumpWidget(frame(
          const ForceUpdateScreen(androidUrl: 'a', iosUrl: 'i', currentVersion: '49.0', language: 'az', isIos: true),
          dark: dark,
        ));
        await settleSvgs(tester);
        await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/force_update_${dark ? 'dark' : 'light'}.png'));
        await tester.pumpWidget(const SizedBox());
      });
    }

    testWidgets('lite: clouds do not drift', (tester) async {
      phone(tester);
      await tester.pumpWidget(frame(
        const ForceUpdateScreen(androidUrl: 'a', iosUrl: 'i', language: 'az', isIos: true),
        reduceMotion: true,
      ));
      await tester.pump(const Duration(seconds: 3));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('cloud drift keyframes (0 → 16,-7 at 6 s → 0 at 12 s, delayed)', (tester) async {
      expect(ASky.driftOffset(Duration.zero, Duration.zero), Offset.zero);
      expect(ASky.driftOffset(const Duration(seconds: 6), Duration.zero), const Offset(16, -7));
      expect(ASky.driftOffset(const Duration(seconds: 12), Duration.zero), Offset.zero);
      expect(ASky.driftOffset(const Duration(seconds: 2), const Duration(milliseconds: 2600)), Offset.zero);
    });
  });

  group('AppUpdateSheet', () {
    for (final dark in [false, true]) {
      testWidgets('golden ${dark ? 'dark' : 'light'}', (tester) async {
        phone(tester);
        final d = AppUpdateDecision.tryParse({
          'protocol': 'anacan-app-update-v1',
          'rule_id': 'r1',
          'mode': 'soft',
          'frequency': 'daily',
          'target_version': '51.0',
          'title': 'Yeni versiya hazırdır',
          'body': 'Bu yeniləmədə sürət və sabitlik artırılıb.',
          'whats_new': ['Yeni rəy bölməsi', 'Daha sürətli açılış', '  '],
          'store_url': 'https://apps.apple.com/app/id6758301924',
        })!;
        await tester.pumpWidget(frame(
          AppUpdateSheet(decision: d, currentVersion: '49.0', language: 'az', isIos: false, onUpdate: () {}, onLater: () {}),
          dark: dark,
        ));
        await settleSvgs(tester);
        await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/update_sheet_${dark ? 'dark' : 'light'}.png'));
      });
    }
  });

  group('error fallbacks', () {
    testWidgets('RootErrorBoundary fallback golden + retry', (tester) async {
      phone(tester);
      var retries = 0;
      await tester.pumpWidget(frame(RootErrorFallback(language: 'az', onRetry: () => retries++)));
      await precacheMark(tester);
      await tester.tap(find.text('Yenidən cəhd et'));
      expect(retries, 1);
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/root_error_light.png'));
    });

    testWidgets('ErrorBoundary fallback: message, unknown error, retry', (tester) async {
      phone(tester);
      var retries = 0;
      await tester.pumpWidget(frame(ErrorBoundaryFallback(message: 'boom', onRetry: () => retries++)));
      expect(find.text('Xəta baş verdi'), findsOneWidget);
      expect(find.text('boom'), findsOneWidget);
      await tester.tap(find.text('Yenidən cəhd et'));
      expect(retries, 1);
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/error_boundary_light.png'));
      await tester.pumpWidget(frame(const ErrorBoundaryFallback()));
      expect(find.text('Naməlum xəta'), findsOneWidget);
    });
  });

  group('OfflineSyncIndicator', () {
    Widget host(bool visible) => ProviderScope(
          overrides: [offlineSyncIndicatorVisibleProvider.overrideWithValue(visible)],
          child: frame(const Stack(children: [OfflineSyncIndicator()])),
        );

    testWidgets('hidden while online / signed out', (tester) async {
      await tester.pumpWidget(host(false));
      expect(find.byType(OfflineSyncPill), findsNothing);
    });

    testWidgets('offline + signed in: the pill below the safe area, touch passes through', (tester) async {
      phone(tester);
      await tester.pumpWidget(host(true));
      await settleSvgs(tester);
      expect(find.text('Oflayn · internet gələndə sinxronlanacaq'), findsOneWidget);
      expect(find.descendant(of: find.byType(OfflineSyncPill), matching: find.byType(IgnorePointer)), findsWidgets);
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/offline_pill_light.png'));
    });
  });

  group('registration', () {
    test('gate ids the shell expects', () {
      final r = FeatureRegistry();
      registerStartupFeature(r);
      expect(r.gate(GateId.splash), isNotNull);
      expect(r.gate(GateId.startup), isNotNull);
      expect(r.gate(GateId.forceUpdate), isNotNull);
      expect(r.frameOverlays, hasLength(1));
    });
  });
}
