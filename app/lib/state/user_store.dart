// Ported from: src/store/userStore.ts
//
// Same fields, actions and derived selectors; persisted under `anacan-user-store` as the zustand
// envelope `{"state":{…partialize…},"version":0}` (same key order, Dates as ISO strings), so the
// value imported from the Capacitor app's localStorage hydrates it unchanged. Persistence is best
// effort (a failed write never fails an auth callback). Native Preferences mirrors
// (`anacan_app_language`, `anacan_has_selected_language`, `anacan_has_seen_intro`) and the i18n
// language go through [UserStorePlatform].

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/app_languages.dart' show normalizeAppLanguage;
import '../core/i18n/language_controller.dart' show i18nRuntimeProvider;
import '../core/i18n/tr.dart' show I18nRuntime;
import 'calendar_utils.dart';
import 'local_store.dart';
import 'persisted_store.dart';

/// `LifeStage` values.
abstract final class LifeStages {
  static const flow = 'flow', bump = 'bump', mommy = 'mommy', partner = 'partner';
}

const Object _unset = Object();

class PartnerWomanData {
  const PartnerWomanData({required this.name, required this.lifeStage, this.mood, this.symptoms});
  final String name;
  final String lifeStage;
  final int? mood;
  final List<String>? symptoms;
}

class CycleData {
  const CycleData({
    required this.lastPeriodDate,
    required this.cycleLength,
    required this.periodLength,
    required this.currentDay,
    required this.phase,
    required this.fertileWindowStart,
    required this.fertileWindowEnd,
    required this.nextPeriodDate,
  });
  final DateTime lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final int currentDay;

  /// 'menstrual' | 'follicular' | 'ovulation' | 'luteal'.
  final String phase;
  final DateTime fertileWindowStart;
  final DateTime fertileWindowEnd;
  final DateTime nextPeriodDate;
}

/// `FRUIT_SIZES[week]` row (`src/types/anacan.ts`, built from `src/lib/fetal-size.ts`).
class FruitSize {
  const FruitSize({required this.fruit, required this.lengthCm, required this.weightG, this.emoji = ''});
  final String fruit;
  final String emoji;
  final double lengthCm;
  final double weightG;
}

class PregnancyData {
  const PregnancyData({
    required this.dueDate,
    required this.lastPeriodDate,
    required this.currentWeek,
    required this.currentDay,
    required this.trimester,
    required this.babySize,
  });
  final DateTime? dueDate;
  final DateTime lastPeriodDate;
  final int currentWeek;
  final int currentDay;
  final int trimester;

  /// Null until the fetal-size table is supplied (see [UserState.getPregnancyData]).
  final FruitSize? babySize;
}

class BabyData {
  const BabyData({
    required this.id,
    required this.name,
    required this.birthDate,
    required this.gender,
    required this.ageInDays,
    required this.ageInMonths,
    required this.ageRemainingDays,
  });
  final String id;
  final String name;
  final DateTime birthDate;
  final String gender;
  final int ageInDays;
  final int ageInMonths;
  final int ageRemainingDays;
}

class PostpartumData {
  const PostpartumData({required this.birthDate, required this.daysSinceBirth, required this.week, this.deliveryType});
  final DateTime birthDate;
  final int daysSinceBirth;
  final int week;
  final String? deliveryType;
}

class UserState {
  const UserState({
    this.isAuthenticated = false,
    this.isOnboarded = false,
    this.hasSeenIntro = false,
    this.hasSelectedLanguage = false,
    this.hasCompletedFunnel = true,
    this.userId,
    this.email,
    this.name,
    this.role = 'woman',
    this.lifeStage,
    this.partnerCode,
    this.linkedPartnerId,
    this.lastPeriodDate,
    this.cycleLength = 28,
    this.periodLength = 5,
    this.dueDate,
    this.babyBirthDate,
    this.babyName,
    this.babyGender,
    this.babyCount = 1,
    this.multiplesType,
    this.deliveryType,
    this.language = 'az',
    this.countryCode,
    this.partnerWomanData,
  });

  final bool isAuthenticated;
  final bool isOnboarded;
  final bool hasSeenIntro;
  final bool hasSelectedLanguage;

