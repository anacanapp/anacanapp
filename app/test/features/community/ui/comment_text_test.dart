// Ported from: src/components/community/CommentText.test.tsx
import 'package:anacan/features/community/ui/comment_text.dart';
import 'package:anacan/features/community/ui/user_badge.dart';
import 'package:anacan/features/settings/ui/settings_ui.dart' show cssUpper;
import 'package:anacan/shell/links/deeplink.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

List<CommentSegment> links(String content, {bool allowLinks = true}) =>
    [for (final s in commentSegments(content, allowLinks: allowLinks)) if (s.kind != CommentLinkKind.text) s];

void main() {
  test('keeps non-staff links as text and renders safe staff HTTP(S) links', () {
    expect(links('Look https://example.com/page.', allowLinks: false), isEmpty);
    final staff = links('Look https://example.com/page.');
    expect(staff.single.href, 'https://example.com/page');
    expect(staff.single.kind, CommentLinkKind.external);
    expect(staff.single.trail, '.');
  });

  test('does not render script URLs or raw HTML as an executable link', () {
    final segments = commentSegments('javascript:alert(1) <script>alert(1)</script>', allowLinks: true);
    expect(segments.where((s) => s.kind != CommentLinkKind.text), isEmpty);
    expect(segments.map((s) => s.text).join(), 'javascript:alert(1) <script>alert(1)</script>');
  });

  testWidgets('shows Premium for a paid member and alongside a staff badge, but respects explicit expiry', (tester) async {
    await pumpCommunity(tester, const UserBadge(type: null, premium: true), overrides: communityOverrides(backend: FakeCommunityBackend()));
    expect(find.text(cssUpper('Premium')), findsOneWidget);
    await pumpCommunity(tester, const UserBadge(type: 'admin', premium: true), overrides: communityOverrides(backend: FakeCommunityBackend()));
    expect(find.text(cssUpper('Premium')), findsOneWidget);
    expect(find.text(cssUpper('İdarəçi')), findsOneWidget);
    await pumpCommunity(tester, const UserBadge(type: 'premium', premium: false), overrides: communityOverrides(backend: FakeCommunityBackend()));
    expect(find.text(cssUpper('Premium')), findsNothing);
    await flushCommunity(tester);
  });

  testWidgets('opens app links the router knows in-app and leaves other links as browser links', (tester) async {
    const content = 'Bax:\nhttps://app.anacan.az/parenting/sos/shop-tantrum\nanacan://tool/names, https://example.com/x https://app.anacan.az/unknown/path';
    final found = links(content);
    expect(found.map((s) => s.href).toList(),
        ['https://app.anacan.az/parenting/sos/shop-tantrum', 'anacan://tool/names', 'https://example.com/x', 'https://app.anacan.az/unknown/path']);
    expect(found[0].kind, CommentLinkKind.inApp);
    expect(found[1].kind, CommentLinkKind.inApp);
    expect(found[2].kind, CommentLinkKind.external);
    expect(found[3].kind, CommentLinkKind.external);

    final seen = <ParsedDeeplink>[];
    final external = <String>[];
    await pumpCommunity(
      tester,
      const CommentText(content: content, allowLinks: true),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend()),
        communityLinkOpenerProvider.overrideWithValue(CommunityLinkOpener(openBlog: (_) {}, openDeeplink: seen.add, openExternal: external.add)),
      ],
    );
    await tester.tapOnText(find.textRange.ofSubstring('https://app.anacan.az/parenting/sos/shop-tantrum'));
    await tester.tapOnText(find.textRange.ofSubstring('anacan://tool/names'));
    expect(seen, [
      const ParsedDeeplink('tool', {'tool_id': 'parenting', 'parenting_kind': 'sos', 'parenting_id': 'shop-tantrum'}),
      const ParsedDeeplink('tool', {'tool_id': 'names'}),
    ]);
    await tester.tapOnText(find.textRange.ofSubstring('https://example.com/x'));
    expect(external, ['https://example.com/x']);
    expect(find.byType(Text), findsWidgets);
    await flushCommunity(tester);
  });
}
