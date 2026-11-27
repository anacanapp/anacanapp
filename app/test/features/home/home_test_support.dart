// Ported from: (test support) — the vi.mock setups of the home tests: a fake HomeRepository instead of the supabase
// client (with the increment_water_intake_v1 op-id dedupe of useDailyLogs.water.test.tsx), a frozen DomainClock,
// in-memory stores, the real i18n dictionaries read from app/assets/i18n, and bundled assets read from disk.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/home/data/home_repository.dart';
import 'package:anacan/features/home/home_inputs.dart';
import 'package:anacan/features/home/home_stage_registry.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/harness.dart';

export '../../design/harness.dart';

typedef JsonRow = Map<String, dynamic>;

class _NoPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}

/// Dictionaries from app/assets/i18n on disk.
class DiskI18nAssets implements I18nAssetSource {
  @override
  Future<Map<String, String>> load(String lang) async => decodeDictionary(File('assets/i18n/$lang.json').readAsBytesSync());
}

/// Installs an i18n runtime with the real dictionaries of [languages] loaded; active language [active].
Future<I18nRuntime> installRealI18n({String active = 'az', List<String> languages = const ['az']}) async {
  final runtime = I18nRuntime(store: TranslationStore(assets: DiskI18nAssets()));
  I18nRuntime.instance = runtime;
  for (final l in {...languages, active}) {
    await runtime.ensureLanguageReady(l);
  }
  runtime.setLanguageInMemory(active);
  return runtime;
}

/// Asset bundle reading files under app/ first (assets not declared in pubspec yet), then the test bundle.
class DiskAssetBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    final f = File(key);
    if (f.existsSync()) return ByteData.view(Uint8List.fromList(f.readAsBytesSync()).buffer);
    return rootBundle.load(key);
  }
}

/// Network mode of the fake water RPC (useDailyLogs.water.test.tsx `mocks.mode`).
enum FakeMode { ok, offline, lostAnswer }

class FakeHomeRepository implements HomeRepository {
  Map<int, JsonRow> pregnancyContent = {};
  List<JsonRow> trimesterTipRows = [];
  List<JsonRow> weeklyTipRows = [];
  List<JsonRow> fruitImageRows = [];
  List<JsonRow> fetusRows = [];
  List<JsonRow> bpRows = [];
  List<JsonRow> appointmentRows = [];
  List<JsonRow> periodRows = [];
  List<JsonRow> blogRows = [];
  List<Object?> storyRows = [];
  Object? recapResult;

  /// Day → stored water / mood (`mocks.rows`).
  final Map<String, JsonRow> dailyRows = {};
  final Set<String> ops = {};
  final List<Map<String, Object?>> waterCalls = [];
  final List<(String, Object?)> calls = [];
  FakeMode mode = FakeMode.ok;

  /// Holds sends until completed (`mocks.gate`).
  Completer<void>? gate;

  /// When set, every read throws (error state).
  Object? readError;

  /// When set, reads wait for it (loading state).
  Completer<void>? readGate;

  Future<void> _read() async {
    if (readGate != null) await readGate!.future;
    if (readError != null) throw readError!;
  }

  @override
  Future<JsonRow?> pregnancyContentByDay(int day) async {
    await _read();
    if (pregnancyContent.containsKey(day)) return pregnancyContent[day];
    final earlier = pregnancyContent.keys.where((k) => k < day).toList()..sort();
    return earlier.isEmpty ? null : pregnancyContent[earlier.last];
  }

  @override
  Future<List<JsonRow>> trimesterTips(int? trimester) async {
    await _read();
    return trimesterTipRows.where((r) => trimester == null || r['trimester'] == trimester).toList();
  }

  @override
  Future<List<JsonRow>> weeklyTips(int? week, String? lifeStage) async {
    await _read();
    return weeklyTipRows.where((r) => (week == null || r['week_number'] == week) && (lifeStage == null || r['life_stage'] == lifeStage)).toList();
  }

  @override
  Future<List<JsonRow>> fruitImages() async => [...fruitImageRows];
  @override
  Future<List<JsonRow>> fetusIllustrations() async => [...fetusRows];

  @override
  Future<List<JsonRow>> dailyLogs(String userId) async {
    await _read();
    if (mode == FakeMode.offline) throw const SocketException('Failed to fetch');
    final days = dailyRows.keys.toList()..sort((a, b) => b.compareTo(a));
    return [
      for (final d in days) {'id': 'id-$d', 'user_id': userId, 'log_date': d, ...dailyRows[d]!},
    ];
  }

  @override
  Future<List<JsonRow>> bloodPressureLogs(String userId) async => [...bpRows];
  @override
  Future<List<JsonRow>> appointments(String userId) async {
    await _read();
    return [...appointmentRows];
  }

  @override
  Future<JsonRow> updateAppointment(String userId, String id, Map<String, Object?> updates) async {
    calls.add(('update', {'id': id, ...updates}));
    final i = appointmentRows.indexWhere((r) => r['id'] == id);
    final row = {
      ...(i >= 0 ? appointmentRows[i] : {'id': id}),
      ...updates,
    };
    if (i >= 0) appointmentRows[i] = row;
    return row;
  }

  @override
  Future<void> deleteAppointment(String userId, String id) async {
    calls.add(('delete', id));
    appointmentRows.removeWhere((r) => r['id'] == id);
  }

  @override
  Future<List<JsonRow>> periodDayLogs(String userId) async => [...periodRows];
  @override
  Future<List<Object?>> appStories(String language) async => [...storyRows];
  @override
  Future<Object?> recap(int year) async => recapResult;
  @override
  Future<List<JsonRow>> blogPosts() async {
    await _read();
    return [...blogRows];
  }

