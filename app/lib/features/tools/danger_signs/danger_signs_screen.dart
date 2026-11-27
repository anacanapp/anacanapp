// Ported from: src/components/tools/DangerSignsScreen.tsx
//
// Danger signs that need urgent care (triage): urgent → the country's emergency number + SOS to the partner; soon →
// contact the doctor today.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart';
import '../../../domain/health/red_flags.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';

/// `border: 1.5px solid #ffc94d` of an open "soon" sign (DangerSignsScreen.tsx literal).
const Color kSoonOpenBorder = Color(0xFFFFC94D);

/// `border: 1.5px solid rgba(177,39,91,0.35)` of the emergency row (literal).
const Color kEmergencyRowBorder = Color(0x59B1275B);

class DangerSignsScreen extends ConsumerStatefulWidget {
  const DangerSignsScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<DangerSignsScreen> createState() => _DangerSignsScreenState();
}

class _DangerSignsScreenState extends ConsumerState<DangerSignsScreen> {
  String? _openId;
  final Set<String> _notified = {};

  Future<void> _toggle(String id) async {
    await ref.read(pregnancyHapticsProvider).light();
    if (mounted) setState(() => _openId = _openId == id ? null : id);
  }

  Future<void> _notifyPartner(DangerSign sign) async {
    final toast = AToastHost.of(context);
    await ref.read(pregnancyHapticsProvider).heavy();
    final send = ref.read(sosAlertPortProvider).sendSOS;
    if (send == null) return;
    final error = await send('${sign.emoji} ${sign.title} — ${tr('rf_partner_msg_suffix', 'dərhal əlaqə saxla!')}', true, 'emergency');
    if (error == null && mounted) {
      setState(() => _notified.add(sign.id));
      toast.success(tr('rf_partner_notified', 'Partnyorunuz xəbərdar edildi 💙'));
    }
  }

