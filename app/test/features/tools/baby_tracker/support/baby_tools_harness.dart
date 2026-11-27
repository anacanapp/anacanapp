// Ported from: (test support) — fakes for the baby tools (growth, teething, vaccines, album, achievements) on top
// of the mommy home harness (children, baby_logs, outbox, timers).
import 'dart:typed_data';

import 'package:anacan/features/tools/baby_album/album_photo_replace.dart';
import 'package:anacan/features/tools/baby_album/baby_album_data.dart';
import 'package:anacan/features/tools/baby_album/image_compress.dart';
import 'package:anacan/features/tools/baby_growth/baby_growth_data.dart';
import 'package:anacan/features/tools/baby_tracker/achievements.dart';
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/features/tools/solid_food/solid_food_data.dart';
import 'package:anacan/features/tools/teething/teething_data.dart';
import 'package:anacan/features/tools/vaccines/vaccine_calendar.dart';
import 'package:anacan/features/tools/vaccines/vaccine_reminders.dart';
import 'package:anacan/features/tools/vaccines/vaccines_data.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/design/design.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:anacan/core/auth/auth_providers.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/language_controller.dart';
import 'package:anacan/core/i18n/tr.dart' show I18nRuntime;
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/features/baby/data/baby_repository.dart';
import 'package:anacan/features/baby/hooks/baby_services.dart';
import 'package:anacan/features/home_mommy/mommy_dashboard.dart';
import 'package:anacan/features/home_mommy/period/mommy_period.dart';
import 'package:anacan/state/persisted_store.dart';
import 'package:anacan/state/timer_store.dart';

import '../../../home/home_test_support.dart' show installRealI18n;
import '../../../home_mommy/support/mommy_harness.dart';
import '../../support/tools_harness.dart' show FakeToolsSource;
import '../../../../support/i18n_fakes.dart';
import 'dart:io';

export '../../../home_mommy/support/mommy_harness.dart';

class FakeGrowthRepository implements GrowthRepository {
  final List<Map<String, dynamic>> rows = [];
  final List<String> calls = [];
  Object? error;
  @override
  Future<List<Map<String, dynamic>>> list(String userId, String? childId) async {
    final out = [for (final r in rows) if (childId == null || r['child_id'] == childId) Map<String, dynamic>.of(r)];
    out.sort((a, b) => '${b['entry_date']}'.compareTo('${a['entry_date']}'));
    return out;
  }

  @override
  Future<void> insert(Map<String, dynamic> row) async {
    calls.add('insert');
    if (error != null) throw error!;
    rows.add({...row, 'id': 'g${rows.length + 1}', 'created_at': ''});
  }

  @override
  Future<void> update(String id, Map<String, dynamic> values) async {
    calls.add('update:$id');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]['id'] == id) rows[i] = {...rows[i], ...values};
    }
  }

  @override
  Future<void> delete(String id) async {
    calls.add('delete:$id');
    rows.removeWhere((r) => r['id'] == id);
  }
}

class FakeTeethingRepository implements TeethingRepository {
  FakeTeethingRepository(this.baby);
  final FakeBabyRepository baby;
  List<Map<String, dynamic>> tipRows = [];
  List<Map<String, dynamic>> symptomRows = [];
  final List<String> calls = [];
  @override
  Future<List<Map<String, dynamic>>> careTips() async => tipRows;
  @override
  Future<List<Map<String, dynamic>>> symptoms() async => symptomRows;
  @override
  Future<void> upsertLog(Map<String, dynamic> row) async {
    calls.add('upsert:${row['tooth_id']}:${row['emerged_date']}');
    baby.teethLogs.removeWhere((l) => l['tooth_id'] == row['tooth_id'] && l['child_id'] == row['child_id']);
    baby.teethLogs.add({...row, 'id': 'tl${baby.teethLogs.length}', 'notes': null});
  }

  @override
  Future<void> deleteLog(String userId, String toothId, String? childId) async {
    calls.add('delete:$toothId');
    baby.teethLogs.removeWhere((l) => l['tooth_id'] == toothId && (childId == null || l['child_id'] == childId));
  }

  @override
  Future<void> updateNote(String userId, String toothId, String? childId, String notes) async {
    calls.add('note:$toothId:$notes');
    for (var i = 0; i < baby.teethLogs.length; i++) {
      if (baby.teethLogs[i]['tooth_id'] == toothId) baby.teethLogs[i] = {...baby.teethLogs[i], 'notes': notes};
    }
  }
}

