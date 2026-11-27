// Ported from: src/components/community/CommentReply.tsx, src/styles/anacan-design.css (.ig-cmt*, .ig-actions*)
//
// Instagram-style flat thread: a root comment collects every descendant (any depth), sorted pinned first then by
// time, under one indent; replies to a reply show "@Name". Replies start folded ("N cavab göstər") unless the
// deep-linked comment is among them. Own / admin edit and delete sit behind a long press (480 ms) or the "…".
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show MaterialLocalizations;

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../chat/data/stickers.dart' show stickerFromImageUrl;
import '../../chat/ui/sticker_picker.dart' show StickerImage;
import '../../moderation/moderator.dart' show moderatorText;
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, showShadDialog, Tw;
import '../copy/community_copy.dart';
import '../data/community.dart';
import '../data/community_backend.dart' show CRow;
import '../data/community_env.dart';
import '../moderation/moderator_content.dart';
import '../moderation/moderator_widgets.dart';
import 'comment_text.dart';
import 'community_widgets.dart';
import 'photo_gallery_viewer.dart';
import 'text_area.dart';
import 'user_badge.dart';

/// `window.confirm(message)` (OK / Cancel in the platform language).
Future<bool> communityConfirm(BuildContext context, String message) async {
  final l = MaterialLocalizations.of(context);
  final result = await showShadDialog<bool>(
    context,
    builder: (ctx) => ShadDialogFrame(radius: 12, maxWidth: 400, inset: 24, children: [
      Text(message, style: Tw.sm),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        ShadButton(variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(ctx).pop(false), child: Text(l.cancelButtonLabel)),
        const SizedBox(width: 8),
        ShadButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(l.okButtonLabel)),
      ]),
    ]),
  );
  return result == true;
}

class IgAction {
  const IgAction({required this.label, required this.onTap, this.icon, this.danger = false});
  final String label;
  final VoidCallback onTap;
  final AIconData? icon;
  final bool danger;
}

/// `.ig-actions` bottom sheet (backdrop rgba(0,0,0,.4), z-340) with a trailing cancel row.
Future<void> showIgActions(BuildContext context, List<IgAction> actions, {required String cancelLabel}) =>
    Navigator.of(context, rootNavigator: true).push(PageRouteBuilder<void>(
      opaque: false,
      barrierDismissible: true,
      barrierColor: const Color(0x66000000),
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (ctx, _, _) => _IgActionsSheet(actions: actions, cancelLabel: cancelLabel),
      transitionsBuilder: (ctx, animation, _, child) =>
          SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(animation), child: child),
    ));

class _IgActionsSheet extends StatelessWidget {
  const _IgActionsSheet({required this.actions, required this.cancelLabel});
  final List<IgAction> actions;
  final String cancelLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget row(String label, VoidCallback onTap, {AIconData? icon, Color? color, bool center = false, bool border = false}) => Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: Container(
              width: double.infinity,
              margin: EdgeInsets.only(top: border ? 4 : 0),
              decoration: border ? BoxDecoration(border: Border(top: BorderSide(color: a.line))) : null,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: Row(mainAxisAlignment: center ? MainAxisAlignment.center : MainAxisAlignment.start, children: [
                if (icon != null) ...[AIcon(icon, size: 18, color: color ?? a.ink), const SizedBox(width: 14)],
                Text(label, style: px(15, weight: FontWeight.w500, color: color ?? a.ink, height: 1.3)),
              ]),
            ),
          ),
        );
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.only(top: 8, bottom: 10 + MediaQuery.paddingOf(context).bottom),
          decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(16))),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final action in actions)
              row(action.label, () {
                Navigator.of(context).pop();
                action.onTap();
              }, icon: action.icon, color: action.danger ? const Color(0xFFED4956) : null), // .ig-actions .danger literal
            row(cancelLabel, () => Navigator.of(context).pop(), color: a.inkSoft, center: true, border: true),
          ]),
        ),
      ),
    );
  }
}

