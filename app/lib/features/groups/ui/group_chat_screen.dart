// Ported from: src/components/community/GroupChatScreen.tsx, src/styles/chat.css (.chat-screen, .chat-topbar,
//              .chat-empty)
//
// A member sees the group conversation (the chat feature's ConversationScreen, kind group) with the details dialog
// (people tabs, approve / reject / block / promote / transfer / remove, leave, delete), the invitation dialog and
// the settings dialog. Anyone else gets the join / request / invitation / blocked screen. Dialogs are routes above
// the full-screen chat (z-100 / z-110 in React); Android back closes them first, then the screen.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/nav/shell_controller.dart' show backDispatcherProvider;
import '../../baby/widgets/child_selector.dart' show showConfirmDialog;
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../chat/data/chat.dart' show ChatKind, chatError;
import '../../chat/data/chat_backend.dart' show ChatException, ChatRow;
import '../../chat/data/partner_messages.dart' show ChatToast;
import '../../chat/ui/chat_member_picker.dart';
import '../../chat/ui/chat_widgets.dart' show ChatAvatar, ChatEmpty, ChatIconButton, FullScreenChatLease, charAt0, showChatToast;
import '../../chat/ui/conversation_screen.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, ShadDialogFrame, px, shadTitle, showShadDialog;
import '../data/chat_groups.dart';
import 'group_widgets.dart';

/// `<GroupChatScreen groupId onBack />`.
class GroupChatScreen extends ConsumerStatefulWidget {
  const GroupChatScreen({super.key, required this.groupId, required this.onBack});
  final String groupId;
  final VoidCallback onBack;

  @override
  ConsumerState<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends ConsumerState<GroupChatScreen> {
  final ValueNotifier<String> _tab = ValueNotifier('member');
  final List<BuildContext> _dialogs = [];

  ChatGroupArgs get _args => ChatGroupArgs.single(widget.groupId);

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  void _failed(Object error) {
    if (mounted) showChatToast(context, ChatToast(title: chatError(error), destructive: true));
  }

  Future<void> _act(String action, [List<String> targets = const []]) async {
    try {
      await ref.read(chatGroupsStateProvider(_args)).manage(widget.groupId, action, targets);
    } catch (error) {
      _failed(error);
    }
  }

  Future<void> _dialog(WidgetBuilder builder) async {
    await showShadDialog<void>(context, builder: (ctx) {
      _dialogs.add(ctx);
      return builder(ctx);
    });
    _dialogs.removeWhere((c) => !c.mounted);
  }

  void _closeDialogs() {
    for (final ctx in _dialogs.reversed.toList()) {
      if (ctx.mounted) Navigator.of(ctx).pop();
    }
    _dialogs.clear();
  }

  /// Leave / delete: the screen goes away with its dialogs.
  Future<void> _leaveWith(String action) async {
    try {
      await ref.read(chatGroupsStateProvider(_args)).manage(widget.groupId, action);
      _closeDialogs();
      widget.onBack();
    } catch (error) {
      _failed(error);
    }
  }

  Future<bool> _confirm(String message) => showConfirmDialog(context, message);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatGroupsStateProvider(_args));
    final group = state.group;
    if (group?['is_member'] != true) {
      if (_dialogs.isNotEmpty) WidgetsBinding.instance.addPostFrameCallback((_) => _closeDialogs());
      return _NotMemberScreen(groupId: widget.groupId, onBack: widget.onBack, onAct: _act);
    }
    final g = group!;
    final public = g['chat_visibility'] == 'public';
    final pending = (g['pending_count'] as num?)?.toInt() ?? 0;
    return ConversationScreen(
      kind: ChatKind.group,
      target: widget.groupId,
      title: '${g['name'] ?? ''}',
      avatar: g['cover_image_url'] as String?,
      canModerate: g['can_manage'] == true,
      readOnly: g['chat_posting_policy'] == 'admins' && g['can_manage'] != true,
      subtitle: '${groupTr(public ? 'group_public' : 'group_private')} · ${g['member_count'] ?? 0} ${groupTr('chat_members', 'üzv')}'
          '${pending > 0 ? ' · $pending ${groupTr('group_requests')}' : ''}',
      onBack: widget.onBack,
      onDetails: () => unawaited(_dialog((ctx) => _DetailsDialog(
            args: _args,
            tab: _tab,
            onAct: _act,
            confirm: _confirm,
            onInvite: () => unawaited(_dialog((_) => _InviteDialog(args: _args, onFailed: _failed))),
            onEdit: () => unawaited(_dialog((_) => _EditDialog(args: _args, group: g, onFailed: _failed))),
            onLeave: () async {
              if (await _confirm(groupTr('chat_leave_confirm', 'Qrupdan ayrılmaq istəyirsiniz?'))) await _leaveWith('leave');
            },
            onDelete: () async {
              if (await _confirm(groupTr('group_delete_confirm'))) await _leaveWith('delete');
            },
          ))),
    );
  }
}

