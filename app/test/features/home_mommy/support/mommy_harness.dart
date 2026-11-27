// Ported from: (test support) — fakes for the mommy home / baby care tests (the vitest files mock
// '@/integrations/supabase/client', useAuth and useChildren the same way).
import 'dart:async';

import 'package:anacan/core/auth/auth_providers.dart';
import 'package:anacan/core/auth/auth_models.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/language_controller.dart';
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/baby/data/baby_repository.dart';
import 'package:anacan/features/baby/hooks/baby_services.dart';
import 'package:anacan/features/home_mommy/mommy_dashboard.dart';
import 'package:anacan/features/home_mommy/period/mommy_period.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/timer_store.dart';
import 'package:flutter/widgets.dart' hide FocusManager;
import 'package:material_ui/material_ui.dart' show Theme;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart' show WidgetTester;
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../../../support/i18n_fakes.dart';

User fakeUser(String id) => User(id: id, appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

Map<String, dynamic> childRow(String id, {String userId = 'u1', String name = '', String birth = '2026-01-01', String? due, String gender = 'girl', int sort = 0}) => {
      'id': id,
      'user_id': userId,
      'name': name.isEmpty ? id : name,
      'birth_date': birth,
      'due_date': due,
      'gender': gender,
      'avatar_emoji': gender == 'girl' ? '👧' : '👦',
      'is_active': true,
      'sort_order': sort,
      'notes': null,
      'created_at': '2026-01-01T00:00:00Z',
    };

/// In-memory backend for [BabyRepository].
class FakeBabyRepository implements BabyRepository {
  List<Map<String, dynamic>> children = [];
  Object? childrenError;
  int childrenCalls = 0;
  Map<String, dynamic>? profile;
  final List<Map<String, dynamic>> inserted = [];
  final List<Map<String, dynamic>> logs = [];
  final List<String> calls = [];
  final List<void Function()> logWatchers = [];
  List<Map<String, dynamic>> crisis = [];
  List<Map<String, dynamic>> tips = [];
  List<Map<String, dynamic>> milestoneDefs = [];
  List<Map<String, dynamic>> milestones = [];
  List<Map<String, dynamic>> teethRows = [];
  List<Map<String, dynamic>> teethLogs = [];
  List<Map<String, dynamic>> growth = [];
  Map<int, Map<String, dynamic>> dailyInfo = {};
  Map<int, Map<String, dynamic>> messages = {};
  Map<String, String> dueDates = {};
  Object? dueDateError;
  Future<FunctionResult> Function(Map<String, Object?> body)? insight;
  bool logExistsAnswer = false;

  @override
  Future<List<Map<String, dynamic>>> loadActiveChildren(String userId) async {
    childrenCalls++;
    calls.add('children:$userId');
    if (childrenError != null) throw childrenError!;
    return [for (final c in children) if (c['user_id'] == userId) Map<String, dynamic>.from(c)];
  }

  @override
  Future<Map<String, dynamic>?> loadProfileBabyFields(String userId) async => profile;
  @override
  Future<void> insertChildRow(Map<String, dynamic> row) async => children.add({...row, 'id': 'seed-${children.length}', 'created_at': ''});
  @override
  Future<Map<String, dynamic>?> insertChild(Map<String, dynamic> row) async {
    final r = {...row, 'id': 'new-${children.length}', 'created_at': '2026-11-27T00:00:00Z', 'notes': null};
    children.add(r);
    inserted.add(r);
    return r;
  }

  @override
  Future<void> updateChild(String childId, String userId, Map<String, dynamic> patch) async {
    calls.add('updateChild:$childId:${patch.keys.join(',')}');
    for (var i = 0; i < children.length; i++) {
      if (children[i]['id'] == childId) children[i] = {...children[i], ...patch};
    }
    children.removeWhere((c) => c['is_active'] == false);
  }

  @override
  Future<void> updateChildDueDate(String childId, String dueDate) async {
    if (dueDateError != null) throw dueDateError!;
    dueDates[childId] = dueDate;
  }

  @override
  Future<List<Map<String, dynamic>>> loadRecentBabyLogs(String userId, String? childId, String sinceIso) async {
    calls.add('logs:$userId:$childId');
    return [
      for (final l in logs)
        if (l['user_id'] == userId && (childId == null || l['child_id'] == childId)) Map<String, dynamic>.from(l)
    ]..sort((a, b) => '${b['start_time']}'.compareTo('${a['start_time']}'));
  }

  @override
  Future<List<Map<String, dynamic>>> loadBabyLogsSince(String userId, String? childId, String fromIso) =>
      loadRecentBabyLogs(userId, childId, fromIso);
  @override
  Future<void> updateBabyLog(String id, String userId, Map<String, dynamic> updates) async {
    for (var i = 0; i < logs.length; i++) {
      if (logs[i]['id'] == id) logs[i] = {...logs[i], ...updates};
    }
  }

  @override
  Future<void> deleteBabyLog(String id, String userId) async => logs.removeWhere((l) => l['id'] == id);
  @override
  Future<bool> babyLogExists(String userId, String logType, String startIso) async {
    calls.add('exists:$logType:$startIso');
    return logExistsAnswer || logs.any((l) => l['user_id'] == userId && l['log_type'] == logType && l['start_time'] == startIso);
  }

  @override
  void watchBabyLogs(Ref ref, String channelPrefix, String userId, void Function() onChange) {
    logWatchers.add(onChange);
    ref.onDispose(() => logWatchers.remove(onChange));
  }

  @override
  Future<Map<String, dynamic>?> babyDailyInfo(int dayNumber) async => dailyInfo[dayNumber];
  @override
  Future<Map<String, dynamic>?> mommyDailyMessage(int dayNumber) async => messages[dayNumber];
  @override
  Future<List<Map<String, dynamic>>> crisisPeriods() async => crisis;
  @override
  Future<List<Map<String, dynamic>>> developmentTips(String? ageGroup) async => [for (final t in tips) if (t['age_group'] == ageGroup) t];
  @override
  Future<List<Map<String, dynamic>>> milestoneDefinitions() async => milestoneDefs;
  @override
  Future<List<Map<String, dynamic>>> teeth() async => teethRows;
  @override
  Future<List<Map<String, dynamic>>> babyMilestones(String userId, String? childId) async =>
      [for (final m in milestones) if (childId == null || m['child_id'] == childId) m];
  @override
  Future<Map<String, dynamic>?> insertBabyMilestone(Map<String, dynamic> row) async {
    final r = {...row, 'id': 'ms-${milestones.length}', 'achieved_at': '2026-11-27T10:00:00Z'};
    milestones.add(r);
    return r;
  }

  @override
  Future<void> deleteBabyMilestone(String id) async => milestones.removeWhere((m) => m['id'] == id);
  @override
  void watchBabyMilestones(Ref ref, String userId, void Function() onChange) {}
  @override
  Future<List<Map<String, dynamic>>> teethingLogs(String userId, String? childId) async =>
      [for (final l in teethLogs) if (childId == null || l['child_id'] == childId) l];
  @override
  Future<List<Map<String, dynamic>>> growthEntries(String userId, String? childId) async =>
      [for (final g in growth) if (childId == null || g['child_id'] == childId) g];
  @override
  Future<Map<String, dynamic>> insertGrowthEntry(Map<String, dynamic> row) async {
    final r = {...row, 'id': 'g-${growth.length}'};
    growth.insert(0, r);
    return r;
  }

  @override
  Future<FunctionResult> invokeBabyInsight(Map<String, Object?> body) =>
      insight?.call(body) ?? Future.value(const FunctionResult(error: 'no fake', status: 500));

  /// Fires the realtime `postgres_changes` callbacks.
  void emitLogChange() {
    for (final w in List.of(logWatchers)) {
      w();
    }
  }
}

/// Server behind the outbox sender: 'ok' | 'offline' | 'reject'.
class FakeLogServer {
  FakeLogServer(this.repo);
  final FakeBabyRepository repo;
  String mode = 'ok';
  final sent = <String>[];

  Future<SendResult> send(String table, Map<String, Object?> row) async {
    sent.add(row['id'] as String);
    if (mode == 'offline') return const SendResult(error: {'message': 'TypeError: Failed to fetch', 'code': ''}, status: 0);
    if (mode == 'reject') return const SendResult(error: {'message': 'check constraint', 'code': '23514'}, status: 400);
    if (repo.logs.any((l) => l['id'] == row['id'])) return const SendResult(status: 201);
    final saved = {'created_at': '2026-11-27T10:00:00.000Z', ...row};
    repo.logs.add(Map<String, dynamic>.from(saved));
    return SendResult(data: saved, status: 201);
  }
}

class RecordingServices implements BabyCareServices {
  final achievements = <String>[];
  num remaining = double.infinity;
  @override
  Future<void> hapticLight() async {}
  @override
  Future<void> hapticMedium() async {}
  @override
  Future<void> unlockAchievement(String key, String stage) async => achievements.add(key);
  @override
  Future<({num remaining, num limit})> peekRemainingDaily(String feature) async => (remaining: remaining, limit: 2);
}

class FakePeriodSource implements MommyPeriodSource {
  List<Map<String, dynamic>> rows = [];
  final writes = <MommyPeriodWrite>[];
  @override
  Future<List<Map<String, dynamic>>> loadPeriodDayLogs(String userId) async => rows;
  @override
  Future<void> record(String userId, MommyPeriodWrite input) async => writes.add(input);
}

/// Everything a mommy test needs, wired into provider overrides.
class MommyHarness {
  MommyHarness({String userId = 'u1', this.nowMs = 1795000000000, String? babyBirthDate, String language = 'az'})
      : user = fakeUser(userId),
        profile = Profile({'user_id': userId, 'baby_birth_date': babyBirthDate, 'country_code': 'AZ'}) {
    installTestI18n();
    server = FakeLogServer(repo);
    outbox = OfflineOutbox(store: store, sender: server.send, connectivity: connectivity, now: () => clock++, log: (_) {});
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry), onlineManager: OnlineManager(), focusManager: FocusManager());
  }

  final User user;
  Profile profile;
  final store = LocalStore.memory();
  final repo = FakeBabyRepository();
  late final FakeLogServer server;
  final connectivity = ManualConnectivitySource();
  late final OfflineOutbox outbox;
  late final QueryClient client;
  final services = RecordingServices();
  final period = FakePeriodSource();
  final timerHooks = RecordingTimerHooks();
  final resumes = StreamController<void>.broadcast();
  int clock = 1000;
  int nowMs;
  MommyHomeEnv env = const MommyHomeEnv();
  List<String> disabledTools = const [];

  List<Override> get overrides => overridesWith();

  List<Override> overridesWith({QueryClient? client}) => [
        localStoreProvider.overrideWithValue(store),
        authUserProvider.overrideWithValue(user),
        authProfileProvider.overrideWith((ref) => profile),
        babyRepositoryProvider.overrideWithValue(repo),
        offlineOutboxProvider.overrideWithValue(outbox),
        queryClientProvider.overrideWithValue(client ?? this.client),
        babyCareServicesProvider.overrideWithValue(services),
        mommyPeriodSourceProvider.overrideWithValue(period),
        mommyHomeEnvProvider.overrideWith((ref) => env),
        mommyDisabledToolsProvider.overrideWith((ref) => disabledTools),
        babyInsightBackendProvider.overrideWithValue('https://api.anacan.az'),
        timerNativeHooksProvider.overrideWithValue(timerHooks),
        timerClockProvider.overrideWithValue(() => nowMs),
        i18nRuntimeProvider.overrideWithValue(installTestI18n()),
        appResumeEventsProvider.overrideWithValue(resumes.stream),
      ];

  ProviderContainer container() => ProviderContainer(overrides: overrides);

  bool _disposed = false;
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    client.clear();
    client.dispose();
    unawaited(outbox.dispose());
    resumes.close();
  }

  /// Unmounts the tree and releases cache / outbox timers before the binding checks for pending timers.
  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    dispose();
    await tester.pump(const Duration(seconds: 6));
  }
}

