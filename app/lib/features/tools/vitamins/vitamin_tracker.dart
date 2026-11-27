// Ported from: src/components/tools/VitaminTracker.tsx
//
// Vitamin tracker (`vitamin-tracker`): today's schedules with a taken toggle (offline outbox), reminder bell, delete,
// and the add modal (presets from the vitamins table, time, days, reminder). Reminders are sent by the server job.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/app_languages.dart' show isPackLanguage;
import '../../../core/i18n/date_utils.dart' show weekdayLabels;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../legal/medical_disclaimer.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, px;
import '../health_common/health_common.dart';
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import 'vitamin_data.dart';

List<({String name, String emoji})> vitaminPresets() => [
      (name: tr('vitamintracker_folat_fol_tursusu_941d76', 'Folat (Fol turşusu)'), emoji: '🟢'),
      (name: tr('vitamintracker_d_vitamini', 'D vitamini'), emoji: '☀️'),
      (name: tr('vitamintracker_demir_30bf6c', 'Dəmir'), emoji: '🔴'),
      (name: tr('vitamintracker_kalsium', 'Kalsium'), emoji: '🦴'),
      (name: tr('vitamintracker_omega_3', 'Omega-3'), emoji: '🐟'),
      (name: tr('vitamintracker_b12_vitamini', 'B12 vitamini'), emoji: '💜'),
      (name: tr('vitamintracker_c_vitamini', 'C vitamini'), emoji: '🍊'),
      (name: tr('vitamintracker_maqnezium', 'Maqnezium'), emoji: '💎'),
      (name: tr('vitamintracker_sink', 'Sink'), emoji: '⚡'),
      (name: tr('vitamintracker_yod', 'Yod'), emoji: '🌊'),
      (name: tr('vitamintracker_prenatal_vitamin', 'Prenatal vitamin'), emoji: '💊'),
      (name: tr('vitamintracker_probiotik', 'Probiotik'), emoji: '🦠'),
    ];

