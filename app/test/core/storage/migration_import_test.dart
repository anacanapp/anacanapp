// Ported from: (Flutter-only) reader of the bridge-release export anacan.migration.localstore.v1.

import 'dart:convert';

import 'package:anacan/core/storage/legacy_preferences.dart';
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
    });
  });
}
