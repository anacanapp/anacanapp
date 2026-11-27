// Ported from: src/hooks/useNotificationSettings.ts, src/hooks/useSilentHours.ts, src/hooks/usePushNotifications.ts,
//              src/hooks/usePrivacyPreferences.ts
//
// The `user_preferences` settings on the query cache. React kept them in component state (one select per mount);
// here each group is a query (`['user-preferences', <group>, uid]`, never persisted: it is per-account settings)
// and updates are optimistic `setQueryData` writes with the same revert-on-error rules. Side effects (local
// reminder scheduling, analytics consent event) go through injected interfaces.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../state/state.dart';

/// `user_preferences` access.
abstract interface class UserPreferencesRepository {
  /// `select(columns).eq('user_id').maybeSingle()`; null when there is no row.
  Future<Map<String, dynamic>?> select(String userId, String columns);

  /// `update(values).eq('user_id')`; throws [PostgrestException] on error.
  Future<void> update(String userId, Map<String, dynamic> values);

  Future<void> insert(Map<String, dynamic> row);

  /// `upsert({user_id, ...values}, onConflict: 'user_id')`; throws on error.
  Future<void> upsert(String userId, Map<String, dynamic> values);
}

class SupabaseUserPreferencesRepository implements UserPreferencesRepository {
  SupabaseUserPreferencesRepository(this._db);
  final Db _db;
  @override
  Future<Map<String, dynamic>?> select(String userId, String columns) async =>
      asRow(await _db.from('user_preferences').select(columns).eq('user_id', userId).maybeSingle());
  @override
  Future<void> update(String userId, Map<String, dynamic> values) async => _db.from('user_preferences').update(values).eq('user_id', userId);
  @override
  Future<void> insert(Map<String, dynamic> row) async => _db.from('user_preferences').insert(row);
  @override
  Future<void> upsert(String userId, Map<String, dynamic> values) async =>
      _db.from('user_preferences').upsert({'user_id': userId, ...values}, onConflict: 'user_id');
}

final userPreferencesRepositoryProvider = Provider<UserPreferencesRepository>((ref) => SupabaseUserPreferencesRepository(ref.watch(dbProvider)));

/// update → on PGRST116 insert, as the hooks do; other errors rethrow.
Future<void> _updateOrInsert(UserPreferencesRepository repo, String userId, Map<String, dynamic> values) async {
  try {
    await repo.update(userId, values);
  } on PostgrestException catch (e) {
    if (e.code == 'PGRST116') {
      await repo.insert({'user_id': userId, ...values});
    } else {
      rethrow;
    }
  }
}

// ── Notification settings ─────────────────────────────────────────────────────────────────────────────────────

class NotificationSettings {
  const NotificationSettings({
    this.notificationsEnabled = true,
    this.soundEnabled = true,
    this.vibrationEnabled = true,
    this.waterReminder = true,
    this.vitaminReminder = true,
    this.exerciseReminder = false,
    this.vitaminTime = '09:00',
    this.exerciseDays = const <int>[1, 3, 5],
  });

  factory NotificationSettings.fromRow(Map<String, dynamic> d) => NotificationSettings(
        notificationsEnabled: d['notifications_enabled'] as bool? ?? true,
        soundEnabled: d['sound_enabled'] as bool? ?? true,
        vibrationEnabled: d['vibration_enabled'] as bool? ?? true,
        waterReminder: d['water_reminder'] as bool? ?? true,
        vitaminReminder: d['vitamin_reminder'] as bool? ?? true,
        exerciseReminder: d['exercise_reminder'] as bool? ?? false,
        vitaminTime: d['vitamin_time'] as String? ?? '09:00',
        exerciseDays: (d['exercise_days'] as List?)?.map((e) => (e as num).toInt()).toList() ?? const <int>[1, 3, 5],
      );

  final bool notificationsEnabled;
  final bool soundEnabled;
  final bool vibrationEnabled;
  final bool waterReminder;
  final bool vitaminReminder;
  final bool exerciseReminder;
  final String vitaminTime;
  final List<int> exerciseDays;

  Map<String, dynamic> toRow() => {
        'notifications_enabled': notificationsEnabled,
        'sound_enabled': soundEnabled,
        'vibration_enabled': vibrationEnabled,
        'water_reminder': waterReminder,
        'vitamin_reminder': vitaminReminder,
        'exercise_reminder': exerciseReminder,
        'vitamin_time': vitaminTime,
        'exercise_days': exerciseDays,
      };

