// Ported from: src/components/tools/Nutrition.tsx
//
// Nutrition (`nutrition`): today's calories against the stage target (+300 kcal per extra baby in a multiple
// pregnancy), meals of the day (the nursing row opens the baby tracker), the vitamins tab, water glasses and the
// meal detail with quick foods and a custom food (calories looked up by the `food-calories` function).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/app_languages.dart' show isPackLanguage, normalizeAppLanguage;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/baby_rules.dart' show offersBreastfeeding;
import '../../baby/models/child.dart' show getChildAge;
import '../../home/data/daily_logs.dart';
import '../../settings/ui/settings_ui.dart' show AEyebrow, AIconBtn, FadeRise, px;
import '../data/dynamic_config.dart' show commonFoodsQuery;
import '../data/dynamic_content.dart' show nutritionTipsQuery;
import '../data/dynamic_tools.dart' show mealTypesQuery, nutritionTargetsQuery;
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'meal_logs.dart';
import 'vitamins_tab.dart';

/// `feature37Text('baby_feeding_title' | 'baby_feeding_sub')` (scripts/i18n/feature37-copy.json): own language, else
/// English.
const Map<String, (String, String)> _babyFeedingCopy = {
  'az': ('Körpənin qidalanması', 'Əmizdirmə və şüşəni körpə izləyicisində qeyd edin'),
  'en': ("Baby's feeding", 'Log breastfeeding and bottles in the baby tracker'),
  'tr': ('Bebeğin beslenmesi', 'Emzirme ve biberonu bebek takipçisinde kaydedin'),
  'ru': ('Кормление малыша', 'Записывайте кормления грудью и из бутылочки в трекере малыша'),
  'de': ('Fütterung des Babys', 'Stillen und Fläschchen im Baby-Tracker eintragen'),
  'ar': ('رضاعة الطفل', 'سجّلي الرضاعة الطبيعية والزجاجة في متتبع الطفل'),
  'ka': ('ბავშვის კვება', 'ძუძუთი და ბოთლით კვება ჩაწერეთ ბავშვის ტრეკერში'),
  'kk': ('Нәрестені тамақтандыру', 'Емізу мен бөтелкені нәресте трекеріне жазыңыз'),
  'uz': ('Chaqaloqni ovqatlantirish', 'Emizish va butilkani chaqaloq trekerida qayd eting'),
  'zh': ('宝宝喂养', '在宝宝记录中记录母乳和奶瓶喂养'),
  'id': ('Menyusui bayi', 'Catat ASI dan botol di pelacak bayi'),
  'fr': ('Alimentation de bébé', 'Notez tétées et biberons dans le suivi de bébé'),
  'es': ('Alimentación del bebé', 'Registra lactancia y biberones en el seguimiento del bebé'),
  'pt': ('Alimentação do bebê', 'Registre amamentação e mamadeira no acompanhamento do bebê'),
  'vi': ('Cho bé ăn', 'Ghi bú mẹ và bú bình trong theo dõi bé'),
  'hi': ('शिशु का आहार', 'स्तनपान और बोतल को शिशु ट्रैकर में दर्ज करें'),
  'ja': ('赤ちゃんの授乳', '授乳とミルクは赤ちゃん記録に記録しましょう'),
  'ko': ('아기 수유', '모유 수유와 젖병은 아기 기록에 남기세요'),
  'pl': ('Karmienie dziecka', 'Zapisuj karmienie piersią i butelką w dzienniku dziecka'),
  'nl': ('Voeding van de baby', 'Leg borst- en flesvoeding vast in de babytracker'),
  'sv': ('Babyns matning', 'Logga amning och flaska i babyloggen'),
  'ky': ('Ымыркайды азыктандыруу', 'Эмчек эмизүүнү жана бөтөлкө менен багууну ымыркай трекерине каттаңыз'),
  'et': ('Beebi toitmine', 'Märgi imetamine ja pudelitoidud beebi jälgijasse'),
  'tk': ('Çaganyň iýmitlenmesi', 'Emdirmegi we çüýşe bilen iýmitlendirmegi çaga yzarlaýjysyna ýazyň'),
  'uk': ('Годування малюка', 'Записуйте грудне вигодовування й пляшечки в трекері малюка'),
};

