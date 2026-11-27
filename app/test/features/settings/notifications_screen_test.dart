// Ported from: src/components/NotificationsScreen.test.tsx (case names kept)
import 'package:anacan/features/settings/data/notifications.dart';
import 'package:anacan/features/settings/notifications_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

class FakeNotifications implements NotificationsRepository {
  FakeNotifications(this.rows);
  List<Map<String, dynamic>> rows;
  final marked = <String>[];
  final removed = <String>[];
  @override
  Future<Map<String, dynamic>?> add(String userId, Map<String, dynamic> notification) async => null;
  @override
  Future<void> delete(String userId, String id) async {
    removed.add(id);
    rows = rows.where((r) => r['id'] != id).toList();
  }

  @override
  Future<List<Map<String, dynamic>>> list(String userId) async => rows;
  @override
  Future<void> markAllRead(String userId) async {}
  @override
  Future<void> markRead(String userId, String id) async => marked.add(id);
  @override
  void Function() subscribe(Ref ref, String userId, void Function() onChange) => () {};
}

List<Map<String, dynamic>> sample() => [
      {'id': 'system', 'user_id': 'viewer', 'title': 'Daily message', 'message': '${'Long daily content. ' * 30}The very last sentence.', 'notification_type': 'tip', 'is_read': false, 'created_at': DateTime.now().toUtc().toIso8601String()},
      {'id': 'comment', 'user_id': 'viewer', 'title': 'New reply', 'message': 'Long community content. ' * 30, 'notification_type': 'community_reply', 'is_read': false, 'created_at': DateTime.now().toUtc().toIso8601String(), 'action_data': {'postId': 'post', 'commentId': 'reply'}},
    ];

Future<FakeNotifications> open(WidgetTester tester, {List<Map<String, dynamic>>? rows, void Function(NotificationCommunityTarget?)? navigate, bool dark = false, bool rtl = false}) async {
  final repo = FakeNotifications(rows ?? sample());
  await pumpApp(tester, NotificationsScreen(onBack: () {}, onNavigateToCommunity: navigate), scroll: false, dark: dark, rtl: rtl, overrides: [
    ...baseOverrides(),
    notificationsRepositoryProvider.overrideWithValue(repo),
  ]);
  await tester.pumpAndSettle();
  return repo;
}

bool expanded(WidgetTester tester, String id) => tester.widget<Text>(find.byKey(ValueKey<String>('notification-message-$id'))).maxLines == null;

void main() {
  setUpAll(loadAnacanFonts);

  group('notification expansion', () {
    screenTest('opens the full system message in place and marks it read', (tester) async {
      final repo = await open(tester);
      expect(expanded(tester, 'system'), isFalse);
      await tester.tap(find.byKey(const ValueKey<String>('notification-toggle-system')));
      await tester.pumpAndSettle();
      expect(expanded(tester, 'system'), isTrue);
      expect(find.textContaining('The very last sentence.'), findsOneWidget);
      expect(repo.marked, contains('system'));
      await tester.tap(find.byKey(const ValueKey<String>('notification-toggle-system')));
      await tester.pumpAndSettle();
      expect(expanded(tester, 'system'), isFalse);
    });

    screenTest('expands community text without losing it to navigation, with a separate exact-target action', (tester) async {
      final calls = <NotificationCommunityTarget?>[];
      await open(tester, navigate: calls.add);
      await tester.tap(find.byKey(const ValueKey<String>('notification-toggle-comment')));
      await tester.pumpAndSettle();
      expect(calls, isEmpty);
      expect(expanded(tester, 'comment'), isTrue);
      await tester.ensureVisible(find.text('Paylaşıma keç'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Paylaşıma keç'));
      expect(calls, [const NotificationCommunityTarget(postId: 'post', commentId: 'reply')]);
    });

    screenTest('does not expand a row when its delete action is used', (tester) async {
      final repo = await open(tester);
      await tester.tap(find.byKey(const ValueKey<String>('notification-delete-system')));
      await tester.pumpAndSettle();
      expect(repo.removed, ['system']);
      expect(repo.marked, isEmpty);
    });

    screenTest('opens the follower profile from a follow notification', (tester) async {
      final calls = <NotificationCommunityTarget?>[];
      final row = {...sample()[1], 'notification_type': 'community_follow', 'action_data': {'userId': 'follower'}};
      await open(tester, rows: [row], navigate: calls.add);
      await tester.tap(find.text('Profilə bax'));
      expect(calls, [const NotificationCommunityTarget(userId: 'follower')]);
    });
  });

  screenTest('filters community vs system', (tester) async {
    await open(tester);
    await tester.tap(find.byKey(const ValueKey<String>('notifications-filter-system')));
    await tester.pumpAndSettle();
    expect(find.text('Daily message'), findsOneWidget);
    expect(find.text('New reply'), findsNothing);
  });

  test('formats relative times', () {
    final now = DateTime.utc(2026, 11, 27, 12);
    expect(formatNotificationTime('2026-11-27T11:59:40Z', now: now), 'İndicə');
    expect(formatNotificationTime('2026-11-27T11:30:00Z', now: now), '30 dəq');
    expect(formatNotificationTime('2026-11-27T07:00:00Z', now: now), '5 saat');
    expect(formatNotificationTime('2026-11-26T07:00:00Z', now: now), 'Dünən');
  });

  group('goldens', () {
    for (final mode in ['light', 'dark']) {
      screenTest('notifications $mode', (tester) async {
        await open(tester, dark: mode == 'dark', navigate: (_) {});
        await expectGolden(tester, 'notifications_$mode');
      });
    }
  });
}
