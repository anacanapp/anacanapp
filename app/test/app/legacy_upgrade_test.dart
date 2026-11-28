// Ported from: (Flutter-only) Capacitor 52/53 → Flutter 60 upgrade path, end to end through the real startup
// (DefaultStartupSteps over BackendClient, NativeSessionPersistence, MigrationImport, LegacyStateImporter, stores).
// Only the device edges are fakes: the Capacitor Preferences store, the WebView localStorage reader, the admission
// HTTP answer and the Auth server (refresh grant).

import 'dart:convert';

import 'package:anacan/app/startup_language.dart' show LegacyLanguagePreferenceStore;
import 'package:anacan/core/admission/backend_admission.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/core/data/privacy_consent.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/core/net/backend_client.dart';
import 'package:anacan/core/net/backend_providers.dart';
import 'package:anacan/core/net/build_config.dart';
import 'package:anacan/core/session/auth_gateway.dart';
import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/session/session_persistence.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/legacy_web_storage.dart';
import 'package:anacan/core/storage/migration_export_rules.dart';
import 'package:anacan/core/storage/migration_import.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart' show AuthApiException;

import '../core/net/support.dart';

const me = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const handoff = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
final azure = parseBackendAdmission(initialSourceAdmission.copyJson(generation: 2, phase: 'azure', handoffSha256: handoff));

const storeConfig = BuildConfig(
  buildMode: 'azure',
  backendBootstrap: 'source-first-v1',
  apiUrl: azureApiOrigin,
  anonKey: 'synthetic-target-public',
  sourceAnonKey: 'synthetic-source-public',
  appVersion: '60.0',
  authCutover: 'false',
);

/// Store builds keep the Source namespace for the SDK key and the backup (client.ts).
final backupKey = sessionBackupKey(sourceAuthRealm);

String backup(String? access, String? refresh) => jsonEncode({
      'realm': sourceAuthRealm,
      'session': access == null ? null : {'access_token': access, 'refresh_token': refresh},
    });

/// The WebView localStorage of a signed-in 52/53 user (mother of twins, mid-nap, games in progress).
final Map<String, String> legacyLocalStorage = {
  'anacan-user-store': jsonEncode({
    'state': {
      'isAuthenticated': true, 'isOnboarded': true, 'hasSeenIntro': true, 'hasCompletedFunnel': true,
      'userId': me, 'email': 'leyla@example.com', 'name': 'Leyla', 'role': 'woman', 'lifeStage': 'mommy',
      'partnerCode': null, 'linkedPartnerId': null, 'lastPeriodDate': null, 'cycleLength': 28, 'periodLength': 5,
      'dueDate': null, 'babyBirthDate': '2026-06-01T00:00:00.000Z', 'babyName': 'Aydan', 'babyGender': 'girl',
      'babyCount': 2, 'multiplesType': 'twins', 'deliveryType': 'natural', 'language': 'ru',
      'hasSelectedLanguage': true, 'countryCode': 'AZ',
    },
    'version': 0,
  }),
  'selected-child-storage': '{"state":{"selectedChildId":"child-2"},"version":0}',
  'language': 'ru',
  'anacan-timers': jsonEncode({
    'state': {
      'activeTimers': [
        {'id': 't1', 'type': 'sleep', 'childId': 'child-1', 'childName': 'Aydan', 'startTime': 1764300000000},
        {'id': 't2', 'type': 'feeding', 'feedType': 'left', 'childId': 'child-2', 'childName': 'Ayla', 'startTime': 1764301000000},
      ],
    },
    'version': 0,
  }),
  'anacan_tool_live_timer_v1': '{"sleep":"la-1"}',
  'anacan_kick_active_v1:$me': '{"startedAt":1764290000000,"kicks":4}',
  'anacan_outbox_v1:$me': '[{"id":"0b8e","table":"baby_logs","payload":{"id":"0b8e","log_type":"diaper"},"createdAt":1764299000000,"attempts":1}]',
  'anacan.sleepTraining.v2.$me.child-1': '{"v":2,"plan":{"wakeTime":"07:00","method":"chair"},"updatedAt":1,"dirty":true}',
  'anacan.parenting.v1.$me': '{"programmes":{"p1":{"done":[1,2,3]}},"dirty":false}',
  'anacan_lock_enabled': '1',
  'anacan_lock_hash': 'ab12',
  'anacan_lock_salt': '00ff',
  'anacan_word_garden_v1:az:3:classic': '{"schema":"anacan-word-garden-profile-v1","language":"az","revision":3,"mode":"classic","seed":7,"level":42}',
  'anacan_word_garden_preferences_v1': '{"sound":false,"haptics":true,"highContrast":false,"reducedMotion":false,"theme":"auto"}',
  'anacan_two_friends_v1:2': '{"schema":"anacan-two-friends-profile-v1","revision":2,"unlocked":12}',
  'anacan_casual_v1:leaf-flight:1': '{"schema":"anacan-casual-profile-v1","game":"leaf-flight","revision":1,"level":9}',
  'anacan_minigame_progress_memory': '{"unlockedLevel":5,"levels":{"1":{"stars":3,"bestScore":900}},"bestScoreOverall":900}',
  'anacan_colorsort_level_count_v1': '44',
  'anacan:qabarciq:best:v1': '1200',
  'anacan.widgets.settings.v1': '{"showFeed":true,"showNap":false,"showActions":true,"privacy":true}',
  'silent_hours_$me': '{"enabled":true,"startTime":"22:00","endTime":"07:00"}',
  'anacan_water_reminder_enabled': 'true',
  // Never imported: credentials and server caches.
  'sb-tntbjulojatnrqmylorp-auth-token': '{"access_token":"webview-a","refresh_token":"webview-r"}',
  'anacan-rq-cache': '{"clientState":{}}',
  'anacan_i18n_cache:ru': '{}',
};

