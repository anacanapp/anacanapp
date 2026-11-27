// Ported from: src/components/community/StoriesBar.tsx
//
// The stories row of the community feed (and of a group): own ring first ("Sizin" / "Əlavə et" with the plus
// badge), the other authors' rings (gradient while unviewed), the "Story Əlavə Et" sheet (gallery / camera), the
// editor, the upload, and the deep-link auto-open (`autoOpenStoryId`: refetch a stale list once, then open or give up).
import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialType, showGeneralDialog;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../chat/ui/chat_widgets.dart' show charAt0;
import '../../community/data/community_backend.dart';
import '../../community/data/community_env.dart' show communityUuidProvider;
import '../../community/moderation/moderator_widgets.dart' show RestrictionNote;
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../data/stories.dart';
import '../data/stories_backend.dart';
import '../data/story_media_picker.dart';
import '../editor/story_crop_editor.dart';
import 'story_viewer.dart';

/// `<StoryViewer storyGroups initialGroupIndex initialStoryId onClose … />` as opened by the bar (test seam, like
/// the vi.mock'ed StoryViewer of StoriesBar.open.test.tsx).
typedef StoriesBarViewerBuilder = Widget Function(
    BuildContext context, {required String? groupId, required List<UserStoryGroup> groups, required int initialGroupIndex, String? initialStoryId, required VoidCallback onClose});

final storiesBarViewerBuilderProvider = Provider<StoriesBarViewerBuilder>(
  (ref) => (context, {required groupId, required groups, required initialGroupIndex, initialStoryId, required onClose}) => LiveStoryViewer(
        groupId: groupId,
        initialGroups: groups,
        initialGroupIndex: initialGroupIndex,
        initialStoryId: initialStoryId,
        onClose: onClose,
      ),
);

/// How the bar presents the viewer and the editor (full-screen routes; tests may render them inline).
final storiesBarPresenterProvider = Provider<Future<void> Function(BuildContext context, WidgetBuilder builder)>((ref) => pushStoryViewer);

const String _bucket = 'community-media';

class StoriesBar extends ConsumerStatefulWidget {
  const StoriesBar({super.key, this.groupId, this.autoOpenStoryId, this.onAutoOpenConsumed});
  final String? groupId;
  final String? autoOpenStoryId;
  final VoidCallback? onAutoOpenConsumed;

  @override
  ConsumerState<StoriesBar> createState() => _StoriesBarState();
}

class _StoriesBarState extends ConsumerState<StoriesBar> {
  bool _viewerOpen = false;
  String? _refreshedStoryId;
  String? _consumedStoryId;
  Object? _effectSignature;

  StoryPickedFile? _selectedFile;
  String? _draftId;
  List<String> _uploadedPaths = [];
  bool _publishing = false;
  bool _uploading = false;
  bool _editorOpen = false;
  BuildContext? _editorContext;

  bool _overlayDismissed = false;
  bool _overlayEscapable = false;
  Timer? _overlayTimer;
  final OverlayPortalController _overlay = OverlayPortalController();

  @override
  void dispose() {
    _overlayTimer?.cancel();
    super.dispose();
  }

  // ── auto open (deep link / push) ──

  void _autoOpenEffect(StoriesView view) {
    final target = widget.autoOpenStoryId;
    if (target == null || target.isEmpty) {
      _refreshedStoryId = null;
      _consumedStoryId = null;
      return;
    }
    if (_consumedStoryId == target) return;
    final groups = view.storyGroups;
    final index = groups.indexWhere((g) => g.stories.any((s) => s['id'] == target));
    if (index >= 0) {
      _openViewer(groups, index, target);
    } else {
      if (view.isLoading || view.isFetching) return;
      if (_refreshedStoryId != target) {
        _refreshedStoryId = target;
        unawaited(view.refetch());
        return;
      }
    }
    _consumedStoryId = target;
    widget.onAutoOpenConsumed?.call();
  }

  void _openViewer(List<UserStoryGroup> groups, int index, [String? storyId]) {
    if (_viewerOpen) return;
    _viewerOpen = true;
    final present = ref.read(storiesBarPresenterProvider);
    final builder = ref.read(storiesBarViewerBuilderProvider);
    final client = ref.read(queryClientProvider);
    var closed = false;
    void close(BuildContext ctx) {
      if (closed) return;
      closed = true;
      Navigator.of(ctx).maybePop();
    }

    unawaited(present(
      context,
      (ctx) => builder(ctx, groupId: widget.groupId, groups: groups, initialGroupIndex: index, initialStoryId: storyId, onClose: () => close(ctx)),
    ).whenComplete(() {
      _viewerOpen = false;
      // markAsViewed does not refetch (the open viewer must not re-sort): the rings refresh once on close.
      unawaited(client.invalidateQueries(queryKey: const ['stories']));
    }));
  }