  void _call(String number) => unawaited(ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: number)));

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final countryCode = ref.watch(userStoreProvider.select((s) => s.countryCode));
    final profile = ref.watch(authProfileProvider);
    // The emergency number follows the user's COUNTRY (not the language).
    final profileCountry = profile?.countryCode;
    final emergency = getEmergencyNumber(profileCountry != null && profileCountry.isNotEmpty ? profileCountry : countryCode);
    final sos = ref.watch(sosAlertPortProvider);
    final isMultiples = profile?.multiplesType != null && profile!.multiplesType!.isNotEmpty && profile.multiplesType != 'single';
    final signs = getDangerSignsForStage(lifeStage, isMultiplesPregnancy: isMultiples, tr: tr);
    final urgent = signs.where((s) => s.severity == 'urgent').toList();
    final soon = signs.where((s) => s.severity == 'soon').toList();
    final sectionTitle = context.aText.aSectionTitle.copyWith(fontWeight: FontWeight.w800);

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          title: tr('rf_title', 'Təhlükə Əlamətləri'),
          eyebrow: lifeStage == 'mommy' ? tr('rf_eyebrow_pp', 'Doğuşdan sonra') : tr('rf_eyebrow_bump', 'Hamiləlik dövrü'),
          onBack: widget.onBack,
        ),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: a.disclaimerBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.disclaimerBorder)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.shieldAlert, size: 16, color: a.disclaimerStrong)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                tr('rf_intro',
                    'Bu əlamətlərdən hər hansı biri sizdə varsa, gözləmək olmaz. Şübhə halında həmişə həkimə müraciət edin — "boş yerə narahat etdim" deyə bir şey yoxdur.'),
                style: px(11.5, color: a.disclaimerInk, height: 1.55),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        Semantics(
          link: true,
          child: GestureDetector(
            key: const ValueKey('danger-emergency'),
            behavior: HitTestBehavior.opaque,
            onTap: () => _call(emergency),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(a.radiusMd), border: Border.all(color: kEmergencyRowBorder, width: 1.5)),
              child: Row(children: [
                _Pulse(
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.pinkInk, shape: BoxShape.circle),
                    child: const AIcon(AIcons.siren, size: 19, color: Color(0xFFFFFFFF)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(fillEmergencyNumber(tr('rf_103_title', 'Təcili Tibbi Yardım'), emergency), style: px(14, weight: FontWeight.w800, color: a.alertInk)),
                    Text(tr('rf_103_sub', 'Zəng etmək üçün toxunun'), style: px(11.5, color: a.alertSoft)),
                  ]),
                ),
                const SizedBox(width: 12),
                Text(emergency, style: px(22, weight: FontWeight.w900, color: a.alertInk)),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('🚨 ${tr('rf_urgent_section', 'Dərhal müraciət')}', style: sectionTitle)),
        for (var i = 0; i < urgent.length; i++) ...[if (i > 0) const SizedBox(height: 10), _sign(context, urgent[i], emergency, sos)],
        if (soon.isNotEmpty) ...[
          const SizedBox(height: 14),
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('📞 ${tr('rf_soon_section', 'Bu gün həkimlə əlaqə')}', style: sectionTitle)),
          for (var i = 0; i < soon.length; i++) ...[if (i > 0) const SizedBox(height: 10), _sign(context, soon[i], emergency, sos)],
        ],
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Text(
            tr('rf_disclaimer', 'Bu siyahı məlumat xarakterlidir və həkim qiymətləndirməsini əvəz etmir.'),
            textAlign: TextAlign.center,
            style: px(10.5, color: a.ink),
          ),
        ),
      ]),
    );
  }

  Widget _sign(BuildContext context, DangerSign sign, String emergency, SosAlertPort sos) {
    final a = context.a;
    final isUrgent = sign.severity == 'urgent';
    final isOpen = _openId == sign.id;
    final notified = _notified.contains(sign.id);
    return Container(
      key: ValueKey('danger-sign-${sign.id}'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: a.cardShadow,
        border: Border.all(color: isOpen ? (isUrgent ? a.pink2 : kSoonOpenBorder) : const Color(0x00000000), width: 1.5),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => unawaited(_toggle(sign.id)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: isUrgent ? a.pink1 : a.yellow1, borderRadius: BorderRadius.circular(14)),
                child: Text(sign.emoji, style: const TextStyle(fontSize: 24)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(sign.title, style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                    decoration: BoxDecoration(color: isUrgent ? a.pink1 : a.yellow1, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      isUrgent ? tr('rf_urgent_chip', 'TƏCİLİ') : tr('rf_soon_chip', 'BU GÜN HƏKİMƏ'),
                      style: px(9.5, weight: FontWeight.w800, color: isUrgent ? a.pinkInk : a.yellowInk),
                    ),
                  ),
                ]),
              ),
              AnimatedRotation(turns: isOpen ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: AIcon(AIcons.chevronDown, size: 16, color: a.inkFaint)),
            ]),
          ),
        ),
        if (isOpen)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(sign.desc, style: px(12.5, color: a.bodyText, height: 1.625))),
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: isUrgent ? null : a.yellow1, gradient: isUrgent ? a.alertBg : null, borderRadius: BorderRadius.circular(13)),
                child: Text(
                  isUrgent
                      ? tr('rf_urgent_guidance_n', '⚠️ Gözləməyin: dərhal həkiminizə zəng edin və ya təcili yardıma ({n}) müraciət edin.').replaceFirst('{n}', emergency)
                      : tr('rf_soon_guidance', '📞 Bu gün ərzində həkiminizlə əlaqə saxlayın və vəziyyəti izləyin.'),
                  style: px(12, weight: FontWeight.w700, color: isUrgent ? a.alertInk : a.warnInk),
                ),
              ),
              Row(children: [
                if (isUrgent)
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _call(emergency),
                      child: Container(
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.pinkInk, borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const AIcon(AIcons.phone, size: 15, color: Color(0xFFFFFFFF)),
                          const SizedBox(width: 6),
                          Text(emergency, style: px(13, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                        ]),
                      ),
                    ),
                  ),
                if (isUrgent && sos.hasPartner) const SizedBox(width: 8),
                if (sos.hasPartner)
                  Expanded(
                    child: Opacity(
                      opacity: sos.loading || notified ? 0.6 : 1,
                      child: GestureDetector(
                        key: ValueKey('danger-partner-${sign.id}'),
                        onTap: sos.loading || notified ? null : () => unawaited(_notifyPartner(sign)),
                        child: Container(
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            AIcon(AIcons.heartHandshake, size: 15, color: a.blueInk),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                notified ? tr('rf_partner_done', 'Xəbərdar edildi ✓') : tr('rf_notify_partner', 'Partnyora bildir'),
                                style: px(12.5, weight: FontWeight.w700, color: a.blueInk),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ]),
            ]),
          ),
      ]),
    );
  }
}

/// framer `animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: 2 }}`.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!animationsDisabled(context)) unawaited(_c.repeat(count: 3).orCancel.catchError((Object _) {}));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final v = _c.value;
          final scale = 1 + 0.08 * (v < 0.5 ? v * 2 : (1 - v) * 2);
          return Transform.scale(scale: scale, child: child);
        },
        child: widget.child,
      );
}
