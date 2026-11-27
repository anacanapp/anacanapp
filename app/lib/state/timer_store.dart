// Ported from: src/store/timerStore.ts
//
// Running sleep/feeding/diaper/white-noise timers, persisted under `anacan-timers` =
// `{"state":{"activeTimers":[{id,type,feedType?,label?,childId?,childName?,startTime}]},"version":0}`.
// Lock-screen side effects (Live Activity / foreground service / notification fallback) go
// through [TimerNativeHooks] (src/lib/live-timer.ts, src/utils/timerNotifications.ts).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'local_store.dart';
import 'persisted_store.dart';

/// 'sleep' | 'feeding' | 'diaper' | 'white-noise'.
abstract final class TimerTypes {
  static const sleep = 'sleep', feeding = 'feeding', diaper = 'diaper', whiteNoise = 'white-noise';
  static const all = [sleep, feeding, diaper, whiteNoise];
}

class ActiveTimer {
  const ActiveTimer({
    required this.id,
    required this.type,
    this.feedType,
    this.label,
    this.childId,
    this.childName,
    required this.startTime,
  });

  final String id;
  final String type;

  /// 'left' | 'right'.
  final String? feedType;
  final String? label;

  /// Which child (twins/triplets each have their own timer); null = single-child families.
  final String? childId;

  /// Display only (floating widget + lock screen).
  final String? childName;

  /// Epoch ms.
  final int startTime;

  /// `JSON.stringify` drops undefined fields.
  Map<String, Object?> toJson() => {
        'id': id,
        'type': type,
        if (feedType != null) 'feedType': feedType,
        if (label != null) 'label': label,
        if (childId != null) 'childId': childId,
        if (childName != null) 'childName': childName,
        'startTime': startTime,
      };

  static ActiveTimer? tryParse(Object? value) {
    if (value is! Map) return null;
    final id = value['id'], type = value['type'], start = value['startTime'];
    if (id is! String || type is! String || start is! num) return null;
    String? str(String k) => value[k] is String ? value[k] as String : null;
    return ActiveTimer(
      id: id,
      type: type,
      feedType: str('feedType'),
      label: str('label'),
      childId: str('childId'),
      childName: str('childName'),
      startTime: start.toInt(),
    );
  }
}

/// Native lock-screen timer integration.
abstract interface class TimerNativeHooks {
  void startNativeTimer(ActiveTimer timer);
  void stopNativeTimer(String id);
  void clearAllTimerNotifications(List<String> ids);
}

class NoopTimerNativeHooks implements TimerNativeHooks {
  const NoopTimerNativeHooks();
  @override
  void startNativeTimer(ActiveTimer timer) {}
  @override
  void stopNativeTimer(String id) {}
  @override
  void clearAllTimerNotifications(List<String> ids) {}
}

/// Overridden by the native layer when it exists.
final timerNativeHooksProvider = Provider<TimerNativeHooks>((ref) => const NoopTimerNativeHooks());

/// Clock of the timer store (tests override it).
final timerClockProvider = Provider<int Function()>((ref) => () => DateTime.now().millisecondsSinceEpoch);

class TimerState {
  const TimerState({this.activeTimers = const []});
  final List<ActiveTimer> activeTimers;
}

const PersistedEnvelope timerStoreEnvelope = PersistedEnvelope(name: 'anacan-timers');

/// `useTimerStore`.
final timerStoreProvider = NotifierProvider<TimerStore, TimerState>(TimerStore.new);

class TimerStore extends Notifier<TimerState> {
  late LocalStore _store;
  late TimerNativeHooks _native;
  late int Function() _now;

  @override
  TimerState build() {
    _store = ref.watch(localStoreProvider);
    _native = ref.watch(timerNativeHooksProvider);
    _now = ref.watch(timerClockProvider);
    return _hydrate();
  }

  TimerState _hydrate() {
    final persisted = timerStoreEnvelope.read(_store).state;
    final list = persisted?['activeTimers'];
    if (list is! List) return const TimerState();
    return TimerState(activeTimers: [for (final t in list) ?ActiveTimer.tryParse(t)]);
  }

  void rehydrate() => state = _hydrate();

  void _set(List<ActiveTimer> timers) {
    state = TimerState(activeTimers: List.unmodifiable(timers));
    timerStoreEnvelope.write(_store, {'activeTimers': [for (final t in timers) t.toJson()]});
  }

  /// Returns the timer id `<type>-<feedType|main>-<childId|nochild>-<now>`.
  String startTimer(String type, {String? feedType, String? label, String? childId, String? childName}) {
    final now = _now();
    final id = '$type-${feedType ?? 'main'}-${childId ?? 'nochild'}-$now';
    final timer = ActiveTimer(
      id: id,
      type: type,
      feedType: feedType,
      label: label,
      childId: childId,
      childName: childName,
      startTime: now,
    );
    _set([...state.activeTimers, timer]);
    _native.startNativeTimer(timer);
    return id;
  }

  /// `{durationSeconds}` or null when no such timer runs.
  int? stopTimer(String id) {
    ActiveTimer? timer;
    for (final t in state.activeTimers) {
      if (t.id == id) timer = t;
    }
    if (timer == null) return null;
    final durationSeconds = ((_now() - timer.startTime) / 1000).floor();
    _set(state.activeTimers.where((t) => t.id != id).toList());
    _native.stopNativeTimer(id);
    return durationSeconds;
  }

  /// With [childId], only that child's timer; without it, timers without a child (previous
  /// single-child behaviour).
  ActiveTimer? getActiveTimer(String type, {String? feedType, String? childId}) {
    for (final t in state.activeTimers) {
      if (t.type == type && (feedType == null || t.feedType == feedType) && t.childId == childId) return t;
    }
    return null;
  }

  int getElapsedSeconds(String id) {
    for (final t in state.activeTimers) {
      if (t.id == id) return ((_now() - t.startTime) / 1000).floor();
    }
    return 0;
  }

  bool hasAnyActiveTimer() => state.activeTimers.isNotEmpty;

  void clearAllTimers() {
    final timers = state.activeTimers;
    for (final t in timers) {
      _native.stopNativeTimer(t.id);
    }
    _native.clearAllTimerNotifications([for (final t in timers) t.id]);
    _set(const []);
  }
}
