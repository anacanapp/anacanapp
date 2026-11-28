// Ported from: src/lib/migration-export.test.ts (rule selection) + a drift guard against src/lib/migration-export.ts.

import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/storage/legacy_web_storage.dart';
import 'package:anacan/core/storage/migration_export_rules.dart';
import 'package:flutter_test/flutter_test.dart';

String _between(String text, String start, String end) {
  final from = text.indexOf(start);
  expect(from, isNonNegative, reason: start);
  final to = text.indexOf(end, from + start.length);
  return text.substring(from + start.length, to);
}

void main() {
  final source = File('../src/lib/migration-export.ts');

  test('the Dart rule list is the TypeScript MIGRATION_EXPORT_RULES, in order', () {
    final text = source.readAsStringSync();
    final block = _between(text, 'MIGRATION_EXPORT_RULES: readonly MigrationKeyRule[] = [', '\n];');
    final ts = <(String, String, bool)>[];
    for (final call in RegExp(r'\.\.\.(exact|prefix)\(([^)]*)\)', dotAll: true).allMatches(block)) {
      final strings = [for (final m in RegExp(r"'([^']*)'").allMatches(call.group(2)!)) m.group(1)!];
      for (final key in strings.skip(1)) {
        ts.add((strings.first, key, call.group(1) == 'prefix'));
      }
    }
    expect(ts, hasLength(greaterThan(80)));
    expect([for (final r in migrationExportRules) (r.area, r.key, r.prefix)], ts);
  }, skip: source.existsSync() ? false : 'src/ not present');

  test('the excluded patterns are the TypeScript MIGRATION_EXPORT_EXCLUDED', () {
    final text = source.readAsStringSync();
    final block = _between(text, 'MIGRATION_EXPORT_EXCLUDED: readonly RegExp[] = [', '\n];');
    final ts = [
      for (final m in RegExp(r'/((?:\\.|[^/\\\n])+)/([a-z]*)').allMatches(block)) (m.group(1)!, m.group(2)!),
    ];
    expect(migrationExportExcludedSources, ts);
  }, skip: source.existsSync() ? false : 'src/ not present');

  test('selects exactly the exportable keys and never credentials', () {
    const uid = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
    final selected = selectMigrationEntries({
      'anacan_lock_enabled': '1',
      'anacan_outbox_v1:$uid': '[]',
      'anacan_word_garden_v1:az:3:classic': '{}',
      'anacan_minigame_progress_memory': '{}',
      'language': 'ru',
      'sb-tntbjulojatnrqmylorp-auth-token': '{"access_token":"x"}',
      'anacan.auth.session.v2:x': '{}',
      'anacan-rq-cache': '{}',
      'anacan_i18n_cache:ru': '{}',
      'anacan_ocache_v1:children': '{}',
      'anacan_tour_v3_refresh_token': '1',
      'unrelated': 'x',
    });
    expect(selected.keys, unorderedEquals([
      'anacan_lock_enabled', 'anacan_outbox_v1:$uid', 'anacan_word_garden_v1:az:3:classic',
      'anacan_minigame_progress_memory', 'language',
    ]));
    expect(migrationRulePriority('anacan_lock_enabled'), 0);
    expect(isMigrationExportKey('anacan-timers'), isTrue);
  });

  test('the WebView script carries the same rules and only reads localStorage', () {
    final script = buildLegacyWebStorageScript();
    expect(script, contains('ls.getItem(k)'));
    expect(script, isNot(contains('setItem')));
    expect(script, isNot(contains('removeItem')));
    expect(script, isNot(contains('clear(')));
    final rules = jsonDecode(script.substring(script.lastIndexOf('})(') + 3, script.length - 1)) as Map;
    expect((rules['exact'] as List).length + (rules['prefixes'] as List).length, migrationExportRules.length);
    expect((rules['excluded'] as List).first, {'s': r'^sb-.*-auth-token', 'f': ''});
  });

  test('parses the script result and drops anything that is not exportable', () {
    final raw = jsonEncode({
      'length': 40,
      'entries': {'anacan-timers': '{}', 'sb-x-auth-token': 'secret', 'language': 3},
    });
    final parsed = parseLegacyWebStorageResult(raw)!;
    expect(parsed.entries, {'anacan-timers': '{}'});
    expect(parsed.totalKeys, 40);
    // Double-encoded (a WebView handing back the JSON string literal).
    expect(parseLegacyWebStorageResult(jsonEncode(raw))!.entries, {'anacan-timers': '{}'});
    expect(parseLegacyWebStorageResult('nope'), isNull);
    expect(parseLegacyWebStorageResult('{"entries":[]}'), isNull);
  });
}
