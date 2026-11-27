// Ported from: src/components/tools/Recipes.tsx
//
// Recipes (`recipes`): search, category chips, a two-column grid (3 free recipes per category, the rest Premium) and
// the recipe detail (ingredients, steps, allergy note). Ads are seams ([healthAdSlotsProvider]).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../native/purchases/purchases.dart' show subscriptionProvider;
import '../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../data/dynamic_content.dart' show recipesQuery;
import '../data/dynamic_tools.dart' show recipeCategoriesQuery;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'recipes_logic.dart';

const String _scrollKey = 'tool:recipes-list';

class Recipes extends ConsumerStatefulWidget {
  const Recipes({super.key, required this.onBack, this.initialCategory, this.initialRecipeId});
  final VoidCallback onBack;

  /// Opened from another tool (e.g. the solid food guide): start on this category / recipe.
  final String? initialCategory;
  final String? initialRecipeId;

  @override
  ConsumerState<Recipes> createState() => _RecipesState();
}

class _RecipesState extends ConsumerState<Recipes> {
  Map<String, dynamic>? _selected;
  late String _category = widget.initialCategory ?? 'all';
  final _search = TextEditingController();
  List<String> _favorites = [];
  bool _initialOpened = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _toggleFavorite(String id) => setState(() => _favorites = _favorites.contains(id) ? _favorites.where((f) => f != id).toList() : [..._favorites, id]);

  String? _cached(String key, String language) => I18nRuntime.instance.store.lookup(key, language);

  void _open(Map<String, dynamic> recipe, bool isPremium, Set<String> free) {
    if (!isPremium && !free.contains('${recipe['id']}')) {
      ref.read(healthPaywallProvider)(context, tr('recipes_reseptler_98ed2c', 'Reseptlər'));
      return;
    }
    // Save the list position, then show the detail from the top.
    final memory = ref.read(scrollMemoryProvider);
    memory.save(_scrollKey);
    setState(() => _selected = recipe);
    memory.scrollToTop();
  }

  void _backFromDetail() {
    setState(() => _selected = null);
    ref.read(scrollMemoryProvider).restore(_scrollKey);
  }

