// Ported from: src/components/community/StoryViewer.tsx
//
// The full-screen community story viewer: progress bars and header at the top of the screen, a fixed 9:16 canvas
// (letterboxed), tap thirds / long-press pause / swipe navigation (mirrored in RTL), likes with a heart burst, replies
// and (own stories) viewers sheets, delete / moderator removal, video sound, and the `community_story_break` ad slot.
// The groups are frozen when the viewer opens; likes are read from the live list.
//
// Pausing: React paused for its own dialogs and the moderator menu (`onOpenChange`). Here the viewer is a route, so it
// pauses whenever another route (delete confirm, moderator menu / dialog) covers it, plus the moderator warning popup
// ([moderationOverlayOpenProvider]).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../chat/ui/chat_widgets.dart' show charAt0;
import '../../community/copy/community_copy.dart' show formatDistanceToNowSuffix;
import '../../community/data/community_env.dart' show randomUuidV4;
import '../../community/moderation/moderator_content.dart' show ModeratorTarget;
import '../../community/moderation/moderator_enforcement.dart' show moderationOverlayOpenProvider;
import '../../community/moderation/moderator_widgets.dart' show ModeratorActionMenu, RestrictionNote, showModeratorActionDialog;
import '../../community/ui/community_widgets.dart' show LucideFilled;
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, px, shadDescription, shadTitle, showShadDialog, ALoader;
import '../data/stories.dart';
import '../data/story_ads.dart';
import '../data/story_viewers.dart';
import '../editor/story_scene.dart';
import 'story_video_layout.dart';

/// `Date.now()` of the ad-break minimum screen time (replaceable in tests).
final storyViewerClockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

const Color _white = Color(0xFFFFFFFF);
const Color _red = Color(0xFFEF4444); // #ef4444 / red-500

class CommunityStoryViewer extends ConsumerStatefulWidget {
  const CommunityStoryViewer({
    super.key,
    required this.storyGroups,
    required this.initialGroupIndex,
    this.initialStoryId,
    required this.onClose,
    required this.onViewed,
    this.onDelete,
    this.onToggleLike,
    this.likePending = false,
  });

  /// The live groups (likes are read from here; navigation uses the snapshot taken at open).
  final List<UserStoryGroup> storyGroups;
  final int initialGroupIndex;

  /// Deep link: start at this story of the group (else its first story).
  final String? initialStoryId;
  final VoidCallback onClose;
  final void Function(String storyId) onViewed;
  final void Function(String storyId)? onDelete;
  final void Function(String storyId, bool isLiked)? onToggleLike;
  final bool likePending;

  /// The key of the shown story (`data-story-viewer`).
  static Key storyKey(String id) => ValueKey('story-viewer:$id');

  /// The heart burst (`data-story-like-animation`).
  static const Key likeAnimationKey = ValueKey('story-like-animation');

  @override
  ConsumerState<CommunityStoryViewer> createState() => CommunityStoryViewerState();
}

class CommunityStoryViewerState extends ConsumerState<CommunityStoryViewer> with TickerProviderStateMixin {
  late final List<UserStoryGroup> _groups = [
    for (final g in widget.storyGroups)
      UserStoryGroup(userId: g.userId, userName: g.userName, userAvatar: g.userAvatar, stories: List.of(g.stories), hasUnviewed: g.hasUnviewed),
  ];
  late int _groupIndex = widget.initialGroupIndex;
  late int _storyIndex = () {
    final id = widget.initialStoryId;
    if (id != null && widget.initialGroupIndex >= 0 && widget.initialGroupIndex < widget.storyGroups.length) {
      final idx = widget.storyGroups[widget.initialGroupIndex].stories.indexWhere((s) => s['id'] == id);
      if (idx >= 0) return idx;
    }
    return 0;
  }();

