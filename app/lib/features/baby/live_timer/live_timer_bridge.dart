// Ported from: src/plugins/LiveActivityPlugin.ts
//
// The native lock-screen timer plugin (`LiveActivity`): iOS ActivityKit Live Activity, Android foreground-service
// chronometer notification. The Flutter native layer implements [LiveTimerBridge] (method channel); until then the
// no-op default keeps everything inert (like the web build, where `isNative` is false).
//
// Pending stops are written by the native side under `anacan-pending-timer-stops` (iOS App Group
// `group.com.atlasoon.anacan` UserDefaults, Android SharedPreferences) as a JSON array of [PendingTimerStop].

/// `PendingTimerStop`.
class PendingTimerStop {
  const PendingTimerStop({required this.id, required this.type, this.feedType, required this.startTime, required this.stoppedAt});

  final String id;
  final String type;

  /// 'left' | 'right'.
  final String? feedType;

  /// ms epoch.
  final int startTime;

  /// ms epoch.
  final int stoppedAt;

  /// Parses one entry of the native JSON list; null when malformed.
  static PendingTimerStop? tryParse(Object? value) {
    if (value is! Map) return null;
    final id = value['id'], type = value['type'], start = value['startTime'], stopped = value['stoppedAt'];
    if (id is! String || type is! String || start is! num || stopped is! num) return null;
    final feed = value['feedType'];
    return PendingTimerStop(
      id: id,
      type: type,
      feedType: feed == 'left' || feed == 'right' ? feed as String : null,
      startTime: start.toInt(),
      stoppedAt: stopped.toInt(),
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'type': type,
        if (feedType != null) 'feedType': feedType,
        'startTime': startTime,
        'stoppedAt': stoppedAt,
      };
}

/// `startActivity` options.
class LiveActivityStart {
  const LiveActivityStart({
    required this.id,
    required this.type,
    required this.label,
    this.subLabel,
    this.stopLabel,
    required this.startTime,
    this.feedType,
    this.channelName,
    this.channelDesc,
  });

  final String id;
  final String type;
  final String label;

  /// Android notification sub text.
  final String? subLabel;

  /// Android "Dayandır" button text.
  final String? stopLabel;

  /// ms epoch.
  final int startTime;
  final String? feedType;

  /// Android channel name / description (localized).
  final String? channelName;
  final String? channelDesc;

  Map<String, Object?> toJson() => {
        'id': id,
        'type': type,
        'label': label,
        if (subLabel != null) 'subLabel': subLabel,
        if (stopLabel != null) 'stopLabel': stopLabel,
        'startTime': startTime,
        if (feedType != null) 'feedType': feedType,
        if (channelName != null) 'channelName': channelName,
        if (channelDesc != null) 'channelDesc': channelDesc,
      };
}

/// `LiveActivityPlugin`. Every call may throw (plugin missing, Live Activities disabled, …).
abstract interface class LiveTimerBridge {
  /// False on the web / in tests: the React code returns early when `!isNative`.
  bool get isNative;

  /// `startActivity(options)`.
  Future<void> startActivity(LiveActivityStart options);

  /// `stopActivity({ timerId })`; without [timerId] stops all.
  Future<void> stopActivity({String? timerId});

  /// `getPendingStops()` → `{ stops }`.
  Future<List<PendingTimerStop>> getPendingStops();

  /// `clearPendingStops()`.
  Future<void> clearPendingStops();

  /// `addListener('timerStopped', listener)` (Android, while the app is open). Returns `remove`.
  Future<void Function()> addTimerStoppedListener(void Function(PendingTimerStop stop) listener);
}

/// Default: no native plugin (behaves like the web build).
class NoopLiveTimerBridge implements LiveTimerBridge {
  const NoopLiveTimerBridge();
  @override
  bool get isNative => false;
  @override
  Future<void> startActivity(LiveActivityStart options) async {}
  @override
  Future<void> stopActivity({String? timerId}) async {}
  @override
  Future<List<PendingTimerStop>> getPendingStops() async => const [];
  @override
  Future<void> clearPendingStops() async {}
  @override
  Future<void Function()> addTimerStoppedListener(void Function(PendingTimerStop stop) listener) async => () {};
}
