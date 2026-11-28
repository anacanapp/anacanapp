// Ported from: src/components/community/CreatePostScreen.tsx
//
// The post composer: text with @mention / #hashtag suggestions and the `/blog` article command, quick hashtags,
// up to four images (10 MB) or videos (50 MB), tagged groups, the post language (auto-detected while typing, a chip
// makes it manual) and anonymity. Posts go through the moderated `submit_community_post_v2`.
// emoji-picker-react has no Flutter port in the project: the emoji button opens a compact grid of common emoji.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../settings/ui/settings_ui.dart' show toasts;
import '../copy/community_copy.dart';
import '../data/community.dart';
import '../data/community_backend.dart';
import '../data/community_blog.dart';
import '../data/community_env.dart';
import '../data/community_media.dart';
import '../moderation/moderator_widgets.dart' show RestrictionNote;
import 'community_blog_card.dart';
import 'community_widgets.dart';
import 'group_post_tags.dart';
import 'text_area.dart';

/// `POPULAR_HASHTAGS`.
List<String> popularHashtags() => [
      tr('createpostscreen_hamilelik_64e7fe', 'hamiləlik'),
      tr('createpostscreen_ana_hashtag', 'ana'),
      tr('createpostscreen_korpe_4abca7', 'körpə'),
      tr('createpostscreen_saglamliq_d183d2', 'sağlamlıq'),
      tr('createpostscreen_qidalanma_hashtag', 'qidalanma'),
      tr('createpostscreen_dogus_01c8e6', 'doğuş'),
      tr('createpostscreen_emzirme_1e11e5', 'əmzirmə'),
      tr('createpostscreen_yuxu_hashtag', 'yuxu'),
      tr('createpostscreen_inkisaf_abc234', 'inkişaf'),
      tr('createpostscreen_oyun_hashtag', 'oyun'),
      tr('createpostscreen_aile_894dfb', 'ailə'),
      tr('createpostscreen_sevgi_hashtag', 'sevgi'),
      tr('createpostscreen_xosbextlik_55f22a', 'xoşbəxtlik'),
      tr('createpostscreen_analar_hashtag', 'analar'),
      tr('createpostscreen_usaq_36b348', 'uşaq'),
    ];

const List<String> _emojiGrid = [
  '😀', '😂', '🥰', '😍', '😊', '😢', '😭', '😮', '🤗', '🙏', '👏', '🙌', '💪', '👶', '🍼', '🤰', //
  '❤️', '💕', '💖', '🔥', '✨', '🌸', '🎉', '👍', '😴', '🤒', '😅', '🥺', '😘', '🤔', '💬', '📷',
];

class _Suggestion {
  const _Suggestion({required this.hashtag, required this.value, this.avatar});
  final bool hashtag;
  final String value;
  final String? avatar;
}

class CreatePostScreen extends ConsumerStatefulWidget {
  const CreatePostScreen({super.key, required this.onBack, this.groupId, this.initialBlog});
  final VoidCallback onBack;
  final String? groupId;
  final SharedBlog? initialBlog;

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final TextEditingController _content = TextEditingController();
  final FocusNode _focus = FocusNode();
  late final BlogAttachment _blog = BlogAttachment(controller: _content);
  final List<CommunityMediaFile> _media = [];
  bool _uploading = false;
  bool _emoji = false;
  bool _anonymous = false;
  List<String> _tagged = const [];
  List<_Suggestion> _suggestions = const [];
  String? _manualLang;
  int _searchToken = 0;

  @override
  void initState() {
    super.initState();
    if (validSharedBlog(widget.initialBlog)) _blog.selected = widget.initialBlog;
    _content.addListener(_changed);
    _blog.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _content.removeListener(_changed);
    _blog.dispose();
    _content.dispose();
    _focus.dispose();
    super.dispose();
  }

  int get _cursor {
    final sel = _content.selection;
    return sel.isValid ? sel.baseOffset.clamp(0, _content.text.length) : _content.text.length;
  }