  bool _isPaused = false;
  bool _isMuted = true;
  bool _adTransitioning = false;
  bool _showViewers = false;
  bool _showReplies = false;
  bool _replyFocused = false;
  Duration _storyDuration = const Duration(milliseconds: 6000);
  late final AnimationController _progress = AnimationController(vsync: this, duration: _storyDuration)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) unawaited(_goToNextStory());
    });

  bool _advancing = false;
  bool _alive = true;
  DateTime _storyStartedAt = DateTime.now();
  final Set<String> _counted = {};
  final String _viewerSession = randomUuidV4();
  final Set<String> _viewed = {};
  String _navigationKey = '';

  ({String storyId, int id})? _likeBurst;
  int _likeSequence = 0;
  Timer? _likeBurstTimer;
  Timer? _longPress;
  bool _isLongPress = false;
  Offset? _downAt;

  final TextEditingController _reply = TextEditingController();
  final FocusNode _replyFocus = FocusNode();

  UserStoryGroup? get _currentGroup => _groupIndex >= 0 && _groupIndex < _groups.length ? _groups[_groupIndex] : null;
  StoryRow? get _currentStory {
    final g = _currentGroup;
    return g != null && _storyIndex >= 0 && _storyIndex < g.stories.length ? g.stories[_storyIndex] : null;
  }

  String? get _userId => ref.read(authUserProvider)?.id;
  bool get _isOwnStory => _currentStory?['user_id'] == _userId;

  @override
  void initState() {
    super.initState();
    _reply.addListener(() => setState(() {}));
    _replyFocus.addListener(() {
      // onFocus → pause, onBlur → resume.
      setState(() {
        _replyFocused = _replyFocus.hasFocus;
        _isPaused = _replyFocus.hasFocus;
      });
    });
    _storyStartedAt = ref.read(storyViewerClockProvider)();
    WidgetsBinding.instance.addPostFrameCallback((_) => _onStoryShown());
  }

  @override
  void dispose() {
    _alive = false;
    _likeBurstTimer?.cancel();
    _longPress?.cancel();
    _progress.dispose();
    _reply.dispose();
    _replyFocus.dispose();
    super.dispose();
  }

  /// Story change: mark viewed once, reset the progress (image 6 s; videos set theirs on metadata).
  void _onStoryShown() {
    if (!mounted) return;
    final story = _currentStory;
    if (story != null && story['is_viewed'] != true && !_isOwnStory && !_viewed.contains('${story['id']}')) {
      _viewed.add('${story['id']}');
      widget.onViewed('${story['id']}');
    }
  }

  void _restartProgress() => _progress.value = 0;

  void _changeStory(void Function() change) {
    setState(() {
      change();
      _likeBurst = null;
      _likeBurstTimer?.cancel();
      final story = _currentStory;
      if (story?['media_type'] != 'video') _storyDuration = const Duration(milliseconds: 6000);
      _progress.duration = _storyDuration;
      _restartProgress();
    });
    _storyStartedAt = ref.read(storyViewerClockProvider)();
    _onStoryShown();
  }

  void _advanceToNextStory() {
    final group = _currentGroup;
    if (group == null) return;
    if (_storyIndex < group.stories.length - 1) {
      _changeStory(() => _storyIndex++);
    } else if (_groupIndex < _groups.length - 1) {
      _changeStory(() {
        _groupIndex++;
        _storyIndex = 0;
      });
    } else {
      _progress.stop();
      widget.onClose();
    }
  }

  Future<void> _goToNextStory() async {
    final story = _currentStory;
    final group = _currentGroup;
    if (_advancing || story == null || group == null) return;
    _advancing = true;
    final key = '${story['id']}';
    try {
      final ads = ref.read(storyAdBreaksProvider);
      final hasNext = _storyIndex < group.stories.length - 1 || _groupIndex < _groups.length - 1;
      final minimum = storyBreakMinSeconds(ads);
      final shown = ref.read(storyViewerClockProvider)().difference(_storyStartedAt);
      if (hasNext && !_isOwnStory && !_counted.contains(key) && shown.inMilliseconds >= minimum * 1000) {
        _counted.add(key);
        if (ads.opportunity(kStoryBreakPlacement, '$_viewerSession:${_counted.length}')) {
          setState(() => _adTransitioning = true);
          await ads.showStory();
        }
      }
      if (_alive && mounted && _navigationKey == key) _advanceToNextStory();
    } finally {
      _advancing = false;
      if (_alive && mounted && _adTransitioning) setState(() => _adTransitioning = false);
    }
  }

  void _goToPrevStory() {
    if (_advancing) return;
    if (_storyIndex > 0) {
      _changeStory(() => _storyIndex--);
    } else if (_groupIndex > 0) {
      _changeStory(() {
        _groupIndex--;
        _storyIndex = _groups[_groupIndex].stories.length - 1;
      });
    } else {
      // First story of the first group: restart it (Instagram).
      setState(_restartProgress);
    }
  }

  // ── gestures ──

  void _onPointerDown(PointerDownEvent e) {
    _downAt = e.position;
    _isLongPress = false;
    _longPress?.cancel();
    _longPress = Timer(const Duration(milliseconds: 200), () {
      _isLongPress = true;
      if (mounted) setState(() => _isPaused = true);
    });
  }

  void _onPointerUp(PointerUpEvent e, double width, double left) {
    _longPress?.cancel();
    final down = _downAt;
    _downAt = null;
    if (_isLongPress) {
      setState(() => _isPaused = false);
      _isLongPress = false;
      return;
    }
    final rtl = Directionality.of(context) == TextDirection.rtl;
    if (down != null) {
      final dx = e.position.dx - down.dx;
      final dy = e.position.dy - down.dy;
      // Swipe down closes; a horizontal swipe navigates (drag end of framer-motion).
      if (dy.abs() > 100 && dy > 0) {
        widget.onClose();
        return;
      }
      if (dx > 80) {
        rtl ? unawaited(_goToNextStory()) : _goToPrevStory();
        return;
      }
      if (dx < -80) {
        rtl ? _goToPrevStory() : unawaited(_goToNextStory());
        return;
      }
      if (dx.abs() > 10 || dy.abs() > 10) return;
    }
    // Tap navigation, mirrored in RTL (the right side = previous).
    final x = e.position.dx - left;
    if (x < width / 3) {
      rtl ? unawaited(_goToNextStory()) : _goToPrevStory();
    } else if (x > width / 3) {
      rtl ? _goToPrevStory() : unawaited(_goToNextStory());
    }
  }

  // ── actions ──

  bool get _currentIsLiked {
    final live = _liveCurrentStory;
    return (live?['is_liked'] ?? _currentStory?['is_liked']) == true;
  }

  num get _currentLikesCount => (_liveCurrentStory?['likes_count'] ?? _currentStory?['likes_count'] ?? 0) as num;

  StoryRow? get _liveCurrentStory {
    final group = _currentGroup;
    final story = _currentStory;
    if (group == null || story == null) return null;
    for (final g in widget.storyGroups) {
      if (g.userId != group.userId) continue;
      for (final s in g.stories) {
        if (s['id'] == story['id']) return s;
      }
    }
    return null;
  }

  void _toggleLike() {
    final story = _currentStory;
    final toggle = widget.onToggleLike;
    if (story == null || toggle == null || widget.likePending || _isOwnStory) return;
    _likeBurstTimer?.cancel();
    final liked = _currentIsLiked;
    setState(() {
      if (!liked) {
        _likeBurst = (storyId: '${story['id']}', id: ++_likeSequence);
        _likeBurstTimer = Timer(const Duration(milliseconds: 900), () {
          if (mounted) setState(() => _likeBurst = null);
        });
      } else {
        _likeBurst = null;
      }
    });
    // The snapshot may be stale: the like state comes from the live cache.
    toggle('${story['id']}', liked);
  }

  void _sendReply() {
    final content = _reply.text.trim();
    final story = _currentStory;
    final restricted = ref.read(myModerationStatusQuery).data?['comment'] == true;
    if (content.isEmpty || story == null || restricted) return;
    ref.read(createStoryReplyMutation.notifier).mutate(StoryReplyInput(
          storyId: '${story['id']}',
          content: content,
          storyAuthorId: story['user_id'] as String?,
          replierName: ref.read(authProfileProvider)?.name,
        ));
    _reply.clear();
  }

  Future<void> _confirmDelete() async {
    final story = _currentStory;
    if (story == null) return;
    setState(() => _isPaused = true);
    final confirmed = await showShadDialog<bool>(
      context,
      builder: (ctx) => ShadDialogFrame(radius: 24, inset: 16, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('untranslated_story_silinsin_yil9td', 'Story silinsin?'), style: shadTitle(ctx)),
          const SizedBox(height: 8),
          Text(tr('storyviewer_bu_story_hemiselik_silinecek_b_577f00', 'Bu story həmişəlik silinəcək. Bu əməliyyat geri alına bilməz.'), style: shadDescription(ctx)),
        ]),
        Wrap(alignment: WrapAlignment.end, spacing: 8, runSpacing: 8, children: [
          ShadButton(variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(ctx).pop(false), child: Text(tr('storyviewer_legv_et_b5e49c', 'Ləğv et'))),
          ShadButton(background: _red, onPressed: () => Navigator.of(ctx).pop(true), child: Text(tr('untranslated_sil_zwa7lz', 'Sil'))),
        ]),
      ]),
    );
    if (!mounted) return;
    setState(() => _isPaused = false);
    final onDelete = widget.onDelete;
    if (confirmed == true && onDelete != null && _currentStory?['id'] == story['id']) {
      onDelete('${story['id']}');
      _advanceToNextStory();
    }
  }

  @override
  Widget build(BuildContext context) {
    final group = _currentGroup;
    final story = _currentStory;
    if (group == null || story == null) return const SizedBox.shrink();
    _navigationKey = '${story['id']}';
    final ads = ref.watch(storyAdBreaksProvider);
    final warningOpen = ref.watch(moderationOverlayOpenProvider);
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true);
    final paused = _isPaused || _adTransitioning || ads.busy || _showViewers || _showReplies || warningOpen || covered;
    if (paused) {
      if (_progress.isAnimating) _progress.stop();
    } else if (!_progress.isAnimating && _progress.value < 1) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_progress.isAnimating && _progress.value < 1 && !_isPausedNow()) unawaited(_progress.forward());
      });
    }
    final size = MediaQuery.sizeOf(context);
    final padding = MediaQuery.paddingOf(context);
    final canvasWidth = size.width < size.height * 9 / 16 ? size.width : size.height * 9 / 16;
    final canvasHeight = canvasWidth * 16 / 9;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final scene = parseStoryScene(story['editor_layout']);

    return PopScope(
      canPop: !_showViewers && !_showReplies,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        setState(() {
          _showViewers = false;
          _showReplies = false;
          _isPaused = false;
        });
      },
      child: AScope(
        child: Material(
          color: const Color(0xFF000000),
          child: Stack(children: [
            // `data-story-viewer={currentStory.id}`.
            SizedBox.shrink(key: CommunityStoryViewer.storyKey('${story['id']}')),
            // The 9:16 canvas, letterboxed.
            Center(
              child: SizedBox(
                width: canvasWidth,
                height: canvasHeight,
                child: ClipRect(
                  child: Stack(children: [
                    Positioned.fill(
                      child: LayoutBuilder(builder: (context, constraints) {
                        return Listener(
                          behavior: HitTestBehavior.opaque,
                          onPointerDown: _onPointerDown,
                          onPointerUp: (e) {
                            final box = context.findRenderObject() as RenderBox?;
                            final left = box?.localToGlobal(Offset.zero).dx ?? 0;
                            _onPointerUp(e, constraints.maxWidth, left);
                          },
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 150),
                            transitionBuilder: (child, animation) => FadeTransition(
                              opacity: animation,
                              child: ScaleTransition(scale: Tween<double>(begin: 1.02, end: 1).animate(animation), child: child),
                            ),
                            child: KeyedSubtree(
                              key: ValueKey('story-media:${story['id']}'),
                              child: _media(story, scene, paused),
                            ),
                          ),
                        );
                      }),
                    ),
                    if (_likeBurst?.storyId == story['id'])
                      Positioned.fill(child: IgnorePointer(child: _HeartBurst(key: CommunityStoryViewer.likeAnimationKey, id: _likeBurst!.id))),
                    // Gradient overlays for readability (h-32 / h-40, black/60).
                    const Positioned(
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 128,
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x99000000), Color(0x00000000)])),
                        ),
                      ),
                    ),
                    const Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 160,
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0x99000000), Color(0x00000000)])),
                        ),
                      ),
                    ),
                    if (scene == null && (story['text_overlay'] as String? ?? '').isNotEmpty)
                      PositionedDirectional(
                        start: 16,
                        end: 16,
                        bottom: 96,
                        child: IgnorePointer(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            decoration: BoxDecoration(color: const Color(0x66000000), borderRadius: BorderRadius.circular(16)),
                            child: Text(
                              story['text_overlay'] as String,
                              textAlign: TextAlign.center,
                              style: px(18, weight: FontWeight.w500, color: _white, height: 28 / 18).copyWith(
                                shadows: const [Shadow(color: Color(0x26000000), offset: Offset(0, 10), blurRadius: 8)],
                              ),
                            ),
                          ),
                        ),
                      ),
                    Positioned(left: 0, right: 0, bottom: 0, child: _bottomCluster(context, story, padding)),
                  ]),
                ),
              ),
            ),
            // Progress bars + header at the very top of the screen.
            Positioned(left: 0, right: 0, top: padding.top + 8, child: _header(context, group, story, rtl, paused)),
            if (_showViewers) Positioned.fill(child: _viewersSheet(context, story)),
            if (_showReplies) Positioned.fill(child: _repliesSheet(context, story)),
          ]),
        ),
      ),
    );
  }

  bool _isPausedNow() {
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true);
    return _isPaused || _adTransitioning || ref.read(storyAdBreaksProvider).busy || _showViewers || _showReplies || ref.read(moderationOverlayOpenProvider) || covered;
  }

  Widget _media(StoryRow story, StoryScene? scene, bool paused) {
    final background = story['background_color'] is String && (story['background_color'] as String).isNotEmpty
        ? _cssColor(story['background_color'] as String)
        : const Color(0xFF000000);
    final url = '${story['media_url'] ?? ''}';
    return ColoredBox(
      color: background,
      child: SizedBox.expand(
        child: story['media_type'] == 'video'
            ? StoryVideoLayout(
                key: ValueKey('video:${story['id']}'),
                src: url,
                layout: story['editor_layout'],
                muted: _isMuted,
                paused: paused,
                onDuration: (d) {
                  // A video story plays its real length (max 30 s).
                  if (d.isFinite && d > 0) {
                    final next = Duration(milliseconds: (d * 1000 < 30000 ? d * 1000 : 30000).round());
                    final elapsed = _progress.value * _storyDuration.inMilliseconds;
                    setState(() {
                      _storyDuration = next;
                      _progress.duration = next;
                      _progress.value = (elapsed / next.inMilliseconds).clamp(0, 1).toDouble();
                    });
                  }
                },
                onEnded: () => unawaited(_goToNextStory()),
              )
            : Image.network(url, fit: BoxFit.contain, semanticLabel: 'Story', errorBuilder: (_, _, _) => const SizedBox.shrink()),
      ),
    );
  }

  Widget _roundButton({required String label, required AIconData icon, required VoidCallback onTap, Widget? child}) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(color: Color(0x66000000), shape: BoxShape.circle),
            alignment: Alignment.center,
            child: child ?? AIcon(icon, size: 16, color: _white),
          ),
        ),
      );

  Widget _header(BuildContext context, UserStoryGroup group, StoryRow story, bool rtl, bool paused) {
    final isAdmin = ref.watch(isAdminProvider);
    final own = _isOwnStory;
    final created = DateTime.tryParse('${story['created_at']}');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      IgnorePointer(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            for (var index = 0; index < group.stories.length; index++) ...[
              if (index > 0) const SizedBox(width: 3),
              Expanded(
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(color: const Color(0x4DFFFFFF), borderRadius: BorderRadius.circular(999)),
                  clipBehavior: Clip.antiAlias,
                  child: index == _storyIndex
                      ? AnimatedBuilder(
                          animation: _progress,
                          builder: (context, _) => FractionallySizedBox(
                            alignment: rtl ? Alignment.centerRight : Alignment.centerLeft,
                            widthFactor: _progress.value,
                            child: const DecoratedBox(decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.all(Radius.circular(999)))),
                          ),
                        )
                      : FractionallySizedBox(
                          alignment: AlignmentDirectional.centerStart,
                          widthFactor: index < _storyIndex ? 1 : 0,
                          child: const DecoratedBox(decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.all(Radius.circular(999)))),
                        ),
                ),
              ),
            ],
          ]),
        ),
      ),
      const SizedBox(height: 12),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(children: [
          Expanded(
            child: IgnorePointer(
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xCCFFFFFF), width: 2)),
                  clipBehavior: Clip.antiAlias,
                  child: group.userAvatar != null
                      ? Image.network(group.userAvatar!, fit: BoxFit.cover, errorBuilder: (_, _, _) => _initialFallback(group.userName))
                      : _initialFallback(group.userName),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(group.userName, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w600, color: _white, height: 1.25)),
                    if (created != null) Text(formatDistanceToNowSuffix(created), style: px(11, color: const Color(0x80FFFFFF))),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(width: 6),
          ModeratorActionMenu(
            target: ModeratorTarget(
              kind: 'story',
              id: '${story['id']}',
              userId: '${story['user_id']}',
              name: group.userName,
              version: (story['moderation_version'] as num?)?.toInt() ?? 0,
              removed: story['moderation_removed_at'] != null,
            ),
            onDone: widget.onClose,
            iconSize: 16,
            minSize: 32,
          ),
          const SizedBox(width: 6),
          _roundButton(
            label: _isPaused ? groupTr('storyviewer_resume', 'Davam et') : groupTr('storyviewer_pause', 'Dayandır'),
            icon: _isPaused ? AIcons.play : AIcons.pause,
            onTap: () => setState(() => _isPaused = !_isPaused),
          ),
          if (story['media_type'] == 'video') ...[
            const SizedBox(width: 6),
            _roundButton(
              label: _isMuted ? groupTr('storyviewer_sesi_ac', 'Səsi aç') : groupTr('storyviewer_sesi_bagla', 'Səsi bağla'),
              icon: _isMuted ? AIcons.volumeX : AIcons.volume2,
              onTap: () => setState(() => _isMuted = !_isMuted),
            ),
          ],
          if ((own || isAdmin) && widget.onDelete != null) ...[
            const SizedBox(width: 6),
            _roundButton(
              label: groupTr('stories_story_sil', 'Story-ni sil'),
              icon: AIcons.trash2,
              onTap: () {
                if (isAdmin && !own) {
                  unawaited(showModeratorActionDialog(
                    context,
                    target: ModeratorTarget(kind: 'story', id: '${story['id']}', userId: '${story['user_id']}', name: group.userName),
                    action: 'remove',
                    onDone: widget.onClose,
                  ));
                } else {
                  unawaited(_confirmDelete());
                }
              },
            ),
          ],
          const SizedBox(width: 6),
          _roundButton(label: groupTr('common_close', 'Bağla'), icon: AIcons.x, onTap: widget.onClose),
        ]),
      ),
    ]);
  }

  Widget _initialFallback(String name) => DecoratedBox(
        // bg-gradient-to-br from-primary to-pink-500
        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [context.tokens.shadcn.primary, const Color(0xFFEC4899)])),
        child: Center(child: Text(charAt0(name).toUpperCase(), style: px(14, weight: FontWeight.w700, color: _white, height: 1))),
      );

  Widget _pill({required Widget child, required EdgeInsets padding}) => Container(
        padding: padding,
        decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(999)),
        child: child,
      );

  Widget _bottomCluster(BuildContext context, StoryRow story, EdgeInsets safe) {
    final own = _isOwnStory;
    final restricted = ref.watch(myModerationStatusQuery).data?['comment'] == true;
    final sending = ref.watch(createStoryReplyMutation).isPending;
    final replies = (story['replies_count'] as num?) ?? 0;
    final liked = _currentIsLiked;
    final hasText = _reply.text.trim().isNotEmpty;
    // pb-[calc(env(safe-area-inset-bottom,16px)+12px)]
    final double bottom = (safe.bottom > 0 ? safe.bottom : 16.0) + 12;
    final placeholder = groupTr('storyviewer_cavab_yaz', 'Cavab yaz...');
    return Listener(
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, 0, 12, bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (own) ...[
            PressScale(
              scale: 0.95,
              onTap: () => setState(() {
                _showViewers = true;
                _isPaused = true;
              }),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const AIcon(AIcons.chevronUp, size: 20, color: Color(0xB3FFFFFF)),
                const SizedBox(height: 4),
                _pill(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AIcon(AIcons.eye, size: 16, color: _white),
                    const SizedBox(width: 8),
                    Text('${story['view_count'] ?? 0} ${groupTr('storyviewer_baxis_d4da3e', 'baxış')}', style: px(14, weight: FontWeight.w500, color: _white, height: 20 / 14)),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 8),
          ],
          if (replies > 0) ...[
            PressScale(
              scale: 0.95,
              onTap: () => setState(() {
                _showReplies = true;
                _isPaused = true;
              }),
              child: _pill(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const AIcon(AIcons.messageCircle, size: 14, color: _white),
                  const SizedBox(width: 6),
                  Text('$replies ${groupTr('storyviewer_cavab_sayi', 'cavab')}', style: px(12, weight: FontWeight.w500, color: _white, height: 16 / 12)),
                ]),
              ),
            ),
            const SizedBox(height: 8),
          ],
          const RestrictionNote(scope: 'comment'),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 80),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0x33FFFFFF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _replyFocused ? const Color(0x66FFFFFF) : const Color(0x33FFFFFF)),
                ),
                child: TextField(
                  controller: _reply,
                  focusNode: _replyFocus,
                  enabled: !restricted && !sending,
                  minLines: 1,
                  maxLines: null,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _sendReply(),
                  cursorColor: _white,
                  style: px(14, color: _white, height: 1.35),
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: placeholder,
                    hintStyle: px(14, color: const Color(0x99FFFFFF), height: 1.35),
                  ),
                ),
              ),
            ),
            if (hasText) ...[
              const SizedBox(width: 8),
              Semantics(
                button: true,
                enabled: !sending && !restricted,
                label: groupTr('directmessagescreen_send', 'Göndər'),
                child: PressScale(
                  scale: 0.9,
                  enabled: !sending && !restricted,
                  onTap: _sendReply,
                  child: Opacity(
                    opacity: sending || restricted ? 0.5 : 1,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(color: _white, shape: BoxShape.circle),
                      alignment: Alignment.center,
                      child: const AIcon(AIcons.send, size: 16, color: Color(0xFF000000)),
                    ),
                  ),
                ),
              ),
            ],
            if (!own && widget.onToggleLike != null) ...[
              const SizedBox(width: 8),
              Semantics(
                button: true,
                enabled: !widget.likePending,
                toggled: liked,
                label: groupTr(liked ? 'story_unlike' : 'story_like'),
                excludeSemantics: true,
                child: PressScale(
                  scale: 1.25,
                  enabled: !widget.likePending,
                  onTap: _toggleLike,
                  child: Opacity(
                    opacity: widget.likePending ? 0.6 : 1,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle),
                      alignment: Alignment.center,
                      child: liked ? const LucideFilled('heart', size: 20, fill: _red) : const AIcon(AIcons.heart, size: 20, color: _white),
                    ),
                  ),
                ),
              ),
            ],
          ]),
        ]),
      ),
    );
  }

  void _closeSheets() => setState(() {
        _showViewers = false;
        _showReplies = false;
        _isPaused = false;
      });

  Widget _sheet(BuildContext context, {required AIconData icon, required String title, required Widget subtitle, required Widget body, bool flex = false}) {
    final s = context.tokens.shadcn;
    final size = MediaQuery.sizeOf(context);
    final safe = MediaQuery.paddingOf(context).bottom;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _closeSheets,
      child: ColoredBox(
        color: const Color(0x80000000),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 1, end: 0),
            duration: const Duration(milliseconds: 320),
            curve: Curves.easeOutCubic,
            builder: (context, t, child) => FractionalTranslation(translation: Offset(0, t), child: child),
            child: GestureDetector(
              onTap: () {},
              child: Container(
                constraints: BoxConstraints(maxHeight: size.height * 0.7),
                decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
                clipBehavior: Clip.antiAlias,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 8),
                    child: Center(
                      child: Container(width: 40, height: 4, decoration: BoxDecoration(color: s.mutedForeground.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(999))),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: s.border.withValues(alpha: 0.5)))),
                    child: Row(children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: AIcon(icon, size: 16, color: s.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(title, style: px(16, weight: FontWeight.w700, color: s.foreground)),
                          DefaultTextStyle.merge(style: px(12, color: s.mutedForeground, height: 16 / 12), child: subtitle),
                        ]),
                      ),
                      Semantics(
                        button: true,
                        label: groupTr('common_close', 'Bağla'),
                        excludeSemantics: true,
                        child: GestureDetector(
                          onTap: _closeSheets,
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                            alignment: Alignment.center,
                            child: AIcon(AIcons.x, size: 16, color: s.mutedForeground),
                          ),
                        ),
                      ),
                    ]),
                  ),
                  Flexible(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxHeight: flex ? double.infinity : size.height * 0.5),
                      child: SingleChildScrollView(
                        padding: EdgeInsets.only(bottom: (safe > 0 ? safe : 20) + 20),
                        child: body,
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sheetLoader(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Center(child: ALoader(size: 24, color: context.tokens.shadcn.primary)),
      );

  Widget _sheetEmpty(BuildContext context, AIconData icon, String text) {
    final s = context.tokens.shadcn;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(children: [
        AIcon(icon, size: 40, color: s.mutedForeground.withValues(alpha: 0.4)),
        const SizedBox(height: 12),
        Text(text, textAlign: TextAlign.center, style: px(14, color: s.mutedForeground, height: 20 / 14)),
      ]),
    );
  }

  Widget _avatar(BuildContext context, String? url, String name, double size, double fontSize) {
    final s = context.tokens.shadcn;
    final fallback = DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [s.primary.withValues(alpha: 0.3), const Color(0x4DEC4899)]),
      ),
      child: Center(child: Text(charAt0(name).toUpperCase(), style: px(fontSize, weight: FontWeight.w700, color: s.primary, height: 1))),
    );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      child: url != null && url.isNotEmpty ? Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback) : fallback,
    );
  }

  Widget _viewersSheet(BuildContext context, StoryRow story) {
    final s = context.tokens.shadcn;
    final query = ref.watch(storyViewersQuery(_isOwnStory && _showViewers ? '${story['id']}' : null));
    final viewers = query.data ?? const [];
    final likes = _currentLikesCount;
    return _sheet(
      context,
      icon: AIcons.eye,
      title: groupTr('storyviewer_baxislar_e938f5', 'Baxışlar'),
      subtitle: Row(children: [
        Text('${story['view_count'] ?? 0} ${groupTr('storyviewer_nefer_dbca98', 'nəfər')}'),
        if (likes > 0) ...[
          const SizedBox(width: 8),
          const LucideFilled('heart', size: 12, fill: _red),
          const SizedBox(width: 2),
          Text('$likes'),
        ],
      ]),
      body: query.isLoading
          ? _sheetLoader(context)
          : viewers.isEmpty
              ? _sheetEmpty(context, AIcons.eye, groupTr('storyviewer_hele_hec_kim_baxmayib_30427f', 'Hələ heç kim baxmayıb'))
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Column(children: [
                    for (final viewer in viewers)
                      Padding(
                        key: ValueKey('viewer:${viewer['user_id']}'),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(children: [
                          _avatar(context, viewer['avatar_url'] as String?, '${viewer['name']}', 40, 14),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Flexible(child: Text('${viewer['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w500, color: s.foreground, height: 20 / 14))),
                                if (viewer['has_liked'] == true) ...[const SizedBox(width: 6), const LucideFilled('heart', size: 14, fill: _red)],
                              ]),
                              if (DateTime.tryParse('${viewer['viewed_at']}') case final viewed?)
                                Text(formatDistanceToNowSuffix(viewed), style: px(11, color: s.mutedForeground)),
                            ]),
                          ),
                        ]),
                      ),
                  ]),
                ),
    );
  }

  Widget _repliesSheet(BuildContext context, StoryRow story) {
    final s = context.tokens.shadcn;
    final storyId = '${story['id']}';
    final query = ref.watch(storyRepliesQuery((storyId: _showReplies ? storyId : null, enabled: _showReplies)));
    final replies = query.data ?? const [];
    final userId = ref.watch(authUserProvider)?.id;
    final isAdmin = ref.watch(isAdminProvider);
    return _sheet(
      context,
      flex: true,
      icon: AIcons.messageCircle,
      title: groupTr('storyviewer_cavablar_basliq', 'Cavablar'),
      subtitle: Text('${story['replies_count'] ?? 0} ${groupTr('storyviewer_nefer_dbca98', 'nəfər')}'),
      body: query.isLoading
          ? _sheetLoader(context)
          : replies.isEmpty
              ? _sheetEmpty(context, AIcons.messageCircle, groupTr('storyviewer_hele_cavab_yoxdur', 'Hələ heç kim cavab verməyib'))
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Column(children: [
                    for (final reply in replies)
                      () {
                        final author = reply['author'] is Map ? reply['author'] as Map : const {};
                        final name = author['name'] as String?;
                        final created = DateTime.tryParse('${reply['created_at']}');
                        return Padding(
                          key: ValueKey('reply:${reply['id']}'),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            _avatar(context, author['avatar_url'] as String?, name ?? '?', 36, 12),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text.rich(
                                  TextSpan(children: [
                                    TextSpan(text: name ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                    const TextSpan(text: ' '),
                                    TextSpan(text: '${reply['content'] ?? ''}', style: TextStyle(color: s.foreground.withValues(alpha: 0.9))),
                                  ]),
                                  style: px(14, color: s.foreground, height: 20 / 14),
                                ),
                                if (created != null) ...[
                                  const SizedBox(height: 2),
                                  Text(formatDistanceToNowSuffix(created), style: px(11, color: s.mutedForeground)),
                                ],
                              ]),
                            ),
                            if (reply['user_id'] == userId || isAdmin)
                              Semantics(
                                button: true,
                                label: tr('untranslated_sil_zwa7lz', 'Sil'),
                                excludeSemantics: true,
                                child: GestureDetector(
                                  behavior: HitTestBehavior.opaque,
                                  onTap: () => ref.read(deleteStoryReplyMutation.notifier).mutate((replyId: '${reply['id']}', storyId: storyId)),
                                  child: SizedBox(width: 28, height: 28, child: Center(child: AIcon(AIcons.trash2, size: 14, color: s.mutedForeground))),
                                ),
                              ),
                          ]),
                        );
                      }(),
                  ]),
                ),
    );
  }
}

