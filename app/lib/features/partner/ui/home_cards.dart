// Ported from: src/components/partner/v2/{DailyMissionsCard,BirthModeCard,PostpartumCard,PartnerActivityFeed,
//              NextAppointmentCard,PartnerWeekInfoCard,PartnerBabyTodayCard}.tsx
//
// The cards of the partner home ("Bu gün").
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart' show DomainClock, jsNumberToString;
import '../../../domain/pregnancy/fetal_size.dart' show formatFetalWeight;
import '../../../state/user_store.dart';
import '../../home/data/pregnancy_content.dart' show FruitData;
import '../../settings/ui/settings_ui.dart' show FadeRise, cssUpper, toasts;
import '../../tools/parenting/programme_ports.dart' show localeDayMonth;
import '../data/partner_cards_data.dart';
import '../data/partner_content.dart';
import '../data/partner_family.dart';
import '../data/partner_missions.dart';
import '../partner_copy.dart';
import '../partner_ports.dart';
import 'level_up_celebration.dart';
import 'partner_ui.dart';

// ── DailyMissionsCard ────────────────────────────────────────────────────────────────────────────────────────

/// "Bu gün necə kömək edim?" — three missions for the woman's stage (all seven on demand), level progress and
/// the level-up confetti.
class DailyMissionsCard extends ConsumerStatefulWidget {
  const DailyMissionsCard({super.key, required this.stage});
  final MissionStageInput stage;

  @override
  ConsumerState<DailyMissionsCard> createState() => _DailyMissionsCardState();
}

class _DailyMissionsCardState extends ConsumerState<DailyMissionsCard> {
  bool _expanded = false;
  int? _celebrateLevel;

