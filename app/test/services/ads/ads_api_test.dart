// Ported from: src/lib/ads/api.test.ts
import 'dart:async';
import 'dart:convert';

import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/services/ads/ads_api.dart';
import 'package:anacan/services/ads/continuity.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Map<String, Object?> snapshot([AdsConfiguration? config, bool emergencyDisabled = false]) {
  final c = config ?? defaultAdsConfiguration();
  final json = c.toJson();
  if (emergencyDisabled) (json['settings']! as Map<String, Object?>)['enabled'] = false;
  return {
    'schema': 'anacan-admob-source-v1',
    'sourceGeneration': 1,
    'upstreamRevision': c.revision,
    'syncedAt': '2026-09-22T00:00:00Z',
    'emergencyDisabled': emergencyDisabled,
    'configuration': json,
  };
}

Matcher throwsAdmob(String message) => throwsA(isA<AdmobConfigurationError>().having((e) => e.message, 'message', message));

class Fixture {
  bool azure = false;
  final List<(String, Map<String, Object?>?)> rpcCalls = [];
  Future<AdsRpcResult> Function(String name, Map<String, Object?>? args) rpcImpl = (_, _) async => const AdsRpcResult();
  final List<http.Request> requests = [];
  Future<http.Response> Function(http.Request request) fetch = (_) async => throw StateError('Unexpected network request');
  final List<Duration> delays = [];
  String sourceKey = 'public-source-anon-fixture';
  Duration timeout = const Duration(seconds: 8);

  AdsApi get api => AdsApi(
        backend: () => (azure: azure, url: azure ? 'https://api.anacan.az' : 'https://tntbjulojatnrqmylorp.supabase.co'),
        rpc: (name, [args]) {
          rpcCalls.add((name, args));
          return rpcImpl(name, args);
        },
        client: MockClient((request) {
          requests.add(request);
          return fetch(request);
        }),
        sourceKey: sourceKey,
        requestTimeout: timeout,
        delay: (d) async => delays.add(d),
      );
}

