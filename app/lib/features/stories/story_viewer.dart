// Ported from: src/components/stories/StoryViewer.tsx (full-screen viewer: progress bars, tap / swipe / hold, quiz,
//              CTA, templates cover/fact/list/myth/quiz/alert/quote/cta), src/components/stories/stories.css (.as-*)
//
// Not ported: "Yüklə" renders through [storyExporterProvider] (src/lib/story-export.ts canvas renderer lands with
// the share feature); the brand mascot on cover slides (OnboardingCompanion images) falls back to the slide art.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../../shell/shell.dart' show OverlayBackHandler;
import 'dashboard_stories.dart' show StoryArt;
import 'stories.dart';

const Duration storySlideDuration = Duration(milliseconds: 6500);

/// Saves the current slide as an image and opens the share sheet. Default: unsupported (shows "Alınmadı").
typedef StoryExporter = Future<void> Function(Story story, int slide, Map<String, String> vars);

final storyExporterProvider = Provider<StoryExporter>(
  (ref) =>
      (story, slide, vars) async => throw UnsupportedError('story export'),
);

/// `analytics.logToolUsed('stories', action, id)` (analytics feature). Default: no-op.
final storyEventLoggerProvider = Provider<void Function(String action, String storyId)>((ref) => (_, _) {});

const String _crownSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>';

class StoryViewer extends ConsumerStatefulWidget {
  const StoryViewer({
    super.key,
    required this.stories,
    required this.startIndex,
    required this.vars,
    required this.onClose,
    required this.onSeen,
    required this.onCta,
  });
  final List<Story> stories;
  final int startIndex;
  final Map<String, String> vars;
  final VoidCallback onClose;
  final void Function(String id) onSeen;
  final void Function(Story story, StorySlide slide) onCta;

  @override
  ConsumerState<StoryViewer> createState() => StoryViewerState();
}