  // ── create ──

  bool get _restricted => ref.read(myModerationStatusQuery).data?['story'] == true;

  Future<void> _showCreateModal() async {
    final choice = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'close',
      barrierColor: const Color(0x66000000),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (ctx, _, _) => const _CreateSheet(),
      transitionBuilder: (ctx, animation, _, child) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
          child: child,
        ),
      ),
    );
    if (!mounted || choice == null) return;
    final picker = ref.read(storyMediaPickerProvider);
    StoryPickedFile? file;
    try {
      file = choice == 'camera' ? await picker.pickFromCamera() : await picker.pickFromGallery();
    } catch (_) {
      file = null;
    }
    if (!mounted) return;
    await _handleFileSelect(file);
  }

  Future<void> _handleFileSelect(StoryPickedFile? file) async {
    if (file == null || ref.read(authUserProvider) == null || _restricted) return;
    _draftId = ref.read(communityUuidProvider)();
    _uploadedPaths = [];
    _selectedFile = file;
    StoryEditorMedia media;
    try {
      media = file.isVideo ? StoryEditorMedia.video(file.path) : StoryEditorMedia.image(await file.read());
    } catch (_) {
      media = StoryEditorMedia.image(Uint8List(0));
    }
    if (!mounted) return;
    setState(() => _editorOpen = true);
    await pushStoryCropEditor(context, (ctx) {
      _editorContext = ctx;
      return StoryCropEditor(
        key: ValueKey(_draftId),
        media: media,
        onConfirm: _handleCropConfirm,
        onCancel: () => Navigator.of(ctx).pop(),
      );
    });
    _editorContext = null;
    if (!mounted) return;
    // handleCropCancel (closing without publishing keeps the draft id for a retry, like React).
    setState(() {
      _editorOpen = false;
      _selectedFile = null;
    });
  }

  Future<void> _handleCropConfirm(StoryEditorResult result) async {
    final user = ref.read(authUserProvider);
    final selected = _selectedFile;
    final storyId = _draftId;
    if (_restricted) throw const CommunityBackendError(message: 'MODERATOR_ACTIVITY_RESTRICTED');
    if (selected == null || user == null || storyId == null) throw const CommunityBackendError(message: 'STORY_DRAFT_MISSING');
    if (_publishing) throw const CommunityBackendError(message: 'STORY_UPLOAD_IN_PROGRESS');
    _publishing = true;
    final backend = ref.read(communityBackendProvider);
    final storage = ref.read(storyStorageProvider);
    final uuid = ref.read(communityUuidProvider);
    final paths = _uploadedPaths;
    final image = result.image;
    final mediaType = image != null ? 'image' : 'video';
    _setUploading(true);
    try {
      final String extension;
      final Uint8List bytes;
      final String contentType;
      if (image != null) {
        extension = image.extension;
        bytes = image.bytes;
        contentType = image.type;
      } else {
        final dot = selected.name.lastIndexOf('.');
        final ext = dot >= 0 ? selected.name.substring(dot + 1).replaceAll(RegExp('[^a-zA-Z0-9]'), '') : '';
        extension = ext.isNotEmpty ? ext : 'mp4';
        bytes = await selected.read();
        contentType = selected.type;
      }
      final fileName = '${user.id}/${uuid()}.$extension';
      final upload = await backend.upload(_bucket, fileName, bytes, contentType);
      if (!upload.ok) throw upload.error ?? const CommunityBackendError(message: 'STORY_UPLOAD_FAILED');
      paths.add(fileName);
      final url = backend.publicUrl(_bucket, fileName);
      await ref.read(createStoryMutation.notifier).mutateAsync(CreateStoryInput(
            mediaUrl: url,
            mediaType: mediaType,
            groupId: widget.groupId,
            storyId: storyId,
            backgroundColor: result.scene.background,
            editorLayout: mediaType == 'video' ? result.scene : null,
            hasEditorLayout: true,
            textOverlay: mediaType == 'video' ? result.scene.texts.map((t) => t.text).join('\n') : null,
          ));
      final obsolete = [for (final p in paths) if (p != fileName) p];
      if (obsolete.isNotEmpty) unawaited(storage.remove(_bucket, obsolete).catchError((Object _) {}));
      if (_draftId == storyId) {
        _selectedFile = null;
        _draftId = null;
        _uploadedPaths = [];
        final editor = _editorContext;
        if (editor != null && editor.mounted) Navigator.of(editor).pop();
      }
    } finally {
      _publishing = false;
      _setUploading(false);
    }
  }

  void _setUploading(bool value) {
    if (!mounted) return;
    setState(() => _uploading = value);
  }

  /// The 15 s escape hatch of the full-screen upload overlay.
  void _syncOverlay(bool visible) {
    if (!visible) {
      _overlayTimer?.cancel();
      _overlayTimer = null;
      _overlayDismissed = false;
      _overlayEscapable = false;
      return;
    }
    _overlayTimer ??= Timer(const Duration(seconds: 15), () {
      if (mounted) setState(() => _overlayEscapable = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(storiesProvider(widget.groupId));
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final restricted = ref.watch(myModerationStatusQuery).data?['story'] == true;
    final creating = ref.watch(createStoryMutation).isPending;
    final signature = (widget.autoOpenStoryId, view.stories, view.isLoading, view.isFetching);
    if (signature != _effectSignature) {
      _effectSignature = signature;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _autoOpenEffect(ref.read(storiesProvider(widget.groupId)));
      });
    }
    final overlayVisible = _uploading || creating;
    _syncOverlay(overlayVisible);
    final showOverlay = overlayVisible && !_editorOpen && !_overlayDismissed;
    if (showOverlay != _overlay.isShowing) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final still = (_uploading || ref.read(createStoryMutation).isPending) && !_editorOpen && !_overlayDismissed;
        if (still && !_overlay.isShowing) _overlay.show();
        if (!still && _overlay.isShowing) _overlay.hide();
      });
    }

    final groups = view.storyGroups;
    final ownGroup = groups.where((g) => g.userId == user?.id).firstOrNull;
    final hasOwn = ownGroup != null;
    final a = context.a;
    final ringGradient = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.peach2, a.pink2, a.lav2]);

    Widget ring({required bool active, required Widget child}) => Container(
          width: 62,
          height: 62,
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(shape: BoxShape.circle, gradient: active ? ringGradient : null, color: active ? null : a.lineStrong),
          child: Container(
            decoration: BoxDecoration(shape: BoxShape.circle, color: a.surface),
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            child: child,
          ),
        );

    Widget label(String text) => SizedBox(
          width: 62,
          child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: px(10, weight: FontWeight.w700, color: a.inkSoft, height: 1.25)),
        );

    Widget initial(String name) => ColoredBox(
          color: a.surfaceSoft,
          child: Center(child: Text(charAt0(name).toUpperCase(), style: px(16, weight: FontWeight.w900, color: a.accentInk, height: 1))),
        );

    final items = <Widget>[
      PressScale(
        scale: 0.92,
        onTap: () {
          if (hasOwn) {
            _openViewer(groups, 0);
          } else if (!restricted) {
            unawaited(_showCreateModal());
          }
        },
        child: Semantics(
          button: true,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(
              width: 62,
              height: 62,
              child: Stack(clipBehavior: Clip.none, children: [
                ring(
                  active: hasOwn,
                  child: hasOwn
                      ? ((profile?.avatarUrl ?? '').isNotEmpty
                          ? Image.network(profile!.avatarUrl!, width: 57, height: 57, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())
                          : Text(charAt0(profile?.name.isNotEmpty == true ? profile!.name : 'S').toUpperCase(),
                              style: px(16, weight: FontWeight.w900, color: a.accentInk, height: 1)))
                      : Container(
                          decoration: BoxDecoration(shape: BoxShape.circle, color: a.surfaceSoft),
                          alignment: Alignment.center,
                          child: AIcon(AIcons.plus, size: 20, color: a.peach2),
                        ),
                ),
                PositionedDirectional(
                  bottom: -2,
                  end: -2,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      if (!restricted) unawaited(_showCreateModal());
                    },
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: a.peach2,
                        border: Border.all(color: a.surface, width: 2),
                        boxShadow: const [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
                      ),
                      alignment: Alignment.center,
                      child: const AIcon(AIcons.plus, size: 10, color: Color(0xFFFFFFFF), strokeWidth: 3),
                    ),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 6),
            label(hasOwn ? tr('storiesbar_sizin', 'Sizin') : tr('storiesbar_elave_et_6e1b9b', 'Əlavə et')),
          ]),
        ),
      ),
      for (final group in groups)
        if (group.userId != user?.id)
          PressScale(
            key: ValueKey('story-ring:${group.userId}'),
            scale: 0.92,
            onTap: () => _openViewer(groups, groups.indexOf(group)),
            child: Semantics(
              button: true,
              label: group.userName,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                ring(
                  active: group.hasUnviewed,
                  child: group.userAvatar != null
                      ? Image.network(group.userAvatar!, width: 57, height: 57, fit: BoxFit.cover, errorBuilder: (_, _, _) => initial(group.userName))
                      : initial(group.userName),
                ),
                const SizedBox(height: 6),
                label(group.userName.split(' ').first),
              ]),
            ),
          ),
      if (view.isLoading)
        for (var i = 0; i < 3; i++)
          Column(mainAxisSize: MainAxisSize.min, children: [
            _Pulse(child: Container(width: 62, height: 62, decoration: BoxDecoration(shape: BoxShape.circle, color: a.surfaceSoft))),
            const SizedBox(height: 6),
            _Pulse(child: Container(width: 36, height: 8, decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: a.surfaceSoft))),
          ]),
    ];

    return OverlayPortal(
      overlayLocation: OverlayChildLocation.rootOverlay,
      controller: _overlay,
      overlayChildBuilder: (context) => _UploadOverlay(
        escapable: _overlayEscapable,
        onDismiss: () => setState(() {
          _overlayDismissed = true;
          _overlay.hide();
        }),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        const RestrictionNote(scope: 'story'),
        // `-mx-5 px-5`: the row bleeds to the screen edges.
        LayoutBuilder(
          builder: (context, constraints) => SizedBox(
            height: 97,
            child: OverflowBox(
              minWidth: constraints.maxWidth + 40,
              maxWidth: constraints.maxWidth + 40,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(width: 14), items[i]],
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `animate-pulse`.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!(MediaQuery.maybeDisableAnimationsOf(context) ?? false) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final t = _c.value;
          return Opacity(opacity: (t < 0.5 ? 1 - t : t).clamp(0.5, 1.0), child: child);
        },
        child: widget.child,
      );
}

/// "Story Əlavə Et": gallery / camera. Pops 'gallery' | 'camera'.
class _CreateSheet extends StatelessWidget {
  const _CreateSheet();

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final bottom = MediaQuery.paddingOf(context).bottom;
    Widget tile({required String value, required AIconData icon, required String label, required Color tint, required Color iconBg, required Color iconColor}) => PressScale(
          scale: 0.96,
          onTap: () => Navigator.of(context).pop(value),
          child: Semantics(
            button: true,
            label: label,
            excludeSemantics: true,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [tint.withValues(alpha: 0.05), tint.withValues(alpha: 0.03)]),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: tint.withValues(alpha: 0.08)),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: iconBg),
                  alignment: Alignment.center,
                  child: AIcon(icon, size: 20, color: iconColor),
                ),
                const SizedBox(height: 12),
                Text(label, style: px(12, weight: FontWeight.w700, color: s.foreground, height: 16 / 12)),
              ]),
            ),
          ),
        );

    const blue = Color(0xFF3B82F6); // blue-500
    return AScope(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Material(
          type: MaterialType.transparency,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.only(bottom: (bottom > 0 ? bottom : 16) + 90),
              decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Padding(
                  padding: const EdgeInsets.only(top: 12, bottom: 4),
                  child: Container(width: 36, height: 4, decoration: BoxDecoration(color: s.border.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(999))),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  child: Column(children: [
                    Row(children: [
                      Expanded(child: Text(tr('storiesbar_story_elave_et_21f0b9', 'Story Əlavə Et'), style: px(16, weight: FontWeight.w900, color: s.foreground))),
                      Semantics(
                        button: true,
                        label: tr('common_close', 'Bağla'),
                        excludeSemantics: true,
                        child: GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.4), shape: BoxShape.circle),
                            alignment: Alignment.center,
                            child: AIcon(AIcons.x, size: 16, color: s.mutedForeground.withValues(alpha: 0.6)),
                          ),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 20),
                    Row(children: [
                      Expanded(
                        child: tile(
                          value: 'gallery',
                          icon: AIcons.image,
                          label: tr('untranslated_qalereyadan_w37f0m', 'Qalereyadan'),
                          tint: s.primary,
                          iconBg: s.primary.withValues(alpha: 0.1),
                          iconColor: s.primary.withValues(alpha: 0.6),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: tile(
                          value: 'camera',
                          icon: AIcons.camera,
                          label: tr('untranslated_kamera_qucuxi', 'Kamera'),
                          tint: blue,
                          iconBg: blue.withValues(alpha: 0.08),
                          iconColor: blue.withValues(alpha: 0.6),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Story yüklənir..." (with "Bağla" after 15 s so a stuck upload never blocks the app).
class _UploadOverlay extends StatelessWidget {
  const _UploadOverlay({required this.escapable, required this.onDismiss});
  final bool escapable;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return AScope(
      child: ColoredBox(
        color: const Color(0x4D000000),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: s.card,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5)],
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              ALoader(size: 40, color: s.primary),
              const SizedBox(height: 12),
              Text(tr('storiesbar_story_yuklenir_a92632', 'Story yüklənir...'), style: px(12, weight: FontWeight.w700, color: s.foreground)),
              if (escapable) ...[
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: onDismiss,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(999)),
                    child: Text(tr('common_close', 'Bağla'), style: px(11, weight: FontWeight.w700, color: s.mutedForeground)),
                  ),
                ),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