  /// Default true so existing users skip; set to false during onboarding.
  final bool hasCompletedFunnel;
  final String? userId;
  final String? email;
  final String? name;

  /// 'woman' | 'partner'.
  final String role;
  final String? lifeStage;
  final String? partnerCode;
  final String? linkedPartnerId;
  final DateTime? lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final DateTime? dueDate;
  final DateTime? babyBirthDate;
  final String? babyName;

  /// 'boy' | 'girl'.
  final String? babyGender;
  final int babyCount;

  /// 'single' | 'twins' | 'triplets' | 'quadruplets'.
  final String? multiplesType;

  /// 'natural' | 'cesarean' | 'assisted' (profiles.delivery_type).
  final String? deliveryType;
  final String language;
  final String? countryCode;

  /// Not persisted.
  final PartnerWomanData? partnerWomanData;

  UserState copyWith({
    bool? isAuthenticated,
    bool? isOnboarded,
    bool? hasSeenIntro,
    bool? hasSelectedLanguage,
    bool? hasCompletedFunnel,
    Object? userId = _unset,
    Object? email = _unset,
    Object? name = _unset,
    String? role,
    Object? lifeStage = _unset,
    Object? partnerCode = _unset,
    Object? linkedPartnerId = _unset,
    Object? lastPeriodDate = _unset,
    int? cycleLength,
    int? periodLength,
    Object? dueDate = _unset,
    Object? babyBirthDate = _unset,
    Object? babyName = _unset,
    Object? babyGender = _unset,
    int? babyCount,
    Object? multiplesType = _unset,
    Object? deliveryType = _unset,
    String? language,
    Object? countryCode = _unset,
    Object? partnerWomanData = _unset,
  }) {
    T? pick<T>(Object? value, T? current) => identical(value, _unset) ? current : value as T?;
    return UserState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isOnboarded: isOnboarded ?? this.isOnboarded,
      hasSeenIntro: hasSeenIntro ?? this.hasSeenIntro,
      hasSelectedLanguage: hasSelectedLanguage ?? this.hasSelectedLanguage,
      hasCompletedFunnel: hasCompletedFunnel ?? this.hasCompletedFunnel,
      userId: pick(userId, this.userId),
      email: pick(email, this.email),
      name: pick(name, this.name),
      role: role ?? this.role,
      lifeStage: pick(lifeStage, this.lifeStage),
      partnerCode: pick(partnerCode, this.partnerCode),
      linkedPartnerId: pick(linkedPartnerId, this.linkedPartnerId),
      lastPeriodDate: pick(lastPeriodDate, this.lastPeriodDate),
      cycleLength: cycleLength ?? this.cycleLength,
      periodLength: periodLength ?? this.periodLength,
      dueDate: pick(dueDate, this.dueDate),
      babyBirthDate: pick(babyBirthDate, this.babyBirthDate),
      babyName: pick(babyName, this.babyName),
      babyGender: pick(babyGender, this.babyGender),
      babyCount: babyCount ?? this.babyCount,
      multiplesType: pick(multiplesType, this.multiplesType),
      deliveryType: pick(deliveryType, this.deliveryType),
      language: language ?? this.language,
      countryCode: pick(countryCode, this.countryCode),
      partnerWomanData: pick(partnerWomanData, this.partnerWomanData),
    );
  }

  /// `partialize` (same keys and order as the React store).
  Map<String, Object?> toPersisted() => {
        'isAuthenticated': isAuthenticated,
        'isOnboarded': isOnboarded,
        'hasSeenIntro': hasSeenIntro,
        'hasCompletedFunnel': hasCompletedFunnel,
        'userId': userId,
        'email': email,
        'name': name,
        'role': role,
        'lifeStage': lifeStage,
        'partnerCode': partnerCode,
        'linkedPartnerId': linkedPartnerId,
        'lastPeriodDate': lastPeriodDate == null ? null : jsDateJson(lastPeriodDate!),
        'cycleLength': cycleLength,
        'periodLength': periodLength,
        'dueDate': dueDate == null ? null : jsDateJson(dueDate!),
        'babyBirthDate': babyBirthDate == null ? null : jsDateJson(babyBirthDate!),
        'babyName': babyName,
        'babyGender': babyGender,
        'babyCount': babyCount,
        'multiplesType': multiplesType,
        'deliveryType': deliveryType,
        'language': language,
        'hasSelectedLanguage': hasSelectedLanguage,
        'countryCode': countryCode,
      };

  /// zustand merge: `{...initial, ...persisted}`. Keys absent from [persisted] keep the current
  /// value; values of an unexpected type keep the current value too (JS would take them as is).
  UserState mergePersisted(Map<String, Object?> persisted) {
    bool b(String k, bool current) => persisted.containsKey(k) && persisted[k] is bool ? persisted[k] as bool : current;
    int i(String k, int current) => persisted.containsKey(k) && persisted[k] is num ? (persisted[k] as num).toInt() : current;
    Object? s(String k, String? current) {
      if (!persisted.containsKey(k)) return _unset;
      final v = persisted[k];
      return v == null || v is String ? v : current;
    }

    Object? d(String k) => persisted.containsKey(k) ? parseJsDate(persisted[k]) : _unset;
    final role = persisted['role'];
    final language = persisted['language'];
    return copyWith(
      isAuthenticated: b('isAuthenticated', isAuthenticated),
      isOnboarded: b('isOnboarded', isOnboarded),
      hasSeenIntro: b('hasSeenIntro', hasSeenIntro),
      hasCompletedFunnel: b('hasCompletedFunnel', hasCompletedFunnel),
      hasSelectedLanguage: b('hasSelectedLanguage', hasSelectedLanguage),
      userId: s('userId', userId),
      email: s('email', email),
      name: s('name', name),
      role: role is String ? role : null,
      lifeStage: s('lifeStage', lifeStage),
      partnerCode: s('partnerCode', partnerCode),
      linkedPartnerId: s('linkedPartnerId', linkedPartnerId),
      lastPeriodDate: d('lastPeriodDate'),
      cycleLength: i('cycleLength', cycleLength),
      periodLength: i('periodLength', periodLength),
      dueDate: d('dueDate'),
      babyBirthDate: d('babyBirthDate'),
      babyName: s('babyName', babyName),
      babyGender: s('babyGender', babyGender),
      babyCount: i('babyCount', babyCount),
      multiplesType: s('multiplesType', multiplesType),
      deliveryType: s('deliveryType', deliveryType),
      language: language is String ? language : null,
      countryCode: s('countryCode', countryCode),
    );
  }

  // ── Computed ────────────────────────────────────────────

  /// `getCycleData()`.
  CycleData? getCycleData({DateTime? today}) {
    final lmp = lastPeriodDate;
    if (lmp == null) return null;
    final lastPeriod = storedCalendarDate(lmp) ?? lmp;
    final daysSincePeriod = differenceInCalendarDays(today ?? DateTime.now(), lastPeriod);
    final currentDay = daysSincePeriod.remainder(cycleLength) + 1;
    final phase = currentDay <= periodLength
        ? 'menstrual'
        : currentDay <= 13
            ? 'follicular'
            : currentDay <= 16
                ? 'ovulation'
                : 'luteal';
    final ovulationDay = cycleLength - 14;
    return CycleData(
      lastPeriodDate: lastPeriod,
      cycleLength: cycleLength,
      periodLength: periodLength,
      currentDay: currentDay,
      phase: phase,
      fertileWindowStart: addDays(lastPeriod, ovulationDay - 5),
      fertileWindowEnd: addDays(lastPeriod, ovulationDay + 1),
      nextPeriodDate: addDays(lastPeriod, cycleLength),
    );
  }

  /// `getPregnancyData()`. [fruitSizes] = `FRUIT_SIZES` (week → size); the fruit week is the
  /// largest key ≤ current week (default 4), falling back to week 4.
  PregnancyData? getPregnancyData({Map<int, FruitSize> fruitSizes = const {}}) {
    final lmp = lastPeriodDate;
    if (lmp == null) return null;
    final currentWeek = getPregnancyWeek(lmp);
    final weeks = fruitSizes.keys.where((w) => w <= currentWeek).toList()..sort();
    final fruitWeek = weeks.isEmpty || weeks.last == 0 ? 4 : weeks.last;
    return PregnancyData(
      dueDate: calculateDueDate(lmp),
      lastPeriodDate: lmp,
      currentWeek: currentWeek,
      currentDay: getDayInWeek(lmp),
      trimester: getTrimester(currentWeek),
      babySize: fruitSizes[fruitWeek] ?? fruitSizes[4],
    );
  }

  /// `getBabyData()`.
  BabyData? getBabyData() {
    final birth = babyBirthDate, name = babyName, gender = babyGender;
    if (birth == null || name == null || name.isEmpty || gender == null || gender.isEmpty) return null;
    final age = getRealCalendarAge(birth);
    return BabyData(
      id: 'baby-1',
      name: name,
      birthDate: birth,
      gender: gender,
      ageInDays: age.totalDays,
      ageInMonths: age.months,
      ageRemainingDays: age.days,
    );
  }

  /// `getPostpartumWeek()`.
  PostpartumData? getPostpartumWeek() {
    final birth = babyBirthDate;
    if (birth == null) return null;
    final age = getRealCalendarAge(birth);
    return PostpartumData(
      birthDate: birth,
      daysSinceBirth: age.totalDays,
      week: (age.totalDays / 7).floor(),
      deliveryType: deliveryType,
    );
  }
}