  Future<void> _changed() async {
    setState(() {});
    final text = _content.text;
    final cursor = _cursor;
    if (blogCommand(text, cursor) != null) {
      setState(() => _suggestions = const []);
      return;
    }
    final words = text.substring(0, cursor).split(RegExp(r'\s'));
    final current = words.last;
    final token = ++_searchToken;
    if (current.startsWith('@') && current.length > 1) {
      final term = current.substring(1);
      List<CRow> rows = const [];
      try {
        rows = await ref.read(communityBackendProvider).select(CQuery('public_profile_cards', 'user_id, name, avatar_url').ilike('name', '%$term%').limit(5));
      } catch (_) {}
      if (!mounted || token != _searchToken) return;
      setState(() => _suggestions = [
            for (final r in rows)
              _Suggestion(
                hashtag: false,
                value: (r['name'] as String?)?.isNotEmpty == true ? r['name'] as String : tr('createpostscreen_i_stifadeci_b6bdd6', 'İstifadəçi'),
                avatar: r['avatar_url'] as String?,
              ),
          ]);
    } else if (current.startsWith('#') && current.length > 1) {
      final term = current.substring(1).toLowerCase();
      setState(() => _suggestions = [for (final tag in popularHashtags().where((t) => t.toLowerCase().contains(term)).take(5)) _Suggestion(hashtag: true, value: tag)]);
    } else if (_suggestions.isNotEmpty) {
      setState(() => _suggestions = const []);
    }
  }

