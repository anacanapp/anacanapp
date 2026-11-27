// Ported from: src/data/partner-missions/partner-missions.test.ts (+ the usePartnerMissions state)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/partner/data/partner_missions.dart';
import 'package:anacan/features/partner/generated/partner_missions_text.g.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support.dart';

Map<String, List<String>> _read(String lang) =>
    (jsonDecode(File('../src/data/partner-missions/$lang.json').readAsStringSync()) as Map<String, dynamic>)
        .map((k, v) => MapEntry(k, [for (final s in v as List) '$s']));

void main() {
  final languages = Directory('../src/data/partner-missions')
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.json'))
      .map((f) => f.uri.pathSegments.last.replaceAll('.json', ''))
      .toList()
    ..sort();

  group('partner missions', () {
    test('has text for every mission in all 21 languages', () {
      expect(languages, hasLength(25));
      final keys = kPartnerMissions.map((m) => m.key).toList()..sort();
      for (final lang in languages) {
        final text = _read(lang);
        expect(text.keys.toList()..sort(), keys, reason: lang);
        for (final e in text.entries) {
          expect(e.value, hasLength(2), reason: '$lang.${e.key}');
          expect(e.value.every((s) => s.trim().isNotEmpty), isTrue, reason: '$lang.${e.key}');
        }
        // The generated table is the JSON (app/tool/partner/gen_partner_data.mjs).
        expect(kPartnerMissionText[lang], text, reason: 'generated $lang');
      }
    });

    test("chooses pools by the woman's stage", () {
      expect(missionPoolsFor((lifeStage: 'flow', pregnancyWeek: 0, babyAgeDays: 0)), ['flow']);
      expect(missionPoolsFor((lifeStage: 'bump', pregnancyWeek: 20, babyAgeDays: 0)), ['bump']);
      expect(missionPoolsFor((lifeStage: 'bump', pregnancyWeek: 35, babyAgeDays: 0)), ['bump_late', 'bump']);
      expect(missionPoolsFor((lifeStage: 'mommy', pregnancyWeek: 0, babyAgeDays: 30)), ['newborn', 'mommy']);
      expect(missionPoolsFor((lifeStage: 'mommy', pregnancyWeek: 0, babyAgeDays: 200)), ['mommy']);
      expect(missionPoolsFor(kNoMissionStage), isEmpty);
    });

    test('never shows pregnancy tasks outside pregnancy and is stable for a day', () {
      final day = DateTime(2026, 10, 30);
      for (final stage in [
        (lifeStage: 'flow', pregnancyWeek: 0, babyAgeDays: 0),
        (lifeStage: 'mommy', pregnancyWeek: 0, babyAgeDays: 200),
      ]) {
        final picked = pickDailyMissions(stage, day);
        expect(picked, hasLength(7));
        expect(picked.any((m) => m.pool == 'bump' || m.pool == 'bump_late'), isFalse);
        expect(picked.map((m) => m.key).toSet(), hasLength(7));
        expect(pickDailyMissions(stage, day), picked);
      }
      final late = pickDailyMissions((lifeStage: 'bump', pregnancyWeek: 37, babyAgeDays: 0), day);
      expect(late.take(4).every((m) => m.pool == 'bump_late' || m.pool == 'bump'), isTrue);
      expect(late.where((m) => m.pool == 'bump_late'), isNotEmpty);
    });

    test('stores one id per day and mission', () {
      expect(dailyMissionId('any_walk', DateTime(2026, 10, 30)), 'daily-20261030-any_walk');
    });
  });

  group('usePartnerMissions', () {
    test('level and points follow the stored rows; a toggle is optimistic and rolled back on failure', () async {
      final backend = FakePartnerBackend()
        ..tables['partner_missions'] = [
          {'user_id': kUserId, 'mission_id': 'daily-1-a', 'is_completed': true, 'points_earned': 30},
          {'user_id': kUserId, 'mission_id': 'daily-1-b', 'is_completed': true, 'points_earned': 20},
          {'user_id': kUserId, 'mission_id': 'daily-1-c', 'is_completed': false, 'points_earned': 0},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerMissionsProvider, (_, _) {});
      await settle();
      var s = sub.read();
      expect(s.completedIds, {'daily-1-a', 'daily-1-b'});
      expect(s.totalPoints, 50);
      expect(s.level, 2);
      expect(s.pointsToNextLevel, 50);
      expect(s.levelProgress, 0);

      final r = await c.read(partnerMissionsProvider.notifier).toggleMission('daily-1-c', 10);
      expect(r, (pointsEarned: 10, completed: true));
      s = sub.read();
      expect(s.totalPoints, 60);
      final up = backend.callsOf('upsert', 'partner_missions').single.payload! as Map;
      expect(up['is_completed'], isTrue);
      expect(up['points_earned'], 10);

      backend.errors['upsert:partner_missions'] = Exception('offline');
      expect(await c.read(partnerMissionsProvider.notifier).toggleMission('daily-1-a', 30), isNull);
      s = sub.read();
      expect(s.completedIds, contains('daily-1-a'));
      expect(s.totalPoints, 60);
    });

    test('builds the day\'s missions in the user language', () {
      final m = buildDailyMissions((lifeStage: 'bump', pregnancyWeek: 20, babyAgeDays: 0), 'en', {}, DateTime(2026, 10, 30));
      expect(m, hasLength(7));
      expect(m.first.id, startsWith('daily-20261030-'));
      expect(m.every((x) => x.title.isNotEmpty && x.description.isNotEmpty), isTrue);
      expect(m.first.title, kPartnerMissionText['en']![m.first.id.substring('daily-20261030-'.length)]![0]);
    });
  });
}
