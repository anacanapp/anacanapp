// Ported from: src/integrations/supabase/auth-storage-key.test.ts

import 'package:anacan/core/session/auth_storage_key.dart';
import 'package:anacan/core/storage/js_compat.dart';
import 'package:flutter_test/flutter_test.dart';

const azure = 'https://anacan-gateway.example.azurecontainerapps.io';
const current = 'sb-anacan-gateway-auth-token';
final marker = 'anacan.auth-key.v1:${encodeUriComponent(azure)}';
const defaults = AuthStorageSelection(storageKey: current, realm: azure, allowLegacyFallback: false);
const legacySelection =
    AuthStorageSelection(storageKey: legacyAuthStorageKey, realm: sourceAuthRealm, allowLegacyFallback: true);

class FakeStorage implements SyncStorage {
  final Map<String, String> values = {};
  final List<String> getCalls = [];
  bool blockGet = false, blockSet = false;

  @override
  String? getItem(String key) {
    getCalls.add(key);
    if (blockGet) throw StateError('blocked');
    return values[key];
  }

  @override
  void setItem(String key, String value) {
    if (blockSet) throw StateError('blocked');
    values[key] = value;
  }

  void removeItem(String key) => values.remove(key);
}

class FakeBrowser implements BrowserContext {
  FakeBrowser(this.hostname, this.storage, {this.blocked = false});

  @override
  final String hostname;
  final FakeStorage storage;
  final bool blocked;

  @override
  SyncStorage get localStorage {
    if (blocked) throw StateError('blocked');
    return storage;
  }
}

late FakeStorage localStorage;
FakeBrowser browser([String hostname = 'app.anacan.az']) => FakeBrowser(hostname, localStorage);

void main() {
  setUp(() => localStorage = FakeStorage());

  test('keeps the exact source/native 25 namespace and source fallback without reading storage', () {
    expect(resolveAuthStorage(sourceAuthRealm, browser: browser()), legacySelection);
    expect(resolveAuthStorage('$sourceAuthRealm/', cutover: true, browser: browser()).storageKey, legacyAuthStorageKey);
    expect(localStorage.getCalls, isEmpty);
  });

  test('leaves Azure preview unchanged unless explicitly enabled', () {
    localStorage.values[legacyAuthStorageKey] = 'source-session';
    expect(resolveAuthStorage(azure, browser: browser()), defaults);
    // (The vitest string-'true' case cannot be expressed: `cutover` is a typed bool.)
    expect(localStorage.getCalls, isEmpty);
  });

  test('preserves an existing destination session even if it is expired or malformed', () {
    localStorage.values[legacyAuthStorageKey] = 'source-session';
    localStorage.values[current] = 'not-json';
    expect(resolveAuthStorage(azure, cutover: true, browser: browser()), defaults);
    expect(localStorage.values[marker], current);
    expect(localStorage.values[current], 'not-json');
    expect(localStorage.values[legacyAuthStorageKey], 'source-session');
  });

  test('pins the legacy namespace without reading, copying or scanning source credentials', () {
    expect(resolveAuthStorage(azure, cutover: true, browser: browser()), legacySelection);
    expect(localStorage.getCalls, [marker, current]);
    expect(localStorage.values[marker], legacyAuthStorageKey);
  });

  test('does not resurrect an alternate entry after destination logout', () {
    localStorage.values[current] = 'azure-session';
    resolveAuthStorage(azure, cutover: true, browser: browser());
    localStorage.removeItem(current);
    localStorage.values[legacyAuthStorageKey] = 'old-source-session';
    expect(resolveAuthStorage(azure, cutover: true, browser: browser()), defaults);
    expect(localStorage.values[marker], current);
  });

  test('retains a legacy pin through logout rather than selecting a later alternate entry', () {
    resolveAuthStorage(azure, cutover: true, browser: browser());
    localStorage.values[current] = 'alternate-session';
    expect(resolveAuthStorage(azure, cutover: true, browser: browser()).storageKey, legacyAuthStorageKey);
  });

  test('fails closed on an invalid pin without changing it', () {
    localStorage.values[marker] = 'sb-unrelated-auth-token';
    expect(resolveAuthStorage(azure, cutover: true, browser: browser()), defaults);
    expect(localStorage.values[marker], 'sb-unrelated-auth-token');
  });

  for (final operation in ['getItem', 'setItem']) {
    group('blocked $operation', () {
      test('uses the default realm with no source backup eligibility', () {
        if (operation == 'getItem') localStorage.blockGet = true;
        if (operation == 'setItem') localStorage.blockSet = true;
        expect(resolveAuthStorage(azure, cutover: true, browser: browser()), defaults);
      });
    });
  }

  test('handles a throwing localStorage getter and an absent browser', () {
    expect(resolveAuthStorage(azure, cutover: true, browser: FakeBrowser('app.anacan.az', localStorage, blocked: true)),
        defaults);
    expect(resolveAuthStorage(azure, cutover: true), defaults);
  });

  for (final hostname in [
    'id-preview--00000000-0000-4000-8000-000000000000.lovableproject.com',
    'project--00000000-0000-4000-8000-000000000000.lovableproject-dev.com',
    'preview.lovable.app', 'preview.gpt-eng.com', 'preview.gptengineer.run',
    'anacan-gateway.example.azurecontainerapps.io', 'localhost',
    'anacan.az.attacker.example', 'notanacan.az',
  ]) {
    test('does not enable migration on $hostname, even with the flag', () {
      expect(resolveAuthStorage(azure, cutover: true, browser: browser(hostname)), defaults);
      expect(localStorage.getCalls, isEmpty);
    });
  }

  test('binds backup realms and pins to the full backend URL, not just its first label', () {
    const other = 'https://anacan-gateway.other.example';
    localStorage.values[marker] = current;
    expect(resolveAuthStorage(other, browser: browser()),
        const AuthStorageSelection(storageKey: current, realm: other, allowLegacyFallback: false));
    expect(resolveAuthStorage(other, cutover: true, browser: browser()).storageKey, legacyAuthStorageKey);
  });

  // Flutter-only: JS encodeURIComponent compatibility of every storage key built from a realm.
  test('encodes realms exactly like JavaScript encodeURIComponent', () {
    expect(encodeUriComponent(sourceAuthRealm), 'https%3A%2F%2Ftntbjulojatnrqmylorp.supabase.co');
    expect(encodeUriComponent("a b!*'()~_.-é"), "a%20b!*'()~_.-%C3%A9");
  });
}
