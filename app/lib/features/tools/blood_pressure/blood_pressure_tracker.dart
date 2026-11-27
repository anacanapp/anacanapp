// Ported from: src/components/tools/BloodPressureTracker.tsx
//
// Blood pressure tracker (`blood-pressure`, host of the blood-sugar section) with pre-eclampsia alerts: in pregnancy
// and the first 6 weeks after birth ≥140/90 warns, ≥160/110 is urgent.
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/blood_pressure.dart';
import '../../../domain/health/emergency.dart';
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../../settings/data/health_service.dart' show healthServiceProvider;
import '../../settings/ui/settings_ui.dart' show cssUpper, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'bp_data.dart';
import 'postpartum_window.dart';

/// `var(--a-…)` of the bloodPressure.ts palette → tokens (`--a-alert-bg` is a gradient).
({Color? color, Gradient? gradient}) bpPaint(ATokens a, String cssVar) => switch (cssVar) {
      'var(--a-blue-1)' => (color: a.blue1, gradient: null),
      'var(--a-green-1)' => (color: a.green1, gradient: null),
      'var(--a-yellow-1)' => (color: a.yellow1, gradient: null),
      'var(--a-peach-1)' => (color: a.peach1, gradient: null),
      'var(--a-alert-bg)' => (color: null, gradient: a.alertBg),
      _ => (color: a.surfaceSoft, gradient: null),
    };

Color bpInk(ATokens a, String cssVar) => switch (cssVar) {
      'var(--a-blue-ink)' => a.blueInk,
      'var(--a-green-ink)' => a.greenInk,
      'var(--a-yellow-ink)' => a.yellowInk,
      'var(--a-accent-ink)' => a.accentInk,
      'var(--a-alert-ink)' => a.alertInk,
      _ => a.ink,
    };

class BloodPressureTracker extends ConsumerStatefulWidget {
  const BloodPressureTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BloodPressureTracker> createState() => _BloodPressureTrackerState();
}

