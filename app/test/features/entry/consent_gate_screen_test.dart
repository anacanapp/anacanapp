// Ported from: src/components/consent/ConsentGateScreen.test.tsx, src/components/consent/consentSaveFeedback.test.tsx
//              (case names kept) + goldens.
import 'dart:io';

import 'package:anacan/design/design.dart';
import 'package:anacan/features/entry/consent/consent_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate_controller.dart';
import 'package:anacan/features/entry/consent/consent_gate_screen.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';
import 'consent_gate_test.dart' show FakeRpc;
import 'support.dart';

class _Toasts extends AToastController {
  final shown = <({String? title, bool destructive, Widget? action})>[];
  @override
  int show({String? title, String? description, bool destructive = false, Widget? action, Duration duration = AToastController.radixDuration}) {
    shown.add((title: title, destructive: destructive, action: action));
    return super.show(title: title, description: description, destructive: destructive, action: action, duration: duration);
  }
}

void main() {
  setUpAll(loadAnacanFonts);
  late FakeRpc rpc;
  late _Toasts toasts;
  late int accepted, signOuts;
  final opened = <Uri>[];

  setUp(() {
    rpc = FakeRpc()..fallback = () => {'gate': {'enabled': true, 'version': '2.0'}, 'consents': {}};
    toasts = _Toasts();
    accepted = 0;
    signOuts = 0;
    opened.clear();
  });

  Future<void> pump(WidgetTester tester, {bool kvkk = false, bool dark = false, bool rtl = false}) async {
    final store = entryTestSetup();
    addTearDown(toasts.dispose);
    final registry = FeatureRegistry()
      ..registerScreen(ScreenId.legal, (context, a) => Column(children: [
            Text('legal:${a.screen.param}', key: const ValueKey('legal-screen')),
            GestureDetector(onTap: a.onBack, child: const Text('back')),
          ]));
    await pumpEntry(
      tester,
      ConsentGateScreen(
        userId: 'u1',
        backend: 'https://api.anacan.az',
        version: '2.0',
        kvkk: kvkk,
        onAccepted: () => accepted++,
        onSignOut: () => signOuts++,
      ),
      overrides: [
        ...baseOverrides(store),
        consentServiceProvider.overrideWithValue(ConsentService(store: store, rpc: rpc.call, source: 'android')),
        featureRegistryProvider.overrideWithValue(registry),
        kvkkNoticeOpenerProvider.overrideWithValue((uri) async => opened.add(uri)),
      ],
      toasts: toasts,
      dark: dark,
      rtl: rtl,
    );
  }

  bool checked(WidgetTester tester, String kind) =>
      find.descendant(of: find.byKey(ValueKey('consent-$kind')), matching: find.byWidgetPredicate((w) => w is AIcon)).evaluate().isNotEmpty;

  bool continueEnabled(WidgetTester tester) =>
      tester.widget<GestureDetector>(find.byKey(const ValueKey('consent-continue'))).onTap != null;

  Future<void> tick(WidgetTester tester, String kind) async {
    await tester.ensureVisible(find.byKey(ValueKey('consent-$kind')));
    await tester.tap(find.byKey(ValueKey('consent-$kind')));
    await tester.pump();
  }

  group('ConsentGateScreen', () {
    testWidgets('renders every item unticked with the medical note, and Continue disabled', (tester) async {
      await pump(tester);
      expect(find.text('İstifadə Şərtləri və Məxfilik Siyasəti ilə tanış oldum və qəbul edirəm'), findsOneWidget);
      expect(find.text('16 yaşdan böyükəm'), findsOneWidget);
      expect(find.textContaining('Anacan tibbi xidmət deyil; məlumatlar həkim məsləhətini əvəz etmir.', findRichText: true), findsOneWidget);
      for (final kind in ['terms', 'health_data', 'age_16', 'marketing']) {
        expect(checked(tester, kind), isFalse);
      }
      expect(continueEnabled(tester), isFalse);
    });

    testWidgets('enables Continue only after the three required items and records them without marketing', (tester) async {
      await pump(tester);
      await tick(tester, 'terms');
      await tick(tester, 'health_data');
      expect(continueEnabled(tester), isFalse);
      await tick(tester, 'age_16');
      expect(continueEnabled(tester), isTrue);
      await tester.ensureVisible(find.byKey(const ValueKey('consent-continue')));
      await tester.tap(find.byKey(const ValueKey('consent-continue')));
      await flushAsync(tester);
      expect(accepted, 1);
      final call = rpc.calls.singleWhere((c) => c.$1 == 'record_consents_v1');
      expect(call.$2!['p_source'], 'android');
      expect(call.$2!['p_items'], [
        {'kind': 'terms', 'granted': true, 'version': '2.0'},
        {'kind': 'health_data', 'granted': true, 'version': '2.0'},
        {'kind': 'age_16', 'granted': true, 'version': '2.0'},
        {'kind': 'marketing', 'granted': false, 'version': '2.0'},
      ]);
    });

    testWidgets('still lets the user in when recording fails (kept locally, sent later)', (tester) async {
      rpc.fallback = () => throw const SocketException('Failed to fetch');
      await pump(tester);
      for (final kind in ['terms', 'health_data', 'age_16']) {
        await tick(tester, kind);
      }
      await tester.ensureVisible(find.byKey(const ValueKey('consent-continue')));
      await tester.tap(find.byKey(const ValueKey('consent-continue')));
      await flushAsync(tester);
      expect(accepted, 1);
      expect(toasts.shown.single.title, 'Seçiminiz cihazda saxlanıldı, internet olanda göndəriləcək.');
    });

    testWidgets("shows the KVKK notice and the owner's Turkish texts for Türkiye users, with İYS channels unticked", (tester) async {
      await pump(tester, kvkk: true);
      await tester.tap(find.byKey(const ValueKey('consent-kvkk-notice')));
      expect(opened, [Uri.parse('https://anacan.az/kvkk')]);
      expect(find.textContaining('″ANACAN″ Mahdud Mesuliyyetli Cemiyyeti'), findsOneWidget);
      expect(find.textContaining('Çocuğumun velisi veya yasal temsilcisi'), findsOneWidget);
      expect(find.textContaining('6563 sayılı Elektronik Ticaretin'), findsOneWidget);
      for (final kind in ['child_data', 'marketing_email', 'marketing_push', 'marketing_sms']) {
        expect(checked(tester, kind), isFalse);
      }
      expect(find.byKey(const ValueKey('consent-marketing')), findsNothing);
      for (final kind in ['terms', 'health_data', 'age_16', 'marketing_push']) {
        await tick(tester, kind);
      }
      await tester.ensureVisible(find.byKey(const ValueKey('consent-continue')));
      await tester.tap(find.byKey(const ValueKey('consent-continue')));
      await flushAsync(tester);
      expect(accepted, 1);
      final items = rpc.calls.singleWhere((c) => c.$1 == 'record_consents_v1').$2!['p_items'] as List;
      expect(items, hasLength(8));
      expect(items, contains(equals({'kind': 'marketing_push', 'granted': true, 'version': '2.0', 'variant': 'kvkk_tr'})));
      expect(items, contains(equals({'kind': 'child_data', 'granted': false, 'version': '2.0', 'variant': 'kvkk_tr'})));
    });

    testWidgets('opens the legal documents in-app and signs out on request', (tester) async {
      await pump(tester);
      await tester.ensureVisible(find.textContaining('Tibbi xəbərdarlıq', findRichText: true));
      await tester.tapOnText(find.textRange.ofSubstring('Tibbi xəbərdarlıq'));
      await tester.pump();
      expect(find.text('legal:disclaimer'), findsOneWidget);
      await tester.tap(find.text('back'));
      await tester.pump();
      await tester.ensureVisible(find.textContaining('Məxfilik Siyasəti', findRichText: true).last);
      await tester.tapOnText(find.textRange.ofSubstring('Məxfilik Siyasəti').last);
      await tester.pump();
      expect(find.text('legal:privacy_policy'), findsOneWidget);
      await tester.tap(find.text('back'));
      await tester.pump();
      await tester.ensureVisible(find.text('Çıxış et'));
      await tester.tap(find.text('Çıxış et'));
      expect(signOuts, 1);
    });
  });

  group('consent save feedback', () {
    late ConsentService service;
    setUp(() => service = ConsentService(store: LocalStore.memory(), rpc: rpc.call));

    test('says "saved on this device" only for a real offline failure', () {
      showConsentSaveFailure(toasts, service, offline: true, backend: 'https://api.anacan.az', userId: 'u1');
      expect(toasts.shown.single.title, 'Seçiminiz cihazda saxlanıldı, internet olanda göndəriləcək.');
      expect(toasts.shown.single.destructive, isFalse);
      toasts.dispose();
    });

    testWidgets('shows a localized error with a retry for a server failure, and retries the stored decision', (tester) async {
      entryTestSetup();
      addTearDown(toasts.dispose);
      showConsentSaveFailure(toasts, service, offline: false, backend: 'https://api.anacan.az', userId: 'u1');
      final call = toasts.shown.single;
      expect(call.title, 'Seçiminizi indi qeydə almaq alınmadı. Bir az sonra yenidən cəhd edin.');
      expect(call.title, isNot(contains('internet olanda')));
      expect(call.destructive, isTrue);
      await tester.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: call.action!));
      await tester.tap(find.text('Yenidən cəhd et'));
      await flushAsync(tester);
      expect(toasts.shown.last.title, 'Razılıq yeniləndi');
    });
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      testWidgets('consent ${dark ? 'dark' : 'light'}', (tester) async {
        await pump(tester, dark: dark);
        await expectGolden(tester, 'consent_${dark ? 'dark' : 'light'}');
      });
    }
    testWidgets('consent rtl', (tester) async {
      await pump(tester, rtl: true);
      await expectGolden(tester, 'consent_rtl');
    });
  });
}
