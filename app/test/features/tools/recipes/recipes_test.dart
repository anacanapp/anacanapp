// Ported from: (no vitest for Recipes.tsx — behaviour checks of the port)
import 'package:anacan/features/tools/recipes/recipes.dart';
import 'package:anacan/features/tools/recipes/recipes_logic.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart';

Map<String, dynamic> recipe(String id, String title, String category) =>
    {'id': id, 'title': title, 'category': category, 'is_active': true, 'created_at': '2026-11-0${id.codeUnitAt(0) % 9 + 1}T00:00:00Z', 'prep_time': 5, 'cook_time': 10, 'servings': 2,
     'ingredients': ['Un'], 'instructions': ['Qarışdırın']};

void main() {
  const cats = [
    {'category_id': 'seher_yemeyi', 'name': 'Səhər Yeməyi', 'name_az': 'Səhər yeməyi', 'name_en': 'Breakfast'},
  ];

  test('category names, slugs and labels in any form match', () {
    expect(normalizedCategorySlug('Breakfast', cats), 'seher_yemeyi');
    expect(normalizedCategorySlug('Desert', const []), 'desertler');
    expect(isCategoryMatch('Səhər yeməyi', 'seher_yemeyi', cats), isTrue);
    expect(translatedCategoryName('desertler', const [], 'ru'), 'Десерты');
    expect(translatedCategoryName('desertler', const [], 'uz'), 'Десерты');
    expect(translatedCategoryName('yeni_kateqoriya', const [], 'az'), 'Yeni kateqoriya');
  });

  test('the first 3 recipes of each category are free', () {
    final rs = [for (var i = 0; i < 5; i++) recipe('r$i', 'R$i', 'nahar'), recipe('d1', 'D', 'desert')];
    expect(freeRecipeIds(rs, const []), {'r0', 'r1', 'r2', 'd1'});
  });

  toolTest('a locked recipe opens the paywall for a free user; a free one opens the detail', (tester) async {
    final h = HealthHarness(tables: {
      'admin_recipes': [for (var i = 0; i < 4; i++) recipe('r$i', 'Resept $i', 'nahar')],
    });
    await h.pump(tester, Recipes(onBack: () {}), extra: [subscriptionProvider.overrideWithValue(const SubscriptionState())]);
    expect(find.text('Daha çox resept?'), findsOneWidget);
    expect(find.text('4 resept tapıldı'), findsOneWidget);
    // One of the four (same category) is past the free three: it carries the lock.
    expect(find.text('Premium'), findsOneWidget);
    await tester.tap(find.text('Premium'));
    await settle(tester);
    expect(h.paywalls, ['Reseptlər']);

    await tester.enterText(find.byKey(const ValueKey('recipes-search')), 'Resept 0');
    await settle(tester);
    expect(find.text('1 resept tapıldı'), findsOneWidget);
    await tester.tap(find.text('Resept 0').last);
    await settle(tester);
    expect(find.text('İnqrediyentlər'), findsOneWidget);
    expect(find.text('Qarışdırın'), findsOneWidget);
  });
}
