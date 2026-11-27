// Ported from: src/components/community/ChatGroupsPanel.tsx
//
// The Community "Qruplar" tab: scope chips (all / mine / public / private), the group cards (visibility, members,
// owner / invitation / pending state, unread badge) and the "Yeni qrup yarat" dialog (name, description, public /
// private, invited people). A retried create keeps its id while the inputs are unchanged.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../chat/data/chat.dart' show chatError;
import '../../chat/data/chat_backend.dart' show ChatRow;
import '../../chat/data/partner_messages.dart' show ChatToast;
import '../../chat/ui/chat_member_picker.dart';
import '../../chat/ui/chat_widgets.dart' show ChatEmpty, showChatToast;
import '../../community/data/community_env.dart' show communityUuidProvider;
import '../../settings/ui/settings_ui.dart' show ALoader, ShadDialogFrame, px, shadTitle, showShadDialog;
import '../data/chat_groups.dart';
import 'group_widgets.dart';

class ChatGroupsPanel extends ConsumerStatefulWidget {
  const ChatGroupsPanel({super.key, required this.onOpen, this.search = ''});
  final void Function(String id) onOpen;
  final String search;

  @override
  ConsumerState<ChatGroupsPanel> createState() => _ChatGroupsPanelState();
}

class _ChatGroupsPanelState extends ConsumerState<ChatGroupsPanel> {
  String _scope = 'all';
  final TextEditingController _name = TextEditingController();
  final TextEditingController _description = TextEditingController();
  final ValueNotifier<String> _visibility = ValueNotifier('private');
  final ValueNotifier<List<ChatRow>> _people = ValueNotifier(const []);
  ({String fingerprint, String id})? _attempt;

  ChatGroupArgs get _args => ChatGroupArgs(scope: _scope, search: widget.search);

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _visibility.dispose();
    _people.dispose();
    super.dispose();
  }

  Future<bool> _submit() async {
    final state = ref.read(chatGroupsStateProvider(_args));
    final name = _name.text.trim();
    if (name.isEmpty || state.creating) return false;
    final ids = [for (final p in _people.value) '${p['user_id']}']..sort();
    final fingerprint = jsonEncode([name, _description.text.trim(), _visibility.value, ids]);
    if (_attempt?.fingerprint != fingerprint) _attempt = (fingerprint: fingerprint, id: ref.read(communityUuidProvider)());
    try {
      final id = await state.create(CreateGroupInput(
        id: _attempt!.id,
        name: name,
        description: _description.text.trim(),
        visibility: _visibility.value,
        people: [for (final p in _people.value) '${p['user_id']}'],
      ));
      _name.clear();
      _description.clear();
      _people.value = const [];
      _attempt = null;
      widget.onOpen(id);
      return true;
    } catch (error) {
      if (mounted) showChatToast(context, ChatToast(title: chatError(error), destructive: true));
      return false;
    }
  }

  Future<void> _openCreate() => showShadDialog<void>(
        context,
        builder: (ctx) => _CreateGroupDialog(
          args: _args,
          name: _name,
          description: _description,
          visibility: _visibility,
          people: _people,
          onSubmit: () async {
            final done = await _submit();
            if (done && ctx.mounted) Navigator.of(ctx).pop();
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatGroupsStateProvider(_args));
    final s = context.tokens.shadcn;
    final scopes = [
      ('all', groupTr('common_all', 'Hamısı')),
      ('mine', groupTr('chat_my_groups', 'Qruplarım')),
      ('public', groupTr('group_public')),
      ('private', groupTr('group_private')),
    ];
    Widget body;
    if (state.loading) {
      body = const ChatEmpty(children: [ALoader(size: 24)]);
    } else if (state.error != null) {
      body = ChatEmpty(alert: true, children: [
        Text(chatError(state.error)),
        GestureDetector(onTap: () => unawaited(state.refetch()), child: Text(groupTr('chat_retry', 'Yenidən cəhd et'))),
      ]);
    } else if (state.groups.isEmpty) {
      body = ChatEmpty(children: [
        AIcon(AIcons.users, size: 32, color: context.a.inkSoft),
        Text(groupTr('chat_no_groups', 'Hələ qrup yoxdur. İlk yazışma qrupunuzu yaradın.')),
      ]);
    } else {
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < state.groups.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          _GroupCard(group: state.groups[i], onTap: () => widget.onOpen('${state.groups[i]['id']}')),
        ],
      ]);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(groupTr('chat_groups', 'Qruplar'), style: px(15, weight: FontWeight.w700, color: s.foreground)),
              Text('${groupTr('group_public')} · ${groupTr('group_private')}', style: px(12, color: s.mutedForeground, height: 16 / 12)),
            ]),
          ),
          const SizedBox(width: 12),
          AButton(
            variant: AButtonVariant.pillSolid,
            onPressed: () => unawaited(_openCreate()),
            leading: const AIcon(AIcons.plus, size: 17, color: Color(0xFFFFFFFF)),
            child: Text(groupTr('chat_create_group', 'Yeni qrup yarat')),
          ),
        ]),
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(children: [
            for (var i = 0; i < scopes.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              GroupChip(label: scopes[i].$2, selected: _scope == scopes[i].$1, onTap: () => setState(() => _scope = scopes[i].$1), tab: true),
            ],
          ]),
        ),
        const SizedBox(height: 16),
        body,
      ]),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.onTap});
  final ChatRow group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final public = group['chat_visibility'] == 'public';
    final unread = (group['unread_count'] as num?)?.toInt() ?? 0;
    final description = group['description'] as String?;
    final emoji = group['icon_emoji'] is String && (group['icon_emoji'] as String).isNotEmpty ? group['icon_emoji'] as String : '💬';
    final status = group['is_owner'] == true
        ? Text(groupTr('group_owner'), style: px(10, weight: FontWeight.w600, color: s.primary, height: 1.4))
        : group['access_state'] == 'invited'
            ? Text(groupTr('group_invites'), style: px(10, weight: FontWeight.w600, color: s.primary, height: 1.4))
            : group['access_state'] == 'requested'
                ? Text(groupTr('group_pending'), style: px(10, color: s.mutedForeground, height: 1.4))
                : null;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ACard(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
              alignment: Alignment.center,
              child: Text(emoji, style: const TextStyle(fontSize: 20, height: 1)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${group['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w700, color: s.foreground, height: 20 / 14)),
                const SizedBox(height: 4),
                Row(children: [
                  AIcon(public ? AIcons.globe : AIcons.lockKeyhole, size: 11, color: s.mutedForeground),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      '${groupTr(public ? 'group_public' : 'group_private')} · ${group['member_count'] ?? 0} ${groupTr('chat_members', 'üzv')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: px(11, color: s.mutedForeground, height: 1.4),
                    ),
                  ),
                ]),
                if (description != null && description.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(description, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12, color: s.mutedForeground, height: 16 / 12)),
                  ),
                ?status,
              ]),
            ),
            if (unread > 0) ...[
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(999)),
                child: Text(unread > 99 ? '99+' : '$unread', style: px(12, color: s.primaryForeground, height: 16 / 12)),
              ),
            ],
            const SizedBox(width: 12),
            AIcon(AIcons.chevronRight, size: 17, color: s.mutedForeground, mirrorInRtl: true),
          ]),
        ),
      ),
    );
  }
}

