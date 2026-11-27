// Ported from: src/components/FloatingTimerWidget.tsx (mini pill + expanded panel of running timers and white noise,
//              stop → baby_logs via the offline outbox), src/hooks/useBabyLogs.ts (addLog row shape)
//
// Native live activities / timer notifications are driven by the timer store's [TimerNativeHooks]
// (state/timer_store.dart), so stopping here also ends them.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/tr.dart';
import '../../core/offline/offline_outbox.dart';
import '../../core/offline/offline_providers.dart';
import '../../core/offline/outbox_copy.dart';
import '../../design/design.dart';
import '../../state/timer_store.dart';
import '../../state/white_noise_store.dart';
import 'home_inputs.dart';

/// Writes a stopped sleep / feeding session (`useBabyLogs().addLog`): `'saved' | 'queued' | 'error'`.
typedef TimerLogSaver = Future<String> Function({
  required String type,
  String? feedType,
  required int startTime,
  required int endTime,
  String? childId,
});

final timerLogSaverProvider = Provider<TimerLogSaver>((ref) {
  return ({required type, feedType, required startTime, required endTime, childId}) async {
    final userId = ref.read(homeUserIdProvider);
    if (userId == null) return 'error';
    final row = <String, Object?>{
      'log_type': type,
      if (type == 'feeding' && feedType != null) 'feed_type': feedType == 'left' ? 'breast_left' : 'breast_right',
      'start_time': DateTime.fromMillisecondsSinceEpoch(startTime).toUtc().toIso8601String(),
      'end_time': DateTime.fromMillisecondsSinceEpoch(endTime).toUtc().toIso8601String(),
      'user_id': userId,
      'child_id': childId ?? ref.read(homeSelectedChildProvider)?['id'],
    };
    final outcome = await ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'baby_logs', row);
    return switch (outcome.status) {
      SaveStatus.saved => 'saved',
      SaveStatus.queued => 'queued',
      SaveStatus.error => 'error',
    };
  };
});

({AIconData icon, Color color, String label}) _config(String type) => switch (type) {
  'feeding' => (icon: AIcons.baby, color: const Color(0xFFF43F5E), label: tr('floatingtimerwidget_emizdirme_20d46a', 'Əmizdirmə')),
  'diaper' => (icon: AIcons.clock, color: const Color(0xFFF59E0B), label: tr('common_bez', 'Bez')),
  'white-noise' => (icon: AIcons.volume2, color: const Color(0xFF10B981), label: tr('floatingtimerwidget_kuy_sesi_7b0cd5', 'Küy Səsi')),
  _ => (icon: AIcons.moon, color: const Color(0xFF6366F1), label: tr('common_yuxu', 'Yuxu')),
};

String formatTimerTime(int totalSeconds) {
  final h = totalSeconds ~/ 3600;
  final m = (totalSeconds % 3600) ~/ 60;
  final s = totalSeconds % 60;
  if (h > 0) return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  return '$m:${s.toString().padLeft(2, '0')}';
}

/// Per-second label (only this re-renders every tick).
class _Elapsed extends ConsumerStatefulWidget {
  const _Elapsed({required this.timerId, required this.style});
  final String timerId;
  final TextStyle style;

  @override
  ConsumerState<_Elapsed> createState() => _ElapsedState();
}

class _ElapsedState extends ConsumerState<_Elapsed> {
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Text(formatTimerTime(ref.read(timerStoreProvider.notifier).getElapsedSeconds(widget.timerId)), style: widget.style);
}

class FloatingTimerWidget extends ConsumerStatefulWidget {
  const FloatingTimerWidget({super.key});

  @override
  ConsumerState<FloatingTimerWidget> createState() => _FloatingTimerWidgetState();
}

class _FloatingTimerWidgetState extends ConsumerState<FloatingTimerWidget> {
  bool _expanded = false;
  final Set<String> _saving = {};

  Future<void> _stop(ActiveTimer timer) async {
    if (_saving.contains(timer.id)) return;
    _saving.add(timer.id);
    try {
      var outcome = 'skipped';
      final end = ref.read(timerClockProvider)();
      if ((timer.type == 'sleep' || timer.type == 'feeding') && end - timer.startTime >= 3000) {
        outcome = await ref.read(timerLogSaverProvider)(
          type: timer.type,
          feedType: timer.feedType,
          startTime: timer.startTime,
          endTime: end,
          childId: timer.childId,
        );
      }
      if (!mounted) return;
      final toast = _toast();
      if (outcome == 'error') {
        final f = saveFailedToast();
        toast?.show(title: f.title, description: f.description, destructive: true);
        return;
      }
      ref.read(timerStoreProvider.notifier).stopTimer(timer.id);
      if (outcome == 'queued') toast?.show(title: queuedToast().title);
    } finally {
      _saving.remove(timer.id);
    }
  }

