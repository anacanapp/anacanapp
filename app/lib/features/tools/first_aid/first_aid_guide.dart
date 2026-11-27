// Ported from: src/components/tools/FirstAidGuide.tsx
//
// First aid SOS (`first-aid`): emergency call card, scenario list (all from the offline bundle) and the step-by-step
// guide. When no content is available it shows a call pill and a retry instead of a blank screen.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart';
import '../../legal/medical_disclaimer.dart';
import '../../settings/ui/settings_ui.dart' show ARingSpinner, FadeRise, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'first_aid_data.dart';

/// Emergency level → palette: (gradient, ink, tag colour).
({Gradient grad, Color ink, Color tag}) firstAidStyle(ATokens a, String level) => switch (level) {
      'critical' => (grad: a.gradPink, ink: a.alertInk, tag: a.pink2),
      'high' => (grad: a.gradPeach, ink: a.accentInk, tag: a.peach2),
      _ => (grad: a.gradYellow, ink: a.warnInk, tag: a.yellow2),
    };

class FirstAidGuide extends ConsumerStatefulWidget {
  const FirstAidGuide({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<FirstAidGuide> createState() => _FirstAidGuideState();
}

class _FirstAidGuideState extends ConsumerState<FirstAidGuide> {
  FirstAidScenario? _scenario;
  int _step = 0;

  void _back() {
    if (_scenario != null) {
      setState(() {
        _scenario = null;
        _step = 0;
      });
    } else {
      widget.onBack();
    }
  }

  void _call(String number) => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: number));