const privacyConsent = '{"analytics":true,"ads":false,"attribution":true,"decidedAt":"2026-10-01T09:00:00.000Z"}';

/// The Capacitor Preferences a signed-in 52/53 install leaves behind (no export unless [withExport]).
InMemoryLegacyPreferences legacyPreferences({bool withExport = false, String? sessionBackup}) =>
    InMemoryLegacyPreferences({
      admissionPinKey: advanceAdmission(null, azure).encode(),
      adoptionReceiptKey: jsonEncode({'schema': adoptionSchema, 'state': 'complete', 'handoff': handoff, 'userId': me}),
      backupKey: sessionBackup ?? backup('legacy-a', 'legacy-r'),
      'anacan_app_language': 'ru',
      'anacan_has_selected_language': 'true',
      'anacan_has_seen_intro': 'true',
      'anacan_privacy_consent_v1': privacyConsent,
      if (withExport)
        migrationExportKey: jsonEncode({
          'schema': migrationExportSchema,
          'exportedAt': '2026-11-27T10:00:00.000Z',
          'appVersion': '53.0',
          'entries': selectMigrationEntries(legacyLocalStorage),
          'skipped': <String>[],
        }),
    });

/// One device: the stores that survive between launches.
class Device {
  Device(this.prefs, {Map<String, String>? webStorage, bool hasWebData = true})
      : web = InMemoryLegacyWebStorageReader(webStorage ?? legacyLocalStorage, hasWebData);

  final InMemoryLegacyPreferences prefs;
  final InMemoryLegacyWebStorageReader web;
  final MemoryLocalStoreBackend disk = MemoryLocalStoreBackend();
  final InMemoryKeyValueStore flutterPrefs = InMemoryKeyValueStore();
  final FakeAuthGateway auth = FakeAuthGateway();
  bool signedIn = false;
  bool online = true;

  /// The Auth server: `legacy-r` / `refresh-*` tokens are valid unless revoked.
  final Set<String> revoked = {};
}

class Launch {
  Launch(this.container);
  final ProviderContainer container;
  late StartupResult result;
  T read<T>(ProviderListenable<T> provider) => container.read(provider);
}

class UpgradeSteps extends DefaultStartupSteps {
  UpgradeSteps(super.container, this.device);
  final Device device;

  @override
  String? currentUserId(BootstrapOpened backend) => device.signedIn ? me : null;

  /// The query-cache file store needs path_provider; not part of the migration.
  @override
  Future<void> restoreQueryCache(BootstrapOpened backend) async {}
}

