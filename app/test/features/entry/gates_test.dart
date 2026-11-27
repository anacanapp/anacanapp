// Ported from: (behaviour of src/components/AppIntroduction.tsx, EmailVerificationScreen.tsx, BlockedScreen.tsx,
//              CountryGate.tsx + CountrySelect.tsx, src/pages/ResetPassword.tsx, Index.tsx gate wiring; there are no
//              vitest cases for these screens) + src/data/email-verification/email-verification.test.ts + goldens.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/entry/auth/reset_password_page.dart';
import 'package:anacan/features/entry/blocked/blocked_screen.dart';
import 'package:anacan/features/entry/country/country_gate.dart';
import 'package:anacan/features/entry/country/country_select.dart';
import 'package:anacan/features/entry/data/email_verification_copy.g.dart';
import 'package:anacan/features/entry/email/email_verification_screen.dart';
import 'package:anacan/features/entry/entry_feature.dart';
import 'package:anacan/features/entry/entry_services.dart';
import 'package:anacan/features/entry/intro/app_introduction.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/state/user_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../design/harness.dart';
import 'support.dart';

final _user = User.fromJson({
  'id': 'user-1',
  'aud': 'authenticated',
  'created_at': '2026-11-01T00:00:00Z',
  'app_metadata': <String, dynamic>{},
  'user_metadata': <String, dynamic>{},
})!;

class _FakeEmailApi {
  final sent = <String>[];
  final confirmed = <String>[];
  VerificationResult sendResult = const VerificationResult(ok: true, retryIn: 60);
  VerificationResult confirmResult = const VerificationResult(ok: true);
  EmailVerificationApi get api => EmailVerificationApi(
        send: (lang) async {
          sent.add(lang);
          return sendResult;
        },
        confirm: (code, lang) async {
          confirmed.add(code);
          return confirmResult;
        },
      );
}

