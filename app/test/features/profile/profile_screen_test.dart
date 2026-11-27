// Ported from: src/components/ProfileScreen.tsx (menu composition per role / stage / admin / moderator — no vitest
//              suite exists for this component; cases written for the port)
import 'package:anacan/features/profile/data/children.dart';
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/profile/profile_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

/// The children part of the shared useChildren port (features/baby) over in-memory rows; every other
/// BabyRepository call is unused by the profile.
class FakeChildren implements BabyRepository {
  FakeChildren([List<Map<String, dynamic>>? rows]) : rows = rows ?? [];
  final List<Map<String, dynamic>> rows;
  final inserted = <Map<String, dynamic>>[];
  @override
  Future<List<Map<String, dynamic>>> loadActiveChildren(String userId) async => rows.where((r) => r['is_active'] != false).toList();
  @override
  Future<Map<String, dynamic>?> loadProfileBabyFields(String userId) async => null;
  @override
  Future<void> insertChildRow(Map<String, dynamic> row) async {}
  @override
  Future<Map<String, dynamic>?> insertChild(Map<String, dynamic> row) async {
    final r = {'id': 'c${rows.length + 1}', ...row};
    inserted.add(r);
    rows.add(r);
    return r;
  }

  @override
  Future<void> updateChild(String childId, String userId, Map<String, dynamic> patch) async {
    final r = rows.firstWhere((x) => x['id'] == childId);
    r.addAll(patch);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class RecordingPremium implements PremiumPrompt {
  int shown = 0;
  @override
  Future<void> show(BuildContext context, {String? feature}) async => shown++;
}

List<Override> profileOverrides({String stage = 'bump', String role = 'woman', bool admin = false, bool moderator = false, bool premium = false, FakeChildren? children, String? layout, PremiumPrompt? prompt}) => [
      ...baseOverrides(store: seededStore(user: {'lifeStage': stage, 'role': role}), isAdmin: admin, isModerator: moderator),
      babyRepositoryProvider.overrideWithValue(children ?? FakeChildren()),
      subscriptionIsPremiumProvider.overrideWithValue(premium),
      profileLayoutSettingProvider.overrideWithValue(layout),
      profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
      if (prompt != null) premiumPromptProvider.overrideWithValue(prompt),
    ];

bool hasRow(String id) => find.byKey(ValueKey<String>('profile-row-$id')).evaluate().isNotEmpty;

void main() {
  setUpAll(loadAnacanFonts);
  setUp(resetProfileSessionTab);

  Future<List<String>> open(WidgetTester tester, List<Override> o, {required void Function(String) nav}) async {
    await pumpApp(tester, ProfileScreen(onNavigate: nav), overrides: o, size: const Size(390, 2400));
    return [];
  }

  screenTest('me tab lists billing, referral, gift code, partners and doctor report', (tester) async {
    await open(tester, profileOverrides(), nav: (_) {});
    for (final id in ['billing', 'referral', 'gift-code', 'partners', 'doctor-report']) {
      expect(hasRow(id), isTrue, reason: id);
    }
    expect(hasRow('qaygicash'), isFalse);
  });

  screenTest('settings tab: widgets only for bump/mommy; moderator and admin rows by role', (tester) async {
    await open(tester, profileOverrides(stage: 'flow'), nav: (_) {});
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-settings')));
    await tester.pump();
    expect(hasRow('appearance'), isTrue);
    expect(hasRow('widgets'), isFalse);
    expect(hasRow('moderation-history'), isTrue);
    expect(hasRow('moderator'), isFalse);
    expect(hasRow('admin'), isFalse);
    expect(hasRow('legal/privacy_policy'), isTrue);
  });

  screenTest('admin sees moderator console, shop and admin rows; admin opens the web admin hook', (tester) async {
    final opened = <String>[];
    await open(tester, profileOverrides(admin: true), nav: opened.add);
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-settings')));
    await tester.pump();
    expect(hasRow('widgets'), isTrue);
    expect(hasRow('moderator'), isTrue);
    expect(hasRow('shop'), isTrue);
    await tester.ensureVisible(find.byKey(const ValueKey<String>('profile-row-admin')));
    await tester.tap(find.byKey(const ValueKey<String>('profile-row-admin')));
    expect(opened, ['admin']);
  });

  screenTest('moderator (not admin) gets the console row but no admin rows', (tester) async {
    await open(tester, profileOverrides(moderator: true), nav: (_) {});
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-settings')));
    await tester.pump();
    expect(hasRow('moderator'), isTrue);
    expect(hasRow('admin'), isFalse);
  });

  screenTest('family tab: partner code card for women, children card for mommy', (tester) async {
    await open(tester, profileOverrides(stage: 'mommy', children: FakeChildren([
      {'id': 'c1', 'name': 'Murad', 'birth_date': '2026-05-01', 'gender': 'boy', 'avatar_emoji': '👦', 'is_active': true},
    ])), nav: (_) {});
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-family')));
    await tester.pumpAndSettle();
    expect(find.text('Murad'), findsOneWidget);
    expect(find.text('Partnyor Kodu'), findsOneWidget);
  });

  screenTest('partner role without mommy stage hides the family tab', (tester) async {
    await open(tester, profileOverrides(role: 'partner', stage: 'bump'), nav: (_) {});
    expect(find.byKey(const ValueKey<String>('profile-tab-family')), findsNothing);
  });

  screenTest('non-premium partner code opens the premium prompt', (tester) async {
    final prompt = RecordingPremium();
    await open(tester, profileOverrides(prompt: prompt), nav: (_) {});
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-family')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey<String>('partner-code-unlock')));
    expect(prompt.shown, 1);
  });

  screenTest('classic layout renders the menu list and the legal section', (tester) async {
    await open(tester, profileOverrides(layout: 'classic'), nav: (_) {});
    await tester.pumpAndSettle();
    expect(hasRow('billing'), isTrue);
    expect(hasRow('help'), isTrue);
    expect(find.text('Hüquqi'), findsOneWidget);
  });

  screenTest('adds a child through the dialog', (tester) async {
    final repo = FakeChildren();
    await open(tester, profileOverrides(stage: 'mommy', children: repo), nav: (_) {});
    await tester.tap(find.byKey(const ValueKey<String>('profile-tab-family')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('children-add')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey<String>('child-name')).first, 'Aylin');
    await tester.tap(find.byKey(const ValueKey<String>('child-submit')));
    await tester.pump();
    expect(repo.inserted, isEmpty, reason: 'birth date is required');
  });

  test('gestational weeks round-trip with the EDD (UTC)', () {
    expect(gestWeeksFromDueDate('2026-01-01', '2026-01-01'), 40);
    expect(dueDateFromGestWeeks('2026-01-01', 34), '2026-02-12');
    expect(gestWeeksFromDueDate('2026-01-01', '2026-02-12'), 34);
    expect(gestWeeksFromDueDate('2026-01-01', '2026-06-01'), 22);
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      screenTest('profile bump ${dark ? 'dark' : 'light'}', (tester) async {
        await pumpApp(tester, ProfileScreen(onNavigate: (_) {}), overrides: profileOverrides(premium: true), dark: dark);
        await expectGolden(tester, 'profile_bump_${dark ? 'dark' : 'light'}');
      });
    }
    screenTest('profile settings tab light', (tester) async {
      await pumpApp(tester, ProfileScreen(onNavigate: (_) {}), overrides: profileOverrides(premium: true));
      await tester.tap(find.byKey(const ValueKey<String>('profile-tab-settings')));
      await tester.pump();
      await expectGolden(tester, 'profile_settings_light');
    });
    screenTest('profile rtl', (tester) async {
      await pumpApp(tester, ProfileScreen(onNavigate: (_) {}), overrides: profileOverrides(premium: true), rtl: true);
      await expectGolden(tester, 'profile_rtl');
    });
  });
}
