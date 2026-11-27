// Ported from: src/hooks/useReferral.ts (pure parts: row mapping, statistics, redeem answer)

import '../js_compat.dart';

/// 'registered' | 'trial' | 'converted'
typedef ReferralStatus = String;

class ReferredUser {
  const ReferredUser({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.status,
    required this.isPremiumNow,
    required this.createdAt,
    required this.convertedAt,
    required this.rewarded,
    required this.rewardDays,
  });
  final String id;
  final String name;
  final String? avatarUrl;
  final ReferralStatus status;
  final bool isPremiumNow;
  final String? createdAt;
  final String? convertedAt;
  final bool rewarded;
  final num rewardDays;
}

class ReferralStats {
  const ReferralStats({
    required this.invitedCount,
    required this.trialCount,
    required this.premiumCount,
    required this.earnedDays,
    required this.redeemedAlready,
  });
  final int invitedCount;
  final int trialCount;
  final int premiumCount;
  final num earnedDays;
  final bool redeemedAlready;
}

bool _truthy(Object? v) => v != null && v != false && v != '' && v != 0;

/// `referrals` rows (referrer side) + `public_profile_cards` rows → the invited list.
List<ReferredUser> mapReferredRows(List<Map<String, Object?>> rows, List<Map<String, Object?>> cards, {Tr tr = azTr}) {
  final cardMap = <Object?, Map<String, Object?>>{for (final c in cards) c['user_id']: c};
  return [
    for (final r in rows)
      () {
        final card = cardMap[r['referred_user_id']];
        final name = card?['name'];
        final avatar = card?['avatar_url'];
        final status = r['status'];
        final reward = r['reward_days'];
        return ReferredUser(
          id: r['id'] as String,
          name: _truthy(name) ? name as String : tr('usecommunity_i_stifadeci_b6bdd6', 'İstifadəçi'),
          avatarUrl: _truthy(avatar) ? avatar as String : null,
          status: _truthy(status) ? status as String : 'registered',
          isPremiumNow: _truthy(card?['is_premium']),
          createdAt: r['created_at'] as String?,
          convertedAt: r['converted_at'] as String?,
          rewarded: _truthy(r['referrer_rewarded_at']),
          rewardDays: _truthy(reward) ? reward as num : 7,
        );
      }(),
  ];
}

ReferralStats referralStats(List<ReferredUser> referred, {bool redeemedAlready = false}) => ReferralStats(
      invitedCount: referred.length,
      trialCount: referred.where((r) => r.status == 'trial').length,
      premiumCount: referred.where((r) => r.status == 'converted').length,
      earnedDays: referred.where((r) => r.rewarded).fold<num>(0, (s, r) => s + r.rewardDays),
      redeemedAlready: redeemedAlready,
    );

/// redeem_referral_code answer → `{ success, error, rewardDays }`.
({bool success, Object? error, Object? rewardDays}) parseRedeemResult(Object? data) {
  final m = data is Map ? data : null;
  return (success: _truthy(m?['success']), error: m?['error'], rewardDays: m?['reward_days']);
}
