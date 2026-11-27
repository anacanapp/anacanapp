// Ported from: src/lib/chat.ts
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, StorageException;

import '../../../core/offline/offline_outbox.dart' show newClientId;
import '../../../shell/links/js_url.dart';
import '../copy/chat_copy.dart';
import 'chat_backend.dart';
import 'chat_push.dart';
import 'stickers.dart';

/// `ChatKind` (`'direct' | 'partner' | 'group'`); [name] is the RPC value.
enum ChatKind { direct, partner, group }

/// `ChatMediaType`.
enum ChatMediaType {
  image,
  video,
  audio;

  static ChatMediaType? tryParse(String? value) => switch (value) {
        'image' => image,
        'video' => video,
        'audio' => audio,
        _ => null,
      };
}

/// `ChatMessage` (a row of `chat_messages_v2` / `direct_messages` / `partner_messages` / `group_messages`).
@immutable
class ChatMessage {
  const ChatMessage(this.row);
  final ChatRow row;

  String get id => '${row['id']}';
  String get senderId => '${row['sender_id']}';
  String? get receiverId => row['receiver_id'] as String?;
  String? get groupId => row['group_id'] as String?;
  String? get content => row['content'] as String?;
  String get messageType => (row['message_type'] as String?) ?? 'text';
  String? get mediaUrl => row['media_url'] as String?;
  String? get mediaPath => row['media_path'] as String?;
  String? get mediaMime => row['media_mime'] as String?;
  int? get durationMs => (row['duration_ms'] as num?)?.toInt();
  String? get replyToId => row['reply_to_id'] as String?;
  bool get isRead => row['is_read'] == true;
  String get createdAt => (row['created_at'] as String?) ?? '';
  String? get deletedAt => row['deleted_at'] as String?;
  int? get revision => (row['revision'] as num?)?.toInt();
  String? get editedAt => row['edited_at'] as String?;

  @override
  String toString() => 'ChatMessage($row)';
}

/// `ChatReaction`.
class ChatReaction {
  const ChatReaction(this.row);
  final ChatRow row;
  String get id => '${row['id']}';
  String get userId => '${row['user_id']}';
  String get emoji => '${row['emoji']}';
  String? messageId(String column) => row[column] as String?;
}

/// `ChatAttachment`.
@immutable
class ChatAttachment {
  const ChatAttachment({required this.path, required this.mime, required this.type, this.durationMs});
  final String path;
  final String mime;
  final ChatMediaType type;
  final int? durationMs;

  ChatAttachment withDuration(int? durationMs) => ChatAttachment(path: path, mime: mime, type: type, durationMs: durationMs);

  /// JSON.stringify order of the retry fingerprint (`{ path, mime, type, durationMs }`).
  Map<String, Object?> toJson() => {'path': path, 'mime': mime, 'type': type.name, 'durationMs': ?durationMs};

  @override
  bool operator ==(Object other) =>
      other is ChatAttachment && other.path == path && other.mime == mime && other.type == type && other.durationMs == durationMs;
  @override
  int get hashCode => Object.hash(path, mime, type, durationMs);
}

/// A picked / recorded file (`Blob`): bytes + `file.type`.
class ChatMediaFile {
  const ChatMediaFile(this.bytes, this.type);
  final Uint8List bytes;

  /// MIME type, possibly with parameters (`audio/webm;codecs=opus`).
  final String type;
  int get size => bytes.length;
}

/// `AbortController` / `AbortSignal`.
class ChatAbort {
  bool _aborted = false;
  bool get aborted => _aborted;
  void abort() => _aborted = true;
}

const List<String> kChatReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

/// Behind the "+" in the message menu; the server (Duzelis66) accepts exactly these plus [kChatReactions].
const List<String> kChatMoreReactions = ['😍', '🥰', '😘', '🤗', '😅', '😭', '😡', '🤔', '👌', '🙌', '💪', '🎉', '💕', '🌸', '👶', '🍼'];

String chatTable(ChatKind kind) => switch (kind) {
      ChatKind.group => 'group_messages',
      ChatKind.partner => 'partner_messages',
      ChatKind.direct => 'direct_messages',
    };

String reactionColumn(ChatKind kind) => switch (kind) {
      ChatKind.group => 'group_message_id',
      ChatKind.partner => 'partner_message_id',
      ChatKind.direct => 'direct_message_id',
    };

const Map<String, String> _mimeExtensions = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', //
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', //
  'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};

/// `error.message` of a thrown value.
String chatErrorMessage(Object? error) => switch (error) {
      null => '',
      PostgrestException(:final message) => message,
      StorageException(:final message) => message,
      ChatException(:final message) => message,
      StateError(:final message) => message,
      _ => '$error',
    };

String? _errorCode(Object? error) => switch (error) {
      PostgrestException(:final code) => code,
      ChatException(:final code) => code,
      _ => null,
    };

