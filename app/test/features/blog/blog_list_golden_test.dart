// Ported from: (golden of src/components/BlogScreen.tsx, list view, for the reference shot mommy.parity__blog,
//              390×844 light az; rows follow tools/reference-shots/fixtures/_shared/tables/blog_*.{mjs,json},
//              covers left empty: the reference shot shows the harness's placeholder PNGs)
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/features/blog/ui/blog_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../settings/support/harness.dart';
import 'support.dart';

void main() {
  setUpAll(() async {
    await loadAnacanFonts();
    await ensureDateLocales();
    // The real-async SVG settle lets a fail-open backend read reach SharedPreferences.
    SharedPreferences.setMockInitialValues({});
  });

  screenTest('golden: blog list (reference shot mommy.parity__blog)', (tester) async {
    const rows = [
      ('ikinci-trimestr', 'pregnancy', 'bump', 'İkinci trimestrdə nələri bilməlisiniz'),
      ('hamilelikde-demir', 'nutrition', 'bump', 'Hamiləlikdə dəmir: nə qədər və haradan?'),
      ('korpe-yuxusu', 'baby-care', 'mommy', 'Altı aylıq körpənin yuxu rejimi'),
      ('elave-qida', 'nutrition', 'mommy', 'Əlavə qidaya necə başlamalı'),
      ('sikl-fazalari', 'pregnancy', 'flow', 'Menstrual siklin dörd fazası'),
    ];
    final backend = FakeBlogBackend(
      posts: [
        for (var i = 0; i < rows.length; i++)
          blogPost('p$i', slug: rows[i].$1, category: rows[i].$2, lifeStage: rows[i].$3, featured: i == 0, extra: {
            'title': rows[i].$4,
            'excerpt': '${rows[i].$4} — mütəxəssis tövsiyələri.',
            'reading_time': 4 + i,
            'view_count': 1500 - i * 100,
            'created_at': DateTime.utc(2026, 11, 20 - (i * 2 + 1), 5).toIso8601String(),
          }),
      ],
      categories: [
        {'id': 'k1', 'slug': 'pregnancy', 'name': 'Hamiləlik', 'icon': 'Baby', 'sort_order': 1},
        {'id': 'k2', 'slug': 'nutrition', 'name': 'Qidalanma', 'icon': 'Utensils', 'sort_order': 2},
        {'id': 'k3', 'slug': 'baby-care', 'name': 'Körpə baxımı', 'icon': 'Heart', 'sort_order': 3},
      ],
    );
    await pumpApp(tester, BlogScreen(onBack: () {}, lifeStage: 'mommy'), overrides: blogOverrides(backend), scroll: false);
    await tester.pump();
    await tester.pump();
    await expectGolden(tester, 'blog_list_light');
  });
}
