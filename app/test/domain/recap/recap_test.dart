// Ported from: src/lib/recap/recap.test.ts (model, timing, persona and numbers groups; the renderRecapFrame
// determinism group tests the canvas renderer, which is UI), src/lib/recap/window.test.ts

import 'package:anacan/domain/recap/recap_model.dart';
import 'package:anacan/domain/recap/recap_numbers.dart';
import 'package:anacan/domain/recap/recap_pace.dart';
import 'package:anacan/domain/recap/recap_persona.dart';
import 'package:anacan/domain/recap/recap_types.dart';
import 'package:anacan/domain/recap/recap_window.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

Map<String, Map<String, Object?>> personas() => {
      for (final c in (loadFixture('recap', zoned: false)! as List).cast<Map>())
        if (c['lang'] == 'az' && c['music'] == null) c['name'] as String: (c['data'] as Map).cast<String, Object?>(),
    };
const labels = RecapLabels(milestone: _ms, symptom: _sym, tool: _tool);
String? _ms(String id) => const {'first_smile': 'İlk təbəssüm', 'head_up': 'Başını tutdu', 'rolling': 'Çevrildi', 'first_laugh': 'İlk gülüş'}[id] ?? (id.isEmpty ? null : id);
String? _sym(String id) => const {'bloating': 'şişkinlik'}[id];
String? _tool(String id) => id;
Map<String, Object?> build(Map<String, Object?> d, [String lang = 'az']) => buildRecapModel(d, lang, recapSource, labels: labels);
List<Map<String, Object?>> scenes(Map<String, Object?> m) => (m['scenes']! as List).cast<Map<String, Object?>>();
List<String> ids(Map<String, Object?> m) => [for (final s in scenes(m)) s['id']! as String];
Map<String, Object?> at(Map<String, Object?> m, String id) => scenes(m).firstWhere((s) => s['id'] == id);

