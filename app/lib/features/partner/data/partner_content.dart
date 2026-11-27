// Ported from: src/hooks/usePartnerDailyTips.ts, src/data/postpartum-partner/index.ts
//
// Content the partner screens read: the daily tip for the woman's stage and the "first 8 weeks" postpartum guide
// (texts per language in generated/postpartum_partner_text.g.dart).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../../state/user_store.dart';
import '../generated/postpartum_partner_text.g.dart';
import 'partner_backend.dart';

// ── Daily tips ───────────────────────────────────────────────────────────────────────────────────────────────

/// `usePartnerDailyTips(lifeStage)`: key `['partner-daily-tips', lifeStage, language]`, 30 min stale; an error
/// gives an empty list.
final partnerDailyTipsQuery = queryProviderFamily<List<Map<String, dynamic>>, String?>((ref, lifeStage) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['partner-daily-tips', lifeStage, language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      try {
        final rows = await ref.read(partnerBackendProvider).activeRows('partner_daily_tips', extraColumn: 'life_stage', extraValue: lifeStage);
        return mapRowsTranslation(rows, language, const ['tip_text']);
      } catch (error) {
        debugPrint('Error fetching partner daily tips: $error');
        return const [];
      }
    },
  );
}, name: 'partnerDailyTipsQuery');

/// The day's tip among [tips]: the week's tips when [weekNumber] has some, else the general ones (no week), else
/// all; the same tip all day (day of year % count).
Map<String, dynamic>? pickDailyTip(List<Map<String, dynamic>> tips, int? weekNumber, [DateTime? now]) {
  if (tips.isEmpty) return null;
  var filtered = tips;
  if (weekNumber != null && weekNumber != 0) {
    final weekSpecific = tips.where((t) => t['week_number'] == weekNumber).toList();
    filtered = weekSpecific.isNotEmpty ? weekSpecific : tips.where((t) => t['week_number'] == null || t['week_number'] == 0).toList();
  }
  if (filtered.isEmpty) filtered = tips;
  final today = now ?? DomainClock.now();
  final dayOfYear = (today.difference(DateTime(today.year, 1, 0)).inMilliseconds / 86400000).floor();
  return filtered[dayOfYear % filtered.length];
}

/// `useDailyTip(lifeStage, weekNumber)`.
final partnerDailyTipProvider = Provider.autoDispose.family<({String tipText, String tipEmoji, bool isLoading}), (String?, int?)>((ref, arg) {
  final q = ref.watch(partnerDailyTipsQuery(arg.$1));
  final tip = pickDailyTip(q.data ?? const [], arg.$2);
  final text = tip?['tip_text'];
  final emoji = tip?['tip_emoji'];
  return (
    tipText: text is String && text.isNotEmpty ? text : tr('usepartnerdailytips_heyat_yoldasiniza_bu_gun_gozel_b30548', 'Həyat yoldaşınıza bu gün gözəl bir jest edin!'),
    tipEmoji: emoji is String && emoji.isNotEmpty ? emoji : '💕',
    isLoading: q.isLoading,
  );
});

// ── Postpartum partner guide ─────────────────────────────────────────────────────────────────────────────────

/// `POSTPARTUM_WEEKS`.
const int kPostpartumWeeks = 8;

/// Week 1..8 from the baby's age in days; null once the programme is over.
int? postpartumWeek(int babyAgeDays) => babyAgeDays >= 0 && babyAgeDays < kPostpartumWeeks * 7 ? babyAgeDays ~/ 7 + 1 : null;

/// One week of the guide.
@immutable
class PostpartumWeekText {
  const PostpartumWeekText(this.raw);
  final Map<String, Object?> raw;
  String get title => '${raw['title'] ?? ''}';
  String get body => '${raw['body'] ?? ''}';
  String get mind => '${raw['mind'] ?? ''}';
  List<String> get doList => [for (final s in (raw['do'] as List? ?? const [])) '$s'];
  List<String> get say => [for (final s in (raw['say'] as List? ?? const [])) '$s'];
  String get avoid => '${raw['avoid'] ?? ''}';
}

/// `PostpartumPartnerText` (same shape as az.json): `ui` strings, 8 `weeks`, `blues`, `phrases`, `tasks`.
@immutable
class PostpartumPartnerText {
  const PostpartumPartnerText(this.raw);
  final Map<String, Object?> raw;

  /// `text.ui.<key>`.
  String ui(String key) => '${(raw['ui'] as Map?)?[key] ?? ''}';
  List<PostpartumWeekText> get weeks => [for (final w in (raw['weeks'] as List? ?? const [])) PostpartumWeekText(Map<String, Object?>.from(w as Map))];

  /// `text.blues` (title, intro, facts[], help_title, help[], ppd_*, urgent_*, self_title, self[]).
  Map<String, Object?> get blues => Map<String, Object?>.from(raw['blues'] as Map? ?? const {});
  List<String> get phrases => [for (final s in (raw['phrases'] as List? ?? const [])) '$s'];
  List<String> get tasks => [for (final s in (raw['tasks'] as List? ?? const [])) '$s'];
}

/// `loadPostpartumPartnerText(language)`: own language, else English, else Azerbaijani.
PostpartumPartnerText postpartumPartnerText(String language) =>
    PostpartumPartnerText(kPostpartumPartnerText[language] ?? kPostpartumPartnerText['en'] ?? kPostpartumPartnerText['az']!);
