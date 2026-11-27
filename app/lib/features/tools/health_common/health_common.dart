// Ported from: src/lib/native.ts (hapticFeedback.light / medium), src/hooks/useDailyLogs.ts (dailyLogUpsertRow, addLog,
//              updateMood, applyLocalPatch), src/hooks/usePartnerNotifications.ts (notifyMoodUpdate seam),
//              the `supabase.channel(...).on('postgres_changes', ...)` effects and `<a href="tel:|mailto:|https:">`
//              links of the health tools
//
// Seams shared by the health & lifestyle tools (nutrition, exercises, mood, mental health, blood pressure / sugar,
// vitamins, first aid, recipes, shopping, doctors). Every one has a safe default; tests override them.
import 'dart:async';

import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart' show BuildContext, VoidCallback, Widget;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgresChangePayload;
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/realtime.dart';
import '../../../core/net/backend_providers.dart' show supabaseClientProvider;
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../../../shell/links/push_nav.dart' show PushNavIntent;
import '../../../shell/nav/shell_controller.dart' show shellProvider;
import '../../../state/shell_bindings.dart' show backendUrlProvider;
import '../../home/data/daily_logs.dart';
import '../../premium/premium_modal.dart' show showPremiumModal;

/// `useAuth().user?.id`.
final healthUserIdProvider = Provider<String?>((ref) => ref.watch(authUserProvider)?.id);

/// `getBackendConfig().url` (part of some query keys; '' before the backend opened).
final healthBackendUrlProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

/// `hapticFeedback.light()` / `.medium()` (Capacitor Haptics impact).
class HealthHaptics {
  const HealthHaptics({this.light = HapticFeedback.lightImpact, this.medium = HapticFeedback.mediumImpact});
  final Future<void> Function() light;
  final Future<void> Function() medium;
}

final healthHapticsProvider = Provider<HealthHaptics>((ref) => const HealthHaptics());

/// Opens `tel:` / `mailto:` / web links (`<a href>`; web pages in the external browser like `target="_blank"`).
final healthLinkLauncherProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      try {
        await launchUrl(uri, mode: uri.scheme == 'http' || uri.scheme == 'https' ? LaunchMode.externalApplication : LaunchMode.platformDefault);
      } catch (_) {
        // No handler on this device: nothing happens, as a dead link would.
      }
    });

/// `window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: { tool } }))`: opens another tool through the shell.
final healthOpenToolProvider = Provider<void Function(String toolId)>(
    (ref) => (toolId) => ref.read(shellProvider.notifier).dispatchPushEvent(PushNavIntent(tool: toolId)));

/// `<PremiumModal isOpen onClose feature />` opened by a tool. Completes when it closes.
final healthPaywallProvider = Provider<Future<void> Function(BuildContext context, String feature)>(
    (ref) => (context, feature) => showPremiumModal(context, feature: feature));

/// The ad seams of a tool page (phase 9, ads): `<AdSurface id>`, `<AdInlineAnchor id>` and `useAdExit(placement,
/// onLeave, active)`. Defaults: nothing rendered, leaving runs at once.
class HealthAdSlots {
  const HealthAdSlots({this.adSurface, this.adInlineAnchor, this.adExit});
  final Widget Function(BuildContext context, String id)? adSurface;
  final Widget Function(BuildContext context, String id)? adInlineAnchor;
  final Future<void> Function(BuildContext context, String placement, VoidCallback onLeave)? adExit;
}

final healthAdSlotsProvider = Provider<HealthAdSlots>((ref) => const HealthAdSlots());

/// `usePartnerNotifications().notifyMoodUpdate(mood)` (partner feature, phase 6). Default: no-op.
final healthMoodPartnerNotifierProvider = Provider<void Function(int mood)>((ref) => (_) {});

/// Realtime subscription seam (`supabase.channel(...).on('postgres_changes', …).subscribe()`, removed on dispose).
abstract interface class HealthRealtime {
  void subscribe(Ref ref, {required String channelPrefix, required String table, String? filter, required void Function() onChange});
}

class SupabaseHealthRealtime implements HealthRealtime {
  const SupabaseHealthRealtime();

  @override
  void subscribe(Ref ref, {required String channelPrefix, required String table, String? filter, required void Function() onChange}) {
    try {
      subscribePostgresChanges(ref, ref.read(supabaseClientProvider),
          channelPrefix: channelPrefix, table: table, filter: filter, onChange: (PostgresChangePayload _) => onChange());
    } catch (_) {
      // Backend not open (tests / signed out): no live updates, data still loads.
    }
  }
}

final healthRealtimeProvider = Provider<HealthRealtime>((ref) => const SupabaseHealthRealtime());