Future<Launch> launch(Device device) async {
  final auth = device.auth;
  auth.onGetSession = () async => const AuthCallResult();
  auth.onRefresh = (token) async {
    if (!device.online) return const AuthCallResult(error: 'offline');
    if (token == null || device.revoked.contains(token)) {
      return AuthCallResult(error: AuthApiException('Invalid Refresh Token', statusCode: '400', code: 'refresh_token_not_found'));
    }
    device.signedIn = true;
    return AuthCallResult(session: view('new', userId: me));
  };
  auth.onSignOut = (_) async => device.signedIn = false;
  final backend = BackendClient(
    config: storeConfig,
    legacyPreferences: device.prefs,
    localStore: device.flutterPrefs,
    baseHttpClient: FakeHttpClient((_) async =>
        device.online ? jsonResponse(azure.toJson()) : throw http.ClientException('offline')),
    isNativePlatform: true,
    clientFactory: (options) async => SdkHandle(auth: auth, hasSession: () => device.signedIn, dispose: () async {}),
    restoreBound: ({required sourceFirst}) => const Duration(seconds: 2),
  );
  final runtime = I18nRuntime(
    store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')),
    preferences: LegacyLanguagePreferenceStore(device.prefs),
  );
  final container = ProviderContainer(overrides: [
    localStoreProvider.overrideWithValue(LocalStore(device.disk, debounce: const Duration(milliseconds: 1))),
    backendClientProvider.overrideWithValue(backend),
    i18nRuntimeProvider.overrideWithValue(runtime),
    legacyWebStorageReaderProvider.overrideWithValue(device.web),
  ]);
  addTearDown(container.dispose);
  final run = Launch(container);
  run.result = await AppBootstrap(UpgradeSteps(container, device)).run();
  await container.read(localStoreProvider).flush();
  return run;
}

