// Ported from: src/lib/weaning-entry.test.ts
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/weaning/weaning.dart';
import 'package:anacan/features/tools/weaning/weaning_entry.dart';
import 'package:flutter_test/flutter_test.dart';

final DateTime now = DateTime(2026, 11, 6, 12, 0, 0);

bool offerable({String? lifeStage = 'mommy', String? birthDate = '2025-09-01', Object? setting = 'on'}) =>
    weaningOfferable(lifeStage: lifeStage, birthDate: birthDate, setting: setting, now: now);

WeaningEntry home({WeaningPlan? plan, bool continueBF = false, bool dismissed = false}) =>
    homeCardState(lifeStage: 'mommy', birthDate: '2025-09-01', setting: 'on', plan: plan, continueBF: continueBF, dismissed: dismissed, now: now);

bool link({WeaningPlan? plan, bool continueBF = false, Object? setting = 'on'}) =>
    feedingLinkVisible(lifeStage: 'mommy', birthDate: '2025-09-01', setting: setting, plan: plan, continueBF: continueBF, now: now);

WeaningPlan newPlan() => createPlan(feeds: defaultFeeds, pace: 'gentle', nightMode: 'last', start: isoDay(now), childId: null, now: now);

WeaningPlan withSteps(WeaningPlan p, List<WeaningStep> steps, {String? status}) => WeaningPlan.fromJson({
      ...p.toJson(),
      'steps': [for (final s in steps) s.toJson()],
      'status': ?status,
    });

FeedLog at(int daysAgo, int h, [String feedType = 'breast_left']) {
  final d = DateTime(now.year, now.month, now.day - daysAgo, h, 10);
  return FeedLog(logType: 'feeding', feedType: feedType, startTime: jsToIsoString(d));
}

Map<String, Object?> feeds(Feeds? f) => f!.toJson();

void main() {
  group('weaningOfferable', () {
    test('needs the Ana module, the admin switch and a child of 12+ months', () {
      expect(offerable(), true);
      expect(offerable(lifeStage: 'bump'), false);
      expect(offerable(setting: 'off'), false);
      expect(offerable(setting: null), false);
      expect(offerable(birthDate: '2026-03-01'), false); // 8 months
      expect(offerable(birthDate: null), false);
    });
  });

  group('homeCardState', () {
    test('shows the one-time intro card', () {
      expect(home().kind, 'intro');
    });
    test('stays hidden after "continue breastfeeding" or dismiss', () {
      expect(home(continueBF: true).kind, 'hidden');
      expect(home(dismissed: true).kind, 'hidden');
    });
    test('shows plan progress when a plan runs, even after dismiss', () {
      final p0 = newPlan();
      final plan = withSteps(p0, [p0.steps[0].copyWith(status: 'done'), ...p0.steps.skip(1)]);
      final s = home(plan: plan, dismissed: true);
      expect(s.kind, 'active');
      expect(s.done, 1);
      expect(s.total, plan.steps.length);
      expect(s.step?.id, plan.steps[1].id);
      expect(s.paused, false);
      final paused = home(plan: withSteps(plan, plan.steps, status: 'paused'));
      expect(paused.kind, 'active');
      expect(paused.paused, true);
    });
    test('is hidden for a finished plan once the mother dismissed the card', () {
      final p0 = newPlan();
      expect(home(plan: withSteps(p0, p0.steps, status: 'finished'), dismissed: true).kind, 'hidden');
    });
  });

  group('feedingLinkVisible', () {
    test('only without a running plan and without "continue breastfeeding"', () {
      expect(link(), true);
      expect(link(continueBF: true), false);
      expect(link(plan: newPlan()), false);
      expect(link(setting: 'off'), false);
    });
  });

  group('feedsFromLogs', () {
    test('counts breastfeeds by time of day over the logged days', () {
      final logs = [for (final d in [1, 2, 3, 4]) ...[at(d, 7), at(d, 11), at(d, 15), at(d, 20), at(d, 2)]];
      // per day: morning 1, daytime 2 (one is the nap feed), bedtime 1, night 1
      expect(feeds(feedsFromLogs(logs, defaultFeeds, now)), {'morning': true, 'day': 1, 'nap': true, 'bedtime': true, 'night': 1});
    });
    test('ignores formula, solids, other logs and logs older than 7 days', () {
      final logs = [for (final d in [1, 2, 3]) ...[at(d, 11), at(d, 23)]];
      final noise = [at(1, 10, 'formula'), FeedLog(logType: 'sleep', startTime: at(1, 10).startTime), at(9, 10), at(10, 23)];
      const base = Feeds(morning: true, day: 2, nap: false, bedtime: true, night: 1);
      expect(feeds(feedsFromLogs([...logs, ...noise], base, now)), {'morning': false, 'day': 1, 'nap': false, 'bedtime': false, 'night': 1});
    });
    test('needs at least 3 logged days', () {
      expect(feedsFromLogs([at(1, 11), at(2, 11)], defaultFeeds, now), isNull);
      expect(feedsFromLogs([], defaultFeeds, now), isNull);
    });
    test('clamps to the builder limits', () {
      final logs = [for (final d in [1, 2, 3]) for (final h in [9, 10, 11, 12, 13, 14, 15, 16, 22, 23, 0, 1, 2]) at(d, h)];
      final f = feedsFromLogs(logs, defaultFeeds, now)!;
      expect(f.day, lessThanOrEqualTo(4));
      expect(f.night, lessThanOrEqualTo(3));
    });
  });

  group('isWeaningQuestion', () {
    for (final q in [
      'Qızım 14 aylıqdır, onu süddən necə ayırım?',
      'Döşdən ayırmaq istəyirəm',
      'Əmizdirməni necə dayandırım?',
      'How do I wean my toddler?',
      'when to stop breastfeeding',
      'Как отлучить ребенка от груди?',
      'Bebeğimi sütten kesmek istiyorum',
      'Wie kann ich abstillen?',
      'Comment réussir le sevrage ?',
      '如何给宝宝断奶',
      'كيف أفطم طفلي',
    ]) {
      test('detects: $q', () => expect(isWeaningQuestion(q), true));
    }
    for (final q in ['Körpəm gecə tez-tez oyanır', 'How much milk should my baby drink?', 'Süd azdır, nə edim?', '', null]) {
      test('ignores: $q', () => expect(isWeaningQuestion(q), false));
    }
  });
}
