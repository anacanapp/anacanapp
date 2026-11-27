// Ported from: src/components/tools/VitaminsTab.tsx
//
// The "Vitamins" tab of Nutrition: essential and recommended vitamins for the pregnancy week (or the stage).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' show getPregnancyWeek;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_ui.dart';
import 'meal_logs.dart';

class VitaminsTab extends ConsumerWidget {
  const VitaminsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final lifeStage = store.lifeStage;
    int? week;
    if (lifeStage == 'bump' && store.lastPeriodDate != null) {
      final w = getPregnancyWeek(store.lastPeriodDate);
      week = w.isNaN ? null : (w < 1 ? 1 : w.toInt());
    }
    final q = ref.watch(vitaminsQuery((week: week, lifeStage: lifeStage ?? 'bump')));
    if (q.isLoading) return const ACenterSpinner(size: 24, padding: 48);
    final vitamins = q.data ?? const <Map<String, dynamic>>[];
    final essential = vitamins.where((v) => v['importance'] == 'essential').toList();
    final recommended = vitamins.where((v) => v['importance'] == 'recommended').toList();

    Widget head(AIconData icon, Color color, String title) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            AIcon(icon, size: 16, color: color),
            const SizedBox(width: 8),
            Text(title, style: AStyles.heading(context, 14, color: a.onBg)),
          ]),
        );

    return FadeRise(
      dx: -20,
      dy: 0,
      child: vgap(16, [
        if (lifeStage == 'bump' && week != null)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              AIcon(AIcons.info, size: 16, color: a.peach2),
              const SizedBox(width: 8),
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '${tr('vitaminstab_hefte_3aa886', 'Həftə')} $week', style: const TextStyle(fontWeight: FontWeight.w700)),
                    TextSpan(text: ' ${tr('vitaminstab_ucun_tovsiye_olunan_vitaminler_1552cd', 'üçün tövsiyə olunan vitaminlər')}'),
                  ]),
                  style: px(12, color: a.ink, height: 16 / 12),
                ),
              ),
            ]),
          ),
        if (essential.isNotEmpty)
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            head(AIcons.circleAlert, a.peach2, tr('vitaminstab_vacib_vitaminler_167026', 'Vacib Vitaminlər')),
            vgap(8, [for (var i = 0; i < essential.length; i++) _VitaminCard(vitamin: essential[i], index: i, essential: true)]),
          ]),
        if (recommended.isNotEmpty)
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            head(AIcons.pill, a.onBgSoft, tr('vitaminstab_tovsiye_olunan_f7f407', 'Tövsiyə Olunan')),
            vgap(8, [for (var i = 0; i < recommended.length; i++) _VitaminCard(vitamin: recommended[i], index: i, essential: false)]),
          ]),
        if (vitamins.isEmpty)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: AIcon(AIcons.pill, size: 48, color: a.inkFaint)),
              Text(tr('vitaminstab_bu_merhele_ucun_vitamin_melumati_yoxdur_d17150', 'Bu mərhələ üçün vitamin məlumatı yoxdur'), textAlign: TextAlign.center, style: AStyles.listSub(context)),
            ]),
          ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(16)),
          child: Text(
            tr('vitaminstab_bu_melumatlar_umumi_xarakter_d_0af27f', '⚠️ Bu məlumatlar ümumi xarakter daşıyır. Vitamin qəbulundan əvvəl həkiminizlə məsləhətləşin.'),
            textAlign: TextAlign.center,
            style: px(10, color: a.disclaimerInk),
          ),
        ),
      ]),
    );
  }
}

class _VitaminCard extends StatelessWidget {
  const _VitaminCard({required this.vitamin, required this.index, required this.essential});
  final Map<String, dynamic> vitamin;
  final int index;
  final bool essential;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    // VitaminsTab.tsx literals: rgba(138, 69, 20, .75 / .15 / .85) on the essential (peach) card.
    const brown75 = Color(0xBF8A4514), brown15 = Color(0x268A4514), brown85 = Color(0xD98A4514);
    final description = vitamin['description'];
    final dosage = vitamin['dosage'];
    final benefits = vitamin['benefits'] is List ? [for (final b in vitamin['benefits'] as List) '$b'] : const <String>[];
    final sources = vitamin['food_sources'] is List ? [for (final s in vitamin['food_sources'] as List) '$s'] : const <String>[];
    final divider = Border(top: BorderSide(color: essential ? brown15 : a.line));
    return FadeRise(
      delay: Duration(milliseconds: (index * 50).clamp(0, 300)),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: essential ? a.peach1 : a.surface,
          borderRadius: BorderRadius.circular(a.radiusLg),
          border: essential ? null : Border.all(color: a.line),
          boxShadow: a.cardShadow,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AListIconBox(
              background: essential ? a.chipOverlay : a.surfaceSoft,
              child: Text(vitamin['icon_emoji'] is String && (vitamin['icon_emoji'] as String).isNotEmpty ? vitamin['icon_emoji'] as String : '💊', style: const TextStyle(fontSize: 18)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text('${vitamin['name'] ?? ''}', style: AStyles.listTitle(context, color: essential ? a.accentInk : null))),
                  if (essential) ...[
                    const SizedBox(width: 8),
                    APill(tr('vitamins_vacib', 'Vacib'), background: a.peach2, color: const Color(0xFFFFFFFF), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), fontSize: 9, weight: FontWeight.w700),
                  ],
                ]),
                if (description is String && description.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(description, maxLines: 2, overflow: TextOverflow.ellipsis, style: px(12, color: essential ? brown75 : a.inkSoft, height: 16 / 12)),
                  ),
                if (dosage is String && dosage.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(children: [
                      AIcon(AIcons.pill, size: 12, color: a.accentInk),
                      const SizedBox(width: 4),
                      Flexible(child: Text(dosage, style: px(10, weight: FontWeight.w700, color: a.accentInk))),
                    ]),
                  ),
              ]),
            ),
          ]),
          if (benefits.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(border: divider),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(tr('vitaminstab_faydalari_8b3d9f', 'Faydaları:'), style: px(10, weight: FontWeight.w700, color: essential ? brown75 : a.inkSoft)),
                ),
                Wrap(spacing: 4, runSpacing: 4, children: [
                  for (final b in benefits.take(3))
                    APill(b,
                        background: essential ? a.chipOverlay : a.surfaceSoft,
                        color: essential ? a.accentInk : a.inkSoft,
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        fontSize: 9,
                        weight: FontWeight.w600),
                ]),
              ]),
            ),
          if (sources.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(border: divider),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    AIcon(AIcons.leaf, size: 12, color: a.greenInk),
                    const SizedBox(width: 4),
                    Text(tr('vitaminstab_qida_menbeleri_b0a789', 'Qida mənbələri:'), style: px(10, weight: FontWeight.w700, color: a.greenInk)),
                  ]),
                ),
                Text(sources.join(', '), style: px(12, color: essential ? brown85 : a.bodyText, height: 16 / 12)),
              ]),
            ),
        ]),
      ),
    );
  }
}
