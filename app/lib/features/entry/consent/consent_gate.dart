// Ported from: src/lib/consentGate.ts
//
// Consent gate (legal documents): Terms + Privacy Policy acceptance, explicit health-data consent, age 16+ and
// optional marketing, recorded server-side in public.user_consents through record_consents_v1 and read back with
// my_consents_v1 (docs/CONSENT_GATE.md). Never lock anyone out: server unreachable / RPC missing → skip; an
// acceptance that could not be sent is kept in the LocalStore (per backend + user + version) and retried.
import 'dart:async';
import 'dart:convert';

import '../../../core/auth/partner_link.dart' show RpcCall;
import '../../../state/local_store.dart';

const List<String> kConsentKinds = [
  'terms', 'health_data', 'age_16', 'marketing', 'child_data', 'ai_assistant',
  'marketing_email', 'marketing_push', 'marketing_sms',
];
const List<String> kRequiredGateKinds = ['terms', 'health_data', 'age_16'];
const List<String> kMarketingChannels = ['marketing_email', 'marketing_push', 'marketing_sms'];

/// `GateChoices` keys (every kind except `ai_assistant`).
const List<String> kGateChoiceKinds = [
  'terms', 'health_data', 'age_16', 'marketing', 'child_data', 'marketing_email', 'marketing_push', 'marketing_sms',
];

/// Last resort when the server could not be asked.
const String kFallbackConsentVersion = '1.0';
const Duration kConsentRpcTimeout = Duration(milliseconds: 6000);

const String _cachePrefix = 'anacan_consent_gate_v1';
const String _pendingPrefix = 'anacan_consent_pending_v1';
const String _aiPrefix = 'anacan_ai_consent_v1';

class ConsentGateConfig {
  const ConsentGateConfig({required this.enabled, this.version});
  final bool enabled;
  final String? version;
  Map<String, Object?> toJson() => {'enabled': enabled, 'version': version};
  @override
  bool operator ==(Object other) => other is ConsentGateConfig && other.enabled == enabled && other.version == version;
  @override
  int get hashCode => Object.hash(enabled, version);
}

class ConsentRecord {
  const ConsentRecord({required this.granted, required this.documentVersion, this.textVariant, this.source, required this.createdAt});
  final bool granted;
  final String documentVersion;
  final String? textVariant;
  final String? source;
  final String createdAt;
}

class ConsentState {
  const ConsentState({required this.gate, this.consents = const {}});
  final ConsentGateConfig gate;
  final Map<String, ConsentRecord> consents;
}

/// `{kind, granted, version, variant?}` (JSON key order as in React).
class ConsentItem {
  const ConsentItem(this.kind, this.granted, this.version, [this.variant]);
  final String kind;
  final bool granted;
  final String version;
  final String? variant;

  Map<String, Object?> toJson() => {'kind': kind, 'granted': granted, 'version': version, if (variant != null) 'variant': variant};
  static ConsentItem? fromJson(Object? v) {
    if (v is! Map || v['kind'] is! String || v['granted'] is! bool || v['version'] is! String) return null;
    return ConsentItem(v['kind'] as String, v['granted'] as bool, v['version'] as String, v['variant'] as String?);
  }

  @override
  bool operator ==(Object other) =>
      other is ConsentItem && other.kind == kind && other.granted == granted && other.version == version && other.variant == variant;
  @override
  int get hashCode => Object.hash(kind, granted, version, variant);
  @override
  String toString() => jsonEncode(toJson());
}

/// Türkiye users (profile country TR or app language tr) see the owner's KVKK Açık Rıza wording.
bool isKvkkUser(String? countryCode, String? language) =>
    (countryCode ?? '').trim().toUpperCase() == 'TR' || (language ?? '').trim().toLowerCase() == 'tr';

final RegExp _versionRe = RegExp(r'^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$');

