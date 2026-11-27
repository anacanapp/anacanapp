// Ported from: src/lib/pushNav.ts (PushNavIntent, intentFromPushData, navigateFromPush,
//              consumePendingPushNav), src/components/community/CommunityScreen.tsx (CommunityDeepLinkTarget)
import 'package:flutter/foundation.dart';

import 'deeplink.dart';
import 'js_url.dart';
import 'nav_handoffs.dart';

/// `CommunityDeepLinkTarget`: which post / comment / story / DM / group Community should open.
///
/// `composeBlog` (a shared blog card) belongs to the blog feature and travels as an opaque value.
@immutable
class CommunityDeepLinkTarget {
  const CommunityDeepLinkTarget({
    this.postId,
    this.commentId,
    this.storyId,
    this.dmUserId,
    this.conversations,
    this.userId,
    this.groupId,
    this.composeBlog,
  });

  final String? postId;
  final String? commentId;
  final String? storyId;
  final String? dmUserId;
  final bool? conversations;
  final String? userId;
  final String? groupId;
  final Object? composeBlog;

  /// `{}`: Community opened without a specific target.
  static const CommunityDeepLinkTarget empty = CommunityDeepLinkTarget();

  bool get isEmpty =>
      postId == null && commentId == null && storyId == null && dmUserId == null && conversations == null &&
      userId == null && groupId == null && composeBlog == null;

  @override
  bool operator ==(Object other) =>
      other is CommunityDeepLinkTarget &&
      other.postId == postId &&
      other.commentId == commentId &&
      other.storyId == storyId &&
      other.dmUserId == dmUserId &&
      other.conversations == conversations &&
      other.userId == userId &&
      other.groupId == groupId &&
      other.composeBlog == composeBlog;

  @override
  int get hashCode => Object.hash(postId, commentId, storyId, dmUserId, conversations, userId, groupId, composeBlog);

  @override
  String toString() {
    final parts = <String>[
      if (postId != null) 'postId: $postId',
      if (commentId != null) 'commentId: $commentId',
      if (storyId != null) 'storyId: $storyId',
      if (dmUserId != null) 'dmUserId: $dmUserId',
      if (conversations != null) 'conversations: $conversations',
      if (userId != null) 'userId: $userId',
      if (groupId != null) 'groupId: $groupId',
      if (composeBlog != null) 'composeBlog: …',
    ];
    return '{${parts.join(', ')}}';
  }
}

/// `PushNavIntent`.
@immutable
class PushNavIntent {
  const PushNavIntent({
    this.tab,
    this.screen,
    this.motherChat = false,
    this.shoppingList = false,
    this.tool,
    this.communityTarget,
    this.deeplink,
  });

  final String? tab;
  final String? screen;

  /// Partner chat (women: Messages screen; partner role: the `chat` tab).
  final bool motherChat;
  final bool shoppingList;
  final String? tool;
  final CommunityDeepLinkTarget? communityTarget;

  /// An in-app link handled by the shell's own deeplink router.
  final ParsedDeeplink? deeplink;

  @override
  bool operator ==(Object other) =>
      other is PushNavIntent &&
      other.tab == tab &&
      other.screen == screen &&
      other.motherChat == motherChat &&
      other.shoppingList == shoppingList &&
      other.tool == tool &&
      other.communityTarget == communityTarget &&
      other.deeplink == deeplink;

  @override
  int get hashCode => Object.hash(tab, screen, motherChat, shoppingList, tool, communityTarget, deeplink);

  @override
  String toString() => 'PushNavIntent(${[
        if (tab != null) 'tab: $tab',
        if (screen != null) 'screen: $screen',
        if (motherChat) 'motherChat',
        if (shoppingList) 'shoppingList',
        if (tool != null) 'tool: $tool',
        if (communityTarget != null) 'communityTarget: $communityTarget',
        if (deeplink != null) 'deeplink: $deeplink',
      ].join(', ')})';
}

/// uuid@14 `validate()`.
final RegExp _uuid = RegExp(
  r'^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
  caseSensitive: false,
);
bool isUuid(Object? value) => value is String && _uuid.hasMatch(value);

