// Ported from: src/components/chat/VoiceMessage.tsx, src/styles/chat.css (.chat-voice*)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../copy/chat_copy.dart';
import '../platform/chat_audio.dart';

String _seconds(double value) => '${value ~/ 60}:${(value % 60).floor().toString().padLeft(2, '0')}';

/// `anacan:voice-message-play`: starting one voice message pauses the others.
final StreamController<Object> _voicePlay = StreamController<Object>.broadcast(sync: true);

class VoiceMessage extends ConsumerStatefulWidget {
  const VoiceMessage({super.key, required this.src, this.own = false, this.onRenew});
  final String src;
  final bool own;
  final Future<String?> Function()? onRenew;

  @override
  ConsumerState<VoiceMessage> createState() => _VoiceMessageState();
}

class _VoiceMessageState extends ConsumerState<VoiceMessage> {
  late final ChatAudioPlayer _audio = ref.read(chatAudioPlayerProvider)();
  final Object _id = Object();
  late String _url = widget.src;
  late String _lease = widget.src;
  bool _playing = false, _loading = false, _failed = false, _alive = true;
  double _elapsed = 0, _duration = 0, _resumeAt = 0;
  String? _attemptedRenewal;
  StreamSubscription<Object>? _others;
  StreamSubscription<ChatAudioEvent>? _events;

  @override
  void initState() {
    super.initState();
    _others = _voicePlay.stream.listen((id) {
      if (id != _id) unawaited(_audio.pause());
    });
    _events = _audio.events.listen(_onEvent);
    unawaited(_audio.load(_url));
  }

