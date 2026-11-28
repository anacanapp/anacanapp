// Ported from: src/components/tools/WeightTracker.tsx
import 'dart:async';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/count_format.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_weight.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show px, todayInfoEyebrow;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'profile_height.dart';
import 'weight_entries.dart';
import 'weight_tracker_stage.dart';

/// `fill="#63bd8b"` of the recommended band (WeightTracker.tsx literal).
const Color kWeightBandColor = Color(0xFF63BD8B);

String _n(num v) => jsNumberToString(v);
String _fixed1(num v) => v.toStringAsFixed(1);

class WeightTracker extends ConsumerStatefulWidget {
  const WeightTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<WeightTracker> createState() => _WeightTrackerState();
}

class _WeightTrackerState extends ConsumerState<WeightTracker> {
  num? _heightCm;
  final TextEditingController _heightInput = TextEditingController();
  String? _heightError;
  String? _aiAdvice;
  bool _aiLoading = false;
  Object? _heightKey;
  Object? _aiKey;

  HeightStorage get _storage => LocalStoreHeightStorage(ref.read(localStoreProvider));

  @override
  void dispose() {
    _heightInput.dispose();
    super.dispose();
  }

  WeightToast _toast(BuildContext context) {
    final host = AToastHost.of(context);
    return ({required title, description, destructive = false}) => host.show(title: title, description: description, destructive: destructive);
  }

  /// Profile value wins; a device-only value is uploaded once. A missing column stays local.
  void _syncHeight(String? uid, Map<String, Object?>? profileRow) {
    final key = (uid, profileRow?['height_cm'], profileHasHeightColumn(profileRow));
    if (_heightKey == key) return;
    _heightKey = key;
    final storage = _storage;
    final plan = planHeight(profileRow, readLocalHeight(uid, storage), isHeightSynced(uid, storage));
    _heightCm = plan.height;
    if (plan.writeLocal != null) {
      writeLocalHeight(uid, plan.writeLocal!, storage);
      markHeightSynced(uid, storage);
    }
    if (plan.upload != null && uid != null) {
      unawaited(saveProfileHeight(ref.read(weightRepositoryProvider).update, uid, plan.upload!).then((ok) {
        if (ok) markHeightSynced(uid, storage);
      }));
    }
  }

  void _saveHeight(String? uid, Map<String, Object?>? profileRow) {
    final h = parseDecimal(_heightInput.text);
    if (!isValidHeightCm(h)) {
      setState(() => _heightError = tr('safety_weight_height_invalid', 'Boyu sm ilə daxil edin (120-220)'));
      return;
    }
    final storage = _storage;
    writeLocalHeight(uid, h, storage);
    if (uid != null && profileHasHeightColumn(profileRow)) {
      unawaited(saveProfileHeight(ref.read(weightRepositoryProvider).update, uid, h).then((ok) {
        if (ok) markHeightSynced(uid, storage);
      }));
    }
    setState(() {
      _heightCm = h;
      _heightInput.clear();
      _heightError = null;
    });
  }

  void _fetchAdvice(Object key, int entryCount, String prompt) {
    if (_aiKey == key) return;
    _aiKey = key;
    if (entryCount == 0) return;
    _aiLoading = true;
    unawaited(() async {
      try {
        final res = await ref.read(weightRepositoryProvider).invokeAdvice({
          'messages': [
            {'role': 'user', 'content': prompt},
          ],
          'isWeightAnalysis': true,
          'language': currentLanguage(),
        });
        final data = res.data;
        if (data is Map && res.error == null && mounted) {
          final msg = data['message'] ?? data['content'];
          setState(() => _aiAdvice = msg is String ? msg : null);
        }
      } catch (e) {
        debugPrint('AI advice error: $e');
      } finally {
        if (mounted) setState(() => _aiLoading = false);
      }
    }());
  }

