// Ported from: src/components/moderation/BlockUserDialog.tsx
//
// Admin "block this user" from a community post: a community-only or full-app restriction through
// `moderator_user_action_v1` (scope, duration; the reason is shown to the user on the block screen).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../moderation/moderation_queries.dart';
import '../../moderation/moderator.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, ShadSelect, showShadDialog, shadTitle, shadDescription, toasts, Tw;
import '../data/community_env.dart';
import '../ui/community_widgets.dart';
import '../ui/text_area.dart';

Future<void> showBlockUserDialog(BuildContext context, {required String userId, String? userName, VoidCallback? onDone}) => showShadDialog<void>(
      context,
      builder: (ctx) => BlockUserDialog(userId: userId, userName: userName, onClose: () => Navigator.of(ctx).pop(), onDone: onDone),
    );

class BlockUserDialog extends ConsumerStatefulWidget {
  const BlockUserDialog({super.key, required this.userId, this.userName, required this.onClose, this.onDone});
  final String? userId;
  final String? userName;
  final VoidCallback onClose;
  final VoidCallback? onDone;

  @override
  ConsumerState<BlockUserDialog> createState() => _BlockUserDialogState();
}

class _BlockUserDialogState extends ConsumerState<BlockUserDialog> {
  String _blockType = 'community';
  late String _duration = ref.read(isAdminProvider) ? 'permanent' : '7d';
  final TextEditingController _reason = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  int _days() => _duration == '1d' ? 1 : _duration == '7d' ? 7 : 30;

  Future<void> _block() async {
    final userId = widget.userId;
    if (userId == null) return;
    final t = toasts(context);
    if (_reason.text.trim().isEmpty) {
      t.show(
        title: tr('blockdialog_xeta', 'Xəta'),
        description: tr('blockdialog_reason_required', 'Səbəb yazılmalıdır — istifadəçi bunu blok ekranında görəcək'),
        destructive: true,
      );
      return;
    }
    setState(() => _saving = true);
    try {
      if (ref.read(authUserProvider) == null) throw StateError('Not authenticated');
      final result = await ref.read(moderatorMutationProvider)('moderator_user_action_v1', {
        'p_user': userId,
        'p_action': 'restrict',
        'p_reason': 'other',
        'p_detail': _reason.text.trim(),
        'p_options': {'scope': _blockType, 'seconds': _duration == 'permanent' ? null : _days() * 86400},
        'p_request': ref.read(communityUuidProvider)(),
      });
      if (result.error != null) throw result.error!;
      t.show(title: tr('blockdialog_ugurlu', 'Uğurlu'), description: tr('blockdialog_user_blocked', 'İstifadəçi bloklandı'));
      widget.onClose();
      widget.onDone?.call();
    } catch (e) {
      t.show(title: tr('blockdialog_xeta', 'Xəta'), description: moderatorError(e), destructive: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ref.watch(isAdminProvider);
    final labelStyle = Tw.sm.copyWith(fontWeight: FontWeight.w500, color: context.tokens.shadcn.foreground);
    Widget typeButton(String type, String label, ShadButtonVariant on) => Expanded(
          child: ShadButton(
            variant: _blockType == type ? on : ShadButtonVariant.outline,
            expand: true,
            onPressed: () => setState(() => _blockType = type),
            child: Text(label, textAlign: TextAlign.center),
          ),
        );
    return ShadDialogFrame(radius: 16, maxWidth: 448, inset: 16, children: [
      Row(children: [
        const AIcon(AIcons.ban, size: 20, color: Color(0xFFEF4444)), // text-red-500
        const SizedBox(width: 8),
        Expanded(child: Text(tr('blockdialog_title', 'İstifadəçini Blokla'), style: shadTitle(context))),
      ]),
      if (widget.userName != null && widget.userName!.isNotEmpty) Text(widget.userName!, style: shadDescription(context)),
      VGap(gap: 8, children: [
        Text(tr('blockdialog_type', 'Blok Növü'), style: labelStyle),
        Row(children: [
          typeButton('community', tr('blockdialog_type_community', 'Yalnız Community'), ShadButtonVariant.primary),
          const SizedBox(width: 8),
          typeButton('full', tr('blockdialog_type_full', 'Tam Blok (tətbiq)'), ShadButtonVariant.destructive),
        ]),
        Text(
          _blockType == 'community'
              ? tr('blockdialog_type_community_hint', 'Post, şərh, story və mesaj yaza bilməyəcək — tətbiqin qalan hissəsi işləyəcək')
              : tr('blockdialog_type_full_hint', 'Tətbiqə girəndə tam blok ekranı görəcək, heç nə edə bilməyəcək'),
          style: px(11, color: context.tokens.shadcn.mutedForeground),
        ),
      ]),
      VGap(gap: 8, children: [
        Text(tr('blockdialog_duration', 'Müddət'), style: labelStyle),
        ShadSelect<String>(
          value: _duration,
          height: 40,
          radius: 6,
          options: [
            ('1d', Text(tr('blockdialog_duration_1d', '1 gün'))),
            ('7d', Text(tr('blockdialog_duration_7d', '7 gün'))),
            ('30d', Text(tr('blockdialog_duration_30d', '30 gün'))),
            if (isAdmin) ('permanent', Text(tr('blockdialog_duration_permanent', 'Daimi'))),
          ],
          onChanged: (v) => setState(() => _duration = v),
        ),
      ]),
      VGap(gap: 8, children: [
        Text(tr('blockdialog_reason', 'Səbəb'), style: labelStyle),
        CommunityTextArea(
          controller: _reason,
          minLines: 3,
          maxLines: 6,
          placeholder: tr('blockdialog_reason_placeholder', 'Bloklama səbəbini yazın (istifadəçi bunu görəcək)...'),
        ),
      ]),
      Row(children: [
        Expanded(
          child: ShadButton(variant: ShadButtonVariant.outline, expand: true, onPressed: widget.onClose, child: Text(tr('blockdialog_cancel', 'Ləğv et'))),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ShadButton(
            variant: ShadButtonVariant.destructive,
            expand: true,
            onPressed: _saving ? null : _block,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              _saving ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.ban, size: 16, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 8),
              Text(tr('blockdialog_confirm', 'Blokla')),
            ]),
          ),
        ),
      ]),
    ]);
  }
}
