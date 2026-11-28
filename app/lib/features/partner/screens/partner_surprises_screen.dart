// Ported from: src/components/partner/v2/PartnerSurprisesScreen.tsx, src/components/partner/SurpriseTab.tsx
//
// The surprise planner: the admin-configured ideas (surprise_ideas) by category, planning one for a date (she gets
// a message), completing it (points, a message and a notification for her), the history of completed ones.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../settings/ui/settings_ui.dart' show FadeRise, Tw, toasts;
import '../../tools/data/data.dart' show surpriseIdeasQuery;
import '../data/partner_backend.dart';
import '../data/partner_data.dart';
import '../data/partner_progress.dart';
import '../partner_ports.dart';
import '../ui/partner_ui.dart';
import 'screens_ui.dart';

/// A `surprise_ideas` row mapped for the UI (`title_az || title`, defaults for emoji / difficulty / points).
typedef SurpriseIdea = ({String id, String title, String? description, String emoji, String category, String difficulty, int points});

SurpriseIdea surpriseIdeaFromRow(Map<String, dynamic> r) {
  String? s(String k) => r[k] is String && (r[k] as String).isNotEmpty ? r[k] as String : null;
  final points = r['points'];
  return (
    id: '${r['id'] ?? ''}',
    title: s('title_az') ?? '${r['title'] ?? ''}',
    description: s('description_az') ?? s('description'),
    emoji: s('emoji') ?? '🎁',
    category: '${r['category'] ?? ''}',
    difficulty: s('difficulty') ?? 'easy',
    points: points is num && points != 0 ? points.toInt() : 10,
  );
}

/// The category chips: "all" plus every known category the ideas use (in order of first appearance).
List<({String id, String label, String emoji})> surpriseCategories(List<SurpriseIdea> ideas) {
  final labels = <String, (String, String)>{
    'romantic': (tr('surprisetab_romantic', 'Romantik'), '❤️'),
    'care': (tr('surprisetab_qaygi_868e7d', 'Qayğı'), '🤗'),
    'adventure': (tr('surprisetab_macera_bc3bdc', 'Macəra'), '🌟'),
    'gift': (tr('surprisetab_hediyye_8578f3', 'Hədiyyə'), '🎁'),
    'creative': (tr('surprisetab_yaradici_28b2b1', 'Yaradıcı'), '🎨'),
    'fun': (tr('surprisetab_eylence_43d0e0', 'Əyləncə'), '🎉'),
  };
  final out = [(id: 'all', label: tr('surprisetab_hamisi_c73c4d', 'Hamısı'), emoji: '✨')];
  final seen = <String>{};
  for (final idea in ideas) {
    if (!seen.add(idea.category)) continue;
    final l = labels[idea.category];
    if (l != null) out.add((id: idea.category, label: l.$1, emoji: l.$2));
  }
  return out;
}

String _dateLong(Object? value, String pattern) {
  final d = storedCalendarDate(value) ?? DateTime.tryParse('${value ?? ''}')?.toLocal();
  return d == null ? '' : formatDatePattern(d, pattern);
}

class PartnerSurprisesScreen extends StatelessWidget {
  const PartnerSurprisesScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => PartnerSubScreen(
        onBack: onBack,
        eyebrow: tr('partnerv2_onu_sevindir', 'Onu sevindir'),
        title: tr('syncedfeaturesgrid_surpriz_planla_d495ce', 'Sürpriz Planla'),
        children: const [SurpriseTab()],
      );
}

/// `SurpriseTab`.
class SurpriseTab extends ConsumerStatefulWidget {
  const SurpriseTab({super.key});

  @override
  ConsumerState<SurpriseTab> createState() => _SurpriseTabState();
}

class _SurpriseTabState extends ConsumerState<SurpriseTab> {
  String _category = 'all';
  bool _showHistory = false;

  Future<void> _notifyHer(Map<String, dynamic> row) async {
    final profile = ref.read(authProfileProvider);
    final her = ref.read(partnerDataProvider).partnerProfile;
    if (profile == null || her == null) return;
    await ref.read(partnerBackendProvider).insert('partner_messages', {'sender_id': profile.userId, 'receiver_id': her.userId, ...row});
  }

