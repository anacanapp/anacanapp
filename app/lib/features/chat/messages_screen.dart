// Ported from: src/components/MessagesScreen.tsx
//
// Unified Messages (partner chat + community DMs + chat groups): Index renders it for `showMotherChat` (women)
// and as the partner `chat` tab.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart' show ALoader;
import 'data/chat_backend.dart';
import 'data/partner_messages.dart' show ChatToast;
import 'dm/conversation_list_screen.dart';
import 'dm/direct_message_screen.dart';
import 'mother_chat_screen.dart';
import 'ui/chat_widgets.dart';

/// The screens MessagesScreen switches between (replaceable in tests).
class MessagesScreenParts {
  const MessagesScreenParts({required this.list, required this.direct, required this.partner});
  final Widget Function(BuildContext context, {required VoidCallback onBack, required OpenChat onOpenChat, String? partnerId, ValueChanged<String>? onOpenGroup}) list;
  final Widget Function(BuildContext context, {required String userId, required String userName, String? userAvatar, required VoidCallback onBack}) direct;
  final Widget Function(BuildContext context, {required VoidCallback onBack}) partner;
}

final messagesScreenPartsProvider = Provider<MessagesScreenParts>((ref) => MessagesScreenParts(
      list: (context, {required onBack, required onOpenChat, partnerId, onOpenGroup}) =>
          ConversationListScreen(onBack: onBack, onOpenChat: onOpenChat, partnerId: partnerId, onOpenGroup: onOpenGroup),
      direct: (context, {required userId, required userName, userAvatar, required onBack}) =>
          DirectMessageScreen(userId: userId, userName: userName, userAvatar: userAvatar, onBack: onBack),
      partner: (context, {required onBack}) => MotherChatScreen(onBack: onBack),
    ));

/// `profiles.user_id` of the linked partner profile (RLS-protected; never guessed).
final messagesPartnerUserIdQuery = queryProviderFamily<String?, String?>((ref, partnerProfileId) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  return QueryOptions<String?>(
    queryKey: ['messages-partner-user-id', userId, partnerProfileId],
    enabled: userId != null && partnerProfileId != null && partnerProfileId.isNotEmpty,
    queryFn: (_) async {
      final row = await backend.maybeSingle('profiles', 'user_id', 'id', partnerProfileId!);
      return row?['user_id'] as String?;
    },
  );
}, name: 'messagesPartnerUserIdQuery');

enum _ChatType { dm, partner, group }

typedef _ActiveChat = ({_ChatType type, String userId, String name, String? avatar});

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key, required this.onBack, this.partnerProfileId});
  final VoidCallback onBack;

  /// `profile.linked_partner_id` of the signed-in user.
  final String? partnerProfileId;

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  _ActiveChat? _activeChat;
  String? _userId;

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authUserProvider)?.id;
  }

  @override
  void didUpdateWidget(MessagesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.partnerProfileId != widget.partnerProfileId) _activeChat = null;
  }

  void _openChat(String userId, String name, String? avatar, String? partnerUserId) {
    // Never guess DM vs partner while the RLS-protected identity lookup is unavailable.
    if (widget.partnerProfileId != null && widget.partnerProfileId!.isNotEmpty && partnerUserId == null) {
      showChatToast(context, ChatToast(title: tr('usepartnerdata_partner_melumatlari_yuklene_bi_430423', 'Could not load partner details'), destructive: true));
      ref.read(messagesPartnerUserIdQuery(widget.partnerProfileId).notifier).refetch();
      return;
    }
    setState(() => _activeChat = (
          type: partnerUserId != null && userId == partnerUserId ? _ChatType.partner : _ChatType.dm,
          userId: userId,
          name: name,
          avatar: avatar,
        ));
  }

  void _close() => setState(() => _activeChat = null);

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider)?.id;
    if (userId != _userId) {
      _userId = userId;
      _activeChat = null;
    }
    final partner = ref.watch(messagesPartnerUserIdQuery(widget.partnerProfileId));
    final parts = ref.watch(messagesScreenPartsProvider);
    if (partner.isLoading) {
      return Container(
        color: context.tokens.shadcn.background,
        constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
        alignment: Alignment.center,
        child: ALoader(size: 24, color: context.tokens.shadcn.primary),
      );
    }
    final partnerUserId = partner.data;
    final active = _activeChat;
    if (active != null) {
      switch (active.type) {
        case _ChatType.group:
          return ref.watch(chatGroupScreenProvider)(context, active.userId, _close);
        case _ChatType.partner:
          return parts.partner(context, onBack: _close);
        case _ChatType.dm:
          return parts.direct(context, userId: active.userId, userName: active.name, userAvatar: active.avatar, onBack: _close);
      }
    }
    return parts.list(
      context,
      onBack: widget.onBack,
      onOpenChat: (id, name, avatar) => _openChat(id, name, avatar, partnerUserId),
      partnerId: partnerUserId,
      onOpenGroup: (id) => setState(() => _activeChat = (type: _ChatType.group, userId: id, name: '', avatar: null)),
    );
  }
}
