// Ported from: src/components/moderation/{ModeratorActionMenu,ModeratorActionDialog,ModeratorMedia,RestrictionNote}.tsx
//
// The inline moderator tools on community posts / comments (owner decision: they stay in the app). Only moderators
// and admins see the shield; every action goes through `moderator_content_action_v1` / `moderator_user_action_v1`
// with a request id reused while the arguments are unchanged.
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/links/js_url.dart';
import '../../moderation/moderation_queries.dart';
import '../../moderation/moderator.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, ShadSelect, showShadDialog, shadTitle, shadDescription, toasts, Tw;
import '../copy/community_copy.dart';
import '../data/community_env.dart';
import '../ui/community_menu.dart';
import '../ui/community_widgets.dart';
import '../ui/text_area.dart';
import 'moderator_content.dart';

/// `<RestrictionNote scope />`: the signed-in user's restriction for a scope (amber notice).
class RestrictionNote extends ConsumerWidget {
  const RestrictionNote({super.key, required this.scope});
  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(myModerationStatusQuery).data;
    if (data == null || data[scope] != true) return const SizedBox.shrink();
    final key = scope == 'full' ? 'full_restricted' : scope == 'community' ? 'community_restricted' : '${scope}_restricted';
    // amber-200 border / amber-50 background (Tailwind literals of RestrictionNote.tsx)
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: context.tokens.isDark ? const Color(0x4D451A03) : const Color(0xFFFFFBEB),
          border: Border.all(color: const Color(0xFFFDE68A)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(padding: EdgeInsets.only(top: 2), child: AIcon(AIcons.shieldAlert, size: 18)),
          const SizedBox(width: 8),
          Expanded(child: Text(moderatorText(key), style: px(14, height: 1.625))),
        ]),
      ),
    );
  }
}

/// `safeUrl(value)` of ModeratorMedia: https community-media objects of this backend (or the Source project).
String? moderatorSafeMediaUrl(String value, String backendUrl) {
  final url = JsUrl.parse(value);
  if (url == null || url.protocol != 'https:' || url.username.isNotEmpty || url.password.isNotEmpty) return null;
  final backendOrigin = JsUrl.parse(backendUrl)?.origin;
  if (url.origin != backendOrigin && url.origin != 'https://tntbjulojatnrqmylorp.supabase.co') return null;
  return RegExp(r'^/storage/v1/object/(public|sign)/community-media/').hasMatch(url.pathname) ? url.href : null;
}

/// `<ModeratorMedia content />`.
class ModeratorMedia extends ConsumerWidget {
  const ModeratorMedia({super.key, required this.content});
  final Map<String, dynamic> content;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mediaUrls = content['media_urls'];
    final urls = mediaUrls is List && mediaUrls.isNotEmpty
        ? [for (final u in mediaUrls) '$u']
        : content['media_url'] is String && (content['media_url'] as String).isNotEmpty
            ? [content['media_url'] as String]
            : content['image_url'] is String && (content['image_url'] as String).isNotEmpty
                ? [content['image_url'] as String]
                : const <String>[];
    if (urls.isEmpty) return const SizedBox.shrink();
    final backendUrl = ref.watch(communityBackendUrlProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: VGap(gap: 12, children: [
        for (var i = 0; i < urls.length; i++)
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: context.tokens.shadcn.border),
              borderRadius: BorderRadius.circular(12),
              color: context.tokens.shadcn.muted.withValues(alpha: 0.3),
            ),
            clipBehavior: Clip.antiAlias,
            child: () {
              final url = moderatorSafeMediaUrl(urls[i], backendUrl);
              if (url == null) return Padding(padding: const EdgeInsets.all(12), child: Text(moderationText('media_unavailable'), style: Tw.sm));
              if (RegExp(r'\.(mp4|mov|webm)(?:\?|$)', caseSensitive: false).hasMatch(url)) {
                return SizedBox(height: 120, child: Center(child: Text('${moderationText('media')} ${i + 1}', style: Tw.sm)));
              }
              return ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 288),
                child: Image.network(url, fit: BoxFit.contain, semanticLabel: '${moderationText('media')} ${i + 1}', errorBuilder: (_, _, _) => const SizedBox()),
              );
            }(),
          ),
      ]),
    );
  }
}

