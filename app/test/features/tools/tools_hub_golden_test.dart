// Ported from: (golden of src/components/ToolsHub.tsx for the reference shot bump.tabs__tools, 390×844 light az;
//              rows follow tools/reference-shots/fixtures/_shared/tables/tool_configs.mjs for the bump stage)
import 'package:anacan/design/design.dart';
import 'package:anacan/features/tools/hub/hub_model.dart';
import 'package:anacan/features/tools/tools_hub.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialApp;

import '../../design/harness.dart';
import '../../support/i18n_fakes.dart';
import 'support/tools_harness.dart';

/// `T(tool_id, icon, color, stages, order, premium, az, …, desc, extra)` of the fixture (bump-visible rows).
Map<String, dynamic> _row(String id, String icon, String color, List<String> stages, int order, bool premium, String name, String desc,
        [Map<String, dynamic> extra = const {}]) =>
    {
      'tool_id': id,
      'icon': icon,
      'color': 'text-$color-600',
      'bg_color': 'bg-$color-50',
      'life_stages': stages,
      'min_week': null,
      'name': name,
      'description': desc,
      'sort_order': order,
      'bump_order': order,
      'flow_order': order,
      'mommy_order': order,
      'is_active': true,
      'bump_active': stages.contains('bump'),
      'flow_active': stages.contains('flow'),
      'mommy_active': stages.contains('mommy'),
      'is_premium': premium,
      'premium_type': 'none',
      'premium_limit': 0,
      'is_hero': false,
      'hero_order': 0,
      ...extra,
    };

const _all = ['flow', 'bump', 'mommy'];

final _rows = <Map<String, dynamic>>[
  _row('kick', 'Footprints', 'pink', ['bump'], 1, false, 'Təpik Sayğacı', 'Körpə hərəkətlərini izləyin', {'min_week': 20}),
  _row('contraction', 'Timer', 'violet', ['bump'], 2, false, 'Sancı Ölçən', '5-1-1 qaydası ilə izləyin', {'min_week': 28}),
  _row('weight', 'Scale', 'blue', _all, 3, false, 'Çəki İzləyici', 'Çəkinizi izləyin'),
  _row('hospital', 'Briefcase', 'teal', ['bump'], 4, false, 'Xəstəxana Çantası', 'Doğuş üçün hazırlıq'),
  _row('names', 'Baby', 'amber', _all, 5, false, 'Körpə Adları', 'Azərbaycan adları'),
  _row('mood', 'Heart', 'fuchsia', _all, 6, false, 'Əhval Gündəliyi', 'Emosiyalarınızı izləyin'),
  _row('safety', 'Shield', 'emerald', _all, 7, false, 'Təhlükəsizlik', 'Qida və fəaliyyət yoxlayın'),
  _row('shopping', 'ShoppingCart', 'purple', _all, 8, false, 'Alınacaqlar Siyahısı', 'Alınacaqlar siyahısı'),
  _row('blood-pressure', 'Gauge', 'red', ['bump', 'mommy'], 9, false, 'Qan Təzyiqi', 'Təzyiqi qeyd edin'),
  _row('blood-sugar', 'Droplet', 'rose', ['bump'], 10, false, 'Qan Şəkəri', 'Qlükoza ölçüləri'),
  _row('danger-signs', 'ShieldAlert', 'red', ['bump', 'mommy'], 11, false, 'Təhlükə Əlamətləri', 'Nə vaxt həkimə müraciət etməli'),
  _row('fetal-growth', 'TrendingUp', 'orange', ['bump'], 12, false, 'Döl İnkişafı', 'USM ölçüləri'),
  _row('exercise', 'Activity', 'cyan', _all, 13, true, 'Məşqlər', 'Təhlükəsiz məşqlər'),
  _row('recipes', 'ChefHat', 'orange', _all, 14, true, 'Reseptlər', 'Sağlam reseptlər'),
  _row('whitenoise', 'Volume2', 'indigo', ['bump', 'mommy'], 15, true, 'Ağ Səs', 'Körpəni sakitləşdirin'),
  _row('photoshoot', 'Camera', 'rose', _all, 16, true, 'Fotosessiya', 'AI körpə fotoları'),
  _row('pregnancy-album', 'ImagePlus', 'pink', ['bump'], 17, true, 'Hamiləlik Albomu', 'Qarın fotoları'),
  _row('doctors', 'Stethoscope', 'sky', _all, 18, false, 'Həkimlər', 'Həkim və xəstəxanalar'),
  _row('maternity-calculator', 'Calculator', 'green', ['bump'], 19, false, 'Dekret Kalkulyatoru', 'Dekret məzuniyyəti'),
  _row('vitamin-tracker', 'Pill', 'lime', _all, 20, false, 'Vitaminlər', 'Gündəlik vitaminlər'),
  _row('mental-health', 'Brain', 'sky', _all, 21, false, 'Psixi Sağlamlıq', 'Özünüzü yoxlayın'),
  _row('horoscope', 'Stars', 'violet', _all, 22, true, 'Bürc Uyğunluğu', 'Ailə bürcləri'),
  _row('blog', 'BookOpen', 'orange', _all, 23, false, 'Bloq', 'Faydalı məqalələr'),
  _row('mini-games', 'Gamepad2', 'pink', _all, 24, false, 'Mini Oyunlar', ''),
];

void main() {
  setUpAll(loadAnacanFonts);

  testWidgets('golden: bump Premium tools hub (reference shot bump.tabs__tools, 390×844 light az)', (tester) async {
    // flutter_test paints BoxShadows without blur (debugDisableShadows), which hides the CSS card shadows.
    debugDisableShadows = false;
    addTearDown(() => debugDisableShadows = true);
    final h = HubHarness(
      context: HubContext(lifeStage: 'bump', language: 'az', countryCode: 'AZ', isPremium: true, currentWeek: 24, now: DateTime(2026, 11, 20, 9)),
      rows: _rows,
      subscription: const SubscriptionState(isPremium: true, entitlementReady: true),
    );
    installTestI18n();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: h.overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
        builder: (context, nav) => MediaQuery(data: const MediaQueryData(size: Size(390, 844), disableAnimations: true), child: nav!),
        home: Builder(
          builder: (context) => Material(
            color: context.a.bg,
            child: const AToastHost(child: SingleChildScrollView(child: ToolsHub())),
          ),
        ),
      ),
    ));
    await settleSvgs(tester);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/tools_hub_bump_light.png'));
    await tearDownTree(tester);
    debugDisableShadows = true;
  });
}