/// Native side effects of the store (Capacitor Preferences mirrors, i18n language).
abstract interface class UserStorePlatform {
  /// `Preferences.set({key, value})` (native only). Fire and forget.
  void writePreference(String key, String value);

  /// The store's language changed (`setCachedAppLanguage` + `ensureCopyLanguage` + Preferences).
  void languageChanged(String language);
}

/// Wires the store to the i18n runtime (which owns the Preferences-backed language store).
class I18nUserStorePlatform implements UserStorePlatform {
  I18nUserStorePlatform(this.runtime);
  final I18nRuntime runtime;

  @override
  void writePreference(String key, String value) {
    if (key == 'anacan_has_selected_language') {
      unawaited(runtime.setHasSelectedLanguage(value == 'true'));
      return;
    }
    unawaited(runtime.preferences?.write(key, value).catchError((Object _) {}));
  }

  @override
  void languageChanged(String language) {
    if (runtime.language == language) return;
    unawaited(runtime.setLanguage(language));
    // Language set without ensureLanguageReady (e.g. server preference after login): load its copy.
    unawaited(runtime.ensureLanguageReady(language).catchError((Object _) {}));
  }
}

final userStorePlatformProvider =
    Provider<UserStorePlatform>((ref) => I18nUserStorePlatform(ref.watch(i18nRuntimeProvider)));