/// Parse the my_consents_v1 / record_consents_v1 payload; malformed → null.
ConsentState? parseConsentState(Object? raw) {
  Object? value = raw;
  if (raw is String) {
    try {
      value = jsonDecode(raw);
    } catch (_) {
      value = null;
    }
  }
  if (value is! Map) return null;
  final gateRaw = value['gate'];
  if (gateRaw is! Map) return null;
  final v = gateRaw['version'];
  final version = v is String && _versionRe.hasMatch(v) ? v : null;
  final gate = ConsentGateConfig(enabled: gateRaw['enabled'] == true && version != null, version: version);
  final consents = <String, ConsentRecord>{};
  final rows = value['consents'];
  if (rows is Map) {
    for (final kind in kConsentKinds) {
      final row = rows[kind];
      if (row is Map && row['granted'] is bool && row['document_version'] is String) {
        final variant = row['text_variant'];
        consents[kind] = ConsentRecord(
          granted: row['granted'] as bool,
          documentVersion: row['document_version'] as String,
          source: row['source'] as String?,
          createdAt: '${row['created_at'] ?? ''}',
          textVariant: variant == 'default' || variant == 'kvkk_tr' ? variant as String : null,
        );
      }
    }
  }
  return ConsentState(gate: gate, consents: consents);
}

enum ConsentGateDecision { show, skip }

/// Whether the full-screen consent gate must be shown. Errors and a disabled setting always skip.
ConsentGateDecision decideConsentGate(ConsentState? state, {String? localAcceptedVersion}) {
  if (state == null) return ConsentGateDecision.skip;
  final gate = state.gate;
  if (!gate.enabled || gate.version == null) return ConsentGateDecision.skip;
  if (localAcceptedVersion != null && localAcceptedVersion.isNotEmpty && localAcceptedVersion == gate.version) {
    return ConsentGateDecision.skip;
  }
  final terms = state.consents['terms'];
  if (terms != null && terms.granted && terms.documentVersion == gate.version) return ConsentGateDecision.skip;
  return ConsentGateDecision.show;
}

/// Continue is enabled only when every required item is ticked.
bool canContinue(Map<String, bool> choices) => kRequiredGateKinds.every((k) => choices[k] == true);

/// The rows recorded when the gate is accepted.
List<ConsentItem> gateItems(Map<String, bool> choices, String version, {bool kvkk = false}) {
  if (!canContinue(choices)) throw StateError('CONSENT_REQUIRED_MISSING');
  if (!kvkk) {
    return [for (final k in const ['terms', 'health_data', 'age_16', 'marketing']) ConsentItem(k, choices[k] == true, version)];
  }
  final anyChannel = kMarketingChannels.any((k) => choices[k] == true);
  return [
    ConsentItem('terms', true, version),
    ConsentItem('health_data', true, version, 'kvkk_tr'),
    ConsentItem('age_16', true, version),
    ConsentItem('child_data', choices['child_data'] == true, version, 'kvkk_tr'),
    ConsentItem('marketing', anyChannel, version, 'kvkk_tr'),
    for (final k in kMarketingChannels) ConsentItem(k, choices[k] == true, version, 'kvkk_tr'),
  ];
}

class PendingConsents {
  const PendingConsents({required this.items, this.source, this.appVersion});
  final List<ConsentItem> items;
  final String? source;
  final String? appVersion;
  Map<String, Object?> toJson() => {'items': [for (final i in items) i.toJson()], 'source': source, 'appVersion': appVersion};
}

/// Result of [ConsentService.acceptConsentGate] / [ConsentService.setAiConsent].
class ConsentWriteResult {
  const ConsentWriteResult({required this.synced, required this.offline, this.state});
  final bool synced;
  final bool offline;
  final ConsentState? state;
}

/// Thrown by [ConsentService.recordConsents] when the RPC returned an error.
class ConsentRpcError implements Exception {
  const ConsentRpcError(this.message, [this.code]);
  final String message;
  final String? code;
  @override
  String toString() => message;
}

