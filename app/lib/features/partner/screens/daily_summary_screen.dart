// Ported from: src/components/partner/DailySummaryScreen.tsx
//
// Her daily summaries for the partner (masked by her sharing settings): mood, then water / kicks / contractions in
// pregnancy, or her own day (partner_day_stage_stats_v1) in the baby and cycle stages; symptoms and notes.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/cache/cache.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../../domain/models/anacan.dart' as anacan;
import '../../settings/ui/settings_ui.dart' show FadeRise;
import '../data/daily_summary.dart';
import '../data/partner_backend.dart';
import '../data/partner_data.dart';
import '../ui/partner_ui.dart';
import 'screens_ui.dart';

/// `useQuery(['partner-day-stage', date])` → `partner_day_stage_stats_v1` (60 s stale).
final partnerDayStageQuery = queryProviderFamily<Map<String, dynamic>?, String>((ref, date) => QueryOptions<Map<String, dynamic>?>(
      queryKey: ['partner-day-stage', date],
      staleTime: const Duration(seconds: 60),
      codec: QueryCodecs.maybeRow,
      queryFn: (_) async {
        final data = await ref.read(partnerBackendProvider).rpc('partner_day_stage_stats_v1', {'p_date': date});
        return data is Map ? Map<String, dynamic>.from(data) : null;
      },
    ), name: 'partnerDayStageQuery');

const List<String> _moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];

/// `getMoodEmoji(mood)`.
String summaryMoodEmoji(int? mood) => mood == null || mood == 0 || mood < 1 || mood > 5 ? '❓' : _moodEmojis[mood - 1];

/// `getMoodLabel(mood)`.
String summaryMoodLabel(int? mood) {
  final none = tr('partner_qeyd_yox', 'Qeyd yox');
  if (mood == null || mood == 0) return none;
  final labels = [
    tr('dailysummaryscreen_cox_pis_e041c5', 'Çox pis'),
    tr('common_pis', 'Pis'),
    tr('common_normal', 'Normal'),
    tr('dailysummaryscreen_yaxsi_9d8595', 'Yaxşı'),
    tr('dailysummaryscreen_ela_720a0e', 'Əla'),
  ];
  return mood >= 1 && mood <= 5 ? labels[mood - 1] : none;
}

/// `formatDate(dateStr)`: today / yesterday / `d MMMM`. The day is read as a local calendar day (React parsed
/// `new Date('YYYY-MM-DD')` as UTC midnight, a day early west of Greenwich).
String summaryDateLabel(String dateStr, [DateTime? now]) {
  final date = storedCalendarDate(dateStr) ?? DateTime.tryParse(dateStr)?.toLocal();
  if (date == null) return dateStr;
  final n = now ?? DomainClock.now();
  final today = DateTime(n.year, n.month, n.day);
  final day = DateTime(date.year, date.month, date.day);
  if (day == today) return tr('dailysummaryscreen_bu_gun_786fd4', 'Bu gün');
  if (day == DateTime(today.year, today.month, today.day - 1)) return tr('dailysummaryscreen_dunen_52b701', 'Dünən');
  return formatDatePattern(date, 'd MMMM');
}

String _symptomLabel(String id) {
  final s = anacan.symptoms(tr: tr).where((s) => s.id == id).firstOrNull;
  return s == null ? id : '${s.icon} ${s.label}';
}

class DailySummaryScreen extends ConsumerWidget {
  const DailySummaryScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(dailySummaryProvider);
    final stage = ref.watch(partnerDataProvider.select((d) => d.partnerProfile?.lifeStage));
    if (summary.loading) return const PartnerPageLoader();
    final summaries = summary.summaries;
    return PartnerSubScreen(
      onBack: onBack,
      title: tr('dailysummaryscreen_gundelik_xulase_3d07a5', 'Gündəlik Xülasə'),
      children: [
        if (summaries.isEmpty)
          PartnerEmptyCard(
            icon: AIcons.calendar,
            title: tr('dailysummaryscreen_helelik_xulase_yoxdur_f1d180', 'Hələlik xülasə yoxdur'),
            sub: tr('dailysummaryscreen_partnyorunuz_gundelik_melumatl_0be3a8', 'Partnyorunuz gündəlik məlumatlarını qeyd etdikdə burada xülasə görəcəksiniz'),
          )
        else
          for (final (i, s) in summaries.indexed) ...[
            if (i > 0) const SizedBox(height: 14),
            FadeRise(
              key: ValueKey('summary-${s.id}'),
              delay: Duration(milliseconds: i * 50),
              child: _SummaryCard(summary: s, recent: i == 0, stage: stage),
            ),
          ],
      ],
    );
  }
}

Widget _tile(Color bg, Color ink, String value, String label, {Widget? icon, Color? valueColor}) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Column(children: [
        if (icon != null) Padding(padding: const EdgeInsets.only(bottom: 4), child: icon),
        Text(value, textAlign: TextAlign.center, style: pText(16, weight: FontWeight.w800, color: valueColor ?? ink)),
        Text(label, textAlign: TextAlign.center, style: pText(10.5, color: ink)),
      ]),
    );

