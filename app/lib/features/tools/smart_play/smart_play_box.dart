// Ported from: src/components/tools/SmartPlayBox.tsx
//
// Ağıllı Oyun Qutusu: play activities for the baby's (corrected) age, matched to the items the family has at home,
// with today's recommendation, a skills overview, the activity detail, a rating after playing and the home items
// picker.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show jsParseDate;
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show getChildAge;
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px, toasts;
import '../health_common/health_common.dart' show healthUserIdProvider;
import '../health_common/health_db.dart';
import '../health_common/health_ui.dart' show AGridCols, AListCardBox, AListIconBox, AListRowBox, APillButton, ARankTagBox, AStyles;
import '../kit/kit.dart';
import '../more_common/more_ui.dart';
import 'play_activities_data.dart';

typedef _Activity = Map<String, dynamic>;

const Map<String, String> _skillIcons = {'motor': '💪', 'sensory': '✋', 'language': '🗣️', 'cognitive': '🧠', 'social': '👥'};

/// `SKILL_STYLES`: (background, ink).
(Color, Color)? _skillStyle(ATokens a, String skill) => switch (skill) {
      'motor' => (a.blue1, a.blueInk),
      'sensory' => (a.lav1, a.lavInk),
      'language' => (a.green1, a.greenInk),
      'cognitive' => (a.yellow1, a.warnInk),
      'social' => (a.pink1, a.pinkInk),
      _ => null,
    };

String? _skillLabel(String skill) => switch (skill) {
      'motor' => '💪 ${tr('smartplaybox_motor', 'Motor')}',
      'sensory' => tr('smartplaybox_duygu_a3bf01', '✋ Duyğu'),
      'language' => '🗣️ ${tr('smartplaybox_dil', 'Dil')}',
      'cognitive' => '🧠 ${tr('playbox_cognitive', 'İdrak')}',
      'social' => '👥 ${tr('smartplaybox_sosial', 'Sosial')}',
      _ => null,
    };

/// `DIFFICULTY_LABELS`: (label, background, ink).
(String, Color, Color)? _difficulty(ATokens a, Object? level) => switch (level) {
      'easy' => (tr('smartplaybox_easy', 'Asan'), a.green1, a.greenInk),
      'medium' => (tr('smartplaybox_medium', 'Orta'), a.yellow1, a.warnInk),
      'hard' => (tr('smartplaybox_cetin_4bf032', 'Çətin'), a.pink1, a.pinkInk),
      _ => null,
    };

String? _categoryLabel(String category) => switch (category) {
      'home' => '🏠 ${tr('common_ev', 'Ev')}',
      'kitchen' => tr('smartplaybox_metbex_4f67cc', '🍳 Mətbəx'),
      'recyclable' => tr('smartplaybox_tekrar_istifade_4effdb', '♻️ Təkrar istifadə'),
      'office' => tr('common_ofis_label', '📎 Ofis'),
      'clothing' => tr('common_paltar_label', '👕 Paltar'),
      'toys' => tr('common_oyuncaq_label', '🧸 Oyuncaq'),
      'education' => tr('smartplaybox_tehsil_ce8208', '📚 Təhsil'),
      'electronics' => tr('common_elektronika_label', '📱 Elektronika'),
      'general' => tr('smartplaybox_umumi_980283', '📦 Ümumi'),
      _ => null,
    };

String _activityEmoji(List<String> skills) {
  if (skills.contains('motor')) return '🤸';
  if (skills.contains('sensory')) return '🎨';
  if (skills.contains('language')) return '📚';
  if (skills.contains('cognitive')) return '🧩';
  if (skills.contains('social')) return '👶';
  return '🎮';
}

/// date-fns `differenceInDays(later, earlier)`: whole 24-hour days (DST-aware calendar days, minus a partial day).
int playDifferenceInDays(DateTime later, DateTime earlier) {
  final sign = later.isBefore(earlier) ? -1 : 1;
  var diff = DateTime(later.year, later.month, later.day).difference(DateTime(earlier.year, earlier.month, earlier.day)).inHours.abs() ~/ 24;
  final shifted = DateTime(earlier.year, earlier.month, earlier.day + sign * diff, earlier.hour, earlier.minute, earlier.second, earlier.millisecond);
  if (sign > 0 ? later.isBefore(shifted) : later.isAfter(shifted)) diff -= 1;
  return sign * diff;
}

