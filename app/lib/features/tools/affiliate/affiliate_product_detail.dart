// Ported from: src/components/tools/affiliate/AffiliateProductDetail.tsx
//
// Product page: looping image carousel with thumbnails, discount / featured badges, video, store chip, title, rating,
// price block with "Məhsula get", tags, description, pros / cons, specifications, review summary, disclaimer, and the
// fixed bottom bar (save + go to store). Share uses the native share sheet, the store link opens in the browser.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';
import 'package:video_player/video_player.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show AEyebrow, AWordmark, px, toasts;
import '../health_common/health_common.dart' show healthLinkLauncherProvider;
import '../health_common/health_ui.dart' show AStyles, LucideFilled;
import '../kit/kit.dart';
import '../media_common/media_ports.dart' show mediaShareProvider;
import 'affiliate_data.dart';
import 'affiliate_product_card.dart';

/// `public/placeholder.svg` (the `src || '/placeholder.svg'` fallback), bundled.
const String affiliatePlaceholderAsset = 'assets/affiliate/placeholder.svg';

/// `platformColors` (soft chips): (background, ink).
(Color, Color) _platformSoft(ATokens a, Object? platform) => switch (platform) {
      'trendyol' => (a.peach1, a.accentInk),
      'amazon' => (a.yellow1, a.warnInk),
      'aliexpress' => (a.pink1, a.pinkInk),
      _ => (a.surfaceSoft, a.inkSoft),
    };

String _platformLabel(Object? platform) => switch (platform) {
      'trendyol' => 'Trendyol',
      'amazon' => 'Amazon',
      'aliexpress' => 'AliExpress',
      _ => tr('affiliateproductdetail_magaza_defaa2', 'Mağaza'),
    };

/// The video player of the full-screen video modal (tests replace it).
typedef AffiliateVideoBuilder = Widget Function(BuildContext context, String url);

final affiliateVideoBuilderProvider = Provider<AffiliateVideoBuilder>((ref) => (context, url) => _NetworkVideo(url: url), name: 'affiliateVideoBuilderProvider');

class AffiliateProductDetail extends ConsumerStatefulWidget {
  const AffiliateProductDetail({super.key, required this.product, required this.onBack});
  final AffiliateProduct product;
  final VoidCallback onBack;
  @override
  ConsumerState<AffiliateProductDetail> createState() => _AffiliateProductDetailState();
}

class _AffiliateProductDetailState extends ConsumerState<AffiliateProductDetail> {
  static const int _loopBase = 10000;
  late final PageController _pages = PageController(initialPage: _loopBase * _images.length.clamp(1, 1 << 20));
  int _current = 0;

  List<String> get _images => [
        if ('${widget.product['image_url'] ?? ''}'.isNotEmpty) '${widget.product['image_url']}',
        if (widget.product['images'] is List)
          for (final i in widget.product['images'] as List)
            if (i is String && i.isNotEmpty) i,
      ];

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _share() async {
    final p = widget.product;
    final price = p['price'];
    final ok = await ref.read(mediaShareProvider)(
      title: affiliateName(p),
      text: '${affiliateName(p)} - ${price is num && price != 0 ? '${affiliateNum(price)} ${p['currency'] ?? ''}' : tr('affiliateproductdetail_qiymeti_yoxla_a4b76d', 'Qiyməti yoxla')}',
      url: '${p['affiliate_url'] ?? ''}',
    );
    if (ok && mounted) toasts(context).show(title: tr('affiliateproductdetail_paylasildi_c7d9ef', 'Paylaşıldı!'));
  }

  void _goToStore() {
    final uri = Uri.tryParse('${widget.product['affiliate_url'] ?? ''}');
    if (uri != null) unawaited(ref.read(healthLinkLauncherProvider)(uri));
  }

  void _scrollTo(int index) {
    final n = _images.length;
    if (n == 0 || !_pages.hasClients) return;
    final page = _pages.page?.round() ?? 0;
    final target = page - (page % n) + index;
    unawaited(_pages.animateToPage(target, duration: const Duration(milliseconds: 300), curve: Curves.easeOut));
  }