  Future<void> _openAddSheet() async {
    final toast = _toast(context);
    await showPeachSheet<void>(context, icon: AIcons.scale, builder: (ctx) => _AddWeightForm(
          onSave: (weight) async {
            final saved = await ref.read(weightEntriesProvider.notifier).addEntry(weight, toast: toast);
            if (saved == null) return false;
            // Health copy is on → copy the saved record to Apple Health / Health Connect (background).
            ref.read(healthVitalsBackgroundSyncProvider)(ref.read(userStoreProvider).userId);
            return true;
          },
        ));
  }

  Future<void> _confirmReset() async {
    final toast = _toast(context);
    final ok = await showTrashConfirm(
      context,
      title: tr('weighttracker_tarixceni_sifirla_577dd6', 'Tarixçəni sıfırla'),
      text: tr('weighttracker_butun_ceki_qeydleri_silinecek__3a01e1', 'Bütün çəki qeydləri silinəcək. Bu əməliyyat geri qaytarıla bilməz.'),
      cancel: tr('weighttracker_legv_et_b5e49c', 'Ləğv et'),
      confirm: tr('weighttracker_sil', 'Sil'),
    );
    if (ok && mounted) await ref.read(weightEntriesProvider.notifier).deleteAllEntries(toast: toast);
  }

