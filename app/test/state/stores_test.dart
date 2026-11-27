// Ported from: src/store/userStore.storage.test.ts (+ store behaviour of src/store/*.ts, src/hooks/useCakeCart.ts)

import 'dart:convert';

import 'package:anacan/core/i18n/language_controller.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/i18n_fakes.dart';

class FakePlatform implements UserStorePlatform {
  final prefs = <String, String>{};
  final languages = <String>[];
  @override
  void writePreference(String key, String value) => prefs[key] = value;
  @override
  void languageChanged(String language) => languages.add(language);
}

class RecordingTimerHooks implements TimerNativeHooks {
  final calls = <String>[];
  @override
  void startNativeTimer(ActiveTimer timer) => calls.add('start:${timer.id}');
  @override
  void stopNativeTimer(String id) => calls.add('stop:$id');
  @override
  void clearAllTimerNotifications(List<String> ids) => calls.add('clear:${ids.join(',')}');
}

/// A realistic `anacan-user-store` value written by the Capacitor app (zustand persist, Dates as ISO).
const capacitorUserStore =
    '{"state":{"isAuthenticated":true,"isOnboarded":true,"hasSeenIntro":true,"hasCompletedFunnel":true,'
    '"userId":"6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b","email":"leyla@example.invalid","name":"Leyla","role":"woman",'
    '"lifeStage":"mommy","partnerCode":"ANACAN-ABCD2345","linkedPartnerId":null,"lastPeriodDate":null,'
    '"cycleLength":28,"periodLength":5,"dueDate":"2025-03-01T20:00:00.000Z","babyBirthDate":"2025-02-27T20:00:00.000Z",'
    '"babyName":"Nuray","babyGender":"girl","babyCount":2,"multiplesType":"twins","deliveryType":"cesarean",'
    '"language":"ru","hasSelectedLanguage":true,"countryCode":"AZ"},"version":0}';