  @override
  void didUpdateWidget(VoiceMessage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.src == widget.src) return;
    // A new lease need not interrupt a playing stream; it is adopted on pause / next playback.
    _lease = widget.src;
    if (_audio.paused) {
      _resumeAt = _audio.ended ? 0 : _audio.currentTime;
      _url = widget.src;
      _failed = false;
      unawaited(_audio.load(_url));
    }
  }

  @override
  void dispose() {
    _alive = false;
    unawaited(_others?.cancel());
    unawaited(_events?.cancel());
    unawaited(_audio.pause().catchError((Object _) {}).whenComplete(_audio.dispose));
    super.dispose();
  }

  void _set(VoidCallback change) {
    if (_alive && mounted) setState(change);
  }

  void _onEvent(ChatAudioEvent event) {
    switch (event) {
      case ChatAudioEvent.loadedMetadata:
        if (_resumeAt > 0) {
          final d = _audio.duration;
          final at = d.isFinite ? (_resumeAt < d ? _resumeAt : d) : _resumeAt;
          unawaited(_audio.seek(Duration(milliseconds: (at * 1000).round())));
          _resumeAt = 0;
        }
        _updateTime();
      case ChatAudioEvent.durationChange || ChatAudioEvent.timeUpdate:
        _updateTime();
      case ChatAudioEvent.play:
        _attemptedRenewal = null;
        _set(() => _playing = true);
      case ChatAudioEvent.pause:
        _set(() => _playing = false);
      case ChatAudioEvent.ended:
        _set(() {
          _playing = false;
          _elapsed = 0;
        });
      case ChatAudioEvent.error:
        _mediaError();
    }
  }

  void _updateTime() {
    final t = _audio.currentTime, d = _audio.duration;
    _set(() {
      _elapsed = t.isFinite && t > 0 ? t : 0;
      if (d.isFinite && d > 0) _duration = d;
    });
  }

  Future<void> _toggle() async {
    if (_loading) return;
    if (!_audio.paused) {
      await _audio.pause();
      return;
    }
    _set(() {
      _loading = true;
      _failed = false;
    });
    try {
      if (_url != _lease) {
        _resumeAt = _audio.ended ? 0 : _audio.currentTime;
        _url = _lease;
        await _audio.load(_lease);
      }
      // State follows media events, not a guessed toggle.
      await _audio.play();
      if (_alive) _voicePlay.add(_id);
    } catch (_) {
      _set(() {
        _failed = true;
        _playing = false;
      });
    } finally {
      _set(() => _loading = false);
    }
  }

  Future<void> _retry() async {
    final renew = widget.onRenew;
    if (renew != null) {
      _set(() => _loading = true);
      try {
        final renewed = await renew();
        if (_alive && renewed != null) {
          _lease = renewed;
          _url = renewed;
          unawaited(_audio.load(renewed));
          _set(() => _failed = false);
        }
      } catch (_) {
        // Retain the visible retry state; never claim playback succeeded.
      } finally {
        _set(() => _loading = false);
      }
    } else {
      unawaited(_audio.load(_url));
      _set(() => _failed = false);
    }
  }

  void _mediaError() {
    _set(() {
      _playing = false;
      _loading = false;
      _failed = true;
    });
    final renew = widget.onRenew;
    if (renew == null || _attemptedRenewal != null) return;
    _attemptedRenewal = _url;
    _set(() => _loading = true);
    renew().then((renewed) {
      if (_alive && renewed != null) {
        _lease = renewed;
        _url = renewed;
        unawaited(_audio.load(renewed));
        _set(() => _failed = false);
      }
    }, onError: (Object _) {}).whenComplete(() => _set(() => _loading = false));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final label = _failed
        ? chatTr('chat_audio_retry', 'Səsi yenidən yüklə')
        : _playing
            ? chatTr('chat_audio_pause', 'Səsi dayandır')
            : chatTr('chat_audio_play', 'Səsi dinlə');
    final max = _duration > 0 ? _duration : 1.0;
    final sliderEnabled = _duration > 0 && !_failed;
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 195),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Semantics(
            container: true,
            button: true,
            enabled: !_loading,
            label: label,
            excludeSemantics: true,
            child: GestureDetector(
              key: const ValueKey('voice-toggle'),
              onTap: _loading ? null : () => unawaited(_failed ? _retry() : _toggle()),
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: widget.own ? a.surface : a.peach1, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: _loading
                    ? ALoader(size: 18, color: a.accentInk)
                    : AIcon(_failed ? AIcons.rotateCcw : _playing ? AIcons.pause : AIcons.play, size: 18, color: a.accentInk),
              ),
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _RangeInput(
                key: const ValueKey('voice-seek'),
                label: chatTr('chat_audio_seek', 'Səsin vaxtı'),
                value: _elapsed < max ? _elapsed : max,
                max: max,
                enabled: sliderEnabled,
                color: a.ink,
                onChanged: (value) {
                  if (_duration <= 0) return;
                  unawaited(_audio.seek(Duration(milliseconds: (value * 1000).round())));
                  _set(() => _elapsed = value);
                },
              ),
              DefaultTextStyle.merge(
                style: px(9, color: a.inkSoft),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(_seconds(_playing || _elapsed > 0 ? _elapsed : _duration)),
                  if (_failed)
                    Flexible(
                      child: Semantics(
                        liveRegion: true,
                        child: Text(chatTr('chat_audio_failed', 'Səs açılmadı. Yenidən yoxlayın.'), textAlign: TextAlign.end),
                      ),
                    ),
                ]),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// `<input type="range">` (16 high, `accent-color: var(--a-ink)`).
class _RangeInput extends StatelessWidget {
  const _RangeInput({super.key, required this.label, required this.value, required this.max, required this.enabled, required this.color, required this.onChanged});
  final String label;
  final double value;
  final double max;
  final bool enabled;
  final Color color;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final fraction = max <= 0 ? 0.0 : (value / max).clamp(0.0, 1.0);
    return Semantics(
      slider: true,
      enabled: enabled,
      label: label,
      value: _seconds(value),
      child: LayoutBuilder(builder: (context, constraints) {
        void seek(double dx) {
          if (!enabled) return;
          final w = constraints.maxWidth;
          final f = w <= 0 ? 0.0 : (dx / w).clamp(0.0, 1.0);
          onChanged(f * max);
        }

        final rtl = Directionality.of(context) == TextDirection.rtl;
        double local(Offset p) => rtl ? constraints.maxWidth - p.dx : p.dx;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => seek(local(d.localPosition)),
          onHorizontalDragUpdate: (d) => seek(local(d.localPosition)),
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: SizedBox(
              height: 16,
              child: Stack(alignment: AlignmentDirectional.centerStart, children: [
                Container(height: 4, decoration: BoxDecoration(color: color.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(2))),
                FractionallySizedBox(
                  widthFactor: fraction,
                  child: Container(height: 4, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
                ),
                Align(
                  alignment: AlignmentDirectional(fraction * 2 - 1, 0),
                  child: Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                ),
              ]),
            ),
          ),
        );
      }),
    );
  }
}