/// Every push `type` [intentFromPushData] maps (anything else → null, the app just opens).
const List<String> kPushTypes = [
  'message', 'partner_message', 'love', 'thank_you', 'direct_message', 'shopping_list', 'parenting_programme',
  'baby_chat', 'group_message', 'group_invite', 'group_join_request', 'community_like', 'community_comment',
  'community_moderation', 'moderation_action', 'community_reply', 'comment_like', 'story_like', 'story_reply', 'like',
  'comment', 'community', 'premium_expired', 'subscription', 'contraction_511', 'appointment', 'appointment_reminder',
  'flow_reminder', 'period_reminder', 'pill_reminder', 'sos', 'sos_alert', 'birth', 'birth_alert',
];

String? _str(Object? v) => v is String ? v : null;

String _jsTruthyString(Object? v) {
  if (v == null || v == false || v == '' || v == 0) return '';
  return v is String ? v : '$v';
}

/// `intentFromPushData(data)`. [parenting] receives the programme target (`setParentingTarget`).
PushNavIntent? intentFromPushData(Map<String, Object?> data, {ParentingTargetStore? parenting}) {
  final type = _jsTruthyString(data['type']);
  switch (type) {
    case 'message':
    case 'partner_message':
    case 'love':
    case 'thank_you':
      return const PushNavIntent(motherChat: true);
    case 'direct_message':
      final sender = data['sender_id'];
      return PushNavIntent(
        tab: 'community',
        communityTarget: isUuid(sender)
            ? CommunityDeepLinkTarget(dmUserId: (sender as String).toLowerCase())
            : const CommunityDeepLinkTarget(conversations: true),
      );
    case 'shopping_list':
      return const PushNavIntent(shoppingList: true);
    case 'parenting_programme':
      final programme = data['programme'];
      if (programme is String) parenting?.set(ParentingTarget('programme', programme));
      return data['partner'] == '1' ? const PushNavIntent(screen: kPartnerParentingScreen) : const PushNavIntent(tool: 'parenting');
    case 'baby_chat':
      return const PushNavIntent(screen: 'baby-chat');
    case 'group_message':
    case 'group_invite':
    case 'group_join_request':
      final group = data['groupId'];
      return isUuid(group)
          ? PushNavIntent(tab: 'community', communityTarget: CommunityDeepLinkTarget(groupId: (group as String).toLowerCase()))
          : const PushNavIntent(tab: 'community');
    case 'community_like':
    case 'community_comment':
      return PushNavIntent(tab: 'community', communityTarget: CommunityDeepLinkTarget(postId: _str(data['postId'])));
    case 'community_moderation':
      final post = data['postId'];
      return isUuid(post)
          ? PushNavIntent(tab: 'community', communityTarget: CommunityDeepLinkTarget(postId: (post as String).toLowerCase()))
          : const PushNavIntent(tab: 'community');
    case 'moderation_action':
      return const PushNavIntent(screen: 'moderation-history');
    case 'community_reply':
      final interaction = data['interactionId'];
      return PushNavIntent(
        tab: 'community',
        communityTarget: CommunityDeepLinkTarget(
          postId: _str(data['postId']),
          commentId: isUuid(interaction) ? interaction as String : _str(data['commentId']),
        ),
      );
    case 'comment_like':
      return PushNavIntent(
        tab: 'community',
        communityTarget: CommunityDeepLinkTarget(postId: _str(data['postId']), commentId: _str(data['commentId'])),
      );
    case 'story_like':
    case 'story_reply':
      return PushNavIntent(tab: 'community', communityTarget: CommunityDeepLinkTarget(storyId: _str(data['storyId'])));
    case 'like':
    case 'comment':
    case 'community':
      return const PushNavIntent(tab: 'community');
    case 'premium_expired':
    case 'subscription':
      return const PushNavIntent(screen: 'billing');
    case 'contraction_511':
      return const PushNavIntent(screen: 'live-contractions');
    case 'appointment':
    case 'appointment_reminder':
      return const PushNavIntent(screen: 'calendar');
    case 'flow_reminder':
    case 'period_reminder':
    case 'pill_reminder':
      return const PushNavIntent(tab: 'home');
    case 'sos':
    case 'sos_alert':
    case 'birth':
    case 'birth_alert':
      // Home mounts AlertReceiver even when a sub-screen was open.
      return const PushNavIntent(tab: 'home');
    default:
      return null;
  }
}

/// The public website (not the app host): its pages open in the phone's browser.
const List<String> kWebsiteOrigins = ['https://anacan.az', 'https://www.anacan.az'];

