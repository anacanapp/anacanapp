// Ported from: src/hooks/usePregnancyContent.ts (usePregnancyContentByDay, applyLanguage),
//              src/hooks/useTrimesterTips.ts (useTrimesterTips), src/hooks/useTrimesterInfo.ts (FALLBACK_TRIMESTER_INFO),
//              src/hooks/useDynamicContent.ts (useWeeklyTips), src/hooks/useFruitData.ts (useFruitImages,
//              getDynamicFruitData, useFruitDataForWeek), src/hooks/useFetusIllustrations.ts
//              (useFetusIllustrations, useFetusIllustrationByMonth), src/lib/illustration-image.ts
//              (resolvePublicStorageUrl), src/hooks/usePregnancyDayNavigation.ts
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/admission/backend_admission.dart' show azureApiOrigin;
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/app_languages.dart' show isPackLanguage;
import '../../../core/i18n/tr.dart';
import '../../../domain/models/anacan.dart' show fruitSizes;
import '../../../domain/pregnancy/pregnancy_utils.dart' show getPregnancyDay, getTrimester;
import '../../../state/user_store.dart';
import 'home_repository.dart';

final _languageProvider = Provider<String>((ref) => ref.watch(userStoreProvider.select((s) => s.language)));

// ── usePregnancyContentByDay ──

const List<String> pregnancyTranslatableFields = [
  'baby_development',
  'baby_message',
  'baby_size_fruit',
  'body_changes',
  'daily_tip',
  'doctor_visit_tip',
  'emotional_tip',
  'exercise_tip',
  'mother_tips',
  'mother_warnings',
  'nutrition_tip',
  'partner_tip',
  'multiples_tip',
  'foods_to_avoid',
  'mother_symptoms',
  'recommended_exercises',
  'recommended_foods',
  'tests_to_do',
];

/// `applyLanguage(row, lang)`.
Row? applyPregnancyLanguage(Row? row, String lang) {
  if (row == null || lang == 'az') return row;
  if (isPackLanguage(lang)) return mapRowTranslation(row, lang, pregnancyTranslatableFields);
  final out = Row.of(row);
  for (final f in pregnancyTranslatableFields) {
    final v = row['${f}_$lang'];
    if (v != null && v != '' && v != false) out[f] = v;
  }
  return out;
}

/// `usePregnancyContentByDay(pregnancyDay)` — key `['pregnancy_content_day', day, language]`, 5 min stale.
final pregnancyContentByDayQuery = queryProviderFamily<Row?, int?>((ref, day) {
  final language = ref.watch(_languageProvider);
  return QueryOptions<Row?>(
    queryKey: ['pregnancy_content_day', day, language],
    enabled: day != null && day != 0,
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async {
      if (day == null || day == 0) return null;
      final row = await ref.read(homeRepositoryProvider).pregnancyContentByDay(day);
      return applyPregnancyLanguage(row, language);
    },
  );
});

// ── useTrimesterTips ──

/// `useTrimesterTips(trimester)` — key `['trimester_tips', trimester, language]`.
final trimesterTipsQuery = queryProviderFamily<Rows, int?>((ref, trimester) {
  final language = ref.watch(_languageProvider);
  return QueryOptions<Rows>(
    queryKey: ['trimester_tips', trimester, language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(homeRepositoryProvider).trimesterTips(trimester), language, const ['tip_text']),
  );
});

/// `FALLBACK_TRIMESTER_INFO`.
List<({int trimesterNumber, String labelAz, String emoji})> fallbackTrimesterInfo() => [
  (trimesterNumber: 1, labelAz: '1-ci Trimester', emoji: '🌱'),
  (trimesterNumber: 2, labelAz: '2-ci Trimester', emoji: '🌸'),
  (trimesterNumber: 3, labelAz: tr('usetrimesterinfo_3_cu_trimester_a4a4bb', '3-cü Trimester'), emoji: '🍼'),
];

// ── useWeeklyTips ──

