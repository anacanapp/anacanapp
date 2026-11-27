// Ported from: src/components/ReferralScreen.tsx + src/hooks/useReferral.ts (no vitest suite; cases for the port)
import 'package:anacan/features/profile/data/referral.dart';
import 'package:anacan/features/profile/partner_profile_screen.dart';
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/profile/profile_screen.dart' show profileAvatarBuilderProvider;
import 'package:anacan/features/profile/referral_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';

class FakeReferral implements ReferralRepository {
  FakeReferral({this.redeemed = false, this.answer = const {'success': true}});
  final bool redeemed;
  final Map<String, Object?> answer;
  final redeemedCodes = <String>[];
  int detailLoads = 0;
  @override
  Future<String?> code() async => 'AB12CD';
  @override
  Future<List<Map<String, Object?>>> cards(List<Object?> userIds) async => [
        {'user_id': 'u2', 'name': 'Nigar', 'avatar_url': null, 'is_premium': true},
      ];
  @override
  Future<Object?> redeem(String code) async {
    redeemedCodes.add(code);
    return answer;
  }

  @override
  Future<({List<Map<String, Object?>> rows, bool redeemedAlready})> referrals(String userId) async {
    detailLoads++;
    return (
      rows: <Map<String, Object?>>[
        {'id': 'r1', 'referred_user_id': 'u2', 'status': 'converted', 'reward_days': 7, 'converted_at': '2026-10-02T10:00:00Z', 'referrer_rewarded_at': '2026-10-02T10:00:00Z', 'created_at': '2026-09-20T10:00:00Z'},
        {'id': 'r2', 'referred_user_id': 'u3', 'status': 'registered', 'reward_days': null, 'converted_at': null, 'referrer_rewarded_at': null, 'created_at': '2026-10-20T10:00:00Z'},
      ],
      redeemedAlready: redeemed,
    );
  }
}

void main() {
  setUpAll(loadAnacanFonts);

  screenTest('shows the code, the stats and the invited list', (tester) async {
    await pumpApp(tester, ReferralScreen(onBack: () {}), scroll: false, overrides: [
      ...baseOverrides(),
      referralRepositoryProvider.overrideWithValue(FakeReferral()),
      profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
    ]);
    await tester.pumpAndSettle();
    expect(find.text('AB12CD'), findsOneWidget);
    expect(find.text('Nigar'), findsOneWidget);
    expect(find.text('İstifadəçi'), findsOneWidget);
    expect(find.text('+7 gün ✓'), findsOneWidget);
    expect(find.text('7'), findsOneWidget); // earned days
  });

  screenTest('redeems an upper-cased code and refreshes the details', (tester) async {
    final repo = FakeReferral();
    await pumpApp(tester, ReferralScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), referralRepositoryProvider.overrideWithValue(repo)]);
    await tester.pumpAndSettle();
    final before = repo.detailLoads;
    await tester.enterText(find.byKey(const ValueKey<String>('referral-input')), 'xy12');
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey<String>('referral-redeem')));
    await tester.tap(find.byKey(const ValueKey<String>('referral-redeem')));
    await tester.pumpAndSettle();
    expect(repo.redeemedCodes, ['XY12']);
    expect(repo.detailLoads, greaterThan(before));
    expect(find.text('Təbriklər! 🎉'), findsOneWidget);
  });

  screenTest('own-code answer shows the specific error', (tester) async {
    final repo = FakeReferral(answer: const {'success': false, 'error': 'own_code'});
    await pumpApp(tester, ReferralScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), referralRepositoryProvider.overrideWithValue(repo)]);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey<String>('referral-input')), 'AB12CD');
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey<String>('referral-redeem')));
    await tester.tap(find.byKey(const ValueKey<String>('referral-redeem')));
    await tester.pumpAndSettle();
    expect(find.text('Öz kodunuzu istifadə edə bilməzsiniz'), findsOneWidget);
  });

  screenTest('redeem box hidden once a code was redeemed', (tester) async {
    await pumpApp(tester, ReferralScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), referralRepositoryProvider.overrideWithValue(FakeReferral(redeemed: true))]);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey<String>('referral-input')), findsNothing);
  });

  test('achievement unlock rules', () {
    const d = PartnerProfileData(completedSurprises: 3, surprisePoints: 100, lovesSent: 6, messagesSent: 4, completedMissions: 2);
    bool u(String cond, int t) => achievementUnlocked({'unlock_condition': cond, 'unlock_threshold': t}, d);
    expect(u('always_unlocked', 0), isTrue);
    expect(u('completed_surprises', 3), isTrue);
    expect(u('completed_surprises', 10), isFalse);
    expect(u('messages_sent', 10), isTrue);
    expect(u('missions_completed', 7), isFalse);
  });

  screenTest('partner profile menu falls back to the bundled items and navigates', (tester) async {
    final opened = <String>[];
    await pumpApp(tester, PartnerProfileScreen(onNavigate: opened.add), overrides: [
      ...baseOverrides(store: seededStore(user: {'role': 'partner', 'name': 'Elvin'})),
      profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
    ], size: const Size(390, 1600));
    await tester.pumpAndSettle();
    for (final id in ['partner-notifications', 'notifications', 'partner-privacy', 'help', 'settings']) {
      expect(find.byKey(ValueKey<String>('partner-menu-$id')), findsOneWidget, reason: id);
    }
    await tester.tap(find.byKey(const ValueKey<String>('partner-menu-help')));
    expect(opened, ['help']);
  });

  group('goldens', () {
    for (final dark in [false, true]) {
      screenTest('referral ${dark ? 'dark' : 'light'}', (tester) async {
        await pumpApp(tester, ReferralScreen(onBack: () {}), scroll: false, dark: dark, overrides: [
          ...baseOverrides(),
          referralRepositoryProvider.overrideWithValue(FakeReferral()),
          profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
        ]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'referral_${dark ? 'dark' : 'light'}');
      });
      screenTest('partner profile ${dark ? 'dark' : 'light'}', (tester) async {
        await pumpApp(tester, const PartnerProfileScreen(), dark: dark, overrides: [
          ...baseOverrides(store: seededStore(user: {'role': 'partner', 'name': 'Elvin'}), profile: testProfile({'linked_partner_id': 'w1'})),
          partnerProfileDataProvider.overrideWithValue(const PartnerProfileData(partnerName: 'Leyla', partnerStage: 'bump', pregnancyWeek: 24, totalPoints: 120, level: 3, levelProgress: 40, pointsToNextLevel: 30, completedSurprises: 4)),
          profileAvatarBuilderProvider.overrideWithValue((_) => const SizedBox()),
        ]);
        await expectGolden(tester, 'partner_profile_${dark ? 'dark' : 'light'}');
      });
    }
  });
}