/// What a notification tap asks the app to do ([PushNavRouter.navigateFromPush]).
sealed class PushTapAction {
  const PushTapAction();
}

/// Route [intent] inside the app (stored as pending and dispatched).
class PushTapIntent extends PushTapAction {
  const PushTapIntent(this.intent);
  final PushNavIntent intent;
  @override
  bool operator ==(Object other) => other is PushTapIntent && other.intent == intent;
  @override
  int get hashCode => intent.hashCode;
  @override
  String toString() => 'PushTapIntent($intent)';
}

/// A website page: open in the external browser once the app is visible (+350 ms).
class PushTapOpenBrowser extends PushTapAction {
  const PushTapOpenBrowser(this.url);
  final String url;
  static const Duration delay = Duration(milliseconds: 350);
  @override
  bool operator ==(Object other) => other is PushTapOpenBrowser && other.url == url;
  @override
  int get hashCode => url.hashCode;
  @override
  String toString() => 'PushTapOpenBrowser($url)';
}

/// A trusted https page the in-app router does not know (`window.location.href = url` in the WebView).
/// Natively the host maps it to an outer route or the browser; when that fails, [fallback] (the
/// mapped push `type`) is applied instead, as the React catch block did.
class PushTapWebNavigate extends PushTapAction {
  const PushTapWebNavigate(this.url, {this.fallback});
  final String url;
  final PushNavIntent? fallback;
  @override
  bool operator ==(Object other) => other is PushTapWebNavigate && other.url == url && other.fallback == fallback;
  @override
  int get hashCode => Object.hash(url, fallback);
  @override
  String toString() => 'PushTapWebNavigate($url, fallback: $fallback)';
}

/// Module state of pushNav.ts: the trust boundary and the single `pending` intent.
class PushNavRouter {
  PushNavRouter({
    this.currentOrigin = 'https://app.anacan.az',
    this.backendUrl,
    ParentingTargetStore? parenting,
  }) : parenting = parenting ?? ParentingTargetStore();

  /// `window.location.origin` of the Capacitor WebView (Android `https://app.anacan.az`).
  final String currentOrigin;

  /// `getBackendConfig().url`: its https origin is trusted too (updated by the shell before each tap).
  String? backendUrl;
  final ParentingTargetStore parenting;

  PushNavIntent? _pending;

  /// `navigateFromPush(data)`: decides the action and updates `pending` like the React module.
  /// Returns null when nothing happens (unknown type, no link).
  PushTapAction? navigateFromPush(Map<String, Object?> data) {
    final link = data['deeplink'];
    if (link is String && link.trim().isNotEmpty) {
      final url = JsUrl.parse(link, base: '$currentOrigin/');
      if (url != null) {
        final trusted = <String>[currentOrigin, 'https://anacan.az', 'https://www.anacan.az', 'https://app.anacan.az', 'https://anacanapp.lovable.app'];
        final configured = backendUrl == null ? null : JsUrl.parse(backendUrl!);
        if (configured != null && configured.protocol == 'https:' && configured.username.isEmpty && configured.password.isEmpty) {
          trusted.add(configured.origin);
        }
        final appScheme = (url.protocol == 'anacan:' || url.protocol == 'com.atlasoon.anacan:') && url.hasAuthority;
        if (url.username.isEmpty && url.password.isEmpty && (appScheme || (url.protocol == 'https:' && trusted.contains(url.origin)))) {
          final parsed = parseDeeplink(url.href);
          if (parsed != null) {
            final intent = PushNavIntent(deeplink: parsed);
            _pending = intent;
            return PushTapIntent(intent);
          }
          _pending = null;
          if (url.protocol == 'https:' && kWebsiteOrigins.contains(url.origin)) return PushTapOpenBrowser(url.href);
          return PushTapWebNavigate(url.href, fallback: intentFromPushData(data, parenting: parenting));
        }
      }
    }
    final intent = intentFromPushData(data, parenting: parenting);
    if (intent == null) return null;
    _pending = intent;
    return PushTapIntent(intent);
  }

  /// The [PushTapWebNavigate.fallback] path: the type wins when the page could not be opened.
  void fallbackAfterFailedNavigation(PushNavIntent intent) => _pending = intent;

  /// `consumePendingPushNav()`.
  PushNavIntent? consumePending() {
    final p = _pending;
    _pending = null;
    return p;
  }

  /// Peek without consuming (tests, debug).
  PushNavIntent? get pending => _pending;
}
