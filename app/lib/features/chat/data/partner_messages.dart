// Ported from: src/hooks/usePartnerMessages.ts, src/hooks/usePartnerConversation.ts
//
// React shared one realtime channel per user between every mounted hook instance; here the single
// [partnerMessagesProvider] instance is that channel (alive while anything watches it). The hook's toasts are
// emitted as [ChatToast]s: on [partnerMessageToastsProvider] for realtime arrivals (shown by
// PartnerMessageToastListener) and to the caller's sink for its own actions.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import 'chat.dart' show chatErrorMessage;
import 'chat_backend.dart';

/// A `toast({ title, description, variant })` request of a chat hook.
@immutable
class ChatToast {
  const ChatToast({this.title, this.description, this.destructive = false});
  final String? title;
  final String? description;
  final bool destructive;

  @override
  bool operator ==(Object other) =>
      other is ChatToast && other.title == title && other.description == description && other.destructive == destructive;
  @override
  int get hashCode => Object.hash(title, description, destructive);
  @override
  String toString() => 'ChatToast($title, $description, destructive: $destructive)';
}

typedef ChatToastSink = void Function(ChatToast toast);

/// `notifyIncomingChatMessage({ title, body, idSeed, userId })` (src/lib/chat-notifications.ts: a foreground local
/// notification outside silent hours). Owned by the chat-notifications service; no-op until it is ported.
typedef IncomingChatNotifier = Future<void> Function({required String title, required String body, required int idSeed, String? userId});

Future<void> _noIncomingNotification({required String title, required String body, required int idSeed, String? userId}) async {}

final chatIncomingNotifierProvider = Provider<IncomingChatNotifier>((ref) => _noIncomingNotification);

/// Realtime toasts of [partnerMessagesProvider] (the hook's `toast(...)` inside the channel callback).
final partnerMessageToastsProvider = Provider<StreamController<ChatToast>>((ref) {
  final controller = StreamController<ChatToast>.broadcast(sync: true);
  ref.onDispose(controller.close);
  return controller;
});

@immutable
class PartnerMessagesState {
  const PartnerMessagesState({this.messages = const [], this.loading = true});
  final List<ChatRow> messages;
  final bool loading;

  PartnerMessagesState copyWith({List<ChatRow>? messages, bool? loading}) =>
      PartnerMessagesState(messages: messages ?? this.messages, loading: loading ?? this.loading);

  /// `getUnreadCount()`.
  int unreadCount(String? userId) => messages.where((m) => m['receiver_id'] == userId && m['is_read'] != true).length;
}

String _jsSlice(String text, int end) {
  final units = text.codeUnits;
  return units.length <= end ? text : String.fromCharCodes(units.sublist(0, end));
}

/// `usePartnerMessages()`.
final partnerMessagesProvider =
    NotifierProvider.autoDispose<PartnerMessagesController, PartnerMessagesState>(PartnerMessagesController.new);

class PartnerMessagesController extends Notifier<PartnerMessagesState> {
  String? _userId;
  int _fetch = 0;

  ChatBackend get _backend => ref.read(chatBackendProvider);

  @override
  PartnerMessagesState build() {
    final userId = ref.watch(authUserProvider)?.id;
    final backend = ref.watch(chatBackendProvider);
    _userId = userId;
    if (userId != null) {
      backend.subscribe(ref,
          channelPrefix: 'partner_messages_changes:$userId',
          table: 'partner_messages',
          event: 'INSERT',
          filter: 'receiver_id=eq.$userId',
          onChange: (change) => _onInsert(userId, change.newRecord));
      scheduleMicrotask(() {
        if (ref.mounted) unawaited(fetchMessages());
      });
    }
    return const PartnerMessagesState();
  }

  /// `fetchMessages()` (`refetch`).
  Future<void> fetchMessages() async {
    final userId = _userId;
    if (userId == null) return;
    final run = ++_fetch;
    try {
      final rows = await _backend.partnerMessages(userId);
      if (!ref.mounted || run != _fetch || _userId != userId) return;
      state = state.copyWith(messages: rows);
    } catch (error) {
      debugPrint('Error fetching partner messages: $error');
    } finally {
      if (ref.mounted && _userId == userId) state = state.copyWith(loading: false);
    }
  }

