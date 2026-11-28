// Ported from: src/lib/parenting.ts (device store: ReminderPref, ChildSlot, ParentingLocal, EMPTY_PARENTING,
//              EMPTY_SLOT, storageKey, capMarks, sanitizeParenting, readParenting, writeParenting, usesRoot, readSlot,
//              writeSlot, allSlots, setSlotBand, normalizeForChild, childForProgramme, toggleSavedState, setBandState,
//              setProgrammeState, hasParentingActivity)
//
// The device copy (LocalStore `anacan.parenting.v1.<uid|guest>`, the WebView JSON shape) is what the tool reads; it
// is merged with public.parenting_state in the background (parenting_sync.dart). One child's band choice, programme
// progress and quiz results live in a slot; the account-level fields are the root child's slot (older app versions
// keep reading them), every other child has its own slot under `children`.
import 'dart:convert';

import '../../../domain/js_compat.dart';
import '../../../domain/parenting/parenting.dart' show BandChoice, ProgrammeProgress, bandForUnset, effectiveBand, toggleSaved;
import '../../../state/local_store.dart';

export '../../../domain/parenting/parenting.dart' show bandForUnset;

/// Daily programme reminder on this phone (Premium / free days). Never synced.
class ReminderPref {
  const ReminderPref({required this.on, required this.time});
  final bool on;

  /// Local time HH:MM.
  final String time;
  Map<String, Object?> toJson() => {'on': on, 'time': time};
}

const String defaultReminderTime = '20:30';

typedef QuizRecord = ({String at, String result});

/// One child's part of the state.
class ChildSlot {
  const ChildSlot({this.band, this.bandAt, this.bandFor = bandForUnset, this.programmes = const {}, this.quizzes = const {}, this.removed});

  /// Parent's manual age band (null = follow the child's age).
  final String? band;

  /// When the band was chosen (ISO).
  final String? bandAt;

  /// The child's own band when the manual band was chosen: [bandForUnset] (missing, older data), null or a band.
  final Object? bandFor;
  final Map<String, ProgrammeProgress> programmes;
  final Map<String, QuizRecord> quizzes;

  /// Restart tombstones `p:programmeId` (ISO); on the account level also bookmark removals `s:ref`.
  final Map<String, String>? removed;

  ChildSlot copyWith({
    Object? band = _keep,
    Object? bandAt = _keep,
    Object? bandFor = _keep,
    Map<String, ProgrammeProgress>? programmes,
    Map<String, QuizRecord>? quizzes,
    Object? removed = _keep,
  }) =>
      ChildSlot(
        band: identical(band, _keep) ? this.band : band as String?,
        bandAt: identical(bandAt, _keep) ? this.bandAt : bandAt as String?,
        bandFor: identical(bandFor, _keep) ? this.bandFor : bandFor,
        programmes: programmes ?? this.programmes,
        quizzes: quizzes ?? this.quizzes,
        removed: identical(removed, _keep) ? this.removed : removed as Map<String, String>?,
      );

  BandChoice get choice => BandChoice(band: band, bandFor: bandFor);

  Map<String, Object?> slotJson() => {
        'band': band,
        if (bandAt != null) 'bandAt': bandAt,
        if (!identical(bandFor, bandForUnset)) 'bandFor': bandFor,
        'programmes': {for (final e in programmes.entries) e.key: e.value.toJson()},
        'quizzes': {for (final e in quizzes.entries) e.key: {'at': e.value.at, 'result': e.value.result}},
        'removed': ?removed,
      };
}

const Object _keep = Object();

/// The device / server state (`ParentingLocal`, v 1).
class ParentingLocal extends ChildSlot {
  const ParentingLocal({
    super.band,
    super.bandAt,
    super.bandFor,
    super.programmes,
    super.quizzes,
    super.removed,
    this.saved = const [],
    this.savedAt,
    this.rootChild,
    this.rootChildAt,
    this.children,
    this.dirty = false,
    this.reminder,
  });

  /// Bookmarks: `a:articleId` or `s:sosId`, newest first (shared by all children).
  final List<String> saved;
  final Map<String, String>? savedAt;

  /// The child the account-level fields belong to.
  final String? rootChild;
  final String? rootChildAt;

  /// Every other child's state, by child id.
  final Map<String, ChildSlot>? children;

  /// Local changes not yet on the server.
  final bool dirty;

  /// Daily programme reminder on this phone. Never synced.
  final ReminderPref? reminder;

