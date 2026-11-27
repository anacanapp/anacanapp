// Tests for app/lib/domain/models/anacan.dart (src/types/anacan.ts has no runtime suite; the FRUIT_SIZES case of
// fetal-size.test.ts is in pregnancy/fetal_size_test.dart).

import 'package:anacan/domain/models/anacan.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('enums round-trip their TypeScript string values', () {
    expect(LifeStage.values.map((s) => s.toJson()), ['flow', 'bump', 'mommy', 'partner']);
    expect(LifeStage.fromJson('mommy'), LifeStage.mommy);
    expect(LifeStage.fromJson('x'), isNull);
    expect(UserRole.fromJson('partner'), UserRole.partner);
  });
  test('models keep the TypeScript field names in JSON', () {
    final user = User.fromJson({'id': 'u', 'email': 'e', 'name': 'n', 'role': 'woman', 'lifeStage': 'bump', 'createdAt': '2026-11-27T10:00:00.000Z'});
    expect(user.toJson(), {'id': 'u', 'email': 'e', 'name': 'n', 'role': 'woman', 'lifeStage': 'bump', 'createdAt': '2026-11-27T10:00:00.000Z'});
    final cycle = {
      'lastPeriodDate': '2026-11-01T00:00:00.000Z', 'cycleLength': 28, 'periodLength': 5, 'currentDay': 3, 'phase': 'menstrual',
      'fertileWindow': {'start': '2026-11-12T00:00:00.000Z', 'end': '2026-11-18T00:00:00.000Z'}, 'nextPeriodDate': '2026-11-29T00:00:00.000Z',
    };
    expect(CycleData.fromJson(cycle).toJson(), cycle);
    final log = {'id': 'l', 'babyId': 'b', 'type': 'feed', 'startTime': '2026-11-27T08:00:00.000Z', 'feedSide': 'left'};
    expect(BabyLog.fromJson(log).toJson(), log);
    final tool = {'id': 't', 'name': 'n', 'description': 'd', 'icon': 'i', 'route': '/r', 'stages': ['bump', 'mommy']};
    expect(Tool.fromJson(tool).toJson(), tool);
  });
  test('symptoms, moods and fruit sizes keep their keys and Azerbaijani defaults', () {
    final keys = <String>[];
    final s = symptoms(tr: (k, d) {
      keys.add(k);
      return d;
    });
    expect(s.first, (id: 'headache', label: 'Baş ağrısı', icon: '🤕'));
    expect(keys.first, 'anacan_bas_agrisi_ff6f4c');
    expect(moods().map((m) => m.label), ['Çox pis', 'Pis', 'Normal', 'Yaxşı', 'Əla']);
    expect(fruitSizes()[40]!.fruit, 'Qarpız');
    expect(fruitSizes(tr: (k, d) => 'T')[40]!.fruit, 'T');
    expect(fruitSizes(tr: (k, d) => 'T')[5]!.fruit, 'Küncüt toxumu');
  });
}
