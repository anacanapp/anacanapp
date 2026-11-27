// Ported from: src/components/tools/MoodDiary.tsx
//
// Mood diary (`mood`, section of the mental-health host): today's mood / symptoms / bleeding / notes saved as a merge
// patch of `daily_logs` (offline outbox), history of the last entries and a weekly trend.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/count_format.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../state/user_store.dart';
import '../../legal/medical_disclaimer.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../data/dynamic_config.dart' show moodOptionsQuery, symptomsQuery;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'mood_colors.dart';
import 'mood_diary_form.dart';

class _Mood {
  const _Mood(this.value, this.emoji, this.label, this.tone);
  final int value;
  final String emoji;
  final String label;
  final MoodTone tone;
}

class _Option {
  const _Option(this.id, this.label, this.emoji);
  final String id;
  final String label;
  final String emoji;
}

class MoodDiary extends ConsumerStatefulWidget {
  const MoodDiary({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<MoodDiary> createState() => _MoodDiaryState();
}

class _MoodDiaryState extends ConsumerState<MoodDiary> {
  String _tab = 'log';
  int? _mood;
  List<String> _symptoms = [];
  String? _bleeding;
  final TextEditingController _notes = TextEditingController();

  /// `dirty` keeps a later refetch from overwriting what the user is entering; `filledFor` fills once per day's row.
  bool _dirty = false;
  String? _filledFor;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fill(ref.read(dailyLogsViewProvider).todayLog);
    });
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  void _fill(Map<String, dynamic>? todayLog) {
    if (todayLog == null || _dirty || _filledFor == todayLog['log_date']) return;
    _filledFor = todayLog['log_date'] as String?;
    final form = moodDiaryFormFromLog(todayLog);
    setState(() {
      _mood = form.mood;
      _symptoms = [...form.symptoms];
      _bleeding = form.bleeding;
    });
    _notes.text = form.notes;
  }

  void _edit() => _dirty = true;

  List<_Mood> _moods(List<Map<String, dynamic>> db) {
    if (db.isEmpty) {
      return [
        _Mood(1, '😢', tr('mooddiary_cox_pis_e041c5', 'Çox pis'), moodTone(1)),
        _Mood(2, '😔', tr('mooddiary_pis_3c7a2d', 'Pis'), moodTone(2)),
        _Mood(3, '😐', tr('common_normal', 'Normal'), moodTone(3)),
        _Mood(4, '🙂', tr('mooddiary_yaxsi_9d8595', 'Yaxşı'), moodTone(4)),
        _Mood(5, '😊', tr('mooddiary_ela_720a0e', 'Əla'), moodTone(5)),
      ];
    }
    return [
      for (final m in db)
        _Mood((m['value'] as num?)?.toInt() ?? 0, '${m['emoji'] ?? ''}', '${m['label'] ?? ''}',
            moodTone((m['value'] as num?) ?? 0, m['color_class'] as String?)),
    ];
  }

  List<_Option> _symptomOptions(List<Map<String, dynamic>> db) {
    if (db.isEmpty) {
      return [
        _Option('tired', tr('mooddiary_yorgunluq_c68d62', 'Yorğunluq'), '😴'),
        _Option('nausea', tr('mooddiary_urekbulanma_a42830', 'Ürəkbulanma'), '🤢'),
        _Option('headache', tr('mooddiary_bas_agrisi_ff6f4c', 'Baş ağrısı'), '🤕'),
      ];
    }
    return [
      for (final s in db)
        _Option('${s['symptom_key'] ?? ''}', '${s['label'] ?? ''}', (s['icon'] is String && (s['icon'] as String).isNotEmpty) ? s['icon'] as String : '🩺'),
    ];
  }

  List<_Option> get _bleedingOptions => [
        _Option('none', tr('mooddiary_bleeding_none', 'Yoxdur'), '⚪'),
        _Option('spotting', tr('mooddiary_bleeding_spotting', 'Ləkələnmə'), '🩸'),
        _Option('light', tr('mooddiary_bleeding_light', 'Az'), '🩸'),
        _Option('medium', tr('mooddiary_bleeding_medium', 'Orta'), '🩸'),
        _Option('heavy', tr('mooddiary_bleeding_heavy', 'Çox'), '🩸'),
      ];

  Future<void> _toggleSymptom(String id) async {
    await ref.read(healthHapticsProvider).light();
    _edit();
    setState(() => _symptoms = _symptoms.contains(id) ? _symptoms.where((s) => s != id).toList() : [..._symptoms, id]);
  }