/// `<ModeratorActionMenu target onDone />`: the shield (moderators / admins only) opening the action list.
class ModeratorActionMenu extends ConsumerWidget {
  const ModeratorActionMenu({super.key, required this.target, this.onDone, this.iconSize = 17, this.minSize = 44});
  final ModeratorTarget target;
  final VoidCallback? onDone;
  final double iconSize;
  final double minSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(isModeratorProvider) && !ref.watch(isAdminProvider)) return const SizedBox.shrink();
    final language = currentLanguage();
    final actions = moderatorContentActions(target);
    return Builder(
      builder: (anchor) => CommunityButton(
        label: moderatorText('moderate', language),
        onTap: () => showCommunityMenu(anchor, [
          for (final action in actions)
            CommunityMenuItem(label: moderatorText(action, language), minHeight: 44, onSelect: () => showModeratorActionDialog(anchor, target: target, action: action, onDone: onDone)),
          for (final (i, action) in const ['warn', 'restrict'].indexed)
            CommunityMenuItem(
              label: moderatorText(action, language),
              minHeight: 44,
              separatorBefore: i == 0 && actions.isNotEmpty,
              onSelect: () => showModeratorActionDialog(anchor, target: target, action: action, onDone: onDone),
            ),
        ]),
        child: SizedBox(
          width: minSize,
          height: minSize,
          child: Center(child: AIcon(AIcons.shieldCheck, size: iconSize, color: context.tokens.shadcn.primary)),
        ),
      ),
    );
  }
}

/// Opens [ModeratorActionDialog] (z-340 over the comment sheet).
Future<void> showModeratorActionDialog(BuildContext context, {required ModeratorTarget target, required String action, VoidCallback? onDone}) =>
    showShadDialog<void>(
      context,
      builder: (ctx) => ModeratorActionDialog(target: target, action: action, onClose: () => Navigator.of(ctx).pop(), onDone: onDone),
    );

const List<(String, String)> _durations = [('900', '15m'), ('3600', '1h'), ('86400', '1d'), ('604800', '7d'), ('2592000', '30d')];

/// `<ModeratorActionDialog target action onClose onDone />` (the dialog body).
class ModeratorActionDialog extends ConsumerStatefulWidget {
  const ModeratorActionDialog({super.key, required this.target, required this.action, required this.onClose, this.onDone});
  final ModeratorTarget target;
  final String action;
  final VoidCallback onClose;
  final VoidCallback? onDone;

  @override
  ConsumerState<ModeratorActionDialog> createState() => _ModeratorActionDialogState();
}

class _ModeratorActionDialogState extends ConsumerState<ModeratorActionDialog> {
  String _reason = 'other';
  String _scope = 'community';
  String _seconds = '86400';
  late final TextEditingController _note = TextEditingController();
  late final TextEditingController _publicDetail = TextEditingController();
  late final TextEditingController _text = TextEditingController(text: widget.target.content ?? '');
  ({String key, String id})? _request;
  String _loaded = '';
  bool _pending = false;
  Object? _error;

