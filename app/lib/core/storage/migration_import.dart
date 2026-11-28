// Ported from: (no React counterpart yet) — reader of the bridge-release export written by the
// Capacitor 53 app (docs/FLUTTER_MIGRATION_PLAN.md §6; key list in docs/flutter/LEGACY_STORAGE.md).
//
// Export, in the Capacitor Preferences store:
//   anacan.migration.localstore.v1 = {"schema":"anacan-migration-localstore-v1","exportedAt":…,
//     "appVersion":…, "entries":{"<localStorage key>":"<raw string value>",…}, "skipped":[…]?}
// The importer is generic: it exposes the raw localStorage strings by key plus typed
// accessors. Feature code decides which keys it adopts. It never throws on a missing
// or corrupt export; it reports what it found instead.
//
// Fallback (plan §6): when there is no usable export (52 → 60, or 53.0 never wrote one), the
// WebView localStorage is read once through a hidden WebView on the old origin
// ([LegacyWebStorageReader]) and handed to the same importer as a synthetic export. The same
// read also recovers the keys a 53.0 export listed under `skipped` (size caps). One-way: neither
// path writes the old stores (only the Flutter receipt/attempt keys below).

import 'dart:convert';

import 'legacy_preferences.dart';
import 'legacy_web_storage.dart';

const String migrationExportKey = 'anacan.migration.localstore.v1';
const String migrationExportSchema = 'anacan-migration-localstore-v1';

/// One-time marker (Capacitor store), written after the Flutter app adopted an export.
const String migrationImportedKey = 'anacan.migration.localstore.imported.v1';
const String migrationImportedSchema = 'anacan-migration-imported-v1';

/// Failed hidden-WebView reads so far (Capacitor store, Flutter-owned key). After
/// [maxWebStorageAttempts] the import is recorded as done without the WebView data, so a device
/// whose WebView cannot be read does not pay the timeout on every launch.
const String migrationWebStorageAttemptsKey = 'anacan.migration.webview.attempts.v1';
const int maxWebStorageAttempts = 3;

/// Where an adopted export came from.
abstract final class MigrationSource {
  /// The 53.0 bridge export.
  static const String bridgeExport = 'export';

  /// The 53.0 export plus its `skipped` keys read through the hidden WebView.
  static const String bridgeExportAndWebView = 'export+webview';

  /// The hidden-WebView fallback (no export).
  static const String webView = 'webview';

  /// Nothing to adopt (fresh install / no legacy WebView data).
  static const String none = 'none';

  /// The WebView could not be read within [maxWebStorageAttempts] launches.
  static const String webViewUnavailable = 'webview-unavailable';
}

/// Why no export is available.
enum MigrationExportProblem { absent, unreadable, notJson, wrongSchema, malformedEntries }

/// A parsed export.
class MigrationExport {
  MigrationExport._({
    required this.exportedAt,
    required this.appVersion,
    required Map<String, String> entries,
    required List<Object?> skipped,
    this.source = MigrationSource.bridgeExport,
  })  : entries = Map.unmodifiable(entries),
        skipped = List.unmodifiable(skipped);

  /// An export assembled by Flutter itself (hidden-WebView read, or nothing to adopt).
  MigrationExport.synthetic({
    required String source,
    Map<String, String> entries = const {},
    Object? exportedAt,
    String? appVersion,
  }) : this._(exportedAt: exportedAt, appVersion: appVersion, entries: entries, skipped: const [], source: source);

  /// One of [MigrationSource].
  final String source;

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
  MigrationImport(this.preferences, {this.webStorage, DateTime Function()? now}) : _now = now ?? DateTime.now;

  final LegacyPreferences preferences;

  /// Hidden-WebView fallback; null disables it (only the 53.0 export is used).
  final LegacyWebStorageReader? webStorage;
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

  /// The export to adopt, or null when it was already imported or nothing can be decided this
  /// launch (Preferences bridge failure, or a failed WebView read with attempts left). An
  /// empty synthetic export ([MigrationSource.none] / [MigrationSource.webViewUnavailable]) means
  /// "nothing to adopt, record the receipt".
  Future<MigrationExport?> pendingImport() async {
    if (await isImported()) return null;
    final result = await read();
    if (result is MigrationExportFound) return _withSkipped(result.export);
    // A Preferences bridge failure says nothing about the export: try again next launch.
    if (result is MigrationExportMissing && result.problem == MigrationExportProblem.unreadable) return null;
    return _fromWebStorage();
  }

  /// Adds the keys the 53.0 exporter skipped (size caps) from the WebView, when it can be read.
  Future<MigrationExport> _withSkipped(MigrationExport export) async {
    final reader = webStorage;
    final skipped = {for (final key in export.skipped) if (key is String) key};
    if (reader == null || skipped.isEmpty) return export;
    final web = await reader.read();
    if (web is! LegacyWebStorageEntries) return export;
    final recovered = {
      for (final MapEntry(:key, :value) in web.entries.entries)
        if (skipped.contains(key) && !export.entries.containsKey(key)) key: value,
    };
    if (recovered.isEmpty) return export;
    return MigrationExport._(
      exportedAt: export.exportedAt,
      appVersion: export.appVersion,
      entries: {...export.entries, ...recovered},
      skipped: [for (final key in export.skipped) if (!recovered.containsKey(key)) key],
      source: MigrationSource.bridgeExportAndWebView,
    )..ignoredEntries = export.ignoredEntries;
  }

  Future<MigrationExport?> _fromWebStorage() async {
    final reader = webStorage;
    if (reader == null) return null;
    final web = await reader.read();
    switch (web) {
      case LegacyWebStorageEntries(:final entries):
        return MigrationExport.synthetic(source: MigrationSource.webView, entries: entries);
      case LegacyWebStorageNone():
        return MigrationExport.synthetic(source: MigrationSource.none);
      case LegacyWebStorageFailed():
        final attempts = await _bumpAttempts();
        if (attempts == null || attempts < maxWebStorageAttempts) return null;
        return MigrationExport.synthetic(source: MigrationSource.webViewUnavailable);
    }
  }

  /// Counts a failed WebView read; null when the counter cannot be stored (then: retry, no cap).
  Future<int?> _bumpAttempts() async {
    try {
      final next = (int.tryParse(await preferences.get(migrationWebStorageAttemptsKey) ?? '') ?? 0) + 1;
      await preferences.set(migrationWebStorageAttemptsKey, '$next');
      return next;
    } catch (_) {
      return null;
    }
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
          'source': export.source,
          'entries': export.entries.length,
        }),
      );
}
