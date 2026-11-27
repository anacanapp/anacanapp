// Ported from: (localStorage semantics relied on by src/; LegacyStateImporter over the 53.0 export
// documented in docs/flutter/LEGACY_STORAGE.md)

import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:anacan/core/storage/migration_import.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';

const me = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const other = '11111111-2222-4333-8444-555555555555';

String exportJson(Map<String, String> entries) => jsonEncode({
      'schema': migrationExportSchema,
      'exportedAt': '2026-11-27T10:00:00.000Z',
      'appVersion': '53.0',
      'entries': entries,
      'skipped': ['anacan_baby_chat_v1:$me'],
    });

void main() {
  group('LocalStore', () {
    test('synchronous reads, debounced single write, flush on demand', () async {
      final backend = MemoryLocalStoreBackend({'a': '1'});
      final store = LocalStore(backend, debounce: const Duration(milliseconds: 20));
      await store.load();
      expect(store.getItem('a'), '1');
      store
        ..setItem('b', '2')
        ..setItem('b', '3')
        ..removeItem('a');
      expect(store.getItem('b'), '3');
      expect(backend.writes, 0);
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(backend.writes, 1);
      expect(backend.values, {'b': '3'});
      store.writeJson('j', {'x': 1});
      await store.flush();
      expect(store.readJson('j'), {'x': 1});
      expect(backend.writes, 2);
    });

    test('writes made before load completes never replace the stored map', () async {
      final backend = MemoryLocalStoreBackend({'kept': 'yes'});
      final store = LocalStore(backend);
      store.setItem('early', '1');
      await store.flush();
      expect(backend.values, {'kept': 'yes', 'early': '1'});
    });

    test('file backend round trip with temp file + rename', () async {
      final dir = await Directory.systemTemp.createTemp('local_store');
      addTearDown(() => dir.delete(recursive: true));
      final backend = FileLocalStoreBackend(directory: () async => dir);
      final store = LocalStore(backend);
      await store.load();
      store.setItem('anacan_lock_enabled', '1');
      store.setItem('big', 'x' * 70000);
      await store.flush();
      final again = LocalStore(FileLocalStoreBackend(directory: () async => dir));
      await again.load();
      expect(again.getItem('anacan_lock_enabled'), '1');
      expect(again.getItem('big')!.length, 70000);
      expect(File('${dir.path}/anacan_local_store_v1.json.tmp').existsSync(), isFalse);
    });

    test('change events fire for set and remove', () {
      final store = LocalStore.memory();
      final events = <String>[];
      store.changes.listen((c) => events.add('${c.key}:${c.oldValue}->${c.newValue}'));
      store
        ..setItem('k', 'v')
        ..removeItem('k');
      expect(events, ['k:null->v', 'k:v->null']);
    });
  });

  group('LegacyStateImporter', () {
    test('imports the current account and unscoped keys once, never credentials or other accounts', () async {
      final prefs = InMemoryLegacyPreferences({
        migrationExportKey: exportJson({
          'anacan-user-store': '{"state":{"userId":"$me","language":"tr"},"version":0}',
          'anacan_lock_enabled': '1',
          'anacan_outbox_v1:$me': '[{"id":"a","table":"baby_logs","payload":{"id":"a"},"createdAt":1,"attempts":2}]',
          'anacan_outbox_v1:$other': '[]',
          'anacan_consent_pending_v1:https://api.anacan.az:$me': '{"items":[]}',
          'sb-tntbjulojatnrqmylorp-auth-token': '{"access_token":"x"}',
          'anacan-rq-cache': '{}',
          'selected-child-storage': '{"state":{"selectedChildId":"c1"},"version":0}',
        }),
      });
      final store = LocalStore.memory({'selected-child-storage': '{"state":{"selectedChildId":"newer"},"version":0}'});
      final importer = LegacyStateImporter(migration: MigrationImport(prefs), store: store);
      final result = await importer.run(currentUserId: me);
      expect(result.found, isTrue);
      expect(result.marked, isTrue);
      expect(result.imported, containsAll(['anacan-user-store', 'anacan_lock_enabled', 'anacan_outbox_v1:$me',
        'anacan_consent_pending_v1:https://api.anacan.az:$me']));
      expect(result.otherAccount, ['anacan_outbox_v1:$other']);
      expect(result.excluded, containsAll(['sb-tntbjulojatnrqmylorp-auth-token', 'anacan-rq-cache']));
      expect(result.keptExisting, ['selected-child-storage']);
      expect(store.getItem('anacan_outbox_v1:$me'),
          '[{"id":"a","table":"baby_logs","payload":{"id":"a"},"createdAt":1,"attempts":2}]');
      expect(store.getItem('sb-tntbjulojatnrqmylorp-auth-token'), isNull);
      expect(store.getItem('selected-child-storage'), contains('newer'));
      // Second launch: marker present, nothing again.
      store.removeItem('anacan_lock_enabled');
      final again = await importer.run(currentUserId: me);
      expect(again.found, isFalse);
      expect(store.getItem('anacan_lock_enabled'), isNull);
    });

    test('signed out: only unscoped keys', () {
      final store = LocalStore.memory();
      final result = LegacyStateImporter(migration: MigrationImport(InMemoryLegacyPreferences()), store: store)
          .importEntries({'language': 'en', 'anacan_kick_active_v1:$me': '{}'});
      expect(result.imported, ['language']);
      expect(result.otherAccount, ['anacan_kick_active_v1:$me']);
    });
  });
}
