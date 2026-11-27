// Ported from: src/components/tools/Exercises.tsx
//
// Pregnancy / postpartum exercises (`exercise`): today's stats, the day's tip, Health workouts of the week (shown
// separately from the fixed-value completions), the filtered list and the step-by-step detail with "Done".
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/data/health_service.dart' show healthConnectedProvider, healthWorkoutsQuery;
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../data/dynamic_config.dart' show exercisesQuery;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'exercise_logs.dart';

class Exercises extends ConsumerStatefulWidget {
  const Exercises({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<Exercises> createState() => _ExercisesState();
}

class _ExercisesState extends ConsumerState<Exercises> {
  String? _selectedId;
  int _currentStep = 0;

  (Color, Color) _levelStyle(String level, ATokens a) => switch (level) {
        'easy' => (a.green1, a.greenInk),
        'medium' => (a.yellow1, a.warnInk),
        'hard' => (a.pink1, a.pinkInk),
        _ => (a.surfaceSoft, a.inkSoft),
      };

  String _levelLabel(String level) => level == 'easy'
      ? tr('exercises_level_easy', 'Asan')
      : level == 'medium'
          ? tr('exercises_level_medium', 'Orta')
          : tr('exercises_cetin_4bf032', 'Çətin');

  void _close() => setState(() {
        _selectedId = null;
        _currentStep = 0;
      });

  Future<void> _complete(ExerciseItem? e) async {
    if (e != null) await ref.read(exerciseLogsProvider.notifier).addLog(e.id, e.name, e.duration, e.calories);
    if (mounted) _close();
  }

  @override
  Widget build(BuildContext context) {
    final logs = ref.watch(exerciseLogsProvider);
    final exQ = ref.watch(exercisesQuery);
    if (logs.loading || exQ.isLoading) return const ToolLoading();

    final a = context.a;
    final store = ref.watch(userStoreProvider);
    final trimester = store.getPregnancyData()?.trimester ?? 2;
    final isMommy = store.lifeStage == 'mommy';
    final postpartum = isMommy ? store.getPostpartumWeek() : null;
    final postpartumWeek = postpartum?.week ?? 0;
    final exercises = [for (final r in exQ.data ?? const <Map<String, dynamic>>[]) ExerciseItem.fromRow(r)];
    final filtered = filterExercises(exercises, isMommy: isMommy, trimester: trimester, postpartumWeek: postpartumWeek, deliveryType: postpartum?.deliveryType);
    final selected = exercises.where((e) => e.id == _selectedId).firstOrNull;
    final stats = logs.todayStats();
    final streak = exerciseStreak(logs.logs);
    final connected = ref.watch(healthConnectedProvider);
    final workouts = connected ? (ref.watch(healthWorkoutsQuery(7)).data ?? const []) : const [];
    final weekMinutes = (workouts.fold<num>(0, (s, w) => s + w.duration) / 60).round();
    final weekCalories = workouts.fold<num>(0, (s, w) => s + w.calories);

    Widget stat(Color bg, Color ink, AIconData icon, String value, String label, int delay) => FadeRise(
          delay: Duration(milliseconds: delay),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: AIcon(icon, size: 20, color: ink)),
              Text(value, style: AStyles.heading(context, 22, color: ink)),
              Opacity(opacity: 0.8, child: Text(label, textAlign: TextAlign.center, style: px(12, weight: FontWeight.w600, color: ink, height: 16 / 12))),
            ]),
          ),
        );

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: selected != null ? _close : widget.onBack,
          eyebrow: isMommy
              ? '${tr('exercises_postpartum_week_prefix', 'Doğuşdan')} $postpartumWeek. ${tr('exercises_postpartum_week_suffix', 'həftə')}'
              : '$trimester${tr('exercises_trimester_ucun_a94dca', '. trimester üçün')}',
          title: selected != null
              ? selected.name
              : isMommy
                  ? tr('exercises_postpartum_title', 'Doğuşdan Sonra Məşqlər')
                  : tr('exercises_hamile_mesqleri_139b99', 'Hamilə Məşqləri'),
        ),
        AGridCols(columns: 3, gap: 12, children: [
          stat(a.blue1, a.blueInk, AIcons.check, '${stats.completedCount}', tr('exercises_bu_gun_786fd4', 'Bu gün'), 100),
          stat(a.peach1, a.accentInk, AIcons.flame, _n(stats.totalCalories), tr('untranslated_kalori_y6oaf2', 'Kalori'), 150),
          stat(a.yellow1, a.warnInk, AIcons.trophy, '$streak', tr('exercises_gun_ardicil_42e659', 'Gün ardıcıl'), 200),
        ]),
        const SizedBox(height: 16),
        KeyedSubtree(
          key: ValueKey(selected == null ? 'list' : 'detail'),
          child: selected == null ? _list(context, filtered, logs, connected, workouts.length, weekMinutes, weekCalories) : _detail(context, selected),
        ),
        SafetyStrip(
          signs: isMommy
              ? tr('safety_exercise_signs_postpartum', 'Dayanın, zəng edin: güclü qanaxma, döş ağrısı, təngnəfəslik, baldır ağrısı, başgicəllənmə')
              : tr('safety_exercise_signs', 'Dayanın, zəng edin: qanaxma, su gəlməsi, başgicəllənmə, döş/baldır ağrısı, ağrılı sancılar'),
        ),
        if (!isMommy)
          SafetyMore(
            summary: tr('safety_exercise_check_title', 'Əvvəlcə həkimlə danışın, əgər:'),
            text: tr('safety_exercise_check_text', 'plasenta previa, serklaj və ya uşaqlıq boynu çatışmazlığı, qanaxma, vaxtından əvvəl doğuş riski, ağır anemiya, preeklampsiya'),
          ),
      ]),
    );
  }

  static String _n(num v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';

  Widget _list(BuildContext context, List<ExerciseItem> filtered, ExerciseLogsState logs, bool connected, int workoutCount, int weekMinutes, num weekCalories) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      FadeRise(
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: ACard(
            child: Row(children: [
              AListIconBox(gradient: a.gradYellow, child: AIcon(AIcons.star, size: 17, strokeWidth: 2.2, color: a.warnInk)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('exercises_gunun_tovsiyesi_f10d9b', 'Günün tövsiyəsi'), style: AStyles.listTitle(context)),
                  Text(tr('exercises_20_deq_gezinti_kegel_mesqleri_797636', '20 dəq gəzinti + Kegel məşqləri'), style: AStyles.listSub(context)),
                ]),
              ),
              const SizedBox(width: 12),
              ARankTagBox(tr('exercises_tovsiye_712d0f', 'Tövsiyə'), background: a.yellow1, color: a.warnInk),
            ]),
          ),
        ),
      ),
      if (connected && workoutCount > 0)
        FadeRise(
          delay: const Duration(milliseconds: 50),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: ACard(
              color: a.lav1,
              child: Row(children: [
                AListIconBox(gradient: a.gradLav, child: AIcon(AIcons.heartPulse, size: 17, strokeWidth: 2.2, color: a.lavInk)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('exercises_health_real_activity', 'Bu həftə real fəaliyyətiniz (Health-dən)'), style: AStyles.listTitle(context)),
                    Text('$workoutCount ${tr('health_workouts_week', 'Məşq (7 gün)').toLowerCase()} · $weekMinutes ${tr('health_min', 'dəq')} · ${_n(weekCalories)} kcal',
                        style: AStyles.listSub(context)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ASectionHeadRow(title: tr('exercises_sizin_ucun_mesqler_d614cc', 'Sizin üçün məşqlər'), trailing: AIcon(AIcons.sparkles, size: 15, color: a.peach2)),
      if (filtered.isEmpty)
        ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
          child: Column(children: [
            Container(
              width: 80,
              height: 80,
              margin: const EdgeInsets.only(bottom: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(24)),
              child: AIcon(AIcons.dumbbell, size: 40, color: a.blue2),
            ),
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(tr('exercises_mesq_tapilmadi_088b54', 'Məşq tapılmadı'), style: AStyles.listTitle(context))),
            Text(tr('exercises_admin_panelden_mesq_elave_edin_acce7f', 'Admin paneldən məşq əlavə edin'), textAlign: TextAlign.center, style: AStyles.listSub(context)),
          ]),
        )
      else
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: vgap(12, [
            for (var i = 0; i < filtered.length; i++)
              FadeRise(delay: Duration(milliseconds: (i * 80).clamp(0, 400)), child: _exerciseCard(context, filtered[i], logs.isCompletedToday(filtered[i].id))),
          ]),
        ),
    ]);
  }

  Widget _exerciseCard(BuildContext context, ExerciseItem e, bool done) {
    final a = context.a;
    final (lbg, link) = _levelStyle(e.level, a);
    return ATap(
      semanticLabel: e.name,
      onTap: () => setState(() => _selectedId = e.id),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: done ? a.green1 : a.surface,
          borderRadius: BorderRadius.circular(a.radiusLg),
          border: done ? null : Border.all(color: a.line),
          boxShadow: a.cardShadow,
        ),
        child: Row(children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: done ? null : a.blue1, gradient: done ? a.gradGreen : null, borderRadius: BorderRadius.circular(16)),
            child: Text(done ? '✅' : e.icon, style: const TextStyle(fontSize: 24, height: 1.2)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.name, style: AStyles.listTitle(context, color: done ? a.greenInk : null)),
              Text(e.description, maxLines: 1, overflow: TextOverflow.ellipsis, style: AStyles.listSub(context, color: done ? a.greenInk.withValues(alpha: 0.7) : null)),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Wrap(spacing: 12, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.clock, size: 14, color: done ? a.greenInk : a.blueInk),
                    const SizedBox(width: 4),
                    Text('${_n(e.duration)} ${tr('exercises_deq_780a5c', 'dəq')}', style: px(12, weight: FontWeight.w600, color: done ? a.greenInk : a.blueInk, height: 16 / 12)),
                  ]),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.flame, size: 14, color: done ? a.greenInk : a.accentInk),
                    const SizedBox(width: 4),
                    Text('${_n(e.calories)} kcal', style: px(12, weight: FontWeight.w600, color: done ? a.greenInk : a.accentInk, height: 16 / 12)),
                  ]),
                  APill(_levelLabel(e.level),
                      background: done ? a.chipOverlay : lbg,
                      color: done ? a.greenInk : link,
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      fontSize: 12,
                      weight: FontWeight.w700),
                ]),
              ),
            ]),
          ),
          const SizedBox(width: 16),
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: done ? a.chipOverlay : a.surfaceSoft, shape: BoxShape.circle),
            child: done ? AIcon(AIcons.check, size: 20, color: a.greenInk) : AIcon(AIcons.chevronRight, size: 20, color: a.inkFaint, mirrorInRtl: true),
          ),
        ]),
      ),
    );
  }

  Widget _detail(BuildContext context, ExerciseItem e) {
    final a = context.a;
    Widget metric(Color bg, Color ink, AIconData icon, String value, String label) => Column(children: [
          Container(
            width: 40,
            height: 40,
            margin: const EdgeInsets.only(bottom: 4),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
            child: AIcon(icon, size: 20, color: ink),
          ),
          Text(value, style: px(16, weight: FontWeight.w700, color: a.ink, height: 24 / 16)),
          Text(label, style: px(10, color: a.inkSoft)),
        ]);
    return FadeRise(
      dx: 50,
      dy: 0,
      child: ACard(
        variant: ACardVariant.list,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(gradient: a.gradBlue),
            child: Column(children: [
              Container(
                width: 80,
                height: 80,
                margin: const EdgeInsets.only(bottom: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: const Color(0x59FFFFFF), borderRadius: BorderRadius.circular(24)),
                child: Text(e.icon, style: const TextStyle(fontSize: 36, height: 1.2)),
              ),
              // `color: '#153e57'` (Exercises.tsx literal)
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(e.name, textAlign: TextAlign.center, style: AStyles.heading(context, 20, color: const Color(0xFF153E57)))),
              Opacity(opacity: 0.8, child: Text(e.description, textAlign: TextAlign.center, style: px(14, color: const Color(0xFF153E57), height: 20 / 14))),
            ]),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
            child: AGridCols(columns: 3, gap: 12, children: [
              metric(a.blue1, a.blueInk, AIcons.clock, _n(e.duration), tr('exercises_deqiqe_94641a', 'dəqiqə')),
              metric(a.peach1, a.accentInk, AIcons.flame, _n(e.calories), 'kcal'),
              metric(a.lav1, a.lavInk, AIcons.award, _levelLabel(e.level), tr('exercises_seviyye_f242cf', 'səviyyə')),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: [
                  AIcon(AIcons.play, size: 16, color: a.blue2),
                  const SizedBox(width: 8),
                  Text(tr('exercises_addimlar_7d0a29', 'Addımlar'), style: AStyles.heading(context, 16)),
                ]),
              ),
              vgap(8, [
                for (var i = 0; i < e.steps.length; i++)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: i == _currentStep ? a.blue1 : a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i < _currentStep ? a.green2 : i == _currentStep ? a.blue2 : a.lineStrong,
                        ),
                        child: Text(i < _currentStep ? '✓' : '${i + 1}',
                            style: px(12, weight: FontWeight.w700, color: i <= _currentStep ? const Color(0xFFFFFFFF) : a.inkSoft, height: 16 / 12)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(e.steps[i],
                              style: px(14, weight: i == _currentStep ? FontWeight.w600 : FontWeight.w400, color: i == _currentStep ? a.blueInk : a.inkSoft, height: 20 / 14)),
                        ),
                      ),
                    ]),
                  ),
              ]),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: APillButton(kind: APillKind.soft, label: tr('common_back', 'Geri'), height: 48, expand: true, tapScale: 0.98, onTap: _close)),
              const SizedBox(width: 12),
              Expanded(
                child: APillButton(
                  label: tr('exercises_bitirdim', 'Bitirdim'),
                  icon: const AIcon(AIcons.check, size: 16, strokeWidth: 2.2),
                  height: 48,
                  expand: true,
                  tapScale: 0.98,
                  background: a.green2,
                  onTap: () => _complete(e),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
