// Ported from: (no vitest for Exercises.tsx / useExerciseLogs.ts — behaviour checks of the port)
import 'package:anacan/features/tools/exercises/exercise_logs.dart';
import 'package:anacan/features/tools/exercises/exercises.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> logAt(DateTime d, [String id = 'x']) => {'id': '$id${d.day}', 'exercise_id': 'e1', 'completed_at': d.toUtc().toIso8601String(), 'calories_burned': 20, 'duration_minutes': 10};

Map<String, dynamic> exercise(String id, String name, {List<int>? trimester, bool postpartum = false, int? from, int? to}) => {
      'id': id,
      'name': name,
      'duration_minutes': 15,
      'calories': 40,
      'level': 'easy',
      'trimester': trimester,
      'icon': '🧘',
      'description': 'desc $name',
      'steps': ['Bir', 'İki'],
      'is_postpartum': postpartum,
      'postpartum_week_start': from,
      'postpartum_week_end': to,
      'is_active': true,
      'sort_order': 1,
    };

void main() {
  group('exerciseStreak', () {
    final now = DateTime(2026, 11, 27, 10);
    test('counts consecutive days ending today', () {
      expect(exerciseStreak([logAt(DateTime(2026, 11, 27, 8)), logAt(DateTime(2026, 11, 26, 8)), logAt(DateTime(2026, 11, 25, 8))], now), 3);
    });
    test('a run ending yesterday counts each day once (React counted one extra day)', () {
      expect(exerciseStreak([logAt(DateTime(2026, 11, 26, 8))], now), 1);
      expect(exerciseStreak([logAt(DateTime(2026, 11, 26, 8)), logAt(DateTime(2026, 11, 25, 8))], now), 2);
    });
    test('a gap ends the streak', () {
      expect(exerciseStreak([logAt(DateTime(2026, 11, 27, 8)), logAt(DateTime(2026, 11, 25, 8))], now), 1);
      expect(exerciseStreak(const [], now), 0);
    });
  });

  test('mommy sees the postpartum exercises of her week, others the trimester ones', () {
    final list = [
      ExerciseItem.fromRow(exercise('a', 'T2', trimester: [2])),
      ExerciseItem.fromRow(exercise('b', 'PP early', trimester: [], postpartum: true, from: 0, to: 6)),
      ExerciseItem.fromRow(exercise('c', 'PP late', trimester: [], postpartum: true, from: 7)),
    ];
    expect(filterExercises(list, isMommy: false, trimester: 2, postpartumWeek: 0).map((e) => e.id), ['a']);
    expect(filterExercises(list, isMommy: true, trimester: 2, postpartumWeek: 3).map((e) => e.id), ['b']);
    expect(filterExercises(list, isMommy: true, trimester: 2, postpartumWeek: 9).map((e) => e.id), ['c']);
  });

  toolTest('opens an exercise and logs it as done through the outbox', (tester) async {
    final h = HealthHarness(user: {'lifeStage': 'flow'}, tables: {
      'exercises': [exercise('e1', 'Yoqa', trimester: [1, 2, 3])],
    });
    await h.pump(tester, Exercises(onBack: () {}));
    expect(find.text('Yoqa'), findsOneWidget);
    await tester.tap(find.text('Yoqa'));
    await settle(tester);
    expect(find.text('Bir'), findsOneWidget);
    await tester.tap(find.text('Bitirdim'));
    await settle(tester);
    final row = h.db.rows('exercise_logs').single;
    expect([row['exercise_id'], row['exercise_name'], row['duration_minutes'], row['calories_burned']], ['e1', 'Yoqa', 15, 40]);
    expect(find.text('✅'), findsOneWidget);
  });
}