/// The flattened descendants of [rootId] (any depth), pinned first, then oldest first.
List<CRow> flattenReplies(String rootId, List<CRow> allComments) {
  final children = <String, List<CRow>>{};
  for (final item in allComments) {
    final parent = item['parent_comment_id'];
    if (parent is String && parent.isNotEmpty) (children[parent] ??= []).add(item);
  }
  final descendants = <CRow>[];
  final pending = [rootId];
  final visited = {rootId};
  while (pending.isNotEmpty) {
    for (final child in children[pending.removeLast()] ?? const <CRow>[]) {
      final id = '${child['id']}';
      if (visited.contains(id)) continue;
      visited.add(id);
      descendants.add(child);
      pending.add(id);
    }
  }
  int ms(CRow c) => DateTime.tryParse('${c['created_at']}')?.millisecondsSinceEpoch ?? 0;
  descendants.sort((a, b) {
    final pin = (b['is_pinned'] == true ? 1 : 0) - (a['is_pinned'] == true ? 1 : 0);
    return pin != 0 ? pin : ms(a) - ms(b);
  });
  return descendants;
}

class CommentReply extends ConsumerStatefulWidget {
  const CommentReply({
    super.key,
    required this.comment,
    required this.postId,
    required this.allComments,
    required this.onReply,
    required this.onRefetch,
    this.onUserClick,
    this.isReply = false,
    this.rootId,
    this.highlightCommentId,
  });
  final CRow comment;
  final String postId;
  final List<CRow> allComments;
  final void Function(CRow comment) onReply;
  final VoidCallback onRefetch;
  final void Function(String userId)? onUserClick;
  final bool isReply;
  final String? rootId;
  final String? highlightCommentId;

  @override
  ConsumerState<CommentReply> createState() => _CommentReplyState();
}

class _CommentReplyState extends ConsumerState<CommentReply> {
  final GlobalKey _rowKey = GlobalKey();
  late bool _showReplies = widget.highlightCommentId != null &&
      widget.highlightCommentId!.isNotEmpty &&
      widget.allComments.any((c) => c['id'] == widget.highlightCommentId && (c['parent_comment_id'] ?? '') != '');
  bool _editing = false;
  late final TextEditingController _edit = TextEditingController(text: '${widget.comment['content'] ?? ''}');
  Object? _editImageUrl;
  Timer? _scroll;

  CRow get c => widget.comment;
  String get _id => '${c['id']}';
  bool get _highlighted => (widget.highlightCommentId ?? '').isNotEmpty && _id == widget.highlightCommentId;

  @override
  void initState() {
    super.initState();
    _editImageUrl = c['image_url'];
    _edit.addListener(() => setState(() {}));
    if (_highlighted) {
      _scroll = Timer(const Duration(milliseconds: 250), () {
        final ctx = _rowKey.currentContext;
        if (ctx != null && ctx.mounted) {
          unawaited(Scrollable.ensureVisible(ctx, alignment: 0.5, duration: const Duration(milliseconds: 300)));
        }
      });
    }
  }

