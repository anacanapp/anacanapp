// Ported from: src/lib/weaning-entry.ts
//
// Entry points into the Süddən ayırma tool outside ToolsHub: the one-time home card, the cross-link in the feeding
// logger and the card under an Anacan.AI answer. All of them follow the same rules as the tile: Ana (mommy) module,
// admin switch `weaning_tool` = 'on'; the entry points need a child of 12+ months (the age at which a plan can be
// built). Nothing here is pushed or shown as an ad.
import 'dart:math' as math;

import '../../../domain/js_compat.dart';
import '../../../domain/weaning/weaning.dart';
import '../../../state/local_store.dart';

/// `WeaningEntry`: kind 'hidden' | 'intro' | 'active' (with the running step and progress).
class WeaningEntry {
  const WeaningEntry.hidden()
      : kind = 'hidden',
        step = null,
        done = 0,
        total = 0,
        paused = false;
  const WeaningEntry.intro()
      : kind = 'intro',
        step = null,
        done = 0,
        total = 0,
        paused = false;
  const WeaningEntry.active({required this.step, required this.done, required this.total, required this.paused}) : kind = 'active';
  final String kind;
  final WeaningStep? step;
  final int done;
  final int total;
  final bool paused;
}

/// Whether the tool can be offered at all (module, switch, 12+ months).
bool weaningOfferable({required String? lifeStage, required String? birthDate, required Object? setting, DateTime? now}) {
  if (lifeStage != 'mommy' || setting != 'on') return false;
  final months = ageInMonths(birthDate, now);
  return months != null && months >= planMinMonths;
}

bool _isLivePlan(WeaningPlan? p) => p != null && (p.status == 'active' || p.status == 'paused');

/// Home card: progress when a plan runs; otherwise a one-time card, gone after "continue" or dismiss.
WeaningEntry homeCardState({
  required String? lifeStage,
  required String? birthDate,
  required Object? setting,
  required WeaningPlan? plan,
  required bool continueBF,
  required bool dismissed,
  DateTime? now,
}) {
  if (!weaningOfferable(lifeStage: lifeStage, birthDate: birthDate, setting: setting, now: now)) return const WeaningEntry.hidden();
  if (_isLivePlan(plan)) {
    final done = plan!.steps.where((s) => s.status == 'done').length;
    return WeaningEntry.active(step: currentStep(plan), done: done, total: plan.steps.length, paused: plan.status == 'paused');
  }
  if (continueBF || dismissed) return const WeaningEntry.hidden();
  return const WeaningEntry.intro();
}

/// Feeding-logger link: only while no plan runs and the mother has not chosen to continue.
bool feedingLinkVisible({required String? lifeStage, required String? birthDate, required Object? setting, required WeaningPlan? plan, required bool continueBF, DateTime? now}) =>
    weaningOfferable(lifeStage: lifeStage, birthDate: birthDate, setting: setting, now: now) && !_isLivePlan(plan) && !continueBF;

// ── Plan prefill from the last 7 days of breastfeeding logs ───────────────────────────────────

/// `{ log_type, feed_type, start_time }` of a `baby_logs` row.
class FeedLog {
  const FeedLog({required this.logType, this.feedType, this.startTime});
  final String logType;
  final String? feedType;
  final String? startTime;
}

bool _isBreastfeed(FeedLog l) => l.logType == 'feeding' && l.feedType != null && l.feedType!.startsWith('breast');

