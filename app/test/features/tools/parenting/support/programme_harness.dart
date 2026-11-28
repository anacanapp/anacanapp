// Ported from: (test support) â€” the vi.mock setups of the programme tool tests (useAuth / useChildren /
// useSubscription / useAppSetting / supabase client / native share / local notifications / pushNav events) as
// provider overrides: in-memory LocalStore, fake remotes, recorded navigation, shares and notifications, and the
// bundled content read from app/assets/i18n.
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/offline/connectivity.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/domain/notifications/local_notification_plan.dart';
import 'package:anacan/domain/baby/baby_logs_range.dart';
import 'package:anacan/features/legal/medical_disclaimer.dart' show emergencyNumberProvider;
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_share.dart';
import 'package:anacan/features/tools/parenting/parenting_sync.dart';
import 'package:anacan/features/tools/parenting/programme_ports.dart';
import 'package:anacan/features/tools/parenting/programme_ui.dart' show Tap;
import 'package:anacan/features/tools/sleep_training/next_nap_section.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training.dart';
import 'package:anacan/features/tools/sleep_training/sleep_training_sync.dart';
import 'package:anacan/features/tools/weaning/weaning_entry.dart';
import 'package:anacan/features/tools/weaning/weaning_entry_cards.dart';
import 'package:anacan/features/tools/weaning/weaning_sync.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

/// Bundled content files from disk (app/assets/i18n).
Future<String?> diskAsset(String file) async {
  final f = File('assets/i18n/$file');
  return f.existsSync() ? f.readAsStringSync() : null;
}

final Map<String, Map<String, dynamic>> _json = {};

/// The bundled content JSON of a language (`import az from '@/data/parenting/az'`).
Map<String, dynamic> contentJson(String lang) =>
    _json.putIfAbsent(lang, () => Map<String, dynamic>.from(jsonDecode(File('assets/i18n/parenting.$lang.json').readAsStringSync()) as Map));

/// The typed content of a language.
ParentingContent contentOf(String lang) => ParentingContent.fromJson(contentJson(lang));

class RecordingNotifications implements ProgrammeNotifications {
  final List<({String namespace, List<StoredNotification> items, bool ask, List<int> cancelIds})> calls = [];
  int permissionRequests = 0;
  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) async =>
      calls.add((namespace: namespace, items: items, ask: ask, cancelIds: cancelIds));
  @override
  Future<bool> requestPermission() async {
    permissionRequests++;
    return true;
  }

  List<StoredNotification> last(String namespace) => calls.lastWhere((c) => c.namespace == namespace).items;
}

/// The `fakeDb` of sleep-training-sync.test.ts: one table, the filters the sync uses.
class FakeSleepPlanRemote implements SleepPlanRemote {
  FakeSleepPlanRemote({List<Map<String, dynamic>>? rows, this.error}) : rows = rows ?? [];
  final List<Map<String, dynamic>> rows;
  final PlanDbError? error;
  final List<String> calls = [];

  Iterable<Map<String, dynamic>> _match(String owner, String? child) => rows.where((r) => r['user_id'] == owner && r['child_id'] == child);

  @override
  Future<RemotePlan?> fetch(String ownerId, String? childId) async {
    calls.add('select');
    if (error != null) throw error!;
    final hit = _match(ownerId, childId);
    return hit.isEmpty ? null : RemotePlan(plan: hit.first['plan'], updatedAt: '${hit.first['updated_at']}');
  }

  @override
  Future<int> update(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt) async {
    calls.add('update');
    if (error != null) throw error!;
    final hit = _match(ownerId, childId).where((r) => DateTime.parse('${r['updated_at']}').isBefore(DateTime.parse(updatedAt))).toList();
    for (final r in hit) {
      r['plan'] = plan;
      r['updated_at'] = updatedAt;
    }
    return hit.length;
  }

  @override
  Future<void> insert(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt) async {
    calls.add('insert');
    if (_match(ownerId, childId).isNotEmpty) throw const PlanDbError(code: '23505', message: 'dup');
    rows.add({'id': 'id-${rows.length}', 'user_id': ownerId, 'child_id': childId, 'plan': plan, 'updated_at': updatedAt});
  }
}