  Future<void> _showVideo(String url) => showGeneralDialog<void>(
        context: context,
        barrierDismissible: true,
        barrierLabel: tr('common_close', 'Bağla'),
        barrierColor: const Color(0xFF000000),
        pageBuilder: (ctx, _, _) => _VideoModal(url: url, builder: ref.read(affiliateVideoBuilderProvider)),
        transitionBuilder: (ctx, anim, _, child) => FadeTransition(opacity: anim, child: child),
      );

  Widget _img(String? url, {BoxFit fit = BoxFit.contain}) {
    final placeholder = SvgPicture.asset(affiliatePlaceholderAsset, fit: fit);
    if (url == null || url.isEmpty) return placeholder;
    return Image.network(url, fit: fit, errorBuilder: (_, _, _) => placeholder);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final p = widget.product;
    final id = '${p['id'] ?? ''}';
    final isSaved = ref.watch(isAffiliateProductSavedQuery(id)).data ?? false;
    final images = _images;
    final discount = affiliateDiscount(p);
    final (pBg, pInk) = _platformSoft(a, p['platform']);
    final store = '${p['store_name'] ?? ''}'.isNotEmpty ? '${p['store_name']}' : (_platformLabel(p['platform']).isNotEmpty ? _platformLabel(p['platform']) : '${p['platform'] ?? ''}');
    final rating = p['rating'] is num ? p['rating'] as num : 0;
    final reviews = p['review_count'] is num ? p['review_count'] as num : 0;
    final price = p['price'] is num ? p['price'] as num : null;
    final original = p['original_price'] is num ? p['original_price'] as num : null;
    final currency = '${p['currency'] ?? ''}';
    final priceAge = affiliatePriceAge(p);
    final tags = p['tags'] is List ? [for (final t in p['tags'] as List) '$t'] : const <String>[];
    final description = '${p['description_az'] ?? ''}'.isNotEmpty ? '${p['description_az']}' : '${p['description'] ?? ''}';
    final pros = p['pros'] is List ? [for (final t in p['pros'] as List) '$t'] : const <String>[];
    final cons = p['cons'] is List ? [for (final t in p['cons'] as List) '$t'] : const <String>[];
    final specs = p['specifications'] is Map ? (p['specifications'] as Map).map((k, v) => MapEntry('$k', '$v')) : const <String, String>{};
    final summary = '${p['review_summary_az'] ?? ''}'.isNotEmpty ? '${p['review_summary_az']}' : '${p['review_summary'] ?? ''}';
    final video = '${p['video_url'] ?? ''}';
    void toggle() => toggleAffiliateSaved(ref, context, id, saved: isSaved);
    Widget cardTitle(String text, {Widget? icon}) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [if (icon != null) ...[icon, const SizedBox(width: 8)], Flexible(child: Text(text, style: AStyles.cardTitle(context)))]),
        );
    Widget roundIcon(AIconData icon, Color color, Color bg, {double box = 24, double size = 14, bool filled = false}) => Container(
          width: box,
          height: box,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: filled ? LucideFilled(icon, size: size, color: color) : AIcon(icon, size: size, color: color),
        );
    Widget bullets(List<String> items, AIconData icon, Color ink) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i > 0 ? 6 : 0),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(icon, size: 12, color: ink)),
                const SizedBox(width: 6),
                Expanded(child: Text(items[i], style: px(12, color: ink, height: 16 / 12))),
              ]),
            ),
        ]);

    final gallery = Stack(children: [
      AspectRatio(
        aspectRatio: 1,
        child: images.length > 1
            ? PageView.builder(
                key: const ValueKey('affiliate-carousel'),
                controller: _pages,
                onPageChanged: (i) => setState(() => _current = i % images.length),
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.all(24),
                  child: ClipRRect(borderRadius: BorderRadius.circular(16), child: _img(images[i % images.length])),
                ),
              )
            : Padding(
                padding: const EdgeInsets.all(24),
                child: ClipRRect(borderRadius: BorderRadius.circular(16), child: _img(images.firstOrNull)),
              ),
      ),
      if (discount != null)
        PositionedDirectional(
          top: 16,
          start: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(999), boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)]),
            child: Text('-$discount%', style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 20 / 14)),
          ),
        ),
      if (p['is_featured'] == true)
        PositionedDirectional(
          top: 16,
          end: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(color: a.yellow2, borderRadius: BorderRadius.circular(999), boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)]),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              // `color: '#5a3d00'` (AffiliateProductDetail.tsx literal)
              const AIcon(AIcons.sparkles, size: 12, color: Color(0xFF5A3D00)),
              const SizedBox(width: 4),
              Text(tr('affiliateproductdetail_tovsiyye_45368e', 'Tövsiyyə'), style: px(12, weight: FontWeight.w700, color: const Color(0xFF5A3D00), height: 16 / 12)),
            ]),
          ),
        ),
      if (video.isNotEmpty)
        PositionedDirectional(
          bottom: 80,
          end: 16,
          child: Semantics(
            button: true,
            child: GestureDetector(
              key: const ValueKey('affiliate-video'),
              behavior: HitTestBehavior.opaque,
              onTap: () => _showVideo(video),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: a.line),
                  boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5)],
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  LucideFilled(AIcons.play, size: 16, color: a.peach2),
                  const SizedBox(width: 8),
                  Text(trInline('AffiliateProductDetail.tsx', 'Video'), style: px(14, weight: FontWeight.w600, color: a.ink, height: 20 / 14)),
                ]),
              ),
            ),
          ),
        ),
    ]);

    return Stack(children: [
      ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          // `.a-topbar` written inline in the component (no ToolHeader): back, store eyebrow, "Məhsul haqqında",
          // share and save buttons.
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(children: [
                ToolIconButton(semanticLabel: tr('common_back', 'Geri'), onTap: widget.onBack, size: 44, icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    AEyebrow(store),
                    AWordmark(tr('affiliateproductdetail_mehsul_haqqinda_6389a1', 'Məhsul haqqında'), fontSize: 16),
                  ]),
                ),
                const SizedBox(width: 12),
                ToolIconButton(key: const ValueKey('affiliate-share'), semanticLabel: tr('a11y_share', 'Paylaş'), onTap: _share, icon: const AIcon(AIcons.share2, size: 16)),
                const SizedBox(width: 8),
                Semantics(
                  selected: isSaved,
                  child: ToolIconButton(
                    key: const ValueKey('affiliate-save-top'),
                    semanticLabel: tr('a11y_save', 'Yadda saxla'),
                    onTap: toggle,
                    icon: isSaved ? LucideFilled(AIcons.heart, size: 16, color: a.pink2) : const AIcon(AIcons.heart, size: 16),
                  ),
                ),
              ]),
            ),
          ),
          ACard(
            variant: ACardVariant.list,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              gallery,
              if (images.length > 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      for (var i = 0; i < images.length; i++) ...[
                        if (i > 0) const SizedBox(width: 8),
                        Semantics(
                          button: true,
                          selected: i == _current,
                          label: formatTr('a11y_image_n', 'Şəkil {n}', {'n': i + 1}),
                          child: GestureDetector(
                            key: ValueKey('affiliate-thumb-$i'),
                            behavior: HitTestBehavior.opaque,
                            onTap: () => _scrollTo(i),
                            child: Transform.scale(
                              scale: i == _current ? 1.05 : 1,
                              child: Opacity(
                                opacity: i == _current ? 1 : 0.7,
                                child: Container(
                                  width: 56,
                                  height: 56,
                                  clipBehavior: Clip.antiAlias,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: i == _current ? a.peach2 : a.line, width: 2),
                                    boxShadow: i == _current ? a.cardShadow : null,
                                  ),
                                  child: _img(images[i], fit: BoxFit.cover),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ]),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 12),
          ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(color: pBg, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AIcon(AIcons.store, size: 14, color: pInk),
                      const SizedBox(width: 6),
                      Text(store, style: px(12, weight: FontWeight.w700, color: pInk, height: 16 / 12)),
                    ]),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(affiliateName(p), style: x.heading(px(20, weight: FontWeight.w700, color: a.ink, height: 1.25))),
              ),
              if (rating > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(children: [
                    for (var s = 1; s <= 5; s++)
                      Padding(
                        padding: const EdgeInsets.only(right: 2),
                        child: s <= rating.round() ? LucideFilled(AIcons.star, size: 16, color: a.yellow2) : AIcon(AIcons.star, size: 16, color: a.lineStrong),
                      ),
                    const SizedBox(width: 6),
                    Text(rating.toStringAsFixed(1), style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                    if (reviews > 0) ...[
                      const SizedBox(width: 8),
                      Text('(${affiliateNum(reviews)} ${tr('affiliateproductdetail_rey_f2285f', 'rəy)')}', style: px(12, color: a.inkSoft, height: 16 / 12)),
                    ],
                  ]),
                ),
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                  if (price != null && price != 0)
                    Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 8, children: [
                      Text(affiliateNum(price), style: x.heading(px(30, color: a.accentInk, height: 1.2))),
                      Text(currency, style: px(18, weight: FontWeight.w700, color: a.accentInk, height: 28 / 18)),
                      if (original != null && original != 0 && original > price)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(start: 8),
                          child: Opacity(
                            opacity: 0.55,
                            child: Text('${affiliateNum(original)} $currency',
                                style: px(16, color: a.accentInk, height: 24 / 16).copyWith(decoration: TextDecoration.lineThrough)),
                          ),
                        ),
                    ])
                  else
                    Opacity(opacity: 0.8, child: Text(tr('affiliateproductdetail_qiymet_ucun_magazaya_kecin_8b6888', 'Qiymət üçün mağazaya keçin'), style: px(16, color: a.accentInk, height: 24 / 16))),
                  if (priceAge != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Opacity(
                        opacity: 0.7,
                        child: Row(children: [
                          AIcon(AIcons.clock, size: 12, color: a.accentInk),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text('${tr('affiliateproductdetail_qiymet_54c4f3', 'Qiymət')} $priceAge ${tr('affiliateproductdetail_yenilenib_d414bf', 'yenilənib')}',
                                style: px(12, color: a.accentInk, height: 16 / 12)),
                          ),
                        ]),
                      ),
                    ),
                  const SizedBox(height: 12),
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      key: const ValueKey('affiliate-go-inline'),
                      behavior: HitTestBehavior.opaque,
                      onTap: _goToStore,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(12)),
                        child: Row(children: [
                          AIcon(AIcons.externalLink, size: 16, color: a.accentInk),
                          const SizedBox(width: 8),
                          Expanded(child: Text(tr('affiliateproductdetail_mehsula_get_eff59e', 'Məhsula get'), style: px(14, weight: FontWeight.w700, color: a.accentInk, height: 20 / 14))),
                          AIcon(AIcons.chevronRight, size: 16, color: a.accentInk, mirrorInRtl: true),
                        ]),
                      ),
                    ),
                  ),
                ]),
              ),
              if (tags.isNotEmpty)
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final t in tags)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.tag, size: 10, color: a.inkSoft),
                        const SizedBox(width: 4),
                        Text(t, style: px(10.5, weight: FontWeight.w800, color: a.inkSoft)),
                      ]),
                    ),
                ]),
            ]),
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 12),
            ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                cardTitle(tr('affiliateproductdetail_mehsul_haqqinda_6389a1', 'Məhsul haqqında'), icon: roundIcon(AIcons.info, a.accentInk, a.peach1)),
                Text(description, style: AStyles.ctaText(context)),
              ]),
            ),
          ],
          if (pros.isNotEmpty || cons.isNotEmpty) ...[
            const SizedBox(height: 12),
            IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Expanded(
                  child: pros.isEmpty
                      ? const SizedBox()
                      : Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(16)),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(children: [
                                roundIcon(AIcons.check, a.greenInk, a.chipOverlay, box: 20, size: 12),
                                const SizedBox(width: 6),
                                Flexible(child: Text(tr('affiliateproductdetail_ustunlukleri_06e1a1', 'Üstünlükləri'), style: px(12, weight: FontWeight.w700, color: a.greenInk, height: 16 / 12))),
                              ]),
                            ),
                            bullets(pros, AIcons.check, a.greenInk),
                          ]),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: cons.isEmpty
                      ? const SizedBox()
                      : Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(children: [
                                roundIcon(AIcons.x, a.pinkInk, a.chipOverlay, box: 20, size: 12),
                                const SizedBox(width: 6),
                                Flexible(child: Text(tr('affiliateproductdetail_catismazliqlari_1c0dce', 'Çatışmazlıqları'), style: px(12, weight: FontWeight.w700, color: a.pinkInk, height: 16 / 12))),
                              ]),
                            ),
                            bullets(cons, AIcons.x, a.pinkInk),
                          ]),
                        ),
                ),
              ]),
            ),
          ],
          if (specs.isNotEmpty) ...[
            const SizedBox(height: 12),
            ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Padding(padding: const EdgeInsets.only(bottom: 4), child: cardTitle(tr('affiliateproductdetail_xususiyyetleri_11ea09', 'Xüsusiyyətləri'))),
                for (final (i, e) in specs.entries.indexed)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(border: i != specs.length - 1 ? Border(bottom: BorderSide(color: a.line)) : null),
                    child: LayoutBuilder(
                      builder: (context, c) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(child: Text(e.key, style: px(14, color: a.inkSoft, height: 20 / 14))),
                        // `text-end max-w-[60%]`
                        ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: c.maxWidth * 0.6),
                          child: Text(e.value, textAlign: TextAlign.end, style: px(14, weight: FontWeight.w600, color: a.ink, height: 20 / 14)),
                        ),
                      ]),
                    ),
                  ),
              ]),
            ),
          ],
          if (summary.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    roundIcon(AIcons.star, a.warnInk, a.chipOverlay, filled: true),
                    const SizedBox(width: 8),
                    Text(tr('affiliateproductdetail_rey_xulasesi_4d1c8e', 'Rəy xülasəsi'), style: px(14, weight: FontWeight.w700, color: a.warnInk, height: 20 / 14)),
                  ]),
                ),
                Opacity(opacity: 0.9, child: Text('"$summary"', style: px(14, color: a.warnInk, height: 1.625).copyWith(fontStyle: FontStyle.italic))),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.disclaimerBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.disclaimerBorder)),
            child: Text(
              tr('affiliateproductdetail_bu_sehifedeki_link_affiliate_l_966c93', 'Bu səhifədəki link affiliate linkdir. Alış-veriş etdikdə biz kiçik komissiya qazana bilərik.\n            Qiymət dəyişə bilər.'),
              textAlign: TextAlign.center,
              style: px(10, color: a.disclaimerInk, height: 1.625),
            ),
          ),
          // `pb-44` (176) instead of the ToolPage `pb-24` (96): room above the fixed bar.
          const SizedBox(height: 80),
        ]),
      ),
      _FixedBar(
        child: Row(children: [
          Expanded(
            child: _SoftButton(
              key: const ValueKey('affiliate-save-bar'),
              onTap: toggle,
              icon: isSaved ? LucideFilled(AIcons.heart, size: 16, color: a.pink2, strokeWidth: 2.2) : AIcon(AIcons.heart, size: 16, strokeWidth: 2.2, color: a.accentInk),
              label: isSaved ? tr('affiliateproductdetail_saxlanildi_66ffe7', 'Saxlanıldı') : tr('affiliateproductdetail_saxla_3c7a2d', 'Saxla'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Semantics(
              button: true,
              child: GestureDetector(
                key: const ValueKey('affiliate-go'),
                behavior: HitTestBehavior.opaque,
                onTap: _goToStore,
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const AIcon(AIcons.externalLink, size: 16, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 6),
                    Flexible(child: Text(tr('affiliateproductdetail_mehsula_kec_4a61a9', 'Məhsula keç'), maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12.5, weight: FontWeight.w700, color: const Color(0xFFFFFFFF)))),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    ]);
  }
}

class _SoftButton extends StatelessWidget {
  const _SoftButton({super.key, required this.onTap, required this.icon, required this.label});
  final VoidCallback onTap;
  final Widget icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          height: 48,
          decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            icon,
            const SizedBox(width: 6),
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12, weight: FontWeight.w700, color: a.accentInk))),
          ]),
        ),
      ),
    );
  }
}

