// Ported from: (unit coverage of src/hooks/useFruitData.ts getDynamicFruitData, src/hooks/usePregnancyDayNavigation.ts,
// src/hooks/usePregnancyContent.ts applyLanguage, src/lib/illustration-image.ts resolvePublicStorageUrl,
// src/hooks/useHomeWidgetSync.ts journey — no vitest suites exist for these)
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/home/data/pregnancy_content.dart';
import 'package:anacan/features/home/home_widget_sync.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';

void main() {
  setUp(() {
    installTestI18n();
    DomainClock.setSystemTime(DateTime(2026, 11, 20, 10));
  });
  tearDown(DomainClock.reset);

  test('fruit data: daily content first, then fruit_size_images, then FRUIT_SIZES', () {
    final db = [
      {'week_number': 24, 'fruit_name': 'Qarğıdalı (db)', 'emoji': '🌽', 'length_cm': 31, 'weight_g': 600, 'image_url': 'x'},
    ];
    final daily = getDynamicFruitData(db, 171, 24, {'baby_size_fruit': 'qarğıdalı', 'baby_size_cm': 30, 'baby_weight_gram': 830});
    expect([daily.fruit, daily.lengthCm, daily.weightG, daily.emoji, daily.imageUrl], ['qarğıdalı', 30, 830, '🌽', 'x']);
    final weekly = getDynamicFruitData(db, 171, 24, null);
    expect([weekly.fruit, weekly.lengthCm, weekly.weightG], ['Qarğıdalı (db)', 31, 600]);
    final fallback = getDynamicFruitData(const [], 171, 24, null);
    expect(fallback.fruit, isNotEmpty);
    expect(fallback.lengthCm, greaterThan(0));
    // Week 0 is "falsy": the week comes from the day.
    expect(getDynamicFruitData(const [], 14, 0, null).fruit, isNotEmpty);
  });

  test('day navigation: 0-based week and day of the selected day, days left never negative', () {
    final nav = PregnancyDayNavigation.of('2026-06-03');
    expect(nav.selectedDay, 171);
    expect([nav.selectedWeek, nav.selectedDayInWeek, nav.selectedTrimester, nav.daysUntilDueFromSelected], [24, 2, 2, 109]);
    expect(nav.navigateToDay(400).selectedDay, 280);
    expect(nav.navigateToDay(400).daysUntilDueFromSelected, 0);
    expect(nav.navigateToDay(-3).selectedDay, 1);
    expect(nav.isViewingCurrentDay, isTrue);
  });

  test('content language: own columns for ru, pack mapping for new languages, az untouched', () {
    final row = {'daily_tip': 'az', 'daily_tip_ru': 'ru', 'daily_tip_en': 'en'};
    expect(applyPregnancyLanguage(row, 'az'), same(row));
    expect(applyPregnancyLanguage(row, 'ru')!['daily_tip'], 'ru');
    expect(applyPregnancyLanguage(row, 'tr')!['daily_tip'], 'az');
    expect(applyPregnancyLanguage(row, 'fr')!['daily_tip'], 'en');
  });

  test('storage URLs: retired Azure host → Google, http → https on Google hosts', () {
    const retired = 'https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io/storage/v1/object/public/a/m6.webp';
    expect(resolvePublicStorageUrl(retired), 'https://api.anacan.az/storage/v1/object/public/a/m6.webp');
    expect(resolvePublicStorageUrl('https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io/other'), isNull);
    expect(resolvePublicStorageUrl('http://gcp.anacan.az/x.png'), 'https://gcp.anacan.az/x.png');
    expect(resolvePublicStorageUrl('/assets/a.svg'), '/assets/a.svg');
    expect(resolvePublicStorageUrl('  '), isNull);
    expect(
      fetusIllustrationForMonth([
        {'month_number': 6, 'image_url': 'https://cdn/x.webp'},
      ], 6),
      'https://cdn/x.webp',
    );
    expect(fetusIllustrationForMonth(const [], 6), isNull);
  });

  test('widget journey for a pregnancy', () {
    final j = computeWidgetJourney(
      lifeStage: 'bump',
      language: 'az',
      profile: {'last_period_date': '2026-06-03'},
      selectedChild: null,
      fruitForWeek: (w) => fruitDataForWeek(const [], w),
      now: DateTime(2026, 11, 20),
    )!;
    expect(j.eyebrow, '2. trimestr');
    expect(j.title, '24 həftə 2 gün');
    expect(j.badge, '110 gün qalıb'); // getDaysUntilDue (due − today), not the hero's 280 − day
    expect(
      computeWidgetJourney(
        lifeStage: 'flow',
        language: 'az',
        profile: const {},
        selectedChild: null,
        fruitForWeek: (w) => fruitDataForWeek(const [], w),
        now: DateTime(2026),
      ),
      isNull,
    );
  });
}