  Future<void> _plan(SurpriseIdea idea, String date, String notes) async {
    final toast = toasts(context);
    await ref.read(partnerHapticsProvider).medium();
    final result = await ref.read(surprisesProvider.notifier).addSurprise({
      'surprise_id': idea.id,
      'surprise_title': idea.title,
      'surprise_emoji': idea.emoji,
      'surprise_category': idea.category,
      'surprise_points': idea.points,
      'planned_date': date,
      if (notes.isNotEmpty) 'notes': notes,
    });
    if (result == null) return;
    try {
      await _notifyHer({
        'message_type': 'surprise_planned',
        'content': tr('partner_surprise_planned', '🎁 Həyat yoldaşın sənin üçün xüsusi bir sürpriz planladı!'),
      });
    } catch (err) {
      debugPrint('Error sending surprise notification: $err');
    }
    toast.show(title: tr('surprisetab_surpriz_planlandi_0e685c', 'Sürpriz planlandı! 🎉'), description: '${idea.title} - ${_dateLong(date, 'd MMMM yyyy')}');
  }

  Future<void> _complete(Map<String, dynamic> s) async {
    final toast = toasts(context);
    final id = '${s['id']}';
    final title = '${s['surprise_title'] ?? ''}';
    final emoji = '${s['surprise_emoji'] ?? ''}';
    final points = s['surprise_points'] ?? 0;
    await ref.read(partnerHapticsProvider).heavy();
    final ok = await ref.read(surprisesProvider.notifier).completeSurprise(id);
    if (!ok) return;
    final profile = ref.read(authProfileProvider);
    final her = ref.read(partnerDataProvider).partnerProfile;
    if (profile != null && her != null) {
      try {
        await _notifyHer({
          'message_type': 'surprise_completed',
          'content': '$emoji ${tr('partner_surprise_completed_1', 'Həyat yoldaşın')} "$title" ${tr('partner_surprise_completed_2', 'sürprizini sənin üçün tamamladı! 🎉')}',
        });
        final name = profile.name.isNotEmpty ? profile.name : tr('surprisetab_heyat_yoldasin_fc543b', 'Həyat yoldaşın');
        await ref.read(partnerBackendProvider).insert('notifications', {
          'user_id': her.userId,
          'notification_type': 'surprise',
          'title': tr('surprisetab_surpriz_tamamlandi_ff52dd', 'Sürpriz Tamamlandı! 🎁'),
          'message': tr('surprisetab_partner_completed_msg_f123bc', '{partnerName} sənin üçün "{title}" sürprizini tamamladı! {emoji}')
              .replaceFirst('{partnerName}', name)
              .replaceFirst('{title}', title)
              .replaceFirst('{emoji}', emoji),
        });
      } catch (err) {
        debugPrint('Error sending surprise completion notification: $err');
      }
    }
    toast.show(title: '+$points ${tr('partner_points_earned_2', 'xal qazandın! 🏆')}', description: '$title ${tr('partner_surprise_done', 'tamamlandı!')}');
  }

  Future<void> _delete(String id) async {
    final toast = toasts(context);
    await ref.read(partnerHapticsProvider).light();
    await ref.read(surprisesProvider.notifier).deleteSurprise(id);
    toast.show(title: tr('surprisetab_surpriz_silindi_095181', 'Sürpriz silindi'));
  }

