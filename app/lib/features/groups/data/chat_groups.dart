// Ported from: src/hooks/useChatGroups.ts
//
// The full group hook: the list (discovery filtered by the creator's language through `chat_groups_v4`, or the
// membership contract `chat_groups_v3` for the inbox and an explicit group), the people of a joined group, the
// create / action / update mutations and the realtime invalidation (inbox: throttled `group_messages`, ≥ 5 s;
// an open group: its own filtered listeners). Query keys are React's, so the chat feature's list query and this one
// share their cache entries (`chat-groups-v3`, `chat-members-v3`).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../chat/data/chat_backend.dart';
import '../../chat/data/chat_groups.dart' show ChatGroupsArgs, ChatGroupsView, kGroupListThrottle;

/// `GroupAction`.
const List<String> kGroupActions = [
  'join', 'accept_invite', 'decline_invite', 'cancel_request', 'invite', 'approve', 'reject', //
  'leave', 'remove', 'block', 'unblock', 'promote', 'demote', 'transfer', 'delete',
];

/// `useChatGroups(groupId, scope, search, languageFiltered = !groupId)`.
@immutable
class ChatGroupArgs {
  // ignore: prefer_initializing_formals
  const ChatGroupArgs({this.groupId, this.scope = 'all', this.search = '', bool? languageFiltered}) : _languageFiltered = languageFiltered;
  final String? groupId;

  /// all | mine | public | private.
  final String scope;
  final String search;
  final bool? _languageFiltered;

  bool get languageFiltered => _languageFiltered ?? (groupId == null || groupId!.isEmpty);

  /// `useChatGroups(groupId)` (GroupChatScreen).
  const ChatGroupArgs.single(String this.groupId)
      : scope = 'all',
        search = '',
        _languageFiltered = null;

  /// The chat feature's list arguments.
  factory ChatGroupArgs.fromChat(ChatGroupsArgs args) => ChatGroupArgs(scope: args.scope, search: args.search, languageFiltered: args.languageFiltered);

  @override
  bool operator ==(Object other) =>
      other is ChatGroupArgs && other.groupId == groupId && other.scope == scope && other.search == search && other.languageFiltered == languageFiltered;
  @override
  int get hashCode => Object.hash(groupId, scope, search, languageFiltered);
}

const List<String> _invalidatedKeys = [
  'chat-groups-v3', 'chat-members-v3', 'chat-messages-v2', 'chat-group-cards-v3', 'community-groups', 'user-memberships', //
];

Future<void> _invalidateGroups(QueryClient client) => Future.wait([for (final key in _invalidatedKeys) client.invalidateQueries(queryKey: [key])]);

/// The UI language of the discovery filter (`normalizeAppLanguage(useUserStore(s => s.language))`).
final groupsLanguageProvider = Provider<String>((ref) => normalizeAppLanguage(ref.watch(appLanguageProvider)));