void main() {
  late LocalStore store;
  late FakePlatform platform;
  late RecordingTimerHooks timerHooks;
  late int now;

  ProviderContainer container() {
    final runtime = installTestI18n();
    final c = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(store),
      userStorePlatformProvider.overrideWithValue(platform),
      i18nRuntimeProvider.overrideWithValue(runtime),
      timerNativeHooksProvider.overrideWithValue(timerHooks),
      timerClockProvider.overrideWithValue(() => now),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  setUp(() {
    store = LocalStore.memory();
    platform = FakePlatform();
    timerHooks = RecordingTimerHooks();
    now = 1764230400000;
  });

  group('userStore', () {
    test('hydrates the Capacitor anacan-user-store value and writes it back byte-compatible', () {
      store.setItem('anacan-user-store', capacitorUserStore);
      final c = container();
      final state = c.read(userStoreProvider);
      expect(state.isAuthenticated, isTrue);
      expect(state.userId, '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b');
      expect(state.lifeStage, 'mommy');
      expect(state.babyBirthDate, DateTime.utc(2025, 2, 27, 20));
      expect(state.babyCount, 2);
      expect(state.language, 'ru');
      expect(state.countryCode, 'AZ');
      expect(state.partnerWomanData, isNull);
      // Any write re-serialises with the same keys, order and Date format.
      c.read(userStoreProvider.notifier).setCountryCode('AZ');
      expect(store.getItem('anacan-user-store'), capacitorUserStore);
    });

    test('missing keys keep the defaults (shallow merge) and another version is ignored', () {
      store.setItem('anacan-user-store', '{"state":{"isOnboarded":true},"version":0}');
      var state = container().read(userStoreProvider);
      expect(state.isOnboarded, isTrue);
      expect(state.cycleLength, 28);
      expect(state.hasCompletedFunnel, isTrue);
      expect(state.language, 'az');

      store.setItem('anacan-user-store', '{"state":{"isOnboarded":true},"version":3}');
      state = container().read(userStoreProvider);
      expect(state.isOnboarded, isFalse);
    });

    test('does not reject login/logout callbacks when the UI snapshot cannot be persisted', () async {
      final backend = MemoryLocalStoreBackend({'admin_draft_article': 'valuable-unsaved-work'})..failWith = StateError('quota');
      store = LocalStore(backend, debounce: Duration.zero);
      await store.load();
      final c = container();
      expect(() => c.read(userStoreProvider.notifier).setAuth(true, 'fixture-user', 'fixture@example.invalid', 'Fixture'),
          returnsNormally);
      expect(c.read(userStoreProvider).isAuthenticated, isTrue);
      expect(c.read(userStoreProvider).userId, 'fixture-user');
      expect(() => c.read(userStoreProvider.notifier).logout(), returnsNormally);
      expect(c.read(userStoreProvider).isAuthenticated, isFalse);
      expect(c.read(userStoreProvider).userId, isNull);
      await store.flush();
      expect(backend.values['admin_draft_article'], 'valuable-unsaved-work');
    });

    test('setAuth keeps the partner code only while authenticated; logout resets the account fields', () {
      final c = container();
      final s = c.read(userStoreProvider.notifier)
        ..setPartnerCode('ANACAN-ABCD2345')
        ..setAuth(true, 'u1', '', 'Leyla');
      expect(c.read(userStoreProvider).partnerCode, 'ANACAN-ABCD2345');
      expect(c.read(userStoreProvider).email, isNull); // '' || null
      s.setAuth(false);
      expect(c.read(userStoreProvider).partnerCode, isNull);
      s
        ..setLanguage('tr')
        ..setHasSeenIntro(true)
        ..logout();
      final state = c.read(userStoreProvider);
      expect(state.hasCompletedFunnel, isFalse);
      expect(state.language, 'tr'); // not reset by logout
      expect(state.hasSeenIntro, isTrue);
    });

    test('setLanguage normalises, mirrors localStorage `language` and the native Preferences', () {
      final c = container();
      c.read(userStoreProvider.notifier).setLanguage('RU_ru');
      expect(c.read(userStoreProvider).language, 'ru');
      expect(store.getItem('language'), 'ru');
      expect(platform.languages, ['ru']);
      c.read(userStoreProvider.notifier)
        ..setHasSelectedLanguage(true)
        ..setHasSeenIntro(true);
      expect(platform.prefs, {'anacan_has_selected_language': 'true', 'anacan_has_seen_intro': 'true'});
    });

    test('derived selectors: cycle, pregnancy, baby and postpartum', () {
      final today = DateTime.now();
      final lmp = DateTime(today.year, today.month, today.day).subtract(const Duration(days: 10));
      final s = const UserState().copyWith(lastPeriodDate: lmp);
      final cycle = s.getCycleData()!;
      expect(cycle.currentDay, 11);
      expect(cycle.phase, 'follicular');
      expect(cycle.nextPeriodDate, addDays(lmp, 28));
      expect(cycle.fertileWindowStart, addDays(lmp, 9));
      final pregnancy = s.getPregnancyData(fruitSizes: {
        4: const FruitSize(fruit: 'Xaşxaş toxumu', lengthCm: 0.1, weightG: 0),
      })!;
      expect(pregnancy.currentWeek, 1);
      expect(pregnancy.currentDay, 3);
      expect(pregnancy.trimester, 1);
      expect(pregnancy.dueDate, addDays(lmp, 280));
      expect(pregnancy.babySize!.fruit, 'Xaşxaş toxumu');

      final birth = DateTime(today.year, today.month, today.day).subtract(const Duration(days: 15));
      final baby = const UserState().copyWith(babyBirthDate: birth, babyName: 'Nuray', babyGender: 'girl', deliveryType: 'natural');
      expect(baby.getBabyData()!.ageInDays, 15);
      expect(baby.getBabyData()!.id, 'baby-1');
      expect(baby.getPostpartumWeek()!.week, 2);
      expect(const UserState().getBabyData(), isNull);
    });
  });

  group('childStore', () {
    test('selected-child-storage round trip', () {
      store.setItem('selected-child-storage', '{"state":{"selectedChildId":"c-1"},"version":0}');
      final c = container();
      expect(c.read(childStoreProvider).selectedChildId, 'c-1');
      c.read(childStoreProvider.notifier).setSelectedChildId(null);
      expect(store.getItem('selected-child-storage'), '{"state":{"selectedChildId":null},"version":0}');
    });
  });

  group('timerStore', () {
    test('hydrates running timers, starts/stops with native hooks and keeps per-child timers apart', () {
      store.setItem(
        'anacan-timers',
        '{"state":{"activeTimers":[{"id":"sleep-main-c1-1764230000000","type":"sleep","childId":"c1","childName":"Əli","startTime":1764230000000}]},"version":0}',
      );
      final c = container();
      final timers = c.read(timerStoreProvider.notifier);
      expect(timers.getElapsedSeconds('sleep-main-c1-1764230000000'), 400);
      expect(timers.getActiveTimer('sleep', childId: 'c1'), isNotNull);
      expect(timers.getActiveTimer('sleep', childId: 'c2'), isNull);
      expect(timers.getActiveTimer('sleep'), isNull);
      final id = timers.startTimer('feeding', feedType: 'left', label: 'Sol');
      expect(id, 'feeding-left-nochild-1764230400000');
      now += 65000;
      expect(timers.stopTimer(id), 65);
      expect(timers.stopTimer('missing'), isNull);
      expect(timerHooks.calls, ['start:$id', 'stop:$id']);
      final persisted = jsonDecode(store.getItem('anacan-timers')!) as Map;
      expect((persisted['state'] as Map)['activeTimers'], [
        {'id': 'sleep-main-c1-1764230000000', 'type': 'sleep', 'childId': 'c1', 'childName': 'Əli', 'startTime': 1764230000000},
      ]);
      timers.clearAllTimers();
      expect(timers.hasAnyActiveTimer(), isFalse);
      expect(timerHooks.calls.last, 'clear:sleep-main-c1-1764230000000');
    });
  });

  group('cake cart', () {
    test('totals include add-ons and persist under cake-cart', () {
      final c = container();
      final cart = c.read(cakeCartProvider.notifier)
        ..addToCart({'id': 'k1', 'price': '25.5'}, 2, {'text': 'Ad günün mübarək'}, 4)
        ..addToCart({'id': 'k2', 'price': 10}, 1, {});
      expect(c.read(cakeCartProvider).totalItems, 3);
      expect(c.read(cakeCartProvider).totalPrice, 69);
      cart.updateQuantity(1, 0);
      expect(c.read(cakeCartProvider).totalItems, 3);
      cart.removeItem(0);
      expect(c.read(cakeCartProvider).totalPrice, 10);
      final state = (jsonDecode(store.getItem('cake-cart')!) as Map)['state'] as Map;
      expect(state['totalItems'], 1);
      expect((state['items'] as List).single, {
        'cake': {'id': 'k2', 'price': 10},
        'quantity': 1,
        'customFields': <String, String>{},
        'extraPrice': 0,
      });
    });
  });

  group('white noise', () {
    test('play/stop/volume/mute state without audio', () {
      final c = container();
      final noise = c.read(whiteNoiseStoreProvider.notifier)
        ..setVolume(40)
        ..play(const WhiteNoiseSound(id: 's', name: 'Yağış', emoji: '🌧', color: '#fff', noiseType: 'pink'));
      expect(c.read(whiteNoiseStoreProvider).isPlaying, isTrue);
      expect(c.read(whiteNoiseStoreProvider).volume, 40);
      noise.toggleMute();
      expect(c.read(whiteNoiseStoreProvider).isMuted, isTrue);
      noise.stop();
      expect(c.read(whiteNoiseStoreProvider).activeSoundId, isNull);
      expect(c.read(whiteNoiseStoreProvider).isMuted, isTrue);
      expect(effectiveGain(40, false), 0.4);
      expect(effectiveGain(150, false), 1);
      expect(effectiveGain(40, true), 0);
    });
  });

  group('calendar helpers', () {
    test('storedCalendarDate keeps the calendar day of UTC-midnight values and bare dates', () {
      expect(storedDateKey('2026-03-01'), '2026-03-01');
      expect(storedDateKey('2026-03-01T00:00:00.000Z'), '2026-03-01');
      expect(storedCalendarDate('2026-03-01'), DateTime(2026, 3, 1));
      expect(storedDateKey(''), isNull);
      expect(jsDateJson(DateTime.utc(2026, 1, 1)), '2026-01-01T00:00:00.000Z');
      expect(parseJsDate('2026-01-01'), DateTime.utc(2026, 1, 1));
      expect(addMonths(DateTime(2026, 1, 31), 1), DateTime(2026, 2, 28));
    });
  });
}