  Future<void> _confirmDelete(String id) async {
    final toast = _toast(context);
    final ok = await ref.read(confirmPromptProvider)(context, tr('weighttracker_bu_qeydi_silmek_isteyirsiniz_c4a2fa', 'Bu qeydi silmək istəyirsiniz?'));
    if (ok && mounted) await ref.read(weightEntriesProvider.notifier).deleteEntry(id, toast: toast);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final entriesState = ref.watch(weightEntriesProvider);
    final entries = entriesState.entries;
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final profileRow = profile?.row;
    final store = ref.watch(userStoreProvider);
    _syncHeight(user?.id, profileRow);

    final isMultiple = profile?.multiplesType != null && profile!.multiplesType!.isNotEmpty && profile.multiplesType != 'single';
    final lifeStage = store.lifeStage;
    final pregData = lifeStage == 'bump' ? store.getPregnancyData() : null;
    final stage = resolveWeightTrackerStage(lifeStage, pregData?.currentWeek);
    final isPregnancy = stage.mode == 'pregnancy';
    final currentWeek = stage.week;
    final trimester = stage.trimester;
    final stats = weightStatsOf(entries, profile?.startWeight);

    final num startWeight = (stats?.startWeight ?? 0) != 0 ? stats!.startWeight : 60;
    final num currentWeight = (stats?.currentWeight ?? 0) != 0 ? stats!.currentWeight : startWeight;
    final num totalGain = (stats?.totalGain ?? 0) != 0 ? stats!.totalGain : 0;

    final num? profileStart = (profile?.startWeight ?? 0) != 0 ? profile!.startWeight : null;
    final num? prePregnancyWeight = profileStart ?? (entries.isNotEmpty ? entries.last.weight : null);
    final bmi = computeBmi(isPregnancy ? prePregnancyWeight : (stats != null ? currentWeight : null), _heightCm);
    final bmiCat = bmiCategory(bmi);
    final anchors = isMultiple ? multipleGainAnchors : singleGainAnchorsFor(bmiCat ?? 'normal');
    ({num min, num max}) recommended = (min: 0, max: 0);
    if (currentWeek != null) {
      final r = interpolateGain(currentWeek, anchors);
      recommended = (min: jsRound(r[0] * 10) / 10, max: jsRound(r[1] * 10) / 10);
    }
    final bmiLabel = switch (bmiCat) {
      'under' => tr('safety_weight_bmi_under', 'arıq'),
      'over' => tr('safety_weight_bmi_over', 'artıq çəki'),
      'obese' => tr('safety_weight_bmi_obese', 'piylənmə'),
      _ => tr('safety_weight_bmi_normal', 'normal'),
    };

    // Status → anacan palette (gradient + ink).
    final ({String status, String text, Gradient grad, Color ink}) status;
    if (!stage.showGainRange) {
      final trend = weightTrend(totalGain);
      status = trend == 'up'
          ? (status: 'high', text: tr('weighttracker_trend_up', 'Artır'), grad: a.gradPeach, ink: a.accentInk)
          : trend == 'down'
              ? (status: 'low', text: tr('weighttracker_trend_down', 'Azalır'), grad: a.gradBlue, ink: a.blueInk)
              : (status: 'normal', text: tr('weighttracker_trend_stable', 'Sabit'), grad: a.gradGreen, ink: a.greenInk);
    } else if (totalGain < recommended.min) {
      status = (status: 'low', text: tr('weighttracker_status_low', 'Az'), grad: a.gradYellow, ink: a.warnInk);
    } else if (totalGain > recommended.max) {
      status = (status: 'high', text: tr('weighttracker_cox_72c890', 'Çox'), grad: a.gradPink, ink: a.berryInk);
    } else {
      status = (status: 'normal', text: tr('weighttracker_status_normal', 'Normal'), grad: a.gradGreen, ink: a.greenInk);
    }

    final aiKey = (entries.length, stage.mode, currentWeek, totalGain, recommended.min, recommended.max);
    _fetchAdvice(
      aiKey,
      entries.length,
      buildWeightAiPrompt(
        WeightPromptInput(stage: stage, startWeight: startWeight, currentWeight: currentWeight, change: totalGain, statusText: status.text, recommended: recommended, bmi: bmi),
        WeightPromptCopy(
          prefix: tr('weighttracker_ai_prompt_prefix', 'Çəki analizi:'),
          week: tr('weighttracker_ai_prompt_week', 'həftə'),
          start: tr('weighttracker_ai_prompt_start', 'başlanğıc:'),
          now: tr('weighttracker_ai_prompt_now', 'indi:'),
          gain: tr('weighttracker_ai_prompt_gain', 'artım:'),
          change: tr('weighttracker_ai_prompt_change', 'dəyişiklik:'),
          rec: tr('weighttracker_ai_prompt_rec', 'tövsiyə:'),
          status: tr('weighttracker_ai_prompt_status', 'Status:'),
          rules: tr('safety_weight_ai_rules', 'QAYDALAR: 1) Salamlama yoxdur, birbaşa məsələyə keç. 2) Maksimum 1-2 cümlə. 3) Yalnız praktik qısa məsləhət.'),
          contextPregnancyUnknownWeek: tr('weighttracker_ai_context_pregnant_unknown', 'İstifadəçi hamilədir, hamiləlik həftəsi məlum deyil.'),
          contextCycle: tr('weighttracker_ai_context_cycle', 'İstifadəçi hamilə deyil, menstrual tsiklini izləyir.'),
          contextPostpartum: tr('weighttracker_ai_context_postpartum', 'İstifadəçi doğuşdan sonrakı dövrdədir, hamilə deyil.'),
        ),
      ),
    );

    // Pregnancy week chart (IOM band).
    final lmp = pregData?.lastPeriodDate;
    List<({int week, num bandMin, num bandMax, num? weight})>? chartData;
    if (stage.showGainRange && lmp != null && entries.length >= 2) {
      final weekWeight = <int, num>{};
      for (final e in entries.reversed) {
        final d = parseJsDate(e.entryDate);
        if (d == null) continue;
        final wk = (differenceInDaysFns(d, lmp) / 7).floor();
        if (wk >= 0 && wk <= 42) weekWeight[wk] = e.weight;
      }
      if (weekWeight.isNotEmpty) {
        chartData = [
          for (var wk = 4; wk <= 42; wk++)
            () {
              final g = interpolateGain(wk, anchors);
              return (week: wk, bandMin: jsRound((startWeight + g[0]) * 10) / 10, bandMax: jsRound((startWeight + g[1]) * 10) / 10, weight: weekWeight[wk]);
            }(),
        ];
      }
    }

    final eyebrow = currentWeek != null && trimester != null
        ? '${weekOrdinal(currentWeek)} · ${trimesterOrdinal(trimester)}'
        : stage.mode == 'postpartum'
            ? tr('weighttracker_eyebrow_postpartum', 'Doğuşdan sonra')
            : null;

    Widget heightForm() => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(children: [
            Expanded(
              child: SizedBox(
                height: 44,
                child: _Field(
                  controller: _heightInput,
                  placeholder: tr('safety_weight_height_placeholder', 'Boy, sm'),
                  onChanged: (_) {
                    if (_heightError != null) setState(() => _heightError = null);
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: AButton(
                key: const ValueKey('weight-height-save'),
                variant: AButtonVariant.pillSoft,
                onPressed: () => _saveHeight(user?.id, profileRow),
                child: Text(tr('weighttracker_yadda_saxla', 'Yadda saxla')),
              ),
            ),
          ]),
        );
    Widget heightError() => _heightError == null
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Semantics(liveRegion: true, child: Text(_heightError!, style: x.aListSub.copyWith(color: a.coralText))),
          );

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: eyebrow,
          title: tr('weighttracker_ceki_i_zleyici_9dfe43', 'Çəki İzləyici'),
          actions: [
            PTap(
              scale: 0.9,
              onTap: _openAddSheet,
              child: Container(
                key: const ValueKey('weight-add'),
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(12)),
                child: const AIcon(AIcons.plus, size: 17, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
              ),
            ),
          ],
        ),
        PTrio(children: [
          PTrioItem(icon: AIcons.scale, iconGradient: a.gradPeach, iconColor: a.accentInk, value: _n(currentWeight), label: tr('weighttracker_hazirki_kg_426054', 'Hazırkı (kg)')),
          PTrioItem(
            icon: AIcons.activity,
            iconGradient: a.gradBlue,
            iconColor: a.blueInk,
            value: '${totalGain >= 0 ? '+' : ''}${_fixed1(totalGain)}',
            label: tr('weighttracker_ferq_kg_8bd06d', 'Fərq (kg)'),
          ),
          stage.showGainRange
              ? PTrioItem(
                  icon: AIcons.target,
                  iconGradient: a.gradLav,
                  iconColor: a.lavInk,
                  value: '${_n(recommended.min)}-${_n(recommended.max)}',
                  label: isMultiple ? tr('weighttracker_tovsiye_kg_ekiz', 'Tövsiyə (kg) · əkiz üçün') : tr('weighttracker_tovsiye_kg_6a77a1', 'Tövsiyə (kg)'),
                )
              : PTrioItem(
                  icon: AIcons.target,
                  iconGradient: a.gradLav,
                  iconColor: a.lavInk,
                  value: !isPregnancy && bmi != null ? _fixed1(bmi) : '–',
                  label: isPregnancy ? tr('weighttracker_tovsiye_kg_6a77a1', 'Tövsiyə (kg)') : tr('weighttracker_bmi_label', 'BMI'),
                ),
        ]),
        const SizedBox(height: 12),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: status.grad, borderRadius: BorderRadius.circular(13)),
                child: AIcon(
                  status.status == 'normal' ? AIcons.minus : (status.status == 'low' ? AIcons.trendingDown : AIcons.trendingUp),
                  size: 19,
                  strokeWidth: 2.2,
                  color: status.ink,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(upperCss(tr('weighttracker_ceki_statusu_d932ab', 'Çəki statusu')), style: todayInfoEyebrow(context)),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(status.text, key: const ValueKey('weight-status'), style: x.heading(px(19, color: a.ink))),
                  ),
                  Text(
                    '${tr('weighttracker_baslangic_ef1964', 'Başlanğıc:')} ${_n(startWeight)} kg → ${tr('weighttracker_indi_eef', 'Cari:')} ${_n(currentWeight)} kg',
                    style: x.aListSub,
                  ),
                ]),
              ),
            ]),
            if (isPregnancy && !stage.showGainRange)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  tr('weighttracker_week_unknown', 'Hamiləlik həftəniz məlum deyil. Tövsiyə olunan artım aralığını görmək üçün profildə son aybaşı tarixini yazın.'),
                  style: x.aListSub,
                ),
              ),
            if (!isPregnancy)
              if (bmi != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(formatTr('weighttracker_bmi_now', 'Hazırkı BMI {bmi} ({category})', {'bmi': _fixed1(bmi), 'category': bmiLabel}), style: x.aListSub),
                )
              else if (stats != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(tr('weighttracker_height_for_bmi', 'BMI hesablamaq üçün boyunuzu yazın.'), style: x.aListSub),
                    heightForm(),
                    heightError(),
                  ]),
                ),
            if (stage.mode == 'postpartum')
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  tr('weighttracker_postpartum_note',
                      'Doğuşdan sonra çəki adətən tədricən, bir neçə ay ərzində azalır. Əmizdirərkən sərt pəhrizdən çəkinin, sualınız olarsa həkiminizlə danışın.'),
                  style: x.aListSub,
                ),
              ),
            if (stage.showGainRange && !isMultiple)
              if (bmi != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    formatTr('safety_weight_bmi_basis', 'Hamiləlikdən əvvəlki BMI {bmi} ({category}) üzrə tövsiyə', {'bmi': _fixed1(bmi), 'category': bmiLabel}),
                    style: x.aListSub,
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(
                      prePregnancyWeight != null && prePregnancyWeight != 0
                          ? tr('safety_weight_bmi_missing', 'Boyunuzu yazın ki, aralıq BMI-yə görə hesablansın. Hələlik normal BMI aralığı göstərilir.')
                          : tr('safety_weight_bmi_no_weight', 'Hamiləlikdən əvvəlki çəki yoxdur, normal BMI aralığı göstərilir.'),
                      style: x.aListSub,
                    ),
                    if (prePregnancyWeight != null && prePregnancyWeight != 0) heightForm(),
                    heightError(),
                  ]),
                ),
            if (stage.showGainRange) _rangeBar(context, recommended, totalGain, status.grad),
          ]),
        ),
        PCta(
          marginTop: 12,
          gradient: a.gradGreen,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              PCtaBadge(
                background: a.chipOverlay,
                color: a.greenInk,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.sparkles, size: 11, strokeWidth: 2.4, color: a.greenInk),
                  const SizedBox(width: 6),
                  Text(upperCss(tr('weighttracker_ai_analiz_41639d', 'AI Analiz'))),
                ]),
              ),
              if (_aiLoading) SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: a.greenInk)),
            ]),
            const SizedBox(height: 12),
            Text(
              _aiLoading ? tr('weighttracker_analiz_edilir_e11d27', 'Analiz edilir...') : (_aiAdvice ?? tr('weighttracker_melumat_yuklenir_355722', 'Məlumat yüklənir...')),
              key: const ValueKey('weight-ai-text'),
              style: x.aCtaText.copyWith(color: a.greenInk.withValues(alpha: 0.85), fontWeight: FontWeight.w500),
            ),
          ]),
        ),
        if (chartData != null) _pregnancyChart(context, chartData, currentWeek),
        if (entries.isNotEmpty && chartData == null) _lastSeven(context, entries),
        if (entries.isNotEmpty) _history(context, entries),
        if (stage.showPregnancySafety)
          SafetyStrip(signs: tr('safety_weight_signs', 'Dərhal zəng edin: üz və əllərdə qəfil şişkinlik, güclü baş ağrısı, görmə dəyişikliyi')),
      ]),
    );
  }

  Widget _rangeBar(BuildContext context, ({num min, num max}) recommended, num totalGain, Gradient grad) {
    final a = context.a;
    final x = context.aText;
    final max = recommended.max;
    final fill = max > 0 ? math.min(totalGain / max * 100, 100).toDouble() : 0.0;
    final marker = max > 0 ? (recommended.min / max).toDouble().clamp(0.0, 1.0) : 0.0;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 5),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${_n(recommended.min)} kg', style: x.aListTime),
            Flexible(child: Text(tr('weighttracker_tovsiye_olunan_araliq_4810a8', 'Tövsiyə olunan aralıq'), textAlign: TextAlign.center, style: x.aListValue.copyWith(color: a.inkSoft))),
            Text('${_n(recommended.max)} kg', style: x.aListTime),
          ]),
        ),
        SizedBox(
          height: 8,
          child: LayoutBuilder(builder: (context, c) {
            return Stack(children: [
              Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)))),
              PositionedDirectional(
                start: 0,
                top: 0,
                bottom: 0,
                width: c.maxWidth * (fill < 0 ? 0 : fill) / 100,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  decoration: BoxDecoration(gradient: grad, borderRadius: BorderRadius.circular(999)),
                ),
              ),
              PositionedDirectional(
                start: c.maxWidth * marker - 2,
                top: 0,
                bottom: 0,
                child: Container(width: 2, color: a.green2),
              ),
            ]);
          }),
        ),
      ]),
    );
  }

  Widget _pregnancyChart(BuildContext context, List<({int week, num bandMin, num bandMax, num? weight})> data, int? currentWeek) {
    final a = context.a;
    final kq = tr('unit_kg', 'kq');
    final tickStyle = px(10, color: a.inkSoft);
    final weights = [for (final d in data) if (d.weight != null) FlSpot(d.week.toDouble(), d.weight!.toDouble())];
    final values = [for (final d in data) ...[d.bandMin, d.bandMax], for (final s in weights) s.y];
    final minY = values.reduce((p, n) => p < n ? p : n).floorToDouble() - 1;
    final maxY = values.reduce((p, n) => p > n ? p : n).ceilToDouble() + 1;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ACardHead(
            title: tr('weighttracker_hamilelik_qrafiki', 'Hamiləlik qrafiki'),
            trailing: PTag(background: a.green1, color: a.greenInk, child: Text(tr('weighttracker_tovsiye_zolagi', 'yaşıl = tövsiyə aralığı'))),
          ),
          SizedBox(
            height: 200,
            child: LineChart(
              key: const ValueKey('weight-pregnancy-chart'),
              LineChartData(
                minX: 4,
                maxX: 42,
                minY: minY,
                maxY: maxY,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: a.line))),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 1,
                      reservedSize: 22,
                      getTitlesWidget: (v, meta) => const [8, 16, 24, 32, 40].contains(v.toInt()) && v == v.roundToDouble()
                          ? SideTitleWidget(meta: meta, child: Text('${v.toInt()}h', style: tickStyle))
                          : const SizedBox.shrink(),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 46,
                      getTitlesWidget: (v, meta) => SideTitleWidget(meta: meta, child: Text('${_n(v)}$kq', style: tickStyle)),
                    ),
                  ),
                ),
                extraLinesData: ExtraLinesData(verticalLines: [
                  if (currentWeek != null)
                    VerticalLine(
                      x: currentWeek.toDouble(),
                      color: a.inkFaint,
                      strokeWidth: 1,
                      dashArray: const [4, 4],
                      label: VerticalLineLabel(show: true, alignment: Alignment.topCenter, style: tickStyle, labelResolver: (_) => tr('weighttracker_indi_ref', 'indi')),
                    ),
                ]),
                betweenBarsData: [BetweenBarsData(fromIndex: 0, toIndex: 1, color: kWeightBandColor.withValues(alpha: 0.18))],
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => a.surface,
                    getTooltipItems: (spots) => [
                      for (final s in spots)
                        s.barIndex == 2
                            ? LineTooltipItem('${tr('weighttracker_cekiniz', 'Çəkiniz')}: ${_n(s.y)} $kq', px(12, color: a.ink))
                            : null,
                    ],
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(spots: [for (final d in data) FlSpot(d.week.toDouble(), d.bandMin.toDouble())], color: const Color(0x00000000), barWidth: 0, dotData: const FlDotData(show: false)),
                  LineChartBarData(spots: [for (final d in data) FlSpot(d.week.toDouble(), d.bandMax.toDouble())], color: const Color(0x00000000), barWidth: 0, dotData: const FlDotData(show: false)),
                  LineChartBarData(
                    spots: weights,
                    isCurved: true,
                    preventCurveOverShooting: true,
                    color: a.peach2,
                    barWidth: 2.5,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, _, _, _) => FlDotCirclePainter(radius: 3, color: a.peach2, strokeWidth: 0),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              tr('weighttracker_qrafik_izah', 'Xətt — çəki qeydləriniz, yaşıl zolaq — həftəyə görə tövsiyə olunan artım aralığı (başlanğıc çəkiyə əsasən).'),
              style: px(12, color: a.inkSoft, height: 1.55),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _lastSeven(BuildContext context, List<WeightEntry> entries) {
    final a = context.a;
    final recent = entries.take(7).toList();
    final shown = recent.reversed.toList();
    final maxW = recent.map((e) => e.weight).reduce((p, n) => p > n ? p : n);
    final minW = recent.map((e) => e.weight).reduce((p, n) => p < n ? p : n);
    final range = (maxW - minW) == 0 ? 1 : maxW - minW;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ACardHead(title: tr('weighttracker_son_7_qeyd', 'Son 7 qeyd')),
          SizedBox(
            height: 128,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var i = 0; i < shown.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Tooltip(
                    message: '${_n(shown[i].weight)} kg',
                    child: Container(
                      height: 128 * ((shown[i].weight - minW) / range * 60 + 40) / 100,
                      decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: const BorderRadius.vertical(top: Radius.circular(8), bottom: Radius.circular(4))),
                    ),
                  ),
                ),
              ],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              for (final e in shown)
                Expanded(child: Text(formatDateAz(e.entryDate), textAlign: TextAlign.center, style: px(10, weight: FontWeight.w700, color: a.inkFaint))),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _history(BuildContext context, List<WeightEntry> entries) {
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 96),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(tr('weighttracker_tarixce_b09a14', 'Tarixçə'), style: x.aSectionTitle),
            Builder(
              builder: (btnContext) => GestureDetector(
                key: const ValueKey('weight-history-menu'),
                onTap: () => _openHistoryMenu(btnContext),
                child: const _SmallIconBox(icon: AIcons.ellipsisVertical, iconSize: 14),
              ),
            ),
          ]),
        ),
        ACard(
          variant: ACardVariant.list,
          child: Column(children: [
            for (var i = 0; i < entries.length && i < 10; i++)
              PListRow(
                first: i == 0,
                leading: PListIcon(background: a.peach1, child: AIcon(AIcons.scale, size: 17, strokeWidth: 2, color: a.accentInk)),
                body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${_n(entries[i].weight)} kg', style: x.aListTitle.copyWith(fontSize: 14.5)),
                  const SizedBox(height: 2),
                  Text('${formatDateAz(entries[i].createdAt)}, ${formatTimeAz(entries[i].createdAt)}', style: x.aListSub),
                ]),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (i > 0) ...[_diffTag(context, entries[i].weight, entries[i - 1].weight), const SizedBox(width: 6)],
                  GestureDetector(
                    key: ValueKey('weight-delete-${entries[i].id}'),
                    onTap: () => _confirmDelete(entries[i].id),
                    child: _SmallIconBox(icon: AIcons.trash2, iconSize: 13),
                  ),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }

  /// Radix DropdownMenu (align end) with the destructive "Tarixçəni sıfırla" item.
  Future<void> _openHistoryMenu(BuildContext btnContext) async {
    final box = btnContext.findRenderObject()! as RenderBox;
    final overlay = Overlay.of(btnContext).context.findRenderObject()! as RenderBox;
    final topLeft = box.localToGlobal(Offset(0, box.size.height + 4), ancestor: overlay);
    final bottomRight = box.localToGlobal(box.size.bottomRight(Offset.zero), ancestor: overlay);
    final destructive = btnContext.tokens.shadcn.destructive;
    final picked = await showMenu<String>(
      context: btnContext,
      position: RelativeRect.fromRect(Rect.fromPoints(topLeft, bottomRight), Offset.zero & overlay.size),
      items: [
        PopupMenuItem<String>(
          key: const ValueKey('weight-history-reset'),
          value: 'reset',
          child: Row(children: [
            AIcon(AIcons.rotateCcw, size: 16, color: destructive),
            const SizedBox(width: 8),
            Text(tr('weighttracker_tarixceni_sifirla_577dd6', 'Tarixçəni sıfırla'), style: TextStyle(color: destructive)),
          ]),
        ),
      ],
    );
    if (picked == 'reset' && mounted) await _confirmReset();
  }

  Widget _diffTag(BuildContext context, num weight, num previous) {
    final a = context.a;
    if (weight > previous) return PTag(background: a.green1, color: a.greenInk, child: Text('+${_fixed1(weight - previous)}'));
    if (weight < previous) return PTag(background: a.pink1, color: a.pinkInk, child: Text(_fixed1(weight - previous)));
    return PTag(background: a.surfaceSoft, color: a.inkSoft, child: const Text('0'));
  }
}

