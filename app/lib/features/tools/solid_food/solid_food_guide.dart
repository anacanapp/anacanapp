// Ported from: src/components/tools/SolidFoodGuide.tsx, src/styles/solid-food-guide.css
//
// Complementary feeding guide (0–4 years): stage, balance, rules, foods and recipes tabs. Texts per language from
// the bundled JSON (solid_food_data.dart). "Recipes" opens the Recipes tool inline (in the baby_food category);
// that tool belongs to another feature and is plugged in through [solidFoodRecipesSlotProvider].
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart';
import '../../../native/purchases/purchases.dart' show subscriptionProvider;
import '../../../shell/shell.dart';
import '../../baby/hooks/use_children.dart';
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../baby_tracker/bt_ui.dart' show A3ChipButton;
import '../data/data.dart' show recipesQuery;
import '../kit/kit.dart';
import 'solid_food_data.dart';

/// `<Recipes onBack initialCategory initialRecipeId />` rendered in place of the guide. Default (null): the
/// registered Recipes tool (no preselected category / recipe until the recipes feature fills this slot).
typedef SolidFoodRecipesBuilder = Widget Function(BuildContext context, {required VoidCallback onBack, required String initialCategory, String? initialRecipeId});

final solidFoodRecipesSlotProvider = Provider<SolidFoodRecipesBuilder?>((ref) => null, name: 'solidFoodRecipesSlotProvider');

// .sfg-tag-* literals (solid-food-guide.css)
const Map<String, (Color, Color)> _tagColors = {
  'iron': (Color(0xFFFDE3E1), Color(0xFFB3373D)),
  'ca': (Color(0xFFE3EEFC), Color(0xFF2F5D9A)),
  'omega': (Color(0xFFDFF3EE), Color(0xFF23735D)),
  'c': (Color(0xFFFFF1D2), Color(0xFF946200)),
  'allergen': (Color(0xFFF1E6FB), Color(0xFF6B3FA0)),
};

const List<String> _tabs = ['stage', 'balance', 'rules', 'foods', 'recipes'];

