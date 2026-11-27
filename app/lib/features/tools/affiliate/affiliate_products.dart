// Ported from: src/components/tools/AffiliateProducts.tsx, src/components/tools/affiliate/SavedProductsList.tsx
//
// Tövsiyyə olunan məhsullar: products for the user's stage (server overlap on life_stages), search, category tabs,
// the featured strip, the grid, the saved list and the product page. Hidden behind "Tezliklə" when the
// `affiliate_section_enabled` app setting is false.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_ui.dart' show AGridCols, APulse, ASearchField, AStyles, LucideFilled;
import '../kit/kit.dart';
import 'affiliate_data.dart';
import 'affiliate_product_card.dart';
import 'affiliate_product_detail.dart';

String _categoryLabel(String cat) => switch (cat) {
      'baby_gear' => tr('affiliateproducts_korpe_esyalari_6e92e1', 'Körpə əşyaları'),
      'maternity' => tr('affiliateproducts_hamilelik_geyimleri_fb1c46', 'Hamiləlik geyimləri'),
      'health' => tr('affiliateproducts_saglamliq_09460a', 'Sağlamlıq'),
      'nutrition' => tr('affiliateproducts_qidalanma_7e8b65', 'Qidalanma'),
      'skincare' => tr('affiliateproducts_deri_qullugu_6c59a3', 'Dəri qulluğu'),
      'general' => tr('affiliateproducts_umumi_1b5521', 'Ümumi'),
      _ => cat,
    };

/// `grid grid-cols-2 gap-3` of four pulsing card skeletons.
Widget _skeletons(BuildContext context) {
  final a = context.a;
  return AGridCols(columns: 2, gap: 12, children: [
    for (var i = 0; i < 4; i++)
      APulse(
        child: ACard(
          variant: ACardVariant.list,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            AspectRatio(aspectRatio: 1, child: ColoredBox(color: a.surfaceSoft)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                FractionallySizedBox(widthFactor: 0.75, child: Container(height: 16, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)))),
                const SizedBox(height: 8),
                FractionallySizedBox(widthFactor: 0.5, child: Container(height: 12, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)))),
              ]),
            ),
          ]),
        ),
      ),
  ]);
}

