// Ported from: src/lib/recap/fixtures.ts (RECAP_PERSONAS, via app/test/domain/fixtures/recap.json)
import 'dart:convert';
import 'dart:io';

List<Map<String, Object?>>? _cases;

List<Map<String, Object?>> _all() =>
    _cases ??= [for (final c in jsonDecode(File('test/domain/fixtures/recap.json').readAsStringSync()) as List) (c as Map).cast<String, Object?>()];

/// The parsed persona data (`RECAP_PERSONAS[name]`).
Map<String, Object?> recapFixtureData(String name, [String lang = 'az']) =>
    (_all().firstWhere((c) => c['name'] == name && c['lang'] == lang)['data']! as Map).cast<String, Object?>();

/// The model the TypeScript `buildRecapModel` produced for that persona and language.
Map<String, Object?> recapFixtureModel(String name, [String lang = 'az']) =>
    (_all().firstWhere((c) => c['name'] == name && c['lang'] == lang)['model']! as Map).cast<String, Object?>();