/// Average daily breastfeeds by time of day: night 22:00–05:59, morning 06:00–08:59, bedtime 19:00–21:59, the rest
/// daytime. Averages over the days that have at least one breastfeed. Needs 3+ such days, else null (the builder
/// keeps its defaults). The nap feed cannot be told apart from daytime feeds, so it is kept.
Feeds? feedsFromLogs(List<FeedLog> logs, Feeds base, [DateTime? now]) {
  final n0 = now ?? DomainClock.now();
  final since = n0.millisecondsSinceEpoch - 7 * 86400000;
  final days = <String>{};
  var morning = 0, bedtime = 0, night = 0, day = 0;
  for (final l in logs) {
    if (!_isBreastfeed(l) || l.startTime == null || l.startTime!.isEmpty) continue;
    final t = jsParseDate(l.startTime!);
    if (t == null || t.millisecondsSinceEpoch < since || t.millisecondsSinceEpoch > n0.millisecondsSinceEpoch) continue;
    days.add('${t.year}-${t.month - 1}-${t.day}');
    final h = t.hour;
    if (h >= 22 || h < 6) {
      night++;
    } else if (h < 9) {
      morning++;
    } else if (h >= 19) {
      bedtime++;
    } else {
      day++;
    }
  }
  final n = days.length;
  if (n < 3) return null;
  final nap = base.nap;
  final dayFeeds = jsRoundInt(day / n) - (nap ? 1 : 0);
  return clampFeeds(Feeds(morning: morning / n >= 0.5, day: math.max(0, dayFeeds), nap: nap, bedtime: bedtime / n >= 0.5, night: jsRoundInt(night / n)));
}

// ── Anacan.AI: is this a weaning question? ────────────────────────────────────────────────────
RegExp _u(String p) => RegExp(p, unicode: true, caseSensitive: false);
RegExp _i(String p) => RegExp(p, caseSensitive: false);

final List<RegExp> _weaningPatterns = [
  // Azerbaijani: allow inflection (\p{L}) and up to three words in between ("süddən necə ayırım").
  _u(r'(süd|sud|döş|dos|sinə|sine|məmə)\p{L}*(\s+\p{L}+){0,3}\s+(ayır|ayir|kəs|kes)'),
  _u(r'əmizdirm\p{L}*(\s+\p{L}+){0,3}\s+(dayandır|kəs|bitir|tərgit)'),
  _i(r'\bwean'),
  _i(r'stop(ping)?\s+(breast|nursing|breastfeeding)'),
  _i('отлуч'),
  _i(r'(перестать|прекратить|бросить)\s+кормить\s+грудью'),
  _u(r'отказ\p{L}*\s+от\s+груди'),
  _u(r'(sütten|memeden)(\s+\p{L}+){0,2}\s+kes'),
  _u(r'emzirme\p{L}*(\s+\p{L}+){0,2}\s+(bırak|kes|bitir)'),
  _i('abstill'),
  _i('sevrage|sevrer'),
  _i('destet'),
  _i('desmam'),
  _u(r'odstaw\p{L}*\s+od\s+piersi'),
  _i('afvenn|spenen'),
  _i(r'avvänj|sluta\s+amma'),
  RegExp('فطام|فطم'),
  RegExp('断奶|戒奶|離乳|卒乳|断乳'),
  RegExp(r'젖\s*떼|단유'),
  _i(r'cai\s+sữa'),
  _i('menyapih|sapih'),
  RegExp(r'स्तनपान\s*छुड़|दूध\s*छुड़'),
  _i(r'емшектен\s+шығар|ажырат'),
  _i(r'эмчектен\s+ажырат'),
  _i(r"ko'?krak(dan)?\s+ajrat"),
  _i(r'rinnast\s+võõr'),
  RegExp(r'ძუძუს?\s*მოწყვეტ|ძუძუდან\s*მოხსნ'),
];

bool isWeaningQuestion(String? text) {
  if (text == null || text.isEmpty) return false;
  return _weaningPatterns.any((re) => re.hasMatch(text));
}

// ── Home card dismiss flag (per account and child; this phone only) ──────────────────────────
String _dismissKey(String? uid, String? childId) =>
    'anacan.weaning.homecard.v1.${uid == null || uid.isEmpty ? 'guest' : uid}.${childId == null || childId.isEmpty ? 'none' : childId}';

bool readHomeDismissed(LocalStore store, String? uid, String? childId) {
  try {
    return store.getItem(_dismissKey(uid, childId)) == '1';
  } catch (_) {
    return false;
  }
}

void writeHomeDismissed(LocalStore store, String? uid, String? childId) {
  try {
    store.setItem(_dismissKey(uid, childId), '1');
  } catch (_) {}
}