/// `useWeeklyTips(week, lifeStage)` — key `['weekly_tips', week, lifeStage, language]`.
final weeklyTipsQuery = queryProviderFamily<Rows, (int?, String?)>((ref, arg) {
  final language = ref.watch(_languageProvider);
  return QueryOptions<Rows>(
    queryKey: ['weekly_tips', arg.$1, arg.$2, language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async =>
        mapRowsTranslation(await ref.read(homeRepositoryProvider).weeklyTips(arg.$1, arg.$2), language, const ['title', 'content', 'tips']),
  );
});

// ── useFruitData ──

/// `useFruitImages()` — key `['fruit-images', language]`, 30 min stale.
final fruitImagesQuery = queryProvider<Rows>((ref) {
  final language = ref.watch(_languageProvider);
  return QueryOptions<Rows>(
    queryKey: ['fruit-images', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(homeRepositoryProvider).fruitImages(), language, const ['fruit_name']),
  );
});

class FruitData {
  const FruitData({required this.fruit, required this.emoji, required this.imageUrl, required this.lengthCm, required this.weightG});
  final String fruit;
  final String emoji;
  final String? imageUrl;
  final num lengthCm;
  final num weightG;
}

String? _nonEmpty(Object? v) => v is String && v.isNotEmpty ? v : null;

/// `getDynamicFruitData(fruitImages, pregnancyDay, weekNumber, dailyContent)`.
FruitData getDynamicFruitData(Rows fruitImages, int? pregnancyDay, int? weekNumber, Row? dailyContent) {
  final week = (weekNumber != null && weekNumber != 0) ? weekNumber : ((pregnancyDay == null || pregnancyDay == 0 ? 1 : pregnancyDay) / 7).ceil();
  final db = fruitImages.where((f) => f.integer('week_number') == week).firstOrNull;
  final st = fruitSizes(tr: tr)[week];
  return FruitData(
    fruit:
        _nonEmpty(dailyContent?['baby_size_fruit']) ??
        _nonEmpty(db?['fruit_name']) ??
        _nonEmpty(st?.fruit) ??
        tr('usefruitdata_meyve_50ca17', 'Meyvə'),
    emoji: _nonEmpty(db?['emoji']) ?? _nonEmpty(st?.emoji) ?? '🍎',
    imageUrl: _nonEmpty(db?['image_url']),
    lengthCm: dailyContent?.number('baby_size_cm') ?? db?.number('length_cm') ?? st?.lengthCm ?? 0,
    weightG: dailyContent?.number('baby_weight_gram') ?? db?.number('weight_g') ?? st?.weightG ?? 0,
  );
}

/// `useFruitDataForWeek(week)` (legacy `||` fallbacks).
FruitData fruitDataForWeek(Rows fruitImages, int week) {
  final db = fruitImages.where((f) => f.integer('week_number') == week).firstOrNull;
  final st = fruitSizes(tr: tr)[week];
  num nz(num? v) => v == null || v == 0 ? 0 : v;
  final len = nz(db?.number('length_cm'));
  final wt = nz(db?.number('weight_g'));
  return FruitData(
    fruit: _nonEmpty(db?['fruit_name']) ?? _nonEmpty(st?.fruit) ?? tr('usefruitdata_meyve_50ca17', 'Meyvə'),
    emoji: _nonEmpty(db?['emoji']) ?? _nonEmpty(st?.emoji) ?? '🍎',
    imageUrl: _nonEmpty(db?['image_url']),
    lengthCm: len != 0 ? len : (st?.lengthCm ?? 0),
    weightG: wt != 0 ? wt : (st?.weightG ?? 0),
  );
}

// ── useFetusIllustrations ──

/// `useFetusIllustrations()` — key `['fetus-illustrations', language]`, 30 min stale.
final fetusIllustrationsQuery = queryProvider<Rows>((ref) {
  final language = ref.watch(_languageProvider);
  return QueryOptions<Rows>(
    queryKey: ['fetus-illustrations', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(homeRepositoryProvider).fetusIllustrations(), language, const ['title', 'description']),
  );
});

const Set<String> _retiredStorageHosts = {'anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io'};
const Set<String> _googleStorageHosts = {'api.anacan.az', 'gcp.anacan.az'};
final RegExp _publicObjectPath = RegExp(r'^/storage/v1/object/public/[^/]+/.+');

/// `resolvePublicStorageUrl(raw)`.
String? resolvePublicStorageUrl(String? raw) {
  final value = raw?.trim() ?? '';
  if (value.isEmpty) return null;
  if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(value)) return value;
  final url = Uri.tryParse(value);
  if (url == null || url.host.isEmpty) return null;
  if (url.userInfo.isNotEmpty) return null;
  if (_retiredStorageHosts.contains(url.host)) {
    return _publicObjectPath.hasMatch(url.path) ? '$azureApiOrigin${url.path}${url.hasQuery ? '?${url.query}' : ''}' : null;
  }
  if (url.scheme == 'http' && _googleStorageHosts.contains(url.host)) return url.replace(scheme: 'https').toString();
  return url.toString();
}

/// `useFetusIllustrationByMonth(month)`.
String? fetusIllustrationForMonth(Rows illustrations, int month) =>
    resolvePublicStorageUrl(illustrations.where((i) => i.integer('month_number') == month).firstOrNull?.str('image_url'));

// ── usePregnancyDayNavigation ──

/// Derived state of `usePregnancyDayNavigation` for a selected day (the hook resets to the current day on
/// mount; the home always shows the current day).
class PregnancyDayNavigation {
  PregnancyDayNavigation._(this.selectedDay, this.actualCurrentDay);

  factory PregnancyDayNavigation.of(Object? lastPeriodDate, {int? selectedDay}) {
    final raw = getPregnancyDay(lastPeriodDate);
    // An invalid stored date is NaN in JS; the hero then shows nothing useful. Treat it as day 0.
    final actual = raw.isNaN ? 0 : raw.toInt();
    return PregnancyDayNavigation._(selectedDay ?? actual, actual);
  }

  final int selectedDay;
  final int actualCurrentDay;

  int get _dayIndex => selectedDay - 1;
  int get selectedWeek => (_dayIndex / 7).floor();

  /// JS `%` (negative for day 0).
  int get selectedDayInWeek => _dayIndex.remainder(7);
  int get selectedTrimester => getTrimester(selectedWeek);
  int get daysUntilDueFromSelected => 280 - selectedDay < 0 ? 0 : 280 - selectedDay;
  bool get isViewingCurrentDay => selectedDay == actualCurrentDay;

  /// `navigateToDay(day)` (clamped 1–280).
  PregnancyDayNavigation navigateToDay(int day) => PregnancyDayNavigation._(day.clamp(1, 280), actualCurrentDay);
}