  void _onInsert(String userId, ChatRow message) {
    unawaited(fetchMessages());
    if (message.isEmpty) return;
    Map<String, dynamic>? data;
    try {
      final content = message['content'];
      if (content is String && content.isNotEmpty) {
        final parsed = jsonDecode(content);
        if (parsed is Map) data = Map<String, dynamic>.from(parsed);
      }
    } catch (_) {
      // Content is not JSON, use as-is
    }
    String? field(String key) => data?[key] is String && (data![key] as String).isNotEmpty ? data[key] as String : null;
    final type = message['message_type'];
    // Native phone notification for text / love messages.
    if (type == 'text' || type == 'love') {
      final title = type == 'love'
          ? tr('usepartnermessages_sevgi_aldiniz_346423', 'Sevgi aldınız! ❤️')
          : tr('usepartnermessages_yeni_mesaj_title', 'Yeni mesaj 💬');
      final content = message['content'];
      final body = type == 'love'
          ? tr('usepartnermessages_partnyorunuz_size_sevgi_gonder_765fb4', 'Partnyorunuz sizə sevgi göndərdi')
          : content is String
              ? _jsSlice(content, 60)
              : tr('usepartnermessages_mesaj_geldi_9e478b', 'Mesaj gəldi');
      unawaited(ref.read(chatIncomingNotifierProvider)(
              title: title, body: body, idSeed: DateTime.now().millisecondsSinceEpoch, userId: userId)
          .catchError((Object _) {}));
    }
    final toasts = ref.read(partnerMessageToastsProvider);
    void toast(ChatToast t) {
      if (!toasts.isClosed) toasts.add(t);
    }

    switch (type) {
      case 'love':
        toast(ChatToast(
            title: tr('usepartnermessages_sevgi_aldiniz_346423', 'Sevgi aldınız! ❤️'),
            description: tr('usepartnermessages_partnyorunuz_size_sevgi_gonderdi_765fb4', 'Partnyorunuz sizə sevgi göndərdi')));
      case 'mood_update':
        toast(ChatToast(
            title: field('title') ?? tr('usepartnermessages_ehval_yenilendi_967cd7', 'Əhval yeniləndi 💭'),
            description: field('body') ?? tr('usepartnermessages_partnyorunuz_ehvalini_qeyd_etd_612302', 'Partnyorunuz əhvalını qeyd etdi')));
      case 'contraction_started':
        toast(ChatToast(
            title: field('title') ?? tr('usepartnermessages_sanci_basladi_c51f20', 'Sancı başladı! ⏱️'),
            description: field('body') ?? tr('usepartnermessages_partnyorunuz_sanci_qeyd_etdi_ac77ff', 'Partnyorunuz sancı qeyd etdi')));
      case 'contraction_511':
        toast(ChatToast(
            title: tr('usepartnermessages_5_1_1_qaydasi_976061', '⚠️ 5-1-1 Qaydası!'),
            description: tr('usepartnermessages_xestexanaya_getme_vaxti_ola_biler_b244c0', 'Xəstəxanaya getmə vaxtı ola bilər!')));
      case 'kick_session':
        toast(ChatToast(title: field('title') ?? tr('usepartnermessages_korpe_tepik_atdi_628b12', 'Körpə təpik atdı! 👶'), description: field('body')));
      case 'water_goal':
        toast(ChatToast(
            title: field('title') ?? tr('usepartnermessages_su_hedefine_catdi_55f2fb', 'Su hədəfinə çatdı! 💧'),
            description: tr('usepartnermessages_partnyorunuz_gundelik_su_hedefine_catdi_f06510', 'Partnyorunuz gündəlik su hədəfinə çatdı!')));
      default:
        if (field('title') != null) toast(ChatToast(title: field('title'), description: field('body')));
    }
  }