  @override
  void dispose() {
    _scroll?.cancel();
    _edit.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _author => c['author'] is Map ? Map<String, dynamic>.from(c['author'] as Map) : const {};

  void _like() {
    final user = ref.read(authUserProvider);
    final pending = ref.read(toggleCommentLikeMutation).isPending;
    if (user == null || pending) return;
    ref.read(communityHapticsProvider).light();
    ref.read(toggleCommentLikeMutation.notifier).mutate((commentId: _id, isLiked: c['is_liked'] == true, postId: widget.postId));
  }

  Future<void> _delete(bool isAdmin, bool own) async {
    if (isAdmin && !own) {
      await showModeratorActionDialog(context,
          target: ModeratorTarget(kind: 'comment', id: _id, userId: '${c['user_id']}', name: _author['name'] as String?, content: '${c['content'] ?? ''}'),
          action: 'remove',
          onDone: widget.onRefetch);
      return;
    }
    if (!mounted) return;
    if (!await communityConfirm(context, tr('commentreply_bu_serhi_silmek_isteyirsiniz_fc50c9', 'Bu şərhi silmək istəyirsiniz?'))) return;
    ref.read(deleteCommentMutation.notifier).mutate((commentId: _id, postId: widget.postId), onSuccess: (_, _, _) => widget.onRefetch());
  }

  void _saveEdit() {
    final content = _edit.text.trim();
    if (content.isEmpty) return;
    ref.read(communityHapticsProvider).light();
    ref.read(editCommentMutation.notifier).mutate(
          EditCommentVars(commentId: _id, content: content, postId: widget.postId, imageUrl: _editImageUrl),
          onSuccess: (_, _, _) {
            if (mounted) setState(() => _editing = false);
          },
        );
  }

  void _avatarTap(bool isAdmin) {
    final userId = '${c['user_id'] ?? ''}';
    if (userId.isNotEmpty && widget.onUserClick != null && (c['is_anonymous'] != true || isAdmin)) widget.onUserClick!(userId);
  }

  void _openActions(bool own, bool isAdmin) {
    final sticker = stickerFromImageUrl(c['image_url'] as String?);
    unawaited(showIgActions(context, [
      if (own && sticker == null)
        IgAction(
          label: tr('postcard_redakte_et_66cf3b', 'Redaktə et'),
          icon: AIcons.pencil,
          onTap: () => setState(() {
            _edit.text = '${c['content'] ?? ''}';
            _editImageUrl = c['image_url'];
            _editing = true;
          }),
        ),
      IgAction(label: tr('untranslated_sil_zwa7lz', 'Sil'), icon: AIcons.trash2, danger: true, onTap: () => unawaited(_delete(isAdmin, own))),
    ], cancelLabel: tr('postcard_legv_et_b5e49c', 'Ləğv et')));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = currentLanguage();
    final isAdmin = ref.watch(isAdminProvider);
    final user = ref.watch(authUserProvider);
    final own = user?.id == c['user_id'];
    final canManage = isAdmin || own;
    final effectiveRoot = widget.rootId ?? _id;
    final replies = widget.isReply ? const <CRow>[] : flattenReplies(_id, widget.allComments);
    String? repliedTo;
    if (widget.isReply && c['parent_comment_id'] != effectiveRoot) {
      final parent = widget.allComments.where((x) => x['id'] == c['parent_comment_id']).firstOrNull;
      final name = parent?['author'] is Map ? (parent!['author'] as Map)['name'] : null;
      repliedTo = name is String && name.isNotEmpty ? name : null;
    }
    final anonymous = c['is_anonymous'] == true;
    final badge = _author['badge_type'] as String?;
    final verified = isVerifiedActive(_author['is_verified'], _author['verified_until']);
    final created = DateTime.tryParse('${c['created_at']}') ?? DateTime.now();
    final timeAgo = formatDistanceToNowStrict(created);
    final name = (_author['name'] as String?)?.isNotEmpty == true ? _author['name'] as String : tr('commentreply_i_stifadeci_b6bdd6', 'İstifadəçi');
    final avatarSize = widget.isReply ? 24.0 : 32.0;
    final sticker = stickerFromImageUrl(c['image_url'] as String?);
    final imageUrl = c['image_url'] as String?;
    final optimistic = _id.startsWith('optimistic-');
    final nameDisabled = anonymous && !isAdmin;
    final likes = (c['likes_count'] as num?)?.toInt() ?? 0;

    final head = Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
      CommunityButton(
        label: name,
        enabled: !nameDisabled,
        onTap: () => _avatarTap(isAdmin),
        tapScale: 0.98,
        child: Text(name, style: px(12.5, weight: FontWeight.w600, color: a.ink, height: 1.35)),
      ),
      if (verified) const VerifiedTick(size: 11),
      if (!anonymous && (badge != null || _author['is_premium'] == true))
        Transform.scale(scale: 0.85, alignment: AlignmentDirectional.centerStart, child: UserBadge(type: badge, premium: _author['is_premium'] as bool?)),
      Text(timeAgo, style: px(12.5, color: a.inkSoft, height: 1.35)),
      if (c['is_pinned'] == true)
        Row(mainAxisSize: MainAxisSize.min, children: [
          AIcon(AIcons.pin, size: 10, color: a.inkSoft),
          const SizedBox(width: 3),
          Text(moderatorText('pinned_comment', language), style: px(12.5, color: a.inkSoft, height: 1.35)),
        ]),
      if (c['moderation_edited_at'] != null) Text('· ${moderatorText('edited_marker', language)}', style: px(12.5, color: a.inkSoft, height: 1.35)),
    ]);

