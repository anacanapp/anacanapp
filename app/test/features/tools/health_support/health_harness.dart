// Ported from: (test harness for the health & lifestyle tool ports — no React counterpart)
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/data.dart';
import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:anacan/core/offline/connectivity.dart';
import 'package:anacan/core/offline/offline_outbox.dart';
import 'package:anacan/core/offline/offline_providers.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/home/data/home_repository.dart';
import 'package:anacan/features/settings/data/health_service.dart' show VitalsSource, vitalsSourceProvider;
import 'package:anacan/features/tools/data/followup_content.dart' show followupContentValuesProvider;
import 'package:anacan/features/tools/data/tools_data_source.dart';
import 'package:anacan/features/tools/health_common/health_common.dart';
import 'package:anacan/features/tools/health_common/health_db.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart' show localStoreProvider;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../support/i18n_fakes.dart';

const String testUserId = 'user-1';

/// In-memory PostgREST tables (filters, order, limit, insert / upsert / update / delete).
class FakeHealthDb implements HealthDb {
  FakeHealthDb([Map<String, List<Map<String, dynamic>>>? tables]) : tables = {for (final e in (tables ?? {}).entries) e.key: [for (final r in e.value) Map<String, dynamic>.of(r)]};

  final Map<String, List<Map<String, dynamic>>> tables;
  final List<String> calls = [];
  final Map<String, Object> failSelect = {};
  final Map<String, Object> failWrite = {};
  final List<(String, Object?)> invocations = [];
  Object? Function(String name, Object? body)? onInvoke;
  int _id = 0;

  List<Map<String, dynamic>> rows(String table) => tables[table] ?? const [];

  bool _match(Map<String, dynamic> row, List<HFilter> filters) {
    for (final f in filters) {
      final v = row[f.column];
      switch (f.op) {
        case 'eq':
          if (v != f.value) return false;
        case 'neq':
          if (v == f.value) return false;
        case 'in':
          if (!(f.value as List).contains(v)) return false;
        case 'gte' || 'gt' || 'lt' || 'lte':
          if (v == null) return false;
          final c = v is num && f.value is num ? v.compareTo(f.value as num) : '$v'.compareTo('${f.value}');
          if (f.op == 'gte' && c < 0 || f.op == 'gt' && c <= 0 || f.op == 'lt' && c >= 0 || f.op == 'lte' && c > 0) return false;
      }
    }
    return true;
  }

  @override
  Future<Rows> select(HQuery query) async {
    calls.add('select ${query.table}');
    final err = failSelect[query.table];
    if (err != null) throw err;
    var out = [for (final r in rows(query.table)) if (_match(r, query.filters)) Map<String, dynamic>.of(r)];
    for (final o in query.order.reversed) {
      out = [...out]..sort((a, b) {
          final x = a[o.column], y = b[o.column];
          final c = x == null && y == null
              ? 0
              : x == null
                  ? -1
                  : y == null
                      ? 1
                      : (x is num && y is num ? x.compareTo(y) : x is bool && y is bool ? (x ? 1 : 0).compareTo(y ? 1 : 0) : '$x'.compareTo('$y'));
          return o.ascending ? c : -c;
        });
    }
    if (query.limit != null && out.length > query.limit!) out = out.sublist(0, query.limit!);
    return out;
  }

  @override
  Future<Map<String, dynamic>?> maybeSingle(HQuery query) async {
    final r = await select(query);
    return r.isEmpty ? null : r.first;
  }

  Map<String, dynamic> _store(String table, Map<String, dynamic> row) {
    final full = {'id': 'gen-${++_id}', 'created_at': DateTime.now().toUtc().toIso8601String(), ...row};
    (tables[table] ??= []).add(full);
    return Map<String, dynamic>.of(full);
  }

  @override
  Future<Map<String, dynamic>> insert(String table, Map<String, dynamic> row) async {
    calls.add('insert $table');
    final err = failWrite[table];
    if (err != null) throw err;
    return _store(table, row);
  }

  @override
  Future<Map<String, dynamic>> upsert(String table, Map<String, dynamic> row, {required String onConflict}) async {
    calls.add('upsert $table');
    final err = failWrite[table];
    if (err != null) throw err;
    final keys = onConflict.split(',');
    final list = tables[table] ??= [];
    final i = list.indexWhere((r) => keys.every((k) => r[k] == row[k]));
    if (i < 0) return _store(table, row);
    list[i] = {...list[i], ...row};
    return Map<String, dynamic>.of(list[i]);
  }

  @override
  Future<Map<String, dynamic>?> update(String table, Map<String, dynamic> patch, List<HFilter> filters, {bool single = false}) async {
    calls.add('update $table');
    final err = failWrite[table];
    if (err != null) throw err;
    final list = tables[table] ?? [];
    Map<String, dynamic>? last;
    for (var i = 0; i < list.length; i++) {
      if (_match(list[i], filters)) list[i] = last = {...list[i], ...patch};
    }
    return last;
  }

  @override
  Future<void> delete(String table, List<HFilter> filters) async {
    calls.add('delete $table');
    final err = failWrite[table];
    if (err != null) throw err;
    tables[table]?.removeWhere((r) => _match(r, filters));
  }

  @override
  Future<DbResult<Object?>> invoke(String name, {Object? body}) async {
    invocations.add((name, body));
    return DbResult(data: onInvoke?.call(name, body));
  }
}

/// `daily_logs` of the home repository read from the fake db.
class FakeHomeRepository implements HomeRepository {
  FakeHomeRepository(this.db);
  final FakeHealthDb db;

