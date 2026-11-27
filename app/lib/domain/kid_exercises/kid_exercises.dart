// Ported from: src/lib/kid-exercises.ts
//
// Uşaq məşqləri: illustrated movement exercises from birth to 5 years. Progress (done today, favourites, chosen
// age group) stays on the phone, per account, bounded; the stored JSON shape is unchanged.

import 'dart:convert';
import 'dart:math' as math;

import '../js_compat.dart';
import 'data/search_fold_data.g.dart';

class KidExercise {
  const KidExercise({
    required this.id,
    required this.set,
    required this.groupKey,
    required this.group,
    required this.title,
    this.age = '',
    required this.how,
    this.duration = '',
    required this.benefit,
    this.caution,
  });

  /// `<set>/<file>`, also the image path.
  final String id;
  final String set;

  /// Azerbaijani group label (month range in the first two sets, kind of movement later).
  final String groupKey;
  final String group;
  final String title;
  final String age;
  final String how;
  final String duration;
  final String benefit;
  final String? caution;

  factory KidExercise.fromJson(Map<String, Object?> j) => KidExercise(
        id: j['id']! as String,
        set: j['set']! as String,
        groupKey: j['groupKey']! as String,
        group: j['group']! as String,
        title: j['title']! as String,
        age: (j['age'] ?? '') as String,
        how: j['how']! as String,
        duration: (j['duration'] ?? '') as String,
        benefit: j['benefit']! as String,
        caution: j['caution'] as String?,
      );
}

String exerciseImage(String id) => '/exercises/$id.webp';

const List<String> kidExSetIds = ['0-1', '1-2', '2-3', '3-4', '4-5'];

/// Age group for a child's age in months; older than 5 years stays in the last group.
String setForMonths(num months) {
  final m = math.max(0, months.floor());
  if (m < 12) return '0-1';
  if (m < 24) return '1-2';
  if (m < 36) return '2-3';
  if (m < 48) return '3-4';
  return '4-5';
}

/// Month range of a group key such as "0–3 ay"; null for kinds of movement.
({int min, int max})? groupMonths(String groupKey) {
  final m = RegExp(r'^(\d+)\s*[–-]\s*(\d+)\s*ay$').firstMatch(groupKey.trim());
  return m == null ? null : (min: int.parse(m[1]!), max: int.parse(m[2]!));
}

/// The group that holds the child's age (first two sets only).
String? currentGroupKey(List<KidExercise> exercises, String setId, num? months) {
  if (months == null) return null;
  for (final e in exercises) {
    if (e.set != setId) continue;
    final r = groupMonths(e.groupKey);
    if (r != null && r.min <= months && months < r.max) return e.groupKey;
  }
  return null;
}

/// Groups of a set in source order.
List<({String key, String label, List<KidExercise> items})> groupsOf(List<KidExercise> exercises) {
  final out = <({String key, String label, List<KidExercise> items})>[];
  for (final e in exercises) {
    final i = out.indexWhere((g) => g.key == e.groupKey);
    if (i < 0) {
      out.add((key: e.groupKey, label: e.group, items: [e]));
    } else {
      out[i].items.add(e);
    }
  }
  return out;
}

/// Accent-insensitive search text: `toLocaleLowerCase`, ə → e, ı → i, then NFD with the combining marks
/// U+0300-U+036F removed. Dart has no `String.normalize`, so the NFD step uses a table generated from Node's ICU
/// (data/search_fold_data.g.dart) plus the algorithmic Hangul syllable decomposition.
String foldSearch(String text) {
  final lower = text.toLowerCase().replaceAll('ə', 'e').replaceAll('ı', 'i');
  final out = StringBuffer();
  for (final r in lower.runes) {
    if (r >= 0x300 && r <= 0x36f) continue;
    if (r >= 0xac00 && r <= 0xd7a3) {
      final s = r - 0xac00;
      out.writeCharCode(0x1100 + s ~/ 588);
      out.writeCharCode(0x1161 + (s % 588) ~/ 28);
      if (s % 28 != 0) out.writeCharCode(0x11a7 + s % 28);
      continue;
    }
    final ch = String.fromCharCode(r);
    out.write(searchFoldMap[ch] ?? ch);
  }
  return out.toString();
}

List<KidExercise> searchExercises(List<KidExercise> exercises, String query) {
  final q = foldSearch(query.trim());
  if (q.isEmpty) return exercises;
  return exercises.where((e) => foldSearch([e.title, e.how, e.benefit, e.group].join(' ')).contains(q)).toList();
}

