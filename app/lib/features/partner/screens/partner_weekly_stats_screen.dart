// Ported from: src/components/partner/v2/PartnerWeeklyStatsScreen.tsx, src/components/partner/WeeklyStatsTab.tsx
//
// Her last 7 days for the partner: water, workouts, calories, average mood (with its trend), and the mood / water /
// workout bar charts per day.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/app_languages.dart' show isPackLanguage;
import '../../../core/i18n/date_utils.dart' show weekdayLabels;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart' show storedCalendarDate;
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show ARingSpinner, FadeRise, Tw;
import 'data/partner_weekly_stats.dart';
import 'screens_ui.dart';

/// `getDayLabels(language)`: Sunday-first short weekday names.
List<String> weeklyDayLabels(String language) {
  if (isPackLanguage(language)) return weekdayLabels(language);
  return switch (language) {
    'en' => const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    'ru' => const ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    'tr' => const ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
    'kk' => const ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'],
    'uz' => const ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
    'ka' => const ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'],
    'de' => const ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    'ar' => const ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
    _ => const ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'],
  };
}

/// `getMoodTrend()`: 'up' / 'down' / 'stable' from the first vs second half of the days with a mood.
String? weeklyMoodTrend(WeeklyStats? stats) {
  if (stats == null) return null;
  final moods = stats.dailyMoods.where((d) => d.mood != null).toList();
  if (moods.length < 2) return null;
  final half = moods.length ~/ 2;
  double avg(Iterable<DailyMoodEntry> l) => l.fold<int>(0, (s, d) => s + (d.mood ?? 0)) / l.length;
  final first = avg(moods.take(half));
  final second = avg(moods.skip(half));
  if (second > first + 0.3) return 'up';
  if (second < first - 0.3) return 'down';
  return 'stable';
}

/// `(value / 1000).toFixed(1)`.
String _liters(num ml) => (ml / 1000).toStringAsFixed(1);

const List<String> _moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];

class PartnerWeeklyStatsScreen extends StatelessWidget {
  const PartnerWeeklyStatsScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => PartnerSubScreen(
        onBack: onBack,
        eyebrow: tr('partnerv2_son_7_gun', 'Son 7 gün'),
        title: tr('syncedfeaturesgrid_heftelik_statistika_292953', 'Həftəlik Statistika'),
        children: const [WeeklyStatsTab()],
      );
}