  NotificationSettings withValue(String key, Object? value) => NotificationSettings.fromRow({...toRow(), key: value});
}

const String _notificationColumns =
    'notifications_enabled, sound_enabled, vibration_enabled, water_reminder, vitamin_reminder, exercise_reminder, vitamin_time, exercise_days';

final notificationSettingsQuery = queryProvider<NotificationSettings>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<NotificationSettings>(
    queryKey: ['user-preferences', 'notifications', uid],
    enabled: uid != null,
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async {
      try {
        final row = await ref.read(userPreferencesRepositoryProvider).select(uid!, _notificationColumns);
        return row == null ? const NotificationSettings() : NotificationSettings.fromRow(row);
      } catch (_) {
        return const NotificationSettings();
      }
    },
  );
});

/// One local notification (`DesiredNotification` of local-notification-scheduler.ts).
class DesiredNotification {
  const DesiredNotification({required this.id, required this.title, required this.body, required this.at, this.repeat});
  final int id;
  final String title;
  final String body;
  final DateTime at;

  /// `'day'` for daily repeats.
  final String? repeat;
}

/// Native local-notification side of the settings (the local-notification scheduler feature implements it).
abstract interface class ReminderScheduler {
  /// `localNotifications.scheduleWaterReminder({ask})` (one daily 10:00 reminder).
  Future<void> scheduleWaterReminder({bool ask = false});
  Future<void> cancelWaterReminders();
  Future<void> cancelAll();

  /// `setLocalNotifications(group, list, {ask, cancelIds})`.
  Future<void> setLocalNotifications(String group, List<DesiredNotification> list, {bool ask = false, List<int>? cancelIds});

  /// `checkPermissions().display` ('granted' | 'denied' | 'prompt').
  Future<String> displayPermission();
}

class NoopReminderScheduler implements ReminderScheduler {
  const NoopReminderScheduler();
  @override
  Future<void> cancelAll() async {}
  @override
  Future<void> cancelWaterReminders() async {}
  @override
  Future<String> displayPermission() async => 'granted';
  @override
  Future<void> scheduleWaterReminder({bool ask = false}) async {}
  @override
  Future<void> setLocalNotifications(String group, List<DesiredNotification> list, {bool ask = false, List<int>? cancelIds}) async {}
}

final reminderSchedulerProvider = Provider<ReminderScheduler>((ref) => const NoopReminderScheduler());

final List<int> kExerciseIds = List<int>.generate(7, (i) => 300 + i);

/// Daily vitamin reminder at [time] (`HH:MM`), today when still ahead, else tomorrow.
DesiredNotification planVitaminReminder(DateTime now, String time, {required String title, required String body}) {
  final parts = time.split(':').map(int.parse).toList();
  var at = DateTime(now.year, now.month, now.day, parts[0], parts[1]);
  if (!at.isAfter(now)) at = DateTime(now.year, now.month, now.day + 1, parts[0], parts[1]);
  return DesiredNotification(id: 200, title: title, body: body, at: at, repeat: 'day');
}

/// Exercise reminders for the next 7 days at 10:00 on [days] (0 = Sunday), ids 300 + offset.
List<DesiredNotification> planExerciseReminders(DateTime now, List<int> days, {required String title, required String body}) => [
      for (var i = 0; i < 7; i++)
        if (days.contains(DateTime(now.year, now.month, now.day + i).weekday % 7))
          if (DateTime(now.year, now.month, now.day + i, 10).isAfter(now))
            DesiredNotification(id: 300 + i, title: title, body: body, at: DateTime(now.year, now.month, now.day + i, 10)),
    ];

// ── Silent hours ──────────────────────────────────────────────────────────────────────────────────────────────

class SilentHoursSettings {
  const SilentHoursSettings({this.enabled = false, this.startTime = '22:00', this.endTime = '08:00'});
  final bool enabled;
  final String startTime;
  final String endTime;
  SilentHoursSettings copyWith({bool? enabled, String? startTime, String? endTime}) =>
      SilentHoursSettings(enabled: enabled ?? this.enabled, startTime: startTime ?? this.startTime, endTime: endTime ?? this.endTime);
  Map<String, Object?> toJson() => {'enabled': enabled, 'startTime': startTime, 'endTime': endTime};
}

