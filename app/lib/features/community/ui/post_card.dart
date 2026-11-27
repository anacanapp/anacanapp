// Ported from: src/components/community/PostCard.tsx, src/lib/lifeStageLabel.ts (getLifeStageMeta),
//              src/styles/anacan-design.css (.a-post*, .ig-sheet*, .ig-emoji-row, .ig-reply-target, .ig-attach,
//              .ig-composer*, .ig-send, .ig-anon-note)
//
// One community post: author row (anonymity, badges, life stage, time), the post menu (edit / report / pin / block /
// delete), the moderator shield, text with #tags / @mentions / links and the translation toggle, media, tagged groups,
// the shared blog card, like / comments / share / save. Comments open as an Instagram-style bottom sheet over the
// whole app (an OverlayPortal, like the `createPortal` to body) with one shared composer at its foot.
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/widgets/android_back_scope.dart' show OverlayBackHandler;
import '../../chat/data/stickers.dart' show stickerStoragePath;
import '../../chat/copy/chat_copy.dart' show stickerText;
import '../../chat/ui/sticker_picker.dart' show StickerPicker;
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../moderation/moderator.dart' show moderatorText;
import '../../profile/profile_interfaces.dart' show shareServiceProvider;
import '../../settings/copy/feature_copy.dart' show lifeStageName;
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, showShadDialog, shadTitle, shadDescription, toasts, Tw;
import '../copy/community_copy.dart';
import '../data/community.dart';
import '../data/community_backend.dart';
import '../data/community_env.dart';
import '../data/community_media.dart';
import '../data/community_social.dart';
import '../moderation/block_user_dialog.dart';
import '../moderation/moderator_content.dart';
import '../moderation/moderator_widgets.dart';
import 'comment_reply.dart';
import 'comment_text.dart';
import 'community_blog_card.dart';
import 'community_menu.dart';
import 'community_widgets.dart';
import 'group_post_tags.dart';
import 'media_carousel.dart';
import 'photo_gallery_viewer.dart';
import 'text_area.dart';
import 'user_badge.dart';

/// `LifeStageMeta { label, bg, ink }`.
({String label, Color bg, Color ink})? lifeStageMeta(BuildContext context, String? stage) {
  final a = context.a;
  return switch (stage) {
    'flow' => (label: lifeStageName('flow'), bg: a.pink1, ink: a.pinkInk),
    'bump' => (label: lifeStageName('bump'), bg: a.peach1, ink: a.accentInk),
    'mommy' => (label: lifeStageName('mommy'), bg: a.lav1, ink: a.lavInk),
    'partner' => (label: 'Partner', bg: a.blue1, ink: a.blueInk),
    _ => null,
  };
}

/// `avatarGradFor(seed)`: a stable gradient per user (JS 32-bit string hash).
int avatarGradIndex(String seed) {
  var h = 0;
  for (final unit in seed.codeUnits) {
    h = ((h * 31 + unit) & 0xffffffff).toSigned(32);
  }
  return h.abs() % 6;
}

Gradient avatarGradFor(BuildContext context, String seed) {
  final a = context.a;
  return [a.gradPeach, a.gradPink, a.gradLav, a.gradBlue, a.gradGreen, a.gradYellow][avatarGradIndex(seed)];
}

/// Instagram's quick-reaction row above the comment field.
const List<String> kQuickEmoji = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

final RegExp _translatable = RegExp('[A-Za-zА-Яа-яЁёƏəĞğIıİÖöŞşÜüÇç]');

class PostCard extends ConsumerStatefulWidget {
  const PostCard({super.key, required this.post, this.groupId, this.onUserClick, this.forceShowComments = false, this.highlightCommentId});
  final CRow post;
  final String? groupId;
  final void Function(String userId)? onUserClick;
  final bool forceShowComments;
  final String? highlightCommentId;

  @override
  ConsumerState<PostCard> createState() => _PostCardState();
}

class _PostCardState extends ConsumerState<PostCard> {
  late bool _showComments = widget.forceShowComments;
  final OverlayPortalController _sheet = OverlayPortalController();
  final TextEditingController _comment = TextEditingController();
  final FocusNode _commentFocus = FocusNode();
  bool _showStickers = false;
  ({String id, String name})? _replyTo;
  bool _submitting = false;
  bool _anonymous = false;
  CommunityMediaFile? _image;
  bool _uploading = false;
  bool _editing = false;
  late final TextEditingController _edit = TextEditingController(text: _content);
  bool _heartBurst = false;
  bool _showTranslation = false;
  String? _translation;
  bool _translating = false;
  int _lastTap = 0;
  Timer? _burstTimer;

  CRow get p => widget.post;
  String get _id => '${p['id']}';
  String get _content => '${p['content'] ?? ''}';
  Map<String, dynamic> get _author => p['author'] is Map ? Map<String, dynamic>.from(p['author'] as Map) : const {};

  @override
  void initState() {
    super.initState();
    _comment.addListener(() => setState(() {}));
    _edit.addListener(() => setState(() {}));
    if (_showComments) WidgetsBinding.instance.addPostFrameCallback((_) => _syncSheet());
  }

  @override
  void didUpdateWidget(PostCard old) {
    super.didUpdateWidget(old);
    if (widget.forceShowComments && !old.forceShowComments) _openComments();
  }