  Future<void> _openPlanner(SurpriseIdea idea) async {
    final result = await showGeneralDialog<(String, String)>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'surprise',
      barrierColor: const Color(0x80000000),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, _) => _PlanSheet(idea: idea),
      transitionBuilder: (ctx, anim, _, child) => FadeTransition(
        opacity: anim,
        child: SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)), child: child),
      ),
    );
    if (result != null) await _plan(idea, result.$1, result.$2);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final s = t.shadcn;
    final dark = t.isDark;
    final surprises = ref.watch(surprisesProvider);
    // `usePartnerData()`: keeps her profile loaded for the messages to her.
    ref.watch(partnerDataProvider.select((d) => d.partnerProfile?.userId));
    final ideas = [for (final r in ref.watch(surpriseIdeasQuery).data ?? const <Map<String, dynamic>>[]) surpriseIdeaFromRow(r)];
    final categories = surpriseCategories(ideas);
    final filtered = _category == 'all' ? ideas : ideas.where((i) => i.category == _category).toList();
    final planned = surprises.plannedSurprises;
    final completed = surprises.completedSurprises;
    final muted = s.mutedForeground;

    return FadeRise(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 128),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(TwRadius.r2xl),
                // from-[#FF8D89] to-[#FF5A5F] (SurpriseTab.tsx:233)
                gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFF8D89), Color(0xFFFF5A5F)]),
              ),
              child: const AIcon(AIcons.gift, size: 24, color: Color(0xFFFFFFFF)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('surprisetab_surpriz_planla_d495ce', 'Sürpriz Planla'), style: Tw.lg.copyWith(fontWeight: FontWeight.w700)),
                Text(tr('surprisetab_onu_xosbext_etmek_ucun_7ecff1', 'Onu xoşbəxt etmək üçün'), style: Tw.sm.copyWith(color: muted)),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                // bg-[#FFE7E1] dark:bg-[#3a2427] (SurpriseTab.tsx:243)
                color: dark ? const Color(0xFF3A2427) : const Color(0xFFFFE7E1),
                borderRadius: BorderRadius.circular(TwRadius.r2xl),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const AIcon(AIcons.trophy, size: 20, color: Color(0xFFFF5A5F)),
                const SizedBox(width: 8),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  // text-[#9E2B2E] dark:text-[#FFC2C4] (SurpriseTab.tsx:246)
                  Text(tr('untranslated_toplam_lheej5', 'Toplam'), style: Tw.xs.copyWith(color: dark ? const Color(0xFFFFC2C4) : const Color(0xFF9E2B2E))),
                  Text('${surprises.totalPoints} xal', style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: dark ? const Color(0xFFFFC2C4) : const Color(0xFF9E2B2E))),
                ]),
              ]),
            ),
          ]),
          if (planned.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(children: [
              AIcon(AIcons.clock, size: 16, color: s.partner),
              const SizedBox(width: 8),
              Text('${tr('surprisetab_planlanmis_surprizler_3cd66a', 'Planlanmış Sürprizlər (')}${planned.length})', style: Tw.base.copyWith(fontWeight: FontWeight.w600)),
            ]),
            for (final p in planned) ...[
              const SizedBox(height: 12),
              FadeRise(
                key: ValueKey('planned-${p['id']}'),
                dy: 0,
                dx: -20,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(TwRadius.r2xl),
                    border: Border.all(color: s.partner.withValues(alpha: 0.2)),
                    gradient: LinearGradient(colors: [s.partner.withValues(alpha: 0.1), TwColors.violet500.withValues(alpha: 0.1)]),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text('${p['surprise_emoji'] ?? ''}', style: const TextStyle(fontSize: 30, height: 36 / 30)),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${p['surprise_title'] ?? ''}', style: Tw.base.copyWith(fontWeight: FontWeight.w600)),
                          Row(children: [
                            AIcon(AIcons.calendar, size: 12, color: muted),
                            const SizedBox(width: 4),
                            Text(_dateLong(p['planned_date'], 'd MMMM yyyy'), style: Tw.sm.copyWith(color: muted)),
                          ]),
                        ]),
                      ),
                      PartnerTap(
                        key: ValueKey('planned-delete-${p['id']}'),
                        scale: 0.9,
                        onTap: () => unawaited(_delete('${p['id']}')),
                        child: Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: dark ? TwColors.red900.withValues(alpha: 0.3) : TwColors.red100, shape: BoxShape.circle),
                          child: const AIcon(AIcons.trash2, size: 16, color: TwColors.red600),
                        ),
                      ),
                      const SizedBox(width: 8),
                      PartnerTap(
                        key: ValueKey('planned-complete-${p['id']}'),
                        scale: 0.9,
                        onTap: () => unawaited(_complete(p)),
                        child: Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(color: TwColors.emerald500, shape: BoxShape.circle),
                          child: const AIcon(AIcons.check, size: 20, color: Color(0xFFFFFFFF)),
                        ),
                      ),
                    ]),
                    if ((p['notes'] as String? ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(top: 8, start: 48),
                        child: Text('${p['notes']}', style: Tw.sm.copyWith(color: muted)),
                      ),
                  ]),
                ),
              ),
            ],
          ],
          if (completed.isNotEmpty) ...[
            const SizedBox(height: 20),
            PartnerTap(
              key: const ValueKey('surprise-history'),
              scale: 0.98,
              onTap: () => setState(() => _showHistory = !_showHistory),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(TwRadius.r2xl),
                  border: Border.all(color: dark ? TwColors.emerald800 : TwColors.emerald200),
                  gradient: LinearGradient(
                    colors: dark
                        ? [TwColors.emerald900.withValues(alpha: 0.2), TwColors.teal900.withValues(alpha: 0.2)]
                        : const [TwColors.emerald50, TwColors.teal50],
                  ),
                ),
                child: Row(children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: TwColors.emerald500, borderRadius: BorderRadius.circular(TwRadius.xl)),
                    child: const AIcon(AIcons.history, size: 20, color: Color(0xFFFFFFFF)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('surprisetab_surpriz_tarixcesi_46a7ab', 'Sürpriz Tarixçəsi'),
                          style: Tw.base.copyWith(fontWeight: FontWeight.w600, color: dark ? TwColors.emerald200 : TwColors.emerald800)),
                      Text('${completed.length} ${tr('surprisetab_surpriz_tamamlanib_e7514f', 'sürpriz tamamlanıb')}',
                          style: Tw.sm.copyWith(color: dark ? TwColors.emerald400 : TwColors.emerald600)),
                    ]),
                  ),
                  AnimatedRotation(
                    turns: _showHistory ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const AIcon(AIcons.chevronDown, size: 20, color: TwColors.emerald600),
                  ),
                ]),
              ),
            ),
            if (_showHistory)
              for (final (i, c) in completed.indexed) ...[
                const SizedBox(height: 8),
                FadeRise(
                  key: ValueKey('completed-${c['id']}'),
                  dy: 0,
                  dx: -20,
                  delay: Duration(milliseconds: i * 50),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: s.card, borderRadius: BorderRadius.circular(TwRadius.xl), border: Border.all(color: s.border.withValues(alpha: 0.5))),
                    child: Row(children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: dark ? TwColors.emerald900.withValues(alpha: 0.3) : TwColors.emerald100, borderRadius: BorderRadius.circular(TwRadius.xl)),
                        child: Text('${c['surprise_emoji'] ?? ''}', style: const TextStyle(fontSize: 20, height: 28 / 20)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c['surprise_title'] ?? ''}', style: Tw.sm.copyWith(fontWeight: FontWeight.w500)),
                          Text(
                            c['completed_date'] != null ? _dateLong(c['completed_date'], 'd MMM yyyy') : tr('surprisetab_tamamlandi_5e0188', 'Tamamlandı'),
                            style: Tw.xs.copyWith(color: muted),
                          ),
                        ]),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: dark ? TwColors.amber900.withValues(alpha: 0.3) : TwColors.amber100, borderRadius: BorderRadius.circular(TwRadius.lg)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const AIcon(AIcons.star, size: 12, color: TwColors.amber600),
                          const SizedBox(width: 4),
                          Text('+${c['surprise_points'] ?? 0}', style: Tw.xs.copyWith(fontWeight: FontWeight.w700, color: dark ? TwColors.amber400 : TwColors.amber700)),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ],
          ],
          const SizedBox(height: 20),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              for (final (i, c) in categories.indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                PartnerTap(
                  key: ValueKey('surprise-cat-${c.id}'),
                  onTap: () => setState(() => _category = c.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: _category == c.id ? s.partner : s.muted.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(TwRadius.xl),
                      boxShadow: _category == c.id
                          ? const [
                              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -1),
                              BoxShadow(color: Color(0x1A000000), offset: Offset(0, 2), blurRadius: 4, spreadRadius: -2),
                            ]
                          : null,
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(c.emoji),
                      const SizedBox(width: 8),
                      Text(c.label, style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: _category == c.id ? const Color(0xFFFFFFFF) : muted)),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 20),
          for (final (i, idea) in filtered.indexed) ...[
            if (i > 0) const SizedBox(height: 16),
            FadeRise(
              key: ValueKey('idea-${idea.id}'),
              delay: Duration(milliseconds: i * 50),
              child: _IdeaCard(
                idea: idea,
                planned: planned.any((p) => p['surprise_id'] == idea.id),
                onPlan: () => unawaited(_openPlanner(idea)),
              ),
            ),
          ],
          const SizedBox(height: 20),
          FadeRise(
            dy: 0,
            delay: const Duration(milliseconds: 300),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(TwRadius.r2xl),
                border: Border.all(color: dark ? TwColors.pink800 : TwColors.pink200),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: dark ? [TwColors.pink900.withValues(alpha: 0.2), TwColors.rose900.withValues(alpha: 0.2)] : const [TwColors.pink50, TwColors.rose50],
                ),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const AIcon(AIcons.sparkles, size: 20, color: TwColors.pink500),
                  const SizedBox(width: 8),
                  Text(tr('surprisetab_ipucu_a842e4', 'İpucu'), style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: dark ? TwColors.pink200 : TwColors.pink800)),
                ]),
                const SizedBox(height: 12),
                Text(
                  tr('surprisetab_kicik_ve_sade_jestler_cox_vaxt_53a074',
                      'Kiçik və sadə jestlər çox vaxt ən yadda qalanlar olur. Gözlənilməz anlarda edilən sürprizlər daha xüsusidir! 💕'),
                  style: Tw.sm.copyWith(color: dark ? TwColors.pink300 : TwColors.pink700),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

LinearGradient _categoryGradient(BuildContext context, String category) {
  final (a, b) = switch (category) {
    'romantic' => (TwColors.pink500, TwColors.rose600),
    'care' => (TwColors.violet500, TwColors.purple600),
    'adventure' => (TwColors.amber500, TwColors.orange600),
    'gift' => (TwColors.emerald500, TwColors.teal600),
    _ => (context.tokens.shadcn.partner, TwColors.indigo600),
  };
  return LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a, b]);
}