void main() {
  late Fixture f;
  setUp(() => f = Fixture());

  group('Source-hosted AdMob continuity', () {
    test('loads the selected Source snapshot with Azure completely unavailable', () async {
      final config = defaultAdsConfiguration()..settings.mode = 'test';
      f.rpcImpl = (_, _) async => AdsRpcResult(data: snapshot(config));
      expect((await f.api.fetchAdmobConfiguration()).toJson(), config.toJson());
      expect(f.rpcCalls.single.$1, kSourceAdmobRpc); expect(f.rpcCalls.single.$2, {'p_expected_revision': null});
      expect(f.requests, isEmpty);
    });

    test('uses the selected authenticated RPC only on Azure and rejects Source-side admin mutations', () async {
      final config = defaultAdsConfiguration();
      await expectLater(f.api.fetchAdmobOverview(), throwsAdmob('admob_azure_required'));
      await expectLater(f.api.saveAdmobConfiguration(config), throwsAdmob('admob_azure_required'));
      expect(f.rpcCalls, isEmpty);
      f.azure = true;
      f.rpcImpl = (_, _) async => AdsRpcResult(data: config.toJson());
      expect((await f.api.fetchAdmobConfiguration()).toJson(), config.toJson());
      expect(f.rpcCalls.single, ('get_admob_configuration', null));
    });

    test('loads the Azure admin overview without waiting for Source availability', () async {
      f.azure = true;
      final overview = {'configuration': defaultAdsConfiguration().toJson(), 'metrics': <Object?>[], 'history': <Object?>[]};
      f.rpcImpl = (_, _) async => AdsRpcResult(data: overview);
      final result = await f.api.fetchAdmobOverview();
      expect(result.configuration.toJson(), defaultAdsConfiguration().toJson());
      expect(result.metrics, isEmpty);
      expect(result.history, isEmpty);
      expect(f.requests, isEmpty);
    });

    test('uses only the public Source key when the selected backend is Azure', () async {
      f.azure = true;
      f.fetch = (_) async => http.Response(jsonEncode(snapshot()), 200);
      expect((await f.api.fetchSourceAdmobSnapshot(1)).toJson(), snapshot());
      final request = f.requests.single;
      expect(request.method, 'POST');
      expect('${request.url}', '$kSourceAdmobOrigin/rest/v1/rpc/$kSourceAdmobRpc');
      expect(request.followRedirects, isFalse);
      expect(request.headers['apikey'], 'public-source-anon-fixture');
      expect(request.headers['Authorization'], 'Bearer public-source-anon-fixture');
      expect(request.headers['Content-Type'], startsWith('application/json'));
      expect(request.body, jsonEncode({'p_expected_revision': 1}));
      expect(f.rpcCalls, isEmpty);
    });

    test('does not fall back to Azure configuration when Source is absent', () async {
      f.rpcImpl = (_, _) async => const AdsRpcResult(error: AdsRpcError(code: 'PGRST202'));
      await expectLater(f.api.fetchAdmobConfiguration(), throwsAdmob('admob_source_not_installed'));
      expect(f.requests, isEmpty);
    });

    test('bounds a stalled Source request instead of hanging the configuration query', () async {
      f.timeout = const Duration(milliseconds: 30);
      f.rpcImpl = (_, _) => Completer<AdsRpcResult>().future;
      await expectLater(f.api.fetchAdmobConfiguration(), throwsAdmob('admob_source_unavailable'));
    });

    test('waits for the requested revision and never reports an older mirror as confirmed', () async {
      final newer = defaultAdsConfiguration()..revision = 2;
      var calls = 0;
      f.rpcImpl = (_, _) async => AdsRpcResult(data: calls++ == 0 ? snapshot() : snapshot(newer));
      expect((await f.api.synchronizeSourceAdmob(2)).upstreamRevision, 2);
      expect(f.rpcCalls, hasLength(2));
      expect(f.rpcCalls.last.$1, kSourceAdmobRpc); expect(f.rpcCalls.last.$2, {'p_expected_revision': 2});
      expect(f.delays, [const Duration(milliseconds: 500)]);
    });

    test('reports pending if Source remains on an older revision', () async {
      f.rpcImpl = (_, _) async => AdsRpcResult(data: snapshot());
      await expectLater(f.api.synchronizeSourceAdmob(2), throwsAdmob('admob_source_sync_pending'));
      expect(f.rpcCalls, hasLength(5));
    });

    for (final operation in ['save', 'restore', 'disable']) {
      test('keeps a committed Azure $operation successful while reporting unconfirmed Source delivery', () async {
        f.azure = true;
        final config = defaultAdsConfiguration()..revision = 2;
        f.rpcImpl = (_, _) async => AdsRpcResult(data: config.toJson());
        final api = f.api;
        final result = await (operation == 'save'
            ? api.saveAdmobConfiguration(config)
            : operation == 'restore'
                ? api.restoreAdmobConfiguration(1, 2)
                : api.disableAdmob());
        expect(result.configuration.toJson(), config.toJson());
        expect(result.continuity.toJson(), {'available': false, 'ready': false});
        expect(f.rpcCalls, hasLength(1));
      });
    }

    test('includes the sticky Source emergency stop in a confirmed Azure save result', () async {
      f.azure = true;
      final config = defaultAdsConfiguration()..revision = 2;
      f.rpcImpl = (_, _) async => AdsRpcResult(data: config.toJson());
      f.fetch = (_) async => http.Response(jsonEncode(snapshot(config, true)), 200);
      final result = await f.api.saveAdmobConfiguration(config);
      expect(result.configuration.toJson(), config.toJson());
      expect(result.continuity.available, isTrue);
      expect(result.continuity.ready, isTrue);
      expect(result.continuity.emergencyDisabled, isTrue);
      expect(result.continuity.upstreamRevision, 2);
    });

    test('does not request a mirror or repeat a mutation when the primary CAS fails', () async {
      f.azure = true;
      f.rpcImpl = (_, _) async => const AdsRpcResult(error: AdsRpcError(message: 'admob_configuration_changed_reload'));
      await expectLater(f.api.saveAdmobConfiguration(defaultAdsConfiguration()), throwsAdmob('admob_configuration_changed_reload'));
      expect(f.requests, isEmpty);
      expect(f.rpcCalls, hasLength(1));
    });

    test('uses Source admin credentials only for the independent emergency control', () async {
      f.azure = true;
      await expectLater(f.api.setSourceAdmobEmergency(true), throwsAdmob('admob_source_admin_required'));
      expect(f.rpcCalls, isEmpty);
      expect(f.requests, isEmpty);
      f.azure = false;
      f.rpcImpl = (_, _) async => AdsRpcResult(data: snapshot(defaultAdsConfiguration(), true));
      expect((await f.api.setSourceAdmobEmergency(true)).emergencyDisabled, isTrue);
      expect(f.rpcCalls.single.$1, 'admin_set_source_admob_emergency_v1'); expect(f.rpcCalls.single.$2, {'p_disabled': true});
    });

    test('surfaces a frozen Source write rather than claiming emergency state changed', () async {
      f.rpcImpl = (_, _) async => const AdsRpcResult(error: AdsRpcError(code: 'PT503'));
      await expectLater(f.api.setSourceAdmobEmergency(false), throwsAdmob('admob_source_frozen'));
    });

    test('sends only bounded coarse native events from Source; demo and unidentified configuration are excluded', () async {
      f.fetch = (_) async => http.Response('true', 200);
      final api = f.api;
      await api.reportAdEvent('home_banner', 'impression', 'demo', 'ios', '', 1);
      await api.reportAdEvent('home_banner', 'impression', 'test', 'web', '', 1);
      await api.reportAdEvent('home_banner', 'impression', 'test', 'ios');
      expect(f.requests, isEmpty);
      await api.reportAdEvent('home_banner', 'impression', 'test', 'ios', '', 7);
      final request = f.requests.single;
      expect('${request.url}', '$kAdmobControlOrigin/admob/events');
      expect(request.headers.keys.map((k) => k.toLowerCase()).toSet(), {'content-type'});
      expect(jsonDecode(request.body), {'p_revision': 7, 'p_placement_id': 'home_banner', 'p_event': 'impression', 'p_mode': 'test', 'p_platform': 'ios', 'p_reason': ''});
      expect(f.rpcCalls, isEmpty);
    });

    test('fails closed on unavailable or malformed Source configuration', () async {
      f.rpcImpl = (_, _) async => const AdsRpcResult(data: <String, Object?>{});
      await expectLater(f.api.fetchAdmobConfiguration(), throwsAdmob('admob_invalid_configuration'));
      f.rpcImpl = (_, _) async => const AdsRpcResult(error: AdsRpcError(message: 'unavailable'));
      await expectLater(f.api.fetchAdmobConfiguration(), throwsAdmob('admob_service_unavailable'));
    });

    for (final patch in <Map<String, Object?>>[
      {'upstreamRevision': 2},
      {'emergencyDisabled': true},
      {'sourceGeneration': 0},
      {'sourceGeneration': 9007199254740992},
      {'syncedAt': 'invalid'},
      {'untrustedField': 'extra'},
    ]) {
      test('rejects malformed or contradictory mirror envelopes', () async {
        f.rpcImpl = (_, _) async => AdsRpcResult(data: {...snapshot(), ...patch});
        await expectLater(f.api.fetchSourceAdmobSnapshot(), throwsAdmob('admob_invalid_configuration'));
      });
    }
  });
}