/// The join / request / invitation / blocked screen (`createPortal(<section className="chat-screen">)`).
class _NotMemberScreen extends ConsumerStatefulWidget {
  const _NotMemberScreen({required this.groupId, required this.onBack, required this.onAct});
  final String groupId;
  final VoidCallback onBack;
  final Future<void> Function(String action, [List<String> targets]) onAct;

  @override
  ConsumerState<_NotMemberScreen> createState() => _NotMemberScreenState();
}

class _NotMemberScreenState extends ConsumerState<_NotMemberScreen> {
  final OverlayPortalController _portal = OverlayPortalController();
  VoidCallback? _releaseBack;

  @override
  void initState() {
    super.initState();
    _portal.show();
    _releaseBack = ref.read(backDispatcherProvider).push(() {
      widget.onBack();
      return true;
    });
  }

  @override
  void dispose() {
    _releaseBack?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FullScreenChatLease(
        child: OverlayPortal(controller: _portal, overlayChildBuilder: _section, child: const SizedBox.shrink()),
      );

  Widget _section(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final top = MediaQuery.paddingOf(context).top;
    final state = ref.watch(chatGroupsStateProvider(ChatGroupArgs.single(widget.groupId)));
    final group = state.group;
    Widget button(String label, VoidCallback? onTap, {bool solid = false, Widget? child}) => solid
        ? Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: AButton(variant: AButtonVariant.pillSolid, onPressed: onTap, child: child ?? Text(label)),
          )
        : Semantics(
            button: true,
            enabled: onTap != null,
            child: GestureDetector(onTap: onTap, child: Opacity(opacity: onTap == null ? 0.5 : 1, child: Text(label))),
          );

    List<Widget> body;
    if (state.loading) {
      body = const [ALoader(size: 24)];
    } else if (group == null) {
      body = [
        AIcon(AIcons.users, size: 36, color: a.inkSoft),
        Text(chatError(state.error ?? const ChatException('CHAT_GROUP_UNAVAILABLE'))),
        button(groupTr('chat_retry', 'Yenidən cəhd et'), () => unawaited(state.refetch())),
      ];
    } else {
      final blocked = group['access_state'] == 'blocked';
      final invited = group['access_state'] == 'invited';
      final public = group['chat_visibility'] == 'public';
      final managing = state.managing;
      final emoji = group['icon_emoji'] is String && (group['icon_emoji'] as String).isNotEmpty ? group['icon_emoji'] as String : '💬';
      body = [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(24)),
          alignment: Alignment.center,
          child: Text(emoji, style: const TextStyle(fontSize: 36, height: 1)),
        ),
        Text('${group['name'] ?? ''}', style: px(20, weight: FontWeight.w700, color: a.ink, height: 28 / 20)),
        Row(mainAxisSize: MainAxisSize.min, children: [
          AIcon(public ? AIcons.globe : AIcons.lockKeyhole, size: 13, color: a.inkSoft),
          const SizedBox(width: 4),
          Text('${groupTr(public ? 'group_public' : 'group_private')} · ${group['member_count'] ?? 0} ${groupTr('chat_members', 'üzv')}',
              style: px(12, color: a.inkSoft, height: 16 / 12)),
        ]),
        ConstrainedBox(constraints: const BoxConstraints(maxWidth: 384), child: Text('${group['description'] ?? ''}')),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 384),
          child: Text(groupTr(blocked
              ? 'group_blocked'
              : invited
                  ? 'group_invited_note'
                  : public
                      ? 'group_public_note'
                      : 'group_private_note')),
        ),
        if (!blocked) ...(group['access_state'] == 'requested'
            ? [
                Text(groupTr('group_pending'), style: const TextStyle(fontWeight: FontWeight.w700)),
                button(groupTr('common_legv_et', 'Ləğv et'), managing ? null : () => unawaited(widget.onAct('cancel_request'))),
              ]
            : [
                button(
                  '',
                  managing ? null : () => unawaited(widget.onAct(invited ? 'accept_invite' : 'join')),
                  solid: true,
                  child: managing
                      ? const ALoader(size: 17, color: Color(0xFFFFFFFF))
                      : Text(groupTr(invited ? 'group_accept' : public ? 'chat_join' : 'group_request', 'Qoşul')),
                ),
                if (invited) button(groupTr('group_reject'), managing ? null : () => unawaited(widget.onAct('decline_invite'))),
              ]),
      ];
    }
    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          color: a.bg,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: EdgeInsets.fromLTRB(16, top + 10, 16, 12),
              decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
              child: Row(children: [
                ChatIconButton(icon: AIcons.arrowLeft, label: tr('common_geri', 'Geri'), onTap: widget.onBack),
                const SizedBox(width: 12),
                Text(groupTr('chat_groups', 'Qruplar'), style: px(15, weight: FontWeight.w700, color: a.ink)),
              ]),
            ),
            Expanded(child: SingleChildScrollView(child: ChatEmpty(alert: group == null && !state.loading, children: body))),
          ]),
        ),
      ),
    );
  }
}

