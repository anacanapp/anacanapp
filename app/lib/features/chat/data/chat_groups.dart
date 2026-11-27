// Ported from: src/hooks/useChatGroups.ts (the group list query and its realtime invalidation only)
//
// The Messages inbox and the unread badge read the user's chat groups. The full hook (members, create / manage /
// update mutations, a single group's listeners) belongs to the community groups port (`social.groups`); it should
// reuse [chatGroupsQuery] or keep the same query key ['chat-groups-v3', backend, actor, scope, group, search,
// language] so both share one cache entry.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import 'chat_backend.dart';

/// `useChatGroups(undefined, scope, search, languageFiltered)` arguments (no single group).
@immutable
class ChatGroupsArgs {
  const ChatGroupsArgs({this.scope = 'all', this.search = '', this.languageFiltered = true});
  final String scope;
  final String search;
  final bool languageFiltered;

  @override
  bool operator ==(Object other) =>
      other is ChatGroupsArgs && other.scope == scope && other.search == search && other.languageFiltered == languageFiltered;
  @override
  int get hashCode => Object.hash(scope, search, languageFiltered);
}

/// Inbox list: `useChatGroups(undefined, 'mine', '', false)` (ConversationListScreen).
const ChatGroupsArgs kInboxGroups = ChatGroupsArgs(scope: 'mine', languageFiltered: false);

/// Unread badge: `useChatGroups(undefined, 'mine')` (useUnreadMessages; language filtered like React).
const ChatGroupsArgs kUnreadGroups = ChatGroupsArgs(scope: 'mine');

/// Throttle of the inbox invalidation on any `group_messages` change (leading + trailing, >= 5 s).
const Duration kGroupListThrottle = Duration(seconds: 5);

final chatGroupsQuery = queryProviderFamily<List<ChatRow>, ChatGroupsArgs>((ref, args) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final backendUrl = ref.watch(chatBackendUrlProvider);
  final language = normalizeAppLanguage(ref.watch(appLanguageProvider));
  final client = ref.read(queryClientProvider);
  if (actor != null) {
    void refresh(ChatChange _) {
      for (final key in const ['chat-groups-v3', 'chat-members-v3', 'chat-messages-v2', 'chat-group-cards-v3', 'community-groups', 'user-memberships']) {
        unawaited(client.invalidateQueries(queryKey: [key]));
      }
    }

    var lastRun = DateTime.fromMillisecondsSinceEpoch(0);
    Timer? trailing;
    ref.onDispose(() => trailing?.cancel());
    void invalidateGroups() {
      lastRun = DateTime.now();
      unawaited(client.invalidateQueries(queryKey: ['chat-groups-v3', backendUrl, actor]));
    }

    void throttled(ChatChange _) {
      final wait = kGroupListThrottle - DateTime.now().difference(lastRun);
      if (wait <= Duration.zero) {
        invalidateGroups();
        return;
      }
      trailing ??= Timer(wait, () {
        trailing = null;
        invalidateGroups();
      });
    }

    final prefix = 'chat-groups-v3:$actor:${args.scope}:inbox';
    backend.subscribe(ref, channelPrefix: prefix, table: 'group_memberships', filter: 'user_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref, channelPrefix: '$prefix:access', table: 'group_chat_access', filter: 'user_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref, channelPrefix: '$prefix:owner', table: 'group_chat_access', filter: 'owner_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref, channelPrefix: '$prefix:messages', table: 'group_messages', onChange: throttled);
  }
  return QueryOptions<List<ChatRow>>(
    queryKey: ['chat-groups-v3', backendUrl, actor, args.scope, null, args.search, args.languageFiltered ? language : null],
    enabled: actor != null,
    staleTime: const Duration(seconds: 10),
    refetchInterval: const Duration(seconds: 30),
    queryFn: (_) async {
      final data = await backend.rpc(args.languageFiltered ? 'chat_groups_v4' : 'chat_groups_v3', {
        'p_scope': args.scope,
        'p_group': null,
        'p_search': args.search,
        if (args.languageFiltered) 'p_language': language,
      });
      return [
        for (final row in data is List ? data : const [])
          if (row is Map && (!args.languageFiltered || row['discovery_language'] == language)) Map<String, dynamic>.from(row),
      ];
    },
  );
}, name: 'chatGroupsQuery');

/// `{ groups, loading, error, refetch }` of useChatGroups.
@immutable
class ChatGroupsView {
  const ChatGroupsView({this.groups = const [], this.loading = true, this.error, required this.refetch});
  final List<ChatRow> groups;
  final bool loading;
  final Object? error;
  final Future<void> Function() refetch;
}

/// The groups the chat screens read; the community feature may override it with its own `useChatGroups`.
final chatGroupsProvider = Provider.autoDispose.family<ChatGroupsView, ChatGroupsArgs>((ref, args) {
  final q = ref.watch(chatGroupsQuery(args));
  return ChatGroupsView(
    groups: q.data ?? const [],
    loading: q.isPending,
    error: q.error,
    refetch: () => ref.read(chatGroupsQuery(args).notifier).refetch(),
  );
});

/// `Number(value || 0)` for counters (NaN → 0).
int jsNumber(Object? value) {
  if (value is num) return value.isNaN ? 0 : value.toInt();
  if (value is String) return num.tryParse(value.trim().isEmpty ? '0' : value.trim())?.toInt() ?? 0;
  return 0;
}

/// The unread contribution of the groups: member → `unread_count`, open invitation → 1.
int groupsUnread(List<ChatRow> groups) => groups.fold(0, (sum, group) {
      if (group['is_member'] == true) return sum + jsNumber(group['unread_count']);
      return sum + (group['access_state'] == 'invited' ? 1 : 0);
    });