class FakeWeaningRemote implements WeaningRemote {
  final List<Map<String, Object?>> planUpserts = [];
  final List<List<Map<String, Object?>>> checkinUpserts = [];
  Map<String, dynamic>? planRow;
  bool fail = false;
  @override
  Future<Map<String, dynamic>?> fetchPlanRow(String uid, String? childId) async {
    if (fail) throw StateError('offline');
    return planRow;
  }

  @override
  Future<void> upsertPlan(Map<String, Object?> row) async {
    if (fail) throw StateError('offline');
    planUpserts.add(row);
  }

  @override
  Future<void> upsertCheckins(List<Map<String, Object?>> rows) async {
    if (fail) throw StateError('offline');
    checkinUpserts.add(rows);
  }
}

/// The parenting_state mock of parenting-sync.test.ts.
class FakeParentingRemote implements ParentingRemote {
  Map<String, Object?>? row;
  final List<Map<String, Object?>> upserts = [];
  bool fail = false;
  @override
  Future<Object?> fetchState(String uid, {required void Function() found}) async {
    if (fail) throw StateError('offline');
    if (row == null) return null;
    found();
    return row!['state'];
  }

  @override
  Future<void> upsert(String uid, Map<String, Object?> state, String updatedAt) async {
    upserts.add({'user_id': uid, 'state': state});
    row = {'state': state, 'updated_at': 'now'};
  }
}

class FakeShareRemote implements ParentingShareRemote {
  String? partnerUser = 'partner-user';
  final List<({String actor, String target, String content})> sent = [];
  List<Map<String, dynamic>> rows = [];
  final List<String> calls = [];
  final List<String> reads = [];
  @override
  Future<String?> partnerUserId(String partnerProfileId) async {
    calls.add('profiles.eq id $partnerProfileId');
    return partnerUser;
  }

  @override
  Future<void> sendPartnerMessage(String actor, String partnerUserId, String text) async => sent.add((actor: actor, target: partnerUserId, content: text));

  @override
  Future<List<Map<String, dynamic>>> partnerShareRows(String userId, String since) async {
    calls.add('partner_messages.eq receiver_id $userId');
    calls.add('partner_messages.eq message_type text');
    return rows;
  }

  @override
  Future<void> markRead(String userId, String messageId) async => reads.add(messageId);
}

class ProgrammeHarness {
  ProgrammeHarness({Map<String, String>? storage}) : store = LocalStore(MemoryLocalStoreBackend(), debounce: const Duration(days: 1)) {
    storage?.forEach(store.setItem);
  }

  final LocalStore store;
  ProgrammeInputs inputs = const ProgrammeInputs(userId: 'u1', lifeStage: 'mommy', language: 'az', weaningSetting: 'on', parentingSetting: 'on');
  String emergency = '103';
  final notifications = RecordingNotifications();
  final sleepRemote = FakeSleepPlanRemote(error: const PlanDbError(code: 'PGRST205', message: "Could not find the table 'public.sleep_training_plans' in the schema cache"));
  final weaningRemote = FakeWeaningRemote();
  final parentingRemote = FakeParentingRemote()..fail = true;
  final shareRemote = FakeShareRemote();
  final connectivity = ManualConnectivitySource();
  final List<String> openedTools = [];
  final List<ParentingTarget?> openedParenting = [];
  final List<({String title, String text})> shares = [];
  final List<Uri> calls = [];
  final List<String> tracked = [];
  final List<String> confirms = [];
  bool confirmResult = true;
  final targets = ParentingTargetStore();
  final widgetActions = WidgetActionStore();
  final back = BackDispatcher();
  List<BabyLogRow> sleepLogs = [];
  final List<(DateTime, DateTime)> addedSleeps = [];
  final List<String> deletedSleeps = [];
  List<FeedLog> feedLogs = [];
  List<ParentingOverrideRow> overrides = [];
  bool overridesFail = false;

  ParentingContentRegistry? _registry;

