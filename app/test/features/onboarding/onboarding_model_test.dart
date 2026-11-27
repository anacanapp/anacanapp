// Ported from: src/lib/onboarding-model.test.ts (+ src/lib/onboardingTour.test.ts, src/lib/onboardingTourPreview.test.ts)
import 'package:anacan/features/onboarding/onboarding_features.dart';
import 'package:anacan/features/onboarding/onboarding_i18n.dart';
import 'package:anacan/features/onboarding/onboarding_model.dart';
import 'package:anacan/features/onboarding/onboarding_tour.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

const actor = '11111111-1111-4111-8111-111111111111', backend = 'https://api.anacan.az';
OnboardingDraft fixture() => newOnboardingDraft(actor, backend, 'Aysel').copyWith(stage: 'bump', pregnancyDate: '2026-06-01');

class ThrowingStorage implements DraftStorage {
  @override
  String? getItem(String key) => null;
  @override
  void removeItem(String key) {}
  @override
  void setItem(String key, String value) => throw StateError('SecurityError: blocked');
}

void main() {
  setUp(() {
    installTestI18n();
    onboardingCachedTranslation = (_, _) => null;
  });

  group('calendar and data contracts', () {
    test('rejects impossible and future dates and derives LMP/due dates without timezone shifts', () {
      expect(calendarDay('2026-02-30'), isNull);
      expect(calendarDay('2024-02-29'), isNotNull);
      expect(onboardingDataError(fixture().copyWith(pregnancyDate: '2026-09-23'), '2026-09-22'), 'pregnancy_date_invalid');
      final dates = pregnancyDates(pregnancyDate: fixture().pregnancyDate, dateMode: 'lmp');
      expect((dates.lastPeriod, dates.due), ('2026-06-01', '2027-03-08'));
      final back = pregnancyDates(pregnancyDate: dates.due, dateMode: 'due');
      expect((back.lastPeriod, back.due), (dates.lastPeriod, dates.due));
      expect(onboardingDataError(fixture().copyWith(dateMode: 'due', pregnancyDate: '2026-09-15'), '2026-09-22'), isNull);
    });
    test('preserves the supported cycle limits and validates both lengths', () {
      final draft = fixture().copyWith(stage: 'flow', lastPeriodDate: '2026-09-01', cycleLength: 10, periodLength: 10);
      expect(onboardingDataError(draft, '2026-09-22'), isNull);
      expect(onboardingDataError(draft.copyWith(cycleLength: 51), '2026-09-22'), 'cycle_length_invalid');
      expect(onboardingDataError(draft.copyWith(periodLength: 11), '2026-09-22'), 'cycle_length_invalid');
    });
    test('requires each child and retains the corrected-age input', () {
      final base = fixture().copyWith(stage: 'mommy');
      final child = base.children[0].copyWith(name: 'Leyla', gender: 'girl', birthDate: '2026-08-01', term: 'preterm', gestationalWeeks: 34);
      final draft = base.copyWith(children: [child]);
      expect(childDueDate(child), '2026-09-12');
      expect(onboardingDataError(draft, '2026-09-22'), isNull);
      expect(onboardingDataError(draft.copyWith(babyCount: 2), '2026-09-22'), 'baby_count_invalid');
      final twin = OnboardingChild(id: newOnboardingChild().id, name: 'Leyla', gender: 'girl', birthDate: '2026-08-01', term: 'preterm', gestationalWeeks: 34);
      expect(onboardingDataError(draft.copyWith(babyCount: 2, children: [child, twin]), '2026-09-22'), 'duplicate_child');
    });
  });

  test('switches branches without carrying incompatible health data or answer IDs', () {
    final changed = selectOnboardingStage(fixture().copyWith(answers: {'firstPregnancy': 'first', 'sleep': 'poor'}), 'flow');
    expect([changed.stage, changed.name, changed.pregnancyDate, changed.lastPeriodDate, changed.answers, changed.step], ['flow', 'Aysel', '', '', <String, Object>{}, 'name']);
    expect(onboardingSteps('flow', false), isNot(contains('feeding')));
    expect(onboardingSteps('mommy', true), contains('notifications'));
  });

  test('drops the purchase-intent questions from setup yet still recommends a valid plan', () {
    for (final stage in onboardingStages) {
      final steps = onboardingSteps(stage, true);
      expect(steps, isNot(contains('duration')));
      expect(steps, isNot(contains('budget')));
      expect(steps.sublist(0, 4), ['welcome', 'stage', 'name', 'data']);
      expect(steps, contains('privacy'));
      expect(steps, contains('notifications'));
    }
    expect(recommendedOnboardingPlan({}), 'yearly');
    expect(['yearly', 'monthly'], contains(recommendedOnboardingPlan({'budget': 'flexible'})));
  });

  test('step order per stage (native adds the notification step before the save)', () {
    expect(onboardingSteps('bump', false), [
      'welcome', 'stage', 'name', 'data', 'firstPregnancy', 'support', 'bumpSymptoms', 'bumpInterests', 'privacy', //
      'concern', 'sleep', 'supportLevel', 'value', 'analysis', 'results', 'features', 'paywall',
    ]);
    expect(onboardingSteps('mommy', true).sublist(4, 8), ['feeding', 'support', 'nightWakes', 'mommyInterests']);
    expect(onboardingSteps('flow', true).sublist(12), ['value', 'notifications', 'analysis', 'results', 'features', 'paywall']);
    expect(onboardingSteps(null, true), ['welcome', 'stage', 'name', 'data']);
  });

  test('keeps none exclusive, stores stable IDs and does not invent skipped answers', () {
    expect(toggleOnboardingAnswer(['none'], 'nausea'), ['nausea']);
    expect(toggleOnboardingAnswer(['nausea'], 'none'), ['none']);
    final answers = validatedOnboardingAnswers(fixture().copyWith(answers: {
      'feeding': 'formula',
      'bumpSymptoms': ['none', 'nausea'],
      'concern': 'invented',
      'budget': 'flexible',
    }));
    expect(answers.containsKey('feeding'), isFalse);
    expect(answers['concern'], isNull);
    expect(answers['bumpSymptoms'], ['none']);
    expect(recommendedOnboardingPlan(answers), 'monthly');
  });

  test('does not present irregular periods as an answer alongside a regular cycle', () {
    final answers = validatedOnboardingAnswers(fixture().copyWith(stage: 'flow', answers: {'regularity': 'regular', 'concern': 'irregular'}));
    expect(answers['regularity'], 'regular');
    expect(answers['concern'], isNull);
  });

  test('resumes only the same authenticated realm and never reopens a completed server journey', () {
    final storage = MemoryDraftStorage();
    final draft = fixture();
    writeOnboardingDraft(draft, storage);
    expect(storage.values.keys.single, 'anacan-onboarding-v3:api.anacan.az:$actor');
    expect(readOnboardingDraft(actor, backend, storage), draft);
    expect(readOnboardingDraft(actor, 'https://source.example', storage), isNull);
    expect(readOnboardingDraft('other', backend, storage), isNull);
    expect(
        hasPendingOnboarding(actor, backend, {
          'journey': {'version': 3, 'id': draft.id, 'revision': 'r', 'completedAt': '2026-09-22'},
        }, storage),
        isFalse);
    expect(hasPendingOnboarding(actor, backend, null, storage), isTrue);
  });

  test('reads a draft written by the Capacitor app (same JSON shape)', () {
    final storage = MemoryDraftStorage();
    storage.values[onboardingDraftKey(actor, backend)] =
        '{"schema":"anacan-onboarding-v3","actor":"$actor","backend":"$backend","id":"22222222-2222-4222-8222-222222222222","step":"sleep","stage":"flow","name":"Aysel","dateMode":"lmp","pregnancyDate":"","lastPeriodDate":"2026-09-01","cycleLength":28,"periodLength":5,"babyCount":1,"children":[{"id":"33333333-3333-4333-8333-333333333333","name":"","gender":"","birthDate":"","term":"","gestationalWeeks":34}],"deliveryType":"","answers":{"flowGoal":"track","flowSymptoms":["cramps"]},"notifications":"skipped","setupComplete":false,"saveStarted":false,"offerSeen":false,"purchasePending":false,"plan":"yearly","outcome":null}';
    final draft = readOnboardingDraft(actor, backend, storage)!;
    expect(draft.step, 'sleep');
    expect(draft.answers['flowSymptoms'], ['cramps']);
    storage.values[onboardingDraftKey(actor, backend)] = storage.values[onboardingDraftKey(actor, backend)]!.replaceFirst('"step":"sleep"', '"step":"feeding"');
    expect(readOnboardingDraft(actor, backend, storage), isNull, reason: 'a step of another branch is rejected');
  });

  test('does not silently swallow persistence failures', () {
    expect(() => writeOnboardingDraft(fixture(), ThrowingStorage()), throwsStateError);
  });

  group('all nine real language dictionaries', () {
    for (final language in onboardingLanguages) {
      test('$language covers every branch/option and all placeholders', () {
        final index = onboardingLanguages.indexOf(language);
        for (final entry in kOnboardingCopy.entries) {
          expect(entry.value, hasLength(9));
          expect(entry.value[index].trim(), isNot(''), reason: entry.key);
          List<String> fields(String s) => [for (final m in RegExp(r'\{(\w+)\}').allMatches(s)) m[1]!]..sort();
          expect(fields(entry.value[index]), fields(entry.value[0]), reason: entry.key);
        }
        for (final stage in onboardingStages) {
          expect(onboardingText(language, 'stage_$stage'), isNot(''));
          for (final question in [...branchQuestions[stage]!, 'sleep', 'supportLevel', 'duration', 'budget']) {
            expect(onboardingText(language, 'q_$question'), isNot(''));
            for (final option in questionOptions[question]!) {
              expect(onboardingText(language, option), isNot(option));
            }
          }
          for (final option in concerns[stage]!) {
            expect(onboardingText(language, option), isNot(''));
          }
        }
        expect(onboardingDate(language, '2026-09-22'), isNot(matches(RegExp('Invalid|M09'))));
      });
    }
  });

  test('stage benefit lists match the compact onboarding contract (docs/ONBOARDING_COMPACT.md)', () {
    List<String> labels(String stage, String page) => [for (final f in onboardingFeatures(stage, page, 'az')) f.label];
    expect(labels('mommy', 'results'), ['Yuxu rejimi izləmə', 'Qidalanma izləmə', 'İnkişaf mərhələləri', 'Ağlama analizi', 'Hava və geyim']);
    expect(labels('bump', 'paywall'), ['Təpik və sancı ölçən', 'Çəki, qan təzyiqi və şəkəri izləyicisi', 'Gündəlik limitsiz Anacan AI', 'Həkim PDF', 'Reklamsız təcrübə']);
    expect(labels('flow', 'offer'), ['Fazalara görə simptom analizi', 'Tsikl statistikası və trendlər', 'Gündəlik limitsiz Anacan AI', 'Həkim PDF', 'Reklamsız təcrübə']);
    expect(labels('mommy', 'features'), hasLength(9));
    expect(labels('bump', 'features'), hasLength(8));
  });

  // ── src/lib/onboardingTour.test.ts ──
  TourTool tool(String id, [bool open = true]) => TourTool(id: id, name: id, open: open);
  final mommyTools = [tool('mood'), tool('vaccine-calendar'), tool('danger-signs'), tool('baby-album'), tool('baby-growth', false), tool('teething', false)];
  List<TourStep> plan({String stage = 'mommy', bool isPremium = false, String push = 'prompt', List<TourTool>? tools}) =>
      buildTourPlan(stage: stage, isPremium: isPremium, push: push, tools: tools ?? mommyTools);
  List<TourSub> pushSubs(List<TourStep> p) => p.expand((s) => s.subs).where((u) => u.kind == 'push').toList();
  List<String?> toolPages(List<TourStep> p) => p.expand((s) => s.subs).where((u) => u.copy == 'tool_page').map((u) => u.toolId).toList();
  final allOpen = [for (final t in mommyTools) TourTool(id: t.id, name: t.name, open: true)];

  group('onboarding tour plan', () {
    test('free users get mood, tools, AI + community and Premium; Premium users skip the Premium step', () {
      final free = plan();
      expect(free.map((s) => s.id), ['welcome', 'mood', 'tools', 'ai', 'premium', 'final']);
      expect(countedSteps(free), 4);
      expect(plan(isPremium: true, tools: allOpen).map((s) => s.id), ['welcome', 'mood', 'tools', 'ai', 'final']);
    });
    test('asks for push only when the OS can still prompt, and only once', () {
      expect(pushSubs(plan(push: 'prompt')), hasLength(1));
      for (final push in ['granted', 'denied', 'unsupported']) {
        expect(pushSubs(plan(push: push)), isEmpty);
      }
      expect(shouldAskPush('granted'), isFalse);
      final noMood = plan(tools: mommyTools.where((t) => t.id != 'mood').toList());
      expect(pushSubs(noMood), hasLength(1));
      expect(noMood.firstWhere((s) => s.id == 'ai').subs.last.kind, 'push');
    });
    test('never opens a locked tool for a free user and never repeats the mood tool', () {
      expect(toolPages(plan()), ['vaccine-calendar', 'danger-signs']);
      expect(toolPages(plan(isPremium: true, tools: allOpen)), ['baby-growth', 'teething']);
      expect(plan().firstWhere((s) => s.id == 'tools').subs.any((u) => u.target == 'tools-premium'), isFalse);
    });
    test('skips tools that are not active for the stage', () {
      expect(toolPages(plan(stage: 'flow', tools: [tool('mood'), tool('doctors')])), ['doctors']);
      final bare = plan(stage: 'flow', tools: []);
      expect(bare.map((s) => s.id), ['welcome', 'tools', 'ai', 'premium', 'final']);
      expect(bare.firstWhere((s) => s.id == 'tools').subs.first.target, 'tab-tools');
    });
    test('opens a tool only through the Tools tab', () {
      for (final sub in plan().expand((s) => s.subs)) {
        if (sub.nav.tool != null) expect(sub.nav.tab, 'tools');
      }
    });
  });

  group('tool openness and eligibility', () {
    test('matches the Tools page rule', () {
      expect(isToolOpenForUser(toolId: 'mood', isPremiumFlag: false, stageLocked: false, isPremium: false), isTrue);
      expect(isToolOpenForUser(toolId: 'mood', isPremiumFlag: true, stageLocked: false, isPremium: false), isFalse);
      expect(isToolOpenForUser(toolId: 'mood', isPremiumFlag: false, stageLocked: true, isPremium: false), isFalse);
      expect(isToolOpenForUser(toolId: 'baby-growth', isPremiumFlag: false, stageLocked: false, isPremium: false), isFalse);
      expect(isToolOpenForUser(toolId: 'baby-growth', isPremiumFlag: true, stageLocked: true, isPremium: true), isTrue);
    });
    final now = DateTime.parse('2026-11-06T10:00:00Z').millisecondsSinceEpoch;
    bool eligible({Object? setting = 'on', Object? since = '2026-11-05T08:00:00Z', String? created = '2026-11-06T09:00:00Z', Object? journey, String? role = 'mother', String? lifeStage = 'mommy', bool loss = false, bool onboarded = true, int? at}) =>
        isTourEligible(setting: setting, since: since, accountCreatedAt: created, journey: journey, role: role, lifeStage: lifeStage, lossRecoveryActive: loss, onboarded: onboarded, now: at ?? now);
    test('shows the tour only to new, eligible accounts that have not seen it', () {
      expect(eligible(), isTrue);
      expect(eligible(setting: 'off'), isFalse);
      expect(eligible(journey: {'status': 'started'}), isFalse);
      expect(eligible(role: 'partner'), isFalse);
      expect(eligible(loss: true), isFalse);
      expect(eligible(onboarded: false), isFalse);
      expect(eligible(created: '2026-11-01T00:00:00Z'), isFalse);
      expect(eligible(at: DateTime.parse('2026-11-25T10:00:00Z').millisecondsSinceEpoch), isFalse);
      expect(eligible(since: null), isFalse);
      expect(eligible(lifeStage: null), isFalse);
    });
    test('treats accounts younger than a day as new', () {
      expect(isNewAccount('2026-11-06T09:00:00Z', now), isTrue);
      expect(isNewAccount('2026-11-04T09:00:00Z', now), isFalse);
      expect(isNewAccount(null, now), isFalse);
    });
  });

  group('admin tour preview handoff', () {
    test('keeps the request for a host that mounts later and hands it out once', () {
      final requests = TourPreviewRequests();
      requests.request(true);
      expect(requests.take(), isTrue);
      expect(requests.take(), isNull);
    });
  });
}
