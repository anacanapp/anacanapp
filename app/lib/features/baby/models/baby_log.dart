// Ported from: src/hooks/useBabyLogs.ts (BabyLog, FeedingHistoryItem, mergePendingBabyLogs, getTodayStats,
//              getFeedingHistory, getTodayFeedingBreakdown)
//
// Pure model + derivations; the provider in hooks/use_baby_logs.dart feeds them with server rows and the
// offline outbox.
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';

/// `BabyLog` (`baby_logs` row; [pending] while it only exists in the offline outbox).
class BabyLog {
  const BabyLog({
    required this.id,
    required this.userId,
    this.childId,
    required this.logType,
    required this.startTime,
    this.endTime,
    this.feedType,
    this.diaperType,
    this.notes,
    this.amountMl,
    required this.createdAt,
    this.pending = false,
  });

  factory BabyLog.fromRow(Map<String, dynamic> row, {bool pending = false}) => BabyLog(
        id: row['id'] as String? ?? '',
        userId: row['user_id'] as String? ?? '',
        childId: row['child_id'] as String?,
        logType: row['log_type'] as String? ?? '',
        startTime: row['start_time'] as String? ?? '',
        endTime: row['end_time'] as String?,
        feedType: row['feed_type'] as String?,
        diaperType: row['diaper_type'] as String?,
        notes: row['notes'] as String?,
        amountMl: row['amount_ml'] as num?,
        createdAt: row['created_at'] as String? ?? row['start_time'] as String? ?? '',
        pending: pending || row['pending'] == true,
      );

  final String id;
  final String userId;
  final String? childId;

  /// 'feeding' | 'sleep' | 'diaper'.
  final String logType;
  final String startTime;
  final String? endTime;
  final String? feedType;
  final String? diaperType;
  final String? notes;

  /// Optional column some rows carry (`(l as any).amount_ml`).
  final num? amountMl;
  final String createdAt;
  final bool pending;

  Map<String, dynamic> toRow() => {
        'id': id,
        'user_id': userId,
        'child_id': childId,
        'log_type': logType,
        'start_time': startTime,
        'end_time': endTime,
        'feed_type': feedType,
        'diaper_type': diaperType,
        'notes': notes,
        if (amountMl != null) 'amount_ml': amountMl,
        'created_at': createdAt,
        if (pending) 'pending': true,
      };

  DateTime? get start => jsParseDate(startTime);
  DateTime? get end => endTime == null ? null : jsParseDate(endTime!);
}

const int _recentWindowMs = 7 * 24 * 60 * 60 * 1000;

/// `localDayOf(iso)`: local YYYY-MM-DD of an ISO timestamp.
String localDayOf(String iso) {
  final d = jsParseDate(iso);
  if (d == null) return 'NaN-NaN-NaN';
  final l = d.toLocal();
  return '${l.year}-${pad2(l.month)}-${pad2(l.day)}';
}

/// Server rows plus rows still waiting in the offline outbox (marked pending), limited like the server
/// query (same user, selected child, last 7 days), newest first. A server row always wins over a queued row
/// with the same id.
List<BabyLog> mergePendingBabyLogs(
  List<BabyLog> serverLogs,
  List<Map<String, Object?>> pendingRows,
  String userId,
  String? childId, [
  int? now,
]) {
  final known = {for (final l in serverLogs) l.id};
  final since = (now ?? DomainClock.nowMs()) - _recentWindowMs;
  final pending = <BabyLog>[];
  for (final row in pendingRows) {
    final id = row['id'];
    if (id is! String || known.contains(id) || row['user_id'] != userId) continue;
    if (childId != null && childId.isNotEmpty && row['child_id'] != childId) continue;
    final start = row['start_time'];
    if (start is! String) continue;
    final ms = jsParseDate(start)?.millisecondsSinceEpoch;
    if (ms == null || ms < since) continue;
    pending.add(BabyLog.fromRow({
      'end_time': null,
      'feed_type': null,
      'diaper_type': null,
      'notes': null,
      'child_id': null,
      ...row,
      'created_at': row['created_at'] ?? start,
    }, pending: true));
  }
  if (pending.isEmpty) return serverLogs;
  // `[...pending, ...server].sort((a, b) => b.start_time.localeCompare(a.start_time))` (stable).
  return jsSorted<BabyLog>([...pending, ...serverLogs], (a, b) => b.startTime.compareTo(a.startTime));
}

/// Logs whose start falls on today's local day.
List<BabyLog> todayLogsOf(List<BabyLog> logs, [DateTime? now]) {
  final today = localDateKey(now ?? DomainClock.now());
  return [for (final l in logs) if (localDayOf(l.startTime) == today) l];
}

int _durationSeconds(BabyLog log) {
  final s = log.start, e = log.end;
  if (s == null || e == null) return 0;
  return jsRoundInt((e.millisecondsSinceEpoch - s.millisecondsSinceEpoch) / 1000);
}

bool _isLeft(String? t) => t == 'breast_left' || t == 'left';
bool _isRight(String? t) => t == 'breast_right' || t == 'right';

/// Return value of `getTodayStats()`.
class TodayStats {
  const TodayStats({
    required this.feedingCount,
    required this.breastFeedingCount,
    required this.formulaCount,
    required this.solidCount,
    required this.sleepHours,
    required this.sleepMinutes,
    required this.diaperCount,
    required this.wetCount,
    required this.dirtyCount,
    required this.bothCount,
    required this.feedingLogs,
    required this.sleepLogs,
    required this.diaperLogs,
  });