Widget _grid(List<Widget> tiles, int columns) => LayoutBuilder(builder: (context, c) {
      const gap = 10.0;
      final w = (c.maxWidth - gap * (columns - 1)) / columns;
      return Wrap(spacing: gap, runSpacing: gap, children: [for (final t in tiles) SizedBox(width: w, child: t)]);
    });

/// `<StageTiles date water />`: mommy / flow days.
class _StageTiles extends ConsumerWidget {
  const _StageTiles({required this.date, required this.water});
  final String date;
  final num water;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final data = ref.watch(partnerDayStageQuery(date)).data;
    final waterTile = _tile(a.blue1, a.blueInk, '💧 ${water}ml', tr('untranslated_su_yvcozn', 'Su'));
    final stage = data?['stage'];
    if (stage == 'mommy' && data?['feeds'] is num) {
      final sleep = data?['sleep_min'] is num ? (data!['sleep_min'] as num).toInt() : 0;
      final feedMl = data?['feed_ml'];
      final feeds = (data!['feeds'] as num);
      return _grid([
        _tile(a.peach1, a.accentInk, '🍼 $feeds${feedMl is num && feedMl != 0 ? ' · ${feedMl}ml' : ''}', tr('partnerv2_qidalanma', 'Qidalanma')),
        _tile(a.lav1, a.lavInk, '😴 ${sleep ~/ 60}:${(sleep % 60).toString().padLeft(2, '0')}', tr('partnerv2_yuxu', 'Yuxu')),
        _tile(a.green1, a.greenInk, '🧷 ${data['diapers'] is num ? data['diapers'] : 0}', tr('partnerv2_bez', 'Bez')),
        waterTile,
      ], 2);
    }
    if (stage == 'flow' && data?['cycle_day'] is num) {
      final phase = data!['phase'];
      final emoji = switch (phase) { 'menstrual' => '🩸', 'fertile' => '🌸', 'follicular' => '🌱', _ => '🌙' };
      return _grid([
        _tile(a.pink1, a.pinkInk, '$emoji ${data['cycle_day']}/${data['cycle_length']}', tr('partnerflowstatuscard_tsikl_gunu_b9e250', 'Tsikl günü')),
        waterTile,
      ], 2);
    }
    return stage == 'mommy' || stage == 'flow' ? _grid([waterTile], 2) : const SizedBox.shrink();
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary, required this.recent, required this.stage});
  final DailySummary summary;
  final bool recent;
  final String? stage;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final mood = summary.mood;
    final symptoms = summary.symptoms ?? const <String>[];
    final notes = summary.notes;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(a.radiusMd),
        boxShadow: a.cardShadow,
        border: Border.all(color: recent ? a.blue2 : const Color(0x00000000), width: 1.5),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
          child: Row(children: [
            Expanded(child: Text(summaryDateLabel(summary.summaryDate), style: pText(14, weight: FontWeight.w700, color: a.ink))),
            if (recent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
                child: Text(tr('dailysummaryscreen_en_son_473654', 'Ən son'), style: pText(10.5, weight: FontWeight.w800, color: a.blueInk)),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: mood != null && mood >= 4 ? a.green1 : (mood != null && mood != 0 && mood <= 2 ? a.pink1 : a.surfaceSoft),
                ),
                child: Text(summaryMoodEmoji(mood), style: const TextStyle(fontSize: 24, height: 32 / 24)),
              ),
              const SizedBox(width: 16),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('dailysummaryscreen_ehval_0457f9', 'Əhval'), style: pText(12, color: a.inkSoft)),
                Text(summaryMoodLabel(mood), style: pText(14, weight: FontWeight.w700, color: a.ink)),
              ]),
            ]),
            const SizedBox(height: 16),
            if (stage == 'mommy' || stage == 'flow')
              _StageTiles(date: summary.summaryDate, water: summary.waterIntake)
            else
              _grid([
                _tile(a.blue1, a.blueInk, '${summary.waterIntake}ml', tr('untranslated_su_yvcozn', 'Su'), icon: AIcon(AIcons.droplets, size: 18, color: a.blueInk)),
                _tile(a.pink1, a.pinkInk, '${summary.kickCount}', tr('dailysummaryscreen_tepik_9a873a', 'Təpik'),
                    icon: AIcon(AIcons.heart, size: 18, color: a.pinkInk), valueColor: a.alertInk),
                _tile(a.lav1, a.lavInk, '${summary.contractionCount}', tr('dailysummaryscreen_sanci_350c2d', 'Sancı'), icon: AIcon(AIcons.activity, size: 18, color: a.lavInk)),
              ], 3),
            if (symptoms.isNotEmpty) ...[
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(tr('untranslated_simptomlar_xhm7bx', 'Simptomlar'), style: pText(12, color: a.inkSoft)),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final s in symptoms)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0x00000000))),
                    child: Text(_symptomLabel(s), style: pText(11.5, weight: FontWeight.w600, color: a.inkSoft)),
                  ),
              ]),
            ],
            if (notes != null && notes.isNotEmpty) ...[
              const SizedBox(height: 16),
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('dailysummaryscreen_qeydler_a7a98b', 'Qeydlər'), style: pText(12, color: a.inkSoft))),
              Text(notes, style: pText(13, color: a.bodyText)),
            ],
          ]),
        ),
      ]),
    );
  }
}
