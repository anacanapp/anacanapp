// Ported from: src/hooks/useChatMessages.ts
//
// `useChatMessages(kind, target)` as [chatConversationProvider] (state) + its notifier (send / react / remove /
// edit / renewMedia / refetch / loadOlder). The queries keep the React keys; the realtime channel and the
// mark-read effect live in [chatConversationRealtimeProvider] so query updates do not re-subscribe.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/offline/offline_providers.dart' show appResumeEventsProvider;
import 'chat.dart';
import 'chat_backend.dart';
import 'chat_push.dart';

const int kChatPageSize = 60;

/// `(kind, target)` of a conversation.
@immutable
class ChatScope {
  const ChatScope(this.kind, this.target);
  final ChatKind kind;
  final String target;
  @override
  bool operator ==(Object other) => other is ChatScope && other.kind == kind && other.target == target;
  @override
  int get hashCode => Object.hash(kind, target);
  @override
  String toString() => 'ChatScope(${kind.name}, $target)';
}

/// The `{ at, id }` page cursor.
typedef ChatCursor = ({String at, String id})?;

List<Object?> _scope(Ref ref, ChatScope scope) =>
    [ref.watch(chatBackendUrlProvider), ref.watch(authUserProvider)?.id, scope.kind.name, scope.target];

List<Object?> chatMessagesKey(String backend, String? actor, ChatScope scope) =>
    ['chat-messages-v2', backend, actor, scope.kind.name, scope.target];

final chatMessagesQuery = NotifierProvider.autoDispose
    .family<InfiniteQueryNotifier<List<ChatMessage>, ChatCursor>, QueryResult<InfiniteData<List<ChatMessage>, ChatCursor>>, ChatScope>(
  (scope) => InfiniteQueryNotifier<List<ChatMessage>, ChatCursor>((ref) {
    final actor = ref.watch(authUserProvider)?.id;
    final backend = ref.watch(chatBackendProvider);
    return infiniteQueryOptions<List<ChatMessage>, ChatCursor>(
      queryKey: ['chat-messages-v2', ..._scope(ref, scope)],
      enabled: actor != null && scope.target.isNotEmpty,
      initialPageParam: null,
      queryFn: (_, page) async {
        final data = await backend.rpc('chat_messages_v2', {
          'p_kind': scope.kind.name,
          'p_target': scope.target,
          'p_before_at': page?.at,
          'p_before_id': page?.id,
          'p_limit': kChatPageSize,
        });
        return [for (final row in data is List ? data : const []) if (row is Map) ChatMessage(Map<String, dynamic>.from(row))];
      },
      getNextPageParam: (page, _, _, _) =>
          page.length == kChatPageSize ? (at: page.last.createdAt, id: page.last.id) : null,
    );
  }),
  name: 'chatMessagesQuery',
);

/// Deduplicated, sorted messages of the loaded pages.
final chatMessageListProvider = Provider.autoDispose.family<List<ChatMessage>, ChatScope>((ref, scope) {
  final data = ref.watch(chatMessagesQuery(scope)).data;
  final rows = <String, ChatMessage>{};
  for (final page in data?.pages ?? const <List<ChatMessage>>[]) {
    for (final message in page) {
      rows[message.id] = message;
    }
  }
  final list = rows.values.toList()
    ..sort((a, b) {
      final at = a.createdAt.compareTo(b.createdAt);
      return at != 0 ? at : a.id.compareTo(b.id);
    });
  return list;
});