class _CreateGroupDialog extends ConsumerWidget {
  const _CreateGroupDialog({required this.args, required this.name, required this.description, required this.visibility, required this.people, required this.onSubmit});
  final ChatGroupArgs args;
  final TextEditingController name;
  final TextEditingController description;
  final ValueNotifier<String> visibility;
  final ValueNotifier<List<ChatRow>> people;
  final Future<void> Function() onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final creating = ref.watch(chatGroupsStateProvider(args)).creating;
    final s = context.tokens.shadcn;
    // max-h-[90dvh] overflow-y-auto: showShadDialog scrolls the frame.
    return ShadDialogFrame(maxWidth: 448, inset: 16, children: [
        Text(groupTr('chat_create_group', 'Yeni qrup yarat'), style: shadTitle(context)),
        GroupTextField(controller: name, label: groupTr('chat_group_name', 'Qrupun adı'), maxLength: 80, placeholder: true),
        GroupTextField(controller: description, label: groupTr('group_description'), maxLength: 500, multiline: true, placeholder: true),
        ValueListenableBuilder<String>(
          valueListenable: visibility,
          builder: (context, value, _) => Row(children: [
            for (final option in const ['public', 'private']) ...[
              if (option == 'private') const SizedBox(width: 8),
              Expanded(
                child: GroupVisibilityOption(
                  selected: value == option,
                  public: option == 'public',
                  note: true,
                  onTap: () => visibility.value = option,
                ),
              ),
            ],
          ]),
        ),
        Text(groupTr('group_invite'), style: px(12, weight: FontWeight.w600, color: s.foreground, height: 16 / 12)),
        ValueListenableBuilder<List<ChatRow>>(
          valueListenable: people,
          builder: (context, selected, _) => ChatMemberPicker(selected: selected, onChange: (next) => people.value = next),
        ),
        ListenableBuilder(
          listenable: name,
          builder: (context, _) => AButton(
            variant: AButtonVariant.pillSolid,
            onPressed: name.text.trim().isEmpty || creating ? null : () => unawaited(onSubmit()),
            child: creating ? const ALoader(size: 18, color: Color(0xFFFFFFFF)) : Text(groupTr('chat_create', 'Yarat')),
          ),
        ),
      ]);
  }
}