/// date-fns `differenceInMonths(later, earlier)`: whole calendar months.
int playDifferenceInMonths(DateTime later, DateTime earlier) {
  final sign = later.isBefore(earlier) ? -1 : 1;
  final (a, b) = sign > 0 ? (later, earlier) : (earlier, later);
  var months = (a.year - b.year) * 12 + (a.month - b.month);
  final shifted = DateTime(b.year, b.month + months, b.day, b.hour, b.minute, b.second, b.millisecond);
  if (a.isBefore(shifted)) months -= 1;
  return sign * months;
}

/// `babyInfo`: days / months (corrected for a premature child) and the eyebrow label.
({int? days, int? months, String label}) playBabyInfo({({int days, int months, bool corrected})? child, String? babyBirthDate, DateTime? now}) {
  String label(int days, int months) {
    if (months < 1) return '$days ${tr('time_days_old', 'günlük')}';
    if (months < 12) return '$months ${tr('time_months_old', 'aylıq')}';
    final years = months ~/ 12;
    final rest = months % 12;
    return '$years ${tr('time_years_old', 'yaş')}${rest > 0 ? ' $rest ${tr('time_month', 'ay')}' : ''}';
  }

  if (child != null) {
    var l = label(child.days, child.months);
    if (child.corrected) l += ' (${tr('preemie_corrected_short', 'korreksiya')})';
    return (days: child.days, months: child.months, label: l);
  }
  if (babyBirthDate == null || babyBirthDate.isEmpty) return (days: null, months: null, label: '');
  final birth = jsParseDate(babyBirthDate)?.toLocal();
  if (birth == null) return (days: null, months: null, label: '');
  final n = now ?? DateTime.now();
  final days = playDifferenceInDays(n, birth);
  final months = playDifferenceInMonths(n, birth);
  return (days: days, months: months, label: label(days, months));
}

/// Activities for the age, the ones matching the home items (most matches first) and today's recommendation.
({List<Map<String, dynamic>> filtered, List<Map<String, dynamic>> matched, Map<String, dynamic>? today}) playRecommendations(
    List<Map<String, dynamic>> all, int? babyDays, List<String> inventory) {
  var activities = all;
  if (babyDays != null) {
    activities = activities.where((a) {
      final min = a['min_age_days'], max = a['max_age_days'];
      return min is num && max is num && babyDays >= min && babyDays <= max;
    }).toList();
  }
  var matched = <_Activity>[];
  if (inventory.isNotEmpty) {
    matched = activities.where((a) {
      final items = activityItems(a);
      if (items.isEmpty) return true;
      return items.any((i) => inventory.contains(playItemKey(i)));
    }).toList();
    int count(_Activity a) => activityItems(a).where((i) => inventory.contains(playItemKey(i))).length;
    final indexed = [for (var i = 0; i < matched.length; i++) (i, matched[i])]..sort((x, y) {
        final c = count(y.$2) - count(x.$2);
        return c != 0 ? c : x.$1 - y.$1;
      });
    matched = [for (final e in indexed) e.$2];
  }
  return (filtered: activities, matched: matched, today: matched.isNotEmpty ? matched.first : activities.firstOrNull);
}