final _chatRepliesQuery = queryProviderFamily<List<ChatMessage>, ChatScope>((ref, scope) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final messages = ref.watch(chatMessageListProvider(scope));
  final ids = {for (final m in messages) m.id};
  final replyIds = <String>{
    for (final m in messages)
      if (m.replyToId != null && m.replyToId!.isNotEmpty && !ids.contains(m.replyToId)) m.replyToId!,
  }.toList();
  return QueryOptions<List<ChatMessage>>(
    queryKey: ['chat-replies-v2', ..._scope(ref, scope), replyIds],
    enabled: actor != null && replyIds.isNotEmpty,
    queryFn: (_) async {
      final rows = <ChatMessage>[];
      for (var start = 0; start < replyIds.length; start += 80) {
        final part = replyIds.sublist(start, (start + 80).clamp(0, replyIds.length));
        rows.addAll((await backend.selectIn(chatTable(scope.kind), 'id', part)).map(ChatMessage.new));
      }
      return rows;
    },
  );
}, name: 'chatRepliesQuery');

/// `allMessages`: loaded messages + quoted ones outside the loaded pages.
final chatAllMessagesProvider = Provider.autoDispose.family<Map<String, ChatMessage>, ChatScope>((ref, scope) {
  final messages = ref.watch(chatMessageListProvider(scope));
  final replies = ref.watch(_chatRepliesQuery(scope)).data ?? const <ChatMessage>[];
  return {for (final m in [...messages, ...replies]) m.id: m};
});

final _chatAuthorsQuery = queryProviderFamily<Map<String, ChatRow>, ChatScope>((ref, scope) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final authorIds = <String>{for (final m in ref.watch(chatAllMessagesProvider(scope)).values) m.senderId}.toList();
  return QueryOptions<Map<String, ChatRow>>(
    queryKey: ['chat-authors-v2', ref.watch(chatBackendUrlProvider), actor, authorIds],
    enabled: actor != null && authorIds.isNotEmpty,
    staleTime: const Duration(seconds: 30),
    queryFn: (_) => getPublicProfileCards(backend, authorIds),
  );
}, name: 'chatAuthorsQuery');

List<ChatMessage> _mediaMessages(List<ChatMessage> messages) => [
      for (final m in messages)
        if ((m.mediaPath?.isNotEmpty ?? false) || (m.mediaUrl?.isNotEmpty ?? false) || const ['image', 'audio', 'video'].contains(m.messageType)) m,
    ];

List<Object?> chatMediaKey(List<Object?> scope, List<ChatMessage> media) =>
    ['chat-media-v3', ...scope, [for (final m in media) [m.id, m.mediaPath, m.mediaUrl, m.content]]];

final _chatMediaQuery = queryProviderFamily<Map<String, String?>, ChatScope>((ref, scope) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final backendUrl = ref.watch(chatBackendUrlProvider);
  final media = _mediaMessages(ref.watch(chatMessageListProvider(scope)));
  return QueryOptions<Map<String, String?>>(
    queryKey: chatMediaKey(_scope(ref, scope), media),
    enabled: actor != null && media.isNotEmpty,
    staleTime: Duration.zero,
    gcTime: Duration.zero,
    refetchInterval: const Duration(seconds: 240),
    queryFn: (_) async {
      final result = <String, String?>{};
      var failures = 0;
      for (var start = 0; start < media.length; start += 8) {
        await Future.wait(media.skip(start).take(8).map((message) async {
          try {
            result[message.id] = await resolveChatMedia(backend, backendUrl, message);
          } catch (_) {
            result[message.id] = null;
            failures++;
          }
        }));
      }
      if (failures == media.length) throw const ChatException('CHAT_MEDIA_SIGNING_FAILED');
      return result;
    },
  );
}, name: 'chatMediaQuery');

final _chatReactionsQuery = queryProviderFamily<List<ChatReaction>, ChatScope>((ref, scope) {
  final actor = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  final ids = [for (final m in ref.watch(chatMessageListProvider(scope))) m.id];
  return QueryOptions<List<ChatReaction>>(
    queryKey: ['chat-reactions-v2', ..._scope(ref, scope), ids],
    enabled: actor != null && ids.isNotEmpty,
    queryFn: (_) async {
      final rows = <ChatReaction>[];
      for (var start = 0; start < ids.length; start += 80) {
        final part = ids.sublist(start, (start + 80).clamp(0, ids.length));
        rows.addAll((await backend.selectIn('chat_message_reactions', reactionColumn(scope.kind), part)).map(ChatReaction.new));
      }
      return rows;
    },
  );
}, name: 'chatReactionsQuery');

