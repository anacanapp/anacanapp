// Ported from: src/lib/parenting-children.test.ts, src/lib/parenting.test.ts ('round-trips and sanitises stored state
// per account'; the other cases of that suite are in test/domain/parenting/parenting_test.dart)
import 'dart:convert';

import 'package:anacan/domain/parenting/parenting.dart' as d;
import 'package:anacan/domain/parenting/parenting.dart' show BandChoice, ProgrammeProgress;
import 'package:anacan/features/tools/parenting/parenting_content.dart';
import 'package:anacan/features/tools/parenting/parenting_reminders.dart';
import 'package:anacan/features/tools/parenting/parenting_store.dart';
import 'package:anacan/features/tools/parenting/parenting_sync.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/programme_harness.dart';

const String t1 = '2026-11-07T08:00:00.000Z';
const String t2 = '2026-11-07T09:00:00.000Z';
const String t3 = '2026-11-07T10:00:00.000Z';
ProgrammeProgress prog(List<String> done, String updatedAt, [String startedAt = '2026-11-01']) =>
    ProgrammeProgress(startedAt: startedAt, done: done, updatedAt: updatedAt);
final DateTime now = DateTime(2026, 11, 7, 10);

/// Data written by the app before multi-child support: one band, one result per quiz, one progress per programme.
ParentingLocal legacy() => ParentingLocal(
      band: '3-6',
      bandAt: t1,
      programmes: {'sleep-7': prog(['2026-11-01'], t1)},
      quizzes: {'style': (at: '2026-11-01', result: 'gentle')},
    );

Map<String, Object?> j(ChildSlot s) => jsonDecode(jsonEncode(s is ParentingLocal ? s.toJson() : s.slotJson())) as Map<String, Object?>;

ChildSlot withQuiz(ChildSlot slot, String result, String at) => slot.copyWith(quizzes: {'style': (at: at, result: result)});

final ParentingContent az = contentOf('az');

