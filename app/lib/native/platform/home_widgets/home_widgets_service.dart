// Ported from: src/hooks/useHomeWidgetSync.ts, src/components/HomeWidgetSync.tsx, src/lib/home-widgets.ts
//              (pushWidgetSnapshot), the `anacan-widgets-changed` event of src/components/WidgetSettingsScreen.tsx
//
// Keeps the native home-screen widgets current while the app runs: pregnancy week or the baby's age for everyone,
// feeding / sleep only with Premium (otherwise the sample preview the widget shows locked). [homeWidgetSnapshotProvider]
// is the reactive `useMemo` of the hook; [homeWidgetsServiceProvider] pushes it on every change (deduplicated by
// [HomeWidgetsChannel]), every 5 minutes, when widget settings or the sleep plan change in the LocalStore (React's
// `storage` listener) and when the app is hidden (`visibilitychange`).
//
// The home feature's HomeWidgetSync widget (mounted for bump / mommy, React's mount condition) calls
// [HomeWidgetBridge.pushJourney]; that first read creates the service, which then lives for the process.
import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_languages.dart' show appLanguageLocale;
import '../../../features/home/data/pregnancy_content.dart' show fruitDataForWeek, fruitImagesQuery;
import '../../../features/home/home_inputs.dart' show homeProfileRowProvider, homeSelectedChildProvider, homeUserIdProvider;
import '../../../features/home/home_slots.dart' show HomeWidgetBridge, HomeWidgetJourney;
import '../../../features/home/home_widget_sync.dart' show computeWidgetJourney;
import '../../../features/baby/hooks/use_baby_care_actions.dart' show babyLogsRangeQuery;
import '../../../features/settings/copy/feature_copy.dart' show widgetText;
import '../../../features/settings/widget_settings_screen.dart' show HomeWidgetsSync, kWidgetSettingsKey, readWidgetSettings;
import '../../../native/purchases/subscription.dart' show subscriptionProvider;
import '../../../domain/baby/baby_logs_range.dart' show BabyLogRow;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart' show userStoreProvider;
import 'home_widget_snapshot.dart';
import 'home_widgets_channel.dart';

/// Re-evaluation trigger (React's `tick` state).
class HomeWidgetsTick extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state = state + 1;
}

final homeWidgetsTickProvider = NotifierProvider<HomeWidgetsTick, int>(HomeWidgetsTick.new, name: 'homeWidgetsTickProvider');

String? _text(Object? v) => v is String && v.isNotEmpty ? v : null;

/// `useUserStore` lifeStage / language and `useSubscription().isPremium` (one input, overridable in tests).
final homeWidgetsAccountProvider = Provider<({String? lifeStage, String language, bool premium})>(
  (ref) => (
    lifeStage: ref.watch(userStoreProvider.select((s) => s.lifeStage)),
    language: ref.watch(userStoreProvider.select((s) => s.language)),
    premium: ref.watch(subscriptionProvider.select((s) => s.isPremium)),
  ),
  name: 'homeWidgetsAccountProvider',
);

/// The snapshot for the signed-in bump / mommy user, or null (nothing is pushed).
final homeWidgetSnapshotProvider = Provider<WidgetSnapshot?>((ref) {
  ref.watch(homeWidgetsTickProvider);
  final userId = ref.watch(homeUserIdProvider);
  final account = ref.watch(homeWidgetsAccountProvider);
  final lifeStage = account.lifeStage;
  if (userId == null || (lifeStage != 'bump' && lifeStage != 'mommy')) return null;
  final language = account.language;
  final text = widgetText(language);
  final premium = account.premium;
  final profile = ref.watch(homeProfileRowProvider);
  final store = ref.watch(localStoreProvider);
  final now = DateTime.now();

  HomeWidgetJourney? journey;
  WidgetCare? care;
  if (lifeStage == 'bump') {
    final fruitImages = ref.watch(fruitImagesQuery).data ?? const [];
    journey = computeWidgetJourney(
      lifeStage: lifeStage,
      language: language,
      profile: profile,
      selectedChild: null,
      fruitForWeek: (w) => fruitDataForWeek(fruitImages, w),
      now: now,
    );
  } else {
    final child = ref.watch(homeSelectedChildProvider);
    final birthIso = _text(child?['birth_date']) ?? _text(profile?['baby_birth_date']);
    if (birthIso != null) {
      final List<BabyLogRow> logs = premium ? (ref.watch(babyLogsRangeQuery(8)).data ?? const <BabyLogRow>[]) : const <BabyLogRow>[];
      final data = mommyWidgetData(
        text: text,
        birthIso: birthIso,
        name: _text(child?['name']) ?? _text(profile?['baby_name']) ?? '',
        emoji: _text(child?['avatar_emoji']) ?? '👶',
        logs: logs,
        plan: sleepPlan(store.getItem, userId, child?['id'] as String?, now),
        now: now,
      );
      journey = data.journey;
      care = data.care;
    }
  }
  return buildWidgetSnapshot(
    text: text,
    premium: premium,
    settings: readWidgetSettings(store),
    journey: journey,
    care: care,
    now: now,
    locale: appLanguageLocale(language),
  );
}, name: 'homeWidgetSnapshotProvider');

/// [HomeWidgetBridge] (home feature) and [HomeWidgetsSync] (widget settings) on the native widgets.
class HomeWidgetsService implements HomeWidgetBridge, HomeWidgetsSync {
  HomeWidgetsService(this._bump);

  final void Function() _bump;

  /// The journey is recomputed here from the same inputs; the call only asks for a fresh snapshot. Deferred: the home
  /// widget calls this while building.
  @override
  Future<void> pushJourney(HomeWidgetJourney? journey) async => scheduleMicrotask(_bump);

  /// `window.dispatchEvent(new Event('anacan-widgets-changed'))`.
  @override
  void changed() => scheduleMicrotask(_bump);
}

/// The service with its triggers; [lifecycle] = false in tests without a binding.
HomeWidgetsService createHomeWidgetsService(Ref ref, {HomeWidgetsChannel? channel, bool lifecycle = true}) {
  final widgets = channel ?? HomeWidgetsChannel();
  void push(WidgetSnapshot? snapshot) {
    if (snapshot != null) unawaited(widgets.push(snapshot));
  }

  // A trigger recomputes and sends at once (reading the provider flushes it); input changes arrive via the listener.
  void bump() {
    ref.read(homeWidgetsTickProvider.notifier).bump();
    push(ref.read(homeWidgetSnapshotProvider));
  }

  ref.listen<WidgetSnapshot?>(homeWidgetSnapshotProvider, (_, next) => push(next), fireImmediately: true);
  final timer = Timer.periodic(const Duration(minutes: 5), (_) => bump());
  final storeChanges = ref.read(localStoreProvider).changes.listen((change) {
    if (change.key == kWidgetSettingsKey || change.key.startsWith('anacan.sleepTraining')) scheduleMicrotask(bump);
  });
  final listener = lifecycle ? AppLifecycleListener(onHide: bump) : null;
  ref.onDispose(() {
    timer.cancel();
    unawaited(storeChanges.cancel());
    listener?.dispose();
  });
  return HomeWidgetsService(bump);
}

final homeWidgetsServiceProvider = Provider<HomeWidgetsService>(createHomeWidgetsService, name: 'homeWidgetsServiceProvider');
