// Ported from: src/lib/tool-live-timer.ts, src/hooks/useKickSessions.ts (useKickLiveTimer),
//              src/hooks/useContractions.ts (useContractionLiveTimer)
//
// Lock-screen live timer for the pregnancy tools (contraction timer, kick counter). Reuses the LiveActivity bridge of
// the feeding/sleep timers (features/baby/live_timer): the native side counts up from `startTime`, so the label only
// carries the text. One live timer per slot; Android updates in place (same id), iOS starts a new activity first and
// ends the old one right after. The shown id is kept in LocalStore (`anacan_tool_live_timer_v1`) so a leftover
// activity from before an app restart is still ended. Without a native bridge (web / tests) everything is a no-op.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/labor/labor_utils.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../baby/live_timer/live_timer.dart' show liveTimerBridgeProvider, LiveTimerBridge, LiveActivityStart;

/// 'contraction' | 'kick'
typedef ToolLiveTimerSlot = String;

@immutable
class ToolLiveTimerView {
  const ToolLiveTimerView({required this.type, required this.label, required this.subLabel, required this.startTime});

  /// 'contraction' | 'kick'.
  final String type;
  final String label;
  final String subLabel;

  /// Epoch ms the native clock counts up from.
  final int startTime;

  String get signature => jsonEncode([type, label, subLabel, startTime]);
}

const String toolLiveTimerStorageKey = 'anacan_tool_live_timer_v1';

class ToolLiveTimer {
  ToolLiveTimer({required this.bridge, required this.store, required this.isAndroid, int Function()? now})
      : _now = now ?? DomainClock.nowMs;

  final LiveTimerBridge bridge;
  final LocalStore store;
  final bool isAndroid;
  final int Function() _now;

  int _idSeq = 0;
  final Map<String, ToolLiveTimerView?> _desired = {};
  final Map<String, Future<void>> _runs = {};

  Map<String, Object?> _readShown() {
    try {
      final raw = store.getItem(toolLiveTimerStorageKey);
      final v = jsonDecode(raw == null || raw.isEmpty ? '{}' : raw);
      return v is Map ? Map<String, Object?>.from(v) : {};
    } catch (_) {
      return {};
    }
  }

  ({String id, String sig})? _shown(String slot) {
    final v = _readShown()[slot];
    if (v is Map && v['id'] is String && v['sig'] is String) return (id: v['id'] as String, sig: v['sig'] as String);
    return null;
  }

  void _writeShown(String slot, ({String id, String sig})? shown) {
    try {
      final all = _readShown();
      if (shown != null) {
        all[slot] = {'id': shown.id, 'sig': shown.sig};
      } else {
        all.remove(slot);
      }
      if (all.isNotEmpty) {
        store.setItem(toolLiveTimerStorageKey, jsonEncode(all));
      } else {
        store.removeItem(toolLiveTimerStorageKey);
      }
    } catch (_) {
      // storage blocked
    }
  }

  String _nextId(String slot, ToolLiveTimerView view) {
    final base = '$slot-${view.startTime}';
    if (isAndroid) return base;
    _idSeq += 1;
    return '$base-${_now().toRadixString(36)}$_idSeq';
  }

  Future<void> _safeStop(String timerId) async {
    try {
      await bridge.stopActivity(timerId: timerId);
    } catch (_) {
      // plugin missing: nothing to stop
    }
  }

  Future<void> _apply(String slot, ToolLiveTimerView? view) async {
    final current = _shown(slot);
    if (view == null) {
      if (current != null) {
        _writeShown(slot, null);
        await _safeStop(current.id);
      }
      return;
    }
    final sig = view.signature;
    if (current?.sig == sig) return;
    final id = _nextId(slot, view);
    try {
      await bridge.startActivity(LiveActivityStart(
        id: id,
        type: view.type,
        label: view.label,
        subLabel: view.subLabel,
        // The lock-screen button only hides the timer; the session stays in the app.
        stopLabel: tr('livetimer_hide', 'Gizlət'),
        startTime: view.startTime,
        channelName: tr('livetimer_channel_name', 'Taymerlər'),
        channelDesc: tr('livetimer_channel_desc', 'Aktiv taymerlər'),
      ));
    } catch (_) {
      // Live Activities off or unsupported: show nothing, drop the old one.
      _writeShown(slot, null);
      if (current != null) await _safeStop(current.id);
      return;
    }
    _writeShown(slot, (id: id, sig: sig));
    if (current != null && current.id != id) await _safeStop(current.id);
  }

