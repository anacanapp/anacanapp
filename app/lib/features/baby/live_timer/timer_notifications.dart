// Ported from: src/utils/timerNotifications.ts
//
// Fallback ongoing local notification when the Live Activity cannot start. Scheduling goes through
// [TimerNotificationScheduler] (the central local-notification scheduler of the native layer; no-op default).
import '../../../core/i18n/tr.dart';

/// `notifyNow` / `cancelLocalNotificationIds` of src/lib/local-notification-scheduler.ts.
abstract interface class TimerNotificationScheduler {
  /// Shows an ongoing notification now; [ask] = may ask for permission (the user started the timer).
  Future<void> notifyNow({
    required int id,
    required String title,
    required String body,
    bool ongoing = true,
    bool autoCancel = false,
    String smallIcon = 'ic_stat_icon',
    bool ask = true,
  });

  Future<void> cancelIds(List<int> ids);
}

class NoopTimerNotificationScheduler implements TimerNotificationScheduler {
  const NoopTimerNotificationScheduler();
  @override
  Future<void> notifyNow({
    required int id,
    required String title,
    required String body,
    bool ongoing = true,
    bool autoCancel = false,
    String smallIcon = 'ic_stat_icon',
    bool ask = true,
  }) async {}
  @override
  Future<void> cancelIds(List<int> ids) async {}
}

/// `getTimerLabels()`.
Map<String, String> timerTypeLabels() => {
      'sleep': tr('timernotifications_yuxu_eb2b53', '😴 Yuxu'),
      'feeding': tr('timernotifications_emizdirme_af3cc9', '🍼 Əmizdirmə'),
      'diaper': tr('timernotifications_bez_deyisdirme_cfec83', '🧷 Bez dəyişdirmə'),
      'white-noise': tr('timernotifications_kuy_sesi_1de6fc', '🔊 Küy Səsi'),
    };

/// ` (Sol)` / ` (Sağ)` for a feeding side.
String feedSideSuffix(String? feedType) => feedType == null
    ? ''
    : ' (${feedType == 'left' ? tr('timernotifications_sol', 'Sol') : tr('timernotifications_sag_edbe12', 'Sağ')})';

/// `hashTimerId`: stable positive 31-bit id (`(hash << 5) - hash + c | 0`, `Math.abs(hash) % 2147483647 || 1`).
int hashTimerId(String timerId) {
  var hash = 0;
  for (final unit in timerId.codeUnits) {
    hash = (((hash << 5) - hash) + unit).toSigned(32);
  }
  final r = hash.abs() % 2147483647;
  return r == 0 ? 1 : r;
}

class TimerNotifications {
  TimerNotifications(this.scheduler, {required this.isNative});
  final TimerNotificationScheduler scheduler;
  final bool isNative;

  /// `showTimerNotification(timerId, type, label, feedType)`.
  Future<void> show(String timerId, String type, {String? label, String? feedType}) async {
    if (!isNative) return;
    try {
      final title = label ?? timerTypeLabels()[type] ?? 'Timer';
      await scheduler.notifyNow(
        id: hashTimerId(timerId),
        title: '$title${feedSideSuffix(feedType)}',
        body: tr('timernotifications_timer_aktiv_geri_donmek_ucun_t_f7638a', 'Timer aktiv — geri dönmək üçün toxunun'),
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_stat_icon',
        ask: true,
      );
    } catch (_) {
      // Timer notification error: ignored like console.warn
    }
  }

  /// `clearTimerNotification(timerId)`.
  Future<void> clear(String timerId) async {
    if (!isNative) return;
    await scheduler.cancelIds([hashTimerId(timerId)]);
  }

  /// `clearAllTimerNotifications(timerIds)`: only these timers' notifications.
  Future<void> clearAll(List<String> timerIds) async {
    if (!isNative || timerIds.isEmpty) return;
    await scheduler.cancelIds(timerIds.map(hashTimerId).toList());
  }
}
