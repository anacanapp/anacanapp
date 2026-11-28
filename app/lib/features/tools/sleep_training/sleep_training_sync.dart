// Ported from: src/lib/sleep-training-sync.ts
//
// Sleep-training plan sync. The device copy (LocalStore per account and child) is what the screen reads: optimistic
// and offline-first. In the background it is synced with public.sleep_training_plans (one row per owner + child; the
// linked partner may read it while baby logs are shared):
//  - the newest updated_at wins (a local change made after the server copy is uploaded, otherwise the server copy
//    replaces the device copy);
//  - an upload only replaces an older server row (`updated_at < ours`), so a slower phone never overwrites a newer
//    plan;
//  - the older per-account plan (v1 key, no child) is adopted once by the first child it is opened for and uploaded
//    when the server has nothing newer;
//  - while the table is absent (migration not applied yet) the tool stays quietly local-only.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../domain/js_compat.dart';
import '../../../domain/sleep/sleep_training.dart';
import '../../../state/local_store.dart';

const String planTable = 'sleep_training_plans';

/// The device envelope (`StoredPlan`, v 2).
class StoredPlan {
  const StoredPlan({required this.plan, required this.updatedAt, required this.dirty});
  final PlanState plan;

  /// ISO time of the last change (local) or of the server copy; null = unknown age (never synced, legacy).
  final String? updatedAt;

  /// Changed on this device and not uploaded yet.
  final bool dirty;

  StoredPlan copyWith({bool? dirty, String? updatedAt}) => StoredPlan(plan: plan, updatedAt: updatedAt ?? this.updatedAt, dirty: dirty ?? this.dirty);

  Map<String, Object?> toJson() => {'v': 2, 'plan': plan.toJson(), 'updatedAt': updatedAt, 'dirty': dirty};

  @override
  bool operator ==(Object other) =>
      other is StoredPlan && other.updatedAt == updatedAt && other.dirty == dirty && samePlan(other.plan, plan);

  @override
  int get hashCode => Object.hash(updatedAt, dirty, jsonEncode(plan.toJson()));
}

class RemotePlan {
  const RemotePlan({required this.plan, required this.updatedAt});
  final Object? plan;
  final String updatedAt;
}

String planStorageKeyV2(String userId, String? childId) => 'anacan.sleepTraining.v2.$userId.${childId ?? 'none'}';
String legacyClaimKey(String userId) => 'anacan.sleepTraining.v1.claimed.$userId';

int _ms(String? iso) => iso == null ? 0 : (jsParseDate(iso)?.millisecondsSinceEpoch ?? 0);
bool _isIso(Object? v) => v is String && jsParseDate(v) != null;

StoredPlan emptyStored() => const StoredPlan(plan: defaultPlanState, updatedAt: null, dirty: false);

bool samePlan(PlanState a, PlanState b) => jsonEncode(a.toJson()) == jsonEncode(b.toJson());
bool isDefaultPlan(PlanState p) => samePlan(p, defaultPlanState);

/// A stored v2 envelope, or null when it is missing or malformed.
StoredPlan? parseStored(String? raw, String todayKey) {
  if (raw == null || raw.isEmpty) return null;
  try {
    final r = jsonDecode(raw);
    if (r is! Map || r['v'] != 2) return null;
    return StoredPlan(
      plan: prunePlanState(parsePlanState(r['plan']), todayKey),
      updatedAt: _isIso(r['updatedAt']) ? r['updatedAt'] as String : null,
      dirty: r['dirty'] == true,
    );
  } catch (_) {
    return null;
  }
}

