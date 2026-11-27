// Ported from: (test harness for the AI & media tool ports — the vi.mock setups of CryTranslator.test.tsx,
//              NoiseMeter.test.tsx and WeatherClothing.test.tsx)
import 'dart:async';
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/design/design.dart';
import 'package:anacan/domain/billing/usage_limits.dart' show UsageDecision;
import 'package:anacan/features/legal/medical_disclaimer.dart' show emergencyNumberProvider;
import 'package:anacan/features/tools/health_common/health_db.dart';
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

import '../../../support/i18n_fakes.dart';

/// One recorded backend call.
typedef DbCall = ({String op, String table, Object? body});

/// In-memory [MediaDb]: rows per table, scripted function answers, recorded calls.
class FakeMediaDb implements MediaDb {
  final Map<String, List<Map<String, dynamic>>> tables = {};
  final List<DbCall> calls = [];

  /// `functions.invoke` answers by function name (a value, a Future, or a function of the body).
  final Map<String, Object? Function(Object? body)> functions = {};

  /// `insert` answer override (e.g. a never-completing future).
  Future<Map<String, dynamic>> Function(String table, Map<String, dynamic> row)? onInsert;

  List<DbCall> callsOf(String op, [String? table]) => [
    for (final c in calls)
      if (c.op == op && (table == null || c.table == table)) c,
  ];

  @override
  Future<List<Map<String, dynamic>>> select(HQuery query) async {
    calls.add((op: 'select', table: query.table, body: query));
    Iterable<Map<String, dynamic>> rows = tables[query.table] ?? const [];
    for (final f in query.filters) {
      if (f.op == 'eq') rows = rows.where((r) => r[f.column] == f.value);
    }
    return [for (final r in rows) Map<String, dynamic>.of(r)];
  }

  @override
  Future<Map<String, dynamic>> insert(String table, Map<String, dynamic> row) {
    calls.add((op: 'insert', table: table, body: row));
    final custom = onInsert;
    if (custom != null) return custom(table, row);
    final stored = {'id': '$table-${(tables[table] ?? const []).length + 1}', 'created_at': '2026-11-27T10:00:00Z', ...row};
    (tables[table] ??= []).add(stored);
    return Future.value(stored);
  }

  @override
  Future<Map<String, dynamic>?> upsert(String table, Map<String, dynamic> row, {required String onConflict}) async {
    calls.add((op: 'upsert', table: table, body: row));
    final stored = {'id': '$table-1', ...row};
    (tables[table] ??= []).add(stored);
    return stored;
  }

  @override
  Future<Map<String, dynamic>?> update(String table, Map<String, dynamic> patch, List<HFilter> filters, {bool returning = false}) async {
    calls.add((op: 'update', table: table, body: patch));
    Map<String, dynamic>? last;
    for (final r in tables[table] ?? <Map<String, dynamic>>[]) {
      if (filters.every((f) => r[f.column] == f.value)) {
        r.addAll(patch);
        last = Map<String, dynamic>.of(r);
      }
    }
    return returning ? last : null;
  }

  @override
  Future<void> delete(String table, List<HFilter> filters) async {
    calls.add((op: 'delete', table: table, body: filters));
    tables[table]?.removeWhere((r) => filters.every((f) => r[f.column] == f.value));
  }

  @override
  Future<DbResult<Object?>> invoke(String name, {Object? body}) async {
    calls.add((op: 'invoke', table: name, body: body));
    final answer = functions[name]?.call(body);
    final resolved = answer is Future ? await answer : answer;
    if (resolved is DbResult<Object?>) return resolved;
    return DbResult<Object?>(data: resolved);
  }

  @override
  Future<String?> signedUrl(String bucket, String path, int seconds) async => 'https://cdn.test/$bucket/$path';
}