class SolidFoodGuide extends ConsumerStatefulWidget {
  const SolidFoodGuide({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<SolidFoodGuide> createState() => _SolidFoodGuideState();
}

class _SolidFoodGuideState extends ConsumerState<SolidFoodGuide> {
  String _tab = 'stage';
  String? _stageId;
  final List<int> _ready = [];
  String _group = 'all';
  ({String? recipeId})? _recipesView;

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final months = selectedChild == null ? null : getChildAge(selectedChild).months;
    _stageId ??= stageFor(months).id;
    final isPremium = ref.watch(subscriptionProvider.select((s) => s.isPremium));
    final emergency = ref.watch(emergencyNumberProvider);
    final textAsync = ref.watch(solidFoodGuideTextProvider(language));
    final sourceTitles = ref.watch(babyRecipeSourceTitlesQuery).data ?? const <String, String>{};
    final allRecipes = ref.watch(recipesQuery).data ?? const <Map<String, dynamic>>[];

    final t = textAsync.value;
    if (t == null) {
      return ToolPage(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [ToolHeader(title: '', onBack: widget.onBack), const ToolLoading()]));
    }

    // Same order and free tier as the Recipes tool: the first three of the category are free.
    final baby = allRecipes.where((r) => r['category'] == babyRecipeCategory).toList();
    final babyRecipes = [
      for (var i = 0; i < baby.length; i++)
        (recipe: baby[i], minMonths: recipeMinMonths(sourceTitles['${baby[i]['id']}'] ?? '${baby[i]['title'] ?? ''}'), free: i < 3),
    ];
    final suggested = [
      ...babyRecipes.where((r) => months == null || r.minMonths == null || r.minMonths! <= (months > 6 ? months : 6)),
    ]..sort((p, q) => (q.minMonths ?? 0) - (p.minMonths ?? 0));
    final topSuggested = suggested.take(8).toList();

    if (_recipesView != null) {
      final slot = ref.watch(solidFoodRecipesSlotProvider);
      void back() => setState(() => _recipesView = null);
      if (slot != null) return slot(context, onBack: back, initialCategory: babyRecipeCategory, initialRecipeId: _recipesView!.recipeId);
      final builder = ref.watch(featureRegistryProvider).tool(ToolId.recipes);
      return builder != null
          ? builder(context, ShellToolArgs(tool: ToolId.recipes, rawId: ToolId.recipes.id, onBack: back))
          : ShellPlaceholder(kind: 'tool', id: ToolId.recipes.id, onBack: back, fill: false);
    }

    final stage = stages.firstWhere((s) => s.id == _stageId, orElse: () => stages[1]);
    final stageTexts = t.stages;
    final stageText = stageTexts.firstWhere((s) => s['id'] == stage.id, orElse: () => stageTexts[1]);
    final foodTexts = t.foods;
    final foodsShown = [
      for (var i = 0; i < foods.length; i++)
        if (_group == 'all' || foods[i].group == _group) (meta: foods[i], text: foodTexts[i]),
    ];
    final dishKey = t.dishes.containsKey(stage.id) ? stage.id : '6-8';
    final dishNames = t.dishes[dishKey]!;
    String ageLabel(int m) => m < 24 ? fill(t.u('months_short'), m) : fill(t.u('years_short'), m ~/ 12);
    String agePlus(int m) => m < 12 ? fill(t.u('months_plus'), m) : fill(t.u('years_plus'), _jsDiv(m, 12));
    final ageText = months == null ? null : '${selectedChild?.name ?? ''} · ${ageLabel(months)}';
    final nutrients = t.nutrients;

    final a = context.a;
    final x = context.aText;
    final h = TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: a.ink, height: 1.5);
    final meta = x.a3Meta;
    Widget heading(String s, {Color? color}) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(s, style: color == null ? h : h.copyWith(color: color)));
    Widget gap(Widget w) => Padding(padding: const EdgeInsets.only(top: 10), child: w);
    Widget chips(List<Widget> children) => Padding(padding: const EdgeInsets.only(top: 12), child: Wrap(spacing: 5, runSpacing: 5, children: children));
    Widget small(String label, bool on, VoidCallback onTap, {Key? key}) =>
        A3ChipButton(key: key, label: label, on: on, onTap: onTap, height: 32, padding: 13, fontSize: 13, semanticsRadio: true);
    Widget stack(List<Widget> children) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 12), children[i]],
          ]),
        );
    Widget card(List<Widget> children) => ACard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children));
    Widget tags(List<String> list) => list.isEmpty
        ? const SizedBox.shrink()
        : Wrap(spacing: 4, runSpacing: 4, children: [
            for (final tag in list)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: _tagColors[tag]!.$1, borderRadius: BorderRadius.circular(999)),
                child: Text(t.u('tag_$tag'), maxLines: 1, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: _tagColors[tag]!.$2, height: 1.5)),
              ),
          ]);
    Widget divided(List<Widget> rows, {bool dashed = false}) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < rows.length; i++)
            Container(decoration: BoxDecoration(border: i > 0 ? Border(top: BorderSide(color: a.line)) : null), child: rows[i]),
        ]);
    Widget dots(List<String> items) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsetsDirectional.only(top: i > 0 ? 4 : 0),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 18, child: Text('•', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: a.ink, height: 1.5))),
                Expanded(child: Text(items[i], style: TextStyle(fontSize: 13, color: a.ink, height: 1.5))),
              ]),
            ),
        ]);
    Widget until(String s) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
          child: Text(s, maxLines: 1, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
        );
    final plateColors = [a.coral, a.yellow2, a.green2];

    final stageTab = stack([
      chips([
        for (final s in stageTexts) small('${s['label']}', s['id'] == _stageId, () => setState(() => _stageId = '${s['id']}'), key: ValueKey('sfg-stage-${s['id']}')),
      ]),
      card([
        Text(_upper('${stageText['label']}', language), style: x.a3Eyebrow),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 12),
          child: Text('${stageText['goal']}', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.35, color: a.ink)),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _grid2([
            for (final f in [
              (t.u('fact_milk'), stageText['milk']),
              (t.u('fact_meals'), stageText['meals']),
              (t.u('fact_portion'), stageText['portion']),
              (t.u('fact_texture'), stageText['texture']),
            ])
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_upper(f.$1, language), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.55, color: a.inkSoft, height: 1.5)),
                  Padding(padding: const EdgeInsets.only(top: 3), child: Text('${f.$2 ?? ''}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.35, color: a.ink))),
                ]),
              ),
          ], gap: 8),
        ),
        Text(t.u('portion_note'), style: meta),
      ]),
      if (stage.id == '0-6')
        card([
          heading(t.u('readiness_title')),
          divided([
            for (var i = 0; i < t.readiness.length; i++)
              Semantics(
                button: true,
                toggled: _ready.contains(i),
                child: GestureDetector(
                  key: ValueKey('sfg-ready-$i'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _ready.contains(i) ? _ready.remove(i) : _ready.add(i)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    child: Row(children: [
                      Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _ready.contains(i) ? a.greenInk : null,
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: _ready.contains(i) ? const Color(0x00000000) : a.line, width: 1.5),
                        ),
                        child: _ready.contains(i) ? const AIcon(AIcons.check, size: 13, color: Color(0xFFFFFFFF)) : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(t.readiness[i], style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink, height: 1.5))),
                    ]),
                  ),
                ),
              ),
          ]),
          gap(Text(_ready.length == t.readiness.length ? t.u('readiness_all') : t.u('readiness_hint'), style: meta)),
        ]),
      if (stage.id == '6-8')
        card([
          heading(t.u('sample_day_title')),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < t.sampleDay.length; i++)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(border: i > 0 ? Border(top: BorderSide(color: a.line)) : null),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 96, child: Text('${t.sampleDay[i]['time']}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5))),
                  const SizedBox(width: 12),
                  Expanded(child: Text('${t.sampleDay[i]['what']}', style: TextStyle(fontSize: 13.5, color: a.ink, height: 1.5))),
                ]),
              ),
          ]),
        ]),
      if (stage.id != '0-6')
        card([
          heading(t.u('dishes_title')),
          divided([
            for (var i = 0; i < dishNames.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Expanded(child: Text(dishNames[i], style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: a.ink, height: 1.5))),
                  const SizedBox(width: 8),
                  Flexible(child: Align(alignment: AlignmentDirectional.centerEnd, child: tags(i < (dishTags[dishKey]?.length ?? 0) ? dishTags[dishKey]![i] : const []))),
                ]),
              ),
          ]),
          gap(Align(
            alignment: AlignmentDirectional.centerStart,
            child: GestureDetector(
              key: const ValueKey('sfg-see-recipes'),
              onTap: () => setState(() => _tab = 'recipes'),
              child: Text(t.u('see_recipes'), style: x.a3Link),
            ),
          )),
        ]),
    ]);

    final balanceTab = stack([
      card([
        heading(t.u('plate_title')),
        ExcludeSemantics(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 14,
              child: Row(children: [
                for (var i = 0; i < plate.length; i++) ...[
                  if (i > 0) const SizedBox(width: 3),
                  Expanded(flex: plate[i].share, child: Container(color: plateColors[i])),
                ],
              ]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < plate.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: const EdgeInsets.only(top: 5), child: Container(width: 10, height: 10, decoration: BoxDecoration(color: plateColors[i], shape: BoxShape.circle))),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${t.plate[i]['label']}', style: TextStyle(color: a.ink, fontWeight: FontWeight.w700)),
                        TextSpan(text: ' ${t.plate[i]['hint']}'),
                      ]),
                      style: TextStyle(fontSize: 13, color: a.inkSoft, height: 1.5),
                    ),
                  ),
                ]),
              ),
          ]),
        ),
        gap(Text(t.u('plate_note'), style: meta)),
      ]),
      card([
        heading(t.u('needs_title')),
        _NeedsTable(ages: t.nutrientAges, rows: [for (final n in nutrients) if ((n['need'] as List).isNotEmpty && (n['need'] as List)[0] != '—') n]),
        gap(Text(t.u('needs_note'), style: meta)),
      ]),
      card([
        heading(t.u('sources_title')),
        divided([
          for (final n in nutrients)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text.rich(TextSpan(children: [
                  TextSpan(text: '${n['name']}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink)),
                  const TextSpan(text: ' '),
                  TextSpan(text: '${n['rule']}', style: meta),
                ]), style: const TextStyle(height: 1.5)),
                Text('${n['sources']}', style: meta),
              ]),
            ),
        ]),
      ]),
      ACard(
        child: _grid2([
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [heading(t.u('iron_helps_title'), color: a.greenInk), dots(t.ironHelps)]),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [heading(t.u('iron_blocks_title'), color: a.coralStrong), dots(t.ironBlocks)]),
        ], gap: 12),
      ),
    ]);

    final rulesTab = stack([
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        // .sfg-alert { background: #fde3e1; color: #9b2c31 }
        decoration: BoxDecoration(color: const Color(0xFFFDE3E1), borderRadius: BorderRadius.circular(16)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const AIcon(AIcons.triangleAlert, size: 18, color: Color(0xFF9B2C31)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(fillEmergencyNumber(t.emergency, emergency),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.45, color: Color(0xFF9B2C31))),
          ),
        ]),
      ),
      card([
        heading(t.u('allergens_title')),
        Text(t.u('allergens_intro'), style: meta),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < t.allergenSteps.length; i++)
              Padding(
                padding: EdgeInsets.only(top: i > 0 ? 5 : 0),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 18, child: Text('${i + 1}.', style: TextStyle(fontSize: 13.5, color: a.ink, height: 1.5))),
                  Expanded(child: Text(t.allergenSteps[i], style: TextStyle(fontSize: 13.5, color: a.ink, height: 1.5))),
                ]),
              ),
          ]),
        ),
        chips([
          for (final al in t.allergens)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(color: _tagColors['allergen']!.$1, borderRadius: BorderRadius.circular(999)),
              child: Text(al, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: _tagColors['allergen']!.$2, height: 1.5)),
            ),
        ]),
      ]),
      card([
        heading(t.u('avoid_title')),
        divided([
          for (final av in t.avoid)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${av['food']}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink, height: 1.5)),
                    Text('${av['why']}', style: meta),
                  ]),
                ),
                const SizedBox(width: 10),
                until('${av['until']}'),
              ]),
            ),
        ]),
      ]),
      card([
        heading(t.u('choking_title')),
        dots(t.choking),
        gap(Text(t.u('choking_note'), style: meta)),
      ]),
      card([
        heading(t.u('myths_title')),
        divided([
          for (final m in t.myths)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text('“${m['myth']}”',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: a.ink,
                        height: 1.5,
                        decoration: TextDecoration.lineThrough,
                        decorationColor: const Color(0x80D93A40), // rgba(217, 58, 64, .5)
                      )),
                ),
                Text('${m['fact']}', style: meta),
              ]),
            ),
        ]),
      ]),
    ]);

    final foodsTab = stack([
      chips([
        for (final g in ['all', ...foodGroups])
          small(g == 'all' ? t.u('all') : (t.foodGroups[g] ?? g), _group == g, () => setState(() => _group = g), key: ValueKey('sfg-group-$g')),
      ]),
      ACard(
        variant: ACardVariant.list,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < foodsShown.length; i++)
            Opacity(
              opacity: months != null && months < foodsShown[i].meta.from ? 0.55 : 1,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(border: i > 0 ? Border(top: BorderSide(color: a.line)) : null),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        Text('${foodsShown[i].text['name']}', style: x.aListTitle),
                        tags(foodsShown[i].meta.tags),
                      ]),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text('${foodsShown[i].text['form']} · ${foodsShown[i].text['value']}', style: x.aListSub)),
                    ]),
                  ),
                  const SizedBox(width: 13),
                  until(agePlus(foodsShown[i].meta.from)),
                ]),
              ),
            ),
        ]),
      ),
    ]);

    final recipesTab = stack([
      Text(t.u('recipes_intro'), style: meta),
      ACard(
        variant: ACardVariant.list,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < topSuggested.length; i++)
            GestureDetector(
              key: ValueKey('sfg-recipe-${topSuggested[i].recipe['id']}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _recipesView = (recipeId: '${topSuggested[i].recipe['id']}')),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(border: i > 0 ? Border(top: BorderSide(color: a.line)) : null),
                child: Row(children: [
                  if ((topSuggested[i].recipe['image_url'] as String? ?? '').isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(topSuggested[i].recipe['image_url'] as String, width: 44, height: 44, fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const SizedBox(width: 44, height: 44)),
                    )
                  else
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(13)),
                      child: const Text('🥣', style: TextStyle(fontSize: 18)),
                    ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(stripAge('${topSuggested[i].recipe['title'] ?? ''}'), style: x.aListTitle),
                      if (topSuggested[i].minMonths != null)
                        Padding(padding: const EdgeInsets.only(top: 2), child: Text(agePlus(topSuggested[i].minMonths!), style: x.aListSub)),
                    ]),
                  ),
                  const SizedBox(width: 13),
                  if (!isPremium && !topSuggested[i].free)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      // .sfg-lock { background: #fff3cf; color: #7a4b00 }
                      decoration: BoxDecoration(color: const Color(0xFFFFF3CF), borderRadius: BorderRadius.circular(999)),
                      child: const Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.lock, size: 12, color: Color(0xFF7A4B00)),
                        SizedBox(width: 4),
                        Text('Premium', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF7A4B00), height: 1.5)),
                      ]),
                    )
                  else
                    AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                ]),
              ),
            ),
          if (topSuggested.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(t.u('recipes_loading'), style: meta)),
        ]),
      ),
      GestureDetector(
        key: const ValueKey('sfg-all-recipes'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _recipesView = (recipeId: null)),
        child: Container(
          padding: const EdgeInsets.all(14),
          // .sfg-premium { background: linear-gradient(135deg, #fff3cf, #ffe2d6); color: #7a4b00 }
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFF3CF), Color(0xFFFFE2D6)]),
          ),
          child: Row(children: [
            const AIcon(AIcons.crown, size: 18, color: Color(0xFF7A4B00)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.u('all_recipes'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink, height: 1.5)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(fill(t.u('all_recipes_sub'), babyRecipes.length), style: TextStyle(fontSize: 12.5, color: a.inkSoft, height: 1.5)),
                ),
              ]),
            ),
            const SizedBox(width: 12),
            const AIcon(AIcons.chevronRight, size: 16, color: Color(0xFF7A4B00), mirrorInRtl: true),
          ]),
        ),
      ),
    ]);

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(title: t.u('title'), eyebrow: ageText, onBack: widget.onBack),
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: chips([
            for (final id in _tabs) A3ChipButton(key: ValueKey('sfg-tab-$id'), label: t.u('tab_$id'), on: _tab == id, onTap: () => setState(() => _tab = id)),
          ]),
        ),
        if (_tab == 'stage') stageTab,
        if (_tab == 'balance') balanceTab,
        if (_tab == 'rules') rulesTab,
        if (_tab == 'foods') foodsTab,
        if (_tab == 'recipes') recipesTab,
        SafetyStrip(signs: tr('safety_solids_signs', 'Zəng edin: boğulma, üz/dodaq şişməsi, səpgi, qusma, nəfəs çətinliyi')),
        Padding(padding: const EdgeInsets.only(top: 18), child: Text(t.disclaimer, textAlign: TextAlign.center, style: meta)),
      ]),
    );
  }
}