  List<Override> get providerOverrides => [
        localStoreProvider.overrideWithValue(store),
        programmeInputsProvider.overrideWith((ref) => inputs),
        emergencyNumberProvider.overrideWithValue(emergency),
        programmeNotificationsProvider.overrideWithValue(notifications),
        programmeShareProvider.overrideWithValue(({required title, required text}) async {
          shares.add((title: title, text: text));
          return true;
        }),
        programmeHapticProvider.overrideWithValue(() async {}),
        programmeTrackProvider.overrideWithValue((tool, action, [item]) => tracked.add(item == null ? action : '$action:$item')),
        programmeNavProvider.overrideWithValue(ProgrammeNav(
          openTool: openedTools.add,
          openParenting: (t) {
            targets.set(t);
            openedParenting.add(t);
          },
        )),
        programmeParentingTargetProvider.overrideWithValue(targets),
        programmeBackProvider.overrideWithValue((handler) => back.push(handler)),
        programmeConfirmProvider.overrideWithValue((context, message) async {
          confirms.add(message);
          return confirmResult;
        }),
        safetyCallLauncherProvider.overrideWithValue((uri) async => calls.add(uri)),
        connectivitySourceProvider.overrideWithValue(connectivity),
        sleepPlanRemoteProvider.overrideWithValue(sleepRemote),
        weaningRemoteProvider.overrideWithValue(weaningRemote),
        parentingRemoteProvider.overrideWithValue(parentingRemote),
        parentingShareRemoteProvider.overrideWithValue(shareRemote),
        widgetActionStoreProvider.overrideWithValue(widgetActions),
        subscriptionProvider.overrideWith((ref) => SubscriptionState(isPremium: inputs.isPremium)),
        sleepTrainingLogsProvider.overrideWith((ref) => sleepLogs),
        sleepTrainingLogActionsProvider.overrideWithValue(SleepLogActions(
          addSleep: (s, e) async {
            addedSleeps.add((s, e));
            return null;
          },
          delete: (id) async {
            deletedSleeps.add(id);
            return null;
          },
        )),
        sleepNextAssetLoaderProvider.overrideWithValue((lang) async => diskAsset('sleep-next.$lang.json')),
        weaningFeedLogsFetcherProvider.overrideWithValue((uid, child, since) async => feedLogs),
        parentingAssetLoaderProvider.overrideWithValue(diskAsset),
        parentingOverridesFetcherProvider.overrideWithValue((language) async {
          if (overridesFail) throw StateError('offline');
          return [for (final r in overrides) r.toJson()];
        }),
        if (_registry != null) parentingContentRegistryProvider.overrideWithValue(_registry!),
      ];

  /// One registry shared by every pump (React's module-level content cache).
  ParentingContentRegistry registry() => _registry ??= ParentingContentRegistry(
        load: diskAsset,
        store: store,
        fetchOverrides: (language) async => [for (final r in overrides) r.toJson()],
      );

  /// Pumps [child] at 390Ã—1600 in a MaterialApp frame (the tool gets unbounded height) and settles async loads.
  Future<void> pump(WidgetTester tester, Widget child, {bool settle = true}) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: providerOverrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(data: const MediaQueryData(size: Size(390, 1600), disableAnimations: true), child: AToastHost(child: nav!)),
        home: SingleChildScrollView(child: child),
      ),
    ));
    if (settle) await flush(tester);
  }

  /// Lets futures (asset loads, syncs) complete.
  Future<void> flush(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 5)));
      await tester.pump(const Duration(milliseconds: 20));
    }
  }

  /// Unmounts and lets timers (toasts, sync delays, LocalStore debounce) run out.
  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(days: 2));
  }
}

/// Taps the widget with [key] (scrolled into view).
Future<void> tapKey(WidgetTester tester, String key) async {
  var f = find.byKey(ValueKey(key)).first;
  // Start-aligned small buttons sit in a full-width Align: tap the button itself.
  final inner = find.descendant(of: f, matching: find.byType(Tap));
  if (inner.evaluate().isNotEmpty) f = inner.first;
  await tester.ensureVisible(f.first);
  await tester.tap(f.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

/// Taps the first widget showing [text] (scrolled into view).
Future<void> tapText(WidgetTester tester, String text) async {
  final f = find.text(text);
  await tester.ensureVisible(f.first);
  await tester.tap(f.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}