void main() {
  setUpAll(loadAnacanFonts);

  group('e-mail verification copy', () {
    test('exists in all 25 languages with the same keys and placeholders', () {
      expect(kEmailVerificationCopy, hasLength(25));
      final az = kEmailVerificationCopy['az']!;
      final ph = RegExp(r'\{\w+\}');
      for (final entry in kEmailVerificationCopy.entries) {
        expect(entry.value.keys.toSet(), az.keys.toSet(), reason: entry.key);
        for (final k in az.keys) {
          expect(ph.allMatches(entry.value[k]!).map((m) => m[0]).toList()..sort(),
              ph.allMatches(az[k]!).map((m) => m[0]).toList()..sort(),
              reason: '${entry.key}.$k');
        }
      }
    });

    test('matches src/data/email-verification/*.json (ui part)', () {
      for (final lang in kEmailVerificationCopy.keys) {
        final json = jsonDecode(File('../src/data/email-verification/$lang.json').readAsStringSync()) as Map;
        expect(kEmailVerificationCopy[lang], Map<String, String>.from(json['ui'] as Map), reason: lang);
      }
    });
  });

  group('AppIntroduction', () {
    testWidgets('renders the family and completes on "Başlayaq"', (tester) async {
      final store = entryTestSetup();
      var done = 0;
      await pumpEntry(tester, AppIntroduction(onComplete: () => done++), overrides: baseOverrides(store));
      expect(find.text('Hər mərhələdə, yanınızda.'), findsOneWidget);
      expect(find.text('Menstruasiya'), findsOneWidget);
      expect(find.text('Hamiləlik'), findsOneWidget);
      expect(find.text('Analıq'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('intro-start')));
      expect(done, 1);
    });

    test('onboardingText falls back to the bundled column; unknown languages use az', () {
      entryTestSetup();
      expect(introText('ru', 'start'), 'Начнём');
      expect(introText('xx', 'start'), 'Başlayaq');
      expect(introText('az', 'companion', {'name': 'Ritm'}), 'Ritm — yol yoldaşınız');
      expect(lifeStageName('bump', 'tk'), 'Göwrelilik');
    });

    for (final dark in [false, true]) {
      testWidgets('intro ${dark ? 'dark' : 'light'} golden', (tester) async {
        final store = entryTestSetup();
        await pumpEntry(tester, AppIntroduction(onComplete: () {}), overrides: baseOverrides(store), dark: dark);
        await expectGolden(tester, 'intro_${dark ? 'dark' : 'light'}');
      });
    }
    testWidgets('intro rtl golden', (tester) async {
      final store = entryTestSetup();
      final c = await pumpEntry(tester, AppIntroduction(onComplete: () {}), overrides: baseOverrides(store), rtl: true);
      c.read(userStoreProvider.notifier).setLanguage('ar');
      await tester.pump();
      await expectGolden(tester, 'intro_rtl');
    });
  });

  group('EmailVerificationScreen', () {
    late _FakeEmailApi api;
    late FakeAuthActions auth;
    setUp(() {
      api = _FakeEmailApi();
      auth = FakeAuthActions();
      emailCodeSentThisSession.clear();
    });

    Future<void> pump(WidgetTester tester, {VoidCallback? onVerified, bool dark = false}) async {
      final store = entryTestSetup();
      await pumpEntry(
        tester,
        EmailVerificationScreen(email: 'mama@example.invalid', onVerified: onVerified ?? () {}),
        overrides: [
          ...baseOverrides(store),
          emailVerificationApiProvider.overrideWithValue(api.api),
          authUserProvider.overrideWithValue(_user),
          entryAuthActionsProvider.overrideWithValue(auth),
        ],
        dark: dark,
      );
      await flushAsync(tester);
    }

    testWidgets('sends the first code once per session and counts down the resend', (tester) async {
      await pump(tester);
      expect(api.sent, ['az']);
      expect(find.text('Kod göndərildi ✓'), findsOneWidget);
      expect(find.text('Yenidən göndərmək: 60 san'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Yenidən göndərmək: 59 san'), findsOneWidget);
      await tester.pump(const Duration(seconds: 60));
      expect(find.text('Kodu yenidən göndər'), findsOneWidget);
    });

    testWidgets('a wrong code clears the field and shows the error; six digits confirm and verify after 900 ms', (tester) async {
      var verified = 0;
      await pump(tester, onVerified: () => verified++);
      api.confirmResult = const VerificationResult(ok: false, error: 'wrong_code');
      await tester.enterText(find.byKey(const ValueKey('email-code')), '12a3456');
      await flushAsync(tester);
      expect(api.confirmed, ['123456']);
      expect(find.text('Kod yanlışdır. Yenidən yoxla.'), findsOneWidget);
      expect(tester.widget<TextField>(find.byKey(const ValueKey('email-code'))).controller!.text, '');
      api.confirmResult = const VerificationResult(ok: true);
      await tester.enterText(find.byKey(const ValueKey('email-code')), '654321');
      await flushAsync(tester);
      expect(find.text('E-poçtun təsdiqləndi 🎉'), findsOneWidget);
      expect(verified, 0);
      await tester.pump(const Duration(milliseconds: 900));
      expect(verified, 1);
    });

    testWidgets('"wrong e-mail" signs out', (tester) async {
      await pump(tester);
      await tester.tap(find.byKey(const ValueKey('email-wrong')));
      await tester.pump();
      expect(auth.calls, ['signOut']);
      await tester.pump(const Duration(seconds: 61));
    });

    testWidgets('email light golden', (tester) async {
      await pump(tester);
      await expectGolden(tester, 'email_light');
      await tester.pump(const Duration(seconds: 61));
    });
    testWidgets('email dark golden', (tester) async {
      await pump(tester, dark: true);
      await expectGolden(tester, 'email_dark');
      await tester.pump(const Duration(seconds: 61));
    });
  });

  group('BlockedScreen', () {
    const block = ActiveBlock(id: 'b1', blockType: 'full', reason: 'Spam', createdAt: '2026-11-01T00:00:00Z');
    testWidgets('shows the reason, "permanent" without an expiry, and signs out', (tester) async {
      final store = entryTestSetup();
      final auth = FakeAuthActions();
      await pumpEntry(tester, const BlockedScreen(block: block),
          overrides: [...baseOverrides(store), entryAuthActionsProvider.overrideWithValue(auth)]);
      expect(find.text('Spam'), findsOneWidget);
      expect(find.textContaining('Bu blok daimidir.', findRichText: true), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('blocked-signout')));
      expect(auth.calls, ['signOut']);
    });
    test('expiry text includes the year', () {
      entryTestSetup();
      expect(blockExpiryText('2027-03-05T10:20:00Z'), contains('2027'));
      expect(blockExpiryText(null), isNull);
    });
    for (final dark in [false, true]) {
      testWidgets('blocked ${dark ? 'dark' : 'light'} golden', (tester) async {
        final store = entryTestSetup();
        await pumpEntry(
            tester,
            const BlockedScreen(
                block: ActiveBlock(id: 'b1', blockType: 'full', reason: null, expiresAt: '2027-03-05T10:20:00', createdAt: '')),
            overrides: baseOverrides(store),
            dark: dark);
        await expectGolden(tester, 'blocked_${dark ? 'dark' : 'light'}');
      });
    }
  });

  group('CountryGate / CountrySelect', () {
    test('CountrySelect search matches the English name or the ISO code', () {
      expect(filterCountrySelect('  azer ').map((c) => c.$1), ['AZ']);
      expect(filterCountrySelect('tr').map((c) => c.$1), contains('TR'));
      expect(filterCountrySelect('').length, 239);
      expect(filterCountrySelect('qqqq'), isEmpty);
    });

    Future<(ProviderContainer, FakeAuthActions, List<String>)> pump(WidgetTester tester,
        {Object? writeError, bool dark = false, VoidCallback? onDone}) async {
      final store = entryTestSetup();
      final auth = FakeAuthActions();
      final writes = <String>[];
      final c = await pumpEntry(tester, CountryGate(onDone: onDone ?? () {}), overrides: [
        ...baseOverrides(store),
        authUserProvider.overrideWithValue(_user),
        entryAuthActionsProvider.overrideWithValue(auth),
        profileCountryWriterProvider.overrideWithValue((userId, code) async {
          if (writeError != null) throw writeError;
          writes.add('$userId:$code');
        }),
      ], dark: dark);
      return (c, auth, writes);
    }

    testWidgets('Continue stays disabled until a country is picked; saving writes the profile, store and refreshes',
        (tester) async {
      var done = 0;
      final (c, auth, writes) = await pump(tester, onDone: () => done++);
      expect(tester.widget<GestureDetector>(find.byKey(const ValueKey('country-gate-save'))).onTap, isNull);
      await tester.tap(find.byKey(const ValueKey('country-select-trigger')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('country-select-search')), 'germ');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('country-option-DE')));
      await tester.pumpAndSettle();
      expect(find.text('Germany'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('country-gate-save')));
      await flushAsync(tester);
      expect(writes, ['user-1:DE']);
      expect(c.read(userStoreProvider).countryCode, 'DE');
      expect(auth.calls, ['refreshProfile']);
      expect(done, 1);
    });

    testWidgets('a failed save shows the error toast and does not finish', (tester) async {
      var done = 0;
      final toasts = AToastController();
      addTearDown(toasts.dispose);
      final store = entryTestSetup();
      await pumpEntry(tester, CountryGate(onDone: () => done++), overrides: [
        ...baseOverrides(store),
        authUserProvider.overrideWithValue(_user),
        entryAuthActionsProvider.overrideWithValue(FakeAuthActions()),
        profileCountryWriterProvider.overrideWithValue((_, _) async => throw StateError('denied')),
      ], toasts: toasts);
      await tester.tap(find.byKey(const ValueKey('country-select-trigger')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('country-select-search')), 'azer');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('country-option-AZ')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('country-gate-save')));
      await flushAsync(tester);
      expect(done, 0);
      expect(find.text('Xəta baş verdi'), findsOneWidget);
    });

    for (final dark in [false, true]) {
      testWidgets('country gate ${dark ? 'dark' : 'light'} golden', (tester) async {
        await pump(tester, dark: dark);
        await expectGolden(tester, 'country_gate_${dark ? 'dark' : 'light'}');
      });
    }
  });

  group('ResetPassword', () {
    late FakeAuthActions auth;
    late AToastController toasts;
    var home = 0;
    setUp(() {
      auth = FakeAuthActions();
      toasts = AToastController();
      home = 0;
    });

    Future<void> pump(WidgetTester tester, {bool dark = false, bool rtl = false}) async {
      final store = entryTestSetup();
      addTearDown(toasts.dispose);
      await pumpEntry(tester, ResetPasswordPage(onHome: () => home++),
          overrides: [...baseOverrides(store), entryAuthActionsProvider.overrideWithValue(auth)],
          toasts: toasts, dark: dark, rtl: rtl);
      await flushAsync(tester);
    }

    testWidgets('warns when there is no recovery session', (tester) async {
      auth.sessionUser = null;
      await pump(tester);
      expect(find.text('Sessiya tapılmadı'), findsOneWidget);
    });

    testWidgets('validates required, length ≥ 6 and match, then updates and goes home after 2 s', (tester) async {
      await pump(tester);
      Future<void> submit() async {
        await tester.tap(find.byKey(const ValueKey('reset-submit')));
        await flushAsync(tester);
      }

      await submit();
      expect(find.text('Şifrə tələb olunur'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('reset-password')), '123');
      await tester.enterText(find.byKey(const ValueKey('reset-confirm')), '123');
      await submit();
      expect(find.text('Şifrə çox qısadır'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('reset-password')), '123456');
      await tester.enterText(find.byKey(const ValueKey('reset-confirm')), '1234567');
      await submit();
      expect(find.text('Şifrələr uyğun gəlmir'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('reset-confirm')), '123456');
      await submit();
      expect(auth.calls.last, 'update:123456');
      expect(find.text('Şifrə Yeniləndi!'), findsOneWidget);
      expect(home, 0);
      await tester.pump(const Duration(seconds: 2));
      expect(home, 1);
    });

    for (final dark in [false, true]) {
      testWidgets('reset ${dark ? 'dark' : 'light'} golden', (tester) async {
        await pump(tester, dark: dark);
        await tester.pump(const Duration(seconds: 6));
        await expectGolden(tester, 'reset_${dark ? 'dark' : 'light'}');
      });
    }
  });

  group('registerEntryFeature', () {
    test('registers every entry gate and the reset-password route', () {
      final r = FeatureRegistry()..registerAll([registerEntryFeature]);
      expect(r.registeredIds, {
        'gate:initialLanguage', 'gate:intro', 'gate:auth', 'gate:blocked', 'gate:emailVerification', 'gate:consent',
        'gate:country', 'route:resetPassword',
      });
    });
  });
}

