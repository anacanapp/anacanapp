// Ported from: src/components/AuthScreen.partner.test.tsx (case names kept; the four Azure Apple *web* SDK cases
//              do not apply natively — usesAzureAppleWebFlow() is false in a native build) + mode switching,
//              validation and error toasts of src/components/AuthScreen.tsx, goldens.
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/entry/auth/auth_screen.dart';
import 'package:anacan/features/entry/auth/promo.dart';
import 'package:anacan/features/entry/entry_services.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/user_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthApiException, PostgrestException;

import '../../design/harness.dart';
import 'support.dart';

class RecordingToasts extends AToastController {
  final shown = <({String? title, String? description, bool destructive, Widget? action, Duration duration})>[];
  @override
  int show({String? title, String? description, bool destructive = false, Widget? action, Duration duration = AToastController.radixDuration}) {
    shown.add((title: title, description: description, destructive: destructive, action: action, duration: duration));
    return super.show(title: title, description: description, destructive: destructive, action: action, duration: duration);
  }
}

late FakeAuthActions auth;
late RecordingToasts toasts;
late LocalStore store;
var reloads = 0;

Future<ProviderContainer> pumpAuth(WidgetTester tester,
    {AuthScreenConfig config = const AuthScreenConfig(), String? country = 'AZ', bool dark = false, bool rtl = false}) async {
  store = entryTestSetup();
  addTearDown(toasts.dispose);
  final List<Override> overrides = [
    ...baseOverrides(store),
    entryAuthActionsProvider.overrideWithValue(auth),
    authScreenConfigProvider.overrideWithValue(config),
    partnerPairingCompleteProvider.overrideWithValue(() async => reloads++),
  ];
  final c = await pumpEntry(tester, const AuthScreen(), overrides: overrides, toasts: toasts, dark: dark, rtl: rtl);
  if (country != null) c.read(userStoreProvider.notifier).setCountryCode(country);
  await tester.pump();
  return c;
}

Future<void> enter(WidgetTester tester, String key, String text) async {
  await tester.enterText(find.byKey(ValueKey(key)), text);
  await tester.pump();
}

Future<void> submit(WidgetTester tester) async {
  await tester.ensureVisible(find.byKey(const ValueKey('auth-submit')));
  await tester.tap(find.byKey(const ValueKey('auth-submit')));
  await flushAsync(tester, 8);
}

Future<void> openRegistration(WidgetTester tester, [String code = 'ANACAN-ABCD2345']) async {
  await tester.ensureVisible(find.byKey(const ValueKey('auth-partner-section')));
  await tester.tap(find.byKey(const ValueKey('auth-partner-section')));
  await tester.pump();
  await enter(tester, 'auth-email', 'pairing@example.invalid');
  await enter(tester, 'auth-password', 'Fixture-password!23');
  await enter(tester, 'auth-partner-code', code);
}

bool enabled(WidgetTester tester, String key) {
  final opacity = tester.widget<Opacity>(find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(Opacity)).first);
  return opacity.opacity == 1;
}