  ParentingLocal copyState({
    Object? band = _keep,
    Object? bandAt = _keep,
    Object? bandFor = _keep,
    Map<String, ProgrammeProgress>? programmes,
    Map<String, QuizRecord>? quizzes,
    Object? removed = _keep,
    List<String>? saved,
    Object? savedAt = _keep,
    Object? rootChild = _keep,
    Object? rootChildAt = _keep,
    Object? children = _keep,
    bool? dirty,
    Object? reminder = _keep,
  }) =>
      ParentingLocal(
        band: identical(band, _keep) ? this.band : band as String?,
        bandAt: identical(bandAt, _keep) ? this.bandAt : bandAt as String?,
        bandFor: identical(bandFor, _keep) ? this.bandFor : bandFor,
        programmes: programmes ?? this.programmes,
        quizzes: quizzes ?? this.quizzes,
        removed: identical(removed, _keep) ? this.removed : removed as Map<String, String>?,
        saved: saved ?? this.saved,
        savedAt: identical(savedAt, _keep) ? this.savedAt : savedAt as Map<String, String>?,
        rootChild: identical(rootChild, _keep) ? this.rootChild : rootChild as String?,
        rootChildAt: identical(rootChildAt, _keep) ? this.rootChildAt : rootChildAt as String?,
        children: identical(children, _keep) ? this.children : children as Map<String, ChildSlot>?,
        dirty: dirty ?? this.dirty,
        reminder: identical(reminder, _keep) ? this.reminder : reminder as ReminderPref?,
      );

  /// The JSON stored on the device (and, without dirty / reminder, on the server).
  Map<String, Object?> toJson() => {
        'v': 1,
        ...slotJson(),
        'saved': saved,
        'savedAt': ?savedAt,
        'rootChild': ?rootChild,
        'rootChildAt': ?rootChildAt,
        if (children != null) 'children': {for (final e in children!.entries) e.key: e.value.slotJson()},
        if (dirty) 'dirty': true,
        if (reminder != null) 'reminder': reminder!.toJson(),
      };
}

ParentingLocal emptyParenting() => const ParentingLocal();
ChildSlot emptySlot() => const ChildSlot();
String storageKey(String? uid) => 'anacan.parenting.v1.${uid == null || uid.isEmpty ? 'guest' : uid}';

const List<String> _bands = ['0-1', '1-3', '3-6', '6-12'];
final RegExp _day = RegExp(r'^\d{4}-\d{2}-\d{2}$');
final RegExp _stamp = RegExp(r'^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$');
final RegExp _ref = RegExp(r'^[as]:[a-z0-9-]{1,60}$');
final RegExp _time = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');

/// Child ids (uuid).
final RegExp childIdPattern = RegExp(r'^[A-Za-z0-9-]{1,64}$');
const int _maxMarks = 300;
const int _maxChildren = 12;
final RegExp _rootRemoved = RegExp(r'^(s:[as]:[a-z0-9-]{1,60}|p:[a-z0-9-]{1,60})$');
final RegExp _slotRemoved = RegExp(r'^p:[a-z0-9-]{1,60}$');

/// Keep the newest [max] entries of a timestamp map.
Map<String, String> capMarks(Map<String, String> marks, [int max = _maxMarks]) {
  if (marks.length <= max) return marks;
  final entries = jsSorted(marks.entries, (MapEntry<String, String> a, MapEntry<String, String> b) => a.value.compareTo(b.value) < 0 ? 1 : -1);
  return {for (final e in entries.take(max)) e.key: e.value};
}

Map<String, String>? _cleanMarks(Object? raw, RegExp key) {
  if (raw is! Map) return null;
  final out = <String, String>{};
  for (final e in raw.entries) {
    final k = '${e.key}';
    final v = e.value;
    if (key.hasMatch(k) && v is String && _stamp.hasMatch(v)) out[k] = v;
  }
  return out.isEmpty ? null : capMarks(out);
}