/// `fixed start-0 end-0 z-30` at `bottom: calc(env(safe-area-inset-bottom) + 72px)` (nav bg, blur 12, top border,
/// p-4): drawn over the screen through the nearest [Overlay]; in place when there is none.
class _FixedBar extends StatefulWidget {
  const _FixedBar({required this.child});
  final Widget child;
  @override
  State<_FixedBar> createState() => _FixedBarState();
}

class _FixedBarState extends State<_FixedBar> {
  final OverlayPortalController _portal = OverlayPortalController()..show();

  Widget _bar(BuildContext context) {
    final a = context.a;
    return Container(
      decoration: BoxDecoration(color: a.navBg, border: Border(top: BorderSide(color: a.line))),
      padding: const EdgeInsets.all(16),
      child: widget.child,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (Overlay.maybeOf(context) == null) return const SizedBox.shrink();
    final mq = MediaQuery.of(context);
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (ctx) => Positioned(left: 0, right: 0, bottom: mq.padding.bottom + 72, child: AScope(child: Builder(builder: _bar))),
      child: const SizedBox.shrink(),
    );
  }
}

/// The full-screen black video layer (close button at safe-top + 16, tap outside closes).
class _VideoModal extends StatelessWidget {
  const _VideoModal({required this.url, required this.builder});
  final String url;
  final AffiliateVideoBuilder builder;
  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(),
      child: ColoredBox(
        color: const Color(0xFF000000),
        child: Stack(children: [
          Center(child: GestureDetector(onTap: () {}, child: builder(context, url))),
          PositionedDirectional(
            top: top + 16,
            end: 16,
            child: Semantics(
              button: true,
              label: tr('common_close', 'Bağla'),
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  // `rgba(255,255,255,0.15)` (AffiliateProductDetail.tsx literal)
                  decoration: const BoxDecoration(color: Color(0x26FFFFFF), shape: BoxShape.circle),
                  child: const AIcon(AIcons.x, size: 24, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `<video src controls autoPlay>`: plays at once; a tap toggles play / pause.
class _NetworkVideo extends StatefulWidget {
  const _NetworkVideo({required this.url});
  final String url;
  @override
  State<_NetworkVideo> createState() => _NetworkVideoState();
}

class _NetworkVideoState extends State<_NetworkVideo> {
  late final VideoPlayerController _c = VideoPlayerController.networkUrl(Uri.parse(widget.url));

  @override
  void initState() {
    super.initState();
    unawaited(_c.initialize().then((_) {
      if (!mounted) return;
      setState(() {});
      unawaited(_c.play());
    }).catchError((Object _) {}));
  }

  @override
  void dispose() {
    unawaited(_c.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_c.value.isInitialized) return const SizedBox.shrink();
    return GestureDetector(
      onTap: () => setState(() => _c.value.isPlaying ? _c.pause() : _c.play()),
      child: AspectRatio(
        aspectRatio: _c.value.aspectRatio,
        child: Stack(alignment: Alignment.bottomCenter, children: [VideoPlayer(_c), VideoProgressIndicator(_c, allowScrubbing: true)]),
      ),
    );
  }
}
