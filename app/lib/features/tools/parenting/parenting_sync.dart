// Ported from: src/lib/parenting-sync.ts
//
// Tərbiyə account sync: the device copy stays the source the UI reads — optimistic and offline — and is merged with
// public.parenting_state (one row per account, RLS own row only) in the background.
//
// Merge rules (commutative, so two phones converge), applied to the account-level slot and to every child slot:
//  - band: the newest choice (bandAt), with the child band it was chosen for (bandFor);
//  - programmes: per programme the newest change of the same run (so an undo sticks); runs started on different days
//    keep the copy with more checked-off days, on a tie the newer change; a restart tombstone newer than the
//    progress removes it;
//  - quizzes: per quiz the newest result;
//  - bookmarks (account level): union, minus refs whose removal is newer than their add; newest first;
//  - rootChild: the earliest claim;
//  - children: union of child ids, each slot merged by the rules above;
//  - the reminder preference never leaves the phone.
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../domain/js_compat.dart';
import '../../../domain/parenting/parenting.dart' show ProgrammeProgress;
import 'parenting_store.dart';

bool _newer(String? a, String? b) => (a ?? '').compareTo(b ?? '') >= 0;

Map<String, String> _maxMarks(Map<String, String>? a, Map<String, String>? b) {
  final out = {...?a};
  for (final e in (b ?? const <String, String>{}).entries) {
    if (out[e.key] == null || e.value.compareTo(out[e.key]!) > 0) out[e.key] = e.value;
  }
  return capMarks(out);
}

ProgrammeProgress? _betterProgress(ProgrammeProgress? a, ProgrammeProgress? b) {
  if (a == null) return b;
  if (b == null) return a;
  // Same run (same start day): the newest change wins, so an undo on one phone is not reverted by the other copy.
  if (a.startedAt == b.startedAt && a.updatedAt != b.updatedAt) return _newer(a.updatedAt, b.updatedAt) ? a : b;
  if (a.done.length != b.done.length) return a.done.length > b.done.length ? a : b;
  return _newer(a.updatedAt, b.updatedAt) ? a : b;
}

/// Merge one slot (local first: ties keep the local copy). [removed] is the already merged tombstone map.
ChildSlot _mergeSlot(ChildSlot local, ChildSlot remote, Map<String, String> removed) {
  final programmes = <String, ProgrammeProgress>{};
  for (final id in {...local.programmes.keys, ...remote.programmes.keys}) {
    final pick = _betterProgress(local.programmes[id], remote.programmes[id]);
    final gone = removed['p:$id'];
    if (pick != null && !(gone != null && gone.compareTo(pick.updatedAt) > 0)) programmes[id] = pick;
  }
  final quizzes = {...remote.quizzes};
  for (final e in local.quizzes.entries) {
    if (quizzes[e.key] == null || _newer(e.value.at, quizzes[e.key]!.at)) quizzes[e.key] = e.value;
  }
  final bandSide = _newer(local.bandAt, remote.bandAt) ? local : remote;
  return ChildSlot(band: bandSide.band, bandAt: bandSide.bandAt, bandFor: bandSide.bandFor, programmes: programmes, quizzes: quizzes);
}

({String? rootChild, String? rootChildAt}) _pickRoot(ParentingLocal a, ParentingLocal b) {
  if (a.rootChild == null) return b.rootChild != null ? (rootChild: b.rootChild, rootChildAt: b.rootChildAt) : (rootChild: null, rootChildAt: null);
  if (b.rootChild == null) return (rootChild: a.rootChild, rootChildAt: a.rootChildAt);
  final ka = '${a.rootChildAt ?? '~'}|${a.rootChild}';
  final kb = '${b.rootChildAt ?? '~'}|${b.rootChild}';
  return ka.compareTo(kb) <= 0 ? (rootChild: a.rootChild, rootChildAt: a.rootChildAt) : (rootChild: b.rootChild, rootChildAt: b.rootChildAt);
}

Map<String, String> _pick(Map<String, String>? m, String prefix) => {for (final e in (m ?? const <String, String>{}).entries) if (e.key.startsWith(prefix)) e.key: e.value};

/// One side's slots seen from the merged root owner: the root slot and every other child's slot.
({ChildSlot root, Map<String, ChildSlot> children}) _rebase(ParentingLocal side, String? owner) {
  final rootSlot = ChildSlot(band: side.band, bandAt: side.bandAt, bandFor: side.bandFor, programmes: side.programmes, quizzes: side.quizzes, removed: _pick(side.removed, 'p:'));
  final children = {...?side.children};
  if (owner == null || side.rootChild == null || side.rootChild == owner) {
    // No claim on this side yet: its account-level data is the owner's.
    if (owner != null) children.remove(owner);
    return (root: rootSlot, children: children);
  }
  // This side's account-level data belonged to another child, which lost the claim: it moves to that child.
  children[side.rootChild!] = rootSlot;
  final root = children[owner] ?? emptySlot();
  children.remove(owner);
  return (root: root, children: children);
}

ChildSlot _mergeSlots(ChildSlot? a, ChildSlot? b) {
  final gone = _maxMarks(a?.removed, b?.removed);
  final x = a ?? b!;
  final slot = _mergeSlot(x, b ?? x, gone);
  return gone.isNotEmpty ? slot.copyWith(removed: gone) : slot;
}