/// `getDayLabels(language)`: Sunday-first short weekday labels.
List<String> vitaminDayLabels(String language) {
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

const List<String> _emojis = ['💊', '🟢', '☀️', '🔴', '🦴', '🐟', '💜', '🍊', '💎', '⚡', '🌊', '🦠'];

class VitaminTracker extends ConsumerStatefulWidget {
  const VitaminTracker({super.key, this.onBack});
  final VoidCallback? onBack;

  @override
  ConsumerState<VitaminTracker> createState() => _VitaminTrackerState();
}

class _VitaminTrackerState extends ConsumerState<VitaminTracker> {
  final _name = TextEditingController();
  String _emoji = '💊';
  String _time = '08:00';
  List<int> _days = [0, 1, 2, 3, 4, 5, 6];
  bool _notification = true;
  bool _showPresets = false;
  bool _adding = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _reset() {
    _name.clear();
    _emoji = '💊';
    _time = '08:00';
    _days = [0, 1, 2, 3, 4, 5, 6];
    _notification = true;
  }

  Future<void> _add(BuildContext dialogContext, void Function(VoidCallback) update) async {
    final toasts = AToastHost.of(context);
    if (_name.text.trim().isEmpty) {
      toasts.error(tr('vitamintracker_vitamin_adini_daxil_edin_3784af', 'Vitamin adını daxil edin'));
      return;
    }
    update(() => _adding = true);
    try {
      await ref.read(vitaminActionsProvider).addSchedule(name: _name.text, emoji: _emoji, scheduledTime: '$_time:00', days: _days, notification: _notification);
      toasts.success(tr('vitamintracker_vitamin_elave_edildi_b2e88b', 'Vitamin əlavə edildi'));
      if (dialogContext.mounted) Navigator.of(dialogContext).pop();
      if (mounted) setState(_reset);
    } catch (_) {
      toasts.error(tr('vitamintracker_xeta_bas_verdi_f22fba', 'Xəta baş verdi'));
    } finally {
      if (mounted) update(() => _adding = false);
    }
  }

  Future<void> _toggleTaken(Map<String, dynamic> schedule, List<Map<String, dynamic>> todayLogs, String displayName) async {
    final toasts = AToastHost.of(context);
    await ref.read(healthHapticsProvider).light();
    final log = todayLogs.where((l) => l['schedule_id'] == schedule['id']).firstOrNull;
    try {
      if (log != null) {
        await ref.read(vitaminActionsProvider).undoIntake('${log['id']}');
      } else {
        await ref.read(vitaminActionsProvider).logIntake(schedule);
        toasts.success('$displayName ${tr('vitamintracker_taken_status', 'qəbul edildi ✓')}');
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final dbVitamins = ref.watch(allRawVitaminsQuery).data ?? const <Map<String, dynamic>>[];
    final schedulesQ = ref.watch(vitaminSchedulesQuery);
    final todayLogs = ref.watch(vitaminLogsTodayQuery).data ?? const <Map<String, dynamic>>[];
    final active = (schedulesQ.data ?? const <Map<String, dynamic>>[]).where((s) => s['is_active'] == true).toList();
    bool taken(Object? id) => todayLogs.any((l) => l['schedule_id'] == id);
    final takenCount = active.where((s) => taken(s['id'])).length;
    final total = active.length;
    final progress = total > 0 ? takenCount / total : 0.0;
    final presets = dbVitamins.isNotEmpty
        ? [for (final v in dbVitamins) (name: localizedVitaminName(v, language), emoji: v['icon_emoji'] is String && (v['icon_emoji'] as String).isNotEmpty ? v['icon_emoji'] as String : '💊')]
        : vitaminPresets();

    return ToolPage(
      child: Padding(
        // `<ToolPage className="pb-32">`: 128px bottom instead of 96.
        padding: const EdgeInsets.only(bottom: 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: '${tr('vitamintracker_bugunku_qebul_ae152d', 'Bugünkü qəbul')}: $takenCount/$total',
            title: tr('vitamintracker_vitamin_izleyicisi_049643', 'Vitamin İzləyicisi'),
            actions: [
              AIconBtn(
                semanticLabel: tr('a11y_add', 'Əlavə et'),
                background: a.peach2,
                foreground: const Color(0xFFFFFFFF),
                border: false,
                onTap: () => _openAdd(presets, language),
                icon: const AIcon(AIcons.plus, size: 17, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
              ),
            ],
          ),
          const MedicalDisclaimer(variant: MedicalDisclaimerVariant.compact),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
            decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(999)),
                  child: Text('💊 ${tr('vitamintracker_bugunku_qebul_ae152d', 'Bugünkü qəbul')}', style: px(11, weight: FontWeight.w800, color: a.greenInk, ls: 0.03)),
                ),
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(14)),
                  child: AIcon(AIcons.pill, size: 18, color: a.greenInk),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 10),
                child: Text('$takenCount/$total', style: AStyles.heading(context, 28, color: a.greenInk)),
              ),
              Container(
                height: 8,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: const Color(0x66FFFFFF), borderRadius: BorderRadius.circular(999)),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: progress),
                    duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 500),
                    builder: (context, v, _) => FractionallySizedBox(
                      widthFactor: v,
                      child: Container(decoration: BoxDecoration(color: a.greenInk, borderRadius: BorderRadius.circular(999))),
                    ),
                  ),
                ),
              ),
              if (total > 0 && takenCount == total)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(tr('vitamintracker_butun_vitaminler_qebul_edildi_87d9d1', '🎉 Bütün vitaminlər qəbul edildi!'),
                      style: px(13, weight: FontWeight.w600, color: a.greenInk.withValues(alpha: 0.85), height: 1.7)),
                ),
            ]),
          ),
          const SizedBox(height: 12),
          if (schedulesQ.isLoading)
            vgap(10, [for (var i = 0; i < 3; i++) APulse(child: SizedBox(height: 76, child: ACard(child: const SizedBox.expand())))])
          else if (active.isEmpty)
            ToolEmpty(
              icon: AIcon(AIcons.pill, size: 26, color: a.peach2),
              title: tr('vitamintracker_vitamin_elave_edin_3a46b1', 'Vitamin əlavə edin'),
              text: tr('vitamintracker_gundelik_vitamin_qebulunuzu_izleyin_f8d5c5', 'Gündəlik vitamin qəbulunuzu izləyin'),
              action: APillButton(label: tr('vitamintracker_vitamin_elave_et_287d28', '+ Vitamin əlavə et'), onTap: () => _openAdd(presets, language)),
            )
          else
            AListCardBox(children: [
              for (var i = 0; i < active.length; i++) _row(context, active[i], i == 0, taken(active[i]['id']), todayLogs, dbVitamins, language),
            ]),
        ]),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> s, bool first, bool isTaken, List<Map<String, dynamic>> todayLogs, List<Map<String, dynamic>> dbVitamins, String language) {
    final a = context.a;
    final name = translatedVitaminName('${s['vitamin_name'] ?? ''}', dbVitamins, language);
    final time = '${s['scheduled_time'] ?? ''}'.split(':');
    final notify = s['notification_enabled'] == true;
    return AListRowBox(
      first: first,
      background: isTaken ? a.green1 : null,
      children: [
        ATap(
          scale: 0.85,
          semanticLabel: name,
          selected: isTaken,
          onTap: () => _toggleTaken(s, todayLogs, name),
          child: Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isTaken ? a.green2 : a.surfaceSoft,
              borderRadius: BorderRadius.circular(13),
              border: isTaken ? null : Border.all(color: a.lineStrong, width: 2),
              // 0 8px 16px -8px rgba(99, 189, 139, 0.8) (VitaminTracker.tsx literal)
              boxShadow: isTaken ? [BoxShadow(color: const Color(0xCC63BD8B), offset: const Offset(0, 8), blurRadius: cssBlur(16), spreadRadius: -8)] : null,
            ),
            child: isTaken
                ? const AIcon(AIcons.check, size: 18, strokeWidth: 2.5, color: Color(0xFFFFFFFF))
                : Text('${s['icon_emoji'] ?? ''}', style: const TextStyle(fontSize: 20, height: 1.4)),
          ),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                style: AStyles.listTitle(context, color: isTaken ? a.greenInk : null)
                    .copyWith(decoration: isTaken ? TextDecoration.lineThrough : null, decorationColor: a.greenInk)),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(children: [
                AIcon(AIcons.clock, size: 11, color: a.inkSoft),
                const SizedBox(width: 5),
                Text(time.length >= 2 ? '${time[0]}:${time[1]}' : time.first, style: AStyles.listSub(context)),
                if (notify) ...[const SizedBox(width: 5), AIcon(AIcons.bell, size: 11, color: a.peach2)],
              ]),
            ),
          ]),
        ),
        Row(mainAxisSize: MainAxisSize.min, children: [
          Semantics(
            toggled: notify,
            child: AIconBtn(
              size: 30,
              semanticLabel: tr('vitamintracker_xatirlatma_bildirisi_8da2b8', 'Xatırlatma bildirişi'),
              onTap: () => ref.read(vitaminActionsProvider).updateSchedule('${s['id']}', {'notification_enabled': !notify}).catchError((Object _) {}),
              icon: notify ? AIcon(AIcons.bell, size: 13, color: a.peach2) : const AIcon(AIcons.bellOff, size: 13),
            ),
          ),
          const SizedBox(width: 6),
          AIconBtn(
            size: 30,
            semanticLabel: tr('common_sil', 'Sil'),
            background: a.pink1,
            foreground: a.pinkInk,
            border: false,
            onTap: () async {
              final toasts = AToastHost.of(context);
              try {
                await ref.read(vitaminActionsProvider).deleteSchedule('${s['id']}');
                toasts.success(tr('vitamintracker_vitamin_deleted', 'Vitamin silindi'));
              } catch (_) {}
            },
            icon: AIcon(AIcons.trash2, size: 13, color: a.pinkInk),
          ),
        ]),
      ],
    );
  }

  void _openAdd(List<({String name, String emoji})> presets, String language) {
    showToolDialog<void>(
      context,
      showClose: false,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        void update(VoidCallback f) {
          if (mounted) setState(f);
          setLocal(() {});
        }

        return _addContent(ctx, presets, language, update);
      }),
    );
  }

  Widget _addContent(BuildContext context, List<({String name, String emoji})> presets, String language, void Function(VoidCallback) update) {
    final a = context.a;
    final labels = vitaminDayLabels(language);
    Widget label(String text, [double bottom = 6]) => Padding(padding: EdgeInsets.only(bottom: bottom), child: Text(text, style: AStyles.statLabel(context)));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        Expanded(child: Text(tr('vitamintracker_vitamin_elave_et_ba4a9c', 'Vitamin Əlavə Et'), style: AStyles.cardTitle(context, size: 16))),
        AIconBtn(size: 32, semanticLabel: tr('common_close', 'Bağla'), onTap: () => Navigator.of(context).pop(), icon: const AIcon(AIcons.x, size: 15)),
      ]),
      const SizedBox(height: 16),
      vgap(16, [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => update(() => _showPresets = !_showPresets),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(tr('vitamintracker_hazir_vitaminler_73ff90', 'Hazır vitaminlər'), style: context.aText.aSectionLink.copyWith(color: a.accentInk)),
                const SizedBox(width: 4),
                Transform.rotate(angle: _showPresets ? 3.14159 : 0, child: AIcon(AIcons.chevronDown, size: 14, color: a.accentInk)),
              ]),
            ),
          ),
          if (_showPresets)
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 8),
              child: Wrap(spacing: 8, runSpacing: 8, children: [
                for (final p in presets)
                  ATagChip(
                    onTap: () => update(() {
                      _name.text = p.name;
                      _emoji = p.emoji;
                      _showPresets = false;
                    }),
                    children: [Text('${p.emoji} ${p.name}')],
                  ),
              ]),
            ),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          label(tr('vitamintracker_vitamin_adi_15e0a6', 'Vitamin adı')),
          Row(children: [
            AIconBtn(
              size: 44,
              onTap: () => update(() => _emoji = _emojis[(_emojis.indexOf(_emoji) + 1) % _emojis.length]),
              icon: Text(_emoji, style: const TextStyle(fontSize: 20, height: 1.2)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: AField(
                fieldKey: const ValueKey('vit-name'),
                controller: _name,
                placeholder: tr('vitamintracker_mes_folat_d_vitamini_6e4ad1', 'Məs: Folat, D vitamini...'),
              ),
            ),
          ]),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          label(tr('vitamintracker_qebul_saati_b569b1', 'Qəbul saatı')),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () async {
              final parts = _time.split(':');
              final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])));
              if (picked != null) update(() => _time = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
            },
            child: Container(
              constraints: const BoxConstraints(maxWidth: 140, minHeight: 42),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              alignment: AlignmentDirectional.centerStart,
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
              child: Text(_time, style: px(13, color: a.ink)),
            ),
          ),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          label(tr('vitamintracker_qebul_gunleri_5262ae', 'Qəbul günləri'), 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (var i = 0; i < labels.length; i++)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => update(() => _days = _days.contains(i) ? _days.where((d) => d != i).toList() : ([..._days, i]..sort())),
                child: Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: _days.contains(i) ? a.peach2 : a.surfaceSoft),
                  child: Text(labels[i], style: px(10, weight: FontWeight.w700, color: _days.contains(i) ? const Color(0xFFFFFFFF) : a.inkSoft)),
                ),
              ),
          ]),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              AIcon(AIcons.bell, size: 15, color: a.peach2),
              const SizedBox(width: 8),
              Expanded(child: Text(tr('vitamintracker_xatirlatma_bildirisi_8da2b8', 'Xatırlatma bildirişi'), style: AStyles.listTitle(context, size: 12.5))),
              Semantics(
                toggled: _notification,
                button: true,
                label: tr('vitamintracker_xatirlatma_bildirisi_8da2b8', 'Xatırlatma bildirişi'),
                child: GestureDetector(
                  onTap: () => update(() => _notification = !_notification),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 44,
                    height: 25,
                    decoration: BoxDecoration(color: _notification ? a.peach2 : a.lineStrong, borderRadius: BorderRadius.circular(999)),
                    child: AnimatedAlign(
                      duration: const Duration(milliseconds: 150),
                      alignment: _notification ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                      child: Container(
                        width: 19,
                        height: 19,
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFFFFF),
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Color(0x33000000), offset: Offset(0, 2), blurRadius: 4)],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(top: 8, start: 4, bottom: 4),
            child: Text(tr('vitamintracker_qebul_vaxtindan_5_deqiqe_evvel_023b26', 'Qəbul vaxtından 5 dəqiqə əvvəl bildiriş göndəriləcək'),
                style: AStyles.listTime(context).copyWith(height: 1.5)),
          ),
        ]),
      ]),
      Container(
        margin: const EdgeInsets.only(top: 16),
        padding: const EdgeInsets.only(top: 16),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
        child: APillButton(
          kind: APillKind.solid,
          label: _adding ? tr('vitamintracker_elave_edilir_3c28b4', 'Əlavə edilir...') : tr('vitamintracker_vitamin_elave_et_ba4a9c', 'Vitamin Əlavə Et'),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          expand: true,
          onTap: _adding ? null : () => _add(context, update),
        ),
      ),
    ]);
  }
}
