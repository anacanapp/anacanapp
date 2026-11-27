// Ported from: src/components/tools/FirstAidGuide.test.tsx
import 'dart:convert';

import 'package:anacan/features/tools/first_aid/first_aid_data.dart';
import 'package:anacan/features/tools/first_aid/first_aid_guide.dart';
import 'package:anacan/features/tools/health_tools.dart';
import 'package:anacan/features/tools/hub/hub_inputs.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

void main() {
  group('FirstAidGuide', () {
    toolTest('shows a call pill and retry instead of a blank screen when nothing is available', (tester) async {
      final h = HealthHarness();
      await h.pump(tester, FirstAidGuide(onBack: () {}));
      expect(find.byKey(const ValueKey('firstaid-unavailable')), findsOneWidget);
      await tester.tap(find.descendant(of: find.byKey(const ValueKey('firstaid-unavailable')), matching: find.byKey(const ValueKey('firstaid-unavailable-call'))));
      expect(h.launched, [Uri(scheme: 'tel', path: '103')]);
      final before = h.db.calls.where((c) => c == 'select first_aid_scenarios').length;
      await tester.tap(find.text('Yenidən cəhd et'));
      await settle(tester);
      expect(h.db.calls.where((c) => c == 'select first_aid_scenarios').length, greaterThan(before));
    });

    toolTest('opens any scenario from the cached bundle without a per-scenario fetch', (tester) async {
      final h = HealthHarness();
      h.store.setItem(
          firstAidCacheKey,
          jsonEncode({
            'v': 1,
            'language': 'az',
            'savedAt': DateTime.now().millisecondsSinceEpoch,
            'scenarios': [
              {'id': 's1', 'title': 'Boğulma', 'description': 'd', 'icon': '🫁', 'color': null, 'emergency_level': 'critical'},
            ],
            'stepsByScenario': {
              's1': [
                {'id': 'a1', 'scenario_id': 's1', 'step_number': 1, 'title': 'Addım bir', 'instruction': 'Təlimat bir', 'duration_seconds': null, 'is_critical': false},
              ],
            },
          }));
      await h.pump(tester, FirstAidGuide(onBack: () {}));
      await tester.tap(find.text('Boğulma'));
      await settle(tester);
      expect(find.text('Təlimat bir'), findsOneWidget);
      expect(find.byKey(const ValueKey('firstaid-unavailable')), findsNothing);
      expect(h.db.calls.where((c) => c.startsWith('select first_aid')), isEmpty);
    });
  });

  toolTest('the hub slot warms the offline bundle 1.5 s after mount', (tester) async {
    final h = HealthHarness(tables: {
      'first_aid_scenarios': [
        {'id': 's1', 'title_az': 'Boğulma', 'is_active': true, 'sort_order': 1, 'emergency_level': 'critical'},
      ],
      'first_aid_steps': [],
    });
    await h.pump(tester, const _HubLike(), extra: [toolsHubSlotsProvider.overrideWithValue(const ToolsHubSlots(prefetchFirstAid: healthToolsPrefetchFirstAid))]);
    expect(readFirstAidCache(h.store), isNull);
    await tester.pump(const Duration(milliseconds: 1600));
    await settle(tester);
    expect(readFirstAidCache(h.store)?.scenarios.single.title, 'Boğulma');
  });
}

/// Calls the slot from initState, as ToolsHub does.
class _HubLike extends ConsumerStatefulWidget {
  const _HubLike();
  @override
  ConsumerState<_HubLike> createState() => _HubLikeState();
}

class _HubLikeState extends ConsumerState<_HubLike> {
  @override
  void initState() {
    super.initState();
    ref.read(toolsHubSlotsProvider).prefetchFirstAid?.call(ref);
  }

  @override
  Widget build(BuildContext context) => const SizedBox();
}