final silentHoursQuery = queryProvider<SilentHoursSettings>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<SilentHoursSettings>(
    queryKey: ['user-preferences', 'silent-hours', uid],
    enabled: uid != null,
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async {
      try {
        final d = await ref.read(userPreferencesRepositoryProvider).select(uid!, 'silent_hours_enabled, silent_hours_start, silent_hours_end');
        if (d == null) return const SilentHoursSettings();
        return SilentHoursSettings(
          enabled: d['silent_hours_enabled'] as bool? ?? false,
          startTime: d['silent_hours_start'] as String? ?? '22:00',
          endTime: d['silent_hours_end'] as String? ?? '08:00',
        );
      } catch (_) {
        return const SilentHoursSettings();
      }
    },
  );
});

/// `isInSilentHours()` (overnight ranges wrap).
bool isInSilentHours(SilentHoursSettings s, DateTime now) {
  if (!s.enabled) return false;
  int mins(String t) {
    final p = t.split(':').map(int.parse).toList();
    return p[0] * 60 + p[1];
  }

  final current = now.hour * 60 + now.minute;
  final start = mins(s.startTime);
  final end = mins(s.endTime);
  return start > end ? current >= start || current < end : current >= start && current < end;
}

// ── Push settings ─────────────────────────────────────────────────────────────────────────────────────────────

class PushSettings {
  const PushSettings({this.pushEnabled = true, this.pushMessages = true, this.pushLikes = true, this.pushComments = true, this.pushCommunity = true});
  factory PushSettings.fromRow(Map<String, dynamic> d) => PushSettings(
        pushEnabled: d['push_enabled'] as bool? ?? true,
        pushMessages: d['push_messages'] as bool? ?? true,
        pushLikes: d['push_likes'] as bool? ?? true,
        pushComments: d['push_comments'] as bool? ?? true,
        pushCommunity: d['push_community'] as bool? ?? true,
      );
  final bool pushEnabled;
  final bool pushMessages;
  final bool pushLikes;
  final bool pushComments;
  final bool pushCommunity;
  Map<String, dynamic> toRow() => {
        'push_enabled': pushEnabled,
        'push_messages': pushMessages,
        'push_likes': pushLikes,
        'push_comments': pushComments,
        'push_community': pushCommunity,
      };
  PushSettings withValue(String key, bool value) => PushSettings.fromRow({...toRow(), key: value});
}

final pushSettingsQuery = queryProvider<PushSettings>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<PushSettings>(
    queryKey: ['user-preferences', 'push', uid],
    enabled: uid != null,
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async {
      try {
        final d = await ref.read(userPreferencesRepositoryProvider).select(uid!, 'push_enabled, push_messages, push_likes, push_comments, push_community');
        return d == null ? const PushSettings() : PushSettings.fromRow(d);
      } catch (_) {
        return const PushSettings();
      }
    },
  );
});

// ── Privacy preferences ───────────────────────────────────────────────────────────────────────────────────────

const Map<String, bool> kDefaultPrivacy = {
  'privacy_profile_visible': true,
  'privacy_show_in_community': true,
  'privacy_allow_messages': true,
  'privacy_share_analytics': false,
  'privacy_location_sharing': true,
  'privacy_notification_sounds': true,
};

final privacyPreferencesQuery = queryProvider<Map<String, bool>>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<Map<String, bool>>(
    queryKey: ['user-preferences', 'privacy', uid],
    enabled: uid != null,
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async {
      final next = Map<String, bool>.of(kDefaultPrivacy);
      try {
        final d = await ref.read(userPreferencesRepositoryProvider).select(uid!, kDefaultPrivacy.keys.join(', '));
        if (d != null) {
          for (final k in kDefaultPrivacy.keys) {
            if (d[k] is bool) next[k] = d[k] as bool;
          }
        }
      } catch (_) {}
      return next;
    },
  );
});

/// `CUSTOMER_IO_CONSENT_EVENT` listener (analytics feature).
typedef AnalyticsConsentNotifier = void Function({required String userId, required bool allowed});

final analyticsConsentNotifierProvider = Provider<AnalyticsConsentNotifier>((ref) => ({required userId, required allowed}) {});

// ── Actions ───────────────────────────────────────────────────────────────────────────────────────────────────

/// The `update*` functions of the four hooks.
class SettingsActions {
  SettingsActions(this._ref);
  final Ref _ref;

  QueryClient get _qc => _ref.read(queryClientProvider);
  UserPreferencesRepository get _repo => _ref.read(userPreferencesRepositoryProvider);
  String? get _uid => _ref.read(authUserProvider)?.id;

