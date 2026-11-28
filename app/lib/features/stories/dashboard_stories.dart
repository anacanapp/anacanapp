// Ported from: src/components/stories/DashboardStories.tsx (story row on the dashboard), src/hooks/useServerStories.ts,
//              src/components/stories/illustrations.ts (via the generated templates), src/components/stories/stories.css
//              (.as-row-wrap, .as-row, .as-ring, .as-ring-o, .as-ring-i, .as-ring-t)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/cache/cache.dart';
import '../../core/i18n/tr.dart' show trInline;
import '../../design/design.dart';
import '../../domain/cycle/cycle_utils.dart' show getCycleDayForDate;
import '../../domain/models/anacan.dart' show fruitSizes;
import '../../state/persisted_store.dart' show localStoreProvider;
import '../../state/user_store.dart';
import '../home/data/home_repository.dart';
import '../home/data/pregnancy_content.dart';
import '../home/home_inputs.dart';
import 'data/story_illustrations.g.dart';
import 'stories.dart';
import 'story_viewer.dart';

String _hex(Color c) {
  final v = c.toARGB32() & 0xFFFFFF;
  return '#${v.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

/// `illustration(name, c, a)` as SVG markup (unknown names draw `blob`).
String storyIllustration(String? name, Color c, Color a) =>
    (illustrationTemplates[name] ?? illustrationTemplates['blob']!).replaceAll(illustrationPop, _hex(c)).replaceAll(illustrationAccent, _hex(a));

/// Our own static SVG (`<Art>`); never user content.
class StoryArt extends StatelessWidget {
  const StoryArt({super.key, required this.name, required this.c, required this.a, this.width});
  final String? name;
  final Color c;
  final Color a;
  final double? width;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SvgPicture.string(storyIllustration(name, c, a), width: width, fit: BoxFit.fitWidth),
  );
}

/// `useServerStories(language, enabled)` — key `['app-stories', language]`, 10 min stale, retry 1, device cache.
final serverStoriesQuery = queryProviderFamily<List<Object?>?, (String, bool)>((ref, arg) {
  final (language, enabled) = arg;
  final store = ref.watch(localStoreProvider);
  return QueryOptions<List<Object?>?>(
    queryKey: ['app-stories', language],
    enabled: enabled,
    staleTime: const Duration(minutes: 10),
    gcTime: const Duration(minutes: 60),
    retry: retryTimes(1),
    initialData: readStoriesCache(store, language),
    initialDataUpdatedAt: 0,
    queryFn: (_) async {
      try {
        final rows = await ref.read(homeRepositoryProvider).appStories(language);
        writeStoriesCache(store, language, rows);
        return rows;
      } catch (e) {
        final cached = readStoriesCache(store, language);
        if (cached != null) return cached;
        rethrow;
      }
    },
  );
});

int? _monthsSince(String? iso, DateTime now) {
  if (iso == null || iso.isEmpty) return null;
  final b = DateTime.tryParse(iso);
  if (b == null || b.isAfter(now)) return null;
  final local = b.toLocal();
  var m = (now.year - local.year) * 12 + (now.month - local.month);
  if (now.day < local.day) m -= 1;
  return m < 0 ? 0 : m;
}

/// Instagram-style story row (Azerbaijani; `app_settings.dashboard_stories` off / admin / on). Only stories that
/// fit this user right now are shown; unseen ones first.
class DashboardStories extends ConsumerStatefulWidget {
  const DashboardStories({super.key, required this.stage, this.now});
  final String stage;
  final DateTime Function()? now;

  @override
  ConsumerState<DashboardStories> createState() => _DashboardStoriesState();
}

class _DashboardStoriesState extends ConsumerState<DashboardStories> {
  Set<String>? _seen;
  String? _seenUid;

  void _markSeen(String uid, String id) {
    final seen = _seen ?? <String>{};
    if (seen.contains(id)) return;
    final next = {...seen, id};
    writeSeen(ref.read(localStoreProvider), uid, next);
    setState(() => _seen = next);
  }

