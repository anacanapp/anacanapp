// Ported from: src/components/MotherChatScreen.tsx
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart' show ALoader, px;
import 'copy/chat_copy.dart';
import 'data/chat.dart' show ChatKind;
import 'data/chat_backend.dart';
import 'ui/chat_widgets.dart';
import 'ui/conversation_screen.dart';

/// The linked partner's `{user_id, name, avatar_url}` (`['chat-partner-v2', backend, user, linked]`).
final chatPartnerQuery = queryProviderFamily<ChatRow?, String?>((ref, linked) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(chatBackendProvider);
  return QueryOptions<ChatRow?>(
    queryKey: ['chat-partner-v2', ref.watch(chatBackendUrlProvider), userId, linked],
    enabled: linked != null && linked.isNotEmpty && userId != null,
    queryFn: (_) => backend.maybeSingle('profiles', 'user_id,name,avatar_url', 'id', linked!),
  );
}, name: 'chatPartnerQuery');

/// The partner conversation of the signed-in user (MessagesScreen's partner row).
class MotherChatScreen extends ConsumerWidget {
  const MotherChatScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final linked = profile != null && profile.userId == user?.id ? profile.linkedPartnerId : null;
    final partner = ref.watch(chatPartnerQuery(linked));
    final data = partner.data;
    if (data != null) {
      return ConversationScreen(
        kind: ChatKind.partner,
        target: '${data['user_id']}',
        title: (data['name'] as String?) ?? '',
        avatar: data['avatar_url'] as String?,
        onBack: onBack,
      );
    }
    final a = context.a;
    final top = MediaQuery.paddingOf(context).top;
    return FullScreenChatLease(
      child: AScope(
        child: Container(
          color: a.bg,
          constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: EdgeInsets.fromLTRB(16, top + 10, 16, 12),
              decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
              child: Row(children: [
                ChatIconButton(icon: AIcons.arrowLeft, label: chatTr('common_geri', 'Geri'), onTap: onBack),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(chatTr('bottomnav_mesajlar', 'Mesajlar'),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: px(15, weight: FontWeight.w700, color: a.ink)),
                ),
              ]),
            ),
            ChatEmpty(children: [
              if (linked != null && linked.isNotEmpty && partner.isPending)
                const ALoader(size: 24)
              else ...[
                Text(partner.isError
                    ? chatTr('chat_partner_load_failed', 'Partnyor məlumatları yüklənmədi.')
                    : chatTr('usepartnermessages_evvelce_partnyorla_elaqelenin_2378fa', 'Əvvəlcə partnyorla əlaqələnin.')),
                if (partner.isError)
                  Semantics(
                    container: true,
                    button: true,
                    child: GestureDetector(
                      onTap: () => ref.read(chatPartnerQuery(linked).notifier).refetch(),
                      child: Text(chatTr('chat_retry', 'Yenidən cəhd et')),
                    ),
                  ),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}