  /// Per slot, calls run one at a time and only the newest request is applied.
  Future<void> _request(String slot, ToolLiveTimerView? view) {
    if (!bridge.isNative) return Future.value();
    _desired[slot] = view;
    final running = _runs[slot];
    if (running != null) return running;
    final run = () async {
      try {
        // Let requests from the same frame settle first so they collapse into one.
        await Future<void>.delayed(Duration.zero);
        while (_desired.containsKey(slot)) {
          final next = _desired.remove(slot);
          try {
            await _apply(slot, next);
          } catch (e) {
            debugPrint('tool live timer: $e');
          }
        }
      } finally {
        _runs.remove(slot);
      }
    }();
    _runs[slot] = run;
    return run;
  }

  /// `showToolLiveTimer(slot, view)`.
  Future<void> show(String slot, ToolLiveTimerView view) => _request(slot, view);

  /// `hideToolLiveTimer(slot)`.
  Future<void> hide(String slot) => _request(slot, null);

  /// `__resetToolLiveTimerForTests`.
  @visibleForTesting
  void resetForTests() {
    _desired.clear();
    _runs.clear();
    _idSeq = 0;
  }
}

/// Android vs iOS id strategy (`Capacitor.getPlatform() === 'android'`); overridable in tests.
final toolLiveTimerIsAndroidProvider = Provider<bool>((ref) => defaultTargetPlatform == TargetPlatform.android);

final toolLiveTimerProvider = Provider<ToolLiveTimer>((ref) => ToolLiveTimer(
      bridge: ref.watch(liveTimerBridgeProvider),
      store: ref.watch(localStoreProvider),
      isAndroid: ref.watch(toolLiveTimerIsAndroidProvider),
    ));

// ── useKickLiveTimer ──

/// `useKickLiveTimer(session, enabled)`: "Hərəkət · {count}" counting up from the stored session start.
/// Call [update] whenever the session or `enabled` changes; it only talks to the bridge on a real change.
class KickLiveTimerSync {
  KickLiveTimerSync(this.timer);
  final ToolLiveTimer timer;
  (int?, int, bool)? _last;

  void update({required int? startTime, required int count, bool enabled = true}) {
    final key = (startTime, count, enabled);
    if (_last == key) return;
    _last = key;
    if (!enabled) return;
    if (startTime == null) {
      unawaited(timer.hide('kick'));
      return;
    }
    unawaited(timer.show(
      'kick',
      ToolLiveTimerView(
        type: 'kick',
        label: formatTr('livetimer_kick_label', 'Hərəkət · {count}', {'count': count}),
        subLabel: tr('livetimer_kick_sub', 'Hər hərəkətdə tətbiqdə toxunun'),
        startTime: startTime,
      ),
    ));
  }
}

// ── useContractionLiveTimer ──

/// `useContractionLiveTimer(timer, enabled)`: "Sancı" from the running start, "Son sancıdan bəri" from the last end
/// (up to an hour), hidden otherwise. Re-checks when the rest turns into a pause.
class ContractionLiveTimerSync {
  ContractionLiveTimerSync(this.timer, {int Function()? now}) : _now = now ?? DomainClock.nowMs;
  final ToolLiveTimer timer;
  final int Function() _now;
  (int?, int?, bool, int)? _last;
  Timer? _expiry;
  int _expiredAt = 0;
  int? _activeStart;
  int? _lastEnd;
  bool _enabled = true;

  void update({required int? activeStart, required int? lastEnd, bool enabled = true}) {
    _activeStart = activeStart;
    _lastEnd = lastEnd;
    _enabled = enabled;
    _run();
  }

  void _run() {
    final key = (_activeStart, _lastEnd, _enabled, _expiredAt);
    if (_last == key) return;
    _last = key;
    _expiry?.cancel();
    _expiry = null;
    if (!_enabled) return;
    final live = contractionLivePhase(activeStart: _activeStart, lastEnd: _lastEnd, now: _now());
    if (live == null) {
      unawaited(timer.hide('contraction'));
      return;
    }
    if (live.phase == 'active') {
      unawaited(timer.show(
        'contraction',
        ToolLiveTimerView(
          type: 'contraction',
          label: tr('livetimer_contraction_active', 'Sancı'),
          subLabel: tr('livetimer_contraction_active_sub', 'Bitəndə tətbiqdə qeyd edin'),
          startTime: live.startTime,
        ),
      ));
      return;
    }
    unawaited(timer.show(
      'contraction',
      ToolLiveTimerView(
        type: 'contraction',
        label: tr('livetimer_contraction_rest', 'Son sancıdan bəri'),
        subLabel: tr('livetimer_contraction_rest_sub', 'Növbəti sancı başlayanda qeyd edin'),
        startTime: live.startTime,
      ),
    ));
    final wait = (live.until! - _now()).clamp(0, 1 << 31) + 500;
    _expiry = Timer(Duration(milliseconds: wait), () {
      _expiredAt = _now();
      _run();
    });
  }

  void dispose() {
    _expiry?.cancel();
    _expiry = null;
  }
}