/// Three picks for today, deterministic per day / child / group (FNV-1a of `seed|id`).
List<KidExercise> todaysPicks(List<KidExercise> exercises, String seed, num? months, [int count = 3]) {
  var pool = exercises;
  var current = <KidExercise>[];
  if (months != null) {
    final ranged = exercises.where((e) => groupMonths(e.groupKey) != null).toList();
    if (ranged.isNotEmpty) {
      pool = ranged.where((e) => (groupMonths(e.groupKey)?.min ?? 0) <= months).toList();
      if (pool.isEmpty) pool = ranged.where((e) => (groupMonths(e.groupKey)?.min ?? 0) == 0).toList();
      current = pool.where((e) {
        final r = groupMonths(e.groupKey)!;
        return r.min <= months && months < r.max;
      }).toList();
    }
  }
  List<KidExercise> order(List<KidExercise> list) =>
      jsSorted(list, (KidExercise a, KidExercise b) => fnv1a32('$seed|${a.id}') - fnv1a32('$seed|${b.id}'));
  final picks = <KidExercise>[];
  for (final e in order(current)) {
    if (picks.length >= math.min(2, count)) break;
    picks.add(e);
  }
  final usedGroups = picks.map((p) => p.groupKey).toSet();
  final rest = order(pool.where((e) => !picks.contains(e)).toList());
  for (final e in rest) {
    if (picks.length >= count) break;
    if (!usedGroups.contains(e.groupKey) || current.isNotEmpty) {
      picks.add(e);
      usedGroups.add(e.groupKey);
    }
  }
  for (final e in rest) {
    if (picks.length >= count) break;
    if (!picks.contains(e)) picks.add(e);
  }
  return picks;
}

// ── Progress on the phone ──────────────────────────────────────────────────────────────────────
class KidExState {
  const KidExState({this.set, this.favs = const [], this.log = const []});

  /// Chosen age group; null follows the child's age.
  final String? set;
  final List<String> favs;
  final List<({String d, String id})> log;

  KidExState copyWith({Object? set = _keep, List<String>? favs, List<({String d, String id})>? log}) =>
      KidExState(set: identical(set, _keep) ? this.set : set as String?, favs: favs ?? this.favs, log: log ?? this.log);

  Map<String, Object?> toJson() => {
        'set': set,
        'favs': favs.take(kidExMaxFavs).toList(),
        'log': [for (final l in log.skip(math.max(0, log.length - kidExMaxLog))) {'d': l.d, 'id': l.id}],
      };
}

const Object _keep = Object();
const int kidExMaxLog = 400;
const int kidExMaxFavs = 60;

String kidExStorageKey(String? userId) => 'anacan_kid_exercises_v1:${userId ?? 'guest'}';

String dayKey(DateTime d) => '${d.year}-${pad2(d.month)}-${pad2(d.day)}';

/// readKidExState on the stored text (null / bad JSON / bad shape → empty).
KidExState parseKidExState(String? raw) {
  if (raw == null || raw.isEmpty) return const KidExState();
  try {
    final v = jsonDecode(raw);
    if (v is! Map) return const KidExState();
    final set = v['set'], favs = v['favs'], log = v['log'];
    final logList = log is List
        ? [
            for (final x in log)
              if (x is Map && x['d'] is String && x['id'] is String) (d: x['d'] as String, id: x['id'] as String),
          ]
        : <({String d, String id})>[];
    return KidExState(
      set: set is String && kidExSetIds.contains(set) ? set : null,
      favs: favs is List ? favs.whereType<String>().take(kidExMaxFavs).toList() : const [],
      log: logList.skip(math.max(0, logList.length - kidExMaxLog)).toList(),
    );
  } catch (_) {
    return const KidExState();
  }
}

/// writeKidExState payload.
String serializeKidExState(KidExState state) => jsonEncode(state.toJson());

Set<String> doneOn(KidExState state, String day) => {for (final l in state.log) if (l.d == day) l.id};

KidExState logDone(KidExState state, String id, DateTime now) {
  final d = dayKey(now);
  if (state.log.any((l) => l.d == d && l.id == id)) return state;
  final log = [...state.log, (d: d, id: id)];
  return state.copyWith(log: log.skip(math.max(0, log.length - kidExMaxLog)).toList());
}

KidExState unlogDone(KidExState state, String id, DateTime now) {
  final d = dayKey(now);
  return state.copyWith(log: state.log.where((l) => !(l.d == d && l.id == id)).toList());
}

KidExState toggleFav(KidExState state, String id) => state.copyWith(
      favs: state.favs.contains(id) ? state.favs.where((f) => f != id).toList() : [id, ...state.favs].take(kidExMaxFavs).toList(),
    );

/// Last 7 days, oldest first, with the number of exercises done each day.
List<({String day, int count, bool today})> weekStrip(KidExState state, DateTime now) => [
      for (var i = 6; i >= 0; i--)
        () {
          final k = dayKey(DateTime(now.year, now.month, now.day - i));
          return (day: k, count: state.log.where((l) => l.d == k).length, today: i == 0);
        }(),
    ];

bool isKidExTileVisible({String? lifeStage, required bool hasContent, bool disabled = false, bool isAdmin = false}) =>
    !disabled && hasContent && (lifeStage == 'mommy' || isAdmin);
