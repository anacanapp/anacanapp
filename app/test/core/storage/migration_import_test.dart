// Ported from: (Flutter-only) reader of the bridge-release export anacan.migration.localstore.v1.

import 'dart:convert';

import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/legacy_web_storage.dart';
import 'package:anacan/core/storage/migration_import.dart';
import 'package:flutter_test/flutter_test.dart';

String export({Object? schema = migrationExportSchema, Object? entries, Object? skipped}) => jsonEncode({
      'schema': schema,
      'exportedAt': '2026-11-20T10:00:00.000Z',
      'appVersion': '53.0',
      'entries': entries ??
          {
            'anacan_app_lock_pin': '{"hash":"h","salt":"s"}',
            'anacan_has_seen_intro': 'true',
            'game:word-garden:progress:v1': '{"level":3}',
            'game:color-sort:best': '42',
          },
      'skipped': ?skipped,
    });

void main() {
  test('exposes raw and typed values of a valid export', () async {
    final prefs = InMemoryLegacyPreferences({migrationExportKey: export(skipped: ['big-cache'])});
    final result = await MigrationImport(prefs).read();
    final data = (result as MigrationExportFound).export;
    expect(data.appVersion, '53.0');
    expect(data.exportedAt, '2026-11-20T10:00:00.000Z');
    expect(data.raw('anacan_app_lock_pin'), '{"hash":"h","salt":"s"}');
    expect(data.boolean('anacan_has_seen_intro'), isTrue);
    expect(data.integer('game:color-sort:best'), 42);
    expect(data.jsonObject('game:word-garden:progress:v1'), {'level': 3});
    expect(data.json('anacan_has_seen_intro'), true);
    expect(data.keysWithPrefix('game:'), hasLength(2));
    expect(data.skipped, ['big-cache']);
    expect(data.has('missing'), isFalse);
    expect(data.boolean('missing'), isNull);
  });

  test('tolerates absence and every kind of corruption', () async {
    final cases = <String?, MigrationExportProblem>{
      null: MigrationExportProblem.absent,
      'not-json': MigrationExportProblem.notJson,
      '[]': MigrationExportProblem.wrongSchema,
      export(schema: 'other'): MigrationExportProblem.wrongSchema,
      export(entries: ['x']): MigrationExportProblem.malformedEntries,
    };
    for (final MapEntry(:key, :value) in cases.entries) {
      final result = parseMigrationExport(key);
      expect(result, isA<MigrationExportMissing>().having((r) => r.problem, 'problem', value), reason: key);
    }
    final failing = InMemoryLegacyPreferences()..onGet = (_) async => throw Exception('bridge');
    expect(await MigrationImport(failing).read(),
        isA<MigrationExportMissing>().having((r) => r.problem, 'problem', MigrationExportProblem.unreadable));
  });

  test('ignores non-string entry values instead of failing', () {
    final result = parseMigrationExport(export(entries: {'a': 'ok', 'b': 3, 'c': null})) as MigrationExportFound;
    expect(result.export.entries, {'a': 'ok'});
    expect(result.export.ignoredEntries, 2);
  });

  test('imports once and leaves the export in place for a rollback build', () async {
    final prefs = InMemoryLegacyPreferences({migrationExportKey: export()});
    final importer = MigrationImport(prefs, now: () => DateTime.utc(2026, 11, 27));
    final pending = await importer.pendingImport();
    expect(pending, isNotNull);
    await importer.markImported(pending!);
    expect(await importer.isImported(), isTrue);
    expect(await importer.pendingImport(), isNull);
    expect(prefs.values[migrationExportKey], export());
    expect(jsonDecode(prefs.values[migrationImportedKey]!), {
      'schema': migrationImportedSchema,
      'exportedAt': '2026-11-20T10:00:00.000Z',
      'appVersion': '53.0',
      'importedAt': '2026-11-27T00:00:00.000Z',
      'source': 'export',
      'entries': 4,
    });
  });

  group('hidden-WebView fallback', () {
    const legacyLocalStorage = {
      'anacan_lock_enabled': '1',
      'anacan-timers': '{"state":{"activeTimers":[]},"version":0}',
      'sb-tntbjulojatnrqmylorp-auth-token': '{"access_token":"a","refresh_token":"r"}',
      'anacan-rq-cache': '{}',
    };

    test('no export (52 → 60): the WebView localStorage becomes the export, credentials stay out', () async {
      final prefs = InMemoryLegacyPreferences();
      final web = InMemoryLegacyWebStorageReader(legacyLocalStorage);
      final importer = MigrationImport(prefs, webStorage: web);
      final pending = (await importer.pendingImport())!;
      expect(pending.source, MigrationSource.webView);
      expect(pending.entries.keys, unorderedEquals(['anacan_lock_enabled', 'anacan-timers']));
      await importer.markImported(pending);
      expect(await importer.pendingImport(), isNull);
      expect(web.reads, 1);
      expect(jsonDecode(prefs.values[migrationImportedKey]!), containsPair('source', 'webview'));
      // One-way: the Capacitor export key is never written by Flutter.
      expect(prefs.values.containsKey(migrationExportKey), isFalse);
    });

    test('a corrupt export also falls back to the WebView', () async {
      final prefs = InMemoryLegacyPreferences({migrationExportKey: 'not-json'});
      final pending = await MigrationImport(prefs, webStorage: InMemoryLegacyWebStorageReader(legacyLocalStorage))
          .pendingImport();
      expect(pending!.source, MigrationSource.webView);
    });

    test('a fresh install records an empty receipt and never opens a WebView again', () async {
      final prefs = InMemoryLegacyPreferences();
      final web = InMemoryLegacyWebStorageReader({}, false);
      final importer = MigrationImport(prefs, webStorage: web);
      final pending = (await importer.pendingImport())!;
      expect(pending.source, MigrationSource.none);
      expect(pending.entries, isEmpty);
      await importer.markImported(pending);
      expect(await importer.pendingImport(), isNull);
      expect(web.reads, 1);
    });

    test('a failed read is retried on the next launches, then given up after the cap', () async {
      final prefs = InMemoryLegacyPreferences();
      final web = InMemoryLegacyWebStorageReader(legacyLocalStorage)..failWith = 'TIMEOUT';
      final importer = MigrationImport(prefs, webStorage: web);
      expect(await importer.pendingImport(), isNull);
      expect(await importer.pendingImport(), isNull);
      final last = (await importer.pendingImport())!;
      expect(last.source, MigrationSource.webViewUnavailable);
      expect(prefs.values[migrationWebStorageAttemptsKey], '$maxWebStorageAttempts');
    });

    test('a Preferences bridge failure decides nothing (no WebView, no attempt)', () async {
      final prefs = InMemoryLegacyPreferences()..onGet = (key) async => key == migrationExportKey ? throw Exception('bridge') : null;
      final web = InMemoryLegacyWebStorageReader(legacyLocalStorage);
      expect(await MigrationImport(prefs, webStorage: web).pendingImport(), isNull);
      expect(web.reads, 0);
    });

    test('keys the 53.0 exporter skipped (size caps) are recovered from the WebView', () async {
      const uid = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
      final chat = '{"2026-11-27":[{"id":"1","from":"me","text":"${'x' * 300000}","at":1}]}';
      final prefs = InMemoryLegacyPreferences({
        migrationExportKey: export(entries: {'anacan_lock_enabled': '1'}, skipped: ['anacan_baby_chat_v1:$uid']),
      });
      final web = InMemoryLegacyWebStorageReader({
        'anacan_lock_enabled': '0',
        'anacan_baby_chat_v1:$uid': chat,
      });
      final pending = (await MigrationImport(prefs, webStorage: web).pendingImport())!;
      expect(pending.source, MigrationSource.bridgeExportAndWebView);
      expect(pending.raw('anacan_baby_chat_v1:$uid'), chat);
      // The export stays authoritative for the keys it holds.
      expect(pending.raw('anacan_lock_enabled'), '1');
      expect(pending.skipped, isEmpty);
      // Without skipped keys no WebView is opened.
      final plain = InMemoryLegacyWebStorageReader({});
      await MigrationImport(InMemoryLegacyPreferences({migrationExportKey: export()}), webStorage: plain).pendingImport();
      expect(plain.reads, 0);
    });
  });
}
