// Ported from: src/hooks/useReferral.ts
//
// `['referral-code', uid]` (rpc get_or_create_referral_code, stale ∞), `['referral-details', uid]` (referrals +
// public_profile_cards), redeem mutation (rpc redeem_referral_code → invalidate `referral-details`).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/i18n.dart';
import '../../../domain/referral/referral.dart';

export '../../../domain/referral/referral.dart' show ReferredUser, ReferralStats, referralStats;

abstract interface class ReferralRepository {
  Future<String?> code();
  Future<({List<Map<String, Object?>> rows, bool redeemedAlready})> referrals(String userId);
  Future<List<Map<String, Object?>>> cards(List<Object?> userIds);
  Future<Object?> redeem(String code);
}

class SupabaseReferralRepository implements ReferralRepository {
  SupabaseReferralRepository(this._db);
  final Db _db;
  @override
  Future<String?> code() async {
    final data = await _db.rpc<Object?>('get_or_create_referral_code');
    return data is String && data.isNotEmpty ? data : null;
  }

  @override
  Future<({List<Map<String, Object?>> rows, bool redeemedAlready})> referrals(String userId) async {
    final results = await Future.wait<Object?>([
      _db.from('referrals').select('id, referred_user_id, status, reward_days, converted_at, referrer_rewarded_at, created_at').eq('referrer_user_id', userId).order('created_at', ascending: false),
      _db.from('referrals').select('id').eq('referred_user_id', userId).maybeSingle(),
    ]);
    return (rows: asRows(results[0]).cast<Map<String, Object?>>(), redeemedAlready: results[1] != null);
  }

  @override
  Future<List<Map<String, Object?>>> cards(List<Object?> userIds) async =>
      asRows(await _db.from('public_profile_cards').select('user_id, name, avatar_url, is_premium').inFilter('user_id', userIds)).cast<Map<String, Object?>>();

  @override
  Future<Object?> redeem(String code) => _db.rpc<Object?>('redeem_referral_code', params: {'p_code': code});
}

final referralRepositoryProvider = Provider<ReferralRepository>((ref) => SupabaseReferralRepository(ref.watch(dbProvider)));

final referralCodeQuery = queryProvider<String?>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<String?>(
    queryKey: ['referral-code', uid],
    enabled: uid != null,
    staleTime: const Duration(days: 36500),
    queryFn: (_) async {
      try {
        return await ref.read(referralRepositoryProvider).code();
      } catch (_) {
        return null;
      }
    },
  );
});

typedef ReferralDetails = ({List<ReferredUser> referred, bool redeemedAlready});

final referralDetailsQuery = queryProvider<ReferralDetails>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<ReferralDetails>(
    queryKey: ['referral-details', uid],
    enabled: uid != null,
    queryFn: (_) async {
      try {
        final repo = ref.read(referralRepositoryProvider);
        final r = await repo.referrals(uid!);
        final cards = r.rows.isEmpty ? const <Map<String, Object?>>[] : await repo.cards([for (final x in r.rows) x['referred_user_id']]);
        return (referred: mapReferredRows(r.rows, cards, tr: tr), redeemedAlready: r.redeemedAlready);
      } catch (_) {
        return (referred: const <ReferredUser>[], redeemedAlready: false);
      }
    },
  );
});

typedef RedeemResult = ({bool success, Object? error, Object? rewardDays});

final redeemReferralMutation = mutationProvider<RedeemResult, String, void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions<RedeemResult, String, void>(
    mutationFn: (code) async => parseRedeemResult(await ref.read(referralRepositoryProvider).redeem(code)),
    onSuccess: (res, _, _) {
      if (res.success) unawaited(qc.invalidateQueries(queryKey: const ['referral-details']));
    },
  );
});
