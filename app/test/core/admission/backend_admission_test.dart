// Ported from: src/integrations/supabase/backend-admission.test.ts

import 'dart:convert';

import 'package:anacan/core/admission/backend_admission.dart';
import 'package:flutter_test/flutter_test.dart';

Matcher throwsAdmission(BackendAdmissionCode code) =>
    throwsA(isA<BackendAdmissionException>().having((e) => e.code, 'code', code));

final source = initialSourceAdmission;
final azure = parseBackendAdmission(source.copyJson(generation: 2, phase: 'azure', handoffSha256: 'a' * 64));
final maintenance = parseBackendAdmission(source.copyJson(generation: 1, phase: 'maintenance'));
final sourcePin = advanceAdmission(null, source);
final azurePin = advanceAdmission(sourcePin, azure);

BackendAdmission policy(BackendAdmission base, {Object? generation, Object? phase, Object? minNativeVersion, Object? handoff}) {
  final json = base.toJson();
  if (generation != null) json['generation'] = generation;
  if (phase != null) json['phase'] = phase;
  if (minNativeVersion != null) json['minNativeVersion'] = minNativeVersion;
  if (handoff != null) json['handoffSha256'] = handoff;
  return parseBackendAdmission(json);
}

void main() {
  test('requires an explicit server handoff receipt for Azure, not a generic ready flag or URL', () {
    for (final value in <Object?>[
      null, <Object?>[], <String, Object?>{},
      azure.copyJson(handoffSha256: null), azure.copyJson(handoffSha256: 'ready'),
      azure.copyJson(generation: 0), azure.copyJson(generation: 1.2), azure.copyJson(generation: -1),
      {...azure.toJson(), 'schema': 'unknown'}, source.copyJson(phase: 'ready'),
      {...source.toJson(), 'url': 'https://untrusted.example'},
      source.copyJson(handoffSha256: 'b' * 64), source.copyJson(minNativeVersion: 'NaN'),
    ]) {
      expect(() => parseBackendAdmission(value), throwsAdmission(BackendAdmissionCode.admissionInvalid), reason: '$value');
    }
  });

  test('keeps an Azure authority latched through maintenance and refuses source rollback', () {
    final paused = advanceAdmission(azurePin, policy(maintenance, generation: 3));
    expect(paused.authority, AdmissionAuthority.azure);
    expect(() => assertAdmissionReady(paused, '28.0'), throwsAdmission(BackendAdmissionCode.admissionMaintenance));
    expect(() => advanceAdmission(paused, policy(source, generation: 4)),
        throwsAdmission(BackendAdmissionCode.admissionRollback));
    expect(advanceAdmission(paused, policy(azure, generation: 4)).authority, AdmissionAuthority.azure);
  });

  test('rejects stale policy generations and equivocation within a generation', () {
    for (final next in [source, policy(azure, minNativeVersion: '29.0'), policy(azure, handoff: 'b' * 64)]) {
      expect(() => advanceAdmission(azurePin, next), throwsAdmission(BackendAdmissionCode.admissionRollback));
    }
    expect(advanceAdmission(azurePin, azure), azurePin);
  });

  test('can resume source after a pre-handoff maintenance window using a newer generation', () {
    expect(advanceAdmission(advanceAdmission(sourcePin, maintenance), policy(source, generation: 2)).authority,
        AdmissionAuthority.source);
  });

  test('reconciles a torn native/WebView mirror by retaining the newer authority', () {
    for (final (a, b) in <(AdmissionPin?, AdmissionPin?)>[
      (sourcePin, azurePin), (azurePin, sourcePin), (null, azurePin), (azurePin, null),
    ]) {
      expect(reconcileAdmissionPins(a, b), azurePin);
    }
    expect(reconcileAdmissionPins(null, null), isNull);
    expect(() => reconcileAdmissionPins(azurePin, advanceAdmission(null, policy(source, generation: 3))),
        throwsAdmission(BackendAdmissionCode.admissionRollback));
  });

  test('does not guess when an authority pin is malformed or contradicts its policy', () {
    for (final value in [
      '', 'not-json', 'null', '{}',
      jsonEncode({...azurePin.toJson(), 'authority': 'source'}),
      jsonEncode({...sourcePin.toJson(), 'extra': true}),
      jsonEncode({...sourcePin.toJson(), 'policy': source.copyJson(phase: 'ready')}),
    ]) {
      expect(() => parseAdmissionPin(value), throwsAdmission(BackendAdmissionCode.admissionStorage), reason: value);
    }
    expect(parseAdmissionPin(jsonEncode(azurePin.toJson())), azurePin);
  });

  group('native version comparison', () {
    for (final (a, b, result) in <(String, String, int?)>[
      ('28.0', '28', 0), ('28.0.1', '28.0', 1), ('9.0', '28.0', -1), ('28.10', '28.2', 1),
      ('25', '28.0', -1), ('28.0.0.0', '28', 0), ('28beta', '28', null), ('', '28', null),
    ]) {
      test('$a versus $b', () => expect(compareNativeVersions(a, b), result));
    }
    test('admits current/newer builds and refuses an older or unknown native version', () {
      expect(() => assertAdmissionReady(sourcePin, '28.0'), returnsNormally);
      expect(() => assertAdmissionReady(sourcePin, '29.0'), returnsNormally);
      for (final version in ['25.0', '', 'unknown']) {
        expect(() => assertAdmissionReady(sourcePin, version), throwsAdmission(BackendAdmissionCode.admissionUpdateRequired));
      }
    });
  });

  // Flutter-only: the stored pin must stay byte-identical to the Capacitor JSON.stringify output.
  test('encodes the pin exactly as the Capacitor app writes it', () {
    expect(
      azurePin.encode(),
      '{"schema":"anacan-backend-pin-v1","authority":"azure","policy":{"schema":"anacan-backend-admission-v1",'
      '"generation":2,"phase":"azure","minNativeVersion":"28.0","handoffSha256":"${'a' * 64}"}}',
    );
    expect(parseAdmissionPin(azurePin.encode())!.encode(), azurePin.encode());
  });
}