class FakeVaccinesRepository implements VaccinesRepository {
  List<Map<String, dynamic>> countryRows = [];
  Map<String, List<Map<String, dynamic>>> vaccineRows = {};
  Map<String, List<Map<String, dynamic>>> scheduleRows = {};
  List<Map<String, dynamic>> logs = [];
  final List<String> scheduleCalls = [];
  final List<String> calls = [];
  Future<Map<String, dynamic>?> Function(String childId, String userId, String code)? onCountryWrite;

  /// Holds the schedule and the child's logs until it completes ("not ready").
  Future<void>? gate;

  @override
  Future<List<Map<String, dynamic>>> countries() async => countryRows;
  @override
  Future<List<Map<String, dynamic>>> vaccines(String countryCode) async {
    scheduleCalls.add(countryCode);
    return vaccineRows[countryCode] ?? const [];
  }

  @override
  Future<List<Map<String, dynamic>>> schedules(String countryCode) async {
    await gate;
    return scheduleRows[countryCode] ?? const [];
  }
  @override
  Future<List<Map<String, dynamic>>> childVaccinations(String childId, String userId) async {
    await gate;
    return [for (final l in logs) if (l['child_id'] == childId) l];
  }
  @override
  Future<Map<String, dynamic>?> upsertChildVaccination(Map<String, dynamic> payload) async {
    calls.add('upsert:${payload['vaccine_schedule_id']}:${payload['administered_at']}:${payload['is_skipped']}');
    logs.removeWhere((l) => l['child_id'] == payload['child_id'] && l['vaccine_schedule_id'] == payload['vaccine_schedule_id']);
    final row = {...payload, 'id': 'cv${logs.length}'};
    logs.add(row);
    return row;
  }

  @override
  Future<void> deleteChildVaccination(String id) async {
    calls.add('delete:$id');
    logs.removeWhere((l) => l['id'] == id);
  }

  @override
  Future<Map<String, dynamic>?> updateChildVaccineCountry(String childId, String userId, String code) async {
    calls.add('country:$childId:$userId:$code');
    return onCountryWrite != null ? onCountryWrite!(childId, userId, code) : {'id': childId, 'vaccine_country_code': code};
  }
}

class FakeVaccineScheduler implements VaccineNotificationScheduler {
  bool native = false;
  String result = 'scheduled';
  final List<String> syncs = [];
  final List<String> clears = [];
  @override
  bool get isNativePlatform => native;
  @override
  Future<String> setLocalNotifications(String namespace, items, {bool ask = true, List<int> cancelIds = const []}) async {
    syncs.add(namespace);
    return result;
  }

  @override
  Future<void> clearLocalNotificationNamespaces(String prefix, List<int> ids) async => clears.add(prefix);
}

class FakeAlbumStorage implements BabyAlbumStorage, AlbumStorageBucket {
  final List<String> names = [];
  final List<String> calls = [];
  Object? uploadError;
  @override
  Future<List<String>> list(String userId) async => [...names]..sort();
  @override
  Future<List<String>> signedUrls(List<String> paths) async => [for (final p in paths) 'https://signed/$p'];
  @override
  AlbumStorageBucket bucket(String name) => this;
  @override
  Future<Object?> upload(String path, UploadFile file) async {
    calls.add('upload:$path');
    if (uploadError != null) return uploadError;
    names.add(path.split('/').last);
    return null;
  }

  @override
  Future<Object?> remove(List<String> paths) async {
    calls.add('remove:${paths.join(',')}');
    for (final p in paths) {
      names.remove(p.split('/').last);
    }
    return null;
  }
}

class FakeAchievementsRepository implements AchievementsRepository {
  final List<Map<String, dynamic>> rows = [];
  final List<String> calls = [];
  void Function(Map<String, dynamic> row)? listener;
  @override
  Future<List<Map<String, dynamic>>> load(String userId) async => [...rows];
  @override
  Future<void> insert(Map<String, dynamic> row) async {
    calls.add('insert:${row['achievement_id']}');
    if (rows.any((r) => r['achievement_id'] == row['achievement_id'])) throw const AchievementWriteError('23505');
    rows.add({...row, 'id': 'a${rows.length}'});
  }