(String, String) _babyFeeding() => _babyFeedingCopy[normalizeAppLanguage(currentLanguage())] ?? _babyFeedingCopy['en']!;

/// The "N items" word of a meal row / summary (Nutrition.tsx inline per-language copy).
String mealItemWord(String language, int n) => switch (language) {
      'en' => n == 1 ? 'item' : 'items',
      'ru' => 'продукт',
      'tr' => 'ürün',
      'kk' => 'өнім',
      'uz' => 'mahsulot',
      'ka' => 'პროდუქტი',
      'de' => n == 1 ? 'Eintrag' : 'Einträge',
      'ar' => 'عنصر',
      _ => 'qida',
    };

const Map<String, Map<String, String>> _mealNameTr = {
  'Əlavə qida': {'en': 'Snack', 'ru': 'Перекус', 'tr': 'Ara öğün', 'kk': 'Жеңіл тамақ', 'uz': 'Yengil tamaddi', 'ka': 'წახემსება', 'de': 'Snack', 'ar': 'وجبة خفيفة'},
  'Qəlyanaltı': {'en': 'Snack', 'ru': 'Перекус', 'tr': 'Ara öğün', 'kk': 'Жеңіл тамақ', 'uz': 'Yengil tamaddi', 'ka': 'წახემსება', 'de': 'Snack', 'ar': 'وجبة خفيفة'},
  'Səhər yeməyi': {'en': 'Breakfast', 'ru': 'Завтрак', 'tr': 'Kahvaltı', 'kk': 'Таңғы ас', 'uz': 'Nonushta', 'ka': 'საუზმე', 'de': 'Frühstück', 'ar': 'الإفطار'},
  'Nahar': {'en': 'Lunch', 'ru': 'Обед', 'tr': 'Öğle yemeği', 'kk': 'Түскі ас', 'uz': 'Tushlik', 'ka': 'სადილი', 'de': 'Mittagessen', 'ar': 'الغداء'},
  'Şam yeməyi': {'en': 'Dinner', 'ru': 'Ужин', 'tr': 'Akşam yemeği', 'kk': 'Кешкі ас', 'uz': 'Kechki ovqat', 'ka': 'ვახშამი', 'de': 'Abendessen', 'ar': 'العشاء'},
};

const Map<String, String> _mealTimeTr = {
  'en': 'Anytime', 'ru': 'В любое время', 'tr': 'Her zaman', 'kk': 'Кез келген уақытта', 'uz': 'Istalgan vaqtda', 'ka': 'ნებისმიერ დროს', 'de': 'Jederzeit', 'ar': 'في أي وقت',
};

typedef MealType = ({String id, String name, String time, String emoji});

