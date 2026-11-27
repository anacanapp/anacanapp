// Ported from: (test harness for the pregnancy tools — no React counterpart)
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ports.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ui.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../support/i18n_fakes.dart';

User testUser([String id = 'u1']) =>
    User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z', email: 'a@b.c');

Profile testProfile([Map<String, dynamic> row = const {}]) =>
    Profile({'id': 'p1', 'user_id': 'u1', 'name': 'Leyla', 'country_code': 'AZ', ...row});

/// LocalStore with the zustand `anacan-user-store` envelope.
LocalStore userStore({Map<String, Object?> user = const {}, Map<String, String> extra = const {}}) => LocalStore.memory({
      'anacan-user-store': jsonEncode({
        'state': {'isAuthenticated': true, 'userId': 'u1', 'name': 'Leyla', 'role': 'woman', 'language': 'az', 'countryCode': 'AZ', ...user},
        'version': 0,
      }),
      ...extra,
    });

/// The `mocks.server` of useBabyLogs.outbox.test.tsx: rows by id; [online] / [reject] switch the answers.
class FakeOutboxServer {
  final Map<String, Map<String, Object?>> rows = {};
  bool online = true;
  bool reject = false;

  Future<SendResult> send(String table, Map<String, Object?> row) async {
    if (!online) return const SendResult(error: {'message': 'TypeError: Failed to fetch', 'code': ''}, status: 0);
    if (reject) return const SendResult(error: {'message': 'check constraint', 'code': '23514'}, status: 400);
    final id = row['id']! as String;
    if (rows.containsKey(id)) return const SendResult(status: 201);
    final stored = {'created_at': DateTime.now().toUtc().toIso8601String(), ...row, 'table': table};
    rows[id] = stored;
    return SendResult(data: stored, status: 201);
  }

  List<Map<String, dynamic>> table(String name) =>
      [for (final r in rows.values) if (r['table'] == name) Map<String, dynamic>.from(r)];
}

class PregnancyEnv {
  PregnancyEnv({LocalStore? store, this.profile, this.signedIn = true}) : store = store ?? userStore();

  final LocalStore store;
  final Profile? profile;
  final bool signedIn;
  final FakeOutboxServer server = FakeOutboxServer();
  final ManualConnectivitySource connectivity = ManualConnectivitySource();
  final QueryClient queryClient = QueryClient();
  final List<Uri> calls = [];
  final List<String> confirms = [];
  bool confirmAnswer = true;

  late final OfflineOutbox outbox = OfflineOutbox(store: store, sender: server.send, connectivity: connectivity, log: (_) {});

  List<Override> get overrides => [
        localStoreProvider.overrideWithValue(store),
        queryClientProvider.overrideWithValue(queryClient),
        authUserProvider.overrideWithValue(signedIn ? testUser() : null),
        authProfileProvider.overrideWithValue(signedIn ? (profile ?? testProfile()) : null),
        offlineOutboxProvider.overrideWithValue(outbox),
        connectivitySourceProvider.overrideWithValue(connectivity),
        safetyCallLauncherProvider.overrideWithValue((uri) async => calls.add(uri)),
        pregnancyHapticsProvider.overrideWithValue(PregnancyHaptics(light: () async {}, medium: () async {}, heavy: () async {})),
        confirmPromptProvider.overrideWithValue((context, text) async {
          confirms.add(text);
          return confirmAnswer;
        }),
      ];
}

/// Pumps a tool body the way the hub shows it (box tab: unbounded height inside a scroll view).
Future<void> pumpTool(WidgetTester tester, Widget child, {List<Override> overrides = const [], Size size = const Size(390, 1800)}) async {
  installTestI18n();
  await tester.runAsync(ensureDateLocales);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
      builder: (context, nav) => MediaQuery(data: MediaQueryData(size: size, disableAnimations: true), child: nav!),
      home: AToastHost(child: SingleChildScrollView(child: child)),
    ),
  ));
  await tester.pump();
}

/// Unmounts the tree and flushes timers (toasts, cache gc).
Future<void> unmount(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(days: 8));
}