/// True only for a real connectivity failure (device offline, network error, timeout).
bool isNetworkFailure(Object? error, {bool deviceOffline = false}) {
  if (deviceOffline) return true;
  if (error == null) return false;
  String text;
  if (error is Map) {
    text = [error['name'], error['message'], error['details']].whereType<String>().join(' ');
  } else if (error is TimeoutException) {
    text = 'CONSENT_TIMEOUT';
  } else {
    final parts = <String>[error.runtimeType.toString()];
    try {
      final dynamic e = error;
      final m = e.message;
      if (m is String) parts.add(m);
    } catch (_) {
      parts.add('$error');
    }
    try {
      final dynamic e = error;
      final d = e.details;
      if (d is String) parts.add(d);
    } catch (_) {}
    text = parts.join(' ');
  }
  return RegExp(
    r'CONSENT_TIMEOUT|Failed to fetch|NetworkError|Network request failed|Load failed|fetch failed|network connection was lost|'
    r'ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ETIMEDOUT|ECONNRESET|AbortError|timed? ?out|SocketException|ClientException|'
    r'AuthRetryableFetchException|Connection (?:refused|reset|closed)',
    caseSensitive: false,
  ).hasMatch(text);
}

/// The local cache + server calls of consentGate.ts, over a [LocalStore] and an RPC function.
class ConsentService {
  ConsentService({
    required this.store,
    required this.rpc,
    this.source = 'web',
    this.appVersion,
    this.deviceOffline,
    this.timeout = kConsentRpcTimeout,
    DateTime Function()? now,
  }) : now = now ?? DateTime.now;

  final LocalStore store;
  final RpcCall rpc;
  final String source;
  final Future<String?> Function()? appVersion;
  final bool Function()? deviceOffline;
  final Duration timeout;
  final DateTime Function() now;

  static String _scoped(String prefix, String backend, String userId) => '$prefix:$backend:$userId';

  Object? _readJson(String key) => store.readJson(key);
  void _writeJson(String key, Object? value) => store.writeJson(key, value);

  String? readAcceptedVersion(String backend, String userId) {
    final cached = _readJson(_scoped(_cachePrefix, backend, userId));
    if (cached is Map && cached['version'] is String) return cached['version'] as String;
    final pending = readPendingConsents(backend, userId);
    for (final item in pending?.items ?? const <ConsentItem>[]) {
      if (item.kind == 'terms' && item.granted) return item.version;
    }
    return null;
  }

  void rememberAcceptedVersion(String backend, String userId, String version) =>
      _writeJson(_scoped(_cachePrefix, backend, userId), {'version': version, 'at': now().toUtc().toIso8601String()});

  PendingConsents? readPendingConsents(String backend, String userId) {
    final v = _readJson(_scoped(_pendingPrefix, backend, userId));
    if (v is! Map || v['items'] is! List || (v['items'] as List).isEmpty) return null;
    final items = [for (final i in v['items'] as List) ?ConsentItem.fromJson(i)];
    return PendingConsents(items: items, source: v['source'] as String?, appVersion: v['appVersion'] as String?);
  }

  /// Merge into the pending batch (a newer decision of the same kind replaces the older one); ≤ 12 items.
  void _savePending(String backend, String userId, PendingConsents value) {
    final previous = readPendingConsents(backend, userId);
    final kinds = {for (final i in value.items) i.kind};
    var items = [...?previous?.items.where((i) => !kinds.contains(i.kind)), ...value.items];
    if (items.length > 12) items = items.sublist(items.length - 12);
    _writeJson(_scoped(_pendingPrefix, backend, userId), PendingConsents(items: items, source: value.source, appVersion: value.appVersion).toJson());
  }

  void _clearPending(String backend, String userId) => store.removeItem(_scoped(_pendingPrefix, backend, userId));

  Future<String?> _appVersion() async {
    try {
      return await appVersion?.call();
    } catch (_) {
      return null;
    }
  }

  /// my_consents_v1; null when unavailable (offline, timeout, RPC missing, malformed).
  Future<ConsentState?> fetchConsentState({Duration? timeout}) async {
    try {
      final data = await rpc('my_consents_v1').timeout(timeout ?? this.timeout);
      return parseConsentState(data);
    } catch (_) {
      return null;
    }
  }