/// The meal rows: DB rows with the label fixes for the nursing row (seeded with the snack text; fixed by
/// supabase/migrations/20261108140000_nutrition_category_fix.sql) and the raw Azerbaijani names / times, else the
/// fallback four.
List<MealType> nutritionMealTypes(List<Map<String, dynamic>> db, String language) {
  if (db.isEmpty) {
    return [
      (id: 'breakfast', name: tr('nutrition_seher_yemeyi_b82929', 'Səhər yeməyi'), time: '07:00 - 09:00', emoji: '🍳'),
      (id: 'lunch', name: tr('nutrition_nahar_lunch', 'Nahar'), time: '12:00 - 14:00', emoji: '🍲'),
      (id: 'dinner', name: tr('nutrition_sam_yemeyi_6002e9', 'Şam yeməyi'), time: '18:00 - 20:00', emoji: '🍽️'),
      (id: 'snack', name: tr('nutrition_qelyanalti_42fb71', 'Qəlyanaltı'), time: tr('nutrition_i_stenilen_vaxt_ec15be', 'İstənilən vaxt'), emoji: '🍎'),
    ];
  }
  return [
    for (final m in db)
      () {
        final id = '${m['meal_id'] ?? ''}';
        var name = '${m['name'] ?? ''}';
        var time = m['time_range'] is String ? m['time_range'] as String : '';
        if (id == 'nursing') {
          name = switch (language) {
            'en' => 'Nursing',
            'ru' => 'Грудное вскармливание',
            'tr' => 'Emzirme',
            'kk' => 'Емізу',
            'uz' => 'Emizish',
            'ka' => 'ძუძუთი კვება',
            'de' => 'Stillen',
            'ar' => 'رضاعة',
            _ => 'Əmizdirmə',
          };
          time = _mealTimeTr[language] ?? 'İstənilən vaxt';
          if (isPackLanguage(language)) {
            name = tr('nutrition_nursing_label', 'Əmizdirmə');
            time = tr('nutrition_any_time', 'İstənilən vaxt');
          }
        } else {
          final translated = _mealNameTr[name]?[language];
          if (translated != null) name = translated;
          if (time == 'İstənilən vaxt' && _mealTimeTr[language] != null) time = _mealTimeTr[language]!;
          if (time == 'İstənilən vaxt' && isPackLanguage(language)) time = tr('nutrition_any_time', 'İstənilən vaxt');
        }
        final emoji = m['emoji'] is String && (m['emoji'] as String).isNotEmpty ? m['emoji'] as String : '🍽️';
        return (id: id, name: name, time: time, emoji: emoji);
      }(),
  ];
}

/// Calories / water target of the stage (+300 kcal per extra baby in a multiple pregnancy).
({num calories, num water, String description}) nutritionTargets(List<Map<String, dynamic>> db, String? lifeStage, num extraKcal) {
  final stage = lifeStage == null || lifeStage.isEmpty ? 'flow' : lifeStage;
  final row = db.where((t) => t['life_stage'] == stage).firstOrNull;
  if (row != null) {
    return (calories: ((row['calories'] as num?) ?? 0) + extraKcal, water: (row['water_glasses'] as num?) ?? 0, description: row['description'] is String ? row['description'] as String : '');
  }
  final fb = switch (stage) {
    'bump' => (calories: 2300, water: 10, description: tr('nutrition_hamilelik_dovru_57af7a', 'Hamiləlik dövrü')),
    'mommy' => (calories: 2500, water: 12, description: tr('nutrition_emizdirme_dovru_6f45f4', 'Əmizdirmə dövrü')),
    _ => (calories: 2000, water: 8, description: tr('nutrition_umumi_saglamliq_6c20a8', 'Ümumi sağlamlıq')),
  };
  return (calories: fb.calories + extraKcal, water: fb.water, description: fb.description);
}

