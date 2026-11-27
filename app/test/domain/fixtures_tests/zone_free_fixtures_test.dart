// Cross-language fixtures for zone-independent modules (app/tool/domain/gen_fixtures.mjs runs the original
// TypeScript): WHO growth, fetal percentiles, Aptek totals, Recap model and number formatting, kid-exercises
// picks / search folding, play-together picks and the vitamin reminder slices.

import 'package:anacan/domain/aptek/aptek_pricing.dart';
import 'package:anacan/domain/growth/who_growth.dart';
import 'package:anacan/domain/kid_exercises/kid_exercises.dart';
import 'package:anacan/domain/play_together/play_together.dart' as play;
import 'package:anacan/domain/pregnancy/fetal_growth.dart';
import 'package:anacan/domain/recap/recap_model.dart';
import 'package:anacan/domain/recap/recap_numbers.dart';
import 'package:anacan/domain/recap/recap_types.dart';
import 'package:anacan/domain/vitamins/vitamins.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

Object? _num(Object? v) => v is Map && v.containsKey(r'$num') ? double.nan : v;

const _demoLabels = RecapLabels(tool: _tool, milestone: _milestone, symptom: _symptom);
String? _tool(String id) => const {
      'baby-tracker': 'Körpə izləyicisi', 'sleep-training': 'Yuxu təlimi', 'white-noise': 'Ağ səs', 'kick-counter': 'Təpik sayğacı',
      'pregnancy-calendar': 'Hamiləlik təqvimi', 'baby-names': 'Körpə adları', 'cycle-calendar': 'Dövr təqvimi', 'mood-diary': 'Əhval gündəliyi',
      'water-tracker': 'Su izləyicisi',
    }[id];
String? _milestone(String id) => const {
      'first_smile': 'İlk təbəssüm', 'head_up': 'Başını tutdu', 'rolling': 'Çevrildi', 'first_laugh': 'İlk gülüş', 'sitting': 'Oturdu',
      'crawling': 'Emklədi', 'first_word': 'İlk söz', 'standing': 'Ayağa qalxdı', 'first_tooth': 'İlk diş', 'first_steps': 'İlk addım',
    }[id];
String? _symptom(String id) => const {'bloating': 'şişkinlik', 'cramps': 'sancı', 'headache': 'baş ağrısı'}[id];