class _IdeaCard extends StatelessWidget {
  const _IdeaCard({required this.idea, required this.planned, required this.onPlan});
  final SurpriseIdea idea;
  final bool planned;
  final VoidCallback onPlan;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final s = t.shadcn;
    final dark = t.isDark;
    final (diffBg, diffFg) = switch (idea.difficulty) {
      'easy' => (dark ? TwColors.emerald900.withValues(alpha: 0.3) : TwColors.emerald100, dark ? TwColors.emerald400 : TwColors.emerald700),
      'medium' => (dark ? TwColors.amber900.withValues(alpha: 0.3) : TwColors.amber100, dark ? TwColors.amber400 : TwColors.amber700),
      'hard' => (dark ? TwColors.rose900.withValues(alpha: 0.3) : TwColors.rose100, dark ? TwColors.rose400 : TwColors.rose700),
      _ => (s.muted, s.mutedForeground),
    };
    final diffLabel = idea.difficulty == 'easy'
        ? tr('surprisetab_difficulty_easy', 'Asan')
        : idea.difficulty == 'medium'
            ? tr('surprisetab_difficulty_orta', 'Orta')
            : tr('surprisetab_cetin_4bf032', 'Çətin');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: planned ? Color.alphaBlend(s.partner.withValues(alpha: 0.05), s.card) : s.card,
        borderRadius: BorderRadius.circular(TwRadius.r2xl),
        border: Border.all(color: planned ? s.partner.withValues(alpha: 0.5) : s.border.withValues(alpha: 0.5), width: 2),
        boxShadow: const [
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
        ],
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: _categoryGradient(context, idea.category), borderRadius: BorderRadius.circular(TwRadius.r2xl)),
          child: Text(idea.emoji, style: const TextStyle(fontSize: 24, height: 32 / 24)),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(idea.title, style: Tw.base.copyWith(fontWeight: FontWeight.w600)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: diffBg, borderRadius: BorderRadius.circular(999)),
                child: Text(diffLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: diffFg)),
              ),
            ]),
            const SizedBox(height: 4),
            if (idea.description != null) Text(idea.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: Tw.sm.copyWith(color: s.mutedForeground)),
            const SizedBox(height: 12),
            Row(children: [
              const AIcon(AIcons.star, size: 16, color: TwColors.amber500),
              const SizedBox(width: 4),
              Expanded(child: Text('+${idea.points} xal', style: Tw.sm.copyWith(fontWeight: FontWeight.w700, color: TwColors.amber600))),
              if (planned)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.clock, size: 12, color: s.partner),
                  const SizedBox(width: 4),
                  Text(tr('surprisetab_planlandi_3fb737', 'Planlandı'), style: Tw.xs.copyWith(fontWeight: FontWeight.w500, color: s.partner)),
                ])
              else
                PartnerTap(
                  key: ValueKey('idea-plan-${idea.id}'),
                  onTap: onPlan,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: s.partner, borderRadius: BorderRadius.circular(TwRadius.xl)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AIcon(AIcons.sparkles, size: 16, color: Color(0xFFFFFFFF)),
                      const SizedBox(width: 4),
                      Text(tr('surprisetab_planla', 'Planla'), style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: const Color(0xFFFFFFFF))),
                    ]),
                  ),
                ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/// The planning modal: a date (from today) and an optional note.