  @override
  Widget build(BuildContext context) {
    final emergency = ref.watch(emergencyNumberProvider);
    final q = ref.watch(firstAidContentQuery);
    final bundle = q.data;
    final scenarios = bundle?.scenarios ?? const <FirstAidScenario>[];
    final scenario = _scenario;
    final steps = scenario == null ? const <FirstAidStep>[] : (bundle?.stepsByScenario[scenario.id] ?? const <FirstAidStep>[]);
    void retry() => ref.read(firstAidContentQuery.notifier).refetch();

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: _back,
          eyebrow: scenario != null ? '${tr('firstaidguide_addim_9346cd', 'Addım')} ${_step + 1} / ${steps.length}' : tr('firstaidguide_tecili_tibbi_yardim_b28b39', 'Təcili Tibbi Yardım'),
          title: scenario != null ? scenario.title : tr('firstaidguide_heyat_qurtaran_sos_2f76df', 'Həyat Qurtaran SOS'),
        ),
        KeyedSubtree(
          key: ValueKey(scenario == null ? 'scenarios' : 'steps'),
          child: scenario == null
              ? _scenarios(context, emergency, scenarios, q.isLoading, q.isFetching, retry)
              : _steps(context, emergency, scenario, steps, q.isFetching, retry),
        ),
      ]),
    );
  }

  Widget _scenarios(BuildContext context, String emergency, List<FirstAidScenario> scenarios, bool loading, bool fetching, VoidCallback retry) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      FadeRise(
        delay: const Duration(milliseconds: 100),
        scaleFrom: 0.95,
        dy: 0,
        child: Semantics(
          link: true,
          label: emergency,
          child: GestureDetector(
            key: const ValueKey('firstaid-call-card'),
            behavior: HitTestBehavior.opaque,
            onTap: () => _call(emergency),
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
              child: Row(children: [
                const AListIconBox(background: Color(0x40FFFFFF), color: Color(0xFFFFFFFF), child: AIcon(AIcons.phone, size: 18, strokeWidth: 2.2, color: Color(0xFFFFFFFF))),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(emergency, style: AStyles.heading(context, 19, color: const Color(0xFFFFFFFF))),
                    Text(tr('firstaidguide_tecili_tibbi_yardim_b28b39', 'Təcili Tibbi Yardım'), style: px(11.5, weight: FontWeight.w600, color: const Color(0xD9FFFFFF))),
                  ]),
                ),
                Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: Color(0x40FFFFFF), shape: BoxShape.circle),
                  child: const AIcon(AIcons.chevronRight, size: 15, color: Color(0xFFFFFFFF), mirrorInRtl: true),
                ),
              ]),
            ),
          ),
        ),
      ),
      const Padding(padding: EdgeInsets.only(bottom: 12), child: MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan)),
      ASectionHeadRow(top: 4, title: tr('firstaidguide_tecili_veziyyet_secin_51d6bd', 'Təcili Vəziyyət Seçin'), trailing: AIcon(AIcons.triangleAlert, size: 15, color: a.pink2)),
      if (loading)
        vgap(10, [
          for (var i = 0; i < 3; i++)
            APulse(child: ACard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [ABar(height: 18, widthFactor: 0.5), SizedBox(height: 6), ABar(height: 12, widthFactor: 0.75)]))),
        ])
      else if (scenarios.isEmpty)
        FirstAidUnavailable(emergency: emergency, retrying: fetching, onRetry: retry)
      else
        AListCardBox(bottomPadding: 16, children: [
          for (var i = 0; i < scenarios.length; i++)
            () {
              final s = scenarios[i];
              final st = firstAidStyle(a, s.emergencyLevel);
              return FadeRise(
                dx: -20,
                dy: 0,
                delay: Duration(milliseconds: (i * 50).clamp(0, 300)),
                child: AListRowBox(
                  first: i == 0,
                  semanticLabel: s.title,
                  onTap: () => setState(() => _scenario = s),
                  children: [
                    AListIconBox(gradient: st.grad, child: Text(s.icon ?? '', style: const TextStyle(fontSize: 18))),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.title, style: AStyles.listTitle(context)),
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(s.description ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listSub(context)),
                        ),
                      ]),
                    ),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      ARankTagBox(
                        s.emergencyLevel == 'critical'
                            ? tr('firstaid_critical', 'KRİTİK')
                            : s.emergencyLevel == 'high'
                                ? tr('firstaidguide_yuksek_22d925', 'YÜKSƏK')
                                : tr('firstaid_medium', 'ORTA'),
                        background: null,
                        gradient: st.grad,
                        color: st.ink,
                      ),
                      const SizedBox(width: 6),
                      AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                    ]),
                  ],
                ),
              );
            }(),
        ]),
    ]);
  }

  Widget _steps(BuildContext context, String emergency, FirstAidScenario scenario, List<FirstAidStep> steps, bool fetching, VoidCallback retry) {
    final a = context.a;
    final st = firstAidStyle(a, scenario.emergencyLevel);
    final step = _step < steps.length ? steps[_step] : null;
    final last = _step == steps.length - 1;
    return FadeRise(
      dx: 30,
      dy: 0,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: hgap(4, [
            for (var i = 0; i < steps.length; i++)
              Expanded(child: Container(height: 4, decoration: BoxDecoration(color: i <= _step ? st.tag : a.lineStrong, borderRadius: BorderRadius.circular(999)))),
          ])),
        ),
        if (steps.isEmpty) FirstAidUnavailable(emergency: emergency, retrying: fetching, onRetry: retry),
        if (step != null)
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: KeyedSubtree(
                key: ValueKey('step-$_step'),
                child: FadeRise(
                  dy: 10,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(children: [
                        AListIconBox(
                          size: 34,
                          radius: 11,
                          gradient: st.grad,
                          child: Text(_step == 0 ? '👋' : last ? '✅' : (scenario.icon ?? ''), style: const TextStyle(fontSize: 15)),
                        ),
                        const SizedBox(width: 8),
                        ATagChip(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), fontSize: 10, children: [Text('${tr('firstaidguide_addim_9346cd', 'Addım')} ${_step + 1}')]),
                        if (step.isCritical) ...[
                          const SizedBox(width: 8),
                          ATagChip(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            fontSize: 10,
                            background: a.pink1,
                            color: a.pinkInk,
                            children: [const AIcon(AIcons.triangleAlert, size: 10), Text(tr('firstaid_critical_badge', 'Kritik'))],
                          ),
                        ],
                        const Spacer(),
                        if (step.durationSeconds != null && step.durationSeconds != 0) Text('⏱️ ${step.durationSeconds}s', style: AStyles.listTime(context)),
                      ]),
                    ),
                    ACard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(step.title, style: AStyles.cardTitle(context))),
                        Text(step.instruction, style: AStyles.ctaText(context)),
                      ]),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: vgap(8, [
                        Row(children: [
                          Expanded(
                            child: APillButton(
                              kind: APillKind.soft,
                              label: tr('firstaidguide_evvelki_936896', 'Əvvəlki'),
                              icon: const AIcon(AIcons.chevronLeft, size: 15, strokeWidth: 2.2, mirrorInRtl: true),
                              height: 44,
                              expand: true,
                              disabledOpacity: 0.45,
                              onTap: _step == 0 ? null : () => setState(() => _step--),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: APillButton(
                              label: last ? tr('firstaid_complete', 'Tamamla') : tr('firstaidguide_novbeti_6e8661', 'Növbəti'),
                              trailingIcon: const AIcon(AIcons.chevronRight, size: 15, strokeWidth: 2.2, mirrorInRtl: true),
                              height: 44,
                              expand: true,
                              background: last ? a.green2 : st.tag,
                              onTap: last ? _back : () => setState(() => _step++),
                            ),
                          ),
                        ]),
                        APillButton(
                          kind: APillKind.soft,
                          label: fillEmergencyNumber(tr('firstaidguide_103_zeng_et_52da85', '{emergency} Zəng Et'), emergency),
                          icon: const AIcon(AIcons.phone, size: 13, strokeWidth: 2.2),
                          height: 40,
                          expand: true,
                          background: a.pink1,
                          foreground: a.pinkInk,
                          onTap: () => _call(emergency),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

/// Shown when no first-aid content is available (offline before the first load, or a failed load). Never blank.
class FirstAidUnavailable extends ConsumerWidget {
  const FirstAidUnavailable({super.key, required this.emergency, required this.retrying, required this.onRetry});
  final String emergency;
  final bool retrying;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    return Semantics(
      liveRegion: true,
      container: true,
      child: ACard(
        key: const ValueKey('firstaid-unavailable'),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AListIconBox(gradient: a.gradYellow, child: AIcon(AIcons.wifiOff, size: 17, strokeWidth: 2.2, color: a.warnInk)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(tr('firstaid_unavailable_title', 'Təlimatları açmaq mümkün olmadı'), textAlign: TextAlign.center, style: AStyles.cardTitle(context)),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('firstaid_unavailable_body', 'İnternet bağlantısını yoxlayıb yenidən cəhd edin. Təcili vəziyyətdə gözləməyin, dərhal zəng edin.'),
                textAlign: TextAlign.center, style: AStyles.listSub(context)),
          ),
          vgap(8, [
            APillButton(
              buttonKey: const ValueKey('firstaid-unavailable-call'),
              label: fillEmergencyNumber(tr('firstaidguide_103_zeng_et_52da85', '{emergency} Zəng Et'), emergency),
              icon: const AIcon(AIcons.phone, size: 15, strokeWidth: 2.2),
              height: 44,
              expand: true,
              background: a.pink2,
              onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
            ),
            APillButton(
              kind: APillKind.soft,
              label: tr('firstaid_retry', 'Yenidən cəhd et'),
              icon: retrying ? ARingSpinner(size: 14, width: 2, color: a.accentInk) : const AIcon(AIcons.refreshCw, size: 14, strokeWidth: 2.2),
              height: 40,
              expand: true,
              disabledOpacity: 0.6,
              onTap: retrying ? null : onRetry,
            ),
          ]),
        ]),
      ),
    );
  }
}