/// Throttle of the reaction invalidation (leading + trailing, >= 2 s).
const Duration kChatReactionThrottle = Duration(seconds: 2);

/// The conversation's realtime channel (messages + reactions) and the mark-read effect (newest loaded message,
/// app resume = `visibilitychange`).
final chatConversationRealtimeProvider = Provider.autoDispose.family<void, ChatScope>((ref, scope) {
  final actor = ref.watch(authUserProvider)?.id;
  final backendUrl = ref.watch(chatBackendUrlProvider);
  final backend = ref.watch(chatBackendProvider);
  if (actor == null || scope.target.isEmpty) return;
  final client = ref.read(queryClientProvider);
  final key = chatMessagesKey(backendUrl, actor, scope);
  final scopeKey = [backendUrl, actor, scope.kind.name, scope.target];
  void refresh(ChatChange _) => unawaited(client.invalidateQueries(queryKey: key));
  final prefix = 'chat-v2:${scope.kind.name}:${scope.target}';
  if (scope.kind == ChatKind.group) {
    backend.subscribe(ref, channelPrefix: prefix, table: 'group_messages', filter: 'group_id=eq.${scope.target}', onChange: refresh);
  } else {
    for (final field in const ['sender_id', 'receiver_id']) {
      backend.subscribe(ref, channelPrefix: '$prefix:$field', table: chatTable(scope.kind), filter: '$field=eq.$actor', onChange: refresh);
    }
  }
  // chat_message_reactions has no usable filter for this conversation: drop events for messages that are not
  // loaded here and throttle the invalidation.
  final column = reactionColumn(scope.kind);
  var lastRun = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? trailing;
  ref.onDispose(() => trailing?.cancel());
  void invalidateReactions() {
    lastRun = DateTime.now();
    unawaited(client.invalidateQueries(queryKey: ['chat-reactions-v2', ...scopeKey]));
  }

  backend.subscribe(ref, channelPrefix: '$prefix:reactions', table: 'chat_message_reactions', onChange: (change) {
    final row = change.newRecord.isNotEmpty ? change.newRecord : change.oldRecord;
    if (row.containsKey(column)) {
      final messageId = row[column];
      if (messageId is! String || !ref.read(chatAllMessagesProvider(scope)).containsKey(messageId)) return;
    }
    final wait = kChatReactionThrottle - DateTime.now().difference(lastRun);
    if (wait <= Duration.zero) {
      invalidateReactions();
      return;
    }
    trailing ??= Timer(wait, () {
      trailing = null;
      invalidateReactions();
    });
  });
});

/// What the conversation screen reads (`useChatMessages` result without the functions).
@immutable
class ChatConversationState {
  const ChatConversationState({
    this.messages = const [],
    this.allMessages = const {},
    this.authors = const {},
    this.media = const {},
    this.reactions = const [],
    this.actor,
    this.loading = true,
    this.error,
    this.hasOlder = false,
    this.loadingOlder = false,
    this.sending = false,
    this.reacting = false,
    this.removing = false,
    this.editing = false,
  });
  final List<ChatMessage> messages;
  final Map<String, ChatMessage> allMessages;
  final Map<String, ChatRow> authors;
  final Map<String, String?> media;
  final List<ChatReaction> reactions;
  final String? actor;
  final bool loading;
  final Object? error;
  final bool hasOlder;
  final bool loadingOlder;
  final bool sending;
  final bool reacting;
  final bool removing;
  final bool editing;
}

/// `useChatMessages(kind, target)`.
final chatConversationProvider =
    NotifierProvider.autoDispose.family<ChatConversationController, ChatConversationState, ChatScope>(ChatConversationController.new);

class ChatConversationController extends Notifier<ChatConversationState> {
  ChatConversationController(this.scope);
  final ChatScope scope;

