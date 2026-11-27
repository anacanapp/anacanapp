// Ported from: src/components/flow/FlowDailyLogger.tsx
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/period_flow.dart';
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

class _Opt<T> {
  const _Opt(this.value, this.label, this.emoji, [this.colors]);
  final T value;
  final String label;
  final String emoji;

  /// (background, border, text) of the selected Tailwind classes.
  final (Color, Color, Color)? colors;
}

List<_Opt<int>> _moodOptions() => [
      _Opt(1, tr('flowdailylogger_cox_pis_e041c5', 'Çox pis'), '😢', (TwColors.red100, TwColors.red300, TwColors.red700)),
      _Opt(2, tr('common_pis', 'Pis'), '😔', (TwColors.orange100, TwColors.orange300, TwColors.orange700)),
      _Opt(3, 'Normal', '😐', (TwColors.yellow100, TwColors.yellow300, TwColors.yellow700)),
      _Opt(4, tr('flowdailylogger_yaxsi_9d8595', 'Yaxşı'), '😊', (TwColors.green100, TwColors.green300, TwColors.green700)),
      _Opt(5, tr('flowdailylogger_ela_720a0e', 'Əla'), '🥰', (TwColors.pink100, TwColors.pink300, TwColors.pink700)),
    ];

List<(int, AIconData, String, Color)> _energyOptions() => [
      (1, AIcons.cloudRain, tr('flowdailylogger_cox_asagi_e45510', 'Çox aşağı'), TwColors.slate400),
      (2, AIcons.meh, tr('flowdailylogger_asagi_1c27f1', 'Aşağı'), TwColors.slate500),
      (3, AIcons.sun, 'Normal', TwColors.yellow500),
      (4, AIcons.zap, tr('flowdailylogger_yuksek_492584', 'Yüksək'), TwColors.orange500),
      (5, AIcons.sparkles, tr('flowdailylogger_cox_yuksek_c4d475', 'Çox yüksək'), TwColors.amber500),
    ];

List<_Opt<String>> _flowOptions() => [
      _Opt('unspecified', tr('flow_had_flow', 'Axın oldu'), '🩸', (TwColors.red100, TwColors.red300, TwColors.red300)),
      _Opt('none', tr('common_yoxdur', 'Yoxdur'), '⚪', (TwColors.slate100, TwColors.red300, TwColors.red300)),
      _Opt('spotting', tr('flowdailylogger_lekelenme_8e7b1e', 'Ləkələnmə'), '🔵', (TwColors.blue100, TwColors.red300, TwColors.red300)),
      _Opt('light', tr('flowdailylogger_yungul_2a8010', 'Yüngül'), '🩸', (TwColors.red100, TwColors.red300, TwColors.red300)),
      _Opt('medium', tr('common_orta', 'Orta'), '🩸🩸', (TwColors.red200, TwColors.red300, TwColors.red300)),
      _Opt('heavy', tr('flowdailylogger_guclu_0fda31', 'Güclü'), '🩸🩸🩸', (TwColors.red300, TwColors.red300, TwColors.red300)),
    ];

List<_Opt<int>> _sleepQuality() => [
      _Opt(1, tr('flowdailylogger_cox_pis_e041c5', 'Çox pis'), '😫'),
      _Opt(2, tr('common_pis', 'Pis'), '😴'),
      _Opt(3, 'Normal', '😐'),
      _Opt(4, tr('flowdailylogger_yaxsi_9d8595', 'Yaxşı'), '😌'),
      _Opt(5, tr('flowdailylogger_ela_720a0e', 'Əla'), '😇'),
    ];

List<_Opt<String>> _mucus() => [
      _Opt('dry', tr('flowdailylogger_mucus_dry', 'Quru'), '🏜️'),
      _Opt('sticky', tr('flowdailylogger_mucus_sticky', 'Yapışqan'), '🍯'),
      _Opt('creamy', tr('flowdailylogger_mucus_creamy', 'Kremvari'), '🥛'),
      _Opt('watery', tr('flowdailylogger_mucus_watery', 'Sulu'), '💧'),
      _Opt('eggwhite', tr('flowdailylogger_mucus_eggwhite', 'Yumurta ağı'), '🥚'),
    ];

