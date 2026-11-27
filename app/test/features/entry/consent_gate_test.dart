// Ported from: src/lib/consentGate.test.ts, src/hooks/useConsentGate.test.tsx (case names kept)
import 'dart:async';
import 'dart:io';

import 'package:anacan/core/auth/partner_link.dart' show RpcCall;
import 'package:anacan/features/entry/consent/consent_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate_controller.dart';
import 'package:anacan/shell/gates/gate_sequence.dart' show ConsentGateStatus;
import 'package:anacan/state/local_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

const b = 'https://api.anacan.az';
const u = '00000000-0000-4000-8000-000000000001';

ConsentState state({bool enabled = true, String? version = '2.0', Map<String, ConsentRecord> consents = const {}}) =>
    ConsentState(gate: ConsentGateConfig(enabled: enabled, version: version), consents: consents);
Map<String, ConsentRecord> terms(String version, [bool granted = true]) =>
    {'terms': ConsentRecord(granted: granted, documentVersion: version, createdAt: '2026-11-07T10:00:00Z')};
Map<String, Object?> termsJson(String v) =>
    {'terms': {'granted': true, 'document_version': v, 'created_at': '2026-11-07T10:00:00Z'}};

/// `mocks.rpc` with queued answers (a function returning the data or throwing).
class FakeRpc {
  final calls = <(String, Map<String, dynamic>?)>[];
  final queue = <FutureOr<Object?> Function()>[];
  FutureOr<Object?> Function()? fallback;
  RpcCall get call => (fn, [params]) async {
        calls.add((fn, params));
        final next = queue.isNotEmpty ? queue.removeAt(0) : fallback;
        if (next == null) return null;
        return await next();
      };
}

Object payload(Map<String, Object?> consents, [Map<String, Object?> gate = const {'enabled': true, 'version': '2.0'}]) =>
    {'gate': gate, 'consents': consents};

