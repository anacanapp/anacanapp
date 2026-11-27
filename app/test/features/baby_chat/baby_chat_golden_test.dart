// Ported from: (visual regression baselines of src/components/baby-chat/BabyChatScreen.tsx, BabyChatCard.tsx and
//              baby-chat.css — Flutter renders, never compared with the WebView)
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/features/baby_chat/baby_chat.dart';
import 'package:anacan/domain/notifications/local_notification_plan.dart' show StoredNotification;
import 'package:anacan/features/baby_chat/register.dart';
import 'package:anacan/features/home_flow/flow_platform.dart' show FlowNotificationPlanner;
import 'package:anacan/state/user_store.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import 'support.dart';

Future<void> _golden(WidgetTester tester, String name) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await settleSvgs(tester);
  await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/$name.png'));
}

class _Planner implements FlowNotificationPlanner {
  final List<(String, int, List<int>)> calls = [];
  @override
  bool get isNativePlatform => true;
  @override
  Future<void> setLocalNotifications(String namespace, List<StoredNotification> items, {bool ask = false, List<int> cancelIds = const []}) async =>
      calls.add((namespace, items.length, cancelIds));
}

const _thread = [
  BabyChatMessage(id: '2026-11-27-open', from: 'baby', text: 'Ana, salam! 👋', at: 1),
  BabyChatMessage(id: '2026-11-27-daily', from: 'baby', text: 'Bu gün səsini eşidirəm, danış mənimlə 💛', at: 2),
  BabyChatMessage(id: '2026-11-27-m1', from: 'mom', text: 'Səni çox sevirəm, balam', at: 3),
  BabyChatMessage(id: '2026-11-27-b1', from: 'baby', text: 'Mən də səni, ana! Qarnında rahatam 🥰', at: 4),
];

void main() {
  setUpAll(loadAnacanFonts);

  test('registers the baby-chat screen', () {
    final r = FeatureRegistry()..registerAll([registerBabyChatFeature]);
    expect(r.registeredIds, {'screen:baby-chat', 'frame:baby-chat-notifications'});
  });

  testWidgets('leaving the bump stage cancels the pending baby-chat notifications', (tester) async {
    final planner = _Planner();
    final env = BabyChatEnv(extra: [babyChatNotificationPlannerProvider.overrideWithValue(planner)]);
    await env.pump(tester, const BabyChatNotificationsCleanup());
    expect(planner.calls, isEmpty);
    env.container.read(userStoreProvider.notifier).setLifeStage('mommy');
    await tester.pump();
    expect(planner.calls, hasLength(1));
    expect(planner.calls.single.$1, 'baby-chat');
    expect(planner.calls.single.$2, 0);
    expect(planner.calls.single.$3, [7300, 7301, 7302, 7303, 7304, 7305, 7306]);
    await env.finish(tester);
  });

  for (final dark in [false, true]) {
    testWidgets('screen with a thread (${dark ? 'dark' : 'light'})', (tester) async {
      final env = BabyChatEnv();
      saveThread(env.store, 'user-1', '2026-11-27', _thread);
      await env.pump(tester, BabyChatScreen(onBack: () {}, onOpenAssistant: () {}), dark: dark);
      await _golden(tester, 'baby_chat_screen_${dark ? 'dark' : 'light'}');
      await env.finish(tester);
    });
  }

  testWidgets('home card (unread)', (tester) async {
    final env = BabyChatEnv();
    await env.pump(tester, Padding(padding: const EdgeInsets.all(16), child: BabyChatCard(onOpen: () {})));
    await _golden(tester, 'baby_chat_card_light');
    await env.finish(tester);
  });
}