  Future<void> _toggle(Mission m) async {
    final toast = toasts(context);
    final haptics = ref.read(partnerHapticsProvider);
    await quietly(haptics.light);
    final before = ref.read(partnerMissionsProvider);
    final levelBefore = before.level;
    final result = await ref.read(partnerMissionsProvider.notifier).toggleMission(m.id, m.points);
    if (result != null && result.completed) {
      toast.show(
        title: '+${result.pointsEarned} ${tr('partnerv2_xal', 'xal')} 🎉',
        description: tr('partnerv2_tesekkurler_qaygikesh', 'Təşəkkürlər, qayğıkeş partnyor!'),
      );
      // Level-up check (points → level: /50), from the total before the toggle.
      final newTotal = before.totalPoints + result.pointsEarned;
      final levelAfter = newTotal ~/ 50 + 1;
      if (levelAfter > levelBefore) {
        await quietly(haptics.heavy);
        if (mounted) setState(() => _celebrateLevel = levelAfter);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final view = ref.watch(partnerMissionsViewProvider(widget.stage));
    if (view.loading) return const SizedBox.shrink();
    final missions = view.missions;
    final st = view.state;
    // Open ones first — the first three are shown.
    final sorted = [...missions.where((m) => !m.isCompleted), ...missions.where((m) => m.isCompleted)];
    final visible = _expanded ? sorted : sorted.take(3).toList();
    final completedToday = missions.where((m) => m.isCompleted).length;
    final diff = <String, (Color, Color, String)>{
      'easy': (a.green1, a.greenInk, tr('partnerv2_asan', 'Asan')),
      'medium': (a.yellow1, a.yellowInk, tr('partnerv2_orta', 'Orta')),
      'hard': (a.pink1, a.pinkInk, tr('partnerv2_cetin', 'Çətin')),
    };
    final cat = <String, (Color, Color)>{
      'care': (a.blue1, a.blueInk),
      'support': (a.lav1, a.lavInk),
      'surprise': (a.pink1, a.pinkInk),
    };

    return PartnerCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('partnerv2_bugun_nece_komek_edim', 'Bu gün necə kömək edim?'), style: pText(15.5, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
              const SizedBox(height: 1),
              Text('$completedToday/${missions.length} ${tr('partnerv2_tamamlandi', 'tamamlandı')}', style: pText(11.5, color: a.inkSoft)),
            ]),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              AIcon(AIcons.zap, size: 12, color: a.blueInk),
              const SizedBox(width: 4),
              Text('${tr('partnerv2_seviyye', 'Səviyyə')} ${st.level}', style: pText(11.5, weight: FontWeight.w800, color: a.blueInk)),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            height: 8,
            color: a.surfaceSoft,
            alignment: AlignmentDirectional.centerStart,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: (st.levelProgress / 100).clamp(0, 1)),
              duration: const Duration(milliseconds: 500),
              curve: ACurves.framerDefault,
              builder: (context, v, _) => FractionallySizedBox(
                widthFactor: v,
                child: DecoratedBox(decoration: BoxDecoration(gradient: a.gradBlue, borderRadius: BorderRadius.circular(999))),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 16),
          child: Text('${tr('partnerv2_novbeti_seviyyeye', 'Növbəti səviyyəyə')}: ${st.pointsToNextLevel} ${tr('partnerv2_xal', 'xal')}',
              textAlign: TextAlign.end, style: pText(10, color: a.inkFaint)),
        ),
        for (var i = 0; i < visible.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          () {
            final m = visible[i];
            final c = cat[m.category] ?? cat['care']!;
            final d = diff[m.difficulty] ?? diff['easy']!;
            return FadeRise(
              key: ValueKey('mission-${m.id}'),
              dy: 8,
              child: PartnerTap(
                scale: 0.98,
                onTap: () => _toggle(m),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                  decoration: BoxDecoration(color: m.isCompleted ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: m.isCompleted ? a.chipOverlay : c.$1, borderRadius: BorderRadius.circular(12)),
                      child: m.isCompleted ? AIcon(AIcons.check, size: 16, color: a.greenInk, strokeWidth: 3) : AIcon(m.icon, size: 16, color: c.$2),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(m.title,
                            style: pText(12.5, weight: FontWeight.w700, color: m.isCompleted ? a.inkSoft : a.ink)
                                .copyWith(decoration: m.isCompleted ? TextDecoration.lineThrough : null)),
                        Text(m.description, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(10.5, color: a.inkSoft)),
                      ]),
                    ),
                    const SizedBox(width: 12),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('+${m.points}', style: pText(11, weight: FontWeight.w800, color: m.isCompleted ? a.greenInk : a.accentInk)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                        decoration: BoxDecoration(color: d.$1, borderRadius: BorderRadius.circular(999)),
                        child: Text(d.$3, style: pText(8.5, weight: FontWeight.w700, color: d.$2)),
                      ),
                    ]),
                  ]),
                ),
              ),
            );
          }(),
        ],
        if (missions.length > 3)
          GestureDetector(
            key: const ValueKey('missions-expand'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(_expanded ? tr('partnerv2_yigcam_gorunus', 'Yığcam görünüş') : '${tr('partnerv2_hamisina_bax', 'Hamısına bax')} (${missions.length})',
                      style: pText(12, weight: FontWeight.w700, color: a.blueInk)),
                  const SizedBox(width: 4),
                  AIcon(_expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 14, color: a.blueInk),
                ]),
              ),
            ),
          ),
        LevelUpCelebration(
          show: _celebrateLevel != null,
          level: _celebrateLevel ?? st.level,
          onClose: () {
            if (mounted) setState(() => _celebrateLevel = null);
          },
        ),
      ]),
    );
  }
}

// ── BirthModeCard ────────────────────────────────────────────────────────────────────────────────────────────

