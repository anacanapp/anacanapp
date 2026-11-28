// Ported from: src/lib/parenting-sync.test.ts
import 'dart:convert';

import 'package:anacan/domain/parenting/parenting.dart' show ProgrammeProgress;
import 'package:anacan/features/tools/parenting/parenting_store.dart';
import 'package:anacan/features/tools/parenting/parenting_sync.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

const String t1 = '2026-11-07T08:00:00.000Z';
const String t2 = '2026-11-07T09:00:00.000Z';
const String t3 = '2026-11-07T10:00:00.000Z';
ProgrammeProgress prog(List<String> done, String updatedAt, {bool? paused, String startedAt = '2026-11-01'}) =>
    ProgrammeProgress(startedAt: startedAt, done: done, updatedAt: updatedAt, paused: paused);
ParentingLocal withProgrammes(Map<String, ProgrammeProgress> p) => emptyParenting().copyState(programmes: p);
ParentingLocal setProg(ParentingLocal s, String id, ProgrammeProgress? p, String at) => writeSlot(s, null, (slot) => setProgrammeState(slot, id, p, at));
Object? j(Object? v) => jsonDecode(jsonEncode(v));

void main() {
  late FakeParentingRemote db;
  setUp(() => db = FakeParentingRemote());

  group('Tərbiyə state merge', () {
    test('keeps the union of bookmarks, newest first', () {
      final a = toggleSavedState(toggleSavedState(emptyParenting(), 'a:lying', t1), 's:nightmare', t3);
      final b = toggleSavedState(emptyParenting(), 'a:fears', t2);
      final m = mergeParenting(a, b);
      expect(m.saved, ['s:nightmare', 'a:fears', 'a:lying']);
      expect(mergeParenting(b, a).saved, m.saved);
    });

    test('a removal on one phone wins over the older add on the other; a newer re-add wins over the removal', () {
      final added = toggleSavedState(emptyParenting(), 'a:lying', t1);
      final removed = toggleSavedState(added, 'a:lying', t2);
      expect(removed.saved, isEmpty);
      expect(mergeParenting(added, removed).saved, isEmpty);
      expect(mergeParenting(removed, added).saved, isEmpty);
      final readded = toggleSavedState(removed, 'a:lying', t3);
      expect(mergeParenting(readded, removed).saved, ['a:lying']);
      expect(mergeParenting(removed, readded).saved, ['a:lying']);
    });

    test('same run: the newest change wins, so an undo on one phone sticks; other runs keep max progress', () {
      final a = withProgrammes({'sleep-7': prog(['2026-11-01', '2026-11-02'], t1)});
      final b = withProgrammes({'sleep-7': prog(['2026-11-01'], t3), 'tantrums-14': prog([], t2)});
      final m = mergeParenting(a, b);
      expect(m.programmes['sleep-7']!.done, hasLength(1));
      expect(mergeParenting(b, a).programmes['sleep-7']!.done, hasLength(1));
      final other = withProgrammes({'sleep-7': prog(['2026-11-05'], t3, startedAt: '2026-11-05')});
      expect(mergeParenting(a, other).programmes['sleep-7']!.done, hasLength(2));
      expect(m.programmes.keys.toList()..sort(), ['sleep-7', 'tantrums-14']);
      final paused = withProgrammes({'sleep-7': prog(['2026-11-01', '2026-11-02'], t3, paused: true)});
      expect(mergeParenting(a, paused).programmes['sleep-7']!.paused, true);
    });

    test('undo checked off on the server copy is not brought back by the next sync (regression)', () {
      final three = withProgrammes({'sleep-7': prog(['2026-11-01', '2026-11-02', '2026-11-03'], t1)});
      final undone = setProg(three, 'sleep-7', prog(['2026-11-01', '2026-11-02'], t1), t2);
      expect(mergeParenting(undone, three).programmes['sleep-7']!.done, hasLength(2));
      expect(mergeParenting(three, undone).programmes['sleep-7']!.done, hasLength(2));
    });

    test('a restart (tombstone) removes older progress from the other phone but not a newer start', () {
      final old = withProgrammes({'sleep-7': prog(['2026-11-01'], t1)});
      final restarted = setProg(old, 'sleep-7', null, t2);
      expect(mergeParenting(old, restarted).programmes['sleep-7'], isNull);
      final again = setProg(restarted, 'sleep-7', prog([], t3), t3);
      expect(mergeParenting(again, old).programmes['sleep-7']!.done, isEmpty);
      expect(mergeParenting(again, restarted).programmes['sleep-7'], isNotNull);
    });

    test('keeps the newest band choice and quiz result; the reminder preference stays on the phone', () {
      final a = setBandState(emptyParenting(), '3-6', t1)
          .copyState(quizzes: {'style': (at: '2026-11-05', result: 'gentle')}, reminder: const ReminderPref(on: true, time: '21:00'));
      final b = setBandState(emptyParenting(), '6-12', t2).copyState(quizzes: {
        'style': (at: '2026-11-06', result: 'balanced'),
        'milestones': (at: '2026-11-01', result: 'ontrack'),
      });
      final m = mergeParenting(a, b);
      expect(m.band, '6-12');
      expect(m.quizzes, {'style': (at: '2026-11-06', result: 'balanced'), 'milestones': (at: '2026-11-01', result: 'ontrack')});
      expect(m.reminder?.on, true);
      expect(m.reminder?.time, '21:00');
      expect(toServerState(m.copyState(dirty: true)).containsKey('reminder'), false);
      expect(toServerState(m.copyState(dirty: true)).containsKey('dirty'), false);
    });

    test('sanitises server data like device data', () {
      final s = sanitizeParenting({
        'band': 'x',
        'saved': ['a:ok', 'bad ref', 7],
        'savedAt': {'a:ok': t1, 'nope': t1},
        'removed': {'p:sleep-7': t2, 'x:y': t2},
        'programmes': {'Bad Id': prog([], t1).toJson()},
      });
      expect(j(s.toJson()), {'v': 1, 'band': null, 'programmes': {}, 'quizzes': {}, 'saved': ['a:ok'], 'savedAt': {'a:ok': t1}, 'removed': {'p:sleep-7': t2}});
    });
  });

  group('Tərbiyə account sync', () {
    setUp(() => db.fail = false);

    test('does not create a server row for a parent who never used the tool', () async {
      final res = await syncParenting(db, 'u1', emptyParenting());
      expect(res.ok, true);
      expect(db.upserts, isEmpty);
    });

    test('pushes local changes, then merges another phone’s row on the next sync', () async {
      final local = toggleSavedState(emptyParenting(), 'a:lying', t1).copyState(dirty: true);
      final first = await syncParenting(db, 'u1', local);
      expect(first.ok, true);
      expect(first.state.dirty, false);
      expect(db.upserts, hasLength(1));
      expect((db.upserts[0]['state']! as Map)['saved'], ['a:lying']);

      db.row = {
        'state': {
          ...toServerState(first.state),
          'saved': ['s:nightmare', 'a:lying'],
          'savedAt': {'s:nightmare': t2, 'a:lying': t1},
        },
        'updated_at': 'x',
      };
      final second = await syncParenting(db, 'u1', first.state);
      expect(second.state.saved, ['s:nightmare', 'a:lying']);
      expect(db.upserts, hasLength(1)); // the merge equals the server copy: nothing to push
    });

    test('keeps the local state (still dirty) when offline', () async {
      db.fail = true;
      final local = setBandState(emptyParenting(), '0-1', t1).copyState(dirty: true);
      final res = await syncParenting(db, 'u1', local);
      expect(identical(res.state, local), true);
      expect(res.ok, false);
    });
  });
}