/// `WeeklyStatsTab`.
class WeeklyStatsTab extends ConsumerWidget {
  const WeeklyStatsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final s = t.shadcn;
    final state = ref.watch(partnerWeeklyStatsProvider);
    final language = ref.watch(userStoreProvider.select((u) => u.language));
    if (state.loading) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 48), child: Center(child: ARingSpinner(size: 32, width: 4, color: s.primary)));
    }
    final stats = state.stats;
    if (stats == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Text(tr('weeklystatstab_statistika_yuklene_bilmedi_96ee1b', 'Statistika yüklənə bilmədi'),
            textAlign: TextAlign.center, style: Tw.base.copyWith(color: s.mutedForeground)),
      );
    }
    final trend = weeklyMoodTrend(stats);
    final labels = weeklyDayLabels(language);
    String dayName(String date) {
      final d = storedCalendarDate(date);
      return d == null ? '' : labels[d.weekday % 7];
    }

    final dark = t.isDark;
    const white = Color(0xFFFFFFFF);
    const white70 = Color(0xB3FFFFFF);

    Widget summary(int i, Gradient gradient, Widget icon, String value, String label) => FadeRise(
          delay: Duration(milliseconds: i * 50),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(TwRadius.r2xl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: icon),
              Text(value, style: const TextStyle(fontSize: 24, height: 32 / 24, fontWeight: FontWeight.w900, color: white)),
              Text(label, style: Tw.sm.copyWith(color: white70)),
            ]),
          ),
        );

    LinearGradient br(Color a, Color b) => LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a, b]);
    Widget opaqueIcon(AIconData icon) => Opacity(opacity: 0.8, child: AIcon(icon, size: 24, color: white));

    Widget chartCard(int delayMs, String title, double height, List<Widget> columns, {Widget? footer}) => FadeRise(
          delay: Duration(milliseconds: delayMs),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: s.card,
              borderRadius: BorderRadius.circular(TwRadius.r2xl),
              border: Border.all(color: s.border.withValues(alpha: 0.5)),
              boxShadow: s.shadowCard,
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(title, style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: s.foreground)),
              ),
              SizedBox(
                height: height,
                // `items-end`: a column taller than the row (mood chart: 139 in h-32) spills upwards, as in CSS.
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  for (var i = 0; i < columns.length; i++) ...[
                    if (i > 0) const SizedBox(width: 4),
                    Expanded(child: OverflowBox(alignment: Alignment.bottomCenter, maxHeight: double.infinity, child: columns[i])),
                  ],
                ]),
              ),
              ?footer,
            ]),
          ),
        );

    Widget bar(double barHeight, double fraction, Color color) => Container(
          constraints: const BoxConstraints(maxWidth: 40),
          height: barHeight,
          alignment: Alignment.bottomCenter,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: fraction),
            duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 500),
            builder: (context, v, _) => FractionallySizedBox(
              heightFactor: v,
              widthFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.vertical(top: Radius.circular(TwRadius.lg))),
              ),
            ),
          ),
        );

    final small = TextStyle(fontSize: 10, height: 15 / 10, color: s.mutedForeground);
    const moodColors = [TwColors.red400, TwColors.orange400, TwColors.yellow400, TwColors.lime400, TwColors.green400];
    bool validMood(int? m) => m != null && m >= 1 && m <= 5;

    return FadeRise(
      dy: 0,
      dx: -20,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('weeklystatstab_heftelik_statistika_292953', 'Həftəlik Statistika'), style: Tw.lg.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, c) {
          final w = (c.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [
            SizedBox(
              width: w,
              child: summary(0, br(TwColors.cyan500, TwColors.blue600), opaqueIcon(AIcons.droplets), '${_liters(stats.totalWater)}L',
                  tr('weeklystatstab_umumi_su_88c3c9', 'Ümumi su')),
            ),
            SizedBox(
              width: w,
              child: summary(1, br(TwColors.violet500, TwColors.purple600), opaqueIcon(AIcons.dumbbell), '${stats.exerciseCount}',
                  tr('weeklystatstab_mesq_sayi_fabe6b', 'Məşq sayı')),
            ),
            SizedBox(
              width: w,
              // from-[#FF8D89] to-[#FF5A5F] (WeeklyStatsTab.tsx:119)
              child: summary(2, br(const Color(0xFFFF8D89), const Color(0xFFFF5A5F)), opaqueIcon(AIcons.flame), '${stats.totalCalories}',
                  tr('untranslated_kalori_y6oaf2', 'Kalori')),
            ),
            SizedBox(
              width: w,
              // from-[#FF8AA4] to-[#E2464B] (WeeklyStatsTab.tsx:130)
              child: summary(
                3,
                br(const Color(0xFFFF8AA4), const Color(0xFFE2464B)),
                Row(children: [
                  opaqueIcon(AIcons.smile),
                  const SizedBox(width: 8),
                  if (trend == 'up') const AIcon(AIcons.trendingUp, size: 16, color: white),
                  if (trend == 'down') const AIcon(AIcons.trendingDown, size: 16, color: white),
                  if (trend == 'stable') const AIcon(AIcons.minus, size: 16, color: white),
                ]),
                stats.avgMood.toStringAsFixed(1),
                tr('weeklystatstab_orta_ehval_1f8ef9', 'Orta əhval'),
              ),
            ),
          ]);
        }),
        const SizedBox(height: 16),
        chartCard(200, tr('weeklystatstab_ehval_deyisiklikleri_7de49c', 'Əhval Dəyişiklikləri'), 128, [
          for (final day in stats.dailyMoods)
            Column(mainAxisSize: MainAxisSize.min, children: [
              bar(80, day.mood != null ? day.mood! / 5 : 0.1, validMood(day.mood) ? moodColors[day.mood! - 1] : s.muted),
              const SizedBox(height: 8),
              Text(validMood(day.mood) ? _moodEmojis[day.mood! - 1] : '—', style: const TextStyle(fontSize: 20, height: 28 / 20)),
              const SizedBox(height: 8),
              Text(dayName(day.date), style: small.copyWith(fontWeight: FontWeight.w500), maxLines: 1),
            ]),
        ]),
        const SizedBox(height: 16),
        chartCard(
          250,
          tr('weeklystatstab_su_icme_ml_1d5ae9', 'Su İçmə (ml)'),
          96,
          [
            for (final day in stats.dailyMoods)
              Column(mainAxisSize: MainAxisSize.min, children: [
                bar(60, day.waterIntake != 0 ? (day.waterIntake / 2500).clamp(0, 1).toDouble() : 0.05,
                    day.waterIntake >= 2000 ? (dark ? TwColors.cyan400 : TwColors.cyan500) : (dark ? TwColors.cyan600 : TwColors.cyan300)),
                const SizedBox(height: 8),
                Text(day.waterIntake > 0 ? '${_liters(day.waterIntake)}L' : '—', style: small.copyWith(fontWeight: FontWeight.w500), maxLines: 1),
                const SizedBox(height: 8),
                Text(dayName(day.date), style: small, maxLines: 1),
              ]),
          ],
          footer: Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(children: [
              Container(width: 12, height: 12, decoration: BoxDecoration(color: dark ? TwColors.cyan400 : TwColors.cyan500, borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 8),
              Flexible(child: Text(tr('weeklystatstab_hedefe_catdi_2l_23ea87', 'Hədəfə çatdı (2L+)'), style: Tw.xs.copyWith(color: s.mutedForeground))),
              const SizedBox(width: 16),
              Container(width: 12, height: 12, decoration: BoxDecoration(color: dark ? TwColors.cyan600 : TwColors.cyan300, borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 8),
              Flexible(child: Text(tr('weeklystatstab_hedef_alti_2de340', 'Hədəf altı'), style: Tw.xs.copyWith(color: s.mutedForeground))),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        chartCard(300, tr('weeklystatstab_mesqler_603be9', 'Məşqlər'), 96, [
          for (final day in stats.exerciseData)
            Column(mainAxisSize: MainAxisSize.min, children: [
              bar(60, day.minutes != 0 ? (day.minutes / 60).clamp(0, 1).toDouble() : 0.05,
                  day.count > 0 ? (dark ? TwColors.violet400 : TwColors.violet500) : s.muted),
              const SizedBox(height: 8),
              Text(day.minutes > 0 ? '${day.minutes}dk' : '—', style: small.copyWith(fontWeight: FontWeight.w500), maxLines: 1),
              const SizedBox(height: 8),
              Text(dayName(day.date), style: small, maxLines: 1),
            ]),
        ]),
      ]),
    );
  }
}