/// `fill(years_plus, m / 12)`: JS division (`1.5` for 18 months, `1` for 12).
String _jsDiv(int m, int d) {
  final v = m / d;
  return v == v.truncateToDouble() ? '${v.toInt()}' : '$v';
}

String _upper(String s, String language) => (language == 'az' || language == 'tr' ? s.replaceAll('i', 'İ') : s).toUpperCase();

/// Two equal columns (`grid-template-columns: 1fr 1fr`), rows top-aligned.
Widget _grid2(List<Widget> cells, {required double gap}) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < cells.length; i += 2) ...[
        if (i > 0) SizedBox(height: gap),
        IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: cells[i]),
            SizedBox(width: gap),
            Expanded(child: i + 1 < cells.length ? cells[i + 1] : const SizedBox.shrink()),
          ]),
        ),
      ],
    ]);

class _NeedsTable extends StatelessWidget {
  const _NeedsTable({required this.ages, required this.rows});
  final List<String> ages;
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget tr(List<Widget> cells, {bool first = false}) => Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
          child: Row(children: [
            Expanded(flex: 12, child: cells[0]),
            for (var i = 1; i < cells.length; i++) ...[const SizedBox(width: 6), Expanded(flex: 10, child: cells[i])],
          ]),
        );
    final head = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5);
    final cell = TextStyle(fontSize: 12.5, color: a.ink, height: 1.5);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      tr([const SizedBox.shrink(), for (final ag in ages) Text(ag, style: head)], first: true),
      for (final n in rows)
        tr([
          Text('${n['name']}', style: cell.copyWith(fontWeight: FontWeight.w700)),
          for (final v in n['need'] as List) Text('$v', style: cell),
        ]),
    ]);
  }
}