class _DetailsDialog extends ConsumerWidget {
  const _DetailsDialog({
    required this.args,
    required this.tab,
    required this.onAct,
    required this.confirm,
    required this.onInvite,
    required this.onEdit,
    required this.onLeave,
    required this.onDelete,
  });
  final ChatGroupArgs args;
  final ValueNotifier<String> tab;
  final Future<void> Function(String action, [List<String> targets]) onAct;
  final Future<bool> Function(String message) confirm;
  final VoidCallback onInvite;
  final VoidCallback onEdit;
  final Future<void> Function() onLeave;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chatGroupsStateProvider(args));
    final group = state.group;
    final userId = ref.watch(authUserProvider)?.id;
    final s = context.tokens.shadcn;
    if (group == null) return const SizedBox.shrink();
    final public = group['chat_visibility'] == 'public';
    final owner = group['is_owner'] == true;
    final managing = state.managing;
    final labels = {
      'member': groupTr('chat_members', 'Üzvlər'),
      'requested': groupTr('group_requests'),
      'invited': groupTr('group_invites'),
      'blocked': groupTr('group_bans'),
    };
    final tabs = ['member', if (owner) ...['requested', 'invited', 'blocked']];
    final description = group['description'] as String?;

    Widget iconButton(AIconData icon, String label, VoidCallback onTap, {Color? color}) =>
        ChatIconButton(icon: icon, label: label, enabled: !managing, color: color, onTap: onTap);

    Future<void> confirmThen(String message, String action, String target) async {
      if (await confirm(message)) await onAct(action, [target]);
    }

    return ValueListenableBuilder<String>(
      valueListenable: tab,
      builder: (context, current, _) {
        final visible = [for (final m in state.members) if (m['state'] == current) m];
        return ShadDialogFrame(maxWidth: 448, inset: 16, children: [
          Text('${group['name'] ?? ''}', style: shadTitle(context)),
          Text('${groupTr(public ? 'group_public' : 'group_private')} · ${groupTr(public ? 'group_public_note' : 'group_private_note')}',
              style: px(12, color: s.mutedForeground, height: 16 / 12)),
          if (description != null && description.isNotEmpty) Text(description, style: px(14, color: s.foreground, height: 20 / 14)),
          if (owner)
            Row(children: [
              AButton(
                variant: AButtonVariant.pillSolid,
                onPressed: onInvite,
                leading: const AIcon(AIcons.userPlus, size: 16, color: Color(0xFFFFFFFF)),
                child: Text(groupTr('group_invite')),
              ),
              const SizedBox(width: 8),
              AButton(
                variant: AButtonVariant.pillSolid,
                onPressed: onEdit,
                leading: const AIcon(AIcons.settings2, size: 16, color: Color(0xFFFFFFFF)),
                child: Text(groupTr('group_settings')),
              ),
            ]),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (var i = 0; i < tabs.length; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                GroupChip(
                  small: true,
                  label: '${labels[tabs[i]]} (${state.members.where((m) => m['state'] == tabs[i]).length})',
                  selected: current == tabs[i],
                  onTap: () => tab.value = tabs[i],
                ),
              ],
            ]),
          ),
          if (state.membersLoading)
            const Align(alignment: AlignmentDirectional.centerStart, child: ALoader(size: 20))
          else if (state.membersError != null)
            Semantics(liveRegion: true, child: Text(chatError(state.membersError)))
          else if (visible.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(groupTr('group_no_people'), style: px(12, color: s.mutedForeground, height: 16 / 12)),
            ),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final member in visible)
              Padding(
                key: ValueKey('member:${member['user_id']}'),
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: _memberRow(context, member, group, userId, iconButton, confirmThen),
              ),
          ]),
          Semantics(
            button: true,
            enabled: !managing,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: managing ? null : () => unawaited(onLeave()),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(border: Border.all(color: s.border), borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(AIcons.logOut, size: 16, color: s.foreground),
                  const SizedBox(width: 8),
                  Text(groupTr('chat_leave', 'Qrupdan ayrıl'), style: px(14, color: s.foreground, height: 20 / 14)),
                ]),
              ),
            ),
          ),
          if (owner)
            Semantics(
              button: true,
              enabled: !managing,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: managing ? null : () => unawaited(onDelete()),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AIcon(AIcons.trash2, size: 16, color: s.destructive),
                  const SizedBox(width: 8),
                  Text(groupTr('group_delete'), style: px(14, color: s.destructive, height: 20 / 14)),
                ]),
              ),
            ),
        ]);
      },
    );
  }

  Widget _memberRow(
    BuildContext context,
    ChatRow member,
    ChatRow group,
    String? userId,
    Widget Function(AIconData icon, String label, VoidCallback onTap, {Color? color}) iconButton,
    Future<void> Function(String message, String action, String target) confirmThen,
  ) {
    final s = context.tokens.shadcn;
    final id = '${member['user_id']}';
    final name = member['name'] as String?;
    final owner = group['is_owner'] == true;
    final memberState = member['state'];
    final role = id == group['created_by'] ? groupTr('group_owner') : member['role'] == 'admin' ? groupTr('group_administrator') : '';
    final actions = <Widget>[
      if (memberState == 'requested' && owner) ...[
        iconButton(AIcons.check, groupTr('group_approve'), () => unawaited(onAct('approve', [id])), color: s.primary),
        iconButton(AIcons.x, groupTr('group_reject'), () => unawaited(onAct('reject', [id]))),
      ],
      if (memberState == 'blocked' && owner)
        GestureDetector(
          onTap: () => unawaited(onAct('unblock', [id])),
          child: Text(groupTr('group_unblock'), style: px(12, color: s.primary, height: 16 / 12)),
        ),
      if (memberState == 'invited' && owner) iconButton(AIcons.x, groupTr('group_reject'), () => unawaited(onAct('remove', [id]))),
      if ((memberState == 'requested' || memberState == 'invited') && owner)
        iconButton(AIcons.ban, groupTr('group_block'), () => unawaited(confirmThen('${groupTr('group_block')}: $name?', 'block', id)), color: s.destructive),
    ];
    final manageable = memberState == 'member' && group['can_manage'] == true && id != userId && id != group['created_by'];
    return Row(children: [
      ChatAvatar(size: 36, url: member['avatar_url'] as String?, fallback: Text(charAt0(name).isNotEmpty ? charAt0(name) : '•')),
      const SizedBox(width: 8),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name != null && name.isNotEmpty ? name : groupTr('chat_member', 'Üzv'),
              maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w600, color: s.foreground, height: 20 / 14)),
          Text(role, style: px(10, color: s.primary, height: 1.4)),
        ]),
      ),
      ...actions,
      if (manageable)
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 144),
          child: Wrap(alignment: WrapAlignment.end, spacing: 2, runSpacing: 2, children: [
            if (owner) ...[
              iconButton(AIcons.shield, groupTr(member['role'] == 'admin' ? 'group_demote' : 'group_make_administrator'),
                  () => unawaited(onAct(member['role'] == 'admin' ? 'demote' : 'promote', [id]))),
              iconButton(AIcons.users, groupTr('group_transfer'), () => unawaited(confirmThen('${groupTr('group_transfer')}: $name?', 'transfer', id))),
            ],
            if (owner || member['role'] != 'admin') ...[
              iconButton(AIcons.userX, groupTr('chat_remove_member', 'Üzvü çıxar'),
                  () => unawaited(confirmThen(groupTr('chat_remove_member_confirm', 'Bu üzvü qrupdan çıxarmaq istəyirsiniz?'), 'remove', id))),
              iconButton(AIcons.ban, groupTr('group_block'), () => unawaited(confirmThen('${groupTr('group_block')}: $name?', 'block', id)), color: s.destructive),
            ],
          ]),
        ),
    ]);
  }
}