class _PlanSheet extends StatefulWidget {
  const _PlanSheet({required this.idea});
  final SurpriseIdea idea;

  @override
  State<_PlanSheet> createState() => _PlanSheetState();
}

class _PlanSheetState extends State<_PlanSheet> {
  String _date = '';
  final TextEditingController _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DomainClock.now();
    final first = DateTime(now.year, now.month, now.day);
    final current = storedCalendarDate(_date);
    final picked = await showDatePicker(context: context, initialDate: current ?? first, firstDate: first, lastDate: DateTime(now.year + 5, 12, 31));
    if (picked != null && mounted) setState(() => _date = localDateKey(picked));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    final idea = widget.idea;
    final mq = MediaQuery.of(context);
    final field = BoxDecoration(color: s.muted.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(TwRadius.xl), border: Border.all(color: const Color(0x00000000), width: 2));
    final shown = storedCalendarDate(_date);
    return AScope(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Material(
          type: MaterialType.transparency,
          child: Container(
            constraints: BoxConstraints(maxWidth: 512, maxHeight: mq.size.height * 0.85),
            decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(TwRadius.r3xl))),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(24, 24, 24, (mq.padding.bottom > 0 ? mq.padding.bottom : 20) + 100 + mq.viewInsets.bottom),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(
                  child: Container(width: 48, height: 4, margin: const EdgeInsets.only(bottom: 24), decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(999))),
                ),
                Row(children: [
                  Container(
                    width: 64,
                    height: 64,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: _categoryGradient(context, idea.category), borderRadius: BorderRadius.circular(TwRadius.r2xl)),
                    child: Text(idea.emoji, style: const TextStyle(fontSize: 30, height: 36 / 30)),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(idea.title, style: Tw.lg.copyWith(fontWeight: FontWeight.w700, color: s.cardForeground)),
                      if (idea.description != null) Text(idea.description!, style: Tw.sm.copyWith(color: s.mutedForeground)),
                    ]),
                  ),
                ]),
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(tr('surprisetab_tarix_sec_937037', 'Tarix seç'), style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.cardForeground)),
                ),
                GestureDetector(
                  key: const ValueKey('surprise-date'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => unawaited(_pickDate()),
                  child: Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    alignment: AlignmentDirectional.centerStart,
                    decoration: field,
                    child: Text(shown == null ? 'dd/mm/yyyy' : formatDatePattern(shown, 'dd.MM.yyyy'),
                        style: Tw.base.copyWith(color: shown == null ? s.mutedForeground : s.foreground)),
                  ),
                ),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(tr('surprisetab_qeyd_isteye_bagli_96c689', 'Qeyd (istəyə bağlı)'), style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.cardForeground)),
                ),
                Container(
                  height: 96,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: field,
                  child: TextField(
                    key: const ValueKey('surprise-notes'),
                    controller: _notes,
                    maxLines: null,
                    expands: true,
                    style: Tw.base.copyWith(color: s.foreground),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: tr('surprisetab_xususi_qeydler_6c6d1f', 'Xüsusi qeydlər...'),
                      hintStyle: Tw.base.copyWith(color: s.mutedForeground),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                PartnerTap(
                  key: const ValueKey('surprise-submit'),
                  scale: 0.98,
                  enabled: _date.isNotEmpty,
                  onTap: () => Navigator.of(context).pop((_date, _notes.text)),
                  child: Opacity(
                    opacity: _date.isNotEmpty ? 1 : 0.5,
                    child: Container(
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(TwRadius.r2xl),
                        gradient: LinearGradient(colors: [s.partner, TwColors.violet600]),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.gift, size: 20, color: Color(0xFFFFFFFF)),
                        const SizedBox(width: 8),
                        Text(tr('surprisetab_surprizi_planla_f95b6f', 'Sürprizi Planla'), style: Tw.base.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
