// Ported from: src/lib/weaning.test.ts (the two WEANING_COPY text assertions belong to the copy/i18n port)

import 'package:anacan/domain/weaning/weaning.dart';
import 'package:flutter_test/flutter_test.dart';

const all = Feeds(morning: true, day: 2, nap: true, bedtime: true, night: 2);
WeaningPlan plan({Feeds feeds = all, Pace pace = 'gentle', NightMode nightMode = 'last', String start = '2026-11-09'}) =>
    createPlan(feeds: feeds, pace: pace, nightMode: nightMode, start: start, childId: 'c1');
CheckinAnswers ci({String? childMood = 'happy', String? diapers = 'ok', bool childSick = false, String? fullness = 'none', bool lump = false, bool red = false, bool fever = false, String? motherMood = 'good'}) =>
    CheckinAnswers(childMood: childMood, diapers: diapers, childSick: childSick, fullness: fullness, lump: lump, red: red, fever: fever, motherMood: motherMood);

void main() {
  group('plan building', () {
    test('orders daytime → nap → morning → night → bedtime last', () {
      final steps = buildSteps(all, 'gentle', 'last', '2026-11-09');
      expect(steps.map((s) => '${s.type}${s.n == 0 ? '' : s.n}'), ['day1', 'day2', 'nap', 'morning', 'night1', 'night2', 'bedtime']);
      expect(steps.last.type, 'bedtime');
    });
    test('numbers repeated feeds only when there are several', () {
      final steps = buildSteps(const Feeds(morning: true, day: 1, nap: true, bedtime: true, night: 1), 'gentle', 'last', '2026-11-09');
      expect(steps.where((s) => s.type == 'day' || s.type == 'night').map((s) => s.n), [0, 0]);
    });
    test('uses 7-day (gentle) and 4-day (medium) contiguous steps', () {
      for (final (pace, days) in [('gentle', 7), ('medium', 4)]) {
        final steps = buildSteps(all, pace, 'last', '2026-11-09');
        for (var i = 0; i < steps.length; i++) {
          expect(steps[i].len, days);
          expect(steps[i].start, addDaysToDay('2026-11-09', i * days));
          expect(steps[i].status, 'todo');
        }
      }
    });
    test('has no one-day option and never builds steps shorter than MIN_DAYS', () {
      expect(paces, ['gentle', 'medium']);
      expect(paceDays.values.every((d) => d >= minDays), true);
      expect(paceDays.values.any((d) => d == 1), false);
      expect(() => buildSteps(all, 'oneday', 'last', '2026-11-09'), throwsA(isA<WeaningError>()));
      expect(minDays, 3);
    });
    test('leaves night feeds to the separate module when nightMode is separate', () {
      final steps = buildSteps(all, 'gentle', 'separate', '2026-11-09');
      expect(steps.any((s) => s.type == 'night'), false);
      expect(planStepCount(all, 'separate'), 5);
      expect(planStepCount(all, 'last'), 7);
      expect(plan(nightMode: 'separate').nightMode, 'separate');
      expect(plan(feeds: const Feeds(morning: true, day: 2, nap: true, bedtime: true, night: 0), nightMode: 'separate').nightMode, 'last');
    });
    test('estimates the duration in weeks and clamps the feed counts', () {
      expect(planWeeks(all, 'last', 'gentle'), 7);
      expect(planWeeks(all, 'last', 'medium'), 4);
      expect(buildSteps(const Feeds(morning: true, day: 9, nap: true, bedtime: true, night: 9), 'gentle', 'last', '2026-11-09').length, 1 + 4 + 1 + 3 + 1);
    });
    test('refuses an empty plan', () {
      expect(() => plan(feeds: const Feeds(morning: false, day: 0, nap: false, bedtime: false, night: 0)), throwsA(isA<WeaningError>()));
      expect(planStepCount(defaultFeeds, 'last'), 6);
    });
  });

  group('MIN_DAYS gating', () {
    final p = plan();
    final s0 = p.steps[0];
    test('enables "comfortable, done" only from day MIN_DAYS of the step', () {
      expect(canComplete(s0, '2026-11-09'), false);
      expect(canComplete(s0, '2026-11-10'), false);
      expect(canComplete(s0, '2026-11-11'), true);
      expect(identical(completeCurrent(p, '2026-11-10'), p), true);
      expect(completeCurrent(p, '2026-11-11').steps[0].status, 'done');
    });
    test('keeps a future next step on schedule after completing', () {
      final done = completeCurrent(p, '2026-11-11');
      expect(done.steps[1].start, '2026-11-16');
      expect(stepState(done.steps[1], '2026-11-11'), 'future');
    });
    test('offers "start now" only when MIN_DAYS passed since the previous step started', () {
      final done = completeCurrent(p, '2026-11-11');
      expect(canStartNow(done, '2026-11-11'), false);
      expect(identical(startNow(done, '2026-11-11'), done), true);
      expect(canStartNow(done, '2026-11-12'), true);
      final started = startNow(done, '2026-11-12');
      expect(started.steps[1].start, '2026-11-12');
      expect(started.steps[2].start, '2026-11-19');
      expect(started.steps[0].start, '2026-11-09');
    });
    test('never offers "start now" for the first step or while paused', () {
      expect(canStartNow(p, '2026-11-01'), false);
      expect(canStartNow(pausePlan(completeCurrent(p, '2026-11-11'), 'manual'), '2026-11-13'), false);
    });
    test('starts an overdue next step today when completing late', () {
      final late = completeCurrent(p, '2026-11-20');
      expect(late.steps[1].start, '2026-11-20');
      expect(late.steps[2].start, '2026-11-27');
    });
    test('finishes the plan after the last step', () {
      var q = plan(feeds: const Feeds(morning: false, day: 1, nap: false, bedtime: true, night: 0), pace: 'medium');
      q = completeCurrent(q, '2026-11-11');
      q = completeCurrent(q, '2026-11-15');
      expect(q.status, 'finished');
      expect(currentStep(q), isNull);
    });
    test('extends a step by 3 days and shifts later steps', () {
      final ext = extendStep(p, 's0', 3);
      expect(ext.steps[0].len, 10);
      expect(ext.steps[1].start, '2026-11-19');
      expect(planLastDay(ext), addDaysToDay(planLastDay(p), 3));
    });
    test('pauses, resumes (restarting a running step today) and cancels', () {
      final paused = pausePlan(p, 'doctor');
      expect([paused.status, paused.pauseReason], ['paused', 'doctor']);
      final r = resumePlan(paused, '2026-11-12');
      expect(r.shifted, true);
      expect([r.plan.status, r.plan.pauseReason], ['active', null]);
      expect(r.plan.steps[0].start, '2026-11-12');
      expect(r.plan.steps[1].start, '2026-11-19');
      expect(resumePlan(pausePlan(p, 'manual'), '2026-11-05').shifted, false);
      expect(cancelPlan(p).status, 'cancelled');
    });
  });

  group('readiness', () {
    const yes = Readiness(sick: false, change: false, allergy: false);
    test('builds no plan under 12 months or without a birth date', () {
      final v = readinessVerdict(11, yes);
      expect([v.tone, v.canPlan, v.title], ['red', false, 'weaning_verdict_young_title']);
      expect(readinessVerdict(9, yes).canPlan, false);
      expect(readinessVerdict(null, yes).canPlan, false);
    });
    test('suggests a 10-day delay for a sick child and 14 days for a big change', () {
      final a = readinessVerdict(14, const Readiness(sick: true, change: false, allergy: false));
      expect([a.tone, a.canPlan, a.delay], ['amber', true, 10]);
      final b = readinessVerdict(14, const Readiness(sick: false, change: true, allergy: false));
      expect([b.tone, b.canPlan, b.delay], ['amber', true, 14]);
      expect(readinessVerdict(14, const Readiness(sick: true, change: true, allergy: false)).delay, 10);
      final c = readinessVerdict(12, yes);
      expect([c.tone, c.canPlan, c.delay], ['mint', true, 0]);
    });
    test('computes the age in whole months from the birth date', () {
      final now = DateTime(2026, 11, 9);
      expect(ageInMonths('2025-11-09', now), 12);
      expect(ageInMonths('2025-11-10', now), 11);
      expect(ageInMonths('2026-02-01', now), 9);
      expect(ageInMonths(null, now), isNull);
      expect(ageInMonths('2027-01-01', now), isNull);
    });
    test('shows the tile only in the mommy module from 9 months when the admin switch is on', () {
      final now = DateTime(2026, 11, 9);
      expect(isWeaningTileVisible(lifeStage: 'mommy', birthDate: '2026-02-09', setting: 'on', now: now), true);
      expect(isWeaningTileVisible(lifeStage: 'mommy', birthDate: '2026-02-10', setting: 'on', now: now), false);
      expect(isWeaningTileVisible(lifeStage: 'mommy', birthDate: '2025-01-01', setting: 'off', now: now), false);
      expect(isWeaningTileVisible(lifeStage: 'mommy', birthDate: '2025-01-01', setting: null, now: now), false);
      expect(isWeaningTileVisible(lifeStage: 'bump', birthDate: '2025-01-01', setting: 'on', now: now), false);
      expect(isWeaningTileVisible(lifeStage: 'mommy', birthDate: null, setting: 'on', now: now), false);
    });
  });

  group('evaluateCheckin (red flags)', () {
    test('pauses and sends to a doctor for lump + fever or redness + fever (possible mastitis)', () {
      for (final (lump, red) in [(true, false), (false, true), (true, true)]) {
        final r = evaluateCheckin(ci(lump: lump, red: red, fever: true, childSick: true, motherMood: 'low'));
        expect([r.tone, r.action, r.title], ['red', 'pause', 'weaning_res_mastitis_title']);
        expect(r.items, hasLength(3));
      }
    });
    test('pauses and sends to a doctor for few wet diapers in a sick child (dehydration)', () {
      final r = evaluateCheckin(ci(diapers: 'few', childSick: true));
      expect([r.tone, r.action, r.title, r.emergency], ['red', 'pause', 'weaning_res_dehyd_title', true]);
      expect(evaluateCheckin(ci(diapers: 'few')).tone, 'mint');
    });
    test('slows down (+3 days) for a lump or redness without fever', () {
      for (final (lump, red) in [(true, false), (false, true)]) {
        final r = evaluateCheckin(ci(lump: lump, red: red, fullness: 'much'));
        expect([r.tone, r.action, r.title], ['amber', 'slow', 'weaning_res_clog_title']);
      }
    });
    test('extends (+2 days) for very full breasts', () {
      final r = evaluateCheckin(ci(fullness: 'much'));
      expect([r.tone, r.action, r.title], ['amber', 'extend', 'weaning_res_full_title']);
      expect(evaluateCheckin(ci(fullness: 'some')).action, isNull);
    });
    test('offers a pause for a sick child (and keeps an amber title)', () {
      final a = evaluateCheckin(ci(childSick: true));
      expect([a.tone, a.action, a.title], ['sky', 'offerPause', 'weaning_res_sick_title']);
      final both = evaluateCheckin(ci(childSick: true, fullness: 'much'));
      expect([both.tone, both.action, both.title], ['amber', 'extend', 'weaning_res_full_title']);
      expect(both.items, contains('weaning_res_sick_item'));
    });
    test('links low maternal mood to the Mood diary and adds the sad-child note', () {
      final r = evaluateCheckin(ci(motherMood: 'low', childMood: 'sad'));
      expect(r.moodLink, true);
      expect(r.items, ['weaning_res_child_sad', 'weaning_res_mother_low']);
      expect(evaluateCheckin(ci()).moodLink, false);
    });
    test('says all is well otherwise', () {
      final r = evaluateCheckin(ci());
      expect([r.tone, r.action, r.items], ['mint', null, ['weaning_res_ok_item']]);
    });
    test('applies the result to the running step', () {
      final p = plan();
      expect(applyCheckin(p, evaluateCheckin(ci(lump: true))).steps[0].len, 10);
      expect(applyCheckin(p, evaluateCheckin(ci(fullness: 'much'))).steps[0].len, 9);
      final paused = applyCheckin(p, evaluateCheckin(ci(red: true, fever: true)));
      expect([paused.status, paused.pauseReason], ['paused', 'doctor']);
      expect(identical(applyCheckin(p, evaluateCheckin(ci(childSick: true))), p), true);
      expect(applyCheckin(cancelPlan(p), evaluateCheckin(ci(lump: true, fever: true))).status, 'cancelled');
    });
  });

  group('nutrition and reminders', () {
    test('rates milk: 2–3 cups ≈ 470–710 ml, a warning above 710 ml', () {
      expect(milkStatus(3), 'low');
      expect(milkStatus(4), 'good');
      expect(milkStatus(5), 'good');
      expect(milkStatus(6), 'over');
    });
    test('plans 09:00 reminders only for upcoming steps of an active plan', () {
      final p = plan();
      final r = reminderDays(p, DateTime(2026, 11, 20, 12));
      expect(r[0].step.id, 's2');
      expect(r[0].at.hour, 9);
      expect(reminderDays(pausePlan(p, 'manual'), DateTime(2026, 11, 20, 12)), isEmpty);
    });
    test('counts calendar days across DST changes', () {
      expect(daysBetween('2026-03-28', '2026-03-30'), 2);
      expect(addDaysToDay('2026-10-24', 7), '2026-10-31');
    });
  });

  test('plan JSON keeps the TypeScript field names', () {
    final original = weaningIdGenerator;
    weaningIdGenerator = () => 'fixed-id';
    addTearDown(() => weaningIdGenerator = original);
    final p = createPlan(feeds: defaultFeeds, pace: 'medium', nightMode: 'last', start: '2026-11-09', childId: null, now: DateTime.utc(2026, 11, 9));
    final json = p.toJson();
    expect(json.keys, ['id', 'childId', 'pace', 'nightMode', 'steps', 'status', 'pauseReason', 'startedAt', 'createdAt', 'updatedAt']);
    expect(json['createdAt'], '2026-11-09T00:00:00.000Z');
    expect(WeaningPlan.fromJson(json).toJson(), json);
  });
}