/// Shown on the partner home from week 36: everything for the birth in one tap.
class BirthModeCard extends StatelessWidget {
  const BirthModeCard({super.key, required this.daysUntilDue, required this.onNavigate});
  final int daysUntilDue;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final actions = [
      ('live-contractions', AIcons.timer, feature37Text('pm_birth_contractions')),
      ('hospital-run', AIcons.car, feature37Text('pm_birth_hospital')),
      ('partner-hospital-bag', AIcons.package, feature37Text('pm_birth_bag')),
      ('birth-plan', AIcons.clipboardList, feature37Text('pm_birth_plan')),
    ];
    return FadeRise(
      dy: 12,
      child: Semantics(
        container: true,
        label: feature37Text('pm_birth_title'),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: a.alertBg,
            borderRadius: BorderRadius.circular(a.radiusLg),
            border: Border.all(color: a.peach2, width: 1.5),
            boxShadow: a.cardShadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(width: 9, height: 9, decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999))),
              const SizedBox(width: 8),
              Expanded(child: Text(feature37Text('pm_birth_title'), style: pText(16, weight: FontWeight.w900, color: a.alertInk, ls: -0.01))),
            ]),
            const SizedBox(height: 4),
            Text(daysUntilDue > 0 ? feature37Text('pm_birth_sub').replaceAll('{n}', '$daysUntilDue') : feature37Text('pm_birth_sub_due'),
                style: pText(12.5, color: a.alertSoft)),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < actions.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: PartnerTap(
                    key: ValueKey('birth-mode-${actions[i].$1}'),
                    onTap: () => onNavigate(actions[i].$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16)),
                      child: Column(children: [
                        Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(12)),
                          child: AIcon(actions[i].$2, size: 17, color: a.accentInk),
                        ),
                        const SizedBox(height: 6),
                        Text(actions[i].$3, textAlign: TextAlign.center, style: pText(10.5, weight: FontWeight.w700, color: a.ink, height: 1.2)),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}

// ── PostpartumCard ───────────────────────────────────────────────────────────────────────────────────────────

/// Partner home, first 8 weeks after birth: this week's focus and a low-mood nudge.
class PostpartumCard extends ConsumerWidget {
  const PostpartumCard({super.key, required this.week, required this.shareMood, required this.onOpen});
  final int week;
  final bool shareMood;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final text = postpartumPartnerText(language.isEmpty ? 'az' : language);
    final lowDays = ref.watch(partnerRecentMoodsProvider((7, shareMood))).lowDays;
    final w = text.weeks[week - 1];
    return FadeRise(
      dy: 12,
      child: PartnerTap(
        key: const ValueKey('postpartum-card'),
        scale: 0.99,
        onTap: onOpen,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.surface, shape: BoxShape.circle),
                child: const Text('💛', style: TextStyle(fontSize: 24)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(cssUpper(text.ui('home_card').replaceAll('{n}', '$week')), style: pText(11, weight: FontWeight.w800, color: a.accentInk, ls: 0.06)),
                  Text(w.title, style: pText(15.5, weight: FontWeight.w900, color: a.ink, ls: -0.01)),
                  Text(w.doList.isEmpty ? '' : w.doList.first, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(12, color: a.bodyText)),
                ]),
              ),
              const SizedBox(width: 12),
              AIcon(AIcons.chevronRight, size: 18, color: a.accentInk, mirrorInRtl: true),
            ]),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 6,
                color: a.chipOverlay,
                alignment: AlignmentDirectional.centerStart,
                child: FractionallySizedBox(
                  widthFactor: (week / kPostpartumWeeks).clamp(0, 1),
                  child: DecoratedBox(decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999))),
                ),
              ),
            ),
            if (lowDays >= 3)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  AIcon(AIcons.heart, size: 13, color: a.pinkInk),
                  const SizedBox(width: 6),
                  Expanded(child: Text(text.ui('mood_low_title'), style: pText(12, weight: FontWeight.w700, color: a.pinkInk))),
                ]),
              ),
          ]),
        ),
      ),
    );
  }
}

// ── PartnerActivityFeed ──────────────────────────────────────────────────────────────────────────────────────

const Set<String> _eventTypes = {
  'mood_update', 'kick_session', 'water_goal', 'contraction_started', 'contraction_511', //
  'daily_summary', 'sos_alert', 'birth_alert', 'thank_you',
};

