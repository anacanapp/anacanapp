// Ported from: (no React counterpart yet) — reader of the bridge-release export written by the
// Capacitor 53 app (docs/FLUTTER_MIGRATION_PLAN.md §6; key list in docs/flutter/LEGACY_STORAGE.md).
//
// Export, in the Capacitor Preferences store:
//   anacan.migration.localstore.v1 = {"schema":"anacan-migration-localstore-v1","exportedAt":…,
//     "appVersion":…, "entries":{"<localStorage key>":"<raw string value>",…}, "skipped":[…]?}
// The importer is generic: it exposes the raw localStorage strings by key plus typed
// accessors. Feature code decides which keys it adopts. It never throws on a missing
// or corrupt export; it reports what it found instead.

import 'dart:convert';

import 'legacy_preferences.dart';

const String migrationExportKey = 'anacan.migration.localstore.v1';
const String migrationExportSchema = 'anacan-migration-localstore-v1';

/// One-time marker (Capacitor store), written after the Flutter app adopted an export.
const String migrationImportedKey = 'anacan.migration.localstore.imported.v1';
const String migrationImportedSchema = 'anacan-migration-imported-v1';

/// Why no export is available.
enum MigrationExportProblem { absent, unreadable, notJson, wrongSchema, malformedEntries }

/// A parsed export.
class MigrationExport {
  MigrationExport._({
    required this.exportedAt,
    required this.appVersion,
    required Map<String, String> entries,
    required List<Object?> skipped,
  })  : entries = Map.unmodifiable(entries),
        skipped = List.unmodifiable(skipped);

  /// As written by the exporter (ISO string or epoch milliseconds); kept verbatim.
  final Object? exportedAt;
  final String? appVersion;

  /// localStorage key → raw string value.
  final Map<String, String> entries;

  /// Keys the exporter left out (with its own reasons); informational.
  final List<Object?> skipped;

  /// Number of entry values that were not strings and were ignored.
  int ignoredEntries = 0;

  bool has(String key) => entries.containsKey(key);

  String? raw(String key) => entries[key];

  /// `'true'`/`'false'` (the localStorage convention); anything else → null.
  bool? boolean(String key) => switch (entries[key]) {
        'true' => true,
        'false' => false,
        _ => null,
      };

  int? integer(String key) {
    final value = entries[key];
    return value == null ? null : int.tryParse(value.trim());
  }

  double? number(String key) {
    final value = entries[key];
    return value == null ? null : double.tryParse(value.trim());
  }

  /// `JSON.parse(raw)`, or null when absent/unparseable.
  Object? json(String key) {
    final value = entries[key];
    if (value == null) return null;
    try {
      return jsonDecode(value);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic>? jsonObject(String key) {
    final value = json(key);
    return value is Map<String, dynamic> ? value : null;
  }

  /// Keys with a given prefix (e.g. per-user or per-game namespaces).
  Iterable<String> keysWithPrefix(String prefix) => entries.keys.where((key) => key.startsWith(prefix));
}

/// Result of [MigrationImport.read].
sealed class MigrationExportResult {
  const MigrationExportResult();
}

final class MigrationExportFound extends MigrationExportResult {
  const MigrationExportFound(this.export);
  final MigrationExport export;
}

final class MigrationExportMissing extends MigrationExportResult {
  const MigrationExportMissing(this.problem);
  final MigrationExportProblem problem;
}

/// Parse an export string. Never throws.
MigrationExportResult parseMigrationExport(String? value) {
  if (value == null) return const MigrationExportMissing(MigrationExportProblem.absent);
  Object? decoded;
  try {
    decoded = jsonDecode(value);
  } catch (_) {
    return const MigrationExportMissing(MigrationExportProblem.notJson);
  }
  if (decoded is! Map || decoded['schema'] != migrationExportSchema) {
    return const MigrationExportMissing(MigrationExportProblem.wrongSchema);
  }
  final rawEntries = decoded['entries'];
  if (rawEntries is! Map) return const MigrationExportMissing(MigrationExportProblem.malformedEntries);
  final entries = <String, String>{};
  var ignored = 0;
  rawEntries.forEach((key, entry) {
    if (key is String && entry is String) {
      entries[key] = entry;
    } else {
      ignored++;
    }
  });
  final skipped = decoded['skipped'];
  final appVersion = decoded['appVersion'];
  return MigrationExportFound(MigrationExport._(
    exportedAt: decoded['exportedAt'],
    appVersion: appVersion is String ? appVersion : null,
    entries: entries,
    skipped: skipped is List ? skipped : const [],
  )..ignoredEntries = ignored);
}

/// Reads the bridge export from the Capacitor store and keeps the one-time marker.
class MigrationImport {
  MigrationImport(this.preferences, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final LegacyPreferences preferences;
  final DateTime Function() _now;

  Future<MigrationExportResult> read() async {
    String? value;
    try {
      value = await preferences.get(migrationExportKey);
    } catch (_) {
      return const MigrationExportMissing(MigrationExportProblem.unreadable);
    }
    return parseMigrationExport(value);
  }

  /// True once [markImported] succeeded on this device. A corrupt marker counts as
  /// imported (never re-apply an old export over newer Flutter data).
  Future<bool> isImported() async {
    try {
      return await preferences.get(migrationImportedKey) != null;
    } catch (_) {
      return false;
    }
  }

  /// The export to adopt, or null when there is none or it was already imported.
  Future<MigrationExport?> pendingImport() async {
    if (await isImported()) return null;
    final result = await read();
    return result is MigrationExportFound ? result.export : null;
  }

  /// Record that [export] was adopted. The export itself stays untouched so a rollback
  /// build (which rewrites it) and a later diagnosis still see it.
  Future<void> markImported(MigrationExport export) => preferences.set(
        migrationImportedKey,
        jsonEncode({
          'schema': migrationImportedSchema,
          'exportedAt': export.exportedAt,
          'appVersion': export.appVersion,
          'importedAt': _now().toUtc().toIso8601String(),
        }),
      );
}