  Future<void> _save(bool showBleeding) async {
    if (_mood == null) return;
    await ref.read(healthHapticsProvider).medium();
    final today = todayKey();
    // Merge: only the diary's own fields are sent, so water/sleep/temperature saved elsewhere stay.
    final result = await ref.read(dailyLogActionsProvider).addLog(moodDiaryPatch(
          MoodDiaryForm(mood: _mood, symptoms: _symptoms, bleeding: _bleeding, notes: _notes.text),
          today,
          showBleeding,
        ));
    if (result.error == null) {
      _dirty = false;
      _filledFor = today;
    }
    if (mounted) setState(() => _tab = 'history');
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(dailyLogsViewProvider, (_, next) => _fill(next.todayLog));
    final view = ref.watch(dailyLogsViewProvider);
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final moodsQ = ref.watch(moodOptionsQuery);
    final symptomsQ = ref.watch(symptomsQuery(lifeStage));
    if (view.loading || moodsQ.isLoading || symptomsQ.isLoading) return const ToolLoading();

    final a = context.a;
    final logs = view.logs;
    final moods = _moods(moodsQ.data ?? const []);
    final symptomOptions = _symptomOptions(symptomsQ.data ?? const []);
    // Bleeding only for bump (spotting in pregnancy) and mommy (postpartum lochia); flow has its own period flow.
    final showBleeding = lifeStage == 'bump' || lifeStage == 'mommy';
    String? emojiOf(Object? mood) => mood is num && mood != 0 ? moods.where((m) => m.value == mood).firstOrNull?.emoji : null;

    final withMood = logs.where((l) => l['mood'] is num && l['mood'] != 0).length;
    final average = logs.isNotEmpty
        ? (logs.fold<num>(0, (s, e) => s + ((e['mood'] as num?) ?? 0)) / withMood).toStringAsFixed(1)
        : '0';
    final countText = formatCount(CountNoun.records, logs.length);

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: '${tr('mooddiary_bu_hefte_a5f60b', 'Bu həftə')}: $countText',
          title: tr('mooddiary_ehval_gundeliyi_831844', 'Əhval Gündəliyi'),
        ),
        const Padding(padding: EdgeInsets.only(bottom: 12), child: MedicalDisclaimer(variant: MedicalDisclaimerVariant.compact)),
        AGridCols(columns: 2, children: [
          AStatTileBox(
            background: a.pink1,
            labelColor: a.berryInk,
            valueSize: 17,
            icon: Text(emojiOf(logs.firstOrNull?['mood']) ?? '😊', style: const TextStyle(fontSize: 26, height: 1.2)),
            label: tr('mooddiary_ortalama_ehval_72856f', 'Ortalama əhval'),
            value: average,
          ),
          AStatTileBox(
            valueSize: 17,
            icon: AStatIcon(icon: AIcons.calendar, gradient: a.gradPeach, color: a.accentInk),
            label: tr('mooddiary_bu_hefte_a5f60b', 'Bu həftə'),
            value: countText,
          ),
        ]),
        const SizedBox(height: 12),
        AFlexTabs<String>(
          selected: _tab,
          onChanged: (t) => setState(() => _tab = t),
          tabs: [
            AFlexTab('log', tr('mooddiary_qeyd', 'Qeyd'), icon: AIcons.plus),
            AFlexTab('history', tr('mooddiary_tarixce_b09a14', 'Tarixçə'), icon: AIcons.calendar),
            AFlexTab('insights', tr('mooddiary_analiz', 'Analiz'), icon: AIcons.trendingUp),
          ],
        ),
        const SizedBox(height: 16),
        KeyedSubtree(
          key: ValueKey('mood-tab-$_tab'),
          child: switch (_tab) {
            'history' => _history(context, logs, moods, symptomOptions),
            'insights' => _insights(context, logs),
            _ => _log(context, moods, symptomOptions, showBleeding, lifeStage),
          },
        ),
      ]),
    );
  }

  Widget _log(BuildContext context, List<_Mood> moods, List<_Option> symptoms, bool showBleeding, String? lifeStage) {
    final a = context.a;
    final selected = moods.where((m) => m.value == _mood).firstOrNull;
    return vgap(12, [
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('mooddiary_bu_gun_ozunuzu_nece_hiss_edirsiniz_b2d818', 'Bu gün özünüzü necə hiss edirsiniz?'),
                textAlign: TextAlign.center, style: AStyles.cardTitle(context)),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (final m in moods)
              ATap(
                scale: 0.95,
                semanticLabel: m.label,
                selected: _mood == m.value,
                onTap: () {
                  _edit();
                  setState(() => _mood = m.value);
                },
                child: _moodButton(context, m, _mood == m.value),
              ),
          ]),
          if (selected != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(selected.label, textAlign: TextAlign.center, style: px(12.5, weight: FontWeight.w700, color: a.accentInk)),
            ),
        ]),
      ),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('untranslated_simptomlar_xhm7bx', 'Simptomlar'), style: AStyles.cardTitle(context))),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in symptoms)
              ATagChip(
                on: _symptoms.contains(s.id),
                onTap: () => _toggleSymptom(s.id),
                children: [Text(s.emoji, style: const TextStyle(fontSize: 12)), Text(s.label)],
              ),
          ]),
        ]),
      ),
      if (showBleeding)
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('mooddiary_bleeding_title', 'Qanaxma'), style: AStyles.cardTitle(context))),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final o in _bleedingOptions)
                ATagChip(
                  on: o.id == 'none' ? _bleeding == null : _bleeding == o.id,
                  onTap: () {
                    _edit();
                    setState(() => _bleeding = o.id == 'none' ? null : o.id);
                  },
                  children: [Text(o.emoji, style: const TextStyle(fontSize: 12)), Text(o.label)],
                ),
            ]),
            if (_bleeding == 'heavy')
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(12)),
                child: Text(
                  '🆘 ${lifeStage == 'mommy' ? tr('mooddiary_bleeding_heavy_warning_mommy', 'Ağır qanaxma (1 saatda bir bezi doldurur və ya iri laxtalar) təhlükəli ola bilər — dərhal həkiminizlə əlaqə saxlayın.') : tr('mooddiary_bleeding_heavy_warning_bump', 'Hamiləlikdə ağır qanaxma təcili tibbi vəziyyət ola bilər — dərhal həkiminizlə və ya təcili yardımla əlaqə saxlayın.')}',
                  style: px(12, weight: FontWeight.w600, color: a.alertInk, height: 16 / 12),
                ),
              ),
          ]),
        ),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('mooddiary_qeydler_a7a98b', 'Qeydlər'), style: AStyles.cardTitle(context))),
          ATextArea(
            fieldKey: const ValueKey('mood-notes'),
            controller: _notes,
            height: 64,
            onChanged: (_) => _edit(),
            placeholder: tr('mooddiary_bu_gun_haqqinda_yazmaq_istedikleriniz_1e2d2d', 'Bu gün haqqında yazmaq istədikləriniz...'),
          ),
        ]),
      ),
      APillButton(
        kind: APillKind.solid,
        label: tr('untranslated_yadda_saxla_bpdu9v', 'Yadda saxla'),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        expand: true,
        tapScale: 0.98,
        disabledOpacity: 0.45,
        onTap: _mood == null ? null : () => _save(showBleeding),
      ),
    ]);
  }

  Widget _moodButton(BuildContext context, _Mood m, bool on) {
    final a = context.a;
    final (bg, border) = on ? moodToneColors(a, m.tone) : (a.surfaceSoft, const Color(0x00000000));
    return Transform.scale(
      scale: on ? 1.1 : 1,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border, width: 2),
          // shadow-lg
          boxShadow: on
              ? const [
                  BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
                  BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
                ]
              : null,
        ),
        child: Text(m.emoji, style: const TextStyle(fontSize: 18, height: 1.2)),
      ),
    );
  }

  Widget _history(BuildContext context, List<Map<String, dynamic>> logs, List<_Mood> moods, List<_Option> symptoms) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ASectionHeadRow(title: tr('mooddiary_son_qeydler_181e41', 'Son qeydlər'), bottom: 8),
      const SizedBox(height: 4),
      if (logs.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Text(tr('mooddiary_hele_qeyd_yoxdur_a3d826', 'Hələ qeyd yoxdur'), textAlign: TextAlign.center, style: AStyles.listSub(context)),
        )
      else
        AListCardBox(children: [
          for (var i = 0; i < logs.length && i < 10; i++) _historyRow(context, logs[i], i == 0, moods, symptoms, a),
        ]),
    ]);
  }

  Widget _historyRow(BuildContext context, Map<String, dynamic> entry, bool first, List<_Mood> moods, List<_Option> symptoms, ATokens a) {
    final mood = (entry['mood'] as num?)?.toInt() ?? 0;
    final day = storedCalendarDate(entry['log_date']);
    final notes = entry['notes'];
    final entrySymptoms = entry['symptoms'] is List ? [for (final s in entry['symptoms'] as List) '$s'] : const <String>[];
    final bleeding = entry['bleeding'];
    final tags = <Widget>[
      for (final s in entrySymptoms)
        if (symptoms.where((o) => o.id == s).firstOrNull case final o?)
          ATagChip(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            fontSize: 10,
            background: a.pink1,
            color: a.berryInk,
            children: [Text('${o.emoji} ${o.label}')],
          ),
      if (bleeding is String && bleeding.isNotEmpty)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(999)),
          child: Text('🩸 ${_bleedingOptions.where((o) => o.id == bleeding).firstOrNull?.label ?? bleeding}',
              style: px(10, weight: FontWeight.w600, color: a.alertInk)),
        ),
    ];
    return AListRowBox(
      first: first,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AListIconBox(background: a.pink1, child: Text(mood != 0 ? moods.where((m) => m.value == mood).firstOrNull?.emoji ?? '' : '😐', style: const TextStyle(fontSize: 19))),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(children: [
                Expanded(child: Text(day == null ? '${entry['log_date'] ?? ''}' : formatDatePattern(day, 'EEEE, d MMM'), style: AStyles.listTitle(context, size: 12.5))),
                for (var i = 0; i < 5; i++)
                  i < mood ? LucideFilled(AIcons.heart, size: 13, color: a.pink2) : AIcon(AIcons.heart, size: 13, color: a.lineStrong),
              ]),
            ),
            if (notes is String && notes.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(notes, style: AStyles.listSub(context))),
            if (tags.isNotEmpty) Wrap(spacing: 5, runSpacing: 5, children: tags),
          ]),
        ),
      ],
    );
  }

  Widget _insights(BuildContext context, List<Map<String, dynamic>> logs) {
    final a = context.a;
    return vgap(12, [
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(child: Text('✨ ${tr('mooddiary_ai_analizi_070626', 'AI Analizi')}', style: AStyles.cardTitle(context))),
              AIcon(AIcons.sparkles, size: 15, color: a.lav2),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('mooddiary_son_bir_heftede_ehvaliniz_umum_c383f6', 'Son bir həftədə əhvalınız ümumiyyətlə yaxşı olub. Ən çox qeyd etdiyiniz simptomları izləyin.'),
                style: AStyles.ctaText(context)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(a.radiusSm)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('💡', style: TextStyle(fontSize: 15, height: 1)),
              const SizedBox(width: 9),
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: tr('mooddiary_meslehet_6a93f2', 'Məsləhət:'), style: const TextStyle(fontWeight: FontWeight.w700)),
                    TextSpan(
                        text:
                            ' ${tr('mooddiary_yorgunluq_hiss_etdiyiniz_gunle_478815', 'Yorğunluq hiss etdiyiniz günlərdə istirahət etməyi unutmayın. Hamiləlik zamanı bədəninizin ehtiyaclarına qulaq asmaq vacibdir.')}'),
                  ]),
                  style: px(12, color: a.bodyText, height: 1.6),
                ),
              ),
            ]),
          ),
        ]),
      ),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ACardHead(title: tr('mooddiary_heftelik_ehval_trendi_5796d9', 'Həftəlik əhval trendi')),
          SizedBox(
            height: 108,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                for (var i = 0; i < 7; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(child: _trendBar(context, i, logs)),
                ],
              ]),
            ),
          ),
        ]),
      ),
    ]);
  }

  Widget _trendBar(BuildContext context, int i, List<Map<String, dynamic>> logs) {
    final a = context.a;
    final day = formatDatePattern(DateTime(2024, 1, 1 + i), 'EEE');
    final dayLog = logs.where((l) => (storedCalendarDate(l['log_date'])?.weekday ?? -1) % 7 == (i + 1) % 7).firstOrNull;
    final mood = (dayLog?['mood'] as num?) ?? 0;
    final factor = mood != 0 ? mood / 5 : 0.5;
    return LayoutBuilder(builder: (context, c) {
      const labelHeight = 15.0, gap = 8.0;
      final barMax = (c.maxHeight - labelHeight - gap).clamp(0.0, double.infinity);
      return Column(mainAxisAlignment: MainAxisAlignment.end, children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: animationsDisabled(context) ? factor.toDouble() : 0, end: factor.toDouble()),
          duration: Duration(milliseconds: animationsDisabled(context) ? 0 : 500),
          builder: (context, v, _) => Container(
            constraints: const BoxConstraints(maxWidth: 26),
            height: barMax * v,
            decoration: BoxDecoration(
              color: mood != 0 ? null : a.surfaceSoft,
              gradient: mood != 0 ? a.gradPink : null,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(6), bottom: Radius.circular(3)),
            ),
          ),
        ),
        const SizedBox(height: gap),
        SizedBox(height: labelHeight, child: Text(day, maxLines: 1, style: px(9.5, weight: FontWeight.w700, color: a.inkFaint))),
      ]);
    });
  }
}
