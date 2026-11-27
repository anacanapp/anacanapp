// Ported from: src/lib/weightTrackerStage.test.ts, src/lib/profileHeight.test.ts
import 'package:anacan/features/tools/weight/profile_height.dart';
import 'package:anacan/features/tools/weight/weight_tracker_stage.dart';
import 'package:flutter_test/flutter_test.dart';

const copy = WeightPromptCopy(
  prefix: 'Weight:',
  week: 'week',
  start: 'start:',
  now: 'now:',
  gain: 'gain:',
  change: 'change:',
  rec: 'rec:',
  status: 'Status:',
  rules: 'RULES.',
  contextPregnancyUnknownWeek: 'Pregnant, week unknown.',
  contextCycle: 'Not pregnant, tracks her cycle.',
  contextPostpartum: 'Postpartum, not pregnant.',
);

class MemoryStorage implements HeightStorage {
  final Map<String, String> m = {};
  @override
  String? getItem(String key) => m[key];
  @override
  void setItem(String key, String value) => m[key] = value;
}

class BadStorage implements HeightStorage {
  @override
  String? getItem(String key) => throw StateError('denied');
  @override
  void setItem(String key, String value) => throw StateError('denied');
}

WeightPromptInput base(WeightTrackerStage stage) => WeightPromptInput(
      stage: stage,
      startWeight: 60,
      currentWeight: 62.5,
      change: 2.5,
      statusText: 'Normal',
      recommended: (min: 1.2, max: 3.4),
      bmi: 22.1,
    );

void main() {
  group('resolveWeightTrackerStage', () {
    test('pregnancy with a known week shows ranges, the chart and the pre-eclampsia strip', () {
      expect(resolveWeightTrackerStage('bump', 23),
          const WeightTrackerStage(mode: 'pregnancy', week: 23, trimester: 2, showGainRange: true, showPregnancySafety: true));
    });
    test('never invents week 20 when the pregnancy week is unknown', () {
      for (final week in <num?>[null, 0, -3, double.nan]) {
        final s = resolveWeightTrackerStage('bump', week);
        expect((s.mode, s.week, s.trimester, s.showGainRange), ('pregnancy', null, null, false));
      }
    });
    test('cycle and postpartum users get no pregnancy week, range or danger strip (even with a period date)', () {
      expect(resolveWeightTrackerStage('flow', 20),
          const WeightTrackerStage(mode: 'cycle', week: null, trimester: null, showGainRange: false, showPregnancySafety: false));
      expect(resolveWeightTrackerStage('mommy', 20),
          const WeightTrackerStage(mode: 'postpartum', week: null, trimester: null, showGainRange: false, showPregnancySafety: false));
      expect(resolveWeightTrackerStage(null, 20).mode, 'cycle');
    });
  });

  group('buildWeightAiPrompt', () {
    test('pregnancy: real week and IOM range', () {
      final text = buildWeightAiPrompt(base(resolveWeightTrackerStage('bump', 18)), copy);
      expect(text, contains('18 week'));
      expect(text, contains('rec: 1.2-3.4kg'));
    });
    test('flow and mommy prompts name the real stage and carry no week or pregnancy range', () {
      for (final (stage, context) in [('flow', copy.contextCycle), ('mommy', copy.contextPostpartum)]) {
        final text = buildWeightAiPrompt(base(resolveWeightTrackerStage(stage, 20)), copy);
        expect(text, contains(context));
        expect(RegExp(r'\bweek\b|rec:|20').hasMatch(text), isFalse);
        expect(text, contains('change: +2.5kg'));
        expect(text, contains('BMI: 22.1'));
      }
    });
    test('pregnancy with an unknown week says so instead of claiming a week', () {
      final text = buildWeightAiPrompt(base(resolveWeightTrackerStage('bump', null)), copy);
      expect(text, contains(copy.contextPregnancyUnknownWeek));
      expect(text, isNot(contains('rec:')));
    });
  });

  group('weightTrend', () {
    test('treats small changes as stable', () {
      expect(weightTrend(0.3), 'stable');
      expect(weightTrend(1.2), 'up');
      expect(weightTrend(-2), 'down');
    });
  });

  group('planHeight', () {
    test('keeps the device value and uploads nothing while the column does not exist', () {
      expect(planHeight({'user_id': 'u'}, 165, false), const HeightPlan(height: 165));
      expect(planHeight(null, 165, false), const HeightPlan(height: 165));
    });
    test('uploads a device-only value once when the column exists and is empty', () {
      expect(planHeight({'height_cm': null}, 165, false), const HeightPlan(height: 165, upload: 165));
      expect(planHeight({'height_cm': null}, 165, true), const HeightPlan(height: 165));
    });
    test('prefers the profile value and copies it to the device (numeric may arrive as a string)', () {
      expect(planHeight({'height_cm': '170.5'}, 165, true), const HeightPlan(height: 170.5, writeLocal: 170.5));
      expect(planHeight({'height_cm': 170}, 170, true), const HeightPlan(height: 170));
      expect(planHeight({'height_cm': 170}, null, false), const HeightPlan(height: 170, writeLocal: 170));
    });
    test('ignores implausible values', () {
      expect(planHeight({'height_cm': 90}, null, false), const HeightPlan());
      expect(planHeight({'height_cm': null}, 300, false), const HeightPlan());
    });
    test('detects the column by key presence', () {
      expect(profileHasHeightColumn({'height_cm': null}), isTrue);
      expect(profileHasHeightColumn({}), isFalse);
      expect(profileHasHeightColumn(null), isFalse);
    });
  });

  group('device copy', () {
    test('reads and writes per user, keeping the existing key', () {
      final s = MemoryStorage();
      expect(heightStorageKey('u1'), 'anacan:weight-tracker:height-cm:u1');
      writeLocalHeight('u1', 162, s);
      expect(readLocalHeight('u1', s), 162);
      expect(readLocalHeight('u2', s), isNull);
      s.setItem(heightStorageKey('u3'), 'abc');
      expect(readLocalHeight('u3', s), isNull);
      expect(isHeightSynced('u1', s), isFalse);
      markHeightSynced('u1', s);
      expect(isHeightSynced('u1', s), isTrue);
    });
    test('survives a throwing storage', () {
      final bad = BadStorage();
      expect(readLocalHeight('u', bad), isNull);
      expect(() => writeLocalHeight('u', 160, bad), returnsNormally);
      expect(isHeightSynced('u', bad), isFalse);
    });
  });

  group('saveProfileHeight', () {
    ({ProfileHeightUpdate update, List<List<Object?>> calls}) client(Object? error) {
      final calls = <List<Object?>>[];
      return (
        update: (String table, Map<String, Object?> values, String column, String value) async {
          calls.add([table, values, column, value]);
          return error;
        },
        calls: calls,
      );
    }

    test('updates profiles.height_cm by user_id', () async {
      final f = client(null);
      expect(await saveProfileHeight(f.update, 'u1', 168), isTrue);
      expect(f.calls.single, ['profiles', {'height_cm': 168}, 'user_id', 'u1']);
    });
    test('fails quietly on a missing column, invalid input or a thrown error', () async {
      expect(await saveProfileHeight(client({'code': 'PGRST204'}).update, 'u1', 168), isFalse);
      expect(await saveProfileHeight(client(null).update, 'u1', 50), isFalse);
      expect(await saveProfileHeight(client(null).update, null, 168), isFalse);
      expect(await saveProfileHeight((t, v, c, val) => throw StateError('offline'), 'u1', 168), isFalse);
    });
  });
}
