// Ported from: src/hooks/useUnreadMessages.ts, src/components/Dashboard.tsx (`totalUnread = partnerUnread +
//              conversations[].unread_count`)
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import 'chat_groups.dart';
import 'direct_messages.dart';
import 'partner_messages.dart';

@immutable
class UnreadMessages {
  const UnreadMessages({required this.unreadCount, required this.loading});
  final int unreadCount;
  final bool loading;
  bool get hasUnread => unreadCount > 0;
}

/// `useUnreadMessages()`: unread partner messages + group unread (member: `unread_count`, open invitation: 1).
final unreadMessagesProvider = Provider.autoDispose<UnreadMessages>((ref) {
  final partner = ref.watch(partnerMessagesProvider);
  final userId = ref.watch(authUserProvider)?.id;
  final groups = ref.watch(chatGroupsProvider(kUnreadGroups)).groups;
  if (userId == null) return UnreadMessages(unreadCount: 0, loading: partner.loading);
  return UnreadMessages(unreadCount: partner.unreadCount(userId) + groupsUnread(groups), loading: partner.loading);
});

/// `unreadMessagesCountProvider` of the shell (bottom nav badge).
final chatUnreadCountProvider = Provider.autoDispose<int>((ref) => ref.watch(unreadMessagesProvider).unreadCount);

/// `homeTotalUnreadProvider` of the home feature (Dashboard chat badge): useUnreadMessages + DM inbox unread.
final chatHomeTotalUnreadProvider =
    Provider.autoDispose<int>((ref) => ref.watch(chatUnreadCountProvider) + ref.watch(directInboxUnreadProvider));
