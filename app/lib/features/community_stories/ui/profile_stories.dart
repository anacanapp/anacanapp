// Ported from: src/components/community/UserProfileScreen.tsx (the "Hekayələr" tab: `useStories(null)`, the 3-column
//              9:16 grid, StoryViewer over `[storyGroup]`)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../../core/i18n/i18n.dart';
import '../../chat/copy/chat_copy.dart' show formatDistanceToNow;
import '../../community/ui/community_widgets.dart' show ASkeleton;
import '../../community/ui/user_profile_screen.dart' show ProfileStoriesEmpty;
import '../../settings/ui/settings_ui.dart' show px;
import '../data/stories.dart';
import 'stories_bar.dart' show storiesBarPresenterProvider;
import 'story_viewer.dart';

class ProfileStories extends ConsumerStatefulWidget {
  const ProfileStories({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<ProfileStories> createState() => _ProfileStoriesState();
}

class _ProfileStoriesState extends ConsumerState<ProfileStories> {
  BuildContext? _viewerContext;

  void _open(String storyId, UserStoryGroup group) {
    if (_viewerContext != null) return;
    final present = ref.read(storiesBarPresenterProvider);
    unawaited(present(context, (ctx) {
      _viewerContext = ctx;
      return LiveStoryViewer(
        groupId: null,
        onlyUserId: widget.userId,
        initialGroups: [group],
        initialGroupIndex: 0,
        initialStoryId: storyId,
        onClose: () => Navigator.of(ctx).maybePop(),
      );
    }).whenComplete(() => _viewerContext = null));
  }

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(storiesProvider(null));
    final group = view.storyGroups.where((g) => g.userId == widget.userId).firstOrNull;
    // `if (!storyGroup) setOpenStoryId(null)`: the viewer closes when the author has no story left.
    if (group == null && _viewerContext != null) {
      final viewer = _viewerContext!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (viewer.mounted) Navigator.of(viewer).maybePop();
      });
    }
    if (view.isLoading) return const ASkeleton(height: 160, radius: 16);
    if (group == null || group.stories.isEmpty) return const ProfileStoriesEmpty();
    return LayoutBuilder(builder: (context, constraints) {
      final cell = (constraints.maxWidth - 16) / 3;
      return Wrap(spacing: 8, runSpacing: 8, children: [
        for (final story in group.stories)
          SizedBox(
            key: ValueKey('profile-story:${story['id']}'),
            width: cell,
            height: cell * 16 / 9,
            child: Semantics(
              button: true,
              label: tr('community_open_story', 'Hekayəni aç'),
              child: GestureDetector(
                onTap: () => _open('${story['id']}', group),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(fit: StackFit.expand, children: [
                    story['media_type'] == 'video'
                        ? _VideoPoster(url: '${story['media_url']}')
                        : Image.network('${story['media_url']}', fit: BoxFit.cover, errorBuilder: (_, _, _) => const ColoredBox(color: Color(0xFF000000))),
                    if (DateTime.tryParse('${story['created_at']}') case final created?)
                      PositionedDirectional(
                        start: 8,
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(999)),
                          child: Text(formatDistanceToNow(created), style: px(12, color: const Color(0xFFFFFFFF), height: 16 / 12)),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
          ),
      ]);
    });
  }
}

/// `<video muted playsInline preload="metadata">`: the first frame, paused.
class _VideoPoster extends StatefulWidget {
  const _VideoPoster({required this.url});
  final String url;
  @override
  State<_VideoPoster> createState() => _VideoPosterState();
}

class _VideoPosterState extends State<_VideoPoster> {
  VideoPlayerController? _c;

  @override
  void initState() {
    super.initState();
    final c = _c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    unawaited(c.initialize().then((_) async {
      await c.setVolume(0);
      if (mounted) setState(() {});
    }, onError: (Object _) {}));
  }

  @override
  void dispose() {
    unawaited(_c?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    if (c == null || !c.value.isInitialized) return const ColoredBox(color: Color(0xFF000000));
    return FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: c.value.size.width, height: c.value.size.height, child: VideoPlayer(c)));
  }
}

/// [communityProfileStoriesProvider] value.
Widget buildProfileStories(BuildContext context, String userId) => ProfileStories(key: ValueKey('profile-stories:$userId'), userId: userId);