  @override
  void dispose() {
    _burstTimer?.cancel();
    _comment.dispose();
    _commentFocus.dispose();
    _edit.dispose();
    super.dispose();
  }

  void _syncSheet() {
    if (!mounted) return;
    if (_showComments && !_sheet.isShowing) _sheet.show();
    if (!_showComments && _sheet.isShowing) _sheet.hide();
  }

  void _openComments() {
    setState(() => _showComments = true);
    _syncSheet();
  }

  void _closeComments() {
    setState(() {
      _showComments = false;
      _showStickers = false;
    });
    _syncSheet();
  }

  CommunityHaptics get _haptics => ref.read(communityHapticsProvider);

  void _like() {
    if (ref.read(toggleLikeMutation).isPending) return;
    _haptics.light();
    ref.read(toggleLikeMutation.notifier).mutate(
        LikeVars(postId: _id, isLiked: p['is_liked'] == true, groupId: widget.groupId, viewerId: ref.read(authUserProvider)?.id));
  }

  void _contentTap() {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastTap < 300) {
      if (p['is_liked'] != true) _like();
      setState(() => _heartBurst = true);
      _haptics.medium();
      _burstTimer?.cancel();
      _burstTimer = Timer(const Duration(milliseconds: 900), () {
        if (mounted) setState(() => _heartBurst = false);
      });
    }
    _lastTap = now;
  }

  void _reply(CRow comment) {
    if (ref.read(authUserProvider) == null || _submitting) return;
    final author = comment['author'] is Map ? (comment['author'] as Map)['name'] : null;
    setState(() => _replyTo = (id: '${comment['id']}', name: author is String && author.isNotEmpty ? author : tr('usecommunity_anonim', 'Anonim')));
    _commentFocus.requestFocus();
  }

  String _commenterName() {
    final profileName = ref.read(authProfileProvider)?.name;
    final metaName = ref.read(authUserProvider)?.userMetadata?['name'];
    if (profileName != null && profileName.isNotEmpty) return profileName;
    if (metaName is String && metaName.isNotEmpty) return metaName;
    return tr('postcard_i_stifadeci_b6bdd6', 'İstifadəçi');
  }

  bool get _blocked => ref.read(myModerationStatusQuery).data?['comment'] == true || p['comments_locked'] == true;

  Future<void> _pickImage() async {
    final file = await ref.read(communityMediaPickerProvider).pickImage();
    if (file == null || !mounted) return;
    if (file.size > 10 * 1024 * 1024) {
      toasts(context).show(title: tr('createpostscreen_fayl_cox_boyukdur_f5cf61', 'Fayl çox böyükdür'), description: 'Max 10MB', destructive: true);
      return;
    }
    setState(() => _image = file);
  }

  Future<void> _sendComment() async {
    if (_blocked) return;
    final content = _comment.text.trim();
    final user = ref.read(authUserProvider);
    if ((content.isEmpty && _image == null) || user == null || _submitting) return;
    _submitting = true;
    _haptics.light();
    String? imageUrl;
    final image = _image;
    if (image != null) {
      setState(() => _uploading = true);
      try {
        imageUrl = await uploadCommunityMedia(ref.read(communityBackendProvider), user.id, image.file, codec: ref.read(communityImageCodecProvider));
      } catch (e) {
        if (mounted) {
          setState(() => _uploading = false);
          toasts(context).show(title: tr('postcard_xeta_3cdbb6', 'Xəta'), description: e.toString(), destructive: true);
        }
        _submitting = false;
        return;
      }
      if (mounted) setState(() => _uploading = false);
    }
    try {
      await ref.read(createCommentMutation.notifier).mutateAsync(CreateCommentVars(
            postId: _id,
            content: content,
            imageUrl: imageUrl,
            postAuthorId: p['user_id'] as String?,
            expectedUserId: user.id,
            parentCommentId: _replyTo?.id,
            commenterName: _commenterName(),
            isAnonymous: _anonymous,
          ));
      if (mounted) {
        setState(() {
          _comment.clear();
          _image = null;
          _anonymous = false;
          _replyTo = null;
        });
      }
    } catch (_) {
      // The mutation reports the error. Keep the complete draft and reply target.
    } finally {
      _submitting = false;
    }
  }

  Future<void> _sendSticker(String id) async {
    final user = ref.read(authUserProvider);
    if (_blocked || user == null || _submitting) return;
    _submitting = true;
    _haptics.light();
    try {
      final url = ref.read(communityBackendProvider).publicUrl(kCommunityMediaBucket, stickerStoragePath(id));
      await ref.read(createCommentMutation.notifier).mutateAsync(CreateCommentVars(
            postId: _id,
            content: '',
            imageUrl: url,
            postAuthorId: p['user_id'] as String?,
            expectedUserId: user.id,
            parentCommentId: _replyTo?.id,
            commenterName: _commenterName(),
            isAnonymous: _anonymous,
          ));
      if (mounted) {
        setState(() {
          _showStickers = false;
          _replyTo = null;
        });
      }
    } catch (_) {
      // The mutation reports the error.
    } finally {
      _submitting = false;
    }
  }

  Future<void> _deletePost(bool isAdmin, bool own) async {
    if (isAdmin && !own) {
      await showModeratorActionDialog(context,
          target: ModeratorTarget(kind: 'post', id: _id, userId: '${p['user_id']}', name: _author['name'] as String?, content: _content), action: 'remove');
      return;
    }
    if (!await communityConfirm(context, tr('postcard_bu_postu_silmek_isteyirsiniz_2fbc75', 'Bu postu silmək istəyirsiniz?'))) return;
    _haptics.medium();
    ref.read(deletePostMutation.notifier).mutate(_id);
  }

  void _togglePin() {
    _haptics.light();
    ref.read(togglePinMutation.notifier).mutate((postId: _id, pin: p['is_pinned'] != true));
  }

  void _saveEdit() {
    final content = _edit.text.trim();
    if (content.isEmpty) return;
    _haptics.light();
    final uiLang = currentLanguage();
    setState(() {
      _showTranslation = false;
      _translation = null;
    });
    ref.read(postTranslationCacheProvider).remove('$_id:$uiLang');
    ref.read(editPostMutation.notifier).mutate(
          EditPostVars(
            postId: _id,
            content: content,
            currentLanguage: p['language'] as String?,
            expectedRevision: (p['ad_moderation_revision'] as num?)?.toInt(),
          ),
          onSuccess: (_, _, _) {
            if (mounted) setState(() => _editing = false);
          },
        );
  }

  Future<void> _translate() async {
    _haptics.light();
    if (_showTranslation) {
      setState(() => _showTranslation = false);
      return;
    }
    final uiLang = currentLanguage();
    final key = '$_id:$uiLang';
    final cached = _translation ?? ref.read(postTranslationCacheProvider)[key];
    if (cached != null) {
      setState(() {
        _translation = cached;
        _showTranslation = true;
      });
      return;
    }
    setState(() => _translating = true);
    try {
      final content = await translatePost(ref.read(communityBackendProvider), _id, uiLang);
      ref.read(postTranslationCacheProvider).remember(key, content);
      if (mounted) {
        setState(() {
          _translation = content;
          _showTranslation = true;
        });
      }
    } catch (_) {
      if (mounted) toasts(context).show(title: tr('postcard_tercume_xetasi', 'Tərcümə alınmadı — yenidən cəhd edin'), destructive: true);
    } finally {
      if (mounted) setState(() => _translating = false);
    }
  }

  Future<void> _share() async {
    _haptics.medium();
    final content = _content;
    await ref.read(shareServiceProvider).share(
          title: tr('postcard_anacan_paylasim_9618d9', 'Anacan - Paylaşım'),
          text: jsSlice(content, 0, 100) + (content.length > 100 ? '...' : ''),
        );
  }

  Future<void> _report() => showShadDialog<void>(context, builder: (ctx) => _ReportDialog(postId: _id, onClose: () => Navigator.of(ctx).pop()));

  void _avatarTap(bool isAdmin) {
    final userId = '${p['user_id'] ?? ''}';
    if (userId.isNotEmpty && widget.onUserClick != null && (p['is_anonymous'] != true || isAdmin)) widget.onUserClick!(userId);
  }

  void _openImage(List<MediaItem> media, int index) {
    if (index >= media.length || media[index].video) return;
    final images = media.where((m) => !m.video).toList();
    final at = images.indexWhere((m) => m.url == media[index].url);
    unawaited(showPhotoGallery(context,
        photos: [for (var i = 0; i < images.length; i++) GalleryPhoto(id: '$_id-img-$i', url: images[i].url)], initialIndex: at < 0 ? 0 : at));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = currentLanguage();
    final uiLang = language.isEmpty ? 'az' : language;
    final isAdmin = ref.watch(isAdminProvider);
    final user = ref.watch(authUserProvider);
    final own = user?.id == p['user_id'];
    final anonymous = p['is_anonymous'] == true;
    final hidden = anonymous && !isAdmin;
    final badge = _author['badge_type'] as String?;
    final verified = isVerifiedActive(_author['is_verified'], _author['verified_until']);
    final stage = anonymous ? null : lifeStageMeta(context, _author['life_stage'] as String?);
    final created = DateTime.tryParse('${p['created_at']}') ?? DateTime.now();
    final timeAgo = formatDistanceToNowSuffix(created);
    final media = [for (final url in (p['media_urls'] is List ? p['media_urls'] as List : const [])) MediaItem(url: '$url', video: isVideoUrl('$url'))];
    final postLang = (p['language'] as String?) ?? 'az';
    final canTranslate = _translatable.hasMatch(_content) && isFeedLang(uiLang) && postLang != uiLang;
    final liked = p['is_liked'] == true;
    final saved = p['is_saved'] == true;
    final likes = (p['likes_count'] as num?)?.toInt() ?? 0;
    final commentsCount = (p['comments_count'] as num?)?.toInt() ?? 0;
    final bookmark = ref.watch(communityBookmarkProvider(_id));
    final authorName = (_author['name'] as String?)?.isNotEmpty == true ? _author['name'] as String : tr('postcard_i_stifadeci_b6bdd6', 'İstifadəçi');

    final avatar = Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        // anonymous: linear-gradient(135deg, #d8d3c6, #b3ac9a) (PostCard.tsx literal)
        gradient: hidden
            ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFD8D3C6), Color(0xFFB3AC9A)])
            : avatarGradFor(context, '${p['user_id'] ?? _id}'),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: hidden
          ? const AIcon(AIcons.eyeOff, size: 15, color: Color(0xFFFFFFFF))
          : (_author['avatar_url'] is String && (_author['avatar_url'] as String).isNotEmpty)
              ? Image.network(_author['avatar_url'] as String, width: 38, height: 38, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())
              : Text((charAt0(_author['name'] as String?).isEmpty ? tr('common_initial_i', 'İ') : charAt0(_author['name'] as String?)).toUpperCase(),
                  style: px(14, weight: FontWeight.w800, color: const Color(0xFFFFFFFF), height: 1)),
    );

    final nameRow = Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, runSpacing: 2, children: [
      CommunityButton(
        enabled: !hidden,
        tapScale: 0.98,
        label: anonymous ? tr('untranslated_anonim_89j5l6', 'Anonim') : authorName,
        onTap: () => _avatarTap(isAdmin),
        child: anonymous
            ? (isAdmin
                ? Text.rich(TextSpan(children: [
                    TextSpan(text: tr('untranslated_anonim_89j5l6', 'Anonim'), style: TextStyle(fontStyle: FontStyle.italic, color: a.inkSoft)),
                    TextSpan(text: ' (${_author['name'] ?? tr('postcard_i_stifadeci_b6bdd6', 'İstifadəçi')})', style: px(11, weight: FontWeight.w600, color: a.peach2)),
                  ]), style: px(14, weight: FontWeight.w700, color: a.ink, height: 1.3))
                : Text(tr('untranslated_anonim_89j5l6', 'Anonim'), style: px(14, weight: FontWeight.w700, color: a.inkSoft, height: 1.3).copyWith(fontStyle: FontStyle.italic)))
            : Text(authorName, style: px(14, weight: FontWeight.w700, color: a.ink, height: 1.3)),
      ),
      if (!anonymous && verified) const VerifiedTick(),
      if (!anonymous) UserBadge(type: badge, premium: _author['is_premium'] as bool?),
      if (anonymous) Text('(${tr('untranslated_anonim_89j5l6', 'Anonim')})', style: px(11.5, weight: FontWeight.w500, color: a.inkFaint, height: 1.3)),
    ]);

    final head = Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CommunityButton(enabled: !hidden, tapScale: 0.9, onTap: () => _avatarTap(isAdmin), child: ExcludeSemantics(child: avatar)),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            nameRow,
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Text.rich(
                TextSpan(children: [
                  const TextSpan(text: '· '),
                  if (stage != null) TextSpan(text: '${stage.label} · ', style: TextStyle(color: stage.ink, fontWeight: FontWeight.w700)),
                  TextSpan(text: timeAgo),
                ]),
                style: px(12, weight: FontWeight.w500, color: a.inkFaint, height: 1.4),
              ),
            ),
          ]),
        ),
        ModeratorActionMenu(
          target: ModeratorTarget(
            kind: 'post',
            id: _id,
            userId: '${p['user_id']}',
            name: _author['name'] as String?,
            content: _content,
            version: (p['moderation_version'] as num?)?.toInt() ?? 0,
            isPinned: p['is_pinned'] == true,
            removed: p['moderation_removed_at'] != null,
            commentsLocked: p['comments_locked'] == true,
          ),
        ),
        Builder(
          builder: (anchor) => CommunityButton(
            onTap: () => showCommunityMenu(anchor, [
              if (own)
                CommunityMenuItem(
                  label: tr('postcard_redakte_et_66cf3b', 'Redaktə et'),
                  icon: AIcons.pencil,
                  onSelect: () => setState(() {
                    _edit.text = _content;
                    _editing = true;
                  }),
                ),
              if (!own)
                CommunityMenuItem(label: tr('postcard_sikayet_et_e8b63a', 'Şikayət et'), icon: AIcons.flag, color: const Color(0xFFD97706), onSelect: _report),
              if (isAdmin)
                CommunityMenuItem(
                  label: p['is_pinned'] == true ? tr('postcard_pini_gotur', 'Pini götür') : tr('postcard_pinle', 'Pinlə'),
                  icon: p['is_pinned'] == true ? AIcons.pinOff : AIcons.pin,
                  onSelect: _togglePin,
                ),
              if (isAdmin && !own)
                CommunityMenuItem(
                  label: tr('postcard_istifadecini_blokla', 'İstifadəçini blokla'),
                  icon: AIcons.ban,
                  color: context.tokens.shadcn.destructive,
                  onSelect: () => showBlockUserDialog(context, userId: '${p['user_id']}', userName: _author['name'] as String?),
                ),
              if (isAdmin || own)
                CommunityMenuItem(
                  label: tr('untranslated_sil_zwa7lz', 'Sil'),
                  icon: AIcons.trash2,
                  color: context.tokens.shadcn.destructive,
                  separatorBefore: true,
                  onSelect: () => unawaited(_deletePost(isAdmin, own)),
                ),
            ]),
            child: SizedBox(width: 30, height: 30, child: Center(child: AIcon(AIcons.ellipsis, size: 16, color: a.inkFaint))),
          ),
        ),
      ]),
    );

    Widget content;
    if (_editing) {
      final pending = ref.watch(editPostMutation).isPending;
      content = Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: VGap(gap: 8, children: [
          CommunityTextArea(
            controller: _edit,
            autofocus: true,
            minHeight: 70,
            minLines: 3,
            maxLines: 10,
            radius: 12,
            fontSize: 13,
            background: a.surfaceSoft,
            borderColor: a.lineStrong,
          ),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            ATagChip(onTap: () => setState(() => _editing = false), child: Text(tr('postcard_legv_et_b5e49c', 'Ləğv et'))),
            const SizedBox(width: 6),
            AButton(
              variant: AButtonVariant.pillSolid,
              onPressed: _edit.text.trim().isEmpty || pending ? null : _saveEdit,
              child: Text(pending ? '...' : tr('common_saxla', 'Saxla')),
            ),
          ]),
        ]),
      );
    } else {
      content = GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _contentTap,
        child: Stack(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _PostText(text: _showTranslation && _translation != null ? _translation! : _content),
            if (canTranslate)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: CommunityButton(
                  enabled: !_translating,
                  onTap: () => unawaited(_translate()),
                  child: Opacity(
                    opacity: _translating ? 0.6 : 1,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.languages, size: 12, strokeWidth: 2.2, color: a.blue2),
                        const SizedBox(width: 4),
                        Text(
                          _translating
                              ? tr('postcard_tercume_olunur', 'Tərcümə olunur…')
                              : _showTranslation
                                  ? tr('postcard_orijinali_goster', 'Orijinalı göstər')
                                  : tr('postcard_tercumeni_gor', 'Tərcüməni gör'),
                          style: px(11, weight: FontWeight.w700, color: a.blue2),
                        ),
                        if (_showTranslation && !_translating) ...[
                          const SizedBox(width: 4),
                          Text('· ${postLang.toUpperCase()} → ${uiLang.toUpperCase()}', style: px(11, weight: FontWeight.w600, color: a.inkFaint)),
                        ],
                      ]),
                    ),
                  ),
                ),
              ),
            if (media.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: MediaCarousel(media: media, onOpenFullscreen: (i) => _openImage(media, i)),
                ),
              ),
          ]),
          if (_heartBurst)
            const Positioned.fill(
              child: IgnorePointer(
                child: Center(child: _HeartBurst()),
              ),
            ),
        ]),
      );
    }

    final tagged = p['tagged_group_ids'] is List ? [for (final id in p['tagged_group_ids'] as List) '$id'] : const <String>[];
    final blogId = p['blog_post_id'] as String?;

    Widget action({required Widget child, required String label, required VoidCallback? onTap, bool? pressed, Color? color, double scale = 0.8}) =>
        CommunityButton(
          label: label,
          selected: pressed,
          enabled: onTap != null,
          tapScale: scale,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            padding: const EdgeInsets.all(8),
            child: DefaultTextStyle.merge(
              style: px(13, weight: FontWeight.w700, color: color ?? a.inkSoft, height: 1.2).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [child]),
            ),
          ),
        );
    const likedColor = Color(0xFFE05575); // .a-post-action.liked literal

    final footer = Container(
      margin: const EdgeInsets.only(top: 13),
      padding: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
      child: Row(children: [
        action(
          label: tr('commentreply_beyen', 'Bəyən'),
          pressed: liked,
          onTap: _like,
          color: liked ? likedColor : null,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            liked ? const LucideFilled('heart', size: 19, fill: likedColor) : AIcon(AIcons.heart, size: 19, color: a.inkSoft),
            if (likes > 0) ...[const SizedBox(width: 6), Text('$likes')],
          ]),
        ),
        const SizedBox(width: 8),
        action(
          label: tr('community_comments', 'Şərhlər'),
          pressed: _showComments,
          onTap: _openComments,
          color: _showComments ? a.accentInk : null,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.messageCircle, size: 19, color: _showComments ? a.accentInk : a.inkSoft),
            if (commentsCount > 0) ...[const SizedBox(width: 6), Text('$commentsCount')],
          ]),
        ),
        const SizedBox(width: 8),
        action(label: tr('community_share', 'Paylaş'), onTap: () => unawaited(_share()), child: AIcon(AIcons.share2, size: 18, color: a.inkSoft)),
        const Spacer(),
        action(
          label: saved ? tr('community_unsave_post', 'Saxlanmışlardan çıxar') : tr('community_save_post', 'Paylaşımı saxla'),
          pressed: saved,
          scale: 0.9,
          onTap: user == null || bookmark.isPending
              ? null
              : () {
                  _haptics.light();
                  bookmark.setSaved(!saved);
                },
          child: saved ? LucideFilled('bookmark', size: 19, fill: a.accentInk) : AIcon(AIcons.bookmark, size: 19, color: a.inkSoft),
        ),
      ]),
    );

    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: a.line),
        boxShadow: a.cardShadow,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (p['is_pinned'] == true)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                LucideFilled('pin', size: 11, fill: a.accentInk, strokeWidth: 2.4),
                const SizedBox(width: 6),
                Text(tr('postcard_pinlenmis_post', 'Pinlənmiş'), style: px(10.5, weight: FontWeight.w800, color: a.accentInk, height: 1.2)),
              ]),
            ),
          ),
        head,
        if (p['moderation_edited_at'] != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(moderatorText('edited_marker', uiLang), style: Tw.xs.copyWith(color: context.tokens.shadcn.mutedForeground)),
          ),
        if (p['comments_locked'] == true)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: context.tokens.shadcn.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
            child: Text(moderatorText('comments_closed', uiLang), style: Tw.xs),
          ),
        content,
        if (tagged.isNotEmpty) GroupPostTags(ids: tagged),
        if (blogId != null && blogId.isNotEmpty) CommunityBlogCard(id: blogId),
        footer,
      ]),
    );

    return OverlayBackHandler(
      open: _showComments,
      onClose: _closeComments,
      child: OverlayPortal(
        controller: _sheet,
        overlayChildBuilder: (context) => _CommentsSheet(state: this),
        child: Semantics(identifier: 'post-$_id', container: true, child: card),
      ),
    );
  }
}