  Future<void> _leave() async {
    final exit = ref.read(healthAdSlotsProvider).adExit;
    if (exit == null) return _backFromDetail();
    await exit(context, 'recipe_exit_interstitial', _backFromDetail);
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final sub = ref.watch(subscriptionProvider);
    final isPremium = sub.isPremium;
    final recipesQ = ref.watch(recipesQuery);
    final recipes = recipesQ.data ?? const <Map<String, dynamic>>[];
    final categories = ref.watch(recipeCategoriesQuery).data ?? const <Map<String, dynamic>>[];
    final free = freeRecipeIds(recipes, categories);
    final slots = ref.watch(healthAdSlotsProvider);
    String catName(Object? cat, [String? label]) => translatedCategoryName(cat, categories, language, localizedLabel: label, cachedTranslation: _cached);

    // Open the requested recipe once the list is loaded (the premium gate still applies).
    if (!_initialOpened && widget.initialRecipeId != null && !sub.loading) {
      final r = recipes.where((r) => r['id'] == widget.initialRecipeId).firstOrNull;
      if (r != null) {
        _initialOpened = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _open(r, isPremium, free);
        });
      }
    }

    final selected = _selected;
    if (selected != null && (isPremium || free.contains('${selected['id']}'))) {
      return KeyedSubtree(key: ValueKey('recipe-${selected['id']}'), child: _detail(context, selected, catName, slots));
    }

    final query = _search.text.toLowerCase();
    final filtered = recipes.where((r) => isCategoryMatch(r['category'], _category, categories) && '${r['title'] ?? ''}'.toLowerCase().contains(query)).toList();
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (slots.adSurface != null) slots.adSurface!(context, 'recipes_banner'),
      ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('recipes_saglam_ve_lezzetli_yemekler_ad49b7', 'Sağlam və ləzzətli yeməklər'),
            title: tr('recipes_reseptler_98ed2c', 'Reseptlər'),
          ),
          if (!isPremium)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: FadeRise(
                dy: 10,
                child: ACard(
                  child: Row(children: [
                    AListIconBox(gradient: a.gradYellow, child: AIcon(AIcons.crown, size: 17, strokeWidth: 2.2, color: a.warnInk)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('recipes_daha_cox_resept_975410', 'Daha çox resept?'), style: AStyles.listTitle(context)),
                        Text(tr('recipes_her_kateqoriyadan_3_resept_pulsuzdur_ham_42a43d', 'Hər kateqoriyadan 3 resept pulsuzdur. Hamısını görmək üçün Premium-a keçin'),
                            style: AStyles.listSub(context)),
                      ]),
                    ),
                    const SizedBox(width: 12),
                    APulse(child: AIcon(AIcons.sparkles, size: 20, color: a.yellow2)),
                  ]),
                ),
              ),
            ),
          if (slots.adInlineAnchor != null) slots.adInlineAnchor!(context, 'recipes_banner'),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ASearchField(fieldKey: const ValueKey('recipes-search'), controller: _search, placeholder: tr('untranslated_resept_axtar_8odzsd', 'Resept axtar...')),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: hgap(8, [
                for (final c in recipeChipCategories(categories))
                  ATap(
                    scale: 0.95,
                    semanticLabel: catName(c.id).isNotEmpty ? catName(c.id) : c.name,
                    selected: _category == c.id,
                    onTap: () => setState(() => _category = c.id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: _category == c.id
                          ? ASurfaces.gradCta(a, borderRadius: BorderRadius.circular(999))
                          : BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(c.emoji, style: const TextStyle(fontSize: 18, height: 28 / 18)),
                        const SizedBox(width: 8),
                        Text(catName(c.id).isNotEmpty ? catName(c.id) : c.name,
                            style: px(14, weight: FontWeight.w700, color: _category == c.id ? a.accentInk : a.inkSoft, height: 20 / 14)),
                      ]),
                    ),
                  ),
              ])),
            ),
          ),
          if (recipesQ.isLoading)
            AGridCols(columns: 2, gap: 12, children: [
              for (var i = 0; i < 4; i++)
                APulse(
                  child: ACard(
                    variant: ACardVariant.list,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Container(height: 112, color: a.surfaceSoft),
                      const Padding(
                        padding: EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [ABar(height: 16, widthFactor: 0.75, radius: 999), SizedBox(height: 8), ABar(height: 12, widthFactor: 0.5, radius: 999)]),
                      ),
                    ]),
                  ),
                ),
            ])
          else if (filtered.isEmpty)
            ACard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
              child: Column(children: [
                Container(
                  width: 80,
                  height: 80,
                  margin: const EdgeInsets.only(bottom: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.illusGrad, borderRadius: BorderRadius.circular(24)),
                  child: AIcon(AIcons.utensilsCrossed, size: 40, color: a.peach2),
                ),
                Text(tr('recipes_resept_tapilmadi_dde89b', 'Resept tapılmadı'), style: AStyles.listTitle(context)),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(tr('recipes_basqa_kateqoriya_yoxlayin_31917a', 'Başqa kateqoriya yoxlayın'), textAlign: TextAlign.center, style: AStyles.listSub(context)),
                ),
              ]),
            )
          else
            AGridCols(columns: 2, gap: 12, children: [for (final r in filtered) _card(context, r, isPremium, free, catName)]),
          if (!recipesQ.isLoading && filtered.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Text('${filtered.length} ${tr('recipes_resept_tapildi_1d8733', 'resept tapıldı')}',
                  textAlign: TextAlign.center, style: px(12, color: a.onBgSoft, height: 16 / 12)),
            ),
        ]),
      ),
    ]);
  }

  static num _time(Map<String, dynamic> r) => ((r['prep_time'] as num?) ?? 0) + ((r['cook_time'] as num?) ?? 0);

  Widget _image(BuildContext context, Map<String, dynamic> r, double height, double emojiSize) {
    final a = context.a;
    final url = r['image_url'];
    final emoji = Container(
      height: height,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: a.illusGrad),
      child: Text(r['emoji'] is String && (r['emoji'] as String).isNotEmpty ? r['emoji'] as String : '🍽️', style: TextStyle(fontSize: emojiSize, height: 1)),
    );
    if (url is! String || url.isEmpty) return emoji;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Image.network(url, fit: BoxFit.cover, errorBuilder: (_, _, _) => emoji, semanticLabel: '${r['title'] ?? ''}'),
    );
  }

  Widget _card(BuildContext context, Map<String, dynamic> r, bool isPremium, Set<String> free, String Function(Object?, [String?]) catName) {
    final a = context.a;
    final id = '${r['id']}';
    final locked = !isPremium && !free.contains(id);
    final fav = _favorites.contains(id);
    final servings = r['servings'];
    return Semantics(
      button: true,
      label: '${r['title'] ?? ''}',
      child: PressScale.css(
        scale: 0.98,
        duration: const Duration(milliseconds: 150),
        curve: ACurves.cssEase,
        onTap: () => _open(r, isPremium, free),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: a.line), boxShadow: a.cardShadow),
          child: Stack(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(
                height: 112,
                child: Stack(fit: StackFit.expand, children: [
                  _image(context, r, 112, 48),
                  if (_time(r) > 0)
                    PositionedDirectional(
                      top: 8,
                      start: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0x99000000), borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const AIcon(AIcons.clock, size: 12, color: Color(0xFFFFFFFF)),
                          const SizedBox(width: 4),
                          Text('${_time(r)} ${tr('recipes_deq_780a5c', 'dəq')}', style: px(10, color: const Color(0xFFFFFFFF))),
                        ]),
                      ),
                    ),
                  PositionedDirectional(
                    top: 8,
                    end: 8,
                    child: ATap(
                      scale: 0.8,
                      semanticLabel: 'Favorite',
                      selected: fav,
                      onTap: () => _toggleFavorite(id),
                      child: Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          color: Color(0xE6FFFFFF),
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -1)],
                        ),
                        child: fav ? LucideFilled(AIcons.heart, size: 14, color: a.pink2) : AIcon(AIcons.heart, size: 14, color: a.inkFaint),
                      ),
                    ),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('${r['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                  ),
                  Row(children: [
                    Flexible(
                      child: APill(catName(r['category'], r['categoryLabel'] as String?),
                          background: a.surfaceSoft, color: a.inkSoft, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), weight: FontWeight.w600),
                    ),
                    const Spacer(),
                    if (!free.contains(id)) ...[AIcon(AIcons.crown, size: 12, color: a.yellow2), const SizedBox(width: 6)],
                    if (servings != null && servings != 0)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.users, size: 12, color: a.inkSoft),
                        const SizedBox(width: 2),
                        Text('$servings', style: px(10, color: a.inkSoft)),
                      ]),
                  ]),
                ]),
              ),
            ]),
            if (locked)
              Positioned.fill(
                child: Stack(children: [
                  // Solid translucent cover (a backdrop blur on every card froze weak devices).
                  Positioned.fill(child: Opacity(opacity: 0.86, child: ColoredBox(color: a.surface))),
                  Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          gradient: a.gradYellow,
                          shape: BoxShape.circle,
                          boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                        ),
                        child: AIcon(AIcons.lock, size: 20, color: a.warnInk),
                      ),
                      const SizedBox(height: 4),
                      Text('Premium', style: px(12, weight: FontWeight.w700, color: a.yellowInk, height: 16 / 12)),
                    ]),
                  ),
                ]),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _detail(BuildContext context, Map<String, dynamic> r, String Function(Object?, [String?]) catName, HealthAdSlots slots) {
    final a = context.a;
    final id = '${r['id']}';
    final fav = _favorites.contains(id);
    final prep = (r['prep_time'] as num?) ?? 0;
    final cook = (r['cook_time'] as num?) ?? 0;
    final servings = r['servings'];
    final description = r['description'];
    final ingredients = r['ingredients'] is List ? [for (final i in r['ingredients'] as List) '$i'] : const <String>[];
    final instructions = r['instructions'] is List ? [for (final i in r['instructions'] as List) '$i'] : const <String>[];
    Widget chip(Color bg, Color ink, AIconData icon, String text) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(icon, size: 16, color: ink),
            const SizedBox(width: 6),
            Text(text, style: px(14, weight: FontWeight.w700, color: ink, height: 20 / 14)),
          ]),
        );
    Widget sectionHead(Gradient grad, Color ink, String emoji, String title, String count) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(gradient: grad),
          child: Row(children: [
            Text(emoji, style: const TextStyle(fontSize: 18, height: 28 / 18)),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: AStyles.heading(context, 16, color: ink))),
            APill(count, background: const Color(0x73FFFFFF), color: ink, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), fontSize: 12, weight: FontWeight.w700),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (slots.adSurface != null) slots.adSurface!(context, 'recipes_banner'),
      ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(
            onBack: () => _leave(),
            eyebrow: catName(r['category'], r['categoryLabel'] as String?),
            title: '${r['title'] ?? ''}',
            actions: [
              ToolIconButton(
                semanticLabel: 'Favorite',
                onTap: () => _toggleFavorite(id),
                icon: fav ? LucideFilled(AIcons.heart, size: 16, color: a.pink2) : const AIcon(AIcons.heart, size: 16),
              ),
            ],
          ),
          vgap(12, [
            FadeRise(
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(26), boxShadow: a.cardShadow),
                child: _image(context, r, (r['image_url'] is String && (r['image_url'] as String).isNotEmpty) ? 192 : 160, 72),
              ),
            ),
            FadeRise(
              dy: 10,
              delay: const Duration(milliseconds: 100),
              child: Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [
                if (prep > 0) chip(a.blue1, a.blueInk, AIcons.timer, '${prep.toInt()} ${tr('recipes_deq_780a5c', 'dəq')}'),
                if (cook > 0) chip(a.peach1, a.accentInk, AIcons.flame, '${cook.toInt()} ${tr('recipes_deq_780a5c', 'dəq')}'),
                if (servings != null && servings != 0) chip(a.green1, a.greenInk, AIcons.users, '$servings por.'),
              ]),
            ),
            if (description is String && description.isNotEmpty)
              FadeRise(
                dy: 10,
                delay: const Duration(milliseconds: 150),
                child: ACard(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    AListIconBox(size: 34, radius: 11, gradient: a.gradYellow, child: AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2, color: a.warnInk)),
                    const SizedBox(width: 12),
                    Expanded(child: Text(description, style: AStyles.ctaText(context))),
                  ]),
                ),
              ),
            if (slots.adInlineAnchor != null) slots.adInlineAnchor!(context, 'recipes_banner'),
            if (ingredients.isNotEmpty)
              FadeRise(
                dy: 10,
                delay: const Duration(milliseconds: 200),
                child: ACard(
                  variant: ACardVariant.list,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    sectionHead(a.gradGreen, a.greenInk, '🥗', tr('recipes_i_nqrediyentler_4c0854', 'İnqrediyentlər'), '${ingredients.length}'),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: vgap(8, [
                        for (var i = 0; i < ingredients.length; i++)
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(border: i < ingredients.length - 1 ? Border(bottom: BorderSide(color: a.line)) : null),
                            child: Row(children: [
                              Container(
                                width: 24,
                                height: 24,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
                                child: Text('${i + 1}', style: px(12, weight: FontWeight.w700, color: a.greenInk, height: 16 / 12)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(child: Text(ingredients[i], style: px(14, color: a.ink, height: 20 / 14))),
                            ]),
                          ),
                      ]),
                    ),
                  ]),
                ),
              ),
            if (instructions.isNotEmpty)
              FadeRise(
                dy: 10,
                delay: const Duration(milliseconds: 300),
                child: ACard(
                  variant: ACardVariant.list,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    sectionHead(a.gradPeach, a.accentInk, '👩‍🍳', tr('recipes_hazirlanma_13bf8d', 'Hazırlanma'), '${instructions.length} ${tr('recipes_addim_74e240', 'addım')}'),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: vgap(16, [
                        for (var i = 0; i < instructions.length; i++)
                          IntrinsicHeight(
                            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              Column(children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    gradient: a.gradPeach,
                                    shape: BoxShape.circle,
                                    boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -1)],
                                  ),
                                  child: Text('${i + 1}', style: px(12, weight: FontWeight.w700, color: a.accentInk, height: 16 / 12)),
                                ),
                                if (i < instructions.length - 1)
                                  Expanded(
                                    child: Opacity(
                                      opacity: 0.4,
                                      child: Container(
                                        width: 2,
                                        margin: const EdgeInsets.only(top: 8),
                                        constraints: const BoxConstraints(minHeight: 20),
                                        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [a.peach2, a.peach2.withValues(alpha: 0)])),
                                      ),
                                    ),
                                  ),
                              ]),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                                    child: Text(instructions[i], style: px(14, color: a.ink, height: 1.625)),
                                  ),
                                ),
                              ),
                            ]),
                          ),
                      ]),
                    ),
                  ]),
                ),
              ),
            FadeRise(
              dy: 10,
              delay: const Duration(milliseconds: 400),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
                child: Text(
                  tr('recipes_allergiya_xeberdarligi_bal_ciy_7e75e8', '⚠️ Allergiya Xəbərdarlığı: Bal, çiyələk və ya fıstıq kimi qidalara allergiyanız varsa, həkiminizlə məsləhətləşin.'),
                  textAlign: TextAlign.center,
                  style: px(12, color: a.alertInk, height: 16 / 12),
                ),
              ),
            ),
          ]),
        ]),
      ),
    ]);
  }
}