class RecordingTimerHooks implements TimerNativeHooks {
  final calls = <String>[];
  @override
  void startNativeTimer(ActiveTimer timer) => calls.add('start:${timer.id}');
  @override
  void stopNativeTimer(String id) => calls.add('stop:$id');
  @override
  void clearAllTimerNotifications(List<String> ids) => calls.add('clear:${ids.join(',')}');
}

/// The anacan theme + scope + toast host around [child] at 390×844 (a Navigator for sheets / dialogs).
Widget mommyApp({
  required List<Override> overrides,
  required Widget child,
  Brightness brightness = Brightness.light,
  TextDirection direction = TextDirection.ltr,
  Locale locale = const Locale('az'),
  bool scroll = true,
}) {
  final theme = buildAnacanTheme(brightness, locale: locale, lite: false);
  final tokens = theme.extension<AnacanTokens>()!;
  final page = Container(
    color: tokens.a.bg,
    child: DefaultTextStyle(
      style: theme.textTheme.bodyMedium!,
      child: AScope(
        child: scroll ? SingleChildScrollView(padding: const EdgeInsets.symmetric(horizontal: 20), child: child) : child,
      ),
    ),
  );
  return ProviderScope(
    overrides: overrides,
    child: WidgetsApp(
      color: tokens.a.bg,
      debugShowCheckedModeBanner: false,
      home: page,
      pageRouteBuilder: <T>(RouteSettings settings, WidgetBuilder builder) =>
          PageRouteBuilder<T>(settings: settings, pageBuilder: (context, _, _) => builder(context)),
      builder: (context, navigator) => Theme(
        data: theme,
        child: Directionality(textDirection: direction, child: AToastHost(child: navigator!)),
      ),
    ),
  );
}