void main() {
  late FakeRpc rpc;
  late LocalStore store;
  late ConsentService service;
  var offline = false;
  setUp(() {
    rpc = FakeRpc();
    store = LocalStore.memory();
    offline = false;
    service = ConsentService(store: store, rpc: rpc.call, source: 'ios', deviceOffline: () => offline);
  });

  group('decideConsentGate', () {
    test('shows the gate when the Terms acceptance for the current version is missing', () {
      expect(decideConsentGate(state()), ConsentGateDecision.show);
    });
    test('skips when the current version was already accepted', () {
      expect(decideConsentGate(state(consents: terms('2.0'))), ConsentGateDecision.skip);
    });
    test('shows again after a version bump (accepted 1.0, current 2.0)', () {
      expect(decideConsentGate(state(consents: terms('1.0'))), ConsentGateDecision.show);
      expect(decideConsentGate(state(version: '2.1', consents: terms('2.0'))), ConsentGateDecision.show);
    });
    test('skips when the setting is disabled or has no valid version', () {
      expect(decideConsentGate(state(enabled: false)), ConsentGateDecision.skip);
      expect(decideConsentGate(state(version: null)), ConsentGateDecision.skip);
    });
    test('never locks anyone out when the RPC failed (state null)', () {
      expect(decideConsentGate(null), ConsentGateDecision.skip);
      expect(decideConsentGate(null, localAcceptedVersion: null), ConsentGateDecision.skip);
    });
    test('trusts a local acceptance of the same version (offline / pending send) but not of an older one', () {
      expect(decideConsentGate(state(), localAcceptedVersion: '2.0'), ConsentGateDecision.skip);
      expect(decideConsentGate(state(), localAcceptedVersion: '1.0'), ConsentGateDecision.show);
    });
  });

  group('required items', () {
    test('continues only with terms, health data and age 16 ticked; marketing is optional', () {
      expect(canContinue({}), isFalse);
      expect(canContinue({'terms': true, 'health_data': true}), isFalse);
      expect(canContinue({'terms': true, 'age_16': true, 'marketing': true}), isFalse);
      expect(canContinue({'terms': true, 'health_data': true, 'age_16': true}), isTrue);
      expect(canContinue({'terms': true, 'health_data': true, 'age_16': true, 'marketing': false}), isTrue);
    });
    test('records every kind with the current version, marketing as chosen', () {
      expect(gateItems({'terms': true, 'health_data': true, 'age_16': true}, '2.0'), const [
        ConsentItem('terms', true, '2.0'), ConsentItem('health_data', true, '2.0'),
        ConsentItem('age_16', true, '2.0'), ConsentItem('marketing', false, '2.0'),
      ]);
      expect(() => gateItems({'terms': true}, '2.0'), throwsA(isA<StateError>()));
    });
  });

  group('server state', () {
    test('parses my_consents_v1 and rejects malformed payloads', () {
      final parsed = parseConsentState({
        'gate': {'enabled': true, 'version': '2.0'},
        'consents': {...termsJson('2.0'), 'bogus': {'granted': true}},
      })!;
      expect(parsed.gate, const ConsentGateConfig(enabled: true, version: '2.0'));
      expect(parsed.consents.keys, ['terms']);
      expect(parsed.consents['terms']!.source, isNull);
      expect(parsed.consents['terms']!.createdAt, '2026-11-07T10:00:00Z');
      expect(parseConsentState('{"gate":{"enabled":true,"version":"x"},"consents":{}}')!.gate,
          const ConsentGateConfig(enabled: false, version: null));
      expect(parseConsentState(null), isNull);
      expect(parseConsentState({'consents': {}}), isNull);
    });
    test('returns null (→ skip) on an RPC error, a missing function, a throw or a timeout', () async {
      rpc.queue.add(() => throw const PostgrestException(code: 'PGRST202', message: 'Could not find the function'));
      expect(await service.fetchConsentState(), isNull);
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      expect(await service.fetchConsentState(), isNull);
      rpc.queue.add(() => Completer<Object?>().future);
      expect(await service.fetchConsentState(timeout: const Duration(milliseconds: 10)), isNull);
      rpc.queue.add(() => Completer<Object?>().future);
      expect(decideConsentGate(await service.fetchConsentState(timeout: const Duration(milliseconds: 10))), ConsentGateDecision.skip);
    });
  });

  group('acceptance', () {
    const choices = {'terms': true, 'health_data': true, 'age_16': true, 'marketing': true};
    test('records through record_consents_v1 with source and caches the accepted version', () async {
      rpc.queue.add(() => payload(termsJson('2.0')));
      final result = await service.acceptConsentGate(b, u, choices, '2.0');
      expect(result.synced, isTrue);
      expect(rpc.calls.single.$1, 'record_consents_v1');
      expect(rpc.calls.single.$2!['p_source'], 'ios');
      expect(rpc.calls.single.$2!['p_items'], contains(equals({'kind': 'marketing', 'granted': true, 'version': '2.0'})));
      expect(service.readAcceptedVersion(b, u), '2.0');
      expect(service.readAcceptedVersion(b, 'other-user'), isNull);
      expect(service.readAcceptedVersion('https://other.backend', u), isNull);
      expect(service.readPendingConsents(b, u), isNull);
      expect(store.readJson('anacan_consent_gate_v1:$b:$u'), containsPair('version', '2.0'));
    });
    test('keeps an offline acceptance locally (no re-ask) and sends it later', () async {
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      expect((await service.acceptConsentGate(b, u, choices, '2.0')).synced, isFalse);
      expect(service.readPendingConsents(b, u)!.items, hasLength(4));
      expect(store.readJson('anacan_consent_pending_v1:$b:$u'), isA<Map>());
      expect(decideConsentGate(state(), localAcceptedVersion: service.readAcceptedVersion(b, u)), ConsentGateDecision.skip);
      rpc.queue.add(() => payload(termsJson('2.0')));
      expect(await service.flushPendingConsents(b, u), isTrue);
      expect(service.readPendingConsents(b, u), isNull);
    });
    test('drops a pending acceptance the server rejects for a new version, so the gate asks again', () async {
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      await service.acceptConsentGate(b, u, choices, '2.0');
      rpc.queue.add(() => throw const PostgrestException(message: 'CONSENT_VERSION_MISMATCH'));
      expect(await service.flushPendingConsents(b, u), isFalse);
      expect(service.readPendingConsents(b, u), isNull);
      expect(service.readAcceptedVersion(b, u), isNull);
    });
  });

  group('Türkiye (KVKK)', () {
    test('detects Türkiye by profile country or app language', () {
      expect(isKvkkUser('TR', 'az'), isTrue);
      expect(isKvkkUser('tr', 'en'), isTrue);
      expect(isKvkkUser('AZ', 'tr'), isTrue);
      expect(isKvkkUser('AZ', 'az'), isFalse);
      expect(isKvkkUser(null, null), isFalse);
    });
    test('records child data and each İYS channel separately; marketing = any channel; KVKK rows carry kvkk_tr', () {
      final items = gateItems({'terms': true, 'health_data': true, 'age_16': true, 'marketing_sms': true}, '2.0', kvkk: true);
      final by = {for (final i in items) i.kind: i};
      expect(items.map((i) => i.kind),
          ['terms', 'health_data', 'age_16', 'child_data', 'marketing', 'marketing_email', 'marketing_push', 'marketing_sms']);
      expect(by['health_data'], const ConsentItem('health_data', true, '2.0', 'kvkk_tr'));
      expect(by['child_data']!.granted, isFalse);
      expect(by['marketing']!.granted, isTrue);
      expect([by['marketing_email']!.granted, by['marketing_push']!.granted, by['marketing_sms']!.granted], [false, false, true]);
      expect(by['terms']!.variant, isNull);
      expect(gateItems({'terms': true, 'health_data': true, 'age_16': true}, '2.0', kvkk: true).firstWhere((i) => i.kind == 'marketing').granted,
          isFalse);
      expect(() => gateItems({'terms': true, 'age_16': true, 'child_data': true}, '2.0', kvkk: true), throwsA(isA<StateError>()));
    });
  });

  group('Anacan.AI consent', () {
    Map<String, ConsentRecord> row(bool granted) =>
        {'ai_assistant': ConsentRecord(granted: granted, documentVersion: '2.0', createdAt: '2026-11-07T10:00:00Z')};
    test('opens only with a granted consent, asks otherwise; the app_settings switch turns it off', () {
      expect(decideAiConsent(state(), null), AiConsentDecision.ask);
      expect(decideAiConsent(state(consents: row(true)), null), AiConsentDecision.open);
      expect(decideAiConsent(state(consents: row(false)), true), AiConsentDecision.ask);
      expect(decideAiConsent(state(enabled: false), null), AiConsentDecision.open);
      expect(decideAiConsent(null, null), AiConsentDecision.ask);
      expect(decideAiConsent(null, true), AiConsentDecision.open);
    });
    test('records grant/decline with the KVKK variant and keeps the decision when offline', () async {
      rpc.queue.add(() => payload({'ai_assistant': {'granted': true, 'document_version': '2.0', 'created_at': 'x'}}));
      expect((await service.setAiConsent(b, u, true, '2.0', kvkk: true)).synced, isTrue);
      expect(rpc.calls.last.$2!['p_items'], [
        {'kind': 'ai_assistant', 'granted': true, 'version': '2.0', 'variant': 'kvkk_tr'},
      ]);
      expect(service.readLocalAiConsent(b, u), isTrue);
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      expect((await service.setAiConsent(b, u, false, null)).synced, isFalse);
      expect(service.readLocalAiConsent(b, u), isFalse);
      expect(service.readPendingConsents(b, u)!.items, const [ConsentItem('ai_assistant', false, kFallbackConsentVersion)]);
    });
  });

  group('offline vs server failure (no misleading "saved offline" message)', () {
    test('flags only connectivity failures as offline', () async {
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      final r1 = await service.acceptConsentGate(b, u, {'terms': true, 'health_data': true, 'age_16': true}, '2.0');
      expect((r1.synced, r1.offline), (false, true));
      rpc.queue.add(() => throw const PostgrestException(message: 'CONSENT_VERSION_MISMATCH', code: 'P0001'));
      final r2 = await service.acceptConsentGate(b, u, {'terms': true, 'health_data': true, 'age_16': true}, '2.0');
      expect((r2.synced, r2.offline), (false, false));
      rpc.queue.add(() => throw const PostgrestException(message: 'permission denied for function record_consents_v1', code: '42501'));
      final r3 = await service.setAiConsent(b, u, true, '2.0');
      expect((r3.synced, r3.offline), (false, false));
    });
    test('isNetworkFailure recognises fetch/timeouts and the offline flag, not server errors', () {
      expect(isNetworkFailure(const SocketException('Failed to fetch')), isTrue);
      expect(isNetworkFailure({'message': 'TypeError: Load failed'}), isTrue);
      expect(isNetworkFailure(TimeoutException('CONSENT_TIMEOUT')), isTrue);
      expect(isNetworkFailure({'message': 'CONSENT_ITEMS_INVALID', 'code': 'P0001'}), isFalse);
      expect(isNetworkFailure({'message': 'anything'}, deviceOffline: true), isTrue);
    });
  });

  group('useConsentGate', () {
    ProviderContainer container(String? userId) {
      final c = ProviderContainer(overrides: [
        consentServiceProvider.overrideWithValue(service),
        consentGateScopeProvider.overrideWithValue((userId: userId, backend: b)),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 5));

    test('skips for a logged-out user without calling the server', () {
      final c = container(null);
      expect(c.read(consentGateProvider).status, ConsentGateStatus.skip);
      expect(rpc.calls, isEmpty);
    });

    test('shows the gate when the current Terms version is missing, and hides it once accepted', () async {
      rpc.fallback = () => payload({});
      final c = container('u1');
      final sub = c.listen(consentGateProvider, (_, _) {});
      expect(c.read(consentGateProvider).status, ConsentGateStatus.loading);
      await settle();
      expect(c.read(consentGateProvider).status, ConsentGateStatus.show);
      expect(c.read(consentGateProvider).consent!.gate.version, '2.0');
      expect(c.read(consentGateInputFromStateProvider), (status: ConsentGateStatus.show, version: '2.0'));
      c.read(consentGateProvider.notifier).markAccepted();
      expect(c.read(consentGateProvider).status, ConsentGateStatus.skip);
      sub.close();
    });

    test('skips when disabled in app_settings or when the RPC fails (no lock-out)', () async {
      rpc.queue.add(() => payload({}, {'enabled': false, 'version': '2.0'}));
      final disabled = container('u1');
      final s1 = disabled.listen(consentGateProvider, (_, _) {});
      await settle();
      expect(disabled.read(consentGateProvider).status, ConsentGateStatus.skip);
      rpc.queue.add(() => throw const SocketException('Failed to fetch'));
      final failed = container('u2');
      final s2 = failed.listen(consentGateProvider, (_, _) {});
      await settle();
      expect(failed.read(consentGateProvider).status, ConsentGateStatus.skip);
      s1.close();
      s2.close();
    });

    test('does not wait for the network when this device already accepted the version', () {
      service.rememberAcceptedVersion(b, 'u1', '2.0');
      rpc.fallback = () => Completer<Object?>().future;
      final c = container('u1');
      expect(c.read(consentGateProvider).status, ConsentGateStatus.skip);
    });
  });
}