  @override
  Future<Rows> dailyLogs(String userId) => db.select(HQuery('daily_logs', filters: [eqF('user_id', userId)], order: const [(column: 'log_date', ascending: false)], limit: 30));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Reads of the shared tool data hooks (`toolsDataSourceProvider`) from the fake db.
class FakeToolsDataSource implements ToolsDataSource {
  FakeToolsDataSource(this.db);
  final FakeHealthDb db;
  @override
  Future<Rows> select(TableQuery query) async {
    var rows = [
      for (final r in db.rows(query.table))
        if (query.eq.entries.every((e) => r[e.key] == e.value)) Map<String, dynamic>.of(r),
    ];
    for (final o in query.order.reversed) {
      rows = [...rows]..sort((a, b) {
          final c = '${a[o.column]}'.compareTo('${b[o.column]}');
          return o.ascending ? c : -c;
        });
    }
    return rows;
  }
}

class NoVitals implements VitalsSource {
  @override
  Future<List<Map<String, dynamic>>> bloodPressure(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> glucose(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> weights(String userId, String since) async => [];
}

class NoopRealtime implements HealthRealtime {
  const NoopRealtime();
  @override
  void subscribe(Ref ref, {required String channelPrefix, required String table, String? filter, required void Function() onChange}) {}
}

User testUser({String id = testUserId}) =>
    User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z', email: 'leyla@example.com');

class HealthHarness {
  HealthHarness({Map<String, Object?> user = const {}, Map<String, dynamic> profile = const {}, Map<String, List<Map<String, dynamic>>>? tables, this.online = true})
      : db = FakeHealthDb(tables),
        store = LocalStore.memory({
          'anacan-user-store': jsonEncode({
            'state': {'isAuthenticated': true, 'userId': testUserId, 'name': 'Leyla', 'role': 'woman', 'language': 'az', 'lifeStage': 'bump', 'countryCode': 'AZ', ...user},
            'version': 0,
          }),
        }),
        profileRow = {'id': 'p1', 'user_id': testUserId, 'name': 'Leyla', 'country_code': 'AZ', ...profile};

  final FakeHealthDb db;
  final LocalStore store;
  final Map<String, dynamic> profileRow;
  final bool online;
  final List<Uri> launched = [];
  final List<String> openedTools = [];
  final List<String> paywalls = [];
  final List<int> partnerMoods = [];
  late final ManualConnectivitySource connectivity = ManualConnectivitySource(online: online);

  /// The outbox sender: writes through to the fake db (offline → transient failure).
  Future<SendResult> send(String table, Map<String, Object?> row) async {
    if (!connectivity.isOnline) return const SendResult(error: 'Failed to fetch', status: 0);
    final data = Map<String, dynamic>.from(row);
    if (table == dailyLogOutboxTable) {
      final patch = {...data}..remove('id');
      return SendResult(data: await db.upsert('daily_logs', patch, onConflict: 'user_id,log_date'), status: 200);
    }
    final existing = db.rows(table).where((r) => r['id'] == data['id']).firstOrNull;
    return SendResult(data: existing ?? await db.insert(table, data), status: 201);
  }

  late final OfflineOutbox outbox = OfflineOutbox(store: store, sender: send, connectivity: connectivity);

  List<Override> get overrides => [
        localStoreProvider.overrideWithValue(store),
        queryClientProvider.overrideWithValue(QueryClient()),
        authUserProvider.overrideWithValue(testUser()),
        authProfileProvider.overrideWithValue(Profile(profileRow)),
        isAdminProvider.overrideWithValue(false),
        healthDbProvider.overrideWithValue(db),
        toolsDataSourceProvider.overrideWithValue(FakeToolsDataSource(db)),
        homeRepositoryProvider.overrideWithValue(FakeHomeRepository(db)),
        healthRealtimeProvider.overrideWithValue(const NoopRealtime()),
        healthLinkLauncherProvider.overrideWithValue((uri) async => launched.add(uri)),
        healthHapticsProvider.overrideWithValue(HealthHaptics(light: () async {}, medium: () async {})),
        healthOpenToolProvider.overrideWithValue(openedTools.add),
        healthPaywallProvider.overrideWithValue((context, feature) async => paywalls.add(feature)),
        healthMoodPartnerNotifierProvider.overrideWithValue(partnerMoods.add),
        healthBackendUrlProvider.overrideWithValue('https://test.example'),
        connectivitySourceProvider.overrideWithValue(connectivity),
        offlineOutboxProvider.overrideWithValue(outbox),
        vitalsSourceProvider.overrideWithValue(NoVitals()),
        followupContentValuesProvider.overrideWith((ref) async => const <String, Map<String, Object?>>{}),
        childrenProvider.overrideWithValue(ChildrenView(children: children, selectedChild: children.firstOrNull, loading: false, loadError: false)),
      ];

  /// `useChildren().children`.
  List<Child> children = const [];

  Future<void> pump(WidgetTester tester, Widget child, {List<Override> extra = const []}) async {
    installTestI18n();
    await ensureDateLocales();
    tester.view.physicalSize = const Size(390, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [...overrides, ...extra],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(
          data: const MediaQueryData(size: Size(390, 2400), disableAnimations: true),
          child: AToastHost(child: nav!),
        ),
        home: SingleChildScrollView(child: child),
      ),
    ));
    await settle(tester);
  }
}

/// The `Semantics` widget carrying [label] (not a visible Text with the same string).
Finder semanticsWidget(String label) => find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label);

/// Lets futures (fake db, microtasks) run and the tree rebuild, without waiting on infinite animations.
Future<void> settle(WidgetTester tester, [int frames = 6]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// `testWidgets` that unmounts and flushes timers (toasts, cache gc) afterwards.
void toolTest(String description, Future<void> Function(WidgetTester tester) body, {bool skip = false}) {
  testWidgets(description, (tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(days: 8));
  }, skip: skip);
}