void main() {
  test('WHO growth percentiles, z-scores and curves', () {
    for (final c in (loadFixture('who', zoned: false)! as List).cast<Map>()) {
      final m = c['measure'] as String, s = c['sex'] as String;
      if (c.containsKey('curve')) {
        expectJsonClose([for (final p in buildCurveData(m, s, 60)) p.toJson()], c['curve'], path: '$m $s curve');
      } else if (c.containsKey('at')) {
        expectJsonClose([for (final p in [3, 15, 50, 85, 97, 42]) valueAtPercentile(m, s, c['age'] as num, p)], c['at'], path: '$m $s ${c['age']}');
      } else {
        final age = c['age'] as num, v = c['v'] as num;
        expect(percentile(m, s, age, v), c['p'], reason: '$c');
        expectJsonClose(zScore(m, s, age, v), _num(c['z']), path: '$c', tol: 1e-12);
      }
    }
  }, skip: fixtureSkip('who', zoned: false));

  test('fetal weight percentiles', () {
    for (final c in (loadFixture('fetal', zoned: false)! as List).cast<List>()) {
      expect(estimatePercentileForWeight(c[0] as num, c[1] as num), c[2], reason: '$c');
    }
  }, skip: fixtureSkip('fetal', zoned: false));

  test('Aptek totals (rounding, bundles, coupons, shipping)', () {
    final config = parseAptekConfig(loadFixture('aptekConfig', zoned: false));
    final cases = (loadFixture('aptek', zoned: false)! as List).cast<Map>();
    for (var i = 0; i < cases.length; i++) {
      final c = cases[i];
      final lines = [for (final l in (c['lines'] as List).cast<Map>()) PriceLine(sku: l['sku'] as String?, price: l['price'] as num, quantity: l['quantity'] as num)];
      // gen_fixtures applies the coupon to every case whose index is not a multiple of 4.
      final coupon = i % 4 != 0 ? AptekCoupon.fromJson((c['coupon'] as Map).cast<String, Object?>()) : null;
      expectJsonClose(computeAptekTotals(lines, config, coupon, DateTime.fromMillisecondsSinceEpoch(0)).toJson(), c['out'], path: 'case $i', tol: 0);
    }
  }, skip: fixtureSkip('aptek', zoned: false));

  test('Recap model: scenes, copy, timing and persona per persona × language', () {
    for (final c in (loadFixture('recap', zoned: false)! as List).cast<Map>()) {
      final data = (c['data'] as Map).cast<String, Object?>();
      if (data['available'] != true) continue;
      final lang = c['lang'] as String;
      final music = c['music'] == null ? null : RecapMusic.fromJson((c['music'] as Map).cast<String, Object?>());
      final model = buildRecapModel(data, lang, recapSource,
          labels: _demoLabels, music: music, seed: c['music'] != null || lang == 'az' ? null : 'seed-${c['name']}');
      expectJsonClose(model, c['model'], path: '${c['name']}/$lang', tol: 1e-12);
    }
  }, skip: fixtureSkip('recap', zoned: false));

  test('parseRecap matches the TypeScript (numbers as strings, bad tools, unavailable)', () {
    final fixture = (loadFixture('recap', zoned: false)! as List).cast<Map>();
    final strings = fixture.firstWhere((c) => c['name'] == 'strings')['data'];
    expectJsonClose(parseRecap({
      'available': true, 'year': '2026', 'stage': 'bump', 'stages': ['bump'], 'days_active': '12.6', 'favorite_hour': '23.7', 'ai_questions': '11',
      'likes': '4', 'comments': 2, 'posts': '1',
      'bump': {'week_start': '12', 'week_end': 13, 'kicks': '0', 'bag_items_ready': 0, 'favorite_names': '3'},
      'top_tools': [{'id': 'x', 'count': '2'}, {'id': '', 'count': 3}, {'id': 'y', 'count': 0}],
    }), strings);
    expectJsonClose(parseRecap({'available': false, 'reason': 'closed'}), fixture.firstWhere((c) => c['name'] == 'unavailable')['data']);
  }, skip: fixtureSkip('recap', zoned: false));

  test('Recap number, percent and unit formatting in every language', () {
    for (final c in (loadFixture('recap_numbers', zoned: false)! as List).cast<Map>()) {
      final lang = c['lang'] as String, n = c['n'] as num;
      expect([formatNumber(lang, n), formatNumber(lang, n, 1), formatPercent(lang, n), formatUnit(lang, n, 'day'), formatUnit(lang, n, 'hour', 1), formatUnit(lang, n, 'kilogram', 1)],
          [c['num'], c['num1'], c['pct'], c['day'], c['hour1'], c['kg1']], reason: '$lang $n');
    }
  }, skip: fixtureSkip('recap_numbers', zoned: false));

  test('kid-exercises: picks, search folding, groups', () {
    final f = loadFixture('kid_exercises', zoned: false)! as Map;
    final exercises = [for (final e in (f['exercises'] as List).cast<Map>()) KidExercise.fromJson(e.cast<String, Object?>())];
    for (final p in (f['picks'] as List).cast<Map>()) {
      final inSet = exercises.where((e) => e.set == p['set']).toList();
      expect(todaysPicks(inSet, p['seed'] as String, p['months'] as num?).map((e) => e.id), p['picks'], reason: '$p');
    }
    for (final s in (f['search'] as List).cast<Map>()) {
      expect(searchExercises(exercises, s['q'] as String).map((e) => e.id), s['ids'], reason: '${s['q']}');
    }
    for (final pair in (f['folds'] as List).cast<List>()) {
      expect(foldSearch(pair[0] as String), pair[1], reason: '${pair[0]}');
    }
    expect([for (final g in groupsOf(exercises)) [g.key, g.items.length]], f['groups']);
    expect([for (final m in [0, 2, 4, 8, 13, 16, 22, 30]) [m, currentGroupKey(exercises, m < 12 ? '0-1' : '1-2', m)]], f['current']);
  }, skip: fixtureSkip('kid_exercises', zoned: false));

  test('play-together: age filter and deterministic picks', () {
    final f = loadFixture('play_together', zoned: false)! as Map;
    final games = [for (final g in (f['games'] as List).cast<Map>()) play.PlayGame.fromJson(g.cast<String, Object?>())];
    for (final p in (f['picks'] as List).cast<Map>()) {
      final forAge = play.gamesForAge(games, p['months'] as num);
      expect(forAge.map((g) => g.id), p['ids'], reason: '${p['months']}');
      expect(play.todaysPicks(forAge, p['seed'] as String, (p['played'] as List).cast<String>().toSet()).map((g) => g.id), p['picks'], reason: '$p');
    }
  }, skip: fixtureSkip('play_together', zoned: false));

  test('vitamin reminder slices per zone (offset from Node Intl, slicing in Dart)', () {
    for (final c in (loadFixture('vitamin_slices', zoned: false)! as List).cast<Map>()) {
      final offset = c['offset'] as int;
      final out = vitaminSlicesForZone(DateTime.parse(c['iso'] as String), (_) => offset);
      expect([for (final s in out) s.toJson()], c['slices'], reason: '$c');
    }
  }, skip: fixtureSkip('vitamin_slices', zoned: false));
}

