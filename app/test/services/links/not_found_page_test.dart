// Ported from: src/pages/AppPathLink.test.tsx ('shows the 404 card for unknown paths'; the known-path cases are in
// test/shell/router_test.dart) and covers src/pages/NotFound.tsx.
import 'package:anacan/services/links/not_found_page.dart';
import 'package:anacan/services/links/register.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../features/settings/support/harness.dart';

void main() {
  group('AppPathLink', () {
    testWidgets('shows the 404 card for unknown paths', (tester) async {
      var home = 0;
      await pumpApp(tester, NotFoundPage(path: '/does-not-exist', onHome: () => home++), scroll: false);
      await tester.pump();
      expect(find.text('404'), findsOneWidget);
      expect(find.text('🧭'), findsOneWidget);
      expect(find.text('Oops! Page not found'), findsOneWidget);
      await tester.tap(find.text('Return to Home'));
      expect(home, 1);
    });
  });

  test('registers the 404 outer page', () {
    final r = FeatureRegistry();
    registerLinksServiceFeature(r);
    expect(r.routePage(OuterRouteId.notFound), isNotNull);
    final page = r.routePage(OuterRouteId.notFound)!(_FakeContext(), OuterRouteArgs(uri: Uri.parse('/404?from=%2Fnope')));
    expect((page as NotFoundPage).path, '/nope');
  });
}

class _FakeContext extends Fake implements BuildContext {}
