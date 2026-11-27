// Ported from: src/components/tools/BloodSugarTracker.tsx
//
// Blood sugar (`blood-sugar`, section of the blood-pressure host): pregnancy targets, per-device mg/dL ↔ mmol/L,
// hypo advice for a recent low reading, repeated-high hint, readings list and the add modal.
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../../legal/medical_disclaimer.dart';
import '../../settings/data/health_service.dart' show healthServiceProvider;
import '../../settings/ui/settings_ui.dart' show AIconBtn, px;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'blood_sugar.dart';
import 'bs_data.dart';

class _Type {
  const _Type(this.id, this.label, this.emoji);
  final String id;
  final String label;
  final String emoji;
}

List<_Type> _readingTypes() => [
      _Type('fasting', tr('bloodsugartracker_acliq_b6d5ee', 'Aclıq'), '🌅'),
      _Type('before_meal', tr('bloodsugartracker_yemekden_evvel_167a3d', 'Yeməkdən əvvəl'), '🍽️'),
      _Type(afterMeal1h, tr('clinical_bs_after_1h', 'Yeməkdən 1 saat sonra'), '⏱️'),
      // 'after_meal' keeps its original meaning: 2 hours after a meal (older rows stay valid).
      _Type('after_meal', tr('bloodsugartracker_yemekden_2_saat_sonra_c59165', 'Yeməkdən 2 saat sonra'), '⏰'),
      _Type('bedtime', tr('bloodsugartracker_yatmazdan_evvel_a457fa', 'Yatmazdan əvvəl'), '🌙'),
      _Type('random', tr('bloodsugartracker_tesadufi_98c20c', 'Təsadüfi'), '📊'),
    ];

List<_Type> _mealContexts() => [
      _Type('breakfast', tr('bloodsugartracker_seher_yemeyi_b82929', 'Səhər yeməyi'), '🥞'),
      _Type('lunch', tr('bloodsugartracker_nahar', 'Nahar'), '🍲'),
      _Type('dinner', tr('bloodsugartracker_sam_yemeyi_6002e9', 'Şam yeməyi'), '🍛'),
      _Type('snack', tr('bloodsugartracker_qelyanalti_42fb71', 'Qəlyanaltı'), '🍎'),
    ];

/// `getReadingStatus`: label + palette of a reading.
({String status, String label, Color ink, Color bg}) readingStatus(ATokens a, num value, String type) {
  final status = glucoseStatus(value, type);
  if (status == 'low') return (status: status, label: tr('bloodsugartracker_asagi_1c27f1', 'Aşağı'), ink: a.blueInk, bg: a.blue1);
  if (status == 'high') return (status: status, label: tr('clinical_bs_above_target', 'Hədəfdən yuxarı'), ink: a.pinkInk, bg: a.pink1);
  return (status: status, label: tr('clinical_bs_in_target', 'Hədəfdə'), ink: a.greenInk, bg: a.green1);
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.value, required this.type});
  final num value;
  final String type;
  @override
  Widget build(BuildContext context) {
    final s = readingStatus(context.a, value, type);
    return APill(s.label, background: s.bg, color: s.ink);
  }
}

num _num(Object? v) => v is num ? v : num.tryParse('$v') ?? double.nan;

class BloodSugarTracker extends ConsumerStatefulWidget {
  const BloodSugarTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BloodSugarTracker> createState() => _BloodSugarTrackerState();
}

class _BloodSugarTrackerState extends ConsumerState<BloodSugarTracker> {
  late GlucoseUnit _unit = loadGlucoseUnit(ref.read(localStoreProvider));
  final _reading = TextEditingController();
  final _notes = TextEditingController();
  String _type = 'random';
  String? _meal;
  bool _pending = false;

