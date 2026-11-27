// Ported from: src/lib/premium-grant-cache.ts
//
// Offline continuation of a server-confirmed Premium grant. `get_premium_access_v1` answers with a short
// (≤31 s) lease plus the real expiry of the own/household grant. A confirmed active grant stays valid
// locally until min(real expiry, last confirmation + 72 h).
//
// Storage key and JSON shape are byte-compatible with the Capacitor app's localStorage entry
// `anacan_premium_grant_v1:<backend>:<userId>` =
// `{"backend","userId","partner","confirmedAt","ownUntil","householdUntil","ownSource"}`.

import 'dart:convert';
import 'dart:math' as math;

import '../../state/local_store.dart';

const int premiumOfflineGraceMs = 72 * 60 * 60 * 1000;

/// Local clock skew tolerated before a record is treated as tampered.
const int _clockBackwardToleranceMs = 5 * 60 * 1000;
const String premiumGrantPrefix = 'anacan_premium_grant_v1:';

class ServerGrant {
  const ServerGrant({required this.active, this.expiresAt, this.source});
  final bool active;
  final String? expiresAt;
  final String? source;
}

class PremiumGrantRecord {
  const PremiumGrantRecord({
    required this.backend,
    required this.userId,
    required this.partner,
    required this.confirmedAt,
    required this.ownUntil,
    required this.householdUntil,
    required this.ownSource,
  });

  final String backend;
  final String userId;

  /// Partner the household grant was confirmed for; a changed link invalidates it.
  final String? partner;

  /// Local wall-clock time (ms) of the confirming server answer.
  final double confirmedAt;

  /// Local wall-clock deadlines (0 = inactive).
  final double ownUntil;
  final double householdUntil;
  final String? ownSource;

  Map<String, Object?> toJson() => {
        'backend': backend,
        'userId': userId,
        'partner': partner,
        'confirmedAt': _jsNum(confirmedAt),
        'ownUntil': _jsNum(ownUntil),
        'householdUntil': _jsNum(householdUntil),
        'ownSource': ownSource,
      };

  static num _jsNum(double v) => v == v.roundToDouble() && v.abs() < 9007199254740992 ? v.toInt() : v;
}

/// `Date.parse` for the ISO strings the server sends; NaN when unparsable.
double _parse(String? value) {
  if (value == null) return double.nan;
  final d = DateTime.tryParse(value);
  return d == null ? double.nan : d.millisecondsSinceEpoch.toDouble();
}

double _grantDeadline(ServerGrant grant, double checkedAt, double confirmedAt, int graceMs) {
  if (!grant.active) return 0;
  final cap = confirmedAt + graceMs;
  if (grant.expiresAt == null) return cap;
  final expires = _parse(grant.expiresAt);
  if (!expires.isFinite) return 0;
  // Server-relative remaining time; immune to a device clock that is simply wrong.
  return math.min(cap, confirmedAt + (expires - checkedAt));
}

/// Build a record from an already validated server answer.
PremiumGrantRecord recordFromServer({
  required String backend,
  required String userId,
  required String? partner,
  required String checkedAt,
  required ServerGrant own,
  required ServerGrant household,
  num? now,
  int graceMs = premiumOfflineGraceMs,
}) {
  final confirmedAt = (now ?? DateTime.now().millisecondsSinceEpoch).toDouble();
  final checked = _parse(checkedAt);
  final safeChecked = checked.isFinite ? checked : confirmedAt;
  return PremiumGrantRecord(
    backend: backend,
    userId: userId,
    partner: partner,
    confirmedAt: confirmedAt,
    ownUntil: _grantDeadline(own, safeChecked, confirmedAt, graceMs),
    householdUntil: _grantDeadline(household, safeChecked, confirmedAt, graceMs),
    ownSource: own.active ? own.source : null,
  );
}