  /// `sendMessage(receiverId, messageType, content)`.
  Future<ChatRow?> sendMessage(String receiverId, String messageType, {String? content, ChatToastSink? toast}) async {
    final userId = _userId;
    if (userId == null) return null;
    final show = toast ?? (_) {};
    try {
      final data = await _backend.insertPartnerMessage({
        'sender_id': userId,
        'receiver_id': receiverId,
        'message_type': messageType,
        'content': content == null || content.isEmpty ? null : content,
      });
      if (messageType == 'love') {
        show(ChatToast(
            title: tr('usepartnermessages_sevgi_gonderildi_14b554', 'Sevgi göndərildi! ❤️'),
            description: tr('usepartnermessages_partnyorunuz_bildiris_alacaq_62f7d7', 'Partnyorunuz bildiriş alacaq')));
      } else {
        show(ChatToast(title: tr('usepartnermessages_mesaj_gonderildi_353ca0', 'Mesaj göndərildi! 💬')));
      }
      await fetchMessages();
      return data;
    } catch (error) {
      debugPrint('Error sending partner message: $error');
      show(ChatToast(title: tr('usepartnermessages_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: chatErrorMessage(error), destructive: true));
      return null;
    }
  }

  /// `sendLoveToPartner()`.
  Future<ChatRow?> sendLoveToPartner({ChatToastSink? toast}) async {
    final show = toast ?? (_) {};
    final linked = ref.read(authProfileProvider)?.linkedPartnerId;
    if (linked == null || linked.isEmpty) {
      show(ChatToast(
          title: tr('usepartnermessages_partnyor_tapilmadi_1239a8', 'Partnyor tapılmadı'),
          description: tr('usepartnermessages_evvelce_partnyorla_elaqelenin_2378fa', 'Əvvəlcə partnyorla əlaqələnin'),
          destructive: true));
      return null;
    }
    ChatRow? partnerProfile;
    try {
      partnerProfile = await _backend.maybeSingle('profiles', 'user_id', 'id', linked);
    } catch (_) {
      partnerProfile = null;
    }
    final partnerUserId = partnerProfile?['user_id'];
    if (partnerUserId is! String) {
      show(ChatToast(title: tr('usepartnermessages_partnyor_tapilmadi_1239a8', 'Partnyor tapılmadı'), destructive: true));
      return null;
    }
    return sendMessage(partnerUserId, 'love', content: '❤️', toast: toast);
  }

  /// `markAsRead(id)`.
  Future<void> markAsRead(String id) async {
    final userId = _userId;
    if (userId == null) return;
    try {
      await _backend.markPartnerMessageRead(id, userId);
      await fetchMessages();
    } catch (error) {
      debugPrint('Error marking message as read: $error');
    }
  }
}

// ── usePartnerConversation ──

/// Message types the partner chat itself shows (same list as chat_messages_v2).
const Set<String> _chatTypes = {'text', 'love', 'image', 'audio', 'video'};

/// `Conversation` of useDirectMessages (also used for groups and the partner chat in the inbox).
@immutable
class Conversation {
  const Conversation({
    required this.userId,
    required this.name,
    this.avatarUrl,
    this.lastMessage,
    required this.lastMessageType,
    required this.lastMessageAt,
    required this.unreadCount,
    this.group = false,
  });
  final String userId;
  final String name;
  final String? avatarUrl;
  final String? lastMessage;
  final String lastMessageType;
  final String lastMessageAt;
  final int unreadCount;

  /// A group row merged into the Messages list.
  final bool group;
}

final partnerConversationPersonQuery = queryProviderFamily<ChatRow?, String?>((ref, partnerId) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  return QueryOptions<ChatRow?>(
    queryKey: ['partner-conversation-person', userId, partnerId],
    enabled: userId != null && partnerId != null && partnerId.isNotEmpty,
    staleTime: const Duration(minutes: 5),
    queryFn: (_) => backend.maybeSingle('profiles', 'name, avatar_url', 'user_id', partnerId!),
  );
}, name: 'partnerConversationPersonQuery');

@immutable
class PartnerConversationView {
  const PartnerConversationView({this.conversation, this.unreadCount = 0, this.loading = true});
  final Conversation? conversation;
  final int unreadCount;
  final bool loading;
}

/// `usePartnerConversation(partnerId)`: the partner chat as a [Conversation] for the unified list.
final partnerConversationProvider = Provider.autoDispose.family<PartnerConversationView, String?>((ref, partnerId) {
  final partner = ref.watch(partnerMessagesProvider);
  final userId = ref.watch(authUserProvider)?.id;
  final person = ref.watch(partnerConversationPersonQuery(partnerId)).data;
  final chat = partner.messages.where((m) => _chatTypes.contains(m['message_type']) && m['deleted_at'] == null).toList();
  if (partnerId == null || partnerId.isEmpty || userId == null || chat.isEmpty) {
    return PartnerConversationView(loading: partner.loading);
  }
  final unread = chat.where((m) => m['receiver_id'] == userId && m['is_read'] != true).length;
  final last = chat.first; // newest first
  final name = (person?['name'] as String?)?.trim();
  final avatar = person?['avatar_url'] as String?;
  return PartnerConversationView(
    loading: partner.loading,
    unreadCount: unread,
    conversation: Conversation(
      userId: partnerId,
      name: name != null && name.isNotEmpty ? name : 'Partner',
      avatarUrl: avatar != null && avatar.isNotEmpty ? avatar : null,
      lastMessage: (last['content'] as String?)?.isNotEmpty == true ? last['content'] as String : null,
      lastMessageType: (last['message_type'] as String?) ?? 'text',
      lastMessageAt: (last['created_at'] as String?) ?? DateTime.now().toUtc().toIso8601String(),
      unreadCount: unread,
    ),
  );
});