class _InviteDialog extends ConsumerStatefulWidget {
  const _InviteDialog({required this.args, required this.onFailed});
  final ChatGroupArgs args;
  final void Function(Object error) onFailed;
  @override
  ConsumerState<_InviteDialog> createState() => _InviteDialogState();
}

class _InviteDialogState extends ConsumerState<_InviteDialog> {
  List<ChatRow> _people = const [];

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatGroupsStateProvider(widget.args));
    final excluded = [for (final m in state.members) if (m['state'] != 'requested') '${m['user_id']}'];
    return ShadDialogFrame(maxWidth: 448, inset: 16, children: [
      Text(groupTr('group_invite'), style: shadTitle(context)),
      ChatMemberPicker(selected: _people, onChange: (next) => setState(() => _people = next), excluded: excluded),
      AButton(
        variant: AButtonVariant.pillSolid,
        onPressed: _people.isEmpty || state.managing
            ? null
            : () async {
                try {
                  await state.manage(widget.args.groupId!, 'invite', [for (final p in _people) '${p['user_id']}']);
                  if (!mounted) return;
                  setState(() => _people = const []);
                  Navigator.of(this.context).pop();
                } catch (error) {
                  widget.onFailed(error);
                }
              },
        child: state.managing ? const ALoader(size: 17, color: Color(0xFFFFFFFF)) : Text(groupTr('group_invite')),
      ),
    ]);
  }
}