  bool _sending = false, _reacting = false, _removing = false, _editing = false, _loadingOlder = false;
  String? _lastMarked;

  QueryClient get _client => ref.read(queryClientProvider);
  ChatBackend get _backend => ref.read(chatBackendProvider);
  String? get _actor => ref.read(authUserProvider)?.id;
  String get _backendUrl => ref.read(chatBackendUrlProvider);
  List<Object?> get _key => chatMessagesKey(_backendUrl, _actor, scope);

  @override
  ChatConversationState build() {
    ref.watch(chatConversationRealtimeProvider(scope));
    final actor = ref.watch(authUserProvider)?.id;
    final messagesResult = ref.watch(chatMessagesQuery(scope));
    final messages = ref.watch(chatMessageListProvider(scope));
    final all = ref.watch(chatAllMessagesProvider(scope));
    final authors = ref.watch(_chatAuthorsQuery(scope)).data ?? const <String, ChatRow>{};
    final media = ref.watch(_chatMediaQuery(scope)).data ?? const <String, String?>{};
    final reactions = ref.watch(_chatReactionsQuery(scope)).data ?? const <ChatReaction>[];
    final pages = messagesResult.data?.pages;
    final hasOlder = pages != null && pages.isNotEmpty && pages.last.length == kChatPageSize;
    try {
      final resume = ref.read(appResumeEventsProvider).listen((_) => _markRead());
      ref.onDispose(resume.cancel);
    } catch (_) {
      // No lifecycle stream (tests without a binding).
    }
    final newest = messages.isEmpty ? null : messages.last.id;
    if (actor != null && scope.target.isNotEmpty && newest != null) scheduleMicrotask(_markRead);
    return ChatConversationState(
      messages: messages,
      allMessages: all,
      authors: authors,
      media: media,
      reactions: reactions,
      actor: actor,
      loading: messagesResult.isPending,
      error: messagesResult.error,
      hasOlder: hasOlder,
      loadingOlder: _loadingOlder,
      sending: _sending,
      reacting: _reacting,
      removing: _removing,
      editing: _editing,
    );
  }

  void _flags() {
    if (!ref.mounted) return;
    final s = state;
    state = ChatConversationState(
      messages: s.messages, allMessages: s.allMessages, authors: s.authors, media: s.media, reactions: s.reactions, //
      actor: s.actor, loading: s.loading, error: s.error, hasOlder: s.hasOlder, loadingOlder: _loadingOlder, //
      sending: _sending, reacting: _reacting, removing: _removing, editing: _editing,
    );
  }

  /// Marks the newest loaded messages read once per newest id (not on every refetch / reaction / media change).
  void _markRead() {
    if (!ref.mounted) return;
    final actor = _actor;
    final messages = ref.read(chatMessageListProvider(scope));
    if (actor == null || scope.target.isEmpty || messages.isEmpty) return;
    final markKey = '$_backendUrl:$actor:${scope.kind.name}:${scope.target}:${messages.last.id}';
    if (_lastMarked == markKey) return;
    final unread = [
      for (final m in messages)
        if (scope.kind == ChatKind.group || (m.receiverId == actor && !m.isRead)) m.id,
    ];
    final ids = unread.length > 100 ? unread.sublist(unread.length - 100) : unread;
    if (ids.isEmpty) return;
    _lastMarked = markKey;
    final client = _client;
    _backend.rpc('chat_mark_read_v2', {'p_actor': actor, 'p_kind': scope.kind.name, 'p_target': scope.target, 'p_ids': ids}).then((_) {
      unawaited(client.invalidateQueries(queryKey: const ['chat-groups-v3']));
    }, onError: (Object _) {
      if (_lastMarked == markKey) _lastMarked = null;
    });
  }

  Future<T> _track<T>(void Function(bool) set, Future<T> Function() run) async {
    set(true);
    _flags();
    try {
      return await run();
    } finally {
      set(false);
      _flags();
    }
  }