/// `#rgb` / `#rrggbb` / `#rrggbbaa` CSS colours of `background_color` (other values → black).
Color _cssColor(String value) {
  var hex = value.trim();
  if (!hex.startsWith('#')) return const Color(0xFF000000);
  hex = hex.substring(1);
  if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
  if (hex.length == 6) return Color(int.tryParse('FF$hex', radix: 16) ?? 0xFF000000);
  if (hex.length == 8) {
    final rgba = int.tryParse(hex, radix: 16);
    if (rgba == null) return const Color(0xFF000000);
    return Color(((rgba & 0xFF) << 24) | (rgba >> 8));
  }
  return const Color(0xFF000000);
}

/// The heart burst: opacity 0 → 1 → 1 → 0, scale .45 → 1.12 → 1 → .94 over 850 ms (no scale under reduced motion).
class _HeartBurst extends StatefulWidget {
  const _HeartBurst({super.key, required this.id});
  final int id;
  @override
  State<_HeartBurst> createState() => _HeartBurstState();
}

class _HeartBurstState extends State<_HeartBurst> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 850))..forward();

  @override
  void didUpdateWidget(_HeartBurst old) {
    super.didUpdateWidget(old);
    if (old.id != widget.id) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  static double _keyframes(double t, List<double> values) {
    const times = [0.0, 0.22, 0.66, 1.0];
    for (var i = 1; i < times.length; i++) {
      if (t <= times[i]) {
        final local = (t - times[i - 1]) / (times[i] - times[i - 1]);
        return values[i - 1] + (values[i] - values[i - 1]) * Curves.easeInOut.transform(local.clamp(0, 1));
      }
    }
    return values.last;
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Opacity(
        opacity: _keyframes(_c.value, const [0, 1, 1, 0]).clamp(0, 1),
        child: Transform.scale(scale: reduced ? 1 : _keyframes(_c.value, const [0.45, 1.12, 1, 0.94]), child: child),
      ),
      child: const Center(
        child: DecoratedBox(
          decoration: BoxDecoration(boxShadow: [BoxShadow(color: Color(0x26000000), blurRadius: 13, offset: Offset(0, 20))]),
          child: LucideFilled('heart', size: 96, fill: _white, strokeWidth: 1.5),
        ),
      ),
    );
  }
}

