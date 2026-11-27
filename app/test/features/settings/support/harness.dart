// Ported from: (test harness for the profile / settings / security / support / legal ports — no React counterpart)
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../design/harness.dart';
import '../../../support/i18n_fakes.dart';

export '../../../design/harness.dart' show loadAnacanFonts, settleSvgs;

User testUser({String id = 'user-1', String email = 'leyla@example.com'}) =>
    User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z', email: email);

Profile testProfile(Map<String, dynamic> row) => Profile({'id': 'p1', 'user_id': 'user-1', 'name': 'Leyla', 'email': 'leyla@example.com', ...row});

/// LocalStore pre-seeded with the zustand `anacan-user-store` envelope (+ extra raw keys).
LocalStore seededStore({Map<String, Object?> user = const {}, Map<String, String> extra = const {}}) => LocalStore.memory({
      'anacan-user-store': jsonEncode({
        'state': {'isAuthenticated': true, 'userId': 'user-1', 'name': 'Leyla', 'email': 'leyla@example.com', 'role': 'woman', 'language': 'az', ...user},
        'version': 0,
      }),
      ...extra,
    });

/// Standard overrides: memory LocalStore, a fresh query client, signed-in user + profile + roles.
List<Override> baseOverrides({
  LocalStore? store,
  User? user,
  Profile? profile,
  bool isAdmin = false,
  bool isModerator = false,
  bool signedIn = true,
}) {
  final client = QueryClient();
  return <Override>[
    localStoreProvider.overrideWithValue(store ?? seededStore()),
    queryClientProvider.overrideWithValue(client),
    authUserProvider.overrideWithValue(signedIn ? (user ?? testUser()) : null),
    authProfileProvider.overrideWithValue(signedIn ? (profile ?? testProfile(const {})) : null),
    isAdminProvider.overrideWithValue(isAdmin),
    isModeratorProvider.overrideWithValue(isModerator || isAdmin),
  ];
}

/// Pumps [child] inside the app theme (light/dark, RTL) at 390×844 (or [size]).
Future<void> pumpApp(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const <Override>[],
  bool dark = false,
  bool rtl = false,
  Size size = const Size(390, 844),
  bool scroll = true,
}) async {
  installTestI18n();
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: Locale(rtl ? 'ar' : 'az'), lite: false),
      builder: (context, nav) => MediaQuery(
        data: MediaQueryData(size: size, disableAnimations: true),
        child: GalleryFrame(dark: dark, rtl: rtl, child: nav!),
      ),
      home: Builder(
        builder: (context) => ColoredBox(
          color: AnacanTokens.of(context).a.bg,
          child: scroll ? SingleChildScrollView(child: child) : child,
        ),
      ),
    ),
  ));
  await tester.pump();
}

/// Lets SVGs decode, then compares the whole screen with `goldens/<name>.png`.
Future<void> expectGolden(WidgetTester tester, String name) async {
  await settleSvgs(tester);
  await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/$name.png'));
}

/// `testWidgets` that unmounts the tree and flushes the cache gc / LocalStore debounce timers afterwards.
void screenTest(String description, Future<void> Function(WidgetTester tester) body, {bool skip = false}) {
  testWidgets(description, (tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(days: 8));
  }, skip: skip);
}