class _EditDialog extends ConsumerStatefulWidget {
  const _EditDialog({required this.args, required this.group, required this.onFailed});
  final ChatGroupArgs args;
  final ChatRow group;
  final void Function(Object error) onFailed;
  @override
  ConsumerState<_EditDialog> createState() => _EditDialogState();
}

class _EditDialogState extends ConsumerState<_EditDialog> {
  // beginEdit: the current values.
  late final TextEditingController _name = TextEditingController(text: '${widget.group['name'] ?? ''}');
  late final TextEditingController _description = TextEditingController(text: widget.group['description'] as String? ?? '');
  late String _visibility = widget.group['chat_visibility'] == 'public' ? 'public' : 'private';
  late String _posting = widget.group['chat_posting_policy'] == 'admins' ? 'admins' : 'members';

  @override
  void initState() {
    super.initState();
    _name.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatGroupsStateProvider(widget.args));
    final s = context.tokens.shadcn;
    return ShadDialogFrame(maxWidth: 448, inset: 16, children: [
      Text(groupTr('group_settings'), style: shadTitle(context)),
      GroupTextField(controller: _name, label: groupTr('chat_group_name', 'Qrupun adı'), maxLength: 80),
      GroupTextField(controller: _description, label: groupTr('group_description'), maxLength: 500, multiline: true),
      Row(children: [
        for (final option in const ['public', 'private']) ...[
          if (option == 'private') const SizedBox(width: 8),
          Expanded(child: GroupVisibilityOption(selected: _visibility == option, public: option == 'public', onTap: () => setState(() => _visibility = option))),
        ],
      ]),
      Semantics(
        checked: _posting == 'admins',
        label: groupTr('group_admins_only'),
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _posting = _posting == 'admins' ? 'members' : 'admins'),
          child: Row(children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: _posting == 'admins',
                activeColor: s.primary,
                onChanged: (v) => setState(() => _posting = v == true ? 'admins' : 'members'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(groupTr('group_admins_only'), style: px(14, color: s.foreground, height: 20 / 14))),
          ]),
        ),
      ),
      AButton(
        variant: AButtonVariant.pillSolid,
        onPressed: _name.text.trim().isEmpty || state.updating
            ? null
            : () async {
                try {
                  await state.update(UpdateGroupInput(
                    group: widget.args.groupId!,
                    name: _name.text.trim(),
                    description: _description.text,
                    visibility: _visibility,
                    posting: _posting,
                  ));
                  if (mounted) Navigator.of(this.context).pop();
                } catch (error) {
                  widget.onFailed(error);
                }
              },
        child: Text(state.updating ? '…' : groupTr('common_saxla', 'Saxla')),
      ),
    ]);
  }
}

/// [chatGroupScreenProvider] value.
Widget buildGroupChatScreen(BuildContext context, String groupId, VoidCallback onBack) =>
    GroupChatScreen(key: ValueKey('group-chat:$groupId'), groupId: groupId, onBack: onBack);