  @override
  Widget build(BuildContext context) {
    final now = (widget.now ?? DateTime.now)();
    final uid = ref.watch(homeUserIdProvider) ?? '';
    final isAdmin = ref.watch(homeIsAdminProvider);
    final setting = ref.watch(homeAppSettingProvider('dashboard_stories'));
    final user = ref.watch(userStoreProvider);
    final isPremium = ref.watch(homeIsPremiumProvider);
    final child = ref.watch(homeSelectedChildProvider);
    final cycleLength = ref.watch(homeEffectiveCycleLengthProvider);
    final enabled = storiesEnabledFor(setting, isAdmin: isAdmin, language: user.language, role: user.role);
    final serverRows = ref.watch(serverStoriesQuery(('az', enabled))).data;
    final server = enabled && serverRows != null ? parseServerStories(serverRows) : null;
    final tables = StoryTables.az;
    final all = mergeStories(tables.stories, server);

    final stage = widget.stage;
    final preg = stage == 'bump' ? user.getPregnancyData() : null;
    final week = preg?.currentWeek;
    final pregnancyDay = preg != null ? PregnancyDayNavigation.of(preg.lastPeriodDate).actualCurrentDay : null;
    final dayContent = ref.watch(pregnancyContentByDayQuery(stage == 'bump' ? pregnancyDay : null)).data;
    ({String name, num lengthCm, num weightG})? fruit;
    if (week != null && week != 0) {
      final sizes = fruitSizes();
      final keys = sizes.keys.where((k) => k <= week).toList()..sort();
      final st = keys.isEmpty ? null : sizes[keys.last];
      final dcName = dayContent?['baby_size_fruit'];
      final name = dcName is String && dcName.isNotEmpty ? dcName : st?.fruit;
      if (name != null) {
        final dl = dayContent?['baby_size_cm'], dw = dayContent?['baby_weight_gram'];
        fruit = (name: name, lengthCm: dl is num ? dl : (st?.lengthCm ?? 0), weightG: dw is num ? dw : (st?.weightG ?? 0));
      }
    }
    final babyMonths = stage == 'mommy' ? _monthsSince(child?['birth_date'] as String?, now) : null;
    final lmp = user.lastPeriodDate;
    final cycleDay = stage == 'flow' && lmp != null ? getCycleDayForDate(now, lmp, cycleLength ?? 28) : null;
    final ctx = StoryContext(
      stage: stage,
      week: week,
      fruit: fruit,
      babyMonths: babyMonths,
      babyName: child?['name'] as String?,
      cycleDay: cycleDay,
      isPremium: isPremium,
    );
    final vars = storyVars(ctx, tables);

    if (_seenUid != uid) {
      _seenUid = uid;
      _seen = readSeen(ref.read(localStoreProvider), uid);
    }
    final seen = _seen!;

    if (!enabled) return const SizedBox.shrink();
    final fit = all.where((s) => storyMatches(s, ctx, vars)).toList();
    final list = [...fit.where((s) => !seen.contains(s['id'])), ...fit.where((s) => seen.contains(s['id']))];
    if (list.isEmpty) return const SizedBox.shrink();

    void open(int index) {
      // Order is fixed while the viewer is open so "next story" does not jump when one is marked seen.
      final frozen = List<Story>.of(list);
      final nav = ref.read(homeNavigationProvider);
      unawaited(
        Navigator.of(context, rootNavigator: true).push<void>(
          PageRouteBuilder<void>(
            opaque: true,
            transitionDuration: const Duration(milliseconds: 180),
            pageBuilder: (ctx, a1, a2) => StoryViewer(
              stories: frozen,
              startIndex: index,
              vars: vars,
              onClose: () => Navigator.of(ctx).maybePop(),
              onSeen: (id) => _markSeen(uid, id),
              onCta: (story, slide) {
                final cta = slide['cta'] as Map?;
                if (cta == null) return;
                _markSeen(uid, story['id'] as String);
                Navigator.of(ctx).maybePop();
                final n = (cta['nav'] as Map?) ?? const {};
                Timer(const Duration(milliseconds: 60), () {
                  if (n['tool'] != null) {
                    nav.pushIntent(tool: n['tool'] as String);
                  } else if (n['tab'] != null) {
                    nav.pushIntent(tab: n['tab'] as String);
                  } else {
                    nav.pushIntent(screen: n['screen'] as String?);
                  }
                });
              },
            ),
            // `as-in .18s ease-out`: opacity 0 → 1, scale .98 → 1.
            transitionsBuilder: (ctx, a, _, child) => FadeTransition(
              opacity: CurvedAnimation(parent: a, curve: ACurves.cssEaseOut),
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.98, end: 1).animate(CurvedAnimation(parent: a, curve: ACurves.cssEaseOut)),
                child: child,
              ),
            ),
          ),
        ),
      );
    }

    final t = context.a;
    return Semantics(
      label: trInline('DashboardStories.tsx', 'Story-lər'),
      container: true,
      child: Padding(
        key: const ValueKey('dashboard-stories'),
        padding: const EdgeInsets.only(top: 2, bottom: 10),
        child: SizedBox(
          height: 4 + 68 + 5 + 11 * 1.15 * 2 + 6 + 2,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(2, 4, 2, 6),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final s = list[i];
              final th = storyThemeOf(s);
              final isSeen = seen.contains(s['id']);
              final title = fillStory(s['title'] as String?, vars);
              return Semantics(
                button: true,
                label: '$title${isSeen ? '' : ', yeni'}',
                child: GestureDetector(
                  key: ValueKey('story-ring-${s['id']}'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => open(i),
                  child: SizedBox(
                    width: 72,
                    child: Column(
                      children: [
                        PressScale.css(
                          scale: 0.94,
                          child: Container(
                            width: 68,
                            height: 68,
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSeen ? t.line : null,
                              gradient: isSeen
                                  ? null
                                  : const SweepGradient(
                                      colors: [Color(0xFFFF5A5F), Color(0xFFFFB37A), Color(0xFFFFD84D), Color(0xFFFF5A5F)],
                                      transform: GradientRotation((210 - 90) * 3.141592653589793 / 180),
                                    ),
                            ),
                            child: Container(
                              clipBehavior: Clip.antiAlias,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: th.bg,
                                border: Border.all(color: t.bg, width: 3),
                              ),
                              child: LayoutBuilder(
                                builder: (context, c) {
                                  final w = c.maxWidth;
                                  return OverflowBox(
                                    alignment: Alignment.topLeft,
                                    maxWidth: w * 1.25,
                                    minWidth: w * 1.25,
                                    child: Transform.translate(
                                      offset: Offset(-w * 0.125, w * 0.14),
                                      child: StoryArt(
                                        name: s['illus'] as String?,
                                        c: th.pop,
                                        a: th.light ? th.ink : const Color(0xFFFFFFFF),
                                        width: w * 1.25,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 5),
                        Opacity(
                          opacity: isSeen ? 0.7 : 1,
                          child: Text(
                            title,
                            maxLines: 2,
                            overflow: TextOverflow.clip,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, height: 1.15, color: t.inkSoft),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
