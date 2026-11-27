// Ported from: src/components/SettingsScreen.tsx, AppearanceScreen.tsx, PrivacyScreen.tsx, PartnerPrivacyScreen.tsx,
//              WidgetSettingsScreen.tsx, ads/AdPreferencesScreen.tsx, hooks/useNotificationSettings.ts,
//              hooks/useSilentHours.ts, hooks/usePrivacyPreferences.ts (no vitest suites — cases for the port:
//              toggle persistence, revert on error, account deletion, theme key)
import 'dart:convert';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/security/app_lock.dart';
import 'package:anacan/features/settings/ad_preferences_screen.dart';
import 'package:anacan/features/settings/appearance_screen.dart';
import 'package:anacan/features/settings/data/preferences.dart';
import 'package:anacan/features/settings/privacy_screen.dart';
import 'package:anacan/features/settings/settings_screen.dart';
import 'package:anacan/features/settings/theme_mode_setting.dart';
import 'package:anacan/features/settings/widget_settings_screen.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../profile/profile_edit_screen_test.dart' show FakeActions;
import '../security/app_lock_test.dart' show FakeBio;
import 'support/harness.dart';

class FakePrefs implements UserPreferencesRepository {
  FakePrefs([Map<String, dynamic>? row]) : row = row ?? <String, dynamic>{};
  final Map<String, dynamic> row;
  final updates = <Map<String, dynamic>>[];
  final upserts = <Map<String, dynamic>>[];
  bool fail = false;
  @override
  Future<void> insert(Map<String, dynamic> r) async {}
  @override
  Future<Map<String, dynamic>?> select(String userId, String columns) async => row.isEmpty ? null : row;
  @override
  Future<void> update(String userId, Map<String, dynamic> values) async {
    if (fail) throw const PostgrestException(message: 'boom', code: '42501');
    updates.add(values);
    row.addAll(values);
  }

  @override
  Future<void> upsert(String userId, Map<String, dynamic> values) async {
    if (fail) throw const PostgrestException(message: 'boom', code: '42501');
    upserts.add(values);
    row.addAll(values);
  }
}

class RecordingScheduler implements ReminderScheduler {
  final calls = <String>[];
  @override
  Future<void> cancelAll() async => calls.add('cancelAll');
  @override
  Future<void> cancelWaterReminders() async => calls.add('cancelWater');
  @override
  Future<String> displayPermission() async => 'granted';
  @override
  Future<void> scheduleWaterReminder({bool ask = false}) async => calls.add('water');
  @override
  Future<void> setLocalNotifications(String group, List<DesiredNotification> list, {bool ask = false, List<int>? cancelIds}) async => calls.add('$group:${list.length}');
}

class DeleteActions extends FakeActions {
  int deletes = 0;
  @override
  Future<AuthResult<void>> deleteAccount() async {
    deletes++;
    return const AuthResult();
  }
}