ChildSlot _sanitizeSlot(Map data, RegExp removedKey) {
  String? band;
  String? bandAt;
  Object? bandFor = bandForUnset;
  if (data['band'] is String && _bands.contains(data['band'])) band = data['band'] as String;
  if (data['bandAt'] is String && _stamp.hasMatch(data['bandAt'] as String)) bandAt = data['bandAt'] as String;
  if (data.containsKey('bandFor') && (data['bandFor'] == null || (data['bandFor'] is String && _bands.contains(data['bandFor'])))) {
    bandFor = data['bandFor'];
  }
  final programmes = <String, ProgrammeProgress>{};
  final rawProgrammes = data['programmes'];
  if (rawProgrammes is Map) {
    for (final e in rawProgrammes.entries) {
      final id = '${e.key}';
      final p = e.value;
      if (!RegExp(r'^[a-z0-9-]{1,60}$').hasMatch(id) || p is! Map || p['startedAt'] is! String || p['done'] is! List) continue;
      programmes[id] = ProgrammeProgress(
        startedAt: p['startedAt'] as String,
        done: [for (final d in p['done'] as List) if (d is String && _day.hasMatch(d)) d].take(60).toList(),
        updatedAt: p['updatedAt'] is String ? p['updatedAt'] as String : p['startedAt'] as String,
        paused: p['paused'] == true ? true : null,
      );
    }
  }
  final quizzes = <String, QuizRecord>{};
  final rawQuizzes = data['quizzes'];
  if (rawQuizzes is Map) {
    for (final e in rawQuizzes.entries) {
      final q = e.value;
      if (q is Map && q['result'] is String && q['at'] is String) quizzes['${e.key}'] = (at: q['at'] as String, result: q['result'] as String);
    }
  }
  return ChildSlot(band: band, bandAt: bandAt, bandFor: bandFor, programmes: programmes, quizzes: quizzes, removed: _cleanMarks(data['removed'], removedKey));
}

/// Sanitise any stored or server state; a bad shape yields an empty state.
ParentingLocal sanitizeParenting(Object? input) {
  if (input is! Map) return emptyParenting();
  final root = _sanitizeSlot(input, _rootRemoved);
  var saved = const <String>[];
  if (input['saved'] is List) {
    final seen = <String>{};
    saved = [for (final x in input['saved'] as List) if (x is String && _ref.hasMatch(x) && seen.add(x)) x].take(200).toList();
  }
  String? rootChild, rootChildAt;
  if (input['rootChild'] is String && childIdPattern.hasMatch(input['rootChild'] as String)) {
    rootChild = input['rootChild'] as String;
    if (input['rootChildAt'] is String && _stamp.hasMatch(input['rootChildAt'] as String)) rootChildAt = input['rootChildAt'] as String;
  }
  Map<String, ChildSlot>? children;
  if (input['children'] is Map) {
    final kids = <String, ChildSlot>{};
    for (final e in (input['children'] as Map).entries.take(_maxChildren)) {
      final id = '${e.key}';
      if (!childIdPattern.hasMatch(id) || id == rootChild || e.value is! Map) continue;
      kids[id] = _sanitizeSlot(e.value as Map, _slotRemoved);
    }
    if (kids.isNotEmpty) children = kids;
  }
  ReminderPref? reminder;
  final r = input['reminder'];
  if (r is Map) reminder = ReminderPref(on: r['on'] == true, time: r['time'] is String && _time.hasMatch(r['time'] as String) ? r['time'] as String : defaultReminderTime);
  return ParentingLocal(
    band: root.band,
    bandAt: root.bandAt,
    bandFor: root.bandFor,
    programmes: root.programmes,
    quizzes: root.quizzes,
    removed: root.removed,
    saved: saved,
    savedAt: _cleanMarks(input['savedAt'], _ref),
    rootChild: rootChild,
    rootChildAt: rootChildAt,
    children: children,
    dirty: input['dirty'] == true,
    reminder: reminder,
  );
}

/// Read and sanitise the stored state; any storage error or bad shape yields an empty state.
ParentingLocal readParenting(LocalStore store, String? uid) {
  try {
    final raw = store.getItem(storageKey(uid));
    return raw != null && raw.isNotEmpty ? sanitizeParenting(jsonDecode(raw)) : emptyParenting();
  } catch (_) {
    return emptyParenting();
  }
}

void writeParenting(LocalStore store, String? uid, ParentingLocal state) {
  try {
    store.setItem(storageKey(uid), jsonEncode(state.toJson()));
  } catch (_) {}
}

// ── Per-child slots ──────────────────────────────────────────────────────────────────────────

/// True when [childId] reads and writes the account-level fields.
bool usesRoot(ParentingLocal s, String? childId) => childId == null || childId.isEmpty || s.rootChild == null || s.rootChild == childId;

/// One child's slot (the account-level fields for the root child).
ChildSlot readSlot(ParentingLocal s, String? childId) {
  if (usesRoot(s, childId)) {
    return ChildSlot(band: s.band, bandAt: s.bandAt, bandFor: s.bandFor, programmes: s.programmes, quizzes: s.quizzes, removed: s.removed);
  }
  return s.children?[childId] ?? emptySlot();
}

/// Change one child's slot; the root child's slot is the account-level fields.
ParentingLocal writeSlot(ParentingLocal s, String? childId, ChildSlot Function(ChildSlot slot) fn) {
  final cur = readSlot(s, childId);
  final next = fn(cur);
  if (identical(next, cur)) return s;
  if (usesRoot(s, childId)) {
    return s.copyState(band: next.band, bandAt: next.bandAt, bandFor: next.bandFor, programmes: next.programmes, quizzes: next.quizzes, removed: next.removed);
  }
  return s.copyState(children: {...?s.children, childId!: next});
}