void main() {
  setUpAll(loadAnacanFonts);
  setUp(() {
    auth = FakeAuthActions();
    toasts = RecordingToasts();
    reloads = 0;
  });

  group('Azure provider availability', () {
    testWidgets('keeps unconfigured Azure providers inactive without calling auth', (tester) async {
      await pumpAuth(tester, config: const AuthScreenConfig(azureBackend: true));
      expect(enabled(tester, 'auth-google'), isFalse);
      expect(enabled(tester, 'auth-apple'), isFalse);
      await tester.ensureVisible(find.byKey(const ValueKey('auth-google')));
      await tester.tap(find.byKey(const ValueKey('auth-google')));
      await tester.tap(find.byKey(const ValueKey('auth-apple')));
      await flushAsync(tester);
      expect(auth.calls, isEmpty);
      expect(find.text('Deaktiv giriş üsulları bu Azure önizləməsində hələ qoşulmayıb. E-mail və şifrədən istifadə edə bilərsiniz.'),
          findsOneWidget);
    });

    testWidgets('opens only the explicitly configured Google path in Azure', (tester) async {
      await pumpAuth(tester, config: const AuthScreenConfig(azureBackend: true, azureGoogleOAuthEnabled: true));
      expect(enabled(tester, 'auth-google'), isTrue);
      expect(enabled(tester, 'auth-apple'), isFalse);
      await tester.ensureVisible(find.byKey(const ValueKey('auth-google')));
      await tester.tap(find.byKey(const ValueKey('auth-google')));
      await flushAsync(tester);
      expect(auth.calls, ['google']);
    });

    testWidgets('preserves source-build provider availability despite Azure-only flags', (tester) async {
      await pumpAuth(tester);
      expect(enabled(tester, 'auth-google'), isTrue);
      expect(enabled(tester, 'auth-apple'), isTrue);
    });
  });

  group('partner registration routing', () {
    testWidgets('refuses pairing before signup when secure pairing is unavailable, with no legacy writes', (tester) async {
      auth.pairing = false;
      await pumpAuth(tester);
      await openRegistration(tester);
      await submit(tester);
      expect(toasts.shown, isNotEmpty);
      expect(auth.calls, isEmpty);
    });

    testWidgets('rejects a legacy invitation before signup, without anonymous profile lookup', (tester) async {
      await pumpAuth(tester);
      await openRegistration(tester, 'ANACAN-A01F');
      await submit(tester);
      expect(toasts.shown.first.title, contains('share a new code'));
      expect(auth.calls, isEmpty);
    });

    testWidgets('registers then sends only the normalized code to the authenticated RPC', (tester) async {
      await pumpAuth(tester);
      await openRegistration(tester, '  anacan-abcd2345  ');
      await submit(tester);
      expect(reloads, 1);
      expect(auth.signUps.single, ['pairing@example.invalid', 'Fixture-password!23', 'Partner', 'AZ']);
      expect(auth.linked, ['ANACAN-ABCD2345']);
      expect(toasts.shown.map((t) => t.title), contains('Partner linked successfully.'));
    });

    testWidgets('allows an editable retry after signup and AuthScreen unmount, without registering again', (tester) async {
      var first = true;
      auth.onLink = (code) {
        if (first) {
          first = false;
          return const PartnerLinkError('PAIRING_CONFLICT');
        }
        return null;
      };
      await pumpAuth(tester);
      await openRegistration(tester);
      await submit(tester);
      final failure = toasts.shown.first;
      expect(failure.title, contains('not complete'));
      expect(failure.duration.inDays, greaterThan(365));
      expect(reloads, 0);
      // The retry form lives in the toast, not in the AuthScreen.
      await tester.pumpWidget(MaterialApp(home: Material(child: failure.action!)));
      await tester.enterText(find.byKey(const ValueKey('partner-retry-code')), 'anacan-bcde2345');
      await tester.tap(find.byKey(const ValueKey('partner-retry')));
      await flushAsync(tester);
      expect(reloads, 1);
      expect(auth.linked.last, 'ANACAN-BCDE2345');
      expect(auth.signUps, hasLength(1));
      expect(auth.signIns, isEmpty);
    });

    testWidgets('offers sign-in on retry when signup requires email confirmation', (tester) async {
      auth.sessionUser = null;
      await pumpAuth(tester);
      await openRegistration(tester);
      await submit(tester);
      expect(auth.linked, isEmpty);
      final failure = toasts.shown.first;
      await tester.pumpWidget(MaterialApp(home: Material(child: failure.action!)));
      auth.sessionSequence = [null, 'registered-user'];
      await tester.tap(find.byKey(const ValueKey('partner-retry')));
      await flushAsync(tester);
      expect(reloads, 1);
      expect(auth.signIns.single, ['pairing@example.invalid', 'Fixture-password!23']);
      expect(auth.signUps, hasLength(1));
    });

    testWidgets('does not link a different account after session switching', (tester) async {
      auth.sessionUser = 'different-user';
      await pumpAuth(tester);
      await openRegistration(tester);
      await submit(tester);
      expect(toasts.shown, isNotEmpty);
      expect(auth.linked, isEmpty);
      expect(reloads, 0);
    });

    for (final code in ['PGRST202', '42501']) {
      testWidgets('never reports success or uses legacy writes after $code', (tester) async {
        auth.onLink = (_) => PostgrestException(code: code, message: 'RPC unavailable');
        await pumpAuth(tester);
        await openRegistration(tester);
        await submit(tester);
        expect(toasts.shown.first.title, contains('not complete'));
        expect(auth.linked, hasLength(1));
        expect(reloads, 0);
      });
    }

    testWidgets('does not pair when signup fails', (tester) async {
      auth.signUpResult = AuthResult(error: AuthApiException('User already registered', code: 'user_already_exists'));
      await pumpAuth(tester);
      await openRegistration(tester);
      await submit(tester);
      expect(toasts.shown.single.title, 'Bu e-mail artıq qeydiyyatdan keçib. Giriş edin və ya şifrəni unutmusunuzsa bərpa edin.');
      expect(auth.linked, isEmpty);
      expect(reloads, 0);
    });

    testWidgets('leaves existing partner login code-free even when opted in', (tester) async {
      await pumpAuth(tester);
      await openRegistration(tester);
      await tester.tap(find.text('Giriş'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      await submit(tester);
      expect(auth.calls, ['signIn']);
    });
  });

  group('main form', () {
    testWidgets('login requires e-mail and password', (tester) async {
      await pumpAuth(tester);
      await submit(tester);
      expect(toasts.shown.single.title, 'Məlumat tələb olunur');
      expect(toasts.shown.single.description, 'E-mail və şifrə daxil edin.');
      expect(toasts.shown.single.destructive, isTrue);
      expect(auth.calls, isEmpty);
    });

    testWidgets('login error maps invalid credentials; success shows the welcome toast', (tester) async {
      auth.signInResult = AuthResult(error: AuthApiException('Invalid login credentials', code: 'invalid_credentials'));
      await pumpAuth(tester);
      await enter(tester, 'auth-email', 'a@b.c');
      await enter(tester, 'auth-password', 'secret1');
      await submit(tester);
      expect(toasts.shown.last.title, 'Giriş alınmadı');
      expect(toasts.shown.last.description, 'E-mail və ya şifrə yanlışdır.');
      auth.signInResult = const AuthResult();
      await submit(tester);
      expect(toasts.shown.last.title, 'Xoş gəldiniz! 👋');
      expect(auth.signIns, hasLength(2));
    });

    testWidgets('register requires a country, validates the gift code and keeps it for the redeemer', (tester) async {
      await pumpAuth(tester, country: null);
      await tester.tap(find.text('Qeydiyyat'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.byKey(const ValueKey('auth-name')), findsOneWidget);
      await enter(tester, 'auth-email', 'mama@example.invalid');
      await enter(tester, 'auth-password', 'secret12');
      await submit(tester);
      expect(toasts.shown.last.title, 'Ölkə seçin');
      final c = ProviderScope.containerOf(tester.element(find.byType(AuthScreen)));
      c.read(userStoreProvider.notifier).setCountryCode('AZ');
      await enter(tester, 'auth-promo', 'a!');
      expect(tester.widget<TextField>(find.byKey(const ValueKey('auth-promo'))).controller!.text, 'A');
      await submit(tester);
      expect(toasts.shown.last.title, 'Kod tapılmadı.');
      expect(auth.signUps, isEmpty);
      await enter(tester, 'auth-promo', 'gift-2026');
      await submit(tester);
      expect(auth.signUps.single, ['mama@example.invalid', 'secret12', 'mama', 'AZ']);
      expect(readPendingPromo(store), 'GIFT-2026');
      expect(toasts.shown.last.title, 'Qeydiyyat uğurludur! 🎉');
    });

    testWidgets('forgot password: e-mail required, link sent returns to login', (tester) async {
      await pumpAuth(tester);
      await tester.tap(find.byKey(const ValueKey('auth-forgot')));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.text('Şifrəni Bərpa Et'), findsOneWidget);
      expect(find.byKey(const ValueKey('auth-password')), findsNothing);
      await submit(tester);
      expect(toasts.shown.last.title, 'E-mail tələb olunur');
      await enter(tester, 'auth-email', 'a@b.c');
      await submit(tester);
      expect(auth.calls.last, 'reset:a@b.c');
      expect(toasts.shown.last.title, 'Link göndərildi! 📧');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.byKey(const ValueKey('auth-forgot')), findsOneWidget);
    });

    testWidgets('social errors show the provider title; a silent cancel shows nothing', (tester) async {
      await pumpAuth(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('auth-google')));
      await tester.tap(find.byKey(const ValueKey('auth-google')));
      await flushAsync(tester);
      expect(toasts.shown, isEmpty);
      auth.appleResult = AuthResult(error: SocialSignInError('apple', 'unknown', appleFailureMessage(AppleNativeFailure.unknown)));
      await tester.tap(find.byKey(const ValueKey('auth-apple')));
      await flushAsync(tester);
      expect(toasts.shown.single.title, 'Apple ilə giriş alınmadı');
      expect(toasts.shown.single.description, startsWith('Apple ilə giriş alınmadı. Ayarlarda Apple ID'));
    });

    testWidgets('password visibility toggles', (tester) async {
      await pumpAuth(tester);
      TextField field() => tester.widget<TextField>(find.byKey(const ValueKey('auth-password')));
      expect(field().obscureText, isTrue);
      await tester.tap(find.byKey(const ValueKey('auth-toggle-password')));
      await tester.pump();
      expect(field().obscureText, isFalse);
    });
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      testWidgets('auth login ${dark ? 'dark' : 'light'}', (tester) async {
        await pumpAuth(tester, dark: dark);
        await expectGolden(tester, 'auth_login_${dark ? 'dark' : 'light'}');
      });
    }
    testWidgets('auth register light', (tester) async {
      await pumpAuth(tester);
      await tester.tap(find.text('Qeydiyyat'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      await expectGolden(tester, 'auth_register_light');
    });
    testWidgets('auth partner light', (tester) async {
      await pumpAuth(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('auth-partner-section')));
      await tester.tap(find.byKey(const ValueKey('auth-partner-section')));
      await tester.pump();
      await expectGolden(tester, 'auth_partner_light');
    });
    testWidgets('auth login rtl', (tester) async {
      await pumpAuth(tester, rtl: true);
      await expectGolden(tester, 'auth_login_rtl');
    });
  });
}
