// Ported from: (no vitest file for MomFriendlyMap.tsx / useMomFriendlyPlaces.ts) — behaviour checks of the port:
// the list (no map in the React tool), category and amenity filters on the server query, search, the suggest-a-place
// form (hidden until approved) and the reviews in the detail dialog.
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/tools/health_common/health_db.dart';
import 'package:anacan/features/tools/mom_map/mom_friendly_map.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../health_support/health_harness.dart' show FakeHealthDb;
import '../more_support/more_harness.dart';

Map<String, dynamic> place(String id, String name, {String category = 'cafe', num rating = 4.5, bool verified = false, Map<String, bool> amenities = const {}}) => {
      'id': id,
      'name': name,
      'address': 'Bakı, $name küç.',
      'category': category,
      'avg_rating': rating,
      'review_count': 3,
      'is_verified': verified,
      'is_active': true,
      'phone': '+994501112233',
      'has_breastfeeding_room': false,
      'has_changing_table': false,
      'has_elevator': false,
      ...amenities,
    };

void main() {
  late MoreToolsHarness h;
  late FakeHealthDb db;
  setUpAll(ensureDateLocales);

  setUp(() {
    h = MoreToolsHarness();
    db = FakeHealthDb({
      'mom_friendly_places': [
        place('p1', 'Kafe Ana', rating: 4.8, verified: true, amenities: {'has_breastfeeding_room': true, 'has_changing_table': true}),
        place('p2', 'Park Mall', category: 'mall', rating: 4.1),
        {...place('p3', 'Gizli'), 'is_active': false},
      ],
      'place_reviews': [
        {'id': 'r1', 'place_id': 'p1', 'rating': 4, 'comment': 'Rahatdır', 'is_verified': true, 'created_at': '2026-11-20T10:00:00Z'},
        {'id': 'r2', 'place_id': 'p1', 'rating': 1, 'comment': 'Yoxlanmayıb', 'is_verified': false, 'created_at': '2026-11-21T10:00:00Z'},
      ],
    });
    h.extra.add(healthDbProvider.overrideWithValue(db));
  });

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Finder key(String k) => find.byKey(ValueKey(k));

  testWidgets('lists active places best rated first with the stats and searches by name or address', (tester) async {
    await h.pump(tester, MomFriendlyMap(onBack: () {}));
    await settle(tester);
    expect(key('mom-place-p1'), findsOneWidget);
    expect(key('mom-place-p2'), findsOneWidget);
    expect(key('mom-place-p3'), findsNothing);
    expect(tester.getTopLeft(key('mom-place-p1')).dy, lessThan(tester.getTopLeft(key('mom-place-p2')).dy));
    expect(find.text('Təsdiqlənib'), findsOneWidget);
    // Without place_categories rows the fallback pills show (Hamısı, Kafe, Restoran, Mall, Park).
    expect(key('mom-cat-park'), findsOneWidget);
    await tester.enterText(key('mom-search'), 'mall');
    await settle(tester);
    expect(key('mom-place-p1'), findsNothing);
    expect(key('mom-place-p2'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('category and amenity filters go to the server query', (tester) async {
    await h.pump(tester, MomFriendlyMap(onBack: () {}));
    await settle(tester);
    await tester.ensureVisible(key('mom-cat-mall'));
    await tester.tap(key('mom-cat-mall'));
    await settle(tester);
    expect(key('mom-place-p1'), findsNothing);
    expect(key('mom-place-p2'), findsOneWidget);
    await tester.ensureVisible(key('mom-cat-all'));
    await tester.tap(key('mom-cat-all'));
    await tester.tap(key('mom-filter'));
    await settle(tester);
    await tester.tap(key('mom-amenity-has_breastfeeding_room'));
    await settle(tester);
    expect(key('mom-place-p1'), findsOneWidget);
    expect(key('mom-place-p2'), findsNothing);
    await tester.tap(key('mom-clear'));
    await settle(tester);
    expect(key('mom-place-p2'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('suggests a place hidden until an admin approves it', (tester) async {
    await h.pump(tester, MomFriendlyMap(onBack: () {}));
    await settle(tester);
    await tester.tap(key('mom-add'));
    await settle(tester);
    await tester.tap(key('mom-new-submit'));
    await settle(tester);
    expect(find.text('Məkan adı tələb olunur'), findsOneWidget);
    await tester.enterText(key('mom-new-name'), 'Ana Kafe');
    await tester.tap(key('mom-new-has_elevator'));
    await settle(tester);
    await tester.tap(key('mom-new-submit'));
    await settle(tester);
    final row = db.rows('mom_friendly_places').last;
    expect(row['name'], 'Ana Kafe');
    expect(row['name_az'], 'Ana Kafe');
    expect(row['category'], 'cafe');
    expect(row['latitude'], 40.4093);
    expect(row['has_elevator'], true);
    expect(row['is_active'], false);
    expect(row['is_verified'], false);
    expect(row['created_by'], 'u1');
    expect(key('mom-new-submit'), findsNothing);
    expect(find.text('Məkan əlavə edildi! Admin təsdiqindən sonra görünəcək.'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('the detail shows amenities and verified reviews and sends a review', (tester) async {
    await h.pump(tester, MomFriendlyMap(onBack: () {}));
    await settle(tester);
    await tester.tap(key('mom-place-p1'));
    await settle(tester);
    expect(find.text('Rahatdır'), findsOneWidget);
    expect(find.text('Yoxlanmayıb'), findsNothing);
    expect(find.text('+994501112233'), findsOneWidget);
    await tester.tap(key('mom-review-toggle'));
    await settle(tester);
    await tester.tap(key('mom-star-5'));
    await tester.enterText(key('mom-review-comment'), 'Əla yer');
    await settle(tester);
    await tester.tap(key('mom-review-send'));
    await settle(tester);
    final review = db.rows('place_reviews').last;
    expect(review['place_id'], 'p1');
    expect(review['rating'], 5);
    expect(review['comment'], 'Əla yer');
    expect(review['user_id'], 'u1');
    expect(key('mom-review-send'), findsNothing);
    await h.finish(tester);
  });
}