  @override
  void dispose() {
    _reading.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _setUnit(GlucoseUnit u) {
    setState(() => _unit = u);
    saveGlucoseUnit(ref.read(localStoreProvider), u);
  }

  String _formatDay(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    if (day == today) return tr('bloodsugartracker_bu_gun_786fd4', 'Bu gün');
    if (day == today.subtract(const Duration(days: 1))) return tr('bloodsugartracker_dunen_52b701', 'Dünən');
    return formatDatePattern(d, 'd MMM');
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final q = ref.watch(bloodSugarLogsQuery);
    final logs = q.data ?? const <Map<String, dynamic>>[];
    final now = DateTime.now();
    DateTime? at(Map<String, dynamic> l) => DateTime.tryParse('${l['logged_at']}')?.toLocal();
    final todayLogs = logs.where((l) {
      final d = at(l);
      return d != null && d.year == now.year && d.month == now.month && d.day == now.day;
    }).toList();
    final weekStart = now.subtract(const Duration(days: 7));
    final weekLogs = logs.where((l) => !(at(l)?.isBefore(weekStart) ?? true)).toList();
    num? avg(List<Map<String, dynamic>> list) =>
        list.isEmpty ? null : ((list.fold<num>(0, (s, l) => s + _num(l['reading_value'])) / list.length) + 0.5).floor();
    final avgToday = avg(todayLogs);
    final avgWeek = avg(weekLogs);
    final latest = logs.firstOrNull;
    final latestAt = latest == null ? null : at(latest);
    final latestLow = latest != null && _num(latest['reading_value']) < hypoMgdl && latestAt != null && now.difference(latestAt).inMilliseconds < 6 * 3600000;
    final repeatedHighs = hasRepeatedHighs(logs);
    final types = _readingTypes();
    final meals = _mealContexts();
    String withUnit(num? v) => v != null && v != 0 ? '${formatGlucose(v, _unit)} ${unitLabel(_unit)}' : '—';

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('bloodsugartracker_seviyyeni_izleyin_1b70d5', 'Səviyyəni izləyin'),
          title: tr('bloodsugartracker_qan_sekeri_b9a2cc', 'Qan Şəkəri'),
          actions: [
            AIconBtn(
              semanticLabel: tr('a11y_add', 'Əlavə et'),
              background: a.peach2,
              foreground: const Color(0xFFFFFFFF),
              border: false,
              onTap: () => _openAdd(types, meals),
              icon: const AIcon(AIcons.plus, size: 17, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
            ),
          ],
        ),
        const MedicalDisclaimer(variant: MedicalDisclaimerVariant.compact),
        const SizedBox(height: 12),
        AGridCols(columns: 2, children: [
          AStatTileBox(
            icon: AStatIcon(icon: AIcons.droplet, gradient: a.gradPink, color: a.berryInk),
            label: tr('bloodsugartracker_bu_gun_orta_96f2fa', 'Bu gün orta'),
            value: withUnit(avgToday),
          ),
          AStatTileBox(
            icon: AStatIcon(icon: AIcons.trendingUp, gradient: a.gradPeach, color: a.accentInk),
            label: tr('bloodsugartracker_heftelik_orta_f3a738', 'Həftəlik orta'),
            value: withUnit(avgWeek),
            extra: '${weekLogs.length} ${tr('bloodsugartracker_olcme_6aff0d', 'ölçmə')}',
          ),
        ]),
        const SizedBox(height: 12),
        Semantics(
          label: tr('clinical_bs_unit', 'Ölçü vahidi'),
          container: true,
          child: Row(children: hgap(6, [
            for (final u in const ['mgdl', 'mmol'])
              Expanded(
                child: Semantics(
                  inMutuallyExclusiveGroup: true,
                  checked: _unit == u,
                  button: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _setUnit(u),
                    child: Container(
                      key: ValueKey('bs-unit-$u'),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _unit == u ? a.tagOnBg : a.surfaceSoft,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: _unit == u ? a.peach2 : a.line, width: 1.5),
                      ),
                      child: Text(unitLabel(u), style: px(12.5, weight: FontWeight.w700, color: a.ink)),
                    ),
                  ),
                ),
              ),
          ])),
        ),
        if (latestLow) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: AAlertCard(
              key: const ValueKey('bs-hypo'),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                AIcon(AIcons.triangleAlert, size: 16, color: a.alertInk),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    formatTr('clinical_bs_hypo_advice',
                        '{value}-dən aşağı (hipoqlikemiya): 15 q tez şəkər yeyin və ya için (məsələn, yarım stəkan meyvə şirəsi), 15 dəqiqə sonra yenidən ölçün. Yenə aşağıdırsa, təkrarlayın və həkiminizə müraciət edin.',
                        {'value': thresholdText(hypoMgdl, _unit)}),
                    style: AAlertCard.text(context),
                  ),
                ),
              ]),
            ),
          ),
        ],
        if (repeatedHighs) ...[
          const SizedBox(height: 12),
          AInfoTip(
            key: const ValueKey('bs-repeated'),
            icon: AIcons.triangleAlert,
            background: a.yellow1,
            color: a.warnInk,
            child: Text(tr('clinical_bs_repeated_high', 'Bir neçə ölçmə hədəfdən yuxarıdır. Həkiminizə müraciət edin.')),
          ),
        ],
        const SizedBox(height: 12),
        AInfoTip(
          icon: AIcons.triangleAlert,
          child: Text.rich(TextSpan(children: [
            TextSpan(text: tr('clinical_bs_targets_title', 'Hamiləlikdə hədəflər:'), style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: '\n• ${formatTr('clinical_bs_target_fasting', 'Aclıq: {value}-dən aşağı', {'value': thresholdText(targetsMgdl.fasting, _unit)})}'),
            TextSpan(text: '\n• ${formatTr('clinical_bs_target_1h', 'Yeməkdən 1 saat sonra: {value}-dən aşağı', {'value': thresholdText(targetsMgdl.after1h, _unit)})}'),
            TextSpan(text: '\n• ${formatTr('clinical_bs_target_2h', 'Yeməkdən 2 saat sonra: {value}-dən aşağı', {'value': thresholdText(targetsMgdl.after2h, _unit)})}'),
            TextSpan(
                text:
                    '\n• ${formatTr('clinical_bs_hypo_short', '{value}-dən aşağı: 15 q tez şəkər, 15 dəqiqə sonra yenidən ölçün.', {'value': thresholdText(hypoMgdl, _unit)})}'),
            TextSpan(text: '\n• ${tr('clinical_bs_repeat_high_short', 'Təkrarlanan yüksək nəticələr: həkiminizə müraciət edin.')}'),
          ])),
        ),
        const SizedBox(height: 22),
        ASectionHeadRow(
          title: tr('bloodsugartracker_son_olcmeler_b024cf', 'Son ölçmələr'),
          trailing: Text('${logs.length}', style: context.aText.aSectionLink),
        ),
        if (q.isLoading)
          vgap(10, [
            for (var i = 0; i < 3; i++)
              APulse(child: ACard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [ABar(height: 14, widthFactor: 0.33), SizedBox(height: 8), ABar(height: 20, widthFactor: 0.25)]))),
          ])
        else if (logs.isEmpty)
          ToolEmpty(
            icon: AIcon(AIcons.droplet, size: 26, color: a.pink2),
            title: tr('bloodsugartracker_hele_hec_bir_qeyd_yoxdur_463107', 'Hələ heç bir qeyd yoxdur'),
            text: tr('bloodsugartracker_ilk_olcmenizi_elave_edin_c94d74', 'İlk ölçmənizi əlavə edin'),
          )
        else
          AListCardBox(children: [
            for (var i = 0; i < logs.length; i++) _row(context, logs[i], i == 0, types, meals),
          ]),
      ]),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> log, bool first, List<_Type> types, List<_Type> meals) {
    final a = context.a;
    final value = _num(log['reading_value']);
    final type = '${log['reading_type']}';
    final status = readingStatus(a, value, type);
    final typeInfo = types.where((t) => t.id == type).firstOrNull;
    final meal = meals.where((m) => m.id == log['meal_context']).firstOrNull;
    final at = DateTime.tryParse('${log['logged_at']}')?.toLocal();
    final notes = log['notes'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          AListIconBox(background: status.bg, child: Text(typeInfo?.emoji ?? '📊', style: const TextStyle(fontSize: 17))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Text(formatGlucose(value, _unit), style: AStyles.listTitle(context)),
                Text(unitLabel(_unit), style: AStyles.listTime(context)),
                _StatusTag(value: value, type: type),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('${typeInfo?.label ?? ''}${meal != null ? ' · ${meal.emoji} ${meal.label}' : ''}', style: AStyles.listSub(context)),
              ),
            ]),
          ),
          const SizedBox(width: 6),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(at == null ? '' : _formatDay(at), style: AStyles.listValue(context)),
            Padding(padding: const EdgeInsets.only(top: 1), child: Text(at == null ? '' : formatDatePattern(at, 'HH:mm'), style: AStyles.listTime(context))),
          ]),
          const SizedBox(width: 6),
          AIconBtn(
            size: 30,
            semanticLabel: tr('common_sil', 'Sil'),
            onTap: () => _delete('${log['id']}'),
            icon: const AIcon(AIcons.trash2, size: 13),
          ),
        ]),
        if (notes is String && notes.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('📝 $notes', style: AStyles.listTime(context))),
      ]),
    );
  }

  Future<void> _delete(String id) async {
    final toasts = AToastHost.of(context);
    try {
      await ref.read(bloodSugarActionsProvider).delete(id);
      toasts.show(title: tr('common_silindi', 'Silindi'), description: tr('bloodsugartracker_qeyd_silindi', 'Qeyd silindi'));
    } catch (_) {}
  }

  void _openAdd(List<_Type> types, List<_Type> meals) {
    showToolDialog<void>(
      context,
      showClose: false,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        void update(VoidCallback f) {
          setState(f);
          setLocal(() {});
        }

        return _addContent(ctx, types, meals, update);
      }),
    );
  }

  Widget _addContent(BuildContext context, List<_Type> types, List<_Type> meals, void Function(VoidCallback) update) {
    final a = context.a;
    final parsed = parseGlucoseInput(_reading.text, _unit);
    final style = px(22, weight: FontWeight.w800, color: a.ink, height: 1.2);
    Widget label(String text) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(text, style: AStyles.statLabel(context)));
    Widget option(_Type t, bool on, VoidCallback onTap, {bool column = false}) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            padding: EdgeInsets.all(column ? 7 : 9),
            decoration: BoxDecoration(
              color: on ? a.tagOnBg : a.surfaceSoft,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: on ? a.peach2 : a.line, width: 1.5),
            ),
            child: column
                ? Column(children: [
                    Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(t.emoji, style: const TextStyle(fontSize: 18, height: 28 / 18))),
                    Text(t.label, textAlign: TextAlign.center, style: px(9, weight: FontWeight.w600, color: a.ink, height: 1.2)),
                  ])
                : Row(children: [
                    Text(t.emoji, style: const TextStyle(fontSize: 16, height: 24 / 16)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t.label, style: px(11.5, weight: FontWeight.w600, color: a.ink))),
                  ]),
          ),
        );
    final showMeal = _type == 'before_meal' || _type == 'after_meal' || _type == afterMeal1h;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(children: [
            Expanded(child: Text(tr('bloodsugartracker_yeni_olcme_cc2042', 'Yeni ölçmə'), style: AStyles.cardTitle(context, size: 16))),
            AIconBtn(size: 32, semanticLabel: tr('common_close', 'Bağla'), onTap: () => Navigator.of(context).pop(), icon: const AIcon(AIcons.x, size: 15)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            label(formatTr('clinical_bs_level_unit', 'Qan şəkəri səviyyəsi ({unit})', {'unit': unitLabel(_unit)})),
            Material(
              type: MaterialType.transparency,
              child: Container(
                height: 52,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
                child: TextField(
                  key: const ValueKey('bs-reading'),
                  controller: _reading,
                  onChanged: (_) => update(() {}),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                  textAlign: TextAlign.center,
                  style: style,
                  cursorColor: a.peach2,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: formatTr('clinical_bs_example', 'Məsələn: {n}', {'n': _unit == 'mmol' ? '5.0' : '90'}),
                    hintStyle: style.copyWith(color: a.inkFaint),
                  ),
                ),
              ),
            ),
            if (parsed != null) Padding(padding: const EdgeInsets.only(top: 8), child: Center(child: _StatusTag(value: parsed, type: _type))),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            label(tr('bloodsugartracker_olcme_novu_0d8219', 'Ölçmə növü')),
            AGridCols(columns: 2, gap: 6, children: [for (final t in types) option(t, _type == t.id, () => update(() => _type = t.id))]),
          ]),
        ),
        if (showMeal)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              label(tr('bloodsugartracker_yemek_b1fd56', 'Yemək')),
              AGridCols(columns: 4, gap: 6, children: [
                for (final m in meals) option(m, _meal == m.id, () => update(() => _meal = _meal == m.id ? null : m.id), column: true),
              ]),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            label(tr('bloodsugartracker_qeyd_isteye_bagli_96c689', 'Qeyd (istəyə bağlı)')),
            ATextArea(controller: _notes, height: 64, placeholder: tr('bloodsugartracker_elave_qeydler_c55f23', 'Əlavə qeydlər...')),
          ]),
        ),
        APillButton(
          kind: APillKind.solid,
          label: _pending ? tr('bloodsugartracker_elave_edilir_3c28b4', 'Əlavə edilir...') : tr('bloodsugartracker_qeyd_et_3c7a2d', 'Qeyd et'),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          expand: true,
          disabledOpacity: 0.45,
          onTap: parsed == null || _pending ? null : () => _add(context, parsed, update),
        ),
      ]),
    );
  }

  Future<void> _add(BuildContext dialogContext, num mgdl, void Function(VoidCallback) update) async {
    final toasts = AToastHost.of(context);
    update(() => _pending = true);
    try {
      await ref.read(bloodSugarActionsProvider).add(mgdl: mgdl, readingType: _type, mealContext: _meal, notes: _notes.text);
      // Health copy on → copy the saved record to Apple Health / Health Connect (background, no duplicates).
      ref.read(healthServiceProvider).syncVitalsInBackground(ref.read(userStoreProvider).userId);
      if (!mounted) return;
      setState(() {
        _pending = false;
        _reading.clear();
        _type = 'random';
        _meal = null;
        _notes.clear();
      });
      if (dialogContext.mounted) Navigator.of(dialogContext).pop();
      toasts.show(title: tr('bloodsugartracker_qeyd_elave_edildi_c5012e', 'Qeyd əlavə edildi'), description: tr('bloodsugartracker_qan_sekeri_seviyyesi_ugurla_qeyd_edildi_cb5736', 'Qan şəkəri səviyyəsi uğurla qeyd edildi'));
    } catch (_) {
      if (mounted) update(() => _pending = false);
      toasts.show(title: tr('bloodsugartracker_xeta_3cdbb6', 'Xəta'), description: tr('bloodsugartracker_qeyd_elave_edile_bilmedi_c1e5e5', 'Qeyd əlavə edilə bilmədi'), destructive: true);
    }
  }
}
