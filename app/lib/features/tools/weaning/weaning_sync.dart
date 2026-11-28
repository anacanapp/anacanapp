// Ported from: src/lib/weaning-sync.ts
//
// Süddən ayırma persistence: the device copy is the source the UI reads (optimistic, works offline); changes are
// queued and pushed to public.weaning_plans / public.weaning_checkins (RLS: own rows only) whenever the network is
// available. Readiness answers, the "continue breastfeeding" choice and the milk cup counter are per-device
// preferences. The LocalStore key and JSON shape are those of the WebView (`anacan.weaning.v1.<uid|guest>`).
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../domain/js_compat.dart';
import '../../../domain/weaning/weaning.dart';
import '../../../state/local_store.dart';

class StoredCheckin {
  const StoredCheckin({
    required this.id,
    required this.planId,
    required this.date,
    required this.answers,
    required this.tone,
    required this.createdAt,
    required this.synced,
  });
  final String id;
  final String? planId;
  final String date;
  final CheckinAnswers answers;
  final Tone tone;
  final String createdAt;
  final bool synced;

  StoredCheckin withSynced() => StoredCheckin(id: id, planId: planId, date: date, answers: answers, tone: tone, createdAt: createdAt, synced: true);

  Map<String, Object?> toJson() => {
        'id': id,
        'planId': planId,
        'date': date,
        'answers': answersToJson(answers),
        'tone': tone,
        'createdAt': createdAt,
        'synced': synced,
      };

  static StoredCheckin? fromJson(Object? raw) {
    if (raw is! Map) return null;
    try {
      return StoredCheckin(
        id: '${raw['id']}',
        planId: raw['planId'] as String?,
        date: '${raw['date'] ?? ''}',
        answers: answersFromJson(raw['answers']),
        tone: '${raw['tone'] ?? 'mint'}',
        createdAt: '${raw['createdAt'] ?? ''}',
        synced: raw['synced'] == true,
      );
    } catch (_) {
      return null;
    }
  }
}

Map<String, Object?> answersToJson(CheckinAnswers c) => {
      'childMood': c.childMood,
      'diapers': c.diapers,
      'childSick': c.childSick,
      'fullness': c.fullness,
      'lump': c.lump,
      'red': c.red,
      'fever': c.fever,
      'motherMood': c.motherMood,
    };

CheckinAnswers answersFromJson(Object? raw) {
  if (raw is! Map) return emptyCheckin;
  return CheckinAnswers(
    childMood: raw['childMood'] as String?,
    diapers: raw['diapers'] as String?,
    childSick: raw['childSick'] == true,
    fullness: raw['fullness'] as String?,
    lump: raw['lump'] == true,
    red: raw['red'] == true,
    fever: raw['fever'] == true,
    motherMood: raw['motherMood'] as String?,
  );
}

Map<String, Object?> resultToJson(CheckinResult r) =>
    {'tone': r.tone, 'title': r.title, 'items': r.items, 'action': r.action, 'moodLink': r.moodLink, 'emergency': r.emergency};

CheckinResult? resultFromJson(Object? raw) {
  if (raw is! Map) return null;
  return CheckinResult(
    tone: '${raw['tone'] ?? 'mint'}',
    title: '${raw['title'] ?? ''}',
    items: [for (final x in (raw['items'] as List? ?? const [])) '$x'],
    action: raw['action'] as String?,
    moodLink: raw['moodLink'] == true,
    emergency: raw['emergency'] == true,
  );
}

Map<String, Object?> readinessToJson(Readiness r) => {'sick': r.sick, 'change': r.change, 'allergy': r.allergy, 'reasons': r.reasons};

/// The device state (`WeaningLocal`, v 1).
class WeaningLocal {
  const WeaningLocal({
    required this.plan,
    required this.planDirty,
    required this.checkins,
    required this.lastResult,
    required this.continueBF,
    required this.readiness,
    required this.feeds,
    required this.pace,
    required this.nightMode,
    required this.cups,
  });
  final WeaningPlan? plan;
  final bool planDirty;
  final List<StoredCheckin> checkins;
  final CheckinResult? lastResult;
  final bool continueBF;
  final Readiness readiness;
  final Feeds feeds;
  final Pace pace;
  final NightMode nightMode;
  final ({String date, int n}) cups;

  WeaningLocal copyWith({
    Object? plan = _keep,
    bool? planDirty,
    List<StoredCheckin>? checkins,
    Object? lastResult = _keep,
    bool? continueBF,
    Readiness? readiness,
    Feeds? feeds,
    Pace? pace,
    NightMode? nightMode,
    ({String date, int n})? cups,
  }) =>
      WeaningLocal(
        plan: identical(plan, _keep) ? this.plan : plan as WeaningPlan?,
        planDirty: planDirty ?? this.planDirty,
        checkins: checkins ?? this.checkins,
        lastResult: identical(lastResult, _keep) ? this.lastResult : lastResult as CheckinResult?,
        continueBF: continueBF ?? this.continueBF,
        readiness: readiness ?? this.readiness,
        feeds: feeds ?? this.feeds,
        pace: pace ?? this.pace,
        nightMode: nightMode ?? this.nightMode,
        cups: cups ?? this.cups,
      );

