// Ported from: src/hooks/useDirectMessages.ts
//
// `useDirectMessages(otherUserId?)`: without a user the inbox (conversations grouped by partner), with a user the
// legacy thread (the conversation screen itself uses useChatMessages). One provider instance per argument.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import 'chat.dart' show ChatAbort, ChatImageCompressor, ChatMediaFile, ChatMediaType, chatErrorMessage;
import 'chat_backend.dart';
import 'chat_push.dart';
import 'partner_messages.dart' show ChatToast, ChatToastSink, Conversation;

@immutable
class DirectMessagesState {
  const DirectMessagesState({this.messages = const [], this.conversations = const [], this.loading = true});
  final List<ChatRow> messages;
  final List<Conversation> conversations;
  final bool loading;

  DirectMessagesState copyWith({List<ChatRow>? messages, List<Conversation>? conversations, bool? loading}) => DirectMessagesState(
      messages: messages ?? this.messages, conversations: conversations ?? this.conversations, loading: loading ?? this.loading);

  /// `totalUnread`.
  int get totalUnread => conversations.fold(0, (sum, c) => sum + c.unreadCount);
}

/// Throttle of the inbox refetch on bursts of inserts (leading + trailing, >= 2 s).
const Duration kDirectInboxThrottle = Duration(seconds: 2);

final directMessagesProvider =
    NotifierProvider.autoDispose.family<DirectMessagesController, DirectMessagesState, String?>(DirectMessagesController.new);

int _ms(String? iso) => DateTime.tryParse(iso ?? '')?.millisecondsSinceEpoch ?? 0;

class DirectMessagesController extends Notifier<DirectMessagesState> {
  DirectMessagesController(this.otherUserId);

  /// The thread partner; null = the inbox.
  final String? otherUserId;

  String? _userId;
  ChatBackend get _backend => ref.read(chatBackendProvider);

  @override
  DirectMessagesState build() {
    final userId = ref.watch(authUserProvider)?.id;
    final backend = ref.watch(chatBackendProvider);
    _userId = userId;
    if (userId != null) {
      var lastConversations = DateTime.fromMillisecondsSinceEpoch(0);
      Timer? trailing;
      ref.onDispose(() => trailing?.cancel());
      void throttledConversations() {
        final wait = kDirectInboxThrottle - DateTime.now().difference(lastConversations);
        if (wait <= Duration.zero) {
          lastConversations = DateTime.now();
          unawaited(fetchConversations());
          return;
        }
        trailing ??= Timer(wait, () {
          trailing = null;
          lastConversations = DateTime.now();
          unawaited(fetchConversations());
        });
      }

      void onInsert(ChatChange _) {
        if (otherUserId != null) {
          unawaited(fetchMessages());
        } else {
          throttledConversations();
        }
      }

      final prefix = 'dm_realtime:$userId:${otherUserId ?? 'inbox'}';
      backend.subscribe(ref, channelPrefix: prefix, table: 'direct_messages', event: 'INSERT', filter: 'receiver_id=eq.$userId', onChange: onInsert);
      backend.subscribe(ref, channelPrefix: '$prefix:sent', table: 'direct_messages', event: 'INSERT', filter: 'sender_id=eq.$userId', onChange: onInsert);
      scheduleMicrotask(() {
        if (!ref.mounted) return;
        unawaited(otherUserId != null ? fetchMessages() : fetchConversations());
      });
    }
    return const DirectMessagesState();
  }

  void _done() {
    if (ref.mounted) state = state.copyWith(loading: false);
  }