/// Reads the device copy for one child. Without one, the older per-account plan is adopted by the first child that
/// asks for it (the claim is remembered, so a second child starts empty) and marked for upload.
StoredPlan readLocalPlan(LocalStore? storage, String userId, String? childId, String todayKey) {
  if (storage == null) return emptyStored();
  try {
    final own = parseStored(storage.getItem(planStorageKeyV2(userId, childId)), todayKey);
    if (own != null) return own;
    if (childId == null) return emptyStored();
    final claimed = storage.getItem(legacyClaimKey(userId));
    if (claimed != null && claimed.isNotEmpty && claimed != childId) return emptyStored();
    final legacyRaw = storage.getItem(planStorageKey(userId));
    if (legacyRaw == null || legacyRaw.isEmpty) return emptyStored();
    final plan = prunePlanState(parsePlanState(jsonDecode(legacyRaw)), todayKey);
    storage.setItem(legacyClaimKey(userId), childId);
    final adopted = StoredPlan(plan: plan, updatedAt: null, dirty: !isDefaultPlan(plan));
    storage.setItem(planStorageKeyV2(userId, childId), jsonEncode(adopted.toJson()));
    return adopted;
  } catch (_) {
    return emptyStored();
  }
}

void writeLocalPlan(LocalStore? storage, String userId, String? childId, StoredPlan s) {
  if (storage == null) return;
  try {
    storage.setItem(planStorageKeyV2(userId, childId), jsonEncode(s.toJson()));
  } catch (_) {}
}

/// Applies a local change: stamped now and marked for upload (unchanged plans stay as they are).
StoredPlan applyLocalChange(StoredPlan s, PlanState next, [DateTime? now]) {
  if (samePlan(s.plan, next)) return s;
  return StoredPlan(plan: next, updatedAt: jsToIsoString(now ?? DomainClock.now()), dirty: true);
}

/// Newest wins. Returns the device copy to keep and whether it must be uploaded. A local copy of unknown age
/// (legacy, never synced) loses to any server row.
({StoredPlan next, bool push}) mergePlan(StoredPlan local, RemotePlan? remote, String todayKey, [DateTime? now]) {
  if (remote == null) {
    if (!local.dirty) return (next: local, push: false);
    return (next: local.updatedAt != null ? local : local.copyWith(updatedAt: jsToIsoString(now ?? DomainClock.now())), push: true);
  }
  final lt = _ms(local.updatedAt), rt = _ms(remote.updatedAt);
  if (local.dirty && lt > rt) return (next: local, push: true);
  if (!local.dirty && lt == rt) return (next: local, push: false);
  return (
    next: StoredPlan(plan: prunePlanState(parsePlanState(remote.plan), todayKey), updatedAt: remote.updatedAt, dirty: false),
    push: false,
  );
}

// ── Server ────────────────────────────────────────────────────────────────────────────────────

/// A PostgREST error as the sync inspects it (`{ code, message }`).
class PlanDbError implements Exception {
  const PlanDbError({this.code, this.message});
  final String? code;
  final String? message;
  @override
  String toString() => 'PlanDbError($code, $message)';
}

({String? code, String? message}) _fields(Object? error) {
  if (error is PlanDbError) return (code: error.code, message: error.message);
  if (error is PostgrestException) return (code: error.code, message: error.message);
  return (code: null, message: error?.toString());
}

/// The table is not there yet (migration pending) or not in PostgREST's schema cache.
bool isMissingTable(Object? error) {
  if (error == null) return false;
  final f = _fields(error);
  if (f.code == '42P01' || f.code == 'PGRST205' || f.code == 'PGRST204') return true;
  final m = f.message ?? '';
  return RegExp('sleep_training_plans').hasMatch(m) && RegExp('(does not exist|schema cache|not find)', caseSensitive: false).hasMatch(m);
}

/// The table access the sync needs (`db.from(PLAN_TABLE)`). Errors are thrown ([PlanDbError] /
/// [PostgrestException]).
abstract interface class SleepPlanRemote {
  /// `select('plan, updated_at').eq('user_id').eq|is('child_id').maybeSingle()`.
  Future<RemotePlan?> fetch(String ownerId, String? childId);

  /// `update({plan, updated_at}).eq('user_id').eq|is('child_id').lt('updated_at', updatedAt).select('id')` → rows.
  Future<int> update(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt);

  /// `insert({user_id, child_id, plan, updated_at})`.
  Future<void> insert(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt);
}