const PersistedEnvelope userStoreEnvelope = PersistedEnvelope(name: 'anacan-user-store');

/// `useUserStore`.
final userStoreProvider = NotifierProvider<UserStore, UserState>(UserStore.new);

class UserStore extends Notifier<UserState> {
  late LocalStore _store;
  late UserStorePlatform _platform;

  @override
  UserState build() {
    _store = ref.watch(localStoreProvider);
    _platform = ref.watch(userStorePlatformProvider);
    final runtime = ref.watch(i18nRuntimeProvider);
    void mirror() {
      final lang = runtime.language;
      if (lang != state.language) _set(state.copyWith(language: lang));
    }

    runtime.languageListenable.addListener(mirror);
    ref.onDispose(() => runtime.languageListenable.removeListener(mirror));
    return _hydrate();
  }

  UserState _hydrate() {
    final read = userStoreEnvelope.read(_store);
    final persisted = read.state;
    final hydrated = persisted == null ? const UserState() : const UserState().mergePersisted(persisted);
    if (read.migrated) userStoreEnvelope.write(_store, hydrated.toPersisted());
    return hydrated;
  }

  /// Re-reads the persisted state (after LegacyStateImporter seeded it).
  void rehydrate() => state = _hydrate();

  /// `restorePreferences()` of bootstrap-app.tsx: the native Preferences copies win over the
  /// localStorage snapshot. Only `true` flags are applied, like React.
  void restorePreferences({String? language, bool hasSelectedLanguage = false, bool hasSeenIntro = false}) {
    if (language != null && language.isNotEmpty) {
      final lang = normalizeAppLanguage(language);
      if (lang != state.language) _set(state.copyWith(language: lang));
      _store.setItem('language', lang);
    }
    if (hasSelectedLanguage && !state.hasSelectedLanguage) _set(state.copyWith(hasSelectedLanguage: true));
    if (hasSeenIntro && !state.hasSeenIntro) _set(state.copyWith(hasSeenIntro: true));
  }