List<_Opt<String>> _sex() => [
      _Opt('none', tr('common_yoxdur', 'Yoxdur'), '➖'),
      _Opt('protected', tr('flowdailylogger_sex_protected', 'Qorunmalı'), '🛡️'),
      _Opt('unprotected', tr('flowdailylogger_sex_unprotected', 'Qorunmasız'), '💞'),
    ];

List<_Opt<int>> _libido() => [
      _Opt(1, tr('flowdailylogger_asagi_1c27f1', 'Aşağı'), '🤍'),
      _Opt(2, tr('common_orta', 'Orta'), '💗'),
      _Opt(3, tr('flowdailylogger_yuksek_492584', 'Yüksək'), '❤️‍🔥'),
    ];

List<_Opt<String>> _opk() => [
      _Opt('negative', tr('flowdailylogger_opk_negative', 'Mənfi'), '➖'),
      _Opt('positive', tr('flowdailylogger_opk_positive', 'Müsbət'), '➕'),
      _Opt('peak', tr('flowdailylogger_opk_peak', 'Pik'), '🌟'),
    ];

const _fields = [
  'mood', 'energy_level', 'symptoms', 'pain_level', 'flow_intensity', 'sleep_hours', 'sleep_quality', 'temperature',
  'water_glasses', 'notes', 'cervical_mucus', 'sexual_activity', 'libido', 'ovulation_test',
];

class FlowDailyLogger extends ConsumerStatefulWidget {
  const FlowDailyLogger({super.key, this.date, this.compact = false, this.onSave});
  final DateTime? date;
  final bool compact;
  final VoidCallback? onSave;

  @override
  ConsumerState<FlowDailyLogger> createState() => _FlowDailyLoggerState();
}

class _FlowDailyLoggerState extends ConsumerState<FlowDailyLogger> {
  late bool _expanded = !widget.compact;
  bool _flowEdited = false;
  Map<String, Object?> _form = _blank();
  String? _syncedFrom;
  final _sleep = TextEditingController();
  final _temp = TextEditingController();
  final _notes = TextEditingController();

  static Map<String, Object?> _blank() => {
        'mood': null, 'energy_level': null, 'symptoms': <String>[], 'pain_level': null, 'flow_intensity': null,
        'sleep_hours': null, 'sleep_quality': null, 'temperature': null, 'water_glasses': 0, 'notes': null,
        'cervical_mucus': null, 'sexual_activity': null, 'libido': null, 'ovulation_test': null,
      };

  DateTime get _date => widget.date ?? flowNow();

  Map<String, Object?> _fromExisting(Map<String, dynamic>? log, String? existingFlow) => {
        'mood': log?['mood'],
        'energy_level': log?['energy_level'],
        'symptoms': [...(log?['symptoms'] as List? ?? const [])],
        'pain_level': log?['pain_level'],
        'flow_intensity': existingFlow,
        'sleep_hours': log?['sleep_hours'],
        'sleep_quality': log?['sleep_quality'],
        'temperature': log?['temperature'],
        'water_glasses': (log?['water_glasses'] as num?) ?? 0,
        'notes': log?['notes'],
        'cervical_mucus': log?['cervical_mucus'],
        'sexual_activity': log?['sexual_activity'],
        'libido': log?['libido'],
        'ovulation_test': log?['ovulation_test'],
      };

  static String _numText(Object? v) => v == null ? '' : (v is num && v == v.roundToDouble() ? '${v.toInt()}' : '$v');