/// `timeAgo(dateStr)` of the activity feed.
String activityTimeAgo(String dateStr, [DateTime? now]) {
  final at = DateTime.tryParse(dateStr);
  final diffMs = at == null ? double.nan : ((now ?? DomainClock.now()).millisecondsSinceEpoch - at.millisecondsSinceEpoch).toDouble();
  if (diffMs.isNaN) return '${jsNumberToString(double.nan)} ${tr('partnerv2_gun', 'gün')}';
  final mins = (diffMs / 60000).floor();
  if (mins < 1) return tr('partnerv2_indice', 'İndicə');
  if (mins < 60) return '$mins ${tr('partnerv2_deq', 'dəq')}';
  final hours = mins ~/ 60;
  if (hours < 24) return '$hours ${tr('partnerv2_saat', 'saat')}';
  return '${hours ~/ 24} ${tr('partnerv2_gun', 'gün')}';
}

/// One feed row: the event title / body from the JSON content (fallback title per type).
typedef ActivityItem = ({String id, String type, String title, String body, String createdAt});

/// The newest 8 events addressed to [userId] (messages newest first).
List<ActivityItem> activityItems(List<Map<String, dynamic>> messages, String? userId) {
  final fallback = {
    'mood_update': tr('partnerv2_ehval_yenilendi', 'Əhval yeniləndi'),
    'kick_session': tr('partnerv2_korpe_tepik_atdi', 'Körpə təpik atdı'),
    'water_goal': tr('partnerv2_su_hedefi', 'Su hədəfinə çatdı'),
    'contraction_started': tr('partnerv2_sanci_qeyd_edildi', 'Sancı qeyd edildi'),
    'contraction_511': tr('partnerv2_511_qaydasi', '5-1-1 Qaydası!'),
    'daily_summary': tr('partnerv2_gunluk_xulase', 'Günlük xülasə'),
    'sos_alert': 'SOS',
    'birth_alert': tr('partnerv2_dogus_siqnali', 'Doğuş siqnalı!'),
    'thank_you': tr('partnerv2_tesekkur_aldiniz', 'Təşəkkür aldınız'),
  };
  return [
    for (final m in messages.where((m) => _eventTypes.contains(m['message_type']) && m['receiver_id'] == userId).take(8))
      () {
        final type = '${m['message_type']}';
        var title = fallback[type] ?? type;
        var body = '';
        final content = m['content'];
        try {
          final parsed = jsonDecode(content is String ? content : '');
          if (parsed is Map) {
            if (parsed['title'] is String && (parsed['title'] as String).isNotEmpty) title = parsed['title'] as String;
            if (parsed['body'] is String && (parsed['body'] as String).isNotEmpty) body = parsed['body'] as String;
          }
        } catch (_) {
          if (content is String && content.isNotEmpty && content.length < 120) body = content;
        }
        return (id: '${m['id']}', type: type, title: title, body: body, createdAt: '${m['created_at'] ?? ''}');
      }(),
  ];
}

