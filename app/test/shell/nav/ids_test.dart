// Ported from: src/lib/merged-tools.test.ts (+ id tables of Index.tsx / ToolsHub.tsx / BottomNav.tsx)
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter_test/flutter_test.dart';

bool Function(String) all(List<String> ids) => ids.contains;

const woman = ShellGuardContext(role: 'woman', lifeStage: 'mommy', isAdmin: false, language: 'az', cakesAvailable: true);
const partner = ShellGuardContext(role: 'partner', lifeStage: 'partner', isAdmin: false, language: 'az', cakesAvailable: true);

void main() {
  group('merged tools', () {
    test('opens a child on its host section when the host is available', () {
      final av = all(['mental-health', 'baby-tracker', 'blood-pressure', 'whitenoise']);
      expect(resolveToolTarget('mood', av), (host: 'mental-health', section: 'mood'));
      expect(resolveToolTarget('mood-diary', av), (host: 'mental-health', section: 'mood'));
      expect(resolveToolTarget('teething-tracker', av), (host: 'baby-tracker', section: 'teething'));
      expect(resolveToolTarget('growth-tracker', av), (host: 'baby-tracker', section: 'baby-growth'));
      expect(resolveToolTarget('blood-sugar', av), (host: 'blood-pressure', section: 'blood-sugar'));
      expect(resolveToolTarget('noise-meter', av), (host: 'whitenoise', section: 'noise-meter'));
      expect(resolveToolTarget('kick', av), (host: 'kick', section: 'kick'));
    });

    test('keeps a child standalone where its host is not available (e.g. mood in the cycle stage)', () {
      final av = all(['mood']);
      expect(resolveToolTarget('mood', av), (host: 'mood', section: 'mood'));
      expect(isMergedAway('mood', av), isFalse);
      expect(isMergedAway('mood', all(['mental-health'])), isTrue);
      expect(canonicalToolId('white-noise'), 'whitenoise');
    });
  });

  test('tool ids: 48 canonical ids, every alias resolves, unknown ids stay null', () {
    expect(ToolId.values, hasLength(48));
    final aliases = {for (final t in ToolId.values) for (final a in t.aliases) a: t};
    expect(aliases, hasLength(11));
    for (final e in aliases.entries) {
      expect(ToolId.tryParse(e.key), e.value);
    }
    expect(ToolId.tryParse('kick-counter'), isNull);
    final ids = ToolId.values.map((t) => t.id).toList();
    expect(ids.toSet(), hasLength(ids.length));
  });

  test('tabs per role in nav order, the AI pill is the 4th', () {
    expect(kWomanNavTabs.map((t) => t.tab.id), ['home', 'tools', 'community', 'ai', 'profile']);
    expect(kPartnerNavTabs.map((t) => t.tab.id), ['home', 'together', 'chat', 'ai', 'profile']);
    expect(kWomanNavTabs.where((t) => t.special).single.tab, ShellTab.ai);
    expect(kPartnerNavTabs.where((t) => t.special).single.tab, ShellTab.ai);
  });

  test('tab content per role (renderContent)', () {
    for (final t in [ShellTab.home, ShellTab.tools, ShellTab.community, ShellTab.ai, ShellTab.profile, ShellTab.cakes]) {
      expect(tabHasContent(t, woman), isTrue, reason: t.id);
    }
    expect(tabHasContent(ShellTab.together, woman), isFalse);
    expect(tabHasContent(ShellTab.chat, woman), isFalse);
    expect(tabHasContent(ShellTab.cakes, const ShellGuardContext(role: 'woman', lifeStage: 'bump', isAdmin: false, language: 'en', cakesAvailable: false)), isFalse);
    expect(tabHasContent(ShellTab.cakes, const ShellGuardContext(role: 'woman', lifeStage: 'bump', isAdmin: true, language: 'en', cakesAvailable: false)), isTrue);
    for (final t in [ShellTab.home, ShellTab.together, ShellTab.chat, ShellTab.ai, ShellTab.profile, ShellTab.community]) {
      expect(tabHasContent(t, partner), isTrue, reason: t.id);
    }
    expect(tabHasContent(ShellTab.tools, partner), isFalse);
    expect(tabHasContent(ShellTab.cakes, partner), isFalse);
  });

  test('isCakesAvailable', () {
    expect(isCakesAvailable(null, null), isTrue);
    expect(isCakesAvailable('AZ', 'ru'), isTrue);
    expect(isCakesAvailable('TR', 'az'), isFalse);
    expect(isCakesAvailable('AZ', 'en'), isFalse);
    expect(isCakesAvailable('', 'az'), isFalse);
  });

  group('screens', () {
    test('51 ids incl. admin; parameterised prefixes', () {
      expect(ScreenId.values, hasLength(51));
      expect(ShellScreen.tryParse('legal/privacy_policy'), const ShellScreen(ScreenId.legal, 'legal/privacy_policy', 'privacy_policy'));
      expect(ShellScreen.tryParse('blog/'), const ShellScreen(ScreenId.blog, 'blog/', ''));
      expect(ShellScreen.tryParse('blog'), const ShellScreen(ScreenId.blog, 'blog'));
      expect(ShellScreen.tryParse('aptek/p:123'), const ShellScreen(ScreenId.aptek, 'aptek/p:123', 'p:123'));
      expect(ShellScreen.tryParse('recovery/kegel')!.id, ScreenId.recoveryKegel);
      expect(ShellScreen.tryParse('loss-guide/signs')!.id, ScreenId.lossGuideSigns);
      expect(ShellScreen.tryParse('settings/x'), isNull);
      expect(ShellScreen.tryParse('subscriptions'), isNull);
    });

    final guards = <String, (bool woman, bool partner)>{
      'mommy-period': (true, false),
      'settings': (true, true),
      'books': (true, true),
      'recovery': (true, false),
      'recovery/kegel': (true, false),
      'shop': (false, false),
      'name-voting': (false, true),
      'partner-shopping': (false, true),
      'partner-parenting': (false, true),
      'hospital-run': (false, true),
      'live-contractions': (false, true),
      'partner-sharing': (true, false),
      'night-shift': (true, true),
      'loss-guide': (true, false),
      'loss-memories': (true, false),
      'partner-loss-support': (false, true),
      'baby-chat': (false, false),
      'partner-notifications': (true, true),
      'admin': (false, false),
      'aptek/cart': (true, true),
    };
    for (final e in guards.entries) {
      test('guard ${e.key}', () {
        expect(resolveSubScreen(e.key, woman) != null, e.value.$1, reason: 'woman');
        expect(resolveSubScreen(e.key, partner) != null, e.value.$2, reason: 'partner');
      });
    }

    test('stage, admin and language guards', () {
      const bump = ShellGuardContext(role: 'woman', lifeStage: 'bump', isAdmin: false, language: 'en', cakesAvailable: false);
      expect(resolveSubScreen('baby-chat', bump), isNotNull);
      expect(resolveSubScreen('mommy-period', bump), isNull);
      expect(resolveSubScreen('books', bump), isNull);
      expect(resolveSubScreen('my-books', bump), isNull);
      const admin = ShellGuardContext(role: 'woman', lifeStage: 'bump', isAdmin: true, language: 'en', cakesAvailable: false);
      expect(resolveSubScreen('books', admin), isNotNull);
      expect(resolveSubScreen('shop', admin), isNotNull);
      expect(resolveSubScreen('admin', admin), isNull, reason: 'admin is an effect, not a sub-screen');
    });

    test('initialAptekView', () {
      expect(initialAptekView('aptek'), (name: 'home', id: null));
      expect(initialAptekView('aptek/cart'), (name: 'cart', id: null));
      expect(initialAptekView('aptek/orders'), (name: 'orders', id: null));
      expect(initialAptekView('aptek/p:42'), (name: 'product', id: '42'));
    });
  });
}