class AffiliateProducts extends ConsumerStatefulWidget {
  const AffiliateProducts({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<AffiliateProducts> createState() => _AffiliateProductsState();
}

class _AffiliateProductsState extends ConsumerState<AffiliateProducts> {
  String _activeCategory = 'all';
  final TextEditingController _search = TextEditingController();
  AffiliateProduct? _selected;
  bool _showSaved = false;

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

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final isEnabled = ref.watch(appSettingProvider('affiliate_section_enabled')) != false;
    final productsQ = ref.watch(affiliateProductsQuery(lifeStage == null || lifeStage.isEmpty ? null : lifeStage));
    final products = productsQ.data ?? const <AffiliateProduct>[];
    final saved = ref.watch(savedAffiliateProductsQuery).data ?? const <AffiliateProduct>[];

    final selected = _selected;
    if (selected != null) {
      return AffiliateProductDetail(key: ValueKey('affiliate-detail-${selected['id']}'), product: selected, onBack: () => setState(() => _selected = null));
    }
    if (_showSaved) {
      return SavedProductsList(onSelectProduct: (p) => setState(() => _selected = p), onBack: () => setState(() => _showSaved = false));
    }
    if (!isEnabled) {
      return ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          ToolHeader(onBack: widget.onBack, title: tr('affiliateproducts_tovsiyye_olunan_mehsullar_db580f', 'Tövsiyyə olunan məhsullar')),
          ConstrainedBox(
            constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height * 0.6),
            child: Center(
              child: ToolEmpty(
                icon: AIcon(AIcons.package, size: 28, color: a.inkSoft),
                title: tr('affiliateproducts_tezlikle_125239', 'Tezliklə'),
                text: tr('affiliateproducts_sizin_ucun_secilmis_mehsullar__85a358', 'Sizin üçün seçilmiş məhsullar tezliklə burada olacaq'),
              ),
            ),
          ),
        ]),
      );
    }

    final categories = ['all', ...{for (final p in products) '${p['category'] ?? ''}'}];
    final q = _search.text.toLowerCase();
    final filtered = products.where((p) {
      final matchesCategory = _activeCategory == 'all' || p['category'] == _activeCategory;
      final desc = '${p['description_az'] ?? ''}'.isNotEmpty ? '${p['description_az']}' : '${p['description'] ?? ''}';
      final matchesSearch = q.isEmpty || affiliateName(p).toLowerCase().contains(q) || desc.toLowerCase().contains(q);
      return matchesCategory && matchesSearch;
    }).toList();
    final featured = filtered.where((p) => p['is_featured'] == true).toList();

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('affiliateproducts_sizin_ucun_secdiklerimiz_e5dde6', 'Sizin üçün seçdiklərimiz'),
          title: tr('affiliateproducts_tovsiyye_olunan_mehsullar_db580f', 'Tövsiyyə olunan məhsullar'),
          actions: [
            Stack(clipBehavior: Clip.none, children: [
              Semantics(
                button: true,
                child: GestureDetector(
                  key: const ValueKey('affiliate-saved-open'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _showSaved = true),
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AIcon(AIcons.heart, size: 13, strokeWidth: 2.2, color: a.accentInk),
                      const SizedBox(width: 6),
                      Text(tr('affiliateproducts_saxlanilmis_a1090d', 'Saxlanılmış'), style: px(11.5, weight: FontWeight.w700, color: a.accentInk)),
                    ]),
                  ),
                ),
              ),
              if (saved.isNotEmpty)
                PositionedDirectional(
                  top: -8,
                  end: -8,
                  child: Container(
                    key: const ValueKey('affiliate-saved-count'),
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.pink2, shape: BoxShape.circle),
                    child: Text('${saved.length}', style: px(10, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 1)),
                  ),
                ),
            ]),
          ],
        ),
        ASearchField(controller: _search, placeholder: tr('affiliateproducts_mehsul_axtar_580a05', 'Məhsul axtar...'), fieldKey: const ValueKey('affiliate-search')),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: [
              for (var i = 0; i < categories.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Semantics(
                  button: true,
                  selected: _activeCategory == categories[i],
                  child: GestureDetector(
                    key: ValueKey('affiliate-cat-${categories[i]}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _activeCategory = categories[i]),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _activeCategory == categories[i] ? a.peach1 : a.surface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: _activeCategory == categories[i] ? const Color(0x00000000) : a.line),
                      ),
                      child: Text(
                        categories[i] == 'all' ? tr('affiliateproducts_hamisi_c73c4d', 'Hamısı') : _categoryLabel(categories[i]),
                        style: px(12, weight: FontWeight.w700, color: _activeCategory == categories[i] ? a.accentInk : a.inkSoft, height: 16 / 12),
                      ),
                    ),
                  ),
                ),
              ],
            ]),
          ),
        ),
        if (featured.isNotEmpty && _activeCategory == 'all' && q.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: [
                  Expanded(child: Text(tr('affiliateproducts_en_cox_tovsiyye_olunanlar_4493f0', 'Ən çox tövsiyyə olunanlar'), style: AStyles.sectionTitle(context))),
                  LucideFilled(AIcons.star, size: 15, color: a.yellow2),
                ]),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (var i = 0; i < featured.length; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    AffiliateProductCard(product: featured[i], onSelect: (p) => setState(() => _selected = p), index: i, featured: true),
                  ],
                ]),
              ),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                Expanded(
                  child: Text(
                    q.isNotEmpty ? tr('affiliateproducts_search_results', 'Axtarış nəticələri') : tr('affiliateproducts_butun_mehsullar_c7373f', 'Bütün məhsullar'),
                    style: AStyles.sectionTitle(context),
                  ),
                ),
                Text('(${filtered.length})', key: const ValueKey('affiliate-count'), style: px(12, weight: FontWeight.w700, color: a.onBgSoft)),
              ]),
            ),
            if (productsQ.isLoading)
              _skeletons(context)
            else if (filtered.isEmpty)
              ACard(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.shoppingBag, size: 48, color: a.inkFaint)),
                  Text(tr('affiliateproducts_hec_bir_mehsul_tapilmadi_7ded0c', 'Heç bir məhsul tapılmadı'), textAlign: TextAlign.center, style: context.aText.aListSub),
                ]),
              )
            else
              AGridCols(columns: 2, gap: 12, children: [
                for (var i = 0; i < filtered.length; i++) AffiliateProductCard(product: filtered[i], onSelect: (p) => setState(() => _selected = p), index: i),
              ]),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 16),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.disclaimerBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.disclaimerBorder)),
            child: Text(
              tr('affiliateproducts_bu_sehifedeki_linkler_affiliat_76280f', 'Bu səhifədəki linklər affiliate linklərdir. Alış-veriş etdikdə biz kiçik komissiya qazana bilərik.'),
              textAlign: TextAlign.center,
              style: px(10, color: a.disclaimerInk, height: 15 / 10),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `<SavedProductsList onSelectProduct onBack />`.
class SavedProductsList extends ConsumerWidget {
  const SavedProductsList({super.key, required this.onSelectProduct, required this.onBack});
  final ValueChanged<AffiliateProduct> onSelectProduct;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final q = ref.watch(savedAffiliateProductsQuery);
    final saved = q.data ?? const <AffiliateProduct>[];
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          onBack: onBack,
          eyebrow: '${saved.length} ${tr('savedproductslist_mehsul_2d6a33', 'məhsul')}',
          title: tr('savedproductslist_saxlanilmis_mehsullar_28bd17', 'Saxlanılmış məhsullar'),
        ),
        if (q.isLoading)
          _skeletons(context)
        else if (saved.isEmpty)
          FadeRise(
            child: ACard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 40),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 80,
                  height: 80,
                  margin: const EdgeInsets.only(bottom: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.pink1, shape: BoxShape.circle),
                  child: AIcon(AIcons.heart, size: 40, color: a.pink2),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(tr('savedproductslist_hele_hec_ne_saxlanmayib_70769c', 'Hələ heç nə saxlanmayıb'), textAlign: TextAlign.center, style: AStyles.listTitle(context, size: 16)),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: Text(
                    tr('savedproductslist_beyendiyiniz_mehsullari_ile_sa_7ecb02', 'Bəyəndiyiniz məhsulları ❤️ ilə saxlayın, sonra buradan asanlıqla tapın'),
                    textAlign: TextAlign.center,
                    style: context.aText.aListSub,
                  ),
                ),
              ]),
            ),
          )
        else
          AGridCols(columns: 2, gap: 12, children: [
            for (var i = 0; i < saved.length; i++) AffiliateProductCard(product: saved[i], onSelect: onSelectProduct, index: i),
          ]),
      ]),
    );
  }
}