  void _apply(_Suggestion s) {
    final text = _content.text;
    final cursor = _cursor;
    final words = text.substring(0, cursor).split(RegExp(r'\s'));
    words[words.length - 1] = s.hashtag ? '#${s.value}' : '@${s.value}';
    final next = '${words.join(' ')} ${text.substring(cursor)}';
    _content.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: next.length));
    setState(() => _suggestions = const []);
    _focus.requestFocus();
  }

  void _insertEmoji(String emoji) {
    final text = _content.text;
    final sel = _content.selection;
    final start = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    final next = text.substring(0, start) + emoji + text.substring(end);
    _content.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: start + emoji.length));
    setState(() => _emoji = false);
    _focus.requestFocus();
  }

  void _add(List<CommunityMediaFile> files, bool video) {
    if (files.isEmpty) return;
    final t = toasts(context);
    if (files.length + _media.length > 4) {
      t.show(title: tr('createpostscreen_limit_asildi_30a129', 'Limit aşıldı'), description: 'Maximum 4 fayl', destructive: true);
      return;
    }
    final max = video ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (files.any((f) => f.size > max)) {
      t.show(title: tr('createpostscreen_fayl_cox_boyukdur_f5cf61', 'Fayl çox böyükdür'), description: video ? 'Max 50MB' : 'Max 10MB', destructive: true);
      return;
    }
    setState(() => _media.addAll(files));
  }

  Future<void> _submit(String postLang) async {
    if (ref.read(myModerationStatusQuery).data?['post'] == true) return;
    final t = toasts(context);
    final text = _content.text.trim();
    if (text.isEmpty && _media.isEmpty && _blog.selected == null) {
      t.show(
        title: tr('createpostscreen_bos_paylasim_47b52d', 'Boş paylaşım'),
        description: tr('createpostscreen_metn_yazin_ve_ya_media_elave_edin_18fa25', 'Mətn yazın və ya media əlavə edin'),
        destructive: true,
      );
      return;
    }
    ref.read(communityHapticsProvider).medium();
    setState(() => _uploading = true);
    try {
      final backend = ref.read(communityBackendProvider);
      final urls = <String>[];
      if (_media.isNotEmpty) {
        final user = await backend.getUserId();
        if (user == null) throw StateError('Not authenticated');
        for (final m in _media) {
          urls.add(await uploadCommunityMedia(backend, user, m.file, codec: ref.read(communityImageCodecProvider)));
        }
      }
      await ref.read(createPostMutation.notifier).mutateAsync(CreatePostVars(
            groupId: widget.groupId,
            content: text.isNotEmpty ? text : (_blog.selected != null ? '📖' : '📷'),
            mediaUrls: urls,
            isAnonymous: _anonymous,
            language: postLang,
            autoLanguage: _manualLang == null,
            taggedGroupIds: _tagged,
            blogPostId: _blog.selected?.id,
          ));
      _blog.selected = null;
      _content.clear();
      setState(() => _media.clear());
      widget.onBack();
    } catch (error) {
      if (mounted) {
        t.show(
          title: tr('createpostscreen_xeta_3cdbb6', 'Xəta'),
          description: error is CommunityUploadException || error is StateError
              ? error.toString().replaceFirst('Bad state: ', '')
              : errorMessage(error).isNotEmpty
                  ? errorMessage(error)
                  : tr('createpostscreen_paylasim_yaradila_bilmedi_6354b1', 'Paylaşım yaradıla bilmədi'),
          destructive: true,
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final uiLang = currentLanguage();
    final fallback = isFeedLang(uiLang) ? uiLang : 'az';
    final postLang = _manualLang ?? detectLang(_content.text, fallback);
    final restricted = ref.watch(myModerationStatusQuery).data?['post'] == true;
    final pending = ref.watch(createPostMutation).isPending;
    final canSubmit =
        (_content.text.trim().isNotEmpty || _media.isNotEmpty || _blog.selected != null) && _blog.command == null && !_uploading && !pending && !restricted;
    final busy = _uploading || pending;
    final hashtags = popularHashtags();

    Widget iconButton(AIconData icon, String label, Color color, VoidCallback? onTap) => CommunityButton(
          label: label,
          enabled: onTap != null,
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.4 : 1,
            child: AIconBtn(size: 40, icon: AIcon(icon, size: 17, color: color)),
          ),
        );

    final composer = Stack(clipBehavior: Clip.none, children: [
      ACard(
        padding: const EdgeInsets.all(6),
        child: Stack(children: [
          CommunityTextArea(
            controller: _content,
            focusNode: _focus,
            autofocus: true,
            bordered: false,
            minHeight: 180,
            minLines: 7,
            maxLines: null,
            fontSize: 14,
            padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 48, 8),
            placeholder: _blog.selected != null ? communityFeature37Text('blog_caption', uiLang) : tr('createpostscreen_ne_dusunursunuz_474859', 'Nə düşünürsünüz? ✨'),
          ),
          PositionedDirectional(
            end: 10,
            top: 10,
            child: CommunityButton(
              label: trInline('CreatePostScreen.tsx', 'Emoji'),
              onTap: () => setState(() => _emoji = !_emoji),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: AIcon(AIcons.smile, size: 16, color: a.inkSoft),
              ),
            ),
          ),
        ]),
      ),
      if (_suggestions.isNotEmpty)
        PositionedDirectional(
          start: 0,
          end: 0,
          top: null,
          bottom: -4,
          child: FractionalTranslation(
            translation: const Offset(0, 1),
            child: Container(
              decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
              clipBehavior: Clip.antiAlias,
              child: Column(children: [
                for (final (i, s) in _suggestions.indexed)
                  CommunityButton(
                    onTap: () => _apply(s),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(border: i < _suggestions.length - 1 ? Border(bottom: BorderSide(color: a.line)) : null),
                      child: Row(children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
                          clipBehavior: Clip.antiAlias,
                          alignment: Alignment.center,
                          child: !s.hashtag && (s.avatar ?? '').isNotEmpty
                              ? Image.network(s.avatar!, width: 28, height: 28, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())
                              : AIcon(s.hashtag ? AIcons.hash : AIcons.atSign, size: 13, color: a.accentInk),
                        ),
                        const SizedBox(width: 12),
                        Text('${s.hashtag ? '#' : '@'}${s.value}', style: px(12, weight: FontWeight.w600, color: a.ink)),
                      ]),
                    ),
                  ),
              ]),
            ),
          ),
        ),
    ]);

    return CommunityScope(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ATopbar(
            onBack: widget.onBack,
            backScale: 0.9,
            title: tr('createpostscreen_yeni_paylasim_4f5b15', 'Yeni Paylaşım'),
            actions: [
              Opacity(
                opacity: canSubmit ? 1 : 0.4,
                child: AButton(
                  variant: AButtonVariant.pillSolid,
                  onPressed: canSubmit ? () => unawaited(_submit(postLang)) : null,
                  leading: busy ? null : const AIcon(AIcons.send, size: 13, color: Color(0xFFFFFFFF)),
                  child: busy ? const ALoader(size: 14, color: Color(0xFFFFFFFF)) : Text(tr('createpostscreen_paylas_b4be3b', 'Paylaş')),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 128),
            child: VGap(gap: 16, children: [
              const RestrictionNote(scope: 'post'),
              composer,
              if (_emoji)
                ACard(
                  padding: const EdgeInsets.all(10),
                  child: Wrap(spacing: 4, runSpacing: 4, children: [
                    for (final e in _emojiGrid)
                      CommunityButton(label: e, onTap: () => _insertEmoji(e), child: Padding(padding: const EdgeInsets.all(4), child: Text(e, style: const TextStyle(fontSize: 24, height: 1)))),
                  ]),
                ),
              BlogAttachmentPicker(attachment: _blog),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final tag in hashtags.take(6))
                  ATagChip(
                    onTap: () {
                      final prev = _content.text;
                      final next = '$prev${prev.isNotEmpty ? ' ' : ''}#$tag';
                      _content.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: next.length));
                    },
                    child: Text('#$tag'),
                  ),
              ]),
              if (_media.isNotEmpty)
                GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: EdgeInsets.zero,
                  children: [
                    for (final (i, m) in _media.indexed)
                      Container(
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
                        clipBehavior: Clip.antiAlias,
                        child: Stack(fit: StackFit.expand, children: [
                          if (m.video)
                            Container(
                              color: const Color(0x4D000000), // bg-black/30
                              alignment: Alignment.center,
                              child: Container(
                                width: 40,
                                height: 40,
                                decoration: const BoxDecoration(color: Color(0xE6FFFFFF), shape: BoxShape.circle),
                                alignment: Alignment.center,
                                child: const Padding(padding: EdgeInsetsDirectional.only(start: 2), child: AIcon(AIcons.play, size: 20, color: Color(0xFF333333))),
                              ),
                            )
                          else
                            Image.memory(m.file.bytes, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
                          PositionedDirectional(
                            top: 8,
                            end: 8,
                            child: CommunityButton(
                              onTap: () => setState(() => _media.removeAt(i)),
                              child: Container(
                                width: 24,
                                height: 24,
                                decoration: const BoxDecoration(color: Color(0x99000000), shape: BoxShape.circle),
                                alignment: Alignment.center,
                                child: const AIcon(AIcons.x, size: 12, color: Color(0xFFFFFFFF)),
                              ),
                            ),
                          ),
                        ]),
                      ),
                  ],
                ),
              Row(children: [
                Text(tr('createpostscreen_elave_et_81035a', 'Əlavə et:'), style: px(11, weight: FontWeight.w600, color: a.inkSoft)),
                const SizedBox(width: 12),
                iconButton(AIcons.image, tr('directmessagescreen_sekil_43e2e3', 'Şəkil'), a.accentInk, _media.length >= 4 || _uploading
                    ? null
                    : () async => _add(await ref.read(communityMediaPickerProvider).pickImages(), false)),
                const SizedBox(width: 12),
                iconButton(AIcons.video, trInline('CreatePostScreen.tsx', 'Video'), a.blueInk, _media.length >= 4 || _uploading
                    ? null
                    : () async {
                        final v = await ref.read(communityMediaPickerProvider).pickVideo();
                        _add([?v], true);
                      }),
                const Spacer(),
                if (_media.isNotEmpty) Text('${_media.length}/4', style: px(10, weight: FontWeight.w600, color: a.inkSoft)),
              ]),
              GroupTagPicker(value: _tagged, onChange: (ids) => setState(() => _tagged = ids), disabled: _uploading || _anonymous),
              Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, runSpacing: 6, children: [
                Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.languages, size: 12, color: a.inkSoft),
                  const SizedBox(width: 4),
                  Text('${tr('createpost_post_dili', 'Post dili')}:', style: px(11, weight: FontWeight.w600, color: a.inkSoft)),
                ]),
                for (final l in kFeedLangs)
                  ATagChip(
                    on: postLang == l,
                    onTap: () {
                      ref.read(communityHapticsProvider).light();
                      setState(() => _manualLang = l);
                    },
                    child: Text(l.toUpperCase()),
                  ),
              ]),
              CommunityButton(
                selected: _anonymous,
                onTap: () => setState(() {
                  if (!_anonymous) _tagged = const [];
                  _anonymous = !_anonymous;
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: a.surface,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: a.cardShadow,
                    border: Border.all(color: _anonymous ? a.lav2 : const Color(0x00000000), width: 1.5),
                  ),
                  child: Row(children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(color: _anonymous ? a.lav1 : a.surfaceSoft, shape: BoxShape.circle),
                      alignment: Alignment.center,
                      child: AIcon(AIcons.eyeOff, size: 16, color: _anonymous ? a.lavInk : a.inkSoft),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('createpostscreen_anonim_paylas_6074c9', 'Anonim paylaş'), style: px(12.5, weight: FontWeight.w700, color: _anonymous ? a.lavInk : a.ink)),
                        Text(tr('createpostscreen_adiniz_ve_sekliniz_gizledilir_6fc767', 'Adınız və şəkliniz gizlədilir'), style: px(10.5, color: a.inkSoft)),
                      ]),
                    ),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 40,
                      height: 24,
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(color: _anonymous ? a.lav2 : a.lineStrong, borderRadius: BorderRadius.circular(999)),
                      alignment: _anonymous ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFFFFF),
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