class Nutrition extends ConsumerStatefulWidget {
  const Nutrition({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<Nutrition> createState() => _NutritionState();
}

class _NutritionState extends ConsumerState<Nutrition> {
  String _tab = 'log';
  String? _meal;
  final _foodName = TextEditingController();
  final _foodCalories = TextEditingController();
  bool _aiLoading = false;

  @override
  void dispose() {
    _foodName.dispose();
    _foodCalories.dispose();
    super.dispose();
  }

  /// Fills the calories from the food name with the `food-calories` function (when the user has not typed them).
  Future<void> _autoFillCalories(String foodName, void Function(VoidCallback) update) async {
    final n = foodName.trim();
    if (n.length < 2 || _foodCalories.text.isNotEmpty || _aiLoading) return;
    update(() => _aiLoading = true);
    try {
      final res = await ref.read(healthDbProvider).invoke('food-calories', body: {'name': n, 'language': ref.read(userStoreProvider).language});
      final data = res.data;
      if (data is Map && data['found'] == true && data['calories'] != null && data['calories'] != 0 && _foodCalories.text.isEmpty) {
        update(() => _foodCalories.text = '${data['calories']}');
      }
    } catch (_) {
      // lookup failed: the user types the calories
    } finally {
      if (mounted) update(() => _aiLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dl = ref.watch(dailyLogsProvider);
    final meals = ref.watch(mealLogsProvider);
    final tipsQ = ref.watch(nutritionTipsQuery);
    if (dl.loading || tipsQ.isLoading || meals.loading) return const ToolLoading();

    final store = ref.watch(userStoreProvider);
    final lifeStage = store.lifeStage;
    final language = store.language;
    final profile = ref.watch(authProfileProvider);
    final isMultiple = (profile?.multiplesType ?? '').isNotEmpty && profile?.multiplesType != 'single';
    final babyCount = (profile?.babyCount ?? 1).clamp(1, 4);
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final childMonths = selectedChild == null ? null : getChildAge(selectedChild).months;
    final dbFoods = ref.watch(commonFoodsQuery).data ?? const <Map<String, dynamic>>[];
    final mealTypes = nutritionMealTypes(ref.watch(mealTypesQuery(lifeStage == null || lifeStage.isEmpty ? 'flow' : lifeStage)).data ?? const [], language);
    final extraKcal = lifeStage == 'bump' && isMultiple ? (babyCount - 1) * 300 : 0;
    final targets = nutritionTargets(ref.watch(nutritionTargetsQuery).data ?? const [], lifeStage, extraKcal);
    final water = ref.read(dailyLogsProvider.notifier).waterToday();
    final stats = meals.todayStats();
    final allFoods = dbFoods.isNotEmpty
        ? [for (final f in dbFoods) (name: '${f['name'] ?? ''}', calories: (f['calories'] as num?) ?? 0, emoji: '${f['emoji'] ?? ''}', mealTypes: f['meal_types'] is List ? [for (final t in f['meal_types'] as List) '$t'] : const <String>[])]
        : [
            (name: tr('nutrition_yumurta_egg', 'Yumurta'), calories: 78 as num, emoji: '🥚', mealTypes: const ['breakfast', 'lunch', 'dinner', 'snack']),
            (name: tr('nutrition_corek_1_dilim_6ad54a', 'Çörək (1 dilim)'), calories: 80 as num, emoji: '🍞', mealTypes: const ['breakfast', 'lunch', 'dinner', 'snack']),
            (name: tr('nutrition_pendir_cheese', 'Pendir'), calories: 113 as num, emoji: '🧀', mealTypes: const ['breakfast', 'lunch', 'dinner', 'snack']),
            (name: tr('nutrition_sud_1_stekan_45357d', 'Süd (1 stəkan)'), calories: 150 as num, emoji: '🥛', mealTypes: const ['breakfast', 'lunch', 'dinner', 'snack']),
          ];

    if (_meal != null) {
      final meal = _meal!;
      final info = mealTypes.where((m) => m.id == meal).firstOrNull;
      final foods = allFoods.where((f) => f.mealTypes.isEmpty || f.mealTypes.contains(meal)).toList();
      return _mealDetail(context, meal, info, meals, stats.mealCalories[meal] ?? 0, foods, language);
    }

    final a = context.a;
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: targets.description.isNotEmpty ? targets.description : tr('nutrition_saglam_qidalanma_ucun_tovsiyel_7cb135', 'Sağlam qidalanma üçün tövsiyələr'),
          title: tr('nutrition_qidalanma_title', 'Qidalanma'),
        ),
        ACard(
          variant: ACardVariant.cta,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    AEyebrow(tr('nutrition_bugunku_kalori_33554f', 'Bugünkü kalori')),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${_n(stats.totalCalories)} '),
                        TextSpan(text: '/ ${_n(targets.calories)}', style: px(13, weight: FontWeight.w700, color: a.inkSoft)),
                      ]),
                      style: AStyles.heading(context, 24),
                    ),
                    if (extraKcal > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(tr('nutrition_ekiz_ucun_elave_kalori', '+{n} kkal əkiz/çoxdöllü üçün daxildir').replaceAll('{n}', '$extraKcal'),
                            style: px(10, weight: FontWeight.w600, color: a.inkSoft)),
                      ),
                  ]),
                ),
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                  child: const Text('🍽️', style: TextStyle(fontSize: 24, height: 1.2)),
                ),
              ]),
            ),
            Container(
              height: 8,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: targets.calories == 0 ? 0 : (stats.totalCalories / targets.calories).clamp(0, 1).toDouble()),
                  duration: animationsDisabled(context) ? Duration.zero : const Duration(seconds: 1),
                  curve: Curves.easeOut,
                  builder: (context, v, _) => FractionallySizedBox(
                    widthFactor: v,
                    child: Container(decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999))),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('${stats.totalMeals} ${tr('nutrition_yemek_qeyd_edildi_1d4996', 'yemək qeyd edildi')}',
                  textAlign: TextAlign.center, style: px(12, weight: FontWeight.w600, color: a.inkSoft, height: 16 / 12)),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        AFlexTabs<String>(
          selected: _tab,
          onChanged: (t) => setState(() => _tab = t),
          tabs: [
            AFlexTab('log', tr('nutrition_yemek_b1fd56', 'Yemək')),
            AFlexTab('vitamins', tr('nutrition_vitaminler_e49129', 'Vitaminlər')),
            AFlexTab('water', tr('common_su_water', 'Su')),
          ],
        ),
        const SizedBox(height: 12),
        KeyedSubtree(
          key: ValueKey('nutrition-$_tab'),
          child: switch (_tab) {
            'vitamins' => const VitaminsTab(),
            'water' => _water(context, water, targets.water, lifeStage),
            'tips' => _tips(context, tipsQ.data ?? const [], lifeStage),
            _ => _log(context, mealTypes, meals, stats.mealCalories, childMonths, language),
          },
        ),
        SafetyStrip(signs: tr('safety_nutrition_signs', 'Zəng edin: dayanmayan qusma, maye saxlaya bilməmək, çox az sidik, başgicəllənmə')),
      ]),
    );
  }

  static String _n(num v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';

  Widget _log(BuildContext context, List<MealType> mealTypes, MealLogsState meals, Map<String, num> mealCalories, int? childMonths, String language) {
    final a = context.a;
    final rows = <Widget>[];
    for (var i = 0; i < mealTypes.length; i++) {
      final meal = mealTypes[i];
      // The mother's own "nursing meal" stayed empty; the row now opens the baby's feeding log.
      if (meal.id == 'nursing') {
        if (!offersBreastfeeding(childMonths)) continue;
        final (title, sub) = _babyFeeding();
        rows.add(AListRowBox(
          first: rows.isEmpty,
          semanticLabel: title,
          onTap: () => ref.read(healthOpenToolProvider)('baby-tracker'),
          children: [
            AListIconBox(gradient: a.gradPeach, child: const Text('🍼', style: TextStyle(fontSize: 18))),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: AStyles.listTitle(context)),
                Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, style: AStyles.listSub(context))),
              ]),
            ),
            AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
          ],
        ));
        continue;
      }
      final logs = meals.mealsByType(meal.id);
      final cal = mealCalories[meal.id] ?? 0;
      rows.add(FadeRise(
        delay: Duration(milliseconds: i * 50),
        child: AListRowBox(
          first: rows.isEmpty,
          semanticLabel: meal.name,
          onTap: () => setState(() => _meal = meal.id),
          children: [
            AListIconBox(gradient: a.gradPeach, child: Text(meal.emoji, style: const TextStyle(fontSize: 18))),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(meal.name, style: AStyles.listTitle(context)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(logs.isNotEmpty ? '${logs.length} ${mealItemWord(language, logs.length)} • ${_n(cal)} kcal' : meal.time, style: AStyles.listSub(context)),
                ),
              ]),
            ),
            logs.isNotEmpty
                ? Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
                    child: AIcon(AIcons.check, size: 14, color: a.greenInk),
                  )
                : AIcon(AIcons.plus, size: 16, color: a.peach2),
          ],
        ),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ASectionHeadRow(title: tr('nutrition_bugunku_yemekler_25c273', 'Bugünkü yeməklər')),
      AListCardBox(bottomPadding: 16, children: rows),
    ]);
  }

  Widget _tips(BuildContext context, List<Map<String, dynamic>> tips, String? lifeStage) {
    final a = context.a;
    return vgap(12, [
      Row(children: [
        AIcon(AIcons.star, size: 16, color: a.yellow2),
        const SizedBox(width: 8),
        Text(tr('nutrition_tovsiye_olunan_qidalar_5d52f5', 'Tövsiyə olunan qidalar'), style: AStyles.heading(context, 14, color: a.onBg)),
      ]),
      Text(
        lifeStage == 'bump'
            ? tr('nutrition_hamilelik_dovrunde_faydali_qid_4fb245', 'Hamiləlik dövründə faydalı qidalar')
            : lifeStage == 'mommy'
                ? tr('nutrition_emizdirme_dovrunde_faydali_qid_38d382', 'Əmizdirmə dövründə faydalı qidalar')
                : tr('nutrition_saglam_qidalanma_ucun_tovsiyel_7cb135', 'Sağlam qidalanma üçün tövsiyələr'),
        style: px(12, color: a.onBgSoft, height: 16 / 12),
      ),
      if (tips.isEmpty)
        ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 30),
          child: Column(children: [
            const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('🥗', style: TextStyle(fontSize: 36))),
            Text(tr('nutrition_tovsiye_tapilmadi_facebb', 'Tövsiyə tapılmadı'), style: AStyles.listSub(context)),
          ]),
        )
      else
        AGridCols(columns: 2, gap: 8, children: [
          for (final t in tips)
            ACard(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t['emoji'] is String ? t['emoji'] as String : '🍎', style: const TextStyle(fontSize: 24))),
                Text('${t['title'] ?? ''}', style: AStyles.listTitle(context)),
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('${t['calories'] ?? 0} kcal', style: AStyles.listSub(context))),
                Wrap(spacing: 2, runSpacing: 2, children: [
                  for (final b in (t['benefits'] is List ? t['benefits'] as List : const []).take(2))
                    APill('$b', background: a.peach1, color: a.accentInk, padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), fontSize: 8, weight: FontWeight.w600),
                ]),
              ]),
            ),
        ]),
    ]);
  }

  Widget _water(BuildContext context, int water, num target, String? lifeStage) {
    final a = context.a;
    final count = water > target ? water : target.toInt();
    return vgap(12, [
      ACard(
        child: Column(children: [
          Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.droplets, size: 40, color: a.blue2)),
          Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('$water / ${_n(target)}', style: AStyles.heading(context, 28))),
          Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(tr('nutrition_stekan_su_icdiniz_a26973', 'stəkan su içdiniz'), style: AStyles.listSub(context))),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
              for (var i = 0; i < count; i++)
                Opacity(
                  opacity: i < water ? 1 : 0.7,
                  child: Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: i < water ? a.blue2 : a.blue1,
                      borderRadius: BorderRadius.circular(12),
                      // 0 6px 14px -6px rgba(99, 172, 223, 0.7) (Nutrition.tsx literal)
                      boxShadow: i < water ? [BoxShadow(color: const Color(0xB363ACDF), offset: const Offset(0, 6), blurRadius: cssBlur(14), spreadRadius: -6)] : null,
                    ),
                    child: i < water
                        ? const LucideFilled(AIcons.droplet, size: 20, color: Color(0xFFFFFFFF))
                        : AIcon(AIcons.droplet, size: 20, color: a.blue2),
                  ),
                ),
            ]),
          ),
          APillButton(
            label: tr('nutrition_su_elave_et_6ae5c0', 'Su əlavə et'),
            icon: const AIcon(AIcons.plus, size: 15, strokeWidth: 2.2),
            height: 46,
            expand: true,
            tapScale: 0.98,
            onTap: water >= 12 ? null : () => unawaited(ref.read(dailyLogsProvider.notifier).updateWaterIntake(1)),
          ),
        ]),
      ),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('nutrition_meslehet_f594cf', '💡 Məsləhət'), style: px(14, weight: FontWeight.w700, color: a.blueInk, height: 20 / 14))),
          Text(
            lifeStage == 'bump'
                ? tr('nutrition_hamilelik_zamani_gunde_en_azi__d70ce9', 'Hamiləlik zamanı gündə ən azı 10 stəkan su içmək tövsiyə olunur. Yetərli su içmək körpənin inkişafına kömək edir.')
                : lifeStage == 'mommy'
                    ? tr('nutrition_emizdirme_dovrunde_gunde_12_st_a765d7', 'Əmizdirmə dövründə gündə 12 stəkan su içmək tövsiyə olunur. Bu süd istehsalına kömək edir.')
                    : tr('nutrition_gunde_en_azi_8_stekan_su_icmek_c12741', 'Gündə ən azı 8 stəkan su içmək bədəni sağlam saxlayır.'),
            style: px(12, color: a.blueInk, height: 16 / 12),
          ),
        ]),
      ),
    ]);
  }

  Widget _mealDetail(BuildContext context, String meal, MealType? info, MealLogsState meals, num mealCalories, List<({String name, num calories, String emoji, List<String> mealTypes})> foods,
      String language) {
    final a = context.a;
    final logs = meals.mealsByType(meal);
    final controller = ref.read(mealLogsProvider.notifier);
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: () => setState(() => _meal = null),
          eyebrow: info?.time,
          title: info?.name ?? '',
          actions: [Text(info?.emoji ?? '', style: const TextStyle(fontSize: 26, height: 1.2))],
        ),
        vgap(12, [
          ACard(
            variant: ACardVariant.cta,
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  AEyebrow(tr('nutrition_bu_yemek_be47dc', 'Bu yemək')),
                  Text.rich(
                    TextSpan(children: [TextSpan(text: '${_n(mealCalories)} '), TextSpan(text: 'kcal', style: px(13, weight: FontWeight.w700))]),
                    style: AStyles.heading(context, 24),
                  ),
                ]),
              ),
              ATagChip(children: [Text('${logs.length} ${mealItemWord(language, logs.length)}')]),
            ]),
          ),
          if (logs.isNotEmpty)
            ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('nutrition_elave_edilen_qidalar_c604e8', 'Əlavə edilən qidalar'), style: AStyles.cardTitle(context))),
                vgap(6, [
                  for (final log in logs)
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${log['food_name'] ?? ''}', style: AStyles.listTitle(context)),
                            Text('${log['calories'] ?? 0} kcal', style: AStyles.listSub(context)),
                          ]),
                        ),
                        ATap(
                          scale: 0.9,
                          semanticLabel: tr('common_sil', 'Sil'),
                          onTap: () => controller.deleteMealLog('${log['id']}'),
                          child: Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
                            child: AIcon(AIcons.trash2, size: 14, color: a.pinkInk),
                          ),
                        ),
                      ]),
                    ),
                ]),
              ]),
            ),
          ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('nutrition_tez_elave_et_5c2127', 'Tez əlavə et'), style: AStyles.cardTitle(context))),
              AGridCols(columns: 4, gap: 6, children: [
                for (final f in foods)
                  ATap(
                    scale: 0.95,
                    semanticLabel: f.name,
                    onTap: () => controller.addMealLog(mealType: meal, foodName: f.name, calories: f.calories),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.line)),
                      child: Column(children: [
                        Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(f.emoji, style: const TextStyle(fontSize: 20, height: 28 / 20))),
                        Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(9, weight: FontWeight.w600, color: a.ink)),
                        Text(_n(f.calories), style: px(8, color: a.inkSoft)),
                      ]),
                    ),
                  ),
              ]),
            ]),
          ),
          ATap(
            onTap: _openCustomFood,
            semanticLabel: tr('nutrition_xususi_qida_elave_et_2a3838', 'Xüsusi qida əlavə et'),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.peach2, width: 1.5)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                AIcon(AIcons.plus, size: 16, color: a.accentInk),
                const SizedBox(width: 8),
                Text(tr('nutrition_xususi_qida_elave_et_2a3838', 'Xüsusi qida əlavə et'), style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14)),
              ]),
            ),
          ),
        ]),
      ]),
    );
  }

  void _openCustomFood() {
    final meal = _meal;
    if (meal == null) return;
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'sheet',
      barrierColor: const Color(0x80000000),
      transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, _) => Align(
        alignment: Alignment.bottomCenter,
        child: AScope(
          child: Material(
            type: MaterialType.transparency,
            child: StatefulBuilder(builder: (ctx, setLocal) {
              void update(VoidCallback f) {
                if (mounted) setState(f);
                setLocal(() {});
              }

              return _customFoodSheet(ctx, meal, update);
            }),
          ),
        ),
      ),
      transitionBuilder: (ctx, anim, _, child) => SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(anim), child: child),
    );
  }

  Widget _customFoodSheet(BuildContext context, String meal, void Function(VoidCallback) update) {
    final a = context.a;
    final ready = _foodName.text.isNotEmpty && _foodCalories.text.isNotEmpty;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.paddingOf(context).bottom + 100),
      decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Row(children: [
            Expanded(child: Text(tr('nutrition_xususi_qida_elave_et_2a3838', 'Xüsusi qida əlavə et'), style: AStyles.heading(context, 16))),
            AIconBtn(semanticLabel: tr('common_close', 'Bağla'), onTap: () => Navigator.of(context).pop(), icon: const AIcon(AIcons.x, size: 15)),
          ]),
        ),
        vgap(12, [
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('nutrition_qida_adi_d6a129', 'Qida adı'), style: AStyles.listSub(context))),
            AField(
              fieldKey: const ValueKey('food-name'),
              controller: _foodName,
              onChanged: (_) => update(() {}),
              onBlur: (v) => _autoFillCalories(v, update),
              placeholder: tr('nutrition_food_ph', 'məs. Plov'),
            ),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(children: [
                Text(tr('untranslated_kalori_y6oaf2', 'Kalori'), style: AStyles.listSub(context)),
                if (_aiLoading) ...[
                  const SizedBox(width: 6),
                  Text('✨ ${tr('nutrition_ai_kalori_axtarir', 'AI təyin edir...')}', style: px(10.5, weight: FontWeight.w700, color: a.peach2)),
                ],
              ]),
            ),
            AField(
              fieldKey: const ValueKey('food-calories'),
              controller: _foodCalories,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: (_) => update(() {}),
              placeholder: tr('nutrition_kcal_ph', 'məs. 350'),
            ),
          ]),
          APillButton(
            label: tr('nutrition_elave_et_6e1b9b', 'Əlavə et'),
            icon: const AIcon(AIcons.check, size: 15, strokeWidth: 2.2),
            height: 46,
            expand: true,
            onTap: !ready
                ? null
                : () async {
                    final nav = Navigator.of(context);
                    await ref.read(mealLogsProvider.notifier).addMealLog(mealType: meal, foodName: _foodName.text, calories: int.tryParse(_foodCalories.text) ?? 0);
                    _foodName.clear();
                    _foodCalories.clear();
                    if (nav.mounted) nav.pop();
                  },
          ),
        ]),
      ]),
    );
  }
}