final chatGroupListQuery = queryProviderFamily<List<ChatRow>, ChatGroupArgs>((ref, args) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final backendUrl = ref.watch(chatBackendUrlProvider);
  final language = ref.watch(groupsLanguageProvider);
  final client = ref.read(queryClientProvider);
  final groupId = args.groupId == null || args.groupId!.isEmpty ? null : args.groupId;
  if (actor != null) {
    void refresh(ChatChange _) => unawaited(_invalidateGroups(client));
    void invalidateGroups() => unawaited(client.invalidateQueries(queryKey: ['chat-groups-v3', backendUrl, actor]));
    // The inbox listens to every group_messages change app-wide: leading + trailing throttle (>= 5 s). An open
    // group keeps its filtered listener and refreshes immediately.
    var lastRun = DateTime.fromMillisecondsSinceEpoch(0);
    Timer? trailing;
    ref.onDispose(() {
      trailing?.cancel();
      trailing = null;
    });
    void throttled(ChatChange _) {
      final wait = kGroupListThrottle - DateTime.now().difference(lastRun);
      if (wait <= Duration.zero) {
        lastRun = DateTime.now();
        invalidateGroups();
        return;
      }
      trailing ??= Timer(wait, () {
        trailing = null;
        lastRun = DateTime.now();
        invalidateGroups();
      });
    }

    final prefix = 'chat-groups-v3:$actor:${args.scope}:${groupId ?? 'inbox'}';
    backend.subscribe(ref, channelPrefix: prefix, table: 'group_memberships', filter: 'user_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref, channelPrefix: '$prefix:access', table: 'group_chat_access', filter: 'user_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref, channelPrefix: '$prefix:owner', table: 'group_chat_access', filter: 'owner_id=eq.$actor', onChange: refresh);
    backend.subscribe(ref,
        channelPrefix: '$prefix:messages',
        table: 'group_messages',
        filter: groupId != null ? 'group_id=eq.$groupId' : null,
        onChange: groupId != null ? (_) => invalidateGroups() : throttled);
    if (groupId != null) {
      backend.subscribe(ref, channelPrefix: '$prefix:group', table: 'community_groups', filter: 'id=eq.$groupId', onChange: refresh);
      backend.subscribe(ref, channelPrefix: '$prefix:members', table: 'group_memberships', filter: 'group_id=eq.$groupId', onChange: refresh);
    }
  }
  final filtered = args.languageFiltered;
  return QueryOptions<List<ChatRow>>(
    queryKey: ['chat-groups-v3', backendUrl, actor, args.scope, groupId, args.search, filtered ? language : null],
    enabled: actor != null,
    staleTime: const Duration(seconds: 10),
    refetchInterval: Duration(seconds: groupId != null ? 10 : 30),
    queryFn: (_) async {
      final data = await backend.rpc(filtered ? 'chat_groups_v4' : 'chat_groups_v3', {
        'p_scope': args.scope,
        'p_group': groupId,
        'p_search': args.search,
        if (filtered) 'p_language': language,
      });
      return [
        for (final row in data is List ? data : const [])
          if (row is Map && (!filtered || row['discovery_language'] == language)) Map<String, dynamic>.from(row),
      ];
    },
  );
}, name: 'chatGroupListQuery');

/// `chat_group_people_v3` of a joined group (`{user_id, name, avatar_url, role, joined_at, state}`).
final chatGroupMembersQuery = queryProviderFamily<List<ChatRow>, String>((ref, groupId) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final backendUrl = ref.watch(chatBackendUrlProvider);
  final groups = ref.watch(chatGroupListQuery(ChatGroupArgs.single(groupId))).data;
  final group = groups?.where((g) => g['id'] == groupId).firstOrNull;
  return QueryOptions<List<ChatRow>>(
    queryKey: ['chat-members-v3', backendUrl, actor, groupId],
    enabled: actor != null && groupId.isNotEmpty && group?['is_member'] == true,
    queryFn: (_) async {
      final data = await backend.rpc('chat_group_people_v3', {'p_group': groupId});
      return [for (final row in data is List ? data : const []) if (row is Map) Map<String, dynamic>.from(row)];
    },
  );
}, name: 'chatGroupMembersQuery');

/// `create({ id, name, people, visibility, description })` → the new group id.
@immutable
class CreateGroupInput {
  const CreateGroupInput({required this.id, required this.name, required this.people, this.visibility = 'private', this.description = ''});
  final String id;
  final String name;
  final List<String> people;
  final String visibility;
  final String description;
}

final createChatGroupMutation = mutationProvider<String, CreateGroupInput, void>((ref) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final language = ref.watch(groupsLanguageProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions<String, CreateGroupInput, void>(
    mutationFn: (v) async {
      final data = await backend.rpc('chat_create_group_v4', {
        'p_language': language,
        'p_actor': actor,
        'p_id': v.id,
        'p_name': v.name,
        'p_visibility': v.visibility,
        'p_members': v.people,
        'p_description': v.description,
      });
      return '$data';
    },
    onSuccess: (_, _, _) => _invalidateGroups(client),
  );
}, name: 'createChatGroupMutation');