  Map<String, Object?> toJson({int? maxCheckins}) => {
        'v': 1,
        'plan': plan?.toJson(),
        'planDirty': planDirty,
        'checkins': [for (final c in (maxCheckins == null ? checkins : checkins.take(maxCheckins))) c.toJson()],
        'lastResult': lastResult == null ? null : resultToJson(lastResult!),
        'continueBF': continueBF,
        'readiness': readinessToJson(readiness),
        'feeds': feeds.toJson(),
        'pace': pace,
        'nightMode': nightMode,
        'cups': {'date': cups.date, 'n': cups.n},
      };
}

const Object _keep = Object();

WeaningLocal emptyLocal([DateTime? now]) => WeaningLocal(
      plan: null,
      planDirty: false,
      checkins: const [],
      lastResult: null,
      continueBF: false,
      readiness: emptyReadiness,
      feeds: defaultFeeds,
      pace: 'gentle',
      nightMode: 'last',
      cups: (date: isoDay(now ?? DomainClock.now()), n: 0),
    );

String weaningStorageKey(String? uid) => 'anacan.weaning.v1.${uid == null || uid.isEmpty ? 'guest' : uid}';
const int maxCheckins = 60;

bool? _boolOrNull(Object? v) => v is bool ? v : null;

/// `readLocal(uid)`: the stored state merged over the defaults; anything malformed gives the defaults.
WeaningLocal readLocal(LocalStore store, String? uid) {
  try {
    final raw = jsonDecode(store.getItem(weaningStorageKey(uid)) ?? 'null');
    if (raw is! Map || raw['v'] != 1) return emptyLocal();
    final base = emptyLocal();
    final r = raw['readiness'];
    final f = raw['feeds'];
    final c = raw['cups'];
    WeaningPlan? plan;
    if (raw['plan'] is Map) {
      try {
        plan = WeaningPlan.fromJson((raw['plan'] as Map).cast<String, Object?>());
      } catch (_) {
        plan = null;
      }
    }
    return WeaningLocal(
      plan: plan,
      planDirty: raw['planDirty'] == true,
      checkins: raw['checkins'] is List ? [for (final x in raw['checkins'] as List) ?StoredCheckin.fromJson(x)] : const [],
      lastResult: resultFromJson(raw['lastResult']),
      continueBF: raw['continueBF'] == true,
      readiness: Readiness(
        sick: r is Map ? _boolOrNull(r['sick']) : null,
        change: r is Map ? _boolOrNull(r['change']) : null,
        allergy: r is Map ? _boolOrNull(r['allergy']) : null,
        reasons: r is Map && r['reasons'] is List ? [for (final x in r['reasons'] as List) '$x'] : const [],
      ),
      feeds: Feeds(
        morning: f is Map && f['morning'] is bool ? f['morning'] as bool : base.feeds.morning,
        day: f is Map && f['day'] is num ? f['day'] as num : base.feeds.day,
        nap: f is Map && f['nap'] is bool ? f['nap'] as bool : base.feeds.nap,
        bedtime: f is Map && f['bedtime'] is bool ? f['bedtime'] as bool : base.feeds.bedtime,
        night: f is Map && f['night'] is num ? f['night'] as num : base.feeds.night,
      ),
      pace: raw['pace'] is String ? raw['pace'] as String : base.pace,
      nightMode: raw['nightMode'] is String ? raw['nightMode'] as String : base.nightMode,
      cups: c is Map && c['date'] is String && c['n'] is num ? (date: c['date'] as String, n: (c['n'] as num).toInt()) : base.cups,
    );
  } catch (_) {
    return emptyLocal();
  }
}

void writeLocal(LocalStore store, String? uid, WeaningLocal state) {
  try {
    store.setItem(weaningStorageKey(uid), jsonEncode(state.toJson(maxCheckins: maxCheckins)));
  } catch (_) {}
}

StoredCheckin makeCheckin(CheckinAnswers answers, CheckinResult res, String? planId, [DateTime? now]) {
  final at = now ?? DomainClock.now();
  return StoredCheckin(id: weaningIdGenerator(), planId: planId, date: isoDay(at), answers: answers, tone: res.tone, createdAt: jsToIsoString(at), synced: false);
}

// ── Server rows ───────────────────────────────────────────────────────────────────────────────

Map<String, Object?> planToRow(String uid, WeaningPlan p) => {
      'id': p.id,
      'user_id': uid,
      'child_id': p.childId,
      'pace': p.pace,
      'night_mode': p.nightMode,
      'steps': [for (final s in p.steps) s.toJson()],
      'status': p.status,
      'pause_reason': p.pauseReason,
      'started_at': p.startedAt,
      'created_at': p.createdAt,
      'updated_at': p.updatedAt,
    };