void main() {
  final skip = fixtureSkip('recap', zoned: false);
  group('buildRecapModel — scene selection', () {
    test('heavy mommy: the four strongest stage scenes plus the journey, then peak / persona / summary / outro', () {
      final m = build(personas()['mommy']!);
      expect(ids(m), ['cold', 'journey', 'mommy_feed', 'mommy_sleep', 'mommy_milestones', 'mommy_growth', 'peak', 'persona', 'summary', 'outro']);
      expect(at(m, 'mommy_feed')['badge'], 'Ən fəal 5% arasındasan');
      expect([at(m, 'mommy_milestones')['items'], at(m, 'mommy_milestones')['more']], [['İlk təbəssüm', 'Başını tutdu', 'Çevrildi', 'İlk gülüş'], '+6 daha']);
      expect([at(m, 'mommy_growth')['line'], at(m, 'mommy_growth')['gain']], ['Leyla bu il 6,2 kq böyüdü.', '+6,2 kq']);
      expect(at(m, 'cold')['title'], 'Aynur, bu il sənin hekayən idi.');
      expect(m['persona'], 'night');
      expect(at(m, 'persona')['title'], 'Gecə Qəhrəmanı');
    }, skip: skip);
    test('a longer track lets more scenes in (days together returns)', () {
      final m = buildRecapModel(personas()['mommy']!, 'az', recapSource,
          labels: labels, music: const RecapMusic(length: 70, drop: 16, breath: 44, lift: 46, tail: 62, end: 66.2, beat: 0.5));
      expect(ids(m), containsAll(['days', 'journey', 'mommy_feed', 'mommy_growth']));
      expect(at(m, 'peak')['start'], 44);
      expect(at(m, 'outro')['start'], 62);
      expect(m['duration'], 66.2);
    }, skip: skip);
    test('bump: weeks, kicks and hospital bag', () {
      final m = build(personas()['bump']!);
      expect(ids(m), containsAll(['journey', 'bump_weeks', 'bump_kicks', 'bump_bag']));
      expect((at(m, 'bump_weeks')['value']! as Map)['text'], '6 → 34');
      expect((at(m, 'bump_kicks')['value']! as Map)['n'], 1172);
    }, skip: skip);
    test('flow: cycles, logged days, mood colour and water', () {
      final m = build(personas()['flow']!);
      expect(ids(m), containsAll(['days', 'flow_cycles', 'flow_days', 'flow_mood', 'flow_water']));
      expect(at(m, 'flow_mood')['subs'], ['Ən çox qeyd etdiyin: şişkinlik']);
      expect(at(m, 'flow_cycles')['subs'], ['Orta dövr: 28 gün', 'Menstruasiya: 5 gün']);
      expect(ids(m), isNot(contains('journey')));
    }, skip: skip);
    test('light user: a full video from the fallback scenes, nothing shown as zero', () {
      final m = build(personas()['light']!);
      expect(ids(m), ['cold', 'days', 'anacan_hour', 'anacan_ai', 'anacan_community', 'peak', 'persona', 'summary', 'outro']);
      for (final s in scenes(m)) {
        if (s['kind'] == 'stat') expect((s['value']! as Map)['text'] ?? (s['value']! as Map)['n'], isNot(0));
        if (s['kind'] == 'peak' || s['kind'] == 'summary') {
          for (final st in (s['stats']! as List).cast<Map>()) {
            expect(st['n'] as num, greaterThan(0));
          }
        }
      }
      expect(at(m, 'cold')['title'], 'Bu il sənin hekayən idi.');
      expect(m['duration'] as num, greaterThanOrEqualTo(45));
    }, skip: skip);
    test('an empty year still gives a short, valid video', () {
      final m = build(parseRecap({'available': true, 'year': 2026, 'stage': 'mommy', 'mommy': {'feedings': 0}}));
      expect(ids(m), ['cold', 'peak', 'persona', 'summary', 'outro']);
      expect(scenes(m).every((s) => (s['end']! as num) > (s['start']! as num)), true);
    });
    test('never surfaces pregnancy for a person whose year went bump → flow', () {
      final p = personas();
      final m = build({...p['flow']!, 'stages': ['bump', 'flow'], 'bump': p['bump']!['bump']});
      expect(ids(m).any((id) => id.startsWith('bump') || id == 'journey'), false);
    }, skip: skip);
    test('skips a top-x % badge above 30 % and growth without a real gain', () {
      final d = personas()['mommy']!;
      final mommy = {...(d['mommy']! as Map).cast<String, Object?>()};
      mommy['feedings_top_pct'] = 45;
      mommy['weight_end_kg'] = mommy['weight_start_kg'];
      final m = build({...d, 'mommy': mommy});
      expect(at(m, 'mommy_feed')['badge'], isNull);
      expect(ids(m), isNot(contains('mommy_growth')));
    }, skip: skip);
    test('persona "why" lines are picked by a stable per-person seed', () {
      final lines = <Object?>{};
      for (final seed in ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) {
        final a = buildRecapModel(personas()['mommy']!, 'az', recapSource, seed: seed), b = buildRecapModel(personas()['mommy']!, 'az', recapSource, seed: seed);
        expect(at(a, 'persona'), at(b, 'persona'));
        lines.add(at(a, 'persona')['reason']);
      }
      expect(lines, hasLength(2));
    }, skip: skip);
    test('the persona table is data: stage-limited rows and custom terms', () {
      final p = personas();
      final table = <Map<String, Object?>>[
        {'id': 'water', 'stages': ['flow'], 'lines': 1, 'terms': [{'input': 'water', 'from': 100, 'to': 500, 'weight': 5}]},
        ...recapPersonas,
      ];
      expect(pickPersonaDef(p['flow']!, table)['id'], 'water');
      expect(pickPersonaDef(p['mommy']!, table)['id'], 'night');
      expect(scorePersona(table[0], personaFeatures(p['light']!)), 0);
    }, skip: skip);
    test('personas follow the data', () {
      final light = personas()['light']!;
      expect(pickPersona(personas()['mommy']!), 'night');
      expect(pickPersona({...light, 'favorite_hour': 12, 'likes': 40, 'comments': 10, 'posts': 2}), 'community');
      expect(pickPersona({...light, 'favorite_hour': 12, 'ai_questions': 40, 'posts_read': 80}), 'knowledge');
      expect(pickPersona({...light, 'favorite_hour': 12}), 'caring');
    }, skip: skip);
  });

  group('buildRecapModel — timing on the music', () {
    for (final p in ['mommy', 'bump', 'flow', 'light']) {
      test('$p: cuts on the drop, the breath and the tail; 45–55 s', () {
        final m = build(personas()[p]!);
        final music = recapMusic2026Value;
        expect(m['duration'] as num, inInclusiveRange(45, 55));
        expect(scenes(m).any((s) => s['start'] == music.drop), true);
        expect(at(m, 'peak')['start'], music.breath);
        expect(at(m, 'outro')['start'], music.tail);
        final ss = scenes(m);
        for (var i = 0; i < ss.length; i++) {
          final s = ss[i];
          if (i > 0) expect(s['start'], ss[i - 1]['end']);
          final len = (s['end']! as num) - (s['start']! as num);
          expect(len, lessThanOrEqualTo(7.51));
          final hold = len - sceneBuildTime(s, false) - (s['kind'] == 'outro' ? 0 : Pace.exit);
          expect(hold, greaterThanOrEqualTo(1.5), reason: s['id'] as String);
        }
        expect(m['hits'], [music.drop, music.lift]);
      }, skip: skip);
    }
    test('fitDurations respects min/max', () {
      expect(fitDurations(10, const [Slot(min: 1, max: 3, w: 1), Slot(min: 1, max: 9, w: 1)]), [3, 7]);
    });
  });

  group('numbers', () {
    test('formats per language without Intl', () {
      expect(formatNumber('az', 1576), '1 576');
      expect(formatNumber('az', 6.2, 1), '6,2');
      expect(formatNumber('en', 1576), '1,576');
      expect(formatNumber('es', 1576), '1576');
      expect(formatNumber('es', 15760), '15.760');
      expect(formatPercent('tr', 5), '%5');
      expect(formatUnit('ru', 21, 'day'), '21 день');
      expect(formatUnit('ru', 23, 'day'), '23 дня');
      expect(formatUnit('ru', 47, 'day'), '47 дней');
      expect(formatUnit('pl', 22, 'day'), '22 dni');
      expect(formatUnit('en', 6.5, 'hour', 1), '6.5 hours');
      expect(formatUnit('ja', 6, 'hour'), '6時間');
      expect(formatUnit('az', 3.2, 'kilogram', 1), '3,2 kq');
      expect(pluralOf('ar', 11), 'many');
    });
  });

  group('recap window', () {
    const cfg = {'enabled': true, 'start_at': '2026-12-10T00:00:00+04:00', 'end_at': '2027-02-28T23:59:59+04:00'};
    test('admins follow the shared dates unless they have their own', () {
      expect(recapOpen(cfg, true, DateTime.parse('2026-11-12T10:00:00Z')), false);
      expect(recapOpen(cfg, false, DateTime.parse('2026-12-10T10:00:00Z')), true);
      final own = {...cfg, 'admin_start_at': '2026-11-01T00:00:00+04:00'};
      expect(recapOpen(own, true, DateTime.parse('2026-11-12T10:00:00Z')), true);
      expect(recapOpen(own, false, DateTime.parse('2026-11-12T10:00:00Z')), false);
      expect(recapWindow(own, true).end, cfg['end_at']);
      expect(recapOpen({...cfg, 'enabled': false}, true, DateTime.parse('2026-12-20T10:00:00Z')), false);
    });
    test('converts Baku input values', () {
      expect(toBakuInput('2026-12-10T00:00:00+04:00'), '2026-12-10T00:00');
      expect(fromBakuInput('2026-12-10T00:00'), '2026-12-10T00:00:00+04:00');
      expect(fromBakuInput(''), isNull);
      expect(parseRecapConfig('{"start_at":"2026-12-10T00:00:00+04:00"}')['start_at'], cfg['start_at']);
    });
  });
}
