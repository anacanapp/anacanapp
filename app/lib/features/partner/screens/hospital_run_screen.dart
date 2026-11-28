// Ported from: src/components/partner/v2/HospitalRunScreen.tsx
//
// "Xəstəxana rejimi": the partner's road map after the birth alert — her location from the latest birth alert,
// the bag status, live contractions, a step-by-step checklist and a calming note.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise;
import '../data/partner_hospital_bag.dart';
import '../data/sos_alert.dart';
import '../ui/alert_receiver.dart' show alertMapsOpenerProvider;
import '../ui/partner_ui.dart';
import 'partner_hospital_bag_screen.dart' show PartnerProgressBar;
import 'screens_ui.dart';

/// The latest birth alert sent to [userId] (alerts are newest first).
SosAlert? latestBirthAlert(List<SosAlert> alerts, String? userId) =>
    alerts.where((a) => a.alertType == 'birth' && a.receiverId == userId).firstOrNull;

class HospitalRunScreen extends ConsumerStatefulWidget {
  const HospitalRunScreen({super.key, required this.onBack, required this.onNavigate, this.onOpenContractions});
  final VoidCallback onBack;
  final void Function(String screen) onNavigate;
  final VoidCallback? onOpenContractions;

  @override
  ConsumerState<HospitalRunScreen> createState() => _HospitalRunScreenState();
}

class _HospitalRunScreenState extends ConsumerState<HospitalRunScreen> {
  final Set<int> _done = {};

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final userId = ref.watch(authUserProvider)?.id;
    final bag = ref.watch(partnerHospitalBagProvider);
    final alerts = ref.watch(sosAlertProvider.select((s) => s.alerts));
    final birth = latestBirthAlert(alerts, userId);
    final hasLocation = birth?.latitude != null && birth?.longitude != null;
    const white = Color(0xFFFFFFFF);

    final steps = [
      (AIcons.heartPulse, tr('partnerv2_hr_step_sakit', 'Sakit ol — dərin nəfəs al. Sən hazırsan!')),
      (AIcons.package, tr('partnerv2_hr_step_canta', 'Xəstəxana çantasını götür')),
      (AIcons.fileText, tr('partnerv2_hr_step_senedler', 'Sənədləri yoxla (vəsiqə, analizlər, kart)')),
      (AIcons.car, tr('partnerv2_hr_step_masin', 'Maşını hazırla / taksi çağır')),
      (AIcons.phone, tr('partnerv2_hr_step_hekim', 'Həkimə / xəstəxanaya zəng et')),
    ];

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: tr('partnerv2_dogus_vaxti', 'Doğuş vaxtı'),
      title: '${tr('partnerv2_xestexana_rejimi', 'Xəstəxana Rejimi')} 🏥',
      children: [
        if (hasLocation) ...[
          FadeRise(
            dy: 12,
            child: PartnerTap(
              key: const ValueKey('hr-location'),
              scale: 0.98,
              onTap: () => unawaited(ref.read(alertMapsOpenerProvider)(Uri.parse('https://maps.google.com/?q=${birth!.latitude},${birth.longitude}'))),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: a.blue2,
                  borderRadius: BorderRadius.circular(a.radiusMd),
                  // 0 14px 28px -12px rgba(99, 172, 223, 0.6) (HospitalRunScreen.tsx:70)
                  boxShadow: const [BoxShadow(color: Color(0x9963ACDF), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
                ),
                child: Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(color: Color(0x40FFFFFF), shape: BoxShape.circle),
                    child: const AIcon(AIcons.mapPin, size: 20, color: white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('partnerv2_onun_yeri', 'Onun yeri'), style: pText(14.5, weight: FontWeight.w800, color: white)),
                      Text(tr('partnerv2_xeritede_ac', 'Xəritədə aç və yola düş'), style: pText(11.5, color: const Color(0xD9FFFFFF))),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  const AIcon(AIcons.car, size: 20, color: white),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
        FadeRise(
          dy: 12,
          delay: const Duration(milliseconds: 50),
          child: PartnerTap(
            key: const ValueKey('hr-bag'),
            scale: 0.98,
            onTap: () => widget.onNavigate('partner-hospital-bag'),
            child: PartnerCard(
              child: Column(children: [
                Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
                    child: AIcon(AIcons.package, size: 19, color: a.accentInk),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('syncedfeaturesgrid_xestexana_cantasi_045078', 'Xəstəxana Çantası'), style: pText(14, weight: FontWeight.w800, color: a.ink)),
                      Text('${bag.checkedCount}/${bag.totalCount} ${tr('partner_ready', 'hazır')}', style: pText(11.5, color: a.inkSoft)),
                    ]),
                  ),
                  Text('${bag.progress.toStringAsFixed(0)}%', style: pText(16, weight: FontWeight.w900, color: a.accentInk)),
                ]),
                const SizedBox(height: 10),
                PartnerProgressBar(progress: bag.progress),
              ]),
            ),
          ),
        ),
        if (widget.onOpenContractions != null) ...[
          const SizedBox(height: 14),
          FadeRise(
            dy: 12,
            delay: const Duration(milliseconds: 80),
            child: PartnerTap(
              key: const ValueKey('hr-contractions'),
              scale: 0.98,
              onTap: widget.onOpenContractions,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(a.radiusMd)),
                child: Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.chipOverlay, shape: BoxShape.circle),
                    child: AIcon(AIcons.heartPulse, size: 19, color: a.pinkInk),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('partnerv2_canli_sancilar', 'Canlı sancılar'), style: pText(14, weight: FontWeight.w800, color: a.alertInk)),
                      Text(tr('partnerv2_interval_ve_muddet', 'İnterval və müddəti izlə'), style: pText(11.5, color: a.berryInk)),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        FadeRise(
          dy: 12,
          delay: const Duration(milliseconds: 100),
          child: PartnerCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr('partnerv2_addim_addim', 'Addım-addım'), style: context.aText.aCardTitle)),
              for (final (i, step) in steps.indexed) ...[
                if (i > 0) const SizedBox(height: 8),
                () {
                  final done = _done.contains(i);
                  return PartnerTap(
                    key: ValueKey('hr-step-$i'),
                    scale: 0.98,
                    onTap: () => setState(() => _done.contains(i) ? _done.remove(i) : _done.add(i)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                      decoration: BoxDecoration(color: done ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                      child: Row(children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: done ? a.green2 : const Color(0xB3FFFFFF), shape: BoxShape.circle),
                          child: done ? const AIcon(AIcons.check, size: 14, strokeWidth: 3, color: white) : AIcon(step.$1, size: 14, color: a.inkSoft),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(step.$2,
                              style: pText(13, weight: FontWeight.w600, color: done ? a.inkSoft : a.ink)
                                  .copyWith(decoration: done ? TextDecoration.lineThrough : null, decorationColor: a.inkSoft)),
                        ),
                      ]),
                    ),
                  );
                }(),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(16)),
          child: Text(
            tr('partnerv2_hr_sakit_qeyd', 'İlk doğuşlar adətən saatlarla çəkir — tələsik amma təmkinli ol. Sən onun ən böyük dayağısan. 💪'),
            textAlign: TextAlign.center,
            style: pText(12, color: a.disclaimerInk),
          ),
        ),
      ],
    );
  }
}