  final int feedingCount;
  final int breastFeedingCount;
  final int formulaCount;
  final int solidCount;
  final double sleepHours;
  final int sleepMinutes;
  final int diaperCount;
  final int wetCount;
  final int dirtyCount;
  final int bothCount;
  final List<BabyLog> feedingLogs;
  final List<BabyLog> sleepLogs;
  final List<BabyLog> diaperLogs;

  BabyLog? get lastFeeding => feedingLogs.firstOrNull;
  BabyLog? get lastSleep => sleepLogs.firstOrNull;
  BabyLog? get lastDiaper => diaperLogs.firstOrNull;
}

/// `getTodayStats()` over today's logs.
TodayStats todayStatsOf(List<BabyLog> todayLogs) {
  final feeding = [for (final l in todayLogs) if (l.logType == 'feeding') l];
  final sleep = [for (final l in todayLogs) if (l.logType == 'sleep') l];
  final diaper = [for (final l in todayLogs) if (l.logType == 'diaper') l];
  var totalSleepMinutes = 0.0;
  for (final log in sleep) {
    if (log.endTime != null) {
      final s = log.start, e = log.end;
      if (s != null && e != null) totalSleepMinutes += (e.millisecondsSinceEpoch - s.millisecondsSinceEpoch) / 60000;
    }
  }
  return TodayStats(
    feedingCount: feeding.length,
    breastFeedingCount: feeding.where((l) => _isLeft(l.feedType) || _isRight(l.feedType)).length,
    formulaCount: feeding.where((l) => l.feedType == 'formula').length,
    solidCount: feeding.where((l) => l.feedType == 'solid').length,
    sleepHours: jsRound(totalSleepMinutes / 60 * 10) / 10,
    sleepMinutes: jsRoundInt(totalSleepMinutes),
    diaperCount: diaper.length,
    wetCount: diaper.where((l) => l.diaperType == 'wet').length,
    dirtyCount: diaper.where((l) => l.diaperType == 'dirty').length,
    bothCount: diaper.where((l) => l.diaperType == 'mixed').length,
    feedingLogs: feeding,
    sleepLogs: sleep,
    diaperLogs: diaper,
  );
}

/// `FeedingHistoryItem`.
class FeedingHistoryItem {
  const FeedingHistoryItem({
    required this.id,
    required this.feedType,
    required this.startTime,
    this.endTime,
    required this.durationSeconds,
    required this.date,
    this.notes,
    this.pending = false,
  });

  final String id;

  /// 'left' | 'right' | 'formula' | 'solid'.
  final String feedType;
  final DateTime startTime;
  final DateTime? endTime;
  final int durationSeconds;
  final String date;
  final String? notes;
  final bool pending;
}

/// `getFeedingHistory(days)`: date key (today, yesterday, …) → feedings of that local day.
Map<String, List<FeedingHistoryItem>> feedingHistoryOf(List<BabyLog> logs, [int days = 3]) {
  final dates = [for (var i = 0; i < days; i++) daysAgoKey(i)];
  final map = <String, List<FeedingHistoryItem>>{for (final d in dates) d: []};
  for (final log in logs) {
    if (log.logType != 'feeding') continue;
    final start = log.start;
    if (start == null) continue;
    final dateStr = localDateKey(start.toLocal());
    if (!dates.contains(dateStr)) continue;
    var feedType = 'left';
    if (_isLeft(log.feedType)) {
      feedType = 'left';
    } else if (_isRight(log.feedType)) {
      feedType = 'right';
    } else if (log.feedType == 'formula') {
      feedType = 'formula';
    } else if (log.feedType == 'solid') {
      feedType = 'solid';
    }
    map[dateStr]!.add(FeedingHistoryItem(
      id: log.id,
      feedType: feedType,
      startTime: start.toLocal(),
      endTime: log.end?.toLocal(),
      durationSeconds: _durationSeconds(log),
      date: dateStr,
      notes: log.notes,
      pending: log.pending,
    ));
  }
  return map;
}

/// `getTodayFeedingBreakdown`.
class FeedingBreakdown {
  const FeedingBreakdown({
    this.leftCount = 0,
    this.rightCount = 0,
    this.leftTotalSeconds = 0,
    this.rightTotalSeconds = 0,
    this.formulaCount = 0,
    this.solidCount = 0,
  });
  final int leftCount;
  final int rightCount;
  final int leftTotalSeconds;
  final int rightTotalSeconds;
  final int formulaCount;
  final int solidCount;
  int get totalBreastFeedings => leftCount + rightCount;
  int get totalBreastSeconds => leftTotalSeconds + rightTotalSeconds;
}

FeedingBreakdown feedingBreakdownOf(List<BabyLog> todayLogs) {
  var left = 0, right = 0, leftS = 0, rightS = 0, formula = 0, solid = 0;
  for (final log in todayLogs) {
    if (log.logType != 'feeding') continue;
    final d = _durationSeconds(log);
    if (_isLeft(log.feedType)) {
      left++;
      leftS += d;
    } else if (_isRight(log.feedType)) {
      right++;
      rightS += d;
    } else if (log.feedType == 'formula') {
      formula++;
    } else if (log.feedType == 'solid') {
      solid++;
    }
  }
  return FeedingBreakdown(
    leftCount: left,
    rightCount: right,
    leftTotalSeconds: leftS,
    rightTotalSeconds: rightS,
    formulaCount: formula,
    solidCount: solid,
  );
}