  AToastController? _toast() {
    try {
      return AToastHost.of(context);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final timers = ref.watch(timerStoreProvider).activeTimers;
    final noise = ref.watch(whiteNoiseStoreProvider);
    final hasAnything = timers.isNotEmpty || noise.isPlaying;
    if (!hasAnything) {
      _expanded = false;
      return const SizedBox.shrink();
    }
    final s = AnacanTokens.of(context).shadcn;
    final bottom = MediaQuery.paddingOf(context).bottom + 92; // calc(env(safe-area-inset-bottom) + 5.75rem)
    final primary = timers.isEmpty ? null : timers.first;
    final count = timers.length + (noise.isPlaying ? 1 : 0);
    final cardDeco = BoxDecoration(
      color: s.card,
      border: Border.all(color: s.border.withValues(alpha: s.border.a * 0.6)),
      boxShadow: const [
        BoxShadow(offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3, color: Color(0x1A000000)),
        BoxShadow(offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4, color: Color(0x1A000000)),
      ],
    );

    Widget content;
    if (!_expanded) {
      final cfg = primary == null ? null : _config(primary.type);
      content = GestureDetector(
        key: const ValueKey('floating-timer-mini'),
        onTap: () => setState(() => _expanded = true),
        child: PressScale(
          scale: 0.9,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: cardDeco.copyWith(borderRadius: BorderRadius.circular(999)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: const Color(0xFF22C55E),
                    shape: BoxShape.circle,
                    boxShadow: const [BoxShadow(color: Color(0x4D22C55E), spreadRadius: 2)],
                  ),
                ),
                const SizedBox(width: 6),
                if (noise.isPlaying && primary == null) ...[
                  Text(noise.soundEmoji ?? '🔊', style: const TextStyle(fontSize: 14)),
                  const SizedBox(width: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 60),
                    child: Text(
                      noise.soundName ?? tr('floatingtimerwidget_kuy_a91589', 'Küy'),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.foreground),
                    ),
                  ),
                ] else if (primary != null) ...[
                  AIcon(cfg!.icon, size: 14, color: cfg.color),
                  const SizedBox(width: 6),
                  _Elapsed(
                    timerId: primary.id,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: s.foreground,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
                if (count > 1) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 16,
                    height: 16,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                    child: Text(
                      '$count',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: s.mutedForeground),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    } else {
      Widget round(Widget icon, Color bg, VoidCallback onTap, {Key? key}) => GestureDetector(
        key: key,
        onTap: onTap,
        child: PressScale(
          scale: 0.85,
          child: Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: icon,
          ),
        ),
      );
      final destructiveSoft = s.destructive.withValues(alpha: 0.1);
      content = SizedBox(
        key: const ValueKey('floating-timer-panel'),
        width: 208,
        child: Container(
          decoration: cardDeco.copyWith(borderRadius: BorderRadius.circular(16)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        tr('untranslated_taymer_uen6sv', 'Taymer').toUpperCase(),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5, color: s.mutedForeground),
                      ),
                    ),
                    round(
                      AIcon(AIcons.x, size: 12, color: s.mutedForeground),
                      s.muted.withValues(alpha: 0.6),
                      () => setState(() => _expanded = false),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (noise.isPlaying)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(color: const Color(0x1A10B981), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          children: [
                            Text(noise.soundEmoji ?? '🔊', style: const TextStyle(fontSize: 14)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    noise.soundName ?? tr('floatingtimerwidget_kuy_sesi_7b0cd5', 'Küy Səsi'),
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, height: 1.25, color: s.foreground),
                                  ),
                                  Text(tr('floatingtimerwidget_oynayir_2c8aa6', 'Oynayır'), style: TextStyle(fontSize: 10, color: s.mutedForeground)),
                                ],
                              ),
                            ),
                            round(
                              AIcon(
                                noise.isMuted ? AIcons.volumeX : AIcons.volume2,
                                size: 10,
                                color: noise.isMuted ? s.mutedForeground : const Color(0xFF059669),
                              ),
                              s.muted.withValues(alpha: 0.6),
                              () => ref.read(whiteNoiseStoreProvider.notifier).toggleMute(),
                            ),
                            const SizedBox(width: 8),
                            round(
                              Container(width: 10, height: 10, color: s.destructive),
                              destructiveSoft,
                              () => ref.read(whiteNoiseStoreProvider.notifier).stop(),
                            ),
                          ],
                        ),
                      ),
                    for (final timer in timers) ...[
                      if (noise.isPlaying || timer != timers.first) const SizedBox(height: 4),
                      Container(
                        key: ValueKey('floating-timer-${timer.id}'),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          children: [
                            AIcon(_config(timer.type).icon, size: 14, color: _config(timer.type).color),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${timer.childName != null && timer.childName!.isNotEmpty ? '${timer.childName} — ' : ''}${timer.label ?? _config(timer.type).label}'
                                    '${timer.feedType != null ? ' (${timer.feedType == 'left' ? tr('dashboard_sol', 'Sol') : tr('floatingtimerwidget_sag_edbe12', 'Sağ')})' : ''}',
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, height: 1.25, color: s.foreground),
                                  ),
                                  _Elapsed(
                                    timerId: timer.id,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: s.foreground,
                                      fontFeatures: const [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            round(
                              Container(width: 10, height: 10, color: s.destructive),
                              destructiveSoft,
                              () => _stop(timer),
                              key: ValueKey('floating-timer-stop-${timer.id}'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    return PositionedDirectional(end: 12, bottom: bottom, child: content);
  }
}