/// Activity feed — the mother's live events (partner_messages event types), live through usePartnerMessages.
class PartnerActivityFeed extends ConsumerWidget {
  const PartnerActivityFeed({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final userId = ref.watch(authUserProvider)?.id;
    final items = activityItems(ref.watch(partnerMessagesFeedProvider).messages, userId);
    final meta = <String, (AIconData, Color, Color)>{
      'mood_update': (AIcons.smile, a.yellow1, a.yellowInk),
      'kick_session': (AIcons.baby, a.pink1, a.pinkInk),
      'water_goal': (AIcons.droplets, a.blue1, a.blueInk),
      'contraction_started': (AIcons.heartPulse, a.lav1, a.lavInk),
      'contraction_511': (AIcons.triangleAlert, a.alertSoft.withValues(alpha: 0.18), a.alertInk),
      'daily_summary': (AIcons.fileText, a.green1, a.greenInk),
      'sos_alert': (AIcons.siren, a.alertSoft.withValues(alpha: 0.18), a.alertInk),
      'birth_alert': (AIcons.siren, a.alertSoft.withValues(alpha: 0.18), a.alertInk),
      'thank_you': (AIcons.handHeart, a.pink1, a.pinkInk),
    };
    final alertTypes = {'contraction_511', 'sos_alert', 'birth_alert'};
    return PartnerCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(12)),
            child: AIcon(AIcons.activity, size: 16, color: a.blueInk),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('partnerv2_aktivlik_lenti', 'Aktivlik lenti'), style: pText(14.5, weight: FontWeight.w800, color: a.ink)),
              Text(tr('partnerv2_onun_gunu_canli', 'Onun günü — canlı'), style: pText(11, color: a.inkSoft)),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Column(children: [
              Text(tr('partnerv2_hele_aktivlik_yoxdur', 'Bu gün hələ aktivlik yoxdur'), textAlign: TextAlign.center, style: pText(12.5, color: a.inkSoft)),
              const SizedBox(height: 2),
              Text(tr('partnerv2_tepik_su_ehval_burada', 'Təpiklər, su və əhval dəyişiklikləri burada görünəcək'),
                  textAlign: TextAlign.center, style: pText(11, color: a.inkFaint)),
            ]),
          )
        else
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: 6),
            () {
              final item = items[i];
              final m = meta[item.type] ?? meta['mood_update']!;
              return FadeRise(
                key: ValueKey('activity-${item.id}'),
                dy: 0,
                dx: -8,
                delay: Duration(milliseconds: i * 30),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(color: i == 0 ? a.surfaceSoft : const Color(0x00000000), borderRadius: BorderRadius.circular(13)),
                  child: Row(children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: alertTypes.contains(item.type) ? null : m.$2,
                        gradient: alertTypes.contains(item.type) ? a.alertBg : null,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: AIcon(m.$1, size: 14, color: m.$3),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(12, weight: FontWeight.w700, color: a.ink)),
                        if (item.body.isNotEmpty) Text(item.body, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(10.5, color: a.inkSoft)),
                      ]),
                    ),
                    const SizedBox(width: 10),
                    Text(activityTimeAgo(item.createdAt), style: pText(10, weight: FontWeight.w600, color: a.inkFaint)),
                  ]),
                ),
              );
            }(),
          ],
      ]),
    );
  }
}

// ── NextAppointmentCard ──────────────────────────────────────────────────────────────────────────────────────

/// The mother's next appointment — "take her there" reminder. Not shown without one (or on any error).
class NextAppointmentCard extends ConsumerWidget {
  const NextAppointmentCard({super.key, required this.motherUserId, this.onOpen});
  final String? motherUserId;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = motherUserId;
    if (id == null || id.isEmpty) return const SizedBox.shrink();
    final appointment = ref.watch(partnerNextAppointmentProvider(id)).value;
    if (appointment == null) return const SizedBox.shrink();
    final a = context.a;
    final isToday = appointment.eventDate == todayKey();
    final isTomorrow = appointment.eventDate == daysAgoKey(-1);
    final date = DateTime.tryParse('${appointment.eventDate}T00:00:00');
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final dateLabel = isToday
        ? tr('partnerv2_bu_gun', 'Bu gün')
        : isTomorrow
            ? tr('partnerv2_sabah', 'Sabah')
            : date == null
                ? 'Invalid Date'
                : localeDayMonth(date, language);
    final time = appointment.eventTime;
    final timePart = time != null && time.isNotEmpty ? ' · ${time.length > 5 ? time.substring(0, 5) : time}' : '';
    return FadeRise(
      dy: 10,
      child: PartnerTap(
        key: const ValueKey('next-appointment'),
        scale: 0.98,
        onTap: onOpen ?? () {},
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: a.surface,
            borderRadius: BorderRadius.circular(a.radiusMd),
            boxShadow: a.cardShadow,
            border: Border.all(color: isToday ? a.blue2 : const Color(0x00000000), width: 1.5),
          ),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(14)),
              child: AIcon(AIcons.calendarHeart, size: 19, color: a.blueInk),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(appointment.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(13.5, weight: FontWeight.w700, color: a.ink))),
                  if (isToday) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: a.blue2, borderRadius: BorderRadius.circular(999)),
                      // color: '#fff' (one-off literal)
                      child: Text('${tr('partnerv2_bu_gun', 'Bu gün')}!', style: pText(9.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                    ),
                  ],
                ]),
                const SizedBox(height: 1),
                Text('$dateLabel$timePart — ${tr('partnerv2_onu_aparmagi_unutma', 'onu aparmağı unutma')} 🚗', style: pText(11.5, color: a.inkSoft)),
              ]),
            ),
            const SizedBox(width: 12),
            AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
          ]),
        ),
      ),
    );
  }
}