  /// `useNotificationSettings().updateSetting(key, value)`; returns the toast to show (or null).
  Future<({String kind, String text})?> updateNotificationSetting(String key, Object value, {required String Function(String, String) tr, DateTime? now}) async {
    final uid = _uid;
    if (uid == null) return null;
    final queryKey = ['user-preferences', 'notifications', uid];
    final prev = _qc.getQueryData<NotificationSettings>(queryKey) ?? const NotificationSettings();
    final next = prev.withValue(key, value);
    _qc.setQueryDataValue(queryKey, next);
    try {
      await _updateOrInsert(_repo, uid, {key: value});
    } catch (_) {
      _qc.setQueryDataValue(queryKey, prev);
      return null;
    }
    final scheduler = _ref.read(reminderSchedulerProvider);
    final native = _ref.read(_nativeProvider);
    if (key == 'notifications_enabled' && value == false) {
      if (native) await scheduler.cancelAll();
      return (kind: 'info', text: tr('usenotificationsettings_butun_bildirisler_deaktiv_edil_085777', 'Bütün bildirişlər deaktiv edildi'));
    }
    ({String kind, String text})? toast;
    if (key == 'water_reminder') {
      _ref.read(localStoreProvider).setItem('anacan_water_reminder_enabled', value == true ? 'true' : 'false');
      if (value == true) {
        // Stale closure of the hook: scheduleWaterReminders checks the previous settings (kept for parity).
        if (prev.notificationsEnabled && prev.waterReminder && native) await scheduler.scheduleWaterReminder(ask: true);
        toast = (kind: 'success', text: tr('usenotificationsettings_su_xatirlatmalari_aktivlesdiri_dd0c67', 'Su xatırlatmaları aktivləşdirildi'));
      } else {
        if (native) await scheduler.cancelWaterReminders();
        toast = (kind: 'info', text: tr('usenotificationsettings_su_xatirlatmalari_deaktiv_edil_153c1c', 'Su xatırlatmaları deaktiv edildi'));
      }
    }
    if (key == 'vitamin_reminder' || key == 'vitamin_time') {
      if (next.vitaminReminder) {
        await _scheduleVitamin(prev, ask: true, tr: tr, now: now);
        toast = (kind: 'success', text: tr('usenotificationsettings_vitamin_xatirlatmasi_aktivlesd_866e4a', 'Vitamin xatırlatması aktivləşdirildi'));
      } else if (native) {
        await scheduler.setLocalNotifications('vitamin', const <DesiredNotification>[]);
      }
    }
    if (key == 'exercise_reminder' || key == 'exercise_days') {
      if (next.exerciseReminder) {
        await _scheduleExercise(prev, ask: true, tr: tr, now: now);
        toast = (kind: 'success', text: tr('usenotificationsettings_mesq_xatirlatmalari_aktivlesdi_ea41d4', 'Məşq xatırlatmaları aktivləşdirildi'));
      } else if (native) {
        await scheduler.setLocalNotifications('exercise', const <DesiredNotification>[], cancelIds: kExerciseIds);
      }
    }
    return toast;
  }

  // The scheduling callbacks of the hook close over the settings of the render that created them (the previous
  // ones), exactly like the React useCallback dependencies.
  Future<void> _scheduleVitamin(NotificationSettings s, {bool ask = false, required String Function(String, String) tr, DateTime? now}) async {
    if (!s.notificationsEnabled || !s.vitaminReminder || !_ref.read(_nativeProvider)) return;
    await _ref.read(reminderSchedulerProvider).setLocalNotifications('vitamin', [
      planVitaminReminder(now ?? DateTime.now(), s.vitaminTime,
          title: tr('usenotificationsettings_vitamin_vaxti_9bfc40', 'Vitamin vaxtı! 💊'),
          body: tr('usenotificationsettings_gundelik_vitaminlerinizi_qebul_6a3811', 'Gündəlik vitaminlərinizi qəbul etməyi unutmayın.')),
    ], ask: ask);
  }

