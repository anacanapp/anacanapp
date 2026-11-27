// Tests for app/lib/domain/referral/referral.dart (useReferral.ts has no vitest suite; values follow its rules).

import 'package:anacan/domain/referral/referral.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps referrals with public cards and fallbacks, and computes the stats', () {
    final list = mapReferredRows([
      {'id': 'r1', 'referred_user_id': 'u1', 'status': 'converted', 'reward_days': 14, 'referrer_rewarded_at': '2026-11-01', 'created_at': 'c'},
      {'id': 'r2', 'referred_user_id': 'u2', 'status': null, 'reward_days': null, 'referrer_rewarded_at': null, 'created_at': 'c'},
      {'id': 'r3', 'referred_user_id': 'u3', 'status': 'trial', 'reward_days': 0, 'referrer_rewarded_at': 'x', 'created_at': 'c'},
    ], [
      {'user_id': 'u1', 'name': 'Aynur', 'avatar_url': '', 'is_premium': true},
    ]);
    expect([list[0].name, list[0].avatarUrl, list[0].isPremiumNow, list[0].rewardDays], ['Aynur', null, true, 14]);
    expect([list[1].name, list[1].status, list[1].rewardDays, list[1].rewarded], ['İstifadəçi', 'registered', 7, false]);
    final stats = referralStats(list, redeemedAlready: true);
    expect([stats.invitedCount, stats.trialCount, stats.premiumCount, stats.earnedDays, stats.redeemedAlready], [3, 1, 1, 21, true]);
  });
  test('reads the redeem answer', () {
    expect(parseRedeemResult({'success': true, 'reward_days': 7}), (success: true, error: null, rewardDays: 7));
    expect(parseRedeemResult(null).success, false);
  });
}