class _BloodPressureTrackerState extends ConsumerState<BloodPressureTracker> {
  final _sys = TextEditingController();
  final _dia = TextEditingController();
  final _pulse = TextEditingController();
  bool _pending = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_sys, _dia, _pulse]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _sys.dispose();
    _dia.dispose();
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _save(bool isPregnant) async {
    final toasts = AToastHost.of(context);
    final sys = int.tryParse(_sys.text.trim()) ?? 0;
    final dia = int.tryParse(_dia.text.trim()) ?? 0;
    final pul = _pulse.text.isNotEmpty ? int.tryParse(_pulse.text.trim()) : null;
    if (sys == 0 || dia == 0 || sys < 50 || sys > 260 || dia < 30 || dia > 200) {
      toasts.error(tr('bp_invalid', 'Düzgün dəyərlər daxil edin (məs. 120/80)'));
      return;
    }
    if (pul != null && (pul < 30 || pul > 220)) {
      toasts.error(tr('bp_invalid_pulse', 'Nəbz 30-220 aralığında olmalıdır'));
      return;
    }
    await ref.read(healthHapticsProvider).medium();
    setState(() => _pending = true);
    try {
      await ref.read(bpActionsProvider).add(systolic: sys, diastolic: dia, pulse: pul);
      final assessment = classifyBp(sys, dia, isPregnant, tr: tr);
      toasts.success('${assessment.emoji} ${assessment.label} — ${tr('bp_saved', 'qeyd edildi')}');
      _sys.clear();
      _dia.clear();
      _pulse.clear();
      // Health copy on → copy the saved record to Apple Health / Health Connect (background, no duplicates).
      ref.read(healthServiceProvider).syncVitalsInBackground(ref.read(userStoreProvider).userId);
    } catch (_) {
      toasts.error(tr('bp_save_error', 'Saxlanılmadı — bazanın hazır olduğundan əmin olun'));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  String _formatDate(Object? iso) {
    final d = iso is String ? DateTime.tryParse(iso)?.toLocal() : null;
    if (d == null) return '';
    final now = DateTime.now();
    final time = formatDatePattern(d, 'HH:mm');
    if (d.year == now.year && d.month == now.month && d.day == now.day) return '${tr('partnerv2_bu_gun', 'Bu gün')} · $time';
    return '${formatDatePattern(d, 'd MMM')} · $time';
  }

  static String _n(Object? v) => v is num ? (v == v.roundToDouble() ? '${v.toInt()}' : '$v') : '${v ?? ''}';

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final isBump = store.lifeStage == 'bump';
    final children = ref.watch(childrenProvider).children;
    // Pre-eclampsia can start or worsen in the first 6 weeks after birth: the youngest baby counts.
    final isPostpartum = store.lifeStage == 'mommy' && isEarlyPostpartum([store.babyBirthDate, for (final c in children) c.birthDate]);
    final isPregnant = isBump || isPostpartum;
    final emergency = ref.watch(emergencyNumberProvider);
    final q = ref.watch(bpLogsQuery);
    final logs = q.data ?? const <Map<String, dynamic>>[];
    final latest = logs.firstOrNull;
    final latestA = latest == null ? null : classifyBp((latest['systolic'] as num?) ?? 0, (latest['diastolic'] as num?) ?? 0, isPregnant, tr: tr);
    final showUrgent = latestA != null && (latestA.category == 'crisis' || latestA.pregnancyAlert == 'urgent');
    final showWarning = latestA != null && !showUrgent && (latestA.pregnancyAlert == 'warning' || latestA.category == 'stage2');
    final canSave = !_pending && _sys.text.isNotEmpty && _dia.text.isNotEmpty;

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          title: tr('bp_title', 'Qan Təzyiqi'),
          eyebrow: isBump
              ? tr('bp_eyebrow_bump', 'Preeklampsiya nəzarəti')
              : isPostpartum
                  ? tr('safety_bp_eyebrow_postpartum', 'Doğuşdan sonra preeklampsiya nəzarəti')
                  : tr('bp_eyebrow', 'Ürək sağlamlığı'),
          onBack: widget.onBack,
        ),
        vgap(14, [
          if (showUrgent)
            AAlertCard(
              key: const ValueKey('bp-urgent'),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('🚨 ${cssUpper(tr('bp_urgent_eyebrow', 'Təcili'))}', style: AAlertCard.eyebrow(context))),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    isPregnant && latestA.pregnancyAlert == 'urgent'
                        ? tr('bp_urgent_preeclampsia', 'Ağır hipertenziya — preeklampsiya riski!')
                        : tr('bp_urgent_crisis', 'Hipertonik böhran!'),
                    style: AAlertCard.headline(context),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text('${_n(latest!['systolic'])}/${_n(latest['diastolic'])} mmHg. ${tr('bp_urgent_text', 'Gözləməyin — dərhal həkiminizə və ya təcili yardıma müraciət edin.')}',
                      style: AAlertCard.text(context)),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: APillButton(
                    label: emergency,
                    icon: const AIcon(AIcons.phone, size: 14, strokeWidth: 2.2),
                    expand: true,
                    background: a.pinkInk,
                    onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
                  ),
                ),
              ]),
            ),
          if (showWarning)
            Container(
              key: const ValueKey('bp-warning'),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(16)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 16, color: a.warnInk)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isPostpartum
                        ? tr('safety_bp_warning_postpartum',
                            'Son ölçmə ≥140/90. Doğuşdan sonrakı ilk 6 həftədə bu, preeklampsiya əlaməti ola bilər. Bu gün həkiminizlə əlaqə saxlayın.')
                        : isPregnant
                            ? tr('bp_warning_preeclampsia', 'Son ölçmə ≥140/90 — hamiləlikdə bu, preeklampsiya əlaməti ola bilər. Bu gün həkiminizlə əlaqə saxlayın.')
                            : tr('bp_warning_stage2', 'Son ölçməniz yüksəkdir. Bu gün həkiminizlə əlaqə saxlamağı tövsiyə edirik.'),
                    style: px(12.5, weight: FontWeight.w600, color: a.warnInk),
                  ),
                ),
              ]),
            ),
          ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 14), child: Text(tr('bp_new_reading', 'Yeni ölçmə'), style: AStyles.cardTitle(context))),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AGridCols(columns: 3, children: [
                  _input(context, _sys, '120', tr('bp_systolic', 'Sistolik'), tr('bp_systolic_hint', '(yuxarı)'), const ValueKey('bp-sys')),
                  _input(context, _dia, '80', tr('bp_diastolic', 'Diastolik'), tr('bp_diastolic_hint', '(aşağı)'), const ValueKey('bp-dia')),
                  _input(context, _pulse, '72', tr('bp_pulse', 'Nəbz'), '(${tr('bp_optional', 'istəyə bağlı')})', const ValueKey('bp-pulse')),
                ]),
              ),
              const SizedBox(height: 8),
              ATap(
                semanticLabel: tr('bp_save_btn', 'Qeyd et'),
                onTap: canSave ? () => _save(isPregnant) : null,
                child: Opacity(
                  opacity: canSave ? 1 : 0.5,
                  child: Container(
                    height: 50,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: a.peach2,
                      borderRadius: BorderRadius.circular(999),
                      // 0 14px 28px -12px rgba(217, 108, 74, 0.55) (BloodPressureTracker.tsx literal)
                      boxShadow: [BoxShadow(color: const Color(0x8CD96C4A), offset: const Offset(0, 14), blurRadius: cssBlur(28), spreadRadius: -12)],
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AIcon(AIcons.plus, size: 17, color: Color(0xFFFFFFFF)),
                      const SizedBox(width: 8),
                      Text(tr('bp_save_btn', 'Qeyd et'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
          if (latestA != null && latest != null) _latestCard(context, latest, latestA, emergency),
          if (q.isLoading)
            const ACenterSpinner()
          else if (logs.isEmpty)
            ToolEmpty(
              icon: AIcon(AIcons.heartPulse, size: 26, color: a.accentInk),
              title: tr('bp_empty_title', 'Hələ ölçmə yoxdur'),
              text: tr('bp_empty_text', 'İlk qan təzyiqi ölçmənizi yuxarıda qeyd edin. Hamiləlikdə həftədə 1-2 dəfə ölçmək tövsiyə olunur.'),
            )
          else
            ACard(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('bp_history', 'Tarixçə'), style: AStyles.cardTitle(context))),
                for (final log in logs.take(20)) _historyRow(context, log, isPregnant),
              ]),
            ),
          SafetyStrip(
            signs: isPregnant
                ? tr('safety_bp_signs_pregnancy', 'Dərhal zəng edin: güclü baş ağrısı, görmə dəyişikliyi, qabırğaaltı ağrı, təngnəfəslik')
                : tr('safety_bp_signs', 'Dərhal zəng edin: döş ağrısı, güclü baş ağrısı, bir tərəfdə zəiflik, nitq pozulması'),
          ),
          _thresholds(context, isPregnant, isPostpartum, emergency),
        ]),
      ]),
    );
  }

  Widget _input(BuildContext context, TextEditingController c, String placeholder, String label, String hint, Key key) {
    final a = context.a;
    final style = px(26, weight: FontWeight.w800, color: a.ink, height: 1.2);
    return Column(children: [
      Material(
        type: MaterialType.transparency,
        child: Container(
          height: 62,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x00000000), width: 2)),
          child: TextField(
            key: key,
            controller: c,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textAlign: TextAlign.center,
            style: style,
            cursorColor: a.peach2,
            decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text.rich(
          TextSpan(children: [TextSpan(text: '$label '), TextSpan(text: hint, style: const TextStyle(fontWeight: FontWeight.w500))]),
          textAlign: TextAlign.center,
          style: px(10.5, weight: FontWeight.w700, color: a.inkSoft),
        ),
      ),
    ]);
  }

  Widget _latestCard(BuildContext context, Map<String, dynamic> latest, BpAssessment la, String emergency) {
    final a = context.a;
    final paint = bpPaint(a, la.bg);
    final pulse = latest['pulse'];
    return ACard(
      key: const ValueKey('bp-latest'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: paint.color, gradient: paint.gradient, borderRadius: BorderRadius.circular(16)),
            child: Text(la.emoji, style: const TextStyle(fontSize: 24, height: 1.2)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 8, children: [
                Text('${_n(latest['systolic'])}/${_n(latest['diastolic'])}', style: px(22, weight: FontWeight.w900, color: a.ink, ls: -0.02, height: 1.2)),
                Text('mmHg', style: px(11, color: a.inkSoft)),
                if (pulse is num && pulse != 0)
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.activity, size: 11, color: a.inkSoft),
                    const SizedBox(width: 4),
                    Text(_n(pulse), style: px(11.5, color: a.inkSoft)),
                  ]),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: paint.color, gradient: paint.gradient, borderRadius: BorderRadius.circular(999)),
                  child: Text(la.label, style: px(11, weight: FontWeight.w800, color: bpInk(a, la.ink))),
                ),
              ),
            ]),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(fillEmergencyNumber(la.guidance, emergency), style: px(12.5, color: a.bodyText, height: 1.625)),
        ),
      ]),
    );
  }

  Widget _historyRow(BuildContext context, Map<String, dynamic> log, bool isPregnant) {
    final a = context.a;
    final la = classifyBp((log['systolic'] as num?) ?? 0, (log['diastolic'] as num?) ?? 0, isPregnant, tr: tr);
    final paint = bpPaint(a, la.bg);
    final ink = bpInk(a, la.ink);
    final pulse = log['pulse'];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
      child: Row(children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: ink, shape: BoxShape.circle)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(
              TextSpan(children: [
                TextSpan(text: '${_n(log['systolic'])}/${_n(log['diastolic'])}'),
                if (pulse is num && pulse != 0)
                  TextSpan(text: ' · ${_n(pulse)} ${tr('bp_bpm', 'vur/dəq')}', style: px(11, weight: FontWeight.w500, color: a.inkSoft)),
              ]),
              style: px(14, weight: FontWeight.w800, color: a.ink),
            ),
            Text(_formatDate(log['measured_at']), style: px(10.5, color: a.inkFaint)),
          ]),
        ),
        const SizedBox(width: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
          decoration: BoxDecoration(color: paint.color, gradient: paint.gradient, borderRadius: BorderRadius.circular(999)),
          child: Text(la.label, style: px(9.5, weight: FontWeight.w800, color: ink)),
        ),
        const SizedBox(width: 12),
        Semantics(
          button: true,
          label: tr('untranslated_sil_zwa7lz', 'Sil'),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => ref.read(bpActionsProvider).delete('${log['id']}').catchError((Object _) {}),
            child: Padding(padding: const EdgeInsets.all(6), child: AIcon(AIcons.trash2, size: 14, color: a.inkFaint)),
          ),
        ),
      ]),
    );
  }

  Widget _thresholds(BuildContext context, bool isPregnant, bool isPostpartum, String emergency) {
    final a = context.a;
    final crisis = fillEmergencyNumber(tr('bp_th_crisis', 'dərhal {emergency}'), emergency);
    final line = px(11, color: a.disclaimerInk, height: 1.6);
    final suffix = isPostpartum
        ? ' — ${tr('safety_bp_th_postpartum', 'doğuşdan sonra preeklampsiya riski, həkimə bildirin')}'
        : isPregnant
            ? ' — ${tr('bp_th_preeclampsia', 'hamiləlikdə preeklampsiya riski, həkimə bildirin')}'
            : '';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(a.radiusMd)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(tr('bp_thresholds_title', '📋 İstinad hədləri'), style: px(11.5, weight: FontWeight.w800, color: a.disclaimerStrong)),
        ),
        vgap(4, [
          Text('💚 ${tr('bp_th_normal', 'Normal')}: ${isPregnant ? '90–129 / 60–84' : '90–119 / 60–79'}', style: line),
          Text('🟡 ${tr('bp_cat_elevated', 'Yüksəlmiş')}: ${isPregnant ? '130–139 / 85–89' : '120–129 / <80'}', style: line),
          if (!isPregnant) Text('🟠 ${tr('bp_cat_monitor', 'Yüksəlmiş — izləyin')}: 130–139 / 80–89', style: line),
          Text('🔴 ${tr('bp_cat_high_reading', 'Yüksək təzyiq')}: ≥140/90$suffix', style: line),
          if (isPregnant) Text('🚨 ${tr('bp_urgent_eyebrow', 'Təcili')}: ≥160/110 — $crisis', style: line),
          Text('🚨 ${tr('bp_cat_crisis', 'Hipertonik böhran')}: ≥180/120 — $crisis', style: line),
        ], cross: CrossAxisAlignment.start),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Opacity(opacity: 0.8, child: Text(tr('bp_disclaimer', 'Bu alət həkim müayinəsini əvəz etmir.'), style: px(10, color: a.disclaimerInk))),
        ),
      ]),
    );
  }
}
