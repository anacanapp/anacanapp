// Ported from: (no React counterpart) — consumer of the 53.0 bridge export written by
// src/lib/migration-export.ts (docs/flutter/LEGACY_STORAGE.md "The export entry").
//
// Runs once after the upgrade: copies the exported localStorage strings byte for byte into the
// LocalStore under the same keys, so the stores (zustand envelopes), the offline outbox
// (`anacan_outbox_v1:<uid>`, replayed with the same ids) and every feature that read localStorage
// directly find their values. The source is the 53.0 export or, without one, the hidden-WebView
// read of the old localStorage (MigrationImport). Rules:
// - every account's keys are imported, like the WebView localStorage kept them: features only read
//   the keys of the signed-in user, and a user who was signed out at upgrade time (logout tombstone)
//   finds their device-only data (unsent outbox, letters, plans) again when they sign back in, as in
//   the Capacitor app. Keys of other accounts than the current one are reported in `otherAccount`;
// - a key Flutter already has is never overwritten (Flutter data is newer);
// - credentials, the react-query cache and server caches are never imported, even if present;
// - `skipped` keys are absent from `entries` and therefore treated as missing;
// - one-way and once: the receipt (`anacan.migration.localstore.imported.v1`) is written after the
//   LocalStore is on disk; a later launch never re-applies the legacy data.

import '../core/storage/migration_import.dart';
import 'local_store.dart';

final RegExp _uuid = RegExp(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');

/// Never imported (credentials / server caches / admission state), whatever the export holds.
bool isExcludedLegacyKey(String key) =>
    (key.startsWith('sb-') && key.contains('-auth-token')) ||
    key.startsWith('anacan.auth') ||
    key.startsWith('anacan.backend-admission') ||
    key == 'anacan-rq-cache' ||
    key.startsWith('anacan_ocache_v1:') ||
    key.startsWith('anacan_i18n_cache:') ||
    key.startsWith('anacan_i18n_sig:');

/// True when [key] belongs to another account than [currentUserId].
bool isOtherAccountKey(String key, String? currentUserId) {
  final ids = _uuid.allMatches(key).map((m) => m.group(0)!.toLowerCase()).toList();
  if (ids.isEmpty) return false;
  final current = currentUserId?.toLowerCase();
  return current == null || !ids.contains(current);
}

class LegacyImportResult {
  const LegacyImportResult({
    this.found = false,
    this.source,
    this.imported = const [],
    this.keptExisting = const [],
    this.otherAccount = const [],
    this.excluded = const [],
    this.marked = false,
  });

  final bool found;

  /// [MigrationSource] of the adopted data (null when nothing was pending).
  final String? source;
  final List<String> imported;
  final List<String> keptExisting;
  final List<String> otherAccount;
  final List<String> excluded;
  final bool marked;
}

class LegacyStateImporter {
  LegacyStateImporter({required this.migration, required this.store});

  final MigrationImport migration;
  final LocalStore store;

  /// Imports the pending export (if any) for [currentUserId] and records the one-time marker.
  /// Never throws.
  Future<LegacyImportResult> run({String? currentUserId}) async {
    MigrationExport? export;
    try {
      export = await migration.pendingImport();
    } catch (_) {
      return const LegacyImportResult();
    }
    if (export == null) return const LegacyImportResult();
    final result = importEntries(export.entries, currentUserId: currentUserId);
    var marked = false;
    try {
      await store.flush();
      await migration.markImported(export);
      marked = true;
    } catch (_) {
      // Next launch tries again; keys already present are kept, so a retry is harmless.
    }
    return LegacyImportResult(
      found: true,
      source: export.source,
      imported: result.imported,
      keptExisting: result.keptExisting,
      otherAccount: result.otherAccount,
      excluded: result.excluded,
      marked: marked,
    );
  }

  /// The copy step (pure apart from the store writes).
  LegacyImportResult importEntries(Map<String, String> entries, {String? currentUserId}) {
    final imported = <String>[], kept = <String>[], other = <String>[], excluded = <String>[];
    for (final MapEntry(:key, :value) in entries.entries) {
      if (isExcludedLegacyKey(key)) {
        excluded.add(key);
      } else if (store.containsKey(key)) {
        kept.add(key);
      } else {
        store.setItem(key, value);
        imported.add(key);
        if (isOtherAccountKey(key, currentUserId)) other.add(key);
      }
    }
    return LegacyImportResult(found: true, imported: imported, keptExisting: kept, otherAccount: other, excluded: excluded);
  }
}
