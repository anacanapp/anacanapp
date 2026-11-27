// Ported from: src/components/dashboard/RecentBlogPosts.test.tsx
import 'package:anacan/features/home/dashboard/recent_blog_posts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../../support/i18n_fakes.dart';
import '../home_test_support.dart';

Map<String, dynamic> post(int i) => {
  'id': 'p$i',
  'slug': 'post-$i',
  'title': 'Post $i',
  'excerpt': 'Excerpt $i',
  'cover_image_url': null,
  'reading_time': 4,
  'view_count': 1,
  'created_at': '2026-10-01T00:00:00Z',
  'life_stage': 'all',
};

void main() {
  late HomeTestEnv env;
  setUp(() {
    installTestI18n();
    env = HomeTestEnv();
    env.repo.blogRows = [for (var i = 1; i <= 12; i++) post(i)];
  });
  tearDown(() => env.dispose());

  group('RecentBlogPosts carousel', () {
    testWidgets('shows at most nine article cards with dots and opens a post', (tester) async {
      phoneSurface(tester);
      final opened = <String>[];
      await tester.pumpWidget(env.wrap(RecentBlogPosts(onNavigate: opened.add), padded: true));
      await settle(tester);
      final rail = tester.widget<ListView>(find.byKey(const ValueKey('blog-rail')));
      expect(rail.semanticChildCount, 9);
      expect(find.byKey(const ValueKey('blog-dot-8')), findsOneWidget);
      expect(find.byKey(const ValueKey('blog-dot-9')), findsNothing);
      expect(find.text('Post 10'), findsNothing);
      await tester.tap(find.text('Post 1'));
      expect(opened, ['blog/post-1']);
    });

    testWidgets('advances automatically and pauses after the user touches it', (tester) async {
      phoneSurface(tester);
      var clock = DateTime(2026, 11, 27, 10);
      await tester.pumpWidget(
        env.wrap(BlogCarousel(posts: [for (var i = 1; i <= 12; i++) post(i)].take(9).toList(), onNavigate: (_) {}, now: () => clock), padded: true),
      );
      await tester.pump();
      double offset() => tester
          .state<ScrollableState>(find.descendant(of: find.byKey(const ValueKey('blog-rail')), matching: find.byType(Scrollable)))
          .position
          .pixels;
      expect(offset(), 0);
      Future<void> advance(Duration d) async {
        clock = clock.add(d);
        await tester.pump(d);
        await tester.pump(const Duration(milliseconds: 500));
      }

      await advance(const Duration(seconds: 5));
      final first = offset();
      expect(first, greaterThan(0));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('blog-rail'))));
      await gesture.up();
      await advance(const Duration(milliseconds: 4500));
      expect(offset(), first);
      await advance(const Duration(milliseconds: 4500));
      expect(offset(), greaterThan(first));
    });
  });
}
