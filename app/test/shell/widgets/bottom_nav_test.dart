// Ported from: src/components/BottomNav.tsx (tabs per role, active state, badges, capsule vs classic, RTL).
// Goldens are Flutter renders only — not compared against browser screenshots.
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:anacan/shell/shell.dart';
import 'dart:ui' show Tristate;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import '../nav/shell_test_support.dart';

Widget frame(Widget child, {bool dark = false, bool rtl = false, bool noBlur = false, double height = 120}) {
  return MediaQuery(
    data: MediaQueryData(size: Size(390, height), padding: const EdgeInsets.only(bottom: 0)),
    child: GalleryFrame(
      dark: dark,
      rtl: rtl,
      child: Builder(builder: (context) {
        final t = AnacanTokens.of(context);
        // Something behind the glass so blur/translucency is visible in the goldens.
        return Stack(children: [
          Positioned.fill(child: ColoredBox(color: t.a.bg)),
          Positioned(left: 0, right: 0, top: 30, height: 40, child: ColoredBox(color: t.a.coral)),
          Align(alignment: Alignment.bottomCenter, child: child),
        ]);
      }),
    ),
  );
}

Future<void> pumpNav(WidgetTester tester, BottomNavBar nav, {bool dark = false, bool rtl = false, double height = 120}) async {
  tester.view.physicalSize = Size(390, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(frame(nav, dark: dark, rtl: rtl, height: height));
  await settleSvgs(tester);
}

BottomNavBar nav({
  ShellTab active = ShellTab.home,
  bool partner = false,
  BottomNavStyle style = BottomNavStyle.capsule,
  int unread = 0,
  int community = 0,
  ValueChanged<ShellTab>? onTap,
  String? name = 'Aysel',
}) =>
    BottomNavBar(
      activeTab: active,
      onTabChange: onTap ?? (_) {},
      isPartner: partner,
      style: style,
      unreadMessages: unread,
      communityUnread: community,
      displayName: name,
    );

/// Index (in visual left-to-right order) of the item painted as active.
List<ShellTab> visualOrder(WidgetTester tester, List<ShellTab> tabs) {
  final xs = {for (final t in tabs) t: tester.getCenter(find.byKey(BottomNavBar.itemKey(t))).dx};
  return [...tabs]..sort((a, b) => xs[a]!.compareTo(xs[b]!));
}

ShellTab? activeByPaint(WidgetTester tester, List<ShellTab> tabs, Color activeColor) {
  for (final t in tabs) {
    final containers = find.descendant(of: find.byKey(BottomNavBar.itemKey(t)), matching: find.byType(AnimatedContainer));
    for (final e in containers.evaluate()) {
      final d = (e.widget as AnimatedContainer).decoration;
      if (d is BoxDecoration && d.color == activeColor) return t;
    }
  }
  return null;
}

void main() {
  setUpAll(loadAnacanFonts);
  final womanTabs = kWomanNavTabs.map((t) => t.tab).toList();
  final partnerTabs = kPartnerNavTabs.map((t) => t.tab).toList();

  group('tabs per role', () {
    testWidgets('woman: home, tools, community, AI pill, profile — labels as aria-labels', (tester) async {
      await pumpNav(tester, nav());
      expect(visualOrder(tester, womanTabs), womanTabs);
      for (final label in ['Əsas', 'Alətlər', 'Cəmiyyət', 'Anacan.AI', 'Profil']) {
        expect(find.bySemanticsLabel(label), findsOneWidget, reason: label);
      }
      expect(find.text('Əsas'), findsNothing, reason: 'capsule is icons only');
    });

    testWidgets('partner: home, together, chat, advice pill, profile', (tester) async {
      await pumpNav(tester, nav(partner: true));
      expect(visualOrder(tester, partnerTabs), partnerTabs);
      for (final label in ['Bu gün', 'Birlikdə', 'Mesajlar', 'Məsləhət', 'Profil']) {
        expect(find.bySemanticsLabel(label), findsOneWidget, reason: label);
      }
    });

    testWidgets('classic style shows labels', (tester) async {
      await pumpNav(tester, nav(style: BottomNavStyle.classic));
      for (final label in ['Əsas', 'Alətlər', 'Cəmiyyət', 'Anacan.AI', 'Profil']) {
        expect(find.text(label), findsOneWidget);
      }
    });

    testWidgets('tap reports the tab', (tester) async {
      final taps = <ShellTab>[];
      await pumpNav(tester, nav(onTap: taps.add));
      for (final t in womanTabs) {
        await tester.tap(find.byKey(BottomNavBar.itemKey(t)));
      }
      await tester.pump(const Duration(milliseconds: 300));
      expect(taps, womanTabs);
    });
  });

  group('active indicator (per-item bubble)', () {
    for (final style in BottomNavStyle.values) {
      testWidgets('one active item per tab, at the tab position (${style.name})', (tester) async {
        for (final t in womanTabs) {
          await pumpNav(tester, nav(active: t, style: style));
          await tester.pump(const Duration(milliseconds: 300));
          final ctx = tester.element(find.byType(BottomNavBar));
          final tokens = AnacanTokens.of(ctx);
          final color = style == BottomNavStyle.capsule ? tokens.navCapsule.bubble : tokens.a.peach1;
          expect(activeByPaint(tester, womanTabs, color), t);
          final selected = tester.getSemantics(find.byKey(BottomNavBar.itemKey(t)));
          expect(selected.flagsCollection.isSelected, Tristate.isTrue);
        }
      });
    }

    testWidgets('RTL mirrors the order: home is rightmost', (tester) async {
      await pumpNav(tester, nav(active: ShellTab.tools), rtl: true);
      expect(visualOrder(tester, womanTabs), womanTabs.reversed.toList());
      final ctx = tester.element(find.byType(BottomNavBar));
      expect(activeByPaint(tester, womanTabs, AnacanTokens.of(ctx).navCapsule.bubble), ShellTab.tools);
    });

    testWidgets('capsule geometry: 52 px items, ≤ 64 px wide, 360 px max, 12 px above the bottom', (tester) async {
      await pumpNav(tester, nav());
      final item = tester.getSize(find.byKey(BottomNavBar.itemKey(ShellTab.home)));
      expect(item.height, 52);
      expect(item.width, 64);
      final navRect = tester.getRect(find.byType(AGlass));
      expect(navRect.width, 358, reason: 'min(360, 390 - 2·16)');
      expect(navRect.height, 66, reason: '52 + 2·6 padding + 2·1 border');
      expect(120 - navRect.bottom, 12);
    });
  });

  group('badges', () {
    testWidgets('unread messages on home (women) with 9+ cap; community with 99+ cap', (tester) async {
      await pumpNav(tester, nav(unread: 3, community: 7));
      expect(find.descendant(of: find.byKey(BottomNavBar.itemKey(ShellTab.home)), matching: find.text('3')), findsOneWidget);
      expect(find.descendant(of: find.byKey(BottomNavBar.itemKey(ShellTab.community)), matching: find.text('7')), findsOneWidget);
      await pumpNav(tester, nav(unread: 12, community: 150));
      expect(find.text('9+'), findsOneWidget);
      expect(find.text('99+'), findsOneWidget);
      await pumpNav(tester, nav());
      expect(find.byKey(const ValueKey('nav-badge')), findsNothing);
    });

    testWidgets('partner: unread on chat, never a community badge', (tester) async {
      await pumpNav(tester, nav(partner: true, unread: 2, community: 5));
      expect(find.descendant(of: find.byKey(BottomNavBar.itemKey(ShellTab.chat)), matching: find.text('2')), findsOneWidget);
      expect(find.text('5'), findsNothing);
      expect(find.byKey(const ValueKey('nav-badge')), findsOneWidget);
    });

    testWidgets('badge sits at 50% + 4px from the inline start (mirrored in RTL)', (tester) async {
      await pumpNav(tester, nav(unread: 1));
      final item = tester.getRect(find.byKey(BottomNavBar.itemKey(ShellTab.home)));
      final badge = tester.getRect(find.byKey(const ValueKey('nav-badge')));
      expect(badge.left, closeTo(item.left + item.width / 2 + 4, 0.01));
      expect(badge.top, closeTo(item.top + 7, 0.01));
      await pumpNav(tester, nav(unread: 1), rtl: true);
      final itemR = tester.getRect(find.byKey(BottomNavBar.itemKey(ShellTab.home)));
      final badgeR = tester.getRect(find.byKey(const ValueKey('nav-badge')));
      expect(badgeR.right, closeTo(itemR.right - itemR.width / 2 - 4, 0.01));
    });
  });

  testWidgets('capsule profile tab shows the name initial', (tester) async {
    await pumpNav(tester, nav(name: ' aysel'));
    expect(find.text('A'), findsOneWidget);
  });

  testWidgets('BottomNavCapsule reads the inputs and hides for a full-screen chat', (tester) async {
    final container = ProviderContainer(overrides: [
      shellUserProvider.overrideWithValue(kWoman),
      unreadMessagesCountProvider.overrideWithValue(4),
      unreadCommunityPostsCountProvider.overrideWithValue(0),
      bottomNavStyleProvider.overrideWithValue(BottomNavStyle.capsule),
    ]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: frame(BottomNavCapsule(activeTab: ShellTab.home, onTabChange: (_) {}, isPartner: false)),
    ));
    await settleSvgs(tester);
    expect(find.text('4'), findsOneWidget);
    expect(find.text('F'), findsOneWidget, reason: 'Fixture User initial');
    container.read(fullScreenChatLeasesProvider.notifier).acquire();
    await tester.pump();
    expect(find.byType(BottomNavBar), findsNothing);
    container.read(fullScreenChatLeasesProvider.notifier).release();
    await tester.pump();
    expect(find.byType(BottomNavBar), findsOneWidget);
  });

  group('goldens', () {
    Future<void> golden(WidgetTester tester, String name, BottomNavBar n, {bool dark = false, bool rtl = false}) async {
      await pumpNav(tester, n, dark: dark, rtl: rtl);
      await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/$name.png'));
    }

    testWidgets('capsule light', (t) => golden(t, 'nav_capsule_light', nav(unread: 3, community: 12)));
    testWidgets('capsule dark', (t) => golden(t, 'nav_capsule_dark', nav(active: ShellTab.community, unread: 3, community: 12), dark: true));
    testWidgets('capsule rtl', (t) => golden(t, 'nav_capsule_rtl', nav(active: ShellTab.ai, unread: 3), rtl: true));
    testWidgets('capsule partner', (t) => golden(t, 'nav_capsule_partner', nav(partner: true, active: ShellTab.chat, unread: 2)));
    testWidgets('classic light', (t) => golden(t, 'nav_classic_light', nav(style: BottomNavStyle.classic, active: ShellTab.tools, unread: 3)));
    testWidgets('classic dark', (t) => golden(t, 'nav_classic_dark', nav(style: BottomNavStyle.classic, unread: 12), dark: true));
  });
}
