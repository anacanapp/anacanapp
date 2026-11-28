// Ported from: src/lib/privacyConsent.ts (loadPrivacyConsent: Preferences copy restores localStorage).

import 'dart:convert';

import 'package:anacan/core/data/privacy_consent.dart';
import 'package:anacan/core/storage/key_value_store.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

const decided = '{"analytics":true,"ads":false,"attribution":true,"decidedAt":"2026-10-01T09:00:00.000Z"}';

void main() {
  test('the Preferences decision fills an empty LocalStore (52 → 60 has no other copy)', () async {
    final store = LocalStore.memory();
    expect(await restorePrivacyConsent(store, InMemoryKeyValueStore({kPrivacyConsentKey: decided})), isTrue);
    expect(jsonDecode(store.getItem(kPrivacyConsentKey)!), jsonDecode(decided));
  });

  test('a different decision in Preferences wins; the same one changes nothing', () async {
    final store = LocalStore.memory({kPrivacyConsentKey: '{"analytics":false,"ads":false,"attribution":false,"decidedAt":"2026-01-01T00:00:00.000Z"}'});
    expect(await restorePrivacyConsent(store, InMemoryKeyValueStore({kPrivacyConsentKey: decided})), isTrue);
    expect(PrivacyConsent.parse(store.readJson(kPrivacyConsentKey)).analytics, isTrue);
    expect(await restorePrivacyConsent(store, InMemoryKeyValueStore({kPrivacyConsentKey: decided})), isFalse);
  });

  test('absent, corrupt or undecided Preferences never touch the LocalStore', () async {
    for (final raw in [null, 'nope', '{"analytics":true}']) {
      final store = LocalStore.memory({kPrivacyConsentKey: decided});
      final prefs = InMemoryKeyValueStore({kPrivacyConsentKey: ?raw});
      expect(await restorePrivacyConsent(store, prefs), isFalse, reason: raw);
      expect(store.getItem(kPrivacyConsentKey), decided);
    }
  });
}