void main() {
  group('device store', () {
    test('round-trips and sanitises stored state per account', () {
      final store = LocalStore.memory();
      final s = ParentingLocal(band: '3-6', saved: const ['a:praise'], programmes: {'x': prog(['2026-11-01'], '2026-11-01')});
      writeParenting(store, 'u1', s);
      expect(j(readParenting(store, 'u1')), j(s));
      expect(j(readParenting(store, 'u2')), j(emptyParenting()));
      store.setItem(storageKey('u3'), jsonEncode({'band': 'x', 'saved': ['bad', 'a:ok', 'a:ok'], 'programmes': {'y': {'done': 'no'}}}));
      expect(j(readParenting(store, 'u3')), j(const ParentingLocal(saved: ['a:ok'])));
      store.setItem(storageKey('u4'), '{broken');
      expect(j(readParenting(store, 'u4')), j(emptyParenting()));
    });
  });

  group('Tərbiyə per child: slots and migration of account-level data', () {
    test('existing account-level data becomes the first opened child’s data; a sibling starts empty', () {
      final s = normalizeForChild(legacy(), 'kid-a', '1-3', t2);
      expect(s.rootChild, 'kid-a');
      expect(s.rootChildAt, t2);
      expect(readSlot(s, 'kid-a').programmes['sleep-7']!.done, ['2026-11-01']);
      expect(readSlot(s, 'kid-a').quizzes['style']!.result, 'gentle');
      expect(j(readSlot(s, 'kid-b')), j(emptySlot()));
      // Old app versions keep reading the same account-level fields.
      expect(s.programmes['sleep-7'], isNotNull);
      expect(s.quizzes['style'], isNotNull);
    });

    test('before any child claims it, every child (and "no child") reads the account-level data', () {
      final s = legacy();
      expect(usesRoot(s, 'kid-a'), true);
      expect(usesRoot(s, null), true);
      expect(readSlot(s, 'kid-z').quizzes['style']!.result, 'gentle');
    });

    test('writes a sibling’s progress into children without touching the root child', () {
      var s = normalizeForChild(legacy(), 'kid-a', '1-3', t2);
      s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'tantrums-14', prog([], t3, '2026-11-07'), t3));
      s = writeSlot(s, 'kid-b', (slot) => withQuiz(slot, 'balanced', '2026-11-07'));
      expect(s.children?['kid-b']!.programmes['tantrums-14'], isNotNull);
      expect(s.children?['kid-b']!.quizzes['style']!.result, 'balanced');
      expect(s.programmes['tantrums-14'], isNull);
      expect(s.quizzes['style']!.result, 'gentle');
      expect(allSlots(s).map((x) => x.childId).toList(), ['kid-a', 'kid-b']);
      expect(childForProgramme(s, 'tantrums-14'), 'kid-b');
      expect(childForProgramme(s, 'sleep-7'), 'kid-a');
    });

    test('a restart in a child slot leaves a tombstone there and keeps root bookmark tombstones', () {
      var s = toggleSavedState(toggleSavedState(emptyParenting(), 'a:lying', t1), 'a:lying', t2);
      s = writeSlot(s, null, (slot) => setProgrammeState(slot, 'sleep-7', null, t3));
      expect(s.removed, {'s:a:lying': t2, 'p:sleep-7': t3});
      s = normalizeForChild(s, 'kid-a', null, t3);
      s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', null, t3));
      expect(s.children?['kid-b']!.removed, {'p:sleep-7': t3});
    });

    test('sanitises children (bad ids, the root child duplicated, bad tombstones) and keeps them on the server copy', () {
      final s = sanitizeParenting({
        ...legacy().toJson(),
        'rootChild': 'kid-a',
        'rootChildAt': t1,
        'children': {
          'kid-b': {'band': '0-1', 'bandAt': t2, 'bandFor': null, 'programmes': {'sleep-7': prog([], t2).toJson()}, 'quizzes': {}, 'removed': {'p:x': t2, 's:a:y': t2}},
          'kid-a': {'band': '6-12', 'programmes': {}, 'quizzes': {}},
          'bad id!': {'band': '0-1', 'programmes': {}, 'quizzes': {}},
        },
      });
      expect(s.children!.keys.toList(), ['kid-b']);
      final kidB = j(s.children!['kid-b']!);
      expect(kidB['band'], '0-1');
      expect(kidB.containsKey('bandFor'), true);
      expect(kidB['bandFor'], isNull);
      expect(kidB['removed'], {'p:x': t2});
      final server = toServerState(s.copyState(dirty: true, reminder: const ReminderPref(on: true, time: '20:30')));
      expect(server['rootChild'], 'kid-a');
      expect(((server['children'] as Map)['kid-b'] as Map)['band'], '0-1');
    });

    test('has activity only once the parent used the tool (first-run intro)', () {
      expect(hasParentingActivity(emptyParenting()), false);
      expect(hasParentingActivity(legacy()), true);
      expect(hasParentingActivity(toggleSavedState(emptyParenting(), 'a:lying', t1)), true);
      expect(
          hasParentingActivity(ParentingLocal(rootChild: 'a', children: {
            'b': const ChildSlot(quizzes: {'style': (at: 'x', result: 'y')}),
          })),
          true);
    });
  });

  group('Tərbiyə manual band expiry', () {
    test('a manual band applies while the child is in the band it was chosen for, then the child band takes over', () {
      final slot = setSlotBand(emptySlot(), '6-12', '1-3', t1);
      expect(slot.band, '6-12');
      expect(slot.bandFor, '1-3');
      expect(slot.bandAt, t1);
      expect(slotBand(slot, '1-3'), '6-12');
      expect(slotBand(slot, '3-6'), '3-6'); // birthday: the child moved on
      expect(slotBand(setSlotBand(emptySlot(), '1-3', '1-3', t1), '1-3'), '1-3');
      expect(setSlotBand(emptySlot(), '1-3', '1-3', t1).band, isNull); // own band = follow the child
    });

    test('a band chosen without a birth date expires once the birth date is known', () {
      final slot = setSlotBand(emptySlot(), '0-1', null, t1);
      expect(slotBand(slot, null), '0-1');
      expect(slotBand(slot, '1-3'), '1-3');
    });

    test('normalising stamps a legacy band with the child band and later drops it when the child moves on', () {
      var s = normalizeForChild(legacy(), 'kid-a', '1-3', t2);
      expect(s.bandFor, '1-3');
      expect(s.band, '3-6');
      expect(identical(normalizeForChild(s, 'kid-a', '1-3', t3), s), true); // nothing to change: same object, no write
      s = normalizeForChild(s, 'kid-a', '3-6', t3);
      expect(s.band, isNull);
      expect(s.bandAt, t3);
      expect(s.bandFor, '3-6');
      // A legacy band without bandFor still applies until stamped.
      expect(d.effectiveBand(const BandChoice(band: '6-12'), '0-1'), '6-12');
    });

    test('the home tip follows the child’s slot band (expired manual band → the child’s band)', () {
      String? tip(ChildSlot slot) => d.homeTipFor<Tip>(az.tips, birthDate: '2024-07-07', slot: slot.choice, now: now)?.band;
      expect(tip(setSlotBand(emptySlot(), '6-12', '1-3', t1)), '6-12');
      expect(tip(setSlotBand(emptySlot(), '6-12', '0-1', t1)), '1-3');
      expect(tip(emptySlot()), '1-3');
    });
  });

  group('Tərbiyə children: visibility and selection', () {
    bool tile({String? birthDate, List<String?>? birthDates}) =>
        d.isParentingTileVisible(lifeStage: 'mommy', language: 'az', setting: 'on', birthDate: birthDate, birthDates: birthDates, now: now);
    const kids = [('old', 'Ali', '2010-01-01'), ('young', 'Aysel', '2024-07-07'), ('mid', 'Nur', '2020-03-01')];
    String? pick(List<(String, String, String)> list, {String? picked, String? preferred}) =>
        d.pickParentingChild(list, idOf: (k) => k.$1, birthDateOf: (k) => k.$3, picked: picked, preferred: preferred, now: now)?.$1;

    test('stays visible while a younger sibling exists although the selected child is 13+', () {
      expect(tile(birthDate: '2010-01-01'), false);
      expect(tile(birthDate: '2010-01-01', birthDates: [for (final k in kids) k.$3]), true);
      expect(tile(birthDates: ['2010-01-01', '2011-05-05']), false);
      expect(tile(birthDates: ['2010-01-01', null]), true);
      expect(tile(birthDates: [], birthDate: '2024-07-07'), true);
    });

    test('picks the switched child, else the preferred one when under 13, else the first younger sibling', () {
      expect(pick(kids, preferred: 'old'), 'young');
      expect(pick(kids, preferred: 'mid'), 'mid');
      expect(pick(kids, picked: 'mid', preferred: 'young'), 'mid');
      expect(pick(kids, picked: 'old'), 'young');
      expect(pick([kids[0]]), isNull);
    });

    test('reminders and "Continue" follow the newest running programme over every child', () {
      var s = normalizeForChild(legacy().copyState(reminder: const ReminderPref(on: true, time: '20:30')), 'kid-a', '3-6', t1);
      s = writeSlot(s, 'kid-b', (slot) => setProgrammeState(slot, 'tantrums-14', prog(['2026-11-06'], t3, '2026-11-06'), t3));
      var a = activeProgramme(s, az.programmes)!;
      expect(a.programme.id, 'tantrums-14');
      expect(a.childId, 'kid-b');
      s = writeSlot(s, 'kid-b', (slot) {
        final p = slot.programmes['tantrums-14']!;
        return slot.copyWith(programmes: {'tantrums-14': ProgrammeProgress(startedAt: p.startedAt, done: p.done, updatedAt: p.updatedAt, paused: true)});
      });
      a = activeProgramme(s, az.programmes)!;
      expect(a.programme.id, 'sleep-7');
      expect(a.childId, 'kid-a');
    });
  });

  group('Tərbiyə merge per child', () {
    ParentingLocal claimed(String child, String at) => normalizeForChild(legacy(), child, '3-6', at);

    test('merges each child slot by the usual rules and keeps the union of children', () {
      final a = writeSlot(claimed('kid-a', t1), 'kid-b', (slot) => withQuiz(slot, 'gentle', '2026-11-05'));
      final b = writeSlot(claimed('kid-a', t1), 'kid-b', (slot) => withQuiz(slot, 'balanced', '2026-11-06'));
      final c = writeSlot(claimed('kid-a', t1), 'kid-c', (slot) => setSlotBand(slot, '0-1', '1-3', t2));
      final m = mergeParenting(mergeParenting(a, b), c);
      expect(m.children?['kid-b']!.quizzes['style']!.result, 'balanced');
      expect(m.children?['kid-c']!.band, '0-1');
      expect(m.children?['kid-c']!.bandFor, '1-3');
      final other = mergeParenting(c, mergeParenting(b, a));
      expect({for (final e in other.children!.entries) e.key: j(e.value)}, {for (final e in m.children!.entries) e.key: j(e.value)});
    });

    test('a child slot tombstone removes older progress from the other phone', () {
      final run = writeSlot(claimed('kid-a', t1), 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', prog(['2026-11-01'], t1), t1));
      final restarted = writeSlot(run, 'kid-b', (slot) => setProgrammeState(slot, 'sleep-7', null, t2));
      expect(mergeParenting(run, restarted).children?['kid-b']!.programmes['sleep-7'], isNull);
      expect(mergeParenting(restarted, run).children?['kid-b']!.programmes['sleep-7'], isNull);
    });

    test('an old app version (no children in its copy) does not drop the children; its root changes still merge', () {
      final fresh = writeSlot(claimed('kid-a', t1), 'kid-b', (slot) => setSlotBand(slot, '0-1', '1-3', t2));
      final oldClient = legacy().copyState(band: '6-12', bandAt: t3); // old build: no rootChild / children / bandFor
      final m = mergeParenting(fresh, oldClient);
      expect(m.rootChild, 'kid-a');
      expect(m.children?['kid-b']!.band, '0-1');
      expect(m.band, '6-12');
      expect(identical(m.bandFor, bandForUnset), true); // picked from the old copy: stamped again on the next open
      expect(j(mergeParenting(oldClient, fresh)), j(m));
    });

    test('two phones that claimed different children converge: the earliest claim keeps the account level, the other moves to its child', () {
      final a = writeSlot(claimed('kid-a', t1), null, (slot) => withQuiz(slot, 'gentle', '2026-11-05'));
      final b0 = normalizeForChild(const ParentingLocal(quizzes: {'style': (at: '2026-11-06', result: 'strict')}), 'kid-b', '1-3', t2);
      final m1 = mergeParenting(a, b0);
      final m2 = mergeParenting(b0, a);
      expect(m1.rootChild, 'kid-a');
      expect(m2.rootChild, 'kid-a');
      expect(m1.quizzes['style']!.result, 'gentle');
      expect(m1.children?['kid-b']!.quizzes['style']!.result, 'strict');
      expect(m2.children?['kid-b']!.quizzes['style']!.result, 'strict');
      expect(m2.quizzes['style']!.result, 'gentle');
    });

    test('keeps the root child’s band stamp (bandFor) with the newest band', () {
      final a = claimed('kid-a', t1);
      final b = writeSlot(a, 'kid-a', (slot) => setSlotBand(slot, '0-1', '3-6', t3));
      final m = mergeParenting(a, b);
      expect(m.band, '0-1');
      expect(m.bandFor, '3-6');
      expect(m.bandAt, t3);
    });
  });

  group('Tərbiyə quiz navigation and programme completion', () {
    test('goes back one question keeping every answer; answering again overwrites only that one', () {
      var nav = d.startQuiz<int>();
      nav = d.quizAnswer(nav, 3, 3);
      nav = d.quizAnswer(nav, 1, 3);
      expect([nav.pos, nav.answers], [2, [3, 1]]);
      nav = d.quizBack(nav);
      expect([nav.pos, nav.answers], [1, [3, 1]]);
      nav = d.quizBack(d.quizBack(nav));
      expect(nav.pos, 0);
      nav = d.quizAnswer(nav, 0, 3);
      expect([nav.pos, nav.answers], [1, [0, 1]]);
      expect(d.quizDone(nav, 3), false);
      nav = d.quizAnswer(d.quizAnswer(nav, 2, 3), 2, 3);
      expect([nav.pos, nav.answers], [3, [0, 2, 2]]);
      expect(d.quizDone(nav, 3), true);
      expect(identical(d.quizAnswer(nav, 1, 3), nav), true); // done: nothing more to answer
      expect(d.quizDone(d.quizBack(nav), 3), false);
    });

    test('summarises a finished programme: days and first / last day', () {
      final done = [for (var i = 0; i < 7; i++) '2026-11-0${i + 1}'];
      expect(d.programmeSummary(prog(done, t1), 7), (days: 7, from: '2026-11-01', to: '2026-11-07'));
      expect(d.programmeSummary(prog(done.sublist(0, 6), t1), 7), isNull);
      expect(d.programmeSummary(null, 7), isNull);
    });

    test('suggests another programme for the band: not started first, then running, then other bands; never a finished one', () {
      const list = [('a', ['1-3']), ('b', ['1-3']), ('c', ['6-12']), ('d', ['1-3'])];
      final finished = prog(['2026-11-01', '2026-11-02'], t1);
      String? next(Map<String, ProgrammeProgress> progress) =>
          d.suggestNextProgramme(list, progress, '1-3', 'a', idOf: (p) => p.$1, bandsOf: (p) => p.$2, daysOf: (_) => 2)?.$1;
      expect(next({'a': finished}), 'b');
      expect(next({'a': finished, 'b': prog(['2026-11-01'], t1)}), 'd');
      expect(next({'a': finished, 'b': finished, 'd': finished}), 'c');
      expect(next({'a': finished, 'b': finished, 'c': finished, 'd': finished}), isNull);
    });
  });
}