class _HeartBurst extends StatefulWidget {
  const _HeartBurst();
  @override
  State<_HeartBurst> createState() => _HeartBurstState();
}

class _HeartBurstState extends State<_HeartBurst> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 400))..forward();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = CurvedAnimation(parent: _c, curve: Curves.easeOut);
    return FadeTransition(
      opacity: t,
      child: ScaleTransition(scale: t, child: const LucideFilled('heart', size: 80, fill: Color(0xFFE05575))), // PostCard.tsx literal
    );
  }
}

/// The post text: whitespace-separated words, `#tag` (peach, bold), `@mention` (blue, bold), app / http links.
class _PostText extends ConsumerStatefulWidget {
  const _PostText({required this.text});
  final String text;
  @override
  ConsumerState<_PostText> createState() => _PostTextState();
}

class _PostTextState extends ConsumerState<_PostText> {
  final List<TapGestureRecognizer> _recognizers = [];
  void _clear() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _clear();
    final a = context.a;
    final opener = ref.watch(communityLinkOpenerProvider);
    final spans = <InlineSpan>[];
    for (final match in RegExp(r'\s+|\S+').allMatches(widget.text)) {
      final word = match[0]!;
      if (word.startsWith('#')) {
        spans.add(TextSpan(text: word, style: TextStyle(fontWeight: FontWeight.w700, color: a.peach2)));
      } else if (word.startsWith('@')) {
        spans.add(TextSpan(text: word, style: TextStyle(fontWeight: FontWeight.w700, color: a.blue2)));
      } else if (RegExp(r'^(?:https?:\/\/|anacan:\/\/)\S+').hasMatch(word)) {
        for (final s in commentSegments(word, allowLinks: true)) {
          if (s.kind == CommentLinkKind.text) {
            spans.add(TextSpan(text: s.text));
            continue;
          }
          final r = TapGestureRecognizer()
            ..onTap = () => switch (s.kind) {
                  CommentLinkKind.blog => opener.openBlog(s.href!),
                  CommentLinkKind.inApp => opener.openDeeplink(s.deeplink!),
                  _ => opener.openExternal(s.href!),
                };
          _recognizers.add(r);
          spans.add(TextSpan(text: s.text, recognizer: r, style: TextStyle(color: context.tokens.shadcn.primary, decoration: TextDecoration.underline)));
          if (s.trail.isNotEmpty) spans.add(TextSpan(text: s.trail));
        }
      } else {
        spans.add(TextSpan(text: word));
      }
    }
    return Text.rich(TextSpan(children: spans), style: px(15, color: a.ink, height: 1.65));
  }
}

