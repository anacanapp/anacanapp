// Ported from: src/components/flow/PartnerFlowStatusCard.tsx
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'flow_platform.dart';
import 'widgets/flow_ui.dart';

class _Phase {
  const _Phase(this.label, this.emoji, this.tip, this.from, this.to);
  final String label;
  final String emoji;
  final String tip;
  final Color from;
  final Color to;
}

Map<String, _Phase> _phases() => {
      'menstrual': _Phase(tr('partnerflowstatuscard_menstruasiya_1c9b68', 'Menstruasiya'), '🩸',
          tr('partnerflowstatuscard_yumsaq_ol_isti_cay_teklif_et_e_bb3d00', 'Yumşaq ol, isti çay təklif et, ev işlərində kömək et.'), TwColors.rose500, TwColors.red500),
      'follicular': _Phase(tr('partnerflowstatuscard_follikular_f123bc', 'Follikular'), '🌱',
          tr('partnerflowstatuscard_enerjisi_yuksekdir_birlikde_ak_59c2fd', 'Enerjisi yüksəkdir — birlikdə aktiv vaxt keçirin.'), TwColors.emerald500, TwColors.teal500),
      'ovulation': _Phase(tr('partnerflowstatuscard_ovulyasiya_f123bc', 'Ovulyasiya'), '🌸',
          tr('partnerflowstatuscard_fertil_dovrdur_yaxinliga_diqqe_610fc2', 'Fertil dövrdür. Yaxınlığa diqqət göstər.'), TwColors.pink500, TwColors.fuchsia500),
      'luteal': _Phase(tr('partnerflowstatuscard_lutein_f123bc', 'Lutein (PMS)'), '🌙',
          tr('partnerflowstatuscard_sebirli_ol_menfi_reaksiyalari__ed5047', 'Səbirli ol, mənfi reaksiyaları şəxsi qəbul etmə.'), TwColors.indigo500, TwColors.purple500),
    };

class PartnerFlowStatusCard extends ConsumerWidget {
  const PartnerFlowStatusCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(partnerFlowSnapshotProvider);
    if (data == null || data.lifeStage != 'flow') return const SizedBox.shrink();
    final info = data.phaseInfo;
    if (info == null) return const SizedBox.shrink();
    final phase = _phases()[info.phase]!;
    final days = data.daysUntilNextPeriod;
    final pms = info.phase == 'luteal' && days <= 3 && days > 0;
    const white = TwColors.white;
    Color w(double o) => white.withValues(alpha: o);
    TextStyle t(double size, {FontWeight? weight, double alpha = 1, double? height}) =>
        TextStyle(fontSize: size, fontWeight: weight, color: w(alpha), height: height);
    Widget box(Widget child, {EdgeInsets padding = const EdgeInsets.all(10)}) =>
        Container(padding: padding, decoration: BoxDecoration(color: w(0.2), borderRadius: BorderRadius.circular(12)), child: child);

    return FramerEnter(
      dy: 10,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(TwRadius.r2xl),
          gradient: CssLinearGradient(angle: 135, colors: [phase.from, phase.to]),
        ),
        child: Stack(children: [
          PositionedDirectional(
            top: -64,
            end: -64,
            child: Container(width: 128, height: 128, decoration: BoxDecoration(shape: BoxShape.circle, color: w(0.1))),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Flexible(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(data.name, style: t(12, alpha: 0.8, height: 16 / 12)),
                    Row(children: [
                      Text(phase.emoji, style: const TextStyle(fontSize: 24, height: 32 / 24)),
                      const SizedBox(width: 8),
                      Flexible(child: Text(phase.label, style: t(20, weight: FontWeight.w700, height: 28 / 20))),
                    ]),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(tr('partnerflowstatuscard_tsikl_gunu_b9e250', 'Tsikl günü'), style: t(10, alpha: 0.7)),
                  Text('${info.dayInCycle}', style: t(30, weight: FontWeight.w700, height: 36 / 30)),
                ]),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: box(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const AIcon(AIcons.calendar, size: 16, color: white),
                    const SizedBox(height: 4),
                    Text('$days', style: t(16, weight: FontWeight.w700, height: 24 / 16)),
                    Text(tr('partnerflowstatuscard_novbeti_perioda_94038c', 'növbəti perioda'), style: t(10, alpha: 0.7)),
                  ])),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: box(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    AIcon(info.isFertileDay ? AIcons.sparkles : AIcons.heart, size: 16, color: white),
                    const SizedBox(height: 4),
                    Text(info.isFertileDay ? tr('partnerflowstatuscard_fertil_f123bc', 'Fertil') : tr('common_normal', 'Normal'),
                        style: t(16, weight: FontWeight.w700, height: 24 / 16)),
                    Text(info.isFertileDay ? tr('partnerflowstatuscard_reproduktiv_dovr_15efae', 'reproduktiv dövr') : tr('partnerflowstatuscard_gun_54e78d', 'gün'),
                        style: t(10, alpha: 0.7)),
                  ])),
                ),
              ]),
              const SizedBox(height: 12),
              if (pms) ...[
                box(Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(padding: EdgeInsets.only(top: 2), child: AIcon(AIcons.circleAlert, size: 16, color: white)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(tr('partnerflowstatuscard_pms_dovru_yaxinlasir_elave_des_4d2e8e', 'PMS dövrü yaxınlaşır — əlavə dəstək lazım ola bilər 💕'),
                        style: t(12, height: 16 / 12)),
                  ),
                ])),
                const SizedBox(height: 8),
              ],
              box(Text('💡 ${phase.tip}', style: t(12, alpha: 0.9, height: 1.375)), padding: const EdgeInsets.all(12)),
            ]),
          ),
        ]),
      ),
    );
  }
}