WeaningPlan rowToPlan(Map<String, dynamic> r) => WeaningPlan(
      id: '${r['id']}',
      childId: r['child_id'] as String?,
      pace: '${r['pace']}',
      nightMode: '${r['night_mode']}',
      steps: r['steps'] is List ? [for (final s in r['steps'] as List) WeaningStep.fromJson((s as Map).cast<String, Object?>())] : const [],
      status: '${r['status']}',
      pauseReason: r['pause_reason'] as String?,
      startedAt: '${r['started_at']}'.length > 10 ? '${r['started_at']}'.substring(0, 10) : '${r['started_at']}',
      createdAt: '${r['created_at']}',
      updatedAt: '${r['updated_at']}',
    );

Map<String, Object?> checkinToRow(String uid, StoredCheckin c) => {
      'id': c.id,
      'user_id': uid,
      'plan_id': c.planId,
      'date': c.date,
      'child_mood': c.answers.childMood,
      'wet_diapers': c.answers.diapers,
      'child_sick': c.answers.childSick,
      'breast_fullness': c.answers.fullness,
      'lump': c.answers.lump,
      'redness': c.answers.red,
      'fever': c.answers.fever,
      'mother_mood': c.answers.motherMood,
      'result_tone': c.tone,
      'created_at': c.createdAt,
    };

/// The two tables the sync writes (errors are thrown).
abstract interface class WeaningRemote {
  /// Latest plan of this user for the child that is still relevant (active, paused or finished), as a row.
  Future<Map<String, dynamic>?> fetchPlanRow(String uid, String? childId);

  /// `weaning_plans.upsert(row, { onConflict: 'id' })`.
  Future<void> upsertPlan(Map<String, Object?> row);

  /// `weaning_checkins.upsert(rows, { onConflict: 'id' })`.
  Future<void> upsertCheckins(List<Map<String, Object?>> rows);
}

class SupabaseWeaningRemote implements WeaningRemote {
  SupabaseWeaningRemote(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<Map<String, dynamic>?> fetchPlanRow(String uid, String? childId) async {
    final q = _client()
        .from('weaning_plans')
        .select('id, user_id, child_id, pace, night_mode, steps, status, pause_reason, started_at, created_at, updated_at')
        .eq('user_id', uid)
        .inFilter('status', ['active', 'paused', 'finished']);
    final data = await (childId != null ? q.eq('child_id', childId) : q.isFilter('child_id', null)).order('updated_at', ascending: false).limit(1);
    return data.isEmpty ? null : Map<String, dynamic>.from(data.first);
  }

  @override
  Future<void> upsertPlan(Map<String, Object?> row) => _client().from('weaning_plans').upsert(row, onConflict: 'id');

  @override
  Future<void> upsertCheckins(List<Map<String, Object?>> rows) => _client().from('weaning_checkins').upsert(rows, onConflict: 'id');
}

final weaningRemoteProvider =
    Provider<WeaningRemote>((ref) => SupabaseWeaningRemote(() => ref.read(supabaseClientProvider)), name: 'weaningRemoteProvider');

Future<WeaningPlan?> fetchPlan(WeaningRemote db, String uid, String? childId) async {
  final row = await db.fetchPlanRow(uid, childId);
  return row == null ? null : rowToPlan(row);
}

Future<void> pushPlan(WeaningRemote db, String uid, WeaningPlan plan) => db.upsertPlan(planToRow(uid, plan));

Future<List<String>> pushCheckins(WeaningRemote db, String uid, List<StoredCheckin> list) async {
  if (list.isEmpty) return const [];
  await db.upsertCheckins([for (final c in list) checkinToRow(uid, c)]);
  return [for (final c in list) c.id];
}

int _parse(String iso) => jsParseDate(iso)?.millisecondsSinceEpoch ?? 0;

/// Reconcile the device state with the server: unsynced local changes win and are pushed; otherwise a newer server
/// plan (another device) replaces the local one. Never throws; returns the new state and whether all pending changes
/// reached the server.
Future<({WeaningLocal state, bool ok})> syncWeaning(WeaningRemote db, String uid, String? childId, WeaningLocal state) async {
  var next = state;
  var ok = true;
  try {
    if (next.plan != null && next.planDirty) {
      await pushPlan(db, uid, next.plan!);
      next = next.copyWith(planDirty: false);
    }
  } catch (_) {
    ok = false;
  }
  try {
    final pending = next.checkins.where((c) => !c.synced).toList();
    if (pending.isNotEmpty) {
      final done = (await pushCheckins(db, uid, pending)).toSet();
      next = next.copyWith(checkins: [for (final c in next.checkins) done.contains(c.id) ? c.withSynced() : c]);
    }
  } catch (_) {
    ok = false;
  }
  if (ok) {
    try {
      final remote = await fetchPlan(db, uid, childId);
      final local = next.plan != null && next.plan!.childId == childId ? next.plan : null;
      // A newer server plan (edited or created on another device) wins; local changes were pushed above.
      if (remote != null && (local == null || _parse(remote.updatedAt) > _parse(local.updatedAt))) {
        next = next.copyWith(plan: remote, planDirty: false);
      }
    } catch (_) {
      ok = false;
    }
  }
  return (state: next, ok: ok);
}