  /// `fetchConversations()`.
  Future<void> fetchConversations() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final data = await _backend.directInbox(userId);
      if (data.isEmpty) {
        if (ref.mounted) state = state.copyWith(conversations: const []);
        return;
      }
      // Group by conversation partner (insertion order = newest message first).
      final messages = <String, List<ChatRow>>{};
      final unread = <String, int>{};
      for (final msg in data) {
        final partnerId = '${msg['sender_id'] == userId ? msg['receiver_id'] : msg['sender_id']}';
        (messages[partnerId] ??= []).add(msg);
        unread[partnerId] = (unread[partnerId] ?? 0) + (msg['receiver_id'] == userId && msg['is_read'] != true ? 1 : 0);
      }
      final partnerIds = messages.keys.toList();
      List<ChatRow> profiles;
      try {
        profiles = await _backend.selectIn('public_profile_cards', 'user_id', partnerIds, columns: 'user_id, name, avatar_url');
      } catch (_) {
        profiles = const [];
      }
      final profileMap = {for (final p in profiles) '${p['user_id']}': p};
      final list = [
        for (final pid in partnerIds)
          () {
            final last = messages[pid]!.first;
            final profile = profileMap[pid];
            final name = profile?['name'] as String?;
            final avatar = profile?['avatar_url'] as String?;
            return Conversation(
              userId: pid,
              name: name != null && name.isNotEmpty ? name : tr('usedirectmessages_i_stifadeci_b6bdd6', 'İstifadəçi'),
              avatarUrl: avatar != null && avatar.isNotEmpty ? avatar : null,
              lastMessage: last['content'] as String?,
              lastMessageType: (last['message_type'] as String?) ?? 'text',
              lastMessageAt: (last['created_at'] as String?) ?? '',
              unreadCount: unread[pid] ?? 0,
            );
          }(),
      ];
      list.sort((a, b) => _ms(b.lastMessageAt).compareTo(_ms(a.lastMessageAt)));
      if (ref.mounted) state = state.copyWith(conversations: list);
    } catch (error) {
      debugPrint('Error fetching conversations: $error');
    } finally {
      _done();
    }
  }

  /// `fetchMessages()` (thread) + mark unread as read.
  Future<void> fetchMessages() async {
    final userId = _userId, other = otherUserId;
    if (userId == null || other == null) return;
    try {
      final data = await _backend.directThread(userId, other);
      if (ref.mounted) state = state.copyWith(messages: data);
      final unread = [for (final m in data) if (m['receiver_id'] == userId && m['is_read'] != true) '${m['id']}'];
      if (unread.isNotEmpty) await _backend.markDirectRead(unread);
    } catch (error) {
      debugPrint('Error fetching messages: $error');
    } finally {
      _done();
    }
  }

  /// `refetch`.
  Future<void> refetch() => otherUserId != null ? fetchMessages() : fetchConversations();

  /// `sendMessage(content, type, mediaUrl)`.
  Future<ChatRow?> sendMessage(String content, {String type = 'text', String? mediaUrl, ChatToastSink? toast}) async {
    final userId = _userId, other = otherUserId;
    if (userId == null || other == null) return null;
    try {
      final data = await _backend.insertDirectMessage({
        'sender_id': userId,
        'receiver_id': other,
        'content': type == 'text' ? content : null,
        'message_type': type,
        'media_url': mediaUrl == null || mediaUrl.isEmpty ? null : mediaUrl,
      });
      // The Azure function verifies the exact persisted row. Unsupported message types remain stored, but are
      // not submitted to a contract that rejects them.
      final messageType = data['message_type'];
      if (const ['text', 'image', 'video', 'audio'].contains(messageType)) {
        try {
          final text = (data['content'] as String?) ?? '';
          final fallback = tr('directmessages_yeni_mesaj', 'Yeni mesaj');
          final body = switch (messageType) {
            'text' => text.length > 60 ? '${String.fromCharCodes(text.codeUnits.take(60))}...' : (text.isNotEmpty ? text : fallback),
            'image' => tr('usedirectmessages_sekil_gonderdi_9e8836', '📷 Şəkil göndərdi'),
            'video' => tr('usedirectmessages_video_gonderdi_41246c', '🎥 Video göndərdi'),
            'audio' => tr('usedirectmessages_ses_mesaji_gonderdi_5b803e', '🎤 Səs mesajı göndərdi'),
            _ => fallback,
          };
          await ref.read(chatPushSenderProvider).send(SendPushPayload(
                userId: '${data['receiver_id']}',
                title: '$fallback 💬',
                body: body,
                data: {
                  'type': 'direct_message',
                  'context': 'direct_message',
                  'sender_id': data['sender_id'],
                  'messageId': data['id'],
                  'interactionId': data['id'],
                },
                kind: 'direct_message',
              ));
        } catch (pushError) {
          debugPrint('Push notification failed: $pushError');
        }
      }
      if (ref.mounted && !state.messages.any((m) => m['id'] == data['id'])) {
        state = state.copyWith(messages: [...state.messages, data]);
      }
      return data;
    } catch (error) {
      debugPrint('Error sending DM: $error');
      toast?.call(ChatToast(
          title: tr('usedirectmessages_mesaj_gonderilmedi_7df412', 'Mesaj göndərilmədi'), description: chatErrorMessage(error), destructive: true));
      return null;
    }
  }

  /// `uploadMedia(original, type, signal)`: the private `chat-media` object path (the message stores the path;
  /// display signs it, see chat_media.dart).
  Future<String?> uploadMedia(ChatMediaFile original, ChatMediaType type, {ChatAbort? signal, ChatImageCompressor? compress}) async {
    final userId = _userId;
    if (userId == null || (signal?.aborted ?? false)) return null;
    final file = type == ChatMediaType.image && compress != null ? await compress(original) : original;
    var ext = 'jpg';
    var contentType = 'image/jpeg';
    final fileType = file.type;
    if (type == ChatMediaType.audio) {
      ext = fileType.contains('mp4') ? 'mp4' : fileType.contains('ogg') ? 'ogg' : fileType.contains('webm') ? 'webm' : 'm4a';
      contentType = fileType.isNotEmpty ? fileType : 'audio/mp4';
    } else if (type == ChatMediaType.video) {
      ext = 'mp4';
      contentType = 'video/mp4';
    } else {
      if (fileType.contains('png')) {
        ext = 'png';
      } else if (fileType.contains('gif')) {
        ext = 'gif';
      } else if (fileType.contains('webp')) {
        ext = 'webp';
      }
      contentType = fileType.isNotEmpty ? fileType : 'image/jpeg';
    }
    final fileName = '$userId/${DateTime.now().millisecondsSinceEpoch}.$ext';
    // Let the request finish so cancellation can remove the exact uploaded path.
    final result = await _backend.upload('chat-media', fileName, Uint8List.fromList(file.bytes), contentType);
    if (result.error != null) throw result.error!;
    final path = result.path ?? fileName;
    if (signal?.aborted ?? false) {
      try {
        await _backend.remove('chat-media', [path]);
      } catch (_) {
        debugPrint('Failed to remove cancelled chat media upload');
      }
      return null;
    }
    return path;
  }
}

/// `useDirectMessages().conversations` total unread (Dashboard badge).
final directInboxUnreadProvider = Provider.autoDispose<int>((ref) => ref.watch(directMessagesProvider(null)).totalUnread);