// ── PartnerWeekInfoCard ──────────────────────────────────────────────────────────────────────────────────────

/// "19. həftə — …"; languages whose label is an ordinal suffix attach it to the number.
String weekHeading(int week, String label) => label.startsWith('-') ? '$week$label' : '$week. $label';

/// A localized content column (`<field>_<lang>`, then the ru / en stand-ins of the original, then az).
String? localizedContent(Map<String, dynamic>? row, String field, String language) {
  if (row == null) return null;
  String? s(Object? v) => v is String && v.isNotEmpty ? v : null;
  final localized = language != 'az'
      ? s(row['${field}_$language']) ??
          (language == 'kk' || language == 'uz' || language == 'ka' ? s(row['${field}_ru']) : null) ??
          (language == 'de' || language == 'ar' ? s(row['${field}_en']) : null)
      : null;
  return localized ?? s(row[field]);
}

/// Bump: "Bu həftə körpəniz" — the week's development card for the partner.
class PartnerWeekInfoCard extends StatefulWidget {
  const PartnerWeekInfoCard({super.key, required this.currentWeek, required this.weekData, required this.dayContent, required this.language, this.isMultiple = false});
  final int currentWeek;
  final FruitData? weekData;
  final Map<String, dynamic>? dayContent;
  final String language;

  /// Twins/triplets: "körpələriniz" instead of "körpəniz".
  final bool isMultiple;

  @override
  State<PartnerWeekInfoCard> createState() => _PartnerWeekInfoCardState();
}

class _PartnerWeekInfoCardState extends State<PartnerWeekInfoCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.currentWeek <= 0) return const SizedBox.shrink();
    final development = localizedContent(widget.dayContent, 'baby_development', widget.language);
    final weekData = widget.weekData;
    if (development == null && weekData == null) return const SizedBox.shrink();
    final a = context.a;
    return FadeRise(
      dy: 16,
      child: PartnerCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(16)),
              child: weekData?.imageUrl != null && weekData!.imageUrl!.isNotEmpty
                  ? Image.network(weekData.imageUrl!, width: 36, height: 36, fit: BoxFit.contain, semanticLabel: weekData.fruit,
                      errorBuilder: (_, _, _) => const SizedBox(width: 36, height: 36))
                  : Text(weekData?.emoji ?? '👶', style: const TextStyle(fontSize: 30)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                    weekHeading(widget.currentWeek,
                        widget.isMultiple ? tr('partnerv2_hefte_korpeleriniz', 'həftə — körpələriniz') : tr('partnerv2_hefte_korpeniz', 'həftə — körpəniz')),
                    style: pText(14.5, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
                if (weekData != null && weekData.fruit.isNotEmpty)
                  Text(
                      widget.isMultiple
                          ? '${tr('partnerv2_her_korpe_texminen', 'Hər körpə təxminən')} ${weekData.fruit} ${tr('partnerv2_boyukluyunde', 'böyüklüyündə')}'
                          : '${tr('partnerv2_texminen', 'Təxminən')} ${weekData.fruit} ${tr('partnerv2_boyukluyunde', 'böyüklüyündə')}',
                      style: pText(11.5, color: a.inkSoft)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          if (weekData != null && (weekData.lengthCm > 0 || weekData.weightG > 0))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                if (weekData.lengthCm > 0) _chip(a.blue1, a.blueInk, AIcons.ruler, '${jsNumberToString(weekData.lengthCm)} sm'),
                if (weekData.lengthCm > 0 && weekData.weightG > 0) const SizedBox(width: 8),
                if (weekData.weightG > 0)
                  _chip(a.green1, a.greenInk, AIcons.weight,
                      weekData.weightG >= 1000 ? '${(weekData.weightG / 1000).toStringAsFixed(1)} kq' : '${formatFetalWeight(weekData.weightG)} q'),
              ]),
            ),
          if (development != null) ...[
            Text(development,
                maxLines: _expanded ? null : 3,
                overflow: _expanded ? null : TextOverflow.ellipsis,
                style: pText(12.5, color: a.bodyText, height: 1.625)),
            if (development.length > 140)
              GestureDetector(
                key: const ValueKey('week-info-expand'),
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _expanded = !_expanded),
                child: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(children: [
                    Text(_expanded ? tr('partnerv2_yigcam_gorunus', 'Yığcam görünüş') : tr('partnerv2_davamini_oxu', 'Davamını oxu'),
                        style: pText(11.5, weight: FontWeight.w700, color: a.accentInk)),
                    const SizedBox(width: 4),
                    AIcon(_expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 13, color: a.accentInk),
                  ]),
                ),
              ),
          ],
        ]),
      ),
    );
  }

  Widget _chip(Color bg, Color ink, AIconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          AIcon(icon, size: 12, color: ink),
          const SizedBox(width: 6),
          Text(text, style: pText(11.5, weight: FontWeight.w700, color: ink)),
        ]),
      );
}