  @override
  Future<void> markNotified(String userId, String achievementId) async => calls.add('notified:$achievementId');
  @override
  void watchInserts(Ref ref, String userId, void Function(Map<String, dynamic> row) onInsert) {
    listener = onInsert;
    ref.onDispose(() => listener = null);
  }
}

/// The mommy harness + the baby tools' fakes.
class BabyToolsHarness extends MommyHarness {
  BabyToolsHarness({super.nowMs, super.babyBirthDate}) {
    runtime = realI18n ?? installTestI18n();
    runtime.setLanguageInMemory('az');
    I18nRuntime.instance = runtime;
  }

  late final I18nRuntime runtime;

  /// The app language for `tr` and `appLanguageProvider` (both read [runtime]).
  void setLanguage(String language) => runtime.setLanguageInMemory(language);

  @override
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
        i18nRuntimeProvider.overrideWithValue(runtime),
        appResumeEventsProvider.overrideWithValue(resumes.stream),
      ];

  final growth = FakeGrowthRepository();
  late final teething = FakeTeethingRepository(repo);
  final vaccines = FakeVaccinesRepository();
  final scheduler = FakeVaccineScheduler();
  final album = FakeAlbumStorage();
  final achievementsRepo = FakeAchievementsRepository();
  final tools = FakeToolsSource();
  final registry = FeatureRegistry();
  final launched = <Uri>[];
  final picked = <UploadFile?>[];
  Map<String, String> recipeTitles = {};
  bool premium = false;
  final widgetActions = WidgetActionStore();

  List<Override> get toolOverrides => [
        ...overrides,
        widgetActionStoreProvider.overrideWithValue(widgetActions),
        growthRepositoryProvider.overrideWithValue(growth),
        teethingRepositoryProvider.overrideWithValue(teething),
        vaccinesRepositoryProvider.overrideWithValue(vaccines),
        vaccineNotificationSchedulerProvider.overrideWithValue(scheduler),
        vaccineLinkLauncherProvider.overrideWithValue((uri) async => launched.add(uri)),
        babyAlbumStorageProvider.overrideWithValue(album),
        babyAlbumPickerProvider.overrideWithValue(() async => picked.isEmpty ? null : picked.removeAt(0)),
        babyAlbumNowProvider.overrideWithValue(() => 1700000000000),
        achievementsRepositoryProvider.overrideWithValue(achievementsRepo),
        toolsDataSourceProvider.overrideWithValue(tools),
        featureRegistryProvider.overrideWithValue(registry),
        subscriptionProvider.overrideWithValue(SubscriptionState(isPremium: premium)),
        safetyCallLauncherProvider.overrideWithValue((uri) async {}),
        solidFoodGuideAssetLoaderProvider.overrideWithValue((lang) async {
          final f = File('assets/i18n/solid-food-guide.$lang.json');
          return f.existsSync() ? f.readAsStringSync() : null;
        }),
        babyRecipeSourceTitlesFetcherProvider.overrideWithValue(() async => [for (final e in recipeTitles.entries) {'id': e.key, 'title': e.value}]),
      ];

  /// Unmounts, disposes and lets the query GC timers (up to 7 days) run out.
  @override
  Future<void> finish(WidgetTester tester) async {
    await super.finish(tester);
    await tester.pump(const Duration(days: 8));
  }

  /// Real az dictionaries (bundled `@copy.babycare.*` texts); load once with [loadRealI18n] in setUpAll.
  static I18nRuntime? realI18n;
  static Future<void> loadRealI18n() async => realI18n = await installRealI18n();

  /// Pumps [child] at 390×1600 inside a MaterialApp frame (the tool gets unbounded height).
  Future<void> pump(WidgetTester tester, Widget child) async {
    final overrides = toolOverrides;
    I18nRuntime.instance = runtime;
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    // The Tools tab is a box tab in the shell's scroll view: the tool gets unbounded height.
    await tester.pumpWidget(ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(data: const MediaQueryData(size: Size(390, 1600), disableAnimations: true), child: AToastHost(child: nav!)),
        home: SingleChildScrollView(child: child),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// A PNG-less upload file for the album tests.
UploadFile pngFile(String name) => UploadFile(bytes: Uint8List.fromList([1, 2, 3]), name: name, type: 'image/jpeg');
