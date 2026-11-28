// Ported from: the pure logic of src/hooks/{usePartnerWeeklyStats,usePartnerFavoriteNames}.ts and
//              src/components/partner/{NameVotingScreen,DailySummaryScreen,SurpriseTab,WeeklyStatsTab}.tsx,
//              src/components/partner/v2/{PartnerAppointmentsScreen,PartnerBabyDayScreen,LiveContractionsScreen,
//              PartnerSharingScreen,NightShiftScreen,BirthPlanScreen,HospitalRunScreen}.tsx (no vitest file exists)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/partner/data/partner_backend.dart' show PartnerChange;
import 'package:anacan/features/partner/data/partner_family.dart' show NightShift;
import 'package:anacan/features/partner/data/partner_sharing.dart';
import 'package:anacan/features/partner/data/sos_alert.dart';
import 'package:anacan/features/partner/screens/birth_plan_screen.dart';
import 'package:anacan/features/partner/screens/daily_summary_screen.dart';
import 'package:anacan/features/partner/screens/data/partner_favorite_names.dart';
import 'package:anacan/features/partner/screens/data/partner_live_rows.dart';
import 'package:anacan/features/partner/screens/data/partner_weekly_stats.dart';
import 'package:anacan/features/partner/screens/data/screens_backend.dart';
import 'package:anacan/features/partner/screens/hospital_run_screen.dart';
import 'package:anacan/features/partner/screens/live_contractions_screen.dart';
import 'package:anacan/features/partner/screens/name_voting_screen.dart';
import 'package:anacan/features/partner/screens/night_shift_screen.dart';
import 'package:anacan/features/partner/screens/partner_appointments_screen.dart';
import 'package:anacan/features/partner/screens/partner_baby_day_screen.dart';
import 'package:anacan/features/partner/screens/partner_sharing_screen.dart';
import 'package:anacan/features/partner/screens/partner_surprises_screen.dart';
import 'package:anacan/features/partner/screens/partner_weekly_stats_screen.dart';
import 'package:anacan/features/partner/screens/postpartum_support_screen.dart';
import 'package:anacan/features/tools/names/favorite_names.dart' show FavoriteName;
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import 'screens_support.dart';

FavoriteName _fav(String name, [String gender = 'girl']) => FavoriteName(id: name, userId: 'u', name: name, gender: gender, createdAt: '');

