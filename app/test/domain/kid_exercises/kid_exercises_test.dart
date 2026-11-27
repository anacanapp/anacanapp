// Ported from: src/lib/kid-exercises.test.ts. The content cases (141 exercises, image files, month-range groups)
// run on the Azerbaijani content dumped from the TypeScript (fixture kid_exercises.json).

import 'package:anacan/domain/kid_exercises/kid_exercises.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

List<KidExercise> content() => [
      for (final e in ((loadFixture('kid_exercises', zoned: false)! as Map)['exercises'] as List).cast<Map>()) KidExercise.fromJson(e.cast<String, Object?>()),
    ];

void main() {
  final skip = fixtureSkip('kid_exercises', zoned: false);
  group('kid exercises content', () {
    test('has 141 exercises in 5 age groups, each with an image and text', () {
      final c = content();
      expect(c, hasLength(141));
      expect(c.map((e) => e.id).toSet(), hasLength(141));
      expect(c.map((e) => e.set).toSet().toList(), kidExSetIds);
      for (final e in c) {
        expect(e.id.startsWith('${e.set}/'), true);
      }
    }, skip: skip);
    test('baby groups carry month ranges, later groups are kinds of movement', () {
      expect(groupMonths('3–6 ay'), (min: 3, max: 6));
      expect(groupMonths('Topla oyunlar'), isNull);
      final c = content();
      expect(currentGroupKey(c, '0-1', 4), '3–6 ay');
      expect(currentGroupKey(c, '1-2', 16), '15–18 ay');
      expect(currentGroupKey(c, '3-4', 40), isNull);
    }, skip: skip);
  });

  group('age group and picks', () {
    test('maps a child age to its group; older children stay in 4–5', () {
      expect([0, 11, 12, 30, 47, 48, 80].map(setForMonths), ['0-1', '0-1', '1-2', '2-3', '3-4', '4-5', '4-5']);
    });
    test('never picks an exercise from an older baby group', () {
      final inSet = content().where((e) => e.set == '0-1').toList();
      for (var d = 1; d <= 20; d++) {
        final picks = todaysPicks(inSet, '2026-11-$d|child|0-1', 2);
        expect(picks, hasLength(3));
        expect(picks.map((p) => p.id).toSet(), hasLength(3));
        for (final p in picks) {
          expect(groupMonths(p.groupKey)!.min, 0);
        }
      }
      final picks = todaysPicks(inSet, 'seed', 7);
      expect(picks.where((p) => p.groupKey == '6–9 ay').length, greaterThanOrEqualTo(1));
      expect(picks.every((p) => groupMonths(p.groupKey)!.min <= 7), true);
    }, skip: skip);
    test('is stable for a day and differs between days', () {
      final inSet = content().where((e) => e.set == '3-4').toList();
      final a = todaysPicks(inSet, 'day1|c|3-4', null).map((e) => e.id).toList();
      expect(todaysPicks(inSet, 'day1|c|3-4', null).map((e) => e.id), a);
      final days = {for (var i = 0; i < 10; i++) todaysPicks(inSet, 'day$i|c|3-4', null).map((e) => e.id).join()};
      expect(days.length, greaterThan(5));
    }, skip: skip);
    test('groups keep source order and search folds Azerbaijani letters', () {
      final c = content();
      expect(groupsOf(c.where((e) => e.set == '0-1').toList()).map((g) => g.key), ['0–3 ay', '3–6 ay', '6–9 ay', '9–12 ay']);
      expect(searchExercises(c, 'qarin ustə').any((e) => e.id == '0-1/01_tummy_time'), true);
      expect(searchExercises(c, 'TOP').length, greaterThan(5));
    }, skip: skip);
  });

  group('progress on the phone', () {
    test('logs done once per day, toggles favourites and survives a round trip', () {
      final store = <String, String>{};
      final now = DateTime(2026, 11, 21, 10);
      var s = parseKidExState(store[kidExStorageKey('u1')]);
      s = logDone(s, 'a', now);
      s = logDone(s, 'a', now);
      s = logDone(s, 'b', now);
      expect(doneOn(s, '2026-11-21'), {'a', 'b'});
      s = unlogDone(s, 'b', now);
      s = toggleFav(s, 'a').copyWith(set: '2-3');
      store[kidExStorageKey('u1')] = serializeKidExState(s);
      final back = parseKidExState(store[kidExStorageKey('u1')]);
      expect(back.favs, ['a']);
      expect(back.set, '2-3');
      expect(parseKidExState(store[kidExStorageKey('u2')]).favs, isEmpty);
      expect(weekStrip(back, now).map((d) => d.count), [0, 0, 0, 0, 0, 0, 1]);
    });
    test('is bounded and ignores bad stored data', () {
      var s = parseKidExState(null);
      for (var i = 0; i < 80; i++) {
        s = toggleFav(s, 'x$i');
      }
      expect(s.favs, hasLength(kidExMaxFavs));
      expect(kidExStorageKey(null), 'anacan_kid_exercises_v1:guest');
      final bad = parseKidExState('{"set":"9-9","favs":[1,"a"],"log":"x"}');
      expect([bad.set, bad.favs, bad.log], [null, ['a'], isEmpty]);
      expect(parseKidExState('not json').log, isEmpty);
    });
    test('tile is for the Ana module and admins, with content', () {
      expect(isKidExTileVisible(lifeStage: 'mommy', hasContent: true), true);
      expect(isKidExTileVisible(lifeStage: 'bump', hasContent: true), false);
      expect(isKidExTileVisible(lifeStage: 'bump', hasContent: true, isAdmin: true), true);
      expect(isKidExTileVisible(lifeStage: 'mommy', hasContent: false), false);
      expect(isKidExTileVisible(lifeStage: 'mommy', hasContent: true, disabled: true), false);
    });
  });
}