  /// `refetch()`.
  Future<void> refetch() async {
    await ref.read(chatMessagesQuery(scope).notifier).refetch();
  }

  /// `loadOlder()` (`fetchNextPage`).
  Future<void> loadOlder() => _track((v) => _loadingOlder = v, () => ref.read(chatMessagesQuery(scope).notifier).fetchNextPage());

  /// `renewMedia(message)`: a fresh URL written into the media query.
  Future<String?> renewMedia(ChatMessage message) async {
    final url = await resolveChatMedia(_backend, _backendUrl, message);
    if (url != null) {
      final key = chatMediaKey([_backendUrl, _actor, scope.kind.name, scope.target], _mediaMessages(ref.read(chatMessageListProvider(scope))));
      _client.setQueryData<Map<String, String?>>(key, (previous) => {...?previous, message.id: url});
    }
    return url;
  }

  void _invalidateConversation({bool groups = true}) {
    unawaited(_client.invalidateQueries(queryKey: _key));
    if (groups) unawaited(_client.invalidateQueries(queryKey: const ['chat-groups-v3']));
  }

  /// `send({ id, text, attachment, replyTo })`.
  Future<ChatMessage> send({required String id, required String text, ChatAttachment? attachment, String? replyTo}) =>
      _track((v) => _sending = v, () async {
        final actor = _actor;
        if (actor == null) throw const ChatException('CHAT_ACCOUNT_CHANGED');
        final data = await _backend.rpc('chat_send_message_v2', {
          'p_actor': actor, 'p_id': id, 'p_kind': scope.kind.name, 'p_target': scope.target, 'p_content': text, //
          'p_type': attachment?.type.name ?? 'text', 'p_media_path': attachment?.path, 'p_media_mime': attachment?.mime, //
          'p_reply_to': replyTo, 'p_duration_ms': attachment?.durationMs,
        });
        final message = ChatMessage(data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{});
        unawaited(notifyChatMessage(_backend, ref.read(chatPushSenderProvider), scope.kind, scope.target, message).catchError((Object _) {}));
        _invalidateConversation();
        return message;
      });

  /// `remove(messageId)`: the sender deletes for both sides (same server contract as groups).
  Future<void> remove(String messageId) => _track((v) => _removing = v, () async {
        final actor = _actor;
        final data = scope.kind == ChatKind.group
            ? await _backend.rpc('chat_delete_group_message_v3', {'p_actor': actor, 'p_group': scope.target, 'p_message': messageId})
            : await _backend.rpc('chat_delete_message_v1',
                {'p_actor': actor, 'p_kind': scope.kind.name, 'p_target': scope.target, 'p_message': messageId});
        final mediaPath = data is Map ? data['media_path'] : null;
        if (mediaPath is String && mediaPath.isNotEmpty) await discardChatAttachment(_backend, mediaPath);
        _invalidateConversation();
      });

  /// `edit({ message, content })`: the server checks ownership and the expected revision (CHAT_MESSAGE_CHANGED).
  Future<void> edit(ChatMessage message, String content) => _track((v) => _editing = v, () async {
        await _backend.rpc('chat_edit_message_v1', {
          'p_actor': _actor, 'p_kind': scope.kind.name, 'p_target': scope.target, 'p_message': message.id, //
          'p_content': content, 'p_expected_revision': message.revision ?? 0,
        });
        _invalidateConversation(groups: false);
      });

  /// `react({ message, emoji })`; a null emoji removes the reaction.
  Future<void> react(String messageId, String? emoji) => _track((v) => _reacting = v, () async {
        await _backend.rpc('chat_set_reaction_v2', {'p_actor': _actor, 'p_kind': scope.kind.name, 'p_message': messageId, 'p_emoji': emoji});
        await _client.invalidateQueries(queryKey: ['chat-reactions-v2', _backendUrl, _actor, scope.kind.name, scope.target]);
      });
}
