// Ported from: src/integrations/supabase/backend-admission.ts
//
// Credential-free protocol. URLs and API keys are never accepted from a policy.
// A published Azure policy is an operator assertion of the *server-side* handoff;
// client parsing is not proof that data, signing keys or refresh state were moved.

import 'dart:convert';

const String admissionUrl = 'https://api.anacan.az/.well-known/anacan-backend.json';
const String admissionPinKey = 'anacan.backend-admission.v1';
const String azureApiOrigin = 'https://api.anacan.az';

const String admissionSchema = 'anacan-backend-admission-v1';
const String admissionPinSchema = 'anacan-backend-pin-v1';

/// `phase` of a published admission policy.
enum AdmissionPhase {
  source,
  maintenance,
  azure;

  static AdmissionPhase? tryParse(Object? value) {
    for (final phase in values) {
      if (phase.name == value) return phase;
    }
    return null;
  }
}

/// `authority` of a device pin. Never `maintenance`.
enum AdmissionAuthority {
  source,
  azure;

  static AdmissionAuthority? tryParse(Object? value) {
    for (final authority in values) {
      if (authority.name == value) return authority;
    }
    return null;
  }
}

/// Error codes, identical to the React `BackendAdmissionError.code` strings.
enum BackendAdmissionCode {
  admissionInvalid('ADMISSION_INVALID'),
  admissionRollback('ADMISSION_ROLLBACK'),
  admissionStorage('ADMISSION_STORAGE'),
  admissionMaintenance('ADMISSION_MAINTENANCE'),
  admissionUpdateRequired('ADMISSION_UPDATE_REQUIRED'),
  admissionConfiguration('ADMISSION_CONFIGURATION');

  const BackendAdmissionCode(this.wire);
  final String wire;
}

class BackendAdmissionException implements Exception {
  const BackendAdmissionException(this.code);
  final BackendAdmissionCode code;

  @override
  String toString() => code.wire;
}

/// `anacan-backend-admission-v1` document.
class BackendAdmission {
  const BackendAdmission._({
    required this.generation,
    required this.phase,
    required this.minNativeVersion,
    required this.handoffSha256,
  });

  final String schema = admissionSchema;
  final int generation;
  final AdmissionPhase phase;
  final String minNativeVersion;
  final String? handoffSha256;

  /// Same key order as the React object (`JSON.stringify` output is byte-identical).
  Map<String, Object?> toJson() => {
        'schema': schema,
        'generation': generation,
        'phase': phase.name,
        'minNativeVersion': minNativeVersion,
        'handoffSha256': handoffSha256,
      };

  /// Unvalidated field copy for tests/fixtures; feed the result to [parseBackendAdmission].
  Map<String, Object?> copyJson({
    Object? generation = _keep,
    Object? phase = _keep,
    Object? minNativeVersion = _keep,
    Object? handoffSha256 = _keep,
  }) =>
      {
        'schema': schema,
        'generation': identical(generation, _keep) ? this.generation : generation,
        'phase': identical(phase, _keep) ? this.phase.name : phase,
        'minNativeVersion': identical(minNativeVersion, _keep) ? this.minNativeVersion : minNativeVersion,
        'handoffSha256': identical(handoffSha256, _keep) ? this.handoffSha256 : handoffSha256,
      };

  @override
  bool operator ==(Object other) =>
      other is BackendAdmission &&
      other.generation == generation &&
      other.phase == phase &&
      other.minNativeVersion == minNativeVersion &&
      other.handoffSha256 == handoffSha256;

  @override
  int get hashCode => Object.hash(generation, phase, minNativeVersion, handoffSha256);

  @override
  String toString() => jsonEncode(toJson());
}

const Object _keep = Object();

/// `anacan-backend-pin-v1`, stored under [admissionPinKey].
class AdmissionPin {
  const AdmissionPin({required this.authority, required this.policy});

  final String schema = admissionPinSchema;
  final AdmissionAuthority authority;
  final BackendAdmission policy;

  Map<String, Object?> toJson() => {'schema': schema, 'authority': authority.name, 'policy': policy.toJson()};

  /// The exact string the Capacitor app writes (`JSON.stringify(pin)`).
  String encode() => jsonEncode(toJson());

  @override
  bool operator ==(Object other) =>
      other is AdmissionPin && other.authority == authority && other.policy == policy;

  @override
  int get hashCode => Object.hash(authority, policy);

  @override
  String toString() => encode();
}

final RegExp _nativeVersion = RegExp(r'^\d{1,9}(?:\.\d{1,9}){0,3}$');
final RegExp _sha256 = RegExp(r'^[a-f0-9]{64}$');

/// -1/0/1, or null when either side is not a dotted numeric version.
int? compareNativeVersions(Object? left, Object? right) {
  bool valid(Object? value) => value is String && _nativeVersion.hasMatch(value);
  if (!valid(left) || !valid(right)) return null;
  final a = (left as String).split('.').map(int.parse).toList();
  final b = (right as String).split('.').map(int.parse).toList();
  final length = a.length > b.length ? a.length : b.length;
  for (var i = 0; i < length; i++) {
    final x = i < a.length ? a[i] : 0;
    final y = i < b.length ? b[i] : 0;
    if (x != y) return x < y ? -1 : 1;
  }
  return 0;
}