/// `chatError(error)`: the user-facing text of a chat failure.
String chatError(Object? error) {
  final code = chatErrorMessage(error);
  if (RegExp('CHAT_GROUP_BLOCKED|CHAT_GROUP_UNBLOCK_FIRST').hasMatch(code)) return groupTr('group_blocked');
  if (RegExp('CHAT_GROUP_ADMINS_ONLY').hasMatch(code)) return groupTr('group_admins_only');
  if (RegExp('CHAT_TAG_OWN_GROUPS_ONLY').hasMatch(code)) return groupTr('group_tag_note');
  if (RegExp('CHAT_(GROUP_ADMIN|GROUP_OWNER)_REQUIRED').hasMatch(code)) {
    return groupTr('chat_admin_only', 'Bu əməliyyatı qrup administratoru edə bilər.');
  }
  if (RegExp('CHAT_GROUP_(MEMBERSHIP_REQUIRED|INVITE_REQUIRED|UNAVAILABLE)').hasMatch(code)) {
    return groupTr('chat_group_access', 'Qrupa girişiniz yoxdur və ya qrup artıq aktiv deyil.');
  }
  if (RegExp('CHAT_ACCOUNT_(CHANGED|BLOCKED)').hasMatch(code)) return groupTr('chat_account_unavailable', 'Hesabı və giriş icazəsini yoxlayın.');
  if (RegExp('CHAT_GROUP_FULL').hasMatch(code)) return groupTr('chat_group_full', 'Qrupun üzv limiti dolub.');
  if (RegExp('CHAT_(INVALID_MEDIA|MEDIA_TOO_LARGE)').hasMatch(code)) {
    return groupTr('chat_media_invalid', 'Uyğun şəkil, səs və ya 25 MB-dan kiçik video seçin.');
  }
  if (_errorCode(error) == 'PGRST202') {
    return groupTr('chat_update_pending', 'Mesajlaşma yenilənməsi serverdə hələ hazır deyil. Bir qədər sonra yenidən yoxlayın.');
  }
  return groupTr('chat_action_failed', 'Əməliyyat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
}

/// `chatPreview(message)`.
String chatPreview(String messageType, String? content) {
  if (messageType == 'image') return groupTr('chat_image', 'Şəkil');
  if (messageType == 'audio') return groupTr('chat_voice', 'Səs mesajı');
  if (messageType == 'video') return groupTr('chat_video', 'Video');
  if (messageType == 'text' && stickerFromMessage(content) != null) return '🧸 ${stickerText('sticker')}';
  final text = content ?? '';
  return text.isNotEmpty ? text : groupTr('chat_message', 'Mesaj');
}

String _jsSlice(String text, int end) {
  final units = text.codeUnits;
  return units.length <= end ? text : String.fromCharCodes(units.sublist(0, end));
}

/// `notifyChatMessage(kind, target, message)`.
Future<void> notifyChatMessage(ChatBackend backend, ChatPushSender push, ChatKind kind, String target, ChatMessage message) async {
  final title = groupTr('directmessages_yeni_mesaj', 'Yeni mesaj');
  final preview = _jsSlice(chatPreview(message.messageType, message.content), 120);
  final body = preview.isNotEmpty ? preview : title;
  if (kind == ChatKind.group) {
    // One call: the server fans the push out to every current member (dedup-claimed per message + recipient).
    // Only a server without that contract gets the per-member loop.
    final fanout = await push.send(SendPushPayload(userId: message.senderId, title: title, body: body, kind: 'group_message_fanout', data: {
      'type': 'group_message_fanout', 'context': 'group_message_fanout', 'groupId': target, 'messageId': message.id, //
      'interactionId': message.id,
    }));
    if (fanout.serverError != 'unsupported_context_or_type') return;
    Object? data;
    try {
      data = await backend.rpc('chat_group_members_v2', {'p_group': target});
    } catch (_) {
      return;
    }
    final recipients = [
      for (final member in data is List ? data : const [])
        if (member is Map && member['user_id'] != message.senderId) '${member['user_id']}',
    ];
    for (var offset = 0; offset < recipients.length; offset += 4) {
      await Future.wait(recipients.skip(offset).take(4).map((userId) => push.send(SendPushPayload(
          userId: userId, title: title, body: body, kind: 'group_message', data: {
            'type': 'group_message', 'context': 'group_message', 'groupId': target, 'messageId': message.id, //
            'interactionId': message.id,
          }))));
    }
  } else {
    await push.send(SendPushPayload(
      userId: target,
      title: title,
      body: body,
      kind: kind == ChatKind.partner ? 'partner_message' : 'direct_message',
      data: kind == ChatKind.partner
          ? {'type': 'partner_message', 'context': 'partner', 'messageId': message.id, 'interactionId': message.id}
          : {'type': 'direct_message', 'context': 'direct_message', 'sender_id': message.senderId, 'messageId': message.id, //
              'interactionId': message.id},
    ));
  }
}

/// Image pre-processing before upload (`compressImageForUpload`); identity by default (the picker already scales
/// to 1600 px / quality 82, see ui/media_picker.dart).
typedef ChatImageCompressor = Future<ChatMediaFile> Function(ChatMediaFile file);

Future<ChatMediaFile> _noCompression(ChatMediaFile file) async => file;

/// `uploadChatMedia(actor, kind, target, original, type, signal)`.
Future<ChatAttachment?> uploadChatMedia(ChatBackend backend, String actor, ChatKind kind, String target, ChatMediaFile original,
    ChatMediaType type, {ChatAbort? signal, ChatImageCompressor compress = _noCompression, String Function() newId = newClientId}) async {
  final file = type == ChatMediaType.image ? await compress(original) : original;
  final mime = file.type.toLowerCase().split(';').first;
  final ext = _mimeExtensions[mime];
  if (ext == null || !mime.startsWith('${type.name}/') || file.size == 0) throw const ChatException('CHAT_INVALID_MEDIA');
  if (file.size > (type == ChatMediaType.image ? 10 : 25) * 1024 * 1024) throw const ChatException('CHAT_MEDIA_TOO_LARGE');
  if (signal?.aborted ?? false) return null;
  final path = '$actor/${kind.name}/$target/${newId()}.$ext';
  // Keep codec information in the encoded bytes, with a canonical bucket MIME.
  final result = await backend.upload('conversation-media', path, file.bytes, mime);
  if (result.error != null) throw result.error!;
  if (signal?.aborted ?? false) {
    try {
      await backend.remove('conversation-media', [path]);
    } catch (_) {
      debugPrint('Failed to remove cancelled chat media upload');
    }
    return null;
  }
  return ChatAttachment(path: path, mime: mime, type: type);
}

/// `discardChatAttachment(path)`: storage RLS rejects removal once a persisted message references this path.
Future<void> discardChatAttachment(ChatBackend backend, String path) async {
  try {
    await backend.remove('conversation-media', [path]);
  } catch (_) {
    // Never erase a sent message to clean an upload.
  }
}

const List<String> _legacyHosts = [
  'api.anacan.az',
  'tntbjulojatnrqmylorp.supabase.co',
  'anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io',
];

/// `resolveChatMedia(message)`: a signed URL for `media_path`, legacy own-storage URLs re-signed with the selected
/// backend, other https URLs as they are.
Future<String?> resolveChatMedia(ChatBackend backend, String backendUrl, ChatMessage message) async {
  final mediaPath = message.mediaPath;
  if (mediaPath != null && mediaPath.isNotEmpty) return backend.signedUrl('conversation-media', mediaPath, 300);
  final mediaUrl = message.mediaUrl;
  final legacy = mediaUrl != null && mediaUrl.isNotEmpty
      ? mediaUrl
      : (const ['audio', 'image', 'video'].contains(message.messageType) ? message.content : null);
  if (legacy == null || legacy.isEmpty) return null;
  final url = JsUrl.parse(legacy);
  if (url == null) return null;
  if (url.protocol != 'https:' || url.username.isNotEmpty || url.password.isNotEmpty) return null;
  final ownHosts = [JsUrl.parse(backendUrl)?.hostname, ..._legacyHosts];
  final match = RegExp(r'^/storage/v1/object/(public|sign)/(chat-media|conversation-media)/(.+)$').firstMatch(url.pathname);
  if (ownHosts.contains(url.hostname) && match != null) {
    String path;
    try {
      path = Uri.decodeComponent(match[3]!);
    } catch (_) {
      return null;
    }
    if (path.startsWith('/') || path.contains(r'\') || path.contains('\u0000') || path.split('/').any((p) => p.isEmpty || p == '..' || p == '.')) {
      return null;
    }
    // Sign with the selected backend only. Never forward an Azure session to Source.
    Object? failure;
    try {
      final signed = await backend.signedUrl(match[2]!, path, 300);
      if (signed.isNotEmpty) return signed;
    } catch (error) {
      failure = error;
    }
    // Only URLs originally published in the legacy public bucket may use the public compatibility path.
    if (match[1] == 'public' && match[2] == 'chat-media') return backend.publicUrl('chat-media', path);
    throw failure ?? const ChatException('CHAT_MEDIA_SIGNING_FAILED');
  }
  return url.href;
}

/// One send path for partner quick messages and ❤️ (same RPC and push as the chat screen).
Future<ChatMessage> sendPartnerMessage(ChatBackend backend, ChatPushSender push, String actor, String partnerUserId, String content,
    {String type = 'text'}) async {
  final data = await backend.rpc('chat_send_message_v2', {
    'p_actor': actor, 'p_id': newClientId(), 'p_kind': 'partner', 'p_target': partnerUserId, 'p_content': content, //
    'p_type': type, 'p_media_path': null, 'p_media_mime': null, 'p_reply_to': null, 'p_duration_ms': null,
  });
  final message = ChatMessage(Map<String, dynamic>.from(data as Map));
  unawaited(notifyChatMessage(backend, push, ChatKind.partner, partnerUserId, message).catchError((Object _) {}));
  return message;
}
