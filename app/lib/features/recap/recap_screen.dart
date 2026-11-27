// Ported from: src/components/recap/RecapScreen.tsx
//
// Anacan Recap player: full screen, story style. Tap the middle to pause, the sides (or swipe) to move
// between scenes; music plays along. "Download / Share" records the very frames shown here (when a video
// encoder is wired), otherwise the summary card is shared as an image.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/language_controller.dart';
import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../domain/recap/recap_model.dart';
import '../../domain/recap/recap_types.dart';
import '../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import 'recap_audio.dart';
import 'recap_canvas.dart';
import 'recap_export.dart';
import 'recap_i18n.dart';
import 'recap_render.dart';
import 'use_recap.dart';

typedef _Json = Map<String, Object?>;

// One-off literals of RecapScreen.tsx inline styles (the player has its own dark palette).
const Color _screenBg = Color(0xFF12040C);
const Color _coral = Color(0xFFFF5A5F);
const Color _coralInk = Color(0xFFE63E4B);
const Color _white = Color(0xFFFFFFFF);
const Color _iconBtnBg = Color.fromRGBO(0, 0, 0, 0.35);
const Color _bigIconBg = Color.fromRGBO(0, 0, 0, 0.4);
const Color _badgeBg = Color.fromRGBO(0, 0, 0, 0.45);
const Color _overlayBg = Color.fromRGBO(18, 4, 12, 0.82);
const Color _trackBg = Color.fromRGBO(255, 255, 255, 0.2);
const Color _cancelBg = Color.fromRGBO(255, 255, 255, 0.15);
const Color _ghostInk = Color.fromRGBO(255, 255, 255, 0.85);

/// `null | {kind: 'video', progress} | {kind: 'image'}`.
class _Busy {
  const _Busy.video(this.progress) : video = true;
  const _Busy.image()
      : video = false,
        progress = 0;
  final bool video;
  final double progress;
}

class _Clock {
  const _Clock(this.base, this.wall, this.playing);
  final double base;
  final double wall;
  final bool playing;
}

class RecapScreen extends ConsumerStatefulWidget {
  const RecapScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<RecapScreen> createState() => _RecapScreenState();
}