  bool get _contentAction => !const ['warn', 'restrict', 'unrestrict'].contains(widget.action);

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _note.dispose();
    _publicDetail.dispose();
    _text.dispose();
    super.dispose();
  }

  (String?, String?) get _contentArgs => (widget.target.kind != 'user' ? widget.target.kind : null, widget.target.id);

  Future<void> _submit(Map<String, dynamic>? detail) async {
    final t = widget.target;
    final Map<String, dynamic> args = _contentAction
        ? {
            'p_kind': t.kind,
            'p_id': t.id,
            'p_version': detail?['version'] ?? t.version ?? 0,
            'p_action': widget.action,
            'p_reason': _reason,
            'p_content': widget.action == 'edit' ? _text.text.trim() : null,
            'p_note': _note.text.trim(),
          }
        : {
            'p_user': t.userId,
            'p_action': widget.action,
            'p_reason': _reason,
            'p_detail': _publicDetail.text.trim(),
            'p_options': widget.action == 'restrict'
                ? {'scope': _scope, 'seconds': _seconds == 'permanent' ? null : int.parse(_seconds), 'note': _note.text.trim()}
                : widget.action == 'unrestrict'
                    ? {'restriction_id': t.restrictionId, 'legacy': t.legacy == true, 'note': _note.text.trim()}
                    : {'note': _note.text.trim()},
          };
    final key = jsonEncode(args);
    if (_request?.key != key) _request = (key: key, id: ref.read(communityUuidProvider)());
    setState(() {
      _pending = true;
      _error = null;
    });
    final run = ref.read(moderatorMutationProvider);
    final result = await run(_contentAction ? 'moderator_content_action_v1' : 'moderator_user_action_v1', {...args, 'p_request': _request!.id});
    if (!mounted) return;
    final language = currentLanguage();
    setState(() {
      _pending = false;
      _error = result.error;
    });
    if (result.error != null) {
      try {
        toasts(context).show(title: moderatorError(result.error, language), destructive: true);
      } catch (_) {}
      return;
    }
    try {
      toasts(context).show(title: moderatorText('saved', language));
    } catch (_) {}
    widget.onDone?.call();
    widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final language = currentLanguage();
    String t(String key) => moderatorText(key, language);
    final access = ref.watch(moderatorAccessQuery).data;
    final detailQuery = ref.watch(moderatorContentQuery(_contentAction ? _contentArgs : (null, null)));
    final detail = detailQuery.data;
    if (detail != null && _loaded != '${detail['id']}') {
      _loaded = '${detail['id']}';
      final next = '${detail['content'] ?? detail['text_overlay'] ?? ''}';
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _text.text = next;
      });
    }
    final busy = _pending || (_contentAction && detailQuery.isPending);
    final action = widget.action;
    final destructive = action == 'remove' || action == 'restrict';
    final labelStyle = Tw.sm.copyWith(fontWeight: FontWeight.w500, color: context.tokens.shadcn.foreground);
    final hintStyle = Tw.xs.copyWith(color: context.tokens.shadcn.mutedForeground);
    final children = <Widget>[
      Row(children: [
        AIcon(AIcons.shieldCheck, size: 20, color: context.tokens.shadcn.foreground),
        const SizedBox(width: 8),
        Expanded(child: Text(t(action), style: shadTitle(context))),
        CommunityButton(label: t('close'), onTap: _pending ? null : widget.onClose, child: AIcon(AIcons.x, size: 16, color: context.tokens.shadcn.mutedForeground)),
      ]),
      Text(widget.target.name?.isNotEmpty == true ? widget.target.name! : t('user'), style: shadDescription(context)),
    ];
    if (_contentAction && detailQuery.isError) {
      children.add(Semantics(
        liveRegion: true,
        child: VGap(gap: 12, children: [
          Text(moderatorError(detailQuery.error, language), style: Tw.sm),
          ShadButton(onPressed: () => ref.read(moderatorContentQuery(_contentArgs).notifier).refetch(), child: Text(t('refresh'))),
        ]),
      ));
    } else {
      children.add(VGap(gap: 16, children: [
        if (_contentAction && detail != null) ModeratorMedia(content: detail),
        if (action == 'edit')
          VGap(gap: 8, children: [
            Text(t('updated'), style: labelStyle),
            CommunityTextArea(controller: _text, maxLength: widget.target.kind == 'comment' ? 8000 : 20000, minLines: 7, maxLines: 12, semanticLabel: t('updated')),
            if (widget.target.kind == 'post') Text(t('edit_recheck'), style: hintStyle),
          ]),
        if (action == 'restore') Text(t('restore_recheck'), style: Tw.sm.copyWith(color: context.tokens.shadcn.mutedForeground)),
        if (action == 'warn') Text(t('warning_hint'), style: Tw.sm.copyWith(color: context.tokens.shadcn.mutedForeground, height: 1.625)),
        if (action == 'restrict') ...[
          VGap(gap: 4, children: [
            Text(t('scope'), style: Tw.sm),
            ShadSelect<String>(
              value: _scope,
              options: [for (final v in moderatorScopes) (v, Text(t('scope_$v')))],
              onChanged: (v) => setState(() => _scope = v),
            ),
          ]),
          VGap(gap: 4, children: [
            Text(t('duration'), style: Tw.sm),
            ShadSelect<String>(
              key: const ValueKey('moderator-duration'),
              value: _seconds,
              options: [
                for (final (value, label) in [..._durations, if (access?['role'] == 'admin') ('permanent', 'permanent')]) (value, Text(t('duration_$label'))),
              ],
              onChanged: (v) => setState(() => _seconds = v),
            ),
          ]),
        ],
        VGap(gap: 4, children: [
          Text(t('reason'), style: labelStyle),
          ShadSelect<String>(
            value: _reason,
            options: [for (final v in moderatorReasons) (v, Text(moderatorReason(v, language)))],
            onChanged: (v) => setState(() => _reason = v),
          ),
        ]),
        if (action == 'warn' || action == 'restrict')
          VGap(gap: 4, children: [
            Text(t('public_detail'), style: labelStyle),
            CommunityTextArea(controller: _publicDetail, maxLength: 1000, minLines: 3, maxLines: 6, semanticLabel: t('public_detail')),
            Text(t('public_detail_hint'), style: hintStyle),
          ]),
        VGap(gap: 4, children: [
          Text(t('note'), style: labelStyle),
          CommunityTextArea(controller: _note, maxLength: 2000, minLines: 3, maxLines: 6, semanticLabel: t('note')),
          Text(t('note_hint'), style: hintStyle),
        ]),
        if (_error != null)
          Semantics(liveRegion: true, child: Text(moderatorError(_error, language), style: Tw.sm.copyWith(color: context.tokens.shadcn.destructive))),
        Wrap(alignment: WrapAlignment.end, spacing: 8, runSpacing: 8, children: [
          ShadButton(variant: ShadButtonVariant.outline, onPressed: _pending ? null : widget.onClose, child: Text(t('cancel'))),
          ShadButton(
            key: const ValueKey('moderator-submit'),
            height: 44,
            variant: destructive ? ShadButtonVariant.destructive : ShadButtonVariant.primary,
            onPressed: busy || access?['allowed'] != true || (action == 'edit' && _text.text.trim().isEmpty) ? null : () => _submit(detail),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (busy) ...[const ALoader(size: 16), const SizedBox(width: 8)],
              Flexible(child: Text(t(action))),
            ]),
          ),
        ]),
      ]));
    }
    return Directionality(
      textDirection: textDirectionFor(language),
      child: ShadDialogFrame(maxWidth: 576, inset: 12, radius: 8, children: children),
    );
  }
}