class SmartPlayBox extends ConsumerStatefulWidget {
  const SmartPlayBox({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<SmartPlayBox> createState() => _SmartPlayBoxState();
}

class _SmartPlayBoxState extends ConsumerState<SmartPlayBox> {
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  int _rating = 0;
  bool _logging = false;
  bool _toggling = false;

  void _update(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
    _tick.value++;
  }

  @override
  void dispose() {
    _tick.dispose();
    super.dispose();
  }

  Widget _live(Widget Function(BuildContext context) build) =>
      ValueListenableBuilder<int>(valueListenable: _tick, builder: (context, _, _) => Consumer(builder: (context, ref, _) => build(context)));

  List<String> _inventoryNames() => [for (final i in ref.read(userPlayInventoryQuery).data ?? const <_Activity>[]) playItemKey('${i['item_name'] ?? ''}')];

  bool _isSelected(String itemName) => _inventoryNames().contains(playItemKey(itemName));

  Future<void> _toggleItem(_Activity item) async {
    _update(() => _toggling = true);
    try {
      await togglePlayInventoryItem(ref.read(healthDbProvider), ref.read(healthUserIdProvider), itemName: '${item['name'] ?? ''}', itemNameAz: item['name_az'] as String?);
      await ref.read(queryClientProvider).invalidateQueries(queryKey: const ['user-play-inventory']);
    } catch (_) {
      // useMutation without onError: the failure only rejects the awaited promise.
    } finally {
      _update(() => _toggling = false);
    }
  }

  /// The activity detail; "Oyunu Tamamladım!" swaps it for the rating dialog, and closing that one without saving
  /// brings the detail back (React keeps `selectedActivity` while `showComplete` toggles).
  Future<void> _openActivity(_Activity activity) async {
    while (true) {
      if (!mounted) return;
      final complete = await showMoreDialog<bool>(context, maxWidth: 448, maxHeightFactor: 0.85, padded: false, builder: (_) => _live((c) => _detailContent(c, activity)));
      if (complete != true || !mounted) return;
      final logged = await showMoreDialog<bool>(context, maxWidth: 384, maxHeightFactor: 0.85, builder: (_) => _live((c) => _completeContent(c, activity)));
      if (logged == true) {
        _update(() => _rating = 0);
        return;
      }
    }
  }

  Future<void> _complete(BuildContext dialogContext, _Activity activity) async {
    _update(() => _logging = true);
    try {
      await logPlayActivity(ref.read(healthDbProvider), ref.read(healthUserIdProvider), activityId: '${activity['id']}', rating: _rating > 0 ? _rating : null);
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['play-activity-logs']));
      if (mounted) toasts(context).success(tr('useplayactivities_oyun_tamamlandi_abeae1', 'Oyun tamamlandı! 🎉'));
      if (dialogContext.mounted) Navigator.of(dialogContext).pop(true);
    } catch (_) {
      // The rejected mutateAsync leaves the dialog open (no toast in React).
    } finally {
      _update(() => _logging = false);
    }
  }

  Future<void> _openInventory() => showMoreDialog<void>(context, maxWidth: 448, maxHeightFactor: 0.85, builder: (_) => _live(_inventoryContent));