class _RecapScreenState extends ConsumerState<RecapScreen> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker(_onTick);
  late final RecapAudio _audio;
  final ValueNotifier<double> _time = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    _audio = ref.read(recapAudioFactoryProvider)();
  }

  _Json? _model;
  List<Object?> _modelDeps = const [];
  RecapAssets? _assets;
  int _assetsGen = 0;

  /// Ticker time (seconds) — the `performance.now()` of this screen.
  double _elapsed = 0;
  _Clock _clock = const _Clock(0, 0, false);
  bool _ready = false;
  bool _playing = false;
  bool _ended = false;
  bool _muted = false;
  _Busy? _busy;
  String? _notice;
  RecapAbort? _abort;
  bool _loggedComplete = false;
  ({double x, double y})? _down;

  double get _duration => (_model?['duration'] as num? ?? 0).toDouble();

  double _now() => _clock.playing ? _clock.base + (_elapsed - _clock.wall) : _clock.base;

  void _log(String name, Map<String, Object?> params) => ref.read(analyticsSinkProvider).logEvent(name, params);

  @override
  void dispose() {
    _audio.pause();
    _abort?.abort();
    _audio.dispose();
    _ticker.dispose();
    _time.dispose();
    super.dispose();
  }

  void _seek(double t, [bool? play]) {
    final model = _model;
    if (model == null) return;
    final p = play ?? _clock.playing;
    final clamped = math.max(0.0, math.min(_duration, t));
    _clock = _Clock(clamped, _elapsed, p && clamped < _duration);
    _time.value = clamped;
    setState(() {
      _playing = _clock.playing;
      _ended = clamped >= _duration;
    });
    try {
      _audio.position = clamped;
    } catch (_) {/* not loaded yet */}
    if (_clock.playing && !_muted) {
      _audio.play().catchError((Object _) {
        if (mounted) setState(() => _muted = true);
      });
    } else {
      _audio.pause();
    }
  }

  /// Assets (logos + grain) once per model, then start.
  void _loadAssets(_Json model) {
    final gen = ++_assetsGen;
    unawaited(ref.read(recapAssetsLoaderProvider)(model).then((assets) {
      if (!mounted || gen != _assetsGen) return;
      _assets = assets;
      setState(() => _ready = true);
      _log('recap_opened', {'year': model['year'], 'stage': model['stage'] ?? 'none', 'scenes': (model['scenes']! as List).length});
      _seek(0, true);
      if (!_ticker.isActive) unawaited(_ticker.start());
    }));
  }

  void _onTick(Duration elapsed) {
    _elapsed = elapsed.inMicroseconds / 1e6;
    final model = _model;
    if (!_ready || model == null) return;
    final t = _now();
    if (t >= _duration && _clock.playing) {
      _clock = _Clock(_duration, _elapsed, false);
      setState(() {
        _playing = false;
        _ended = true;
      });
      if (!_loggedComplete) {
        _loggedComplete = true;
        _log('recap_completed', {'year': model['year'], 'stage': model['stage'] ?? 'none'});
      }
    }
    _time.value = math.min(t, _duration);
    // Keep the music on the picture's clock.
    if (_clock.playing && _audio.playing && (_audio.position - t).abs() > 0.3) {
      try {
        _audio.position = t;
      } catch (_) {}
    }
  }

  void _togglePlay() {
    if (_model == null) return;
    if (_ended) {
      _seek(0, true);
      return;
    }
    _seek(_now(), !_clock.playing);
  }

  void _step(int dir) {
    final model = _model;
    if (model == null) return;
    final t = _now();
    final scenes = (model['scenes']! as List).cast<_Json>();
    final i = sceneIndexAt(model, t);
    final s = scenes[i];
    final start = (s['start']! as num).toDouble(), end = (s['end']! as num).toDouble();
    if (dir > 0) {
      _seek(end + 0.001, true);
    } else {
      _seek(t - start > 1.2 || i == 0 ? start : (scenes[i - 1]['start']! as num).toDouble(), true);
    }
  }

  void _onPointerDown(PointerDownEvent e) => _down = (x: e.position.dx, y: e.position.dy);

  void _onPointerUp(PointerUpEvent e, double width) {
    final d = _down;
    _down = null;
    if (d == null || _busy != null) return;
    final dx = e.position.dx - d.x, dy = e.position.dy - d.y;
    if (dx.abs() > 50 && dx.abs() > dy.abs()) {
      _step(dx < 0 ? 1 : -1);
      return;
    }
    final fx = width > 0 ? e.localPosition.dx / width : 0.5;
    if (fx < 0.28) {
      _step(-1);
    } else if (fx > 0.72) {
      _step(1);
    } else {
      _togglePlay();
    }
  }

  void _toggleMute() {
    final next = !_muted;
    setState(() => _muted = next);
    _audio.muted = next;
    if (next) {
      _audio.pause();
    } else if (_clock.playing) {
      try {
        _audio.position = _now();
      } catch (_) {}
      _audio.play().catchError((Object _) {
        if (mounted) setState(() => _muted = true);
      });
    }
  }

  int get _year => (_model?['year'] as num? ?? recapYear).toInt();
  String get _baseName => 'anacan-recap-$_year';
  String get _shareText => fillRecap(rt('recap_share_text'), {'year': _year});

  Future<void> _exportVideo(String mode) async {
    final model = _model, assets = _assets;
    if (model == null || assets == null || _busy != null) return;
    final encoder = ref.read(recapVideoEncoderProvider);
    if (!encoder.supported) {
      setState(() => _notice = rt('recap_error'));
      return;
    }
    _seek(_now(), false);
    final abort = _abort = RecapAbort();
    setState(() {
      _busy = const _Busy.video(0);
      _notice = null;
    });
    try {
      final video = await encoder.record(model, assets,
          musicAsset: recapMusicAsset, signal: abort, onProgress: (p) => mounted ? setState(() => _busy = _Busy.video(p)) : null);
      _log('recap_exported', {'year': model['year'], 'format': video.mimeType.contains('mp4') ? 'mp4' : 'webm', 'mode': mode});
      if (!mounted) return;
      setState(() => _busy = null);
      final ext = video.mimeType.contains('mp4') ? 'mp4' : 'webm';
      final outcome = await ref.read(recapShareServiceProvider).share(video.bytes, fileName: '$_baseName.$ext', mimeType: video.mimeType, text: _shareText, mode: mode);
      if (outcome != 'cancelled') {
        if (mounted) setState(() => _notice = rt('recap_saved'));
        _log('recap_shared', {'year': model['year'], 'kind': 'video', 'outcome': outcome});
      }
    } catch (error) {
      if (!mounted) return;
      final code = error is RecapExportError ? error.code : null;
      setState(() {
        _busy = null;
        if (code == 'INTERRUPTED') {
          _notice = rt('recap_rendering_hint');
        } else if (code != 'ABORTED') {
          _notice = rt('recap_error');
        }
      });
    } finally {
      _abort = null;
    }
  }

  Future<void> _exportImage() async {
    final model = _model, assets = _assets;
    if (model == null || assets == null || _busy != null) return;
    setState(() => _busy = const _Busy.image());
    try {
      final Uint8List png = await ref.read(recapImageRendererProvider)(model, assets);
      if (mounted) setState(() => _busy = null);
      final outcome = await ref.read(recapShareServiceProvider).share(png, fileName: '$_baseName-card.png', mimeType: 'image/png', text: _shareText);
      if (outcome != 'cancelled') _log('recap_shared', {'year': model['year'], 'kind': 'image', 'outcome': outcome});
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = null;
          _notice = rt('recap_error');
        });
      }
    }
  }

  /// useMemo(buildRecapModel, [recap, language, labels, user?.id]).
  void _syncModel(_Json? recap, String language, RecapLabels labels, String? uid) {
    final deps = [recap, language, labels, uid];
    if (_modelDeps.length == deps.length && Iterable.generate(deps.length).every((i) => identical(deps[i], _modelDeps[i]) || deps[i] == _modelDeps[i])) return;
    _modelDeps = deps;
    _model = recap != null ? buildRecapModel(recap, language, recapTranslator(tr), labels: labels, seed: uid) : null;
    final model = _model;
    if (model != null) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted && identical(_model, model)) _loadAssets(model);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(recapProvider(recapYear));
    final language = ref.watch(appLanguageProvider);
    final labels = ref.watch(recapLabelsProvider);
    final uid = ref.watch(authUserProvider)?.id;
    _syncModel(state.recap, language, labels, uid);
    final model = _model;
    final canRecord = ref.watch(recapVideoEncoderProvider).supported;
    final pad = MediaQuery.paddingOf(context);
    final screenH = MediaQuery.sizeOf(context).height;
    final brandLabel = ['Anacan Recap', model?['year'] ?? recapYear].join(' ');
    final enabled = _ready && _busy == null;

    return DefaultTextStyle.merge(
      style: const TextStyle(color: _white),
      child: Stack(
        key: const ValueKey('recap-screen'),
        children: [
          Positioned.fill(
            child: ColoredBox(
              color: _screenBg,
              child: Padding(
                padding: EdgeInsets.only(top: pad.top, bottom: pad.bottom),
                child: Column(
                  children: [
                    Expanded(
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: Center(
                              child: model != null
                                  ? _player(model, screenH, brandLabel)
                                  : Padding(
                                      padding: const EdgeInsets.all(24),
                                      child: Text(
                                        state.isLoading
                                            ? rt('recap_loading')
                                            : state.result != null && state.result!['available'] != true
                                                ? rt('recap_unavailable')
                                                : rt('recap_loading'),
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(fontWeight: FontWeight.w800),
                                      ),
                                    ),
                            ),
                          ),
                          PositionedDirectional(
                            top: 10,
                            end: 10,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (model != null) ...[
                                  _IconButton(
                                    key: const ValueKey('recap-mute'),
                                    icon: _muted ? AIcons.volumeX : AIcons.volume2,
                                    size: 18,
                                    label: _muted ? rt('recap_unmute') : rt('recap_mute'),
                                    onTap: _toggleMute,
                                  ),
                                  const SizedBox(width: 8),
                                  _IconButton(
                                    key: const ValueKey('recap-play'),
                                    icon: _playing ? AIcons.pause : AIcons.play,
                                    size: 18,
                                    label: _playing ? rt('recap_pause') : rt('recap_replay'),
                                    onTap: _togglePlay,
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                _IconButton(key: const ValueKey('recap-close'), icon: AIcons.x, size: 20, label: rt('recap_close'), onTap: widget.onBack),
                              ],
                            ),
                          ),
                          if (state.recap?['preview'] == true)
                            PositionedDirectional(
                              top: 14,
                              start: 12,
                              child: DecoratedBox(
                                decoration: BoxDecoration(color: _badgeBg, borderRadius: BorderRadius.circular(999)),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  child: Text(rt('recap_preview_badge'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (model != null)
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_notice != null) ...[
                                Semantics(
                                  liveRegion: true,
                                  child: Opacity(
                                    opacity: 0.9,
                                    child: Text(_notice!, key: const ValueKey('recap-notice'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 13)),
                                  ),
                                ),
                                const SizedBox(height: 8),
                              ],
                              if (canRecord) ...[
                                Row(
                                  children: [
                                    Expanded(
                                      child: _PillButton(
                                        key: const ValueKey('recap-download'),
                                        icon: AIcons.download,
                                        iconSize: 18,
                                        label: rt('recap_download'),
                                        background: _coral,
                                        color: _white,
                                        onTap: enabled ? () => unawaited(_exportVideo('download')) : null,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: _PillButton(
                                        key: const ValueKey('recap-share'),
                                        icon: AIcons.share2,
                                        iconSize: 18,
                                        label: rt('recap_share'),
                                        background: _white,
                                        color: _coralInk,
                                        onTap: enabled ? () => unawaited(_exportVideo('share')) : null,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                              ],
                              // Phones that cannot record video still share the summary card.
                              _PillButton(
                                key: const ValueKey('recap-share-image'),
                                icon: AIcons.image,
                                iconSize: 16,
                                label: rt('recap_share_image'),
                                background: canRecord ? null : _coral,
                                color: canRecord ? _ghostInk : _white,
                                minHeight: canRecord ? 38 : 46,
                                fontSize: canRecord ? 13 : 14,
                                onTap: enabled ? () => unawaited(_exportImage()) : null,
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
          if (_busy?.video == true) Positioned.fill(child: _renderingOverlay(_busy!.progress)),
        ],
      ),
    );
  }

  Widget _player(_Json model, double screenH, String brandLabel) => LayoutBuilder(builder: (context, c) {
        // height: 100%, max-height: calc(100vh - 120px), aspect-ratio: 9 / 16, max-width: 100%.
        var h = math.min(c.maxHeight, screenH - 120);
        var w = h * 9 / 16;
        if (w > c.maxWidth) {
          w = c.maxWidth;
          h = w * 16 / 9;
        }
        return SizedBox(
          width: w,
          height: h,
          child: Listener(
            onPointerDown: _onPointerDown,
            onPointerUp: (e) => _onPointerUp(e, w),
            behavior: HitTestBehavior.opaque,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Semantics(
                  label: brandLabel,
                  image: true,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: ColoredBox(
                      color: _screenBg,
                      child: _ready
                          ? RepaintBoundary(child: CustomPaint(key: const ValueKey('recap-canvas'), painter: RecapFramePainter(model: model, time: _time, assets: _assets ?? const RecapAssets())))
                          : const SizedBox.expand(),
                    ),
                  ),
                ),
                if (!_playing && _ready && _busy == null)
                  IgnorePointer(
                    child: Center(
                      child: Container(
                        key: const ValueKey('recap-big-play'),
                        width: 72,
                        height: 72,
                        decoration: const BoxDecoration(color: _bigIconBg, shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: AIcon(_ended ? AIcons.rotateCcw : AIcons.play, size: 30, color: _white),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      });

  Widget _renderingOverlay(double progress) {
    final pct = (progress * 100).round();
    return Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      child: ColoredBox(
        key: const ValueKey('recap-rendering'),
        color: _overlayBg,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(fillRecap(rt('recap_rendering'), {'pct': '$pct%'}), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              LayoutBuilder(builder: (context, c) {
                final w = math.min(c.maxWidth * 0.7, 320.0);
                return Container(
                  width: w,
                  height: 8,
                  decoration: BoxDecoration(color: _trackBg, borderRadius: BorderRadius.circular(999)),
                  clipBehavior: Clip.antiAlias,
                  alignment: AlignmentDirectional.centerStart,
                  child: AnimatedContainer(duration: const Duration(milliseconds: 200), width: w * pct / 100, height: 8, color: _coral),
                );
              }),
              const SizedBox(height: 14),
              Opacity(opacity: 0.85, child: Text(rt('recap_rendering_hint'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 13))),
              const SizedBox(height: 14),
              _PillButton(key: const ValueKey('recap-cancel'), label: rt('recap_cancel'), background: _cancelBg, color: _white, onTap: () => _abort?.abort()),
            ],
          ),
        ),
      ),
    );
  }
}

/// The canvas: renderRecapFrame at the shared clock, scaled from 1080×1920 to the widget.
class RecapFramePainter extends CustomPainter {
  RecapFramePainter({required this.model, required this.time, required this.assets}) : super(repaint: time);
  final Map<String, Object?> model;
  final ValueListenable<double> time;
  final RecapAssets assets;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.scale(size.width / recapW, size.height / recapH);
    renderRecapFrame(UiRecapCtx(canvas), math.min(time.value, (model['duration'] as num).toDouble()), model, assets);
    canvas.restore();
  }

  @override
  bool shouldRepaint(RecapFramePainter old) => !identical(old.model, model) || !identical(old.assets, assets) || old.time != time;
}

class _IconButton extends StatelessWidget {
  const _IconButton({super.key, required this.icon, required this.size, required this.label, required this.onTap});
  final AIconData icon;
  final double size;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: _iconBtnBg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: AIcon(icon, size: size, color: _white),
          ),
        ),
      );
}

class _PillButton extends StatelessWidget {
  const _PillButton({super.key, this.icon, this.iconSize = 18, required this.label, this.background, required this.color, this.onTap, this.minHeight = 46, this.fontSize = 14});
  final AIconData? icon;
  final double iconSize;
  final String label;
  final Color? background;
  final Color color;
  final VoidCallback? onTap;
  final double minHeight;
  final double fontSize;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: onTap != null,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            constraints: BoxConstraints(minHeight: minHeight),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[AIcon(icon!, size: iconSize, color: color), const SizedBox(width: 8)],
                Flexible(child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: fontSize))),
              ],
            ),
          ),
        ),
      );
}