void expectEverythingInPlace(Launch run, Device device) {
  expect(run.result, isA<StartupReady>());
  expect((run.result as StartupReady).language, 'ru');

  final user = run.read(userStoreProvider);
  expect(user.userId, me);
  expect(user.lifeStage, 'mommy');
  expect(user.babyName, 'Aydan');
  expect(user.babyCount, 2);
  expect(user.multiplesType, 'twins');
  expect(user.isOnboarded, isTrue);
  expect(user.language, 'ru');
  expect(user.hasSelectedLanguage, isTrue);
  expect(user.hasSeenIntro, isTrue);
  expect(run.read(childStoreProvider).selectedChildId, 'child-2');
  expect([for (final t in run.read(timerStoreProvider).activeTimers) '${t.id}:${t.type}:${t.childId}:${t.startTime}'],
      ['t1:sleep:child-1:1764300000000', 't2:feeding:child-2:1764301000000']);
  expect(run.read(privacyConsentProvider).analytics, isTrue);
  expect(run.read(privacyConsentProvider).decidedAt, '2026-10-01T09:00:00.000Z');

  // Byte-for-byte on disk (the receipt is only written after the flush).
  final disk = device.disk.values;
  for (final key in [
    'anacan_kick_active_v1:$me', 'anacan_outbox_v1:$me', 'anacan.sleepTraining.v2.$me.child-1', 'anacan.parenting.v1.$me',
    'anacan_lock_enabled', 'anacan_lock_hash', 'anacan_lock_salt', 'anacan_word_garden_v1:az:3:classic',
    'anacan_word_garden_preferences_v1', 'anacan_two_friends_v1:2', 'anacan_casual_v1:leaf-flight:1',
    'anacan_minigame_progress_memory', 'anacan_colorsort_level_count_v1', 'anacan:qabarciq:best:v1',
    'anacan.widgets.settings.v1', 'silent_hours_$me', 'anacan_water_reminder_enabled', 'anacan_tool_live_timer_v1',
  ]) {
    expect(disk[key], legacyLocalStorage[key], reason: key);
  }
  for (final key in ['sb-tntbjulojatnrqmylorp-auth-token', 'anacan-rq-cache', 'anacan_i18n_cache:ru']) {
    expect(disk.containsKey(key), isFalse, reason: key);
  }
  expect(disk['language'], 'ru');

  // Signed in through the Capacitor backup: one refresh grant, the backup now holds the rotated pair.
  expect(device.auth.refreshCalls, ['legacy-r']);
  expect(jsonDecode(device.prefs.values[backupKey]!), {
    'realm': sourceAuthRealm,
    'session': {'access_token': 'access-new', 'refresh_token': 'refresh-new'},
  });
  // One-way: the adoption receipt and the admission pin are untouched, the 53.0 export (if any) stays.
  expect(jsonDecode(device.prefs.values[adoptionReceiptKey]!)['state'], 'complete');
  expect(device.prefs.values[migrationImportedKey], isNotNull);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('53.0 → 60: boots signed in with session, settings, progress, timers and widget prefs from the export',
      () async {
    final device = Device(legacyPreferences(withExport: true));
    final run = await launch(device);
    expectEverythingInPlace(run, device);
    expect((run.result as StartupReady).legacyImport.source, MigrationSource.bridgeExport);
    // The export path never opens the hidden WebView.
    expect(device.web.reads, 0);
  });

  test('52 → 60 (no export): the hidden-WebView read restores the same state', () async {
    final device = Device(legacyPreferences());
    final run = await launch(device);
    expectEverythingInPlace(run, device);
    expect((run.result as StartupReady).legacyImport.source, MigrationSource.webView);
    expect(device.web.reads, 1);
    expect(device.prefs.values.containsKey(migrationExportKey), isFalse);
  });

  test('second launch: no re-import over newer Flutter data, no second WebView, still signed in', () async {
    final device = Device(legacyPreferences());
    final first = await launch(device);
    final store = first.read(localStoreProvider)
      ..setItem('anacan:qabarciq:best:v1', '1500')
      ..removeItem('anacan_kick_active_v1:$me');
    await store.flush();

    final second = await launch(device);
    expect(second.result, isA<StartupReady>());
    expect((second.result as StartupReady).legacyImport.found, isFalse);
    expect(device.disk.values['anacan:qabarciq:best:v1'], '1500');
    expect(device.disk.values.containsKey('anacan_kick_active_v1:$me'), isFalse);
    expect(device.web.reads, 1);
    // The rotated backup from the first launch is what the second one refreshes.
    expect(device.auth.refreshCalls, ['legacy-r', 'refresh-new']);
  });

  test('logout tombstone from the Capacitor app: signed out, no refresh, no v1 fallback, data kept for later',
      () async {
    final prefs = legacyPreferences(sessionBackup: backup(null, null))
      ..values[legacySessionBackupKey] = jsonEncode({'access_token': 'old-a', 'refresh_token': 'old-r'});
    final device = Device(prefs);
    final run = await launch(device);
    expect(run.result, isA<StartupSignedOut>());
    expect(device.auth.refreshCalls, isEmpty);
    expect(jsonDecode(prefs.values[backupKey]!)['session'], isNull);
    // The previous account's device-only data waits for that account (as localStorage kept it).
    final result = (run.result as StartupSignedOut).legacyImport;
    expect(result.otherAccount, contains('anacan_outbox_v1:$me'));
    expect(device.disk.values['anacan_outbox_v1:$me'], legacyLocalStorage['anacan_outbox_v1:$me']);
    // Language, seen-intro and consent still come from Preferences.
    expect(run.read(userStoreProvider).language, 'ru');
    expect(run.read(privacyConsentProvider).decided, isTrue);
  });

  test('a revoked refresh token signs out with a tombstone; the import still runs once', () async {
    final device = Device(legacyPreferences())..revoked.add('legacy-r');
    final run = await launch(device);
    expect(run.result, isA<StartupSignedOut>());
    expect(jsonDecode(device.prefs.values[backupKey]!)['session'], isNull);
    expect(device.prefs.values[migrationImportedKey], isNotNull);
    expect(device.disk.values['anacan.widgets.settings.v1'], legacyLocalStorage['anacan.widgets.settings.v1']);
  });

  test('offline first launch: retry screen, backup kept, nothing imported until the session is decided', () async {
    final device = Device(legacyPreferences())..online = false;
    final offline = await launch(device);
    expect(offline.result,
        isA<StartupRetry>().having((r) => r.reason, 'reason', StartupFailureReason.sessionRecoveryPending));
    expect(device.prefs.values[backupKey], backup('legacy-a', 'legacy-r'));
    expect(device.prefs.values.containsKey(migrationImportedKey), isFalse);
    expect(device.web.reads, 0);

    device
      ..online = true
      ..auth.refreshCalls.clear();
    expectEverythingInPlace(await launch(device), device);
  });

  test('logout after the upgrade writes the tombstone; the next launch stays signed out without re-importing',
      () async {
    final device = Device(legacyPreferences());
    final run = await launch(device);
    expect(run.result, isA<StartupReady>());
    await (run.result as StartupReady).backend.persistence.signOut();
    expect(jsonDecode(device.prefs.values[backupKey]!), {'realm': sourceAuthRealm, 'session': null});

    final next = await launch(device);
    expect(next.result, isA<StartupSignedOut>());
    expect((next.result as StartupSignedOut).legacyImport.found, isFalse);
    expect(device.auth.refreshCalls, ['legacy-r']);
    expect(device.web.reads, 1);
  });

  test('fresh install: no WebView data, an empty receipt, never asked again', () async {
    final device = Device(InMemoryLegacyPreferences(), hasWebData: false);
    final first = await launch(device);
    expect(first.result, isA<StartupNeedsLanguage>());
    expect((first.result as StartupOpened).legacyImport.source, MigrationSource.none);
    await launch(device);
    expect(device.web.reads, 1);
  });
}