/// Merge two states (local first: ties keep the local copy; the local reminder preference is kept).
ParentingLocal mergeParenting(ParentingLocal local, ParentingLocal remote) {
  final owner = _pickRoot(local, remote);
  final l = _rebase(local, owner.rootChild);
  final r = _rebase(remote, owner.rootChild);
  final root = _mergeSlots(l.root, r.root);
  final bookmarkGone = _maxMarks(_pick(local.removed, 's:'), _pick(remote.removed, 's:'));
  final savedAt = _maxMarks(local.savedAt, remote.savedAt);

  final order = [...local.saved, ...remote.saved.where((x) => !local.saved.contains(x))];
  final kept = [
    for (var i = 0; i < order.length; i++)
      if (bookmarkGone['s:${order[i]}'] == null || (savedAt[order[i]] ?? '').compareTo(bookmarkGone['s:${order[i]}']!) > 0) (ref: order[i], i: i, at: savedAt[order[i]] ?? ''),
  ];
  final saved = jsSorted(kept, (({String ref, int i, String at}) x, ({String ref, int i, String at}) y) => x.at == y.at ? x.i - y.i : x.at.compareTo(y.at) < 0 ? 1 : -1)
      .map((x) => x.ref)
      .take(200)
      .toList();
  final keptAt = {for (final e in savedAt.entries) if (saved.contains(e.key)) e.key: e.value};
  final removed = capMarks({...bookmarkGone, ...?root.removed});

  final children = <String, ChildSlot>{};
  for (final id in {...l.children.keys, ...r.children.keys}) {
    children[id] = _mergeSlots(l.children[id], r.children[id]);
  }
  return ParentingLocal(
    band: root.band,
    bandAt: root.bandAt,
    bandFor: root.bandFor,
    programmes: root.programmes,
    quizzes: root.quizzes,
    removed: removed.isNotEmpty ? removed : null,
    saved: saved,
    savedAt: keptAt.isNotEmpty ? keptAt : null,
    rootChild: owner.rootChild,
    rootChildAt: owner.rootChild != null ? owner.rootChildAt : null,
    children: children.isNotEmpty ? children : null,
    reminder: local.reminder,
    dirty: local.dirty,
  );
}

/// What goes to the server: everything except device-only fields.
Map<String, Object?> toServerState(ParentingLocal s) => s.copyState(dirty: false, reminder: null).toJson();

/// JSON with sorted object keys (arrays keep their order), so equal states compare equal.
String _canonical(Object? v) {
  if (v is List) return '[${v.map(_canonical).join(',')}]';
  if (v is Map) {
    final keys = v.keys.map((k) => '$k').toList()..sort();
    return '{${keys.map((k) => '${jsonEncode(k)}:${_canonical(v[k])}').join(',')}}';
  }
  return jsonEncode(v);
}

bool sameServerState(ParentingLocal a, ParentingLocal b) => _canonical(toServerState(a)) == _canonical(toServerState(b));

/// `parenting_state` access (errors are thrown).
abstract interface class ParentingRemote {
  /// `select('state, updated_at').eq('user_id').maybeSingle()` → the state JSON or null.
  Future<Object?> fetchState(String uid, {required void Function() found});

  /// `upsert({ user_id, state, updated_at }, { onConflict: 'user_id' })`.
  Future<void> upsert(String uid, Map<String, Object?> state, String updatedAt);
}

class SupabaseParentingRemote implements ParentingRemote {
  SupabaseParentingRemote(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<Object?> fetchState(String uid, {required void Function() found}) async {
    final row = await _client().from('parenting_state').select('state, updated_at').eq('user_id', uid).maybeSingle();
    if (row == null) return null;
    found();
    return row['state'];
  }

  @override
  Future<void> upsert(String uid, Map<String, Object?> state, String updatedAt) =>
      _client().from('parenting_state').upsert({'user_id': uid, 'state': state, 'updated_at': updatedAt}, onConflict: 'user_id');
}

final parentingRemoteProvider =
    Provider<ParentingRemote>((ref) => SupabaseParentingRemote(() => ref.read(supabaseClientProvider)), name: 'parentingRemoteProvider');

Future<ParentingLocal?> fetchRemoteParenting(ParentingRemote db, String uid) async {
  var found = false;
  final state = await db.fetchState(uid, found: () => found = true);
  return found ? sanitizeParenting(state) : null;
}

Future<void> pushRemoteParenting(ParentingRemote db, String uid, ParentingLocal s) => db.upsert(uid, toServerState(s), jsToIsoString(DomainClock.now()));

/// Fetch → merge → push when the server copy differs. Never throws: on failure the local state comes back unchanged
/// (still dirty) with ok = false, and the next attempt retries.
Future<({ParentingLocal state, bool ok})> syncParenting(ParentingRemote db, String uid, ParentingLocal local) async {
  try {
    final remote = await fetchRemoteParenting(db, uid);
    final merged = remote != null ? mergeParenting(local, remote) : local;
    final untouched = remote == null && !local.dirty && sameServerState(local, emptyParenting());
    if (!untouched && (remote == null || !sameServerState(merged, remote))) await pushRemoteParenting(db, uid, merged);
    return (state: merged.copyState(dirty: false), ok: true);
  } catch (_) {
    return (state: local, ok: false);
  }
}