  void _set(UserState next) {
    state = next;
    userStoreEnvelope.write(_store, next.toPersisted());
  }

  void setAuth(bool isAuth, [String? userId, String? email, String? name]) {
    _set(state.copyWith(
      isAuthenticated: isAuth,
      userId: userId == null || userId.isEmpty ? null : userId,
      email: email == null || email.isEmpty ? null : email,
      name: name == null || name.isEmpty ? null : name,
      // The invitation code comes from the server profile (ensure_secure_partner_code).
      partnerCode: isAuth ? state.partnerCode : null,
    ));
  }

  void setOnboarded(bool isOnboarded) => _set(state.copyWith(isOnboarded: isOnboarded));

  void setHasSeenIntro(bool hasSeen) {
    _set(state.copyWith(hasSeenIntro: hasSeen));
    _platform.writePreference('anacan_has_seen_intro', '$hasSeen');
  }

  void setHasSelectedLanguage(bool value) {
    _set(state.copyWith(hasSelectedLanguage: value));
    _platform.writePreference('anacan_has_selected_language', '$value');
  }

  void setFunnelCompleted(bool value) => _set(state.copyWith(hasCompletedFunnel: value));
  void setCountryCode(String? code) => _set(state.copyWith(countryCode: code));
  void setLifeStage(String stage) => _set(state.copyWith(lifeStage: stage));
  void setRole(String role) => _set(state.copyWith(role: role));
  void setLastPeriodDate(DateTime? date) => _set(state.copyWith(lastPeriodDate: date));
  void setCycleLength(int length) => _set(state.copyWith(cycleLength: length));
  void setPeriodLength(int length) => _set(state.copyWith(periodLength: length));
  void setDueDate(DateTime? date) => _set(state.copyWith(dueDate: date));

  void setBabyData(DateTime birthDate, String name, String gender,
          [int babyCount = 1, String multiplesType = 'single']) =>
      _set(state.copyWith(
        babyBirthDate: birthDate,
        babyName: name,
        babyGender: gender,
        babyCount: babyCount,
        multiplesType: multiplesType,
      ));

  void setMultiplesData(int babyCount, String multiplesType) =>
      _set(state.copyWith(babyCount: babyCount, multiplesType: multiplesType));
  void setDeliveryType(String? type) => _set(state.copyWith(deliveryType: type));

  void setLanguage(String lang) {
    final language = normalizeAppLanguage(lang);
    _set(state.copyWith(language: language));
    // getLocaleTag() reads it (localStorage `language`).
    _store.setItem('language', language);
    _platform.languageChanged(language);
  }

  void setPartnerCode(String code) => _set(state.copyWith(partnerCode: code));
  void setLinkedPartnerId(String? id) => _set(state.copyWith(linkedPartnerId: id));
  void setPartnerWomanData(PartnerWomanData? data) => _set(state.copyWith(partnerWomanData: data));

  void logout() => _set(state.copyWith(
        isAuthenticated: false,
        isOnboarded: false,
        hasCompletedFunnel: false,
        userId: null,
        email: null,
        name: null,
        role: 'woman',
        lifeStage: null,
        partnerCode: null,
        linkedPartnerId: null,
        lastPeriodDate: null,
        dueDate: null,
        babyBirthDate: null,
        babyName: null,
        babyGender: null,
        babyCount: 1,
        multiplesType: null,
        deliveryType: null,
        partnerWomanData: null,
      ));
}