// ── daily_logs patches (useDailyLogs.addLog / updateMood) ──

/// `dailyLogUpsertRow(userId, patch, today)`: only the keys present are saved (null still clears a field);
/// `log_date` defaults to the phone's local day.
Map<String, Object?> dailyLogUpsertRow(String userId, Map<String, Object?> patch, [String? today]) {
  final logDate = patch['log_date'];
  return {
    ...patch,
    'user_id': userId,
    'log_date': logDate is String && logDate.isNotEmpty ? logDate : (today ?? todayKey()),
  };
}

/// `{ data, error }` of `addLog`.
class DailyLogSaveResult {
  const DailyLogSaveResult({this.data, this.error});
  final Map<String, Object?>? data;
  final Object? error;
}

/// The write half of `useDailyLogs()` that the health tools use (`addLog`, `updateMood`).
class DailyLogActions {
  DailyLogActions(this._ref);
  final Ref _ref;

  /// `addLog(patch)`: queued in the offline outbox first (merge-upsert on user_id,log_date); a confirmed save
  /// reloads the logs, a queued one stays visible through [pendingDailyLogPatch].
  Future<DailyLogSaveResult> addLog(Map<String, Object?> patch) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) return const DailyLogSaveResult(error: 'No user logged in');
    final row = dailyLogUpsertRow(userId, patch);
    final outcome = await _ref.read(offlineOutboxProvider).saveWithOutbox(userId, dailyLogOutboxTable, row);
    if (outcome.status == SaveStatus.error) return DailyLogSaveResult(error: outcome.error);
    if (outcome.status == SaveStatus.saved) {
      try {
        await _ref.read(dailyLogsProvider.notifier).fetchLogs();
      } catch (_) {}
    }
    return DailyLogSaveResult(data: outcome.data);
  }

  /// `updateMood(mood)`: today's mood + the partner notification after a successful save.
  Future<DailyLogSaveResult> updateMood(int mood) async {
    final result = await addLog({'log_date': todayKey(), 'mood': mood});
    if (result.data != null) _ref.read(healthMoodPartnerNotifierProvider)(mood);
    return result;
  }
}

final dailyLogActionsProvider = Provider<DailyLogActions>(DailyLogActions.new);

/// `applyLocalPatch`: the fields of today's patches still queued offline (oldest first, water never included).
Map<String, Object?> pendingDailyLogPatch(OfflineOutbox outbox, String? userId, [String? today]) {
  final day = today ?? todayKey();
  final merged = <String, Object?>{};
  for (final p in outbox.pendingRows(userId, dailyLogOutboxTable)) {
    if (p['log_date'] != day) continue;
    for (final e in p.entries) {
      if (e.key == 'id' || e.key == 'user_id' || e.key == 'water_intake') continue;
      merged[e.key] = e.value;
    }
  }
  return merged;
}

/// Today's daily log as `useDailyLogs().todayLog` shows it: the loaded row with the queued patches applied, or a
/// fresh row when only queued patches exist.
Map<String, dynamic>? visibleTodayDailyLog(Ref ref) {
  final controller = ref.read(dailyLogsProvider.notifier);
  final userId = ref.read(healthUserIdProvider);
  final base = controller.visibleTodayLog();
  final pending = pendingDailyLogPatch(ref.read(offlineOutboxProvider), userId);
  if (pending.isEmpty) return base;
  final today = todayKey();
  return {
    ...(base ??
        {
          'id': '',
          'user_id': userId,
          'log_date': today,
          'mood': null,
          'symptoms': null,
          'water_intake': null,
          'temperature': null,
          'bleeding': null,
          'notes': null,
          'created_at': DateTime.now().toUtc().toIso8601String(),
        }),
    ...pending,
  };
}

/// `logs` of useDailyLogs with today's queued patch merged into today's row (when it is in the list).
List<Map<String, dynamic>> visibleDailyLogs(Ref ref) {
  final logs = ref.read(dailyLogsProvider).logs;
  final pending = pendingDailyLogPatch(ref.read(offlineOutboxProvider), ref.read(healthUserIdProvider));
  if (pending.isEmpty) return logs;
  final today = todayKey();
  return [for (final l in logs) l['log_date'] == today ? {...l, ...pending} : l];
}

/// The visible daily-log view for widgets (rebuilds with the logs and the outbox).
typedef DailyLogsView = ({List<Map<String, dynamic>> logs, Map<String, dynamic>? todayLog, bool loading});

final dailyLogsViewProvider = Provider.autoDispose<DailyLogsView>((ref) {
  final state = ref.watch(dailyLogsProvider);
  return (logs: visibleDailyLogs(ref), todayLog: visibleTodayDailyLog(ref), loading: state.loading);
});
