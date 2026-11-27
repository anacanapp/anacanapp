// Tests for app/lib/domain/water/water_target.dart (water-intake.ts / water-intake-rpc.ts pure parts have no
// vitest suite of their own; useDailyLogs.water.test.tsx renders the hook — the rules it checks are below).

import 'package:anacan/domain/water/water_target.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('shows the stored total for the same day plus queued deltas, clamped like the server', () {
    final outbox = [
      {'table': 'water_intake', 'payload': {'log_date': '2026-11-27', 'delta': 1}},
      {'table': 'water_intake', 'payload': {'log_date': '2026-11-27', 'delta': 2}},
      {'table': 'water_intake', 'payload': {'log_date': '2026-11-26', 'delta': 5}},
      {'table': 'daily_logs', 'payload': {'log_date': '2026-11-27', 'delta': 9}},
    ];
    expect(pendingWaterDelta(outbox, '2026-11-27'), 3);
    expect(storedWaterForDay(logDate: '2026-11-26', waterIntake: 4, day: '2026-11-27'), 0);
    expect(storedWaterForDay(logDate: '2026-11-27', waterIntake: null, day: '2026-11-27'), 0);
    expect(displayedWater(stored: 4, pending: 3), 7);
    expect(clampWater(-3), 0);
    expect(clampWater(25000), 20000);
    expect(clampWater(2.5), 3);
  });
  test('old backend detection and the partner goal notification', () {
    expect(isMissingRpc({'code': 'PGRST202'}), true);
    expect(isMissingRpc({'code': 'x', 'message': 'Function not found'}, 404), true);
    expect(isMissingRpc({'code': 'x', 'message': 'boom'}, 500), false);
    expect(isMissingRpc(null), false);
    expect(crossesWaterGoal(applied: true, total: 2000, amount: 1), true);
    expect(crossesWaterGoal(applied: true, total: 2001, amount: 1), false);
    expect(crossesWaterGoal(applied: false, total: 2000, amount: 1), false);
  });
  test('nutrition targets: DB row first, fallback by stage, +300 kcal per extra baby in pregnancy only', () {
    expect(nutritionTargets(lifeStage: 'bump'), (calories: 2300, water: 10, description: 'Hamiləlik dövrü'));
    expect(nutritionTargets(lifeStage: 'bump', isMultiple: true, babyCount: 3).calories, 2900);
    expect(nutritionTargets(lifeStage: 'mommy', isMultiple: true, babyCount: 2).calories, 2500);
    expect(nutritionTargets().water, 8);
    expect(nutritionTargets(lifeStage: 'flow', dbTargets: [{'life_stage': 'flow', 'calories': 1900, 'water_glasses': 9, 'description': null}]),
        (calories: 1900, water: 9, description: ''));
  });
}