const int _maxSafeInteger = 9007199254740991;

/// `Number.isSafeInteger` over a decoded JSON value (JSON `2.0` is the JS number 2).
int? _safeInteger(Object? value) {
  if (value is int) return value.abs() <= _maxSafeInteger ? value : null;
  if (value is double && value.isFinite && value == value.truncateToDouble() && value.abs() <= _maxSafeInteger) {
    return value.toInt();
  }
  return null;
}

/// Strict parse of a decoded JSON value. Throws `ADMISSION_INVALID`.
BackendAdmission parseBackendAdmission(Object? value) {
  const invalid = BackendAdmissionException(BackendAdmissionCode.admissionInvalid);
  if (value is! Map) throw invalid;
  final keys = value.keys.map((key) => '$key').toList()..sort();
  if (keys.join(',') != 'generation,handoffSha256,minNativeVersion,phase,schema') throw invalid;
  if (value['schema'] != admissionSchema) throw invalid;
  final generation = _safeInteger(value['generation']);
  if (generation == null || generation < 0) throw invalid;
  final phase = AdmissionPhase.tryParse(value['phase']);
  if (phase == null) throw invalid;
  final minNativeVersion = value['minNativeVersion'];
  if (compareNativeVersions(minNativeVersion, '0') == null) throw invalid;
  final handoff = value['handoffSha256'];
  if (phase == AdmissionPhase.azure) {
    if (generation == 0 || handoff is! String || !_sha256.hasMatch(handoff)) throw invalid;
  } else if (handoff != null) {
    throw invalid;
  }
  return BackendAdmission._(
    generation: generation,
    phase: phase,
    minNativeVersion: minNativeVersion as String,
    handoffSha256: handoff as String?,
  );
}

final BackendAdmission initialSourceAdmission = parseBackendAdmission({
  'schema': admissionSchema,
  'generation': 0,
  'phase': 'source',
  'minNativeVersion': '28.0',
  'handoffSha256': null,
});

/// Parse a stored pin string. `null` (absent) → null; anything malformed → `ADMISSION_STORAGE`.
AdmissionPin? parseAdmissionPin(String? value) {
  if (value == null) return null;
  try {
    final pin = jsonDecode(value);
    if (pin is! Map) throw const FormatException();
    final keys = pin.keys.map((key) => '$key').toList()..sort();
    final authority = AdmissionAuthority.tryParse(pin['authority']);
    if (keys.join(',') != 'authority,policy,schema' || pin['schema'] != admissionPinSchema || authority == null) {
      throw const FormatException();
    }
    final policy = parseBackendAdmission(pin['policy']);
    if (policy.phase != AdmissionPhase.maintenance && policy.phase.name != authority.name) {
      throw const FormatException();
    }
    return AdmissionPin(authority: authority, policy: policy);
  } catch (_) {
    throw const BackendAdmissionException(BackendAdmissionCode.admissionStorage);
  }
}

bool sameAdmission(BackendAdmission left, BackendAdmission right) =>
    left.generation == right.generation &&
    left.phase == right.phase &&
    left.minNativeVersion == right.minNativeVersion &&
    left.handoffSha256 == right.handoffSha256;

/// Source -> Azure is one-way. A failed target refresh must never try source.
AdmissionPin advanceAdmission(AdmissionPin? pin, BackendAdmission policy) {
  if (pin != null &&
      (policy.generation < pin.policy.generation ||
          (policy.generation == pin.policy.generation && !sameAdmission(policy, pin.policy)) ||
          (pin.authority == AdmissionAuthority.azure && policy.phase == AdmissionPhase.source))) {
    throw const BackendAdmissionException(BackendAdmissionCode.admissionRollback);
  }
  final authority = switch (policy.phase) {
    AdmissionPhase.maintenance => pin?.authority ?? AdmissionAuthority.source,
    AdmissionPhase.source => AdmissionAuthority.source,
    AdmissionPhase.azure => AdmissionAuthority.azure,
  };
  return AdmissionPin(authority: authority, policy: policy);
}

/// Recover a torn mirror write without rolling an Azure device back to source.
AdmissionPin? reconcileAdmissionPins(AdmissionPin? left, AdmissionPin? right) {
  if (left == null) return right;
  if (right == null) return left;
  final (older, newer) = left.policy.generation <= right.policy.generation ? (left, right) : (right, left);
  final next = advanceAdmission(older, newer.policy);
  if (next.authority != newer.authority) {
    throw const BackendAdmissionException(BackendAdmissionCode.admissionStorage);
  }
  return newer;
}

void assertAdmissionReady(AdmissionPin pin, String nativeVersion) {
  final comparison = compareNativeVersions(nativeVersion, pin.policy.minNativeVersion);
  if (comparison == null || comparison < 0) {
    throw const BackendAdmissionException(BackendAdmissionCode.admissionUpdateRequired);
  }
  if (pin.policy.phase == AdmissionPhase.maintenance) {
    throw const BackendAdmissionException(BackendAdmissionCode.admissionMaintenance);
  }
}
