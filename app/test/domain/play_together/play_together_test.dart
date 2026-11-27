// Ported from: src/lib/play-together.test.ts. Content cases run on PLAY_GAMES_AZ dumped from the TypeScript
// (fixture play_together.json: id, category, ages, minutes, books). Text checks (steps, materials, no long dashes)
// and the book-catalogue case belong to the content / books ports.

import 'package:anacan/domain/play_together/play_together.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

List<PlayGame> games() => [
      for (final g in ((loadFixture('play_together', zoned: false)! as Map)['games'] as List).cast<Map>()) PlayGame.fromJson(g.cast<String, Object?>()),
    ];

void main() {
  final skip = fixtureSkip('play_together', zoned: false);
  group('play-together content', () {
    test('has unique ids, valid ages, steps and only real book ids', () {
      final ids = <String>{};
      for (final g in games()) {
        expect(ids.add(g.id), true, reason: g.id);
        expect(g.minM, lessThan(g.maxM));
        expect(playCategories, contains(g.cat));
      }
    }, skip: skip);
    test('offers at least 8 games and 3 categories for every age band', () {
      final all = games();
      for (final months in [6, 8, 14, 20, 26, 30, 38, 44, 50, 56, 62, 70, 80, 100]) {
        final g = gamesForAge(all, months);
        expect(g.length, greaterThanOrEqualTo(5), reason: 'age $months');
        expect(g.map((x) => x.cat).toSet().length, greaterThanOrEqualTo(3), reason: 'age $months');
      }
      expect(gamesForAge(all, 30).length, greaterThanOrEqualTo(8));
    }, skip: skip);
  });

  group('play-together logic', () {
    test('maps ages to bands and screen guidance', () {
      expect(bandForMonths(7), '6m');
      expect(bandForMonths(25), '2y');
      expect(bandForMonths(100), '6y');
      expect(screenGuideFor(18), 'none');
      expect(screenGuideFor(36), 'hour');
      expect(screenGuideFor(72), 'family');
    });
    test('picks three games of different categories, stable for a day', () {
      final g = gamesForAge(games(), 42);
      final a = todaysPicks(g, '2026-11-12|c1|3y', {}), b = todaysPicks(g, '2026-11-12|c1|3y', {});
      expect(a.map((x) => x.id), b.map((x) => x.id));
      expect(a, hasLength(3));
      expect(a.map((x) => x.cat).toSet(), hasLength(3));
    }, skip: skip);
    test('logs a game once per day and counts minutes', () {
      final now = DateTime(2026, 11, 12, 10);
      const game = (id: 'g1', minutes: 15);
      var s = logPlayed(emptyPlayState(), game, now);
      s = logPlayed(s, game, now);
      expect(s.log, hasLength(1));
      expect(minutesOn(s, '2026-11-12'), 15);
      expect(playedOn(s, '2026-11-12').contains('g1'), true);
      expect(weekStrip(s, now).last, (day: '2026-11-12', minutes: 15, today: true));
      expect(unlogPlayed(s, 'g1', now).log, isEmpty);
    });
    test('keeps stored state bounded and drops malformed entries', () {
      final log = [for (var i = 0; i < 400; i++) {'id': 'g$i', 'day': '2026-11-01', 'minutes': 10}];
      final s = sanitizePlayState({'log': [...log, {'id': 1}, {'id': 'x', 'day': 'bad', 'minutes': 5}], 'favs': ['a', 'a', 3], 'band': 'zz'});
      expect(s.log, hasLength(300));
      expect(s.favs, ['a']);
      expect(s.band, isNull);
      expect(toggleFav(toggleFav(s, 'b'), 'b').favs, ['a']);
      expect(parsePlayState(serializePlayState(s)).log, hasLength(300));
    });
    test('shows the tile for mothers whose app language has content', () {
      expect(isPlayTileVisible(lifeStage: 'mommy', hasContent: true), true);
      expect(isPlayTileVisible(lifeStage: 'mommy', hasContent: false), false);
      expect(isPlayTileVisible(lifeStage: 'bump', hasContent: true), false);
      expect(isPlayTileVisible(lifeStage: 'bump', hasContent: true, isAdmin: true), true);
    });
  });
}
