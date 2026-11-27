import 'package:anacan/features/home_flow/daily_story_cards.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'flow_test_support.dart';

void main() {
  flowSetUpAll();
  testWidgets('dbg', (tester) async {
    final env = FlowTestEnv();
    addTearDown(env.dispose);
    env.repo.insights = [{'id': 'i1', 'title': 'Enerji', 'content': 'x', 'emoji': '⚡'}];
    phoneSurface(tester);
    await tester.pumpWidget(env.wrap(const DailyStoryCards()));
    await settle(tester);
    for (final o in tester.widgetList<Opacity>(find.byType(Opacity))) {
      debugPrint('opacity ${o.opacity}');
    }
    debugPrint('RECT ${tester.getRect(find.text('Enerji'))}');
  });
}