    Widget body;
    if (_editing) {
      final editImage = _editImageUrl as String?;
      body = Padding(
        padding: const EdgeInsets.only(top: 4),
        child: VGap(gap: 6, children: [
          if (editImage != null && editImage.isNotEmpty)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: SizedBox(
                width: 56,
                height: 56,
                child: Stack(clipBehavior: Clip.none, children: [
                  ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(editImage, width: 56, height: 56, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())),
                  PositionedDirectional(
                    top: -5,
                    end: -5,
                    child: CommunityButton(
                      onTap: () => setState(() => _editImageUrl = null),
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(color: a.ink, shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: AIcon(AIcons.x, size: 10, color: a.bg),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          CommunityTextArea(
            controller: _edit,
            autofocus: true,
            minLines: 1,
            maxLines: 6,
            minHeight: 44,
            radius: 12,
            background: a.surfaceSoft,
            borderColor: a.lineStrong,
          ),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            ATagChip(
              onTap: () => setState(() {
                _editing = false;
                _edit.text = '${c['content'] ?? ''}';
                _editImageUrl = c['image_url'];
              }),
              child: Text(tr('postcard_legv_et_b5e49c', 'Ləğv et')),
            ),
            const SizedBox(width: 6),
            AButton(
              variant: AButtonVariant.pillSolid,
              onPressed: _edit.text.trim().isEmpty || ref.watch(editCommentMutation).isPending ? null : _saveEdit,
              child: Text(ref.watch(editCommentMutation).isPending ? '...' : tr('common_saxla', 'Saxla')),
            ),
          ]),
        ]),
      );
    } else {
      final content = '${c['content'] ?? ''}';
      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (content.isNotEmpty || repliedTo != null)
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: CommentText(
              content: content,
              allowLinks: _author['can_share_links'] == true || const ['admin', 'moderator'].contains(badge ?? ''),
              style: px(14, color: a.ink, height: 1.42),
              prefix: [
                if (repliedTo != null) TextSpan(text: '@$repliedTo ', style: TextStyle(color: a.accentInk, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        if (sticker != null)
          Padding(padding: const EdgeInsets.only(top: 4), child: StickerImage(id: sticker, size: 96))
        else if (imageUrl != null && imageUrl.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: CommunityButton(
              onTap: () => unawaited(showPhotoGallery(context, photos: [GalleryPhoto(id: _id, url: imageUrl)])),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 200),
                child: AspectRatio(
                  aspectRatio: 4 / 5,
                  child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(children: [
            CommunityButton(
              label: tr('commentreply_action_reply', 'Cavab'),
              enabled: !optimistic,
              onTap: () => widget.onReply(c),
              child: Opacity(
                opacity: optimistic ? 0.5 : 1,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 24),
                  child: Center(widthFactor: 1, child: Text(tr('commentreply_action_reply', 'Cavab'), style: px(12, weight: FontWeight.w600, color: a.inkSoft, height: 1.3))),
                ),
              ),
            ),
            if (canManage) ...[
              const SizedBox(width: 14),
              CommunityButton(
                label: tr('adminepoint_emeliyyatlar_54d70c', 'Əməliyyatlar'),
                onTap: () => _openActions(own, isAdmin),
                child: SizedBox(height: 24, child: Center(widthFactor: 1, child: AIcon(AIcons.ellipsis, size: 15, color: a.inkFaint))),
              ),
            ],
            const SizedBox(width: 14),
            ModeratorActionMenu(
              iconSize: 14,
              minSize: 24,
              target: ModeratorTarget(
                kind: 'comment',
                id: _id,
                userId: '${c['user_id']}',
                name: _author['name'] as String?,
                content: content,
                version: (c['moderation_version'] as num?)?.toInt() ?? 0,
                isPinned: c['is_pinned'] == true,
                removed: c['moderation_removed_at'] != null,
              ),
              onDone: widget.onRefetch,
            ),
          ]),
        ),
      ]);
    }

    Widget row = Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      CommunityButton(
        enabled: !nameDisabled,
        onTap: () => _avatarTap(isAdmin),
        tapScale: 0.94,
        child: ExcludeSemantics(child: CommunityAvatar(size: avatarSize, url: _author['avatar_url'] as String?, name: _author['name'] as String?, fallback: tr('common_initial_i', 'İ'))),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [head, body])),
      CommunityButton(
        label: tr('commentreply_beyen', 'Bəyən'),
        selected: c['is_liked'] == true,
        onTap: _like,
        tapScale: 0.75,
        child: SizedBox(
          width: 28,
          child: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Column(children: [
              c['is_liked'] == true
                  ? const LucideFilled('heart', size: 14, fill: Color(0xFFFF3040)) // .ig-cmt-like.on literal
                  : AIcon(AIcons.heart, size: 14, color: a.inkSoft),
              if (likes > 0) Text('$likes', style: px(11, weight: FontWeight.w600, color: c['is_liked'] == true ? const Color(0xFFFF3040) : a.inkSoft, height: 1.3)),
            ]),
          ),
        ),
      ),
    ]);
    if (canManage && !_editing) {
      row = RawGestureDetector(
        gestures: {
          LongPressGestureRecognizer: GestureRecognizerFactoryWithHandlers<LongPressGestureRecognizer>(
            () => LongPressGestureRecognizer(duration: const Duration(milliseconds: 480)),
            (r) => r.onLongPress = () {
              ref.read(communityHapticsProvider).light();
              _openActions(own, isAdmin);
            },
          ),
        },
        child: row,
      );
    }