/// `.ig-sheet-backdrop` + `.ig-sheet`: the comments of one post.
class _CommentsSheet extends ConsumerStatefulWidget {
  const _CommentsSheet({required this.state});
  final _PostCardState state;
  @override
  ConsumerState<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends ConsumerState<_CommentsSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 320))..forward();
  double _drag = 0;

  _PostCardState get s => widget.state;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) _enter.value = 1;
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  void _dragEnd(DragEndDetails d) {
    final velocity = d.primaryVelocity ?? 0;
    if (_drag > 110 || velocity > 600) {
      s._closeComments();
    } else {
      setState(() => _drag = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final media = MediaQuery.of(context);
    final postId = s._id;
    final q = ref.watch(postCommentsQuery((postId: postId, enabled: true)));
    final comments = q.data ?? const <CRow>[];
    final ids = {for (final c in comments) c['id']};
    final top = [for (final c in comments) if ((c['parent_comment_id'] ?? '') == '' || !ids.contains(c['parent_comment_id'])) c];
    final pending = ref.watch(createCommentMutation).isPending;
    final busy = pending || s._uploading;
    final profile = ref.watch(authProfileProvider);
    final title = tr('community_comments', 'Şərhlər');
    final height = (media.size.height * 0.88).clamp(0.0, media.size.height);
    final keyboard = media.viewInsets.bottom;

    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      children: [
        const RestrictionNote(scope: 'comment'),
        if (q.isLoading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: ARingSpinner(size: 20, width: 2)))
        else if (top.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(tr('postcard_hele_serh_yoxdur_89ce09', 'Hələ şərh yoxdur 💭'), textAlign: TextAlign.center, style: px(14, color: a.inkSoft)),
          )
        else
          for (final (i, c) in top.indexed) ...[
            if (i > 0) const SizedBox(height: 18),
            CommentReply(
              key: ValueKey(c['id']),
              comment: c,
              postId: postId,
              allComments: comments,
              onReply: s._reply,
              onRefetch: () => ref.read(postCommentsQuery((postId: postId, enabled: true)).notifier).refetch(),
              onUserClick: s.widget.onUserClick,
              highlightCommentId: s.widget.highlightCommentId,
            ),
          ],
      ],
    );

    Widget toolButton(AIconData icon, String label, VoidCallback onTap, {bool pressed = false}) => CommunityButton(
          label: label,
          selected: pressed,
          enabled: !busy,
          onTap: onTap,
          child: Opacity(
            opacity: busy ? 0.5 : 1,
            child: SizedBox(width: 34, height: 36, child: Center(child: AIcon(icon, size: 19, color: pressed ? a.peach2 : a.ink))),
          ),
        );

    final canSend = (s._comment.text.trim().isNotEmpty || s._image != null) && !busy;
    final foot = Container(
      decoration: BoxDecoration(color: a.surface, border: Border(top: BorderSide(color: a.line))),
      padding: EdgeInsets.fromLTRB(12, 6, 12, 10 + (keyboard > 0 ? 0 : media.padding.bottom)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (s._replyTo != null)
          Container(
            margin: const EdgeInsets.only(bottom: 6),
            transform: Matrix4.translationValues(0, 0, 0),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: a.surfaceSoft,
            child: Row(children: [
              Expanded(child: Text(tr('community_replying_to', '{name} üçün cavab').replaceAll('{name}', s._replyTo!.name), style: px(13, color: a.inkSoft))),
              CommunityButton(
                label: tr('community_cancel_reply', 'Cavabı ləğv et'),
                enabled: !busy,
                onTap: () => s.setState(() => s._replyTo = null),
                child: Padding(padding: const EdgeInsets.all(4), child: AIcon(AIcons.x, size: 16, color: a.inkSoft)),
              ),
            ]),
          ),
        if (s._showStickers)
          StickerPicker(onPick: (id) => unawaited(s._sendSticker(id)), onClose: () => s.setState(() => s._showStickers = false), disabled: pending),
        Padding(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (final emoji in kQuickEmoji)
              CommunityButton(
                label: emoji,
                enabled: !busy,
                tapScale: 0.85,
                onTap: () {
                  final t = s._comment.text + emoji;
                  s._comment.value = TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));
                  s._commentFocus.requestFocus();
                },
                child: Padding(padding: const EdgeInsets.all(4), child: Text(emoji, style: const TextStyle(fontSize: 24, height: 1))),
              ),
          ]),
        ),
        if (s._image != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 44, bottom: 8),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: SizedBox(
                width: 56,
                height: 56,
                child: Stack(clipBehavior: Clip.none, children: [
                  ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.memory(s._image!.file.bytes, width: 56, height: 56, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())),
                  PositionedDirectional(
                    top: -6,
                    end: -6,
                    child: CommunityButton(
                      label: tr('postcard_legv_et_b5e49c', 'Ləğv et'),
                      onTap: () => s.setState(() => s._image = null),
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(color: a.ink, shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: AIcon(AIcons.x, size: 11, color: a.bg),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          CommunityAvatar(
            size: 32,
            url: profile?.avatarUrl,
            name: profile?.name.isNotEmpty == true ? profile!.name : '?',
            fallback: '?',
            fallbackColor: context.tokens.shadcn.primary.withValues(alpha: 0.1),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(
              padding: const EdgeInsetsDirectional.fromSTEB(14, 2, 6, 2),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22), border: Border.all(color: a.lineStrong)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: CommunityTextArea(
                    controller: s._comment,
                    focusNode: s._commentFocus,
                    bordered: false,
                    minLines: 1,
                    maxLines: 5,
                    minHeight: 40,
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    enabled: !busy,
                    semanticLabel: tr('community_comment_text', 'Şərh və ya cavab yaz'),
                    placeholder: s._replyTo != null
                        ? tr('community_reply_placeholder', 'Cavabınızı yazın...')
                        : s._anonymous
                            ? tr('postcard_anonim_serh_yaz_9af1ca', 'Anonim şərh yaz...')
                            : tr('postcard_serh_yaz_54a89a', 'Şərh yaz...'),
                    onKey: (event) {
                      if (event is! KeyDownEvent || event.logicalKey != LogicalKeyboardKey.enter) return false;
                      final keyboard = HardwareKeyboard.instance;
                      if (!(keyboard.isControlPressed || keyboard.isMetaPressed) || s._comment.value.composing.isValid) return false;
                      unawaited(s._sendComment());
                      return true;
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    toolButton(AIcons.eyeOff, tr('postcard_anonim_olaraq_yaz_abc123', 'Anonim olaraq yaz'), () => s.setState(() => s._anonymous = !s._anonymous),
                        pressed: s._anonymous),
                    toolButton(AIcons.sticker, stickerText('stickers'), () => s.setState(() => s._showStickers = !s._showStickers), pressed: s._showStickers),
                    toolButton(AIcons.imagePlus, tr('postcard_sekil_elave_et', 'Şəkil əlavə et'), () => unawaited(s._pickImage())),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(width: 10),
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: CommunityButton(
              label: tr('postcard_gonder_3f11bd', 'Göndər'),
              enabled: canSend,
              onTap: () => unawaited(s._sendComment()),
              child: Opacity(
                opacity: canSend ? 1 : 0.35,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: busy ? const ALoader(size: 20, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.send, size: 20, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ),
        ]),
        if (s._anonymous)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 44, top: 6),
            child: Row(children: [
              AIcon(AIcons.eyeOff, size: 12, color: a.inkSoft),
              const SizedBox(width: 5),
              Text(tr('postcard_anonim_olaraq_yaz_abc123', 'Anonim olaraq yaz'), style: px(11.5, color: a.inkSoft)),
            ]),
          ),
      ]),
    );

    final sheet = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: 640, maxHeight: height),
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          boxShadow: const [BoxShadow(color: Color(0x80000000), offset: Offset(0, -10), blurRadius: 40, spreadRadius: -20)],
        ),
        clipBehavior: Clip.antiAlias,
        child: DefaultTextStyle.merge(
          style: px(14, color: a.ink),
          child: Column(children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onVerticalDragUpdate: (d) => setState(() => _drag = (_drag + d.delta.dy).clamp(0, double.infinity) * 1.0),
              onVerticalDragEnd: _dragEnd,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 10),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
                child: Column(children: [
                  Opacity(opacity: 0.7, child: Container(width: 40, height: 4, decoration: BoxDecoration(color: a.inkFaint, borderRadius: BorderRadius.circular(4)))),
                  const SizedBox(height: 10),
                  Semantics(header: true, child: Text(title, textAlign: TextAlign.center, style: px(15, weight: FontWeight.w700, color: a.ink, height: 1.3))),
                ]),
              ),
            ),
            Expanded(child: list),
            foot,
          ]),
        ),
      ),
    );

    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: title,
      child: Stack(children: [
        Positioned.fill(
          child: GestureDetector(onTap: s._closeComments, child: const ColoredBox(color: Color(0x73000000))), // rgba(0,0,0,.45)
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: keyboard,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: AnimatedBuilder(
              animation: _enter,
              builder: (context, child) {
                final t = Curves.easeOutCubic.transform(_enter.value);
                return Transform.translate(offset: Offset(0, (1 - t) * height + _drag), child: child);
              },
              child: AScope(child: sheet),
            ),
          ),
        ),
      ]),
    );
  }
}

