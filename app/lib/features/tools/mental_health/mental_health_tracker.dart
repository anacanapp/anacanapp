// Ported from: src/components/tools/MentalHealthTracker.tsx
//
// Mental health (`mental-health`, host of the mood diary section): daily mood check-in (mirrored to daily_logs),
// last-7-days chart, breathing exercise, the EPDS questionnaire with the self-harm safety path, help lines.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../legal/medical_disclaimer.dart';
import '../../settings/data/health_service.dart' show healthConnectedProvider, healthDailyQuery;
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'epds_scoring.dart';
import 'mental_health_data.dart';

/// `#rrggbb` → colour (null when not a hex colour).
Color? _hex(Object? value, [int alpha = 0xFF]) {
  if (value is! String) return null;
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(value.trim());
  if (m == null) return null;
  return Color((alpha << 24) | int.parse(m[1]!, radix: 16));
}

class _MoodLevel {
  const _MoodLevel(this.value, this.emoji, this.label, this.color, this.soft);
  final num value;
  final String emoji;
  final String label;
  final Color color;
  final Color soft;
}

class _Breathing {
  const _Breathing(this.name, this.inhale, this.hold, this.exhale, this.description, this.emoji);
  final String name;
  final int inhale;
  final int hold;
  final int exhale;
  final String description;
  final String emoji;
}

class MentalHealthTracker extends ConsumerStatefulWidget {
  const MentalHealthTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<MentalHealthTracker> createState() => _MentalHealthTrackerState();
}

class _MentalHealthTrackerState extends ConsumerState<MentalHealthTracker> {
  final TextEditingController _notes = TextEditingController();
  bool _checkinPending = false;
  Map<String, num> _epdsAnswers = {};
  int _currentQuestion = 0;
  bool _submitting = false;
  String? _selectedExercise;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  // Fallback mood colours mapped to the anacan palette (MentalHealthTracker.tsx literals).
  (Color, Color)? _fallbackColors(num value, ATokens a) => switch (value) {
    1 => (const Color(0xFFFF8AA4), a.pink1),
    2 => (a.peach2, a.peach1),
    3 => (const Color(0xFFFFC94D), a.yellow1),
    4 => (const Color(0xFF8FD19E), a.green1),
    5 => (const Color(0xFF63BD8B), a.green1),
    _ => null,
  };

  List<_MoodLevel> _moodLevels(List<Map<String, dynamic>> db, ATokens a) {
    final rows = db.isNotEmpty ? db : fallbackMoodLevels();
    return [
      for (final m in rows)
        () {
          final value = (m['mood_value'] as num?) ?? 0;
          final fb = _fallbackColors(value, a);
          final dbColor = db.isNotEmpty ? _hex(m['color']) : null;
          return _MoodLevel(
            value,
            '${m['emoji'] ?? ''}',
            '${m['label'] ?? ''}',
            dbColor ?? fb?.$1 ?? a.peach2,
            db.isNotEmpty && dbColor != null ? _hex(m['color'], 0x1F)! : (fb?.$2 ?? a.surfaceSoft),
          );
        }(),
    ];
  }

  List<_Breathing> _exercises(List<Map<String, dynamic>> db) {
    final rows = db.isNotEmpty ? db : fallbackBreathingExercises();
    return [
      for (final e in rows)
        _Breathing(
          '${e['name'] ?? ''}',
          (e['inhale_seconds'] as num?)?.toInt() ?? 0,
          (e['hold_seconds'] as num?)?.toInt() ?? 0,
          (e['exhale_seconds'] as num?)?.toInt() ?? 0,
          e['description'] is String ? e['description'] as String : '',
          e['icon'] == 'Wind'
              ? '🌙'
              : e['icon'] == 'Square'
              ? '📦'
              : '💨',
        ),
    ];
  }

  List<EpdsQuestion> _questions(List<Map<String, dynamic>> db) {
    if (db.isEmpty) return fallbackEpdsQuestions();
    return [
      for (final q in db)
        EpdsQuestion((q['question_number'] as num?)?.toInt() ?? 0, '${q['question_text'] ?? ''}', [
          for (final o in (q['options'] is List ? q['options'] as List : const []))
            if (o is Map) (value: (o['value'] as num?) ?? 0, label: '${o['text'] ?? ''}'),
        ]),
    ];
  }

  Future<void> _selectMood(num level) async {
    setState(() => _checkinPending = true);
    try {
      final notes = _notes.text;
      await ref.read(mentalHealthActionsProvider).addMoodCheckin(moodLevel: level.toInt(), notes: notes.isEmpty ? null : notes);
      // Mirrored to daily_logs so the dashboard mood card / weekly summaries stay the same (not awaited: the main
      // record is already saved).
      unawaited(ref.read(dailyLogActionsProvider).updateMood(level.toInt()));
      _notes.clear();
      if (mounted) AToastHost.of(context).success(tr('mentalhealthtracker_ehvaliniz_qeyd_edildi_dd9071', 'Əhvalınız qeyd edildi ✨'));
    } catch (_) {
      // mutateAsync rejected: React lets the promise reject unhandled; nothing is shown.
    } finally {
      if (mounted) setState(() => _checkinPending = false);
    }
  }

