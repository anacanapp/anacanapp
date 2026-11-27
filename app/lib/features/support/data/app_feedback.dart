// Ported from: src/lib/app-feedback.ts, src/lib/prompt-day.ts
//
// In-app feedback (1–5 stars + reasons + text) sent as a support ticket (category `app_feedback`). Timestamps and
// the shared once-a-day prompt marker live in LocalStore under the React localStorage keys.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/data/data.dart';
import '../../../state/state.dart';

const List<String> kLowReasons = ['crash', 'bug', 'slow', 'missing', 'content', 'ads', 'price', 'hard', 'other'];
const List<String> kHighReasons = ['tracking', 'content', 'ai', 'community', 'partner', 'design', 'other'];

const String kFeedbackSentKey = 'anacan.feedback.sentAt';
const String kFeedbackDismissedKey = 'anacan.feedback.dismissedAt';
const String kFirstOpenKey = 'anacan.review.firstOpenAt';
const String kPromptDayKey = 'anacan.prompt.lastShownDay';
const int _day = 86400000;

/// `feedbackPromptDue(o)`: from day 14, ≥ 5 sessions, never after a send, not within 90 days of a dismissal,
/// not within 7 days of a store request, never in loss recovery.
bool feedbackPromptDue({
  required int now,
  required int? firstUseAt,
  required int sessions,
  required int? sentAt,
  required int? dismissedAt,
  required int? lastStoreRequestAt,
  required bool lossRecovery,
}) {
  if (lossRecovery || firstUseAt == null || firstUseAt == 0 || sessions < 5) return false;
  if (now - firstUseAt < 14 * _day) return false;
  if (sentAt != null && sentAt != 0) return false;
  if (dismissedAt != null && dismissedAt != 0 && now - dismissedAt < 90 * _day) return false;
  if (lastStoreRequestAt != null && lastStoreRequestAt != 0 && now - lastStoreRequestAt < 7 * _day) return false;
  return true;
}

/// `today(now)` of prompt-day.ts: `Y-M-D` without zero padding.
String promptDayKey(DateTime now) => '${now.year}-${now.month}-${now.day}';

class FeedbackStore {
  FeedbackStore(this.store, {int Function()? now}) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);
  final LocalStore store;
  final int Function() _now;

  int? _read(String k) {
    final v = num.tryParse(store.getItem(k) ?? '');
    return v == null || v == 0 ? null : v.toInt();
  }

  void _write(String k) => store.setItem(k, '${_now()}');

  bool promptShownToday([DateTime? now]) => store.getItem(kPromptDayKey) == promptDayKey(now ?? DateTime.fromMillisecondsSinceEpoch(_now()));
  void markPromptShown([DateTime? now]) => store.setItem(kPromptDayKey, promptDayKey(now ?? DateTime.fromMillisecondsSinceEpoch(_now())));

  /// `noteFirstOpen()`.
  void noteFirstOpen() {
    if (store.getItem(kFirstOpenKey) == null) _write(kFirstOpenKey);
  }

  /// `shouldAutoPromptFeedback({accountCreatedAt, lossRecovery})`.
  bool shouldAutoPromptFeedback({String? accountCreatedAt, bool lossRecovery = false}) {
    if (promptShownToday()) return false;
    final firstOpen = _read(kFirstOpenKey);
    final created = accountCreatedAt == null ? null : DateTime.tryParse(accountCreatedAt)?.millisecondsSinceEpoch;
    final firstUse = [firstOpen, created].whereType<int>().where((x) => x != 0).toList();
    final sessions = num.tryParse(store.getItem('anacan_app_usage_count') ?? '')?.toInt() ?? 0;
    return feedbackPromptDue(
      now: _now(),
      firstUseAt: firstUse.isEmpty ? null : firstUse.reduce((a, b) => a < b ? a : b),
      sessions: sessions,
      sentAt: _read(kFeedbackSentKey),
      dismissedAt: _read(kFeedbackDismissedKey),
      lastStoreRequestAt: null,
      lossRecovery: lossRecovery,
    );
  }

  void markFeedbackDismissed() => _write(kFeedbackDismissedKey);
  void markFeedbackSent() => _write(kFeedbackSentKey);
}

final feedbackStoreProvider = Provider<FeedbackStore>((ref) => FeedbackStore(ref.watch(localStoreProvider)));

/// Platform and version shown in the ticket footer.
abstract interface class AppInfoSource {
  String get platform;
  Future<String> version();
}

class PackageAppInfoSource implements AppInfoSource {
  const PackageAppInfoSource();
  @override
  String get platform => switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'ios',
        TargetPlatform.android => 'android',
        _ => 'web',
      };
  @override
  Future<String> version() async {
    try {
      final info = await PackageInfo.fromPlatform();
      return '${info.version} (${info.buildNumber})';
    } catch (_) {
      return '';
    }
  }
}

final appInfoSourceProvider = Provider<AppInfoSource>((ref) => const PackageAppInfoSource());

/// Ticket body of `sendAppFeedback`.
Map<String, dynamic> buildFeedbackTicket({
  required String userId,
  required int rating,
  required List<String> reasons,
  required String message,
  required String subject,
  required String platform,
  required String version,
  String? lifeStage,
  String? language,
}) {
  final stars = '${'★' * rating}${'☆' * (5 - rating)}';
  final lines = <String>[
    '$stars ($rating/5)',
    if (reasons.isNotEmpty) 'Reasons: ${reasons.join(', ')}',
    if (message.trim().isNotEmpty) '\n${message.trim()}',
    '\n— $platform${version.isNotEmpty ? ' $version' : ''} · ${lifeStage ?? ''} · ${language ?? ''}',
  ];
  String cut(String s, int n) => s.length > n ? s.substring(0, n) : s;
  return {
    'user_id': userId,
    'subject': cut('$subject $rating★', 200),
    'message': cut(lines.join('\n'), 4000),
    'category': 'app_feedback',
    'priority': rating <= 2 ? 'high' : rating == 3 ? 'normal' : 'low',
    'status': 'open',
  };
}

/// Inserts a `support_tickets` row (throws on error).
typedef TicketInserter = Future<void> Function(Map<String, dynamic> row);

final ticketInserterProvider = Provider<TicketInserter>((ref) => (row) async {
      final db = ref.read(dbProvider);
      await db.from('support_tickets').insert(row);
    });

/// `sendAppFeedback(o)`.
class FeedbackSender {
  FeedbackSender(this._ref);
  final Ref _ref;

  Future<void> send({
    required String userId,
    required int rating,
    required List<String> reasons,
    required String message,
    required String subject,
    String? lifeStage,
    String? language,
  }) async {
    final info = _ref.read(appInfoSourceProvider);
    final version = info.platform == 'web' ? '' : await info.version();
    await _ref.read(ticketInserterProvider)(buildFeedbackTicket(
      userId: userId,
      rating: rating,
      reasons: reasons,
      message: message,
      subject: subject,
      platform: info.platform,
      version: version,
      lifeStage: lifeStage,
      language: language,
    ));
    _ref.read(feedbackStoreProvider).markFeedbackSent();
  }
}

final feedbackSenderProvider = Provider<FeedbackSender>((ref) => FeedbackSender(ref));