// ── PartnerBabyTodayCard ─────────────────────────────────────────────────────────────────────────────────────

/// Mommy: "Körpə bu gün" — compact feed / sleep / diaper strip; opens the "Körpə Günü" screen.
class PartnerBabyTodayCard extends ConsumerWidget {
  const PartnerBabyTodayCard({super.key, required this.motherUserId, required this.babyName, required this.onOpen});
  final String motherUserId;
  final String babyName;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agg = ref.watch(partnerBabyTodayProvider(motherUserId));
    if (agg == null) return const SizedBox.shrink();
    final a = context.a;
    final sleepH = agg.sleepMin ~/ 60;
    final sleepM = (agg.sleepMin % 60).round();
    final tiles = [
      ('🍼', '${agg.feeds}', agg.totalMl > 0 ? '${jsNumberToString(agg.totalMl)} ml' : tr('partnerv2_qidalanma', 'Qidalanma')),
      (agg.sleepOngoing ? '😴' : '🌙', agg.sleepMin > 0 ? '${sleepH}s ${sleepM}d' : (agg.sleepOngoing ? tr('partnerv2_yatir', 'Yatır') : '0'), tr('partnerv2_yuxu', 'Yuxu')),
      ('🧷', '${agg.diapers}', tr('partnerv2_bez', 'Bez')),
    ];
    return FadeRise(
      dy: 16,
      child: PartnerTap(
        key: const ValueKey('partner-baby-today'),
        scale: 0.98,
        onTap: onOpen,
        child: PartnerCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: '$babyName ${tr('partnerv2_bu_gun_lower', 'bu gün')}'),
                  if (agg.sleepOngoing)
                    TextSpan(text: '  😴 ${tr('partnerv2_indi_yatir', 'indi yatır')}', style: pText(11, weight: FontWeight.w700, color: a.lavInk)),
                ]), style: pText(14, weight: FontWeight.w800, color: a.ink)),
              ),
              AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              for (var i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 9),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                    child: Column(children: [
                      Text(tiles[i].$1, style: const TextStyle(fontSize: 17)),
                      const SizedBox(height: 1),
                      Text(tiles[i].$2, style: pText(13.5, weight: FontWeight.w800, color: a.ink)),
                      Text(tiles[i].$3, style: pText(9, weight: FontWeight.w600, color: a.inkSoft)),
                    ]),
                  ),
                ),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}