/// Every slot with its child id (the root slot's id is rootChild, or null before any child claimed it).
List<({String? childId, ChildSlot slot})> allSlots(ParentingLocal s) => [
      (childId: s.rootChild, slot: readSlot(s, null)),
      for (final e in (s.children ?? const <String, ChildSlot>{}).entries) (childId: e.key, slot: e.value),
    ];

/// The band the tool shows for a slot.
String? slotBand(ChildSlot slot, String? childBand) => effectiveBand(slot.choice, childBand);

/// Choose a band for a child (null or the child's own band = follow the child), stamped for the merge.
ChildSlot setSlotBand(ChildSlot slot, String? band, String? childBand, [String? at]) {
  final manual = band != null && band != childBand ? band : null;
  return slot.copyWith(band: manual, bandAt: at ?? jsToIsoString(DomainClock.now()), bandFor: childBand);
}

/// On opening the tool for a child: claim the account-level data for it (first child seen), stamp a legacy manual
/// band with the child's band, and drop a manual band that no longer fits the child. The same object when nothing
/// changes.
ParentingLocal normalizeForChild(ParentingLocal s, String? childId, String? childBand, [String? at]) {
  final stamp = at ?? jsToIsoString(DomainClock.now());
  var out = s;
  if (childId != null && childIdPattern.hasMatch(childId) && s.rootChild == null) out = out.copyState(rootChild: childId, rootChildAt: stamp);
  return writeSlot(out, childId, (slot) {
    if (slot.band == null || slot.band!.isEmpty) return slot;
    if (identical(slot.bandFor, bandForUnset)) return slot.copyWith(bandFor: childBand);
    if (slot.bandFor != childBand) return slot.copyWith(band: null, bandAt: stamp, bandFor: childBand);
    return slot;
  });
}

/// Where a programme runs: the child with its newest change.
String? childForProgramme(ParentingLocal s, String programmeId) {
  ({String? childId, String at})? best;
  for (final x in allSlots(s)) {
    final p = x.slot.programmes[programmeId];
    if (p != null && (best == null || p.updatedAt.compareTo(best.at) > 0)) best = (childId: x.childId, at: p.updatedAt);
  }
  return best?.childId;
}

/// Toggle a bookmark in the full state, stamping the add / remove time for the sync merge.
ParentingLocal toggleSavedState(ParentingLocal s, String ref, [String? at]) {
  final stamp = at ?? jsToIsoString(DomainClock.now());
  final saved = toggleSaved(s.saved, ref);
  final adding = saved.contains(ref);
  final savedAt = {...?s.savedAt};
  final removed = {...?s.removed};
  if (adding) {
    savedAt[ref] = stamp;
    removed.remove('s:$ref');
  } else {
    savedAt.remove(ref);
    removed['s:$ref'] = stamp;
  }
  return s.copyState(saved: saved, savedAt: savedAt, removed: capMarks(removed));
}

/// Choose a band on the account level (null = follow the child), stamped for the merge.
ParentingLocal setBandState(ParentingLocal s, String? band, [String? at]) => s.copyState(band: band, bandAt: at ?? jsToIsoString(DomainClock.now()));

/// Write one programme's progress (null = restart / remove), stamped for the merge; a removal leaves a tombstone.
ChildSlot setProgrammeState(ChildSlot s, String id, ProgrammeProgress? p, [String? at]) {
  final stamp = at ?? jsToIsoString(DomainClock.now());
  final programmes = {...s.programmes};
  final removed = {...?s.removed};
  if (p != null) {
    programmes[id] = ProgrammeProgress(startedAt: p.startedAt, done: p.done, updatedAt: stamp, paused: p.paused);
    removed.remove('p:$id');
  } else {
    programmes.remove(id);
    removed['p:$id'] = stamp;
  }
  final out = s.copyWith(programmes: programmes, removed: capMarks(removed));
  return s is ParentingLocal ? s.copyState(programmes: out.programmes, removed: out.removed) : out;
}

/// Whether the parent has used the tool at all on this account (first-run intro only for new users).
bool hasParentingActivity(ParentingLocal s) {
  if (s.saved.isNotEmpty) return true;
  return allSlots(s).any((x) => (x.slot.band != null && x.slot.band!.isNotEmpty) || x.slot.programmes.isNotEmpty || x.slot.quizzes.isNotEmpty);
}