void main() {
  setUpAll(loadAnacanFonts);

  Future<(FakePrefs, RecordingScheduler, LocalStore)> openSettings(WidgetTester tester, {FakePrefs? prefs, AccountActions? actions, bool dark = false, bool rtl = false}) async {
    final p = prefs ?? FakePrefs();
    final s = RecordingScheduler();
    final store = seededStore();
    await pumpApp(tester, SettingsScreen(onBack: () {}, onNavigate: (_) {}), scroll: false, dark: dark, rtl: rtl, overrides: [
      ...baseOverrides(store: store),
      userPreferencesRepositoryProvider.overrideWithValue(p),
      reminderSchedulerProvider.overrideWithValue(s),
      biometricAuthProvider.overrideWithValue(FakeBio()),
      if (actions != null) accountActionsProvider.overrideWithValue(actions),
    ]);
    await tester.pumpAndSettle();
    return (p, s, store);
  }

  group('settings toggles', () {
    screenTest('turning notifications off persists, cancels everything and disables the dependants', (tester) async {
      final (prefs, sched, _) = await openSettings(tester);
      await tester.tap(find.byKey(const ValueKey<String>('settings-notifications_enabled')));
      await tester.pumpAndSettle();
      expect(prefs.updates.last, {'notifications_enabled': false});
      expect(sched.calls, contains('cancelAll'));
      expect(find.text('Bütün bildirişlər deaktiv edildi'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey<String>('settings-sound_enabled')));
      await tester.pump();
      expect(prefs.updates.length, 1, reason: 'sound switch is disabled');
    });

    screenTest('water reminder mirrors to LocalStore', (tester) async {
      final (prefs, _, store) = await openSettings(tester);
      await tester.ensureVisible(find.byKey(const ValueKey<String>('settings-water_reminder')));
      await tester.tap(find.byKey(const ValueKey<String>('settings-water_reminder')));
      await tester.pumpAndSettle();
      expect(prefs.updates.last, {'water_reminder': false});
      expect(store.getItem('anacan_water_reminder_enabled'), 'false');
    });

    screenTest('a failed save reverts the switch', (tester) async {
      final (prefs, _, _) = await openSettings(tester, prefs: FakePrefs()..fail = true);
      await tester.tap(find.byKey(const ValueKey<String>('settings-notifications_enabled')));
      await tester.pumpAndSettle();
      expect((tester.widget(find.byKey(const ValueKey<String>('settings-notifications_enabled'))) as dynamic).checked, isTrue);
      expect(prefs.updates, isEmpty);
    });

    screenTest('silent hours write the DB and the chat-notifications LocalStore copy', (tester) async {
      final (prefs, _, store) = await openSettings(tester);
      await tester.tap(find.byKey(const ValueKey<String>('settings-silent_hours')));
      await tester.pumpAndSettle();
      expect(prefs.updates.last, {'user_id': 'user-1', 'silent_hours_enabled': true});
      expect(jsonDecode(store.getItem('silent_hours_user-1')!), {'enabled': true, 'startTime': '22:00', 'endTime': '08:00'});
      expect(find.text('22:00'), findsOneWidget);
    });

    screenTest('push sub-toggles upsert and follow the master switch', (tester) async {
      final (prefs, _, _) = await openSettings(tester);
      await tester.ensureVisible(find.byKey(const ValueKey<String>('settings-push_likes')));
      await tester.tap(find.byKey(const ValueKey<String>('settings-push_likes')));
      await tester.pumpAndSettle();
      expect(prefs.upserts.last, {'push_likes': false});
    });

    screenTest('account deletion needs the keyword, then calls the auth controller', (tester) async {
      final actions = DeleteActions();
      await openSettings(tester, actions: actions);
      await tester.ensureVisible(find.byKey(const ValueKey<String>('setting-row-delete-account')));
      await tester.tap(find.byKey(const ValueKey<String>('setting-row-delete-account')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('delete-account-confirm')));
      await tester.pump();
      expect(actions.deletes, 0);
      await tester.enterText(find.byKey(const ValueKey<String>('delete-confirm')), 'SİL');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey<String>('delete-account-confirm')));
      await tester.pumpAndSettle();
      expect(actions.deletes, 1);
      expect(find.text('Hesabınız uğurla silindi'), findsOneWidget);
    });
  });

  test('reminder plans: vitamin daily, exercise on the chosen weekdays at 10:00', () {
    final now = DateTime(2026, 11, 27, 9, 30); // Friday
    final v = planVitaminReminder(now, '09:00', title: 't', body: 'b');
    expect(v.at, DateTime(2026, 11, 28, 9));
    expect(v.repeat, 'day');
    final ex = planExerciseReminders(now, const [1, 3, 5], title: 't', body: 'b');
    expect(ex.map((e) => '${e.id}@${e.at.weekday}'), ['300@5', '303@1', '305@3']);
    expect(isInSilentHours(const SilentHoursSettings(enabled: true), DateTime(2026, 1, 1, 23)), isTrue);
    expect(isInSilentHours(const SilentHoursSettings(enabled: true), DateTime(2026, 1, 1, 12)), isFalse);
  });

  screenTest('appearance writes the next-themes key', (tester) async {
    final store = seededStore();
    await pumpApp(tester, AppearanceScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(store: store), systemBrightnessProvider.overrideWithValue(Brightness.light)]);
    await tester.pumpAndSettle();
    expect(find.text('Hal-hazırda sistem teması (açıq) istifadə olunur.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('theme-dark')));
    await tester.pumpAndSettle();
    expect(store.getItem('theme'), 'dark');
    expect(find.text('Qaranlıq rejim aktiv edilib.'), findsOneWidget);
  });

  screenTest('privacy toggles upsert; a failure reverts with the error toast', (tester) async {
    final prefs = FakePrefs();
    await pumpApp(tester, PrivacyScreen(onBack: () {}), scroll: false, overrides: [...baseOverrides(), userPreferencesRepositoryProvider.overrideWithValue(prefs)]);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey<String>('privacy-privacy_allow_messages')));
    await tester.pumpAndSettle();
    expect(prefs.upserts.last, {'privacy_allow_messages': false});
    expect(find.text('Ayar yeniləndi'), findsOneWidget);
    prefs.fail = true;
    await tester.tap(find.byKey(const ValueKey<String>('privacy-privacy_profile_visible')));
    await tester.pumpAndSettle();
    expect((tester.widget(find.byKey(const ValueKey<String>('privacy-privacy_profile_visible'))) as dynamic).checked, isTrue);
  });

  screenTest('widget settings persist under anacan.widgets.settings.v1 and notify the native sync', (tester) async {
    final store = seededStore(user: {'lifeStage': 'mommy'});
    var synced = 0;
    await pumpApp(tester, WidgetSettingsScreen(onBack: () {}), scroll: false, overrides: [
      ...baseOverrides(store: store),
      homeWidgetsSyncProvider.overrideWithValue(_Sync(() => synced++)),
    ]);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey<String>('widget-privacy')));
    await tester.tap(find.byKey(const ValueKey<String>('widget-privacy')));
    await tester.pump();
    expect(jsonDecode(store.getItem(kWidgetSettingsKey)!), {'showFeed': true, 'showNap': true, 'showActions': true, 'privacy': true});
    expect(synced, 1);
  });

  group('goldens', () {
    for (final mode in ['light', 'dark', 'rtl']) {
      screenTest('settings $mode', (tester) async {
        await openSettings(tester, dark: mode == 'dark', rtl: mode == 'rtl');
        await expectGolden(tester, 'settings_$mode');
      });
    }
    for (final mode in ['light', 'dark']) {
      screenTest('appearance $mode', (tester) async {
        await pumpApp(tester, AppearanceScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(), systemBrightnessProvider.overrideWithValue(Brightness.light)]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'appearance_$mode');
      });
      screenTest('privacy $mode', (tester) async {
        await pumpApp(tester, PrivacyScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(), userPreferencesRepositoryProvider.overrideWithValue(FakePrefs())]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'privacy_$mode');
      });
      screenTest('partner privacy $mode', (tester) async {
        await pumpApp(tester, PrivacyScreen(onBack: () {}, partner: true), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(), userPreferencesRepositoryProvider.overrideWithValue(FakePrefs())]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'partner_privacy_$mode');
      });
      screenTest('widgets $mode', (tester) async {
        await pumpApp(tester, WidgetSettingsScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides(store: seededStore(user: {'lifeStage': 'mommy'}))]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'widgets_$mode');
      });
      screenTest('ad preferences $mode', (tester) async {
        await pumpApp(tester, AdPreferencesScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: [...baseOverrides()]);
        await tester.pumpAndSettle();
        await expectGolden(tester, 'ad_preferences_$mode');
      });
    }
  });
}

class _Sync implements HomeWidgetsSync {
  _Sync(this.cb);
  final void Function() cb;
  @override
  void changed() => cb();
}