/// `.a-icon-btn` at 30×30.
class _SmallIconBox extends StatelessWidget {
  const _SmallIconBox({required this.icon, required this.iconSize});
  final AIconData icon;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: a.btnBorder),
        // `0 6px 14px -8px rgba(217, 108, 74, 0.35)` (.a-icon-btn, anacan-design.css)
        boxShadow: const [BoxShadow(offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8, color: Color(0x59D96C4A))],
      ),
      child: AIcon(icon, size: iconSize, strokeWidth: 2, color: a.ink),
    );
  }
}

/// `.a-input` text field (decimal keyboard).
class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.placeholder, this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    // `.a-input` (13px) loses to keyboard.css's phone rule (16px).
    final style = phoneInputStyle(context, px(13, color: a.ink));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
      child: Material(
        type: MaterialType.transparency,
        child: Semantics(
          label: placeholder,
          child: TextField(
            key: const ValueKey('weight-height-input'),
            controller: controller,
            onChanged: onChanged,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: style,
            cursorColor: a.peach2,
            decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
          ),
        ),
      ),
    );
  }
}

/// The add-weight sheet body (input "65,5" + kg, error line, solid save button).
class _AddWeightForm extends StatefulWidget {
  const _AddWeightForm({required this.onSave});
  final Future<bool> Function(num weight) onSave;