/// Opens the viewer as a full-screen route over everything (React portals it to `body`, z-300).
Future<void> pushStoryViewer(BuildContext context, WidgetBuilder builder) => Navigator.of(context, rootNavigator: true).push<void>(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: null,
        transitionDuration: const Duration(milliseconds: 200),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (ctx, _, _) => builder(ctx),
        transitionsBuilder: (ctx, animation, _, child) => FadeTransition(opacity: animation, child: child),
      ),
    );

/// The viewer bound to the live `useStories(groupId)` data (likes, delete, views), optionally only [onlyUserId]'s
/// group (UserProfileScreen passes `[storyGroup]`).
class LiveStoryViewer extends ConsumerWidget {
  const LiveStoryViewer({
    super.key,
    required this.groupId,
    required this.initialGroupIndex,
    this.initialStoryId,
    this.onlyUserId,
    required this.initialGroups,
    required this.onClose,
  });
  final String? groupId;
  final int initialGroupIndex;
  final String? initialStoryId;
  final String? onlyUserId;
  final List<UserStoryGroup> initialGroups;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(storiesProvider(groupId));
    var groups = view.storyGroups;
    if (onlyUserId != null) groups = [for (final g in groups) if (g.userId == onlyUserId) g];
    if (groups.isEmpty && view.stories.isEmpty) groups = initialGroups;
    final like = ref.watch(toggleStoryLikeMutation);
    ref.watch(deleteStoryMutation);
    final markViewed = ref.watch(markStoryViewedProvider);
    return CommunityStoryViewer(
      storyGroups: groups,
      initialGroupIndex: initialGroupIndex,
      initialStoryId: initialStoryId,
      onClose: onClose,
      onViewed: (id) => unawaited(markViewed(id)),
      onDelete: (id) => ref.read(deleteStoryMutation.notifier).mutate(id),
      likePending: like.isPending,
      onToggleLike: (storyId, isLiked) => ref.read(toggleStoryLikeMutation.notifier).mutate((storyId: storyId, isLiked: isLiked)),
    );
  }
}
