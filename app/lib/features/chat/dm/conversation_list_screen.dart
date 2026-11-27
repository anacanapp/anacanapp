// Ported from: src/components/community/ConversationListScreen.tsx
//
// The Messages inbox: direct conversations, the partner chat and the user's chat groups in one list, plus open
// group invitations. Entry point for the community feature: `ConversationListScreen(onBack, onOpenChat, …)`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ARingSpinner, ATopbar, px;
import '../copy/chat_copy.dart';
import '../data/chat_groups.dart';
import '../data/direct_messages.dart';
import '../data/partner_messages.dart';
import '../data/stickers.dart';
import '../ui/chat_widgets.dart';

typedef OpenChat = void Function(String userId, String name, String? avatar);

/// `getLastMessagePreview(type, content)`.
String lastMessagePreview(String type, String? content) {
  switch (type) {
    case 'image':
      return groupTr('conversationlistscreen_sekil_25710e', '📷 Şəkil');
    case 'video':
      return '🎥 Video';
    case 'audio':
      return groupTr('conversationlistscreen_ses_mesaji_acd8d9', '🎤 Səs mesajı');
    default:
      if (stickerFromMessage(content) != null) return '🧸 ${stickerText('sticker')}';
      final text = content ?? '';
      final units = text.codeUnits;
      return units.length <= 50 ? text : String.fromCharCodes(units.sublist(0, 50));
  }
}

/// The merged, newest-first list (DMs, the partner chat when it is not already a DM, member groups).
List<Conversation> mergeConversations({
  required List<Conversation> conversations,
  Conversation? partner,
  String? partnerId,
  required List<Map<String, dynamic>> groups,
}) {
  final list = [...conversations];
  if (partner != null && !list.any((c) => c.userId == partnerId)) list.insert(0, partner);
  for (final group in groups) {
    if (group['is_member'] != true) continue;
    final last = group['last_message'] as String?;
    final type = group['last_message_type'] as String?;
    final at = group['last_message_at'] as String?;
    list.add(Conversation(
      userId: '${group['id']}',
      group: true,
      name: (group['name'] as String?) ?? '',
      avatarUrl: group['cover_image_url'] as String?,
      lastMessage: last != null && last.isNotEmpty ? last : groupTr('chat_empty', 'İlk mesajı göndərin.'),
      lastMessageType: type != null && type.isNotEmpty ? type : 'text',
      lastMessageAt: at != null && at.isNotEmpty ? at : (group['created_at'] as String?) ?? '',
      unreadCount: jsNumber(group['unread_count']),
    ));
  }
  // Array.prototype.sort is stable: equal timestamps keep their order.
  int ms(Conversation c) => DateTime.tryParse(c.lastMessageAt)?.millisecondsSinceEpoch ?? 0;
  final indexed = [for (var i = 0; i < list.length; i++) (i, list[i])];
  indexed.sort((a, b) {
    final byDate = ms(b.$2).compareTo(ms(a.$2));
    return byDate != 0 ? byDate : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

class ConversationListScreen extends ConsumerStatefulWidget {
  const ConversationListScreen({super.key, required this.onBack, required this.onOpenChat, this.partnerId, this.onOpenGroup});
  final VoidCallback onBack;
  final OpenChat onOpenChat;

  /// The linked partner's user id (merges the partner chat into the list).
  final String? partnerId;

  /// Opens a group; without it the list shows the group chat itself.
  final ValueChanged<String>? onOpenGroup;

  @override
  ConsumerState<ConversationListScreen> createState() => _ConversationListScreenState();
}

class _ConversationListScreenState extends ConsumerState<ConversationListScreen> {
  String? _openGroup;

  void _selectGroup(String id) {
    final open = widget.onOpenGroup;
    if (open != null) {
      open(id);
    } else {
      setState(() => _openGroup = id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inbox = ref.watch(directMessagesProvider(null));
    final partner = ref.watch(partnerConversationProvider(widget.partnerId));
    final groupState = ref.watch(chatGroupsProvider(kInboxGroups));
    final openGroup = _openGroup;
    if (openGroup != null) return ref.watch(chatGroupScreenProvider)(context, openGroup, () => setState(() => _openGroup = null));

    final a = context.a;
    final all = mergeConversations(
      conversations: inbox.conversations,
      partner: partner.conversation,
      partnerId: widget.partnerId,
      groups: groupState.groups,
    );
    final invites = [for (final g in groupState.groups) if (g['access_state'] == 'invited' && g['is_member'] != true) g];
    final loading = inbox.loading || partner.loading || groupState.loading;

    Widget body;
    if (loading) {
      body = const Padding(padding: EdgeInsets.symmetric(vertical: 64), child: Center(child: ARingSpinner(size: 28)));
    } else if (all.isEmpty) {
      body = ACard(
        padding: const EdgeInsets.symmetric(vertical: 38, horizontal: 18),
        child: Column(children: [
          Container(
            width: 64,
            height: 64,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: AIcon(AIcons.messageCircle, size: 26, color: a.accentInk),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(groupTr('conversationlistscreen_hele_mesajiniz_yoxdur_79d3c7', 'Hələ mesajınız yoxdur'),
                textAlign: TextAlign.center, style: context.aText.aListTitle),
          ),
          Text(groupTr('conversationlistscreen_istifadeci_profilinden_mesaj_gondere_bil_777661', 'İstifadəçi profilindən mesaj göndərə bilərsiniz'),
              textAlign: TextAlign.center, style: context.aText.aListSub),
        ]),
      );
    } else {
      body = ACard(
        variant: ACardVariant.list,
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(children: [
          for (var i = 0; i < all.length; i++)
            _ConversationRow(
              key: ValueKey('${all[i].group ? 'group' : 'person'}:${all[i].userId}'),
              conversation: all[i],
              last: i == all.length - 1,
              onTap: () => all[i].group ? _selectGroup(all[i].userId) : widget.onOpenChat(all[i].userId, all[i].name, all[i].avatarUrl),
            ),
        ]),
      );
    }

    // The page scrolled in the WebView (`min-h-screen`); natively the screen owns its scroll view.
    return SingleChildScrollView(
      child: AScope(
      child: Container(
        color: a.bg,
        constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
        padding: EdgeInsets.only(bottom: 96, top: MediaQuery.paddingOf(context).top),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            ATopbar(onBack: widget.onBack, backScale: 0.9, title: groupTr('untranslated_mesajlar_ak8wzw', 'Mesajlar'), titleSize: 16),
            if (invites.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(groupTr('group_invites'), style: px(12, weight: FontWeight.w700, color: context.tokens.shadcn.mutedForeground, height: 16 / 12)),
                  for (final group in invites) ...[
                    const SizedBox(height: 8),
                    _InviteRow(group: group, onTap: () => _selectGroup('${group['id']}')),
                  ],
                ]),
              ),
            if (groupState.error != null)
              ChatNotice(
                onTap: () => groupState.refetch(),
                child: Text('${groupTr('chat_groups', 'Qruplar')} · ${groupTr('chat_retry', 'Yenidən cəhd et')}'),
              ),
            body,
          ]),
        ),
      ),
      ),
    );
  }
}