/// `manage({ group, action, people })` → `{ state }`.
final manageChatGroupMutation = mutationProvider<Object?, ({String group, String action, List<String> people}), void>((ref) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions<Object?, ({String group, String action, List<String> people}), void>(
    mutationFn: (v) => backend.rpc('chat_group_action_v3', {'p_actor': actor, 'p_group': v.group, 'p_action': v.action, 'p_users': v.people}),
    onSuccess: (_, _, _) => _invalidateGroups(client),
  );
}, name: 'manageChatGroupMutation');

@immutable
class UpdateGroupInput {
  const UpdateGroupInput({required this.group, required this.name, required this.description, required this.visibility, required this.posting});
  final String group;
  final String name;
  final String description;
  final String visibility;
  final String posting;
}

final updateChatGroupMutation = mutationProvider<void, UpdateGroupInput, void>((ref) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final client = ref.read(queryClientProvider);
  return MutationOptions<void, UpdateGroupInput, void>(
    mutationFn: (v) async {
      await backend.rpc('chat_update_group_v3', {
        'p_actor': actor,
        'p_group': v.group,
        'p_name': v.name,
        'p_description': v.description,
        'p_visibility': v.visibility,
        'p_posting_policy': v.posting,
      });
    },
    onSuccess: (_, _, _) => _invalidateGroups(client),
  );
}, name: 'updateChatGroupMutation');

/// The return value of `useChatGroups`.
@immutable
class ChatGroupsState {
  const ChatGroupsState({
    required this.groups,
    required this.group,
    required this.loading,
    required this.error,
    required this.refetch,
    required this.members,
    required this.membersLoading,
    required this.membersError,
    required this.create,
    required this.creating,
    required this.manage,
    required this.managing,
    required this.update,
    required this.updating,
  });
  final List<ChatRow> groups;
  final ChatRow? group;
  final bool loading;
  final Object? error;
  final Future<void> Function() refetch;
  final List<ChatRow> members;
  final bool membersLoading;
  final Object? membersError;
  final Future<String> Function(CreateGroupInput input) create;
  final bool creating;
  final Future<Object?> Function(String group, String action, [List<String> people]) manage;
  final bool managing;
  final Future<void> Function(UpdateGroupInput input) update;
  final bool updating;
}

final chatGroupsStateProvider = Provider.autoDispose.family<ChatGroupsState, ChatGroupArgs>((ref, args) {
  final list = ref.watch(chatGroupListQuery(args));
  final groupId = args.groupId;
  final groups = list.data ?? const <ChatRow>[];
  final group = groupId == null ? null : groups.where((g) => g['id'] == groupId).firstOrNull;
  final members = groupId == null || groupId.isEmpty ? null : ref.watch(chatGroupMembersQuery(groupId));
  final create = ref.watch(createChatGroupMutation);
  final manage = ref.watch(manageChatGroupMutation);
  final update = ref.watch(updateChatGroupMutation);
  return ChatGroupsState(
    groups: groups,
    group: group,
    loading: list.isPending,
    error: list.error,
    refetch: () async {
      await ref.read(chatGroupListQuery(args).notifier).refetch();
    },
    members: members?.data ?? const [],
    membersLoading: members?.isPending ?? true,
    membersError: members?.error,
    create: (input) => ref.read(createChatGroupMutation.notifier).mutateAsync(input),
    creating: create.isPending,
    manage: (group, action, [people = const []]) => ref.read(manageChatGroupMutation.notifier).mutateAsync((group: group, action: action, people: people)),
    managing: manage.isPending,
    update: (input) => ref.read(updateChatGroupMutation.notifier).mutateAsync(input),
    updating: update.isPending,
  );
}, name: 'chatGroupsStateProvider');

/// The chat feature's `chatGroupsProvider` backed by this hook (same keys, plus the full listeners).
ChatGroupsView chatGroupsViewFor(Ref ref, ChatGroupsArgs args) {
  final groupArgs = ChatGroupArgs.fromChat(args);
  final q = ref.watch(chatGroupListQuery(groupArgs));
  return ChatGroupsView(
    groups: q.data ?? const [],
    loading: q.isPending,
    error: q.error,
    refetch: () async {
      await ref.read(chatGroupListQuery(groupArgs).notifier).refetch();
    },
  );
}