  /// record_consents_v1; throws on failure, returns the fresh state on success.
  Future<ConsentState?> recordConsents(List<ConsentItem> items) async {
    final version = await _appVersion();
    final data = await rpc('record_consents_v1', {
      'p_items': [for (final i in items) i.toJson()],
      'p_source': source,
      'p_app_version': version,
    }).timeout(timeout, onTimeout: () => throw TimeoutException('CONSENT_TIMEOUT'));
    return parseConsentState(data);
  }

  bool _offline(Object error) => isNetworkFailure(error, deviceOffline: deviceOffline?.call() ?? false);

  /// Gate acceptance: record on the server; on failure keep it locally (never re-ask on this device).
  Future<ConsentWriteResult> acceptConsentGate(String backend, String userId, Map<String, bool> choices, String version,
      {bool kvkk = false}) async {
    final items = gateItems(choices, version, kvkk: kvkk);
    rememberAcceptedVersion(backend, userId, version);
    try {
      final state = await recordConsents(items);
      _clearPending(backend, userId);
      return ConsentWriteResult(synced: true, offline: false, state: state);
    } catch (error) {
      _savePending(backend, userId, PendingConsents(items: items, source: source, appVersion: await _appVersion()));
      return ConsentWriteResult(synced: false, offline: _offline(error));
    }
  }

  /// Retry an acceptance that could not be sent; dropped when the server no longer accepts that version.
  Future<bool> flushPendingConsents(String backend, String userId) async {
    final pending = readPendingConsents(backend, userId);
    if (pending == null) return true;
    try {
      await recordConsents(pending.items);
      _clearPending(backend, userId);
      return true;
    } catch (error) {
      final message = error is ConsentRpcError ? error.message : _messageOf(error);
      if (RegExp('CONSENT_(VERSION_MISMATCH|ITEMS_INVALID|KIND_INVALID|REQUIRED_NOT_WITHDRAWABLE)').hasMatch(message)) {
        _clearPending(backend, userId);
        store.removeItem(_scoped(_cachePrefix, backend, userId));
      }
      return false;
    }
  }

  static String _messageOf(Object error) {
    try {
      final dynamic e = error;
      return '${e.message}';
    } catch (_) {
      return '$error';
    }
  }

  // ── Anacan.AI first-use consent (kind ai_assistant) ──

  bool? readLocalAiConsent(String backend, String userId) {
    final v = _readJson(_scoped(_aiPrefix, backend, userId));
    return v is Map && v['granted'] is bool ? v['granted'] as bool : null;
  }

  void _rememberAiConsent(String backend, String userId, bool granted) =>
      _writeJson(_scoped(_aiPrefix, backend, userId), {'granted': granted, 'at': now().toUtc().toIso8601String()});

  Future<ConsentWriteResult> setAiConsent(String backend, String userId, bool granted, String? version, {bool kvkk = false}) async {
    final item = ConsentItem('ai_assistant', granted, (version == null || version.isEmpty) ? kFallbackConsentVersion : version,
        kvkk ? 'kvkk_tr' : null);
    _rememberAiConsent(backend, userId, granted);
    try {
      final state = await recordConsents([item]);
      return ConsentWriteResult(synced: true, offline: false, state: state);
    } catch (error) {
      _savePending(backend, userId, PendingConsents(items: [item], source: source, appVersion: await _appVersion()));
      return ConsentWriteResult(synced: false, offline: _offline(error));
    }
  }

  void syncLocalAiConsent(String backend, String userId, ConsentState? state) {
    final row = state?.consents['ai_assistant'];
    if (row != null) _rememberAiConsent(backend, userId, row.granted);
  }
}

enum AiConsentDecision { open, ask }

AiConsentDecision decideAiConsent(ConsentState? state, bool? local) {
  if (state != null) {
    if (!state.gate.enabled) return AiConsentDecision.open;
    final row = state.consents['ai_assistant'];
    if (row != null) return row.granted ? AiConsentDecision.open : AiConsentDecision.ask;
    return local == true ? AiConsentDecision.open : AiConsentDecision.ask;
  }
  return local == true ? AiConsentDecision.open : AiConsentDecision.ask;
}
