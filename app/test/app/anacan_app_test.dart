// Ported from: src/main.tsx (admission error screen: updateRequired / connectionPending, retry = reload),
//              src/App.tsx (ThemeProvider, DirectionProvider), src/pages/Index.tsx (splash gate) — no vitest file;
//              the app root is exercised with fakes for every StartupResult branch.
import 'dart:async';

import 'package:anacan/app/anacan_app.dart';
import 'package:anacan/app/theme_mode.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/core/i18n/tr.dart';
import 'package:anacan/design/design.dart' show AnacanTokens, AToastHost;
import 'package:anacan/features/startup/startup.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../support/i18n_fakes.dart';
import 'app_test_support.dart';

void main() {
  late I18nRuntime runtime;

  setUp(() {
    runtime = installTestI18n();
    GateHost.brandSplashShown = false;
  });

  Future<AnacanAppState> pumpApp(
    WidgetTester tester,
    FakeStartup startup, {
    ProviderContainer Function()? container,
  }) async {
    await tester.pumpWidget(AnacanApp(
      createContainer: container ?? () => testAppContainer(),
      runStartup: startup.call,
      prepare: noPrepare,
      watchAdmission: false,
    ));
    return tester.state<AnacanAppState>(find.byType(AnacanApp));
  }

  Future<void> settleTimers(WidgetTester tester) async {
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  }

  group('before the startup result', () {
    testWidgets('the first frame is the startup splash', (tester) async {
      final pending = Completer<StartupResult>();
      await pumpApp(tester, FakeStartup([pending.future]));
      expect(find.byType(StartupScreen), findsOneWidget);
      expect(find.text('Anacan'), findsOneWidget);
      expect(find.byType(MaterialApp), findsNothing);
      pending.complete(const StartupMaintenance());
      await tester.pump();
      await tester.pump();
      await settleTimers(tester);
    });
  });

  group('admission failures (src/main.tsx catch)', () {
    testWidgets('update required → updateRequired copy + retry', (tester) async {
      await pumpApp(tester, FakeStartup([const StartupUpdateRequired()]));
      await tester.pump();
      await tester.pump();
      expect(find.byType(AdmissionScreen), findsOneWidget);
      expect(find.text('Davam etmək üçün Anacan tətbiqini mağazadan yeniləyin.'), findsOneWidget);
      expect(find.text('Yenidən cəhd et'), findsOneWidget);
      await settleTimers(tester);
    });

    testWidgets('maintenance → connectionPending copy', (tester) async {
      await pumpApp(tester, FakeStartup([const StartupMaintenance()]));
      await tester.pump();
      await tester.pump();
      expect(find.text('Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.'), findsOneWidget);
      await settleTimers(tester);
    });

    testWidgets('retry failure → connectionPending in the stored language (ru)', (tester) async {
      final store = LocalStore.memory({'anacan-user-store': '{"state":{"language":"ru"},"version":0}'});
      await pumpApp(tester, FakeStartup([const StartupRetry(StartupFailureReason.sessionRecoveryPending)]),
          container: () => testAppContainer(store: store));
      await tester.pump();
      await tester.pump();
      expect(find.text('Подготовка подключения. Повторите попытку чуть позже.'), findsOneWidget);
      expect(find.text('Повторить'), findsOneWidget);
      await settleTimers(tester);
    });

    testWidgets('Arabic stored language → RTL retry screen', (tester) async {
      final store = LocalStore.memory({'language': 'ar'});
      await pumpApp(tester, FakeStartup([const StartupMaintenance()]), container: () => testAppContainer(store: store));
      await tester.pump();
      await tester.pump();
      expect(Directionality.of(tester.element(find.text('حاولي مرة أخرى'))), TextDirection.rtl);
      await settleTimers(tester);
    });

    testWidgets('retry reloads: a fresh container and a new startup run', (tester) async {
      final created = <ProviderContainer>[];
      final startup = FakeStartup([const StartupRetry(StartupFailureReason.unexpected), const StartupUpdateRequired()]);
      await pumpApp(tester, startup, container: () {
        final c = testAppContainer();
        created.add(c);
        return c;
      });
      await tester.pump();
      await tester.pump();
      expect(find.text('Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.'), findsOneWidget);
      await tester.tap(find.text('Yenidən cəhd et'));
      await tester.pump();
      expect(find.byType(StartupScreen), findsOneWidget);
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(startup.runs, 2);
      expect(created, hasLength(2));
      expect(find.text('Davam etmək üçün Anacan tətbiqini mağazadan yeniləyin.'), findsOneWidget);
      await settleTimers(tester);
    });

    testWidgets('a throwing startup shows the retry screen', (tester) async {
      await tester.pumpWidget(AnacanApp(
        createContainer: () => testAppContainer(),
        runStartup: (_) async => throw StateError('boom'),
        prepare: noPrepare,
        watchAdmission: false,
      ));
      await tester.pump();
      await tester.pump();
      expect(find.byType(AdmissionScreen), findsOneWidget);
      await settleTimers(tester);
    });
  });

  group('opened → routed app', () {
    for (final entry in <String, StartupResult Function()>{
      'ready': fakeReady,
      'signed out': fakeSignedOut,
      'needs language': fakeNeedsLanguage,
    }.entries) {
      testWidgets('${entry.key}: MaterialApp.router with the splash gate, then the shell', (tester) async {
        await pumpApp(tester, FakeStartup([entry.value()]));
        await tester.pump();
        await tester.pump();
        expect(find.byType(MaterialApp), findsOneWidget);
        expect(find.byType(GateHost), findsOneWidget);
        // Index's 350 ms brand splash is the registered startup gate.
        expect(find.byType(SplashScreen), findsOneWidget);
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pump();
        expect(find.byType(SplashScreen), findsNothing);
        expect(find.byType(ShellScaffold), findsOneWidget);
        await settleTimers(tester);
      });
    }

    testWidgets('auth loading shows the StartupScreen gate', (tester) async {
      await pumpApp(tester, FakeStartup([fakeReady()]),
          container: () => testAppContainer(inputs: const GateInputs(
                hasSelectedLanguage: true,
                hasSeenIntro: true,
                isOnboarded: true,
                isAuthenticated: true,
                authLoading: true,
                hasUser: true,
              )));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.byType(StartupScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
      await settleTimers(tester);
    });

    testWidgets('Arabic → RTL directionality and the ar locale', (tester) async {
      runtime.setLanguageInMemory('ar');
      await pumpApp(tester, FakeStartup([fakeReady()]));
      await tester.pump();
      await tester.pump();
      final context = tester.element(find.byType(GateHost));
      expect(Directionality.of(context), TextDirection.rtl);
      expect(Localizations.localeOf(context).languageCode, 'ar');
      expect(AnacanTokens.of(context).arabic, isTrue);
      await settleTimers(tester);
    });

    testWidgets('Azerbaijani → LTR', (tester) async {
      await pumpApp(tester, FakeStartup([fakeReady()]));
      await tester.pump();
      await tester.pump();
      final context = tester.element(find.byType(GateHost));
      expect(Directionality.of(context), TextDirection.ltr);
      expect(Localizations.localeOf(context), const Locale('az', 'AZ'));
      await settleTimers(tester);
    });

    testWidgets('a toast host is mounted once above the router', (tester) async {
      await pumpApp(tester, FakeStartup([fakeReady()]));
      await tester.pump();
      await tester.pump();
      expect(find.byType(AToastHost), findsOneWidget);
      expect(AToastHost.of(tester.element(find.byType(GateHost))), isNotNull);
      await settleTimers(tester);
    });
  });

  group('theme mode (next-themes `theme` key)', () {
    testWidgets('persisted dark choice renders the dark theme; switching writes the key', (tester) async {
      final store = LocalStore.memory({'theme': 'dark'});
      final app = await pumpApp(tester, FakeStartup([fakeReady()]), container: () => testAppContainer(store: store));
      await tester.pump();
      await tester.pump();
      BuildContext ctx() => tester.element(find.byType(GateHost));
      expect(Theme.of(ctx()).brightness, Brightness.dark);
      app.container!.read(themeModeProvider.notifier).setTheme('light');
      await tester.pump();
      expect(store.getItem('theme'), 'light');
      expect(Theme.of(ctx()).brightness, Brightness.light);
      await settleTimers(tester);
    });

    testWidgets('system follows the platform brightness', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      await pumpApp(tester, FakeStartup([fakeReady()]));
      await tester.pump();
      await tester.pump();
      expect(Theme.of(tester.element(find.byType(GateHost))).brightness, Brightness.dark);
      await settleTimers(tester);
    });
  });
}