    final children = <Widget>[row];
    if (!widget.isReply && replies.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsetsDirectional.only(start: 44, top: 10),
        child: CommunityButton(
          label: _showReplies ? tr('commentreply_cavablari_gizle', 'Cavabları gizlə') : tr('commentreply_n_cavab_goster', '{n} cavab göstər').replaceAll('{n}', '${replies.length}'),
          onTap: () => setState(() => _showReplies = !_showReplies),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 24, height: 1, color: a.inkFaint),
            const SizedBox(width: 12),
            Text(
              _showReplies ? tr('commentreply_cavablari_gizle', 'Cavabları gizlə') : tr('commentreply_n_cavab_goster', '{n} cavab göstər').replaceAll('{n}', '${replies.length}'),
              style: px(12, weight: FontWeight.w600, color: a.inkSoft, height: 1.3),
            ),
          ]),
        ),
      ));
    }
    if (!widget.isReply && _showReplies && replies.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsetsDirectional.only(start: 44, top: 14),
        child: VGap(gap: 16, children: [
          for (final reply in replies)
            CommentReply(
              key: ValueKey(reply['id']),
              comment: reply,
              postId: widget.postId,
              allComments: widget.allComments,
              onReply: widget.onReply,
              onRefetch: widget.onRefetch,
              onUserClick: widget.onUserClick,
              isReply: true,
              rootId: effectiveRoot,
              highlightCommentId: widget.highlightCommentId,
            ),
        ]),
      ));
    }
    Widget result = Column(key: _rowKey, crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
    if (_highlighted) {
      result = Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
        child: result,
      );
    }
    return Semantics(identifier: 'comment-$_id', container: true, child: result);
  }
}
