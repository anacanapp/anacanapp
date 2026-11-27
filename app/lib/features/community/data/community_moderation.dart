// Ported from: src/lib/community-moderation.ts, src/hooks/useCommunityModeration.ts (useMyAdReviews),
//              src/hooks/useFeedLanguages.ts (matchesFeedLanguage)
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../copy/community_copy.dart';
import 'community_backend.dart';
import 'community_env.dart';

/// `AD_REASONS`.
const List<String> kAdReasons = [
  'commercial_offer', 'contact_solicitation', 'referral', 'recruitment', 'external_group', 'deceptive_promotion', //
  'media_review', 'uncertain', 'check_unavailable', 'not_advertising', 'other', 'blocked_account',
];

/// `isHeldPost(state)`: checking / review / rejected posts are private to their author.
bool isHeldPost(String? state) => const ['checking', 'review', 'rejected'].contains(state ?? '');

/// `moderationReason(reason, language)` (unknown reasons read as `uncertain`).
String moderationReason(String? reason, [String? language]) =>
    moderationText('reason_${kAdReasons.contains(reason) ? reason : 'uncertain'}', language);

/// `moderationError(error, language)`.
String moderationError(Object? error, [String? language]) {
  final code = errorCode(error) ?? '';
  final message = errorMessage(error);
  if (RegExp('MODERATION_MEDIA_').hasMatch(message)) return moderationText('media_reupload', language);
  if (const ['PGRST202', '42883'].contains(code) || RegExp('MODERATION_REQUIRED').hasMatch(message)) {
    return moderationText('unavailable', language);
  }
  final both = '${code.isEmpty ? 'undefined' : code} ${message.isEmpty ? 'undefined' : message}';
  if (RegExp('CONFLICT|40001').hasMatch(both)) return moderationText('conflict', language);
  return moderationText('save_failed', language);
}

/// `matchesFeedLanguage(post, language)`: unknown post metadata is not treated as Azerbaijani.
bool matchesFeedLanguage(Map<String, dynamic> post, String language) => post['language'] == normalizeAppLanguage(language);

/// `OwnAdReview` row of `my_community_ad_reviews_v1`.
typedef OwnAdReview = Map<String, dynamic>;

@immutable
class AdReviewsArgs {
  const AdReviewsArgs({this.postId, this.page = 0});
  final String? postId;
  final int page;
  @override
  bool operator ==(Object other) => other is AdReviewsArgs && other.postId == postId && other.page == page;
  @override
  int get hashCode => Object.hash(postId, page);
}

/// `useMyAdReviews(postId, page)`: never persisted, polled every 10 s. The refresh side effects of the hook live in
/// [AdReviewsWatcher] (called by the widget on every data change).
final myAdReviewsQuery = queryProviderFamily<List<OwnAdReview>, AdReviewsArgs>((ref, args) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  final backendUrl = ref.watch(communityBackendUrlProvider);
  final loading = ref.watch(communityAuthLoadingProvider);
  return QueryOptions<List<OwnAdReview>>(
    queryKey: ['community-ad-mine', backendUrl, actor, args.postId, args.page],
    meta: const {'persist': false},
    enabled: actor != null && !loading,
    staleTime: Duration.zero,
    refetchInterval: const Duration(seconds: 10),
    queryFn: (_) async {
      final data = await backend.rpc('my_community_ad_reviews_v1', {
        'p_actor': actor,
        'p_post': args.postId,
        'p_limit': 30,
        'p_offset': args.page * 30,
      });
      if (data is! List) throw const CommunityBackendError(message: 'MODERATION_INVALID_RESPONSE');
      return [for (final row in data) if (row is Map) Map<String, dynamic>.from(row)];
    },
  );
}, name: 'myAdReviewsQuery');

/// The effect of `useMyAdReviews`: a review that disappears for the same account / backend (approved and published,
/// or withdrawn) refreshes the feeds; an approved deep-linked post refreshes its single-post query.
class AdReviewsWatcher {
  String? _actor;
  String? _backend;
  List<String> _ids = const [];

  void update(QueryClient client, {required String? actor, required String backend, required String? postId, List<OwnAdReview>? data}) {
    if (data != null && _actor == actor && _backend == backend) {
      final ids = [for (final row in data) '${row['id']}'];
      if (_ids.any((id) => !ids.contains(id))) {
        unawaited(client.invalidateQueries(queryKey: ['community-feed', actor]));
        unawaited(client.invalidateQueries(queryKey: ['community-profile-stats', actor]));
      }
    }
    _actor = actor;
    _backend = backend;
    _ids = [for (final row in data ?? const <OwnAdReview>[]) '${row['id']}'];
    if (postId != null && (data ?? const []).any((row) => row['state'] == 'approved')) {
      unawaited(client.invalidateQueries(queryKey: ['single-post', postId, actor]));
      unawaited(client.invalidateQueries(queryKey: ['community-feed', actor]));
    }
  }
}