  @override
  State<_AddWeightForm> createState() => _AddWeightFormState();
}

class _AddWeightFormState extends State<_AddWeightForm> {
  final TextEditingController _c = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Accept "65,5" as well as "65.5"; say why instead of silently not saving.
    final weight = parseDecimal(_c.text);
    if (!isValidWeightKg(weight)) {
      setState(() => _error = tr('safety_weight_invalid', 'Çəkini kq ilə daxil edin, məs. 65,5 (30-250)'));
      return;
    }
    setState(() => _error = null);
    final ok = await widget.onSave(weight);
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(tr('weighttracker_ceki_elave_et_252a47', 'Çəki əlavə et'), textAlign: TextAlign.center, style: x.heading(px(18, color: a.ink))),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Text(tr('weighttracker_bugunku_cekinizi_daxil_edin_24f734', 'Bugünkü çəkinizi daxil edin'), textAlign: TextAlign.center, style: x.aListSub),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: PBigInput(
          fieldKey: const ValueKey('weight-input'),
          controller: _c,
          placeholder: '65,5',
          unit: 'kg',
          invalid: _error != null,
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
        ),
      ),
      if (_error != null)
        Transform.translate(
          offset: const Offset(0, -12),
          child: Text(_error!, textAlign: TextAlign.center, style: x.aListSub.copyWith(color: a.coralText)),
        ),
      PTap(
        scale: 0.98,
        onTap: _submit,
        child: Container(
          key: const ValueKey('weight-save'),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const AIcon(AIcons.sparkles, size: 17, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
            const SizedBox(width: 6),
            Text(tr('weighttracker_yadda_saxla', 'Yadda saxla'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
          ]),
        ),
      ),
    ]);
  }
}

/// date-fns `differenceInDays(left, right)`: whole days (truncated towards zero).
int differenceInDaysFns(DateTime left, DateTime right) => (left.difference(right).inMilliseconds / 86400000).truncate();