class SupabaseSleepPlanRemote implements SleepPlanRemote {
  SupabaseSleepPlanRemote(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<RemotePlan?> fetch(String ownerId, String? childId) async {
    final q = _client().from(planTable).select('plan, updated_at').eq('user_id', ownerId);
    final row = await (childId != null ? q.eq('child_id', childId) : q.isFilter('child_id', null)).maybeSingle();
    if (row == null) return null;
    return RemotePlan(plan: row['plan'], updatedAt: '${row['updated_at']}');
  }

  @override
  Future<int> update(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt) async {
    final q = _client().from(planTable).update({'plan': plan, 'updated_at': updatedAt}).eq('user_id', ownerId);
    final data = await (childId != null ? q.eq('child_id', childId) : q.isFilter('child_id', null)).lt('updated_at', updatedAt).select('id');
    return data.length;
  }

  @override
  Future<void> insert(String ownerId, String? childId, Map<String, Object?> plan, String updatedAt) =>
      _client().from(planTable).insert({'user_id': ownerId, 'child_id': childId, 'plan': plan, 'updated_at': updatedAt});
}

final sleepPlanRemoteProvider =
    Provider<SleepPlanRemote>((ref) => SupabaseSleepPlanRemote(() => ref.read(supabaseClientProvider)), name: 'sleepPlanRemoteProvider');

bool _tableMissing = false;

/// Test hook: forget that the table was missing.
void resetPlanTableState() => _tableMissing = false;

Future<RemotePlan?> fetchRemotePlan(SleepPlanRemote db, String ownerId, String? childId) => db.fetch(ownerId, childId);

/// Upload: replaces only an older row; 'conflict' = the server has something newer (or a concurrent insert).
Future<String> pushRemotePlan(SleepPlanRemote db, String ownerId, String? childId, StoredPlan s, bool remoteExists) async {
  final updatedAt = s.updatedAt ?? jsToIsoString(DomainClock.now());
  if (remoteExists) {
    final n = await db.update(ownerId, childId, s.plan.toJson(), updatedAt);
    return n > 0 ? 'ok' : 'conflict';
  }
  try {
    await db.insert(ownerId, childId, s.plan.toJson(), updatedAt);
  } catch (error) {
    if (_fields(error).code == '23505') return 'conflict';
    rethrow;
  }
  return 'ok';
}

/// Fetch → merge → upload when ours is newer. Never throws: on failure (offline, table absent) the local copy comes
/// back unchanged with ok = false, and it stays dirty for the next attempt.
Future<({StoredPlan state, bool ok})> syncPlan({
  required SleepPlanRemote db,
  required String userId,
  required String? childId,
  required StoredPlan local,
  required String todayKey,
  DateTime? now,
}) async {
  if (_tableMissing) return (state: local, ok: false);
  try {
    var cur = local;
    for (var attempt = 0; attempt < 3; attempt += 1) {
      final remote = await fetchRemotePlan(db, userId, childId);
      final m = mergePlan(cur, remote, todayKey, now);
      if (!m.push) return (state: m.next, ok: true);
      final res = await pushRemotePlan(db, userId, childId, m.next, remote != null);
      if (res == 'ok') return (state: m.next.copyWith(dirty: false), ok: true);
      cur = m.next; // someone wrote meanwhile: fetch again and let the newest win
    }
    return (state: cur, ok: false);
  } catch (error) {
    if (isMissingTable(error)) _tableMissing = true;
    return (state: local, ok: false);
  }
}

/// The mother's plan for one of her children, for her linked partner (RLS: only while she shares baby logs).
Future<({PlanState plan, String updatedAt})?> fetchSharedSleepPlan(SleepPlanRemote db, String ownerId, String childId, String todayKey) async {
  if (_tableMissing) return null;
  try {
    final remote = await fetchRemotePlan(db, ownerId, childId);
    return remote == null ? null : (plan: prunePlanState(parsePlanState(remote.plan), todayKey), updatedAt: remote.updatedAt);
  } catch (error) {
    if (isMissingTable(error)) _tableMissing = true;
    return null;
  }
}
