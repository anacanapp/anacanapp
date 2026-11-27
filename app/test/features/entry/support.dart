// Ported from: (test support for the entry-flow widget tests — no React counterpart)
import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/entry/entry_services.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/user_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';
import '../../support/i18n_fakes.dart';

/// No-op native mirrors.
class FakeUserStorePlatform implements UserStorePlatform {
  final prefs = <String, String>{};
  final languages = <String>[];
  @override
  void languageChanged(String language) => languages.add(language);
  @override
  void writePreference(String key, String value) => prefs[key] = value;
}

/// Records every call; results configurable per test.
class FakeAuthActions implements EntryAuthActions {
  final calls = <String>[];
  AuthResult<Object?> signInResult = const AuthResult();
  AuthResult<String?> signUpResult = const AuthResult(data: 'registered-user');
  AuthResult<Object?> googleResult = const AuthResult();
  AuthResult<Object?> appleResult = const AuthResult();
  AuthResult<void> resetResult = const AuthResult();
  AuthResult<Object?> updatePasswordResult = const AuthResult();
  String? sessionUser = 'registered-user';
  List<String?>? sessionSequence;
  Object? Function(String code)? onLink;
  bool pairing = true;
  final linked = <String>[];
  final signUps = <List<Object?>>[];
  final signIns = <List<String>>[];

  @override
  Future<AuthResult<Object?>> signIn(String email, String password) async {
    calls.add('signIn');
    signIns.add([email, password]);
    return signInResult;
  }

  @override
  Future<AuthResult<String?>> signUp(String email, String password, String name, String? countryCode) async {
    calls.add('signUp');
    signUps.add([email, password, name, countryCode]);
    return signUpResult;
  }

  @override
  Future<AuthResult<Object?>> signInWithGoogle() async {
    calls.add('google');
    return googleResult;
  }

  @override
  Future<AuthResult<Object?>> signInWithApple() async {
    calls.add('apple');
    return appleResult;
  }

  @override
  Future<AuthResult<void>> resetPassword(String email) async {
    calls.add('reset:$email');
    return resetResult;
  }

  @override
  Future<AuthResult<Object?>> updatePassword(String password) async {
    calls.add('update:$password');
    return updatePasswordResult;
  }

  @override
  Future<void> signOut() async => calls.add('signOut');

  @override
  Future<String?> sessionUserId() async {
    calls.add('getSession');
    final seq = sessionSequence;
    if (seq != null && seq.isNotEmpty) return seq.length == 1 ? seq.first : seq.removeAt(0);
    return sessionUser;
  }

  @override
  Future<void> linkPartnerByCode(String code) async {
    calls.add('link:$code');
    if (!pairing) throw const PartnerLinkError('PAIRING_UNAVAILABLE');
    final normalized = normalizeSecurePartnerCode(code);
    linked.add(normalized);
    final err = onLink?.call(normalized);
    if (err != null) throw err;
  }

  @override
  bool get partnerPairingEnabled => pairing;

  @override
  Future<void> refreshProfile() async => calls.add('refreshProfile');
}

/// Fresh i18n runtime (tr → az defaults) and a memory LocalStore.
LocalStore entryTestSetup() {
  installTestI18n();
  final store = LocalStore(MemoryLocalStoreBackend(), debounce: const Duration(days: 1));
  addTearDown(() {
    unawaited(store.flush()); // cancels the debounce timer
  });
  return store;
}

List<Override> baseOverrides(LocalStore store, {FakeUserStorePlatform? platform, Future<String?> Function()? geo}) => [
      localStoreProvider.overrideWithValue(store),
      i18nRuntimeProvider.overrideWithValue(I18nRuntime.instance),
      userStorePlatformProvider.overrideWithValue(platform ?? FakeUserStorePlatform()),
      geoCountryFetcherProvider.overrideWithValue(geo ?? () async => null),
      deviceLocalesProvider.overrideWithValue(const [Locale('az', 'AZ')]),
      loginLogoUrlProvider.overrideWith((ref) async => null),
    ];

/// Pumps [child] in a 390×844 app frame (theme, direction, toasts) under [overrides].
Future<ProviderContainer> pumpEntry(
  WidgetTester tester,
  Widget child, {
  required List<Override> overrides,
  bool dark = false,
  bool rtl = false,
  bool reduceMotion = true,
  AToastController? toasts,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(overrides: overrides);
  addTearDown(container.dispose);
  final locale = rtl ? const Locale('ar') : const Locale('az');
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MediaQuery(
      data: MediaQueryData(size: const Size(390, 844), disableAnimations: reduceMotion),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: locale, lite: false),
        builder: (context, child) => Directionality(
          textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
          child: DefaultAssetBundle(bundle: EntryTestBundle(), child: AToastHost(controller: toasts, child: child!)),
        ),
        home: MediaQuery(
          data: MediaQueryData(size: const Size(390, 844), disableAnimations: reduceMotion),
          child: Material(type: MaterialType.transparency, child: child),
        ),
      ),
    ),
  ));
  await tester.pump();
  return container;
}

/// Lets images/SVGs decode, then compares with `goldens/<name>.png`.
Future<void> expectGolden(WidgetTester tester, String name) async {
  await settleSvgs(tester);
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

Future<void> flushAsync(WidgetTester tester, [int times = 5]) async {
  for (var i = 0; i < times; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump();
  }
}

/// Completer-backed async value for tests.
Completer<T> pending<T>() => Completer<T>();

/// `assets/images/entry/**` is not declared in pubspec.yaml yet (the build owner adds it); tests read those
/// files from disk and everything else from the root bundle.
class EntryTestBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    if (key.startsWith('assets/images/entry/')) {
      final bytes = File(key).readAsBytesSync();
      return ByteData.view(Uint8List.fromList(bytes).buffer);
    }
    return rootBundle.load(key);
  }
}