class _InviteRow extends StatelessWidget {
  const _InviteRow({required this.group, required this.onTap});
  final Map<String, dynamic> group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final name = (group['name'] as String?) ?? '';
    return Semantics(
      container: true,
      button: true,
      label: '$name ${groupTr('group_invited_note')} ${groupTr('group_accept')}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ACard(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            AIcon(AIcons.users, size: 22, color: s.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: px(14, weight: FontWeight.w700, height: 20 / 14)),
                Text(groupTr('group_invited_note'), style: px(12, color: s.mutedForeground, height: 16 / 12)),
              ]),
            ),
            const SizedBox(width: 12),
            Text(groupTr('group_accept'), style: px(12, weight: FontWeight.w700, color: s.primary, height: 16 / 12)),
          ]),
        ),
      ),
    );
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({super.key, required this.conversation, required this.last, required this.onTap});
  final Conversation conversation;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final c = conversation;
    final unread = c.unreadCount > 0;
    final at = DateTime.tryParse(c.lastMessageAt);
    final preview = lastMessagePreview(c.lastMessageType, c.lastMessage);
    return Semantics(
      container: true,
      button: true,
      label: '${c.name} $preview',
      excludeSemantics: true,
      child: PressScale(
        scale: 0.98,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: const Color(0x00000000), border: last ? null : Border(bottom: BorderSide(color: a.line))),
          child: Row(children: [
            SizedBox(
              width: 48,
              height: 48,
              child: Stack(clipBehavior: Clip.none, children: [
                ChatAvatar(
                  size: 48,
                  url: c.avatarUrl,
                  border: Border.all(color: a.peach1, width: 2),
                  fallbackColor: a.peach1,
                  fallback: c.group
                      ? AIcon(AIcons.users, size: 22, color: a.accentInk)
                      : Text(charAt0(c.name), style: px(16, weight: FontWeight.w700, color: a.accentInk)),
                ),
                if (unread)
                  PositionedDirectional(
                    top: -2,
                    end: -2,
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle, border: Border.all(color: a.surface, width: 2)),
                      alignment: Alignment.center,
                      child: Text(c.unreadCount > 9 ? '9+' : '${c.unreadCount}',
                          style: px(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF), height: 1)),
                    ),
                  ),
              ]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: c.name),
                        if (c.group)
                          TextSpan(
                            text: ' · ${groupTr('chat_groups', 'Qruplar')}',
                            style: px(10, color: context.tokens.shadcn.mutedForeground),
                          ),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: px(14, weight: unread ? FontWeight.w800 : FontWeight.w600, color: a.ink),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(at == null ? '' : formatDistanceToNow(at), style: px(10, weight: FontWeight.w500, color: a.inkFaint)),
                ]),
                const SizedBox(height: 2),
                Text(preview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: px(12, weight: unread ? FontWeight.w600 : FontWeight.w400, color: unread ? a.ink : a.inkSoft)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