class _ReportDialog extends ConsumerStatefulWidget {
  const _ReportDialog({required this.postId, required this.onClose});
  final String postId;
  final VoidCallback onClose;
  @override
  ConsumerState<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends ConsumerState<_ReportDialog> {
  final TextEditingController _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final t = toasts(context);
    if (_reason.text.trim().isEmpty) {
      t.show(title: tr('postcard_xeta_3cdbb6', 'Xəta'), description: tr('postcard_sikayet_sebebini_qeyd_edin_9d11b9', 'Şikayət səbəbini qeyd edin'), destructive: true);
      return;
    }
    final user = ref.read(authUserProvider);
    if (user == null) {
      t.show(title: tr('postcard_xeta_3cdbb6', 'Xəta'), description: tr('postcard_giris_etmelisiniz_6c2220', 'Giriş etməlisiniz'), destructive: true);
      return;
    }
    try {
      await ref.read(communityBackendProvider).insertSingle(
            'post_reports',
            {'post_id': widget.postId, 'reporter_id': user.id, 'reason': _reason.text, 'status': 'pending'},
            columns: 'id',
          );
      t.show(title: tr('postcard_sikayet_gonderildi_b7b528', 'Şikayət göndərildi'), description: tr('postcard_sikayetiniz_yoxlanilacaq_ad512c', 'Şikayətiniz yoxlanılacaq'));
      widget.onClose();
    } catch (e) {
      t.show(title: tr('postcard_xeta_3cdbb6', 'Xəta'), description: errorMessage(e), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) => ShadDialogFrame(radius: 16, maxWidth: 448, inset: 18, children: [
        Text(tr('postcard_postu_sikayet_et_fd45d9', 'Postu Şikayət Et'), style: shadTitle(context).copyWith(fontSize: 14)),
        Text(tr('postcard_bu_postun_niye_uygunsuz_oldugunu_bildiri_b86b7c', 'Bu postun niyə uyğunsuz olduğunu bildirin'),
            style: shadDescription(context).copyWith(fontSize: 12)),
        CommunityTextArea(controller: _reason, radius: 12, fontSize: 14, placeholder: tr('postcard_sikayet_sebebi_a49b6b', 'Şikayət səbəbi...')),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          ShadButton(variant: ShadButtonVariant.outline, height: 32, onPressed: widget.onClose, child: Text(tr('postcard_legv_et_b5e49c', 'Ləğv et'))),
          const SizedBox(width: 8),
          ShadButton(height: 32, onPressed: () => unawaited(_send()), child: Text(tr('postcard_gonder_3f11bd', 'Göndər'))),
        ]),
      ]);
}