void main() {
  setUpAll(ensureDateLocales);
  setUp(installTestI18n);
  tearDown(DomainClock.reset);

  group('usePartnerWeeklyStats', () {
    final days = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];

    test('fills missing days, treats mood 0 as none and averages the rest', () {
      final s = buildWeeklyStats(days, [
        {'log_date': '2026-11-22', 'mood': 4, 'water_intake': 1500},
        {'log_date': '2026-11-24', 'mood': 0, 'water_intake': null},
        {'log_date': '2026-11-27', 'mood': 2, 'water_intake': 2500},
      ], const []);
      expect(s.dailyMoods.map((d) => d.mood).toList(), [null, 4, null, null, null, null, 2]);
      expect(s.totalWater, 4000);
      expect(s.avgMood, 3);
      expect(s.exerciseCount, 0);
    });

    test('groups exercise by local day and sums minutes and calories (null counts as 0)', () {
      final s = buildWeeklyStats(days, const [], [
        {'completed_at': DateTime(2026, 11, 26, 8).toUtc().toIso8601String(), 'duration_minutes': 20, 'calories_burned': 100},
        {'completed_at': DateTime(2026, 11, 26, 19).toUtc().toIso8601String(), 'duration_minutes': null, 'calories_burned': 50},
        {'completed_at': DateTime(2026, 11, 21, 7).toUtc().toIso8601String(), 'duration_minutes': 30, 'calories_burned': 120},
      ]);
      expect(s.exerciseData.map((e) => (e.count, e.minutes)).toList(), [(1, 30), (0, 0), (0, 0), (0, 0), (0, 0), (2, 20), (0, 0)]);
      expect((s.exerciseCount, s.totalCalories), (3, 270));
    });

    test('mood trend: up / down / stable from the halves; none below two moods', () {
      WeeklyStats w(List<int?> moods) => buildWeeklyStats(days, [
            for (var i = 0; i < moods.length; i++)
              if (moods[i] != null) {'log_date': days[i], 'mood': moods[i]},
          ], const []);
      expect(weeklyMoodTrend(w([2, 2, 4, 5])), 'up');
      expect(weeklyMoodTrend(w([5, 4, 2, 2])), 'down');
      expect(weeklyMoodTrend(w([3, 3, 3])), 'stable');
      expect(weeklyMoodTrend(w([3])), isNull);
      expect(weeklyMoodTrend(null), isNull);
    });

    test('day labels: Sunday first, pack languages through weekdayLabels', () {
      expect(weeklyDayLabels('en').first, 'Sun');
      expect(weeklyDayLabels('az'), ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş']);
      expect(weeklyDayLabels('fr'), hasLength(7));
    });

    test('reads her logs and exercise for the last 7 local days', () async {
      DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
      final backend = FakePartnerBackend()
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId
        ..rpcs['partner_daily_logs_v1'] = (p) => [
              {'log_date': '2026-11-27', 'mood': 5, 'water_intake': 2000},
            ];
      final screens = FakeScreensBackend()
        ..rows['exercise'] = [
          {'completed_at': DateTime(2026, 11, 27, 9).toUtc().toIso8601String(), 'duration_minutes': 15, 'calories_burned': 60},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', extra: [partnerScreensBackendProvider.overrideWithValue(screens)]));
      c.listen(partnerWeeklyStatsProvider, (_, _) {});
      await settle();
      final s = c.read(partnerWeeklyStatsProvider);
      expect(s.loading, isFalse);
      expect(s.stats!.dailyMoods.last.mood, 5);
      expect(s.stats!.exerciseCount, 1);
      final rpc = backend.callsOf('rpc', 'partner_daily_logs_v1').single.payload as Map;
      expect((rpc['p_from'], rpc['p_to']), ('2026-11-21', '2026-11-27'));
      expect(screens.calls.single.$2.first, kPartnerUserId);
    });

    test('without a link: no stats, not loading', () async {
      final c = partnerContainer(partnerOverrides(backend: FakePartnerBackend(), linked: null));
      c.listen(partnerWeeklyStatsProvider, (_, _) {});
      await settle();
      expect((c.read(partnerWeeklyStatsProvider).stats, c.read(partnerWeeklyStatsProvider).loading), (null, false));
    });
  });

  group('usePartnerFavoriteNames', () {
    test("reads her favourites and refetches on a change of her rows only", () async {
      final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      final screens = FakeScreensBackend()
        ..rows['favoriteNames'] = [
          {'id': '1', 'user_id': kPartnerUserId, 'name': 'Aysel', 'gender': 'girl', 'created_at': ''},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend, extra: [partnerScreensBackendProvider.overrideWithValue(screens)]));
      c.listen(partnerFavoriteNamesProvider, (_, _) {});
      await settle();
      expect(c.read(partnerFavoriteNamesProvider).partnerFavorites.map((f) => f.name), ['Aysel']);
      expect(backend.handlers.keys, contains('favorite_names|user_id=eq.$kPartnerUserId'));
      screens.rows['favoriteNames'] = [
        ...screens.rows['favoriteNames']!,
        {'id': '2', 'user_id': kPartnerUserId, 'name': 'Murad', 'gender': 'boy', 'created_at': ''},
      ];
      backend.emit('favorite_names', 'user_id=eq.$kPartnerUserId', const PartnerChange(eventType: 'INSERT'));
      await settle();
      expect(c.read(partnerFavoriteNamesProvider).partnerFavorites.map((f) => f.name), ['Aysel', 'Murad']);
    });

    test('not linked: empty and done', () async {
      final c = partnerContainer(partnerOverrides(backend: FakePartnerBackend(), linked: null));
      c.listen(partnerFavoriteNamesProvider, (_, _) {});
      await settle();
      final s = c.read(partnerFavoriteNamesProvider);
      expect(s.partnerFavorites, isEmpty);
      expect(s.loading, isFalse);
    });
  });

  group('NameVotingScreen pool', () {
    test('baby names once, then her favourites not in the list; search and gender filter', () {
      final pool = nameVotingPool([
        {'name': 'Aysel', 'gender': 'girl', 'meaning': 'Ay kimi'},
        {'name': 'Aysel', 'gender': 'girl'},
        {'name': 'Murad', 'gender': 'boy', 'meaning': 'Arzu'},
        {'name': 'Nur', 'gender': 'unisex'},
      ], [_fav('Aysel'), _fav('Leyla')]);
      expect(pool.map((n) => n.name), ['Aysel', 'Murad', 'Nur', 'Leyla']);
      expect(filterNameVotingPool(pool, '', 'boy').map((n) => n.name), ['Murad', 'Nur']);
      expect(filterNameVotingPool(pool, 'ARZU', 'all').map((n) => n.name), ['Murad']);
      expect(filterNameVotingPool(pool, 'ay', 'girl').map((n) => n.name), ['Aysel']);
    });
  });

  group('DailySummaryScreen', () {
    test('mood emoji / label and the date header', () {
      expect([summaryMoodEmoji(null), summaryMoodEmoji(0), summaryMoodEmoji(1), summaryMoodEmoji(5), summaryMoodEmoji(7)], ['❓', '❓', '😢', '😊', '❓']);
      expect([summaryMoodLabel(null), summaryMoodLabel(4), summaryMoodLabel(9)], ['Qeyd yox', 'Yaxşı', 'Qeyd yox']);
      final now = DateTime(2026, 11, 27, 1);
      expect(summaryDateLabel('2026-11-27', now), 'Bu gün');
      expect(summaryDateLabel('2026-11-26', now), 'Dünən');
      expect(summaryDateLabel('2026-11-20', now), isNot(anyOf('Bu gün', 'Dünən')));
    });
  });

  group('SurpriseTab', () {
    test('ideas fall back to the Azerbaijani title, a gift emoji, easy and 10 points; categories in first-seen order', () {
      final ideas = [
        surpriseIdeaFromRow({'id': '1', 'title': 'Dinner', 'title_az': 'Şam yeməyi', 'category': 'romantic', 'points': 20, 'difficulty': 'hard'}),
        surpriseIdeaFromRow({'id': '2', 'title': 'Walk', 'category': 'adventure'}),
        surpriseIdeaFromRow({'id': '3', 'title': 'X', 'category': 'unknown'}),
        surpriseIdeaFromRow({'id': '4', 'title': 'Y', 'category': 'romantic'}),
      ];
      expect((ideas[0].title, ideas[0].points, ideas[0].difficulty), ('Şam yeməyi', 20, 'hard'));
      expect((ideas[1].title, ideas[1].emoji, ideas[1].difficulty, ideas[1].points), ('Walk', '🎁', 'easy', 10));
      expect(surpriseCategories(ideas).map((c) => c.id), ['all', 'romantic', 'adventure']);
    });
  });

  group('PartnerAppointmentsScreen', () {
    test('upcoming from today; past newest first', () {
      final split = splitAppointments([
        {'id': 'a', 'event_date': '2026-11-01'},
        {'id': 'b', 'event_date': '2026-11-20'},
        {'id': 'c', 'event_date': '2026-11-27'},
        {'id': 'd', 'event_date': '2026-12-02'},
      ], '2026-11-27');
      expect(split.upcoming.map((r) => r['id']), ['c', 'd']);
      expect(split.past.map((r) => r['id']), ['b', 'a']);
    });
  });

  group('PartnerBabyDayScreen', () {
    test('totals: feeds with ml, finished sleep minutes, diapers', () {
      final t = babyDayTotals([
        {'log_type': 'feeding', 'amount_ml': 90},
        {'log_type': 'feeding', 'amount_ml': null},
        {'log_type': 'sleep', 'start_time': '2026-11-27T08:00:00Z', 'end_time': '2026-11-27T09:30:00Z'},
        {'log_type': 'sleep', 'start_time': '2026-11-27T11:00:00Z', 'end_time': null},
        {'log_type': 'diaper'},
      ]);
      expect((t.feeds, t.totalMl, t.sleeps, t.sleepMinutes, t.diapers), (2, 90, 2, 90.0, 1));
    });

    test("her rows of today, refetched on her realtime change", () async {
      DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
      final backend = FakePartnerBackend();
      final screens = FakeScreensBackend()..rows['babyLogs'] = [{'id': '1', 'log_type': 'diaper', 'start_time': '2026-11-27T05:00:00Z'}];
      final c = partnerContainer(partnerOverrides(backend: backend, extra: [partnerScreensBackendProvider.overrideWithValue(screens)]));
      final args = (kind: 'baby-day', userId: kPartnerUserId);
      c.listen(partnerLiveRowsProvider(args), (_, _) {});
      await settle();
      expect(c.read(partnerLiveRowsProvider(args)).rows, hasLength(1));
      expect(screens.calls.single.$2, [kPartnerUserId, DateTime(2026, 11, 27).toUtc().toIso8601String()]);
      backend.emit('baby_logs', 'user_id=eq.$kPartnerUserId', const PartnerChange(eventType: 'INSERT'));
      await settle();
      expect(screens.calls, hasLength(2));
    });
  });

  group('LiveContractionsScreen', () {
    final now = DateTime.utc(2026, 11, 27, 10);
    Map<String, dynamic> c(int minutesAgo, int? duration, int? interval) =>
        {'id': '$minutesAgo', 'start_time': now.subtract(Duration(minutes: minutesAgo)).toIso8601String(), 'duration_seconds': duration, 'interval_seconds': interval};

    test('5-1-1: three or more in the last hour, average interval ≤ 5 min and duration ≥ 1 min', () {
      final s = contractionStats([c(1, 70, 280), c(6, 65, 290), c(11, 60, 300), c(90, 30, 900)], now)!;
      expect((s.count, s.is511), (3, true));
      expect(s.avgDuration, 65);
      expect(s.avgInterval, 290);
      expect(contractionStats([c(1, 70, 280), c(6, 65, 290)], now)!.is511, isFalse);
      expect(contractionStats([c(1, 50, 280), c(6, 50, 290), c(11, 50, 300)], now)!.is511, isFalse);
      expect(contractionStats([c(70, 60, 200)], now), isNull);
    });

    test('durations as m:ss', () {
      expect([fmtContractionDuration(65), fmtContractionDuration(59.6), fmtContractionDuration(125)], ['1:05', '0:60', '2:05']);
    });
  });

  group('PartnerSharingScreen', () {
    test("the partner's week counts loves (incl. a ❤️ text) and messages to me in the last 7 days", () {
      final now = DateTime.utc(2026, 11, 27, 10);
      String ago(int d) => now.subtract(Duration(days: d)).toIso8601String();
      final week = partnerWeek([
        {'receiver_id': kUserId, 'message_type': 'love', 'created_at': ago(1)},
        {'receiver_id': kUserId, 'message_type': 'text', 'content': '❤️', 'created_at': ago(2)},
        {'receiver_id': kUserId, 'message_type': 'text', 'content': 'salam', 'created_at': ago(3)},
        {'receiver_id': kUserId, 'message_type': 'image', 'content': 'x', 'created_at': ago(3)},
        {'receiver_id': kUserId, 'message_type': 'text', 'content': 'old', 'created_at': ago(9)},
        {'receiver_id': 'someone', 'message_type': 'love', 'created_at': ago(1)},
      ], kUserId, now);
      expect((week.loves, week.texts), (2, 2));
    });

    test('a group switch saves only the keys that differ', () {
      final g = kSharingGroups.firstWhere((g) => g.id == 'health');
      expect(groupKeysToSave(g, PartnerSharing.defaults, true), ['share_weight']);
      expect(groupKeysToSave(g, PartnerSharing.defaults, false), ['share_water']);
    });
  });

  group('NightShiftScreen', () {
    test('a day cycles nobody → me → the other → nobody', () {
      expect(nextNightAssignee(null, 'partner', 'mother'), 'partner');
      expect(nextNightAssignee('partner', 'partner', 'mother'), 'mother');
      expect(nextNightAssignee('mother', 'partner', 'mother'), isNull);
    });

    test('stats count past nights only', () {
      NightShift s(String d, String who, int w) => NightShift(shiftDate: d, assignee: who, isDone: true, wakeups: w, updatedByMe: false, updatedAt: '');
      final stats = nightShiftStats([s('2026-11-25', 'partner', 2), s('2026-11-26', 'mother', 3), s('2026-11-27', 'partner', 9)], '2026-11-27', 'partner', 'mother');
      expect((stats.mine, stats.theirs, stats.wakeups), (1, 1, 5));
    });

    test('the no-family error has its own text', () {
      expect(nightShiftErrorText(Exception('NIGHT_SHIFT_NO_FAMILY')), isNot(nightShiftErrorText(Exception('boom'))));
    });
  });

  group('BirthPlanScreen', () {
    test('"none" companions exclude every other choice; other lists toggle', () {
      var plan = <String, dynamic>{};
      plan = toggleBirthPlanList(plan, 'companions', 'partner');
      plan = toggleBirthPlanList(plan, 'companions', 'mother');
      expect(plan['companions'], ['partner', 'mother']);
      plan = toggleBirthPlanList(plan, 'companions', 'none');
      expect(plan['companions'], ['none']);
      plan = toggleBirthPlanList(plan, 'companions', 'doula');
      expect(plan['companions'], ['doula']);
      plan = toggleBirthPlanList(plan, 'companions', 'none');
      plan = toggleBirthPlanList(plan, 'companions', 'none');
      expect(plan['companions'], isEmpty);
      plan = toggleBirthPlanList(plan, 'environment', 'dim');
      plan = toggleBirthPlanList(plan, 'environment', 'dim');
      expect(plan['environment'], isEmpty);
    });
  });

  group('HospitalRunScreen', () {
    test('uses the latest birth alert sent to me', () {
      final alerts = [
        SosAlert({'id': '1', 'alert_type': 'emergency', 'receiver_id': kUserId}),
        SosAlert({'id': '2', 'alert_type': 'birth', 'receiver_id': 'other'}),
        SosAlert({'id': '3', 'alert_type': 'birth', 'receiver_id': kUserId, 'latitude': 40.4, 'longitude': 49.8}),
        SosAlert({'id': '4', 'alert_type': 'birth', 'receiver_id': kUserId}),
      ];
      expect(latestBirthAlert(alerts, kUserId)?.id, '3');
      expect(latestBirthAlert(alerts, 'nobody'), isNull);
    });
  });

  group('PostpartumSupportScreen', () {
    test('the emergency number comes from the translated text', () {
      expect(postpartumEmergencyNumber('Zəng et: 103 və ya 112'), '103');
      expect(postpartumEmergencyNumber('Call now'), '112');
    });
  });
}