  @override
  void dispose() {
    _sleep.dispose();
    _temp.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _set(String key, Object? value) => setState(() => _form = {..._form, key: value});

  Future<void> _save(Map<String, dynamic>? existingLog) async {
    final toast = flowToast(context);
    final payload = <String, Object?>{'log_date': ymd(_date), ..._form};
    if (!_flowEdited) payload.remove('flow_intensity');
    try {
      await ref.read(saveFlowDailyLogMutation.notifier).mutateAsync(payload);
      toast?.success(tr('flowdailylogger_gundelik_qeyd_saxlanildi_03bc8a', 'Gündəlik qeyd saxlanıldı!'));
      widget.onSave?.call();
    } catch (_) {
      toast?.error(tr('flowdailylogger_xeta_bas_verdi_f22fba', 'Xəta baş verdi'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final dateStr = ymd(_date);
    final logQ = ref.watch(flowDailyLogQuery(dateStr));
    final existingLog = logQ.data;
    final periodLogs = ref.watch(periodDayLogsQuery(null)).data ?? const <Map<String, dynamic>>[];
    final periodLog = periodLogs.where((l) => l['log_date'] == dateStr).firstOrNull;
    final existingFlow = periodLog != null ? periodFlowLabel(periodLog['flow_intensity']) : existingLog?['flow_intensity'] as String?;
    final symptoms = ref.watch(flowSymptomsQuery).data ?? const <Map<String, dynamic>>[];
    final saving = ref.watch(saveFlowDailyLogMutation).isPending;
    final language = ref.watch(userStoreProvider.select((u) => u.language));

    // useEffect([dateStr, existingLog, existingFlow]) → reset the form.
    final initial = _fromExisting(existingLog, existingFlow);
    final sig = '$dateStr|${jsonEncode(existingLog)}|$existingFlow';
    if (_syncedFrom != sig) {
      _syncedFrom = sig;
      _form = initial;
      _flowEdited = false;
      _sleep.text = _numText(initial['sleep_hours']);
      _temp.text = _numText(initial['temperature']);
      _notes.text = (initial['notes'] as String?) ?? '';
    }
    final hasChanges = jsonEncode([for (final f in _fields) _form[f]]) != jsonEncode([for (final f in _fields) initial[f]]);

    if (logQ.isLoading) {
      return const FlowSkeletonCard(bars: [(height: 48, radius: 14)]);
    }

    final labelStyle = TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w500, color: s.foreground);
    Widget label(String text, {Widget? icon, Widget? extra, double bottom = 12}) => Padding(
          padding: EdgeInsets.only(bottom: bottom),
          child: Row(children: [
            if (icon != null) ...[icon, const SizedBox(width: 8)],
            Flexible(child: Text.rich(TextSpan(text: text, children: [if (extra != null) WidgetSpan(alignment: PlaceholderAlignment.baseline, baseline: TextBaseline.alphabetic, child: extra)]), style: labelStyle)),
          ]),
        );
    Widget hint(String text) => Padding(
          padding: const EdgeInsetsDirectional.only(start: 6),
          child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: a.inkSoft)),
        );

    Widget chip({required bool selected, required String text, required VoidCallback onTap, required Color bg, Color? border, Color? fg, bool flex = false, EdgeInsets padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 8), String? semantics}) {
      final w = AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: padding,
        alignment: flex ? Alignment.center : null,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: border ?? const Color(0x00000000), width: 2)),
        child: Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w500, color: fg)),
      );
      return Semantics(
        button: true,
        toggled: selected,
        label: semantics ?? text,
        excludeSemantics: true,
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: w),
      );
    }

    Widget tile({required bool selected, required Widget top, required String text, required VoidCallback onTap, required Color selBg, required Color selBorder, Color? selFg, double scale = 1.05}) {
      return Expanded(
        child: Semantics(
          button: true,
          toggled: selected,
          label: text,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: AnimatedScale(
              scale: selected ? scale : 1,
              duration: const Duration(milliseconds: 150),
              curve: ACurves.tailwind,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: selected ? selBg : s.muted,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: selected ? selBorder : const Color(0x00000000), width: 2),
                ),
                child: Column(children: [
                  top,
                  const SizedBox(height: 4),
                  Text(text, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, height: 1.5, fontWeight: FontWeight.w500, color: selected ? selFg : null)),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    List<Widget> gap(List<Widget> items, double g) => [for (var i = 0; i < items.length; i++) ...[if (i > 0) SizedBox(width: g), items[i]]];

    final ovu = _form['ovulation_test'];
    final content = Container(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Mood
        label(tr('flowdailylogger_ehval_0457f9', 'Əhval')),
        Row(children: gap([
          for (final o in _moodOptions())
            tile(
              selected: _form['mood'] == o.value,
              top: Text(o.emoji, style: const TextStyle(fontSize: 24, height: 32 / 24)),
              text: o.label,
              onTap: () => _set('mood', o.value),
              selBg: o.colors!.$1,
              selBorder: o.colors!.$2,
              selFg: o.colors!.$3,
            ),
        ], 8)),
        const SizedBox(height: 24),
        // Energy
        label(tr('flowdailylogger_enerji_seviyyesi_961691', 'Enerji Səviyyəsi')),
        Row(children: gap([
          for (final o in _energyOptions())
            tile(
              selected: _form['energy_level'] == o.$1,
              top: AIcon(o.$2, size: 24, color: o.$4),
              text: o.$3,
              onTap: () => _set('energy_level', o.$1),
              selBg: op(s.primary, 0.1),
              selBorder: s.primary,
            ),
        ], 8)),
        const SizedBox(height: 24),
        // Flow intensity
        label(tr('flowdailylogger_qanaxma_e42bdc', 'Qanaxma'), icon: const AIcon(AIcons.droplets, size: 16, color: TwColors.red500)),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final o in _flowOptions())
            chip(
              selected: _form['flow_intensity'] == o.value,
              text: '${o.emoji} ${o.label}',
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              bg: _form['flow_intensity'] == o.value ? o.colors!.$1 : s.muted,
              border: _form['flow_intensity'] == o.value ? TwColors.red300 : null,
              onTap: () => setState(() {
                _flowEdited = true;
                _form = {..._form, 'flow_intensity': o.value};
              }),
            ),
        ]),
        const SizedBox(height: 24),
        // Cervical mucus
        label(tr('flowdailylogger_servikal_maye', 'Servikal maye'), extra: hint('(${tr('flowdailylogger_fertillik_gostericisi', 'fertillik göstəricisi')})')),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final o in _mucus())
            () {
              final sel = _form['cervical_mucus'] == o.value;
              return chip(
                selected: sel,
                text: '${o.emoji} ${o.label}',
                bg: sel ? a.blue1 : a.surfaceSoft,
                fg: sel ? a.blueInk : a.inkSoft,
                border: sel ? a.blue2 : null,
                onTap: () => _set('cervical_mucus', sel ? null : o.value),
              );
            }(),
        ]),
        const SizedBox(height: 24),
        // Ovulation test
        label(tr('flowdailylogger_ovulyasiya_testi', 'Ovulyasiya testi'), extra: hint('(OPK/LH)')),
        Row(children: gap([
          for (final o in _opk())
            Expanded(child: () {
              final sel = ovu == o.value;
              return chip(
                selected: sel,
                flex: true,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                text: '${o.emoji} ${o.label}',
                bg: sel ? a.green1 : a.surfaceSoft,
                fg: sel ? a.greenInk : a.inkSoft,
                border: sel ? a.green2 : null,
                onTap: () => _set('ovulation_test', sel ? null : o.value),
              );
            }()),
        ], 8)),
        if (ovu == 'positive' || ovu == 'peak')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              ovu == 'peak'
                  ? tr('flowdailylogger_opk_peak_hint', '🌟 Pik LH — ovulyasiya təxminən 24 saat ərzində gözlənilir')
                  : tr('flowdailylogger_opk_positive_hint', '➕ LH yüksəlişi — ovulyasiya 24-36 saat ərzində gözlənilir'),
              style: TextStyle(fontSize: 12, height: 16 / 12, color: a.greenInk, fontWeight: FontWeight.w600),
            ),
          ),
        const SizedBox(height: 24),
        // Sexual activity + libido
        label(tr('flowdailylogger_cinsi_elaqe', 'Cinsi əlaqə')),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final o in _sex())
            () {
              final sel = _form['sexual_activity'] == o.value;
              return chip(
                selected: sel,
                text: '${o.emoji} ${o.label}',
                bg: sel ? a.pink1 : a.surfaceSoft,
                fg: sel ? a.pinkInk : a.inkSoft,
                border: sel ? a.pink2 : null,
                onTap: () => _set('sexual_activity', sel ? null : o.value),
              );
            }(),
        ]),
        const SizedBox(height: 16),
        label(tr('flowdailylogger_libido', 'Libido')),
        Row(children: gap([
          for (final o in _libido())
            Expanded(child: () {
              final sel = _form['libido'] == o.value;
              return chip(
                selected: sel,
                flex: true,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                text: '${o.emoji} ${o.label}',
                bg: sel ? a.pink1 : a.surfaceSoft,
                fg: sel ? a.pinkInk : a.inkSoft,
                border: sel ? a.pink2 : null,
                onTap: () => _set('libido', sel ? null : o.value),
              );
            }()),
        ], 8)),
        const SizedBox(height: 24),
        // Pain
        label('${tr('flowdailylogger_agri_seviyyesi_57b383', 'Ağrı Səviyyəsi:')} ${(_form['pain_level'] as num?) ?? 0}/10'),
        ShadSlider(value: ((_form['pain_level'] as num?) ?? 0).toDouble(), max: 10, onChanged: (v) => _set('pain_level', v.round())),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(tr('flowdailylogger_agri_yoxdur_25522a', 'Ağrı yoxdur'), style: TextStyle(fontSize: 12, height: 16 / 12, color: s.mutedForeground)),
            Text(tr('flowdailylogger_cox_agrili_ee7bd3', 'Çox ağrılı'), style: TextStyle(fontSize: 12, height: 16 / 12, color: s.mutedForeground)),
          ]),
        ),
        const SizedBox(height: 24),
        // Symptoms
        label(tr('untranslated_simptomlar_xhm7bx', 'Simptomlar')),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final sym in symptoms)
            () {
              final key = sym['symptom_key'] as String? ?? '';
              final sel = (_form['symptoms'] as List).contains(key);
              final text = '${sym['emoji'] ?? ''} ${language == 'en' ? sym['label'] : (sym['label_az'] ?? sym['label'])}';
              return Semantics(
                button: true,
                toggled: sel,
                label: text,
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: () {
                    final list = [...(_form['symptoms'] as List).cast<String>()];
                    sel ? list.remove(key) : list.add(key);
                    _set('symptoms', list);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: sel ? s.primary : s.muted, borderRadius: BorderRadius.circular(999)),
                    child: Text(text, style: TextStyle(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w500, color: sel ? s.primaryForeground : s.mutedForeground)),
                  ),
                ),
              );
            }(),
        ]),
        const SizedBox(height: 24),
        // Sleep
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              label(tr('flowdailylogger_yuxu_saat_33bd1e', 'Yuxu (saat)'), icon: const AIcon(AIcons.moon, size: 16, color: TwColors.indigo500), bottom: 8),
              ShadInput(
                controller: _sleep,
                placeholder: '7.5',
                textAlign: TextAlign.center,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: (v) => _set('sleep_hours', v.isEmpty ? null : double.tryParse(v)),
              ),
            ]),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              label(tr('flowdailylogger_yuxu_keyfiyyeti_0bb5f7', 'Yuxu Keyfiyyəti'), bottom: 8),
              Row(children: gap([
                for (final o in _sleepQuality())
                  Expanded(
                    child: Semantics(
                      button: true,
                      toggled: _form['sleep_quality'] == o.value,
                      label: o.label,
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: () => _set('sleep_quality', o.value),
                        child: AnimatedScale(
                          scale: _form['sleep_quality'] == o.value ? 1.1 : 1,
                          duration: const Duration(milliseconds: 150),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _form['sleep_quality'] == o.value ? dk(context, TwColors.indigo100, op(TwColors.indigo900, 0.3)) : null,
                              borderRadius: BorderRadius.circular(TwRadius.lg),
                            ),
                            child: Text(o.emoji, style: const TextStyle(fontSize: 18, height: 28 / 18)),
                          ),
                        ),
                      ),
                    ),
                  ),
              ], 4)),
            ]),
          ),
        ]),
        const SizedBox(height: 24),
        // Temperature
        label(tr('flowdailylogger_beden_temperaturu_c_527103', 'Bədən Temperaturu (°C)'), icon: const AIcon(AIcons.thermometer, size: 16, color: TwColors.red500), bottom: 8),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: SizedBox(
            width: 150,
            child: ShadInput(
              controller: _temp,
              placeholder: '36.6',
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (v) => _set('temperature', v.isEmpty ? null : double.tryParse(v)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(tr('flowdailylogger_bbt_olcme_zamani_deqiq_netice__7b2954', 'BBT ölçmə zamanı dəqiq nəticə üçün səhər yuxudan durduqda ölçün'),
              style: TextStyle(fontSize: 12, height: 16 / 12, color: s.mutedForeground)),
        ),
        const SizedBox(height: 24),
        // Notes
        label(tr('flowdailylogger_qeydler_a7a98b', 'Qeydlər'), bottom: 8),
        ShadInput(
          controller: _notes,
          maxLines: 3,
          minHeight: 80,
          placeholder: tr('flowdailylogger_bu_gun_haqqinda_qeydlerinizi_yazin_eca8f7', 'Bu gün haqqında qeydlərinizi yazın...'),
          onChanged: (v) => _set('notes', v.isEmpty ? null : v),
        ),
        const SizedBox(height: 24),
        ShadButton(
          label: saving
              ? tr('flowdailylogger_saxlanilir_ee05ad', 'Saxlanılır...')
              : existingLog != null
                  ? tr('flowdailylogger_yenile_570ce2', 'Yenilə')
                  : tr('flowdailylogger_saxla_7dcde1', 'Saxla'),
          // bg-gradient-to-r from-[#FF7A7E] to-[#FF5A5F] (FlowDailyLogger.tsx save button literal)
          gradient: const LinearGradient(colors: [Color(0xFFFF7A7E), Color(0xFFFF5A5F)]),
          foreground: TwColors.white,
          onPressed: saving || !hasChanges ? null : () => _save(existingLog),
        ),
      ]),
    );

    return AFadeIn(
      child: ACard(
        padding: EdgeInsets.zero,
        variant: ACardVariant.list,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Semantics(
            button: true,
            expanded: _expanded,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                child: Row(children: [
                  AListIcon(
                    background: const Color(0x00000000),
                    child: DecoratedBox(
                      decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
                      child: SizedBox(width: 40, height: 40, child: Center(child: AIcon(AIcons.heart, size: 17, color: a.berryInk))),
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('flowdailylogger_gundelik_qeyd_32e154', 'Gündəlik Qeyd'), style: context.aText.aListTitle),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text(formatDatePattern(_date, 'd MMMM, EEEE'), style: context.aText.aListSub)),
                    ]),
                  ),
                  const SizedBox(width: 13),
                  if (existingLog != null) ...[
                    ATag(on: true, child: Row(mainAxisSize: MainAxisSize.min, children: [const AIcon(AIcons.check, size: 11), const SizedBox(width: 4), Text(tr('flowdailylogger_doldurulub', 'Doldurulub'))])),
                    const SizedBox(width: 8),
                  ],
                  AIcon(_expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 17, color: a.inkFaint),
                ]),
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: ACurves.framerDefault,
            alignment: Alignment.topCenter,
            child: _expanded ? content : const SizedBox(width: double.infinity),
          ),
        ]),
      ),
    );
  }
}