  String _riskLabel(String level) => switch (level) {
    'high' => tr('mentalhealthtracker_yuksek_risk_29a5a3', 'Yüksək Risk'),
    'moderate' => tr('mentalhealthtracker_risk_orta', 'Orta Risk'),
    _ => tr('mentalhealthtracker_risk_normal', 'Normal'),
  };

  String _assessmentLabel(Map<String, dynamic> a) => isEpdsSelfHarm(a) ? tr('epds_self_harm_label', 'Təcili dəstək') : _riskLabel('${a['risk_level']}');

  (Color, Color) _riskStyle(String level, ATokens a) => switch (level) {
    'high' => (a.pink1, a.pinkInk),
    'moderate' => (a.yellow1, a.warnInk),
    _ => (a.green1, a.greenInk),
  };

  void _call(String number) => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: number));

  Widget _emergencyCallButton(BuildContext context, String number, double height) => APillButton(
    buttonKey: const ValueKey('mh-emergency-call'),
    label: formatTr('weaning_call_emergency', 'Təcili yardım: {emergency}', {'emergency': number}),
    icon: const AIcon(AIcons.phone, size: 15, strokeWidth: 2.2),
    height: height,
    expand: true,
    background: context.a.pink2,
    onTap: () => _call(number),
  );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final moodLevels = _moodLevels(ref.watch(moodLevelsDbQuery).data ?? const [], a);
    final exercises = _exercises(ref.watch(breathingExercisesDbQuery).data ?? const []);
    final questions = _questions(ref.watch(epdsQuestionsDbQuery).data ?? const []);
    final checkins = ref.watch(moodCheckinsQuery(14)).data ?? const <Map<String, dynamic>>[];
    final todayCheckin = ref.watch(todayMoodCheckinQuery).data;
    final assessments = ref.watch(epdsAssessmentsQuery).data ?? const <Map<String, dynamic>>[];
    final resources = ref.watch(mentalHealthResourcesQuery).data ?? const <Map<String, dynamic>>[];
    final dailyLogs = ref.watch(dailyLogsViewProvider).logs;
    final showPrompt = shouldShowEpdsPrompt(checkins, dailyLogs);
    final emergency = ref.watch(emergencyNumberProvider);

    final moodTrend = checkins.length >= 2
        ? checkins.take(7).fold<num>(0, (s, c) => s + ((c['mood_level'] as num?) ?? 0)) / (checkins.length < 7 ? checkins.length : 7)
        : null;
    final now = DateTime.now();
    final last7 = [
      for (var i = 0; i < 7; i++)
        () {
          final d = DateTime(now.year, now.month, now.day - (6 - i));
          final key = localDateKey(d);
          final c = checkins.where((c) => c['checked_at'] == key).firstOrNull;
          return (mood: (c?['mood_level'] as num?) ?? 0, day: formatDatePattern(d, 'EEE'));
        }(),
    ];
    final emergencyResources = resources.where((r) => r['is_emergency'] == true).toList();
    final emergencyPhone = emergencyResources.where((r) => r['phone'] is String && (r['phone'] as String).isNotEmpty).toList();
    final otherResources = resources.where((r) => r['is_emergency'] != true).toList();
    _MoodLevel? levelOf(num v) => moodLevels.where((m) => m.value == v).firstOrNull;

    Widget stat(Color bg, Color ink, AIconData icon, String value, String label, int delayMs) => FadeRise(
      delay: Duration(milliseconds: delayMs),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: AIcon(icon, size: 20, color: ink),
            ),
            Text(value, style: AStyles.heading(context, 22, color: ink)),
            Opacity(
              opacity: 0.8,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: px(12, weight: FontWeight.w600, color: ink, height: 16 / 12),
              ),
            ),
          ],
        ),
      ),
    );

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('mentalhealthtracker_rahatlama_ve_stress_azaltma_1a97bc', 'Rahatlama və stress azaltma'),
            title: tr('mentalhealthtracker_mental_saglamliq_68e65e', 'Mental Sağlamlıq'),
          ),
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan),
          ),
          AGridCols(
            columns: 3,
            gap: 12,
            children: [
              stat(a.green1, a.greenInk, AIcons.smile, '${checkins.length}', tr('untranslated_qeyd_z0999u', 'Qeyd'), 100),
              stat(
                a.blue1,
                a.blueInk,
                AIcons.activity,
                moodTrend != null ? moodTrend.toStringAsFixed(1) : '—',
                tr('untranslated_ortalama_qxgps6', 'Ortalama'),
                150,
              ),
              stat(a.lav1, a.lavInk, AIcons.calendar, '${assessments.length}', 'EPDS', 200),
            ],
          ),
          const SizedBox(height: 16),
          vgap(16, [
            if (showPrompt && assessments.isEmpty)
              FadeRise(
                dy: -10,
                child: ACard(
                  color: a.yellow1,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AListIconBox(
                        gradient: a.gradYellow,
                        child: AIcon(AIcons.triangleAlert, size: 17, strokeWidth: 2.2, color: a.warnInk),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr('mentalhealthtracker_sizinle_danisaq_a4ad3a', 'Sizinlə danışaq?'), style: AStyles.listTitle(context, color: a.warnInk)),
                            Opacity(
                              opacity: 0.85,
                              child: Text(
                                tr('mentalhealthtracker_qisa_sorgu_ile_veziyyeti_qiyme_97ab4c', 'Qısa sorğu ilə vəziyyəti qiymətləndirək?'),
                                style: px(14, color: a.warnInk, height: 20 / 14),
                              ),
                            ),
                            const SizedBox(height: 12),
                            APillButton(
                              label: tr('mentalhealthtracker_sorguya_basla_0563f3', 'Sorğuya başla'),
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              fontSize: 11.5,
                              onTap: () => _openEpds(questions, emergency, emergencyPhone),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            FadeRise(child: _checkinCard(context, todayCheckin, moodLevels, levelOf)),
            if (checkins.isNotEmpty) FadeRise(delay: const Duration(milliseconds: 100), child: _weekChart(context, last7, moodTrend, levelOf)),
            AGridCols(
              columns: 2,
              gap: 12,
              children: [
                FadeRise(
                  dx: -20,
                  dy: 0,
                  child: _actionCard(
                    context,
                    AIcons.wind,
                    a.gradBlue,
                    a.blueInk,
                    tr('mentalhealthtracker_nefes_mesqi_8d98bb', 'Nəfəs Məşqi'),
                    tr('mentalhealthtracker_rahatlama_ve_stress_azaltma_1a97bc', 'Rahatlama və stress azaltma'),
                    () => _openBreathing(exercises),
                  ),
                ),
                FadeRise(
                  dx: 20,
                  dy: 0,
                  child: _actionCard(
                    context,
                    AIcons.brain,
                    a.gradGreen,
                    a.greenInk,
                    tr('mentalhealthtracker_epds_testi_3c7a2d', 'EPDS Testi'),
                    tr('mentalhealthtracker_depressiya_riski_qiymetlendirme_2729fe', 'Depressiya riski qiymətləndirmə'),
                    () => _openEpds(questions, emergency, emergencyPhone),
                  ),
                ),
              ],
            ),
            if (assessments.isNotEmpty)
              FadeRise(
                delay: const Duration(milliseconds: 200),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ASectionHeadRow(
                      title: tr('mentalhealthtracker_kecmis_neticeler_072044', 'Keçmiş Nəticələr'),
                      trailing: AIcon(AIcons.sparkles, size: 15, color: a.green2),
                    ),
                    AListCardBox(
                      children: [
                        for (var i = 0; i < assessments.length && i < 3; i++)
                          AListRowBox(
                            first: i == 0,
                            onTap: () => _showResult(assessments[i], emergency, emergencyPhone),
                            children: [
                              AListIconBox(
                                background: a.green1,
                                child: AIcon(AIcons.brain, size: 17, strokeWidth: 2.2, color: a.greenInk),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_formatCompleted(assessments[i]['completed_at']), style: AStyles.listTitle(context)),
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        '${tr('mentalhealthtracker_bal_label', 'Bal:')} ${_score(assessments[i]['total_score'])}/30',
                                        style: AStyles.listSub(context),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              () {
                                final (bg, ink) = _riskStyle('${assessments[i]['risk_level']}', a);
                                return ARankTagBox(_assessmentLabel(assessments[i]), background: bg, color: ink);
                              }(),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            FadeRise(
              delay: const Duration(milliseconds: 300),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ASectionHeadRow(
                    title: tr('mentalhealthtracker_tecili_yardim_283100', 'Təcili Yardım'),
                    trailing: AIcon(AIcons.phone, size: 15, color: a.pink2),
                  ),
                  vgap(8, [
                    for (final r in emergencyResources) _emergencyResource(context, r),
                    if (emergencyPhone.isEmpty) _emergencyCallButton(context, emergency, 44),
                  ]),
                ],
              ),
            ),
            if (otherResources.isNotEmpty)
              FadeRise(
                delay: const Duration(milliseconds: 400),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ASectionHeadRow(title: tr('mentalhealthtracker_destek_resurslari_345241', 'Dəstək Resursları')),
                    Padding(padding: const EdgeInsets.only(bottom: 16), child: vgap(8, [for (final r in otherResources) _otherResource(context, r)])),
                  ],
                ),
              ),
          ]),
        ],
      ),
    );
  }

  String _score(Object? v) => v is num ? (v == v.roundToDouble() ? '${v.toInt()}' : '$v') : '${v ?? ''}';

  String _formatCompleted(Object? iso) {
    final d = iso is String ? DateTime.tryParse(iso)?.toLocal() : null;
    return d == null ? '' : formatDatePattern(d, 'd MMMM yyyy');
  }

  Widget _checkinCard(BuildContext context, Map<String, dynamic>? todayCheckin, List<_MoodLevel> moodLevels, _MoodLevel? Function(num) levelOf) {
    final a = context.a;
    final level = todayCheckin == null ? null : levelOf((todayCheckin['mood_level'] as num?) ?? 0);
    return ACard(
      padding: EdgeInsets.zero,
      variant: ACardVariant.list,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(gradient: a.gradGreen),
            child: Row(
              children: [
                AIcon(AIcons.smile, size: 20, color: a.greenInk),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(tr('mentalhealthtracker_bu_gun_necesen_26ad26', 'Bu gün necəsən?'), style: AStyles.heading(context, 16, color: a.greenInk)),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: todayCheckin != null
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(level?.emoji ?? '', style: const TextStyle(fontSize: 72, height: 1)),
                        ),
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: '${tr('mentalhealthtracker_bu_gun_ozunuzu_24fed0', 'Bu gün özünüzü')} '),
                              TextSpan(
                                text: (level?.label ?? '').toLowerCase(),
                                style: TextStyle(fontWeight: FontWeight.w700, color: a.accentInk),
                              ),
                              const TextSpan(text: ' hiss edirsiniz'),
                            ],
                          ),
                          textAlign: TextAlign.center,
                          style: px(18, weight: FontWeight.w500, color: a.ink, height: 28 / 18),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            tr('mentalhealthtracker_qeyd_etdiyiniz_ucun_tesekkurle_52b458', '✨ Qeyd etdiyiniz üçün təşəkkürlər!'),
                            style: AStyles.listSub(context),
                          ),
                        ),
                      ],
                    ),
                  )
                : vgap(16, [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          for (var i = 0; i < moodLevels.length; i++)
                            Flexible(
                              child: FadeRise(
                                delay: Duration(milliseconds: i * 100),
                                child: ATap(
                                  scale: 0.95,
                                  semanticLabel: moodLevels[i].label,
                                  onTap: _checkinPending ? null : () => _selectMood(moodLevels[i].value),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(color: moodLevels[i].soft, borderRadius: BorderRadius.circular(16)),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(moodLevels[i].emoji, style: const TextStyle(fontSize: 30, height: 36 / 30)),
                                        const SizedBox(height: 8),
                                        Text(
                                          moodLevels[i].label,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: px(10, weight: FontWeight.w700, color: a.ink),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    ATextArea(
                      fieldKey: const ValueKey('mh-notes'),
                      controller: _notes,
                      height: 64,
                      placeholder: tr('mentalhealthtracker_i_steyirsinizse_qisa_qeyd_elave_edin_9043bb', 'İstəyirsinizsə, qısa qeyd əlavə edin...'),
                    ),
                  ]),
          ),
        ],
      ),
    );
  }

  Widget _weekChart(BuildContext context, List<({num mood, String day})> last7, num? moodTrend, _MoodLevel? Function(num) levelOf) {
    final a = context.a;
    return ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                AIcon(AIcons.activity, size: 20, color: a.green2),
                const SizedBox(width: 8),
                Text(tr('mentalhealthtracker_son_7_gun_1d4103', 'Son 7 Gün'), style: AStyles.heading(context, 16)),
              ],
            ),
          ),
          SizedBox(
            height: 112,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < last7.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final barMax = c.maxHeight - 15 - 4;
                        final mood = last7[i].mood;
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Container(
                              height: barMax * (mood > 0 ? mood / 5 : 0.15),
                              decoration: BoxDecoration(
                                color: mood > 0 ? (levelOf(mood)?.color ?? a.peach2) : a.lineStrong,
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            const SizedBox(height: 4),
                            SizedBox(
                              height: 15,
                              child: Text(
                                last7[i].day,
                                maxLines: 1,
                                style: px(10, weight: FontWeight.w600, color: a.inkSoft),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (moodTrend != null)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(16)),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(levelOf(moodTrend.round())?.emoji ?? '', style: const TextStyle(fontSize: 30, height: 36 / 30)),
                        const SizedBox(width: 12),
                        Text(
                          'Ortalama: ${moodTrend.toStringAsFixed(1)}/5',
                          style: px(18, weight: FontWeight.w700, color: a.greenInk, height: 28 / 18),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    moodTrend >= 4
                        ? tr('mentalhealthtracker_ela_gedir_ozunuze_qaygi_goster_f76926', '🌟 Əla gedir! Özünüzə qayğı göstərməyə davam edin.')
                        : moodTrend >= 3
                        ? tr('mentalhealthtracker_yaxsi_gedir_ozunuze_vaxt_ayiri_a89726', '💪 Yaxşı gedir. Özünüzə vaxt ayırın.')
                        : tr(
                            'mentalhealthtracker_biraz_cetin_dovr_kecirirsiniz__85fe81',
                            '💝 Biraz çətin dövr keçirirsiniz. Yardım istəməkdən çəkinməyin.',
                          ),
                    textAlign: TextAlign.center,
                    style: px(12, color: a.greenInk, height: 16 / 12),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _actionCard(BuildContext context, AIconData icon, Gradient grad, Color ink, String title, String sub, VoidCallback onTap) => ATap(
    onTap: onTap,
    semanticLabel: title,
    child: ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AListIconBox(
              gradient: grad,
              child: AIcon(icon, size: 17, strokeWidth: 2.2, color: ink),
            ),
          ),
          Text(title, style: AStyles.listTitle(context)),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(sub, style: AStyles.listSub(context)),
          ),
        ],
      ),
    ),
  );

  Widget _emergencyResource(BuildContext context, Map<String, dynamic> r) {
    final a = context.a;
    final phone = r['phone'];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${r['name'] ?? ''}',
                  style: px(16, weight: FontWeight.w700, color: a.alertInk, height: 24 / 16),
                ),
                if (r['description'] is String)
                  Text(
                    r['description'] as String,
                    style: px(12, color: a.alertSoft, height: 16 / 12),
                  ),
              ],
            ),
          ),
          if (phone is String && phone.isNotEmpty) ...[
            const SizedBox(width: 12),
            APillButton(
              label: phone,
              icon: const AIcon(AIcons.phone, size: 13, strokeWidth: 2.2),
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              fontSize: 11.5,
              background: a.pink2,
              onTap: () => _call(phone),
            ),
          ],
        ],
      ),
    );
  }

  Widget _otherResource(BuildContext context, Map<String, dynamic> r) {
    final phone = r['phone'];
    final website = r['website'];
    return ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${r['name'] ?? ''}', style: AStyles.listTitle(context)),
          if (r['description'] is String) Text(r['description'] as String, style: AStyles.listSub(context)),
          const SizedBox(height: 12),
          Row(
            children: hgap(8, [
              if (phone is String && phone.isNotEmpty)
                APillButton(
                  kind: APillKind.soft,
                  label: tr('mentalhealthtracker_zeng_et_15094d', 'Zəng et'),
                  icon: const AIcon(AIcons.phone, size: 13, strokeWidth: 2.2),
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  fontSize: 11.5,
                  onTap: () => _call(phone),
                ),
              if (website is String && website.isNotEmpty)
                APillButton(
                  kind: APillKind.soft,
                  label: tr('mentalhealthtracker_sayt_3c7a2d', 'Sayt'),
                  icon: const AIcon(AIcons.externalLink, size: 13, strokeWidth: 2.2),
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  fontSize: 11.5,
                  onTap: () {
                    final uri = Uri.tryParse(website);
                    if (uri != null) ref.read(healthLinkLauncherProvider)(uri);
                  },
                ),
            ]),
          ),
        ],
      ),
    );
  }

  // ── breathing ──

  void _openBreathing(List<_Breathing> exercises) {
    _selectedExercise ??= exercises.firstOrNull?.name;
    showToolDialog<void>(
      context,
      builder: (ctx) => _BreathingDialog(exercises: exercises, initial: _selectedExercise, onSelect: (name) => _selectedExercise = name),
    );
  }

  // ── EPDS ──

  void _openEpds(List<EpdsQuestion> questions, String emergency, List<Map<String, dynamic>> emergencyPhone) {
    showToolDialog<void>(
      context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          void update(VoidCallback f) {
            setState(f);
            setLocal(() {});
          }

          return _epdsQuiz(ctx, questions, emergency, emergencyPhone, update);
        },
      ),
    );
  }

  Widget _epdsQuiz(
    BuildContext context,
    List<EpdsQuestion> questions,
    String emergency,
    List<Map<String, dynamic>> emergencyPhone,
    void Function(VoidCallback) update,
  ) {
    final a = context.a;
    final q = _currentQuestion < questions.length ? questions[_currentQuestion] : null;
    final selfHarmNow = q?.id == epdsSelfHarmQuestion && (_epdsAnswers['$epdsSelfHarmQuestion'] ?? 0) > 0;
    final answered = q != null && _epdsAnswers.containsKey('${q.id}');
    final complete = _epdsAnswers.length >= questions.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ToolDialogTitle(tr('mentalhealthtracker_epds_sorgusu_564f52', 'EPDS Sorğusu'), icon: AIcon(AIcons.brain, size: 20, color: a.green2)),
        vgap(16, [
          Row(
            children: hgap(8, [
              for (var i = 0; i < questions.length; i++)
                Expanded(
                  child: Container(
                    height: 6,
                    decoration: BoxDecoration(color: i <= _currentQuestion ? a.green2 : a.lineStrong, borderRadius: BorderRadius.circular(999)),
                  ),
                ),
            ]),
          ),
          Text(
            formatTr('mental_question_progress', 'Sual {n} / {total}', {'n': _currentQuestion + 1, 'total': questions.length}),
            textAlign: TextAlign.center,
            style: AStyles.listSub(context),
          ),
          if (q != null)
            KeyedSubtree(
              key: ValueKey('epds-q-$_currentQuestion'),
              child: FadeRise(
                dx: 20,
                dy: 0,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(q.question, style: AStyles.heading(context, 18)),
                    ),
                    vgap(8, [
                      for (final o in q.options)
                        () {
                          final on = _epdsAnswers['${q.id}'] == o.value;
                          return ATap(
                            semanticLabel: o.label,
                            selected: on,
                            onTap: () => update(() => _epdsAnswers = {..._epdsAnswers, '${q.id}': o.value}),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: on ? a.green1 : a.surfaceSoft,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: on ? a.green2 : const Color(0x00000000), width: 2),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 20,
                                    height: 20,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: on ? a.green2 : null,
                                      border: Border.all(color: on ? a.green2 : a.lineStrong, width: 2),
                                    ),
                                    child: on
                                        ? Container(
                                            width: 8,
                                            height: 8,
                                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFFFFFF)),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      o.label,
                                      style: px(14, weight: FontWeight.w500, color: a.ink, height: 20 / 14),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }(),
                    ]),
                  ],
                ),
              ),
            ),
          if (selfHarmNow)
            Semantics(
              liveRegion: true,
              child: Container(
                key: const ValueKey('epds-self-harm-inline'),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Text(
                        tr(
                          'epds_self_harm_inline',
                          'Bu fikirlər çətin ola bilər və siz tək deyilsiniz. İndi kiminləsə danışın. Təhlükədəsinizsə, təcili yardıma zəng edin.',
                        ),
                        style: px(14, weight: FontWeight.w700, color: a.alertInk, height: 20 / 14),
                      ),
                    ),
                    _emergencyCallButton(context, emergency, 42),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                APillButton(
                  kind: APillKind.soft,
                  label: tr('common_back', 'Geri'),
                  icon: const AIcon(AIcons.chevronLeft, size: 14, strokeWidth: 2.2, mirrorInRtl: true),
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  disabledOpacity: 0.45,
                  onTap: _currentQuestion == 0 ? null : () => update(() => _currentQuestion--),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _currentQuestion < questions.length - 1
                      ? APillButton(
                          label: tr('mentalhealthtracker_novbeti_6e8661', 'Növbəti'),
                          trailingIcon: const AIcon(AIcons.chevronRight, size: 14, strokeWidth: 2.2, mirrorInRtl: true),
                          height: 44,
                          expand: true,
                          background: a.green2,
                          onTap: answered ? () => update(() => _currentQuestion++) : null,
                        )
                      : APillButton(
                          label: tr('mentalhealthtracker_neticeni_gor_d2fef0', 'Nəticəni Gör'),
                          height: 44,
                          expand: true,
                          background: a.green2,
                          onTap: _submitting || !complete ? null : () => _submitEpds(context, questions, emergency, emergencyPhone, update),
                        ),
                ),
              ],
            ),
          ),
        ]),
      ],
    );
  }

  Future<void> _submitEpds(
    BuildContext dialogContext,
    List<EpdsQuestion> questions,
    String emergency,
    List<Map<String, dynamic>> emergencyPhone,
    void Function(VoidCallback) update,
  ) async {
    if (_epdsAnswers.length < questions.length) {
      AToastHost.of(context).error(tr('mentalhealthtracker_butun_suallara_cavab_verin_3e999d', 'Bütün suallara cavab verin'));
      return;
    }
    update(() => _submitting = true);
    final answers = Map<String, num>.of(_epdsAnswers);
    Map<String, dynamic> result;
    try {
      result = await ref.read(mentalHealthActionsProvider).submitEpds(answers);
    } catch (_) {
      // Saving failed (offline / server): still show the result on this device. A self-harm answer must never end
      // without the urgent help screen.
      final local = buildEpdsResult(answers);
      result = {
        'id': 'local-${DateTime.now().millisecondsSinceEpoch}',
        'user_id': '',
        'total_score': local.totalScore,
        'answers': answers,
        'risk_level': local.riskLevel,
        'recommendation': local.recommendation,
        'completed_at': DateTime.now().toUtc().toIso8601String(),
        'self_harm': local.selfHarm,
      };
    }
    if (!mounted) return;
    setState(() {
      _submitting = false;
      _epdsAnswers = {};
      _currentQuestion = 0;
    });
    if (dialogContext.mounted) Navigator.of(dialogContext).pop();
    _showResult(result, emergency, emergencyPhone);
  }

  void _showResult(Map<String, dynamic> result, String emergency, List<Map<String, dynamic>> emergencyPhone) {
    showToolDialog<void>(context, builder: (ctx) => _resultContent(ctx, result, emergency, emergencyPhone));
  }

  Widget _resultContent(BuildContext context, Map<String, dynamic> result, String emergency, List<Map<String, dynamic>> emergencyPhone) {
    final a = context.a;
    final selfHarm = isEpdsSelfHarm(result);
    final risk = '${result['risk_level']}';
    final (bg, ink) = _riskStyle(selfHarm ? 'high' : risk, a);
    final urgent = risk == 'high' || selfHarm
        ? Semantics(
            liveRegion: true,
            child: Container(
              key: const ValueKey('epds-urgent-help'),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      selfHarm
                          ? tr('epds_self_harm_result_title', 'Özünüzə zərər vermək fikirləri ciddidir. İndi kiminləsə danışın:')
                          : tr('mentalhealthtracker_zehmet_olmasa_mutexessisle_ela_07b456', '🆘 Zəhmət olmasa mütəxəssislə əlaqə saxlayın:'),
                      style: px(14, weight: FontWeight.w700, color: a.alertInk, height: 20 / 14),
                    ),
                  ),
                  vgap(8, [
                    _emergencyCallButton(context, emergency, 44),
                    for (final r in emergencyPhone)
                      APillButton(
                        label: '${r['name'] ?? ''}: ${r['phone']}',
                        icon: const AIcon(AIcons.phone, size: 15, strokeWidth: 2.2),
                        height: 44,
                        expand: true,
                        background: a.pink2,
                        onTap: () => _call('${r['phone']}'),
                      ),
                  ]),
                ],
              ),
            ),
          )
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ToolDialogTitle(tr('mentalhealthtracker_neticeniz_d14591', 'Nəticəniz'), center: true),
        vgap(24, [
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AIcon(risk == 'low' && !selfHarm ? AIcons.circleCheck : AIcons.triangleAlert, size: 24, color: ink),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      _assessmentLabel(result),
                      style: px(18, weight: FontWeight.w700, color: ink, height: 28 / 18),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (selfHarm) urgent!,
          Column(
            children: [
              Text(_score(result['total_score']), style: AStyles.heading(context, 52)),
              Text(tr('mentalhealthtracker_30_bal_suffix', '/ 30 bal'), style: px(16, color: a.inkSoft)),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Text(
              '${result['recommendation'] ?? ''}',
              textAlign: TextAlign.center,
              style: px(14, color: a.bodyText, height: 20 / 14),
            ),
          ),
          if (!selfHarm && urgent != null) urgent,
        ]),
      ],
    );
  }
}