class StoryViewerState extends ConsumerState<StoryViewer> with SingleTickerProviderStateMixin {
  late int _si = widget.startIndex;
  int _slide = 0;
  int? _answer;
  String _saving = 'idle';
  final Set<String> _holds = {};
  late final AnimationController _bar = AnimationController(vsync: this, duration: storySlideDuration)
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) next();
    });
  Duration _lastNav = Duration.zero;
  final Stopwatch _clock = Stopwatch()..start();
  Offset? _downAt;
  Duration? _downTime;
  Timer? _quizTimer;

  Story? get _story => _si < widget.stories.length ? widget.stories[_si] : null;
  List<StorySlide> get _slides => [for (final s in (_story?['slides'] as List? ?? const [])) Map<String, dynamic>.from(s as Map)];

  void _log(String action) {
    final id = _story?['id'];
    if (id is String) ref.read(storyEventLoggerProvider)(action, id);
  }

  @override
  void initState() {
    super.initState();
    _log('story_open');
    _restartBar();
  }

  @override
  void dispose() {
    _quizTimer?.cancel();
    _bar.dispose();
    super.dispose();
  }

  void _restartBar() {
    _bar.value = 0;
    if (_holds.isEmpty) _bar.forward();
  }

  void _setPaused(String reason, bool on) {
    if (on) {
      _holds.add(reason);
    } else {
      _holds.remove(reason);
    }
    if (_holds.isNotEmpty) {
      _bar.stop();
    } else if (!_bar.isAnimating && _bar.value < 1) {
      _bar.forward();
    }
  }

  void _resetSlideState() {
    _answer = null;
    _saving = 'idle';
    _holds
      ..remove('hold')
      ..remove('quiz');
    _quizTimer?.cancel();
  }

  bool _navAllowed() {
    final now = _clock.elapsed;
    if (now - _lastNav < const Duration(milliseconds: 300) && _lastNav != Duration.zero) return false;
    _lastNav = now;
    return true;
  }

  /// Next slide, next story, or close.
  void next() {
    final story = _story;
    if (story == null) return;
    if (_slide < _slides.length - 1) {
      setState(() {
        _slide++;
        _resetSlideState();
      });
      _restartBar();
      return;
    }
    widget.onSeen(story['id'] as String);
    _log('story_complete');
    if (_si < widget.stories.length - 1) {
      setState(() {
        _si++;
        _slide = 0;
        _resetSlideState();
      });
      _log('story_open');
      _restartBar();
    } else {
      _bar.stop();
      widget.onClose();
    }
  }

  void prev() {
    setState(() {
      if (_slide > 0) {
        _slide--;
      } else if (_si > 0) {
        _si--;
        _slide = 0;
      }
      _resetSlideState();
    });
    _restartBar();
  }

  Future<void> _save() async {
    final story = _story;
    if (story == null || _saving == 'busy') return;
    _setPaused('save', true);
    setState(() => _saving = 'busy');
    _log('story_download');
    try {
      await ref.read(storyExporterProvider)(story, _slide, widget.vars);
      if (mounted) setState(() => _saving = 'done');
    } catch (_) {
      if (mounted) setState(() => _saving = 'error');
    } finally {
      if (mounted) _setPaused('save', false);
    }
  }

  void _onDown(PointerDownEvent e) {
    _downAt = e.position;
    _downTime = _clock.elapsed;
    _setPaused('hold', true);
  }

  void _onUp(PointerUpEvent e, double width) {
    final d = _downAt;
    final dt = _downTime;
    _downAt = null;
    if (d == null || dt == null) return;
    _setPaused('hold', false);
    final dy = e.position.dy - d.dy;
    final dx = e.position.dx - d.dx;
    if (dy > 90 && dy.abs() > dx.abs()) {
      widget.onClose();
      return;
    }
    if (!_navAllowed()) return;
    if (dx.abs() > 60 && dx.abs() > dy.abs()) {
      dx < 0 ? next() : prev();
      return;
    }
    if (_clock.elapsed - dt > const Duration(milliseconds: 250)) return; // a hold, not a tap
    final box = context.findRenderObject() as RenderBox?;
    final local = box?.globalToLocal(e.position).dx ?? e.position.dx;
    if (local < width / 3) {
      prev();
    } else {
      next();
    }
  }

  @override
  Widget build(BuildContext context) {
    final story = _story;
    if (story == null || _slide >= _slides.length) return const SizedBox.shrink();
    final sl = _slides[_slide];
    final th = storyThemeOf(story);
    final artInk = th.light ? th.ink : const Color(0xFFFFFFFF);
    final vars = widget.vars;
    final pad = MediaQuery.paddingOf(context);
    final t = sl['t'] as String? ?? 'cover';

    Widget rich(String? text, TextStyle style) {
      if (text == null) return const SizedBox.shrink();
      final parts = parseStoryText(fillStory(text, vars));
      return Text.rich(
        TextSpan(
          children: [
            for (final p in parts)
              switch (p.kind) {
                StoryTextKind.mark => WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    decoration: BoxDecoration(color: th.pop, borderRadius: BorderRadius.circular(10)),
                    child: Text(p.text, style: style.copyWith(color: th.popInk)),
                  ),
                ),
                StoryTextKind.hl => TextSpan(
                  text: p.text,
                  style: TextStyle(color: th.pop),
                ),
                StoryTextKind.bold => TextSpan(
                  text: p.text,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                StoryTextKind.plain => TextSpan(text: p.text),
              },
          ],
        ),
        style: style,
      );
    }

    final w = MediaQuery.sizeOf(context).width.clamp(0, 520).toDouble();
    double clampVw(double min, double vw, double max) => (w * vw / 100).clamp(min, max);
    const display = TextStyle(fontFamily: AFonts.inter, fontWeight: FontWeight.w800, letterSpacing: -0.025 * 1, height: 1.05);
    final hSize = switch (sl['size'] ?? (t == 'cover' ? 'xl' : 'l')) {
      'xl' => clampVw(32, 10, 42),
      'm' => clampVw(23, 7, 28),
      _ => clampVw(27, 8.4, 34),
    };
    final source = story['source'] is String && const ['list', 'alert', 'myth', 'fact'].contains(t)
        ? Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Opacity(
              opacity: 0.68,
              child: Text('Mənbə: ${story['source']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
            ),
          )
        : null;
    Widget art(String? name, {double? widthFactor}) => Align(
      alignment: Alignment.bottomCenter,
      child: FractionallySizedBox(
        widthFactor: widthFactor ?? 1,
        child: StoryArt(name: name, c: th.pop, a: artInk),
      ),
    );
    final small = art(story['illus'] as String?, widthFactor: 0.7);
    final kick = sl['kicker'] != null
        ? Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Opacity(
              opacity: 0.78,
              child: rich(sl['kicker'] as String?, const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.96)),
            ),
          )
        : null;
    final title = sl['title'] != null ? rich(sl['title'] as String?, display.copyWith(fontSize: hSize, letterSpacing: -0.025 * hSize)) : null;
    final body = sl['body'] != null
        ? Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Opacity(opacity: 0.94, child: rich(sl['body'] as String?, const TextStyle(fontSize: 16, height: 1.4))),
          )
        : null;
    final chipDeco = BoxDecoration(color: th.chip, borderRadius: BorderRadius.circular(18));

    final content = <Widget>[];
    switch (t) {
      case 'cover':
        content.addAll([?kick, ?title, const Spacer(), if (sl['illus'] != null) art(sl['illus'] as String?)]);
      case 'fact':
        content.addAll([
          ?kick,
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 6,
            children: [
              Text(
                fillStory(sl['value'] as String?, vars),
                style: display.copyWith(fontSize: clampVw(64, 22, 96), height: 0.92, letterSpacing: -0.04 * clampVw(64, 22, 96)),
              ),
              if (sl['unit'] != null) Text(fillStory(sl['unit'] as String?, vars), style: display.copyWith(fontSize: 22)),
            ],
          ),
          ?body,
          ?source,
          const Spacer(),
          art((sl['illus'] ?? story['illus']) as String?),
        ]);
      case 'list':
        final items = (sl['items'] as List?)?.cast<String>() ?? const <String>[];
        content.addAll([
          ?kick,
          ?title,
          const SizedBox(height: 18),
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: chipDeco,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: th.pop, shape: BoxShape.circle),
                      child: Text(
                        '${i + 1}',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: th.popInk),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: rich(items[i], const TextStyle(fontSize: 15.5, height: 1.32, fontWeight: FontWeight.w600))),
                  ],
                ),
              ),
            ),
          ?source,
          const Spacer(),
          if (items.length <= 3) small,
        ]);
      case 'myth':
        Widget box(String label, String? text, bool fact) => Container(
          margin: const EdgeInsets.only(top: 16),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: th.chip, borderRadius: BorderRadius.circular(24)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: fact ? th.pop : th.ink2, borderRadius: BorderRadius.circular(999)),
                child: Text(
                  label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.96, color: fact ? th.popInk : th.bg2),
                ),
              ),
              rich(text, const TextStyle(fontSize: 18.5, fontWeight: FontWeight.w700, height: 1.28)),
            ],
          ),
        );
        content.addAll([
          const Opacity(
            opacity: 0.78,
            child: Text('MİF VƏ FAKT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.96)),
          ),
          box('MİF', sl['myth'] as String?, false),
          box('FAKT', sl['fact'] as String?, true),
          ?source,
          const Spacer(),
          small,
        ]);
      case 'quiz':
        final options = (sl['options'] as List?)?.cast<String>() ?? const <String>[];
        final correct = sl['correct'] as num?;
        content.addAll([
          ?kick,
          ?title,
          const SizedBox(height: 20),
          for (var i = 0; i < options.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
              child: GestureDetector(
                key: ValueKey('story-opt-$i'),
                onTap: _answer != null
                    ? null
                    : () {
                        setState(() => _answer = i);
                        _setPaused('quiz', true);
                        _log(i == correct ? 'story_quiz_ok' : 'story_quiz_no');
                        _quizTimer = Timer(const Duration(milliseconds: 2600), () {
                          if (mounted) _setPaused('quiz', false);
                        });
                      },
                child: Opacity(
                  opacity: _answer != null && i != correct ? 0.45 : 1,
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 52),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: _answer != null && i == correct ? th.pop : null,
                      border: Border.all(color: _answer != null && i == correct ? th.pop : th.ink, width: 2),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: rich(
                            options[i],
                            TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _answer != null && i == correct ? th.popInk : th.ink),
                          ),
                        ),
                        if (_answer != null && i == correct) Text('✓', style: TextStyle(color: th.popInk)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: _answer == null
                  ? const SizedBox()
                  : Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: _answer == correct ? 'Düzdür! ' : 'Əslində: '),
                          WidgetSpan(child: rich(sl['explain'] as String?, const TextStyle(fontSize: 15, height: 1.38, fontWeight: FontWeight.w600))),
                        ],
                      ),
                      key: const ValueKey('story-reveal'),
                      style: const TextStyle(fontSize: 15, height: 1.38, fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ]);
      case 'alert':
        final items = (sl['items'] as List?)?.cast<String>() ?? const <String>[];
        content.addAll([
          ?kick,
          ?title,
          const SizedBox(height: 16),
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(color: th.chip, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(color: th.pop, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: rich(items[i], const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                  ],
                ),
              ),
            ),
          ?source,
          const Spacer(),
          if (sl['illus'] != null) art(sl['illus'] as String?),
        ]);
      case 'quote':
        content.addAll([
          if (sl['badge'] != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: th.chip, borderRadius: BorderRadius.circular(999)),
                child: Text('✦ ${sl['badge']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          Text('“', style: TextStyle(fontSize: 70, height: 0.6, color: th.pop)),
          const SizedBox(height: 8),
          rich(sl['quote'] as String?, display.copyWith(fontSize: clampVw(23, 7, 27), height: 1.2)),
          if (sl['src'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Opacity(
                opacity: 0.68,
                child: Text('${sl['src']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ),
          const Spacer(),
          art('blob'),
        ]);
      case 'cta':
        final cta = sl['cta'] as Map?;
        content.addAll([
          ?kick,
          ?title,
          ?body,
          if (cta != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: GestureDetector(
                key: const ValueKey('story-cta'),
                onTap: () => widget.onCta(story, sl),
                child: Container(
                  margin: const EdgeInsets.only(top: 18),
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(color: th.ink2, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (cta['premium'] == true) ...[
                        SvgPicture.string(_crownSvg, width: 15, height: 15, theme: SvgTheme(currentColor: th.bg2)),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        '${cta['label']}',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: th.bg2),
                      ),
                      const SizedBox(width: 8),
                      AIcon(AIcons.chevronRight, size: 16, strokeWidth: 2.6, color: th.bg2),
                    ],
                  ),
                ),
              ),
            ),
          const Spacer(),
          if (sl['illus'] != null) art(sl['illus'] as String?),
        ]);
      default:
        content.addAll([?kick, ?title]);
    }

    final slides = _slides;
    final barTrack = th.light ? const Color(0x26000000) : const Color(0x59FFFFFF);
    final barFill = th.light ? th.ink : const Color(0xFFFFFFFF);

    return OverlayBackHandler(
      open: true,
      onClose: widget.onClose,
      child: Semantics(
        scopesRoute: true,
        namesRoute: true,
        label: fillStory(story['title'] as String?, vars),
        child: ColoredBox(
          color: const Color(0xFF000000),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Listener(
                onPointerDown: _onDown,
                onPointerUp: (e) => _onUp(e, w),
                onPointerCancel: (_) {
                  _setPaused('hold', false);
                  _downAt = null;
                },
                child: Container(
                  color: th.bg,
                  child: DefaultTextStyle(
                    style: TextStyle(fontFamily: AFonts.inter, color: th.ink, fontSize: 16, height: 1.5),
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: KeyedSubtree(
                            key: ValueKey('${story['id']}-$_slide'),
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(22, pad.top + 76, 22, pad.bottom + 22),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: content),
                            ),
                          ),
                        ),
                        Positioned(
                          top: pad.top + 10,
                          left: 12,
                          right: 12,
                          child: Row(
                            children: [
                              for (var i = 0; i < slides.length; i++) ...[
                                if (i > 0) const SizedBox(width: 4),
                                Expanded(
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(3),
                                    child: Container(
                                      height: 3,
                                      color: barTrack,
                                      alignment: Alignment.centerLeft,
                                      child: i < _slide
                                          ? ColoredBox(color: barFill, child: const SizedBox.expand())
                                          : i == _slide
                                          ? AnimatedBuilder(
                                              animation: _bar,
                                              builder: (_, _) => FractionallySizedBox(
                                                widthFactor: _bar.value,
                                                heightFactor: 1,
                                                child: ColoredBox(color: barFill),
                                              ),
                                            )
                                          : null,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Positioned(
                          top: pad.top + 22,
                          left: 14,
                          right: 8,
                          child: DefaultTextStyle.merge(
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            child: Row(
                              children: [
                                Container(
                                  width: 30,
                                  height: 30,
                                  alignment: Alignment.center,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFFFFFFF),
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: Color(0x14000000), spreadRadius: 2)],
                                  ),
                                  child: const Text(
                                    'A',
                                    style: TextStyle(color: Color(0xFFFF5A5F), fontWeight: FontWeight.w800, fontSize: 14),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text('Anacan'),
                                const SizedBox(width: 8),
                                Opacity(
                                  opacity: 0.72,
                                  child: Text('· ${storyModuleLabel[story['module']] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w500)),
                                ),
                                const Spacer(),
                                Semantics(
                                  button: true,
                                  label: 'Story-ni yüklə',
                                  child: GestureDetector(
                                    key: const ValueKey('story-download'),
                                    onTap: _saving == 'busy' ? null : _save,
                                    child: Opacity(
                                      opacity: _saving == 'busy' ? 0.8 : 1,
                                      child: Container(
                                        height: 34,
                                        padding: const EdgeInsets.symmetric(horizontal: 12),
                                        decoration: BoxDecoration(color: th.chip, borderRadius: BorderRadius.circular(999)),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            AIcon(
                                              _saving == 'busy' ? AIcons.loaderCircle : AIcons.download,
                                              size: 18,
                                              strokeWidth: 2.4,
                                              color: th.ink,
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              _saving == 'done'
                                                  ? 'Hazırdır'
                                                  : _saving == 'error'
                                                  ? 'Alınmadı'
                                                  : 'Yüklə',
                                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                Semantics(
                                  button: true,
                                  label: 'Bağla',
                                  child: GestureDetector(
                                    key: const ValueKey('story-close'),
                                    onTap: widget.onClose,
                                    child: SizedBox(
                                      width: 44,
                                      height: 44,
                                      child: Center(child: AIcon(AIcons.x, size: 22, strokeWidth: 2.4, color: th.ink)),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
