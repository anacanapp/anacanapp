// Ported from: src/hooks/useFirstAid.test.ts
import 'package:anacan/features/tools/first_aid/first_aid_data.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

final scenarioRows = <Map<String, dynamic>>[
  {'id': 's1', 'title': 'Choking', 'title_az': 'Boğulma', 'title_en': 'Choking', 'description': null, 'description_az': 'Desc', 'icon': '🫁', 'color': 'red', 'emergency_level': 'critical', 'is_active': true, 'sort_order': 1},
  {'id': 's2', 'title': 'Burns', 'title_az': 'Yanıq', 'title_en': 'Burns', 'description': null, 'description_az': null, 'icon': '🔥', 'color': 'orange', 'emergency_level': 'high', 'is_active': true, 'sort_order': 2},
];
final stepRows = <Map<String, dynamic>>[
  {'id': 'a2', 'scenario_id': 's1', 'step_number': 2, 'title': 'T2', 'title_az': 'A2', 'instruction': 'I2', 'instruction_az': 'B2', 'duration_seconds': 10, 'is_critical': false},
  {'id': 'a1', 'scenario_id': 's1', 'step_number': 1, 'title': 'T1', 'title_az': 'A1', 'instruction': 'I1', 'instruction_az': 'B1', 'duration_seconds': null, 'is_critical': true},
  {'id': 'b1', 'scenario_id': 's2', 'step_number': 1, 'title': 'U1', 'title_az': 'C1', 'instruction': 'J1', 'instruction_az': 'D1', 'duration_seconds': null, 'is_critical': false},
  {'id': 'x1', 'scenario_id': 'inactive', 'step_number': 1, 'title': 'X', 'title_az': 'X', 'instruction': 'X', 'instruction_az': 'X', 'is_critical': false},
];

void main() {
  late LocalStore store;
  late FakeHealthDb db;

  setUp(() {
    store = LocalStore.memory();
    db = FakeHealthDb({'first_aid_scenarios': scenarioRows, 'first_aid_steps': stepRows});
  });

  group('buildFirstAidBundle', () {
    test('groups steps of active scenarios, sorted, with localized text', () {
      final b = buildFirstAidBundle(scenarioRows, stepRows, 'az', 1);
      expect(b.scenarios.map((s) => s.title).toList(), ['Boğulma', 'Yanıq']);
      expect(b.stepsByScenario['s1']!.map((s) => s.instruction).toList(), ['B1', 'B2']);
      expect(b.stepsByScenario['s2'], hasLength(1));
      expect(b.stepsByScenario['inactive'], isNull);
    });

    test('uses the app language for display text', () {
      final b = buildFirstAidBundle(scenarioRows, stepRows, 'en', 1);
      expect(b.scenarios[0].title, 'Choking');
    });
  });

  group('fetchFirstAidBundle', () {
    test('persists all scenarios with all steps so unopened scenarios work offline', () async {
      await fetchFirstAidBundle(db, store, 'az');
      final cached = readFirstAidCache(store);
      expect(cached?.language, 'az');
      expect(cached!.stepsByScenario.keys.toList()..sort(), ['s1', 's2']);
    });

    test('falls back to the saved bundle when the network fails', () async {
      await fetchFirstAidBundle(db, store, 'az');
      db.failSelect['first_aid_scenarios'] = Exception('offline');
      final b = await fetchFirstAidBundle(db, store, 'az');
      expect(b.stepsByScenario['s2']![0].instruction, 'D1');
    });

    test('throws when offline with nothing saved (UI shows the retry state)', () async {
      db.failSelect['first_aid_steps'] = {'message': 'offline'};
      await expectLater(fetchFirstAidBundle(db, store, 'az'), throwsA({'message': 'offline'}));
      expect(store.getItem(firstAidCacheKey), isNull);
    });

    test('does not overwrite good content with an empty response', () async {
      await fetchFirstAidBundle(db, store, 'az');
      db.tables['first_aid_scenarios'] = [];
      await fetchFirstAidBundle(db, store, 'az');
      expect(readFirstAidCache(store)?.scenarios, hasLength(2));
    });
  });
}