/// The breathing exercise dialog: exercise list, then the timed inhale / hold / exhale circle (4 rounds).
class _BreathingDialog extends ConsumerStatefulWidget {
  const _BreathingDialog({required this.exercises, required this.initial, required this.onSelect});
  final List<_Breathing> exercises;
  final String? initial;
  final ValueChanged<String> onSelect;

  @override
  ConsumerState<_BreathingDialog> createState() => _BreathingDialogState();
}

class _BreathingDialogState extends ConsumerState<_BreathingDialog> {
  String _phase = 'idle';
  int _count = 0;
  late String? _selected = widget.initial;
  final OneShot _timer = OneShot();

  _Breathing? get _exercise => widget.exercises.where((e) => e.name == _selected).firstOrNull ?? widget.exercises.firstOrNull;

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  void _schedule() {
    final ex = _exercise;
    if (_phase == 'idle' || ex == null) return;
    final seconds = switch (_phase) {
      'inhale' => ex.inhale,
      'hold' => ex.hold,
      _ => ex.exhale,
    };
    _timer.run(Duration(seconds: seconds), () {
      if (!mounted) return;
      if (_phase == 'inhale') {
        setState(() => _phase = 'hold');
      } else if (_phase == 'hold') {
        setState(() => _phase = 'exhale');
      } else if (_phase == 'exhale') {
        if (_count < 3) {
          setState(() {
            _count++;
            _phase = 'inhale';
          });
        } else {
          setState(() {
            _phase = 'idle';
            _count = 0;
          });
          AToastHost.of(context).success(tr('mentalhealthtracker_tamamlandi_ozunuzu_nece_hiss_e_9a2212', 'Tamamlandı! Özünüzü necə hiss edirsiniz?'));
          ref.read(analyticsSinkProvider).logEvent('breathing_exercise_done', {'exercise_id': ex.name});
          return;
        }
      }
      _schedule();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final connected = ref.watch(healthConnectedProvider);
    final mindfulness = connected ? (ref.watch(healthDailyQuery(7)).data?.mindfulness ?? const []) : const [];
    final weekMin = mindfulness.fold<num>(0, (s, x) => s + x.value);
    final ex = _exercise;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ToolDialogTitle(tr('mentalhealthtracker_nefes_mesqi_8d98bb', 'Nəfəs Məşqi'), icon: AIcon(AIcons.wind, size: 20, color: a.blue2)),
        if (_phase == 'idle')
          vgap(24, [
            if (connected && weekMin > 0)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    AIcon(AIcons.wind, size: 15, color: a.lavInk),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        tr(
                          'mh_health_mindfulness_bridge',
                          'Bu həftə Apple Health / Health Connect-də {min} dəqiqə rahatlama qeydə alınıb',
                        ).replaceAll('{min}', weekMin == weekMin.roundToDouble() ? '${weekMin.toInt()}' : '$weekMin'),
                        style: px(11.5, weight: FontWeight.w600, color: a.lavInk),
                      ),
                    ),
                  ],
                ),
              ),
            vgap(12, [
              for (final e in widget.exercises)
                ATap(
                  semanticLabel: e.name,
                  selected: ex?.name == e.name,
                  onTap: () {
                    setState(() => _selected = e.name);
                    widget.onSelect(e.name);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: ex?.name == e.name ? a.green1 : a.surfaceSoft,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: ex?.name == e.name ? a.green2 : const Color(0x00000000), width: 2),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: a.gradBlue, borderRadius: BorderRadius.circular(12)),
                          child: Text(e.emoji, style: const TextStyle(fontSize: 24, height: 1.2)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(e.name, style: AStyles.listTitle(context)),
                              Text(e.description, style: AStyles.listSub(context)),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  '${tr('mentalhealthtracker_nefes_al_56f3c5', 'Nəfəs al:')} ${e.inhale}s • ${tr('mentalhealthtracker_saxla_colon', 'Saxla:')} ${e.hold}s • ${tr('mentalhealthtracker_burax_colon', 'Burax:')} ${e.exhale}s',
                                  style: px(12, weight: FontWeight.w600, color: a.greenInk, height: 16 / 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ]),
            APillButton(
              label: tr('mentalhealthtracker_basla_4820bc', 'Başla'),
              icon: const AIcon(AIcons.wind, size: 16, strokeWidth: 2.2),
              height: 48,
              expand: true,
              background: a.green2,
              onTap: () {
                setState(() {
                  _phase = 'inhale';
                  _count = 0;
                });
                _schedule();
              },
            ),
          ])
        else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(end: _phase == 'exhale' ? 1 : 1.4),
                  duration: Duration(
                    seconds: ex == null
                        ? 0
                        : (_phase == 'inhale'
                              ? ex.inhale
                              : _phase == 'hold'
                              ? ex.hold
                              : ex.exhale),
                  ),
                  builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
                  child: AnimatedContainer(
                    duration: Duration(
                      seconds: ex == null
                          ? 0
                          : (_phase == 'inhale'
                                ? ex.inhale
                                : _phase == 'hold'
                                ? ex.hold
                                : ex.exhale),
                    ),
                    width: 176,
                    height: 176,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      // MentalHealthTracker.tsx literals: inhale #63bd8b, hold #63acdf, exhale var(--a-peach-2)
                      color: _phase == 'inhale'
                          ? const Color(0xFF63BD8B)
                          : _phase == 'hold'
                          ? const Color(0xFF63ACDF)
                          : a.peach2,
                      boxShadow: const [
                        BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5),
                        BoxShadow(color: Color(0x1A000000), offset: Offset(0, 8), blurRadius: 10, spreadRadius: -6),
                      ],
                    ),
                    child: Text(
                      _phase == 'inhale'
                          ? tr('mentalhealthtracker_nefes_al_50ff18', 'Nəfəs al')
                          : _phase == 'hold'
                          ? tr('mentalhealthtracker_saxla_3c7a2d', 'Saxla')
                          : tr('mentalhealthtracker_burax_3c7a2d', 'Burax'),
                      style: px(24, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 32 / 24),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  '${tr('mentalhealthtracker_dovre_a52cde', 'Dövrə:')} ${_count + 1} / 4',
                  style: px(20, weight: FontWeight.w700, color: a.ink, height: 28 / 20),
                ),
                const SizedBox(height: 16),
                APillButton(
                  kind: APillKind.soft,
                  label: tr('mentalhealthtracker_dayandir_b2ea06', 'Dayandır'),
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  onTap: () {
                    _timer.cancel();
                    setState(() => _phase = 'idle');
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }
}