  @override
  Future<SendResult> send(String table, Map<String, Object?> row) async {
    if (gate != null) await gate!.future;
    if (table == waterOutboxTable) {
      waterCalls.add(row);
      if (mode == FakeMode.offline) return const SendResult(error: 'TypeError: Failed to fetch', status: 0);
      final id = row['id'] as String;
      final day = row['log_date'] as String;
      if (ops.contains(id)) {
        return SendResult(data: {'water_intake': dailyRows[day]?['water_intake'] ?? 0, 'applied': false, 'log_date': day});
      }
      ops.add(id);
      final r = dailyRows.putIfAbsent(day, () => {'water_intake': 0, 'mood': null});
      r['water_intake'] = ((r['water_intake'] as num) + (row['delta'] as num)).clamp(0, 20000);
      if (mode == FakeMode.lostAnswer) return const SendResult(error: 'TypeError: Failed to fetch', status: 0);
      return SendResult(data: {'water_intake': r['water_intake'], 'applied': true, 'log_date': day});
    }
    calls.add(('send:$table', row));
    if (mode == FakeMode.offline) return const SendResult(error: 'TypeError: Failed to fetch', status: 0);
    if (table == 'appointments') appointmentRows.add({...row});
    return SendResult(data: {...row, 'created_at': '2026-01-01T00:00:00Z'});
  }
}

class NavCall {
  NavCall(this.kind, this.value);
  final String kind;
  final String? value;
  @override
  String toString() => '$kind:$value';
}

/// Builds a [ProviderContainer] with the home fakes, a frozen clock and a woman user.
class HomeTestEnv {
  HomeTestEnv({
    DateTime? now,
    this.stage = 'bump',
    this.uid = 'u1',
    DateTime? lastPeriod,
    String name = 'Leyla',
    Map<String, dynamic>? profile,
    bool isAdmin = false,
    Object? storiesSetting,
    List<Override> extra = const [],
  }) {
    this.now = now ?? DateTime(2026, 11, 27, 10);
    DomainClock.setSystemTime(this.now);
    store = LocalStore.memory();
    outbox = OfflineOutbox(store: store, sender: repo.send, log: (_) {});
    container = ProviderContainer(
      overrides: [
        localStoreProvider.overrideWithValue(store),
        userStorePlatformProvider.overrideWithValue(_NoPlatform()),
        queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
        homeRepositoryProvider.overrideWithValue(repo),
        homeUserIdProvider.overrideWithValue(uid),
        homeProfileRowProvider.overrideWithValue(profile ?? const {}),
        homeIsAdminProvider.overrideWithValue(isAdmin),
        homeIsNativeProvider.overrideWithValue(false),
        offlineOutboxProvider.overrideWithValue(outbox),
        homeAppSettingProvider.overrideWith((ref, key) => key == 'dashboard_stories' ? storiesSetting : null),
        homeNavigationProvider.overrideWithValue(
          HomeNavigation(
            openTool: (id) => nav.add(NavCall('tool', id)),
            navigate: (s) => nav.add(NavCall('screen', s)),
            openChat: () => nav.add(NavCall('chat', null)),
            openAssistant: () => nav.add(NavCall('assistant', null)),
            pushIntent: ({tool, tab, screen}) => nav.add(NavCall('intent', tool ?? tab ?? screen)),
          ),
        ),
        ...extra,
      ],
    );
    final s = container.read(userStoreProvider.notifier);
    s.setAuth(true, uid, null, name);
    s.setLifeStage(stage);
    if (stage == 'bump') s.setLastPeriodDate(lastPeriod ?? DateTime(2026, 6, 17)); // day 164 → week 23 on 27 Nov
    if (stage == 'flow') s.setLastPeriodDate(lastPeriod ?? DateTime(2026, 11, 20));
  }

  late final DateTime now;
  final String stage;
  final String? uid;
  final FakeHomeRepository repo = FakeHomeRepository();
  late final LocalStore store;
  late final OfflineOutbox outbox;
  late final ProviderContainer container;
  final List<NavCall> nav = [];

  void dispose() {
    container.dispose();
    unawaited(outbox.dispose());
    clearHomeStageBodies();
    DomainClock.reset();
  }

  /// MaterialApp + theme + toast host + disk assets. [scroll] mimics the shell's single scroll container.
  Widget wrap(Widget child, {bool dark = false, bool rtl = false, bool scroll = true, bool padded = false}) {
    return UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: DefaultAssetBundle(
          bundle: DiskAssetBundle(),
          child: GalleryFrame(
            dark: dark,
            rtl: rtl,
            child: Builder(
              builder: (context) => ColoredBox(
                color: context.a.bg,
                child: scroll
                    ? SingleChildScrollView(
                        key: const ValueKey('test-scroll'),
                        padding: padded ? const EdgeInsets.symmetric(horizontal: 20) : EdgeInsets.zero,
                        child: child,
                      )
                    : child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A 390×844 phone surface.
void phoneSurface(WidgetTester tester, {double height = 844}) {
  tester.view.physicalSize = Size(390 * 3, height * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// Lets queries resolve and entry animations finish.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  await tester.pump(const Duration(seconds: 2));
}

Future<void> goldenSettle(WidgetTester tester) async {
  await settle(tester);
  await settleSvgs(tester);
}

/// A bundled-asset-free JSON helper for fixtures.
String pretty(Object? v) => const JsonEncoder.withIndent(' ').convert(v);