  Future<void> _scheduleExercise(NotificationSettings s, {bool ask = false, required String Function(String, String) tr, DateTime? now}) async {
    if (!s.notificationsEnabled || !s.exerciseReminder || !_ref.read(_nativeProvider)) return;
    await _ref.read(reminderSchedulerProvider).setLocalNotifications(
          'exercise',
          planExerciseReminders(now ?? DateTime.now(), s.exerciseDays,
              title: tr('usenotificationsettings_mesq_vaxti_4a1396', 'Məşq vaxtı! 🧘‍♀️'),
              body: tr('usenotificationsettings_hamilelik_ucun_saglam_mesqler__015e22', 'Hamiləlik üçün sağlam məşqlər edərək günə enerji ilə başlayın.')),
          ask: ask,
          cancelIds: kExerciseIds,
        );
  }

  /// `initializeReminders()`; returns true when the OS display permission is denied (the screen shows a toast).
  Future<bool> initializeReminders({required String Function(String, String) tr, DateTime? now}) async {
    final uid = _uid;
    final s = _qc.getQueryData<NotificationSettings>(['user-preferences', 'notifications', uid]) ?? const NotificationSettings();
    if (!s.notificationsEnabled || !_ref.read(_nativeProvider)) return false;
    final scheduler = _ref.read(reminderSchedulerProvider);
    final denied = await scheduler.displayPermission() == 'denied';
    await Future.wait<void>([
      if (s.waterReminder && s.notificationsEnabled) scheduler.scheduleWaterReminder(),
      if (s.vitaminReminder) _scheduleVitamin(s, tr: tr, now: now),
      if (s.exerciseReminder) _scheduleExercise(s, tr: tr, now: now),
    ]);
    return denied;
  }

  /// `useSilentHours().updateSettings(updates)`.
  Future<void> updateSilentHours({bool? enabled, String? startTime, String? endTime}) async {
    final uid = _uid;
    if (uid == null) return;
    final queryKey = ['user-preferences', 'silent-hours', uid];
    final prev = _qc.getQueryData<SilentHoursSettings>(queryKey) ?? const SilentHoursSettings();
    final next = prev.copyWith(enabled: enabled, startTime: startTime, endTime: endTime);
    _qc.setQueryDataValue(queryKey, next);
    final db = <String, dynamic>{
      'user_id': uid,
      'silent_hours_enabled': ?enabled,
      'silent_hours_start': ?startTime,
      'silent_hours_end': ?endTime,
    };
    try {
      await _updateOrInsert(_repo, uid, db);
    } catch (_) {
      _qc.setQueryDataValue(queryKey, prev);
    }
    // Also for chat-notifications (best effort).
    try {
      _ref.read(localStoreProvider).setItem('silent_hours_$uid', jsonEncode(next.toJson()));
    } catch (_) {}
  }

  /// `usePushNotifications().updateSetting(key, value)` (upsert; revert on error).
  Future<void> updatePushSetting(String key, bool value) async {
    final uid = _uid;
    if (uid == null) return;
    final queryKey = ['user-preferences', 'push', uid];
    final prev = _qc.getQueryData<PushSettings>(queryKey) ?? const PushSettings();
    _qc.setQueryDataValue(queryKey, prev.withValue(key, value));
    try {
      await _repo.upsert(uid, {key: value});
    } catch (_) {
      _qc.setQueryDataValue(queryKey, prev);
    }
  }

  /// `usePrivacyPreferences().updatePref(key, value)` → success.
  Future<bool> updatePrivacyPref(String key, bool value) async {
    final uid = _uid;
    if (uid == null) return false;
    final queryKey = ['user-preferences', 'privacy', uid];
    final prev = _qc.getQueryData<Map<String, bool>>(queryKey) ?? kDefaultPrivacy;
    final notify = _ref.read(analyticsConsentNotifierProvider);
    if (key == 'privacy_share_analytics' && !value) notify(userId: uid, allowed: false);
    _qc.setQueryDataValue(queryKey, {...prev, key: value});
    try {
      await _repo.upsert(uid, {key: value});
      if (key == 'privacy_share_analytics') notify(userId: uid, allowed: value);
      return true;
    } catch (_) {
      _qc.setQueryDataValue(queryKey, prev);
      if (key == 'privacy_share_analytics') notify(userId: uid, allowed: prev['privacy_share_analytics'] ?? false);
      return false;
    }
  }
}

/// `isNative` of lib/native.ts (always true in the app; tests override).
final _nativeProvider = Provider<bool>((ref) => ref.watch(settingsIsNativeProvider));
final settingsIsNativeProvider = Provider<bool>((ref) => true);

final settingsActionsProvider = Provider<SettingsActions>((ref) => SettingsActions(ref));