/// Scripted `useSubscription()`.
class FakeUsage implements MediaUsage {
  FakeUsage({this.isPremium = true});
  @override
  bool isPremium;
  final List<String> consumed = [];
  final List<num> tracked = [];
  Future<UsageDecision> Function(String feature)? onConsume;
  double remainingDaily = 3;
  ({bool allowed, double remainingSeconds}) whiteNoise = (allowed: true, remainingSeconds: double.infinity);
  ({bool allowed, double remainingCount}) photoshoot = (allowed: true, remainingCount: double.infinity);

  @override
  Future<UsageDecision> checkAndConsume(String feature) {
    consumed.add(feature);
    return onConsume?.call(feature) ?? Future.value(const UsageDecision(allowed: true, remaining: 1, limit: 3));
  }

  @override
  Future<({double remaining, double limit})> peekRemainingDaily(String feature) async => (remaining: remainingDaily, limit: 3.0);

  @override
  ({bool allowed, double remainingSeconds}) canUseWhiteNoise() => whiteNoise;

  @override
  Future<void> trackWhiteNoiseUsage(num seconds) async => tracked.add(seconds);

  @override
  Future<({bool allowed, double remainingCount})> canUseBabyPhotoshoot() async => photoshoot;
}

/// The mocks shared by the tool tests (toasts, paywall, backend, usage, tel links).
class MediaEnv {
  MediaEnv({this.profile, this.userId = 'u1', String language = 'az', Map<String, Object?> user = const {}})
    : store = LocalStore.memory({
        'anacan-user-store': jsonEncode({
          'state': {'isAuthenticated': true, 'userId': userId, 'name': 'Leyla', 'role': 'woman', 'language': language, 'countryCode': 'AZ', ...user},
          'version': 0,
        }),
      });

  final Profile? profile;
  final String? userId;
  final LocalStore store;
  final FakeMediaDb db = FakeMediaDb();
  final FakeUsage usage = FakeUsage();
  final List<MediaToastData> toasts = [];
  final List<String> paywalls = [];
  final List<Uri> calls = [];
  final List<String> shares = [];
  String language = 'en';

  List<Override> get overrides => [
    localStoreProvider.overrideWithValue(store),
    queryClientProvider.overrideWithValue(QueryClient()),
    authProfileProvider.overrideWithValue(profile),
    mediaDbProvider.overrideWithValue(db),
    mediaUsageProvider.overrideWithValue(usage),
    mediaUserIdProvider.overrideWithValue(profile == null ? null : userId),
    mediaAuthUserIdProvider.overrideWithValue(userId),
    mediaToastProvider.overrideWithValue((context, t) => toasts.add(t)),
    mediaPremiumModalProvider.overrideWithValue((context, feature) async => paywalls.add(feature)),
    mediaLanguageProvider.overrideWithValue(() => language),
    mediaHapticsProvider.overrideWithValue(MediaHaptics(light: () async {}, medium: () async {}, heavy: () async {})),
    mediaShareProvider.overrideWithValue(({text, title, url}) async {
      shares.add(text ?? '');
      return true;
    }),
    emergencyNumberProvider.overrideWithValue('103'),
    safetyCallLauncherProvider.overrideWithValue((uri) async => calls.add(uri)),
  ];
}

/// Pumps a tool body the way the hub shows it (box tab: unbounded height inside a scroll view).
Future<void> pumpMediaTool(WidgetTester tester, Widget child, {List<Override> overrides = const [], Size size = const Size(390, 2400)}) async {
  installTestI18n();
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(
          data: MediaQueryData(size: size, disableAnimations: true),
          child: nav!,
        ),
        home: AToastHost(child: SingleChildScrollView(child: child)),
      ),
    ),
  );
  await tester.pump();
}

/// Unmounts the tree and flushes timers.
Future<void> unmountMediaTool(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(days: 8)); // flushes the query cache gc timers
}

/// Lets pending microtasks / zero timers run.
Future<void> settle(WidgetTester tester, [int times = 5]) async {
  for (var i = 0; i < times; i++) {
    await tester.pump();
  }
}

/// A never-completing future (`new Promise(() => {})`).
Future<T> never<T>() => Completer<T>().future;