  Widget _itemChip(BuildContext context, String item, {bool md = false}) {
    final a = context.a;
    final items = ref.read(playInventoryItemsQuery).data ?? const <_Activity>[];
    final inv = items.where((i) => playItemKey('${i['name'] ?? ''}') == playItemKey(item)).firstOrNull;
    final has = _isSelected(item);
    final emoji = inv?['emoji'] is String ? inv!['emoji'] as String : '';
    final name = inv != null && '${inv['name'] ?? ''}'.isNotEmpty ? '${inv['name']}' : item;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: md ? 6 : 4),
      decoration: BoxDecoration(color: has ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (has) ...[AIcon(AIcons.check, size: 12, color: a.greenInk), const SizedBox(width: 4)],
        Flexible(child: Text('$emoji $name'.trimLeft(), style: px(14, weight: FontWeight.w600, color: has ? a.greenInk : a.inkSoft, height: 20 / 14))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final profile = ref.watch(authProfileProvider);
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final age = selectedChild == null ? null : getChildAge(selectedChild);
    final baby = playBabyInfo(
      child: age == null
          ? null
          : (days: age.correctionApplied ? age.correctedDays : age.days, months: age.correctionApplied ? age.correctedMonths : age.months, corrected: age.correctionApplied),
      babyBirthDate: profile?.babyBirthDate,
    );
    ref.watch(playInventoryItemsQuery);
    final userInventory = ref.watch(userPlayInventoryQuery).data ?? const <_Activity>[];
    final activitiesQ = ref.watch(playActivitiesQuery);
    final all = activitiesQ.data ?? const <_Activity>[];
    final names = [for (final i in userInventory) playItemKey('${i['item_name'] ?? ''}')];
    final rec = playRecommendations(all, baby.days, names);
    final today = rec.today;
    final list = rec.matched.isNotEmpty ? rec.matched : rec.filtered;
    final lavWhite = const Color(0xFFFFFFFF);

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: baby.label.isNotEmpty ? '${tr('smartplaybox_korpeniz_da99de', 'Körpəniz')} ${baby.label}' : tr('smartplaybox_bugunku_tovsiye_ec6c3a', 'Bugünkü Tövsiyə'),
          title: tr('smartplaybox_agilli_oyun_qutusu_db6ef9', 'Ağıllı Oyun Qutusu'),
          actions: [
            Stack(clipBehavior: Clip.none, children: [
              ToolIconButton(
                key: const ValueKey('smartplay-inventory'),
                semanticLabel: tr('smartplaybox_evde_olan_esyalar_382e9a', 'Evdə Olan Əşyalar'),
                onTap: _openInventory,
                icon: const AIcon(AIcons.package, size: 16),
              ),
              if (userInventory.isNotEmpty)
                PositionedDirectional(
                  top: -4,
                  end: -4,
                  child: Container(
                    key: const ValueKey('smartplay-inventory-count'),
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.lav2, shape: BoxShape.circle),
                    child: Text('${userInventory.length}', style: px(10, weight: FontWeight.w700, color: lavWhite, height: 1)),
                  ),
                ),
            ]),
          ],
        ),
        if (userInventory.isEmpty) ...[
          FadeRise(
            dy: -10,
            // `.a-card` with `background: var(--a-lav-1); border: none`.
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                AListIconBox(gradient: a.gradLav, child: AIcon(AIcons.package, size: 17, strokeWidth: 2.2, color: a.lavInk)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(tr('smartplaybox_evdeki_esyalari_secin_3b81dd', 'Evdəki əşyaları seçin'), style: AStyles.listTitle(context, color: a.lavInk)),
                    const SizedBox(height: 4),
                    Opacity(
                      opacity: 0.8,
                      child: Text(tr('smartplaybox_daha_deqiq_oyun_teklifleri_ucu_c0c456', 'Daha dəqiq oyun təklifləri üçün evinizdəki əşyaları qeyd edin.'),
                          style: px(14, color: a.lavInk, height: 20 / 14)),
                    ),
                    const SizedBox(height: 12),
                    APillButton(
                      buttonKey: const ValueKey('smartplay-setup'),
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      fontSize: 11.5,
                      background: a.lav2,
                      foreground: lavWhite,
                      label: tr('smartplaybox_esyalari_sec_67bfb1', 'Əşyaları seç'),
                      onTap: _openInventory,
                    ),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (today != null) ...[
          FadeRise(
            dy: 0,
            scaleFrom: 0.95,
            child: ACard(
              variant: ACardVariant.list,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(gradient: a.gradLav),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(children: [
                        AIcon(AIcons.trophy, size: 20, color: a.lavInk),
                        const SizedBox(width: 8),
                        Text(tr('smartplaybox_bugunku_tovsiye_ec6c3a', 'Bugünkü Tövsiyə'), style: x.heading(px(16, weight: FontWeight.w700, color: a.lavInk))),
                      ]),
                    ),
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _Wiggle(child: Text(_activityEmoji(activitySkills(today)), style: const TextStyle(fontSize: 48, height: 1))),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text('${today['title'] ?? ''}', style: x.heading(px(20, weight: FontWeight.w700, color: a.lavInk, height: 28 / 20))),
                          ),
                          Opacity(opacity: 0.85, child: Text('${today['description'] ?? ''}', style: px(14, color: a.lavInk, height: 20 / 14))),
                        ]),
                      ),
                    ]),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 16, runSpacing: 8, children: [
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          AIcon(AIcons.clock, size: 16, color: a.inkSoft),
                          const SizedBox(width: 4),
                          Text('${today['duration_minutes'] ?? ''} ${tr('smartplaybox_deq_780a5c', 'dəq')}', style: px(14, weight: FontWeight.w600, color: a.inkSoft, height: 20 / 14)),
                        ]),
                        if (_difficulty(a, today['difficulty_level']) case final d?) ARankTagBox(d.$1, background: d.$2, color: d.$3),
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          for (final s in activitySkills(today))
                            Padding(
                              padding: const EdgeInsetsDirectional.only(end: 4),
                              child: Semantics(tooltip: _skillLabel(s), child: Text(_skillIcons[s] ?? '', style: px(18, height: 28 / 18))),
                            ),
                        ]),
                      ]),
                    ),
                    if (activityItems(today).isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('smartplaybox_lazim_olan_esyalar_b33d1b', 'Lazım olan əşyalar:'), style: x.aListSub)),
                          Wrap(spacing: 8, runSpacing: 8, children: [for (final i in activityItems(today)) _itemChip(context, i)]),
                        ]),
                      ),
                    APillButton(
                      buttonKey: const ValueKey('smartplay-start'),
                      height: 46,
                      expand: true,
                      background: a.lav2,
                      foreground: lavWhite,
                      icon: const AIcon(AIcons.play, size: 15, strokeWidth: 2.2),
                      label: tr('smartplaybox_oyuna_basla_fe4574', 'Oyuna Başla'),
                      onTap: () => _openActivity(today),
                    ),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),
        ],
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr('smartplaybox_bacariq_saheleri_d5133c', 'Bacarıq Sahələri'), style: AStyles.cardTitle(context))),
            AGridCols(columns: 5, gap: 8, children: [
              for (final e in _skillIcons.entries)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(color: _skillStyle(a, e.key)?.$1 ?? a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(e.value, style: px(24, height: 32 / 24))),
                    Text(
                      '${rec.filtered.where((act) => activitySkills(act).contains(e.key)).length}',
                      key: ValueKey('smartplay-skill-${e.key}'),
                      style: px(12, weight: FontWeight.w700, color: _skillStyle(a, e.key)?.$2 ?? a.inkSoft, height: 16 / 12),
                    ),
                  ]),
                ),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            rec.matched.isNotEmpty
                ? '${tr('playbox_for_you', 'Sizin üçün')} (${rec.matched.length})'
                : '${tr('playbox_all_games', 'Bütün Oyunlar')} (${rec.filtered.length})',
            style: AStyles.sectionTitle(context),
          ),
        ),
        if (activitiesQ.isLoading)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: ALoader(size: 32, color: a.lav2)),
              Text(tr('smartplaybox_oyunlar_yuklenir_d1edd2', 'Oyunlar yüklənir...'), style: x.aListSub),
            ]),
          )
        else if (rec.filtered.isEmpty)
          ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.baby, size: 48, color: a.inkFaint)),
              Text(tr('smartplaybox_bu_yasa_uygun_oyun_tapilmadi_72e443', 'Bu yaşa uyğun oyun tapılmadı'), textAlign: TextAlign.center, style: x.aListTitle),
              if ((profile?.babyBirthDate ?? '').isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(tr('smartplaybox_profilde_korpenin_dogum_tarixini_elave_e_696d85', 'Profildə körpənin doğum tarixini əlavə edin'), textAlign: TextAlign.center, style: x.aListSub),
                ),
            ]),
          )
        else
          AListCardBox(bottomPadding: 16, children: [
            for (var i = 0; i < list.length; i++)
              FadeRise(
                dy: 10,
                delay: Duration(milliseconds: (i * 50).clamp(0, 300)),
                child: AListRowBox(
                  key: ValueKey('smartplay-row-${list[i]['id']}'),
                  first: i == 0,
                  onTap: () => _openActivity(list[i]),
                  children: [
                    AListIconBox(gradient: a.gradLav, child: Text(_activityEmoji(activitySkills(list[i])))),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text('${list[i]['title'] ?? ''}', style: x.aListTitle),
                        Text('${list[i]['duration_minutes'] ?? ''} ${tr('smartplaybox_deq_780a5c', 'dəq')} · ${list[i]['description'] ?? ''}',
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListSub),
                      ]),
                    ),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(activitySkills(list[i]).take(3).map((s) => _skillIcons[s] ?? '').join(' '), style: px(13)),
                      const SizedBox(width: 6),
                      AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                    ]),
                  ],
                ),
              ),
          ]),
      ]),
    );
  }

  Widget _detailContent(BuildContext context, _Activity act) {
    final a = context.a;
    final x = context.aText;
    final skills = activitySkills(act);
    final items = activityItems(act);
    final d = _difficulty(a, act['difficulty_level']);
    final instructions = '${act['instructions'] ?? ''}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(gradient: a.gradLav),
        child: Row(children: [
          Text(_activityEmoji(skills), style: const TextStyle(fontSize: 48, height: 1)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text('${act['title'] ?? ''}', style: x.heading(px(20, weight: FontWeight.w700, color: a.lavInk, height: 28 / 20))),
              const SizedBox(height: 4),
              Opacity(
                opacity: 0.8,
                child: Row(children: [
                  AIcon(AIcons.clock, size: 16, color: a.lavInk),
                  const SizedBox(width: 8),
                  Text('${act['duration_minutes'] ?? ''} ${tr('smartplaybox_deqiqe_94641a', 'dəqiqə')}', style: px(14, color: a.lavInk, height: 20 / 14)),
                ]),
              ),
            ]),
          ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('${act['description'] ?? ''}', style: AStyles.ctaText(context)),
          const SizedBox(height: 20),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in skills) ARankTagBox(_skillLabel(s) ?? '', background: _skillStyle(a, s)?.$1 ?? a.surfaceSoft, color: _skillStyle(a, s)?.$2 ?? a.inkSoft),
            if (d != null) ARankTagBox(d.$1, background: d.$2, color: d.$3),
          ]),
          if (items.isNotEmpty) ...[
            const SizedBox(height: 20),
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('smartplaybox_lazim_olan_esyalar_8e1429', '📦 Lazım olan əşyalar'), style: px(16, weight: FontWeight.w700, color: a.ink))),
            Wrap(spacing: 8, runSpacing: 8, children: [for (final i in items) _itemChip(context, i, md: true)]),
          ],
          if (instructions.isNotEmpty) ...[
            const SizedBox(height: 20),
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('smartplaybox_nece_oynamali_6cadac', '📝 Necə oynamalı'), style: px(16, weight: FontWeight.w700, color: a.ink))),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
              child: Text(instructions, style: px(14, color: a.bodyText, height: 1.625)),
            ),
          ],
          const SizedBox(height: 20),
          APillButton(
            buttonKey: const ValueKey('smartplay-complete-open'),
            height: 46,
            expand: true,
            background: a.lav2,
            foreground: const Color(0xFFFFFFFF),
            icon: const AIcon(AIcons.check, size: 15, strokeWidth: 2.2),
            label: tr('smartplaybox_oyunu_tamamladim_51cdab', 'Oyunu Tamamladım!'),
            onTap: () => Navigator.of(context).pop(true),
          ),
        ]),
      ),
    ]);
  }

  Widget _completeContent(BuildContext context, _Activity act) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Text(tr('smartplaybox_ela_548a34', '🎉 Əla!'), textAlign: TextAlign.center, style: context.aText.heading(px(18, weight: FontWeight.w600, color: a.ink, height: 28 / 18))),
      ),
      const SizedBox(height: 16),
      Text(tr('smartplaybox_oyun_nece_kecdi_c5f5f4', 'Oyun necə keçdi?'), textAlign: TextAlign.center, style: context.aText.aListSub),
      const SizedBox(height: 16),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var star = 1; star <= 5; star++) ...[
          if (star > 1) const SizedBox(width: 8),
          Semantics(
            button: true,
            selected: _rating >= star,
            child: PressScale(
              scale: 0.9,
              onTap: () => _update(() => _rating = star),
              child: Text(_rating >= star ? '⭐' : '☆', key: ValueKey('smartplay-star-$star'), style: TextStyle(fontSize: 30, height: 36 / 30, color: a.ink)),
            ),
          ),
        ],
      ]),
      const SizedBox(height: 16),
      Builder(
        builder: (dialogContext) => APillButton(
          buttonKey: const ValueKey('smartplay-log'),
          height: 46,
          expand: true,
          background: a.lav2,
          foreground: const Color(0xFFFFFFFF),
          opacity: _logging ? 0.7 : 1,
          icon: _logging ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : null,
          label: _logging ? '' : tr('playbox_log_note', 'Qeyd et'),
          onTap: _logging ? null : () => _complete(dialogContext, act),
        ),
      ),
    ]);
  }

  Widget _inventoryContent(BuildContext context) {
    final a = context.a;
    final items = ref.watch(playInventoryItemsQuery).data ?? const <_Activity>[];
    final userInventory = ref.watch(userPlayInventoryQuery).data ?? const <_Activity>[];
    final groups = <String, List<_Activity>>{};
    for (final item in items) {
      final cat = '${item['category'] ?? ''}'.isNotEmpty ? '${item['category']}' : 'general';
      (groups[cat] ??= []).add(item);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(icon: AIcon(AIcons.package, size: 20, color: a.lav2), title: tr('smartplaybox_evde_olan_esyalar_382e9a', 'Evdə Olan Əşyalar')),
      const SizedBox(height: 16),
      Text(tr('smartplaybox_evinizde_olan_esyalari_secin_s_ec7864', 'Evinizdə olan əşyaları seçin, sizə uyğun oyunlar tövsiyə edək.'), style: context.aText.aListSub),
      if (userInventory.isNotEmpty) ...[
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(16)),
          child: Text('✓ ${userInventory.length} ${tr('smartplaybox_esya_secilib_cfd789', 'əşya seçilib')}', style: px(14, weight: FontWeight.w700, color: a.lavInk, height: 20 / 14)),
        ),
      ],
      const SizedBox(height: 16),
      for (final e in groups.entries) ...[
        Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_categoryLabel(e.key) ?? e.key, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final item in e.value)
            () {
              final on = _isSelected('${item['name'] ?? ''}');
              return MorePillChip(
                key: ValueKey('smartplay-item-${item['id']}'),
                selected: on,
                onTap: _toggling ? null : () => _toggleItem(item),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                background: on ? a.lav2 : a.surfaceSoft,
                color: on ? const Color(0xFFFFFFFF) : a.inkSoft,
                // `0 6px 14px -6px rgba(171, 132, 238, 0.6)` (SmartPlayBox.tsx literal)
                shadow: on ? const [BoxShadow(color: Color(0x99AB84EE), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -6)] : null,
                children: [Text('${item['emoji'] ?? ''}'), Text('${item['name'] ?? ''}'), if (on) const AIcon(AIcons.check, size: 12)],
              );
            }(),
        ]),
        const SizedBox(height: 16),
      ],
    ]);
  }
}

/// framer `animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: 2 }}` (three runs, then still).
class _Wiggle extends StatefulWidget {
  const _Wiggle({required this.child});
  final Widget child;
  @override
  State<_Wiggle> createState() => _WiggleState();
}

class _WiggleState extends State<_Wiggle> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 6));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating && _c.value == 0) unawaited(_c.forward());
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final t = (_c.value * 3) % 1;
          // keyframes 0 → 5° → -5° → 0 at equal thirds
          final deg = t < 1 / 3 ? 15 * t : (t < 2 / 3 ? 5 - 30 * (t - 1 / 3) : -5 + 15 * (t - 2 / 3));
          return Transform.rotate(angle: deg * 3.141592653589793 / 180, child: child);
        },
      );
}
