// Ported from: src/components/community/GroupPostTags.tsx (GroupTagPicker, GroupPostTags)
//
// A post may tag up to three chat groups its author owns; the cards link to the group (the push-navigation path of
// a `group_message`).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../design/design.dart';
import '../../../shell/nav/shell_controller.dart';
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../chat/data/chat_groups.dart' show chatGroupsProvider, kUnreadGroups;
import '../../settings/ui/settings_ui.dart' show ShadDialogFrame, showShadDialog, shadTitle, Tw;
import '../data/community_backend.dart';
import '../data/community_env.dart';
import 'community_widgets.dart';

/// `GroupPostTags` query: `['chat-group-cards-v3', backend, user, ids, language]`.
final groupCardsQuery = queryProviderFamily<List<CRow>, String>((ref, idsKey) {
  final user = ref.watch(authUserProvider)?.id;
  final language = ref.watch(communityLanguageProvider);
  final backend = ref.watch(communityBackendProvider);
  final ids = idsKey.isEmpty ? const <String>[] : idsKey.split(',');
  return QueryOptions<List<CRow>>(
    queryKey: ['chat-group-cards-v3', ref.watch(communityBackendUrlProvider), user, ids, language],
    enabled: user != null && ids.isNotEmpty,
    staleTime: const Duration(seconds: 30),
    queryFn: (_) async {
      final data = await backend.rpc('chat_group_cards_v4', {'p_groups': ids, 'p_language': language});
      return [for (final g in data is List ? data : const []) if (g is Map && g['discovery_language'] == language) Map<String, dynamic>.from(g)];
    },
  );
}, name: 'groupCardsQuery');

/// `<GroupPostTags ids />`.
class GroupPostTags extends ConsumerWidget {
  const GroupPostTags({super.key, required this.ids});
  final List<String> ids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(groupCardsQuery(ids.join(','))).data ?? const [];
    if (data.isEmpty) return const SizedBox.shrink();
    final primary = context.tokens.shadcn.primary;
    final muted = context.tokens.shadcn.mutedForeground;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: VGap(gap: 8, children: [
        for (final group in data)
          CommunityButton(
            onTap: () => ref.read(shellProvider.notifier).navigateFromPush({'type': 'group_message', 'groupId': group['id']}),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: primary.withValues(alpha: 0.15)),
              ),
              child: Row(children: [
                AIcon(AIcons.users, size: 24, color: primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${group['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: Tw.sm.copyWith(fontWeight: FontWeight.w700)),
                    Row(children: [
                      AIcon(group['chat_visibility'] == 'public' ? AIcons.globe : AIcons.lockKeyhole, size: 11, color: muted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          '${groupTr(group['chat_visibility'] == 'public' ? 'group_public' : 'group_private')} · ${group['member_count']} ${groupTr('chat_members', 'üzv')}',
                          style: px(11, color: muted, height: 1.4),
                        ),
                      ),
                    ]),
                  ]),
                ),
                Text(groupTr(group['chat_visibility'] == 'public' ? 'chat_join' : 'group_request', 'Qoşul'),
                    style: Tw.xs.copyWith(fontWeight: FontWeight.w700, color: primary)),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// `<GroupTagPicker value onChange disabled />`: the author's own groups, at most three.
class GroupTagPicker extends ConsumerWidget {
  const GroupTagPicker({super.key, required this.value, required this.onChange, this.disabled = false});
  final List<String> value;
  final ValueChanged<List<String>> onChange;
  final bool disabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chatGroupsProvider(kUnreadGroups));
    final groups = [for (final g in state.groups) if (g['is_owner'] == true) g];
    final primary = context.tokens.shadcn.primary;
    return VGap(gap: 8, children: [
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: ATagChip(
          enabled: !disabled,
          onTap: () => _open(context, ref),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const AIcon(AIcons.users, size: 14),
            const SizedBox(width: 6),
            Text('${groupTr('group_tag')}${value.isNotEmpty ? ' (${value.length})' : ''}'),
          ]),
        ),
      ),
      if (value.isNotEmpty)
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final g in groups.where((g) => value.contains(g['id'])))
            CommunityButton(
              onTap: () => onChange([for (final id in value) if (id != g['id']) id]),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(color: primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('${g['name']}', style: Tw.xs.copyWith(color: primary)),
                  const SizedBox(width: 4),
                  AIcon(AIcons.x, size: 12, color: primary),
                ]),
              ),
            ),
        ]),
    ]);
  }

  Future<void> _open(BuildContext context, WidgetRef ref) => showShadDialog<void>(
        context,
        builder: (ctx) => _GroupTagDialog(initial: value, onChange: onChange),
      );
}

class _GroupTagDialog extends ConsumerStatefulWidget {
  const _GroupTagDialog({required this.initial, required this.onChange});
  final List<String> initial;
  final ValueChanged<List<String>> onChange;
  @override
  ConsumerState<_GroupTagDialog> createState() => _GroupTagDialogState();
}

class _GroupTagDialogState extends ConsumerState<_GroupTagDialog> {
  late List<String> _value = [...widget.initial];

  void _set(List<String> next) {
    setState(() => _value = next);
    widget.onChange(next);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatGroupsProvider(kUnreadGroups));
    final groups = [for (final g in state.groups) if (g['is_owner'] == true) g];
    final muted = context.tokens.shadcn.mutedForeground;
    return ShadDialogFrame(maxWidth: 448, inset: 16, children: [
      Text(groupTr('group_tag'), style: shadTitle(context)),
      Text(groupTr('group_tag_note'), style: Tw.xs.copyWith(color: muted)),
      if (state.loading)
        const ALoader(size: 20)
      else if (state.error != null)
        CommunityButton(onTap: () => state.refetch(), child: Text(groupTr('chat_retry', 'Yenidən cəhd et')))
      else if (groups.isEmpty)
        Text(groupTr('chat_no_groups', 'Hələ qrup yoxdur.'), style: Tw.sm.copyWith(color: muted))
      else
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 288),
          child: SingleChildScrollView(
            child: VGap(gap: 8, children: [
              for (final g in groups)
                () {
                  final id = '${g['id']}';
                  final checked = _value.contains(id);
                  final enabled = checked || _value.length < 3;
                  return CommunityButton(
                    enabled: enabled,
                    selected: checked,
                    label: '${g['name']}',
                    onTap: () => _set(checked ? [for (final v in _value) if (v != id) v] : [..._value, id]),
                    child: Opacity(
                      opacity: enabled ? 1 : 0.5,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: context.tokens.shadcn.muted.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(12)),
                        child: Row(children: [
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: checked ? context.tokens.shadcn.primary : null,
                              borderRadius: BorderRadius.circular(3),
                              border: Border.all(color: checked ? context.tokens.shadcn.primary : muted),
                            ),
                            child: checked ? AIcon(AIcons.check, size: 12, color: context.tokens.shadcn.primaryForeground) : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text('${g['name']}', style: Tw.sm.copyWith(fontWeight: FontWeight.w600))),
                          Text(groupTr(g['chat_visibility'] == 'public' ? 'group_public' : 'group_private'), style: px(11, color: muted)),
                        ]),
                      ),
                    ),
                  );
                }(),
            ]),
          ),
        ),
      AButton(
        variant: AButtonVariant.pillSolid,
        onPressed: () => Navigator.of(context).pop(),
        child: Text(groupTr('common_saxla', 'Saxla')),
      ),
    ]);
  }
}