class GrantEvaluation {
  const GrantEvaluation({required this.own, required this.household, required this.hadGrant, this.nextChange});
  final bool own;
  final bool household;
  final bool hadGrant;
  final double? nextChange;
}

/// Evaluate a record for the current account/backend/partner at [now] (ms).
GrantEvaluation evaluateGrant(PremiumGrantRecord? record, {required String backend, required String? userId, required String? partner, num? now}) {
  const none = GrantEvaluation(own: false, household: false, hadGrant: false);
  final t = (now ?? DateTime.now().millisecondsSinceEpoch).toDouble();
  if (record == null || userId == null || userId.isEmpty || record.userId != userId || record.backend != backend) return none;
  if (t < record.confirmedAt - _clockBackwardToleranceMs) {
    return GrantEvaluation(own: false, household: false, hadGrant: record.ownUntil > 0 || record.householdUntil > 0);
  }
  final householdUntil = record.partner == partner ? record.householdUntil : 0.0;
  final own = record.ownUntil > t, household = householdUntil > t;
  final upcoming = [record.ownUntil, householdUntil].where((v) => v > t).toList();
  return GrantEvaluation(
    own: own,
    household: household,
    hadGrant: record.ownUntil > 0 || householdUntil > 0,
    nextChange: upcoming.isEmpty ? null : upcoming.reduce(math.min),
  );
}

String premiumGrantKey(String backend, String userId) => '$premiumGrantPrefix$backend:$userId';

/// Synchronous localStorage surface (LocalStore implements it through [LocalStoreGrantStorage]).
abstract interface class GrantStorage {
  String? getItem(String key);
  void setItem(String key, String value);
  void removeItem(String key);
}

class LocalStoreGrantStorage implements GrantStorage {
  const LocalStoreGrantStorage(this.store);
  final LocalStore store;
  @override
  String? getItem(String key) => store.getItem(key);
  @override
  void setItem(String key, String value) => store.setItem(key, value);
  @override
  void removeItem(String key) => store.removeItem(key);
}

class MemoryGrantStorage implements GrantStorage {
  final Map<String, String> values = {};
  @override
  String? getItem(String key) => values[key];
  @override
  void setItem(String key, String value) => values[key] = value;
  @override
  void removeItem(String key) => values.remove(key);
}

double _finite(Object? v) => v is num ? v.toDouble() : double.nan;

PremiumGrantRecord? readGrantRecord(GrantStorage storage, String backend, String userId) {
  try {
    final raw = storage.getItem(premiumGrantKey(backend, userId));
    if (raw == null || raw.isEmpty) return null;
    final value = jsonDecode(raw);
    if (value is! Map || value['userId'] != userId || value['backend'] != backend) return null;
    final confirmedAt = _finite(value['confirmedAt']), ownUntil = _finite(value['ownUntil']), householdUntil = _finite(value['householdUntil']);
    if (![confirmedAt, ownUntil, householdUntil].every((v) => v.isFinite)) return null;
    return PremiumGrantRecord(
      backend: backend,
      userId: userId,
      partner: value['partner'] as String?,
      confirmedAt: confirmedAt,
      ownUntil: ownUntil,
      householdUntil: householdUntil,
      ownSource: value['ownSource'] as String?,
    );
  } catch (_) {
    return null;
  }
}

void writeGrantRecord(GrantStorage storage, PremiumGrantRecord record) {
  try {
    final key = premiumGrantKey(record.backend, record.userId);
    if (record.ownUntil <= 0 && record.householdUntil <= 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, jsonEncode(record.toJson()));
    }
  } catch (_) {
    // storage unavailable: the in-memory record still covers this session
  }
}

/// Pick the newest of the in-memory and stored records.
PremiumGrantRecord? newestRecord(Iterable<PremiumGrantRecord?> records) {
  PremiumGrantRecord? best;
  for (final value in records) {
    if (value != null && (best == null || value.confirmedAt > best.confirmedAt)) best = value;
  }
  return best;
}
